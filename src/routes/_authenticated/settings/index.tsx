import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getMyOrganization, updateOrganizationSettings } from "@/lib/org.functions";
import { PageHeader, Card, EmptyState } from "@/components/primitives";
import { Globe, Shield, Clock, HardDrive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings — Aetherium" }] }),
  component: SettingsPage,
});

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST — Indian Standard Time, UTC+05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time, UTC+00:00)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT — Eastern Time, UTC-05:00)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT — Central Time, UTC-06:00)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT — Mountain Time, UTC-07:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT — Pacific Time, UTC-08:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST — British Time, UTC+00:00)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST — Central European Time, UTC+01:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST — Gulf Standard Time, UTC+04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT — Singapore Time, UTC+08:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST — Japan Standard Time, UTC+09:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST — Australian Eastern Time, UTC+10:00)" },
];

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchOrg = useServerFn(getMyOrganization);
  const runUpdateSettings = useServerFn(updateOrganizationSettings);

  const { data: org, isLoading } = useQuery({
    queryKey: ["my-org-settings"],
    queryFn: () => fetchOrg({ data: undefined }),
  });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [heartbeatInterval, setHeartbeatInterval] = useState(300);
  const [retentionDays, setRetentionDays] = useState(90);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setTimezone(org.timezone ?? "Asia/Kolkata");
      setHeartbeatInterval(org.heartbeat_interval_seconds ?? 300);
      setRetentionDays(org.data_retention_days ?? 90);
    }
  }, [org]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await runUpdateSettings({
        data: {
          name,
          timezone,
          heartbeat_interval_seconds: Number(heartbeatInterval),
          data_retention_days: Number(retentionDays),
        },
      });
      toast.success("Organization settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["my-org-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform & Telemetry Settings"
        description="Configure organization heartbeat intervals, default timezone, and telemetry retention policies."
      />

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading settings…</div>
      ) : !org ? (
        <EmptyState title="No organization found" />
      ) : (
        <Card className="max-w-2xl border border-border shadow-sm p-6">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Organization Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" />
                Organization Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Editable Timezone Dropdown Selection with IST (Asia/Kolkata) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-primary" />
                Default Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Timezone used for default shift schedules and daily productivity aggregation reports.
              </p>
            </div>

            {/* Heartbeat Cadence */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                Desktop Heartbeat Cadence (seconds)
              </label>
              <input
                type="number"
                min={30}
                max={3600}
                value={heartbeatInterval}
                onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Data Retention Period */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="size-3.5 text-primary" />
                Data Retention Period (days)
              </label>
              <input
                type="number"
                min={7}
                max={730}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
