# PlantDiary — Test Feedback Log

Informal friend-testing round. Started **2026-08-30** with the Android preview APK
(EAS build `e8a419dc`). Friends report over chat; reports get logged here, triaged,
and linked to a fix commit when closed.

**Types:** `bug` · `ux` (confusing/rough) · `idea` (feature/nice-to-have)
**Severity:** `blocker` (can't use app) · `major` (feature broken) · `minor` (annoyance/cosmetic)
**Status:** `open` · `in-progress` · `resolved` · `wontfix`

---

## Index

| #  | Date       | Reporter | Device            | Type | Severity | Summary                          | Status   |
|----|------------|----------|-------------------|------|----------|----------------------------------|----------|
| 1  | 2026-08-30 | sister   | Android           | bug  | blocker  | App crashed on launch            | resolved |
| 2  | 2026-09-03 | sister   | Android           | ux   | major    | No way to remove/delete a plant  | resolved |
| 3  | 2026-09-05 | sister   | Android           | bug  | major    | Weather follows the phone, not home | resolved |

---

## Open

_(none yet)_

---

## Resolved

### #3 — Weather follows the phone, not the plants' home · `bug` · `major` · resolved
- **Reporter / device:** sister · Android
- **Symptom:** Weather on Today (and the situation she would relay to whoever is at
  home) used wherever *she* was. Away from home, the numbers were the trip, not
  the house.
- **Cause:** Today fetched live GPS on every focus and upserted those coords onto
  `profiles`. Event `captureWeather()` also used live GPS, so travel weather was
  written onto `plant_events.weather`. N3's advisor already reads `profiles`
  coords, so a trip poisoned tomorrow's push too. Context cannot be backfilled.
- **Fix:** Treat `profiles.latitude/longitude` as a home pin. First successful GPS
  write seeds it; later Today opens do not overwrite. Today, event logging, and
  N3 all read that pin. **Update** on the weather card is the only overwrite:
  Open-Meteo city search (works without GPS) or "Use current location".
- **Verified:** 2026-09-05 in Expo Go (iOS) — copy and Update sheet reviewed.
  Commit `8d61c73` on `dev/home-weather`. Existing travel coords on a profile stay
  until Update is tapped once.
- **Pending:** merge the PR; next `eas build --profile preview --platform android`
  so sister's device gets it (same rebuild as #2).

---

### #2 — No way to remove/delete a plant · `ux` · `major` · resolved
- **Reporter / device:** sister · Android
- **Symptom:** Couldn't figure out how to remove a plant she no longer wanted — there was
  simply no delete affordance anywhere in the app.
- **Cause:** Deletion was never built. Two latent blockers also existed: `plant_events`
  referenced `plants` with no `ON DELETE CASCADE` (so a raw plant delete would fail once
  events existed), and `plant-photos` storage had no DELETE policy.
- **Fix:**
  - Added `src/lib/plants.ts` — `deletePlant()`: deletes events, then the plant, then best-effort
    removes associated storage photos (profile + check-in photos). Photo cleanup failure only warns.
  - `PlantProfileScreen.tsx`: "Remove plant" button at the bottom of the timeline → destructive
    confirmation Alert → deletes and navigates back. Loading state while removing.
  - Migration `00006_delete_plant.sql`: adds `ON DELETE CASCADE` to the `plant_events` FK and a
    storage DELETE policy scoped to the user's own folder. **Must be run manually in Supabase.**
- **Note:** App-side cleanup already handles events explicitly, but the cascade makes the DB
  self-consistent and protects the manual delete path.
- **Verified:** 2026-09-03 in iOS Simulator (Expo Go) + SQL Editor checks — plant, `plant_events`,
  `journal_entries`, and `plant-photos` storage objects all removed. Migration `00006` applied.
  Ships to sister's Android build on next `eas build --profile preview --platform android`.

---

### #1 — App crashed on launch · `bug` · `blocker` · resolved
- **Reporter / device:** sister · Android (first preview APK)
- **Symptom:** App installed fine but closed immediately on open (never showed a screen).
- **Cause:** `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` were not registered
  on EAS. `.env` is gitignored, so it's never uploaded to cloud builds — the APK was built
  with `undefined` Supabase credentials and `createClient()` threw at startup.
- **Fix:** Added both `EXPO_PUBLIC_*` vars to EAS `preview` + `production` environments, rebuilt
  (build `e8a419dc`). Build log confirmed the vars loaded.
- **Lesson:** EAS cloud builds need `EXPO_PUBLIC_*` set as EAS environment variables — a local
  `.env` alone is not enough. Re-check this before any future build on a fresh environment.

---

## Ideas & nice-to-haves

_(none yet)_
