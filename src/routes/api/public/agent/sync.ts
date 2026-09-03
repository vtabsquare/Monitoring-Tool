import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateDevice } from "@/lib/agent.server";
import { computeDailyMetrics, type RawSession } from "@/lib/metrics";
import { normalizeAppName, getCanonicalClassification } from "@/lib/app-mapping";

/**
 * POST /api/public/agent/sync
 * Batch upload of application-level activity sessions collected during monitoring hours.
 * Enforces privacy (no window titles/tab names) and applies centralized app-mapping and canonical classification.
 */
const sessionSchema = z.object({
  app_name: z.string().min(1).max(200),
  process_name: z.string().max(200).nullable().optional(),
  window_title: z.string().max(500).nullable().optional(),
  category: z.enum(["productive", "neutral", "distracted"]).optional(),
  is_idle: z.boolean().default(false),
  started_at: z.string().min(10).max(60),
  duration_seconds: z.number().int().min(0).max(86400),
});

const bodySchema = z.object({
  sessions: z.array(sessionSchema).min(1).max(2000),
});

export const Route = createFileRoute("/api/public/agent/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const result = await authenticateDevice(request);
        if ("error" in result && result.error) return result.error;
        const { device, supabaseAdmin } = result as Exclude<typeof result, { error: Response }>;
        if (device.status !== "active")
          return Response.json(
            { error: "Device not active", code: "DEVICE_" + device.status.toUpperCase() },
            { status: 403 },
          );

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

        const rows = parsed.data.sessions.map((s) => {
          const normalized = normalizeAppName(s.app_name, s.process_name);
          const canonicalCategory = getCanonicalClassification(normalized);

          return {
            org_id: device.org_id,
            profile_id: device.profile_id,
            device_id: device.id,
            app_name: normalized,
            process_name: s.process_name ?? null,
            window_title: null, // Privacy: Always store null for window title
            category: canonicalCategory,
            is_idle: s.is_idle,
            started_at: s.started_at,
            duration_seconds: s.duration_seconds,
          };
        });

        const { error } = await supabaseAdmin.from("activity_sessions").insert(rows);
        if (error) return Response.json({ error: "Sync failed" }, { status: 500 });

        // Recompute daily summaries for affected dates.
        const byDate = new Map<string, RawSession[]>();
        for (const r of rows) {
          const d = r.started_at.slice(0, 10);
          const list = byDate.get(d) ?? [];
          list.push(r as any);
          byDate.set(d, list);
        }

        for (const [date, batch] of byDate) {
          const dayStart = new Date(date + "T00:00:00Z").toISOString();
          const dayEnd = new Date(date + "T23:59:59Z").toISOString();
          const { data: all } = await supabaseAdmin
            .from("activity_sessions")
            .select("app_name, category, is_idle, started_at, duration_seconds")
            .eq("device_id", device.id)
            .gte("started_at", dayStart)
            .lte("started_at", dayEnd);
          const metrics = computeDailyMetrics((all ?? batch) as RawSession[]);
          await supabaseAdmin.from("daily_summaries").upsert(
            {
              org_id: device.org_id,
              profile_id: device.profile_id,
              date,
              ...metrics,
            },
            { onConflict: "profile_id,date" },
          );
        }

        await supabaseAdmin
          .from("devices")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", device.id);

        return Response.json({ ok: true, accepted: rows.length, days_updated: byDate.size });
      },
    },
  },
});
