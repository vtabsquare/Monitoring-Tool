import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminOrg } from "./admin.server";
import { normalizeAppName, getCanonicalClassification } from "./app-mapping";

const periodSchema = z.object({
  days: z.number().int().min(1).max(90).default(14),
});

async function summariesFor(context: { supabase: any; userId: string }, days: number) {
  const { orgId, org } = await requireAdminOrg(context.supabase, context.userId);
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data, error } = await context.supabase
    .from("daily_summaries")
    .select("*, profiles(full_name, job_role, departments(name))")
    .eq("org_id", orgId)
    .gte("date", since)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return { orgId, org, summaries: data ?? [] };
}

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => periodSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { orgId, org, summaries } = await summariesFor(context, data.days);

    const [{ data: profiles }, { data: devices }, { data: schedule }, { data: invites }] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("id, status, full_name, job_role, departments(name)")
          .eq("org_id", orgId),
        context.supabase
          .from("devices")
          .select(
            "id, name, os, agent_version, status, monitoring_state, last_heartbeat_at, last_sync_at, profiles(full_name, job_role, departments(name))",
          )
          .eq("org_id", orgId),
        context.supabase
          .from("monitoring_schedules")
          .select("*")
          .eq("org_id", orgId)
          .is("profile_id", null)
          .order("day_of_week"),
        context.supabase
          .from("invitations")
          .select("id, status")
          .eq("org_id", orgId)
          .in("status", ["pending", "sent"]),
      ]);

    const today = new Date().toISOString().slice(0, 10);
    const todayRows = summaries.filter((s: any) => s.date === today);
    const sum = (rows: any[], f: string) => rows.reduce((a: number, r: any) => a + (r[f] ?? 0), 0);

    const avg = (rows: any[], f: string) =>
      rows.length ? rows.reduce((a: number, r: any) => a + (r[f] ?? 0), 0) / rows.length : 0;

    const byDate = new Map<
      string,
      {
        date: string;
        productivity: number;
        focus: number;
        productive: number;
        distracted: number;
        idle: number;
      }
    >();
    for (const s of summaries as any[]) {
      const b = byDate.get(s.date) ?? {
        date: s.date,
        productivity: 0,
        focus: 0,
        productive: 0,
        distracted: 0,
        idle: 0,
      };
      b.productivity += s.productivity_score;
      b.focus += s.focus_score;
      b.productive += s.productive_seconds;
      b.distracted += s.distracted_seconds;
      b.idle += s.idle_seconds;
      byDate.set(s.date, b);
    }
    const counts = new Map<string, number>();
    for (const s of summaries as any[]) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    const trend = [...byDate.values()].map((b) => ({
      date: b.date,
      productivity: Math.round((b.productivity / (counts.get(b.date) ?? 1)) * 10) / 10,
      focus: Math.round((b.focus / (counts.get(b.date) ?? 1)) * 10) / 10,
      productive_hours: Math.round((b.productive / 3600) * 10) / 10,
      distracted_hours: Math.round((b.distracted / 3600) * 10) / 10,
      idle_hours: Math.round((b.idle / 3600) * 10) / 10,
    }));

    const perUser = new Map<string, any>();
    for (const s of summaries as any[]) {
      const u = perUser.get(s.profile_id) ?? {
        profile_id: s.profile_id,
        full_name: s.profiles?.full_name ?? "Unknown",
        job_role: s.profiles?.job_role ?? "",
        department: s.profiles?.departments?.name ?? "—",
        productive_seconds: 0,
        distracted_seconds: 0,
        neutral_seconds: 0,
        idle_seconds: 0,
        context_switches: 0,
        days: 0,
        score_sum: 0,
        focus_sum: 0,
      };
      u.productive_seconds += s.productive_seconds;
      u.distracted_seconds += s.distracted_seconds;
      u.neutral_seconds += s.neutral_seconds;
      u.idle_seconds += s.idle_seconds;
      u.context_switches += s.context_switches;
      u.score_sum += s.productivity_score;
      u.focus_sum += s.focus_score;
      u.days += 1;
      perUser.set(s.profile_id, u);
    }
    const userPerformance = [...perUser.values()]
      .map((u) => ({
        ...u,
        avg_productivity: Math.round((u.score_sum / Math.max(1, u.days)) * 10) / 10,
        avg_focus: Math.round((u.focus_sum / Math.max(1, u.days)) * 10) / 10,
      }))
      .sort((a, b) => b.avg_productivity - a.avg_productivity);

    return {
      org,
      kpis: {
        org_productivity: Math.round(avg(summaries as any[], "productivity_score") * 10) / 10,
        focus_score: Math.round(avg(summaries as any[], "focus_score") * 10) / 10,
        productive_seconds_today: sum(todayRows, "productive_seconds"),
        distracted_ratio: (() => {
          const p = sum(summaries as any[], "productive_seconds");
          const d = sum(summaries as any[], "distracted_seconds");
          const n = sum(summaries as any[], "neutral_seconds");
          return p + d + n > 0 ? Math.round((d / (p + d + n)) * 1000) / 10 : 0;
        })(),
        active_users: (profiles ?? []).filter((p: any) => p.status === "active").length,
        total_users: (profiles ?? []).length,
        devices_online: (devices ?? []).filter(
          (d: any) => d.monitoring_state === "active" || d.monitoring_state === "off_shift",
        ).length,
        total_devices: (devices ?? []).length,
        focus_seconds_today: sum(todayRows, "focus_seconds"),
        context_switches: sum(summaries as any[], "context_switches"),
        pending_invites: (invites ?? []).length,
      },
      trend,
      userPerformance,
      devices: devices ?? [],
      defaultSchedule: schedule ?? [],
    };
  });

