import { AuthService } from "./AuthService";
import { ScheduleService } from "./ScheduleService";

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private authService: AuthService,
    private scheduleService: ScheduleService
  ) {}

  public start(intervalSeconds = 10): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.sendHeartbeat();
    this.timer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public async sendHeartbeat(): Promise<void> {
    const creds = this.authService.getCredentials();
    if (!creds) return;

    // Refresh monitoring schedule config from server
    try {
      const configRes = await fetch(`${creds.serverUrl}/api/public/agent/config`, {
        headers: { Authorization: `Bearer ${creds.deviceKey}` },
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        this.scheduleService.setConfig(configData);
      }
    } catch (err) {
      // Ignore network config sync errors
    }

    const monitoringState = this.scheduleService.isWithinShift() ? "active" : "off_shift";

    try {
      const res = await fetch(`${creds.serverUrl}/api/public/agent/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.deviceKey}`,
        },
        body: JSON.stringify({
          agent_version: "1.0.0",
          monitoring_state: monitoringState,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        console.warn("[HeartbeatService] Device credentials revoked by server.");
        this.authService.clearCredentials();
        this.stop();
      }
    } catch (err) {
      console.error("[HeartbeatService] Network error during heartbeat:", err);
    }
  }
}
