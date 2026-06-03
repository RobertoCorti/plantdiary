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
-   Support shared care between people living together

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

These are validated ideas for future iterations, not MVP scope.

Feature

Description

Priority

Push notifications

Daily reminder for plants that need water

High

Shared plants

Multiple users can co-manage a plant (couples, flatmates)

High

AI learning

Adjust watering frequency based on history ("your Pothos actually needs 9 days, not 7")

High

Plant health score

Visual score 1–10 based on recent photo analysis

Medium

Seasonal adjustment

Automatically reduce watering in winter

Medium

Community / social

Share plant milestones, compare collections

Low

Plant shop integration

"Your Monstera is root-bound — here's where to buy a bigger pot"

Low

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
-   Plant sharing: requires multi-tenancy on plant ownership — defer to post-MVP but design schema to support it

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
