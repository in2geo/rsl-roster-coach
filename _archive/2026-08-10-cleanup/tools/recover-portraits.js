/**
 * Recover champion portraits from a faction roster screenshot.
 *
 * The original portrait pass only cropped page 1 of each faction/rarity, leaving
 * page-2+ champions without portraits even though the screenshots are on disk.
 * This recovers them: detectGrid() crops each card's (banner-free) portrait band,
 * Claude vision reads each champion's name + grid position, the two are matched by
 * position, and (optionally) uploaded for champions that currently lack a portrait.
 *
 * SAFE BY DEFAULT — preview mode: saves crops + a manifest for review, no upload,
 * no DB writes, and never overwrites an existing working portrait.
 *
 * Usage:
 *   node --env-file=.env.local tools/recover-portraits.js "<screenshot>" --rarity epic
 *   node --env-file=.env.local tools/recover-portraits.js "<screenshot>" --rarity epic --upload
 *
 * --rarity   bucket folder (rare|epic|legendary|mythical) — required
 * --out      preview output dir (default output/recovered/<rarity>)
 * --upload   upload + link champions that currently have NO working portrait
 */
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { extname } from 'path';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has  = (k) => args.includes(k);

const screenshot = args.find(a => !a.startsWith('--') && /\.(png|jpe?g)$/i.test(a));
const rarity = (flag('--rarity') ?? '').toLowerCase();
const upload = has('--upload');
const outDir = flag('--out') ?? path.join('output', 'recovered', rarity || 'unknown');

if (!screenshot || !['rare', 'epic', 'legendary', 'mythical'].includes(rarity)) {
  console.error('Usage: node --env-file=.env.local tools/recover-portraits.js "<screenshot>" --rarity epic [--upload]');
  process.exit(1);
}

const supabase = createClient(
  (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const PUBLIC_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '') +
  '/storage/v1/object/public/portraits/';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ /g, '_');
async function dHash(buffer) {
  const { data } = await sharp(buffer).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) bits = (bits << 1n) | (data[r*9+c] < data[r*9+c+1] ? 1n : 0n);
  return bits.toString(16).padStart(16, '0');
}
// Uniform-grid headshot crop: a centered square in each cell. Assumes the grid
// fills the screenshot with even spacing (validated on the faction roster crops).
// detectGrid() was tuned for the in-game Index screen and doesn't fit these.
function cellRegion(W, H, nCols, nRows, row, col) {
  const cellW = W / nCols, cellH = H / nRows;
  const side  = Math.round(Math.min(cellW, cellH) * 0.82);
  let left = Math.round(col * cellW + (cellW - side) / 2);
  let top  = Math.round(row * cellH + cellH * 0.06);
  left = Math.max(0, Math.min(left, W - side));
  top  = Math.max(0, Math.min(top,  H - side));
  return { left, top, width: side, height: side };
}

// ── 1. read image ────────────────────────────────────────────────────────────────
const buf = fs.readFileSync(screenshot);
const meta = await sharp(buf).metadata();

// ── 2. identify via vision (name + grid position) ────────────────────────────────
const mediaType = extname(screenshot).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
const resp = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  tools: [{
    name: 'grid', description: 'Champions and their grid positions',
    input_schema: { type: 'object', properties: { champions: { type: 'array', items: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'champion name on the card banner' },
        row:  { type: 'integer', description: '0-based row, top row = 0' },
        col:  { type: 'integer', description: '0-based column, left column = 0' },
      }, required: ['name', 'row', 'col'],
    } } }, required: ['champions'] },
  }],
  tool_choice: { type: 'tool', name: 'grid' },
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
    { type: 'text', text: 'This is a Raid: Shadow Legends Champion Index grid. For every card, read the champion name from its bottom banner and give its 0-based grid row and column (top-left card is row 0, col 0). Return all cards.' },
  ] }],
});
const visionChamps = resp.content.find(b => b.type === 'tool_use')?.input.champions ?? [];

// ── 3. DB lookup (existing files + champion rows) ────────────────────────────────
// Load EVERY rarity folder, not just the current one: portraits are sometimes filed
// under a different rarity folder than the champion's rarity (e.g. a Legendary whose
// portrait lives at rare/<slug>.jpg). Scanning only one folder falsely reports those as
// missing and would OVERWRITE a working portrait with a grid crop on --upload.
const bucketFiles = new Set();
for (const rar of ['rare', 'epic', 'legendary', 'mythical']) {
  const { data } = await supabase.storage.from('portraits').list(rar, { limit: 1000 });
  for (const o of (data || [])) bucketFiles.add(`${rar}/${o.name.toLowerCase()}`);
}

