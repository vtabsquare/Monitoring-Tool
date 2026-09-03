import { exec } from "child_process";
import { promisify } from "util";
import { normalizeAppName } from "./app-mapping";

const execAsync = promisify(exec);

export interface WindowObservation {
  appName: string;
  processName: string;
  windowTitle: string;
  timestamp: string;
}

const PS_SCRIPT = `
$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$hwnd = [Win32]::GetForegroundWindow()
$pidOut = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pidOut) | Out-Null
$proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
@{
  ProcessName = if ($proc) { $proc.ProcessName + ".exe" } else { "unknown.exe" };
  AppName = if ($proc -and $proc.Description) { $proc.Description } elseif ($proc) { $proc.ProcessName } else { "Active Application" }
} | ConvertTo-Json
`;

const ENCODED_PS = Buffer.from(PS_SCRIPT, "utf16le").toString("base64");

export class CollectorService {
  public async getActiveWindow(): Promise<WindowObservation> {
    try {
      const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${ENCODED_PS}`);
      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const rawApp = parsed.AppName || parsed.ProcessName || "Application";
        const processName = parsed.ProcessName || "unknown.exe";

        return {
          appName: normalizeAppName(rawApp, processName),
          processName: processName,
          windowTitle: "", // Privacy Requirement: Do not capture browser tabs, URLs, or window titles
          timestamp: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn("[CollectorService] PowerShell observation error:", err);
    }

    return {
      appName: "Desktop Workspace",
      processName: "explorer.exe",
      windowTitle: "",
      timestamp: new Date().toISOString(),
    };
  }
}
