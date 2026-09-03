import { createFileRoute } from "@tanstack/react-router";
import fs from "fs";
import path from "path";

/**
 * GET /api/public/agent/download
 * Public endpoint to download the Windows Desktop Agent Setup Executable.
 */
export const Route = createFileRoute("/api/public/agent/download")({
  server: {
    handlers: {
      GET: async () => {
        const installerPath = path.resolve(
          process.cwd(),
          "agent/release/installer/FlowFocusDesktopAgentSetup.exe",
        );

        if (!fs.existsSync(installerPath)) {
          return new Response("Installer binary not found. Please contact your administrator.", {
            status: 444,
          });
        }

        const fileBuffer = fs.readFileSync(installerPath);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="FlowFocusDesktopAgentSetup.exe"',
            "Content-Length": fileBuffer.length.toString(),
          },
        });
      },
    },
  },
});
