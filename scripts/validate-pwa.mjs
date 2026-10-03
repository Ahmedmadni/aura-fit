import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error("PWA validation failed: " + message);
  process.exit(1);
};

const manifestPath = path.join(root, "public", "manifest.webmanifest");
const swPath = path.join(root, "public", "sw.js");
const offlinePath = path.join(root, "public", "offline.html");
const rootRoutePath = path.join(root, "src", "routes", "__root.tsx");

for (const file of [manifestPath, swPath, offlinePath, rootRoutePath]) {
  if (!fs.existsSync(file)) fail("missing " + path.relative(root, file));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const key of ["name", "short_name", "start_url", "scope", "display", "icons"]) {
  if (!manifest[key]) fail("manifest missing " + key);
}

if (manifest.start_url !== "/" || manifest.scope !== "/") {
  fail("manifest start_url and scope must both be /");
}
if (!["standalone", "fullscreen", "minimal-ui"].includes(manifest.display)) {
  fail("manifest display must be installable");
}
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
  fail("manifest must contain at least two icons");
}

for (const icon of manifest.icons) {
  if (!icon.src?.startsWith("/")) fail("manifest icon must use same-origin path");
  const iconPath = path.join(root, "public", icon.src.replace(/^\//, ""));
  if (!fs.existsSync(iconPath)) fail("missing manifest icon " + icon.src);
}

const sw = fs.readFileSync(swPath, "utf8");
for (const required of [
  'self.addEventListener("install"',
  'self.addEventListener("activate"',
  'self.addEventListener("fetch"',
  '"/offline.html"',
]) {
  if (!sw.includes(required)) fail("service worker missing " + required);
}

const rootRoute = fs.readFileSync(rootRoutePath, "utf8");
if (!rootRoute.includes("<PwaRegister />")) {
  fail("root route does not mount PwaRegister");
}

const registerPath = path.join(root, "src", "components", "pwa-register.tsx");
if (!fs.existsSync(registerPath)) fail("missing PWA registration component");
const register = fs.readFileSync(registerPath, "utf8");
if (!register.includes('navigator.serviceWorker.register("/sw.js"')) {
  fail("PWA registration does not register /sw.js");
}

console.log(
  "PWA validation PASS: manifest, icons, service worker, offline fallback and registration are present.",
);
