import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { translate, translateError } from "./i18n";
import type { Snapshot, TorrentView, Language } from "./shared";
import "./style.css";
const Icon = ({ name }: { name: string }) => (
  <img className="icon" src={`./assets/${name}.svg`} alt="" />
);
const bytes = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KB", "MB", "GB"][i]}`;
};
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
const initial: Snapshot = {
  language: "en",
  torrents: [],
  downloadSpeed: 0,
  uploadSpeed: 0,
  dht: false,
  downloadPath: "",
  defaultPlayer: { name: "VLC" },
  downloadLimit: 0,
  uploadLimit: 0,
  protocolRegistered: false,
};
type Run = (fn: () => Promise<unknown>) => Promise<void>;
function App() {
  const [state, setState] = useState(initial),
    [filter, setFilter] = useState("All Torrents"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<"magnet" | "settings" | null>(null),
    [magnet, setMagnet] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    magnetInput = useRef<HTMLInputElement>(null);
  const tr = (s: string) => translate(state.language, s);
  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (!window.torrent)
          throw Error("Open the desktop app to connect to the torrent engine.");
        const data = await window.torrent.snapshot();
        if (active) setState(data);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) timer = setTimeout(poll, 800);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      if (modal === "magnet") magnetInput.current?.focus();
    } else dialog.current?.close();
  }, [modal]);
  const run: Run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      setState(await window.torrent.snapshot());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const match = (t: TorrentView, label: string) =>
    label === "All Torrents" ||
    (label === "Downloading" && t.progress < 1 && !t.paused) ||
    (label === "Paused" && t.paused) ||
    (label === "Completed" && t.progress === 1 && !t.paused);
  const list = state.torrents.filter(
    (t) =>
      match(t, filter) &&
      t.name
        .toLocaleLowerCase(state.language)
        .includes(search.toLocaleLowerCase(state.language)),
  );
  const openMagnet = () => {
    setError("");
    setMenu(null);
    setModal("magnet");
  };
  return (
    <div className="app">
      <aside>
        <div className="traffic-space" />
        <div className="brand">
          <span>
            <img className="icon" src="./assets/app-icon.png" alt="" />
          </span>
          StreamTorrent
        </div>
        <div className="caption">{tr("LIBRARY")}</div>
        <nav>
          {["All Torrents", "Downloading", "Paused", "Completed"].map(
            (label, i) => (
              <button
                key={label}
                className={filter === label ? "selected" : ""}
                onClick={() => {
                  setFilter(label);
                  setMenu(null);
                }}
              >
                <Icon name={["all", "down", "pause", "done"][i]} />
                <span>
                  {tr(label === "Paused" ? "Paused torrents" : label)}
                </span>
                <b>{state.torrents.filter((t) => match(t, label)).length}</b>
              </button>
            ),
          )}
        </nav>
        <button
          className="settings"
          onClick={() => {
            setError("");
            setMenu(null);
            setModal("settings");
          }}
        >
          <Icon name="settings" />
          {tr("Settings")}
        </button>
        <small className="version">StreamTorrent 0.2</small>
      </aside>
      <main>
        <header>
          <div>
            <h1>{tr(filter)}</h1>
            <small>
              {state.torrents.filter((t) => !t.paused && t.progress < 1).length}{" "}
              {tr("Active Torrents")}
            </small>
          </div>
          <div className="toolbar">
            <label className="search">
              <Icon name="search" />
              <input
                aria-label={tr("Search torrents")}
                placeholder={tr("Search torrents")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button onClick={openMagnet}>
              <Icon name="magnet" />
              {tr("Add Magnet")}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(() => window.torrent.addFile())}
            >
              <Icon name="plus" />
              {tr("Add Torrent")}
            </button>
          </div>
        </header>
        <div className="global">
          <span>↓ {bytes(state.downloadSpeed)}/s</span>
          <span>↑ {bytes(state.uploadSpeed)}/s</span>
          <span>
            {tr("Peers")} {state.torrents.reduce((n, t) => n + t.peers, 0)}
          </span>
          <span className={state.dht ? "green" : ""}>
            ● DHT {tr(state.dht ? "Connected" : "Connecting…")}
          </span>
          {(state.downloadLimit > 0 || state.uploadLimit > 0) && (
            <span className="limit-summary">
              {tr("Limits")}: ↓{" "}
              {state.downloadLimit
                ? bytes(state.downloadLimit) + "/s"
                : tr("Unlimited")}{" "}
              · ↑{" "}
              {state.uploadLimit
                ? bytes(state.uploadLimit) + "/s"
                : tr("Unlimited")}
            </span>
          )}
        </div>
        {(error || state.error) && !modal && (
          <div className="error" role="alert">
            {translateError(state.language, error || state.error || "")}
            <button
              aria-label={tr("Dismiss error")}
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}
        <section className="list">
          {list.map((t) => (
            <Card
              key={t.id}
              t={t}
              state={state}
              menu={menu === t.id}
              onMenu={() => setMenu(menu === t.id ? null : t.id)}
              closeMenu={() => setMenu(null)}
              run={run}
              busy={busy}
            />
          ))}
          {!list.length && (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="stream" />
              </div>
              <h2>
                {tr(
                  state.torrents.length
                    ? "No matching torrents"
                    : "Your library starts here",
                )}
              </h2>
              <p>
                {tr(
                  state.torrents.length
                    ? "Try another search or library filter."
                    : "Add a magnet link or .torrent file. Start watching while it downloads.",
                )}
              </p>
            </div>
          )}
        </section>
      </main>
      <dialog
        ref={dialog}
        className={modal === "settings" ? "settings-dialog" : ""}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="dialog-title">
          <h2>{tr(modal === "settings" ? "Settings" : "Add Magnet Link")}</h2>
          {modal === "settings" && (
            <button
              className="close"
              aria-label={tr("Close dialog")}
              onClick={() => setModal(null)}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        {modal === "magnet" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await window.torrent.addMagnet(magnet);
                setMagnet("");
                setModal(null);
                setFilter("All Torrents");
              });
            }}
          >
            <input
              ref={magnetInput}
              autoFocus
              aria-label={tr("Magnet link")}
              placeholder={tr("Paste magnet link...")}
              value={magnet}
              onChange={(e) => setMagnet(e.target.value)}
            />
            {error && (
              <p className="form-error" role="alert">
                {translateError(state.language, error)}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                {tr("Cancel")}
              </button>
              <button className="primary" disabled={busy || !magnet.trim()}>
                {tr(busy ? "Adding…" : "Add Torrent")}
              </button>
            </div>
          </form>
        ) : modal === "settings" ? (
          <Settings state={state} run={run} busy={busy} error={error} />
        ) : null}
      </dialog>
    </div>
  );
}
function Settings({
  state,
  run,
  busy,
  error,
}: {
  state: Snapshot;
  run: Run;
  busy: boolean;
  error: string;
}) {
  const tr = (s: string) => translate(state.language, s);
  const [download, setDownload] = useState(String(state.downloadLimit / 1024)),
    [upload, setUpload] = useState(String(state.uploadLimit / 1024));
  return (
    <div className="settings-content">
      <section>
        <label htmlFor="language">{tr("Language")}</label>
        <select
          id="language"
          value={state.language}
          disabled={busy}
          onChange={(e) =>
            run(() => window.torrent.setLanguage(e.target.value as Language))
          }
        >
          <option value="en">English</option>
          <option value="tr">Türkçe</option>
        </select>
      </section>
      <section>
        <h3>{tr("Default save path")}</h3>
        <code>{state.downloadPath}</code>
        <div className="setting-actions">
          <button
            disabled={busy}
            onClick={() => run(() => window.torrent.openFolder())}
          >
            {tr("Open Folder")}
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => window.torrent.chooseFolder())}
          >
            {tr("Choose Folder…")}
          </button>
        </div>
        <small>
          {tr(
            "Applies to new torrents. Existing downloads keep their current folder.",
          )}
        </small>
      </section>
      <section>
        <label htmlFor="player">{tr("Default external player")}</label>
        <div className="player-setting">
          <select
            id="player"
            value={state.defaultPlayer.path ? "custom" : "VLC"}
            disabled={busy}
            onChange={(e) =>
              run(() =>
                e.target.value === "VLC"
                  ? window.torrent.useVLC()
                  : window.torrent.choosePlayer(),
              )
            }
          >
            <option value="VLC">VLC</option>
            <option value="custom">
              {state.defaultPlayer.path
                ? state.defaultPlayer.name
                : tr("Choose Player…")}
            </option>
          </select>
          <button
            disabled={busy}
            onClick={() => run(() => window.torrent.choosePlayer())}
          >
            {tr("Choose Player…")}
          </button>
        </div>
        {state.defaultPlayer.path && <code>{state.defaultPlayer.path}</code>}
      </section>
      <section>
        <h3>{tr("Transfer limits")}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              window.torrent.setLimits(
                Math.round(Number(download) * 1024),
                Math.round(Number(upload) * 1024),
              ),
            );
          }}
        >
          <div className="limit-fields">
            <label>
              {tr("Download limit")}
              <div>
                <input
                  aria-label={tr("Download limit")}
                  type="number"
                  min="0"
                  max="1048576"
                  step="1"
                  required
                  value={download}
                  onChange={(e) => setDownload(e.target.value)}
                />
                <span>KiB/s</span>
              </div>
            </label>
            <label>
              {tr("Upload limit")}
              <div>
                <input
                  aria-label={tr("Upload limit")}
                  type="number"
                  min="0"
                  max="1048576"
                  step="1"
                  required
                  value={upload}
                  onChange={(e) => setUpload(e.target.value)}
                />
                <span>KiB/s</span>
              </div>
            </label>
          </div>
          <div className="setting-actions">
            <small>
              {tr("0 = unlimited. Applies immediately to all torrents.")}
            </small>
            <button disabled={busy} className="primary">
              {tr("Apply")}
            </button>
          </div>
        </form>
      </section>
      <section>
        <h3>{tr("Magnet links")}</h3>
        <div className="setting-actions">
          <small>
            {tr(
              state.protocolRegistered
                ? "StreamTorrent handles magnet links."
                : "Open website magnet links with StreamTorrent.",
            )}
          </small>
          <button
            disabled={busy || state.protocolRegistered}
            onClick={() =>
              run(async () => {
                if (!(await window.torrent.registerMagnet()))
                  throw Error(
                    "Could not register magnet links. Run the packaged application.",
                  );
              })
            }
          >
            {tr("Use StreamTorrent")}
          </button>
        </div>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {translateError(state.language, error)}
        </p>
      )}
    </div>
  );
}
function Card({
  t,
  state,
  menu,
  onMenu,
  closeMenu,
  run,
  busy,
}: {
  t: TorrentView;
  state: Snapshot;
  menu: boolean;
  onMenu: () => void;
  closeMenu: () => void;
  run: Run;
  busy: boolean;
}) {
  const tr = (s: string) => translate(state.language, s);
  const trigger = useRef<HTMLButtonElement>(null);
  const status = t.error
    ? "Error"
    : t.paused
      ? "Paused"
      : !t.metadata
        ? "Metadata"
        : t.serving
          ? "Streaming"
          : t.progress === 1
            ? "Completed"
            : t.ready
              ? "Ready to Play"
              : t.peers === 0
                ? "No Peers"
                : t.files.length
                  ? "Buffering"
                  : "Downloading";
  const good = t.ready || t.serving || t.progress === 1;
  const action = (a: Parameters<Window["torrent"]["action"]>[1]) =>
    run(() => window.torrent.action(t.id, a));
  const playerName = t.player || state.defaultPlayer.name;
  return (
    <article className="card">
      <div className="file-art">
        {t.media?.thumbnail ? (
          <img
            className="thumbnail"
            src={t.media.thumbnail}
            alt={tr("Video thumbnail")}
          />
        ) : (
          <>
            <Icon name="stream" />
            <span>
              {t.files
                .find((f) => f.index === t.selected)
                ?.name.split(".")
                .pop()
                ?.toUpperCase() || "TORRENT"}
            </span>
          </>
        )}
      </div>
      <div className="details">
        <div className="title-row">
          <div>
            <h3 title={t.name}>{tr(t.name)}</h3>
            <div className="media-info">
              <small>{bytes(t.length)}</small>
              {t.media?.year && <small>{t.media.year}</small>}
              {t.media?.duration && (
                <small>
                  {duration(t.media.duration)} {tr("min")}
                </small>
              )}
              {t.media?.title && (
                <small title={t.media.title}>{t.media.title}</small>
              )}
            </div>
          </div>
          <b className={`badge ${good ? "good" : ""}`}>
            {tr(status).toLocaleUpperCase(state.language)}
          </b>
        </div>
        <div className={`stream-line ${good ? "good" : ""}`}>
          <span className="stream-state">
            ●{" "}
            {t.error
              ? translateError(state.language, t.error)
              : t.paused
                ? tr("Torrent paused")
                : t.serving
                  ? `${tr("Serving to")} ${playerName}`
                  : t.ready
                    ? tr("Ready to play")
                    : t.metadata && !t.files.length
                      ? tr("No supported video in this torrent")
                      : tr("Preparing video…")}
          </span>
          {t.files.length > 0 && (
            <span
              className="buffer-inline"
              title={tr(
                "Estimated from verified bytes and average video bitrate; not the player’s playback clock.",
              )}
            >
              <span>{tr("Buffer")}</span>{" "}
              {t.bufferSeconds !== null
                ? `≈ ${duration(t.bufferSeconds)} ${tr("min")}`
                : "—"}{" "}
              <i /> {(t.bufferBytes / 1024 ** 3).toFixed(3)} GB
            </span>
          )}
        </div>
        <div className="card-bottom">
          <div className="progress-labels">
            <span>
              {tr("Download")}: {(t.progress * 100).toFixed(1)}%
            </span>
            <small>
              {tr("Downloaded")}: {bytes(t.downloaded)} / {bytes(t.length)}
            </small>
          </div>
          <progress
            max={1}
            value={t.progress}
            aria-label={tr("Download progress")}
          />
          <div className="control-row">
            <div className="actions">
              <button
                className={t.ready ? "primary" : ""}
                disabled={!t.ready || busy}
                title={state.defaultPlayer.name}
                onClick={() => run(() => window.torrent.play(t.id))}
              >
                <Icon name="play" />
                {state.defaultPlayer.name === "VLC"
                  ? tr("Open in VLC")
                  : state.language === "tr"
                    ? `${state.defaultPlayer.name} ile Aç`
                    : `Open in ${state.defaultPlayer.name}`}
              </button>
              <button
                disabled={busy}
                onClick={() => action(t.paused ? "resume" : "pause")}
              >
                <Icon name={t.paused ? "stream" : "pause"} />
                {tr(t.paused ? "Resume" : "Pause")}
              </button>
              <button
                className="delete-button"
                disabled={busy}
                title={tr("Delete Torrent and Files")}
                onClick={() => action("deleteFiles")}
              >
                {tr("Delete")}
              </button>
              <button
                ref={trigger}
                aria-label={`${tr("More actions")}: ${t.name}`}
                aria-expanded={menu}
                aria-haspopup="menu"
                onClick={onMenu}
              >
                •••
              </button>
            </div>
            <div className="stats">
              <span>↓ {bytes(t.downloadSpeed)}/s</span>
              <span>↑ {bytes(t.uploadSpeed)}/s</span>
              <span>
                {tr("Peers")} {t.peers}
              </span>
              <span title={tr("Connected peers with the complete torrent")}>
                {tr("Seeds")} {t.seeds}
              </span>
              <span>
                {tr("ETA")}{" "}
                {t.eta === null
                  ? "—"
                  : t.eta <= 0
                    ? tr("Done")
                    : duration(t.eta / 1000)}
              </span>
            </div>
          </div>
          {t.files.length > 1 && (
            <select
              className="video-select"
              aria-label={tr("Video file")}
              value={t.selected}
              disabled={busy}
              onChange={(e) =>
                run(() => window.torrent.select(t.id, Number(e.target.value)))
              }
            >
              {t.files.map((f) => (
                <option key={f.index} value={f.index}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {menu && (
        <TorrentMenu
          trigger={trigger}
          close={closeMenu}
          t={t}
          tr={tr}
          busy={busy}
          run={run}
        />
      )}
    </article>
  );
}
function TorrentMenu({
  trigger,
  close,
  t,
  tr,
  busy,
  run,
}: {
  trigger: React.RefObject<HTMLButtonElement | null>;
  close: () => void;
  t: TorrentView;
  tr: (s: string) => string;
  busy: boolean;
  run: Run;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    const button = trigger.current!.getBoundingClientRect(),
      height = ref.current?.offsetHeight || 340;
    setPosition({
      left: Math.max(8, Math.min(button.right - 244, window.innerWidth - 252)),
      top:
        button.bottom + height + 8 < window.innerHeight
          ? button.bottom + 6
          : Math.max(8, button.top - height - 6),
    });
  }, [trigger, tr]);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const pointer = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, []);
  const call = (fn: () => Promise<unknown>) => {
    close();
    void run(fn);
  };
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="torrent-menu"
      style={position}
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          const items = [
            ...ref.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          items[
            (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length
          ]?.focus();
        }
      }}
    >
      <button
        role="menuitem"
        disabled={busy || !t.ready}
        onClick={() => call(() => window.torrent.play(t.id, "VLC"))}
      >
        {tr("Open in VLC")}
      </button>
      <button
        role="menuitem"
        disabled={busy || !t.ready}
        onClick={() => call(() => window.torrent.choosePlayer(t.id))}
      >
        {tr("Choose Player…")}
      </button>
      <hr />
      <button
        role="menuitem"
        disabled={!t.metadata || t.paused}
        onClick={() => call(() => window.torrent.action(t.id, "copyStream"))}
      >
        {tr("Copy Stream URL")}
      </button>
      <button
        role="menuitem"
        onClick={() => call(() => window.torrent.action(t.id, "copyMagnet"))}
      >
        {tr("Copy Magnet Link")}
      </button>
      <hr />
      <button
        role="menuitem"
        onClick={() => call(() => window.torrent.action(t.id, "reveal"))}
      >
        {tr("Reveal in Finder")}
      </button>
      <button
        role="menuitem"
        onClick={() => call(() => window.torrent.action(t.id, "openFolder"))}
      >
        {tr("Open Download Folder")}
      </button>
      <hr />
      <button
        role="menuitem"
        disabled={busy}
        onClick={() =>
          call(() => window.torrent.action(t.id, t.paused ? "resume" : "pause"))
        }
      >
        {tr(t.paused ? "Resume" : "Pause Torrent")}
      </button>
      <button
        role="menuitem"
        className="danger"
        disabled={busy}
        onClick={() => call(() => window.torrent.action(t.id, "remove"))}
      >
        {tr("Remove Torrent")}
      </button>
      <button
        role="menuitem"
        className="danger"
        disabled={busy}
        onClick={() => call(() => window.torrent.action(t.id, "deleteFiles"))}
      >
        {tr("Delete Torrent and Files")}
      </button>
    </div>,
    document.body,
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
