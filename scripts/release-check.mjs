import { _electron as electron } from "playwright";
import executablePath from "electron";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import WebTorrent from "webtorrent";
const dir = await mkdtemp(join(tmpdir(), "streamtorrent-release-"));
const chosen = join(dir, "chosen");
await mkdir(chosen);
await mkdir("verification", { recursive: true });
const seed = new WebTorrent({
  dht: false,
  tracker: false,
  lsd: false,
  natUpnp: false,
  natPmp: false,
  utp: false,
});
let app;
const env = {
  ...process.env,
  STREAMTORRENT_TEST_DIR: join(dir, "state"),
  STREAMTORRENT_DOWNLOAD_DIR: join(dir, "downloads"),
};
const launch = () =>
  electron.launch({
    executablePath: process.env.PACKAGED_APP || executablePath,
    args: process.env.PACKAGED_APP ? [] : ["."],
    env,
  });
try {
  const movie = join(dir, "Local.test.mp4");
  await promisify(execFile)(resolve("vendor/darwin-arm64/ffmpeg"), [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=15",
    "-t",
    "12",
    "-c:v",
    "mpeg4",
    "-q:v",
    "4",
    "-metadata",
    "date=2010",
    "-metadata",
    "title=Local video preview",
    "-movflags",
    "+faststart",
    movie,
  ]);
  const torrent = await new Promise((resolve) =>
    seed.seed(movie, { announce: [] }, resolve),
  );
  const magnet = torrent.magnetURI + `&x.pe=127.0.0.1:${seed.torrentPort}`;
  app = await launch();
  let page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = () => page.evaluate(() => window.torrent.snapshot());
  const waitState = async (test) => {
    for (let i = 0; i < 200; i++) {
      const s = await state();
      if (test(s)) return s;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw Error("State timeout: " + JSON.stringify(await state()));
  };
  await page.getByText("Your library starts here", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  );
  assert.equal(
    await page.getByRole("button", { name: "Add your first torrent" }).count(),
    0,
  );
  assert.equal(await page.getByText(/Playback unlocks/).count(), 0);
  assert.equal(
    await page
      .locator("nav")
      .getByRole("button", { name: /Streaming/ })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator("nav")
      .getByRole("button", { name: /Paused/ })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Add Magnet", exact: true }).click();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: "Magnet link" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("#language").selectOption("tr");
  await page.getByRole("heading", { name: "Ayarlar" }).waitFor();
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, chosen);
  await page.getByRole("button", { name: "Klasör Seç…", exact: true }).click();
  await waitState((s) => s.downloadPath === chosen);
  const custom = join(dir, "Custom Player.app");
  await mkdir(custom);
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, custom);
  await page
    .getByRole("button", { name: "Oynatıcı Seç…", exact: true })
    .click();
  await waitState((s) => s.defaultPlayer.path === custom);
  await page.locator("#player").selectOption("VLC");
  await waitState((s) => !s.defaultPlayer.path);
  await page.getByRole("spinbutton", { name: "İndirme limiti" }).fill("512");
  await page.getByRole("spinbutton", { name: "Yükleme limiti" }).fill("128");
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  await waitState(
    (s) => s.downloadLimit === 524288 && s.uploadLimit === 131072,
  );
  await page.screenshot({ path: "verification/settings-tr.png" });
  await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  await page.getByRole("button", { name: "Magnet Ekle", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Magnet bağlantısı" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("textbox", { name: "Magnet bağlantısı" }).fill(magnet);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Torrent Ekle", exact: true })
    .click();
  await waitState(
    (s) => s.torrents[0]?.ready && s.torrents[0]?.media?.thumbnail,
  );
  await page.locator(".thumbnail").waitFor();
  await page.waitForFunction(
    () => document.querySelector(".thumbnail")?.complete,
  );
  await page.screenshot({ path: "verification/library-tr.png" });
  await page.getByRole("button", { name: /Diğer işlemler:/ }).click();
  await page.getByRole("menu").waitFor();
  assert.equal(
    await page.getByRole("menuitem", { name: /IINA|mpv/ }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("menuitem", { name: "Oynatıcı Seç…" }).count(),
    1,
  );
  const box = await page.getByRole("menu").boundingBox();
  const height = await page.evaluate(() => window.innerHeight);
  assert.ok(box.y >= 0 && box.y + box.height <= height);
  await page.screenshot({ path: "verification/menu-tr.png" });
  await page.keyboard.press("Escape");
  // Cancel preserves both the entry and payload.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 0,
      checkboxChecked: false,
    });
  });
  await page.locator(".delete-button").click();
  assert.equal((await state()).torrents.length, 1);
  // Remove keeps the file.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({
      response: 1,
      checkboxChecked: false,
    });
  });
  await page.getByRole("button", { name: /Diğer işlemler:/ }).click();
  await page.getByRole("menuitem", { name: "Sil", exact: true }).click();
  await waitState((s) => s.torrents.length === 0);
  await access(join(chosen, "Local.test.mp4"));
  // Warm-start magnet delivery uses the actual application's registered event handler.
  await app.evaluate(
    ({ app }, url) => app.emit("open-url", { preventDefault() {} }, url),
    magnet,
  );
  await waitState((s) => s.torrents[0]?.ready);
  await page.locator(".delete-button").waitFor();
  await page.locator(".delete-button").click();
  await waitState((s) => s.torrents.length === 0);
  await assert.rejects(access(join(chosen, "Local.test.mp4")));
  assert.deepEqual(errors, []);
  await app.close();
  app = undefined;
  app = await launch();
  page = await app.firstWindow();
  await page.getByRole("heading", { name: "Tüm Torrentler" }).waitFor();
  const saved = await state();
  assert.equal(saved.language, "tr");
  assert.equal(saved.downloadPath, chosen);
  assert.equal(saved.downloadLimit, 524288);
  assert.equal(saved.torrents.length, 0);
  console.log(
    "PASS: Turkish/English settings, save path, custom/default player, speed limits, focus, compact card metadata, bounded menu, cancel/keep/delete, warm magnet, restart persistence",
  );
} finally {
  if (app) await app.close();
  await new Promise((resolve) => seed.destroy(resolve));
  await rm(dir, { recursive: true, force: true });
}
