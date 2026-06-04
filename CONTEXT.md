# PlantDiary — Context for Claude Code

## Current milestone: N1 — Push Notifications (CODE COMPLETE — NOT TESTED)
## Last session: 2026-06-04

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

#### M4 — Plant Profile (COMPLETE)
- Added `PlantProfile: { plantId: string }` route to `RootStackParamList` (exported from App.tsx)
- Expanded `src/lib/events.ts` with `logEvent()` (generic event insert, updates `last_watered_at` when type is "watered") and `fetchPlantEvents()` (ordered by `created_at` desc)
- Created `src/screens/PlantProfileScreen.tsx`:
  - Hero plant photo with overlaid back button
  - Plant name, species, location, watering status badge (reuses STATUS_CONFIG pattern)
  - Care stats row: average watering interval (computed from watered event timestamps), event count last 30 days
  - Event timeline: FlatList with icon per event type, relative timestamps ("2h ago", "3d ago"), notes display
  - Fixed "+ Log Event" button at bottom opens Modal with event type picker (watered/fertilized/repotted/observation), optional notes TextInput, cancel/save actions
  - New events appear in timeline immediately after logging
- HomeScreen plant cards wrapped in `Pressable` — tapping navigates to PlantProfile with `plantId`
- HomeScreen navigation prop typed with `NativeStackNavigationProp<RootStackParamList, "Home">`
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- Tested end-to-end: navigation, display, event logging, back navigation all working

#### M5 — Photo Check-In (COMPLETE)
- Added `AIPhotoAnalysisResult` type to `src/types/index.ts`
- Extended `logEvent()` in `src/lib/events.ts` with optional `photoUrl` and `aiAnalysis` parameters
- Created `analyze-plant` Supabase Edge Function (`supabase/functions/analyze-plant/index.ts`) — calls Anthropic API with vision for plant health analysis
- Added photo check-in flow to PlantProfileScreen:
  - "Photo Check-In" button next to "Log Event" at bottom of screen
  - Camera capture → upload to Supabase Storage → AI analysis via edge function
  - Analysis result modal: status badge (healthy/monitor/concern), observations, recommended action
  - Photo event with AI analysis saved to plant_events timeline
  - AI analysis displayed inline in event timeline with status badge
  - `parseAnalysis()` helper parses JSON ai_analysis from events
  - Loading state with "Analyzing your plant..." spinner
  - Error handling with Alert on failure
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

#### M6 — Polish (COMPLETE)
- Splash screen (`App.tsx`): replaced blank `return null` during auth loading with centered "PlantDiary" title and spinner
- Auth fix (`AuthScreen.tsx`): removed misleading "Check your email" alert (email confirmation is disabled)
- Empty state (`HomeScreen.tsx`): added "Welcome to PlantDiary" title, descriptive tagline, and prominent "Add Your First Plant" CTA button
- Error handling (`HomeScreen.tsx`):
  - `fetchPlants`: try/catch with error state and "Retry" button
  - `handleWater`: Alert on watering failure before reverting
  - Logout: confirmation dialog before signing out
- Error handling (`PlantProfileScreen.tsx`):
  - `fetchData`: try/catch with Alert on failure
  - `handleLogEvent`: Alert on failure (modal stays open for retry)
- Camera permission (`AddPlantScreen.tsx`): explicit `requestCameraPermissionsAsync()` before launching camera, alert if denied
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

#### N1 — Push Notifications (CODE COMPLETE — NOT TESTED)
- Installed `expo-notifications` and `expo-device`
- Created `src/lib/notifications.ts` — `registerForPushNotifications()`:
  - Checks for physical device (push tokens require it)
  - Creates Android notification channel for Android 13+ permission prompt
  - Requests notification permissions
  - Returns Expo push token or null
  - Sets foreground notification handler (show banner + list)
- App.tsx: after session is confirmed, registers for push and upserts token to `profiles` table
- Created `supabase/migrations/00002_push_tokens.sql`:
  - `profiles` table with `id` (FK to auth.users), `push_token`, `created_at`, `updated_at`
  - RLS policy: users can only access their own profile
  - Commented pg_cron schedule (8am UTC daily) with `net.http_post` to edge function
  - Commented GitHub Actions cron fallback if pg_cron is not available
