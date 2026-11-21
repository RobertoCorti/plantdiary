import type { SupabaseClient } from "@supabase/supabase-js";

export const FEEDBACK_CATEGORIES = ["bug", "ux", "idea"] as const;
export const FEEDBACK_PLATFORMS = ["ios", "android", "web"] as const;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2000;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackPlatform = (typeof FEEDBACK_PLATFORMS)[number];

export type FeedbackSubmissionInput = {
  category: FeedbackCategory;
  message: string;
  appVersion: string | null;
  platform: FeedbackPlatform;
  platformVersion: string | null;
};

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory);
}

function isFeedbackPlatform(value: unknown): value is FeedbackPlatform {
  return FEEDBACK_PLATFORMS.includes(value as FeedbackPlatform);
}

function optionalText(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function submitFeedback(
  client: SupabaseClient,
  userId: string,
  input: FeedbackSubmissionInput
): Promise<void> {
  const message = input.message.trim();

  if (!isFeedbackCategory(input.category)) {
    throw new Error("Choose a feedback category.");
  }
  if (!message) {
    throw new Error("Feedback cannot be empty.");
  }
  if (Array.from(message).length > FEEDBACK_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Feedback must be ${FEEDBACK_MESSAGE_MAX_LENGTH.toLocaleString()} characters or fewer.`
    );
  }
  if (!isFeedbackPlatform(input.platform)) {
    throw new Error("Feedback is not supported on this platform.");
  }

  const { error } = await client.from("feedback_submissions").insert({
    user_id: userId,
    category: input.category,
    message,
    app_version: optionalText(input.appVersion),
    platform: input.platform,
    platform_version: optionalText(input.platformVersion),
  });

  if (error) throw error;
}
