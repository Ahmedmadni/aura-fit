// Regression test for local-first sync isolation across Supabase accounts.
// No real Supabase credentials or network access required.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const data = new Map<string, string>();
const statuses: { state: string }[] = [];
(globalThis as any).window = {
  dispatchEvent: (event: Event) => {
    if (event.type === "aura:cloud-sync-status") {
      statuses.push((event as CustomEvent<{ state: string }>).detail);
    }
    return true;
  },
};
(globalThis as any).localStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { data.set(key, value); },
  removeItem: (key: string) => { data.delete(key); },
};
const { runFullCloudSync, syncLocalChange, CloudAccountChangedError } =
  await import("../src/lib/cloud-sync");

const assert = (value: unknown, msg: string) => {
  if (!value) throw new Error("Cloud account isolation: " + msg);
};
const session = (id: string) => ({
  access_token: "access-" + id, refresh_token: "refresh-" + id,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id, email: id + "@example.test" },
});
const setUser = (id: string) =>
  data.set("kp.cloud.session", JSON.stringify(session(id)));
const profile = (name: string) => ({
  name, level: "beginner", goals: ["general-fitness"],
  equipment: ["none", "mat"], injuries: [], daysPerWeek: 3,
  sessionMinutes: 30, sleepQuality: 4, fatigue: 2,
});
const setProfile = (name: string, updated = "2026-10-10T01:00:00.000Z") => {
  data.set("kp.profile", JSON.stringify(profile(name)));
  data.set("kp.profile.updated-at", updated);
};
const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200, headers: { "Content-Type": "application/json" },
});

let resolveReads: Array<(r: Response) => void> = [];
let writes = 0;
setUser("alpha");
setProfile("Alpha on device");
(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  if (init?.method === "POST") {
    writes++;
    return new Response(null, { status: 204 });
  }
  return new Promise<Response>((resolve) => resolveReads.push(resolve));
};
const staleSync = runFullCloudSync();
// Promise.all request setup happens in microtasks after token lookup.
for (let n = 0; n < 10 && resolveReads.length !== 3; n++) await Promise.resolve();
assert(resolveReads.length === 3, "three read requests must start for alpha");

setUser("bravo");
setProfile("Bravo on device");
resolveReads[0](json([{
  user_id: "alpha", client_updated_at: "2026-10-12T00:00:00.000Z",
  data: profile("Alpha from cloud"),
}]));
resolveReads[1](json([]));
resolveReads[2](json([]));
let changedError = false;
try {
  await staleSync;
} catch (error) {
  changedError = error instanceof CloudAccountChangedError;
}
assert(changedError, "a stale sync must abort after account switch");
assert(JSON.parse(data.get("kp.profile") ?? "{}").name === "Bravo on device",
  "old cloud result overwrote the currently signed-in account");
assert(writes === 0, "old account attempted a cloud write after switch");
assert(data.get("kp.cloud.session")?.includes('"bravo"'),
  "old cloud result changed the current login");
assert(!statuses.some(s => s.state === "synced"),
  "stale account emitted a false successful sync status");

// A local-save event races with account switching while the async session
// lookup resolves. It must not send the new user's local record to old user.
setUser("alpha");
setProfile("Alpha on device");
let localWrites = 0;
(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  if (init?.method === "POST") {
    localWrites++;
    return new Response(null, { status: 204 });
  }
  throw new Error("No GET expected for this test");
};
const pendingLocal = syncLocalChange({ kind: "profile" });
setUser("bravo");
setProfile("Bravo on device");
await pendingLocal;
assert(localWrites === 0, "local-save raced with account switch and leaked data");

// Normal, same-account full sync should still retrieve/merge/upload.
setUser("bravo");
setProfile("Bravo on device");
const posted: Array<{ path: string; payload: any }> = [];
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  if (init?.method === "POST") {
    posted.push({ path: url, payload: JSON.parse(String(init.body)) });
    return new Response(null, { status: 204 });
  }
  return json([]);
};
const ok = await runFullCloudSync();
assert(ok.signedIn === true, "current account could not complete a normal sync");
assert(posted.some(x => x.path.includes("aura_profiles") &&
  x.payload.user_id === "bravo" && x.payload.data.name === "Bravo on device"),
  "current account did not upload its own profile");
assert(!posted.some(x => x.payload.user_id === "alpha"),
  "current account sync leaked records across user IDs");
console.log("Cloud account isolation PASS: stale GET, local-save switch and current-account reconciliation.");
