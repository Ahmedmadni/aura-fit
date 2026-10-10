// Test account-scoped device data with mocked Supabase auth (no real network).
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";
const values = new Map<string, string>();
(globalThis as any).window = { dispatchEvent: (_: Event) => true };
(globalThis as any).localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};
const vault = await import("../src/lib/cloud-local-vault");
const auth = await import("../src/lib/cloud-auth");
const assert = (condition: unknown, msg: string) => {
  if (!condition) throw new Error("Local account vault: " + msg);
};
const items = [
  "kp.profile", "kp.profile.updated-at", "kp.history", "kp.readiness",
  "kp.achievements", "aura.workout-session.v1", "aura.workout-session-meta.v1",
];
assert(items.every(k => vault.LOCAL_ACCOUNT_DATA_KEYS.includes(k as any)),
  "one or more account-specific keys were not covered");
const creds = (email: string) => ({
  access_token: "access-" + email, refresh_token: "refresh-" + email,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: email, email: email + "@example.test" },
});
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  if (url.includes("/auth/v1/token?grant_type=password")) {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(creds(body.email)), { status: 200 });
  }
  if (url.endsWith("/auth/v1/logout")) return new Response(null, { status: 204 });
  throw new Error("Unexpected network request " + url);
};
values.set("kp.profile", JSON.stringify({ name: "Guest" }));
values.set("kp.history", '[{"id":"guest-1"}]');
await auth.signInCloud("alpha", "test-only");
assert(JSON.parse(values.get("kp.profile") ?? "{}").name === "Guest",
  "first login lost guest data");
assert(values.get("kp.history")?.includes("guest-1"),
  "guest history was discarded during first login");
assert(values.get("aura.cloud.local-owner.v1") === "alpha",
  "first account did not claim the anonymous dataset");

values.set("kp.profile", JSON.stringify({ name: "Alpha" }));
values.set("kp.history", '[{"id":"alpha-1"}]');
values.set("kp.readiness", '[{"dateKey":"2026-10-10","energy":4}]');
values.set("kp.achievements", '["first-workout"]');
values.set("aura.workout-session.v1", '{"dayIndex":0}');
values.set("aura.workout-session-meta.v1", '{"start":"alpha"}');
await auth.signOutCloud();
assert(values.get("kp.history")?.includes("alpha-1"), "logout deleted device data");

await auth.signInCloud("bravo", "test-only");
assert(auth.loadCloudSession()?.user.id === "bravo", "second login failed");
for (const key of items) assert(!values.has(key), "account B inherited " + key);
values.set("kp.profile", JSON.stringify({ name: "Bravo" }));
values.set("kp.history", '[{"id":"bravo-1"}]');
values.set("aura.workout-session.v1", '{"dayIndex":2}');
await auth.signOutCloud();
await auth.signInCloud("alpha", "test-only");
assert(auth.loadCloudSession()?.user.id === "alpha", "re-login A failed");
assert(values.get("kp.history")?.includes("alpha-1"), "alpha workouts not restored");
assert(values.get("kp.profile")?.includes("Alpha"), "alpha profile not restored");
assert(values.get("kp.readiness")?.includes("energy"), "alpha readiness not restored");
assert(values.get("kp.achievements")?.includes("first-workout"), "achievements lost");
assert(values.get("aura.workout-session.v1")?.includes("dayIndex"), "draft lost");
assert(values.get("aura.workout-session-meta.v1")?.includes("alpha"),
  "safety signature metadata lost");
assert(!values.get("kp.history")?.includes("bravo"), "bravo data leaked into alpha");

await auth.signInCloud("bravo", "test-only");
assert(values.get("kp.profile")?.includes("Bravo"), "bravo profile not restored");
assert(values.get("kp.history")?.includes("bravo-1"), "bravo history not restored");
assert(!values.get("kp.history")?.includes("alpha-1"), "alpha data leaked into bravo");
values.set("aura.cloud.local-data.v1.charlie", "{invalid");
let rejected = false;
try { await auth.signInCloud("charlie", "test-only"); }
catch { rejected = true; }
assert(rejected, "corrupt target snapshot was accepted");
assert(auth.loadCloudSession()?.user.id === "bravo", "failed switch changed identity");
assert(values.get("kp.history")?.includes("bravo-1"),
  "failed account switch destroyed active history");
console.log("Cloud local vault PASS: guest adoption, logout, account swap, draft restoration and corrupt snapshot guard.");
