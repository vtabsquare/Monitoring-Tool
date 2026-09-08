import { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, Notification, shell, dialog, net } from "electron";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";

if (process.platform === "win32") {
  app.setAppUserModelId("com.vtabsquare.flowfocusagent");
}

// Enforce single instance lock to prevent duplicate background processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[Agent Main] Another instance of Flow Focus Desktop Agent is already running. Quitting.");
  app.quit();
  process.exit(0);
}

// Handle Windows Squirrel installer lifecycle flags
function handleSquirrelEvents(): boolean {
  if (process.argv.length < 2) return false;
  const squirrelCommand = process.argv[1];

  const appFolder = path.resolve(process.execPath, "..");
  const rootAppFolder = path.resolve(appFolder, "..");
  const updateDotExe = path.resolve(path.join(rootAppFolder, "Update.exe"));
  const exeName = path.basename(process.execPath);

  const spawn = (command: string, args: string[]) => {
    try {
      execFile(command, args);
    } catch (e) {
      console.error("[Squirrel] Spawn error:", e);
    }
  };

  switch (squirrelCommand) {
    case "--squirrel-install":
    case "--squirrel-updated":
      spawn(updateDotExe, ["--createShortcut", exeName]);
      setTimeout(() => app.quit(), 1000);
      return true;
    case "--squirrel-uninstall":
      spawn(updateDotExe, ["--removeShortcut", exeName]);
      setTimeout(() => app.quit(), 1000);
      return true;
    case "--squirrel-obsolete":
      app.quit();
      return true;
    case "--squirrel-firstrun":
      return false;
  }
  return false;
}

if (handleSquirrelEvents()) {
  // Exit early only for background installer/uninstaller tasks
  process.exit(0);
}

import { SQLiteService } from "./services/SQLiteService";
import { AuthService } from "./services/AuthService";
import { ScheduleService } from "./services/ScheduleService";
import { HeartbeatService } from "./services/HeartbeatService";
import { CollectorService } from "./services/CollectorService";
import { IdleDetector } from "./services/IdleDetector";
import { SessionEngine } from "./services/SessionEngine";
import { SyncService } from "./services/SyncService";
import { OnboardingService } from "./services/OnboardingService";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let collectionTimer: NodeJS.Timeout | null = null;

// Initialize core agent services
const sqliteService = new SQLiteService();
const authService = new AuthService(sqliteService);
const scheduleService = new ScheduleService();
const heartbeatService = new HeartbeatService(authService, scheduleService);
const collectorService = new CollectorService();
const idleDetector = new IdleDetector();
const sessionEngine = new SessionEngine(sqliteService);
const syncService = new SyncService(authService, sqliteService);
const onboardingService = new OnboardingService(authService);

async function startAgentLoop() {
  if (!authService.isAuthenticated()) {
    console.log("[Agent Main] No valid device credentials found. Showing onboarding window.");
    showOnboardingWindow();
    return;
  }

  // Fetch shift configuration from server
  scheduleService.onMonitoringStateChange = (state: string) => {
    console.log(`[MONITORING] Server state: ${state}`);
    if (state === "paused") {
      stopTelemetry();
    } else {
      startTelemetry();
    }
  };

  scheduleService.onFaceAuthAlert = (alertData) => {
    console.log(`[MONITORING] Face Auth Alert received: ${alertData.level}`);
    
    // Always show an aggressive modal dialog to ensure they see it, especially in local testing
    dialog.showMessageBox({
      type: 'warning',
      title: 'Face Verification Required',
      message: 'Your verification session has expired.',
      detail: 'Please open OfficeHub360 to verify your face. Your productivity tracking is suspended until verified.',
      buttons: ['Verify Now', 'Remind Me Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        shell.openExternal(alertData.url);
      }
    });

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: "Face Verification Required",
        body: "Your verification session has expired. Please click here to verify your face in OfficeHub360.",
        icon: path.join(__dirname, "../../assets/icon.png")
      });
      notification.on("click", () => {
        shell.openExternal(alertData.url);
      });
      notification.show();
    }
  };

  const creds = authService.getCredentials();
  if (creds) {
    try {
      const res = await fetch(`${creds.serverUrl}/api/public/agent/config`, {
        headers: { Authorization: `Bearer ${creds.deviceKey}` },
      });
      if (res.ok) {
        const configData = await res.json();
        scheduleService.setConfig(configData);
      }
    } catch (e) {
      console.warn("[Agent Main] Offline mode: using cached schedule.");
    }
  }

  // Start background heartbeat and sync services
  heartbeatService.start(10);
  syncService.start(5);

  function startTelemetry() {
    if (collectionTimer) return;
    console.log("[MONITORING] Collection resumed by server state");
    collectionTimer = setInterval(async () => {
      const isShiftActive = scheduleService.isWithinShift();

      if (isShiftActive) {
        const { isIdle } = idleDetector.getSystemIdleState();
        const observation = await collectorService.getActiveWindow();
        sessionEngine.processObservation(observation, isIdle);
      } else {
        sessionEngine.flushCurrentSession();
      }
    }, 1000);
  }

  function stopTelemetry() {
    if (collectionTimer) {
      console.log("[MONITORING] Collection paused by server state");
      clearInterval(collectionTimer);
      collectionTimer = null;
      sessionEngine.flushCurrentSession();
    }
  }

  const currentState = scheduleService.getMonitoringState();
  if (currentState === "paused") {
    stopTelemetry();
  } else {
    startTelemetry();
  }
}

function showOnboardingWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 450,
    height: 520,
    resizable: false,
    autoHideMenuBar: true,
    title: "Flow Focus Desktop Agent — Setup",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const distHtml = path.join(__dirname, "../renderer/index.html");
  const srcHtml = path.join(__dirname, "../../src/renderer/index.html");

  if (fs.existsSync(distHtml)) {
    mainWindow.loadFile(distHtml);
  } else if (fs.existsSync(srcHtml)) {
    mainWindow.loadFile(srcHtml);
  }
}

function updateTray(isOnline: boolean) {
  try {
    const iconPath = path.join(__dirname, "../../assets/icon.png");
    if (fs.existsSync(iconPath)) {
      const statusLabel = isOnline 
        ? "🟢 Status: Active & Monitoring" 
        : "🔴 Status: Offline (Monitoring Locally)";
        
      const contextMenu = Menu.buildFromTemplate([
        { label: "Flow Focus Desktop Agent (v1.0.0)", enabled: false },
        { type: "separator" },
        { label: statusLabel, enabled: false },
        { type: "separator" },
        {
          label: "Quit Agent",
          click: () => {
            sessionEngine.flushCurrentSession();
            app.quit();
          },
        },
      ]);
      
      if (!tray) {
        tray = new Tray(iconPath);
      }
      tray.setToolTip(isOnline ? "Flow Focus - Online" : "Flow Focus - Offline");
      tray.setContextMenu(contextMenu);
    }
  } catch (err) {
    console.error("Failed to update tray", err);
  }
}

// Handle second instance activation
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Register IPC handlers
ipcMain.handle("register-token", async (_: unknown, { token, serverUrl }: { token: string; serverUrl?: string }) => {
  const result = await onboardingService.registerWithToken(token, serverUrl);
  if (result.success) {
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    await startAgentLoop();
  }
  return result;
});

// App Lifecycle & Windows Power Event Management
app.whenReady().then(() => {
  // Initialize tray with current network state
  let lastOnlineState = net.isOnline();
  updateTray(lastOnlineState);

  // Poll network status every 3 seconds to instantly detect changes
  setInterval(() => {
    const currentOnlineState = net.isOnline();
    if (currentOnlineState !== lastOnlineState) {
      lastOnlineState = currentOnlineState;
      if (currentOnlineState) {
        console.log("[Network] Device is back online. Syncing will resume.");
        updateTray(true);
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: "Network Restored",
            body: "You are back online. Flow Focus will now sync your offline data.",
            icon: path.join(__dirname, "../../assets/icon.png")
          });
          notification.show();
        }
      } else {
        console.log("[Network] Device went offline. Monitoring continues locally.");
        updateTray(false);
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: "Network Disconnected",
            body: "Your device is offline. Flow Focus is continuing to record your productivity locally.",
            icon: path.join(__dirname, "../../assets/icon.png")
          });
          notification.show();
        }
      }
    }
  }, 3000);

  // Listen to Windows power monitor events
  powerMonitor.on("suspend", () => {
    console.log("[PowerMonitor] Windows entering sleep/suspend. Pausing active duration tracking.");
    sessionEngine.flushCurrentSession();
    if (collectionTimer) {
      clearInterval(collectionTimer);
      collectionTimer = null;
    }
  });

  powerMonitor.on("resume", () => {
    console.log("[PowerMonitor] Windows resumed from sleep. Resuming active duration tracking.");
    startAgentLoop();
  });

  powerMonitor.on("lock-screen", () => {
    console.log("[PowerMonitor] Windows screen locked. Flushing current active session.");
    sessionEngine.flushCurrentSession();
  });

  startAgentLoop();
});

app.on("window-all-closed", () => {
  // Keep agent running in background & system tray
});

app.on("before-quit", () => {
  sessionEngine.flushCurrentSession();
});
