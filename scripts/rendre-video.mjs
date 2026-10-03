#!/usr/bin/env node
// Rend une page animée (timeline GSAP exposée par window.positionner) en MP4 1080x1920, 30 i/s.
// Usage : node scripts/rendre-video.mjs marque/video/explication.html marque/video/lallat-explication.mp4 [secondes1,secondes2 pour des images fixes]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';

const [source, sortie, apercus] = process.argv.slice(2);
const FPS = Number(process.env.IPS || 30);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + path.resolve(source));
await p.evaluate(() => window.pret);
const scene = p.locator('#scene');
if (apercus) {
  for (const s of apercus.split(',')) {
    await p.evaluate((t) => window.positionner(t), Number(s));
    await scene.screenshot({ path: `${sortie}-${s}.png` });
  }
  await b.close();
  process.exit(0);
}
const duree = await p.evaluate(() => window.duree);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', sortie], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.ceil(duree * FPS);
for (let i = 0; i <= total; i++) {
  await p.evaluate((t) => window.positionner(t), i / FPS);
  const img = await scene.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`${i}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();
console.log('Vidéo :', sortie);
