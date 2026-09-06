import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plant, PlantEvent } from "../types";
import { log } from "./logger";
import { getHomeCoords } from "./location";
import { fetchWeather } from "./weather";

type NewPlant = Pick<Plant, "user_id" | "name"> & Partial<Pick<Plant,
  "species" | "location" | "photo_url" | "watering_frequency_days"
>>;

export async function createPlant(supabase: SupabaseClient, input: NewPlant): Promise<Plant> {
  if (!input.name.trim()) throw new Error("Give your plant a name.");
  const { data, error } = await supabase.from("plants").insert({
    user_id: input.user_id,
    name: input.name.trim(),
    species: input.species?.trim() || null,
    location: input.location?.trim() || null,
    photo_url: input.photo_url || null,
    watering_frequency_days: input.watering_frequency_days ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as Plant;
}

/** The plant ID also identifies its first photo event, making event retries safe. */
export async function saveInitialPlantPhoto(
  supabase: SupabaseClient, plant: Plant, aiAnalysis: string | null
): Promise<void> {
  if (!plant.photo_url) return;
  let weather = null;
  try {
    const coords = await getHomeCoords(supabase, plant.user_id);
    if (coords) weather = await fetchWeather(coords.lat, coords.lon);
  } catch (error) {
    log.warn("weather", "Initial photo weather unavailable", error);
  }
  const { error } = await supabase.from("plant_events").upsert({
    id: plant.id,
    plant_id: plant.id,
    user_id: plant.user_id,
    event_type: "photo",
    photo_url: plant.photo_url,
    ai_analysis: aiAnalysis,
    weather,
    created_at: plant.created_at,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

const PHOTO_PATH_MARKER = "/object/public/plant-photos/";

export function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf(PHOTO_PATH_MARKER);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + PHOTO_PATH_MARKER.length).split("?")[0]);
  return path.length > 0 ? path : null;
}

export async function deletePlant(
  supabase: SupabaseClient,
  plant: Plant,
  events: PlantEvent[]
): Promise<void> {
  const photoPaths = [
    storagePathFromPublicUrl(plant.photo_url),
    ...events.map((e) => storagePathFromPublicUrl(e.photo_url)),
  ].filter((p): p is string => p !== null);
  const uniquePaths = [...new Set(photoPaths)];

  // plant_events has no ON DELETE CASCADE in the original schema, so
  // events must go first. journal_entries already cascade from plants.
  const { error: eventsError } = await supabase
    .from("plant_events")
    .delete()
    .eq("plant_id", plant.id);
  if (eventsError) throw eventsError;

  const { error: plantError } = await supabase
    .from("plants")
    .delete()
    .eq("id", plant.id);
  if (plantError) throw plantError;

  if (uniquePaths.length === 0) return;

  const { error: storageError } = await supabase.storage
    .from("plant-photos")
    .remove(uniquePaths);
  if (storageError) {
    log.warn(
      "events",
      "Photo cleanup failed after plant delete",
      storageError.message
    );
  }
}
