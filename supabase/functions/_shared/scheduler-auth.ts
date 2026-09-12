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
 * Supabase Cron and the temporary GitHub schedules send the service-role key in
 * the `apikey` header. Requiring that exact server-side credential prevents an
 * anonymous or ordinary user JWT from triggering database-wide processing.
 */
export function authorizeSchedulerRequest(
  req: Request,
  expectedServiceRoleKey: string | undefined,
): Response | null {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", { Allow: "POST" });
  }

  if (!expectedServiceRoleKey) {
    return errorResponse(500, "Scheduler authentication is not configured");
  }

  const providedKey = req.headers.get("apikey");
  if (!providedKey || providedKey !== expectedServiceRoleKey) {
    return errorResponse(401, "Unauthorized");
  }

  return null;
}
