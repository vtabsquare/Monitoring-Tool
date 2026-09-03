import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAppUsage } from "@/lib/analytics.functions";
import { listUsers } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { User, AppWindow, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — Aetherium" }] }),
  component: ApplicationsPage,
});

function categoryTone(cat: string) {
  return cat === "productive" ? "success" : cat === "distracted" ? "danger" : "info";
}

function ApplicationsPage() {
  const fetchApps = useServerFn(getAppUsage);
  const fetchUsers = useServerFn(listUsers);

  // Default selection must always be "all" and period "1" (Last 24 Hours)
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<number>(1);

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const { data: appData, isLoading: isAppsLoading } = useQuery({
    queryKey: ["app-usage", selectedUserId, daysRange],
    queryFn: () =>
      fetchApps({
        data: {
          profile_id: selectedUserId !== "all" ? selectedUserId : undefined,
          days: daysRange,
        },
      }),
  });

  const activeUser = selectedUserId !== "all" ? usersData?.find((u: any) => u.id === selectedUserId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Inventory & Usage"
        description="Aggregated usage metrics, canonical application tracking, and productivity classification."
      />

      {/* Filter / User Selection Bar */}
      <Card className="p-4 bg-card/80 border-border/80 backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* User Selector Dropdown (Default: All Users) */}
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User:
              </label>
              {isUsersLoading ? (
                <div className="h-8 w-36 animate-pulse rounded bg-muted" />
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Users</option>
                  {usersData?.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Time Window Selector (Default: Last 24 Hours) */}
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Period:
              </label>
              <select
                value={daysRange}
                onChange={(e) => setDaysRange(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>Last 24 Hours</option>
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Active Context Banner */}
          <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
            <div>
              <span className="text-muted-foreground">Scope: </span>
              <span className="font-semibold text-foreground">
                {activeUser ? activeUser.full_name : "All Users"}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Applications Tracked: </span>
              <span className="font-semibold text-primary">{appData?.length ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Application-Level Usage Table (Strictly 4 Columns) */}
      <Card className="p-0 overflow-hidden">
        {isAppsLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading application metrics…
          </div>
        ) : !appData?.length ? (
          <EmptyState
            title={`No application telemetry in the ${daysRange === 1 ? "last 24 hours" : `last ${daysRange} days`}`}
            hint="Application usage recorded during active shift hours will appear here."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                <th className="px-6 py-3.5">Application</th>
                <th className="px-6 py-3.5">Classification</th>
                <th className="px-6 py-3.5">Active Users</th>
                <th className="px-6 py-3.5 text-right">Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {appData.map((app: any, idx: number) => (
                <tr
                  key={idx}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-3.5 font-semibold text-foreground flex items-center gap-2">
                    <AppWindow className="size-4 text-primary/80" />
                    <span>{app.app_name}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge tone={categoryTone(app.category)}>{app.category}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs font-medium">
                    {app.users} member{app.users === 1 ? "" : "s"}
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-xs font-medium text-foreground">
                    {(app.total_seconds / 3600).toFixed(1)} hrs ({Math.round(app.total_seconds / 60)} mins)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
