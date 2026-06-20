import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// N3 — Event-triggered Advisor (v1: heatwave trigger only).
//
// Fires only when forecast + plant state actually intersect. Silent on
// uneventful days (PRD §7 structural-honesty contract). Reads each plant's
// learned `watering_frequency_days` (N2), not species defaults.
//
// Trigger: a heatwave is incoming AND at least one plant is due to dry within
// the forecast window. "Heatwave" = max daily high over the next FORECAST_WINDOW
// days exceeds the recent rolling average high by HEATWAVE_DELTA_C or more.

const FORECAST_WINDOW_DAYS = 3; // how far ahead we look / "due to dry" horizon
const PAST_DAYS = 7; // rolling baseline for "recent average high"
const HEATWAVE_DELTA_C = 5; // °C above recent average that counts as a heatwave

interface Plant {
  id: string;
  name: string;
  watering_frequency_days: number | null;
  last_watered_at: string | null;
}

// Days until this plant is next due for water. null when we can't reason
// (no learned frequency or never watered — the watering reminder covers those).
function daysUntilWatering(plant: Plant): number | null {
  if (!plant.watering_frequency_days || !plant.last_watered_at) return null;

  const next = new Date(plant.last_watered_at);
  next.setDate(next.getDate() + plant.watering_frequency_days);
  next.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

interface Forecast {
  recentAvgHigh: number;
  upcomingMaxHigh: number;
}

// Open-Meteo daily max temps: PAST_DAYS of history + today + forecast window.
// The response array is chronological with exactly PAST_DAYS leading entries,
// so index PAST_DAYS is today and the entries after it are the forecast.
async function fetchForecast(lat: number, lon: number): Promise<Forecast | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max&past_days=${PAST_DAYS}` +
    `&forecast_days=${FORECAST_WINDOW_DAYS + 1}&timezone=auto`;

  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`Open-Meteo error: ${resp.status}`);
    return null;
  }

  const json = await resp.json();
  const highs: number[] = json?.daily?.temperature_2m_max ?? [];
  const past = highs.slice(0, PAST_DAYS).filter((n) => typeof n === "number");
  // Skip today (index PAST_DAYS); look only at the next FORECAST_WINDOW_DAYS.
  const upcoming = highs
    .slice(PAST_DAYS + 1, PAST_DAYS + 1 + FORECAST_WINDOW_DAYS)
    .filter((n) => typeof n === "number");

  if (past.length === 0 || upcoming.length === 0) return null;

  return {
    recentAvgHigh: past.reduce((a, b) => a + b, 0) / past.length,
    upcomingMaxHigh: Math.max(...upcoming),
  };
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only users who have both a push token and known coordinates can get a tip.
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, push_token, latitude, longitude")
      .not("push_token", "is", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No eligible profiles" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const pushMessages: Array<{
      to: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    }> = [];

    for (const profile of profiles) {
      const forecast = await fetchForecast(profile.latitude, profile.longitude);
      if (!forecast) continue;

      const delta = forecast.upcomingMaxHigh - forecast.recentAvgHigh;
      // No heatwave → no tip. This is where most uneventful days exit silently.
      if (delta < HEATWAVE_DELTA_C) continue;

      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id, name, watering_frequency_days, last_watered_at")
        .eq("user_id", profile.id);

      if (plantsError || !plants || plants.length === 0) continue;

      // Plants whose next watering falls inside the forecast window (or already
      // overdue) will feel the heat first.
      const atRisk: string[] = [];
      for (const plant of plants) {
        const days = daysUntilWatering(plant);
        if (days !== null && days <= FORECAST_WINDOW_DAYS) atRisk.push(plant.name);
      }

      if (atRisk.length === 0) continue; // heatwave, but nothing thirsty — stay silent

      const peak = Math.round(forecast.upcomingMaxHigh);
      const above = Math.round(delta);
      const subject =
        atRisk.length === 1 ? `${atRisk[0]} will` : `${joinNames(atRisk)} will`;

      pushMessages.push({
        to: profile.push_token,
        title: "🔥 Heatwave incoming",
        body:
          `Up to ${peak}°C over the next ${FORECAST_WINDOW_DAYS} days ` +
          `(${above}° above usual). ${subject} dry out faster than normal — ` +
          `check on ${atRisk.length === 1 ? "it" : "them"} soon.`,
        data: { screen: "Home" },
      });
    }

    if (pushMessages.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No advisor tips today" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const batchSize = 100;
    let totalSent = 0;
    for (let i = 0; i < pushMessages.length; i += batchSize) {
      const batch = pushMessages.slice(i, i + batchSize);
      const pushResp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (!pushResp.ok) {
        console.error(`Expo Push API error: ${pushResp.status} ${await pushResp.text()}`);
      } else {
        totalSent += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, total_users: profiles.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-advisor-tips error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
