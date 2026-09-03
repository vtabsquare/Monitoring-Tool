import { powerMonitor } from "electron";

export class IdleDetector {
  private idleThresholdSeconds = 180; // 3 minutes idle threshold

  constructor() {
    powerMonitor.on("suspend", () => {
      console.log("[IdleDetector] System entering sleep/suspend");
    });

    powerMonitor.on("resume", () => {
      console.log("[IdleDetector] System resumed from sleep");
    });

    powerMonitor.on("lock-screen", () => {
      console.log("[IdleDetector] Screen locked");
    });

    powerMonitor.on("unlock-screen", () => {
      console.log("[IdleDetector] Screen unlocked");
    });
  }

  public getSystemIdleState(): { isIdle: boolean; idleSeconds: number } {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    return {
      isIdle: idleSeconds >= this.idleThresholdSeconds,
      idleSeconds,
    };
  }
}
