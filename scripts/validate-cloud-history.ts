// Phase 38: local retention, multi-page restoration and no repeated PATCH
// storm on page visibility/sign-in. All PostgREST replies are mocked.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const storage = new Map<string, string>();
(globalThis as any).window = { dispatchEvent: () => true };
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
const db = await import("../src/lib/user-profile");
const backup = await import("../src/lib/local-backup");
const sync = await import("../src/lib/cloud-sync");
const assert = (ok: unknown, message: string) => {
  if (!ok) throw new Error("Cloud history regression: " + message);
};

const userId = "athlete-history";
storage.set("kp.cloud.session", JSON.stringify({
  access_token: "test", refresh_token: "test-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: userId },
}));
const date = (start: string, delta: number) =>
  new Date(new Date(start).getTime() + delta * 86400000).toISOString();
const workouts = Array.from({ length: 501 }, (_, i) => ({
  id: "completed-" + i, date: date("2024-01-01T06:00:00.000Z", i),
  exercises: [{ id: "plank", sets: 2, reps: "30", completed: true }],
  durationSec: 1200, activeSec: 900, calories: 80,
  intensity: 50, performance: 70,
}));
const ready = Array.from({ length: 366 }, (_, i) => ({
  dateKey: date("2025-01-01T00:00:00.000Z", i).slice(0, 10),
  recordedAt: date("2025-01-01T08:00:00.000Z", i),
  sleepQuality: 4, fatigue: 2, muscleSoreness: 1, energy: 4,
}));
db.replaceLocalHistory(workouts, false);
db.replaceLocalReadinessHistory(ready, false);
assert(db.MAX_LOCAL_WORKOUTS === 500 && db.MAX_LOCAL_READINESS === 365,
  "bounded on-device limits not updated");
assert(db.loadHistory().length === 500 && db.loadReadinessHistory().length === 365,
  "device did not retain the expanded working set");

// Use 240 completed sessions and 120 readiness entries in the cloud scenario:
// both used to be silently truncated by the 200/90 implementation.
db.replaceLocalHistory(workouts.slice(0, 240), false);
db.replaceLocalReadinessHistory(ready.slice(0, 120), false);
assert(db.loadHistory().length === 240 && db.loadReadinessHistory().length === 120,
  "initial local records were truncated before upload");
const exported = backup.serializeLocalBackup();
const parsed = backup.parseLocalBackup(exported);
assert(parsed.workouts.length === 240 && parsed.readiness.length === 120,
  "backup export lost historical entries");
const cloud = {
  aura_readiness: new Map<string, any>(),
  aura_workouts: new Map<string, any>(),
};
let workoutPosts = 0;
let readinessPosts = 0;
let readinessPatches = 0;
let readPages = 0;
const answer = (data: unknown, status = 200) =>
  status === 204 ? new Response(null, { status }) :
    new Response(JSON.stringify(data), { status });
(globalThis as any).fetch = async (address: string, init?: RequestInit) => {
  const url = new URL(address);
  const method = init?.method ?? "GET";
  const table = url.pathname.split("/").at(-1);
  if (method === "GET") {
    if (table === "aura_profiles") return answer([]);
    const current = [...cloud[table as keyof typeof cloud].values()];
    const sorted = table === "aura_workouts" ?
      current.sort((a, b) =>
        b.workout_date.localeCompare(a.workout_date) ||
        b.workout_id.localeCompare(a.workout_id)) :
      current.sort((a, b) => b.date_key.localeCompare(a.date_key));
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const size = Number(url.searchParams.get("limit") ?? "100");
    assert(Number.isInteger(offset) && Number.isInteger(size) && size <= 100,
      "history GET was not paginated in safe page sizes");
    readPages++;
    return answer(sorted.slice(offset, offset + size));
  }
  const data = init?.body ? JSON.parse(String(init.body)) : null;
  if (method === "POST") {
    const batch = Array.isArray(data) ? data : [data];
    if (table === "aura_readiness") {
      readinessPosts++;
      for (const row of batch) cloud.aura_readiness.set(row.date_key, row);
    } else if (table === "aura_workouts") {
      workoutPosts++;
      for (const row of batch) cloud.aura_workouts.set(row.workout_id, row);
    } else if (table !== "aura_profiles") {
      throw Error("Unknown Supabase table: " + table);
    }
  }
  if (method === "PATCH" && table === "aura_readiness") {
    readinessPatches++;
    cloud.aura_readiness.set(data.date_key, data);
  }
  return answer(null, 204);
};

// Upload 240 sessions and 120 daily checks through the delta path.
await sync.runFullCloudSync();
assert(cloud.aura_workouts.size === 240 && cloud.aura_readiness.size === 120,
  "initial cloud sync failed to preserve the expanded history");
assert(workoutPosts === 1 && readinessPosts === 1,
  "historical cloud inserts were not batched");
assert(readinessPatches === 0,
  "initial upload unnecessarily PATCHed every inserted readiness entry");

// Simulate fresh browser/device signed into the same account (no local data).
storage.delete("kp.history");
storage.delete("kp.readiness");
const pagesBefore = readPages;
await sync.runFullCloudSync();
assert(db.loadHistory().length === 240 && db.loadReadinessHistory().length === 120,
  "new device did not recover all cloud records");
assert(readPages - pagesBefore >= 10,
  "cloud upload and read-back did not fetch multiple pages");
assert(workoutPosts === 1 && readinessPosts === 1,
  "recovered cloud rows were redundantly re-uploaded");

// Repeat a full sync with unchanged data. Should not reinsert 240 workouts
// or send a separate PATCH request for every historical daily check.
await sync.runFullCloudSync();
assert(workoutPosts === 1 && readinessPosts === 1 && readinessPatches === 0,
  "routine visibility/sign-in sync repeatedly wrote unchanged history");

// Local backup should restore the same records with the expanded bounds.
storage.delete("kp.history");
storage.delete("kp.readiness");
const restored = backup.restoreLocalBackup(exported);
assert(restored.workouts === 240 && restored.readiness === 120,
  "backup restore counters still use the old 200/90 limits");
assert(db.loadHistory().length === 240 && db.loadReadinessHistory().length === 120,
  "backup restore dropped older valid entries");
console.log("Cloud history PASS: 500/365 device retention, 240/120 paged cross-device restore, no redundant full-sync writes and backup round-trip.");
