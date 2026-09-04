import { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor } from "electron";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";

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

  // Start 1-second telemetry collection loop ONLY if currently inside shift hours
  if (collectionTimer) clearInterval(collectionTimer);

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

function createTray() {
  try {
    const iconPath = path.join(__dirname, "../../assets/icon.png");
    if (fs.existsSync(iconPath)) {
      const contextMenu = Menu.buildFromTemplate([
        { label: "Flow Focus Desktop Agent (v1.0.0)", enabled: false },
        { type: "separator" },
        { label: "Status: Active & Monitoring", enabled: false },
        { type: "separator" },
        {
          label: "Quit Agent",
          click: () => {
            sessionEngine.flushCurrentSession();
            app.quit();
          },
        },
      ]);
      tray = new Tray(iconPath);
      tray.setToolTip("Flow Focus Telemetry Agent");
      tray.setContextMenu(contextMenu);
    }
  } catch (err) {
    console.warn("[Tray] System tray initialization skipped:", err);
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
  createTray();

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
