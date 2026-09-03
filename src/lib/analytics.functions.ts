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
        full_name: s.profiles?.full_name ?? "User",
        department: s.profiles?.departments?.name ?? "General",
        prod_sum: 0,
        focus_sum: 0,
        count: 0,
        switches: 0,
      };
      u.prod_sum += s.productivity_score;
      u.focus_sum += s.focus_score;
      u.count += 1;
      u.switches += s.context_switches ?? 0;
      perUser.set(s.profile_id, u);
    }
    const userPerformance = [...perUser.values()].map((u) => ({
      profile_id: u.profile_id,
      full_name: u.full_name,
      department: u.department,
      avg_productivity: Math.round((u.prod_sum / u.count) * 10) / 10,
      avg_focus: Math.round((u.focus_sum / u.count) * 10) / 10,
      context_switches: u.switches,
    }));

    const totalSecsToday = sum(todayRows, "productive_seconds") + sum(todayRows, "distracted_seconds") + sum(todayRows, "idle_seconds");
    const distractedRatio = totalSecsToday > 0 ? Math.round((sum(todayRows, "distracted_seconds") / totalSecsToday) * 100) : 0;

    return {
      org,
      kpis: {
        org_productivity: Math.round(avg(todayRows, "productivity_score")),
        focus_score: Math.round(avg(todayRows, "focus_score")),
        active_users: (profiles ?? []).filter((p: any) => p.status === "active").length,
        total_users: (profiles ?? []).length,
        devices_online: (devices ?? []).filter(
          (d: any) =>
            d.last_heartbeat_at &&
            Date.now() - new Date(d.last_heartbeat_at).getTime() < 120_000,
        ).length,
        total_devices: (devices ?? []).length,
        focus_seconds_today: sum(todayRows, "productive_seconds"),
        pending_invites: (invites ?? []).length,
        distracted_ratio: distractedRatio,
      },
      trend,
      userPerformance,
      schedule: schedule ?? [],
    };
  });

export const getAppUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        days: z.number().int().min(1).max(90).default(7),
        profile_id: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let q = context.supabase
      .from("activity_sessions")
      .select("app_name, process_name, category, duration_seconds, profiles(full_name)")
      .eq("org_id", orgId)
      .gte("started_at", since);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: sessions, error } = await q;
    if (error) throw new Error(error.message);

    const byApp = new Map<
      string,
      { app_name: string; category: string; total_seconds: number; users: Set<string> }
    >();
    for (const s of sessions as any[]) {
      const normalizedName = normalizeAppName(s.app_name, s.process_name);
      const category = getCanonicalClassification(normalizedName);
      const a = byApp.get(normalizedName) ?? {
        app_name: normalizedName,
        category,
        total_seconds: 0,
        users: new Set<string>(),
      };
      a.total_seconds += s.duration_seconds || 0;
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

export const getLiveWorkEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);

    // 1. Fetch profiles in organization
    const { data: profiles, error: profileErr } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("org_id", orgId)
      .order("full_name", { ascending: true });

    if (profileErr) throw new Error(profileErr.message);

    const profileIds = (profiles ?? []).map((p: any) => p.id);
    if (!profileIds.length) return [];

    // 2. Fetch devices and recent activity sessions
    const since24h = new Date(Date.now() - 86400_000).toISOString();
    const [{ data: devices }, { data: sessions }] = await Promise.all([
      context.supabase
        .from("devices")
        .select("id, profile_id, status, monitoring_state, last_heartbeat_at")
        .eq("org_id", orgId)
        .in("profile_id", profileIds),
      context.supabase
        .from("activity_sessions")
        .select("id, profile_id, device_id, app_name, process_name, category, is_idle, started_at, duration_seconds")
        .eq("org_id", orgId)
        .gte("started_at", since24h)
        .order("started_at", { ascending: false }),
    ]);

    const now = Date.now();

    // Map each profile to their single live work record
    return (profiles ?? []).map((profile: any) => {
      const userDevices = (devices ?? []).filter((d: any) => d.profile_id === profile.id);

      // A device is online if heartbeat is within 2 minutes and not offline/revoked
      const activeOnlineDevice = userDevices.find((d: any) => {
        if (!d.last_heartbeat_at) return false;
        const hbAge = now - new Date(d.last_heartbeat_at).getTime();
        const isRecent = hbAge < 120_000;
        const isStateActive = d.status === "active" && d.monitoring_state !== "offline" && d.monitoring_state !== "revoked";
        return isRecent && isStateActive;
      });

      const latestSession = (sessions ?? []).find((s: any) => s.profile_id === profile.id);
      const isOnline = Boolean(activeOnlineDevice);

      // OFFLINE STATE: When device is offline, category is "offline", app is "—", running is "—"
      if (!isOnline || !latestSession) {
        return {
          id: `offline-${profile.id}`,
          profile_id: profile.id,
          employee_name: profile.full_name || profile.email || "Employee",
          app_name: "—",
          category: "offline",
          is_online: false,
          started_at: null,
          duration_seconds: null,
        };
      }

      // ONLINE STATE: Current application, category, and duration
      const normalizedName = normalizeAppName(latestSession.app_name, latestSession.process_name);
      const cat = latestSession.is_idle
        ? "idle"
        : getCanonicalClassification(normalizedName);

      return {
        id: latestSession.id,
        profile_id: profile.id,
        employee_name: profile.full_name || profile.email || "Employee",
        app_name: normalizedName,
        category: cat,
        is_online: true,
        started_at: latestSession.started_at,
        duration_seconds: latestSession.duration_seconds || 0,
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
