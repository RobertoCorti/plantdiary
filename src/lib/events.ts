import type { SupabaseClient } from "@supabase/supabase-js";

export async function logWatering(
  supabase: SupabaseClient,
  plantId: string,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error: eventError } = await supabase.from("plant_events").insert({
    plant_id: plantId,
    user_id: userId,
    event_type: "watered",
    created_at: now,
  });

  if (eventError) throw eventError;

  const { error: updateError } = await supabase
    .from("plants")
    .update({ last_watered_at: now, updated_at: now })
    .eq("id", plantId);

  if (updateError) throw updateError;
}
