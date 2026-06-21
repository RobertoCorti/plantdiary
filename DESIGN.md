# Loam — PlantDiary Design System

> The rich soil a personal model grows from.

A restyle, not a rebrand. Same forest-green DNA, elevated into a calm botanical
palette, an editorial type voice, and an honest way of showing confidence —
numbers that tighten with data, never alarm-red urgency or fake precision.

## Design principles

1. **Calm, not alarmist.** A thirsty plant is terracotta, not emergency red. Status reads as a gentle nudge, never a fire alarm.
2. **Honest by structure.** Confidence is a monospaced number with a bar that visibly tightens — not a reassuring sentence or a colored label.
3. **Editorial & organic.** A literary serif for moments and names; a clean grotesk for the work. It should read like a field journal.

---

## 1. Color tokens

### Neutrals — warm paper & ink

| Token     | Hex       | Usage                          |
|-----------|-----------|--------------------------------|
| `paper`   | `#EFEDE4` | App background                 |
| `mist`    | `#FBFAF4` | Raised / inset surfaces        |
| `surface` | `#FFFFFF` | Cards                          |
| `line`    | `#E3E2D5` | Hairline borders               |
| `bark`    | `#5E5D50` | Secondary text                 |
| `ink`     | `#262720` | Primary text                   |

### Brand greens

| Token    | Hex       | Usage                          |
|----------|-----------|--------------------------------|
| `forest` | `#33442E` | Primary actions, brand anchor  |
| `fern`   | `#5A6E45` | Eyebrows, links, accents       |
| `sage`   | `#9DAE85` | Decorative fills, dividers     |
| `wash`   | `#EAEDE0` | Tinted / selected surfaces     |

### Status — off the traffic light

| Status       | Text      | Background | Dot       | Usage              |
|--------------|-----------|------------|-----------|--------------------|
| Water today  | `#9A5235` | `#F1E3D9`  | `#B5613E` | Needs water        |
| Check soon   | `#8A6A2D` | `#F0E8D4`  | `#C0913E` | Due soon           |
| Thriving     | `#46603A` | `#E6EBDA`  | `#5A6E45` | All good           |

### Special colors

| Token   | Hex       | Usage                              |
|---------|-----------|------------------------------------|
| `rain`  | `#4E6E76` | Water action button                |
| `slate` | `#516A72` | Medium confidence bar              |

### Confidence ramp

| Level    | Bar fill  | Label color | Range label |
|----------|-----------|-------------|-------------|
| Low      | `#C0913E` | `#8A6A2D`  | e.g. ±3.1d |
| Moderate | `#516A72` | `#516A72`  | e.g. ±1.4d |
| High     | `#46603A` | `#46603A`  | e.g. ±0.6d |

Bar track: `#DDE3CE`. Bar fills from left, width proportional to confidence.

---

## 2. Typography

Three font families. Install via Google Fonts (`expo-google-fonts` or `useFonts`).

| Token      | Family             | Size | Line | Weight | Usage                           |
|------------|--------------------|------|------|--------|---------------------------------|
| `display`  | Spectral           | 30   | 36   | 500    | Auth title, Day 30 moment       |
| `title`    | Spectral           | 24   | 30   | 600    | Plant name, screen title         |
| `heading`  | Hanken Grotesk     | 19   | 26   | 600    | Section titles                   |
| `subhead`  | Hanken Grotesk     | 16   | 22   | 600    | Card titles                      |
| `body`     | Hanken Grotesk     | 15   | 22   | 400    | Paragraphs                       |
| `small`    | Hanken Grotesk     | 13   | 18   | 400    | Species, meta                    |
| `label`    | Hanken Grotesk     | 11   | 14   | 700    | Eyebrows, badges (UPPERCASE, letterSpacing: 1.5) |
| `metric`   | IBM Plex Mono      | 22   | 26   | 500    | Stat values, intervals           |
| `metricSm` | IBM Plex Mono      | 13   | 16   | 500    | Inline numbers, confidence       |

### Font loading

