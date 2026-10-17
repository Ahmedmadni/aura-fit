# Phase 51 — Lovable Cloud release verification gates

**Status: PENDING real-environment verification.** This is a tracking and operating checklist, not a claim of production approval.

## Environments and safety
- Source of truth for code: `Ahmedmadni/aura-fit`, main branch. Lovable AI is the preview/deployment integration; ensure its GitHub sync has pulled the intended merged commit before publishing.
- Use a **disposable Supabase project** and two newly created, verified-email test users for tests that write/delete records.
- Never run `cloud-live:verify` against production accounts. Never paste user passwords, service-role keys, or bearer tokens into GitHub, CI, screenshots or review comments.
- The production migration `supabase/migrations/20261003143000_aura_cloud_sync.sql` is reported **already applied**. Do not run it again.
- Do not modify production schemas, apply migrations, or delete user records to resolve a failed test automatically.

## Gate A — production metadata inspection (read-only)

1. In the **existing Lovable Cloud** project's SQL editor, open and execute only the contents of `supabase/aura_production_readonly_audit.sql`.
2. Record the returned `table_name`, `check_name`, and `status` columns only (no personal data).
3. Expect **43 READY** results (14 per table and one function check). Any REVIEW result is a **blocker**, not permission to rerun a migration.
4. Confirm independently that you used the correct production project before executing. The audit reads PostgreSQL system metadata and does not read user rows.
5. Evidence: execution date, environment label, READY count, REVIEW count, and only failed check names.

- [ ] Gate A passed in real Lovable Cloud

## Gate B — live authentication, RLS and conflicts (disposable project only)

1. Follow `CLOUD_LIVE_TESTING.md` exactly; provision a disposable project with the existing migration and **two distinct confirmed-email test accounts**.
2. Keep the `AURA_LIVE_*` variables in a private execution environment; use publishable/anon key, never `service_role`.
3. Run `bun run cloud-live:verify`. **Do not** substitute `bun run cloud-live:validate`, which uses mock responses.
4. Verify read/write isolation in both directions; rejected anonymous requests; profile/readiness timestamp checks; immutable workout IDs; and verified cleanup of the exact temporary rows.
5. On any failure, preserve only sanitized results and investigate before retrying.

- [ ] Gate B passed on disposable live Supabase project

## Gate C — published Lovable cross-device recovery

1. Verify Lovable preview/build references the expected GitHub commit.
2. With a **non-production test account**, save profile settings, readiness and a completed workout on device A; wait for explicit verified cloud status.
3. Sign in on device B and confirm exact values, set repetitions, and session identity. Switch between test accounts and ensure other-account data does not appear.
4. Edit the same readiness record on two devices; validate reconciliation, offline pending state and reconnect behavior. Check that a sign-out/sign-in does not expose the previous account's local data.
5. Do not declare this passed from unit tests or SQL metadata checks alone.

- [ ] Gate C passed on two physical devices

## Gate D — PWA and exercise assets on a physical phone

1. Install the **published** app on Android Chrome; verify install, relaunch, navigation, offline shell, and signed-in privacy.
2. Open a previously approved GIF while online; toggle airplane mode; reopen the exercise. Confirm that approved cached imagery is available without assuming every CDN request can be cached.
3. Test a never-before-loaded GIF offline, a failed poster, a failed GIF and a failed canonical frame. Confirm accurate fallback labels and manual retry after reconnect.
4. Repeat core offline/reconnect behavior in iPhone Safari where supported. Record browser/device differences.
5. Validate that private navigation HTML and authenticated Supabase responses are not in CacheStorage.

- [ ] Gate D passed on real phone browsers

## Gate E — regression, observability and release decision

- [ ] GitHub `build` workflow is green for the release SHA (`typecheck`, media, workout, cloud mocks, PWA, browser and device smoke).
- [ ] Review Lovable build/runtime logs after preview and after publishing; no new auth, hydration, asset, or sync errors.
- [ ] Verify deployed commit SHA and test account login; check key routes (`/onboarding`, `/programs`, `/workout`, `/progress`, `/profile`).
- [ ] Release decision recorded with date, tested commit, environments, and unresolved blockers.

## Handoff record (fill after real runs)

| Gate | Result | Date | Environment | Sanitized evidence/blocker |
| --- | --- | --- | --- | --- |
| A: production 43 checks | PENDING | — | Lovable Cloud production (read-only) | — |
| B: live RLS | PENDING | — | Disposable Supabase | — |
| C: two devices | PENDING | — | Lovable published test accounts | — |
| D: phone PWA | PENDING | — | Android/iOS | — |
| E: release | PENDING | — | GitHub + Lovable | — |

**Release policy:** CI green and migration present are not equivalent to real-environment verification. A production deployment should not be marked security-cleared until relevant gates pass.
