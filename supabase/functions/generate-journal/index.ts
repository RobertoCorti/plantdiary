import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  `You are writing one month's entry in a plant owner's private journal.
You are given the plant, the month, and that month's logged events (waterings,
feedings, repottings, photo health check-ins, observations, learned schedule
changes) — each with the weather at the time when available.

Write a single calm, grounded paragraph (3-5 sentences) in second person ("your
Calla") that reflects back what actually happened this month. Ground every
statement in the data: cite real counts, intervals, weather, and health
observations. Do not invent events that are not in the data. Do not give generic
species care advice. Do not use hype or exclamation marks. If the month was
quiet, say so honestly and briefly.

Respond ONLY with valid JSON, no markdown or extra text:
{
  "narrative": "the paragraph"
}`;

function monthRange(period: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-based
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return { start, end };
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface EventRow {
  event_type: string;
  notes: string | null;
  ai_analysis: string | null;
  weather: { temperature: number; humidity: number; precipitation: number } | null;
  created_at: string;
}

function summarizeEvents(events: EventRow[]): string {
  return events
    .map((e) => {
      const day = new Date(e.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      let line = `- ${day}: ${e.event_type}`;
      if (e.notes) line += ` — ${e.notes}`;
      if (e.weather) {
        line += ` (weather: ${e.weather.temperature}°C, ${e.weather.humidity}% humidity, ${e.weather.precipitation}mm rain)`;
      }
      if (e.ai_analysis) line += ` [health check: ${e.ai_analysis}]`;
      return line;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const { plant_id, period } = await req.json();

    if (!plant_id || !period) {
      return new Response(
        JSON.stringify({ error: "plant_id and period are required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const range = monthRange(period);
    if (!range) {
      return new Response(
        JSON.stringify({ error: "period must be in 'YYYY-MM' format" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // RLS-scoped client acting as the calling user — every read/write below is
    // constrained to plants and entries this user owns.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    const userId = userData.user.id;

    // Return the cached entry if it already exists — never re-bill Anthropic.
    const { data: existing } = await supabase
      .from("journal_entries")
      .select("period, narrative, created_at")
      .eq("plant_id", plant_id)
      .eq("period", period)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ...existing, cached: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("id, name, species, location")
      .eq("id", plant_id)
      .single();

    if (plantError || !plant) {
      return new Response(
        JSON.stringify({ error: "Plant not found" }),
        { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const { data: events, error: eventsError } = await supabase
      .from("plant_events")
      .select("event_type, notes, ai_analysis, weather, created_at")
      .eq("plant_id", plant_id)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: true });

    if (eventsError) {
      return new Response(
        JSON.stringify({ error: "Failed to load events", details: eventsError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ error: "No events for this period" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const contextParts: string[] = [`Plant: ${plant.name}`];
    if (plant.species) contextParts.push(`Species: ${plant.species}`);
    if (plant.location) contextParts.push(`Location: ${plant.location}`);
    contextParts.push(`Month: ${monthLabel(period)}`);
    contextParts.push(`\nEvents this month:\n${summarizeEvents(events as EventRow[])}`);

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contextParts.join("\n") }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return new Response(
        JSON.stringify({ error: "Anthropic API error", details: errorText }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const anthropicData = await anthropicResponse.json();
    const textContent = anthropicData.content?.find(
      (block: { type: string }) => block.type === "text",
    );

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: "No text response from AI" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const cleaned = textContent.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const narrative = parsed.narrative;

    if (!narrative || typeof narrative !== "string") {
      return new Response(
        JSON.stringify({ error: "AI response missing narrative" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("journal_entries")
      .insert({ plant_id, user_id: userId, period, narrative })
      .select("period, narrative, created_at")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save entry", details: insertError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ...inserted, cached: false }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
