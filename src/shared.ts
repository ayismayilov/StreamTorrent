export type Language = "en" | "tr";
export type Player = "VLC";
export interface PlayerChoice {
  name: string;
  path?: string;
}
export interface MediaInfo {
  duration?: number;
  year?: string;
  title?: string;
  thumbnail?: string;
}
export interface TorrentView {
  id: string;
  name: string;
  length: number;
  downloaded: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  seeds: number;
  eta: number | null;
  paused: boolean;
  ready: boolean;
  error?: string;
  metadata: boolean;
  bufferBytes: number;
  bufferTarget: number;
  bufferSeconds: number | null;
  serving: boolean;
  player?: string;
  media?: MediaInfo;
  files: { index: number; name: string; length: number }[];
  selected: number;
}
export interface Snapshot {
  language: Language;
  torrents: TorrentView[];
  downloadSpeed: number;
  uploadSpeed: number;
  dht: boolean;
  downloadPath: string;
  defaultPlayer: PlayerChoice;
  downloadLimit: number;
  uploadLimit: number;
  protocolRegistered: boolean;
  error?: string;
}
export interface Bridge {
  snapshot(): Promise<Snapshot>;
  addMagnet(value: string): Promise<void>;
  addFile(): Promise<void>;
  action(
    id: string,
    action:
      | "pause"
      | "resume"
      | "remove"
      | "deleteFiles"
      | "reveal"
      | "copyMagnet"
      | "copyStream"
      | "openFolder",
  ): Promise<void>;
  play(id: string, player?: Player): Promise<void>;
  select(id: string, index: number): Promise<void>;
  setLanguage(language: Language): Promise<void>;
  chooseFolder(): Promise<void>;
  openFolder(): Promise<void>;
  choosePlayer(id?: string): Promise<void>;
  useVLC(): Promise<void>;
  setLimits(download: number, upload: number): Promise<void>;
  registerMagnet(): Promise<boolean>;
}
declare global {
  interface Window {
    torrent: Bridge;
  }
}