```ts
// Use expo-font or @expo-google-fonts
import {
  Spectral_400Regular,
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_400Regular_Italic,
} from "@expo-google-fonts/spectral";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
```

---

## 3. Spacing & radius

### Spacing (4pt base)

| Token    | Value |
|----------|-------|
| `xs`     | 4     |
| `sm`     | 8     |
| `md`     | 12    |
| `base`   | 16    |
| `lg`     | 20    |
| `gutter` | 24    |
| `xl`     | 32    |
| `2xl`    | 40    |

Screen horizontal padding: `gutter` (24).

### Border radius

| Token  | Value |
|--------|-------|
| `sm`   | 8     |
| `md`   | 12    |
| `lg`   | 16    |
| `xl`   | 20    |
| `full` | 999   |

### Elevation

- **Flat (default):** `borderWidth: 1, borderColor: '#E3E2D5'` — the identity is border-defined.
- **Raised:** `shadowColor: '#26272014', shadowOffset: {width:0, height:4}, shadowRadius: 12, elevation: 4` — modals, active cards only.

---

## 4. Component patterns

### Status badge (pill)

```tsx
<View style={{
  flexDirection: 'row', alignItems: 'center', gap: 5,
  paddingHorizontal: 11, paddingVertical: 4,
  borderRadius: 999, backgroundColor: STATUS.bg,
}}>
  <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: STATUS.dot }} />
  <Text style={{ color: STATUS.text, fontSize: 11, fontWeight: '600' }}>
    {STATUS.label}
  </Text>
</View>
```

### Card

```tsx
<View style={{
  backgroundColor: '#FFFFFF',
  borderWidth: 1, borderColor: '#E3E2D5',
  borderRadius: 16, padding: 14,
}}>
```

### Button — primary (Forest)

```tsx
<Pressable style={{
  backgroundColor: '#33442E', borderRadius: 12,
  paddingVertical: 14, paddingHorizontal: 24,
  alignItems: 'center',
}}>
  <Text style={{ color: '#fff', fontSize: 15, fontFamily: 'HankenGrotesk_600SemiBold' }}>
    Label
  </Text>
</Pressable>
```

### Button — secondary (outline)

```tsx
<Pressable style={{
  backgroundColor: '#fff', borderRadius: 12,
  borderWidth: 1, borderColor: '#CFD8BC',
  paddingVertical: 14, paddingHorizontal: 24,
  alignItems: 'center',
}}>
  <Text style={{ color: '#33442E', fontSize: 15, fontFamily: 'HankenGrotesk_600SemiBold' }}>
    Label
  </Text>
</Pressable>
```

### Button — water action (Rain)

```tsx
<Pressable style={{
  backgroundColor: '#4E6E76', borderRadius: 12,
  paddingVertical: 10, paddingHorizontal: 16,
}}>
  <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'HankenGrotesk_600SemiBold' }}>
    Water
  </Text>
</Pressable>
```

### Confidence bar

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
  <Text style={{ fontSize: 12, color: '#5A6E45', fontFamily: 'HankenGrotesk_600SemiBold' }}>
    Confidence
  </Text>
  <View style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: '#DDE3CE' }}>
    <View style={{
      width: `${fillPercent}%`, height: '100%',
      backgroundColor: CONFIDENCE_BAR_COLOR, borderRadius: 999,
    }} />
  </View>
  <Text style={{ fontFamily: 'IBMPlexMono_500Medium', fontSize: 11, color: CONFIDENCE_LABEL_COLOR }}>
    {confidenceLabel} · ±{errorRange}d
  </Text>
</View>
```

### Eyebrow label

```tsx
<Text style={{
  fontSize: 11, fontFamily: 'HankenGrotesk_700Bold',
  letterSpacing: 1.5, textTransform: 'uppercase',
  color: '#5A6E45',
}}>
  SECTION TITLE
</Text>
```

### Event icon (replaces emoji)

Use a `View` circle with an SVG icon inside instead of emoji:

```tsx
<View style={{
  width: 36, height: 36, borderRadius: 999,
  backgroundColor: EVENT_BG_COLOR,
  alignItems: 'center', justifyContent: 'center',
}}>
  {/* SVG icon here — use react-native-svg */}
