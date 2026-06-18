# PlantDiary — Product Requirements Document

**Version:** 0.1
**Date:** June 2026
**Author:** Roberto
**Status:** Draft — MVP

----------

## 1. Vision

PlantDiary is a mobile app that helps plant owners keep their plants alive and thriving. Unlike generic plant care apps that give one-size-fits-all advice, PlantDiary builds a **personal history for each plant** — learning how your specific plant, in your specific home, responds to your care over time.

Core insight: the difference between a plant that survives and one that thrives is context. The right watering frequency for a Pothos in a bright Amsterdam apartment is different from one in a dim Copenhagen bedroom. PlantDiary captures that context.

**One-line pitch:** Strava for your plants — track, learn, improve.

### Strategic principles

1. **Context cannot be backfilled.** Every signal we don't capture today (weather, light, time-of-day, season) is permanently lost training data. Default to logging silently and richly; the cost of recording is near-zero, the cost of missing data is permanent.
2. **The personal model precedes the advice.** Any AI-generated tip built on species defaults is exactly what we are differentiating against. Build the learning loop first, then the advisor that reads from it.
3. **Honest AI is structural, not cosmetic.** Confidence is rendered as numbers and error bars that visibly tighten with data, not as disclaimers in prose. Silence is allowed — and preferable to padding.
4. **Differentiation compounds.** Features should be boring on day 1 and uncanny on day 90. Prefer features whose magic comes from accumulated history over features that are flashy at first use.

----------

## 2. Target User

Primary: People who own houseplants but feel insecure about care — they forget to water, overwater, or don't know what's wrong when a plant looks sad.

Secondary: Plant enthusiasts who want to track growth and care history across a large collection.

**Persona — Roberto, 29, Amsterdam:**

-   Has ~10 plants at home, girlfriend bought most of them
-   Doesn't know species names or care schedules
-   Wants a quick daily answer: "do I need to do anything today?"
-   Uses his phone for everything, hates manual data entry

----------

## 3. Core Problem

Existing apps (PictureThis, Greg, Planta) give generic care advice based on species. They don't:

-   Learn how _your_ plant in _your_ environment actually behaves
-   Track the history of individual plants over time
-   Adapt recommendations based on past observations

----------

## 4. Tech Stack

Layer

Technology

Rationale

Mobile

React Native + Expo

Cross-platform, native camera access

Backend / DB

Supabase

Auth, PostgreSQL, Storage, Realtime — zero backend boilerplate

AI

Anthropic API (claude-sonnet-4) with vision

Plant ID, care advice, photo analysis

Weather

Open-Meteo API

Free, no API key, accurate

Build / Deploy

Expo EAS

Simple OTA updates and app store builds

Analytics

PostHog

Behavioral analytics, free tier

----------

## 5. Database Schema

```sql
-- Users handled by Supabase Auth

create table plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,                        -- user-given name e.g. "Giorgio"
  species text,                              -- identified by AI e.g. "Pothos (Epipremnum aureum)"
  location text,                             -- e.g. "Living room window"
  photo_url text,                            -- latest photo, stored in Supabase Storage
  watering_frequency_days integer,           -- AI-estimated base frequency
  last_watered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table plant_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references plants not null,
  user_id uuid references auth.users not null,
  event_type text not null,                  -- 'watered' | 'fertilized' | 'repotted' | 'photo' | 'observation'
  notes text,                                -- free text, AI-generated or user-written
  photo_url text,                            -- optional photo for this event
  ai_analysis text,                          -- AI response when photo was analyzed
  created_at timestamptz default now()
);

-- RLS: users can only see their own plants and events
alter table plants enable row level security;
alter table plant_events enable row level security;

create policy "users own their plants" on plants
  for all using (auth.uid() = user_id);

create policy "users own their events" on plant_events
  for all using (auth.uid() = user_id);

```

----------

## 6. Feature Scope — MVP

### 6.1 Add a Plant

-   User takes a photo or uploads from gallery
-   AI identifies species, common name, and basic care needs
-   User gives the plant a nickname and location
-   Plant card created with: species, nickname, location, photo, estimated watering frequency

### 6.2 Today Screen (Home)

-   List of plants that need attention today
-   For each plant: "Water today" / "OK for now" / "Check on it"
-   Logic: last watered date + estimated frequency + weather context (humidity, recent rain if outdoor)
-   One tap to log "watered" directly from this screen

### 6.3 Plant Profile

-   Photo, nickname, species, location
-   Timeline of events (watered, fertilized, observations, photos)
-   Care stats: average watering interval, last 30 days activity
-   "Log event" button: watered / fertilized / repotted / take photo

### 6.4 Photo Check-In

-   User takes a new photo of the plant
-   AI compares to previous photos and notes any changes (yellowing, new growth, drooping)
-   AI gives a brief status: "Looking healthy" / "Leaves look slightly yellow — may be overwatering" / "New leaf emerging!"
-   Analysis saved to plant history

### 6.5 Onboarding

