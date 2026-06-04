-- Migration: Add profiles table for push notification tokens
-- Run this in the Supabase SQL Editor manually.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  push_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only read/write their own profile
alter table profiles enable row level security;

create policy "users own their profile" on profiles
  for all using (auth.uid() = id);

-- Allow the service_role (used by edge functions) to read all profiles
-- This is needed for the send-watering-reminders edge function.
-- service_role bypasses RLS by default, so no extra policy needed.

-- Schedule daily watering reminders at 8:00 AM UTC via pg_cron.
-- pg_cron is available on Supabase Pro plans. Enable the extension first:
--
--   create extension if not exists pg_cron;
--
--   select cron.schedule(
--     'send-watering-reminders',
--     '0 8 * * *',  -- every day at 08:00 UTC
--     $$
--     select net.http_post(
--       url := 'https://xsqklmpgibpznfbpuyxe.supabase.co/functions/v1/send-watering-reminders',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'
--     );
--     $$
--   );
--
-- FALLBACK: If pg_cron is not available, use a GitHub Actions cron workflow:
--
--   # .github/workflows/watering-reminders.yml
--   name: Send Watering Reminders
--   on:
--     schedule:
--       - cron: '0 8 * * *'  # daily at 08:00 UTC
--   jobs:
--     send:
--       runs-on: ubuntu-latest
--       steps:
--         - run: |
--             curl -X POST \
--               https://xsqklmpgibpznfbpuyxe.supabase.co/functions/v1/send-watering-reminders \
--               -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
--               -H "Content-Type: application/json"
