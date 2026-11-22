// Sunfall City — gta6-01 entry program (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files
// (game/index.html plus classic scripts under game/src/, no libraries, no
// network requests) that a desktop browser runs offline. This program hands
// the entry in: it copies game/ and screenshots/ to the output directory and
// writes dossier.json there with the vendored make.fun library.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- sanity-check the screenshots before handing anything in -----------------
// The judge mostly reads the dossier's contact sheet, so an entry without its
// four staged scenes (cover, driving, chase, marina) is not worth submitting.
const shotsDir = join(here, 'screenshots');
const shotFiles = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`Sunfall City needs 3-4 screenshots in screenshots/, found ${shotFiles.length}`);
}
for (const f of shotFiles) {
  const bytes = statSync(join(shotsDir, f)).size;
  if (bytes > 262144) throw new Error(`Screenshot ${f} is ${bytes} bytes — over the 256 KiB cap`);
}

// --- copy the game and the screenshots into the output directory -------------
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// --- write the dossier the judge reads ----------------------------------------
// Caps mirror the scorer's own limits (reference/gate.json): a screenshot over
// 256 KiB, more than 993 game files or 48 MiB of game, or an over-long path
// would get the entry refused, so buildDossier is told to enforce them here.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// --- a short human-readable summary of what was handed in ----------------------
const gameEntries = readdirSync(join(out, 'game'), { recursive: true });
let gameBytes = 0;
for (const rel of gameEntries) {
  const p = join(out, 'game', rel);
  if (statSync(p).isFile()) gameBytes += statSync(p).size;
}
console.log('Sunfall City handed in:');
console.log(`  game files copied : ${gameEntries.length} (${gameBytes} bytes)`);
console.log(`  screenshots       : ${shotFiles.join(', ')} (cover: ${shotFiles[0]})`);
console.log(`  dossier           : ${join(out, 'dossier.json')}`);
