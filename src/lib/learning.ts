import type { SupabaseClient } from "@supabase/supabase-js";
import type { FrequencyProposal, Plant } from "../types";
import { log } from "./logger";

const MIN_WATERINGS = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function confidenceFor(count: number): FrequencyProposal["confidence"] {
  if (count >= 10) return "high";
  if (count >= MIN_WATERINGS) return "medium";
  return "low";
}

export async function proposeFrequency(
  supabase: SupabaseClient,
  plant: Plant
): Promise<FrequencyProposal | null> {
  if (plant.watering_frequency_days === null) return null;

  const { data, error } = await supabase
    .from("plant_events")
    .select("created_at")
    .eq("plant_id", plant.id)
    .eq("event_type", "watered")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const timestamps = (data ?? []).map((row) =>
    new Date(row.created_at as string).getTime()
  );
  if (timestamps.length < MIN_WATERINGS) return null;

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push((timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60 * 24));
  }

  const medianDays = median(intervals);
  const proposedDays = Math.round(medianDays);
  const currentDays = plant.watering_frequency_days;

  if (proposedDays === currentDays) return null;

  const proposal: FrequencyProposal = {
    proposed_days: proposedDays,
    current_days: currentDays,
    median_days: medianDays,
    count: timestamps.length,
    confidence: confidenceFor(timestamps.length),
  };
  log.info("learning", "Frequency proposal", { plantId: plant.id, ...proposal });
  return proposal;
}
