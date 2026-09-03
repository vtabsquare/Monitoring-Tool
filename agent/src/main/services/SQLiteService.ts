import path from "path";
import fs from "fs";
import { app } from "electron";

export interface LocalActivitySession {
  id: number;
  app_name: string;
  process_name: string;
  window_title: string;
  category: "productive" | "neutral" | "distracted";
  is_idle: number;
  started_at: string;
  duration_seconds: number;
  synced: number;
}

interface DBData {
  lastId: number;
  activity_sessions: LocalActivitySession[];
  credentials: Record<string, string>;
  configuration: Record<string, unknown>;
}

export class SQLiteService {
  private dbFilePath: string;
  private data: DBData;

  constructor() {
    const userDataPath = app.getPath("userData");
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.dbFilePath = path.join(userDataPath, "agent_telemetry_store.json");
    this.data = this.loadData();
  }

  private loadData(): DBData {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const content = fs.readFileSync(this.dbFilePath, "utf-8");
        return JSON.parse(content);
      }
    } catch (err) {
      console.error("[SQLiteService] Failed to load local store, creating new:", err);
    }
    return {
      lastId: 0,
      activity_sessions: [],
      credentials: {},
      configuration: {},
    };
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("[SQLiteService] Atomic write error:", err);
    }
  }

  public saveActivitySession(session: Omit<LocalActivitySession, "id" | "synced">): number {
    this.data.lastId += 1;
    const newSession: LocalActivitySession = {
      ...session,
      id: this.data.lastId,
      synced: 0,
    };
    this.data.activity_sessions.push(newSession);
    this.saveData();
    return newSession.id;
  }

  public getUnsyncedSessions(limit = 100): LocalActivitySession[] {
    return this.data.activity_sessions
      .filter((s) => s.synced === 0)
      .slice(0, limit);
  }

  public markSessionsSynced(sessionIds: number[]): void {
    if (!sessionIds.length) return;
    const idSet = new Set(sessionIds);
    for (const session of this.data.activity_sessions) {
      if (idSet.has(session.id)) {
        session.synced = 1;
      }
    }
    this.saveData();
  }

  public setCredential(key: string, value: string): void {
    this.data.credentials[key] = value;
    this.saveData();
  }

  public getCredential(key: string): string | null {
    return this.data.credentials[key] ?? null;
  }

  public clearCredential(key: string): void {
    delete this.data.credentials[key];
    this.saveData();
  }
}
