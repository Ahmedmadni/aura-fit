import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.AURA_BASE_URL ?? "http://127.0.0.1:4173";
const DEBUG_PORT = Number(process.env.AURA_CHROME_DEBUG_PORT ?? 9222);
const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const explicit = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;

  for (const name of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "chrome",
  ]) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) {
      return found.stdout.trim();
    }
  }
  throw new Error("Chrome/Chromium was not found on PATH.");
}

async function waitForJson(
  url,
  chrome,
  getChromeStderr,
  timeoutMs = 30000,
) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    if (chrome.exitCode !== null) {
      const stderr = getChromeStderr().trim();
      throw new Error(
        "Chrome exited before exposing DevTools (code " +
          chrome.exitCode +
          ")" +
          (stderr ? "\nChrome stderr (tail):\n" + stderr : ""),
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await timeout(200);
  }

  const stderr = getChromeStderr().trim();
  throw new Error(
    "Timed out after " +
      timeoutMs +
      "ms waiting for Chrome DevTools endpoint" +
      (lastError instanceof Error ? ": " + lastError.message : "") +
      (stderr ? "\nChrome stderr (tail):\n" + stderr : ""),
  );
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out connecting to Chrome DevTools.")),
        10000,
      );
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Chrome DevTools WebSocket connection failed."));
      });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }

      const callbacks = this.listeners.get(message.method);
      if (!callbacks) return;
      for (const callback of [...callbacks]) callback(message.params ?? {});
    });
  }

  on(method, callback) {
    const current = this.listeners.get(method) ?? new Set();
    current.add(callback);
    this.listeners.set(method, current);
    return () => current.delete(callback);
  }

  waitForEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for CDP event " + method));
      }, timeoutMs);
      const cleanup = this.on(method, (params) => {
        clearTimeout(timer);
        cleanup();
        resolve(params);
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function main() {
  const chromePath = findChrome();
  const profileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "aura-fit-browser-smoke-"),
  );
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=" + DEBUG_PORT,
      "--user-data-dir=" + profileDir,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let chromeStderr = "";
  chrome.stderr.on("data", (chunk) => {
    chromeStderr += String(chunk);
    if (chromeStderr.length > 6000) chromeStderr = chromeStderr.slice(-6000);
  });

  const cleanup = () => {
    try {
      chrome.kill("SIGTERM");
    } catch {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  };
  process.on("exit", cleanup);

  try {
    const pages = await waitForJson(
      "http://127.0.0.1:" + DEBUG_PORT + "/json/list",
      chrome,
      () => chromeStderr,
    );
    const page = pages.find((item) => item.type === "page") ?? pages[0];
    if (!page?.webSocketDebuggerUrl) {
      throw new Error("Chrome did not expose a debuggable page.");
    }

    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([
      cdp.send("Page.enable"),
      cdp.send("Runtime.enable"),
      cdp.send("Network.enable"),
      cdp.send("Log.enable"),
      cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      }),
    ]);

    const runtimeErrors = [];
    cdp.on("Runtime.exceptionThrown", (params) => {
      runtimeErrors.push(
        params.exceptionDetails?.exception?.description ??
          params.exceptionDetails?.text ??
          "Uncaught runtime exception",
      );
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry?.level === "error") runtimeErrors.push(entry.text);
    });

    async function evaluate(expression, awaitPromise = false) {
      const result = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text ??
            "Browser evaluation failed.",
        );
      }
      return result.result?.value;
    }

    async function navigate(route, expectedText) {
      const loaded = cdp.waitForEvent("Page.loadEventFired", 20000);
      const result = await cdp.send("Page.navigate", {
        url: new URL(route, BASE_URL).href,
      });
      if (result.errorText) {
        throw new Error("Navigation failed for " + route + ": " + result.errorText);
      }
      await loaded;
      let body = "";
      for (let attempt = 0; attempt < 100; attempt += 1) {
        body = String(await evaluate("document.body?.innerText ?? ''"));
        const ready = await evaluate('document.readyState === "complete"');
        if (ready && body.includes(expectedText)) {
          const overflow = await evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth",
          );
          if (Number(overflow) > 2) {
            throw new Error(
              "Horizontal overflow detected on " + route + ": " + overflow + "px",
            );
          }
          return body;
        }
        await timeout(100);
      }
      throw new Error(
        "Expected text " +
          JSON.stringify(expectedText) +
          " was not found on " +
          route +
          ". Body starts with: " +
          JSON.stringify(String(body).slice(0, 400)),
      );
    }

    async function waitForText(text, timeoutMs = 10000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const body = String(await evaluate("document.body?.innerText ?? ''"));
        if (body.includes(text)) return body;
        await timeout(100);
      }
      throw new Error("Timed out waiting for text " + JSON.stringify(text));
    }

    async function waitForExpression(expression, label, timeoutMs = 15000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await evaluate(expression)) return;
        await timeout(100);
      }
      throw new Error("Timed out waiting for " + label);
    }


    async function clickText(text, exact = false) {
      const clicked = await evaluate(
        `(() => {
          const target = ${JSON.stringify(text)};
          const elements = [...document.querySelectorAll("button, a")];
          const element = elements.find((node) => {
            const value = (node.textContent || "").trim().replace(/\\s+/g, " ");
            return ${exact ? "value === target" : "value.includes(target)"};
          });
          if (!element) return false;
          element.click();
          return true;
        })()`,
      );
      if (!clicked) {
        throw new Error("Could not find clickable text " + JSON.stringify(text));
      }
      await timeout(120);
    }

    async function clickAria(label) {
      const clicked = await evaluate(
        `(() => {
          const node = document.querySelector(
            '[aria-label="' + ${JSON.stringify(label)}.replace(/"/g, '\\"') + '"]'
          );
          if (!node) return false;
          node.click();
          return true;
        })()`,
      );
      if (!clicked) {
        throw new Error("Could not find aria-label " + JSON.stringify(label));
      }
      await timeout(80);
    }

    async function setLabeledInput(label, value) {
      const changed = await evaluate(
        `(() => {
          const target = ${JSON.stringify(label)};
          const labels = [...document.querySelectorAll("label")];
          const wrapper = labels.find((node) =>
            (node.textContent || "").includes(target)
          );
          const input = wrapper?.querySelector("input");
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set;
          setter?.call(input, ${JSON.stringify(value)});
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`,
      );
      if (!changed) {
        throw new Error("Could not find input for label " + JSON.stringify(label));
      }
      await timeout(80);
    }

    await navigate("/", "أهلاً بعودتك");

    const accessibilityShell = await evaluate(`(() => {
      const skip = document.querySelector('a.skip-link[href="#main-content"]');
      const main = document.querySelector("main#main-content");
      const nav = document.querySelector('nav[aria-label="التنقل الرئيسي"]');
      const current = nav?.querySelector('[aria-current="page"]');
      const navTargets = nav
        ? [...nav.querySelectorAll("a")].map((node) =>
            Math.round(node.getBoundingClientRect().height),
          )
        : [];
      return {
        hasSkip: Boolean(skip),
        hasMain: Boolean(main),
        mainTabIndex: main?.getAttribute("tabindex"),
        hasNav: Boolean(nav),
        currentText: (current?.textContent || "").trim(),
        minNavTargetHeight: navTargets.length ? Math.min(...navTargets) : 0,
      };
    })()`);

    if (
      !accessibilityShell?.hasSkip ||
      !accessibilityShell?.hasMain ||
      accessibilityShell.mainTabIndex !== "-1" ||
      !accessibilityShell.hasNav ||
      !accessibilityShell.currentText.includes("الرئيسية") ||
      accessibilityShell.minNavTargetHeight < 44
    ) {
      throw new Error(
        "Accessibility shell validation failed: " +
          JSON.stringify(accessibilityShell),
      );
    }

    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    const reducedMotionDuration = await evaluate(`(() => {
      const probe = document.createElement("div");
      probe.className = "animate-enter";
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).animationDuration;
      probe.remove();
      return value;
    })()`);
    const reducedMotionSeconds = Number.parseFloat(
      String(reducedMotionDuration).replace("ms", ""),
    );
    const reducedMotionIsMs = String(reducedMotionDuration).includes("ms");
    const normalizedReducedMotionSeconds = reducedMotionIsMs
      ? reducedMotionSeconds / 1000
      : reducedMotionSeconds;
    if (
      !Number.isFinite(normalizedReducedMotionSeconds) ||
      normalizedReducedMotionSeconds > 0.001
    ) {
      throw new Error(
        "Reduced-motion preference did not suppress animation duration: " +
          reducedMotionDuration,
      );
    }
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });

    await evaluate("localStorage.clear(); true");

    // Full mobile onboarding through the actual UI.
    await navigate("/onboarding", "الخطوة ١ من ٨");
    await setLabeledInput("الاسم", "Browser E2E");
    await setLabeledInput("العمر", "32");
    await clickText("التالي", true);

    await waitForText("الخطوة ٢ من ٨");
    await clickText("ذكر", true);
    await clickText("التالي", true);

    await waitForText("الخطوة ٣ من ٨");
    await setLabeledInput("الطول", "178");
    await setLabeledInput("الوزن", "80");
    await clickText("التالي", true);

    await waitForText("الخطوة ٤ من ٨");
    await clickText("متوسط", true);
    await clickText("التالي", true);

    await waitForText("الخطوة ٥ من ٨");
    await clickText("بناء العضلات", true);
    await clickText("التالي", true);

    await waitForText("الخطوة ٦ من ٨");
    await clickText("دمبل", true);
    await clickText("باربل", true);
    await clickText("كابل / أجهزة", true);
    await clickText("التالي", true);

    await waitForText("الخطوة ٧ من ٨");
    await clickText("الركبة", true);
    await clickText("التالي", true);

    await waitForText("الخطوة ٨ من ٨");
    await clickText("3", true);
    await clickText("45 د", true);
    await clickText("أنشئ خطتي الأسبوعية");

    await waitForExpression(
      `(() => {
        try {
          const profile = JSON.parse(localStorage.getItem("kp.profile") || "{}");
          return location.pathname === "/" && profile.name === "Browser E2E";
        } catch {
          return false;
        }
      })()`,
      "onboarding profile persistence and home navigation",
    );
    await waitForText("Browser E2E", 15000);
    const onboardingProfile = await evaluate(
      'JSON.parse(localStorage.getItem("kp.profile") || "{}")',
    );
    if (
      onboardingProfile.name !== "Browser E2E" ||
      onboardingProfile.level !== "intermediate" ||
      onboardingProfile.daysPerWeek !== 3 ||
      onboardingProfile.sessionMinutes !== 45 ||
      !onboardingProfile.injuries?.includes("knee") ||
      !onboardingProfile.equipment?.includes("dumbbells") ||
      !onboardingProfile.equipment?.includes("barbell")
    ) {
      throw new Error(
        "Onboarding did not persist the expected profile: " +
          JSON.stringify(onboardingProfile),
      );
    }

    // Daily readiness through the actual controls.
    await waitForText("كيف حالك اليوم؟");
    await clickAria("جودة النوم 5 من 5");
    await clickAria("التعب 2 من 5");
    await clickAria("ألم العضلات 2 من 5");
    await clickAria("الطاقة 5 من 5");
    await clickText("حفظ تقييم اليوم");
    await waitForText("تقييم اليوم مسجل");

    const storedReadiness = await evaluate(
      'JSON.parse(localStorage.getItem("kp.readiness") || "[]")',
    );
    if (
      !storedReadiness.length ||
      storedReadiness[0].sleepQuality !== 5 ||
      storedReadiness[0].fatigue !== 2 ||
      storedReadiness[0].muscleSoreness !== 2 ||
      storedReadiness[0].energy !== 5
    ) {
      throw new Error(
        "Readiness check-in did not persist through the UI: " +
          JSON.stringify(storedReadiness),
      );
    }

    const workoutBody = await navigate("/workout?day=0", "استجابة الخطة");
    if (!workoutBody.includes("فلترة الإصابة فعّالة")) {
      throw new Error("Workout did not show active knee safety filtering.");
    }
    if (workoutBody.includes("لم يتم تسجيل Check-in اليوم")) {
      throw new Error("Workout ignored the daily readiness check-in.");
    }

    // Seed only a completed strength entry so progress analytics can be tested.
    const history = [
      {
        id: "browser-smoke-workout",
        date: new Date().toISOString(),
        exercises: [
          {
            id: "bench-press",
            sets: 3,
            reps: "8-12",
            completed: true,
            setReps: [10, 10, 10],
            setLoadsKg: [70, 70, 70],
            setRir: [2, 2, 2],
            setRpe: [8, 8, 8],
            progressionAction: "hold",
          },
        ],
        durationSec: 2700,
        activeSec: 2100,
        calories: 300,
        intensity: 75,
        performance: 90,
        adaptationMode: "maintain",
        readinessScore: 82,
        periodizationPhase: "progression",
        periodizationCycleWeek: 2,
      },
    ];

    await evaluate(
      `(() => {
        localStorage.setItem("kp.history", ${JSON.stringify(JSON.stringify(history))});
        localStorage.setItem(
          "kp.cloud.session",
          JSON.stringify({
            access_token: "BROWSER_SMOKE_ACCESS",
            refresh_token: "BROWSER_SMOKE_REFRESH",
            user: {
              id: "browser-smoke-user",
              email: "browser-smoke@example.test",
            },
          }),
        );
        return true;
      })()`,
    );

    await navigate("/", "Browser E2E");

    const routes = [
      ["/programs", "التوزيع الحالي"],
      ["/workout?day=0", "فلترة الإصابة فعّالة"],
      ["/progress", "سجل القوة"],
      ["/profile", "ملف التدريب"],
      ["/coach", "المدرب التحليلي"],
      ["/nutrition", "هدف طاقة تقديري"],
      ["/dna", "بصمة"],
      ["/library", "المكتبة الشاملة"],
      ["/builder", "ابنِ جلستك"],
    ];

    for (const [route, text] of routes) {
      await navigate(route, text);
    }

    const profileBody = await navigate("/profile", "ملف التدريب");
    if (
      !profileBody.includes("تصدير واستعادة بيانات التدريب") ||
      !profileBody.includes("فحص ملف للاستعادة")
    ) {
      throw new Error("Safe local backup controls are missing from Profile.");
    }

    const preservedCloudSession = await evaluate(
      'JSON.parse(localStorage.getItem("kp.cloud.session") || "null")',
    );
    if (
      preservedCloudSession?.user?.id !== "browser-smoke-user" ||
      preservedCloudSession?.refresh_token !== "BROWSER_SMOKE_REFRESH"
    ) {
      throw new Error(
        "Profile hydration changed the existing cloud session unexpectedly.",
      );
    }

    // Simulate Chromium's installability event so the profile install UX is
    // exercised without depending on CI's browser-installability heuristics.
    await evaluate(`(() => {
      window.__auraInstallPromptCalls = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperty(event, "prompt", {
        value: async () => {
          window.__auraInstallPromptCalls += 1;
        },
      });
      Object.defineProperty(event, "userChoice", {
        value: Promise.resolve({
          outcome: "accepted",
          platform: "web",
        }),
      });
      window.dispatchEvent(event);
      return true;
    })()`);
    await waitForText("تثبيت Aura Fit");

    // beforeinstallprompt cannot be fully emulated as a native Chromium
    // BeforeInstallPromptEvent in CI. Static validation verifies that the
    // button calls prompt() and awaits userChoice; the browser journey verifies
    // event-driven visibility plus the real appinstalled lifecycle.
    await evaluate(
      'window.dispatchEvent(new Event("appinstalled")); true',
    );
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const body = String(await evaluate("document.body?.innerText ?? ''"));
      if (!body.includes("تثبيت التطبيق")) break;
      await timeout(100);
    }
    const installCardStillVisible = String(
      await evaluate("document.body?.innerText ?? ''"),
    ).includes("تثبيت التطبيق");
    if (installCardStillVisible) {
      throw new Error("PWA install card did not hide after appinstalled.");
    }

    const swState = await evaluate(
      `navigator.serviceWorker
        ? navigator.serviceWorker.ready.then((registration) => ({
            active: registration.active?.state ?? null,
            scope: registration.scope,
          }))
        : Promise.resolve(null)`,
      true,
    );

    if (!swState || swState.active !== "activated") {
      throw new Error(
        "Production service worker did not activate: " +
          JSON.stringify(swState),
      );
    }

    // Reload once so the page can become controlled by the active service
    // worker. Chromium may expose an activated registration slightly before
    // navigator.serviceWorker.controller is updated, so wait for that handoff.
    const reloaded = cdp.waitForEvent("Page.loadEventFired", 20000);
    await cdp.send("Page.reload", { ignoreCache: true });
    await reloaded;

    let controlled = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      controlled = Boolean(
        await evaluate(
          "Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)",
        ),
      );
      if (controlled) break;
      await timeout(100);
    }

    if (!controlled) {
      // A second online navigation is the standards-compatible fallback after
      // first activation when the initial page was created before SW control.
      await navigate("/profile", "ملف التدريب");
      for (let attempt = 0; attempt < 50; attempt += 1) {
        controlled = Boolean(
          await evaluate(
            "Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)",
          ),
        );
        if (controlled) break;
        await timeout(100);
      }
    }

    if (!controlled) {
      throw new Error(
        "Page is not controlled by the Aura Fit service worker after activation and online navigation.",
      );
    }

    // The profile route has now been visited online and should be in runtime cache.
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
      connectionType: "none",
    });

    const offlineLoaded = cdp.waitForEvent("Page.loadEventFired", 20000);
    const offlineNavigate = await cdp.send("Page.navigate", {
      url: new URL("/profile", BASE_URL).href,
    });
    if (offlineNavigate.errorText) {
      throw new Error(
        "Offline navigation returned " + offlineNavigate.errorText,
      );
    }
    await offlineLoaded;
    const offlineBody = await evaluate("document.body.innerText");
    if (!String(offlineBody).includes("ملف التدريب")) {
      throw new Error(
        "Previously visited profile route was not available offline.",
      );
    }

    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "wifi",
    });

    const filteredErrors = runtimeErrors.filter(
      (message) =>
        !/favicon|ResizeObserver loop|Failed to load resource.*raw\.githubusercontent/i.test(
          message,
        ),
    );
    if (filteredErrors.length) {
      throw new Error(
        "Browser runtime errors:\n" + filteredErrors.slice(0, 10).join("\n"),
      );
    }

    console.log(
      "Browser smoke PASS: mobile onboarding, readiness, injury-safe workout, hydration-safe cloud session, safe backup controls, PWA install UX, real-data routes, service worker and offline cached navigation all verified in headless Chrome.",
    );

    cdp.close();
  } catch (error) {
    console.error(
      error instanceof Error ? error.stack ?? error.message : error,
    );
    if (chromeStderr) {
      console.error("\nChrome stderr (tail):\n" + chromeStderr);
    }
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

await main();
