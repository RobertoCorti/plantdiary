import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  fetchAuthenticatedPlantPhoto,
  PhotoStorageError,
} from "../_shared/photo-storage.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const SYSTEM_PROMPT =
  `You are a botanist assistant. Given a photo of a plant, identify the species, provide the common name, and give practical care guidelines.

Respond ONLY with valid JSON, no markdown or extra text:
{
  "species": "Scientific name",
  "common_name": "Common name",
  "confidence": "high" | "medium" | "low",
  "watering_frequency_days": number,
  "light": "light requirement",
  "humidity": "humidity preference",
  "care_notes": "Brief practical care advice"
}`;

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

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const payload = await req.json();
    const imageResponse = await fetchAuthenticatedPlantPhoto(req, payload, {
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
    });

    // Convert the authorized image to base64 for Anthropic.
    const imageBuffer = await imageResponse.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);

    const contentType = imageResponse.headers.get("content-type") ||
      "image/jpeg";

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: contentType,
                    data: base64Image,
                  },
                },
                {
                  type: "text",
                  text: "Identify this plant and provide care instructions.",
                },
              ],
            },
          ],
        }),
      },
    );

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return new Response(
        JSON.stringify({
          error: "Anthropic API error",
          details: errorText,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const anthropicData = await anthropicResponse.json();
    const textContent = anthropicData.content?.find(
      (block: { type: string }) => block.type === "text",
    );

    if (!textContent) {
      return new Response(
        JSON.stringify({ error: "No text response from AI" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const cleaned = textContent.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const result = JSON.parse(cleaned);

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof PhotoStorageError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: error.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        error: "Internal error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
