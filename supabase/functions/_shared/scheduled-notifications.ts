import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ScheduledJobName = "watering-reminders" | "advisor-tips";
export type ScheduledDeliveryStatus = "submitted" | "failed";

const TABLE = "scheduled_notification_deliveries";

export function getUtcScheduledWindow(now = new Date()): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Cannot create a scheduled window from an invalid date");
  }
  return now.toISOString().slice(0, 10);
}

export async function reserveScheduledNotification(
  supabase: SupabaseClient,
  jobName: ScheduledJobName,
  userId: string,
  scheduledFor: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      job_name: jobName,
      user_id: userId,
      scheduled_for: scheduledFor,
    })
    .select("id")
    .single();

  if (error?.code === "23505") return null;
  if (error) {
    throw new Error(
      `Failed to reserve scheduled notification: ${error.message}`,
    );
  }
  if (!data?.id) {
    throw new Error("Scheduled notification reservation returned no ID");
  }

  return data.id;
}

export async function updateScheduledNotificationStatus(
  supabase: SupabaseClient,
  deliveryIds: string[],
  status: ScheduledDeliveryStatus,
): Promise<void> {
  if (deliveryIds.length === 0) return;

  const now = new Date().toISOString();
  const values = {
    status,
    updated_at: now,
    submitted_at: status === "submitted" ? now : null,
  };
  const { error } = await supabase
    .from(TABLE)
    .update(values)
    .in("id", deliveryIds);

  if (error) {
    throw new Error(
      `Failed to update scheduled notifications: ${error.message}`,
    );
  }
}
