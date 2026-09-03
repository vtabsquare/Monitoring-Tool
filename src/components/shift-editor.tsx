import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getUserShift, saveUserShift } from "@/lib/users.functions";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0");
  return [`${h}:00`, `${h}:30`];
}).flat();
if (!TIME_OPTIONS.includes("23:59")) {
  TIME_OPTIONS.push("23:59");
}

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

  function applyPreset(preset: "24/7" | "standard" | "night") {
    if (!rows) return;
    setRows(
      rows.map((r) => {
        if (preset === "24/7") {
          return { ...r, enabled: true, start_time: "00:00", end_time: "23:59" };
        } else if (preset === "standard") {
          return {
            ...r,
            enabled: r.day_of_week > 0 && r.day_of_week < 6,
            start_time: "09:00",
            end_time: "18:00",
          };
        } else {
          return {
            ...r,
            enabled: r.day_of_week > 0 && r.day_of_week < 6,
            start_time: "22:00",
            end_time: "06:00",
          };
        }
      }),
    );
  }

  async function handleSave() {
    if (!rows) return;
    try {
      await saveShift({
        data: {
          profile_id: user.id,
          shift: {
            timezone: "Asia/Kolkata", // Indian Standard Time (IST / UTC+05:30)
            days: rows,
          },
        },
      });
      toast.success("Shift schedule saved in Indian Standard Time (IST)");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["shift", user.id] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shift");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Shift schedule — {user.name}</h2>
          <span className="rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[11px] font-bold text-primary">
            IST (UTC+05:30)
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Monitoring windows strictly operate in <strong>Indian Standard Time (IST)</strong>. Overnight shifts (e.g. 22:00 IST to 06:00 IST) are supported.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset("24/7")}
            className="rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            Preset: 24/7 All Day (00:00–23:59 IST)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("standard")}
            className="rounded border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Preset: Mon–Fri 09:00 AM – 06:00 PM IST
          </button>
          <button
            type="button"
            onClick={() => applyPreset("night")}
            className="rounded border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Preset: Night Shift 10:00 PM – 06:00 AM IST
          </button>
        </div>

        {!rows ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading shift schedule…</div>
        ) : (
          <div className="mt-4 space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {rows.map((row, i) => (
              <div
                key={row.day_of_week}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <label className="flex w-28 items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, enabled: e.target.checked };
                      setRows(next);
                    }}
                    className="accent-primary size-4"
                  />
                  {DAY_LABELS[row.day_of_week]}
                </label>

                <select
                  value={row.start_time}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, start_time: e.target.value };
                    setRows(next);
                  }}
                  className="rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground disabled:opacity-40 outline-none"
                >
                  {!TIME_OPTIONS.includes(row.start_time) && (
                    <option value={row.start_time}>{row.start_time}</option>
                  )}
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-muted-foreground">→</span>

                <select
                  value={row.end_time}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, end_time: e.target.value };
                    setRows(next);
                  }}
                  className="rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground disabled:opacity-40 outline-none"
                >
                  {!TIME_OPTIONS.includes(row.end_time) && (
                    <option value={row.end_time}>{row.end_time}</option>
                  )}
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <span className="text-[10px] text-muted-foreground font-semibold">IST</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save IST Shift
          </button>
        </div>
      </div>
    </div>
  );
}
