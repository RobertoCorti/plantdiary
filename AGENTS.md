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

## Feature priorities
- N1: Push notifications (daily reminder, watering urgency)
- N2: Contextual Daily Advisor (AI tip combining weather + plant history)
- N3: AI Learning (auto-adjust watering frequency from real history)
- N4: Plant Journal View (monthly narrative, photo gallery, health trend)
- N5: Plant Health Score (1-10 from photo analysis history)

## What NOT to build
- Social features, sharing, community
- Marketplace or shop integrations
- Generic care content not tied to the user's own data

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
- Weather at time of watering is valuable context — consider logging it
- AI responses should always be stored (`ai_analysis` column) for future learning

# Claude Code Session Rules

1. ONE objective per session. Read it from the session prompt, do not scope-creep.
2. Read CONTEXT.md before writing any code. It is the source of truth.
3. Never move to the next step if the current one is broken.
4. After completing the session objective, update CONTEXT.md before stopping.
5. If a feature requires a DB migration, write the SQL file in `supabase/migrations/` with incremental numbering (`00002_`, `00003_`, etc.) and note it must be run manually.
6. TypeScript must compile cleanly (`npx tsc --noEmit`) before the session ends.
