import { readMedia } from "./media";
import parseTorrent from "parse-torrent";
import { deleteTorrentFiles } from "./delete-files";
import WebTorrent, { type Torrent, type Options } from "webtorrent";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  Snapshot,
  TorrentView,
  PlayerChoice,
  MediaInfo,
  Language,
} from "../src/shared";
import { contiguousBytes, createGateway } from "./stream";

interface Entry {
  id: string;
  name?: string;
  filePaths?: string[];
  removing?: boolean;
  source: string;
  path: string;
  selected: number;
  paused: boolean;
  torrent?: Torrent;
  error?: string;
  requests: number;
  offset: number;
  player?: string;
  media?: MediaInfo;
  probe?: AbortController;
  probeAttempts?: number;
  nextProbe?: number;
  cached?: TorrentView;
}
const VIDEO = /\.(mp4|mkv|webm|mov|m4v|avi|mpg|mpeg|ts)$/i;
export class Engine {
  readonly client: WebTorrent;
  readonly entries = new Map<string, Entry>();
  error?: string;
  language: Language = "en";
  defaultPlayer: PlayerChoice = { name: "VLC" };
  downloadLimit = 0;
  uploadLimit = 0;
  mediaTools?: string;
  protocolRegistered = false;
  private mediaTimer?: ReturnType<typeof setInterval>;
  private saving = Promise.resolve();
  private closing = false;
  readonly gateway = createGateway((id, purpose) => {
    const e = this.entries.get(id),
      file = e?.torrent?.files[e.selected];
    if (!e || !file || !e.torrent?.ready) return;
    return {
      file,
      paused: e.paused,
      onRequest: (start: number) => {
        if (purpose === "stream") {
          e.requests++;
          e.offset = start;
        }
      },
      onClose: () => {
        if (purpose === "stream") e.requests = Math.max(0, e.requests - 1);
      },
    };
  });
  constructor(
    readonly stateDir: string,
    public downloadPath: string,
    options: Options = {},
  ) {
    this.client = new WebTorrent({ utp: false, ...options });
    this.client.on("error", (err) => {
      this.error = String(err);
    });
  }
  async start() {
    await mkdir(this.stateDir, { recursive: true });
    await mkdir(this.downloadPath, { recursive: true });
    await this.gateway.start();
    try {
      const state = JSON.parse(
        await readFile(join(this.stateDir, "session.json"), "utf8"),
      );
      if (typeof state.downloadPath === "string")
        this.downloadPath = state.downloadPath;
      if (state.language === "en" || state.language === "tr")
        this.language = state.language;
      if (
        state.defaultPlayer?.name &&
        (state.defaultPlayer.name === "VLC" ||
          typeof state.defaultPlayer.path === "string")
      )
        this.defaultPlayer = state.defaultPlayer;
      if (Number.isSafeInteger(state.downloadLimit) && state.downloadLimit >= 0)
        this.downloadLimit = state.downloadLimit;
      if (Number.isSafeInteger(state.uploadLimit) && state.uploadLimit >= 0)
        this.uploadLimit = state.uploadLimit;
      this.applyLimits();
      for (const saved of state.entries ?? []) {
        if (typeof saved.source !== "string" || typeof saved.path !== "string")
          continue;
        const e: Entry = {
          id: randomUUID(),
          name: typeof saved.name === "string" ? saved.name : undefined,
          source: saved.source,
          cached:
            saved.cached?.name && Number.isFinite(saved.cached.length)
              ? saved.cached
              : undefined,
          filePaths: Array.isArray(saved.filePaths)
            ? saved.filePaths.filter((p: unknown) => typeof p === "string")
            : undefined,
          removing: !!saved.removing,
          path: saved.path,
          selected: Number.isInteger(saved.selected) ? saved.selected : -1,
          paused: !!saved.paused,
          requests: 0,
          offset: 0,
        };
        this.entries.set(e.id, e);
        if (!e.paused && !e.removing) this.attach(e);
      }
      for (const e of [...this.entries.values()])
        if (e.removing) await this.remove(e.id);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        this.error = "Saved session could not be restored: " + String(error);
    }
  }
  enableMedia(toolsPath: string) {
    this.mediaTools = toolsPath;
    this.mediaTimer = setInterval(() => {
      for (const e of this.entries.values()) void this.probeMedia(e);
    }, 3000);
    this.mediaTimer.unref();
  }
  private async probeMedia(e: Entry) {
    if (
      !this.mediaTools ||
      e.probe ||
      e.paused ||
      e.removing ||
      !e.torrent?.ready ||
      !e.torrent.files[e.selected] ||
      e.media?.thumbnail ||
      Date.now() < (e.nextProbe ?? 0) ||
      (e.probeAttempts ?? 0) >= 4
    )
      return;
    const current = this.view(e);
    if (current.bufferBytes < Math.min(current.bufferTarget, 1024 * 1024))
      return;
    const controller = new AbortController();
    e.probe = controller;
    e.probeAttempts = (e.probeAttempts ?? 0) + 1;
    e.nextProbe = Date.now() + 15000;
    try {
      const media = await readMedia(
        this.mediaTools,
        this.gateway.url(e.id, "probe"),
        controller.signal,
      );
      if (!controller.signal.aborted && this.entries.has(e.id)) e.media = media;
    } catch {
    } finally {
      if (e.probe === controller) e.probe = undefined;
    }
  }
  private attach(e: Entry) {
    e.error = undefined;
    try {
      const input = e.source.startsWith("base64:")
        ? Buffer.from(e.source.slice(7), "base64")
        : e.source;
      const t = this.client.add(input, { path: e.path });
      e.torrent = t;
      t.on("error", (error) => {
        e.error = String(error);
      });
      t.on("done", () => {
        if (!e.media?.thumbnail) {
          e.probeAttempts = 0;
          e.nextProbe = 0;
        }
      });
      t.on("ready", () => {
        if (this.closing || e.removing) return;
        e.filePaths = t.files.map((f) => f.path);
        e.name = t.name;
        e.source = "base64:" + Buffer.from(t.torrentFile).toString("base64");
        if (
          e.selected < 0 ||
          !t.files[e.selected] ||
          !VIDEO.test(t.files[e.selected].name)
        )
          e.selected = t.files.reduce(
            (best, f, i) =>
              VIDEO.test(f.name) &&
              (best < 0 || f.length > t.files[best].length)
                ? i
                : best,
            -1,
          );
        this.prioritize(e);
        void this.save().catch(() => {});
      });
    } catch (error) {
      e.error = String(error);
    }
  }
  async add(input: string | Buffer) {
    if (typeof input === "string") {
      if (input.length > 32768) throw Error("Magnet link is too long");
      let url: URL;
      try {
        url = new URL(input);
      } catch {
        throw Error("Paste a valid magnet link");
      }
      if (
        url.protocol !== "magnet:" ||
        !url.searchParams
          .getAll("xt")
          .some((x) => /^urn:btih:([a-f\d]{40}|[a-z2-7]{32})$/i.test(x))
      )
        throw Error("A BitTorrent v1 magnet link (btih) is required");
    }
    const parsed = await parseTorrent(input);
    if (!parsed.infoHash) throw Error("Invalid magnet");
    for (const existing of this.entries.values()) {
      const known = await parseTorrent(
        existing.source.startsWith("base64:")
          ? Buffer.from(existing.source.slice(7), "base64")
          : existing.source,
      );
      if (known.infoHash === parsed.infoHash) return;
    }
    const e: Entry = {
      id: randomUUID(),
      source:
        typeof input === "string"
          ? input
          : "base64:" + input.toString("base64"),
      path: this.downloadPath,
      selected: -1,
      paused: false,
      requests: 0,
      offset: 0,
    };
    this.entries.set(e.id, e);
    this.attach(e);
    await this.save();
    if (e.error) throw Error(e.error);
  }
  get(id: string) {
    const e = this.entries.get(id);
    if (!e) throw Error("Torrent no longer exists");
    return e;
  }
  private prioritize(e: Entry) {
    const t = e.torrent,
      f = t?.files[e.selected];
    if (!t?.ready || !f) return;
    const offset = t.files
      .slice(0, e.selected)
      .reduce((n, f) => n + f.length, 0);
    // Prioritize startup and tail metadata without preventing the rest of the torrent downloading.
    const first = Math.floor(offset / t.pieceLength),
      last = Math.floor((offset + f.length - 1) / t.pieceLength);
    t.select(
      first,
      Math.min(
        last,
        Math.floor(
          (offset + Math.min(f.length, 8 * 1024 * 1024) - 1) / t.pieceLength,
        ),
      ),
      10,
    );
    t.select(Math.max(first, last - 1), last, 10);
  }
  async select(id: string, index: number) {
    const e = this.get(id);
    if (
      !Number.isInteger(index) ||
      !e.torrent?.files[index] ||
      !VIDEO.test(e.torrent.files[index].name)
    )
      throw Error("Select a video file");
    e.probe?.abort();
    e.probe = undefined;
    e.probeAttempts = 0;
    e.nextProbe = 0;
    e.media = undefined;
    this.gateway.disconnect(id);
    e.selected = index;
    e.offset = 0;
    e.player = undefined;
    this.prioritize(e);
    await this.save();
  }
  view(e: Entry): TorrentView {
    const t = e.torrent,
      file = t?.files[e.selected];
    const offset =
      t?.files.slice(0, e.selected).reduce((n, f) => n + f.length, 0) ?? 0;
    const bufferBytes =
      file && t?.ready
        ? contiguousBytes(
            { offset, length: file.length },
            t.pieceLength,
            (index) => t.pieces[index] === null,
            e.requests ? e.offset : 0,
          )
        : 0;
    const initialBuffer =
      file && t?.ready
        ? contiguousBytes(
            { offset, length: file.length },
            t.pieceLength,
            (index) => t.pieces[index] === null,
          )
        : 0;
    const target = Math.min(file?.length ?? 8 * 1024 * 1024, 8 * 1024 * 1024);
    if (!t && e.cached)
      return {
        ...e.cached,
        id: e.id,
        paused: e.paused,
        downloadSpeed: 0,
        uploadSpeed: 0,
        peers: 0,
        seeds: 0,
        serving: false,
        ready: false,
        error: e.error,
      };
    return {
      id: e.id,
      name:
        t?.name ||
        e.name ||
        (e.paused ? "Paused torrent" : "Fetching torrent metadata…"),
      length: t?.length ?? 0,
      downloaded: t?.downloaded ?? 0,
      progress: t?.progress ?? 0,
      downloadSpeed: e.paused ? 0 : (t?.downloadSpeed ?? 0),
      uploadSpeed: e.paused ? 0 : (t?.uploadSpeed ?? 0),
      peers: t?.numPeers ?? 0,
      seeds: t?.ready
        ? t.wires.filter((w) => {
            for (let i = 0; i < t.pieces.length; i++)
              if (!w.peerPieces.get(i)) return false;
            return t.pieces.length > 0;
          }).length
        : 0,
      media: e.media,
      bufferSeconds:
        e.media?.duration && file?.length
          ? Math.min(
              e.media.duration,
              (bufferBytes / file.length) * e.media.duration,
            )
          : null,
      eta: Number.isFinite(t?.timeRemaining) ? t!.timeRemaining : null,
      paused: e.paused,
      ready: !!file && !e.paused && initialBuffer >= target && target > 0,
      error: e.error,
      metadata: !!t?.ready,
      bufferBytes,
      bufferTarget: target,
      serving: e.requests > 0,
      player: e.player,
      files:
        t?.files.flatMap((f, index) =>
          VIDEO.test(f.name) ? [{ index, name: f.name, length: f.length }] : [],
        ) ?? [],
      selected: e.selected,
    };
  }
  snapshot(): Snapshot {
    return {
      language: this.language,
      defaultPlayer: this.defaultPlayer,
      downloadLimit: this.downloadLimit,
      uploadLimit: this.uploadLimit,
      protocolRegistered: this.protocolRegistered,
      torrents: [...this.entries.values()].map((e) => this.view(e)),
      downloadSpeed: this.client.downloadSpeed,
      uploadSpeed: this.client.uploadSpeed,
      dht: !!this.client.dht && this.client.dht.toJSON().nodes.length > 0,
      downloadPath: this.downloadPath,
      error: this.error,
    };
  }
  async pause(id: string) {
    const e = this.get(id);
    e.probe?.abort();
    e.probe = undefined;
    e.cached = this.view(e);
    if (e.torrent?.files.length)
      e.filePaths = e.torrent.files.map((f) => f.path);
    e.paused = true;
    this.gateway.disconnect(id);
    if (e.torrent) {
      const t = e.torrent;
      e.torrent = undefined;
      await new Promise<void>((resolve) =>
        t.destroy({ destroyStore: false }, () => resolve()),
      );
    }
    await this.save();
  }
  async resume(id: string) {
    const e = this.get(id);
    if (e.removing) throw Error("Deletion in progress");
    if (!e.paused) return;
    e.paused = false;
    this.attach(e);
    await this.save();
  }
  async manifest(e: Entry): Promise<string[]> {
    if (e.filePaths?.length) return e.filePaths;
    if (e.torrent?.files.length) return e.torrent.files.map((f) => f.path);
    if (e.source.startsWith("base64:")) {
      const metadata = await parseTorrent(
        Buffer.from(e.source.slice(7), "base64"),
      );
      return metadata.files?.map((f) => f.path) ?? [];
    }
    return [];
  }
  async remove(id: string, deleteFiles = true) {
    if (!deleteFiles) {
      const e = this.get(id);
      if (e.removing) throw Error("Deletion in progress");
      await this.pause(id);
      this.entries.delete(id);
      try {
        await this.save();
      } catch (error) {
        this.entries.set(id, e);
        throw error;
      }
      return;
    }
    const e = this.get(id);
    e.filePaths = await this.manifest(e);
    const targets = new Set(e.filePaths.map((file) => resolve(e.path, file)));
    for (const other of this.entries.values()) {
      if (other === e) continue;
      if (
        (await this.manifest(other)).some((file) =>
          targets.has(resolve(other.path, file)),
        )
      )
        throw Error("Cannot delete a file used by another torrent");
    }
    e.removing = true;
    await this.pause(id);
    // The persisted tombstone prevents re-downloading if the app exits during deletion.
    try {
      await deleteTorrentFiles(e.path, e.filePaths);
      e.cached = undefined;
      this.entries.delete(id);
      try {
        await this.save();
      } catch (error) {
        this.entries.set(id, e);
        throw error;
      }
    } catch (error) {
      e.error = String(error);
      throw error;
    }
  }
  applyLimits() {
    this.client.throttleDownload(this.downloadLimit || -1);
    this.client.throttleUpload(this.uploadLimit || -1);
  }
  async setLimits(download: number, upload: number) {
    if (
      ![download, upload].every(
        (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1024 * 1024 * 1024,
      )
    )
      throw Error("Invalid speed limit");
    this.downloadLimit = download;
    this.uploadLimit = upload;
    this.applyLimits();
    await this.save();
  }
  async setDefaultPlayer(player: PlayerChoice) {
    this.defaultPlayer = player;
    await this.save();
  }
  async setLanguage(language: Language) {
    if (language !== "en" && language !== "tr") throw Error("Invalid language");
    this.language = language;
    await this.save();
  }
  async setDownloadPath(path: string) {
    await mkdir(path, { recursive: true });
    this.downloadPath = path;
    await this.save();
  }
  save() {
    if (this.closing) return this.saving;
    this.saving = this.saving
      .catch(() => {})
      .then(async () => {
        const data = JSON.stringify({
          downloadPath: this.downloadPath,
          language: this.language,
          defaultPlayer: this.defaultPlayer,
          downloadLimit: this.downloadLimit,
          uploadLimit: this.uploadLimit,
          entries: [...this.entries.values()].map(
            ({
              source,
              path,
              selected,
              paused,
              name,
              filePaths,
              removing,
              cached,
            }) => ({
              cached: paused ? cached : undefined,
              filePaths,
              removing,
              source,
              path,
              selected,
              paused,
              name,
            }),
          ),
        });
        const file = join(this.stateDir, "session.json");
        await writeFile(file + ".tmp", data, { mode: 0o600 });
        await rename(file + ".tmp", file);
      })
      .catch((err) => {
        this.error = "Session could not be saved: " + String(err);
        throw err;
      });
    return this.saving;
  }
  async close() {
    clearInterval(this.mediaTimer);
    for (const e of this.entries.values()) e.probe?.abort();
    await this.save();
    this.closing = true;
    await this.gateway.close();
    await new Promise<void>((resolve) => this.client.destroy(() => resolve()));
  }
}
