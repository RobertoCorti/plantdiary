-- Create the plant-photos storage bucket
-- Run this in the Supabase SQL Editor

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true);

-- Allow authenticated users to upload files to their own folder
create policy "users can upload plant photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own photos
create policy "users can read own plant photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (photos are referenced by public URL)
create policy "public can read plant photos"
on storage.objects for select
to anon
using (bucket_id = 'plant-photos');
