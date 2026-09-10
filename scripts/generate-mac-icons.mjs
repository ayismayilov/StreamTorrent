import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'assets/icon-1024.png');
const iconset = resolve(root, 'assets/icon.iconset');
mkdirSync(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = size * scale;
    execFileSync('sips', ['-z', String(pixels), String(pixels), source, '--out', resolve(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)], { stdio: 'ignore' });
  }
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', resolve(root, 'assets/icon.icns')]);
copyFileSync(source, resolve(root, 'public/assets/app-icon.png'));
console.log('Generated macOS iconset, ICNS, and application PNG.');
