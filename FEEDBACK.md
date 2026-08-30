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

---

## Open

_(none yet)_

---

## Resolved

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
