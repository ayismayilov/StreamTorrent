import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import WebTorrent, { type Torrent } from "webtorrent";
import { Engine } from "../electron/engine";
const wait = async (check: () => boolean, timeout = 25000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout)
      throw Error("Timed out waiting for torrent state");
    await new Promise((r) => setTimeout(r, 50));
  }
};
const offline = {
  dht: false,
  tracker: false,
  lsd: false,
  natUpnp: false,
  natPmp: false,
  utp: false,
};
test(
  "real torrent: metadata, partial-download HTTP seek, pause/resume, file persistence",
  { timeout: 90000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "streamtorrent-test-"));
    const seed = new WebTorrent(offline),
      engine = new Engine(join(root, "state"), join(root, "download"), {
        ...offline,
        downloadLimit: 2 * 1024 * 1024,
      });
    const data = randomBytes(32 * 1024 * 1024);
    const path = join(root, "fixture.mp4");
    await writeFile(path, data);
    let restored: Engine | undefined;
    try {
      await engine.start();
      await engine.setLanguage("tr");
      await engine.setLimits(2 * 1024 * 1024, 128 * 1024);
      await engine.setDownloadPath(join(root, "chosen"));
      await assert.rejects(engine.add("https://example.com"), /magnet/i);
      const torrent = await new Promise<Torrent>((resolve, reject) => {
        seed.on("error", reject);
        seed.seed(path, { announce: [] }, resolve);
      });
      await engine.add(Buffer.from(torrent.torrentFile));
      const entry = [...engine.entries.values()][0];
      await wait(() => !!entry.torrent?.ready);
      assert.equal(engine.view(entry).files.length, 1);
      entry.torrent!.addPeer(`127.0.0.1:${seed.torrentPort}`);
      await wait(() => engine.view(entry).ready);
      assert.ok(
        engine.view(entry).progress < 1,
        "playback is enabled before full download",
      );
      assert.ok(engine.view(entry).bufferBytes >= 8 * 1024 * 1024);
      const start = 20 * 1024 * 1024 + 17,
        end = start + 131071;
      const response = await fetch(engine.gateway.url(entry.id), {
        headers: { Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(20000),
      });
      assert.equal(response.status, 206);
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        data.subarray(start, end + 1),
      );
      await engine.pause(entry.id);
      assert.equal(engine.view(entry).paused, true);
      assert.equal(engine.view(entry).downloadSpeed, 0);
      await engine.resume(entry.id);
      await wait(() => !!entry.torrent?.ready);
      assert.ok(entry.torrent!.downloaded > 0, "resume reuses verified data");
      await engine.pause(entry.id);
      await access(join(root, "chosen", "fixture.mp4"));
      // Simulate an older saved session with no stored manifest.
      entry.filePaths = undefined;
      await engine.close();
      restored = new Engine(
        join(root, "state"),
        join(root, "download"),
        offline,
      );
      await restored.start();
      assert.equal(restored.entries.size, 1);
      assert.equal(restored.language, "tr");
      assert.equal(restored.downloadPath, join(root, "chosen"));
      assert.equal([...restored.entries.values()][0].paused, true);
      assert.ok(restored.snapshot().torrents[0].downloaded > 0);
      assert.equal(
        restored.snapshot().torrents[0].id,
        [...restored.entries.keys()][0],
      );
      await restored.remove([...restored.entries.keys()][0]);
      assert.equal(restored.entries.size, 0);
      await assert.rejects(access(join(root, "chosen", "fixture.mp4")));
      const saved = JSON.parse(
        await readFile(join(root, "state", "session.json"), "utf8"),
      );
      assert.deepEqual(saved.entries, []);
      assert.equal(saved.language, "tr");
    } finally {
      if (restored) await restored.close();
      else await engine.close();
      await new Promise<void>((resolve) => seed.destroy(() => resolve()));
      await rm(root, { recursive: true, force: true });
    }
  },
);

test("settings persist and non-destructive remove keeps downloaded files", async () => {
  const root = await mkdtemp(join(tmpdir(), "streamtorrent-settings-"));
  const engine = new Engine(
    join(root, "state"),
    join(root, "downloads"),
    offline,
  );
  let restored: Engine | undefined;
  try {
    await engine.start();
    await engine.setLanguage("tr");
    await engine.setDownloadPath(join(root, "chosen"));
    await engine.setLimits(524288, 131072);
    await engine.setDefaultPlayer({
      name: "Custom Player",
      path: "/Applications/Custom Player.app",
    });
    await assert.rejects(engine.setLimits(-2, 0), /Invalid/);
    assert.equal(engine.snapshot().downloadLimit, 524288);
    const id = "fixture";
    await writeFile(join(root, "chosen", "keep.mp4"), "partial");
    engine.entries.set(id, {
      id,
      name: "keep.mp4",
      source: "magnet:?xt=urn:btih:0123456789012345678901234567890123456789",
      path: join(root, "chosen"),
      filePaths: ["keep.mp4"],
      selected: 0,
      paused: true,
      requests: 0,
      offset: 0,
    });
    await engine.remove(id, false);
    await access(join(root, "chosen", "keep.mp4"));
    await engine.close();
    restored = new Engine(
      join(root, "state"),
      join(root, "downloads"),
      offline,
    );
    await restored.start();
    assert.equal(restored.language, "tr");
    assert.equal(restored.downloadPath, join(root, "chosen"));
    assert.equal(restored.downloadLimit, 524288);
    assert.equal(restored.uploadLimit, 131072);
    assert.equal(restored.defaultPlayer.name, "Custom Player");
    assert.equal(restored.entries.size, 0);
  } finally {
    if (restored) await restored.close();
    else await engine.close();
    await rm(root, { recursive: true, force: true });
  }
});
