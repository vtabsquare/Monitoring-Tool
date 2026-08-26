import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminOrg, audit } from "./admin.server";

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("devices")
      .select("id, name, os, agent_version, status, monitoring_state, last_heartbeat_at, last_sync_at, registered_at, created_at, profiles(id, full_name, email, job_role, departments(name))")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const deviceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        device_id: z.string().uuid(),
        action: z.enum(["pause", "resume", "revoke", "force_reregister"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { device_id, action } = data;

    const patch =
      action === "pause"
        ? { status: "paused", monitoring_state: "paused" }
        : action === "resume"
          ? { status: "active", monitoring_state: "off_shift" }
          : action === "revoke"
            ? { status: "revoked", monitoring_state: "offline", device_key_hash: null }
            : // force re-registration: rotate credentials, agent must re-onboard
              { status: "active", monitoring_state: "offline", device_key_hash: null, registered_at: null };

    const { error } = await context.supabase
      .from("devices")
      .update(patch)
      .eq("id", device_id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: `device.${action === "force_reregister" ? "force_reregister" : action + "d"}`,
      entityType: "device",
      entityId: device_id,
    });
    return { ok: true };
  });

export { deviceAction };
