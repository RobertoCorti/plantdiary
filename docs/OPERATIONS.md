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

Migration `00009_schedule_notification_jobs.sql` was applied during the first
rollout attempt, but its jobs were immediately unscheduled after the Edge
Functions rejected a valid service-role JWT. The delivery ledger from migration
`00008` remains valid. Migration `00010_use_scheduler_secret.sql` supersedes the
old job definitions and must not be applied until both dry-run gates below pass.

### Repository components

- `supabase/migrations/00008_scheduled_notification_deliveries.sql` creates the
  service-only duplicate-prevention ledger.
- `supabase/migrations/00009_schedule_notification_jobs.sql` creates the two
  original Supabase Cron jobs and is retained as migration history.
- `supabase/migrations/00010_use_scheduler_secret.sql` replaces those jobs with
  dedicated scheduler-secret authentication.
- `supabase/functions/send-watering-reminders` sends watering reminders.
- `supabase/functions/send-advisor-tips` sends event-triggered advisor tips.

Keep both GitHub schedules enabled until the Supabase jobs have completed a real
scheduled run successfully.

### 1. Confirm the code is ready

The original issue #11 pull request is already merged. Perform this corrected
rollout only after the scheduler-secret fix has passed CI and review. Configure
the GitHub secrets in steps 2 and 3 before merging the fix so the existing
GitHub schedules keep working. After the merge, pull `main` locally and confirm
the working tree is clean before deploying.

### 2. Create the scheduler secret

Generate one random scheduler-only secret on a trusted local computer:

```bash
openssl rand -hex 32
```

Store the same generated value in all three locations below. Never paste it into
chat, source files, command history, screenshots, or issue comments.

- Supabase Edge Function secret: `PLANTDIARY_SCHEDULER_SECRET`
- Supabase Vault secret: `plantdiary_scheduler_secret`
- GitHub Actions repository secret: `SUPABASE_SCHEDULER_SECRET`

The scheduler secret authorizes the trigger. It is separate from the Edge
Function runtime's built-in `SUPABASE_SERVICE_ROLE_KEY`, which remains internal
and is used only for database access.

### 3. Configure the caller credentials

Add the project's legacy anon key in these two locations:

- Supabase Vault secret: `plantdiary_anon_key`
- GitHub Actions repository secret: `SUPABASE_ANON_KEY`

The anon key only lets a request pass through the Supabase gateway. It cannot
trigger a scheduled function without the private scheduler secret.

Keep the existing GitHub Actions and Vault service-role secrets until the new
jobs have completed a real scheduled run. They can be removed during cleanup.

### 4. Confirm the Vault secrets

In the Supabase Dashboard, open Vault for the PlantDiary project and create these
secrets if they do not already exist:

- Name: `plantdiary_project_url`
  Value: the project URL in the form `https://<project-ref>.supabase.co`
- Name: `plantdiary_anon_key`
  Value: the project's legacy anon key
- Name: `plantdiary_scheduler_secret`
  Value: the generated scheduler-only secret

Use the exact names. Do not include a trailing slash in the project URL. Do not
share any secret value with the coding agent.

Confirm the names exist without selecting or copying their decrypted values:

```sql
select name, created_at, updated_at
from vault.secrets
where name in (
  'plantdiary_project_url',
  'plantdiary_anon_key',
  'plantdiary_scheduler_secret'
)
order by name;
```

Expected result: exactly three rows.

### 5. Confirm migration 00008

Migration `00008` was applied during the first rollout attempt. Do not reapply it.
Verify that its table and protections remain present:

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

### 6. Deploy the corrected Edge Functions

Only after `PLANTDIARY_SCHEDULER_SECRET` exists in the Edge Function secrets,
deploy both functions from the updated local `main`:

```bash
supabase functions deploy send-watering-reminders
supabase functions deploy send-advisor-tips
```

The functions fail closed with `500` when the scheduler secret is not configured.

### 7. Verify authorization with a safe HTTP dry run

Load the values into hidden local shell variables. Paste the raw values without
quotes when prompted:

```bash
read "PROJECT_URL?Supabase Project URL: "
read -s "ANON_KEY?Supabase legacy anon key: "
echo
read -s "SCHEDULER_SECRET?PlantDiary scheduler secret: "
echo
```

First prove that the public anon key cannot trigger the function by itself:

```bash
curl --include \
  --request POST \
  "$PROJECT_URL/functions/v1/send-watering-reminders" \
  --header "Content-Type: application/json" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $ANON_KEY" \
  --header "x-scheduler-dry-run: true" \
  --data '{}'
```

Expected result: `401 Unauthorized`.

Then prove that an incorrect scheduler secret is rejected by adding:

```bash
--header "x-scheduler-secret: deliberately-wrong"
```

Expected result: `401 Unauthorized`.

Finally, perform the authorized dry run:

```bash
curl --include \
  --request POST \
  "$PROJECT_URL/functions/v1/send-watering-reminders" \
  --header "Content-Type: application/json" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $ANON_KEY" \
  --header "x-scheduler-secret: $SCHEDULER_SECRET" \
  --header "x-scheduler-dry-run: true" \
  --data '{}'
```

Expected result:

```text
HTTP/2 200
{"authorized":true,"dry_run":true}
```

This response is returned before database reads, delivery reservations, external
weather requests, Expo calls, or notifications.

Confirm that no delivery row was created by these tests:

```sql
select *
from public.scheduled_notification_deliveries
where created_at >= now() - interval '10 minutes'
order by created_at desc;
```

Inspect the Edge Function logs and confirm that no credential, authorization
header, plant name, or push token was logged.

### 8. Verify Vault and pg_net without creating a schedule

From the Supabase SQL Editor, send one asynchronous dry-run request using the
same Vault values migration `00010` will use:

```sql
select net.http_post(
  url := rtrim((
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'plantdiary_project_url'
  ), '/') || '/functions/v1/send-watering-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'plantdiary_anon_key'
    ),
    'Authorization', 'Bearer ' || (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'plantdiary_anon_key'
    ),
    'x-scheduler-secret', (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'plantdiary_scheduler_secret'
    ),
    'x-scheduler-dry-run', 'true'
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
) as request_id;
```

Record the returned request ID. Because `pg_net` is asynchronous, wait briefly
and inspect that response without displaying any request headers:

```sql
select id, status_code, content, timed_out, error_msg, created
from net._http_response
where id = <request_id>;
```

Expected result: `status_code` is `200` and `content` contains the authorized
dry-run response. Also confirm the dry run in the Edge Function logs and confirm
again that no delivery-ledger row or notification was created.

### 9. Apply corrective migration 00010

In the Supabase SQL Editor, run the complete contents of:

```text
supabase/migrations/00010_use_scheduler_secret.sql
```

The migration stops with a clear error if any required Vault secret is
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

### 10. Verify a real scheduled run

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

### 11. Complete the cutover

Only after both Supabase jobs have completed successfully, make a follow-up
repository change that removes their `schedule` triggers from GitHub Actions.
Keep `workflow_dispatch` temporarily if a manual recovery path is still useful.

After that follow-up is deployed, remove the obsolete
`SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret and
`plantdiary_service_role_key` Vault secret. Do not remove the Edge Function
runtime's built-in `SUPABASE_SERVICE_ROLE_KEY`; both functions still need it for
database access.

Clear the local shell variables:

```bash
unset ANON_KEY SCHEDULER_SECRET PROJECT_URL
```

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
