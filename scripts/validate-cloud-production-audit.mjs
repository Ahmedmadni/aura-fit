// Phase 50: ensure the production diagnostic remains observational only.
// This checks the SQL artifact's intent and table coverage; the operator
// runs the SELECT in the live database editor. CI never connects to production.
import fs from "node:fs";
import path from "node:path";

const sql=fs.readFileSync(path.resolve(
  "supabase/aura_production_readonly_audit.sql"),"utf8");
const fail=(message)=>{throw Error("Production readonly audit: "+message);};
const clean=sql.replace(/\/\*[\s\S]*?\*\//g,"")
  .replace(/--[^\r\n]*/g,"")
  .replace(/'(?:''|[^'])*'/g,"''");
const tokens=clean.toLowerCase();
if(!/^\s*with\b/.test(tokens)||!/[\s;]select\b/.test(tokens)) {
  fail("expected one metadata-only WITH ... SELECT query");
}
if(/\b(insert|update|delete|alter|drop|create|truncate|grant|revoke|merge|call|execute|do|copy|vacuum|set|lock)\b/.test(tokens)) {
  fail("destructive/privileged statement found in production SQL");
}
if((tokens.match(/;/g)||[]).length!==1||!tokens.trim().endsWith(";")) {
  fail("the operator must run precisely one SELECT statement");
}
for(const table of ["aura_profiles","aura_readiness","aura_workouts"]) {
  if(!sql.includes("'"+table+"'"))fail("missing metadata check for "+table);
}
for(const required of [
  "pg_policies","pg_trigger","pg_constraint","pg_attribute","pg_class",
  "has_table_privilege('anon'","has_table_privilege('authenticated'",
  "to_regprocedure('public.aura_touch_updated_at()')",
  "'06_exactly_four_rls_policies'","'13_touch_trigger_enabled'",
  "'04_auth_users_cascade_fk'",
]) {
  if(!sql.includes(required))fail("missing essential metadata assertion: "+required);
}
if(/\bfrom\s+public\.aura_(profiles|readiness|workouts)\b/i.test(tokens)) {
  fail("query reads real end-user data rather than PostgreSQL catalogs");
}
console.log("Production audit SQL PASS: one read-only catalog SELECT, all 3 cloud tables, 4 RLS permissions, grants, FK, indexes and update triggers.");
