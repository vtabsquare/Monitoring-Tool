import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDashboardData } from "@/lib/analytics.functions";
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
  const [days, setDays] = useState("7");
  const [dept, setDept] = useState("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["dashboard", days, dept],
    queryFn: () => fetchDashboard({ data: { days: Number(days), departmentId: dept || undefined } }),
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

  const { org, kpis, departments, trend, categorySplit, topApps, aiPulse } = data;
  const deptOptions = [
    { value: "", label: "All departments" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];
  const pie = [
    { name: "Productive", value: categorySplit.productive },
    { name: "Neutral", value: categorySplit.neutral },
    { name: "Distracted", value: categorySplit.distracted },
  ];
  const pieTotal = pie.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <PageHeader
        title="Executive Overview"
        description={`${org.name} · monitoring during configured shifts only`}
        actions={
          <>
            <SelectField value={dept} onChange={setDept} options={deptOptions} />
            <SelectField value={days} onChange={setDays} options={RANGE_OPTIONS} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Avg productivity" value={`${kpis.avgProductivity}%`} />
        <KpiCard label="Avg focus" value={`${kpis.avgFocus}%`} />
        <KpiCard label="Active users" value={String(kpis.activeUsers)} sub={`of ${kpis.totalUsers} total`} />
        <KpiCard label="Devices live" value={String(kpis.devicesLive)} sub={`of ${kpis.devicesTotal} enrolled`} />
        <KpiCard label="Focus time" value={`${kpis.focusHours}h`} />
        <KpiCard
          label="Pending invites"
          value={String(kpis.pendingInvites)}
          sub={kpis.devicesPaused > 0 ? `${kpis.devicesPaused} device(s) paused` : "Fleet nominal"}
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
                      <Cell key={i} fill={CATEGORY_COLORS[i]} />
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
              <BarChart data={departments.filter((d) => d.memberCount > 0)} margin={{ left: -20, right: 8, top: 8 }}>
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
          {aiPulse.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No insights yet" hint="Insights are generated from aggregated summaries." />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {aiPulse.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <Badge tone={r.scope === "org" ? "primary" : "info"}>{r.scope}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.summary}</p>
                  {r.recommendations[0] && (
                    <p className="mt-2 border-l-2 border-primary/50 pl-3 text-xs text-foreground/80">
                      {r.recommendations[0]}
                    </p>
                  )}
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
