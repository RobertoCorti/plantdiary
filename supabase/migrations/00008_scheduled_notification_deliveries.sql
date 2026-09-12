-- Prevent duplicate scheduled notifications when a job is retried or multiple
-- schedulers overlap during migration. Apply manually before deploying the Edge
-- Functions that use this table.

create table public.scheduled_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (
    job_name in ('watering-reminders', 'advisor-tips')
  ),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_for date not null,
  status text not null default 'reserved' check (
    status in ('reserved', 'submitted', 'failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (job_name, user_id, scheduled_for)
);

alter table public.scheduled_notification_deliveries enable row level security;

-- There are intentionally no client policies. Only service-role Edge Functions
-- can reserve or update scheduled notification deliveries.
revoke all on table public.scheduled_notification_deliveries from anon, authenticated;
grant all on table public.scheduled_notification_deliveries to service_role;

create index scheduled_notification_deliveries_scheduled_for_idx
  on public.scheduled_notification_deliveries (scheduled_for);

comment on table public.scheduled_notification_deliveries is
  'Service-only idempotency ledger for scheduled push notification submissions.';
