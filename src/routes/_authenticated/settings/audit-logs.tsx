import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/users.functions";
import { PageHeader, Card, EmptyState } from "@/components/primitives";

export const Route = createFileRoute("/_authenticated/settings/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — Aetherium" }] }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const fetchAuditLogs = useServerFn(listAuditLogs);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchAuditLogs({ data: undefined }),
  });

  return (
    <div>
      <PageHeader
        title="Security & Administration Audit Trail"
        description="Immutable record of security events, administrative changes, and policy modifications."
      />

      <Card className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading audit logs…</div>
        ) : !data?.length ? (
          <EmptyState title="No audit log entries recorded" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Actor</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Entity Type</th>
                <th className="px-6 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log: any) => (
                <tr
                  key={log.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                >
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 font-medium text-foreground">{log.actor_email}</td>
                  <td className="px-6 py-3 font-mono text-xs text-primary">{log.action}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {log.entity_type || "—"}
                  </td>
                  <td className="px-6 py-3 text-right text-xs font-mono text-muted-foreground truncate max-w-xs">
                    {JSON.stringify(log.metadata ?? {})}
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
