import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listAiReports, generateAiReport } from "@/lib/insights.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "AI Insights — VTAB SQUARE" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const queryClient = useQueryClient();
  const fetchReports = useServerFn(listAiReports);
  const runGenerate = useServerFn(generateAiReport);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-reports-full"],
    queryFn: () => fetchReports({ data: undefined }),
  });

  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await runGenerate({ data: { report_type: "weekly" } });
      toast.success("AI Insights generated successfully");
      queryClient.invalidateQueries({ queryKey: ["ai-reports-full"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Productivity Insights"
        description="Gemini-interpreted organizational patterns derived strictly from aggregated daily metrics."
        actions={
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate AI Insights"}
          </button>
        }
      />

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading AI reports…</div>
      ) : !data?.length ? (
        <EmptyState
          title="No AI reports generated yet"
          hint="Click 'Generate AI Insights' to interpret your team's aggregated productivity trends."
        />
      ) : (
        <div className="space-y-6">
          {data.map((r: any) => (
            <Card key={r.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {r.report_type.toUpperCase()} Organizational Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Period: {r.period_start} to {r.period_end} · Model: {r.model}
                  </p>
                </div>
                <Badge tone="primary">Confidence {(r.confidence * 100).toFixed(0)}%</Badge>
              </div>

              <p className="text-sm leading-relaxed text-foreground">{r.summary}</p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-success mb-2">
                    Strengths
                  </h4>
                  <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                    {(Array.isArray(r.strengths) ? r.strengths : []).map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-warning mb-2">
                    Concerns
                  </h4>
                  <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                    {(Array.isArray(r.concerns) ? r.concerns : []).map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
