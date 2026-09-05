import type { SupabaseClient } from "@supabase/supabase-js";
import * as Location from "expo-location";
import { log } from "./logger";

export type Coords = { lat: number; lon: number };

export async function getCurrentCoordsOrNull(): Promise<Coords | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== "granted") {
        log.warn("weather", "Location permission not granted; weather will be NULL");
        return null;
      }
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch (err) {
    log.warn("weather", "Failed to get coords", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getHomeCoords(
  supabase: SupabaseClient,
  userId: string
): Promise<Coords | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("latitude, longitude")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    log.warn("weather", "Failed to read home coords", error.message);
    return null;
  }
  if (data?.latitude == null || data?.longitude == null) return null;
  return { lat: data.latitude, lon: data.longitude };
}

export async function saveHomeCoords(
  supabase: SupabaseClient,
  userId: string,
  coords: Coords
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    latitude: coords.lat,
    longitude: coords.lon,
    coords_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Stored home pin, or first GPS write if none exists yet. Never overwrites. */
export async function resolveHomeCoords(
  supabase: SupabaseClient,
  userId: string
): Promise<Coords | null> {
  const stored = await getHomeCoords(supabase, userId);
  if (stored) return stored;

  const current = await getCurrentCoordsOrNull();
  if (!current) return null;

  try {
    await saveHomeCoords(supabase, userId, current);
  } catch (err) {
    log.warn(
      "weather",
      "Failed to persist home coords",
      err instanceof Error ? err.message : err
    );
  }
  return current;
}