-   Sign up / log in (Supabase Auth — email or Google)
-   "Add your first plant" flow immediately after signup
-   Permission request for camera and notifications

----------

## 7. Feature Scope — Post-MVP

The roadmap is ordered so that every feature compounds the personal model (Strategic Principle 2). Numbers reflect build order, not user-facing priority.

| # | Feature | What it is | Why it ships in this order |
|---|---------|------------|----------------------------|
| **N1** | **Push notifications (context-aware payloads)** | Daily/event-triggered reminders, body text drawn from the user's actual data ("Giorgio's usually thirsty by now and it's been a dry week") not species defaults | Table-stakes plumbing. Payload quality is where the differentiator shows up. |
| **N1.5** | **Weather logged on every `plant_event`** | `weather` JSONB column (temperature, humidity, precipitation) populated silently by `logEvent`/`logWatering` from existing `fetchWeather()` | **Critical prerequisite** for every feature below. Cannot be backfilled (Strategic Principle 1). Ship before anything else. ~1 hour of work. |
| **N2** | **AI Learning — per-plant watering frequency** | After N watering events, propose an updated frequency with evidence: *"14 waterings averaged 9.2 days, plant healthy throughout — update from 7 to 9?"* Confidence visibly tightens as data grows. Never silently change. | This is the core differentiator. Everything below reads from this model. Building anything AI-facing before this means building on species defaults — exactly what we are differentiating against. |
| **N3** | **Event-triggered Advisor** (replaces "Daily Advisor") | AI tip surfaces only when weather forecast + plant state actually intersect ("heatwave incoming, three plants will dry early"). Silent on uneventful days. | Honest AI is structural (Principle 3). Daily cadence forces padding; event cadence forces signal. Reads from N2's learned model. |
| **N4** | **Plant Journal View** | Monthly narrative (Claude-generated), photo gallery, milestone feed (auto-detected: anniversaries from `created_at`, opportunistic counters; vision-detected milestones later when baseline is stable) | Emotional retention engine (Principle 4). Auto-feeds from milestones produced by N1.5 weather logging, N2 frequency proposals, and photo check-ins. |
| **N5** | **Slow-drift detector** (replaces 1–10 health score) | Compares latest photo against a rolling 4–6 week baseline, surfaces direction + evidence ("gradual color shift over 6 weeks, here's the comparison"). No scalar score. | A 1–10 score is fake precision and violates Principle 3. Direction + evidence is honest and more useful. |
| Small wins | **Plant ID correction loop** | "This isn't right" affordance on plant profile that re-prompts identification or lets user override species | A wrong species at add-time poisons every downstream recommendation. Cheap to add, high leverage. |
| Small wins | **Care stats milestone cards** | "100 days with Giorgio. 14 waterings, 2 fertilizings, 1 scare survived." | Screenshot-worthy. All counters on existing data. <1 day. |
| Deferred | Seasonal adjustment | Automatic — N2 will pick this up from history once we have a full year of data. Not a separate feature. |
| Deferred | Community / social | Out of scope per AGENTS.md (no social features). |
| Deferred | Plant shop integration | Out of scope per AGENTS.md (no marketplace). |
| **Cut** | **Shared Plants** (was N6) | Multi-user ownership on a plant. Cut 2026-06-18 — keeping the app single-user. The personal-model differentiator stands on its own without multi-tenancy, and removing it simplifies the schema (no join table for plant ownership) and the auth model. Revisit only if usage data shows real demand. |

### 7.1 North Star — the Day 30 moment

Every roadmap item ladders up to a single user-facing moment that proves PlantDiary was learning all along.

**Trigger:** 30 days after a plant is added, given ≥4 watering events and ≥2 photos.

**Push notification:** *"Giorgio has something to tell you."*

**The card (full screen, calm voice):**

> *"I've been watching Giorgio for 30 days.*
> *Care guides said water every 7 days — you actually watered every 9.2 days, and he's thriving. Here's day 1 next to today.*
> *[first photo | latest photo — vision-noted new growth highlighted]*
> *His thirstiest stretch was the week of May 20 — the warmest, driest week of the month.*
> *[tiny weather sparkline from the logged `weather` column]*
> *I'd like to update his schedule to 9 days. Confidence: moderate — it'll sharpen over the next few weeks."*
>
> **[Update schedule] [Keep as is]**

**Why this is the north star:**

- It is the first time the app *proves* it was learning rather than claiming it.
- The user gave nothing but taps and photos and got back an observation about *their specific plant in their specific home* — something no species database can produce.
- It ends in a request for permission, not a silent change (Principle 3).
- Every piece of data powering it ships in N1.5 → N2. The moment is just their convergence, staged.

**Sequencing implication:** the Day 30 moment goes live ~30 days after N1.5 (weather column) ships. That makes N1.5 a calendar-gating decision, not a nice-to-have.

----------

## 8. AI Integration Details

### Plant Identification (on add)

