import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You are a botanist assistant. Given a photo of a plant, identify the species, provide the common name, and give practical care guidelines.

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
    const { photo_url } = await req.json();

    if (!photo_url) {
      return new Response(
        JSON.stringify({ error: "photo_url is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch the image and convert to base64
    const imageResponse = await fetch(photo_url);
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch image" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

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
          model: "claude-sonnet-4-20250514",
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

    const result = JSON.parse(textContent.text);

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
