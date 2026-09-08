import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/external/officehub/face-verification-alert
 * Secure server-to-server endpoint for OfficeHub360 to trigger native desktop alerts for face verification.
 */
const bodySchema = z.object({
  org_id: z.string().uuid(),
  employee_id: z.string().min(1).max(200),
  alert_level: z.enum(["due_soon", "overdue", "missed", "verified", "clear"]),
  verify_url: z.string().url(),
});

export const Route = createFileRoute("/api/external/officehub/face-verification-alert")({
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
            { error: "Invalid request payload. Expected org_id, employee_id, alert_level, and verify_url." },
            { status: 400 }
          );
        }

        const { org_id, employee_id, alert_level, verify_url } = parsed.data;

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
        const { data: updatedDevices, error: updateError } = await supabaseAdmin
          .from("devices")
          .update({
            face_auth_alert_at: new Date().toISOString(),
            face_auth_alert_level: alert_level,
            face_auth_verify_url: verify_url,
          })
          .eq("profile_id", profile.id)
          .select("id");

        if (updateError) {
          console.error("[OfficeHub Integration] Failed to update devices for face auth:", updateError);
          return Response.json({ error: "Failed to queue face auth alerts" }, { status: 500 });
        }

        // 5. Success Logging
        console.log("[OfficeHub Integration] face_auth alert queued for employee=" + employee_id + " level=" + alert_level + " devices_updated=" + (updatedDevices?.length || 0));

        return Response.json({
          success: true,
          employee_id,
          alert_level,
          devices_updated: updatedDevices?.length || 0,
        });
      },
    },
  },
});
