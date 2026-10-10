// Local contract tests for the opt-in production RLS smoke. No network and no
// credentials: pretend to be two confirmed Supabase accounts and PostgREST.
import { auditLiveCloud, validateLiveConfig } from "./cloud-live-verify.mjs";

const fail = (msg) => { throw new Error("Cloud LIVE contract: " + msg); };
const assert = (x, msg) => { if (!x) fail(msg); };
const ids = {
  "alpha@example.test": "11111111-1111-4111-8111-111111111111",
  "bravo@example.test": "22222222-2222-4222-8222-222222222222",
};
const cfg = {
  url: "https://aura-test.supabase.co",
  key: "sb_publishable_ci_only",
  confirm: "isolated-test-accounts",
  users: [
    { email: "alpha@example.test", password: "testing-only-password" },
    { email: "bravo@example.test", password: "testing-only-password" },
  ],
};
const mustReject = (fn, msg) => {
  let rejected = false;
  try { fn(); } catch { rejected = true; }
  assert(rejected, msg);
};
mustReject(() => validateLiveConfig({ ...cfg, confirm: undefined }),
  "audit must require deliberate acknowledgment");
mustReject(() => validateLiveConfig({ ...cfg, key: "sb_secret_dangerous_key" }),
  "secret API key not rejected");
const serviceRoleJwt = "e30." +
  Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") +
  ".placeholder";
mustReject(() => validateLiveConfig({ ...cfg, key: serviceRoleJwt }),
  "service-role JWT not rejected");
mustReject(() => validateLiveConfig({ ...cfg, url: "http://localhost:54321" }),
  "non HTTPS/project URL accepted");
mustReject(() => validateLiveConfig({ ...cfg, users: [cfg.users[0], cfg.users[0]] }),
  "identical account identities accepted");
assert(validateLiveConfig(cfg) === "https://aura-test.supabase.co",
  "valid disposable test configuration rejected");

