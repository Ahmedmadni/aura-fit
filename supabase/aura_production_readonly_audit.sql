-- Aura Fit — SAFE PRODUCTION AUDIT (READ-ONLY)
-- Run in the SQL editor of the ACTUAL Lovable Cloud / Supabase project.
-- Executes SELECT statements only; no user rows are read or modified.
-- This is NOT a migration. It checks metadata, roles, policies, and triggers.
-- A READY result confirms structural configuration only, not two-device sync.
WITH
target_tables(table_name, stamp_column, touch_trigger, extra_index) AS (
  VALUES
    ('aura_profiles', 'client_updated_at', 'aura_profiles_touch_updated_at', NULL::text),
    ('aura_readiness', 'recorded_at', 'aura_readiness_touch_updated_at', 'aura_readiness_user_date_idx'),
    ('aura_workouts', 'workout_date', 'aura_workouts_touch_updated_at', 'aura_workouts_user_date_idx')
),
targets AS (
  SELECT t.*, to_regclass(format('public.%I', t.table_name)) AS table_oid
  FROM target_tables t
),
policy_types(operation, policy_cmd) AS (
  VALUES ('select', 'SELECT'), ('insert', 'INSERT'),
         ('update', 'UPDATE'), ('delete', 'DELETE')
),
policy_state AS (
  SELECT t.table_name, p.operation,
    EXISTS (
      SELECT 1
      FROM pg_policies pol
      WHERE pol.schemaname = 'public'
        AND pol.tablename = t.table_name
        AND pol.policyname = t.table_name || '_' || p.operation || '_own'
        AND pol.cmd = p.policy_cmd
        AND pol.permissive = 'PERMISSIVE'
        AND (
          (p.operation = 'select' AND
            regexp_replace(coalesce(pol.qual, ''), '[[:space:]()]', '', 'g')
              IN ('auth.uid=user_id', 'user_id=auth.uid'))
          OR
          (p.operation = 'insert' AND
            regexp_replace(coalesce(pol.with_check, ''), '[[:space:]()]', '', 'g')
              IN ('auth.uid=user_id', 'user_id=auth.uid'))
          OR
          (p.operation = 'update' AND
            regexp_replace(coalesce(pol.qual, ''), '[[:space:]()]', '', 'g')
              IN ('auth.uid=user_id', 'user_id=auth.uid')
            AND regexp_replace(coalesce(pol.with_check, ''), '[[:space:]()]', '', 'g')
              IN ('auth.uid=user_id', 'user_id=auth.uid'))
          OR
          (p.operation = 'delete' AND
            regexp_replace(coalesce(pol.qual, ''), '[[:space:]()]', '', 'g')
              IN ('auth.uid=user_id', 'user_id=auth.uid'))
        )
    ) AS passed
  FROM targets t
  CROSS JOIN policy_types p
),
checks AS (
  SELECT table_name, '01_table_exists'::text AS check_name,
         table_oid IS NOT NULL AS passed
  FROM targets

  UNION ALL
  SELECT t.table_name, '02_rls_enabled',
         coalesce(c.relrowsecurity, false)
  FROM targets t
  LEFT JOIN pg_class c ON c.oid = t.table_oid

  UNION ALL
  SELECT t.table_name, '03_primary_key',
         EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conrelid = t.table_oid AND c.contype = 'p'
         )
  FROM targets t

  UNION ALL
  SELECT t.table_name, '04_auth_users_cascade_fk',
         EXISTS (
           SELECT 1 FROM pg_constraint c
           WHERE c.conrelid = t.table_oid AND c.contype = 'f'
             AND c.confrelid = to_regclass('auth.users')
             AND c.confdeltype = 'c'
         )
  FROM targets t

  UNION ALL
  SELECT t.table_name, '05_required_timestamp_column',
         EXISTS (
           SELECT 1 FROM pg_attribute a
           WHERE a.attrelid = t.table_oid
             AND a.attname = t.stamp_column
             AND NOT a.attisdropped AND a.attnotnull
         )
  FROM targets t

  UNION ALL
  SELECT t.table_name, '06_exactly_four_rls_policies',
         (SELECT count(*) FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = t.table_name) = 4
  FROM targets t

  UNION ALL
  SELECT table_name, '07_own_' || operation || '_policy', passed
  FROM policy_state

  UNION ALL
  SELECT t.table_name, '11_anon_has_no_crud_grants',
         t.table_oid IS NOT NULL AND NOT (
           has_table_privilege('anon', t.table_oid, 'SELECT')
           OR has_table_privilege('anon', t.table_oid, 'INSERT')
           OR has_table_privilege('anon', t.table_oid, 'UPDATE')
           OR has_table_privilege('anon', t.table_oid, 'DELETE')
         )
  FROM targets t

  UNION ALL
  SELECT t.table_name, '12_authenticated_has_crud_grants',
         t.table_oid IS NOT NULL AND
           has_table_privilege('authenticated', t.table_oid, 'SELECT') AND
           has_table_privilege('authenticated', t.table_oid, 'INSERT') AND
           has_table_privilege('authenticated', t.table_oid, 'UPDATE') AND
           has_table_privilege('authenticated', t.table_oid, 'DELETE')
  FROM targets t

  UNION ALL
  SELECT t.table_name, '13_touch_trigger_enabled',
         EXISTS (
           SELECT 1 FROM pg_trigger trg
           WHERE trg.tgrelid = t.table_oid
             AND trg.tgname = t.touch_trigger
             AND trg.tgenabled IN ('O', 'A')
             AND NOT trg.tgisinternal
             AND trg.tgfoid = to_regprocedure('public.aura_touch_updated_at()')
         )
  FROM targets t

  UNION ALL
  SELECT t.table_name, '14_expected_index',
         t.extra_index IS NULL OR EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indrelid = t.table_oid
             AND i.indexrelid = to_regclass(format('public.%I', t.extra_index))
             AND i.indisvalid AND i.indisready
         )
  FROM targets t

  UNION ALL
  SELECT 'aura_touch_updated_at()'::text, '15_trigger_function_invoker',
         EXISTS (
           SELECT 1 FROM pg_proc p
           WHERE p.oid = to_regprocedure('public.aura_touch_updated_at()')
             AND NOT p.prosecdef
         )
)
SELECT table_name, check_name,
       CASE WHEN coalesce(passed, false) THEN 'READY' ELSE 'REVIEW' END AS status
FROM checks
ORDER BY table_name, check_name;
