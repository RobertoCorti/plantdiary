# PlantDiary — Context for Claude Code

## Current milestone: M2 — Add Plant (COMPLETE)
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

### What's in progress
- Nothing — M2 is complete

### Next steps (M3 — Today Screen)
1. Watering logic: determine which plants need water based on last_watered_at + watering_frequency_days
2. Weather integration via Open-Meteo API (humidity, precipitation)
3. One-tap "watered" logging from HomeScreen
4. Plant event creation (watered, fertilized, etc.)

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

### Project structure
```
plantdiary/
├── App.tsx                  # Root: typed navigator + auth state
├── src/
│   ├── lib/
│   │   └── supabase.ts      # Supabase client config
│   ├── screens/
│   │   ├── AuthScreen.tsx    # Sign up / log in
│   │   ├── HomeScreen.tsx    # Plant list + add button
│   │   └── AddPlantScreen.tsx # Photo → AI ID → save plant
│   └── types/
│       └── index.ts          # Plant, PlantEvent, AIIdentificationResult
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
