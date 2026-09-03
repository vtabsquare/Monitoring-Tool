import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminOrg, audit } from "./admin.server";

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data: devices, error } = await context.supabase
      .from("devices")
      .select(
        "id, name, os, agent_version, status, monitoring_state, last_heartbeat_at, last_sync_at, registered_at, created_at, profile_id, profiles(id, full_name, email, job_role, departments(name))",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { getEffectiveSchedule, isWithinShift } = await import("./agent.server");
    const updatedDevices = await Promise.all(
      (devices ?? []).map(async (d: any) => {
        if (d.status === "paused") return { ...d, monitoring_state: "paused" };
        if (d.status === "revoked") return { ...d, monitoring_state: "offline" };

        const isOnline =
          d.last_heartbeat_at &&
          Date.now() - new Date(d.last_heartbeat_at).getTime() < 120_000; // 2 minutes heartbeat threshold

        const schedule = await getEffectiveSchedule(context.supabase, orgId, d.profile_id);
        const inShift = isWithinShift(schedule);

        // State is "active" when agent is online and sending periodic heartbeats
        const state = isOnline ? (inShift ? "active" : "off_shift") : "offline";

        if (d.monitoring_state !== state) {
          await context.supabase
            .from("devices")
            .update({ monitoring_state: state })
            .eq("id", d.id);
        }

        return { ...d, monitoring_state: state };
      }),
    );

    return updatedDevices;
  });

const deviceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        device_id: z.string().uuid(),
        action: z.enum(["pause", "resume", "revoke", "force_reregister", "delete"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { device_id, action } = data;

    if (action === "delete") {
      await context.supabase.from("activity_sessions").delete().eq("device_id", device_id).eq("org_id", orgId);
      const { error } = await context.supabase
        .from("devices")
        .delete()
        .eq("id", device_id)
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);

      await audit(context.supabase, {
        orgId,
        actorId: context.userId,
        actorEmail: context.claims.email ?? "unknown",
        action: "device.deleted",
        entityType: "device",
        entityId: device_id,
      });
      return { ok: true };
    }

    const patch =
      action === "pause"
        ? { status: "paused", monitoring_state: "paused" }
        : action === "resume"
          ? { status: "active", monitoring_state: "active" }
          : action === "revoke"
            ? { status: "revoked", monitoring_state: "offline" }
            : {
                status: "active",
                monitoring_state: "active",
                registered_at: new Date().toISOString(),
              };

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
