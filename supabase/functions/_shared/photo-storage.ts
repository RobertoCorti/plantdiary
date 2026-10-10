const BUCKET = "plant-photos";
const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

type PhotoPayload = {
  photo_path?: unknown;
  photo_url?: unknown;
};

type StorageConfig = {
  supabaseUrl: string | undefined;
  anonKey: string | undefined;
};

type Fetcher = typeof fetch;

export class PhotoStorageError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "PhotoStorageError";
  }
}

function canonicalPath(value: string): string | null {
  if (
    !value ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return null;
  }

  try {
    const path = decodeURIComponent(value);
    const segments = path.split("/");
    if (
      segments.length < 2 ||
      segments.some((segment) =>
        !segment || segment === "." || segment === ".."
      )
    ) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/** Resolve new object paths and legacy public URLs without accepting arbitrary URLs. */
export function photoPathFromPayload(
  payload: PhotoPayload,
  supabaseUrl: string,
): string | null {
  if (typeof payload.photo_path === "string") {
    return canonicalPath(payload.photo_path.trim());
  }
  if (typeof payload.photo_url !== "string") return null;

  try {
    const reference = new URL(payload.photo_url);
    if (reference.origin !== new URL(supabaseUrl).origin) return null;
    if (!reference.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) return null;
    return canonicalPath(reference.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  } catch {
    return null;
  }
}

function encodedStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Fetch a caller-owned photo through Storage RLS using the caller's JWT. */
export async function fetchAuthenticatedPlantPhoto(
  req: Request,
  payload: PhotoPayload,
  config: StorageConfig,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const authorization = req.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new PhotoStorageError(401, "Unauthorized");
  }
  if (!config.supabaseUrl || !config.anonKey) {
    throw new PhotoStorageError(500, "Photo storage is not configured");
  }

  const path = photoPathFromPayload(payload, config.supabaseUrl);
  if (!path) {
    throw new PhotoStorageError(
      400,
      "A valid plant photo reference is required",
    );
  }

  const objectUrl = `${
    config.supabaseUrl.replace(/\/$/, "")
  }/storage/v1/object/authenticated/${BUCKET}/${encodedStoragePath(path)}`;
  const response = await fetcher(objectUrl, {
    headers: {
      Authorization: authorization,
      apikey: config.anonKey,
    },
  });

  if (!response.ok) {
    const status = response.status === 401 || response.status === 403
      ? response.status
      : 400;
    throw new PhotoStorageError(status, "Photo could not be accessed");
  }
  return response;
}
