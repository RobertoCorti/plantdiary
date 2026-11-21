-- Migration: add an authenticated feedback inbox for later review.
-- Run this in the Supabase SQL Editor manually before shipping the client UI.

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  message text not null,
  app_version text,
  platform text not null,
  platform_version text,
  status text not null default 'new',
  review_note text,
  created_at timestamptz not null default now(),

  constraint feedback_submissions_category_check
    check (category in ('bug', 'ux', 'idea')),
  constraint feedback_submissions_message_check
    check (char_length(btrim(message)) between 1 and 2000),
  constraint feedback_submissions_platform_check
    check (platform in ('ios', 'android', 'web')),
  constraint feedback_submissions_status_check
    check (status in ('new', 'reviewed', 'planned', 'resolved', 'declined'))
);

alter table public.feedback_submissions enable row level security;

-- The app is an intake path only. Review and triage stay administrative.
revoke all on table public.feedback_submissions from anon, authenticated;
grant insert on table public.feedback_submissions to authenticated;
grant all on table public.feedback_submissions to service_role;

create policy "users submit their own feedback"
  on public.feedback_submissions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'new'
    and review_note is null
  );

create index idx_feedback_submissions_status_created_at
  on public.feedback_submissions(status, created_at desc);
