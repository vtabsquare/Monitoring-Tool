import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice, getEffectiveSchedule, isWithinShift } from "@/lib/agent.server";

/**
 * POST /api/public/agent/heartbeat
 * Liveness + config check. Runs inside and outside the shift; the response
 * tells the agent whether monitoring must be ON right now.
 */
const bodySchema = z.object({
  agent_version: z.string().max(40).optional(),
});

export const Route = createFileRoute("/api/public/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await authenticateDevice(request);
        if ("error" in result && result.error) return result.error;
        const { device, supabaseAdmin } = result as Exclude<typeof result, { error: Response }>;

        const raw = await request.json().catch(() => ({}));
        const body = bodySchema.safeParse(raw);

        const schedule = await getEffectiveSchedule(supabaseAdmin, device.org_id, device.profile_id);
        const inShift = device.status === "active" && isWithinShift(schedule);
        const monitoring = device.status === "paused" ? "paused" : inShift ? "active" : "off_shift";

        await supabaseAdmin
          .from("devices")
          .update({
            last_heartbeat_at: new Date().toISOString(),
            monitoring_state: monitoring,
            ...(body.success && body.data.agent_version ? { agent_version: body.data.agent_version } : {}),
          })
          .eq("id", device.id);

        return Response.json({
          ok: true,
          monitoring, // "active" | "off_shift" | "paused"
          status: device.status,
          server_time: new Date().toISOString(),
        });
      },
    },
  },
});