function pretendSupabase(
  enforceRls = true, allowAnonymous = false, silentDelete = false,
  anonymousReadDenied = false,
) {
  const tables = {
    aura_profiles: new Map(),
    aura_readiness: new Map(),
    aura_workouts: new Map(),
  };
  const calls = [];
  const respond = (status, body) => status === 204 ?
    new Response(null, { status }) :
    new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });
  const key = (table, row) => table === "aura_profiles" ? row.user_id :
    table === "aura_readiness" ? row.user_id + ":" + row.date_key :
    row.user_id + ":" + row.workout_id;
  const fetchMock = async (address, init = {}) => {
    const url = new URL(address);
    const method = init.method ?? "GET";
    calls.push({ method, path: url.pathname });
    if (url.pathname === "/auth/v1/token") {
      const { email } = JSON.parse(init.body);
      const id = ids[email];
      if (!id) return respond(400, { error: "invalid_grant" });
      return respond(200, { access_token: "mock-" + id, user: { id } });
    }
    if (url.pathname === "/auth/v1/user") {
      const id = (new Headers(init.headers).get("Authorization") ?? "").replace("Bearer mock-", "");
      return ids[Object.keys(ids).find(email => ids[email] === id)] ?
        respond(200, { id }) : respond(401, {});
    }
    const table = url.pathname.split("/").at(-1);
    if (!(table in tables)) return respond(404, { message: "table missing" });
    const bearer = (new Headers(init.headers).get("Authorization") ?? "");
    const caller = bearer.startsWith("Bearer mock-")
      ? bearer.replace("Bearer mock-", "") : "anon";
    if (caller === "anon" && !allowAnonymous)
      return respond(401, { message: "unauthorized" });
    if (caller !== "anon" && !Object.values(ids).includes(caller))
      return respond(401, { message: "unauthorized" });
    const prefer = new Headers(init.headers).get("Prefer") ?? "";
    const records = tables[table];
    const matches = (row) => {
      if (enforceRls && caller !== "anon" && row.user_id !== caller) return false;
      for (const [field, value] of url.searchParams) {
        if (field === "select" || field === "limit" || field === "on_conflict" ||
            field === "order") continue;
        if (value.startsWith("eq.") && String(row[field]) !== value.slice(3)) return false;
        if (value.startsWith("lt.") && !(Date.parse(row[field]) < Date.parse(value.slice(3))))
          return false;
      }
      return true;
    };
    if (method === "GET") {
      if (caller === "anon" && anonymousReadDenied) {
        return respond(403, { message: "anonymous SELECT denied" });
      }
      let rows = Array.from(records.values()).filter(matches);
      if (url.searchParams.has("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
      const fields = url.searchParams.get("select")?.split(",") ?? [];
      if (fields.length) rows = rows.map(row => Object.fromEntries(
        fields.filter(name => name in row).map(name => [name, row[name]])
      ));
      return respond(200, rows);
    }
    if (method === "POST") {
      const incoming = JSON.parse(init.body);
      for (const row of Array.isArray(incoming) ? incoming : [incoming]) {
        if (enforceRls && caller !== "anon" && row.user_id !== caller)
          return respond(403, { message: "RLS denied" });
        const id = key(table, row);
        if (records.has(id)) {
          if (!prefer.includes("resolution=ignore-duplicates")) return respond(409, {});
        } else {
          records.set(id, row);
        }
      }
      return respond(204);
    }
    const affected = [];
    for (const [id, row] of records.entries()) {
      if (!matches(row)) continue;
      affected.push(row);
      if (method === "PATCH") records.set(id, { ...row, ...JSON.parse(init.body) });
      else if (method === "DELETE" && !silentDelete) records.delete(id);
      else return respond(405, {});
    }
    if (prefer.includes("return=representation")) {
      const fields = url.searchParams.get("select")?.split(",") ?? [];
      return respond(200, affected.map(row => fields.length ?
        Object.fromEntries(fields.filter(name => name in row).map(name => [name, row[name]])) :
        row));
    }
    return respond(204);
  };
  return { fetchMock, tables, calls };
}

const mock = pretendSupabase();
const results = await auditLiveCloud(cfg, mock.fetchMock, () => "ci-check");
assert(results.length >= 8, "audit did not verify anonymous access and all RLS cases");
assert(Object.values(mock.tables).every(table => table.size === 0),
  "temporary test rows remain after successful audit");
assert(mock.calls.filter(call => call.path === "/auth/v1/user").length === 2,
  "auth identity verification was skipped");
assert(mock.calls.some(call => call.method === "PATCH") &&
  mock.calls.some(call => call.method === "DELETE"), "cross-user mutation checks were skipped");
assert(mock.calls.some(call => call.method === "GET" &&
  call.path.startsWith("/rest/v1/")), "REST policy checks did not execute");

const insecure = pretendSupabase(false);
let failedClosed = false;
try {
  await auditLiveCloud(cfg, insecure.fetchMock, () => "ci-insecure");
} catch (error) {
  failedClosed = String(error).includes("leaked a foreign row");
}
assert(failedClosed, "audit incorrectly passed against a database without RLS");
assert(Object.values(insecure.tables).every(table => table.size === 0),
  "temporary rows were not cleaned up when an RLS violation was found");

const anonymousLeak = pretendSupabase(true, true);
let leaked = false;
try {
  await auditLiveCloud(cfg, anonymousLeak.fetchMock, () => "ci-anon-leak");
} catch (error) {
  leaked = String(error).includes("unauthenticated visitor");
}
assert(leaked, "audit passed when anonymous visitors could SELECT account data");
assert(Object.values(anonymousLeak.tables).every(table => table.size === 0),
  "anonymous-access failure left disposable audit rows behind");

const anonymousInsertLeak = pretendSupabase(true, true, false, true);
let inserted = false;
try {
  await auditLiveCloud(cfg, anonymousInsertLeak.fetchMock, () => "ci-anon-insert");
} catch (error) {
  inserted = String(error).includes("anonymous visitor inserted");
}
assert(inserted, "audit passed when anonymous INSERT was allowed but SELECT was denied");
assert(Object.values(anonymousInsertLeak.tables).every(table => table.size === 0),
  "anonymous-insert regression left disposable test rows behind");

const failedCleanup = pretendSupabase(true, false, true);
let refusedFalseCleanup = false;
try {
  await auditLiveCloud(cfg, failedCleanup.fetchMock, () => "ci-silent-delete");
} catch (error) {
  refusedFalseCleanup = String(error).includes("cleanup was incomplete");
}
assert(refusedFalseCleanup, "audit declared cleanup success when DELETE changed zero rows");
assert(Object.values(failedCleanup.tables).some(table => table.size > 0),
  "mock did not reproduce the silent-DELETE scenario");

console.log("Cloud LIVE contract PASS: opt-in credentials, anon-denial, account RLS, timestamp guards, immutable sessions and verified cleanup.");