- Created `supabase/functions/send-watering-reminders/index.ts`:
  - Uses service_role key to bypass RLS and read all profiles + plants
  - Mirrors `getWateringStatus()` logic from `src/lib/watering.ts`
  - For each user: computes which plants need water/check
  - Builds summary notification body (e.g. "Giorgio needs water today · Check on Fern")
  - Sends via Expo Push API (`https://exp.host/--/api/v2/push/send`) with batching (100 per request)
- **Manual steps required:**
  - Run `00002_push_tokens.sql` in Supabase SQL Editor
  - Deploy edge function: `supabase functions deploy send-watering-reminders`
  - Set up scheduling: enable pg_cron in Supabase dashboard or create GitHub Actions workflow
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

### What's in progress
- N1 push notifications: code is written but notification permission prompt is not appearing on physical device
- EAS project initialized (projectId: 7acd1cb3-5663-4418-8183-2438585df567, owner: robi29)
- GitHub Actions workflow created (`.github/workflows/watering-reminders.yml`), `SUPABASE_SERVICE_ROLE_KEY` secret added
- **Debugging needed next session:**
  - Check Expo Go console logs for errors from `registerForPushNotifications()`
  - Verify `00002_push_tokens.sql` migration has been run in Supabase SQL Editor
  - Verify `profiles` table exists before the upsert runs
  - May need to check if Expo Go on this device/OS version requires additional config
  - Consider testing with `expo-notifications` `requestPermissionsAsync()` in isolation

### Next steps (post-MVP)
- N2: Contextual Daily Advisor (AI tip combining weather + plant history)
- N3: AI Learning (auto-adjust watering frequency from real history)
- N4: Plant Journal View (monthly narrative, photo gallery, health trend)
- N5: Plant Health Score (1-10 from photo analysis history)

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
- `RootStackParamList` exported from App.tsx so screens can import it for typed navigation props
- PlantProfileScreen uses a Modal for event logging (no external dependencies)
- `logEvent()` is the generic version; `logWatering()` kept for backward compatibility with HomeScreen's one-tap water flow
- Photo check-in reuses the same XHR upload pattern as AddPlantScreen
- `analyze-plant` edge function receives photo_url, plant info, and previous events for context-aware analysis
- Analysis results stored as JSON string in `plant_events.ai_analysis` column
- Push token stored in `profiles` table, upserted on each app launch (handles token refresh)
- `send-watering-reminders` edge function uses service_role to bypass RLS
- Expo Push API used for delivery — no Firebase/APNs config needed in dev (Expo handles routing)

### Project structure
```
plantdiary/
├── App.tsx                  # Root: typed navigator + auth state + splash screen, exports RootStackParamList
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client config
│   │   ├── notifications.ts # registerForPushNotifications() — Expo push token
│   │   ├── watering.ts      # getWateringStatus(), daysSinceWatered()
│   │   ├── weather.ts       # fetchWeather() — Open-Meteo API
│   │   └── events.ts        # logWatering(), logEvent(), fetchPlantEvents()
│   ├── screens/
│   │   ├── AuthScreen.tsx    # Sign up / log in
│   │   ├── HomeScreen.tsx    # Today Screen: weather + watering status + tappable plant cards
│   │   ├── AddPlantScreen.tsx # Photo → AI ID → save plant
│   │   └── PlantProfileScreen.tsx # Plant details, care stats, event timeline, log event, photo check-in
│   └── types/
│       └── index.ts          # Plant, PlantEvent, WateringStatus, WeatherData, AIIdentificationResult, AIPhotoAnalysisResult
├── supabase/
│   ├── functions/
│   │   ├── identify-plant/
│   │   │   └── index.ts      # Edge function: Anthropic vision API (plant ID)
│   │   ├── analyze-plant/
│   │   │   └── index.ts      # Edge function: Anthropic vision API (health analysis)
│   │   └── send-watering-reminders/
│   │       └── index.ts      # Edge function: daily push notifications via Expo Push API
│   ├── migrations/
│   │   ├── 00001_initial_schema.sql
│   │   └── 00002_push_tokens.sql  # profiles table + pg_cron schedule
│   └── storage-setup.sql     # Bucket + RLS for plant-photos
├── .github/
│   └── workflows/
│       └── watering-reminders.yml  # Daily cron → edge function for push notifications
├── .env                     # Supabase credentials (gitignored)
└── CONTEXT.md               # This file
```
