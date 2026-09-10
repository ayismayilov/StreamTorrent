import { createServer, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { Readable } from "node:stream";

export function parseRange(
  header: string | undefined,
  length: number,
): { start: number; end: number; partial: boolean } | null {
  if (!header) return { start: 0, end: length - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  let start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  let end = match[1]
    ? match[2]
      ? Math.min(Number(match[2]), length - 1)
      : length - 1
    : length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= length ||
    end < start
  )
    return null;
  return { start, end, partial: true };
}
export interface StreamFile {
  length: number;
  name: string;
  createReadStream(opts: { start: number; end: number }): Readable;
}
export interface StreamTarget {
  file: StreamFile;
  paused: boolean;
  onRequest(start: number): void;
  onClose(): void;
}
export function createGateway(
  resolve: (
    id: string,
    purpose: "stream" | "probe",
  ) => StreamTarget | undefined,
) {
  const token = randomBytes(24).toString("hex");
  const active = new Map<ServerResponse, { id: string; stream: Readable }>();
  const server = createServer((req, res) => {
    if (req.headers.origin) {
      res.writeHead(403).end();
      return;
    }
    if (!["GET", "HEAD"].includes(req.method ?? "")) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const parts = (req.url ?? "").split("/");
    if (
      parts.length !== 4 ||
      parts[1] !== token ||
      !["stream", "probe"].includes(parts[2])
    ) {
      res.writeHead(404).end();
      return;
    }
    const id = parts[3];
    const target = resolve(id, parts[2] as "stream" | "probe");
    if (!target) {
      res.writeHead(404).end();
      return;
    }
    if (target.paused) {
      res.writeHead(503, { "Retry-After": "2" }).end();
      return;
    }
    const file = target.file;
    const range = parseRange(req.headers.range, file.length);
    if (!range) {
      res.writeHead(416, { "Content-Range": `bytes */${file.length}` }).end();
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const type =
      ext === "mp4"
        ? "video/mp4"
        : ext === "webm"
          ? "video/webm"
          : ext === "mkv"
            ? "video/x-matroska"
            : "application/octet-stream";
    res.writeHead(range.partial ? 206 : 200, {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Content-Length": range.end - range.start + 1,
      "Cache-Control": "no-store",
      ...(range.partial
        ? {
            "Content-Range": `bytes ${range.start}-${range.end}/${file.length}`,
          }
        : {}),
    });
    if (req.method === "HEAD" || file.length === 0) {
      res.end();
      return;
    }
    target.onRequest(range.start);
    const source = file.createReadStream({
      start: range.start,
      end: range.end,
    });
    active.set(res, { id, stream: source });
    const timer = setTimeout(() => res.destroy(), 60_000);
    timer.unref();
    source.once("data", () => clearTimeout(timer));
    source.on("error", () => res.destroy());
    res.once("close", () => {
      clearTimeout(timer);
      source.destroy();
      active.delete(res);
      target.onClose();
    });
    source.pipe(res);
  });
  return {
    server,
    async start() {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
    },
    url(id: string, purpose: "stream" | "probe" = "stream") {
      const addr = server.address();
      if (!addr || typeof addr === "string")
        throw Error("Streaming server unavailable");
      return `http://127.0.0.1:${addr.port}/${token}/${purpose}/${id}`;
    },
    disconnect(id: string) {
      for (const [res, item] of active)
        if (item.id === id) {
          item.stream.destroy();
          res.destroy();
        }
    },
    async close() {
      for (const [res, item] of active) {
        item.stream.destroy();
        res.destroy();
      }
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
/** Contiguous verified bytes from a file-relative offset; never total scattered bytes. */
export function contiguousBytes(
  file: { offset: number; length: number },
  pieceLength: number,
  has: (index: number) => boolean,
  start = 0,
): number {
  const absolute = file.offset + start,
    end = file.offset + file.length;
  let cursor = absolute;
  while (cursor < end) {
    const piece = Math.floor(cursor / pieceLength);
    if (!has(piece)) break;
    cursor = Math.min(end, (piece + 1) * pieceLength);
  }
  return Math.max(0, cursor - absolute);
}
