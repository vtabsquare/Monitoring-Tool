import { AuthService } from "./AuthService";
import { SQLiteService, LocalActivitySession } from "./SQLiteService";

export class SyncService {
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(
    private authService: AuthService,
    private sqliteService: SQLiteService
  ) {}

  public start(intervalSeconds = 60): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.syncPendingSessions();
    }, intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async syncPendingSessions(): Promise<void> {
    if (this.isSyncing) return;

    const creds = this.authService.getCredentials();
    if (!creds) return;

    const unsynced = this.sqliteService.getUnsyncedSessions(50);
    if (!unsynced.length) return;

    this.isSyncing = true;

    try {
      const payload = {
        sessions: unsynced.map((s: LocalActivitySession) => ({
          app_name: s.app_name,
          process_name: s.process_name,
          window_title: s.window_title,
          category: s.category,
          is_idle: Boolean(s.is_idle),
          started_at: s.started_at,
          duration_seconds: s.duration_seconds,
        })),
      };

      const res = await fetch(`${creds.serverUrl}/api/public/agent/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.deviceKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const syncedIds = unsynced.map((s) => s.id!).filter(Boolean);
        this.sqliteService.markSessionsSynced(syncedIds);
        console.log(`[SyncService] Successfully synced ${syncedIds.length} telemetry sessions.`);
      } else {
        console.warn(`[SyncService] Server returned HTTP ${res.status} during sync.`);
      }
    } catch (err) {
      console.error("[SyncService] Network error during telemetry sync:", err);
    } finally {
      this.isSyncing = false;
    }
  }
}
