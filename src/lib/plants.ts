import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plant, PlantEvent } from "../types";
import { log } from "./logger";

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
