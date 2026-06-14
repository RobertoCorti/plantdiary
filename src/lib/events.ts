import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantEvent, WeatherData } from "../types";
import { fetchWeather } from "./weather";
import { getCurrentCoordsOrNull } from "./location";
import { log } from "./logger";

async function captureWeather(): Promise<WeatherData | null> {
  const coords = await getCurrentCoordsOrNull();
  if (!coords) return null;
  try {
    const w = await fetchWeather(coords.lat, coords.lon);
    log.info("weather", "Captured for event", w);
    return w;
  } catch (err) {
    log.warn("weather", "fetchWeather failed; storing NULL", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function logWatering(
  supabase: SupabaseClient,
  plantId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  const weather = await captureWeather();

  const { error: eventError } = await supabase.from("plant_events").insert({
    plant_id: plantId,
    user_id: userId,
    event_type: "watered",
    weather,
    created_at: now,
  });

  if (eventError) throw eventError;

  const { error: updateError } = await supabase
    .from("plants")
    .update({ last_watered_at: now, updated_at: now })
    .eq("id", plantId);

  if (updateError) throw updateError;
}

export async function logEvent(
  supabase: SupabaseClient,
  plantId: string,
  userId: string,
  eventType: PlantEvent["event_type"],
  notes?: string,
  photoUrl?: string,
  aiAnalysis?: string
): Promise<void> {
  const now = new Date().toISOString();
  const weather = await captureWeather();

  const { error: eventError } = await supabase.from("plant_events").insert({
    plant_id: plantId,
    user_id: userId,
    event_type: eventType,
    notes: notes || null,
    photo_url: photoUrl || null,
    ai_analysis: aiAnalysis || null,
    weather,
    created_at: now,
  });

  if (eventError) throw eventError;

  if (eventType === "watered") {
    const { error: updateError } = await supabase
      .from("plants")
      .update({ last_watered_at: now, updated_at: now })
      .eq("id", plantId);

    if (updateError) throw updateError;
  }
}

export async function fetchPlantEvents(
  supabase: SupabaseClient,
  plantId: string
): Promise<PlantEvent[]> {
  const { data, error } = await supabase
    .from("plant_events")
    .select("*")
    .eq("plant_id", plantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlantEvent[];
}
