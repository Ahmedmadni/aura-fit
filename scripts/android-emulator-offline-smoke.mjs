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
import { createHash } from "node:crypto";
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
  async js(expression, userGesture = false) {
    const result = await this.call("Runtime.evaluate", {
      expression, returnByValue:true, awaitPromise:true, userGesture,
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

/**
 * Operate the actual Android DocumentsUI window via accessibility hierarchy.
 * No hardcoded screen coordinates or mock data providers. The app is running
 * as an ordinary unprivileged package; adb has no extra app permissions.
 */
function androidUiNodes() {
  const result = spawnSync("adb", ["shell", "uiautomator", "dump",
    "/sdcard/aura-saf-ui.xml"], {encoding:"utf8",timeout:25_000});
  if (result.status !== 0) throw new Error("Android accessibility dump failed: "+result.stderr);
  const xml = adb("shell","cat","/sdcard/aura-saf-ui.xml");
  return [...xml.matchAll(/<node\b[^>]*>/g)].map((match) => {
    const attrs = {};
    for (const attr of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attrs[attr[1]] = attr[2].replace(/&quot;/g,'"').replace(/&amp;/g,'&');
    }
    return attrs;
  });
}
function tapNode(attrs, description) {
  const bounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attrs?.bounds || "");
  if (!bounds) throw new Error("Missing UI bounds for "+description);
  const x = Math.round((Number(bounds[1])+Number(bounds[3]))/2);
  const y = Math.round((Number(bounds[2])+Number(bounds[4]))/2);
  adb("shell","input","tap",String(x),String(y));
}
function describeUi(nodes) {
  return nodes.filter(n=>n.text || n["content-desc"] || n["resource-id"])
    .map(n=>[n.text,n["content-desc"],n["resource-id"]].filter(Boolean).join("/"))
    .slice(0,90).join(" | ").slice(0,4500);
}
function findUi(nodes, regex) {
  return nodes.find(n=>regex.test([n.text,n["content-desc"],n["resource-id"]]
    .filter(Boolean).join(" ")));
}
async function ensureDownloadFolder() {
  let nodes=androidUiNodes();
  // The picker often opens on "Recent", where Save cannot target a folder.
  // Prefer the explicit Downloads root irrespective of previous picker state.
  let downloads = findUi(nodes,/^(Downloads|Download|التنزيلات|التحميلات)$/i);
  if (!downloads) {
    const nav = findUi(nodes,/navigation drawer|show roots|إظهار الجذور|Open drawer|Navigate up/i);
    if (nav) {
      tapNode(nav,"DocumentsUI navigation drawer");
      await sleep(450);
      nodes=androidUiNodes();
      downloads=findUi(nodes,/^(Downloads|Download|التنزيلات|التحميلات)$/i);
    }
  }
  if (!downloads) {
    throw new Error("Cannot select Android Downloads root. UI: "+describeUi(nodes));
  }
  tapNode(downloads,"Downloads root");
  await sleep(450);
}
async function tapDocumentAction(regex,label) {
  let last = [];
  for (let attempt=0;attempt<9;attempt++) {
    const nodes=androidUiNodes();
    last=nodes;
    const target=findUi(nodes,regex);
    if (target) {tapNode(target,label);return;}
    await sleep(350);
  }
  throw new Error("Android DocumentsUI action missing ("+label+"): "+describeUi(last));
}
async function waitForDocumentsUi() {
  await waitFor(()=>{
    const activity=adb("shell","dumpsys","activity","activities");
    return /topResumedActivity=.*[Dd]ocuments[Uu][Ii]|mResumedActivity.*[Dd]ocuments[Uu][Ii]|[Rr]esumed.*[Dd]ocuments[Uu][Ii]/.test(activity);
  },"Android system DocumentsUI foreground",50,200);
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
    // FULL NATIVE DOCUMENTSUI ROUNDTRIP: ensure a real licensed local GIF is
    // present in Android IndexedDB (after upgrade), export the real binary
    // backup through WebView->Java, select Downloads and SAVE via DocumentsUI,
    // verify actual file bytes on /sdcard, then restore via ACTION_OPEN_DOCUMENT.
    await cdp.js("location.hash = '#/profile'; true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-testid=full-offline-backup]'))"),
      "full archive UI on actual WebView",65,180);
    async function startFullExport() {
      const clicked = await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');" +
        "const b=[...scope.querySelectorAll('button')].find(x=>x.innerText.includes('تصدير نسخة كاملة'));" +
        "if(!b) return false;b.click();return true})()",true);
      assert(clicked,"Could not click full backup export in Android");
      await waitFor(async()=>await cdp.js(
        "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('تم تجهيز الحزمة')"),
        "Android Java native backup streaming finished",120,220);
      await waitForDocumentsUi();
    }

    // Test user CANCEL explicitly. This must NOT show a false save success.
    await startFullExport();
    adb("shell","input","keyevent","4");
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('أُلغيت عملية الحفظ')"),
      "native SAF cancellation callback",65,220);
    console.log("PASS: native SAF cancellation surfaces cancelled status without claiming file saved.");

    await startFullExport();
    await ensureDownloadFolder();
    await tapDocumentAction(/(?:text|action_menu_save|^Save$|^SAVE$|حفظ)/i,
      "Android SAF save button");
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتمل حفظ الحزمة')"),
      "SAF provider committed archive and native completion callback",110,220);

    const allDownloads=adb("shell","ls","-1","/sdcard/Download").split(/\r?\n/);
    const savedNames=allDownloads.filter(n=>/^aura-fit-complete-.*\.afbackup$/.test(n));
    assert(savedNames.length===1,
      "Expected exactly one real .afbackup file in Android Downloads: "+allDownloads.join(", "));
    const savedPath="/sdcard/Download/"+savedNames[0];
    const raw=execFileSync("adb",["exec-out","cat",savedPath],
      {encoding:null,maxBuffer:550*1024*1024,timeout:35_000});
    const magic=Buffer.from("AURA-FIT-FULL-ARCHIVE-V1\n");
    assert(raw.subarray(0,magic.length).equals(magic),
      "Android SAF saved archive has wrong binary header");
    const manifestBytes=raw.readUInt32LE(magic.length);
    assert(manifestBytes>10 && manifestBytes<10*1024*1024,
      "Android SAF archive manifest length invalid");
    const manifest=JSON.parse(raw.subarray(magic.length+4,
      magic.length+4+manifestBytes).toString("utf8"));
    assert(manifest.format==="aura-fit-offline-full" &&
      manifest.training?.format==="aura-fit-local-backup" &&
      Array.isArray(manifest.media) &&
      manifest.media.some(x=>x.exerciseId==="bench-press"),
      "Real SAF file is missing training or the imported exercise GIF");
    let offset=magic.length+4+manifestBytes;
    for(const item of manifest.media){
      const clip=raw.subarray(offset,offset+item.bytes);
      assert(clip.length===item.bytes && createHash("sha256").update(clip).digest("hex")===item.sha256,
        "Android SAF file checksum mismatch for "+item.exerciseId);
      offset+=item.bytes;
    }
    assert(offset===raw.length,"Android SAF document has a truncated or appended payload");
    console.log("PASS: Android SAF SAVE wrote a real .afbackup to Downloads; original media SHA256 and training manifest verified.");

    // Modify training and remove the video inside the isolated emulator to
    // prove restoration comes from the REAL document provider, not in-memory
    // or stale IndexedDB data.
    await cdp.js("(async()=>{"+
      "const db=await new Promise((ok,bad)=>{const r=indexedDB.open('aura-fit-local-exercise-motion',1);"+
      "r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});"+
      "await new Promise((ok,bad)=>{const tx=db.transaction('motions','readwrite');"+
      "tx.objectStore('motions').delete('bench-press');tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});"+
      "db.close(); const p="+JSON.stringify(manifest.training.profile)+";"+
      "p.name='CHANGED_AFTER_SAF_EXPORT';localStorage.setItem('kp.profile',JSON.stringify(p));return true;})()");
    await cdp.js("location.hash='#/exercise/bench-press';true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-exercise-media-mode=approved-gif]'))"),
      "video absent before SAF import",70,170);
    await cdp.js("location.hash='#/profile';true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-testid=full-backup-file]'))"),
      "full backup input on WebView",60,150);
    const pickerOpened=await cdp.js("(() => {const input=document.querySelector('[data-testid=full-backup-file]');"+
      "if(!input)return false;input.click();return true})()",true);
    assert(pickerOpened,"Could not open the native Android archive chooser");
    await waitForDocumentsUi();
    await ensureDownloadFolder();
    await tapDocumentAction(/aura-fit-complete-.*\.afbackup/i,"saved archive in Downloads");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-testid=full-backup-preview]'))"),
      "native ACTION_OPEN_DOCUMENT delivered binary file to WebView",110,220);
    const confirmed=await cdp.js("(() => {const scope=document.querySelector('[data-testid=full-offline-backup]');"+
      "const b=[...scope.querySelectorAll('button')].find(x=>x.textContent.includes('تأكيد استعادة الحزمة'));" +
      "if(!b)return false;b.click();return true})()",true);
    assert(confirmed,"Cannot confirm native SAF restore after preview");
    await waitFor(async()=>await cdp.js(
      "document.querySelector('[data-testid=full-offline-backup]')?.innerText.includes('اكتملت الاستعادة')"),
      "restoration completed from Android SAF document",120,220);
    await cdp.js("location.hash='#/exercise/bench-press';true");
    await waitFor(async()=>await cdp.js(
      "Boolean(document.querySelector('[data-exercise-media-mode=local-gif]'))"),
      "restored exercise GIF from actual downloaded SAF document",90,200);
    const restoredProfile=await cdp.js("JSON.parse(localStorage.getItem('kp.profile')||'{}').name");
    assert(restoredProfile===manifest.training.profile.name,
      "Native SAF restored media but did not restore original training profile");
    console.log("ANDROID SAF ROUNDTRIP PASS: real picker save -> read binary .afbackup from Downloads -> picker import -> confirmed restoration of training profile and original exercise GIF.");

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
