import { contextBridge, ipcRenderer } from "electron";
import type { Bridge } from "../src/shared";
const bridge: Bridge = {
  snapshot: () => ipcRenderer.invoke("snapshot"),
  addMagnet: (value) => ipcRenderer.invoke("addMagnet", value),
  addFile: () => ipcRenderer.invoke("addFile"),
  action: (id, action) => ipcRenderer.invoke("action", id, action),
  play: (id, player) => ipcRenderer.invoke("play", id, player),
  select: (id, index) => ipcRenderer.invoke("select", id, index),
  setLanguage: (language) => ipcRenderer.invoke("setLanguage", language),
  chooseFolder: () => ipcRenderer.invoke("chooseFolder"),
  openFolder: () => ipcRenderer.invoke("openFolder"),
  choosePlayer: (id) => ipcRenderer.invoke("choosePlayer", id),
  useVLC: () => ipcRenderer.invoke("useVLC"),
  setLimits: (download, upload) =>
    ipcRenderer.invoke("setLimits", download, upload),
  registerMagnet: () => ipcRenderer.invoke("registerMagnet"),
};
contextBridge.exposeInMainWorld("torrent", bridge);
