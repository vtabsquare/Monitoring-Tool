import { SQLiteService } from "./SQLiteService";

export interface DeviceCredentials {
  deviceId: string;
  deviceKey: string;
  serverUrl: string;
}

export class AuthService {
  constructor(private sqliteService: SQLiteService) {}

  public getCredentials(): DeviceCredentials | null {
    const deviceId = this.sqliteService.getCredential("device_id");
    const deviceKey = this.sqliteService.getCredential("device_key");
    const serverUrl = this.sqliteService.getCredential("server_url") || "http://localhost:8080";

    if (deviceId && deviceKey) {
      return { deviceId, deviceKey, serverUrl };
    }
    return null;
  }

  public saveCredentials(deviceId: string, deviceKey: string, serverUrl: string): void {
    this.sqliteService.setCredential("device_id", deviceId);
    this.sqliteService.setCredential("device_key", deviceKey);
    this.sqliteService.setCredential("server_url", serverUrl);
  }

  public clearCredentials(): void {
    this.sqliteService.clearCredential("device_id");
    this.sqliteService.clearCredential("device_key");
  }

  public isAuthenticated(): boolean {
    return this.getCredentials() !== null;
  }
}
