import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listUsers, addUser, updateUser, resendInvitation } from "@/lib/users.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { UserShiftEditor } from "@/components/shift-editor";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Aetherium" }] }),
  component: UsersPage,
});

function statusTone(s: string) {
  return s === "active" ? "success" : s === "invited" ? "info" : s === "suspended" ? "warning" : "danger";
}

function UsersPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const runAddUser = useServerFn(addUser);
  const runUpdateUser = useServerFn(updateUser);
  const runResend = useServerFn(resendInvitation);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [shiftUser, setShiftUser] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", job_role: "", department_id: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await runAddUser({ data: { ...form, department_id: form.department_id || undefined } });
      toast.success("Invitation sent — the desktop agent download is on its way");
      setAddOpen(false);
      setForm({ full_name: "", email: "", job_role: "", department_id: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  }

  async function handleStatus(profile_id: string, status: "active" | "suspended" | "disabled") {
    try {
      await runUpdateUser({ data: { profile_id, status } });
      toast.success(`User ${status}`);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Members of your organization. Invites deliver the desktop agent installer."
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            Add user
          </button>
        }
      />

      <Card className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data?.users.length ? (
          <EmptyState title="No users yet" hint="Add your first team member to start monitoring." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Shift</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u: any) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                  <td className="px-6 py-3">
                    <p className="font-medium text-foreground">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{u.job_role || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{u.departments?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {u.schedule?.length ? "Custom" : "Org default"}
                  </td>
                  <td className="px-6 py-3">
                    <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => setShiftUser({ id: u.id, name: u.full_name })}
                        className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Shift
                      </button>
                      {u.status === "invited" && (
                        <button
                          onClick={async () => {
                            await runResend({ data: { profile_id: u.id } }).catch((e) =>
                              toast.error(e.message),
                            );
                            toast.success("Invitation re-sent");
                          }}
                          className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Resend invite
                        </button>
                      )}
                      {u.status === "active" && (
                        <button
                          onClick={() => handleStatus(u.id, "suspended")}
                          className="rounded border border-border px-2 py-1 text-warning hover:bg-muted"
                        >
                          Suspend
                        </button>
                      )}
                      {u.status === "suspended" && (
                        <button
                          onClick={() => handleStatus(u.id, "active")}
                          className="rounded border border-border px-2 py-1 text-success hover:bg-muted"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {addOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <form onSubmit={handleAdd} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Add user</h2>
            <p className="text-xs text-muted-foreground">
              An email with the Windows agent installer and a one-time registration token will be sent.
            </p>
            {(
              [
                ["full_name", "Full name", "Jane Cooper"],
                ["email", "Work email", "jane@company.com"],
                ["job_role", "Job role", "Product Designer"],
              ] as const
            ).map(([key, label, ph]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  required={key !== "job_role"}
                  type={key === "email" ? "email" : "text"}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={ph}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="">None</option>
                {data?.departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Send invitation
              </button>
            </div>
          </form>
        </div>
      )}

      {shiftUser && <UserShiftEditor user={shiftUser} onClose={() => setShiftUser(null)} />}
    </div>
  );
}
