revoke all on table public.aura_profiles from anon;
revoke all on table public.aura_readiness from anon;
revoke all on table public.aura_workouts from anon;

grant select, insert, update, delete on table public.aura_profiles to authenticated;
grant select, insert, update, delete on table public.aura_readiness to authenticated;
grant select, insert, update, delete on table public.aura_workouts to authenticated;

grant all on table public.aura_profiles to service_role;
grant all on table public.aura_readiness to service_role;
grant all on table public.aura_workouts to service_role;