// Aura Fit: verify that HTTP success is not mistaken for a successful CAS
// update, and that another device's changes become visible immediately.
// All Supabase responses below are mocked. No production credentials.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const local = new Map<string, string>();
const states: string[] = [];
(globalThis as any).window = {
  dispatchEvent: (event: Event) => {
    if (event.type === "aura:cloud-sync-status") {
      states.push((event as CustomEvent<{state: string}>).detail.state);
    }
    return true;
  },
};
(globalThis as any).localStorage = {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => { local.set(key, value); },
  removeItem: (key: string) => { local.delete(key); },
};
const { runFullCloudSync, syncLocalChange } = await import("../src/lib/cloud-sync");
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error("Cloud convergence: " + message);
};
const old = "2026-10-09T08:00:00.000Z";
const newer = "2026-10-10T08:00:00.000Z";
const athlete = "aura-athlete";
const cloud = {
  profile: null as any,
  readiness: new Map<string, any>(),
  workouts: new Map<string, any>(),
};
const athleteSession = (userId = athlete) => JSON.stringify({
  access_token: "fake-access-" + userId,
  refresh_token: "fake-refresh-" + userId,
  expires_at: Math.floor(Date.now() / 1000) + 7200,
  user: { id: userId },
});
const makeProfile = (name: string) => ({
  name, level: "beginner", goals: ["general-fitness"],
  equipment: ["mat"], injuries: [], daysPerWeek: 3,
  sessionMinutes: 30, fatigue: 2, sleepQuality: 4,
});
const makeReadiness = (when: string, energy: number) => ({
  dateKey: "2026-10-10", recordedAt: when, energy, sleepQuality: 4,
  fatigue: 2, muscleSoreness: 1,
});
const makeWorkout = (id: string, performance: number) => ({
  id, date: "2026-10-09T14:00:00.000Z", durationSec: 1200,
  activeSec: 900, calories: 100, intensity: 45, performance,
  exercises: [{ id: "plank", sets: 3, reps: "30 sec", completed: true }],
});
const setDevice = (name: string, at: string, energy: number, performance: number) => {
  local.set("kp.profile", JSON.stringify(makeProfile(name)));
  local.set("kp.profile.updated-at", at);
  local.set("kp.readiness", JSON.stringify([makeReadiness(at, energy)]));
  local.set("kp.history", JSON.stringify([makeWorkout("same-id", performance)]));
};
const response = (data: unknown, status = 200) =>
  status === 204 ? new Response(null, { status })
    : new Response(JSON.stringify(data), { status });
local.set("kp.cloud.session", athleteSession());
setDevice("Stale", old, 1, 5);
cloud.profile = {
  user_id: athlete, client_updated_at: newer, data: makeProfile("Remote"),
};
cloud.readiness.set("2026-10-10", {
  user_id: athlete, date_key: "2026-10-10", recorded_at: newer,
  data: makeReadiness(newer, 5),
});
cloud.workouts.set("same-id", {
  user_id: athlete, workout_id: "same-id",
  workout_date: "2026-10-09T14:00:00.000Z",
  data: makeWorkout("same-id", 95),
});
let failVerification = false;
let insertConcurrentWorkout = false;
let getCalls = 0;
let postCalls = 0;
let patchCalls = 0;
(globalThis as any).fetch = async (address: string, init?: RequestInit) => {
  const url = new URL(address);
  const table = url.pathname.split("/").at(-1);
  const method = init?.method ?? "GET";
  const incoming = init?.body ? JSON.parse(String(init.body)) : null;
  if (method === "GET") {
    getCalls++;
    if (failVerification) throw new TypeError("Connection interrupted during verification");
    if (table === "aura_profiles") return response(cloud.profile ? [cloud.profile] : []);
    if (table === "aura_readiness") {
      const key = url.searchParams.get("date_key");
      const rows = Array.from(cloud.readiness.values());
      return response(key?.startsWith("eq.") ? rows.filter(x => x.date_key === key.slice(3)) : rows);
    }
    const key = url.searchParams.get("workout_id");
    const rows = Array.from(cloud.workouts.values());
    return response(key?.startsWith("eq.") ? rows.filter(x => x.workout_id === key.slice(3)) : rows);
  }
  if (method === "POST") {
    postCalls++;
    const prefer = new Headers(init?.headers).get("Prefer") ?? "";
    assert(prefer.includes("resolution=ignore-duplicates"), "unsafe overwrite on insert");
    if (insertConcurrentWorkout && table === "aura_profiles") {
      // Device B saves a new workout AFTER the initial full-sync GET, but
      // BEFORE this device uploads. Only the post-write read should find it.
      cloud.workouts.set("new-from-b", {
        user_id: athlete, workout_id: "new-from-b",
        workout_date: "2026-10-10T02:00:00.000Z",
        data: makeWorkout("new-from-b", 88),
      });
      insertConcurrentWorkout = false;
    }
    const rows = Array.isArray(incoming) ? incoming : [incoming];
    for (const row of rows) {
      if (table === "aura_profiles") cloud.profile ??= row;
      else if (table === "aura_readiness") {
        if (!cloud.readiness.has(row.date_key)) cloud.readiness.set(row.date_key, row);
      } else if (!cloud.workouts.has(row.workout_id)) {
        cloud.workouts.set(row.workout_id, row);
      }
    }
    return response(null, 204);
  }
  if (method === "PATCH") {
    patchCalls++;
    const version = table === "aura_profiles" ? "client_updated_at" : "recorded_at";
    const param = url.searchParams.get(version);
    assert(param?.startsWith("lt."), "missing timestamp compare on PATCH");
    const candidateStamp = Date.parse(param!.slice(3));
    if (table === "aura_profiles") {
      if (Date.parse(cloud.profile[version]) < candidateStamp) cloud.profile = incoming;
    } else {
      const before = cloud.readiness.get(incoming.date_key);
      if (before && Date.parse(before[version]) < candidateStamp) {
        cloud.readiness.set(incoming.date_key, incoming);
      }
    }
    return response(null, 204);
  }
  throw new Error("Unexpected HTTP method " + method);
};

