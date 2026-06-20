-- Migration: Add last-known coordinates to profiles (for N3 event-triggered advisor)
-- Run this in the Supabase SQL Editor manually.
--
-- The advisor cron (send-advisor-tips) runs server-side with no GPS. It needs a
-- per-user location to fetch a weather forecast. The client persists its
-- last-known coordinates here whenever it already fetches weather (Home screen).
-- Approximate home location only; refreshed on each weather load.

alter table profiles add column latitude double precision;
alter table profiles add column longitude double precision;
alter table profiles add column coords_updated_at timestamptz;

-- No RLS change needed: existing "users own their profile" policy covers the new
-- columns, and the edge function uses service_role (bypasses RLS).

-- Schedule the advisor at 07:00 UTC (an hour before the watering reminders so the
-- two pushes don't collide). pg_cron equivalent, if available:
--
--   select cron.schedule(
--     'send-advisor-tips',
--     '0 7 * * *',  -- every day at 07:00 UTC
--     $$
--     select net.http_post(
--       url := 'https://xsqklmpgibpznfbpuyxe.supabase.co/functions/v1/send-advisor-tips',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'
--     );
--     $$
--   );
--
-- FALLBACK: GitHub Actions cron — see .github/workflows/advisor-tips.yml
