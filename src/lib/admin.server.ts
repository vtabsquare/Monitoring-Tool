import type { SupabaseClient } from "@supabase/supabase-js";

export interface Org {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  heartbeat_interval_seconds: number;
  data_retention_days: number;
  created_at: string;
}

/** Resolve the organization the signed-in user admins. Throws if none. */
export async function requireAdminOrg(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ orgId: string; org: Org }> {
  const { data: role, error } = await supabase
    .from("user_roles")
    .select("org_id, organizations(*)")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!role) throw new Error("No organization. Complete onboarding first.");
  const org = role.organizations as unknown as Record<string, unknown>;
  return { orgId: role.org_id as string, org };
}

/** Find the org the user admins, or null (used by onboarding). */
export async function findAdminOrg(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("org_id, organizations(*)")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const org = data.organizations as unknown as Record<string, unknown>;
  return { orgId: data.org_id as string, org };
}

export async function audit(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    actorId: string;
    actorEmail: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_logs").insert({
    org_id: input.orgId,
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
