import { mkdtemp, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import WebTorrent, { type Torrent } from "webtorrent";
import { Engine } from "../electron/engine";
const options = {
  dht: false,
  tracker: false,
  lsd: false,
  natUpnp: false,
  natPmp: false,
  utp: false,
};
const dir = await mkdtemp(join(tmpdir(), "streamtorrent-vlc-"));
const seed = new WebTorrent(options),
  engine = new Engine(join(dir, "state"), join(dir, "download"), {
    ...options,
    downloadLimit: 1024 * 1024,
  });
try {
  const video = join(dir, "Sintel.mp4"),
    padding = join(dir, "z-padding.bin");
  await copyFile(
    process.env.VIDEO_FIXTURE || "../../work/sintel-trailer.mp4",
    video,
  );
  await writeFile(padding, Buffer.alloc(128 * 1024 * 1024, 7));
  const torrent = await new Promise<Torrent>((resolve, reject) => {
    seed.once("error", reject);
    seed.seed([video, padding], { announce: [] }, resolve);
  });
  await engine.start();
  await engine.add(Buffer.from(torrent.torrentFile));
  const entry = [...engine.entries.values()][0];
  const wait = async (check: () => boolean) => {
    for (let n = 0; n < 300; n++) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Timeout");
  };
  await wait(() => !!entry.torrent?.ready);
  entry.torrent!.addPeer(`127.0.0.1:${seed.torrentPort}`);
  await wait(() => engine.view(entry).ready);
  const progress = engine.view(entry).progress;
  assert.ok(progress < 1);
  let httpRequests = 0;
  engine.gateway.server.on("request", () => httpRequests++);
  const child = spawn(
    "/Applications/VLC.app/Contents/MacOS/VLC",
    [
      "-vv",
      "--intf",
      "dummy",
      "--vout",
      "dummy",
      "--aout",
      "dummy",
      "--play-and-exit",
      "--run-time=2",
      engine.gateway.url(entry.id),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  child.stderr.on("data", (data) => {
    log += data;
  });
  child.stdout.on("data", (data) => {
    log += data;
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 20000);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  clearTimeout(timer);
  await writeFile("verification/vlc-check.log", log);
  assert.ok(httpRequests > 0, "VLC requested the local HTTP stream");
  assert.match(
    log,
    /using video decoder module|avcodec decoder.*codec.*started/i,
    "VLC initialized video decoding",
  );
  assert.equal(code, 0, "VLC completed playback normally");
  console.log(
    `PASS: VLC decoded the torrent HTTP stream; playback began at ${(progress * 100).toFixed(1)}% total download, ${httpRequests} HTTP requests.`,
  );
} finally {
  await engine.close();
  await new Promise<void>((resolve) => seed.destroy(() => resolve()));
  await rm(dir, { recursive: true, force: true });
}
