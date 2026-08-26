import { createFileRoute } from "@tanstack/react-router";
import { authenticateDevice } from "@/lib/agent.server";

/**
 * POST /api/public/agent/revoke
 * Agent self-revocation on uninstall. Clears credentials server-side; the
 * device key stops working immediately after this call.
 */
export const Route = createFileRoute("/api/public/agent/revoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await authenticateDevice(request);
        if ("error" in result && result.error) return result.error;
        const { device, supabaseAdmin } = result as Exclude<typeof result, { error: Response }>;

        await supabaseAdmin
          .from("devices")
          .update({ status: "revoked", monitoring_state: "offline", device_key_hash: null })
          .eq("id", device.id);

        return Response.json({ ok: true, revoked: true });
      },
    },
  },
});
