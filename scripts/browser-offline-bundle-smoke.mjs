/**
 * Real Chromium render of the self-contained Android web bundle.
 * Local HTTP bootstraps the bundle, then Chrome Fetch intercepts every
 * request: packaged files are fulfilled from disk like WebViewAssetLoader,
 * while every other origin and missing path is rejected. No remote requests
 * or post-bootstrap HTTP fetches are allowed.
 * This is NOT an Android device/physical APK test.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
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
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
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
      if (!result.id) {
        this.onEvent?.(result);
        return;
      }
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

    // Simulate Android WebViewAssetLoader faithfully: every asset request is
    // fulfilled from APK files in the CI workspace (no HTTP/network), and
    // ALL remote domains, requests with queries and unknown files are denied.
    // CDP Network.emulateNetworkConditions(offline=true) incorrectly blocks
    // the HTTP test origin as well; the real Android app intercepts that
    // synthetic HTTPS host from assets without granting INTERNET permission.
    const deniedRemote = [];
    const assetErrors = [];
    let fulfilledAssets = 0;
    cdp.onEvent = (message) => {
      if (message.method !== "Fetch.requestPaused") return;
      const requestId = message.params.requestId;
      const url = message.params.request.url;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "blob:") {
          // Local IndexedDB media is played from a browser-internal blob URL.
          // It never makes a network request and remains valid while offline.
          void cdp.send("Fetch.continueRequest", { requestId })
            .catch((e) => assetErrors.push("Local blob unavailable: " + String(e)));
          return;
        }
        const prefix = "/assets/web/";
        if (parsed.origin !== origin || !parsed.pathname.startsWith(prefix) ||
            parsed.search || message.params.request.method !== "GET") {
          deniedRemote.push(url);
          void cdp.send("Fetch.failRequest", { requestId,
            errorReason:"BlockedByClient" }).catch((e) => assetErrors.push(String(e)));
          return;
        }
        const relative = decodeURIComponent(parsed.pathname.slice(prefix.length));
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep) || !existsSync(file)) {
          assetErrors.push("Bundled asset not found: " + url);
          void cdp.send("Fetch.failRequest", { requestId,
            errorReason:"Failed" }).catch((e) => assetErrors.push(String(e)));
          return;
        }
        fulfilledAssets++;
        const body = readFileSync(file);
        void cdp.send("Fetch.fulfillRequest", {
          requestId, responseCode:200,
          responseHeaders: [
            { name:"Content-Type", value:mime[path.extname(file)] ?? "application/octet-stream" },
            { name:"Cache-Control", value:"no-store" },
          ],
          body:body.toString("base64"),
        }).catch((e) => assetErrors.push("Failed to fulfill " + url + ": " + String(e)));
      } catch(error) {
        assetErrors.push("Invalid intercepted request " + url + ": " + String(error));
        void cdp.send("Fetch.failRequest", { requestId,
          errorReason:"Failed" }).catch(() => {});
      }
    };
    await cdp.send("Fetch.enable", {
      patterns:[{urlPattern:"*",requestStage:"Request"}],
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
    const mappings = JSON.parse(readFileSync("src/data/exercise-media-map.json", "utf8"));
    const exercisesSeen = new Set();
    let animatedRendered = 0;
    let sourceFramesRendered = 0;
    for (const exercise of manifest) {
      const hash = "#/exercise/" + encodeURIComponent(exercise.slug);
      // Replace instead of pushing hundreds of browser history entries:
      // Chrome throttles excessive fragment navigation as potential abuse.
      await js("location.replace(" + JSON.stringify(hash) + "); true");
      // Browser anti-abuse guards silently ignore hundreds of fragment
      // navigations made in a short burst. Model realistic user pacing so
      // every exercise can actually be visited and asserted.
      await delay(400);
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
      // Verify the REAL displayed image decodes in an offline browser.
      // Rendering the name is not enough: a broken GIF could silently fall
      // back to a generic squat illustration unrelated to this exercise.
      const mapped = mappings[exercise.slug];
      const approved = mapped.matchConfidence === "exact" || mapped.matchConfidence === "high";
      const expectedMode = approved ? "approved-gif" : "frame";
      const expectedPrefix = "/assets/web/media/" + (approved ? "gifs/" : "frames/");
      let mediaLoaded = false;
      for (let attempt=0; attempt<75; attempt++) {
        const status = await js("(() => { const player = document.querySelector('[data-exercise-media-mode]'); " +
          "const img = player?.querySelector('img'); " +
          "return { mode: player?.getAttribute('data-exercise-media-mode'), " +
          "source: img?.getAttribute('src'), decoded: Boolean(img?.complete && img?.naturalWidth > 0) }; })()");
        if (status.mode === expectedMode && status.decoded &&
            status.source?.startsWith(expectedPrefix)) {
          mediaLoaded = true; break;
        }
        await delay(45);
      }
      if (!mediaLoaded) {
        const diagnostic = await js("(() => { const p = document.querySelector('[data-exercise-media-mode]'); " +
          "const img = p?.querySelector('img'); " +
          "return { mode:p?.dataset.exerciseMediaMode, url:img?.src, width:img?.naturalWidth }; })()");
        throw new Error("Exercise animation/frame did not decode offline: " +
          exercise.slug + ", expected=" + expectedMode + ", got=" + JSON.stringify(diagnostic));
      }
      if (approved) animatedRendered++;
      else sourceFramesRendered++;
      exercisesSeen.add(exercise.slug);
    }
    if (exercisesSeen.size !== 302 || animatedRendered !== 191 || sourceFramesRendered !== 111) {
      throw new Error("Exercise media coverage incorrect: " + JSON.stringify({
        pages: exercisesSeen.size, animatedRendered, sourceFramesRendered,
      }));
    }

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
    // The previously opened generated workout left a recoverable draft.
    // The app must NOT overwrite it without a visible, explicit decision.
    const afterLaunch = await js("document.body?.innerText ?? ''");
    if (afterLaunch.includes("جلسة غير مكتملة")) {
      await clickButton("بدء الجديدة وحذف المحفوظة");
    }
    await waitForText("استجابة الخطة");
    const selected = await js("location.hash");
    if (!selected.includes("custom=")) throw new Error("Builder launched a generated workout instead of saved custom plan");
    const activeTitle = await js("document.body.innerText");
    if (!activeTitle.includes("مجموعة 1 /")) throw new Error("Saved sets not shown in the active workout");
    if (assetErrors.length || deniedRemote.length) {
      throw new Error("Android-media simulation requested missing/external assets: " +
        JSON.stringify({errors:assetErrors.slice(0,10),external:deniedRemote.slice(0,10)}));
    }
    if (fulfilledAssets < 302) {
      throw new Error("APK asset loader served too few requests: " + fulfilledAssets);
    }
    // The app must let the user attach a licensed animation from Android
    // documents and persist it to IndexedDB. Test all real UI actions, blob
    // decoding, reload persistence, and deletion with an already-matched GIF.
    async function pickedFile(fileName) {
      const doc = await cdp.send("DOM.getDocument", { depth: 1 });
      const input = await cdp.send("DOM.querySelector", {
        nodeId: doc.root.nodeId, selector: '[data-testid="local-motion-file"]',
      });
      if (!input.nodeId) throw new Error("Exercise motion picker missing");
      await cdp.send("DOM.setFileInputFiles", {
        nodeId: input.nodeId, files: [fileName],
      });
    }
    async function waitForMediaMode(mode) {
      for (let attempt=0; attempt<110; attempt++) {
        if (await js("document.querySelector('[data-exercise-media-mode]')?.getAttribute('data-exercise-media-mode')") === mode)
          return;
        await delay(75);
      }
      throw new Error("Media player not switched to " + mode + " after selection");
    }
    await js("location.hash = '#/exercise/bench-press'; true");
    await waitForText("Bench Press");
    await clickButton("الحركة");
    await waitForText("إضافة حركة مرخصة");
    const gif = path.resolve(root, "media/gifs/bench-press.gif");
    if (!existsSync(gif)) throw new Error("Missing licensed bench-press fixture");
    await pickedFile(gif);
    await waitForText("ملف الحركة محفوظ");
    await waitForMediaMode("local-gif");
    await js("location.hash = '#/profile'; true");
    await waitForText("ملف التدريب");
    await js("location.hash = '#/exercise/bench-press'; true");
    await waitForMediaMode("local-gif");
    await clickButton("الحركة");
    await waitForText("ملف الحركة محفوظ");
    await clickButton("حذف الملف المحلي");
    await clickButton("تأكيد الحذف");
    await waitForText("حُذف الملف المحلي");
    await waitForMediaMode("approved-gif");

    // Reject forged file formats, not just extensions.
    const fakeFile = path.join(profile, "invalid.mp4");
    writeFileSync(fakeFile, Buffer.alloc(400, 33));
    await pickedFile(fakeFile);
    await waitForText("الصيغة غير مدعومة");

    // Real H.264 MP4 sample if the image runner has FFmpeg. Playback is
    // checked via HTMLVideoElement metadata, not inferred from file naming.
    const clip = path.join(profile, "test-motion.mp4");
    const encoder = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", "color=c=black:s=160x120:r=5:d=1",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-an", clip,
    ], { encoding:"utf8", timeout: 15000 });
    if (encoder.status === 0 && existsSync(clip)) {
      await pickedFile(clip);
      await waitForText("ملف الحركة محفوظ");
      await waitForMediaMode("local-video");
      let videoReady = false;
      for (let attempt=0; attempt<80; attempt++) {
        videoReady = await js("(() => { const v=document.querySelector('[data-exercise-media-mode=local-video] video'); " +
          "return Boolean(v && v.videoWidth > 0 && v.videoHeight > 0 && Number.isFinite(v.duration)); })()");
        if (videoReady) break;
        await delay(80);
      }
      if (!videoReady) throw new Error("Imported MP4 did not decode");
      await clickButton("حذف الملف المحلي");
      await clickButton("تأكيد الحذف");
      await waitForMediaMode("approved-gif");
      console.log("Local video importer PASS: GIF and H.264 MP4, local IndexedDB persistence, deletion and invalid file refusal.");
    } else {
      console.warn("H.264 clip integration skipped: ffmpeg missing or encoder unavailable", encoder.stderr?.slice(0,300));
      console.log("Local media importer PASS: GIF, IndexedDB persistence, deletion and forged MP4 rejection.");
    }

    // Two-user-supplied files with canonical exercise slugs must import
    // into the matching catalog records, not another movement.
    await js("location.hash = '#/exercises'; true");
    await waitForText("مكتبة التمارين");
    const opened = await js("(() => { const b = document.querySelector('button[aria-controls=local-motion-bulk-panel]'); if(!b) return false; b.click(); return true; })()");
    if (!opened) throw new Error("Bulk motion library is inaccessible");
    const doc = await cdp.send("DOM.getDocument", { depth: 1 });
    const chooser = await cdp.send("DOM.querySelector", {
      nodeId:doc.root.nodeId, selector:'[data-testid="batch-motion-input"]',
    });
    if (!chooser.nodeId) throw new Error("Bulk multi-file picker missing");
    const pushupGif = path.resolve(root, "media/gifs/push-up.gif");
    await cdp.send("DOM.setFileInputFiles", {
      nodeId:chooser.nodeId, files:[gif,pushupGif],
    });
    await waitForText("تأكيد ربط 2 حركة محلية");
    await clickButton("تأكيد ربط 2 حركة محلية");
    await waitForText("حُفظت 2 حركة من 2");
    await js("location.hash = '#/exercise/push-up'; true");
    await waitForMediaMode("local-gif");
    await clickButton("الحركة");
    await clickButton("حذف الملف المحلي");
    await clickButton("تأكيد الحذف");
    await waitForMediaMode("approved-gif");
    await js("location.hash = '#/exercise/bench-press'; true");
    await waitForMediaMode("local-gif");
    await clickButton("الحركة");
    await clickButton("حذف الملف المحلي");
    await clickButton("تأكيد الحذف");
    await waitForMediaMode("approved-gif");
    console.log("Bulk media import PASS: 2 licensed GIFs matched by exact exercise slugs and removable independently.");

    if (assetErrors.length || deniedRemote.length) {
      throw new Error("Local exercise media accessed external network/missing asset: " +
        JSON.stringify({errors:assetErrors.slice(0,5),external:deniedRemote.slice(0,5)}));
    }
    console.log("APK asset loader simulation PASS: " + fulfilledAssets +
      " local assets served from disk; no external requests.");
    console.log("Offline form/exercise browser PASS: numeric validation, full 8-step onboarding, " +
      exercisesSeen.size + " detail routes (191 GIFs and 111 source frame previews), builder save and custom workout launch.");
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
