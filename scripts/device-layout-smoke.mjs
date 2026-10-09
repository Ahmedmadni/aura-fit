import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.AURA_BASE_URL ?? "http://127.0.0.1:4173";
const DEBUG_PORT = Number(process.env.AURA_DEVICE_DEBUG_PORT ?? 9223);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIEWPORTS = [
  { name: "small-mobile", width: 320, height: 568, dpr: 2, mobile: true },
  { name: "mobile", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "tablet-portrait", width: 768, height: 1024, dpr: 2, mobile: true },
  { name: "tablet-landscape", width: 1024, height: 768, dpr: 2, mobile: false },
];

const ROUTES = [
  ["/", "أهلاً بعودتك"],
  ["/onboarding", "الخطوة ١ من ٨"],
  ["/exercises", "مكتبة التمارين"],
  ["/exercise/meadows-row", "Meadows Row"],
  ["/library", "المكتبة الشاملة"],
  ["/programs", "التوزيع الحالي"],
  ["/workout?day=0", "استجابة الخطة"],
  ["/progress", "سجل القوة"],
  ["/profile", "ملف التدريب"],
  ["/nutrition", "هدف طاقة تقديري"],
  ["/coach", "المدرب التحليلي"],
  ["/dna", "بصمة"],
  ["/builder", "ابنِ جلستك"],
];

function validateSafeAreaSources() {
  const requirements = [
    [
      "src/components/bottom-nav.tsx",
      'calc(1.25rem + env(safe-area-inset-bottom))',
    ],
    [
      "src/components/page-shell.tsx",
      'calc(8rem + env(safe-area-inset-bottom))',
    ],
    [
      "src/components/page-shell.tsx",
      'minHeight: "100dvh"',
    ],
    [
      "src/components/page-shell.tsx",
      'env(safe-area-inset-top)',
    ],
    [
      "src/routes/exercise.$id.tsx",
      'calc(6rem + env(safe-area-inset-bottom))',
    ],
    [
      "src/routes/onboarding.tsx",
      'calc(2rem + env(safe-area-inset-bottom))',
    ],
    [
      "src/routes/builder.tsx",
      'calc(1.25rem + env(safe-area-inset-bottom))',
    ],
    [
      "src/routes/builder.tsx",
      'maxHeight: "75dvh"',
    ],
    [
      "src/routes/__root.tsx",
      'viewport-fit=cover',
    ],
  ];

  for (const [relativePath, marker] of requirements) {
    const filePath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes(marker)) {
      throw new Error(
        "Safe-area device gate missing " + JSON.stringify(marker) +
          " in " + relativePath,
      );
    }
  }
}


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
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }

  throw new Error("Chrome/Chromium was not found on PATH.");
}

async function waitForJson(
  url,
  chrome,
  getChromeStderr,
  timeoutMs = 45000,
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
    await sleep(200);
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
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
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
  validateSafeAreaSources();
  const chromePath = findChrome();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-device-qa-"));
  // GitHub runners may expose an invalid session bus address. Chrome does not
  // need a user D-Bus session for headless CDP tests.
  const chromeEnv = { ...process.env };
  delete chromeEnv.DBUS_SESSION_BUS_ADDRESS;
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
    { stdio: ["ignore", "pipe", "pipe"], env: chromeEnv },
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
    ]);

    async function evaluate(expression) {
      const result = await cdp.send("Runtime.evaluate", {
        expression,
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

    async function seedStableProfile() {
      const result = await cdp.send("Page.navigate", { url: BASE_URL });
      if (result.errorText) {
        throw new Error("Could not open app origin before seeding device QA state.");
      }

      const expectedOrigin = new URL(BASE_URL).origin;
      let originReady = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        originReady = Boolean(
          await evaluate(
            `location.origin === ${JSON.stringify(expectedOrigin)} && document.readyState === "complete"`,
          ),
        );
        if (originReady) break;
        await sleep(100);
      }
      if (!originReady) {
        throw new Error("App origin did not become ready before seeding device QA state.");
      }

      const profile = {
        name: "Device QA",
        level: "intermediate",
        goals: ["muscle-gain"],
        equipment: ["dumbbells", "barbell", "machine", "cable"],
        injuries: [],
        daysPerWeek: 3,
        sessionMinutes: 45,
        sleepQuality: 4,
        fatigue: 2,
        age: 32,
        weightKg: 80,
        heightCm: 178,
        gender: "male",
      };

      await evaluate(
        `(() => {
          localStorage.setItem("kp.profile", ${JSON.stringify(JSON.stringify(profile))});
          localStorage.setItem("kp.history", "[]");
          localStorage.setItem("kp.readiness", "[]");
          return true;
        })()`,
      );
    }

    async function navigate(route, expectedText) {
      const result = await cdp.send("Page.navigate", {
        url: new URL(route, BASE_URL).href,
      });
      if (result.errorText) {
        throw new Error("Navigation failed for " + route + ": " + result.errorText);
      }

      let body = "";
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const ready = await evaluate('document.readyState === "complete"');
        body = String(await evaluate("document.body?.innerText ?? ''"));
        if (ready && body.includes(expectedText)) break;
        await sleep(100);
      }

      if (!body.includes(expectedText)) {
        throw new Error(
          "Expected text " + JSON.stringify(expectedText) +
            " was not found on " + route,
        );
      }

      const layout = await evaluate(`(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const main = document.querySelector("main#main-content");
        const nav = document.querySelector('nav[aria-label="التنقل الرئيسي"]');
        const mainRect = main?.getBoundingClientRect();
        const navRect = nav?.getBoundingClientRect();
        return {
          viewportWidth,
          pageOverflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          bodyOverflow:
            document.body.scrollWidth - document.documentElement.clientWidth,
          mainLeft: mainRect?.left ?? null,
          mainRight: mainRect?.right ?? null,
          mainWidth: mainRect?.width ?? null,
          navLeft: navRect?.left ?? null,
          navRight: navRect?.right ?? null,
          navWidth: navRect?.width ?? null,
          viewportFitCover:
            document.querySelector('meta[name="viewport"]')?.content?.includes("viewport-fit=cover") ??
            false,
        };
      })()`);

      if (Number(layout.pageOverflow) > 2 || Number(layout.bodyOverflow) > 2) {
        throw new Error(
          "Horizontal overflow on " + route + ": " + JSON.stringify(layout),
        );
      }

      if (
        layout.mainLeft === null ||
        layout.mainRight === null ||
        layout.mainLeft < -1 ||
        layout.mainRight > layout.viewportWidth + 1
      ) {
        throw new Error(
          "Main content escaped viewport on " + route + ": " +
            JSON.stringify(layout),
        );
      }

      if (!layout.viewportFitCover) {
        throw new Error("viewport-fit=cover missing on " + route);
      }

      if (
        layout.navLeft !== null &&
        (layout.navLeft < -1 || layout.navRight > layout.viewportWidth + 1)
      ) {
        throw new Error(
          "Bottom navigation escaped viewport on " + route + ": " +
            JSON.stringify(layout),
        );
      }
    }

    await seedStableProfile();

    for (const viewport of VIEWPORTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.dpr,
        mobile: viewport.mobile,
      });

      for (const [route, expectedText] of ROUTES) {
        await navigate(route, expectedText);
      }

      console.log(
        `Device layout PASS: ${viewport.name} ${viewport.width}x${viewport.height} @${viewport.dpr}x across ${ROUTES.length} routes.`,
      );
    }

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
