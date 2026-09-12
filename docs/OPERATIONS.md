# PlantDiary Operations

This runbook contains manual production procedures. Roberto performs all hosted
Supabase actions. An AI coding agent may prepare repository changes and explain
the steps, but must not access the Supabase project, apply remote migrations,
change secrets, deploy functions, or configure jobs.

Never paste a Supabase service-role key into chat, source files, migration files,
commit messages, screenshots, or issue comments.

## Scheduled notification rollout

This procedure moves watering reminders and advisor tips from GitHub Actions to
Supabase Cron without creating a notification gap.

### Repository components

- `supabase/migrations/00008_scheduled_notification_deliveries.sql` creates the
  service-only duplicate-prevention ledger.
- `supabase/migrations/00009_schedule_notification_jobs.sql` creates the two
  Supabase Cron jobs.
- `supabase/functions/send-watering-reminders` sends watering reminders.
- `supabase/functions/send-advisor-tips` sends event-triggered advisor tips.

Keep both GitHub schedules enabled until the Supabase jobs have completed a real
scheduled run successfully.

### 1. Confirm the code is ready

Perform this rollout only after the issue #11 pull request has passed CI and been
merged into `main`. Pull the merged branch locally and confirm the working tree
is clean.

### 2. Create the Vault secrets

In the Supabase Dashboard, open Vault for the PlantDiary project and create these
two secrets:

- Name: `plantdiary_project_url`
  Value: the project URL in the form `https://<project-ref>.supabase.co`
- Name: `plantdiary_service_role_key`
  Value: the project's service-role key

Use the exact names. Do not include a trailing slash in the project URL. Do not
share either value with the coding agent.

Confirm the names exist without selecting or copying their decrypted values:

```sql
select name, created_at, updated_at
from vault.secrets
where name in (
  'plantdiary_project_url',
  'plantdiary_service_role_key'
)
order by name;
```

Expected result: exactly two rows.

### 3. Apply migration 00008

In the Supabase SQL Editor, run the complete contents of:

```text
supabase/migrations/00008_scheduled_notification_deliveries.sql
```

Verify the table, RLS, and unique constraint:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'scheduled_notification_deliveries';

select constraint_name, constraint_type
from information_schema.table_constraints
where table_schema = 'public'
  and table_name = 'scheduled_notification_deliveries'
order by constraint_name;
```

Expected result: the table exists with RLS enabled, and the constraints include
a primary key, foreign key, checks, and a unique constraint.

### 4. Deploy the secured Edge Functions

From the updated local `main`, deploy both functions:

```bash
supabase functions deploy send-watering-reminders
supabase functions deploy send-advisor-tips
```

Do not deploy these versions before migration `00008` exists. They reserve rows
in the new table before sending notifications.

### 5. Verify authorization

First call either function with an anonymous or ordinary user credential. It
must return `401 Unauthorized` and must not add a delivery-ledger row.

Then perform one authorized manual invocation using the service-role credential
in both the `apikey` and `Authorization` headers. Keep the credential in a local
shell variable or another secret mechanism so it is not committed. The response
should be a normal success or honest no-op result, not `401` or `500`.

After the authorized test, inspect the Edge Function logs. Confirm that no key,
authorization header, plant name, or push token was logged.

### 6. Apply migration 00009

In the Supabase SQL Editor, run the complete contents of:

```text
supabase/migrations/00009_schedule_notification_jobs.sql
```

The migration stops with a clear error if either required Vault secret is
missing. Reapplying it replaces the existing PlantDiary job definitions instead
of creating duplicates.

Verify the schedules:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'plantdiary-send-advisor-tips',
  'plantdiary-send-watering-reminders'
)
order by jobname;
```

Expected result:

- `plantdiary-send-advisor-tips` is active on `0 7 * * *`.
- `plantdiary-send-watering-reminders` is active on `0 8 * * *`.

### 7. Verify a real scheduled run

After the next scheduled times, inspect the Cron history:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname in (
    'plantdiary-send-advisor-tips',
    'plantdiary-send-watering-reminders'
  )
)
order by start_time desc
limit 20;
```

A successful Cron row proves that Postgres queued the asynchronous HTTP request;
it does not by itself prove that the Edge Function completed. Also check:

- the invocation in each Edge Function's logs;
- an expected success or honest no-op response;
- delivery-ledger rows for notifications that were eligible to send.

```sql
select job_name, scheduled_for, status, count(*)
from public.scheduled_notification_deliveries
where scheduled_for >= current_date - 2
group by job_name, scheduled_for, status
order by scheduled_for desc, job_name, status;
```

The GitHub and Supabase schedules may overlap during this verification window.
The unique delivery constraint prevents the same job from reserving the same
user twice on the same UTC day.

### 8. Complete the cutover

Only after both Supabase jobs have completed successfully, make a follow-up
repository change that removes their `schedule` triggers from GitHub Actions.
Keep `workflow_dispatch` temporarily if a manual recovery path is still useful.

### Rollback

To stop the Supabase schedules without deleting delivery history:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'plantdiary-send-advisor-tips',
  'plantdiary-send-watering-reminders'
);
```

Confirm no matching rows remain in `cron.job`. The GitHub schedules can remain
active or be restored while the Supabase problem is investigated.
