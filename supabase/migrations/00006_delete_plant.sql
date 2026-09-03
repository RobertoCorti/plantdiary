-- Migration: make plant deletion work
-- - plant_events originally referenced plants WITHOUT ON DELETE CASCADE, so
--   deleting a plant row failed if any events existed.
-- - plant-photos storage had insert/select policies but no delete policy.
-- journal_entries already cascades (00005).
-- Run this in the Supabase SQL Editor manually.

alter table plant_events
  drop constraint plant_events_plant_id_fkey;

alter table plant_events
  add constraint plant_events_plant_id_fkey
  foreign key (plant_id) references plants(id) on delete cascade;

create policy "users can delete own plant photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
