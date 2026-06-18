# PlantDiary — Context for Claude Code

## Current milestone: N3 — Event-triggered Advisor (next)
## Last session: 2026-06-18

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

#### N1 — Push Notifications (COMPLETE — verified end-to-end 2026-06-14)
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

#### N2 — AI Learning, per-plant watering frequency (COMPLETE — verified end-to-end 2026-06-18)
- `src/lib/learning.ts` — `proposeFrequency(supabase, plant)`:
  - Fetches all `event_type = 'watered'` rows for the plant, ordered ascending.
  - Returns `null` when `< 5` waterings OR `plant.watering_frequency_days === null` OR `Math.round(median(intervals)) === current`.
  - Otherwise returns `{ proposed_days, current_days, median_days, count, confidence }`.
  - Confidence buckets are count-based for v1: `<5` low (filtered out), `5–9` medium, `≥10` high. Variance/IQR tightening deferred.
- `src/lib/events.ts` — `acceptFrequencyProposal(supabase, plantId, userId, proposal)`:
  - Inserts a `frequency_updated` `plant_event` with structured notes (`"Schedule updated 7 → 9 days (median 9.2d over 12 waterings, confidence medium)"`).
  - Updates `plants.watering_frequency_days` to the proposed value.
  - Awaits `captureWeather()` like every other event, so this row also carries N1.5 context for future N4 narratives. This is the ~1s latency the user sees on Update.
- `src/types/index.ts`: added `frequency_updated` to `PlantEvent.event_type` union and new `FrequencyProposal` type.
- `src/lib/logger.ts`: added `learning` tag.
- `PlantProfileScreen.tsx`:
  - Calls `proposeFrequency()` inside `fetchData()`, stores result in `proposal` state.
  - Renders "Schedule suggestion" card between care stats and timeline when `proposal && !proposalDismissed`. Shows median (1 decimal), count, current schedule, proposed schedule, and confidence badge.
  - `Keep` flips `proposalDismissed` for the current screen mount only — re-shows on next fresh navigation. No persistent dismissal yet (deferred until it proves annoying).
  - `Update` runs `acceptFrequencyProposal` → updates local `plant` state → clears proposal → refetches events. Timeline picks up the new `frequency_updated` row with the 📊 icon and "Schedule updated" label.
- Verified on device 2026-06-18: tapped Update on a plant proposal, observed ~1s delay (weather capture), `plants.watering_frequency_days` persisted, `frequency_updated` row appeared in `plant_events`.
- **No DB migration** — `event_type` is free text at the SQL layer. No edge function — pure client computation. **The personal model now exists**; N3+ can read from it.

#### Model ID bump (2026-06-18)
- Both edge functions (`identify-plant`, `analyze-plant`) pinned `claude-sonnet-4-20250514`. That snapshot is retired; the API returned 404 on photo check-in, our wrapper rewrapped as 502.
- Bumped both to `claude-sonnet-4-6` (current stable Sonnet). User must run `supabase functions deploy analyze-plant && supabase functions deploy identify-plant` to deploy.
- `AGENTS.md` line 78 still says *"AI model: always `claude-sonnet-4-20250514`"* — stale rule. Either change to rolling-pin wording or accept that it must be revisited on each Anthropic model retirement.

#### N1.5 — Weather column on plant_events (COMPLETE — verified end-to-end 2026-06-14)
- Migration `00003_plant_events_weather.sql`: `alter table plant_events add column weather jsonb;`. Existing rows NULL = "not yet attempted" baseline.
- `src/lib/location.ts` — `getCurrentCoordsOrNull()`. Requests foreground permission if not granted, returns null on any failure. Live GPS per event (Balanced accuracy ≈ <1s on warm cache).
- `src/lib/events.ts` — private `captureWeather()` orchestrates location + fetchWeather, logs result, returns `WeatherData | null`. Both `logWatering` and `logEvent` await it and pass `weather` into the insert. Event always saves, weather is silently NULL on any failure (PRD Principle 1: context cannot be backfilled, but losing the event itself is worse).
- `src/types/index.ts` — `PlantEvent.weather: WeatherData | null`.
- Verified on device 2026-06-14 16:07: observation logged → `[weather] Captured for event {humidity:62, precipitation:0, temperature:16.2}` → row persisted with that JSONB in `plant_events.weather`.
- **Calendar gate cleared.** Day 30 north-star moment is now ~30 days from this point for any plant added now; existing plants will have it from when they get their first post-N1.5 event.