export const getAppUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(14),
        profile_id: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = context.supabase
      .from("activity_sessions")
      .select("app_name, process_name, category, is_idle, duration_seconds, profile_id, profiles(full_name)")
      .eq("org_id", orgId)
      .gte("started_at", since);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: sessions, error } = await q;
    if (error) throw new Error(error.message);

    const byApp = new Map<string, any>();
    for (const s of sessions ?? []) {
      const normalizedName = normalizeAppName(s.app_name, s.process_name);
      const canonicalCategory = getCanonicalClassification(normalizedName);

      const a = byApp.get(normalizedName) ?? {
        app_name: normalizedName,
        process_name: s.process_name,
        category: canonicalCategory,
        total_seconds: 0,
        sessions: 0,
        users: new Set<string>(),
      };
      a.total_seconds += s.duration_seconds;
      a.sessions += 1;
      if (s.profiles?.full_name) a.users.add(s.profiles.full_name);
      byApp.set(normalizedName, a);
    }
    return [...byApp.values()]
      .map((a) => ({ ...a, users: a.users.size }))
      .sort((a, b) => b.total_seconds - a.total_seconds);
  });

export const getActivitySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(7),
        profile_id: z.string().uuid().optional(),
        device_id: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = context.supabase
      .from("activity_sessions")
      .select(
        "id, app_name, process_name, category, is_idle, started_at, duration_seconds, profile_id, device_id, profiles(id, full_name, email), devices(id, name, os)",
      )
      .eq("org_id", orgId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1000);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    if (data.device_id) q = q.eq("device_id", data.device_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => {
      const normalizedName = normalizeAppName(r.app_name, r.process_name);
      return {
        ...r,
        app_name: normalizedName,
        category: getCanonicalClassification(normalizedName),
        window_title: null, // Privacy: Always omit window titles
      };
    });
  });

export const getReportsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(1),
        profile_id: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { orgId, org } = await requireAdminOrg(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    let sessionsQ = context.supabase
      .from("activity_sessions")
      .select(
        "id, app_name, process_name, category, is_idle, started_at, duration_seconds, profile_id, device_id, profiles(id, full_name, email, job_role, departments(name)), devices(id, name, os)",
      )
      .eq("org_id", orgId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1000);

    if (data.profile_id) sessionsQ = sessionsQ.eq("profile_id", data.profile_id);

    let summariesQ = context.supabase
      .from("daily_summaries")
      .select("*, profiles(full_name, email, job_role)")
      .eq("org_id", orgId)
      .order("date", { ascending: false })
      .limit(300);

    if (data.profile_id) summariesQ = summariesQ.eq("profile_id", data.profile_id);

    const [{ data: rawSessions }, { data: summaries }] = await Promise.all([
      sessionsQ,
      summariesQ,
    ]);

    const sessions = (rawSessions ?? []).map((s: any) => {
      const normalizedName = normalizeAppName(s.app_name, s.process_name);
      return {
        ...s,
        app_name: normalizedName,
        category: getCanonicalClassification(normalizedName),
        window_title: null,
      };
    });

    const appMap = new Map<string, any>();
    let totalProductiveSec = 0;
    let totalDistractedSec = 0;
    let totalNeutralSec = 0;
    let totalIdleSec = 0;

    for (const s of sessions) {
      const dur = s.duration_seconds || 0;
      if (s.category === "productive") totalProductiveSec += dur;
      else if (s.category === "distracted") totalDistractedSec += dur;
      else totalNeutralSec += dur;
      if (s.is_idle) totalIdleSec += dur;

      const app = appMap.get(s.app_name) ?? {
        app_name: s.app_name,
        process_name: s.process_name,
        category: s.category,
        total_seconds: 0,
        count: 0,
      };
      app.total_seconds += dur;
      app.count += 1;
      appMap.set(s.app_name, app);
    }

    const appUsage = [...appMap.values()].sort((a, b) => b.total_seconds - a.total_seconds);

    return {
      org,
      sessions,
      summaries: summaries ?? [],
      appUsage,
      totals: {
        productive_seconds: totalProductiveSec,
        distracted_seconds: totalDistractedSec,
        neutral_seconds: totalNeutralSec,
        idle_seconds: totalIdleSec,
        total_sessions: sessions.length,
      },
    };
  });
