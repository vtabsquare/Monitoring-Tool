// Deterministic productivity metrics.
// Derived from raw activity sessions.

export type SessionCategory = "productive" | "neutral" | "distracted";

export interface RawSession {
  app_name: string;
  category: SessionCategory;
  is_idle: boolean;
  started_at: string; // ISO
  duration_seconds: number;
}

export interface DailyMetrics {
  productive_seconds: number;
  neutral_seconds: number;
  distracted_seconds: number;
  idle_seconds: number;
  focus_seconds: number;
  focus_score: number;
  context_switches: number;
  productivity_score: number;
}

/**
 * Deterministic Classification Rules:
 * Active application usage when Windows is awake is classified as PRODUCTIVE by default.
 * Explicit entertainment and social media platforms are classified as DISTRACTED.
 */
export function classifyApp(appName: string): SessionCategory {
  const key = appName.trim().toLowerCase();

  // Distracted applications
  if (
    key.includes("youtube") ||
    key.includes("netflix") ||
    key.includes("tiktok") ||
    key.includes("twitter") ||
    key.includes("facebook") ||
    key.includes("instagram") ||
    key.includes("reddit") ||
    key.includes("spotify")
  ) {
    return "distracted";
  }

  // Active usage of Chrome, VS Code, ChatGPT, Word, Excel, WhatsApp, Teams, Slack, etc. is Productive
  return "productive";
}

export function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10;
}

/**
 * Deterministic productivity score:
 * weighted time ratio (productive 1.0, neutral 0.5, distracted -0.5) over
 * total tracked (non-idle) time, scaled to 0-100.
 */
export function productivityScore(m: {
  productive_seconds: number;
  neutral_seconds: number;
  distracted_seconds: number;
}): number {
  const total = m.productive_seconds + m.neutral_seconds + m.distracted_seconds;
  if (total <= 0) return 0;
  const raw =
    ((m.productive_seconds + m.neutral_seconds * 0.5 - m.distracted_seconds * 0.5) / total) * 100;
  return clampScore(raw);
}

/**
 * Deterministic focus score: 60% productive ratio of active time,
 * 40% longest uninterrupted productive block (capped at 2.5h).
 */
export function focusScore(m: {
  productive_seconds: number;
  neutral_seconds: number;
  distracted_seconds: number;
  focus_seconds: number;
}): number {
  const active = m.productive_seconds + m.neutral_seconds + m.distracted_seconds;
  if (active <= 0) return 0;
  const ratio = (m.productive_seconds / active) * 60;
  const depth = (Math.min(m.focus_seconds, 9000) / 9000) * 40;
  return clampScore(ratio + depth);
}

/** Aggregate raw sessions of one user-day into deterministic metrics. */
export function computeDailyMetrics(sessions: RawSession[]): DailyMetrics {
  const sorted = [...sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const m: DailyMetrics = {
    productive_seconds: 0,
    neutral_seconds: 0,
    distracted_seconds: 0,
    idle_seconds: 0,
    focus_seconds: 0,
    focus_score: 0,
    context_switches: 0,
    productivity_score: 0,
  };

  let prevApp: string | null = null;
  let runStart: string | null = null;
  let runEnd: string | null = null;

  for (const s of sorted) {
    if (s.is_idle) {
      m.idle_seconds += s.duration_seconds;
      // Idle breaks a focus run
      if (runStart && runEnd) {
        m.focus_seconds = Math.max(
          m.focus_seconds,
          Math.round((new Date(runEnd).getTime() - new Date(runStart).getTime()) / 1000),
        );
      }
      runStart = null;
      runEnd = null;
    } else {
      m[`${s.category}_seconds`] += s.duration_seconds;
      if (s.category === "productive") {
        if (!runStart) runStart = s.started_at;
        runEnd = new Date(
          new Date(s.started_at).getTime() + s.duration_seconds * 1000,
        ).toISOString();
      } else {
        if (runStart && runEnd) {
          m.focus_seconds = Math.max(
            m.focus_seconds,
            Math.round((new Date(runEnd).getTime() - new Date(runStart).getTime()) / 1000),
          );
        }
        runStart = null;
        runEnd = null;
      }
    }
    if (prevApp !== null && prevApp !== s.app_name) m.context_switches += 1;
    prevApp = s.app_name;
  }
  if (runStart && runEnd) {
    m.focus_seconds = Math.max(
      m.focus_seconds,
      Math.round((new Date(runEnd).getTime() - new Date(runStart).getTime()) / 1000),
    );
  }

  m.productivity_score = productivityScore(m);
  m.focus_score = focusScore(m);
  return m;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
