import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listDevices, deviceAction } from "@/lib/devices.functions";
import { listUsers } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { User, Monitor, Laptop, Trash2, Pause, Play, ShieldAlert, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Devices — VTAB SQUARE" }] }),
  component: DevicesPage,
});

function stateTone(state: string) {
  return state === "active"
    ? "success"
    : state === "off_shift"
      ? "info"
      : state === "paused"
        ? "warning"
        : "danger";
}

function DevicesPage() {
  const queryClient = useQueryClient();
  const fetchDevices = useServerFn(listDevices);
  const fetchUsers = useServerFn(listUsers);
  const runDeviceAction = useServerFn(deviceAction);

  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices({ data: undefined }),
  });

  async function handleAction(
    device_id: string,
    action: "pause" | "resume" | "revoke" | "force_reregister" | "delete",
  ) {
    try {
      await runDeviceAction({ data: { device_id, action } });
      toast.success(`Device action '${action}' completed successfully`);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Device action failed");
    }
  }

  // Filter devices by user selection and search term
  const filteredDevices = (data ?? []).filter((d: any) => {
    // 1. User Filter
    if (selectedUserId !== "all" && d.profile_id !== selectedUserId) {
      return false;
    }
    // 2. Search Term Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const userName = d.profiles?.full_name?.toLowerCase() ?? "";
      const userEmail = d.profiles?.email?.toLowerCase() ?? "";
      const deviceName = d.name?.toLowerCase() ?? "";
      return userName.includes(term) || userEmail.includes(term) || deviceName.includes(term);
    }
    return true;
  });

  const activeUser = usersData?.find((u: any) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registered Workstations & Devices"
        description="Clear user-to-device mapping (User → Workstation), online telemetry status, and remote device management."
      />

      {/* Filter / User Selection Bar */}
      <Card className="p-4 bg-card/80 border-border/80 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* User Selector Dropdown */}
            <div className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User:
              </label>
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
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 max-w-xs flex-1">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search workstation or user…"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Scope: <strong className="text-foreground">{activeUser ? activeUser.full_name : "All Users"}</strong>
            </span>
            <span>•</span>
            <span>
              Enrolled Workstations: <strong className="text-foreground">{filteredDevices.length}</strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Device Table View */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading workstations…</div>
        ) : !filteredDevices.length ? (
          <EmptyState
            title={`No matching workstations ${activeUser ? `for ${activeUser.full_name}` : "found"}`}
            hint="Workstations automatically register when users complete desktop agent setup."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                <th className="px-6 py-3">User Owner (User → Device)</th>
                <th className="px-6 py-3">Workstation Name</th>
                <th className="px-6 py-3">Device Identifier</th>
                <th className="px-6 py-3">OS / Platform</th>
                <th className="px-6 py-3">Monitoring State</th>
                <th className="px-6 py-3">Last Sync</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((d: any) => (
                <tr
                  key={d.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  {/* User Owner Column */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
                        {d.profiles?.full_name ? d.profiles.full_name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground flex items-center gap-1">
                          <span>{d.profiles?.full_name ?? "Unassigned User"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">→</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{d.profiles?.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>

                  {/* Workstation Name Column */}
                  <td className="px-6 py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Laptop className="size-4 text-primary" />
                      <span>{d.name}</span>
                    </div>
                  </td>

                  {/* Device Identifier */}
                  <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                    {d.id}
                  </td>

                  {/* OS / Version */}
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{d.os || "Windows Workstation"}</p>
                    <p className="text-[11px]">v{d.agent_version || "1.0.0"}</p>
                  </td>

                  {/* State */}
                  <td className="px-6 py-3">
                    <Badge tone={stateTone(d.monitoring_state)}>{d.monitoring_state}</Badge>
                  </td>

                  {/* Last Sync */}
                  <td className="px-6 py-3 text-xs text-muted-foreground font-mono">
                    {d.last_sync_at ? new Date(d.last_sync_at).toLocaleString() : "Never"}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                      {d.status === "active" ? (
                        <button
                          onClick={() => handleAction(d.id, "pause")}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-warning hover:bg-muted"
                        >
                          <Pause className="size-3" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(d.id, "resume")}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-success hover:bg-muted"
                        >
                          <Play className="size-3" />
                          Start
                        </button>
                      )}
                      {d.status !== "revoked" && (
                        <button
                          onClick={() => handleAction(d.id, "revoke")}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-danger hover:bg-muted"
                        >
                          <ShieldAlert className="size-3" />
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete device '${d.name}'?`)) {
                            handleAction(d.id, "delete");
                          }
                        }}
                        className="flex items-center gap-1 rounded border border-border px-2 py-1 text-danger hover:bg-muted"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
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
