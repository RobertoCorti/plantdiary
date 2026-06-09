# PlantDiary — Context for Claude Code

## Current milestone: N1 — Push Notifications (FIX APPLIED — DEV BUILD IN PROGRESS)
## Last session: 2026-06-09

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

#### N1 — Push Notifications (FIX APPLIED — DEV BUILD IN PROGRESS)
- Installed `expo-notifications`, `expo-device`, `expo-constants`, `expo-dev-client`
- Created `src/lib/notifications.ts` — `registerForPushNotifications()`:
  - Lazy-requires `expo-notifications` inside the function (NOT at module top level — see "Root cause" below)
  - Early bail when `Constants.appOwnership === "expo"` (Expo Go) — logs and returns null
  - Checks for physical device (push tokens require it)
  - Creates Android notification channel for Android 13+ permission prompt
  - Requests notification permissions
  - Returns Expo push token or null
- App.tsx: after session is confirmed, registers for push and upserts token to `profiles` table
- Created `supabase/migrations/00002_push_tokens.sql`:
  - `profiles` table with `id` (FK to auth.users), `push_token`, `created_at`, `updated_at`
  - RLS policy: users can only access their own profile
  - Migration applied to Supabase (verified via REST API — 200 OK on /rest/v1/profiles)
- Created `supabase/functions/send-watering-reminders/index.ts`:
  - Uses service_role key to bypass RLS and read all profiles + plants
  - Mirrors `getWateringStatus()` logic from `src/lib/watering.ts`
  - For each user: computes which plants need water/check
  - Builds summary notification body (e.g. "Giorgio needs water today · Check on Fern")
  - Sends via Expo Push API (`https://exp.host/--/api/v2/push/send`) with batching (100 per request)
  - Deployed to Supabase (verified via `supabase functions list`)
- GitHub Actions workflow (`.github/workflows/watering-reminders.yml`), `SUPABASE_SERVICE_ROLE_KEY` secret added
- TypeScript compiles cleanly (`npx tsc --noEmit` passes)

#### Root cause discovered (2026-06-09)
- Symptom: app crashed with red error on login: `expo-notifications: Android Push notifications functionality was removed from Expo Go with the release of SDK 53. Use a development build instead`
- Cause: `expo-notifications` throws at module-load time in Expo Go on Android (SDK 53+). The `import * as Notifications from "expo-notifications"` at the top of `notifications.ts` was triggering this before any code ran.
- Fix: changed to lazy `require()` inside `registerForPushNotifications()`, gated behind `Constants.appOwnership === "expo"` early-return. App now boots cleanly in Expo Go (registration is a no-op there).
- Verified: confirmed via dev server log `LOG  Push notifications skipped: Expo Go does not support remote push since SDK 53` after login.

### What's in progress
- EAS development build kicked off (2026-06-09) — Android APK, profile `development`
  - Build URL: https://expo.dev/accounts/robi29/projects/plantdiary/builds/d3aa1d64-4ed0-4798-a43c-a0f8ed184b47
  - Created `eas.json` with `development` (dev client + APK + internal distribution), `preview`, `production` profiles
  - Added `android.package: "com.robi29.plantdiary"` to `app.json`
  - Keystore auto-generated by EAS (cloud-managed)
- **Next session — verification steps once dev build is installed on device:**
  1. Open installed dev build app, run `npx expo start --dev-client`, scan QR, log in
  2. Confirm permission prompt appears and is granted
  3. Verify token in Supabase: `select id, push_token, updated_at from profiles;` — should see `ExponentPushToken[...]`
  4. Trigger edge function manually:
     ```
     curl -X POST 'https://xsqklmpgibpznfbpuyxe.supabase.co/functions/v1/send-watering-reminders' \
       -H 'Authorization: Bearer <SERVICE_ROLE_KEY>'
     ```
  5. Confirm notification arrives on phone

### Strategic principles (2026-06-09 — revised after roadmap review)

1. **Context cannot be backfilled.** Every signal we don't log today (weather, light, time-of-day) is permanently lost training data. Default to silent rich logging — recording is near-free, missing data is forever.
2. **The personal model precedes the advice.** AI advice built on species defaults is what we are differentiating against. Build the learning loop (N2 — AI Learning) before the advisor (N3 — Event-triggered Advisor).
3. **Honest AI is structural, not cosmetic.** Render confidence as numbers and error bars that tighten with data, not as prose disclaimers. Silence beats padding.
4. **Differentiation compounds.** Prefer features boring on day 1 and uncanny on day 90.

