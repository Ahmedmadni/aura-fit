// Simulates Supabase Auth responses with no network or production credentials.
// Run with bun: CI must prove transient outages never log the athlete out.
process.env.VITE_SUPABASE_URL = "https://aura-test.supabase.co";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "fake-public-test-key";

const storage = new Map<string, string>();
const events: string[] = [];
(globalThis as any).window = {
  dispatchEvent: (event: Event) => { events.push(event.type); return true; },
};
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
const auth = await import("../src/lib/cloud-auth");

const assert = (value: unknown, message: string) => {
  if (!value) throw new Error("Cloud auth regression: " + message);
};
const now = Math.floor(Date.now() / 1000);
const response = (status: number, payload: object) =>
  new Response(JSON.stringify(payload), {
    status, headers: { "Content-Type": "application/json" },
  });
const tokens = (id: string, n: number, expires = now - 5) => ({
  access_token: "access-" + id + "-" + n,
  refresh_token: "refresh-" + id + "-" + n,
  expires_at: expires,
  user: { id, email: id + "@example.test" },
});

let refreshCalls = 0;
(globalThis as any).fetch = async (url: string) => {
  if (url.includes("grant_type=password")) return response(200, tokens("one", 1));
  if (url.includes("grant_type=refresh_token")) {
    refreshCalls++;
    return response(200, tokens("one", 2, now + 3600));
  }
  throw new Error("Unexpected fetch request: " + url);
};
await auth.signInCloud("one@example.test", "test-only");
const initial = auth.loadCloudSession();
assert(initial?.refresh_token === "refresh-one-1", "initial login not stored");
const sessions = await Promise.all(Array.from({ length: 5 }, () => auth.getValidCloudSession()));
assert(refreshCalls === 1, "concurrent refresh requests were not coalesced");
assert(sessions.every(s => s?.refresh_token === "refresh-one-2"),
  "concurrent refresh callers received inconsistent tokens");

storage.set("kp.cloud.session", JSON.stringify(tokens("one", 3)));
(globalThis as any).fetch = async () => { throw new TypeError("Failed to fetch"); };
const whileOffline = await auth.getValidCloudSession();
assert(whileOffline?.refresh_token === "refresh-one-3",
  "transient network outage logged the athlete out");
assert(auth.loadCloudSession()?.refresh_token === "refresh-one-3",
  "offline session was removed from storage");
(globalThis as any).fetch = async () => response(503, { msg: "temporarily unavailable" });
await auth.getValidCloudSession();
assert(auth.loadCloudSession()?.refresh_token === "refresh-one-3",
  "HTTP 503 incorrectly destroyed the session");
(globalThis as any).fetch = async () => response(200, tokens("one", 4, now + 3600));
const reconnected = await auth.getValidCloudSession();
assert(reconnected?.refresh_token === "refresh-one-4",
  "session failed to recover when Supabase came back");

storage.set("kp.cloud.session", JSON.stringify(tokens("one", 5)));
(globalThis as any).fetch = async () => response(400, {
  error: "invalid_grant", error_description: "Invalid Refresh Token",
});
const invalid = await auth.getValidCloudSession();
assert(invalid === null && auth.loadCloudSession() === null,
  "explicit invalid refresh token should invalidate the stored session");

let resolveRefresh!: (response: Response) => void;
(globalThis as any).fetch = async (url: string) => {
  if (url.includes("grant_type=password")) return response(200, tokens("one", 6));
  if (url.includes("grant_type=refresh_token")) {
    return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
  }
  if (url.includes("/auth/v1/logout")) return response(200, {});
  throw new Error("Unexpected fetch: " + url);
};
await auth.signInCloud("one@example.test", "test-only");
const pendingSignOut = auth.getValidCloudSession();
await Promise.resolve();
assert(typeof resolveRefresh === "function", "refresh test request not dispatched");
await auth.signOutCloud();
resolveRefresh(response(200, tokens("one", 7, now + 3600)));
const afterSignOut = await pendingSignOut;
assert(afterSignOut === null && auth.loadCloudSession() === null,
  "late refresh resurrected a signed-out account");

(globalThis as any).fetch = async (url: string) => {
  if (url.includes("grant_type=password")) return response(200, tokens("one", 8));
  if (url.includes("grant_type=refresh_token")) {
    return new Promise<Response>(resolve => { resolveRefresh = resolve; });
  }
  throw new Error("Unexpected fetch: " + url);
};
await auth.signInCloud("one@example.test", "test-only");
const pendingSwitch = auth.getValidCloudSession();
await Promise.resolve();
storage.set("kp.cloud.session", JSON.stringify(tokens("two", 1, now + 3600)));
resolveRefresh(response(200, tokens("one", 9, now + 3600)));
const afterSwitch = await pendingSwitch;
assert(afterSwitch?.user.id === "two" && auth.loadCloudSession()?.user.id === "two",
  "old user's token overwrite an active account switch");

// Legacy sessions lacking expiration must not rotate on every local write.
storage.set("kp.cloud.session", JSON.stringify({
  access_token: "legacy", refresh_token: "legacy-refresh", user: { id: "legacy" },
}));
(globalThis as any).fetch = async () => {
  throw new Error("Legacy sessions must not force refresh");
};
const legacy = await auth.getValidCloudSession();
assert(legacy?.access_token === "legacy", "legacy session unexpectedly forced refresh");
assert(events.includes(auth.CLOUD_AUTH_CHANGED_EVENT), "auth events were not emitted");
console.log("Cloud auth scenarios PASS: single-flight, offline/503 recovery, invalid token, sign-out, account switch and legacy sessions.");
