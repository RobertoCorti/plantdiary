# PlantDiary

A mobile app that helps plant owners keep their plants alive and thriving. Unlike generic plant care apps, PlantDiary builds a personal history for each plant — learning how your specific plant, in your specific home, responds to your care over time.

**One-line pitch:** Strava for your plants — track, learn, improve.

## Tech Stack

- **Mobile:** React Native + Expo (TypeScript)
- **Backend/DB:** Supabase (Auth, PostgreSQL, Storage)
- **AI:** Anthropic API (claude-sonnet-4) for plant identification and health analysis
- **Weather:** Open-Meteo API

## Features (MVP)

- **Add a Plant** — Take a photo, AI identifies the species and care needs
- **Today Screen** — See which plants need attention today
- **Plant Profile** — Timeline of care events, stats, and photo history (with a "Remove plant" action)
- **Photo Check-In** — AI compares photos over time and flags changes
- **Push Notifications** — Context-aware watering reminders and event-triggered advisor tips
- **AI Learning** — Learns your plant's actual watering rhythm and proposes schedule updates with confidence
- **Plant Journal** — Monthly AI narrative, photo gallery, and auto-detected milestones

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A [Supabase](https://supabase.com/) project

### Setup

1. Clone the repo:
   ```bash
   git clone git@github.com:RobertoCorti/plantdiary.git
   cd plantdiary
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run the migrations in your Supabase SQL Editor, in order:
   ```
   supabase/migrations/00001_initial_schema.sql
   supabase/migrations/00002_push_tokens.sql
   supabase/migrations/00003_plant_events_weather.sql
   supabase/migrations/00004_profiles_coords.sql
   supabase/migrations/00005_journal_entries.sql
   supabase/migrations/00006_delete_plant.sql
   ```
   Then run `supabase/storage-setup.sql` to create the `plant-photos` bucket and its policies.

5. Start the app:
   ```bash
   npx expo start
   ```
   Using Expo Go in a simulator? Add the `--go` flag (a dev client is configured by default):
   ```bash
   npx expo start --go
   ```

## Project Structure

```
plantdiary/
├── App.tsx                  # Root: navigation + auth state
├── src/
│   ├── lib/
│   │   └── supabase.ts      # Supabase client config
│   └── screens/
│       ├── AuthScreen.tsx    # Sign up / log in
│       └── HomeScreen.tsx    # Home screen
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql
└── CONTEXT.md               # Session memory for development
```
