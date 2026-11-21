-- Run only against a disposable PostgreSQL database as an administrator:
-- psql -v ON_ERROR_STOP=1 -f tests/feedback-submissions.sql
-- All fixtures, roles, and schema changes are rolled back after the checks.
\set ON_ERROR_STOP on
begin;

create role authenticated;
create role anon;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth, public to authenticated, anon, service_role;

insert into auth.users values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

\ir ../supabase/migrations/00013_feedback_submissions.sql

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

insert into public.feedback_submissions (
  user_id,
  category,
  message,
  app_version,
  platform,
  platform_version
) values (
  '00000000-0000-4000-8000-000000000001',
  'idea',
  'Show the latest photo beside the first one.',
  '1.0.0',
  'ios',
  '18.1'
);

do $$ begin
  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000002',
      'bug',
      'This belongs to another account.',
      'android'
    );
    raise exception 'TEST FAILED: another account user_id was accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: users cannot submit feedback for another account';

  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000001',
      'question',
      'Unsupported category.',
      'ios'
    );
    raise exception 'TEST FAILED: unsupported category was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000001',
      'ux',
      '   ',
      'ios'
    );
    raise exception 'TEST FAILED: blank message was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000001',
      'idea',
      repeat('x', 2001),
      'ios'
    );
    raise exception 'TEST FAILED: oversized message was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000001',
      'bug',
      'Unsupported platform.',
      'desktop'
    );
    raise exception 'TEST FAILED: unsupported platform was accepted';
  exception when check_violation then null;
  end;
  raise notice 'PASS: category, message, and platform constraints reject invalid input';

  begin
    insert into public.feedback_submissions (
      user_id,
      category,
      message,
      platform,
      status
    ) values (
      '00000000-0000-4000-8000-000000000001',
      'bug',
      'Trying to control review state.',
      'ios',
      'planned'
    );
    raise exception 'TEST FAILED: app set a reviewer status';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.feedback_submissions (
      user_id,
      category,
      message,
      platform,
      review_note
    ) values (
      '00000000-0000-4000-8000-000000000001',
      'bug',
      'Trying to add a review note.',
      'ios',
      'Not from a reviewer'
    );
    raise exception 'TEST FAILED: app set a review note';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: app submissions cannot set reviewer fields';

  begin
    perform count(*) from public.feedback_submissions;
    raise exception 'TEST FAILED: authenticated user read the inbox';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.feedback_submissions set status = 'reviewed';
    raise exception 'TEST FAILED: authenticated user updated the inbox';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.feedback_submissions;
    raise exception 'TEST FAILED: authenticated user deleted from the inbox';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: app users cannot read, update, or delete the inbox';
end;
$$;

reset role;

set local role anon;
do $$ begin
  begin
    insert into public.feedback_submissions (user_id, category, message, platform)
    values (
      '00000000-0000-4000-8000-000000000001',
      'idea',
      'Anonymous submission.',
      'web'
    );
    raise exception 'TEST FAILED: anonymous insert was accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: anonymous users cannot submit feedback';
end;
$$;

reset role;

set local role service_role;
do $$ begin
  assert (
    select count(*) = 1
    from public.feedback_submissions
    where user_id = '00000000-0000-4000-8000-000000000001'
      and category = 'idea'
      and status = 'new'
      and review_note is null
      and app_version = '1.0.0'
      and platform = 'ios'
      and platform_version = '18.1'
  ), 'valid feedback was not stored with defaults and context';

  update public.feedback_submissions
  set status = 'planned', review_note = 'Promoted to a GitHub issue';

  assert (
    select count(*) = 1
    from public.feedback_submissions
    where status = 'planned'
      and review_note = 'Promoted to a GitHub issue'
  ), 'reviewer could not triage feedback';
  raise notice 'PASS: reviewers can read and triage stored feedback';
end;
$$;

rollback;
