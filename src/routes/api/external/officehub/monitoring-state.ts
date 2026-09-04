import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/external/officehub/monitoring-state
 * Secure server-to-server endpoint for OfficeHub360 to control desktop monitoring state.
 */
const bodySchema = z.object({
  org_id: z.string().uuid(),
  employee_id: z.string().min(1).max(200),
  monitoring_state: z.enum(["active", "paused"]),
});

export const Route = createFileRoute("/api/external/officehub/monitoring-state")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate Request
        const auth = request.headers.get("authorization");
        const secret = process.env.OFFICEHUB_INTEGRATION_SECRET;
        
        if (!secret) {
          console.error("[OfficeHub Integration] SERVER MISCONFIGURATION: OFFICEHUB_INTEGRATION_SECRET is not set.");
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }

        const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
        if (!token || token !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Parse Body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid request payload. Expected org_id, employee_id, and monitoring_state ('active' or 'paused')." },
            { status: 400 }
          );
        }

        const { org_id, employee_id, monitoring_state } = parsed.data;

        // 3. Resolve Employee
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("org_id", org_id)
          .eq("external_id", employee_id)
          .maybeSingle();

        if (profileError || !profile) {
          return Response.json({ error: "Employee profile not found for the given org_id and employee_id" }, { status: 404 });
        }

        // 4. Update Devices
        // Idempotent: We just update monitoring_state for all devices belonging to this profile
        const { data: updatedDevices, error: updateError } = await supabaseAdmin
          .from("devices")
          .update({ monitoring_state })
          .eq("profile_id", profile.id)
          .select("id");

        if (updateError) {
          console.error("[OfficeHub Integration] Failed to update devices:", updateError);
          return Response.json({ error: "Failed to update device states" }, { status: 500 });
        }

        // 5. Success Logging
        console.log(`[OfficeHub Integration] employee=${employee_id} state=${monitoring_state} devices_updated=${updatedDevices?.length || 0}`);

        return Response.json({
          success: true,
          employee_id,
          monitoring_state,
          devices_updated: updatedDevices?.length || 0,
        });
      },
    },
  },
});
