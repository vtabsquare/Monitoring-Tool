import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listUsers, addUser, updateUser, resendInvitation, deleteUser } from "@/lib/users.functions";
import { getMyOrganization } from "@/lib/org.functions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/primitives";
import { UserShiftEditor } from "@/components/shift-editor";
import { Copy, Check, Edit2, Trash2, Mail, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/users")({
  head: () => ({ meta: [{ title: "Users — VTAB SQUARE" }] }),
  component: UsersPage,
});

function statusTone(s: string) {
  return s === "active"
    ? "success"
    : s === "invited"
      ? "info"
      : s === "suspended"
        ? "warning"
        : "danger";
}

function UsersPage() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchOrg = useServerFn(getMyOrganization);
  const runAddUser = useServerFn(addUser);
  const runUpdateUser = useServerFn(updateUser);
  const runResend = useServerFn(resendInvitation);
  const runDeleteUser = useServerFn(deleteUser);

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const { data: orgData } = useQuery({
    queryKey: ["my-org-detail"],
    queryFn: () => fetchOrg({ data: undefined }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editUserObj, setEditUserObj] = useState<any | null>(null);
  const [shiftUser, setShiftUser] = useState<{ id: string; name: string } | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    name: string;
    email: string;
    token: string;
    emailSent?: boolean;
    emailError?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [addForm, setAddForm] = useState({ full_name: "", email: "", job_role: "", department_id: "" });
  const [editForm, setEditForm] = useState({ full_name: "", job_role: "", department_id: "", status: "active" as any });

  const availableDepartments = orgData?.departments ?? Array.from(
    new Map(
      (data ?? []).flatMap((user: any) =>
        user.department_id && user.departments
          ? [[user.department_id, { id: user.department_id, name: user.departments.name }] as const]
          : [],
      ),
    ).values(),
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["devices"] });
    queryClient.invalidateQueries({ queryKey: ["my-org-detail"] });
  };

  function openEdit(u: any) {
    setEditUserObj(u);
    setEditForm({
      full_name: u.full_name || "",
      job_role: u.job_role || "",
      department_id: u.department_id || "",
      status: u.status || "active",
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (isAdding) return;
    setIsAdding(true);
    try {
      const res = await runAddUser({
        data: {
          ...addForm,
          department_id: addForm.department_id || null,
          shift: {
            timezone: orgData?.timezone ?? "Asia/Kolkata",
            days: Array.from({ length: 7 }, (_, day_of_week) => ({
              day_of_week,
              enabled: true,
              start_time: "00:00",
              end_time: "23:59",
            })),
          },
        },
      });
      if (res.emailSent === false) {
        toast.warning(`User added, but email failed to send.`);
      } else {
        toast.success("User added & onboarding email automatically sent! (Check spam folder)");
      }
      setAddOpen(false);
      if (res.invitationToken) {
        setCreatedInvite({
          name: addForm.full_name,
          email: addForm.email,
          token: res.invitationToken,
          emailSent: res.emailSent,
          emailError: res.emailError,
        });
      }
      setAddForm({ full_name: "", email: "", job_role: "", department_id: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserObj) return;
    try {
      await runUpdateUser({
        data: {
          id: editUserObj.id,
          full_name: editForm.full_name,
          job_role: editForm.job_role,
          department_id: editForm.department_id || null,
          status: editForm.status,
        },
      });
      toast.success(`User '${editForm.full_name}' updated successfully`);
      setEditUserObj(null);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function handleStatus(id: string, status: "active" | "disabled") {
    try {
      await runUpdateUser({ data: { id, status } });
      toast.success(`User status updated to ${status}`);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete user '${name}'? This will remove their devices, schedules, and activity logs.`)) return;
    try {
      await runDeleteUser({ data: { id } });
      toast.success(`User '${name}' deleted successfully`);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  function handleCopyToken(token: string) {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Activation token copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Members of your organization. Adding a user generates a unique activation token & triggers an onboarding email."
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            Add user
          </button>
        }
      />

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : !data?.length ? (
          <EmptyState title="No users yet" hint="Add your first team member to start monitoring." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Shift Timezone</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u: any) => (
                <tr
                  key={u.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-3">
                    <p className="font-semibold text-foreground">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{u.job_role || "—"}</td>
                  <td className="px-6 py-3 font-medium text-foreground">
                    {u.departments?.name ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs border border-border/80">
                        {u.departments.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs font-mono text-muted-foreground">
                    {orgData?.timezone ?? "Asia/Kolkata"}
                  </td>
                  <td className="px-6 py-3">
                    <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-1.5 text-xs">
                      <button
                        onClick={() => openEdit(u)}
                        className="flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit2 className="size-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => setShiftUser({ id: u.id, name: u.full_name })}
                        className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Shift
                      </button>
                      {u.invitation?.token && (
                        <button
                          onClick={() => setCreatedInvite({ name: u.full_name, email: u.email, token: u.invitation.token })}
                          className="rounded border border-border px-2 py-1 text-primary hover:bg-muted"
                        >
                          View Token
                        </button>
                      )}
                      {u.status === "invited" && (
                        <button
                          onClick={async () => {
                            const res = await runResend({ data: { profile_id: u.id } }).catch((e) => {
                              toast.error(e.message);
                              return null;
                            });
                            if (res?.token) {
                              toast.success("Activation token rotated & onboarding email resent");
                              setCreatedInvite({ name: u.full_name, email: u.email, token: res.token });
                              invalidate();
                            }
                          }}
                          className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Resend invite
                        </button>
                      )}
                      {u.status === "active" && (
                        <button
                          onClick={() => handleStatus(u.id, "disabled")}
                          className="rounded border border-border px-2 py-1 text-warning hover:bg-muted"
                        >
                          Suspend
                        </button>
                      )}
                      {u.status === "disabled" && (
                        <button
                          onClick={() => handleStatus(u.id, "active")}
                          className="rounded border border-border px-2 py-1 text-success hover:bg-muted"
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(u.id, u.full_name)}
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

      {/* Add User Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <form
            onSubmit={handleAdd}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-foreground">Add User</h2>
            <p className="text-xs text-muted-foreground">
              Create a new user profile. An onboarding email containing the activation token and EXE installer will be sent automatically.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                required
                type="text"
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                placeholder="Jane Cooper"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Work Email</label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="jane@company.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Job Role</label>
              <input
                type="text"
                value={addForm.job_role}
                onChange={(e) => setAddForm({ ...addForm, job_role: e.target.value })}
                placeholder="Product Designer"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department</label>
              <select
                value={addForm.department_id}
                onChange={(e) => setAddForm({ ...addForm, department_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              >
                <option value="">No Department Assigned</option>
                {availableDepartments.map((d: any) => (
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
                disabled={isAdding}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Create User & Send Email"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserObj && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-foreground">Edit User — {editUserObj.full_name}</h2>
            <p className="text-xs text-muted-foreground">
              Modify profile details, assigned department, role, or user status.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                required
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Work Email (Immutable)</label>
              <input
                disabled
                type="email"
                value={editUserObj.email}
                className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground opacity-70 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Job Role</label>
              <input
                type="text"
                value={editForm.job_role}
                onChange={(e) => setEditForm({ ...editForm, job_role: e.target.value })}
                placeholder="Software Engineer"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department</label>
              <select
                value={editForm.department_id}
                onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No Department Assigned</option>
                {availableDepartments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Account Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="disabled">Disabled / Suspended</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditUserObj(null)}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onboarding Invitation Modal */}
      {createdInvite && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
            {createdInvite.emailSent === false ? (
              <>
                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                  <Mail className="size-4" />
                  <span>Email Dispatch Failed</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  User <strong className="text-foreground">{createdInvite.name}</strong> ({createdInvite.email}) has been created, but we could not automatically send the onboarding email.
                </p>
                <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <strong>Error:</strong> {createdInvite.emailError || "Unknown error"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Please securely share the Activation Token and download instructions with the user manually.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-success font-semibold text-sm">
                  <Mail className="size-4" />
                  <span>Onboarding Email Dispatched Automatically</span>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  User <strong className="text-foreground">{createdInvite.name}</strong> ({createdInvite.email}) has been created. An onboarding email containing the setup steps, activation token, and desktop agent EXE installer download link has been dispatched.
                </p>
                <div className="rounded border border-warning/20 bg-warning/10 p-2 mt-2">
                  <p className="text-xs text-warning font-semibold">
                    Note: If the user doesn't see the email, ask them to check their Spam or Junk folder! (Emails sent via third-party services often go to spam).
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Activation Token</label>
              <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3">
                <code className="flex-1 font-mono text-sm text-primary font-bold break-all">{createdInvite.token}</code>
                <button
                  onClick={() => handleCopyToken(createdInvite.token)}
                  className="rounded p-1.5 text-primary hover:bg-primary/20 transition-colors"
                  title="Copy token"
                >
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1 text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Download className="size-3.5 text-primary" />
                <span>Installer Binary</span>
              </div>
              <p>Direct Download URL included in email:</p>
              <code className="block font-mono text-[11px] text-foreground bg-background p-1.5 rounded border border-border/80">
                /api/public/agent/download
              </code>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCreatedInvite(null)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {shiftUser && <UserShiftEditor user={shiftUser} onClose={() => setShiftUser(null)} />}
    </div>
  );
}
