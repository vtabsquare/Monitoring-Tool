import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAdminOrg, requireAdminOrg, audit } from "./admin.server";

export const getMyOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const found = await findAdminOrg(context.supabase, context.userId);
    if (!found) return null;
    const { data: departments } = await context.supabase
      .from("departments")
      .select("*")
      .eq("org_id", found.orgId)
      .order("name");
    return { ...found.org, departments: departments ?? [] };
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
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
      "-" + Math.random().toString(36).slice(2, 7);
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