### Revised roadmap (supersedes prior N1–N5)

Build order, not user-facing priority. Full rationale in PRD §7.

- **N1 — Push notifications (context-aware payloads).** In progress. Payload body must read from user data, not species defaults.
- **N1.5 — Weather column on `plant_events`.** *Highest-leverage 1-hour change in the project.* `weather` JSONB populated silently by `logEvent`/`logWatering` from existing `fetchWeather()`. Ships before anything else once N1 is verified. **Calendar-gating** — the Day 30 north-star moment goes live ~30 days after this lands.
- **N2 — AI Learning (per-plant watering frequency).** Propose updates with evidence, never silent change. Confidence visibly tightens with N. This is the core differentiator and what everything below reads from.
- **N3 — Event-triggered Advisor.** Replaces the old "daily" advisor. Surfaces only when forecast + plant state intersect. Silent on uneventful days.
- **N4 — Plant Journal View.** Monthly Claude-generated narrative + photo gallery + milestone feed. Auto-feeds from N1.5/N2 outputs.
- **N5 — Slow-drift detector.** Replaces the cut 1–10 health score. Compares latest photo to 4–6 week rolling baseline; direction + evidence, no scalar.
- **N6 — Shared Plants.** Named in PRD §3 as a key differentiator vs competitors. Deferred to N6 only because the personal model needs to be working first.
- **Small wins (parallel):** plant ID correction loop ("this isn't right" affordance); care stats milestone cards.
- **Cut:** N5 1–10 health score (fake precision, violates honest-AI). Daily-cadence advisor (forces padding).

### North star: the Day 30 moment

30 days after a plant is added, app surfaces a single full-screen card: side-by-side first/latest photo, the user's actual watering interval vs species default, a weather sparkline of the dryest week, and a proposed frequency update with confidence label. Full spec in PRD §7.1. Every roadmap item ladders up to this convergence.

### Immediate next action

**Ship N1.5 (weather column) the day N1 is verified.** Rationale: every uncaptured event is permanent data loss; the Day 30 moment is calendar-gated by this. Scope: migration adding `weather` JSONB to `plant_events`, edits in `src/lib/events.ts` to populate from `fetchWeather()`, NULL backfill for existing rows (distinguishes "no data" from "we forgot").

### Dev workflow

**Primary workflow — EAS dev client (required from N1 onwards because of push):**
1. EAS dev build APK is installed on physical Android device (one-time per native-deps change).
2. Start Metro: `npx expo start --dev-client`
3. Open the installed PlantDiary dev build app on phone → scan QR / enter URL.
4. JS/TS edits hot-reload over Wi-Fi. Native features (push, camera, location) work because the dev build is a real native binary.
5. Both phone and Mac must be on the same Wi-Fi (LAN). Mac IP via `ipconfig getifaddr en0`.

**When to rebuild the dev client (`eas build --profile development --platform android`):**
- New native module added (anything with `ios/` or `android/` folders — e.g. a new `expo-*` package with native code).
- `app.json` plugins, permissions, or package identifier changed.
- Expo SDK upgraded.
- NOT required for pure JS/TS changes, edge function changes, DB migrations, or AI prompt tweaks.

**Fallback — Expo Go** (`npx expo start`, scan QR with Expo Go from Play Store):
- Works for everything EXCEPT push notifications (registration is a no-op).
- Faster iteration when you don't need to test push.
- Acceptable for N2 (AI advisor) and N4 (journal view) since those don't need push.

**Debugging logs from device:**
- JS `console.log` appears in the Metro terminal (the one running `expo start`).
- Native errors (rare) need `adb logcat` (Android) or Xcode Console (iOS).
- Claude Code can monitor `expo start` output in background via the Monitor tool when collaborating live.

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
- **Expo Go SDK 53+ does NOT support remote push notifications on Android.** `expo-notifications` throws at module load if push APIs touched. Always lazy-require `expo-notifications` and gate behind `Constants.appOwnership !== "expo"`. Dev build (EAS) required to test push end-to-end.
- Android package name: `com.robi29.plantdiary` (permanent identifier for Play Store)
- EAS `development` profile uses APK + internal distribution + dev client — install once on device, then load JS from local Metro via `npx expo start --dev-client`

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
├── app.json                 # Expo config (incl. android.package, eas.projectId)
├── eas.json                 # EAS build profiles: development (APK + dev client), preview, production
├── .env                     # Supabase credentials (gitignored)
└── CONTEXT.md               # This file
```
