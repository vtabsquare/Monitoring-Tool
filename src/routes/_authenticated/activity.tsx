import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getActivitySessions } from "@/lib/analytics.functions";
import { listUsers } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { User, Monitor, Clock, RefreshCw, Check, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Timeline — Aetherium" }] }),
  component: ActivityPage,
});

function categoryTone(cat: string) {
  return cat === "productive" ? "success" : cat === "distracted" ? "danger" : "info";
}

function ActivityPage() {
  const fetchActivity = useServerFn(getActivitySessions);
  const fetchUsers = useServerFn(listUsers);

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  // Default selection must always be "all" and period "1" (Last 24 Hours)
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [daysRange, setDaysRange] = useState<number>(1);

  // Live Sync Status State
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  const activeUser = selectedUserId !== "all" ? usersData?.find((u: any) => u.id === selectedUserId) : null;
  const userDevices = activeUser?.devices ?? [];

  // Reset device selection when switching users if selected device doesn't belong to new user
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
    refetch,
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

  async function handleLiveSync() {
    setSyncStatus("syncing");
    try {
      await refetch();
      setSyncStatus("synced");
      setLastSyncedTime("Just now");
      setTimeout(() => {
        setSyncStatus("idle");
      }, 4000);
    } catch (err) {
      setSyncStatus("error");
      toast.error("Synchronization failed. Please try again.");
      setTimeout(() => {
        setSyncStatus("idle");
      }, 4000);
    }
  }

  const totalProductiveSeconds = (sessionsData ?? []).reduce(
    (acc: number, s: any) => (s.category === "productive" ? acc + (s.duration_seconds || 0) : acc),
    0,
  );

  const selectedDeviceObj = userDevices.find((d: any) => d.id === selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Page Header & Live Sync Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Activity Log & Timeline"
          description="Application-level activity telemetry captured during active shift hours."
        />

        {/* Live Sync Control */}
        <div className="flex items-center gap-3">
          {lastSyncedTime && (
            <span className="text-xs text-muted-foreground font-medium">
              Last synced: {lastSyncedTime}
            </span>
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

      {/* Filter & Selection Control Bar */}
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

            {/* Workstation / Device Selector Dropdown */}
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workstation:
              </label>
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

          {/* Telemetry Summary Badge */}
          <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
            <div>
              <span className="text-muted-foreground">Scope: </span>
              <span className="font-semibold text-foreground">
                {activeUser ? activeUser.full_name : "All Users"}
              </span>
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
            <div className="h-3 w-px bg-border" />
            <div>
              <span className="text-muted-foreground">Productive Focus: </span>
              <span className="font-semibold text-success">
                {Math.round(totalProductiveSeconds / 60)} mins
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Application-Level Activity Log Table */}
      <Card className="p-0 overflow-hidden">
        {isSessionsLoading || isUsersLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading activity logs…
          </div>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">User / Device</th>
                <th className="px-6 py-3.5">Application</th>
                <th className="px-6 py-3.5">Classification</th>
                <th className="px-6 py-3.5 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {sessionsData.map((s: any) => (
                <tr
                  key={s.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-3.5 text-xs text-muted-foreground font-mono">
                    {new Date(s.started_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 font-medium text-foreground">
                    {s.profiles?.full_name ?? "User"}
                    <p className="text-xs text-muted-foreground">
                      {s.devices?.name ?? "Workstation"}
                    </p>
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-foreground">{s.app_name}</td>
                  <td className="px-6 py-3.5">
                    <Badge tone={categoryTone(s.category)}>{s.category}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right text-xs font-mono font-medium text-foreground">
                    {Math.round(s.duration_seconds / 60)}m {s.duration_seconds % 60}s
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