const { data: allChamps } = await supabase.from('champions')
  .select('id,name,rarity,portrait_url').eq('game_id', 'raid_shadow_legends');
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Alias registry so a grid SHORT name (e.g. "AUGUSTIN") resolves to the DB long name
// ("Pontiff Augustin") via its alias — the same any-name→champion.id resolution the app uses.
const byId = new Map((allChamps ?? []).map(c => [c.id, c]));
const { data: allAliases } = await supabase.from('champion_aliases')
  .select('alias,champion_id').eq('game_id', 'raid_shadow_legends');
const aliasByNorm = new Map();
for (const a of (allAliases ?? [])) { const c = byId.get(a.champion_id); if (c) aliasByNorm.set(norm(a.alias), c); }
const hasPortrait = c => { const p = c.portrait_url?.split('/portraits/')[1]?.toLowerCase(); return p && bucketFiles.has(p); };
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i; for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
// exact → unique prefix → fuzzy (only same-rarity champions still missing a portrait,
// edit distance ≤ 2, so a stylized-banner misread links but a correct one can't be re-linked).
function findChampion(name) {
  const nn = norm(name);
  const exact = (allChamps ?? []).find(x => norm(x.name) === nn);
  if (exact) return exact;
  const byAlias = aliasByNorm.get(nn);        // grid short name → DB long name via alias
  if (byAlias) return byAlias;
  const pre = (allChamps ?? []).filter(x => norm(x.name).startsWith(nn));
  if (pre.length === 1) return pre[0];
  let best = null, bestD = 99;
  for (const x of allChamps ?? []) {
    if ((x.rarity || '').toLowerCase() !== rarity || hasPortrait(x)) continue;
    const d = lev(nn, norm(x.name));
    if (d < bestD) { bestD = d; best = x; }
  }
  return best && bestD <= 2 ? { ...best, _fuzzy: bestD } : null;
}

// ── 4. match + (preview | upload) ────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
let saved = 0, uploaded = 0, skipped = 0, unmatched = 0;

// Grid extent from the vision-reported positions.
const nCols = Math.max(...visionChamps.map(v => v.col)) + 1;
const nRows = Math.max(...visionChamps.map(v => v.row)) + 1;

for (const v of visionChamps) {
  if (v.row >= nRows || v.col >= nCols || v.row < 0 || v.col < 0) {
    manifest.push({ name: v.name, pos: `${v.row},${v.col}`, status: 'bad-pos' }); skipped++; continue;
  }
  const region = cellRegion(meta.width, meta.height, nCols, nRows, v.row, v.col);
  const square = await sharp(buf).extract(region).jpeg({ quality: 90 }).toBuffer();

  const champ = await findChampion(v.name);
  const slug = slugify(champ?.name ?? v.name);
  fs.writeFileSync(path.join(outDir, `${slug}.jpg`), square);
  saved++;

  if (!champ) { manifest.push({ name: v.name, pos: `${v.row},${v.col}`, status: 'UNMATCHED in DB', crop: `${slug}.jpg` }); unmatched++; continue; }

  const curPath = champ.portrait_url?.split('/portraits/')[1]?.toLowerCase();
  const hasPortrait = curPath && bucketFiles.has(curPath);
  let action = hasPortrait ? 'has-portrait (skip)' : 'MISSING';

  if (!hasPortrait && upload) {
    const targetPath = curPath ?? `${rarity}/${slug}.jpg`;
    const { error: upErr } = await supabase.storage.from('portraits').upload(targetPath, square, { contentType: 'image/jpeg', upsert: true });
    if (upErr) action = 'upload FAILED: ' + upErr.message;
    else {
      const url = PUBLIC_BASE + targetPath;
      const { error: dbErr } = await supabase.from('champions').update({ portrait_url: url, portrait_hash: await dHash(square) }).eq('id', champ.id);
      action = dbErr ? ('link FAILED: ' + dbErr.message) : 'UPLOADED ' + targetPath;
      if (!dbErr) uploaded++;
    }
  }
  manifest.push({ name: v.name, db: champ.name, ...(champ._fuzzy != null ? { fuzzy: champ._fuzzy } : {}), pos: `${v.row},${v.col}`, rarity: champ.rarity, action, crop: `${slug}.jpg` });
}

// ── report ───────────────────────────────────────────────────────────────────────
console.log(`\nScreenshot: ${path.basename(screenshot)}  |  rarity: ${rarity}  |  ${upload ? 'UPLOAD' : 'PREVIEW'} mode`);
console.log(`grid: ${nCols}×${nRows}  vision champions: ${visionChamps.length}  crops saved: ${saved} → ${outDir}`);
console.log('manifest:');
for (const m of manifest) console.log('  ', JSON.stringify(m));
console.log(`\nsaved ${saved} | uploaded ${uploaded} | unmatched ${unmatched} | skipped ${skipped}`);
fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
