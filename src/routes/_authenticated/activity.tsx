import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getActivitySessions, getAppUsage } from "@/lib/analytics.functions";
import { listUsers } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { User, Monitor, Clock, RefreshCw, Check, AlertTriangle, AppWindow, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Timeline — Aetherium" }] }),
  component: ActivityPage,
});

function categoryTone(cat: string) {
  return cat === "productive" ? "success" : cat === "distracted" ? "danger" : "info";
}

function ActivityPage() {
  const fetchActivity = useServerFn(getActivitySessions);
  const fetchApps = useServerFn(getAppUsage);
  const fetchUsers = useServerFn(listUsers);

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const [activeTab, setActiveTab] = useState<"activity" | "applications">("activity");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<number>(1);

  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  const activeUser = selectedUserId !== "all" ? usersData?.find((u: any) => u.id === selectedUserId) : null;
  const userDevices = activeUser?.devices ?? [];

  useEffect(() => {
    if (selectedUserId === "all") {
      setSelectedDeviceId("all");
    } else if (selectedDeviceId !== "all" && !userDevices.some((d: any) => d.id === selectedDeviceId)) {
      setSelectedDeviceId("all");
    }
  }, [selectedUserId, userDevices, selectedDeviceId]);

  const {
    data: sessionsData,
    isLoading: isSessionsLoading,
    isRefetching,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["activity-sessions", selectedUserId, selectedDeviceId, daysRange],
    queryFn: () =>
      fetchActivity({
        data: {
          profile_id: selectedUserId !== "all" ? selectedUserId : undefined,
          device_id: selectedDeviceId !== "all" ? selectedDeviceId : undefined,
          days: daysRange,
        },
      }),
  });

  const {
    data: appData,
    isLoading: isAppsLoading,
    refetch: refetchApps,
  } = useQuery({
    queryKey: ["app-usage", selectedUserId, daysRange],
    queryFn: () =>
      fetchApps({
        data: {
          profile_id: selectedUserId !== "all" ? selectedUserId : undefined,
          days: daysRange,
        },
      }),
  });

  async function handleLiveSync() {
    setSyncStatus("syncing");
    try {
      await Promise.all([refetchSessions(), refetchApps()]);
      setSyncStatus("synced");
      setLastSyncedTime("Just now");
      setTimeout(() => setSyncStatus("idle"), 4000);
    } catch (err) {
      setSyncStatus("error");
      toast.error("Synchronization failed. Please try again.");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }

  // Calculate Chart Data
  let productiveSec = 0;
  let distractedSec = 0;
  let idleSec = 0;

  (sessionsData ?? []).forEach((s: any) => {
    const dur = s.duration_seconds || 0;
    if (s.is_idle) {
      idleSec += dur;
    } else if (s.category === "productive") {
      productiveSec += dur;
    } else if (s.category === "distracted") {
      distractedSec += dur;
    }
  });

  const pieData = [
    { name: "Productive", value: productiveSec, color: "#10b981" },
    { name: "Non-Productive", value: distractedSec, color: "#ef4444" },
    { name: "Idle", value: idleSec, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const barData = (appData ?? [])
    .slice(0, 7)
    .map((app: any) => ({
      name: app.app_name,
      Hours: Number((app.total_seconds / 3600).toFixed(2)),
    }));

  const selectedDeviceObj = userDevices.find((d: any) => d.id === selectedDeviceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Activity & Applications"
          description="Application-level activity telemetry and usage analytics."
        />

        <div className="flex items-center gap-3">
          {lastSyncedTime && (
            <span className="text-xs text-muted-foreground font-medium">Last synced: {lastSyncedTime}</span>
          )}
          <button
            onClick={handleLiveSync}
            disabled={syncStatus === "syncing" || isRefetching}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {syncStatus === "syncing" || isRefetching ? (
              <>
                <RefreshCw className="size-3.5 animate-spin text-primary" />
                <span>⟳ Syncing...</span>
              </>
            ) : syncStatus === "synced" ? (
              <>
                <Check className="size-3.5 text-success" />
                <span className="text-success font-medium">✓ Synced</span>
              </>
            ) : syncStatus === "error" ? (
              <>
                <AlertTriangle className="size-3.5 text-danger" />
                <span className="text-danger font-medium">⚠ Sync Failed</span>
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5 text-muted-foreground" />
                <span>↻ Live Sync</span>
              </>
            )}
          </button>
        </div>
      </div>

      <Card className="p-4 bg-card/80 border-border/80 backdrop-blur-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User:</label>
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

            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workstation:</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                disabled={selectedUserId === "all" || !userDevices.length}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">
                  {selectedUserId === "all"
                    ? "All Workstations"
                    : userDevices.length
                      ? `All Assigned Devices (${userDevices.length})`
                      : "No Devices Enrolled"}
                </option>
                {userDevices.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.os || "Windows"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period:</label>
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

          <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
            <div>
              <span className="text-muted-foreground">Scope: </span>
              <span className="font-semibold text-foreground">{activeUser ? activeUser.full_name : "All Users"}</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Workstation: </span>
              <span className="font-semibold text-foreground">
                {selectedDeviceId !== "all" && selectedDeviceObj
                  ? selectedDeviceObj.name
                  : selectedUserId !== "all" && userDevices.length
                    ? `${userDevices.length} Enrolled`
                    : "All Workstations"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 flex flex-col">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <AppWindow className="size-4 text-primary" />
            Top Application Usage
          </h3>
          <div className="flex-1 min-h-[250px]">
            {isAppsLoading ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                Loading chart...
              </div>
            ) : barData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val.length > 10 ? val.substring(0, 10) + "..." : val)}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#1e293b" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f8fafc",
                    }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Bar
                    dataKey="Hours"
                    fill="url(#colorHours)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 flex flex-col">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Time Allocation
          </h3>
          <div className="flex-1 min-h-[250px]">
            {isSessionsLoading ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                Loading chart...
              </div>
            ) : pieData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f8fafc",
                    }}
                    itemStyle={{ color: "#f8fafc" }}
                    formatter={(value: number) => [
                      `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`,
                      "Duration",
                    ]}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={1500}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border">
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "activity"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Activity className="size-4" />
          Activity Timeline
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "applications"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <AppWindow className="size-4" />
          Application Usage
        </button>
      </div>

      {/* Tables */}
      <Card className="p-0 overflow-hidden">
        {activeTab === "activity" ? (
          isSessionsLoading || isUsersLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading activity logs…</div>
          ) : !sessionsData?.length ? (
            <EmptyState
              title={`No activity sessions in the ${daysRange === 1 ? "last 24 hours" : `last ${daysRange} days`}`}
              hint={
                activeUser
                  ? `No application activity logged for ${activeUser.full_name}. Ensure the desktop agent is active.`
                  : "Application usage captured by desktop agents will appear here."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                    <th className="px-6 py-3.5 whitespace-nowrap">Timestamp</th>
                    <th className="px-6 py-3.5 whitespace-nowrap">User / Device</th>
                    <th className="px-6 py-3.5 whitespace-nowrap">Application</th>
                    <th className="px-6 py-3.5 whitespace-nowrap">Classification</th>
                    <th className="px-6 py-3.5 text-right whitespace-nowrap">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsData.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(s.started_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground whitespace-nowrap">
                        {s.profiles?.full_name ?? "User"}
                        <p className="text-xs text-muted-foreground">{s.devices?.name ?? "Workstation"}</p>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-foreground whitespace-nowrap">{s.app_name}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <Badge tone={s.is_idle ? "warning" : categoryTone(s.category)}>
                          {s.is_idle ? "idle" : s.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs font-mono font-medium text-foreground whitespace-nowrap">
                        {Math.floor((s.duration_seconds || 0) / 60)}m {(s.duration_seconds || 0) % 60}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : isAppsLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading application metrics…</div>
        ) : !appData?.length ? (
          <EmptyState
            title={`No application telemetry in the ${daysRange === 1 ? "last 24 hours" : `last ${daysRange} days`}`}
            hint="Application usage recorded during active shift hours will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                  <th className="px-6 py-3.5 whitespace-nowrap">Application</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Classification</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Active Users</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Total Duration</th>
                </tr>
              </thead>
              <tbody>
                {appData.map((app: any, idx: number) => (
                  <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-foreground flex items-center gap-2 whitespace-nowrap">
                      <AppWindow className="size-4 text-primary/80" />
                      <span>{app.app_name}</span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <Badge tone={categoryTone(app.category)}>{app.category}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground text-xs font-medium whitespace-nowrap">
                      {app.users} member{app.users === 1 ? "" : "s"}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs font-medium text-foreground whitespace-nowrap">
                      {(app.total_seconds / 3600).toFixed(1)} hrs ({Math.round(app.total_seconds / 60)} mins)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