</View>
```

Event background colors:
- Watered: `#E0EAF0` (rain tint)
- Fertilized: `#F0E8D4` (honey tint)
- Photo: `#EAEDE0` (sage tint)
- Observation: `#EAEDE0`
- Repotted: `#F1E3D9` (clay tint)
- Schedule updated: `#F1F3E8` (wash)

---

## 5. Screen-by-screen changes

### 5.1 HomeScreen (Today)

**Layout changes:**
- Replace flat plant list with two sections: **"Needs attention"** (water_today + check) and **"All good"** (ok)
- Attention cards: full-size, left border accent (3px, status dot color), Water button visible
- Thriving cards: compact (44px photo, no action button, `mist` background instead of `surface`)
- Add an **at-a-glance summary strip** below weather: three status pills showing counts ("2 to water · 1 to check · 2 thriving")

**Weather widget → care bridge:**
- Replace the raw-numbers box with a contextual sentence + inline data:
  ```
  "Warm and dry today — your thirstier plants will feel it."
  24° temp   42% humidity   0 rain mm
  ```
- The sentence is generated from simple thresholds (temp > 28 = "hot", humidity < 40 = "dry", precipitation > 5 = "rainy"). Not AI — just template strings.

**Color/type changes:**
- Container: `paper` (#EFEDE4) replaces #f8faf5
- "Today" title: Spectral 500 30px, `ink` color
- Date subtitle: Hanken 14px, `bark` color (#908E7E)
- Card names: Spectral 18px (was system 18px 600)
- All buttons: forest/rain palette (see §4)
- Status badges: pill-shaped with dot (see §4), replaces rectangle badges
- Log out text: `bark` color (#908E7E), not red

**New features:**
- **Batch water:** When 2+ plants need watering, show "Water all (N)" at the "Needs attention" section header. Calls existing `logWatering()` in a loop.

### 5.2 PlantProfileScreen

**Layout changes:**
- Add **"First vs. Now" photo strip** below plant info: two side-by-side thumbnails with "Day 1" / "Day N" labels. Source: first and latest `photo` events.
- Add **"Days together"** as a third stat card (computed from `plant.created_at`)
- Add **30-day care rhythm dots**: a row of 30 dots (one per day), color-coded by event type. Not a streak/score — just an honest view of cadence. Colors: watered = `forest`, photo = `rain`, other = `sage`, empty = `line`.
- **Group timeline by week**: "This week" / "Last week" / "2 weeks ago" / etc. Date grouping on the existing events array.
- **Proposal card copy change**: Contrast species default vs. user's actual data. "Care guides say 7; you've found your own rhythm at 9.2 days."
- **Replace emoji event icons** with SVG icons in colored circles (see §4 Event icon).

**Color/type changes:**
- Container: `paper`
- Plant name: Spectral 600 26px, `ink`
- Species: Hanken 15px, `bark`
- Location: Hanken 13px, `#908E7E`
- Stat values: IBM Plex Mono 500 24px, `ink`
- Section titles: eyebrow label style (§4)
- Timeline event type: Hanken 600 15px, `ink`
- Timeline time: IBM Plex Mono 11px, `#908E7E`
- Proposal card: `#F1F3E8` bg, `#CFD8BC` border, confidence bar (not badge)
- Bottom buttons: primary (forest) + secondary (outline) at radius 14
- Analysis status badges: same pill pattern as main status, using the analysis status colors

**Confidence rendering:**
Replace the colored confidence BADGE with the confidence BAR pattern (§4). The bar visually tightens with data:
- Low (4 waterings): 28% fill, honey color, "±3.1d"
- Moderate (14 waterings): 62% fill, slate color, "±1.4d"  
- High (30+ waterings): 92% fill, fern color, "±0.6d"

### 5.3 PlantJournalScreen

**Layout changes:**
- Stats card → **horizontal segmented row** (same pattern as weather widget): 4 stats inline with dividers, not centered in boxes.
- Photo gallery → **horizontal scroll strip with date labels** on each thumbnail (overlay badge: "May 7", "Jun 13"). Replaces the 3-column grid.
- **Monthly narrative card** (NEW — N4): Claude-generated monthly summary at the top of the journal. Calm, observational voice. Cache monthly. Sources: event counts, watering intervals, AI photo analyses, weather data.
  - Call the `generate-journal` edge function on journal open.
  - Show loading state while generating, cache result in plant_events as a `journal_narrative` event type (or a separate table).
- **Milestones with context**: Each milestone gets a one-sentence explanation of why it matters. "30 days: your average interval settled at 9.2 days." Enrich in `computeMilestones()`.
- **Replace emoji milestone icons** with SVG icons in colored circles.

**Color/type changes:**
- Container: `paper`
- Plant name: Spectral 600 26px, `ink`
- Tenure line: IBM Plex Mono 12px, `#908E7E` — "45 days together · since May 7, 2026"
- Stats: IBM Plex Mono 500 22px in `mist` row
- Section titles: eyebrow label style
- Milestone titles: Hanken 700 15px, `ink`
- Milestone detail: Hanken 400 13px, `bark`, line-height 18
- Milestone date: IBM Plex Mono 11px, `#908E7E`
- Narrative card: `surface` bg, `line` border, Spectral italic 16px body

### 5.4 AuthScreen

- Container: `paper`
- Title: Spectral 500 display (30px), `ink`
- Subtitle: Hanken 16px, `bark`
- Input: `surface` bg, `line` border, radius `md` (12)
- Button: forest primary (§4)
- Toggle text: Hanken 14px, `fern`

### 5.5 AddPlantScreen

- Same color/type migration as above.
- Camera/gallery buttons: forest primary + secondary outline
- AI identification result card: `mist` bg, `line` border, species in Spectral title style
- Confidence of AI identification: rendered as bar (same pattern as frequency proposal), not a text label

---

## 6. Migration checklist

### New dependencies
```bash
npx expo install \
  @expo-google-fonts/spectral \
  @expo-google-fonts/hanken-grotesk \
  @expo-google-fonts/ibm-plex-mono \
  expo-font \
  react-native-svg
```

### Files to create
- `src/lib/theme.ts` — all color/spacing/radius/typography tokens as exported constants
- `src/components/StatusBadge.tsx` — reusable status pill
- `src/components/ConfidenceBar.tsx` — reusable confidence bar + label
- `src/components/EventIcon.tsx` — SVG icon circle replacing emoji
- `src/components/EyebrowLabel.tsx` — section eyebrow text

### Files to modify
1. `App.tsx` — load fonts with `useFonts`, show splash until loaded
2. `src/screens/HomeScreen.tsx` — full restyle per §5.1
3. `src/screens/PlantProfileScreen.tsx` — full restyle per §5.2
4. `src/screens/PlantJournalScreen.tsx` — full restyle per §5.3
5. `src/screens/AuthScreen.tsx` — color/type migration per §5.4
6. `src/screens/AddPlantScreen.tsx` — color/type migration per §5.5
7. `src/lib/journal.ts` — enrich `computeMilestones()` with context sentences
8. `src/lib/watering.ts` — add weather-to-care bridge sentence generator

### Migration order
1. Create `theme.ts` + shared components (StatusBadge, ConfidenceBar, EventIcon, EyebrowLabel)
2. Add font loading to `App.tsx`
3. Migrate AuthScreen (simplest — validates fonts work)
4. Migrate HomeScreen (most visible — validates full token set)
5. Migrate PlantProfileScreen (most complex — validates all components)
6. Migrate AddPlantScreen
7. Migrate PlantJournalScreen (depends on enriched milestones)
8. Test every screen on Expo Go before committing

---

## 7. What this is NOT

- Not a different product. Same screens, same data, same features.
- Not a CSS framework. Tokens are React Native `StyleSheet` values.
- No new database tables or migrations (except optionally for journal narrative caching).
- No new navigation routes.
- Emoji → SVG icons is cosmetic. If `react-native-svg` causes issues, keep emoji — the colors and layout matter more.
