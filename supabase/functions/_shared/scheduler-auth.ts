const JSON_HEADERS = { "Content-Type": "application/json" };

function errorResponse(
  status: number,
  error: string,
  extraHeaders = {},
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/**
 * Authorize a privileged service-to-service scheduler request.
 *
 * Supabase Cron and the temporary GitHub schedules send a dedicated shared
 * secret in the `x-scheduler-secret` header. The gateway credential and the
 * function's internal database credential stay separate from trigger access.
 */
export function authorizeSchedulerRequest(
  req: Request,
  expectedSchedulerSecret: string | undefined,
): Response | null {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", { Allow: "POST" });
  }

  if (!expectedSchedulerSecret) {
    return errorResponse(500, "Scheduler authentication is not configured");
  }

  const providedSecret = req.headers.get("x-scheduler-secret");
  if (!providedSecret || providedSecret !== expectedSchedulerSecret) {
    return errorResponse(401, "Unauthorized");
  }

  return null;
}

/**
 * Return a side-effect-free success response for rollout verification.
 * Authorization must be checked before calling this helper.
 */
export function schedulerDryRunResponse(req: Request): Response | null {
  if (req.headers.get("x-scheduler-dry-run") !== "true") return null;

  return new Response(
    JSON.stringify({ authorized: true, dry_run: true }),
    { headers: JSON_HEADERS },
  );
}
