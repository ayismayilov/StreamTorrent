import { _electron as electron } from "playwright";
import { mkdtemp, mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import executablePath from "electron";
import WebTorrent from "webtorrent";
const dir = await mkdtemp(join(tmpdir(), "streamtorrent-flow-"));
const seed = new WebTorrent({
  dht: false,
  tracker: false,
  lsd: false,
  natUpnp: false,
  natPmp: false,
  utp: false,
});
let app;
try {
  const media = join(dir, "Sintel.trailer.mp4");
  await copyFile(
    process.env.VIDEO_FIXTURE || "../../work/sintel-trailer.mp4",
    media,
  );
  const torrent = await new Promise((resolve, reject) => {
    seed.once("error", reject);
    seed.seed(media, { announce: [] }, resolve);
  });
  const torrentPath = join(dir, "sintel.torrent");
  await writeFile(torrentPath, torrent.torrentFile);
  const binary = process.env.PACKAGED_APP || executablePath;
  app = await electron.launch({
    executablePath: binary,
    args: process.env.PACKAGED_APP ? [] : ["."],
    env: {
      ...process.env,
      STREAMTORRENT_TEST_DIR: join(dir, "state"),
      STREAMTORRENT_DOWNLOAD_DIR: join(dir, "downloads"),
    },
  });
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false})});
  const page = await app.firstWindow();
  await page.getByText("Your library starts here").waitFor();
  const waitState = async (predicate) => {
    let state;
    for (let i = 0; i < 150; i++) {
      state = await page.evaluate(() => window.torrent.snapshot());
      if (predicate(state)) return state;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw Error("Torrent timeout: " + JSON.stringify(state));
  };
  await page.getByRole("button", { name: "Add Magnet", exact: true }).click();
  const magnet = torrent.magnetURI + `&x.pe=${"127.0.0.1:" + seed.torrentPort}`;
  await page.getByRole("textbox", { name: "Magnet link" }).fill(magnet);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add Torrent", exact: true })
    .click();
  await waitState((s) => s.torrents[0]?.ready);
  await page.getByRole("heading", { name: "Sintel.trailer.mp4" }).waitFor();
  await page.screenshot({ path: "verification/torrent-ready.png" });
  const snapshot = await page.evaluate(() => window.torrent.snapshot());
  assert.equal(snapshot.torrents.length, 1);
  assert.equal(snapshot.torrents[0].ready, true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).waitFor();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await waitState((s) => s.torrents[0]?.ready);
  // Validate the actual .torrent picker handler with a deterministic native dialog result.
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, torrentPath);
  await page.evaluate(async () => {
    const s = await window.torrent.snapshot();
    await window.torrent.action(s.torrents[0].id, "remove");
  });
  await page.getByRole("button", { name: "Add Torrent", exact: true }).click();
  await waitState((s) => s.torrents[0]?.ready);
  assert.equal(
    (await page.evaluate(() => window.torrent.snapshot())).torrents.length,
    1,
  );
  await page.getByRole("button", { name: "Open in VLC", exact: true }).click();
  await waitState((s) => s.torrents[0]?.player === "VLC");
  console.log(
    "PASS: real magnet metadata via local peer, video ready, pause/resume, .torrent picker handler, actual macOS VLC launcher",
  );
} finally {
  if (app) await app.close();
  await new Promise((resolve) => seed.destroy(resolve));
  await rm(dir, { recursive: true, force: true });
}
