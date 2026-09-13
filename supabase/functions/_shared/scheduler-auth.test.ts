import {
  authorizeSchedulerRequest,
  schedulerDryRunResponse,
} from "./scheduler-auth.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const SCHEDULER_SECRET = "test-scheduler-secret";

function request(method = "POST", schedulerSecret?: string): Request {
  const headers = new Headers();
  if (schedulerSecret) {
    headers.set("x-scheduler-secret", schedulerSecret);
  }
  return new Request("https://example.com/scheduled-function", {
    method,
    headers,
  });
}

Deno.test("accepts a POST with the configured scheduler secret", () => {
  const response = authorizeSchedulerRequest(
    request("POST", SCHEDULER_SECRET),
    SCHEDULER_SECRET,
  );
  assertEquals(response, null);
});

Deno.test("rejects a missing scheduler credential", () => {
  const response = authorizeSchedulerRequest(request(), SCHEDULER_SECRET);
  assertEquals(response?.status, 401);
});

Deno.test("rejects an ordinary project credential", () => {
  const response = authorizeSchedulerRequest(
    request("POST", "ordinary-user-or-anon-key"),
    SCHEDULER_SECRET,
  );
  assertEquals(response?.status, 401);
});

Deno.test("does not accept the scheduler secret only as a bearer token", () => {
  const req = new Request("https://example.com/scheduled-function", {
    method: "POST",
    headers: { Authorization: `Bearer ${SCHEDULER_SECRET}` },
  });
  const response = authorizeSchedulerRequest(req, SCHEDULER_SECRET);
  assertEquals(response?.status, 401);
});

Deno.test("rejects unsupported methods before authorization", () => {
  const response = authorizeSchedulerRequest(
    request("GET", SCHEDULER_SECRET),
    SCHEDULER_SECRET,
  );
  assertEquals(response?.status, 405);
  assertEquals(response?.headers.get("Allow"), "POST");
});

Deno.test("does not return a dry-run response without the explicit header", () => {
  assertEquals(schedulerDryRunResponse(request()), null);
});

Deno.test("returns a side-effect-free authorized dry-run response", async () => {
  const req = new Request("https://example.com/scheduled-function", {
    method: "POST",
    headers: { "x-scheduler-dry-run": "true" },
  });
  const response = schedulerDryRunResponse(req);

  assertEquals(response?.status, 200);
  assertEquals(
    JSON.stringify(await response?.json()),
    JSON.stringify({ authorized: true, dry_run: true }),
  );
});

Deno.test("fails closed when the scheduler secret is missing", () => {
  const response = authorizeSchedulerRequest(
    request("POST", SCHEDULER_SECRET),
    undefined,
  );
  assertEquals(response?.status, 500);
});
