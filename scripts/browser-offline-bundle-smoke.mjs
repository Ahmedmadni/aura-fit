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
        const body = await js("document.body.innerText");
        if (String(body).includes(marker)) return;
        await delay(100);
      }
      throw new Error("Offline route did not render " + marker +
        ". Visible: " + String(await js("document.body.innerText")).slice(0,800));
    }
    await cdp.send("Page.navigate", { url: url + "#/onboarding" });
    await waitForText("الخطوة ١ من ٨");
    const markers = await js("({ embedded: window.__AURA_EMBEDDED_ANDROID__, auth: localStorage.getItem('kp.cloud.session') })");
    if (!markers.embedded || markers.auth !== null) {
      throw new Error("Not a guest-only embedded Android build");
    }

    const guestProfile = {
      name:"Embedded Offline Tester", level:"beginner", goals:["general-fitness"],
      equipment:["none","mat"], injuries:[], daysPerWeek:3, sessionMinutes:30,
      sleepQuality:4,fatigue:2,
    };
    await js(`localStorage.setItem("kp.profile", ${JSON.stringify(JSON.stringify(guestProfile))}); true`);

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
    if (await js("JSON.parse(localStorage.getItem('kp.profile')).name") !== "Embedded Offline Tester")
      throw new Error("Offline navigation lost saved profile");
    console.log("Offline bundled browser PASS: first render + local profile + 5 guest routes with network disabled.");
  } finally {
    cdp?.close();
    chrome.kill("SIGTERM");
    server.close();
    rmSync(profile, { recursive:true, force:true });
  }
}

await main();
