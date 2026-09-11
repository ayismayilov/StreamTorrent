import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deleteTorrentFiles } from "../electron/delete-files";
test("delete removes only manifest files and empty directories; unrelated files survive", async () => {
  const root = await mkdtemp(join(tmpdir(), "streamtorrent-delete-"));
  try {
    await mkdir(join(root, "video", "sub"), { recursive: true });
    await writeFile(join(root, "video", "sub", "movie.mp4"), "partial data");
    await writeFile(join(root, "keep.txt"), "keep");
    await deleteTorrentFiles(root, ["video/sub/movie.mp4", "missing.bin"]);
    await assert.rejects(access(join(root, "video")));
    assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "keep");
    await access(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("delete refuses traversal and symlink parent before removing any files", async () => {
  const root = await mkdtemp(join(tmpdir(), "streamtorrent-safe-"));
  const other = await mkdtemp(join(tmpdir(), "streamtorrent-other-"));
  try {
    await writeFile(join(other, "keep.mp4"), "keep");
    await writeFile(join(root, "owned.mp4"), "owned");
    await symlink(other, join(root, "linked"));
    await assert.rejects(deleteTorrentFiles(root, ["../escape.mp4"]), /Unsafe/);
    await assert.rejects(
      deleteTorrentFiles(root, ["owned.mp4", "linked/keep.mp4"]),
      /Symbolic/,
    );
    assert.equal(await readFile(join(root, "owned.mp4"), "utf8"), "owned");
    assert.equal(await readFile(join(other, "keep.mp4"), "utf8"), "keep");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
