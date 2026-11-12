import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve("android-offline/app/src/main/assets/web");
const htmlPath = join(out, "index.html");
assert(existsSync(htmlPath), "Offline APK index.html was not built");
const html = readFileSync(htmlPath, "utf8");
assert(html.includes('id="root"'), "Offline app mount missing");
assert(html.includes("__AURA_EMBEDDED_ANDROID__"), "Offline app marker missing");
const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const assets = urls.filter((u) => u.startsWith("/assets/web/"));
assert(assets.some((u) => /\.js(?:$|\?)/.test(u)), "Offline JS entry missing");
assert(assets.some((u) => /\.css(?:$|\?)/.test(u)), "Offline CSS missing");
for (const url of urls) {
  assert(!/^https?:\/\//.test(url) && !url.startsWith("//"),
    "Entry HTML requires external origin: " + url);
}
for (const asset of assets) {
  const relative = decodeURIComponent(asset.slice("/assets/web/".length));
  assert(!relative.includes("..") && !relative.startsWith("/"), "Unsafe bundled asset path");
  assert(existsSync(join(out, relative)), "Referenced APK asset does not exist: " + asset);
}
let bytes = 0;
let jsCount = 0;
function walk(folder) {
  for (const filename of readdirSync(folder)) {
    const path = join(folder, filename);
    const entry = statSync(path);
    if (entry.isDirectory()) walk(path);
    else { bytes += entry.size; if (filename.endsWith(".js")) jsCount++; }
  }
}
walk(out);
assert(jsCount > 0 && bytes > 100_000, "Missing bundled client modules");

const manifest = readFileSync("android-offline/app/src/main/AndroidManifest.xml", "utf8");
assert(!/uses-permission\s+android:name="android\.permission\.INTERNET"/.test(manifest),
  "Offline edition must never request INTERNET");
const activity = readFileSync("android-offline/app/src/main/java/com/aurafit/offline/OfflineActivity.java", "utf8");
assert(activity.includes("setBlockNetworkLoads(true)") &&
  activity.includes("setAllowFileAccess(false)") &&
  activity.includes("new WebViewAssetLoader.AssetsPathHandler"),
  "Android shell must serve only bundled assets and block network/file URLs");
console.log("Offline Android bundle PASS: local HTML, JS, CSS, catalog bundle, no INTERNET permission, offline WebView guard. Total bytes: " + bytes);
