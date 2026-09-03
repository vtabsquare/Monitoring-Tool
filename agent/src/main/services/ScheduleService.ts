export interface ShiftDay {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export interface MonitoringConfig {
  timezone: string;
  heartbeat_interval_seconds: number;
  data_retention_days: number;
  days: ShiftDay[];
}

export class ScheduleService {
  private config: MonitoringConfig | null = null;

  public setConfig(config: MonitoringConfig): void {
    this.config = config;
  }

  public isWithinShift(now = new Date()): boolean {
    if (!this.config || !this.config.days || !this.config.days.length) {
      // If config not yet loaded or default schedule, allow monitoring to run while device is active
      return true;
    }

    let tzNow = now;
    if (this.config.timezone) {
      try {
        tzNow = new Date(now.toLocaleString("en-US", { timeZone: this.config.timezone }));
      } catch (e) {
        tzNow = now;
      }
    }

    const dayOfWeek = tzNow.getDay(); // 0 = Sun, 1 = Mon ...
    const todayShift = this.config.days.find((d) => d.day_of_week === dayOfWeek);

    if (!todayShift || !todayShift.enabled) {
      return false;
    }

    const currentMinutes = tzNow.getHours() * 60 + tzNow.getMinutes();

    const [startH = 0, startM = 0] = todayShift.start_time.split(":").map(Number);
    const [endH = 23, endM = 59] = todayShift.end_time.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Full 24-hour shift (00:00 - 23:59 or 00:00 - 00:00)
    if (startMinutes === endMinutes || (startMinutes === 0 && endMinutes >= 1439)) {
      return true;
    }

    // Standard intra-day shift (e.g. 09:00 - 18:00)
    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    // Overnight shift (e.g. 22:00 - 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}
