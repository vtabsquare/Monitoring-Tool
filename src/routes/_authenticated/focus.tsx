import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/analytics.functions";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/primitives";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({ meta: [{ title: "Focus Analytics — Aetherium" }] }),
  component: FocusPage,
});

function FocusPage() {
  const fetchDashboard = useServerFn(getDashboardData);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-focus"],
    queryFn: () => fetchDashboard({ data: { days: 14 } }),
  });

  return (
    <div>
      <PageHeader
        title="Focus & Deep Work Analytics"
        description="Deterministic focus metrics, context switching telemetry, and distraction ratios."
      />

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading focus metrics…</div>
      ) : !data ? (
        <EmptyState title="No focus telemetry available" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Org Focus Score" value={`${data.kpis.focus_score}%`} />
            <KpiCard label="Context Switches" value={String(data.kpis.context_switches)} />
            <KpiCard label="Distraction Ratio" value={`${data.kpis.distracted_ratio}%`} />
            <KpiCard
              label="Focus Hours Today"
              value={`${(data.kpis.focus_seconds_today / 3600).toFixed(1)}h`}
            />
          </div>

          <Card>
            <h3 className="text-sm font-semibold text-foreground">User Focus Performance</h3>
            <p className="text-xs text-muted-foreground mb-4">Ranked by average focus score</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Avg Focus Score</th>
                  <th className="px-4 py-2">Avg Productivity</th>
                  <th className="px-4 py-2 text-right">Context Switches</th>
                </tr>
              </thead>
              <tbody>
                {data.userPerformance.map((u: any) => (
                  <tr
                    key={u.profile_id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.full_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.department}</td>
                    <td className="px-4 py-2.5 font-semibold text-success">{u.avg_focus}%</td>
                    <td className="px-4 py-2.5 text-primary">{u.avg_productivity}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {u.context_switches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
