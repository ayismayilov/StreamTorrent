<p align="center"><img src="assets/icon-1024.png" width="128" alt="StreamTorrent icon"></p>

# StreamTorrent

Stream video torrents in your preferred external player before the download finishes. Built for macOS Apple Silicon and Windows 11 x64, with English and Turkish interfaces.

## Downloads

[Download for Mac Apple Silicon](https://github.com/ayismayilov/StreamTorrent/releases/latest/download/StreamTorrent-0.2.0-mac-arm64.zip) · [Download for Windows 11](https://github.com/ayismayilov/StreamTorrent/releases/latest/download/StreamTorrent-0.2.0-win-x64.zip)

[All releases](https://github.com/ayismayilov/StreamTorrent/releases)

- **macOS Apple Silicon:** extract the ZIP, copy StreamTorrent.app to Applications, then open it. Quit any previous version first.
- **Windows 11 x64:** extract the entire ZIP and run StreamTorrent.exe. Keep the accompanying files together.
- Install VLC or choose an existing external player in Settings.

These are unsigned prototype builds. macOS has been tested; the Windows package has been structurally verified but has not been run on Windows.

## Features

- Magnet links and .torrent files, including browser magnet-link handling.
- Local HTTP streaming with seeking, plus separate download and video-buffer indicators.
- Default external player, download folder, and upload/download limits.
- English / Türkçe language switching.
- Video duration, year and preview when readable from media metadata.
- Pause/resume and separate removal options that either keep or delete downloaded files.

Buffer time is an estimate from contiguous downloaded bytes and average bitrate, not the external player’s playback clock.

## Türkçe

Videoları indirme tamamlanmadan VLC veya seçtiğiniz harici oynatıcıda açın. **Releases** bölümünden işletim sisteminize uygun ZIP dosyasını indirin. Ayarlardan Türkçe dilini, oynatıcıyı, indirme klasörünü ve hız limitlerini seçebilirsiniz.

**Sil** indirilmiş dosyaları korur. **Dosyalarla Birlikte Sil** onaydan sonra torrentin dosyalarını da kaldırır.

## Build from source

Requires Node.js 22.12+ and pnpm 11. Platform media tools are downloaded separately and verified against pinned checksums; binaries are not stored in Git.

```sh
pnpm install --frozen-lockfile
pnpm prepare:media
pnpm dev
```

```sh
pnpm build
pnpm test
pnpm package:mac
pnpm package:win
```

macOS packaging requires macOS. See [development notes](docs/DEVELOPMENT.tr.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Technology

Electron, TypeScript, React/Vite, WebTorrent, local HTTP streaming, FFmpeg/FFprobe. Streaming is inspired by WebTorrent Desktop’s approach; this is an independent project.

Use torrents you have permission to download and share.
