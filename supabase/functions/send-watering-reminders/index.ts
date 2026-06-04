import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Watering status logic — mirrors src/lib/watering.ts getWateringStatus()
type WateringStatus = "water_today" | "check" | "ok";

interface Plant {
  id: string;
  name: string;
  watering_frequency_days: number | null;
  last_watered_at: string | null;
}

function getWateringStatus(plant: Plant): WateringStatus {
  if (!plant.watering_frequency_days) return "check";
  if (!plant.last_watered_at) return "water_today";

  const lastWatered = new Date(plant.last_watered_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWatering = new Date(lastWatered);
  nextWatering.setDate(nextWatering.getDate() + plant.watering_frequency_days);
  nextWatering.setHours(0, 0, 0, 0);

  const diffMs = nextWatering.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "water_today";
  if (diffDays === 1) return "check";
  return "ok";
}

Deno.serve(async (req) => {
  // This function is meant to be called by pg_cron or a scheduled job.
  // It uses the service_role key to bypass RLS.

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all profiles that have a push token
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, push_token")
      .not("push_token", "is", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No profiles with push tokens" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const pushMessages: Array<{
      to: string;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    }> = [];

    // For each user, fetch their plants and compute watering status
    for (const profile of profiles) {
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id, name, watering_frequency_days, last_watered_at")
        .eq("user_id", profile.id);

      if (plantsError || !plants || plants.length === 0) continue;

      const needsWater: string[] = [];
      const needsCheck: string[] = [];

      for (const plant of plants) {
        const status = getWateringStatus(plant);
        if (status === "water_today") needsWater.push(plant.name);
        else if (status === "check") needsCheck.push(plant.name);
      }

      // Only send a notification if there's something to report
      if (needsWater.length === 0 && needsCheck.length === 0) continue;

      // Build notification body
      const parts: string[] = [];
      if (needsWater.length > 0) {
        parts.push(
          needsWater.length === 1
            ? `${needsWater[0]} needs water today`
            : `${needsWater.length} plants need water today`
        );
      }
      if (needsCheck.length > 0) {
        parts.push(
          needsCheck.length === 1
            ? `Check on ${needsCheck[0]}`
            : `${needsCheck.length} plants to check on`
        );
      }

      pushMessages.push({
        to: profile.push_token,
        title: "PlantDiary",
        body: parts.join(" · "),
        data: { screen: "Home" },
      });
    }

    if (pushMessages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No plants need attention" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send via Expo Push API (supports batching up to 100 per request)
    const batchSize = 100;
    let totalSent = 0;

    for (let i = 0; i < pushMessages.length; i += batchSize) {
      const batch = pushMessages.slice(i, i + batchSize);
      const pushResp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!pushResp.ok) {
        const errText = await pushResp.text();
        console.error(`Expo Push API error: ${pushResp.status} ${errText}`);
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
    console.error("send-watering-reminders error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
