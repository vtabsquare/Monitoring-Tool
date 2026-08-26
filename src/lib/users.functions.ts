import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminOrg, audit } from "./admin.server";

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const shiftSchema = z.object({
  timezone: z.string().min(1).max(64),
  days: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        enabled: z.boolean(),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .length(7),
});

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("*, departments(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: invites }, { data: devices }] = await Promise.all([
      context.supabase
        .from("invitations")
        .select("profile_id, status, created_at, token")
        .eq("org_id", orgId)
        .in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      context.supabase
        .from("devices")
        .select("profile_id, id, name, monitoring_state, last_heartbeat_at")
        .eq("org_id", orgId)
        .in("profile_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    return (profiles ?? []).map((p) => ({
      ...p,
      invitation: (invites ?? []).find((i) => i.profile_id === p.id) ?? null,
      devices: (devices ?? []).filter((d) => d.profile_id === p.id),
    }));
  });

export const addUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        full_name: z.string().min(2).max(120),
        email: z.string().email(),
        department_id: z.string().uuid().nullable(),
        job_role: z.string().max(120).optional(),
        shift: shiftSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .insert({
        org_id: orgId,
        department_id: data.department_id,
        email: data.email.toLowerCase(),
        full_name: data.full_name,
        job_role: data.job_role ?? null,
        status: "invited",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("monitoring_schedules").insert(
      data.shift.days.map((d) => ({
        org_id: orgId,
        profile_id: profile.id,
        day_of_week: d.day_of_week,
        enabled: d.enabled,
        start_time: d.start_time,
        end_time: d.end_time,
        timezone: data.shift.timezone,
      })),
    );

    const { data: invite } = await context.supabase
      .from("invitations")
      .insert({ org_id: orgId, profile_id: profile.id, email: data.email.toLowerCase(), status: "sent", invited_by: context.userId })
      .select("token")
      .single();

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "user.invited",
      entityType: "profile",
      entityId: profile.id,
      metadata: { email: data.email.toLowerCase() },
    });

    // In production this triggers an email containing the Windows agent
    // installer link + this registration token.
    return { id: profile.id as string, invitationToken: invite?.token as string };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        full_name: z.string().min(2).max(120).optional(),
        department_id: z.string().uuid().nullable().optional(),
        job_role: z.string().max(120).nullable().optional(),
        status: z.enum(["invited", "active", "disabled"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { id, ...fields } = data;
    const { error } = await context.supabase
      .from("profiles")
      .update({
        ...(fields.full_name !== undefined ? { full_name: fields.full_name } : {}),
        ...(fields.department_id !== undefined ? { department_id: fields.department_id } : {}),
        ...(fields.job_role !== undefined ? { job_role: fields.job_role } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
      })
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: fields.status === "disabled" ? "user.disabled" : "user.updated",
      entityType: "profile",
      entityId: id,
      metadata: fields,
    });
    return { ok: true };
  });

export const saveUserShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ profile_id: z.string().uuid(), shift: shiftSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    await context.supabase
      .from("monitoring_schedules")
      .delete()
      .eq("profile_id", data.profile_id)
      .eq("org_id", orgId);
    const { error } = await context.supabase.from("monitoring_schedules").insert(
      data.shift.days.map((d) => ({
        org_id: orgId,
        profile_id: data.profile_id,
        day_of_week: d.day_of_week,
        enabled: d.enabled,
        start_time: d.start_time,
        end_time: d.end_time,
        timezone: data.shift.timezone,
      })),
    );
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "schedule.updated",
      entityType: "profile",
      entityId: data.profile_id,
    });
    return { ok: true };
  });

export const getUserShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("monitoring_schedules")
      .select("*")
      .eq("profile_id", data.profile_id)
      .eq("org_id", orgId)
      .order("day_of_week");
    return rows ?? [];
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    // Rotate the token — old download links die.
    const { data: invite, error } = await context.supabase
      .from("invitations")
      .update({
        token: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
        status: "sent",
        expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      })
      .eq("profile_id", data.profile_id)
      .eq("org_id", orgId)
      .select("token, email")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "invitation.resent",
      entityType: "profile",
      entityId: data.profile_id,
      metadata: { email: invite.email },
    });
    return { ok: true, token: invite.token as string };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const WEEKDAYS = DAYS;
