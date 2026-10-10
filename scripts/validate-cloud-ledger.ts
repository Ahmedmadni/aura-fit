// Aura Fit: pending cloud saves must survive network failures and must never be
// acknowledged by an older in-flight verification. No external credentials.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const storage = new Map<string, string>();
const events: string[] = [];
(globalThis as any).window = {
  dispatchEvent: (event: Event) => {
    events.push(event.type);
    return true;
  },
};
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
const ledger = await import("../src/lib/cloud-sync-ledger");
const sync = await import("../src/lib/cloud-sync");
const assert = (ok: unknown, message: string) => {
  if (!ok) throw new Error("Cloud pending-ledger regression: " + message);
};

const a = "athlete-a";
const b = "athlete-b";
const profileChange = { kind: "profile" } as const;
const workoutChange = { kind: "workout", id: "session-01" } as const;
const readinessChange = { kind: "readiness", dateKey: "2026-10-10" } as const;

// Out-of-order response must not acknowledge an edit that happened later.
const rev1 = ledger.markCloudChangePending(a, profileChange);
const rev2 = ledger.markCloudChangePending(a, profileChange);
assert(rev2 > rev1, "revisions did not advance");
ledger.confirmCloudChange(a, profileChange, rev1);
assert(ledger.pendingCloudChanges(a) === 1,
  "old response cleared a newer pending profile edit");
ledger.confirmCloudChange(a, profileChange, rev2);
assert(ledger.pendingCloudChanges(a) === 0, "latest edit stayed pending");
assert(Boolean(ledger.loadCloudSyncLedger(a).verifiedAt),
  "confirmed verification timestamp missing");

// Full sync must only clear revisions that existed when it started; if the
// athlete edits while the fetch is running, the newer edit stays outstanding.
ledger.markCloudChangePending(a, workoutChange);
ledger.markCloudChangePending(a, readinessChange);
const started = ledger.snapshotPendingCloudChanges(a);
ledger.markCloudChangePending(a, workoutChange);
ledger.confirmFullCloudSync(a, started);
assert(ledger.pendingCloudChanges(a) === 1,
  "full sync incorrectly acknowledged a newly edited workout");
assert("workout:session-01" in ledger.loadCloudSyncLedger(a).pending,
  "new workout revision was lost");

// Account switching never presents another athlete's pending records.
const other = ledger.markCloudChangePending(b, profileChange);
assert(ledger.pendingCloudChanges(a) === 1 &&
  ledger.pendingCloudChanges(b) === 1, "pending changes mixed across accounts");
ledger.confirmCloudChange(b, profileChange, other);
assert(ledger.pendingCloudChanges(b) === 0 &&
  ledger.pendingCloudChanges(a) === 1, "other athlete's confirmation cleared A");
const stillPending = ledger.loadCloudSyncLedger(a).pending["workout:session-01"];
ledger.confirmCloudChange(a, workoutChange, stillPending);
assert(ledger.pendingCloudChanges(a) === 0, "A could not clear matching revision");

// Simulate an authenticated local save that hits an offline Supabase endpoint.
storage.set("kp.cloud.session", JSON.stringify({
  access_token: "test-access", refresh_token: "test-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: a },
}));
storage.set("kp.profile.updated-at", "2026-10-10T08:00:00.000Z");
const profile = {
  name: "Athlete A", level: "beginner", goals: ["general-fitness"],
  equipment: ["mat"], injuries: [], daysPerWeek: 3, sessionMinutes: 30,
  sleepQuality: 4, fatigue: 2,
};
storage.set("kp.profile", JSON.stringify(profile));
let networkOnline = false;
let remote: any = null;
let writes = 0;
(globalThis as any).fetch = async (address: string, init?: RequestInit) => {
  if (!networkOnline) throw new TypeError("Network offline");
  const url = new URL(address);
  const method = init?.method ?? "GET";
  const table = url.pathname.split("/").at(-1);
  if (method === "GET") {
    if (table === "aura_profiles") return new Response(
      JSON.stringify(remote ? [remote] : []), { status: 200 },
    );
    return new Response("[]", { status: 200 });
  }
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (method === "POST" && table === "aura_profiles") {
    writes++;
    remote ??= body;
  } else if (method === "PATCH" && table === "aura_profiles") {
    writes++;
    if (remote && Date.parse(remote.client_updated_at) <
      Date.parse(body.client_updated_at)) {
      remote = body;
    }
  }
  return new Response(null, { status: 204 });
};
await sync.syncLocalChange(profileChange);
assert(ledger.pendingCloudChanges(a) === 1,
  "offline save was falsely confirmed instead of remaining pending");
assert(storage.get("kp.profile")?.includes("Athlete A"),
  "offline save changed the local-first profile");

networkOnline = true;
await sync.syncLocalChange(profileChange);
assert(writes === 2 && remote.data.name === "Athlete A",
  "reconnected update failed to create/verify the cloud profile");
assert(ledger.pendingCloudChanges(a) === 0,
  "successful server read-back did not clear the pending indicator");
assert(Boolean(ledger.loadCloudSyncLedger(a).verifiedAt),
  "sync read-back verification date missing");
assert(events.includes(ledger.CLOUD_SYNC_LEDGER_UPDATED_EVENT),
  "ledger state changes were not broadcast to the profile UI");

// A full sync with no pending edits is still entitled to report its last
// successful round-trip verification, but not to clear new concurrent edits.
const result = await sync.runFullCloudSync();
assert(result.signedIn === true && Boolean(ledger.loadCloudSyncLedger(a).verifiedAt),
  "full-sync verification did not update the ledger");

console.log("Cloud pending ledger PASS: out-of-order confirmations, cross-account isolation, full-sync races, offline retention, reconnect and final read-back.");
