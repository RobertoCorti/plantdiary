export type Plant = {
  id: string;
  user_id: string;
  name: string;
  species: string | null;
  location: string | null;
  photo_url: string | null;
  watering_frequency_days: number | null;
  last_watered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlantEvent = {
  id: string;
  plant_id: string;
  user_id: string;
  event_type:
    | "watered"
    | "fertilized"
    | "repotted"
    | "photo"
    | "observation"
    | "frequency_updated";
  notes: string | null;
  photo_url: string | null;
  ai_analysis: string | null;
  weather: WeatherData | null;
  created_at: string;
};

export type FrequencyProposal = {
  proposed_days: number;
  current_days: number;
  median_days: number;
  count: number;
  confidence: "low" | "medium" | "high";
};

export type WateringStatus = "water_today" | "ok" | "check";

export type WeatherData = {
  temperature: number;
  humidity: number;
  precipitation: number;
};

export type AIIdentificationResult = {
  species: string;
  common_name: string;
  confidence: "high" | "medium" | "low";
  watering_frequency_days: number;
  light: string;
  humidity: string;
  care_notes: string;
};

export type AIPhotoAnalysisResult = {
  status: "healthy" | "monitor" | "concern";
  observations: string;
  recommended_action: string | null;
};

// N4 — Plant Journal. Auto-detected from existing plant_events; no AI, no DB.
export type MilestoneKind =
  | "anniversary"
  | "watering"
  | "feeding"
  | "repot"
  | "photo"
  | "schedule"
  | "scare";

export type Milestone = {
  id: string; // stable key for list rendering
  kind: MilestoneKind; // drives the colored-circle tint in the journal
  icon: string; // emoji glyph rendered inside the circle
  title: string;
  detail: string | null;
  date: string; // ISO timestamp of when the milestone occurred
};

export type JournalStats = {
  daysWithPlant: number;
  waterings: number;
  fertilizings: number;
  repottings: number;
  photos: number;
  scaresSurvived: number;
};
