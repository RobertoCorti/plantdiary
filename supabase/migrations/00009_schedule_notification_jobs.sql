-- Move PlantDiary's production notification schedules to Supabase Cron.
--
-- Before applying this migration, create these secrets in Supabase Vault:
--   plantdiary_project_url       https://<project-ref>.supabase.co
--   plantdiary_service_role_key  <the project's service-role key>
--
-- Apply 00008 and deploy the secured Edge Functions before applying this file.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'plantdiary_project_url'
      and nullif(decrypted_secret, '') is not null
  ) then
    raise exception 'Missing Supabase Vault secret: plantdiary_project_url';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'plantdiary_service_role_key'
      and nullif(decrypted_secret, '') is not null
  ) then
    raise exception 'Missing Supabase Vault secret: plantdiary_service_role_key';
  end if;
end;
$$;

-- Reapplying this migration replaces the two PlantDiary jobs rather than
-- creating duplicate schedules.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in (
      'plantdiary-send-advisor-tips',
      'plantdiary-send-watering-reminders'
    )
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'plantdiary-send-advisor-tips',
  '0 7 * * *',
  $cron$
    select net.http_post(
      url := rtrim((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'plantdiary_project_url'
      ), '/') || '/functions/v1/send-advisor-tips',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'plantdiary_service_role_key'
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'plantdiary_service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);

select cron.schedule(
  'plantdiary-send-watering-reminders',
  '0 8 * * *',
  $cron$
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
          where name = 'plantdiary_service_role_key'
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'plantdiary_service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
