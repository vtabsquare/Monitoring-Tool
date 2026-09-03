import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  registerToken: (token: string, serverUrl?: string) =>
    ipcRenderer.invoke("register-token", { token, serverUrl }),
  getAgentStatus: () => ipcRenderer.invoke("get-agent-status"),
});
