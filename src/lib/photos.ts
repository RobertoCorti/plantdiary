import type { SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_PHOTO_MARKER = "/storage/v1/object/public/plant-photos/";
const DEFAULT_SIGNED_URL_SECONDS = 60 * 60;

function decodePath(value: string): string | null {
  try {
    const path = decodeURIComponent(value).replace(/^\/+/, "");
    const segments = path.split("/");
    if (
      segments.length < 2 ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/**
 * Normalizes both legacy public Storage URLs and canonical object paths.
 * New database writes should store only the returned object path.
 */
export function photoPathFromReference(reference: string | null): string | null {
  if (!reference) return null;
  const value = reference.trim();
  if (!value) return null;

  const markerIndex = value.indexOf(PUBLIC_PHOTO_MARKER);
  if (markerIndex !== -1) {
    const encodedPath = value
      .slice(markerIndex + PUBLIC_PHOTO_MARKER.length)
      .split(/[?#]/, 1)[0];
    return decodePath(encodedPath);
  }

  if (value.includes("://") || value.includes("?") || value.includes("#")) {
    return null;
  }
  return decodePath(value);
}

export async function createSignedPhotoUrl(
  supabase: SupabaseClient,
  reference: string | null,
  expiresIn = DEFAULT_SIGNED_URL_SECONDS
): Promise<string | null> {
  const path = photoPathFromReference(reference);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("plant-photos")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Photo URL could not be signed.");
  return data.signedUrl;
}
