// Simulate PostgREST insert-on-conflict-ignore and conditional PATCH, including
// cases where the second device is older than the database. No credentials.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const local = new Map<string, string>();
const calls: Array<{ method: string; url: string; prefer: string }> = [];
(globalThis as any).window = { dispatchEvent: (_e: Event) => true };
(globalThis as any).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, val: string) => { local.set(key, val); },
  removeItem: (key: string) => { local.delete(key); },
};
const assert = (x: unknown, message: string) => {
  if (!x) throw new Error("Cloud conflict regression: " + message);
};
const { syncLocalChange, runFullCloudSync } = await import("../src/lib/cloud-sync");
const userId = "athlete-one";
local.set("kp.cloud.session", JSON.stringify({
  access_token: "mock", refresh_token: "mock-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: userId },
}));
const profile = (name: string) => ({
  name, level: "beginner", goals: ["strength"], equipment: ["mat"],
  injuries: [], daysPerWeek: 3, sessionMinutes: 35, sleepQuality: 4, fatigue: 2,
});
const readiness = (at: string, energy: number) => ({
  dateKey: "2026-10-10", recordedAt: at, sleepQuality: 4,
  fatigue: 2, muscleSoreness: 1, energy,
});
const workout = (performance: number) => ({
  id: "workout-001", date: "2026-10-09T15:00:00.000Z",
  exercises: [{ id: "plank", sets: 3, reps: "30 s", completed: true }],
  durationSec: 1200, activeSec: 800, calories: 95,
  intensity: 55, performance,
});
const past = "2026-10-09T10:00:00.000Z";
const future = "2026-10-10T10:00:00.000Z";
const remote = {
  profile: null as any,
  readiness: new Map<string, any>(),
  workouts: new Map<string, any>(),
};
const setDevice = (name: string, at: string, energy: number, performance: number) => {
  local.set("kp.profile", JSON.stringify(profile(name)));
  local.set("kp.profile.updated-at", at);
  local.set("kp.readiness", JSON.stringify([readiness(at, energy)]));
  local.set("kp.history", JSON.stringify([workout(performance)]));
};
const reply = (data: unknown, code = 200) =>
  code === 204 ? new Response(null, { status: 204 })
  : new Response(JSON.stringify(data), { status: code });
(globalThis as any).fetch = async (address: string, init?: RequestInit) => {
  const url = new URL(address);
  const path = url.pathname;
  const method = init?.method ?? "GET";
  const prefer = new Headers(init?.headers).get("Prefer") ?? "";
  calls.push({ method, url: address, prefer });
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  const table = path.split("/").at(-1);
  const key = (item: any) => table === "aura_readiness" ? item.date_key : item.workout_id;
  const stored = table === "aura_readiness" ? remote.readiness : remote.workouts;
  if (method === "GET") {
    if (table === "aura_profiles") return reply(remote.profile ? [remote.profile] : []);
    return reply(Array.from(stored.values()));
  }
  if (method === "POST") {
    assert(prefer.includes("resolution=ignore-duplicates"),
      "POST could overwrite existing rows");
    const rows = Array.isArray(body) ? body : [body];
    if (table === "aura_profiles") {
      if (!remote.profile) remote.profile = rows[0];
    } else {
      for (const row of rows) if (!stored.has(key(row))) stored.set(key(row), row);
    }
    return reply(null, 204);
  }
  if (method === "PATCH") {
    assert(prefer.includes("return=minimal"), "PATCH header missing");
    const timestamp = table === "aura_profiles" ? "client_updated_at" : "recorded_at";
    const versionFilter = url.searchParams.get(timestamp);
    assert(versionFilter?.startsWith("lt."), "update does not require an older timestamp");
    const expected = Date.parse(versionFilter!.slice(3));
    assert(Number.isFinite(expected), "timestamp conditional filter invalid");
    if (table === "aura_profiles") {
      if (remote.profile && Date.parse(remote.profile[timestamp]) < expected)
        remote.profile = body;
    } else {
      const existing = stored.get(body.date_key);
      if (existing && Date.parse(existing[timestamp]) < expected)
        stored.set(body.date_key, body);
    }
    return reply(null, 204);
  }
  throw new Error("Unexpected request: " + method + " " + table);
};
// Device A writes a newer profile/readiness and an immutable completed workout.
setDevice("Newest", future, 5, 95);
await runFullCloudSync();
assert(remote.profile.data.name === "Newest", "initial profile did not sync");
assert(remote.readiness.get("2026-10-10")?.data.energy === 5, "initial readiness failed");
assert(remote.workouts.get("workout-001")?.data.performance === 95,
  "initial workout failed");

// Device B is older and sends a stale local save without first pulling from A.
// Conditional PATCH must not regress cloud data.
setDevice("Stale", past, 1, 10);
await syncLocalChange({ kind: "profile" });
await syncLocalChange({ kind: "readiness", dateKey: "2026-10-10" });
await syncLocalChange({ kind: "workout", id: "workout-001" });
assert(remote.profile.data.name === "Newest", "stale profile overwrote newer cloud data");
assert(remote.readiness.get("2026-10-10")?.data.energy === 5,
  "stale readiness overwrote newer cloud data");
assert(remote.workouts.get("workout-001")?.data.performance === 95,
  "identical workout ID overwrote original workout");

// GET+merge must restore latest cloud records locally, not blindly prefer a
// workout with the same session date from the stale device.
await runFullCloudSync();
assert(JSON.parse(local.get("kp.profile") ?? "{}").name === "Newest",
  "full sync did not recover the latest profile");
assert(JSON.parse(local.get("kp.readiness") ?? "[]")[0]?.energy === 5,
  "full sync did not recover newest readiness");
assert(JSON.parse(local.get("kp.history") ?? "[]")[0]?.performance === 95,
  "workout conflict did not resolve to cloud original");

// New local edit with an even newer timestamp must be accepted by CAS PATCH.
const future2 = "2026-10-11T12:00:00.000Z";
setDevice("More recent", future2, 3, 3);
await syncLocalChange({ kind: "profile" });
await syncLocalChange({ kind: "readiness", dateKey: "2026-10-10" });
assert(remote.profile.data.name === "More recent", "newer profile PATCH was rejected");
assert(remote.readiness.get("2026-10-10")?.data.energy === 3,
  "newer readiness PATCH was rejected");
assert(remote.workouts.get("workout-001")?.data.performance === 95,
  "workout mutated when only profile/readiness changed");

// Empty/default new browser has no profile edit timestamp. It should pull
// cloud profile but never manufacture a fresh stamp on upload.
local.delete("kp.profile.updated-at");
local.delete("kp.profile");
await runFullCloudSync();
assert(remote.profile.data.name === "More recent",
  "default new-device profile replaced genuine cloud profile");
assert(!calls.some(x => x.method === "PATCH" && !x.url.includes("lt.")),
  "unsafe unconditional PATCH detected");
assert(!calls.some(x => x.method === "POST" && x.prefer.includes("merge-duplicates")),
  "legacy unconditional merge-upsert detected");
console.log("Cloud conflict scenarios PASS: older/newer profile/readiness, immutable workout IDs and fresh-device defaults.");
