import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_CALLBACK_URL = "plantdiary://auth/callback";

function callbackParams(url: string): URLSearchParams {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1).split("#")[0] : "";
  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  return new URLSearchParams([query, fragment].filter(Boolean).join("&"));
}

/** Completes only PlantDiary auth callbacks; unrelated links are ignored. */
export async function completeAuthCallback(
  supabase: SupabaseClient,
  url: string
): Promise<boolean> {
  if (!url.startsWith(AUTH_CALLBACK_URL)) return false;

  const params = callbackParams(url);
  const errorDescription = params.get("error_description");
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("The confirmation link did not contain a valid session.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return true;
}
