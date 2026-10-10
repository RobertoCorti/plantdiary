import {
  fetchAuthenticatedPlantPhoto,
  photoPathFromPayload,
  PhotoStorageError,
} from "./photo-storage.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const SUPABASE_URL = "https://project.supabase.co";
const CONFIG = { supabaseUrl: SUPABASE_URL, anonKey: "anon-key" };

function request(authorization = "Bearer user-token"): Request {
  return new Request("https://example.com/identify-plant", {
    method: "POST",
    headers: { Authorization: authorization },
  });
}

async function expectPhotoError(
  action: () => Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
    throw new Error("Expected PhotoStorageError");
  } catch (error) {
    if (!(error instanceof PhotoStorageError)) throw error;
    assertEquals(error.status, status);
  }
}

Deno.test("accepts a canonical caller-owned photo path", () => {
  assertEquals(
    photoPathFromPayload({ photo_path: "user-1/123.jpg" }, SUPABASE_URL),
    "user-1/123.jpg",
  );
});

Deno.test("normalizes the current legacy public URL payload", () => {
  assertEquals(
    photoPathFromPayload({
      photo_url:
        `${SUPABASE_URL}/storage/v1/object/public/plant-photos/user-1/folder%20photo.jpg`,
    }, SUPABASE_URL),
    "user-1/folder photo.jpg",
  );
});

Deno.test("rejects arbitrary and malformed photo URLs", () => {
  for (
    const photo_url of [
      "https://example.com/photo.jpg",
      `${SUPABASE_URL}/storage/v1/object/public/other-bucket/user-1/photo.jpg`,
      "not-a-url",
    ]
  ) {
    assertEquals(photoPathFromPayload({ photo_url }, SUPABASE_URL), null);
  }
});

Deno.test("fetches Storage with the caller JWT and encoded object path", async () => {
  let observedUrl = "";
  let observedHeaders: Headers | undefined;
  const fetcher: typeof fetch = (input, init) => {
    observedUrl = String(input);
    observedHeaders = new Headers(init?.headers);
    return Promise.resolve(
      new Response("image", {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
  };

  const response = await fetchAuthenticatedPlantPhoto(
    request(),
    { photo_path: "user-1/folder photo.jpg" },
    CONFIG,
    fetcher,
  );

  assertEquals(response.status, 200);
  assertEquals(
    observedUrl,
    `${SUPABASE_URL}/storage/v1/object/authenticated/plant-photos/user-1/folder%20photo.jpg`,
  );
  assertEquals(observedHeaders?.get("Authorization"), "Bearer user-token");
  assertEquals(observedHeaders?.get("apikey"), "anon-key");
});

Deno.test("rejects missing caller authentication before Storage", async () => {
  let fetched = false;
  const fetcher: typeof fetch = () => {
    fetched = true;
    return Promise.resolve(new Response());
  };
  await expectPhotoError(
    () =>
      fetchAuthenticatedPlantPhoto(
        new Request("https://example.com/identify-plant", { method: "POST" }),
        { photo_path: "user-1/photo.jpg" },
        CONFIG,
        fetcher,
      ),
    401,
  );
  assertEquals(fetched, false);
});

Deno.test("surfaces Storage denial for another user's path", async () => {
  const fetcher: typeof fetch = () =>
    Promise.resolve(new Response("forbidden", { status: 403 }));
  await expectPhotoError(
    () =>
      fetchAuthenticatedPlantPhoto(
        request(),
        { photo_path: "other-user/photo.jpg" },
        CONFIG,
        fetcher,
      ),
    403,
  );
});

Deno.test("rejects malformed paths without contacting Storage", async () => {
  let fetched = false;
  const fetcher: typeof fetch = () => {
    fetched = true;
    return Promise.resolve(new Response());
  };
  await expectPhotoError(
    () =>
      fetchAuthenticatedPlantPhoto(
        request(),
        { photo_path: "user-1/../other-user/photo.jpg" },
        CONFIG,
        fetcher,
      ),
    400,
  );
  assertEquals(fetched, false);
});
