import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  generateDeviceKey,
  hashDeviceKey,
  getEffectiveSchedule,
} from "@/lib/agent.server";

/**
 * POST /api/public/agent/register
 * First-boot onboarding for the Electron agent. The agent presents the
 * invitation token from the download email; the server binds the device to
 * the invitation's org + user and issues device credentials exactly once.
 */
const bodySchema = z.object({
  invitation_token: z.string().min(16).max(128),
  device_name: z.string().min(1).max(120),
  os: z.string().min(1).max(120),
  agent_version: z.string().min(1).max(40),
});

export const Route = createFileRoute("/api/public/agent/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
        const input = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Invitation token is the ONLY client-supplied identity. The org and
        // user binding come from the invitation row, never from the client.
        const { data: invite } = await supabaseAdmin
          .from("invitations")
          .select("id, org_id, profile_id, email, status, expires_at")
          .eq("token", input.invitation_token)
          .maybeSingle();
        if (!invite || ["revoked", "expired"].includes(invite.status))
          return Response.json({ error: "Invalid invitation" }, { status: 401 });
        if (new Date(invite.expires_at) < new Date())
          return Response.json({ error: "Invitation expired", code: "INVITE_EXPIRED" }, { status: 410 });

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, status")
          .eq("id", invite.profile_id)
          .eq("org_id", invite.org_id)
          .single();
        if (!profile || profile.status === "disabled")
          return Response.json({ error: "User is disabled" }, { status: 403 });

        const deviceKey = generateDeviceKey();
        const { data: device, error } = await supabaseAdmin
          .from("devices")
          .insert({
            org_id: invite.org_id,
            profile_id: invite.profile_id,
            name: input.device_name,
            os: input.os,
            agent_version: input.agent_version,
            device_key_hash: hashDeviceKey(deviceKey),
            status: "active",
            monitoring_state: "off_shift",
            registered_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) return Response.json({ error: "Registration failed" }, { status: 500 });

        await supabaseAdmin
          .from("invitations")
          .update({ status: "accepted" })
          .eq("id", invite.id);
        await supabaseAdmin
          .from("profiles")
          .update({ status: "active" })
          .eq("id", invite.profile_id);

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("timezone, heartbeat_interval_seconds")
          .eq("id", invite.org_id)
          .single();
        const schedule = await getEffectiveSchedule(supabaseAdmin, invite.org_id, invite.profile_id);

        // device_key is returned exactly once. Only its hash is stored.
        return Response.json({
          device_id: device.id,
          device_key: deviceKey,
          config: {
            heartbeat_interval_seconds: org?.heartbeat_interval_seconds ?? 300,
            sync_interval_seconds: 900,
            schedule,
            privacy: {
              collects: ["app_name", "process_name", "window_title", "duration", "idle_state"],
              never_collects: ["screenshots", "keystrokes", "passwords", "clipboard"],
            },
          },
        });
      },
    },
  },
});
