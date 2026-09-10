import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  shell,
  Menu,
} from "electron";
import { join, dirname, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat, writeFile, access } from "node:fs/promises";
import { launchPlayer } from "./players";
import { Engine } from "./engine";
import { translate } from "../src/i18n";
import type { Player, Language, PlayerChoice } from "../src/shared";
const here = dirname(fileURLToPath(import.meta.url));
if (process.env.STREAMTORRENT_TEST_DIR)
  app.setPath("userData", process.env.STREAMTORRENT_TEST_DIR);
let win: BrowserWindow | undefined,
  engine: Engine | undefined,
  quitting = false;
const pending: string[] = [];
function focus() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}
function receiveMagnet(url: string) {
  if (!url.toLowerCase().startsWith("magnet:")) return;
  pending.push(url);
  focus();
  void drainLinks();
}
let draining = false;
async function drainLinks() {
  if (!engine || !win || draining) return;
  draining = true;
  try {
    while (pending.length) {
      try {
        await engine.add(pending.shift()!);
      } catch (error) {
        engine.error = String(error);
      }
    }
  } finally {
    draining = false;
  }
}
// Register before ready: macOS sends URLs here on cold start as well as warm start.
app.on("open-url", (event, url) => {
  event.preventDefault();
  receiveMagnet(url);
});
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on("second-instance", (_event, args) => {
    for (const value of args) receiveMagnet(value);
    focus();
  });
  for (const value of process.argv)
    if (value.startsWith("magnet:")) pending.push(value);
  app.whenReady().then(async () => {
    try {
      if (process.platform === "darwin" && !app.isPackaged) {
        app.dock?.setIcon(join(here, "../public/assets/app-icon.png"));
      }
      const current = new Engine(
        app.getPath("userData"),
        process.env.STREAMTORRENT_DOWNLOAD_DIR ||
          join(app.getPath("downloads"), "StreamTorrent"),
      );
      await current.start();
      engine = current;
      const tr = (value: string) => translate(current.language, value);
      current.enableMedia(
        app.isPackaged
          ? join(process.resourcesPath, "media")
          : join(here, "../vendor", `${process.platform}-${process.arch}`),
      );
      const register = () => {
        const ok = app.isPackaged
          ? app.setAsDefaultProtocolClient("magnet")
          : false;
        current.protocolRegistered = app.isDefaultProtocolClient("magnet");
        return ok;
      };
      if (app.isPackaged && !process.env.STREAMTORRENT_TEST_DIR) {
        const marker = join(
          app.getPath("userData"),
          "magnet-registration.json",
        );
        try {
          await access(marker);
        } catch {
          const ok = register();
          if (ok) await writeFile(marker, JSON.stringify({ registered: true }));
        }
      }
      current.protocolRegistered = app.isDefaultProtocolClient("magnet");
      const handle = (name: string, fn: (...args: any[]) => unknown) =>
        ipcMain.handle(name, (event, ...args) => {
          if (
            !win ||
            event.sender !== win.webContents ||
            event.senderFrame !== win.webContents.mainFrame
          )
            throw Error("Untrusted sender");
          return fn(...args);
        });
      const window = () => {
        if (!win) throw Error("Window unavailable");
        return win;
      };
      handle("snapshot", () => current.snapshot());
      handle("setLanguage", async (language: Language) => {
        await current.setLanguage(language);
        updateMenu();
      });
      handle("setLimits", (download: number, upload: number) =>
        current.setLimits(download, upload),
      );
      handle("registerMagnet", register);
      handle("addMagnet", (value: unknown) => {
        if (typeof value !== "string") throw Error("Invalid magnet");
        return current.add(value.trim());
      });
      handle("addFile", async () => {
        const result = await dialog.showOpenDialog(window(), {
          properties: ["openFile", "multiSelections"],
          filters: [{ name: tr("Torrent files"), extensions: ["torrent"] }],
        });
        for (const path of result.filePaths) {
          if ((await stat(path)).size > 10 * 1024 * 1024)
            throw Error("Torrent metadata exceeds 10 MB");
          await current.add(await readFile(path));
        }
      });
      handle("select", (id: string, index: number) =>
        current.select(id, index),
      );
      handle("chooseFolder", async () => {
        const result = await dialog.showOpenDialog(window(), {
          properties: ["openDirectory", "createDirectory"],
          title: tr("Choose download folder"),
          defaultPath: current.downloadPath,
        });
        if (result.filePaths[0])
          await current.setDownloadPath(result.filePaths[0]);
      });
      const openPath = async (path: string) => {
        const error = await shell.openPath(path);
        if (error) throw Error(error);
      };
      handle("openFolder", () => openPath(current.downloadPath));
      async function play(id: string, choice: PlayerChoice) {
        const e = current.get(id);
        if (!current.view(e).ready)
          throw Error("Wait for the initial video buffer");
        try {
          await launchPlayer(choice, current.gateway.url(id));
          e.player = choice.name;
        } catch {
          throw Error("Player not found. Choose a player in Settings.");
        }
      }
      handle("play", (id: string, player?: Player) => {
        if (player !== undefined && player !== "VLC")
          throw Error("Unsupported player");
        return play(
          id,
          player === "VLC" ? { name: "VLC" } : current.defaultPlayer,
        );
      });
      handle("useVLC", () => current.setDefaultPlayer({ name: "VLC" }));
      handle("choosePlayer", async (id?: string) => {
        if (id !== undefined) current.get(id);
        const result = await dialog.showOpenDialog(window(), {
          title: tr("Choose Player…"),
          defaultPath:
            process.platform === "darwin"
              ? "/Applications"
              : process.env.ProgramFiles,
          properties: ["openFile"],
          filters:
            process.platform === "win32"
              ? [{ name: tr("Applications"), extensions: ["exe"] }]
              : [{ name: tr("Applications"), extensions: ["app"] }],
        });
        const path = result.filePaths[0];
        if (!path) return;
        if (
          !isAbsolute(path) ||
          (process.platform === "win32"
            ? !path.toLowerCase().endsWith(".exe")
            : !path.endsWith(".app"))
        )
          throw Error("Select an application");
        const choice = {
          name: basename(path).replace(/\.(app|exe)$/i, ""),
          path,
        };
        if (id) await play(id, choice);
        else await current.setDefaultPlayer(choice);
      });
      handle("action", async (id: string, action: string) => {
        const e = current.get(id);
        if (action === "pause") return current.pause(id);
        if (action === "resume") return current.resume(id);
        if (action === "remove" || action === "deleteFiles") {
          const files = action === "deleteFiles";
          const result = await dialog.showMessageBox(window(), {
            type: "warning",
            title: tr(files ? "Delete Torrent and Files" : "Remove Torrent"),
            message: tr(
              files
                ? "Delete this torrent and its downloaded files?"
                : "Remove this torrent from the library?",
            ),
            detail:
              e.name +
              "\n\n" +
              tr(
                files
                  ? "Downloaded files and saved torrent data will be permanently deleted."
                  : "Downloaded files will be kept.",
              ),
            buttons: [
              tr("Cancel"),
              tr(files ? "Delete Torrent and Files" : "Remove Torrent"),
            ],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          if (result.response === 1) await current.remove(id, files);
          return;
        }
        if (action === "reveal") {
          shell.showItemInFolder(
            e.torrent?.files[e.selected]
              ? join(e.path, e.torrent.files[e.selected].path)
              : e.path,
          );
          return;
        }
        if (action === "openFolder") return openPath(e.path);
        if (action === "copyMagnet") {
          if (e.torrent?.magnetURI) clipboard.writeText(e.torrent.magnetURI);
          else if (e.source.startsWith("magnet:"))
            clipboard.writeText(e.source);
          else {
            const parse = (await import("parse-torrent")).default;
            const { toMagnetURI } = await import("parse-torrent");
            const metadata = await parse(
              Buffer.from(e.source.slice(7), "base64"),
            );
            clipboard.writeText(
              toMagnetURI({
                infoHash: metadata.infoHash,
                name: metadata.name,
                announce: metadata.announce,
                urlList: metadata.urlList,
              }),
            );
          }
          return;
        }
        if (action === "copyStream") {
          if (!e.torrent?.files[e.selected]) throw Error("No video available");
          clipboard.writeText(current.gateway.url(id));
          return;
        }
        throw Error("Unknown action");
      });
      function createWindow() {
        win = new BrowserWindow({
          width: 1440,
          height: 900,
          minWidth: 1060,
          minHeight: 660,
          title: "StreamTorrent",
          backgroundColor: "#0b0d10",
          ...(process.platform === "darwin"
            ? {
                titleBarStyle: "hiddenInset" as const,
                trafficLightPosition: { x: 14, y: 18 },
              }
            : {}),
          webPreferences: {
            preload: join(here, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", (event) => event.preventDefault());
        const dev = process.env.STREAMTORRENT_DEV_URL;
        if (dev) void win.loadURL(dev);
        else void win.loadFile(join(here, "../dist/index.html"));
      }
      function updateMenu() {
        Menu.setApplicationMenu(
          Menu.buildFromTemplate([
            {
              label: "StreamTorrent",
              submenu: [
                { role: "about", label: tr("About StreamTorrent") },
                { type: "separator" },
                { role: "hide", label: tr("Hide StreamTorrent") },
                { role: "quit", label: tr("Quit StreamTorrent") },
              ],
            },
            {
              label: tr("Edit"),
              submenu: [
                { role: "undo", label: tr("Undo") },
                { role: "redo", label: tr("Redo") },
                { type: "separator" },
                { role: "cut", label: tr("Cut") },
                { role: "copy", label: tr("Copy") },
                { role: "paste", label: tr("Paste") },
                { role: "selectAll", label: tr("Select All") },
              ],
            },
            {
              label: tr("View"),
              submenu: [
                { role: "reload", label: tr("Reload") },
                { role: "togglefullscreen", label: tr("Toggle Full Screen") },
              ],
            },
            {
              label: tr("Window"),
              submenu: [
                { role: "minimize", label: tr("Minimize") },
                { role: "zoom", label: tr("Zoom") },
              ],
            },
          ]),
        );
      }
      updateMenu();
      createWindow();
      void drainLinks();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
      app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
      });
      app.on("before-quit", (event) => {
        if (!quitting) {
          event.preventDefault();
          quitting = true;
          void current.close().finally(() => app.quit());
        }
      });
    } catch (error) {
      dialog.showErrorBox("StreamTorrent", String(error));
      app.quit();
    }
  });
}
