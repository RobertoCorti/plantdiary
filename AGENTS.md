# Product Vision & Differentiation

PlantDiary is NOT a generic plant care app. The differentiator is contextual
personal memory: the app learns how YOUR specific plant, in YOUR specific home,
responds to YOUR care over time.

Other apps (Greg, Planta, PictureThis) give species-level advice that never
changes. PlantDiary builds a personal history that makes advice increasingly
accurate and impossible to replicate elsewhere.

Every feature should serve one of these goals:
1. Capture more context (weather, photos, observations, real watering intervals)
2. Surface insights from that context (advisor, health trends, seasonal patterns)
3. Create emotional connection to the plant (narrative summaries, milestones)

## Strategic principles

1. **Context cannot be backfilled.** Every signal we don't log today (weather, light, time-of-day) is permanently lost training data. Default to silent rich logging.
2. **The personal model precedes the advice.** Any AI-generated tip built on species defaults is exactly what we are differentiating against. Build the learning loop before the advisor that reads from it.
3. **Honest AI is structural, not cosmetic.** Render confidence as numbers/error bars that visibly tighten with data, not as prose disclaimers. Silence beats padding.
4. **Differentiation compounds.** Prefer features boring on day 1 and uncanny on day 90.

## North star: the Day 30 moment

30 days after a plant is added, the app surfaces a single full-screen card showing first/latest photo, the user's actual watering interval vs species default, a weather sparkline of the dryest week, and a proposed frequency update with confidence. Full spec in PRD §7.1. Every roadmap item ladders up to this convergence.

## Feature priorities (build order, revised 2026-06-09)

- **N1**: Push notifications — context-aware payloads (not species defaults)
- **N1.5**: Weather logged on every `plant_event` — 1-hour change, calendar-gates everything below. **Cannot be backfilled.**
- **N2**: AI Learning (per-plant watering frequency) — propose with evidence, never silent change. The differentiator everything else reads from.
- **N3**: Event-triggered Advisor (replaces "daily" advisor) — silent on uneventful days
- **N4**: Plant Journal View — monthly narrative + photo gallery + auto-detected milestones
- **N5**: Slow-drift detector (replaces 1–10 health score) — direction + evidence, no scalar
- Small wins (parallel): plant ID correction loop; care stats milestone cards

**Cut:** 1–10 health score (fake precision), daily-cadence advisor (forces padding), Shared Plants / multi-user ownership (cut 2026-06-18 — keeping the app single-user; personal-model differentiator stands alone). See PRD §7 for full rationale.

## What NOT to build
- Social features, sharing, community
- Marketplace or shop integrations
- Generic care content not tied to the user's own data
- Scalar health scores (use direction + evidence instead)
- AI features that must produce output every day (silence is a feature)

# Architecture Constraints

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## React Native / Expo
- File uploads: NEVER use `fetch` + `Blob`, `ArrayBuffer`, or the Supabase storage client. These all fail in React Native / Expo Go. The ONLY reliable approach is `XMLHttpRequest` + `FormData` with a file URI object:

```ts
const formData = new FormData();
formData.append("file", {
  uri: fileUri,
  name: "filename.jpg",
  type: "image/jpeg",
} as unknown as Blob);

const xhr = new XMLHttpRequest();
xhr.open("POST", uploadUrl);
xhr.setRequestHeader("Authorization", `Bearer ${token}`);
xhr.send(formData);
```

- Env vars: `EXPO_PUBLIC_` prefix for client-side access
- Navigation: typed NativeStackNavigator, `RootStackParamList` exported from App.tsx
- Auth tokens: `expo-secure-store` on native, default on web

## Supabase Edge Functions
- Runtime: Deno — excluded from project tsconfig via `"exclude": ["supabase/functions"]`
- When converting binary to base64, NEVER use `String.fromCharCode(...spread)` — stack overflow on large files. Use a for loop.
- `supabase.functions.invoke` swallows error details on non-2xx responses. Use direct `fetch` to `${supabaseUrl}/functions/v1/<name>` for better error handling.
- AI model: always `claude-sonnet-4-20250514`

## Data philosophy
- Every user action that reveals something about the plant should be persisted
- **Log weather on every `plant_event`** (`weather` JSONB column). Not optional — context cannot be backfilled. Use existing `fetchWeather()` and write silently.
- AI responses should always be stored (`ai_analysis` column) for future learning

# Claude Code Session Rules

1. ONE objective per session. Read it from the session prompt, do not scope-creep.
2. Read CONTEXT.md before writing any code. It is the source of truth.
3. Never move to the next step if the current one is broken.
4. After completing the session objective, update CONTEXT.md before stopping.
5. If a feature requires a DB migration, write the SQL file in `supabase/migrations/` with incremental numbering (`00002_`, `00003_`, etc.) and note it must be run manually.
6. TypeScript must compile cleanly (`npx tsc --noEmit`) before the session ends.
