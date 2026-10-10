-- Migration: make plant photos private
--
-- Prerequisite: deploy the identify-plant and analyze-plant functions that read
-- caller-owned photos through authenticated Storage before applying this file.
-- Run this migration manually in the Supabase SQL Editor after that deployment.

-- Existing rows store permanent public URLs. Keep the current column names for
-- compatibility, but replace those URLs with their bucket-relative object path.
update plants
set photo_url = split_part(
  photo_url,
  '/storage/v1/object/public/plant-photos/',
  2
)
where photo_url like '%/storage/v1/object/public/plant-photos/%';

update plant_events
set photo_url = split_part(
  photo_url,
  '/storage/v1/object/public/plant-photos/',
  2
)
where photo_url like '%/storage/v1/object/public/plant-photos/%';

-- Private buckets require an authenticated download or a short-lived signed URL.
update storage.buckets
set public = false
where id = 'plant-photos';

-- Authenticated folder-scoped insert, select, and delete policies remain in
-- place. Remove the legacy policy that explicitly granted anonymous reads.
drop policy if exists "public can read plant photos" on storage.objects;

