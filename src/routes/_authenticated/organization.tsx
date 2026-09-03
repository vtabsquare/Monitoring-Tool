import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMyOrganization,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/org.functions";
import { PageHeader, Card, EmptyState } from "@/components/primitives";
import { Building2, Plus, Edit2, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({ meta: [{ title: "Organization — VTAB SQUARE" }] }),
  component: OrganizationPage,
});

function OrganizationPage() {
  const queryClient = useQueryClient();
  const fetchOrg = useServerFn(getMyOrganization);
  const runCreateDept = useServerFn(createDepartment);
  const runUpdateDept = useServerFn(updateDepartment);
  const runDeleteDept = useServerFn(deleteDepartment);

  const { data, isLoading } = useQuery({
    queryKey: ["my-org-detail"],
    queryFn: () => fetchOrg({ data: undefined }),
  });

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<{ id: string; name: string } | null>(null);
  const [deptName, setDeptName] = useState("");

  function openCreate() {
    setEditingDept(null);
    setDeptName("");
    setDeptModalOpen(true);
  }

  function openEdit(dept: { id: string; name: string }) {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptModalOpen(true);
  }

  async function handleSaveDept(e: React.FormEvent) {
    e.preventDefault();
    if (!deptName.trim()) return;
    try {
      if (editingDept) {
        await runUpdateDept({
          data: {
            id: editingDept.id,
            name: deptName.trim(),
          },
        });
        toast.success(`Department '${deptName}' updated`);
      } else {
        await runCreateDept({
          data: {
            name: deptName.trim(),
          },
        });
        toast.success(`Department '${deptName}' created`);
      }
      queryClient.invalidateQueries({ queryKey: ["my-org-detail"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeptModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save department");
    }
  }

  async function handleDeleteDept(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete department '${name}'?`)) return;
    try {
      await runDeleteDept({ data: { id } });
      toast.success(`Department '${name}' deleted`);
      queryClient.invalidateQueries({ queryKey: ["my-org-detail"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization & Departments"
        description="Tenant details, department topology, default timezones, and data retention parameters."
      />

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading organization…</div>
      ) : !data ? (
        <EmptyState title="No organization found" />
      ) : (
        <div className="space-y-6">
          {/* Organization Profile Overview */}
          <Card>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Organization Profile
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Organization Name</span>
                <span className="font-semibold text-foreground">{data.name}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Organization Slug</span>
                <span className="font-mono text-xs text-muted-foreground">{data.slug}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Default Timezone</span>
                <span className="font-medium text-foreground">
                  {data.timezone || "Asia/Kolkata"} (IST)
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Data Retention</span>
                <span className="font-medium text-foreground">{data.data_retention_days} days</span>
              </div>
            </div>
          </Card>

          {/* Department Topology Management */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Departments</h3>
                <p className="text-xs text-muted-foreground">
                  Manage functional departments for user assignment (IT, HR, Finance, Marketing, Operations, etc.).
                </p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Plus className="size-3.5" />
                Add Department
              </button>
            </div>

            {!data.departments?.length ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No departments created yet. Click <strong>Add Department</strong> above to create your first department.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40">
                    <th className="px-6 py-3">Department Name</th>
                    <th className="px-6 py-3">Assigned Members</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map((d: any) => (
                    <tr
                      key={d.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-3 font-semibold text-foreground">{d.name}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Users className="size-3.5 text-muted-foreground" />
                          <span>{d.member_count} member{d.member_count === 1 ? "" : "s"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            onClick={() => openEdit(d)}
                            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Edit2 className="size-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDept(d.id, d.name)}
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
      )}

      {/* Clean & Simple Create/Edit Department Modal */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <form
            onSubmit={handleSaveDept}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-foreground">
              {editingDept ? "Edit Department" : "Create Department"}
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department Name</label>
              <input
                required
                type="text"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. IT, HR, Finance, Marketing, Operations"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {editingDept ? "Save Changes" : "Create Department"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
