import { lstat, unlink, rmdir } from "node:fs/promises";
import { resolve, relative, dirname, sep, isAbsolute } from "node:path";
// Delete only the torrent's manifest files; never recursively delete a user's save folder.
export async function deleteTorrentFiles(root: string, files: string[]) {
  const base = resolve(root);
  const targets = [...new Set(files)].map((file) => {
    const target = resolve(base, file),
      rel = relative(base, target);
    if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel))
      throw Error("Unsafe download file path");
    return target;
  });
  for (const target of targets) {
    for (
      let parent = dirname(target);
      parent !== base;
      parent = dirname(parent)
    ) {
      try {
        if ((await lstat(parent)).isSymbolicLink())
          throw Error(
            "Symbolic links in download folders cannot be deleted automatically",
          );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    try {
      if ((await lstat(target)).isDirectory())
        throw Error("Unsafe download file path");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const target of targets) {
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const parents = new Set<string>();
  for (const target of targets)
    for (
      let parent = dirname(target);
      parent !== base;
      parent = dirname(parent)
    )
      parents.add(parent);
  for (const parent of [...parents].sort((a, b) => b.length - a.length)) {
    try {
      await rmdir(parent);
    } catch (error) {
      if (
        !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      )
        throw error;
    }
  }
}