// A stale device sends successful-but-ignored POST and PATCH responses.
// The read-back must show the winning remote version immediately, not wait
// until the user manually requests a later full sync.
await syncLocalChange({ kind: "profile" });
assert(JSON.parse(local.get("kp.profile") ?? "{}").name === "Remote",
  "profile remained stale after server rejected its PATCH");
await syncLocalChange({ kind: "readiness", dateKey: "2026-10-10" });
assert(JSON.parse(local.get("kp.readiness") ?? "[]")[0]?.energy === 5,
  "readiness remained stale after server rejected its PATCH");
await syncLocalChange({ kind: "workout", id: "same-id" });
assert(JSON.parse(local.get("kp.history") ?? "[]")[0]?.performance === 95,
  "same-ID immutable cloud workout not restored");
assert(getCalls >= 3 && postCalls >= 3 && patchCalls >= 2,
  "incremental requests skipped post-write verification");

// A second device inserts a new workout between a full-sync GET and write.
// Only a final server read can discover the concurrent record.
insertConcurrentWorkout = true;
const readsBefore = getCalls;
const full = await runFullCloudSync();
assert(full.signedIn && full.workouts === 2, "new remote workout not counted");
assert(JSON.parse(local.get("kp.history") ?? "[]").some((x: any) => x.id === "new-from-b"),
  "concurrent remote workout missing from local history");
assert(getCalls - readsBefore >= 6, "full sync did not verify all remote collections");

// Failure of the second (verification) read must NOT claim a success.
states.length = 0;
setDevice("More recent", "2026-10-11T09:00:00.000Z", 3, 30);
failVerification = true;
await syncLocalChange({ kind: "profile" });
assert(states.includes("error") && !states.includes("synced"),
  "verification failure emitted a false synchronized status");
assert(JSON.parse(local.get("kp.profile") ?? "{}").name === "More recent",
  "failed verification erased local-first updates");

// Account change before read-back cannot move old account data into new user.
failVerification = false;
const savedFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  if ((init?.method ?? "GET") === "GET") {
    local.set("kp.cloud.session", athleteSession("another-athlete"));
    local.set("kp.profile", JSON.stringify(makeProfile("Another device account")));
  }
  return savedFetch(url, init);
};
states.length = 0;
await syncLocalChange({ kind: "profile" });
assert(JSON.parse(local.get("kp.profile") ?? "{}").name === "Another device account",
  "stale read-back modified switched account");
assert(!states.includes("synced"), "stale account verification reported success");
console.log("Cloud convergence PASS: stale ignored writes, incremental refresh, concurrent remote addition, read failure and account switch.");
