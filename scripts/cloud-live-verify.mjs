/**
 * Opt-in LIVE Supabase RLS and cross-device conflict audit.
 *
 * Run only with two dedicated, disposable confirmed-email test accounts.
 * Uses a browser publishable/anon key and password login; NEVER a service-role
 * key. Test records are deleted in finally, scoped to their exact owner IDs.
 * No tests are run merely by importing this module.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const READINESS_DATE = "2099-12-31";
const CONFIRM = "isolated-test-accounts";

export function validateLiveConfig(config) {
  if (config?.confirm !== CONFIRM) {
    throw new Error("Set AURA_LIVE_TEST_CONFIRM=isolated-test-accounts for two disposable accounts.");
  }
  let url;
  try { url = new URL(config.url); }
  catch { throw new Error("Supply a valid Supabase project URL."); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Test URL must be a project origin: https://PROJECT.supabase.co/");
  }
  if (typeof config.key !== "string" || config.key.length < 10 ||
      config.key.startsWith("sb_secret_") || config.key.includes("service_role")) {
    throw new Error("Provide only a Supabase PUBLISHABLE/anon key, never a service-role key.");
  }
  // Also reject legacy JWT keys whose role is encoded in the payload.
  if (config.key.split(".").length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(config.key.split(".")[1], "base64url").toString("utf8"));
      if (claims.role === "service_role") {
        throw new Error("A service-role JWT is forbidden in the live audit.");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("forbidden")) throw error;
      throw new Error("Invalid legacy JWT key; use only an anon/publishable key.");
    }
  }
  if (!Array.isArray(config.users) || config.users.length !== 2 ||
      config.users.some(u => typeof u?.email !== "string" || !u.email.includes("@") ||
        typeof u?.password !== "string" || u.password.length < 6) ||
      config.users[0].email.toLowerCase() === config.users[1].email.toLowerCase()) {
    throw new Error("Two distinct, existing, email-confirmed disposable test accounts are required.");
  }
  return url.origin;
}

function assert(ok, label) {
  if (!ok) throw new Error("Cloud LIVE audit failed: " + label);
}
function httpError(label, response) {
  // Never print response bodies or credentials; Supabase errors might carry PII.
  return new Error(label + " (HTTP " + response.status + ")");
}
function buildRestPath(table, fields) {
  const q = new URLSearchParams(fields);
  return "/rest/v1/" + table + (q.size ? "?" + q.toString() : "");
}
function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}
function queryOwner(id, extra = {}) {
  return { user_id: "eq." + id, ...extra };
}

export async function auditLiveCloud(config, fetcher = fetch, uuid = randomUUID) {
  const origin = validateLiveConfig(config);
  const sessions = [];
  const results = [];
  const created = [];
  let error = null;

  async function auth(email, password) {
    const r = await fetcher(origin + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw httpError("Unable to sign in to disposable test account", r);
    const payload = await r.json();
    assert(typeof payload.access_token === "string", "auth token missing");
    const who = await fetcher(origin + "/auth/v1/user", {
      headers: { apikey: config.key, Authorization: "Bearer " + payload.access_token },
    });
    if (!who.ok) throw httpError("Could not validate test account identity", who);
    const identity = await who.json();
    assert(typeof identity.id === "string" && /^[\da-f-]{36}$/i.test(identity.id),
      "validated user ID missing");
    assert(identity.id === payload.user?.id, "token user ID mismatch");
    return { id: identity.id, token: payload.access_token };
  }

  async function rest(user, table, method = "GET", query = {}, body, prefer) {
    const headers = {
      apikey: config.key,
      Authorization: "Bearer " + user.token,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    };
    const r = await fetcher(origin + buildRestPath(table, query), {
      method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    if (r.ok && r.status !== 204) {
      const text = await r.text();
      if (text) data = JSON.parse(text);
    }
    return { status: r.status, ok: r.ok, data };
  }

  async function checkOwn(user, table, filters, label) {
    const r = await rest(user, table, "GET", {
      ...queryOwner(user.id, filters), select: "user_id,data", limit: "1",
    });
    assert(r.ok && Array.isArray(r.data) && r.data.length === 1 &&
      r.data[0].user_id === user.id, label + " own row inaccessible");
    return r.data[0].data;
  }
  async function getForeign(who, other, table, filters, label) {
    const r = await rest(who, table, "GET", {
      ...queryOwner(other.id, filters), select: "user_id", limit: "1",
    });
    assert(r.ok && Array.isArray(r.data) && r.data.length === 0,
      label + " leaked a foreign row through SELECT");
  }
  async function createRecord(user, table, query, row, deletionFilter) {
    const r = await rest(user, table, "POST", query, row, "return=minimal");
    assert(r.ok, "could not create audit row in " + table + " (HTTP " + r.status + ")");
    created.push({ user, table, filter: deletionFilter });
  }
  async function crossModify(actor, owner, table, filter) {
    for (const method of ["PATCH", "DELETE"]) {
      const res = await rest(
        actor, table, method,
        { ...queryOwner(owner.id, filter), select: "user_id" },
        method === "PATCH" ? { data: { audit_marker: "foreign-write-should-be-denied" } } : undefined,
        "return=representation",
      );
      // RLS typically filters to an empty affected-row result; reject any
      // successful foreign mutation even if the server uses 200 vs 204.
      assert(!res.ok || (Array.isArray(res.data) && res.data.length === 0),
        table + " allowed a foreign " + method);
    }
  }
  async function forbiddenInsert(actor, owner, table, query, body, cleanupFilter) {
    const r = await rest(actor, table, "POST", query, body, "return=minimal");
    if (r.ok) {
      // If policy is misconfigured, still delete only this test's own row.
      created.push({ user: owner, table, filter: cleanupFilter });
    }
    assert(!r.ok, table + " accepted an insert owned by another user");
  }
  async function guardedUpdate(user, table, filter, column, stamp, row) {
    const r = await rest(user, table, "PATCH",
      { ...queryOwner(user.id, filter), [column]: "lt." + stamp },
      row, "return=minimal");
    assert(r.ok, "conditional " + table + " PATCH failed (HTTP " + r.status + ")");
  }

  try {
    for (const u of config.users) sessions.push(await auth(u.email, u.password));
    const [a, b] = sessions;
    assert(a.id !== b.id, "the two accounts resolve to the same user ID");
    results.push("Two separately authenticated user IDs");

    // Abort BEFORE mutation if test accounts hold real profile or reserved
    // readiness data. Do not delete or rewrite an existing user's records.
    for (const user of sessions) {
      for (const [table, filter] of [
        ["aura_profiles", {}],
        ["aura_readiness", { date_key: "eq." + READINESS_DATE }],
      ]) {
        const r = await rest(user, table, "GET",
          { ...queryOwner(user.id, filter), select: "user_id", limit: "1" });
        assert(r.ok && Array.isArray(r.data), table + " unavailable: apply schema/RLS first");
        assert(r.data.length === 0,
          "test account already has " + table + " data in reserved slot; use new accounts");
      }
    }
    results.push("Preflight: no existing profile or reserved readiness test data");

    const token = "aura-live-" + uuid();
    const baseline = iso(0);
    const older = iso(-60000);
    const later = iso(60000);
    const workouts = new Map();
    for (const user of sessions) {
      const workoutId = token + "-" + user.id.slice(0, 8);
      workouts.set(user.id, workoutId);
      const p = { user_id: user.id, client_updated_at: baseline,
        data: { audit_marker: token, profile_version: "baseline" } };
      const rd = { user_id: user.id, date_key: READINESS_DATE, recorded_at: baseline,
        data: { audit_marker: token, dateKey: READINESS_DATE, recordedAt: baseline,
          energy: 3, sleepQuality: 3, fatigue: 3, muscleSoreness: 2 } };
      const wo = { user_id: user.id, workout_id: workoutId, workout_date: baseline,
        data: { audit_marker: token, id: workoutId, date: baseline, performance: 72 } };
      await createRecord(user, "aura_profiles", {}, p, {});
      await createRecord(user, "aura_readiness", {}, rd, { date_key: "eq." + READINESS_DATE });
      await createRecord(user, "aura_workouts", {}, wo, { workout_id: "eq." + workoutId });
      for (const [table, filters] of [
        ["aura_profiles", {}],
        ["aura_readiness", { date_key: "eq." + READINESS_DATE }],
        ["aura_workouts", { workout_id: "eq." + workoutId }],
      ]) {
        await checkOwn(user, table, filters, table);
      }
    }
    results.push("Owner SELECT/INSERT on all three cloud tables");

    for (const [actor, owner] of [[a, b], [b, a]]) {
      for (const [table, filter] of [
        ["aura_profiles", {}],
        ["aura_readiness", { date_key: "eq." + READINESS_DATE }],
        ["aura_workouts", { workout_id: "eq." + workouts.get(owner.id) }],
      ]) {
        await getForeign(actor, owner, table, filter, table);
        await crossModify(actor, owner, table, filter);
        await checkOwn(owner, table, filter, table + " after blocked mutation");
      }
    }
    results.push("Both directions: foreign SELECT/PATCH/DELETE denied by RLS");

    // Test a foreign INSERT with a never-used ID/date, not a conflict with an
    // existing row (which could produce 409 rather than an RLS violation).
    const attemptedWorkout = token + "-foreign";
    await forbiddenInsert(b, a, "aura_workouts", {}, {
      user_id: a.id, workout_id: attemptedWorkout, workout_date: baseline,
      data: { audit_marker: token }
    }, { workout_id: "eq." + attemptedWorkout });
    const foreignReadinessDate = "2099-12-30";
    const reserved = await rest(a, "aura_readiness", "GET",
      { ...queryOwner(a.id, { date_key: "eq." + foreignReadinessDate }),
        select: "user_id", limit: "1" });
    assert(reserved.ok && Array.isArray(reserved.data) && reserved.data.length === 0,
      "extra readiness probe date is not empty");
    await forbiddenInsert(b, a, "aura_readiness", {}, {
      user_id: a.id, date_key: foreignReadinessDate, recorded_at: baseline,
      data: { audit_marker: token },
    }, { date_key: "eq." + foreignReadinessDate });
    results.push("Foreign-owned INSERT denied for workouts and readiness");

    // Verify the same conditional-write semantics used by the actual app,
    // including a simulated device with an older or newer clock.
    const profileFilter = {};
    const rFilter = { date_key: "eq." + READINESS_DATE };
    for (const [table, filter, version] of [
      ["aura_profiles", profileFilter, "client_updated_at"],
      ["aura_readiness", rFilter, "recorded_at"],
    ]) {
      const stale = { user_id: a.id, [version]: older,
        data: { audit_marker: token, profile_version: "stale" } };
      const fresh = { user_id: a.id, [version]: later,
        data: { audit_marker: token, profile_version: "new" } };
      if (table === "aura_readiness") {
        stale.date_key = READINESS_DATE; fresh.date_key = READINESS_DATE;
      }
      await guardedUpdate(a, table, filter, version, older, stale);
      assert((await checkOwn(a, table, filter, table)).profile_version !== "stale",
        table + " overwrote a newer row with an old timestamp");
      await guardedUpdate(a, table, filter, version, later, fresh);
      assert((await checkOwn(a, table, filter, table)).profile_version === "new",
        table + " rejected a newer conditional write");
    }
    results.push("PostgreSQL conditional timestamp comparisons: older rejected, newer accepted");

    const id = workouts.get(a.id);
    const duplicate = await rest(a, "aura_workouts", "POST",
      { on_conflict: "user_id,workout_id" },
      { user_id: a.id, workout_id: id, workout_date: later,
        data: { audit_marker: token, performance: 999 } },
      "resolution=ignore-duplicates,return=minimal");
    assert(duplicate.ok, "workout duplicate ignore request failed");
    assert((await checkOwn(a, "aura_workouts", { workout_id: "eq." + id },
      "immutable workout")).performance === 72,
      "duplicate workout ID overwrote immutable cloud data");
    results.push("Immutable workout ID cannot overwrite an existing record");
  } catch (caught) {
    error = caught;
  } finally {
    const cleanupFailures = [];
    for (const row of created.reverse()) {
      try {
        const r = await rest(row.user, row.table, "DELETE", {
          ...queryOwner(row.user.id, row.filter),
        }, undefined, "return=minimal");
        if (!r.ok) cleanupFailures.push(row.table + " HTTP " + r.status);
      } catch { cleanupFailures.push(row.table + " request failed"); }
    }
    if (cleanupFailures.length) {
      const suffix = "Test-row cleanup was incomplete: " + cleanupFailures.join(", ");
      error = new Error((error ? error.message + "; " : "") + suffix);
    }
  }
  if (error) throw error;
  return results;
}

function getConfig() {
  return {
    url: process.env.AURA_LIVE_SUPABASE_URL,
    key: process.env.AURA_LIVE_SUPABASE_PUBLISHABLE_KEY,
    confirm: process.env.AURA_LIVE_TEST_CONFIRM,
    users: [
      { email: process.env.AURA_LIVE_USER_A_EMAIL,
        password: process.env.AURA_LIVE_USER_A_PASSWORD },
      { email: process.env.AURA_LIVE_USER_B_EMAIL,
        password: process.env.AURA_LIVE_USER_B_PASSWORD },
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const details = await auditLiveCloud(getConfig());
    for (const detail of details) console.log("PASS: " + detail);
    console.log("PASS: Live Supabase RLS and conflict audit completed; test rows cleaned.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cloud live audit failed");
    process.exitCode = 1;
  }
}
