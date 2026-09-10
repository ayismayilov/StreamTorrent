import { execFile } from "node:child_process";
import { join } from "node:path";
import type { MediaInfo } from "../src/shared";
export function metadataFromProbe(data: {
  format?: { duration?: string; tags?: Record<string, string> };
  streams?: { duration?: string; tags?: Record<string, string> }[];
}): MediaInfo {
  const tags = Object.fromEntries(
    Object.entries(data.format?.tags ?? {}).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  const seconds = Number(
    data.format?.duration ||
      data.streams?.find((s) => Number(s.duration) > 0)?.duration,
  );
  const date = tags.date || tags.year || tags.release_date;
  const year = date?.match(/\b(?:18|19|20)\d{2}\b/)?.[0];
  return {
    duration: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
    year,
    title: tags.title?.slice(0, 300),
  };
}
export async function readMedia(
  toolsPath: string,
  url: string,
  signal: AbortSignal,
): Promise<MediaInfo> {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const run = (binary: string, args: string[], maxBuffer: number) =>
    new Promise<Buffer>((resolve, reject) =>
      execFile(
        join(toolsPath, binary + suffix),
        args,
        {
          encoding: "buffer",
          signal,
          timeout: 12000,
          maxBuffer,
          windowsHide: true,
        },
        (error, out) => (error ? reject(error) : resolve(out)),
      ),
    );
  const source = [
    "-protocol_whitelist",
    "http,tcp",
    "-rw_timeout",
    "6000000",
    "-probesize",
    "2097152",
    "-analyzeduration",
    "3000000",
  ];
  const raw = await run(
    "ffprobe",
    [
      "-v",
      "error",
      ...source,
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      url,
    ],
    1024 * 1024,
  );
  const data = JSON.parse(raw.toString());
  const info = metadataFromProbe(data);
  try {
    const cover = data.streams?.find(
      (s: { disposition?: { attached_pic: number } }) =>
        s.disposition?.attached_pic === 1,
    );
    const args = [
      "-v",
      "error",
      ...source,
      "-i",
      url,
      ...(cover ? ["-map", `0:${cover.index}`] : ["-ss", "2", "-map", "0:v:0"]),
      "-frames:v",
      "1",
      "-vf",
      "scale=240:-1",
      "-threads",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "pipe:1",
    ];
    const jpeg = await run("ffmpeg", args, 1024 * 1024);
    if (jpeg.length)
      info.thumbnail = "data:image/jpeg;base64," + jpeg.toString("base64");
  } catch {
    /* Duration/tags remain useful when a preview frame is not yet available. */
  }
  return info;
}
