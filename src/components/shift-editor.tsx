import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserShift, saveUserShift } from "@/lib/users.functions";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ShiftRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export function UserShiftEditor({
  user,
  onClose,
}: {
  user: { id: string; name: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fetchShift = useServerFn(getUserShift);
  const saveShift = useServerFn(saveUserShift);
  const [rows, setRows] = useState<ShiftRow[] | null>(null);

  const { data } = useQuery({
    queryKey: ["shift", user.id],
    queryFn: () => fetchShift({ data: { profile_id: user.id } }),
  });

  useEffect(() => {
    if (!data) return;
    setRows(
      DAY_LABELS.map((_, d) => {
        const row = data.find((candidate) => candidate.day_of_week === d);
        return {
          day_of_week: d,
          enabled: row?.enabled ?? false,
          start_time: (row?.start_time ?? "09:00:00").slice(0, 5),
          end_time: (row?.end_time ?? "18:00:00").slice(0, 5),
        };
      }),
    );
  }, [data]);

  async function handleSave() {
    if (!rows) return;
    try {
      await saveShift({
        data: {
          profile_id: user.id,
          shift: {
            timezone: data?.[0]?.timezone ?? "America/New_York",
            days: rows,
          },
        },
      });
      toast.success("Shift schedule saved");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shift");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Shift schedule — {user.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Monitoring runs only inside these windows. Overnight shifts (end before start) are supported.
        </p>

        {!rows ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((row, i) => (
              <div
                key={row.day_of_week}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <label className="flex w-28 items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, enabled: e.target.checked };
                      setRows(next);
                    }}
                    className="accent-[#4F7CFF]"
                  />
                  {DAY_LABELS[row.day_of_week]}
                </label>
                <input
                  type="time"
                  value={row.start_time}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, start_time: e.target.value };
                    setRows(next);
                  }}
                  className="rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground disabled:opacity-40"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="time"
                  value={row.end_time}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, end_time: e.target.value };
                    setRows(next);
                  }}
                  className="rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save shift
          </button>
        </div>
      </div>
    </div>
  );
}