```
System: You are a botanist assistant. Given a photo of a plant, identify the species,
provide the common name, and give practical care guidelines.

Respond in JSON:
{
  "species": "Epipremnum aureum",
  "common_name": "Pothos / Devil's Ivy",
  "confidence": "high",
  "watering_frequency_days": 7,
  "light": "indirect bright",
  "humidity": "moderate",
  "care_notes": "Very forgiving. Let soil dry out between waterings.
                  Yellowing leaves usually mean overwatering."
}

```

### Daily Care Recommendation

```
System: You are a plant care assistant. Given a plant's history and current weather,
tell the user whether to water today.

Context provided:
- Species and care profile
- Last 5 watering events with dates
- Current weather (temperature, humidity, recent precipitation)
- Time of year

Respond with: should_water (boolean), reason (1 sentence), urgency (low/medium/high)

```

### Photo Check-In Analysis

```
System: You are analyzing a plant's health over time.
Given the plant's history and a new photo, describe what you observe.

Context: plant species, previous AI analyses, last event dates.

Respond with: status (healthy/monitor/concern), observations (2-3 sentences),
recommended_action (optional, only if concern)

```

----------

## 9. UX Principles

-   **Zero friction for daily use** — logging a watering should take 1 tap from the home screen
-   **Proactive, not reactive** — the app tells you what to do, you don't have to ask
-   **Emotional connection** — plants have names, history, personalities. The app reinforces this.
-   **Honest AI** — if the AI is unsure, it says so. No fake confidence.

----------

## 10. MVP Milestones

Milestone

Deliverable

Est. Effort

M1 — Foundation

Supabase setup, auth, DB schema, Expo project scaffold

1 day

M2 — Add Plant

Camera → AI identification → plant card saved

2 days

M3 — Today Screen

Watering logic + weather integration + log event

2 days

M4 — Plant Profile

Timeline, events, photo history

1 day

M5 — Photo Check-In

AI photo analysis + history comparison

2 days

M6 — Polish

Onboarding flow, empty states, error handling

1 day

**Total MVP estimate: ~9 focused days**

----------

## 11. Claude Code Usage Tips

When working with Claude Code on this project:

1.  **Give this PRD as initial context** — paste it at the start of a new session
2.  **Work milestone by milestone** — don't ask for the full app at once
3.  **Always specify the file** — "in `screens/AddPlantScreen.tsx`, add..."
4.  **Review Supabase types** — generate TypeScript types from schema with `supabase gen types`
5.  **Test AI prompts separately** — iterate prompts in Claude.ai before hardcoding them

----------

## 12. Project Rules

Rules to follow to keep the project healthy and reach completion.

**Rule 1 — One session, one objective** Every time you open Claude Code, work on one thing only. Not "add the plant screen and fix login and integrate weather". One milestone at a time, one feature at a time. Scope creep is the fastest way to accumulate broken code you don't understand.

**Rule 2 — Never move forward if something is broken** If login doesn't work, don't start the camera. Technical debt on a mobile project accumulates fast and becomes hard to unwind. Test every feature on Expo Go before moving to the next one.

**Rule 3 — Only commit working code** Never `git commit` if the app doesn't start or a feature is half-built. A commit is a checkpoint — it must represent a stable state. Work on `dev`, merge to `main` only when the milestone is complete and tested.

**Rule 4 — Update CONTEXT.md every session** It's the project's memory. If you skip this two sessions in a row, Claude Code starts making inconsistent decisions and the code diverges. 5 minutes at the end of a session saves hours of debugging.

**Rule 5 — Understand before moving on** If Claude Code writes code you don't understand, ask it to explain immediately: _"Explain what this function does and why you implemented it this way."_ A project you don't understand is a project you can't debug.

**Rule 6 — Iterate AI prompts separately** The prompts for plant identification and photo analysis are the core of the app. Test them here on Claude.ai with real photos before putting them in the code. A mediocre prompt produces a mediocre app.

**Rule 7 — Complete milestones in order** M1 → M2 → M3. No skipping. Every milestone depends on the previous one. The temptation to jump to the "interesting" part (AI, photos) before having solid auth and DB leads to rewriting everything.

----------

## 13. Open Questions

-   Should the MVP support outdoor plants? (complicates weather logic significantly — defer to post-MVP)
-   Monetization: freemium (up to 3 plants free, unlimited paid) or subscription? Decide before launch.

----------

## 14. Git Workflow

### Initial Setup

```bash
cd plantdiary
git init
git add .
git commit -m "init: Expo project scaffold"
```

Create `.env` for credentials (never commit this):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=xxxx
ANTHROPIC_API_KEY=xxxx
```

### Branch Strategy

```
main          ← only working, tested code
dev           ← daily work
feature/xxx   ← only for large or risky changes
```

Work on `dev`. When a milestone is working and tested, merge to `main`.

### Commit Convention

```bash
git commit -m "init: project scaffold"
git commit -m "feat: add plant identification flow"
git commit -m "fix: supabase storage 403 on image upload"
git commit -m "chore: update CONTEXT.md after M2"
git commit -m "refactor: extract AI prompts to lib/ai.ts"
```

----------

_This document is a living PRD. Update it as decisions are made during development._
