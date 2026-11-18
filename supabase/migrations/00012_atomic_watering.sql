-- Run manually in Supabase before installing the client change.
-- One RPC transaction records a watering and updates its plant. The caller
-- retains p_event_id across retries; the existing event primary key deduplicates it.
create function public.record_watering(
  p_event_id uuid,
  p_plant_id uuid,
  p_watered_at timestamptz,
  p_weather jsonb,
  p_notes text default null
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  last_watered timestamptz;
  inserted_id uuid;
  existing_event public.plant_events%rowtype;
begin
  if caller_id is null then
    raise exception 'Sign in to record watering' using errcode = '42501';
  end if;
  if p_event_id is null or p_watered_at is null or not isfinite(p_watered_at) then
    raise exception 'A watering ID and finite timestamp are required' using errcode = '22023';
  end if;

  -- Serialize waterings for this plant and check ownership even if table
  -- policies change. SECURITY INVOKER also preserves the caller's RLS policies.
  select p.last_watered_at into last_watered
  from public.plants p
  where p.id = p_plant_id and p.user_id = caller_id
  for update;
  if not found then
    raise exception 'Plant not available' using errcode = '42501';
  end if;

  insert into public.plant_events (
    id, plant_id, user_id, event_type, created_at, weather, notes
  ) values (
    p_event_id, p_plant_id, caller_id, 'watered', p_watered_at, p_weather, p_notes
  ) on conflict (id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select * into existing_event from public.plant_events where id = p_event_id;
    if not found
      or existing_event.plant_id is distinct from p_plant_id
      or existing_event.user_id is distinct from caller_id
      or existing_event.event_type is distinct from 'watered'
      or existing_event.created_at is distinct from p_watered_at
      or existing_event.weather is distinct from p_weather
      or existing_event.notes is distinct from p_notes then
      raise exception 'Watering ID already used for a different action' using errcode = '22023';
    end if;
    return last_watered;
  end if;

  -- An older request retried later must never move the plant's date backwards.
  update public.plants
  set last_watered_at = greatest(last_watered_at, p_watered_at), updated_at = now()
  where id = p_plant_id and user_id = caller_id
  returning last_watered_at into last_watered;
  if not found then
    raise exception 'Plant could not be updated' using errcode = '42501';
  end if;
  return last_watered;
end;
$$;

revoke all on function public.record_watering(uuid, uuid, timestamptz, jsonb, text)
  from public, anon;
grant execute on function public.record_watering(uuid, uuid, timestamptz, jsonb, text)
  to authenticated;
