-- Migration: persist one-time onboarding per account.
-- Run this in the Supabase SQL Editor manually before wiring onboarding navigation.

alter table public.profiles
  add column onboarding_step text not null default 'welcome',
  add column onboarding_completed_at timestamptz,
  add column onboarding_plant_id uuid references public.plants(id) on delete set null,
  add column onboarding_updated_at timestamptz not null default now();

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step in ('welcome', 'premise', 'schedule', 'diary', 'plant', 'done'));

-- Everyone who exists when this migration runs is a returning user and must not
-- be sent through onboarding. This also creates missing profile rows.
insert into public.profiles (
  id,
  onboarding_step,
  onboarding_completed_at,
  onboarding_updated_at
)
select id, 'done', now(), now()
from auth.users
on conflict (id) do update
set onboarding_step = 'done',
    onboarding_completed_at = coalesce(
      public.profiles.onboarding_completed_at,
      excluded.onboarding_completed_at
    ),
    onboarding_updated_at = excluded.onboarding_updated_at;

-- Future auth users start eligible. The conflict guard keeps this compatible
-- with another profile-creation trigger if one is added outside this repository.
create function public.initialize_plantdiary_onboarding()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger initialize_plantdiary_onboarding_after_signup
  after insert on auth.users
  for each row execute procedure public.initialize_plantdiary_onboarding();
