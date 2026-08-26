import { createFileRoute } from "@tanstack/react-router";
import { authenticateDevice, getEffectiveSchedule, isWithinShift } from "@/lib/agent.server";

/**
 * GET /api/public/agent/config
 * Full configuration payload for the agent: schedule (per-day, timezone,
 * overnight-capable), heartbeat/sync cadence, current monitoring state.
 */
export const Route = createFileRoute("/api/public/agent/config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await authenticateDevice(request);
        if ("error" in result && result.error) return result.error;
        const { device, supabaseAdmin } = result as Exclude<typeof result, { error: Response }>;

        const [{ data: org }, schedule] = await Promise.all([
          supabaseAdmin
            .from("organizations")
            .select("timezone, heartbeat_interval_seconds")
            .eq("id", device.org_id)
            .single(),
          getEffectiveSchedule(supabaseAdmin, device.org_id, device.profile_id),
        ]);

        return Response.json({
          device_id: device.id,
          heartbeat_interval_seconds: org?.heartbeat_interval_seconds ?? 300,
          sync_interval_seconds: 900,
          schedule,
          monitoring_now: device.status === "active" && isWithinShift(schedule),
          status: device.status,
          privacy: {
            collects: ["app_name", "process_name", "window_title", "duration", "idle_state"],
            never_collects: ["screenshots", "keystrokes", "passwords", "clipboard"],
          },
        });
      },
    },
  },
});
