-- Run only against a disposable PostgreSQL database as an administrator:
-- psql -v ON_ERROR_STOP=1 -f tests/atomic-watering.sql
-- All fixtures, roles, and schema changes are rolled back after the checks.
\set ON_ERROR_STOP on
begin;
create role authenticated;
create role anon;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to authenticated, anon;
\ir ../supabase/migrations/00001_initial_schema.sql
\ir ../supabase/migrations/00003_plant_events_weather.sql
\ir ../supabase/migrations/00012_atomic_watering.sql
grant select, insert, update, delete on public.plants, public.plant_events to authenticated;

insert into auth.users values
  ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.plants (id, user_id, name) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Giorgio'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Other account');

-- Force the second write to fail for a specific date, after the event insert.
alter table public.plants add constraint reject_test_date check (
  last_watered_at <> '2026-11-04T12:00:00Z'::timestamptz
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  plant_id uuid := '10000000-0000-4000-8000-000000000001';
  event_id uuid := '20000000-0000-4000-8000-000000000001';
  result timestamptz;
begin
  result := public.record_watering(event_id, plant_id, '2026-11-01T12:00:00Z',
    '{"temperature":20,"humidity":60,"precipitation":0}', 'Dry soil');
  assert result = '2026-11-01T12:00:00Z'::timestamptz, 'wrong return date';
  assert (select count(*) = 1 from public.plant_events where id = event_id
    and notes = 'Dry soil' and weather->>'temperature' = '20'), 'context not saved';
  assert (select last_watered_at = result from public.plants where id = plant_id), 'plant not updated';
  raise notice 'PASS: event, notes, weather, and plant date save together';

  perform public.record_watering(event_id, plant_id, '2026-11-01T12:00:00Z',
    '{"temperature":20,"humidity":60,"precipitation":0}', 'Dry soil');
  assert (select count(*) = 1 from public.plant_events where id = event_id), 'duplicate event';
  raise notice 'PASS: an identical retry does not duplicate the event';

  begin
    perform public.record_watering(event_id, plant_id, '2026-11-01T12:00:00Z', null, 'Changed');
    raise exception 'TEST FAILED: reused ID accepted different content';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'PASS: an existing ID cannot be repurposed';

  perform public.record_watering('20000000-0000-4000-8000-000000000002', plant_id,
    '2026-11-03T12:00:00Z', null);
  result := public.record_watering('20000000-0000-4000-8000-000000000003', plant_id,
    '2026-11-02T12:00:00Z', null);
  assert result = '2026-11-03T12:00:00Z'::timestamptz, 'older action moved date backwards';
  result := public.record_watering(event_id, plant_id, '2026-11-01T12:00:00Z',
    '{"temperature":20,"humidity":60,"precipitation":0}', 'Dry soil');
  assert result = '2026-11-03T12:00:00Z'::timestamptz, 'old retry moved date backwards';
  raise notice 'PASS: older actions and retries retain the latest date; null weather works';

  begin
    perform public.record_watering('20000000-0000-4000-8000-000000000004', plant_id,
      '2026-11-04T12:00:00Z', null);
    raise exception 'TEST FAILED: forced update failure did not fail';
  exception when check_violation then null;
  end;
  assert not exists (select from public.plant_events where id = '20000000-0000-4000-8000-000000000004'),
    'failed update left an event behind';
  assert (select last_watered_at = '2026-11-03T12:00:00Z'::timestamptz
    from public.plants where id = plant_id), 'failed action changed plant';
  raise notice 'PASS: failed plant update rolls back its event';

  begin
    perform public.record_watering('20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000002', '2026-11-05T12:00:00Z', null);
    raise exception 'TEST FAILED: another account plant was accessible';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: another account plant is rejected';

  begin
    perform public.record_watering(null, plant_id, '2026-11-05T12:00:00Z', null);
    raise exception 'TEST FAILED: null ID accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_watering('20000000-0000-4000-8000-000000000005', plant_id, 'infinity', null);
    raise exception 'TEST FAILED: infinite date accepted';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'PASS: missing ID and infinite dates are rejected';
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.record_watering('20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001', '2026-11-05T12:00:00Z', null);
    raise exception 'TEST FAILED: missing identity accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: missing authenticated identity rejected';
end; $$;

set local role anon;
do $$ begin
  begin
    perform public.record_watering('20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000001', '2026-11-05T12:00:00Z', null);
    raise exception 'TEST FAILED: anonymous execution allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anonymous callers cannot execute the function';
end; $$;

rollback;
