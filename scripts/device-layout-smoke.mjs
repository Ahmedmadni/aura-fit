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

async function waitForJson(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await sleep(150);
  }
  throw new Error("Timed out waiting for Chrome DevTools endpoint.");
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
  const chromePath = findChrome();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-device-qa-"));
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
  } finally {
    cleanup();
  }
}

await main();
