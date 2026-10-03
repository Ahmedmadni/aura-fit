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

async function waitForJson(url, timeoutMs = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await timeout(150);
  }
  throw new Error(
    "Timed out waiting for Chrome DevTools endpoint: " +
      (lastError instanceof Error ? lastError.message : ""),
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
        if (ready && body.includes(expectedText)) return body;
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

    await navigate("/", "أهلاً بعودتك");

    const today = new Date().toISOString().slice(0, 10);
    const profile = {
      name: "Browser Smoke",
      level: "intermediate",
      goals: ["muscle-gain"],
      equipment: [
        "none",
        "mat",
        "dumbbells",
        "barbell",
        "kettlebell",
        "resistance-band",
        "pullup-bar",
        "bench",
        "machine",
        "cable",
        "cardio-machine",
        "weight-plate",
        "wall",
        "chair",
        "doorway",
        "towel",
        "box",
        "stability-ball",
      ],
      injuries: ["knee"],
      daysPerWeek: 3,
      sessionMinutes: 45,
      sleepQuality: 4,
      fatigue: 2,
      age: 32,
      weightKg: 80,
      heightCm: 178,
      gender: "male",
    };
    const readiness = [
      {
        dateKey: today,
        recordedAt: new Date().toISOString(),
        sleepQuality: 4,
        fatigue: 2,
        muscleSoreness: 2,
        energy: 4,
      },
    ];
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
        localStorage.setItem("kp.profile", ${JSON.stringify(JSON.stringify(profile))});
        localStorage.setItem("kp.profile.updated-at", ${JSON.stringify(new Date().toISOString())});
        localStorage.setItem("kp.readiness", ${JSON.stringify(JSON.stringify(readiness))});
        localStorage.setItem("kp.history", ${JSON.stringify(JSON.stringify(history))});
        return true;
      })()`,
    );

    await navigate("/", "Browser Smoke");

    const routes = [
      ["/programs", "التوزيع الحالي"],
      ["/workout?day=0", "استجابة الخطة"],
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

    await navigate("/profile", "ملف التدريب");

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

    // Reload once so the page is controlled by the active service worker.
    const reloaded = cdp.waitForEvent("Page.loadEventFired", 20000);
    await cdp.send("Page.reload", { ignoreCache: true });
    await reloaded;
    const controlled = await evaluate(
      "Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)",
    );
    if (!controlled) {
      throw new Error("Page is not controlled by the Aura Fit service worker.");
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
      "Browser smoke PASS: hydrated routes, real-data pages, workout UI, service worker and offline cached navigation all verified in headless Chrome.",
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
