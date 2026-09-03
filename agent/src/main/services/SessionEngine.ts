import { SQLiteService } from "./SQLiteService";
import { WindowObservation } from "./CollectorService";
import { normalizeAppName, getCanonicalClassification } from "./app-mapping";

export class SessionEngine {
  private currentSession: {
    appName: string;
    processName: string;
    windowTitle: string;
    category: "productive" | "neutral" | "distracted";
    isIdle: boolean;
    startedAt: string;
    durationSeconds: number;
  } | null = null;

  constructor(private sqliteService: SQLiteService) {}

  public processObservation(obs: WindowObservation, isIdle: boolean): void {
    const normalizedApp = normalizeAppName(obs.appName, obs.processName);
    const category = getCanonicalClassification(normalizedApp);

    if (
      this.currentSession &&
      this.currentSession.appName === normalizedApp &&
      this.currentSession.isIdle === isIdle
    ) {
      // Merge observation into current app-level session
      this.currentSession.durationSeconds += 1;
      if (this.currentSession.durationSeconds >= 5) {
        this.flushCurrentSession();
      }
    } else {
      // Flush active session to SQLite if application or idle state changed
      this.flushCurrentSession();

      // Start new application-level session
      this.currentSession = {
        appName: normalizedApp,
        processName: obs.processName,
        windowTitle: "", // Application-level monitoring only
        category,
        isIdle,
        startedAt: obs.timestamp,
        durationSeconds: 1,
      };
    }
  }

  public flushCurrentSession(): void {
    if (this.currentSession && this.currentSession.durationSeconds > 0) {
      this.sqliteService.saveActivitySession({
        app_name: this.currentSession.appName,
        process_name: this.currentSession.processName,
        window_title: "",
        category: this.currentSession.category,
        is_idle: this.currentSession.isIdle ? 1 : 0,
        started_at: this.currentSession.startedAt,
        duration_seconds: this.currentSession.durationSeconds,
      });
      this.currentSession = null;
    }
  }
}
