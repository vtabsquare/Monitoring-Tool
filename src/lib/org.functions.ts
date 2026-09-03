import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAdminOrg, requireAdminOrg, audit } from "./admin.server";

export const getMyOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let found = await findAdminOrg(context.supabase, context.userId);
    
    if (!found && context.claims.email) {
      // Auto-link logic using supabaseAdmin (bypasses RLS, no SQL migration needed)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const email = context.claims.email;
      const newUserId = context.userId;

      const { data: oldestProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, org_id, auth_user_id")
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (oldestProfile) {
        const oldUserId = oldestProfile.auth_user_id;

        if (oldUserId && oldUserId !== newUserId) {
          // Transfer role from old user id
          await supabaseAdmin
            .from("user_roles")
            .update({ user_id: newUserId })
            .eq("user_id", oldUserId)
            .eq("org_id", oldestProfile.org_id);
        }

        // Unlink any newer profiles this user might have accidentally created
        await supabaseAdmin
          .from("profiles")
          .update({ auth_user_id: null })
          .eq("auth_user_id", newUserId)
          .neq("id", oldestProfile.id);

        // Link the oldest profile
        await supabaseAdmin
          .from("profiles")
          .update({ auth_user_id: newUserId, status: "active" })
          .eq("id", oldestProfile.id);

        // Ensure they have the admin role for this org
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", newUserId)
          .eq("org_id", oldestProfile.org_id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: newUserId, org_id: oldestProfile.org_id, role: "admin" });
        }

        found = await findAdminOrg(context.supabase, newUserId);
      }
    }

    if (!found) return null;

    const [{ data: departments }, { data: profiles }] = await Promise.all([
      context.supabase.from("departments").select("id, name").eq("org_id", found.orgId).order("name"),
      context.supabase.from("profiles").select("id, department_id").eq("org_id", found.orgId),
    ]);

    const memberCounts = new Map<string, number>();
    for (const p of profiles ?? []) {
      if (p.department_id) {
        memberCounts.set(p.department_id, (memberCounts.get(p.department_id) ?? 0) + 1);
      }
    }

    const deptsWithCount = (departments ?? []).map((d) => ({
      ...d,
      member_count: memberCounts.get(d.id) ?? 0,
    }));

    return { ...found.org, departments: deptsWithCount };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(2).max(80),
        timezone: z.string().min(1).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const existing = await findAdminOrg(context.supabase, context.userId);
    if (existing) return { orgId: existing.orgId, created: false };
    const slug =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 7);
    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({ name: data.name, slug, timezone: data.timezone })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { orgId: org.id as string, created: true };
  });

export const updateOrganizationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(2).max(80).optional(),
        timezone: z.string().min(1).max(64).optional(),
        heartbeat_interval_seconds: z.number().int().min(30).max(3600).optional(),
        data_retention_days: z.number().int().min(7).max(730).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("organizations")
      .update({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.heartbeat_interval_seconds !== undefined
          ? { heartbeat_interval_seconds: data.heartbeat_interval_seconds }
          : {}),
        ...(data.data_retention_days !== undefined
          ? { data_retention_days: data.data_retention_days }
          : {}),
      })
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: orgId,
      metadata: data,
    });
    return { ok: true };
  });

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data: dept, error } = await context.supabase
      .from("departments")
      .insert({
        org_id: orgId,
        name: data.name.trim(),
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "department.created",
      entityType: "department",
      entityId: dept.id,
      metadata: { name: data.name },
    });
    return dept;
  });

export const updateDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("departments")
      .update({
        name: data.name.trim(),
      })
      .eq("id", data.id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "department.updated",
      entityType: "department",
      entityId: data.id,
      metadata: { name: data.name },
    });
    return { ok: true };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);

    await context.supabase
      .from("profiles")
      .update({ department_id: null })
      .eq("department_id", data.id)
      .eq("org_id", orgId);

    const { error } = await context.supabase
      .from("departments")
      .delete()
      .eq("id", data.id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "department.deleted",
      entityType: "department",
      entityId: data.id,
    });
    return { ok: true };
  });
