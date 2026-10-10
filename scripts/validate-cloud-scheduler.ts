// Phase 40: deterministic lifecycle scheduler contracts. No browser, network
// credentials or Supabase project are needed.
import { createCloudSyncCoordinator } from "../src/lib/cloud-sync-scheduler";

const assert = (value: unknown, label: string) => {
  if (!value) throw new Error("Cloud sync scheduler: " + label);
};
type Gate = { user: string | null; resolve: () => void; reject: () => void };
let user: string | null = "account-A";
let time = 100_000;
const pending = new Map<string, number>();
const calls: Gate[] = [];
const create = () => createCloudSyncCoordinator({
  getUserId: () => user,
  getPendingCount: (id) => pending.get(id) ?? 0,
  now: () => time,
  quietPeriodMs: 45_000,
  runFullSync: () => new Promise<void>((resolve, reject) => {
    calls.push({ user, resolve, reject });
  }),
});
const scheduler = create();
const next = async () => { await Promise.resolve(); await Promise.resolve(); };

// The initial mount starts one full sync. Multiple visibility changes while
// in flight do not cause more network calls. But a local edit/reconnect
// requests one final pass, not one pass per browser event.
const first = scheduler.request("initial");
assert(calls.length === 1 && calls[0].user === "account-A",
  "startup did not start exactly one reconciliation");
void scheduler.request("visible");
void scheduler.request("visible");
void scheduler.request("local");
void scheduler.request("online");
void scheduler.request("local");
assert(calls.length === 1, "duplicate full sync during an in-flight request");
calls[0].resolve();
await next();
assert(calls.length === 2, "pending edits were not replayed after current sync");
calls[1].resolve();
await first;
assert(calls.length === 2, "repeated browser signals caused more than one replay");

// After a verified success, lifecycle chatter is suppressed for 45 seconds.
time += 1000;
await scheduler.request("visible");
await scheduler.request("online");
await scheduler.request("auth");
assert(calls.length === 2, "quiet period did not suppress redundant syncs");

// A recent verification cannot suppress pending offline changes.
pending.set("account-A", 1);
const pendingRun = scheduler.request("visible");
assert(calls.length === 3, "an outstanding offline change was rate-limited");
calls[2].resolve();
await pendingRun;
pending.set("account-A", 0);

// Failures immediately lift the quiet period; the next browser trigger retries.
time += 50_000;
const failing = scheduler.request("visible");
assert(calls.length === 4, "elapsed quiet period did not allow a new sync");
calls[3].reject(new Error("simulated offline response"));
await failing;
const retry = scheduler.request("online");
assert(calls.length === 5, "failed sync was incorrectly rate-limited");
calls[4].resolve();
await retry;

// Switching signed-in accounts during an active sync queues the *new*
// account rather than letting the old account's success silence its sync.
time += 50_000;
const switching = scheduler.request("visible");
assert(calls.length === 6 && calls[5].user === "account-A",
  "pre-switch reconciliation did not start");
user = "account-B";
void scheduler.request("auth");
void scheduler.request("visible");
assert(calls.length === 6, "started a concurrent sync for the new account");
calls[5].resolve();
await next();
assert(calls.length === 7 && calls[6].user === "account-B",
  "new account was not reconciled after old account finished");
calls[6].resolve();
await switching;
const beforeSameAuth = calls.length;
await scheduler.request("auth");
assert(calls.length === beforeSameAuth,
  "same-account auth refresh retriggered an already-verified sync");

// A local edit with no active full sync uses incremental upload instead.
await scheduler.request("local");
assert(calls.length === beforeSameAuth,
  "idle local edit triggered a redundant full synchronization");

// Cleanup must prevent an in-flight signal from launching another run.
time += 50_000;
const cleanup = scheduler.request("visible");
assert(calls.length === 8, "cleanup scenario did not start");
void scheduler.request("online");
scheduler.dispose();
calls[7].resolve();
await cleanup;
await scheduler.request("initial");
assert(calls.length === 8, "unmounted bridge retried after disposal");

// Fresh bridge sign-in after sign-out cannot inherit old account cooldown.
const fresh = create();
user = "account-A";
const mounted = fresh.request("initial");
assert(calls.length === 9, "fresh mount reused an obsolete success cache");
calls[8].resolve();
await mounted;
user = null;
await fresh.request("auth");
user = "account-A";
const signedIn = fresh.request("auth");
assert(calls.length === 10, "sign-out / sign-in was incorrectly throttled");
calls[9].resolve();
await signedIn;
fresh.dispose();

console.log("Cloud scheduler PASS: lifecycle bursts, offline pending, failed retry, account switch, signout, local edits and unmount.");
