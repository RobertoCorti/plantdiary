# PlantDiary — Context for Claude Code

## Current milestone: M1 — Foundation (COMPLETE)
## Last session: 2026-06-03

### What's done
- Expo project initialized with TypeScript (blank-typescript template)
- Dependencies installed: @supabase/supabase-js, @react-navigation/native, @react-navigation/native-stack, react-native-screens, react-native-safe-area-context, expo-secure-store
- Supabase client configured with SecureStore for token persistence (`src/lib/supabase.ts`)
- DB migration file created (`supabase/migrations/00001_initial_schema.sql`) with plants + plant_events tables, RLS policies, and indexes
- Auth flow built: AuthScreen with email sign up / log in, toggle between modes
- HomeScreen placeholder showing user email and empty state
- App.tsx wired with React Navigation, auth state listener, conditional rendering (auth vs home)
- `.env` file created with placeholder Supabase credentials (gitignored)
- TypeScript compiles cleanly

### What's in progress
- Nothing — M1 is complete

### Next steps (M2 — Add Plant)
1. Install expo-image-picker for camera/gallery access
2. Create AddPlantScreen with photo capture
3. Integrate Anthropic API for plant identification
4. Save identified plant to Supabase (plants table)
5. Set up Supabase Storage bucket for plant photos
6. Add navigation from HomeScreen to AddPlantScreen

### Key decisions made
- Using `expo-secure-store` for auth token persistence on native (falls back to default on web)
- Using `EXPO_PUBLIC_` prefix for env vars (Expo convention for client-side access)
- Auth uses email/password only for MVP (no Google OAuth yet)
- Navigation uses native stack navigator
- Color scheme: green tones (#2d5016 primary, #f8faf5 background)

### Project structure
```
plantdiary/
├── App.tsx                  # Root: navigation + auth state
├── src/
│   ├── lib/
│   │   └── supabase.ts      # Supabase client config
│   └── screens/
│       ├── AuthScreen.tsx    # Sign up / log in
│       └── HomeScreen.tsx    # Home (placeholder)
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql
├── .env                     # Supabase credentials (gitignored)
└── CONTEXT.md               # This file
```
