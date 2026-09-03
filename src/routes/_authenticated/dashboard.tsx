import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getDashboardData, getLiveWorkEntries } from "@/lib/analytics.functions";
import { getMyOrganization } from "@/lib/org.functions";
import { PageHeader, Card, KpiCard, Badge, SelectField, EmptyState } from "@/components/primitives";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — VTAB SQUARE" },
      {
        name: "description",
        content: "Organization-wide productivity telemetry and monitoring status.",
      },
    ],
  }),
  component: DashboardPage,
});

const RANGE_OPTIONS = [
  { value: "1", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getCategoryBadge(row: any) {
  if (!row.is_online || row.category === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
        <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
        Offline
      </span>
    );
  }
  if (row.category === "idle") {
    return <Badge tone="warning">Idle</Badge>;
  }
  if (row.category === "productive") {
    return <Badge tone="success">Productive</Badge>;
  }
  if (row.category === "distracted" || row.category === "non-productive") {
    return <Badge tone="danger">Non-Productive</Badge>;
  }
  return <Badge tone="info">Neutral</Badge>;
}

function DashboardPage() {
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboardData);
  const fetchLiveWork = useServerFn(getLiveWorkEntries);
  const fetchOrganization = useServerFn(getMyOrganization);
  const [days, setDays] = useState("14");
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Real-time second counter for Running timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ["my-organization"],
    queryFn: () => fetchOrganization({ data: undefined }),
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", days],
    queryFn: () => fetchDashboard({ data: { days: Number(days) } }),
    enabled: Boolean(organization),
    retry: false,
  });

  // Single Source of Truth Live Work Query (polls every 3 seconds)
  const { data: liveRows, isLoading: isLiveLoading } = useQuery({
    queryKey: ["dashboard-live-work"],
    queryFn: () => fetchLiveWork({ data: undefined }),
    enabled: Boolean(organization),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!isOrganizationLoading && organization === null) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isOrganizationLoading, navigate, organization]);

  if (isOrganizationLoading || organization === null || isLoading)
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );

  if (!data)
    return (
      <EmptyState
        title="No organization configured yet"
        hint="Create your organization to start seeing telemetry."
      />
    );

  const { org, kpis } = data;

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Executive Overview"
        description={`${org.name} · monitoring during configured shifts only`}
        actions={<SelectField value={days} onChange={setDays} options={RANGE_OPTIONS} />}
      />

      {/* 1. KEEP EXISTING SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Org productivity" value={`${kpis.org_productivity}%`} />
        <KpiCard label="Focus score" value={`${kpis.focus_score}%`} />
        <KpiCard
          label="Active users"
          value={String(kpis.active_users)}
          sub={`of ${kpis.total_users} total`}
        />
        <KpiCard
          label="Devices live"
          value={String(kpis.devices_online)}
          sub={`of ${kpis.total_devices} enrolled`}
        />
        <KpiCard
          label="Productive Hours"
          value={`${Math.round(kpis.focus_seconds_today / 360) / 10}h`}
        />
        <KpiCard
          label="Pending invites"
          value={String(kpis.pending_invites)}
          sub={`${kpis.distracted_ratio}% distracted`}
        />
      </div>

      {/* 2 & 3. LIVE WORK TABLE WITH OFFLINE MONITORING STATE CONTROL */}
      <Card className="mt-6 p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between p-6 border-b border-border gap-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground uppercase">
              LIVE WORK
            </h2>
            <p className="text-xs text-muted-foreground">Active Employees</p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Live / Syncing</span>
          </div>
        </div>

        {isLiveLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading live work data…</div>
        ) : !liveRows?.length ? (
          <EmptyState
            title="No employee profiles found"
            hint="Add employees to your organization to view real-time live work status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                  <th className="px-6 py-3.5 whitespace-nowrap">Employee</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Application</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Category</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Running</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row: any) => {
                  const startedMs = row.started_at ? new Date(row.started_at).getTime() : null;
                  const elapsed = startedMs
                    ? Math.max(
                        row.duration_seconds || 0,
                        Math.floor((nowTimestamp - startedMs) / 1000),
                      )
                    : null;

                  return (
                    <tr
                      key={row.id || row.profile_id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap">
                        {row.employee_name}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                        {row.is_online ? row.app_name : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getCategoryBadge(row)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-foreground whitespace-nowrap">
                        {row.is_online && elapsed !== null ? formatDuration(elapsed) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
