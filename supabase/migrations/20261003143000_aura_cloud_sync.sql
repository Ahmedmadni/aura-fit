-- Aura Fit cloud sync foundation
-- Apply this migration in the Supabase project used by the app.

create table if not exists public.aura_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aura_readiness (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  data jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create table if not exists public.aura_workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null,
  workout_date timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

create index if not exists aura_workouts_user_date_idx
  on public.aura_workouts (user_id, workout_date desc);

create index if not exists aura_readiness_user_date_idx
  on public.aura_readiness (user_id, date_key desc);

alter table public.aura_profiles enable row level security;
alter table public.aura_readiness enable row level security;
alter table public.aura_workouts enable row level security;

revoke all on table public.aura_profiles from anon;
revoke all on table public.aura_readiness from anon;
revoke all on table public.aura_workouts from anon;

grant select, insert, update, delete on table public.aura_profiles to authenticated;
grant select, insert, update, delete on table public.aura_readiness to authenticated;
grant select, insert, update, delete on table public.aura_workouts to authenticated;

drop policy if exists "aura_profiles_select_own" on public.aura_profiles;
create policy "aura_profiles_select_own"
  on public.aura_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "aura_profiles_insert_own" on public.aura_profiles;
create policy "aura_profiles_insert_own"
  on public.aura_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "aura_profiles_update_own" on public.aura_profiles;
create policy "aura_profiles_update_own"
  on public.aura_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_profiles_delete_own" on public.aura_profiles;
create policy "aura_profiles_delete_own"
  on public.aura_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "aura_readiness_select_own" on public.aura_readiness;
create policy "aura_readiness_select_own"
  on public.aura_readiness for select
  using (auth.uid() = user_id);

drop policy if exists "aura_readiness_insert_own" on public.aura_readiness;
create policy "aura_readiness_insert_own"
  on public.aura_readiness for insert
  with check (auth.uid() = user_id);

drop policy if exists "aura_readiness_update_own" on public.aura_readiness;
create policy "aura_readiness_update_own"
  on public.aura_readiness for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_readiness_delete_own" on public.aura_readiness;
create policy "aura_readiness_delete_own"
  on public.aura_readiness for delete
  using (auth.uid() = user_id);

drop policy if exists "aura_workouts_select_own" on public.aura_workouts;
create policy "aura_workouts_select_own"
  on public.aura_workouts for select
  using (auth.uid() = user_id);

drop policy if exists "aura_workouts_insert_own" on public.aura_workouts;
create policy "aura_workouts_insert_own"
  on public.aura_workouts for insert
  with check (auth.uid() = user_id);

drop policy if exists "aura_workouts_update_own" on public.aura_workouts;
create policy "aura_workouts_update_own"
  on public.aura_workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "aura_workouts_delete_own" on public.aura_workouts;
create policy "aura_workouts_delete_own"
  on public.aura_workouts for delete
  using (auth.uid() = user_id);

create or replace function public.aura_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aura_profiles_touch_updated_at on public.aura_profiles;
create trigger aura_profiles_touch_updated_at
before update on public.aura_profiles
for each row execute function public.aura_touch_updated_at();

drop trigger if exists aura_readiness_touch_updated_at on public.aura_readiness;
create trigger aura_readiness_touch_updated_at
before update on public.aura_readiness
for each row execute function public.aura_touch_updated_at();

drop trigger if exists aura_workouts_touch_updated_at on public.aura_workouts;
create trigger aura_workouts_touch_updated_at
before update on public.aura_workouts
for each row execute function public.aura_touch_updated_at();
