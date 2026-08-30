-- Migration: Add journal_entries table for monthly AI-generated narratives (N4)
-- One narrative per plant per calendar month. Generated once, cached here,
-- never re-billed on re-view.
-- Run this in the Supabase SQL Editor manually.

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants on delete cascade not null,
  user_id uuid references auth.users not null,
  period text not null, -- 'YYYY-MM'
  narrative text not null,
  created_at timestamptz default now(),
  unique (plant_id, period)
);

-- Row Level Security: users own their journal entries
alter table journal_entries enable row level security;

create policy "users own their journal entries" on journal_entries
  for all using (auth.uid() = user_id);

create index idx_journal_entries_plant_id on journal_entries(plant_id);
