import type { SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import type { FrequencyProposal, PlantEvent, WeatherData } from "../types";
import { fetchWeather } from "./weather";
import { getHomeCoords } from "./location";
import { log } from "./logger";

async function captureWeather(
  supabase: SupabaseClient,
  userId: string
): Promise<WeatherData | null> {
  try {
    const coords = await getHomeCoords(supabase, userId);
    if (!coords) return null;
    const w = await fetchWeather(coords.lat, coords.lon);
    log.info("weather", "Captured for event", w);
    return w;
  } catch (err) {
    log.warn("weather", "fetchWeather failed; storing NULL", err instanceof Error ? err.message : err);
    return null;
  }
}

type PendingWatering = {
  id: string;
  wateredAt: string;
  weather: WeatherData | null;
  notes: string | null;
};

export type WateringSaveResult = {
  lastWateredAt: string;
  wateredAt: string;
  wasRetry: boolean;
};

const wateringInFlight = new Map<string, {
  notes: string | null;
  request: Promise<WateringSaveResult>;
}>();

const PENDING_NOTES_MESSAGE =
  "An earlier watering is awaiting confirmation. Retry it from Today before adding different notes.";

/** A pending action survives screen changes and restarts until confirmed. */
async function saveWatering(
  supabase: SupabaseClient,
  plantId: string,
  userId: string,
  notes?: string
): Promise<WateringSaveResult> {
  const key = `plantdiary.watering.${userId}.${plantId}`;
  const saved = Platform.OS === "web"
    ? localStorage.getItem(key)
    : await SecureStore.getItemAsync(key);
  let pending: PendingWatering;
  if (saved) {
    pending = JSON.parse(saved);
    if (!pending || typeof pending.id !== "string" ||
      !Number.isFinite(Date.parse(pending.wateredAt)) ||
      (pending.notes !== null && typeof pending.notes !== "string") ||
      !("weather" in pending)) {
      throw new Error("Could not read the pending watering. Please try again.");
    }
    if (notes?.trim() && notes.trim() !== pending.notes) {
      throw new Error(PENDING_NOTES_MESSAGE);
    }
  } else {
    pending = {
      id: randomUUID(),
      wateredAt: new Date().toISOString(),
      weather: await captureWeather(supabase, userId),
      notes: notes?.trim() || null,
    };
    // Do not send anything until the retry ID and original context are durable.
    const value = JSON.stringify(pending);
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  }

  const { data, error } = await supabase.rpc("record_watering", {
    p_event_id: pending.id,
    p_plant_id: plantId,
    p_watered_at: pending.wateredAt,
    p_weather: pending.weather,
    p_notes: pending.notes,
  });
  if (error) throw error;
  if (typeof data !== "string" || !Number.isFinite(Date.parse(data))) {
    throw new Error("Could not confirm watering. Please try again.");
  }

  if (Platform.OS === "web") localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
  return { lastWateredAt: data, wateredAt: pending.wateredAt, wasRetry: saved !== null };
}

export function logWatering(
  supabase: SupabaseClient,
  plantId: string,
  userId: string,
  notes?: string
): Promise<WateringSaveResult> {
  const key = `${userId}.${plantId}`;
  const inFlight = wateringInFlight.get(key);
  if (inFlight) {
    if (notes?.trim() && notes.trim() !== inFlight.notes) {
      return Promise.reject(new Error(PENDING_NOTES_MESSAGE));
    }
    return inFlight.request;
  }
  const request = saveWatering(supabase, plantId, userId, notes).finally(() => {
    wateringInFlight.delete(key);
  });
  wateringInFlight.set(key, { notes: notes?.trim() || null, request });
  return request;
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
  if (eventType === "watered") {
    await logWatering(supabase, plantId, userId, notes);
    return;
  }
  const now = new Date().toISOString();
  const weather = await captureWeather(supabase, userId);

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
}

export async function acceptFrequencyProposal(
  supabase: SupabaseClient,
  plantId: string,
  userId: string,
  proposal: FrequencyProposal
): Promise<void> {
  const now = new Date().toISOString();
  const weather = await captureWeather(supabase, userId);

  const notes = `Schedule updated ${proposal.current_days} → ${proposal.proposed_days} days (median ${proposal.median_days.toFixed(1)}d over ${proposal.count} waterings, confidence ${proposal.confidence}).`;

  const { error: eventError } = await supabase.from("plant_events").insert({
    plant_id: plantId,
    user_id: userId,
    event_type: "frequency_updated",
    notes,
    weather,
    created_at: now,
  });

  if (eventError) throw eventError;

  const { error: updateError } = await supabase
    .from("plants")
    .update({ watering_frequency_days: proposal.proposed_days, updated_at: now })
    .eq("id", plantId);

  if (updateError) throw updateError;
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
