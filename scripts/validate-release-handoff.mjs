// Phase 54: detect release documentation drift without accessing cloud data.
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");
const requiredFiles = [
  "PHASE_51_RELEASE_GATES.md",
  "LOVABLE_PHASE_53_QA_AR.md",
  "CLOUD_LIVE_TESTING.md",
  "CLOUD_PRODUCTION_READONLY.md",
  "supabase/aura_production_readonly_audit.sql",
  "supabase/migrations/20261003143000_aura_cloud_sync.sql",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw Error(`Missing release prerequisite: ${file}`);
}
const handoff = read("LOVABLE_PHASE_53_QA_AR.md");
const gates = read("PHASE_51_RELEASE_GATES.md");
const readme = read("README.md");
const pkg = JSON.parse(read("package.json"));
for (const name of [
  "cloud-live:verify",
  "cloud-live:validate",
  "cloud:production-audit:validate",
  "workout:validate",
  "pwa:validate",
  "browser:smoke",
]) {
  if (typeof pkg.scripts[name] !== "string") {
    throw Error(`Missing referenced release command: ${name}`);
  }
}
for (const path of requiredFiles.slice(0, 4)) {
  if (!read(path).trim()) throw Error(`Empty release document: ${path}`);
}
if (!readme.includes("PHASE_51_RELEASE_GATES.md") ||
    !readme.includes("365") || !readme.includes("500")) {
  throw Error("README lost cloud release checklist or current history limits");
}
if (!handoff.includes("cloud-live:verify") ||
    !handoff.includes("aura_production_readonly_audit.sql") ||
    !handoff.includes("لم تُثبت بعد") ||
    !handoff.includes("جهازين")) {
  throw Error("Lovable handoff must preserve true pending live verification");
}
if (!gates.includes("43 READY") ||
    !gates.includes("PENDING") ||
    !gates.includes("disposable")) {
  throw Error("Release gates lost real-production verification safeguards");
}
console.log("Release handoff consistency PASS: required artifacts, commands, retention limits, and unverified live gates.");
