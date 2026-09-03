import os from "os";
import { AuthService } from "./AuthService";

export class OnboardingService {
  constructor(private authService: AuthService) {}

  public async registerWithToken(
    token: string,
    preferredServerUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    const deviceName = os.hostname() || "WINDOWS-WORKSTATION";
    const platform = `Windows ${os.release()} x64`;
    const cleanToken = token.trim();

    if (!cleanToken) {
      return { success: false, error: "Please enter an activation code." };
    }

    // Candidate server URLs (production or active local dev ports)
    const candidateUrls: string[] = [];
    if (preferredServerUrl) candidateUrls.push(preferredServerUrl);

    // Standard local dev ports fallback list
    candidateUrls.push(
      "http://localhost:8080",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://localhost:8083",
      "http://localhost:8084",
      "http://localhost:8085",
      "http://localhost:3000"
    );

    const uniqueCandidateUrls = Array.from(new Set(candidateUrls));
    let lastError = "Unable to connect to the server. Please check your internet connection.";

    for (const serverUrl of uniqueCandidateUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${serverUrl}/api/public/agent/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitation_token: cleanToken,
            device_name: deviceName,
            os: platform,
            agent_version: "1.0.0",
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          // If non-JSON response from a non-API port, try next candidate port
          continue;
        }

        if (res.ok && data.device_id && data.device_key) {
          this.authService.saveCredentials(data.device_id, data.device_key, serverUrl);
          return { success: true };
        }

        // Handle specific human-readable API error responses
        if (data.error || data.message) {
          return {
            success: false,
            error: data.error || data.message,
          };
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          lastError = "Connection timed out. Please check your network connection.";
        } else {
          lastError = "Unable to connect to the server. Please check your internet connection.";
        }
      }
    }

    return {
      success: false,
      error: lastError,
    };
  }
}