### Session 2026-06-14 — N1 verified end-to-end

- Dev build #2 (Android APK with FCM config) installed on physical device.
- Metro connected via `npx expo start --dev-client`.
- Login → OS permission prompt → Allow → registration succeeded silently.
- Token persisted to `profiles` (userId `77f930ea-e552-486a-ab27-f5338bec1e33`, token `ExponentPushToken[u1H7cNNDSK3MieH60S-An0]`).
- Direct Expo Push API test landed on device.
- `send-watering-reminders` edge function fired via curl with service_role key → `{"sent":1,"total_users":1}` → notification *"Calla needs water today"* arrived → confirms context-aware payload (PRD §7 N1 promise).
- Non-fatal `expo-notifications` WARN observed twice during registration: `"fetch failed: Fetch request has been canceled"` — internal Expo server token-sync retry. Token retrieval still succeeded. Not a blocker; revisit only if it recurs in field use.

### Dev tooling added this session

- `src/lib/logger.ts` — tagged, timestamped logger (`log.info/warn/error("push"|"auth"|"weather"|"ai"|"events"|"nav"|"app", message, data?)`). Wired into `notifications.ts` and `App.tsx` push-registration path. Replaces scattered `console.log`. Pure JS — no native rebuild.
- `app.config.js` — extends `app.json` to let `GOOGLE_SERVICES_JSON` env var override the local Firebase config path during EAS builds. Local default still `./google-services.json`.

### Data cleanup this session

- Orphan plant `Calla` id=`6fcac1f8-ed09-4bbf-99b9-2cfe97def1b9` was owned by an unknown auth user `0bb661bf-cbaf-4457-99b8-ef4a20b9a0c8` (likely from a discarded test signup before email confirmation was disabled). Reassigned to current user `77f930ea-…` via direct SQL update so the edge function had a real overdue plant to push about. The orphan account itself may still exist in `auth.users` — not yet cleaned.

### Phase 3 (deferred) — Sentry crash tracking

Plan agreed: install `@sentry/react-native` + Expo plugin, wire DSN, trigger EAS build #3. Skipped this session in favour of shipping N1.5 first (calendar-gating). Sentry account/DSN not yet created.

### Build #1 history (kept for posterity)

- Build #1 succeeded but failed at runtime: `Unable to get Firebase Messaging instance ... Default FirebaseApp is not initialized`.
- Fix applied before build #2: Firebase project `plantdiary-b4b24` + `google-services.json` in root (gitignored) + FCM V1 service account uploaded to EAS Credentials + `android.googleServicesFile` in `app.json`.

### Files in project root (gitignored)
- `google-services.json` — Firebase Android client config
- `plantdiary-b4b24-firebase-adminsdk.json` — FCM V1 service account key (sensitive — admin-level Firebase access)
- `.env` — Supabase credentials

### Strategic principles (2026-06-09 — revised after roadmap review)

1. **Context cannot be backfilled.** Every signal we don't log today (weather, light, time-of-day) is permanently lost training data. Default to silent rich logging — recording is near-free, missing data is forever.
2. **The personal model precedes the advice.** AI advice built on species defaults is what we are differentiating against. Build the learning loop (N2 — AI Learning) before the advisor (N3 — Event-triggered Advisor).
3. **Honest AI is structural, not cosmetic.** Render confidence as numbers and error bars that tighten with data, not as prose disclaimers. Silence beats padding.
4. **Differentiation compounds.** Prefer features boring on day 1 and uncanny on day 90.

### Revised roadmap (supersedes prior N1–N5)

Build order, not user-facing priority. Full rationale in PRD §7.

