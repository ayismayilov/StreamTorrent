import { build } from "esbuild";
await build({
  entryPoints: ["electron/main.ts"],
  outdir: "dist-electron",
  platform: "node",
  format: "esm",
  packages: "external",
  bundle: true,
  target: "node22",
});
await build({
  entryPoints: ["electron/preload.ts"],
  outfile: "dist-electron/preload.cjs",
  platform: "node",
  format: "cjs",
  external: ["electron"],
  bundle: true,
  target: "node22",
});
