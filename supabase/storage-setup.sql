-- Create the private plant-photos storage bucket
-- Run this in the Supabase SQL Editor

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do update set public = false;

-- Allow authenticated users to upload files to their own folder
drop policy if exists "users can upload plant photos" on storage.objects;
create policy "users can upload plant photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own photos
drop policy if exists "users can read own plant photos" on storage.objects;
create policy "users can read own plant photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Remove the legacy anonymous read policy if this updates an existing project.
drop policy if exists "public can read plant photos" on storage.objects;