- **N1 — Push notifications (context-aware payloads).** ✅ Complete (verified 2026-06-14). Payload body reads from user data ("Calla needs water today"). Next iteration: weather-aware payload bodies once N1.5 lands.
- **N1.5 — Weather column on `plant_events`.** ✅ Complete (verified 2026-06-14). `weather` JSONB populated by `captureWeather()` on every `logEvent`/`logWatering`. Day 30 moment is now calendar-counting from here.
- **N2 — AI Learning (per-plant watering frequency).** ✅ Complete (verified 2026-06-18). Median-based proposal, count-based confidence, structural honesty (numbers not prose), no silent change. Personal model now exists.
- **N3 — Event-triggered Advisor.** Replaces the old "daily" advisor. Surfaces only when forecast + plant state intersect. Silent on uneventful days. Reads from N2's learned `watering_frequency_days`.
- **N4 — Plant Journal View.** Monthly Claude-generated narrative + photo gallery + milestone feed. Auto-feeds from N1.5/N2 outputs.
- **N5 — Slow-drift detector.** Replaces the cut 1–10 health score. Compares latest photo to 4–6 week rolling baseline; direction + evidence, no scalar.
- **N6 — Shared Plants.** Named in PRD §3 as a key differentiator vs competitors. Deferred to N6 only because the personal model needs to be working first.
- **Small wins (parallel):** plant ID correction loop ("this isn't right" affordance); care stats milestone cards.
- **Cut:** N5 1–10 health score (fake precision, violates honest-AI). Daily-cadence advisor (forces padding).

### North star: the Day 30 moment

30 days after a plant is added, app surfaces a single full-screen card: side-by-side first/latest photo, the user's actual watering interval vs species default, a weather sparkline of the dryest week, and a proposed frequency update with confidence label. Full spec in PRD §7.1. Every roadmap item ladders up to this convergence.

### Immediate next action

**Start N3 — Event-triggered Advisor.** N2 just shipped, so we now have a per-plant learned `watering_frequency_days` to read from. Scope (proposed, refine at session start):
1. Trigger conditions (intersection of forecast + plant state). Examples to spec:
   - Heatwave incoming (next 3 days max temp > rolling avg + 5°C) AND plant due to dry within forecast window.
   - Sustained drop in humidity vs. recent average AND species marked humidity-sensitive.
   - Multiple plants intersecting → batch into one notification, not N.
2. Reuse the `send-watering-reminders` cron / edge function pattern. Probably a new `send-advisor-tips` function on a daily schedule.
3. Output: a notification with a *specific* observation, never a generic "check your plants". Same standard as N1 — payload reads from user data.
4. **Silent on uneventful days.** No padding. If nothing intersects, no notification. This is the structural-honesty contract from PRD §7.

Defer until first round of real triggers fires: weather-trend-aware adjustment to the N2 proposal itself (recompute median against same-season historicals only). Needs more `weather` data accumulated first.

Phase 3 (Sentry) still queued — wire alongside next native-deps change to avoid an extra rebuild.

**Open follow-ups from 2026-06-18 not yet acted on:**
- Persistent dismissal for the N2 proposal card (only matters if "Keep" → re-show on next mount proves annoying in real use).
- Optimistic UI on the N2 Update button (~1s weather-capture latency is visible but harmless).
- `AGENTS.md` line 78 model-pin rule wording — currently pins a now-retired snapshot.
- Photo check-in: model bump committed to code, but `supabase functions deploy analyze-plant && supabase functions deploy identify-plant` must be run to take effect in prod. Verify after deploy.

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
│   │   ├── logger.ts        # log.info/warn/error(tag, message, data?) — tagged JS logger
│   │   ├── location.ts      # getCurrentCoordsOrNull() — GPS with permission + null fallback
│   │   ├── notifications.ts # registerForPushNotifications() — Expo push token
│   │   ├── watering.ts      # getWateringStatus(), daysSinceWatered()
│   │   ├── weather.ts       # fetchWeather() — Open-Meteo API
│   │   ├── events.ts        # logWatering()/logEvent()/acceptFrequencyProposal() — silently capture weather; fetchPlantEvents()
│   │   └── learning.ts      # proposeFrequency() — median-interval N2 proposal, count-based confidence
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
│   │   ├── 00002_push_tokens.sql  # profiles table + pg_cron schedule
│   │   └── 00003_plant_events_weather.sql  # adds weather jsonb to plant_events
│   └── storage-setup.sql     # Bucket + RLS for plant-photos
├── .github/
│   └── workflows/
│       └── watering-reminders.yml  # Daily cron → edge function for push notifications
├── app.json                 # Expo config (incl. android.package, eas.projectId)
├── app.config.js            # Wraps app.json; allows GOOGLE_SERVICES_JSON env override for EAS
├── eas.json                 # EAS build profiles: development (APK + dev client), preview, production
├── .env                     # Supabase credentials (gitignored)
└── CONTEXT.md               # This file
```
