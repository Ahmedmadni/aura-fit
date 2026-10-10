// Regression coverage for Supabase 204 responses which did not actually
// save anything. No real project, network, keys or migrations are required.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const local = new Map<string, string>();
const statuses: Array<{ state: string; message: string }> = [];
(globalThis as any).window = { dispatchEvent: (event: Event) => {
  if (event.type === "aura:cloud-sync-status") {
    statuses.push((event as CustomEvent<{state: string; message: string}>).detail);
  }
  return true;
}};
(globalThis as any).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => { local.set(key, value); },
  removeItem: (key: string) => { local.delete(key); },
};
const ledger = await import("../src/lib/cloud-sync-ledger");
const { syncLocalChange, runFullCloudSync } = await import("../src/lib/cloud-sync");
const assert = (condition: unknown, label: string) => {
  if (!condition) throw new Error("Pending cloud verification: " + label);
};
const uid = "athlete-verify";
local.set("kp.cloud.session", JSON.stringify({
  access_token: "mock-access", refresh_token: "mock-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: uid },
}));
const old = "2026-10-09T08:00:00.000Z";
const fresh = "2026-10-10T08:00:00.000Z";
const makeProfile = (name: string) => ({
  name, level: "beginner", goals: ["general-fitness"],
  equipment: ["mat"], injuries: [], daysPerWeek: 3, sessionMinutes: 30,
  sleepQuality: 4, fatigue: 2,
});
const makeReadiness = (time: string, energy: number) => ({
  dateKey: "2026-10-10", recordedAt: time,
  sleepQuality: 4, fatigue: 2, muscleSoreness: 1, energy,
});
const makeWorkout = (id: string) => ({
  id, date: "2026-10-09T15:00:00.000Z",
  exercises: [{ id: "plank", sets: 3, reps: "30", completed: true }],
  durationSec: 1200, activeSec: 900, calories: 88,
  intensity: 60, performance: 78,
});
const setLocal = (time: string) => {
  local.set("kp.profile.updated-at", time);
  local.set("kp.profile", JSON.stringify(makeProfile("Saved on phone")));
  local.set("kp.readiness", JSON.stringify([makeReadiness(time, 5)]));
  local.set("kp.history", JSON.stringify([makeWorkout("session-one")]));
};
setLocal(fresh);
const cloud = {
  profile: null as any,
  readiness: new Map<string, any>(),
  workouts: new Map<string, any>(),
};
let ignoreWrites = true;
let hideWorkoutOnFetch = false;
const response = (payload: unknown, status = 200) =>
  status === 204 ? new Response(null, { status }) :
    new Response(JSON.stringify(payload), { status });
(globalThis as any).fetch = async (address: string, options?: RequestInit) => {
  const uri = new URL(address);
  const table = uri.pathname.split("/").at(-1);
  const method = options?.method ?? "GET";
  const body = options?.body ? JSON.parse(String(options.body)) : null;
  if (method === "GET") {
    if (table === "aura_profiles") return response(cloud.profile ? [cloud.profile] : []);
    if (table === "aura_readiness") {
      const date = uri.searchParams.get("date_key");
      const records = [...cloud.readiness.values()];
      return response(date?.startsWith("eq.") ?
        records.filter(x => x.date_key === date.slice(3)) : records);
    }
    const id = uri.searchParams.get("workout_id");
    const records = hideWorkoutOnFetch ? [] : [...cloud.workouts.values()];
    return response(id?.startsWith("eq.") ?
      records.filter(x => x.workout_id === id.slice(3)) : records);
  }
  if (!ignoreWrites && method === "POST") {
    const records = Array.isArray(body) ? body : [body];
    if (table === "aura_profiles") cloud.profile ??= records[0];
    if (table === "aura_readiness") {
      for (const record of records) {
        if (!cloud.readiness.has(record.date_key)) cloud.readiness.set(record.date_key, record);
      }
    }
    if (table === "aura_workouts") {
      for (const record of records) {
        if (!cloud.workouts.has(record.workout_id)) cloud.workouts.set(record.workout_id, record);
      }
    }
  }
  if (!ignoreWrites && method === "PATCH") {
    const compare = table === "aura_profiles" ? "client_updated_at" : "recorded_at";
    if (table === "aura_profiles" && cloud.profile &&
        Date.parse(cloud.profile[compare]) < Date.parse(body[compare])) {
      cloud.profile = body;
    }
    if (table === "aura_readiness") {
      const current = cloud.readiness.get(body.date_key);
      if (current && Date.parse(current[compare]) < Date.parse(body[compare])) {
        cloud.readiness.set(body.date_key, body);
      }
    }
  }
  // A successful PostgREST 204 does not prove a conditional write occurred.
  return response(null, 204);
};
const profile = { kind: "profile" } as const;
const readiness = { kind: "readiness", dateKey: "2026-10-10" } as const;
const workout = { kind: "workout", id: "session-one" } as const;

for (const change of [profile, readiness, workout]) {
  statuses.length = 0;
  await syncLocalChange(change);
  assert(statuses.some(status => status.state === "error"),
    "empty verification produced a successful " + change.kind + " status");
}
assert(ledger.pendingCloudChanges(uid) === 3,
  "HTTP 204 without a verified server row cleared a pending edit");

// A full sync has 3 successful GETs and 3 "successful" POSTs, yet server
// contains NONE of the pending records. The ledger must remain untouched.
statuses.length = 0;
await runFullCloudSync();
assert(ledger.pendingCloudChanges(uid) === 3,
  "full reconciliation confirmed records that don't exist on the server");
assert(!ledger.loadCloudSyncLedger(uid).verifiedAt,
  "unverified full sync received an incorrect verifiedAt timestamp");
assert(statuses.some(x => x.message.includes("لم يُتحقق")),
  "partial synchronization was incorrectly displayed as completed");

// Restore network writes. Normal full synchronization uploads and verifies
// the three pending rows; all outstanding markers should now clear.
ignoreWrites = false;
await runFullCloudSync();
assert(ledger.pendingCloudChanges(uid) === 0,
  "genuine server writes did not confirm the pending data");
assert(Boolean(ledger.loadCloudSyncLedger(uid).verifiedAt),
  "confirmed server data is missing a verification timestamp");

// Simulate an outdated server row and an ignored PATCH for local data that
// has been edited after the previous successful round-trip.
local.set("kp.profile.updated-at", "2026-10-12T08:00:00.000Z");
local.set("kp.readiness", JSON.stringify([makeReadiness("2026-10-12T08:00:00.000Z", 2)]));
ignoreWrites = true;
for (const change of [profile, readiness]) {
  statuses.length = 0;
  await syncLocalChange(change);
  assert(statuses.some(x => x.state === "error"),
    "outdated server row confirmed newer local " + change.kind);
}
assert(ledger.pendingCloudChanges(uid) === 2,
  "server rejected an update but ledger reported it as confirmed");

// Full sync may fetch only 200 latest workouts. The pending workout may have
// been stored but fallen outside the result set: never assume it was verified.
const pendingWorkout = ledger.markCloudChangePending(uid, workout);
ignoreWrites = false;
hideWorkoutOnFetch = true;
await runFullCloudSync();
assert(ledger.loadCloudSyncLedger(uid).pending["workout:session-one"] === pendingWorkout,
  "a workout omitted from the paged GET was falsely acknowledged");
hideWorkoutOnFetch = false;
await runFullCloudSync();
assert(ledger.pendingCloudChanges(uid) === 0,
  "confirmed records did not clear after a later successful read");
console.log("Cloud pending proof PASS: 204 empty rows, stale server records, limited fetch, pending retention and true recovery.");
