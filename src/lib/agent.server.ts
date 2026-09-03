import { createHash, randomBytes } from "crypto";

/**
 * Server-side helpers for the desktop agent API. All device identity comes
 * from the device key the server issued at registration — the backend never
 * trusts org/user/device IDs supplied by the client.
 */

export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateDeviceKey(): string {
  return "aeth_" + randomBytes(24).toString("hex");
}

export async function authenticateDevice(request: Request) {
  const auth = request.headers.get("authorization");
  const key = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!key) return { error: Response.json({ error: "Missing device key" }, { status: 401 }) };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: device, error } = await supabaseAdmin
    .from("devices")
    .select("id, org_id, profile_id, name, status, agent_version")
    .eq("device_key_hash", hashDeviceKey(key))
    .maybeSingle();
  if (error) return { error: Response.json({ error: "Lookup failed" }, { status: 500 }) };
  if (!device) return { error: Response.json({ error: "Unknown device" }, { status: 401 }) };
  if (device.status === "revoked")
    return {
      error: Response.json({ error: "Device revoked", code: "DEVICE_REVOKED" }, { status: 403 }),
    };
  return { device, supabaseAdmin };
}

interface ScheduleRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  timezone: string;
}

/**
 * Is monitoring active right now for this schedule?
 * Handles timezones and overnight windows (end < start, e.g. 22:00-06:00).
 */
export function isWithinShift(schedule: ScheduleRow[], now = new Date()): boolean {
  for (const row of schedule) {
    if (!row.enabled) continue;
    const tzNow = new Date(now.toLocaleString("en-US", { timeZone: row.timezone }));
    const dow = tzNow.getDay();
    const minutes = tzNow.getHours() * 60 + tzNow.getMinutes();
    const [sh = 9, sm = 0] = row.start_time.split(":").map(Number);
    const [eh = 18, em = 0] = row.end_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;

    if (start === end) {
      // 24-hour full day shift
      if (dow === row.day_of_week) return true;
    } else if (end > start) {
      // Same-day window
      if (dow === row.day_of_week && minutes >= start && minutes <= end) return true;
    } else {
      // Overnight: window belongs to row.day_of_week, spills into next day
      const prevDow = (row.day_of_week + 6) % 7;
      if (dow === row.day_of_week && minutes >= start) return true;
      if (
        dow === (row.day_of_week + 1) % 7 &&
        minutes <= end &&
        scheduleEnabledOn(schedule, row.day_of_week)
      )
        return true;
      void prevDow;
    }
  }
  return false;
}

function scheduleEnabledOn(schedule: ScheduleRow[], dow: number): boolean {
  return schedule.some((r) => r.day_of_week === dow && r.enabled);
}

export async function getEffectiveSchedule(supabaseAdmin: any, orgId: string, profileId: string) {
  const { data: personal } = await supabaseAdmin
    .from("monitoring_schedules")
    .select("*")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .order("day_of_week");
  if (personal?.length) return personal as ScheduleRow[];
  const { data: orgDefault } = await supabaseAdmin
    .from("monitoring_schedules")
    .select("*")
    .eq("org_id", orgId)
    .is("profile_id", null)
    .order("day_of_week");
  return (orgDefault ?? []) as ScheduleRow[];
}
