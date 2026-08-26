import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminOrg, audit } from "./admin.server";

export const listAiReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ai_reports")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Generates a Gemini interpretation of already-aggregated daily summaries.
 * Only aggregate metrics are sent — never raw window titles or sessions.
 * Base productivity scores are computed deterministically elsewhere.
 */
export const generateAiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        report_type: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
        profile_id: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireAdminOrg(context.supabase, context.userId);
    const days = data.report_type === "daily" ? 1 : data.report_type === "weekly" ? 7 : 30;
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - days * 86400_000);

    let q = context.supabase
      .from("daily_summaries")
      .select("date, profile_id, productive_seconds, neutral_seconds, distracted_seconds, idle_seconds, focus_seconds, focus_score, context_switches, productivity_score, profiles(full_name, departments(name))")
      .eq("org_id", orgId)
      .gte("date", periodStart.toISOString().slice(0, 10))
      .order("date", { ascending: true });
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: summaries, error } = await q;
    if (error) throw new Error(error.message);
    if (!summaries?.length) throw new Error("No summary data in this period yet.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI gateway is not configured.");

    const prompt = [
      "You are an organizational productivity analyst. Interpret these AGGREGATED daily summaries (no raw activity was or should be shared).",
      "Do not recompute scores. Respond ONLY with strict JSON: {summary, strengths[], concerns[], patterns[], recommendations[], confidence (0-1)}.",
      `Report type: ${data.report_type}. Period: ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}.`,
      "Data:",
      JSON.stringify(summaries),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output only valid JSON, no markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI gateway error: ${res.status}`);
    const completion = await res.json();
    const text: string = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const { data: report, error: insertError } = await context.supabase
      .from("ai_reports")
      .insert({
        org_id: orgId,
        profile_id: data.profile_id ?? null,
        report_type: data.report_type,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        summary: String(parsed.summary ?? ""),
        strengths: parsed.strengths ?? [],
        concerns: parsed.concerns ?? [],
        patterns: parsed.patterns ?? [],
        recommendations: parsed.recommendations ?? [],
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        model: "google/gemini-2.5-flash",
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);

    await audit(context.supabase, {
      orgId,
      actorId: context.userId,
      actorEmail: context.claims.email ?? "unknown",
      action: "ai_report.generated",
      entityType: "ai_report",
      entityId: report.id,
      metadata: { report_type: data.report_type },
    });
    return report;
  });
