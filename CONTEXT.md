# PlantDiary — Context for Claude Code

## Current milestone: M3 — Today Screen (COMPLETE)
## Last session: 2026-06-03

### What's done

#### M1 — Foundation (COMPLETE)
- Expo project initialized with TypeScript (blank-typescript template)
- Dependencies installed: @supabase/supabase-js, @react-navigation/native, @react-navigation/native-stack, react-native-screens, react-native-safe-area-context, expo-secure-store
- Supabase client configured with SecureStore for token persistence (`src/lib/supabase.ts`)
- DB migration file created (`supabase/migrations/00001_initial_schema.sql`) with plants + plant_events tables, RLS policies, and indexes
- Auth flow built: AuthScreen with email sign up / log in, toggle between modes
- App.tsx wired with React Navigation, auth state listener, conditional rendering (auth vs home)
- `.env` file created with Supabase credentials (gitignored)
- Supabase project created and linked (project ID: xsqklmpgibpznfbpuyxe)
- Migration run in Supabase SQL Editor — tables and RLS policies live
- Email confirmation disabled in Supabase Auth settings (for faster dev iteration)
- Auth flow tested end-to-end: sign up, log in, HomeScreen displays user email

#### M2 — Add Plant (COMPLETE)
- Installed expo-image-picker and expo-file-system
- Created TypeScript types (`src/types/index.ts`): Plant, PlantEvent, AIIdentificationResult
- Created Supabase Storage bucket `plant-photos` with RLS policies (run via SQL Editor)
- Created `identify-plant` Supabase Edge Function — calls Anthropic API (claude-sonnet-4) with vision, returns structured JSON
- Edge function deployed and ANTHROPIC_API_KEY set as Supabase secret
- Built AddPlantScreen with full flow: photo capture → upload → AI identification → form → save
- Photo upload uses XMLHttpRequest with FormData (only reliable method in React Native / Expo Go)
- HomeScreen updated with "Add Plant" button, fetches plants on focus, renders plant cards
- App.tsx updated with typed RootStackParamList, AddPlant modal screen
- tsconfig.json excludes `supabase/functions` (Deno types)
- Full flow tested end-to-end: photo → AI identification → save → plant appears on HomeScreen

#### M3 — Today Screen (COMPLETE)
- Installed expo-location for device GPS access
- Added `WateringStatus` and `WeatherData` types to `src/types/index.ts`
- Created `src/lib/watering.ts` — `getWateringStatus()` (date math comparing last_watered_at + frequency to today) and `daysSinceWatered()` helper
- Created `src/lib/weather.ts` — `fetchWeather()` calls Open-Meteo API, returns temperature/humidity/precipitation
- Created `src/lib/events.ts` — `logWatering()` inserts into `plant_events` and updates `plants.last_watered_at`
- Redesigned HomeScreen as Today Screen:
  - Header shows "Today" with formatted date (e.g. "Wednesday, June 3")
  - Weather widget at top — requests location permission, shows temperature/humidity/precipitation
  - Graceful fallback if location permission denied ("Location access needed for weather data")
  - Plant cards sorted by urgency — "water_today" first, then "check", then "ok"
  - Status badges: red "Water today", yellow "Check", green "OK"
  - "Last watered Xd ago" subtitle (or "Never watered")
  - One-tap "Water" button on cards needing attention — optimistic UI update, persists to Supabase
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

### What's in progress
- Nothing — M3 is complete

### Next steps (M4 — Plant Profile)
1. Plant profile screen with photo, nickname, species, location
2. Timeline of events (watered, fertilized, observations, photos)
3. Care stats: average watering interval, last 30 days activity
4. "Log event" button: watered / fertilized / repotted / take photo

### Key decisions made
- Using `expo-secure-store` for auth token persistence on native (falls back to default on web)
- Using `EXPO_PUBLIC_` prefix for env vars (Expo convention for client-side access)
- Auth uses email/password only for MVP (no Google OAuth yet)
- Email confirmation disabled for development
- Navigation uses native stack navigator
- Color scheme: green tones (#2d5016 primary, #f8faf5 background)
- Photo upload: React Native's `fetch`/`Blob`/`ArrayBuffer` APIs don't work for file uploads in Expo Go. Using `XMLHttpRequest` + `FormData` with file URI directly against Supabase Storage REST API is the only reliable approach.
- Edge function base64 conversion: `String.fromCharCode(...spread)` causes stack overflow for large images. Must use a for loop instead.
- `supabase.functions.invoke` swallows error details on non-2xx. Using direct `fetch` to the functions endpoint gives better error visibility.
- Supabase Edge Functions use Deno runtime — excluded from project tsconfig to avoid type conflicts.
- Watering logic: simple date math (`last_watered_at + watering_frequency_days` vs today). No AI recommendations yet (deferred to M5).
- Weather: displayed as context only, does not factor into watering logic yet (deferred to M5).
- Open-Meteo API: free, no API key needed. Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current=temperature_2m,relative_humidity_2m,precipitation`

### Project structure
```
plantdiary/
├── App.tsx                  # Root: typed navigator + auth state
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   ├── watering.ts      # getWateringStatus(), daysSinceWatered()
│   │   ├── weather.ts       # fetchWeather() — Open-Meteo API
│   │   └── events.ts        # logWatering() — insert event + update plant
│   ├── screens/
│   │   ├── AuthScreen.tsx    # Sign up / log in
│   │   ├── HomeScreen.tsx    # Today Screen: weather + watering status + water button
│   │   └── AddPlantScreen.tsx # Photo → AI ID → save plant
│   └── types/
│       └── index.ts          # Plant, PlantEvent, WateringStatus, WeatherData, AIIdentificationResult
├── supabase/
│   ├── functions/
│   │   └── identify-plant/
│   │       └── index.ts      # Edge function: Anthropic vision API
│   ├── migrations/
│   │   └── 00001_initial_schema.sql
│   └── storage-setup.sql     # Bucket + RLS for plant-photos
├── .env                     # Supabase credentials (gitignored)
└── CONTEXT.md               # This file
```
