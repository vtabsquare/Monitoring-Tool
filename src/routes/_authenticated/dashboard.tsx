import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDashboardData, getAppUsage } from "@/lib/analytics.functions";
import { listAiReports } from "@/lib/insights.functions";
import { PageHeader, Card, KpiCard, Badge, SelectField, EmptyState } from "@/components/primitives";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aetherium" },
      { name: "description", content: "Organization-wide productivity telemetry and monitoring status." },
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
const CATEGORY_COLORS = ["#2EE59D", "#6EA8FE", "#FF6B6B"];

function DashboardPage() {
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboardData);
  const fetchApps = useServerFn(getAppUsage);
  const fetchReports = useServerFn(listAiReports);
  const [days, setDays] = useState("14");

  const { data, error, isLoading } = useQuery({
    queryKey: ["dashboard", days],
    queryFn: () => fetchDashboard({ data: { days: Number(days) } }),
  });
  const { data: apps } = useQuery({
    queryKey: ["apps", days],
    queryFn: () => fetchApps({ data: { days: Number(days) } }),
  });
  const { data: aiPulse } = useQuery({
    queryKey: ["ai-reports"],
    queryFn: () => fetchReports({ data: undefined }),
  });

  useEffect(() => {
    if (error && error.message === "No organization") navigate({ to: "/onboarding" });
  }, [error, navigate]);

  if (isLoading)
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

  const { org, kpis, trend, userPerformance } = data;

  // Department comparison derived from per-user aggregates
  const deptMap = new Map<string, { name: string; prod: number; focus: number; members: number }>();
  for (const u of userPerformance) {
    const d = deptMap.get(u.department) ?? { name: u.department, prod: 0, focus: 0, members: 0 };
    d.prod += u.avg_productivity;
    d.focus += u.avg_focus;
    d.members += 1;
    deptMap.set(u.department, d);
  }
  const departments = [...deptMap.values()].map((d) => ({
    name: d.name,
    avgProductivity: Math.round(d.prod / d.members),
    avgFocus: Math.round(d.focus / d.members),
  }));

  const pie = [
    { name: "Productive", value: Math.round(trend.reduce((s, t) => s + t.productive_hours, 0)) },
    { name: "Distracted", value: Math.round(trend.reduce((s, t) => s + t.distracted_hours, 0)) },
    { name: "Idle", value: Math.round(trend.reduce((s, t) => s + t.idle_hours, 0)) },
  ];
  const pieTotal = pie.reduce((s, p) => s + p.value, 0);

  const topApps = (apps ?? []).slice(0, 8).map((a) => ({
    app_name: a.app_name,
    hours: Math.round((a.total_seconds / 3600) * 10) / 10,
  }));

  return (
    <div>
      <PageHeader
        title="Executive Overview"
        description={`${org.name} · monitoring during configured shifts only`}
        actions={<SelectField value={days} onChange={setDays} options={RANGE_OPTIONS} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Org productivity" value={`${kpis.org_productivity}%`} />
        <KpiCard label="Focus score" value={`${kpis.focus_score}%`} />
        <KpiCard label="Active users" value={String(kpis.active_users)} sub={`of ${kpis.total_users} total`} />
        <KpiCard label="Devices live" value={String(kpis.devices_online)} sub={`of ${kpis.total_devices} enrolled`} />
        <KpiCard label="Focus time today" value={`${Math.round(kpis.focus_seconds_today / 360) / 10}h`} />
        <KpiCard
          label="Pending invites"
          value={String(kpis.pending_invites)}
          sub={`${kpis.distracted_ratio}% distracted`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">Productivity trend</h3>
          <p className="text-xs text-muted-foreground">Daily organization average, percent</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#1F242B" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#12151A", border: "1px solid #1F242B", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#9CA3AF" }}
                />
                <Area type="monotone" dataKey="productivity" stroke="#6EA8FE" strokeWidth={2} fill="#6EA8FE" fillOpacity={0.12} />
                <Area type="monotone" dataKey="focus" stroke="#2EE59D" strokeWidth={1.5} fill="#2EE59D" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground">Time allocation</h3>
          <p className="text-xs text-muted-foreground">Hours by category</p>
          <div className="mt-4 h-72">
            {pieTotal === 0 ? (
              <EmptyState title="No activity in range" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={60} outerRadius={90} strokeWidth={0}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    formatter={(v: string) => <span style={{ color: "#9CA3AF", fontSize: 11 }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: "#12151A", border: "1px solid #1F242B", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-foreground">Department comparison</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={departments} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#1F242B" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#12151A", border: "1px solid #1F242B", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "#1F242B", opacity: 0.3 }}
                />
                <Bar dataKey="avgProductivity" name="Productivity" fill="#6EA8FE" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgFocus" name="Focus" fill="#2EE59D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground">AI pulse</h3>
          <p className="text-xs text-muted-foreground">
            Interpreted from aggregated daily summaries — never raw activity
          </p>
          {!aiPulse?.length ? (
            <div className="mt-4">
              <EmptyState title="No insights yet" hint="Generate one from the AI Insights page." />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {aiPulse.slice(0, 3).map((r: any) => (
                <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <Badge tone={r.scope === "org" ? "primary" : "info"}>{r.scope}</Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.summary}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">Top applications</h3>
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <BarChart data={topApps} layout="vertical" margin={{ left: 60, right: 24, top: 0 }}>
              <CartesianGrid stroke="#1F242B" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="app_name"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{ background: "#12151A", border: "1px solid #1F242B", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "#1F242B", opacity: 0.3 }}
              />
              <Bar dataKey="hours" name="Hours" fill="#4F7CFF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
