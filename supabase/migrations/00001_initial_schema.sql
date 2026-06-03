-- PlantDiary initial schema

create table plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  species text,
  location text,
  photo_url text,
  watering_frequency_days integer,
  last_watered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table plant_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants not null,
  user_id uuid references auth.users not null,
  event_type text not null,
  notes text,
  photo_url text,
  ai_analysis text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table plants enable row level security;
alter table plant_events enable row level security;

create policy "users own their plants" on plants
  for all using (auth.uid() = user_id);

create policy "users own their events" on plant_events
  for all using (auth.uid() = user_id);

-- Index for common queries
create index idx_plants_user_id on plants(user_id);
create index idx_plant_events_plant_id on plant_events(plant_id);
create index idx_plant_events_user_id on plant_events(user_id);
