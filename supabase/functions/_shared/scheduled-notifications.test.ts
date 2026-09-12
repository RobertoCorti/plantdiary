import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getUtcScheduledWindow,
  reserveScheduledNotification,
  updateScheduledNotificationStatus,
} from "./scheduled-notifications.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function reservationClient(
  result: { data: unknown; error: unknown },
): SupabaseClient {
  return {
    from() {
      return {
        insert() {
          return {
            select() {
              return { single: async () => result };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function statusClient(
  result: { error: unknown },
  observed: Record<string, unknown>,
): SupabaseClient {
  return {
    from(table: string) {
      observed.table = table;
      return {
        update(values: Record<string, unknown>) {
          observed.values = values;
          return {
            in(column: string, ids: string[]) {
              observed.column = column;
              observed.ids = ids;
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

Deno.test("uses the UTC calendar day as the scheduled window", () => {
  assertEquals(
    getUtcScheduledWindow(new Date("2026-09-13T23:59:59.000-07:00")),
    "2026-09-14",
  );
});

Deno.test("rejects an invalid scheduled-window date", () => {
  let message = "";
  try {
    getUtcScheduledWindow(new Date("invalid"));
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(
    message,
    "Cannot create a scheduled window from an invalid date",
  );
});

Deno.test("returns the reserved delivery ID", async () => {
  const id = await reserveScheduledNotification(
    reservationClient({ data: { id: "delivery-1" }, error: null }),
    "watering-reminders",
    "user-1",
    "2026-09-14",
  );
  assertEquals(id, "delivery-1");
});

Deno.test("treats the unique constraint as an already reserved delivery", async () => {
  const id = await reserveScheduledNotification(
    reservationClient({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }),
    "advisor-tips",
    "user-1",
    "2026-09-14",
  );
  assertEquals(id, null);
});

Deno.test("surfaces unexpected reservation failures", async () => {
  let message = "";
  try {
    await reserveScheduledNotification(
      reservationClient({
        data: null,
        error: { code: "42501", message: "permission denied" },
      }),
      "watering-reminders",
      "user-1",
      "2026-09-14",
    );
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(
    message,
    "Failed to reserve scheduled notification: permission denied",
  );
});

Deno.test("records submitted delivery IDs", async () => {
  const observed: Record<string, unknown> = {};
  await updateScheduledNotificationStatus(
    statusClient({ error: null }, observed),
    ["delivery-1", "delivery-2"],
    "submitted",
  );

  assertEquals(observed.table, "scheduled_notification_deliveries");
  assertEquals(observed.column, "id");
  assertEquals((observed.ids as string[]).join(","), "delivery-1,delivery-2");
  assertEquals(
    (observed.values as Record<string, unknown>).status,
    "submitted",
  );
});
