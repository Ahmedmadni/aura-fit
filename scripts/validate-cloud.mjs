import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error("Cloud validation failed: " + message);
  process.exit(1);
};

const migrationDir = path.join(root, "supabase", "migrations");
if (!fs.existsSync(migrationDir)) fail("supabase/migrations is missing");

const migrations = fs
  .readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
if (!migrations.length) fail("no Supabase migration found");

const sql = migrations
  .map((name) => fs.readFileSync(path.join(migrationDir, name), "utf8"))
  .join("\n");

for (const table of [
  "aura_profiles",
  "aura_readiness",
  "aura_workouts",
]) {
  if (!sql.includes("public." + table)) {
    fail("missing table " + table);
  }
  if (
    !sql.includes(
      "alter table public." + table + " enable row level security",
    )
  ) {
    fail("RLS is not enabled for " + table);
  }
  if (!sql.includes("auth.uid() = user_id")) {
    fail("owner RLS predicate missing");
  }
}

for (const table of [
  "aura_profiles",
  "aura_readiness",
  "aura_workouts",
]) {
  if (!sql.includes("revoke all on table public." + table + " from anon")) {
    fail("anonymous table access was not revoked for " + table);
  }
  if (
    !sql.includes(
      "grant select, insert, update, delete on table public." +
        table +
        " to authenticated",
    )
  ) {
    fail("authenticated CRUD grant missing for " + table);
  }
}

for (const policy of [
  "aura_profiles_select_own",
  "aura_profiles_insert_own",
  "aura_profiles_update_own",
  "aura_readiness_select_own",
  "aura_readiness_insert_own",
  "aura_readiness_update_own",
  "aura_workouts_select_own",
  "aura_workouts_insert_own",
  "aura_workouts_update_own",
]) {
  if (!sql.includes(policy)) fail("missing RLS policy " + policy);
}

const envExamplePath = path.join(root, ".env.example");
if (!fs.existsSync(envExamplePath)) fail(".env.example is missing");
const envExample = fs.readFileSync(envExamplePath, "utf8");
if (!envExample.includes("VITE_SUPABASE_URL")) {
  fail("VITE_SUPABASE_URL missing from .env.example");
}
if (
  !envExample.includes("VITE_SUPABASE_PUBLISHABLE_KEY") &&
  !envExample.includes("VITE_SUPABASE_ANON_KEY")
) {
  fail("Supabase browser key missing from .env.example");
}

const sourceFiles = [
  path.join(root, "src", "lib", "cloud-config.ts"),
  path.join(root, "src", "lib", "cloud-auth.ts"),
  path.join(root, "src", "lib", "cloud-local-vault.ts"),
  path.join(root, "src", "lib", "cloud-sync.ts"),
  path.join(root, "src", "components", "cloud-sync-bridge.tsx"),
  path.join(root, "src", "routes", "__root.tsx"),
];
for (const file of sourceFiles) {
  if (!fs.existsSync(file)) fail("missing " + path.relative(root, file));
}

const allClientSource = fs
  .readdirSync(path.join(root, "src", "lib"))
  .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
  .map((name) =>
    fs.readFileSync(path.join(root, "src", "lib", name), "utf8"),
  )
  .join("\n");

if (/service[_-]?role/i.test(allClientSource)) {
  fail("service-role material must never appear in browser source");
}

const rootRoute = fs.readFileSync(
  path.join(root, "src", "routes", "__root.tsx"),
  "utf8",
);
if (!rootRoute.includes("<CloudSyncBridge />")) {
  fail("CloudSyncBridge is not mounted at the app root");
}

const authSource = fs.readFileSync(
  path.join(root, "src", "lib", "cloud-auth.ts"),
  "utf8",
);
const bridgeSource = fs.readFileSync(
  path.join(root, "src", "components", "cloud-sync-bridge.tsx"),
  "utf8",
);
if (
  !authSource.includes("refreshInFlight") ||
  !authSource.includes("CloudAuthRequestError") ||
  !authSource.includes("latest.refresh_token !== current.refresh_token")
) {
  fail("cloud auth lacks safe concurrent refresh and account switch protection");
}
if (
  !bridgeSource.includes('addEventListener("online"') ||
  !bridgeSource.includes('addEventListener("visibilitychange"')
) {
  fail("cloud sync retry handlers are missing");
}

const syncSource = fs.readFileSync(
  path.join(root, "src", "lib", "cloud-sync.ts"),
  "utf8",
);
if (
  !syncSource.includes("CloudAccountChangedError") ||
  !syncSource.includes("assertCurrentCloudUser(session);")
) {
  fail("cross-account sync protection is missing");
}
if (!bridgeSource.includes("retryAfterCurrent = true")) {
  fail("auth change while syncing must queue a new reconciliation");
}

const vaultSource = fs.readFileSync(
  path.join(root, "src", "lib", "cloud-local-vault.ts"), "utf8",
);
if (
  !vaultSource.includes("activateLocalAccount") ||
  !vaultSource.includes("aura.workout-session-meta.v1") ||
  !authSource.includes("activateLocalAccount(session.user.id")
) {
  fail("local account isolation must cover workout drafts and all account data");
}

if (
  !syncSource.includes("resolution=ignore-duplicates") ||
  !syncSource.includes("client_updated_at") ||
  !syncSource.includes("recorded_at") ||
  !syncSource.includes("updateOnlyIfOlder") ||
  !syncSource.includes("cloud,") && !syncSource.includes("...local, ...cloud")
) {
  fail("conditional cloud upsert and conflict protection are missing");
}

if (
  !syncSource.includes("verifyLocalChange(session, change)") ||
  !syncSource.includes("const verified = applyFullCloudRows(") ||
  !syncSource.includes("await readFullCloudRows(session)")
) {
  fail("post-write cloud verification is missing");
}
console.log(
  "Cloud validation PASS: RLS, per-account data, conditional writes and post-write reconciliation are present.",
);
