import type {
  AIPhotoAnalysisResult,
  JournalStats,
  Milestone,
  Plant,
  PlantEvent,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Named day-based anniversaries. Yearly marks beyond the first are generated
// separately so a long-lived plant keeps accruing "N years" milestones.
const ANNIVERSARIES: Array<{ days: number; label: string }> = [
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
  { days: 100, label: "100 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

// Round-number watering counts worth celebrating.
const WATERING_MARKS = [10, 25, 50, 100, 200, 365];

function parseAnalysisStatus(
  raw: string | null
): AIPhotoAnalysisResult["status"] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.status === "healthy" || parsed?.status === "monitor" || parsed?.status === "concern") {
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

// Builds the milestone feed entirely from existing data, newest first.
export function computeMilestones(
  plant: Plant,
  events: PlantEvent[]
): Milestone[] {
  const milestones: Milestone[] = [];
  const now = Date.now();
  const created = new Date(plant.created_at).getTime();

  // Anniversaries — only those already reached.
  for (const { days, label } of ANNIVERSARIES) {
    const when = created + days * DAY_MS;
    if (when <= now) {
      milestones.push({
        id: `anniv-${days}`,
        icon: "🎉",
        title: `${label} with ${plant.name}`,
        detail: null,
        date: new Date(when).toISOString(),
      });
    }
  }
  // Yearly marks beyond the first year.
  const ageYears = Math.floor((now - created) / (365 * DAY_MS));
  for (let y = 2; y <= ageYears; y++) {
    const when = created + y * 365 * DAY_MS;
    milestones.push({
      id: `anniv-year-${y}`,
      icon: "🎉",
      title: `${y} years with ${plant.name}`,
      detail: null,
      date: new Date(when).toISOString(),
    });
  }

  const ordered = asc(events);

  // Watering count marks — dated at the event that crossed each threshold.
  let wateringCount = 0;
  let openScare = false;
  let firstFertilizing = true;
  let firstRepot = true;
  let firstPhoto = true;

  for (const e of ordered) {
    if (e.event_type === "watered") {
      wateringCount += 1;
      if (WATERING_MARKS.includes(wateringCount)) {
        milestones.push({
          id: `water-${wateringCount}`,
          icon: "💧",
          title: `${wateringCount} waterings`,
          detail: `You've watered ${plant.name} ${wateringCount} times.`,
          date: e.created_at,
        });
      }
    } else if (e.event_type === "fertilized" && firstFertilizing) {
      firstFertilizing = false;
      milestones.push({
        id: `first-fertilized-${e.id}`,
        icon: "🧪",
        title: "First feeding",
        detail: null,
        date: e.created_at,
      });
    } else if (e.event_type === "repotted" && firstRepot) {
      firstRepot = false;
      milestones.push({
        id: `first-repot-${e.id}`,
        icon: "🪴",
        title: "First repot",
        detail: null,
        date: e.created_at,
      });
    } else if (e.event_type === "photo" && firstPhoto) {
      firstPhoto = false;
      milestones.push({
        id: `first-photo-${e.id}`,
        icon: "📷",
        title: "First photo check-in",
        detail: null,
        date: e.created_at,
      });
    } else if (e.event_type === "frequency_updated") {
      milestones.push({
        id: `freq-${e.id}`,
        icon: "📊",
        title: "Schedule learned",
        detail: e.notes,
        date: e.created_at,
      });
    }

    // Scare survived — a concern check-in later followed by a healthy one.
    const status = parseAnalysisStatus(e.ai_analysis);
    if (status === "concern") openScare = true;
    else if (status === "healthy" && openScare) {
      openScare = false;
      milestones.push({
        id: `scare-${e.id}`,
        icon: "🌱",
        title: "Survived a scare",
        detail: `${plant.name} looked concerning, then bounced back to healthy.`,
        date: e.created_at,
      });
    }
  }

  // Newest first.
  return milestones.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
