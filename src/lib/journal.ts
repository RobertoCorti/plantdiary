import type {
  AIPhotoAnalysisResult,
  JournalStats,
  Milestone,
  Plant,
  PlantEvent,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

const ANNIVERSARIES: Array<{ days: number; label: string; fallback: string }> = [
  { days: 7, label: "1 week", fallback: "Off to a steady start." },
  {
    days: 30,
    label: "1 month",
    fallback: "First month logged. Each event is shaping the personal model.",
  },
  { days: 100, label: "100 days", fallback: "Three digits. Patterns are sharpening." },
  { days: 180, label: "6 months", fallback: "Half a year together." },
  {
    days: 365,
    label: "1 year",
    fallback: "A full year together. The data is starting to tell its own story.",
  },
];

const WATERING_MARKS = [10, 25, 50, 100, 200, 365];

function parseAnalysisStatus(
  raw: string | null
): AIPhotoAnalysisResult["status"] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed?.status === "healthy" ||
      parsed?.status === "monitor" ||
      parsed?.status === "concern"
    ) {
      return parsed.status;
    }
  } catch {
    // not JSON — ignore
  }
  return null;
}

function asc(events: PlantEvent[]): PlantEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// Median watering interval (in days) computed over all `watered` events up to
// and including `asOf`. Returns null when there aren't enough intervals (<3)
// to make the median meaningful.
function medianIntervalAt(events: PlantEvent[], asOf: number): number | null {
  const sorted = asc(
    events.filter(
      (e) =>
        e.event_type === "watered" && new Date(e.created_at).getTime() <= asOf
    )
  );
  if (sorted.length < 4) return null;
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(
      (new Date(sorted[i].created_at).getTime() -
        new Date(sorted[i - 1].created_at).getTime()) /
        DAY_MS
    );
  }
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2
    ? intervals[mid]
    : (intervals[mid - 1] + intervals[mid]) / 2;
}

export function computeJournalStats(
  plant: Plant,
  events: PlantEvent[]
): JournalStats {
  const daysWithPlant = Math.max(
    0,
    Math.floor((Date.now() - new Date(plant.created_at).getTime()) / DAY_MS)
  );

  let scaresSurvived = 0;
  let openScare = false;
  for (const e of asc(events)) {
    const status = parseAnalysisStatus(e.ai_analysis);
    if (status === "concern") openScare = true;
    else if (status === "healthy" && openScare) {
      scaresSurvived += 1;
      openScare = false;
    }
  }

  return {
    daysWithPlant,
    waterings: events.filter((e) => e.event_type === "watered").length,
    fertilizings: events.filter((e) => e.event_type === "fertilized").length,
    repottings: events.filter((e) => e.event_type === "repotted").length,
    photos: events.filter((e) => e.event_type === "photo").length,
    scaresSurvived,
  };
}

// Each milestone carries a one-sentence "why it matters" — either derived from
// the user's own data (median interval, current pace) or a category-specific
// note (what a first feeding means, why a baseline photo matters).
export function computeMilestones(
  plant: Plant,
  events: PlantEvent[]
): Milestone[] {
  const milestones: Milestone[] = [];
  const now = Date.now();
  const created = new Date(plant.created_at).getTime();

  for (const { days, label, fallback } of ANNIVERSARIES) {
    const when = created + days * DAY_MS;
    if (when <= now) {
      const median = medianIntervalAt(events, when);
      const detail =
        median !== null
          ? `Your average interval settled at ${median.toFixed(1)} days.`
          : fallback;
      milestones.push({
        id: `anniv-${days}`,
        kind: "anniversary",
        icon: "🎉",
        title: `${label} with ${plant.name}`,
        detail,
        date: new Date(when).toISOString(),
      });
    }
  }
  const ageYears = Math.floor((now - created) / (365 * DAY_MS));
  for (let y = 2; y <= ageYears; y++) {
    const when = created + y * 365 * DAY_MS;
    const wateringsByThen = events.filter(
      (e) =>
        e.event_type === "watered" &&
        new Date(e.created_at).getTime() <= when
    ).length;
    milestones.push({
      id: `anniv-year-${y}`,
      kind: "anniversary",
      icon: "🎉",
      title: `${y} years with ${plant.name}`,
      detail: `${wateringsByThen} waterings on the record.`,
      date: new Date(when).toISOString(),
    });
  }

  const ordered = asc(events);

  let wateringCount = 0;
  let openScare = false;
  let firstFertilizing = true;
  let firstRepot = true;
  let firstPhoto = true;

  for (const e of ordered) {
    if (e.event_type === "watered") {
      wateringCount += 1;
      if (WATERING_MARKS.includes(wateringCount)) {
        const eventTime = new Date(e.created_at).getTime();
        const median = medianIntervalAt(events, eventTime);
        const pace =
          median !== null
            ? `Your current pace: roughly every ${median.toFixed(1)} days.`
            : "Each one a quiet vote for routine.";
        milestones.push({
          id: `water-${wateringCount}`,
          kind: "watering",
          icon: "💧",
          title: `${wateringCount} waterings`,
          detail: pace,
          date: e.created_at,
        });
      }
    } else if (e.event_type === "fertilized" && firstFertilizing) {
      firstFertilizing = false;
      milestones.push({
        id: `first-fertilized-${e.id}`,
        kind: "feeding",
        icon: "🌿",
        title: "First feeding",
        detail:
          "Plants get hungry too — feeding replaces what watering washes through.",
        date: e.created_at,
      });
    } else if (e.event_type === "repotted" && firstRepot) {
      firstRepot = false;
      milestones.push({
        id: `first-repot-${e.id}`,
        kind: "repot",
        icon: "🪴",
        title: "First repot",
        detail: "Fresh soil and room for the roots to spread.",
        date: e.created_at,
      });
    } else if (e.event_type === "photo" && firstPhoto) {
      firstPhoto = false;
      milestones.push({
        id: `first-photo-${e.id}`,
        kind: "photo",
        icon: "📷",
        title: "First photo check-in",
        detail: "A baseline for future check-ins to compare against.",
        date: e.created_at,
      });
    } else if (e.event_type === "frequency_updated") {
      milestones.push({
        id: `freq-${e.id}`,
        kind: "schedule",
        icon: "📊",
        title: "Schedule learned",
        detail:
          e.notes ??
          "The personal model now knows this plant's rhythm better than the species default.",
        date: e.created_at,
      });
    }

    const status = parseAnalysisStatus(e.ai_analysis);
    if (status === "concern") openScare = true;
    else if (status === "healthy" && openScare) {
      openScare = false;
      milestones.push({
        id: `scare-${e.id}`,
        kind: "scare",
        icon: "🌱",
        title: "Survived a scare",
        detail: `${plant.name} looked concerning, then bounced back to healthy.`,
        date: e.created_at,
      });
    }
  }

  return milestones.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
