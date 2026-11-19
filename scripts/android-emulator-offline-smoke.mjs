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

    // Verify a REAL Android package-version upgrade signed with the SAME QA
    // certificate. Data must survive package manager replacement, not merely
    // a process restart. The two APKs have increasing versionCode values.
    if (process.argv[3] && process.argv[4]) {
      const v1 = process.argv[3], v2 = process.argv[4];
      cdp.close();
      adb("uninstall", PACKAGE); // Isolated CI emulator ONLY; not a user device.
      assert(adb("install", v1).includes("Success"),
        "The first QA signed APK cannot be installed");
      cdp=await openApp();
      await waitFor(async()=>await cdp.js(
        "document.readyState === 'complete' && window.__AURA_EMBEDDED_ANDROID__ === true"),
        "first signed QA version startup");
      await cdp.js("localStorage.setItem('aura.qa.upgrade-data','preserved'); true");
      await cdp.js("(async()=>{"+
        "const gif=await (await fetch('/assets/web/media/gifs/bench-press.gif')).blob();"+
        "const db=await new Promise((ok,bad)=>{"+
        "const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
        "r.onupgradeneeded=()=>r.result.createObjectStore('motions',{keyPath:'exerciseId'});"+
        "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
        "await new Promise((ok,bad)=>{const tx=db.transaction('motions','readwrite');"+
        "tx.objectStore('motions').put({exerciseId:'bench-press',kind:'gif',blob:gif,"+
        "fileName:'bench-press.gif',storedAt:Date.now()});"+
        "tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});db.close();return true;})()");
      cdp.close();
      adb("shell","am","force-stop",PACKAGE);
      const installed = adb("install","-r",v2);
      assert(installed.includes("Success"), "Same-signer upgrade must install in place: "+installed);
      const metadata = adb("shell","dumpsys","package",PACKAGE);
      assert(/versionCode=10002(?:\s|$)/.test(metadata),
        "Upgrade did not increase version code to 10002");
      cdp=await openApp();
      await waitFor(async()=>await cdp.js(
        "localStorage.getItem('aura.qa.upgrade-data') === 'preserved'"),
        "localStorage persisted after v10001 -> v10002 signed upgrade",75,200);
      await cdp.js("location.hash = '#/exercise/bench-press'; true");
      await waitFor(async()=>await cdp.js(
        "(() => {const p=document.querySelector('[data-exercise-media-mode=local-gif]');"+
        "const img=p?.querySelector('img');return !!(img?.complete && img.naturalWidth>0)})()"),
        "IndexedDB GIF survived signed versionCode upgrade",75,200);
      console.log("PASS: signed Android versionCode 10001 -> 10002 in-place upgrade kept localStorage and IndexedDB video.");
      // An APK with a different certificate must be refused rather than
      // replacing the existing application and erasing its data.
      // -d suppresses versionCode downgrade rejection so this assertion
      // specifically proves the Android signature identity check, not just
      // the versionCode comparison.
      const mismatch = spawnSync("adb",["install","-r","-d",APK],{
        encoding:"utf8",timeout:30_000,
      });
      const mismatchText = String(mismatch.stdout)+" "+String(mismatch.stderr);
      assert(mismatch.status!==0 && /INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(mismatchText),
        "Expected a certificate mismatch rejection, observed: "+mismatchText.slice(0,650));
      console.log("PASS: Android rejects mismatched signer; existing local data remains untouched.");
      const sentinel = await cdp.js("localStorage.getItem('aura.qa.upgrade-data')");
      assert(sentinel === "preserved","Signer mismatch attempt modified local data.");
    }
    // Exercise the real WebView -> Java chunked binary bridge and Android
    // ACTION_CREATE_DOCUMENT picker (not a simulated Chrome download).
    await cdp.js("location.hash = '#/profile'; true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-testid=full-offline-backup]'))"),
      "full archive export panel on real Android WebView",55,200);
    const exported = await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');" +
      "const b=[...scope.querySelectorAll('button')].find(x=>x.innerText.includes('تصدير نسخة كاملة'));" +
      "if (!b) return false;b.click();return true})()");
    assert(exported,"Full backup export button is not clickable on Android");
    // Progress text changes rapidly between SHA256 hashing and native
    // chunk transfer. Test the durable SAF picker and verified result,
    // not any transient progress message that might already disappear.
    let androidDocumentPicker = false;
    for (let i=0;i<45;i++) {
      const activity = adb("shell","dumpsys","activity","activities");
      if (/topResumedActivity=.*[Dd]ocuments[Uu][Ii]|mResumedActivity.*[Dd]ocuments[Uu][Ii]|[Rr]esumed.*[Dd]ocuments[Uu][Ii]/.test(activity)) {
        androidDocumentPicker = true;
        break;
      }
      await sleep(150);
    }
    assert(androidDocumentPicker,
      "Android SAF ACTION_CREATE_DOCUMENT did not launch after writing archive");
    const notCompleted = await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتمل حفظ الحزمة')");
    assert(!notCompleted,"False-positive archive success was shown before SAF completed");
    adb("shell","input","keyevent","4"); // Explicitly cancel first picker.
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup] [role=alert]')?.innerText.includes('أُلغِي حفظ الحزمة')"),
      "Android SAF cancellation must reject full export",75,200);
    const cancelledShowsSuccess = await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتمل حفظ الحزمة')");
    assert(!cancelledShowsSuccess,"Cancelled SAF export was incorrectly marked saved");
    console.log("PASS: native SAF cancel returns explicit failure and cannot be mistaken for a saved backup.");

    // Save a second archive through the REAL Android DocumentsUI picker.
    const second = await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');"+
      "const b=[...scope.querySelectorAll('button')].find(x=>x.innerText.includes('تصدير نسخة كاملة'));" +
      "if(!b)return false;b.click();return true})()");
    assert(second,"Second full backup button did not reopen Android SAF");
    await waitFor(() => {
      const activity = adb("shell","dumpsys","activity","activities");
      return /topResumedActivity=.*[Dd]ocuments[Uu][Ii]|mResumedActivity.*[Dd]ocuments[Uu][Ii]|[Rr]esumed.*[Dd]ocuments[Uu][Ii]/.test(activity);
    }, "second Android documents save dialog",85,200);
    // Query Android accessibility XML rather than blind fixed screen taps:
    // DocumentsUI labels vary by Android release and device locale.
    adb("shell","uiautomator","dump","/sdcard/aura-saf-window.xml");
    const hierarchy = adb("shell","cat","/sdcard/aura-saf-window.xml");
    const nodes = [...hierarchy.matchAll(/<node\s[^>]*\/?\>/g)];
    let saveBounds = null;
    for (const [tag] of nodes) {
      if (/text="(?:SAVE|Save|حفظ|إنشاء|CREATE|Create)"/.test(tag) ||
          /content-desc="(?:SAVE|Save|حفظ|إنشاء|CREATE|Create)"/.test(tag)) {
        const bounds = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
        if (bounds) {
          saveBounds = bounds.slice(1).map(Number);
          break;
        }
      }
    }
    assert(saveBounds,"Android DocumentsUI save button not found: "+hierarchy.slice(-2600));
    adb("shell","input","tap",
      String(Math.floor((saveBounds[0]+saveBounds[2])/2)),
      String(Math.floor((saveBounds[1]+saveBounds[3])/2)));
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتمل حفظ الحزمة')"),
      "real Android SAF write + SHA256 readback verified before UI success",100,200);
    console.log("PASS: real Android SAF wrote archive and verified full destination SHA256 readback.");

    // Phase 70: prove the file written by Android SAF can be READ BACK through
    // the *user-facing* Android ACTION_OPEN_DOCUMENT -> WebView file input,
    // SHA256-validated, and explicitly restored into localStorage + IndexedDB.
    // This is distinct from Phase 69's native writer readback smoke test.
    // SAF providers expose content:// document URIs, not necessarily
    // shell-visible /sdcard paths. The real proof is whether native
    // ACTION_OPEN_DOCUMENT returns that saved file to Android WebView and
    // it passes our binary SHA256 and data-restore checks below.

    // Deliberately change user profile and remove the locally saved exercise
    // GIF. Both must return only AFTER the user approves a verified backup.
    const originalName = await cdp.js(
      "JSON.parse(localStorage.getItem('kp.profile') || '{}').name || ''");
    const alteredName = "SAF restore regression changed profile";
    await cdp.js("(() => {const p=JSON.parse(localStorage.getItem('kp.profile')||'{}');"+
      "p.name="+JSON.stringify(alteredName)+";localStorage.setItem('kp.profile',JSON.stringify(p));return true})()");
    await cdp.js("(async()=>{const db=await new Promise((ok,bad)=>{"+
      "const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
      "await new Promise((ok,bad)=>{const tx=db.transaction('motions','readwrite');"+
      "tx.objectStore('motions').delete('bench-press');"+
      "tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});db.close();return true})()");
    await cdp.js("location.hash='#/exercise/bench-press';true");
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-exercise-media-mode]')?.getAttribute('data-exercise-media-mode')==='approved-gif'"),
      "exercise reverted to approved preview after deleting imported GIF",70,200);
    await cdp.js("location.hash='#/profile';true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-testid=full-offline-backup]'))"),
      "restore panel ready on Android after deleting local GIF",65,200);

    function parsePickerNodes(xml) {
      return [...xml.matchAll(/<node\b[^>]*>/g)].map(([tag])=>{
        const get=(field)=>tag.match(new RegExp(field+'="([^"]*)"'))?.[1]||"";
        const bounds=get("bounds").match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
        return {text:get("text"),description:get("content-desc"),
          resource:get("resource-id"),visible:get("enabled")!=="false",
          bounds:bounds?.slice(1).map(Number)};
      }).filter(n=>n.visible&&n.bounds);
    }
    function tapPickerNode(node) {
      const [x1,y1,x2,y2]=node.bounds;
      adb("shell","input","tap",String(Math.floor((x1+x2)/2)),
        String(Math.floor((y1+y2)/2)));
    }

    // Android WebView requires genuine user activation for a file chooser.
    // Use the accessibility node's actual DISPLAY bounds, then send a real
    // Android touch. WebView CSS coordinates are not display coordinates:
    // devicePixelRatio and the status-bar height vary by device, so adding a
    // guessed 24dp offset can tap below the button and stall the whole test.
    await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');"+
      "const b=[...scope.querySelectorAll('button')].find(x=>x.innerText.includes('فحص حزمة للاستعادة'));"+
      "if(!b)return false;b.scrollIntoView({block:'center',behavior:'instant'});return true})()");
    await sleep(350);
    adb("shell","uiautomator","dump","/sdcard/aura-profile-window.xml");
    const profileHierarchy=adb("shell","cat","/sdcard/aura-profile-window.xml");
    const restoreButton=parsePickerNodes(profileHierarchy).find(n=>
      (n.text+" "+n.description).includes("فحص حزمة للاستعادة"));
    assert(restoreButton,"Android restore button not found in accessibility hierarchy: "+
      profileHierarchy.slice(-2200));
    tapPickerNode(restoreButton);
    await waitFor(() => {
      const activity=adb("shell","dumpsys","activity","activities");
      return /topResumedActivity=.*[Dd]ocuments[Uu][Ii]|mResumedActivity.*[Dd]ocuments[Uu][Ii]|[Rr]esumed.*[Dd]ocuments[Uu][Ii]/.test(activity);
    },"native Android ACTION_OPEN_DOCUMENT picker for archive restore",80,200);
    let openedFile=false, lastPicker="";
    for(let attempt=0;attempt<9;attempt++) {
      adb("shell","uiautomator","dump","/sdcard/aura-restore-picker.xml");
      lastPicker=adb("shell","cat","/sdcard/aura-restore-picker.xml");
      const nodes=parsePickerNodes(lastPicker);
      const found=nodes.find(n=>(n.text+" "+n.description).includes("aura-fit-complete-"));
      if(found) {tapPickerNode(found);openedFile=true;break;}
      const downloads=nodes.find(n=>/^Downloads$|^التنزيلات$|^Download$/.test(n.text||n.description));
      const showRoots=nodes.find(n=>/Show roots|Browse|تصفح|إظهار/.test(n.description+" "+n.text));
      if(downloads) tapPickerNode(downloads);
      else if(showRoots) tapPickerNode(showRoots);
      else throw new Error("SAF picker does not display saved .afbackup or Downloads: "+lastPicker.slice(-1800));
      await sleep(500);
    }
    assert(openedFile,"Native Android picker did not expose verified exported backup: "+lastPicker.slice(-1400));

    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-backup-preview]')?.innerText.includes('ملف فيديو/حركة')"),
      "real Android selected .afbackup passed binary SHA256 inspection",120,200);
    const profileNotRestored = await cdp.js(
      "JSON.parse(localStorage.getItem('kp.profile')||'{}').name === "+JSON.stringify(alteredName));
    assert(profileNotRestored,"Choosing a file must not restore user profile before confirmation");
    const gifNotRestored = await cdp.js("(async()=>{const db=await new Promise((ok,bad)=>{"+
      "const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
      "const result=await new Promise((ok,bad)=>{const tx=db.transaction('motions','readonly');"+
      "const r=tx.objectStore('motions').get('bench-press');"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
      "db.close();return !result})()");
    assert(gifNotRestored,"Selecting a backup mutated IndexedDB without user confirmation");
    console.log("PASS: real Android ACTION_OPEN_DOCUMENT delivered verified SAF file to WebView; preview did not alter existing data.");

    const confirmed = await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');"+
      "const b=[...scope.querySelectorAll('button')].find(x=>x.innerText.includes('تأكيد استعادة الحزمة'));" +
      "if(!b)return false;b.click();return true})()");
    assert(confirmed,"Native restored-archive preview confirmation missing");
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتملت الاستعادة')"),
      "explicit Android full restore completed",90,200);
    const nameRestored=await cdp.js(
      "JSON.parse(localStorage.getItem('kp.profile')||'{}').name || ''");
    assert(nameRestored===originalName,
      "Training profile was not restored from the real SAF archive");
    await cdp.js("location.hash='#/exercise/bench-press';true");
    await waitFor(async()=>await cdp.js(
      "(() => {const p=document.querySelector('[data-exercise-media-mode=local-gif]');"+
      "const img=p?.querySelector('img');return !!(img?.complete && img.naturalWidth>0)})()"),
      "imported GIF restored and decoded after SAF archive roundtrip",80,200);
    console.log("PASS: Android SAF complete export -> ACTION_OPEN_DOCUMENT -> SHA256 verify -> explicit restore preserved training and restored playable IndexedDB GIF.");

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
