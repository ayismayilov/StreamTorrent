import { execFile, spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { promisify } from "node:util";
import type { PlayerChoice } from "../src/shared";
const exec = promisify(execFile);
export async function launchPlayer(choice: PlayerChoice, url: string) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url))
    throw Error("Invalid stream URL");
  if (
    process.platform === "darwin" &&
    (!choice.path || choice.path.endsWith(".app"))
  ) {
    await exec("/usr/bin/open", ["-a", choice.path || "VLC", url]);
    return;
  }
  let binary = choice.path;
  if (!binary && process.platform === "win32") {
    for (const root of [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean) as string[]) {
      const candidate = join(root, "VideoLAN", "VLC", "vlc.exe");
      try {
        await access(candidate);
        binary = candidate;
        break;
      } catch {}
    }
  }
  if (!binary || !isAbsolute(binary))
    throw Error("Player not found. Choose a player in Settings.");
  await access(binary);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary!, [url], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
