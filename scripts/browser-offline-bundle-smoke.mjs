/**
 * Real Chromium render of the self-contained Android web bundle.
 * Local HTTP stands in for WebViewAssetLoader. After initial load, CDP
 * disables network and exercises client hash routes without any cloud user.
 * This is NOT an Android device/physical APK test.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve("android-offline/app/src/main/assets/web");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const server = createServer((request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const prefix = "/assets/web/";
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404); response.end(); return;
    }
    const rel = decodeURIComponent(pathname.slice(prefix.length));
    const filePath = path.resolve(root, rel);
    if (!(filePath.startsWith(root + path.sep)) || !existsSync(filePath)) {
      response.writeHead(404); response.end(); return;
    }
    response.setHeader("content-type", mime[path.extname(filePath)] ?? "application/octet-stream");
    response.end(readFileSync(filePath));
  } catch {
    response.writeHead(400); response.end();
  }
});

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 1; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.ws);
    await new Promise((ok,fail) => {
      this.socket.addEventListener("open", ok, { once: true });
      this.socket.addEventListener("error", fail, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const result = JSON.parse(String(event.data));
      if (!result.id) return;
      const entry = this.pending.get(result.id);
      if (!entry) return;
      this.pending.delete(result.id);
      if (result.error) entry.reject(new Error(result.error.message));
      else entry.resolve(result.result ?? {});
    });
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  close() { this.socket?.close(); }
}

async function main() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const chromePath = process.env.CHROME_PATH || ["google-chrome","chromium","chromium-browser"]
    .map((name) => spawnSync("which", [name], { encoding: "utf8" }))
    .find((result) => result.status === 0)?.stdout.trim();
  if (!chromePath) throw new Error("Chrome/Chromium unavailable for offline browser smoke");
  const debugPort = 19365;
  const profile = mkdtempSync(path.join(tmpdir(), "aura-offline-client-"));
  const env = {...process.env}; delete env.DBUS_SESSION_BUS_ADDRESS;
  const chrome = spawn(chromePath, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-background-networking", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--remote-allow-origins=*",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + debugPort,
    "--user-data-dir=" + profile, "about:blank",
  ], { stdio: ["ignore","ignore","pipe"], env });
  let stderr = ""; chrome.stderr?.on("data", (x) => { stderr = (stderr + x.toString()).slice(-4000); });
  let cdp;
  try {
    let page;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (chrome.exitCode != null) throw new Error("Chrome terminated: " + stderr);
      try {
        const response = await fetch("http://127.0.0.1:" + debugPort + "/json/list");
        const pages = await response.json();
        page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
        if (page) break;
      } catch {}
      await delay(200);
    }
    if (!page) throw new Error("Chrome CDP not reachable " + stderr);
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    const origin = "http://127.0.0.1:" + port;
    const url = origin + "/assets/web/index.html";
    const js = async (expression) => {
      const v = await cdp.send("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true,
      });
      if (v.exceptionDetails) throw new Error("JS: " + JSON.stringify(v.exceptionDetails));
      return v.result?.value;
    };
    async function waitForText(marker) {
      for (let i = 0; i < 120; i++) {
        const body = await js("document.body?.innerText ?? ''");
        if (String(body).includes(marker)) return;
        await delay(100);
      }
      throw new Error("Offline route did not render " + marker +
        ". Visible: " + String(await js("document.body?.innerText ?? ''")).slice(0,800));
    }

    async function clickButton(label) {
      const clicked = await js("(() => { const label = " + JSON.stringify(label) +
        "; const el = [...document.querySelectorAll('button')].find((node) => (node.innerText || '').trim() === label); if (!el) return false; el.click(); return true; })()");
      if (!clicked) throw new Error("Form button unavailable: " + label);
      await delay(120);
    }
    async function enterLabeledValue(label, value) {
      const applied = await js("(() => { const label = " + JSON.stringify(label) +
        "; const value = " + JSON.stringify(value) +
        "; const tag = [...document.querySelectorAll('label')].find((node) => (node.innerText || '').includes(label)); " +
        "const input = tag?.querySelector('input'); if (!input) return false; " +
        "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); " +
        "input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); return true; })()");
      if (!applied) throw new Error("Form field unavailable: " + label);
      await delay(120);
    }
    await cdp.send("Page.navigate", { url: url + "#/onboarding" });
    await waitForText("الخطوة ١ من ٨");

    // Real interactive onboarding forms. Invalid measurements must not advance
    // or enter the local user profile, while Arabic digits must persist.
    await enterLabeledValue("الاسم", "Offline Forms Tester");
    await enterLabeledValue("العمر", "0");
    await clickButton("التالي");
    await waitForText("أدخل العمر صحيحًا");
    if (!(await js("document.body.innerText.includes('الخطوة ١ من ٨')"))) {
      throw new Error("Invalid age advanced the onboarding form");
    }
    await enterLabeledValue("العمر", "٢٨");
    await clickButton("التالي");
    await waitForText("الخطوة ٢ من ٨");
    await clickButton("التالي");
    await waitForText("الخطوة ٣ من ٨");
    await enterLabeledValue("الطول", "999");
    await clickButton("التالي");
    await waitForText("أدخل الطول صحيحًا");
    await enterLabeledValue("الطول", "١٧٨٫٥");
    await enterLabeledValue("الوزن", "٧٦٫٥");
    await clickButton("التالي");
    await waitForText("الخطوة ٤ من ٨");
    for (const next of ["الخطوة ٥ من ٨", "الخطوة ٦ من ٨",
      "الخطوة ٧ من ٨", "الخطوة ٨ من ٨"]) {
      await clickButton("التالي");
      await waitForText(next);
    }
    await clickButton("أنشئ خطتي الأسبوعية");
    await waitForText("Offline Forms Tester");
    const completedForm = await js("JSON.parse(localStorage.getItem('kp.profile') || '{}')");
    if (completedForm.age !== 28 || completedForm.heightCm !== 178.5 ||
        completedForm.weightKg !== 76.5 || completedForm.name !== "Offline Forms Tester") {
      throw new Error("Onboarding form did not persist validated Arabic measurements");
    }
    const markers = await js("({ embedded: window.__AURA_EMBEDDED_ANDROID__, auth: localStorage.getItem('kp.cloud.session') })");
    if (!markers.embedded || markers.auth !== null) {
      throw new Error("Not a guest-only embedded Android build");
    }

    // No network after bootstrap. Hash history must not reload or call a server.
    await cdp.send("Network.emulateNetworkConditions", {
      offline: true, latency:0, downloadThroughput:0, uploadThroughput:0,
      connectionType:"none",
    });
    for (const [hash, label] of [
      ["#/profile","ملف التدريب"],
      ["#/programs","التوزيع الحالي"],
      ["#/builder","ابنِ جلستك"],
      ["#/progress","سجل القوة"],
      ["#/workout?day=0","استجابة الخطة"],
    ]) {
      await js(`window.location.hash = ${JSON.stringify(hash)}; true`);
      await waitForText(label);
      if (await js("localStorage.getItem('kp.cloud.session')") !== null)
        throw new Error("Offline navigation unexpectedly required a cloud session");
    }
    if (await js("JSON.parse(localStorage.getItem('kp.profile')).name") !== "Offline Forms Tester")
      throw new Error("Offline navigation lost saved profile");

    // Every exercise detail page must resolve in the packaged client while
    // network requests are disabled. Verify the actual rendered Latin name.
    const manifest = JSON.parse(readFileSync("src/data/workout-guide-manifest.json", "utf8"));
    const exercisesSeen = new Set();
    for (const exercise of manifest) {
      const hash = "#/exercise/" + encodeURIComponent(exercise.slug);
      // Replace instead of pushing hundreds of browser history entries:
      // Chrome throttles excessive fragment navigation as potential abuse.
      await js("location.replace(" + JSON.stringify(hash) + "); true");
      let rendered = false;
      for (let attempt = 0; attempt < 85; attempt++) {
        rendered = await js("(() => { const title = document.querySelector('section h1')?.innerText; " +
          "const latin = document.querySelector('section p[dir=ltr]')?.innerText; " +
          "return location.hash === " + JSON.stringify(hash) +
          " && Boolean(title) && latin === " + JSON.stringify(exercise.name) + "; })()");
        if (rendered) break;
        await delay(35);
      }
      if (!rendered) {
        const view = await js("({ hash: location.hash, heading: document.querySelector('section h1')?.innerText, " +
          "latin: document.querySelector('section p[dir=ltr]')?.innerText })");
        throw new Error("Exercise detail failed while offline: " + exercise.slug +
          " observed=" + JSON.stringify(view) +
          " - " + String(await js("document.body?.innerText ?? ''")).slice(0,250));
      }
      exercisesSeen.add(exercise.slug);
    }
    if (exercisesSeen.size !== 302) throw new Error("Not all 302 exercises rendered");

    // The library search and custom-plan editor are interactive while offline.
    await js("location.hash = '#/exercises'; true");
    await waitForText("مكتبة التمارين");
    await js("location.hash = '#/builder'; true");
    await waitForText("ابنِ جلستك");
    await clickButton("توليد ذكي");
    if (!(await js("document.body.innerText.includes('حفظ الخطة')"))) {
      throw new Error("Workout builder did not populate generated exercises");
    }
    await clickButton("حفظ الخطة");
    const plans = await js("JSON.parse(localStorage.getItem('kp.customPlans') || '[]')");
    if (!plans.length || !plans[0].slots?.length) throw new Error("Builder did not save actual exercises");
    await clickButton("ابدأ خطتي");
    await waitForText("استجابة الخطة");
    const selected = await js("location.hash");
    if (!selected.includes("custom=")) throw new Error("Builder launched a generated workout instead of saved custom plan");
    const activeTitle = await js("document.body.innerText");
    if (!activeTitle.includes("مجموعة 1 /")) throw new Error("Saved sets not shown in the active workout");
    console.log("Offline form/exercise browser PASS: numeric validation, full 8-step onboarding, " +
      exercisesSeen.size + " detail routes, builder save and custom workout launch.");
    console.log("Offline bundled browser PASS: first render + local profile + 5 guest routes with network disabled.");
  } finally {
    cdp?.close();
    chrome.kill("SIGTERM");
    if (chrome.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => chrome.once("exit", resolve)),
        delay(2500),
      ]);
    }
    server.close();
    try {
      rmSync(profile, { recursive:true, force:true, maxRetries:12, retryDelay:200 });
    } catch (error) {
      // Test assertions already completed; Chrome may still release a Linux
      // lock file asynchronously, which must not falsify successful UI QA.
      console.warn("Temporary browser profile cleanup incomplete:", String(error));
    }
  }
}

await main();
