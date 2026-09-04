import { powerMonitor } from "electron";

export class IdleDetector {
  private idleThresholdSeconds = 180; // 3 minutes idle threshold

  public getSystemIdleState(): { isIdle: boolean; idleSeconds: number } {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    return {
      isIdle: idleSeconds >= this.idleThresholdSeconds,
      idleSeconds,
    };
  }
}
