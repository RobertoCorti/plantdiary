import { authorizeSchedulerRequest } from "./scheduler-auth.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const SERVICE_ROLE_KEY = "test-service-role-key";

function request(method = "POST", apiKey?: string): Request {
  const headers = new Headers();
  if (apiKey) headers.set("apikey", apiKey);
  return new Request("https://example.com/scheduled-function", {
    method,
    headers,
  });
}

Deno.test("accepts a POST with the configured service-role key", () => {
  const response = authorizeSchedulerRequest(
    request("POST", SERVICE_ROLE_KEY),
    SERVICE_ROLE_KEY,
  );
  assertEquals(response, null);
});

Deno.test("rejects a missing scheduler credential", () => {
  const response = authorizeSchedulerRequest(request(), SERVICE_ROLE_KEY);
  assertEquals(response?.status, 401);
});

Deno.test("rejects an ordinary project credential", () => {
  const response = authorizeSchedulerRequest(
    request("POST", "ordinary-user-or-anon-key"),
    SERVICE_ROLE_KEY,
  );
  assertEquals(response?.status, 401);
});

Deno.test("does not accept the service-role key only as a bearer token", () => {
  const req = new Request("https://example.com/scheduled-function", {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const response = authorizeSchedulerRequest(req, SERVICE_ROLE_KEY);
  assertEquals(response?.status, 401);
});

Deno.test("rejects unsupported methods before authorization", () => {
  const response = authorizeSchedulerRequest(
    request("GET", SERVICE_ROLE_KEY),
    SERVICE_ROLE_KEY,
  );
  assertEquals(response?.status, 405);
  assertEquals(response?.headers.get("Allow"), "POST");
});

Deno.test("fails closed when the server credential is missing", () => {
  const response = authorizeSchedulerRequest(
    request("POST", SERVICE_ROLE_KEY),
    undefined,
  );
  assertEquals(response?.status, 500);
});
