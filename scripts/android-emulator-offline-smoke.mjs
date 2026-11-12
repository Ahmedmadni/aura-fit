/**
 * Phase 66: runtime smoke on an ACTUAL Android emulator WebView, not Chrome.
 *
 * The APK is installed BEFORE any page load and wireless networks are
 * disabled. Debug-only WebView DevTools is reached through ADB's local socket.
 * This tests Android WebViewAssetLoader, first render, offline GIF/SVG decode,
 * hash navigation, profile persistence, and IndexedDB Blob local playback.
 *
 * Requires: GitHub Actions Android emulator, Node 22+, adb and a debug APK.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const APK = process.argv[2] || "android-offline/app/build/outputs/apk/debug/app-debug.apk";
const PACKAGE = "com.aurafit.offline";
const LOCAL_HOST = "appassets.androidplatform.net";
const PORT = 19229;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function adb(...args) {
  try {
    return execFileSync("adb", args, { encoding: "utf8", timeout: 40_000 }).trim();
  } catch (error) {
    throw new Error("ADB command failed: " + args.join(" ") + ": " + String(error));
  }
}
function inspectLog() {
  try {
    return execFileSync("adb", ["logcat","-d","-t","400","-s","chromium:E","AndroidRuntime:E"],
      { encoding:"utf8", timeout: 30_000 }).slice(-4000);
  } catch { return "(no logcat)"; }
}

class DevTools {
  constructor(url) { this.url = url; this.nextId = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve,reject) => {
      this.ws.addEventListener("open", resolve, { once:true });
      this.ws.addEventListener("error", reject, { once:true });
    });
    this.ws.addEventListener("message", event => {
      let result;
      try { result = JSON.parse(String(event.data)); } catch { return; }
      if (!result.id) return;
      const pending = this.pending.get(result.id);
      if (!pending) return;
      this.pending.delete(result.id);
      if (result.error) pending.reject(new Error(result.error.message));
      else pending.resolve(result.result || {});
    });
    await this.call("Runtime.enable");
    await this.call("Page.enable");
  }
  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve,reject) => {
      this.pending.set(id, {resolve,reject});
      this.ws.send(JSON.stringify({id,method,params}));
    });
  }
  async js(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression, returnByValue:true, awaitPromise:true,
    });
    if (result.exceptionDetails) {
      throw new Error("Android WebView JS exception: " +
        JSON.stringify(result.exceptionDetails).slice(0,850));
    }
    return result.result?.value;
  }
  close() { try { this.ws.close(); } catch {} }
}

async function waitFor(check, label, attempts = 85, every = 150) {
  let last;
  for (let i=0; i<attempts; i++) {
    try {
      const outcome = await check();
      if (outcome === true) return;
      last = outcome;
    } catch (error) { last = String(error); }
    await sleep(every);
  }
  throw new Error("Android emulator check timed out: " + label +
    ", last=" + JSON.stringify(last).slice(0,550));
}

async function connectWebView() {
  for (let attempt=0; attempt<75; attempt++) {
    let pid = 0;
    try {
      pid = Number(adb("shell","pidof",PACKAGE).split(/\s+/)[0]);
    } catch {
      // Android may still be spawning the WebView process.
    }
    if (pid > 1) {
      const forward = spawnSync("adb", [
        "forward","tcp:"+PORT,"localabstract:webview_devtools_remote_"+pid,
      ], { encoding:"utf8",timeout:12_000 });
      if (forward.status === 0) {
        try {
          const response = await fetch("http://127.0.0.1:"+PORT+"/json/list", {
            signal:AbortSignal.timeout(2500),
          });
          if (response.ok) {
            const pages = await response.json();
            const page = pages.find((entry) => entry.type === "page" &&
              entry.webSocketDebuggerUrl &&
              entry.url?.startsWith("https://" + LOCAL_HOST + "/assets/web/index.html"));
            if (page) {
              // WebView reports its loopback CDP URL with host localhost or
              // 127.0.0.1, depending on Android System WebView revision.
              const endpoint = new URL(page.webSocketDebuggerUrl);
              endpoint.hostname = "127.0.0.1";
              endpoint.port = String(PORT);
              const client = new DevTools(endpoint.href);
              await client.open();
              return client;
            }
          }
        } catch {}
      }
    }
    await sleep(300);
  }
  throw new Error("Debuggable Android WebView did not expose a local asset document. " +
    inspectLog());
}

async function openApp() {
  const launch = adb("shell","am","start","-n",PACKAGE+"/.OfflineActivity");
  assert(!/Error:|Exception:/i.test(launch), "Offline app did not start: "+launch);
  return await connectWebView();
}

async function testExercise(cdp, slug, expectedLatin, expectedMode, assetKind) {
  await cdp.js("location.hash = '#/exercise/" + slug + "'; true");
  await waitFor(async () => await cdp.js(
    "(() => { const latin=document.querySelector('section p[dir=ltr]')?.innerText; "+
    "const player=document.querySelector('[data-exercise-media-mode]'); "+
    "const img=player?.querySelector('img'); return latin === "+
    JSON.stringify(expectedLatin) + " && player?.dataset.exerciseMediaMode === "+
    JSON.stringify(expectedMode) + " && img?.complete && img?.naturalWidth > 0 && "+
    "img.currentSrc.includes('/assets/web/media/" + assetKind + "/'); })()"
  ), slug+" image decoding on real Android WebView",70,200);
}

async function run() {
  console.log("Installing standalone offline APK on Android emulator: "+APK);
  adb("install","-r",APK);
  const permission = adb("shell","dumpsys","package",PACKAGE);
  assert(!permission.includes("android.permission.INTERNET: granted=true"),
    "APK must not request network capability");
  adb("shell","svc","wifi","disable");
  adb("shell","svc","data","disable");
  // Android 15 denies ACTION_AIRPLANE_MODE broadcasts sent by the shell
  // UID. Disabling both radios through svc is permitted and provides the
  // offline condition; the APK independently has NO INTERNET permission.
  // Do not fail the test on a protected system broadcast.
  console.log("Network disabled: Wi-Fi and mobile data off; APK has no INTERNET permission.");
  adb("logcat","-c");
  let cdp = await openApp();
  try {
    await waitFor(async () => await cdp.js(
      "document.readyState === 'complete' && !!document.querySelector('#root') && "+
      "document.body.innerText.length > 100 && "+
      "window.__AURA_EMBEDDED_ANDROID__ === true"),
      "first-launch React boot with Android Wi-Fi and data disabled",80,200);
    const view = await cdp.js("location.href");
    assert(view.startsWith("https://"+LOCAL_HOST+"/assets/web/index.html"),
      "WebView unexpectedly loaded a remote site: "+view);
    console.log("PASS: first Android WebView launch, local React shell, both radios disabled");

    await testExercise(cdp,"bench-press","Bench Press","approved-gif","gifs");
    await testExercise(cdp,"plank","Plank","frame","frames");
    console.log("PASS: source-matched GIF and SVG frame decoding from APK");

    await cdp.js("location.hash = '#/exercises'; true");
    await waitFor(async () => await cdp.js("document.body.innerText.includes('مكتبة التمارين')"),
      "exercise catalog",40);
    await cdp.js("location.hash = '#/builder'; true");
    await waitFor(async () => await cdp.js("document.body.innerText.includes('ابنِ جلستك')"),
      "custom training builder",40);
    await cdp.js("location.hash = '#/profile'; true");
    await waitFor(async () => await cdp.js("document.body.innerText.includes('ملف التدريب')"),
      "local profile",40);
    console.log("PASS: exercise library, custom builder, profile navigation");

    const sentinel="aura.emulator.real-webview-check";
    await cdp.js("localStorage.setItem(" + JSON.stringify(sentinel) +
      ", 'survives-restart'); true");
    // Simulate an imported GIF in the real Android IndexedDB Blob store.
    // Native file-picker selection is separately exercised in Chromium CI;
    // this verifies the Android media engine can persist and replay a Blob.
    await cdp.js("(async () => { "+
      "const gif=await (await fetch('/assets/web/media/gifs/bench-press.gif')).blob();"+
      "const db=await new Promise((ok,bad)=>{"+
      "const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
      "r.onupgradeneeded=()=>r.result.createObjectStore('motions',{keyPath:'exerciseId'});"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error);});"+
      "await new Promise((ok,bad)=>{const tx=db.transaction('motions','readwrite');"+
      "tx.objectStore('motions').put({exerciseId:'bench-press',kind:'gif',"+
      "blob:gif,fileName:'bench-press.gif',storedAt:Date.now()});"+
      "tx.oncomplete=ok;tx.onerror=()=>bad(tx.error);});db.close();return true;})()");
    await cdp.js("location.hash = '#/exercise/bench-press'; true");
    await waitFor(async () => await cdp.js(
      "(() => {const p=document.querySelector('[data-exercise-media-mode=local-gif]');"+
      "const img=p?.querySelector('img'); return !!(img?.complete && img?.naturalWidth > 0);})()"),
      "locally stored GIF playback",50);
    console.log("PASS: Android IndexedDB stores and plays exercise GIF Blob");

    cdp.close();
    adb("shell","am","force-stop",PACKAGE);
    await sleep(500);
    cdp=await openApp();
    await waitFor(async()=> await cdp.js(
      "localStorage.getItem("+JSON.stringify(sentinel)+") === 'survives-restart'"),
      "local profile survives force-stop/relaunch",65,200);
    await testExercise(cdp,"plank","Plank","frame","frames");
    await cdp.js("location.hash = '#/exercise/bench-press'; true");
    await waitFor(async()=>await cdp.js(
      "(() => {const p=document.querySelector('[data-exercise-media-mode=local-gif]');"+
      "const img=p?.querySelector('img'); return !!(img?.complete && img?.naturalWidth > 0);})()"),
      "Android persisted imported GIF after process restart",65,200);
    await cdp.js("(async()=>{"+
      "const db=await new Promise((ok,bad)=>{const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
      "await new Promise((ok,bad)=>{const tx=db.transaction('motions','readwrite');"+
      "tx.objectStore('motions').delete('bench-press');"+
      "tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});db.close();"+
      "localStorage.removeItem("+JSON.stringify(sentinel)+");return true;})()");
    console.log("ANDROID OFFLINE EMULATOR PASS: first-run offline WebView, decoded GIF/SVG, "+
      "local navigation, Android persistence after restart, local exercise Blob playback.");
  } finally {
    cdp?.close();
    try { adb("forward","--remove","tcp:"+PORT); } catch {}
  }
}
run().catch((error) => {
  console.error("ANDROID EMULATOR FAILED: "+String(error));
  const folder = "android-emulator-diagnostics";
  mkdirSync(folder, { recursive:true });
  writeFileSync(folder+"/failure.txt", String(error)+"\n");
  const logcat = inspectLog();
  writeFileSync(folder+"/logcat.txt", logcat);
  console.error(logcat);
  const screen = spawnSync("adb", ["exec-out","screencap","-p"],
    {timeout:15_000,maxBuffer:5*1024*1024});
  if (screen.status===0 && screen.stdout?.length) {
    writeFileSync(folder+"/screen.png", screen.stdout);
  }
  process.exitCode=1;
});
