#!/usr/bin/env node
/**
 * Regenerates every raster brand asset in public/ from the SVGs in brand/.
 *   favicon.svg, favicon.ico (16/32/48), favicon-16x16.png, favicon-32x32.png,
 *   apple-touch-icon.png, android-chrome-192/512, icons/*, og-image.png (1200x630)
 * Needs the dev dependency `sharp`:  npm i  &&  npm run brand
 * Brand: ink #0B1210 · Desk cyan #06B6D4 / #22D3EE · blue #2563EB / #3B82F6 · amber spark #D9993A
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'brand', f), 'utf8');
const dest = (...p) => {
  const f = path.join(ROOT, 'public', ...p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  return f;
};
const raster = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 });

const icon = read('desk-icon.svg');
fs.writeFileSync(dest('favicon.svg'), icon);

// Plain "any" icons (rounded tile) and Apple touch (iOS rounds it itself, so full-bleed).
const inner = icon.match(/<g transform[\s\S]*<\/g>/)[0];
const bleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#0B1210"/><g transform="translate(100 100) scale(${scale}) translate(-100 -100)">${inner}</g></svg>`;

await raster(bleed(1), 180).toFile(dest('apple-touch-icon.png'));
await raster(bleed(1), 180).toFile(dest('icons', 'apple-icon-180.png'));
await raster(icon, 192).toFile(dest('android-chrome-192x192.png'));
await raster(icon, 512).toFile(dest('android-chrome-512x512.png'));
await raster(icon, 192).toFile(dest('icons', 'icon-192x192.png'));
await raster(icon, 512).toFile(dest('icons', 'icon-512x512.png'));
await raster(icon, 196).toFile(dest('icons', 'favicon-196.png'));
await raster(icon, 96).toFile(dest('icons', 'icon-96x96.png'));
// Maskable: full-bleed ink with the mark inside the ~80% safe zone.
await raster(bleed(0.8), 192).toFile(dest('icons', 'manifest-icon-192.maskable.png'));
await raster(bleed(0.8), 512).toFile(dest('icons', 'manifest-icon-512.maskable.png'));
await raster(icon, 16).toFile(dest('favicon-16x16.png'));
await raster(icon, 32).toFile(dest('favicon-32x32.png'));

// favicon.ico (PNG-in-ICO: 16, 32, 48)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => raster(icon, s).toBuffer()));
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let off = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(off, 12);
  off += pngs[i].length;
  return e;
});
fs.writeFileSync(dest('favicon.ico'), Buffer.concat([head, ...dir, ...pngs]));

// Social share image
await sharp(Buffer.from(read('desk-og.svg')), { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(dest('og-image.png'));
// Logo used by structured data
await sharp(Buffer.from(read('desk-lockup-reversed.svg')), { density: 288 }).resize({ width: 1052 }).png().toFile(dest('logo.png'));

console.log('✔ Samuhia Desk icons, favicon and social image regenerated in public/');
