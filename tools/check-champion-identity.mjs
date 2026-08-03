// tools/check-champion-identity.mjs — ANTI-REGRESSION GUARDRAIL for the ONE champion-identity protocol.
//
// The rule (CLAUDE.md "never look a champion up by a raw or locally-normalized name"): every champion lookup
// resolves a name/alias → champions.id via the registry (lib/champion-names.js), then acts on the id. This
// script fails (exit 1) when a NEW raw-name champion lookup or a combatant-side hand-rolled identity key sneaks
// back in. It is the fence that keeps the 2026-08-03 unification from silently eroding.
//
// Run: node tools/check-champion-identity.mjs   (no DB needed — pure source scan)
//
// Two invariants are checked:
//   A) SIM combatant identity — inside lib/sim, a combatant must be matched to authored data via combatantKey(),
//      never champKey(<combatant>.name). The only allowed champKey(x.name) is the id→canonical→key derivation
//      that STAMPS recipeKey at build (marked "canonical name → key").
//   B) No raw-name CHAMPION DB lookup — .eq('name')/.in('name')/name=eq./`where …name = '…'` is forbidden when
//      it targets the champions table. Dungeon/tags/gear-set lookups, comments, `registry-exempt`-marked
//      candidate prefetches, and the deprecated bracket-scrapers are allowlisted (with reasons below).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['lib', 'tools', 'api', 'gestal-sync'];
const EXTS = new Set(['.js', '.mjs', '.cjs']);
const SELF = 'check-champion-identity.mjs';

// Deprecated one-off scrapers that write via an INSERT/UPDATE join-on-name against externally-scraped names.
// Bracket-scraping tag generation is DEPRECATED (CLAUDE.md); these are not on any live path. Flagged, not
// converted, in the 2026-08-03 identity unification. If one is ever revived, route it through the registry.
const DEPRECATED_SCRAPERS = new Set([
  'scrape-champion-tags.js', 'scrape-champion-tags-fandom.js', 'scrape-base-stats.js', 'scrape-skills-to-worksheet.js',
]);

// A raw-name lookup only matters when it targets the CHAMPIONS table. supabase-js chains put `.from('champions')`
// a few lines above the `.eq('name', …)`, and REST/SQL name the table inline — so decide by scanning a small
// window (the matched line + a few lines above) for a champions-table reference. Dungeon/tags/content lookups
// (the vast majority of name= queries) never reference champions nearby, so they are simply never flagged.
const CHAMPIONS_TABLE = /\.from\('champions'\)|[?&/]champions\?|\bfrom\s+champions\b|\binto\s+champions\b|\bupdate\s+champions\b/i;
const isChampionRawName = (line, base, windowText) => {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('#')) return false;   // comment / doc
  if (/registry-exempt/.test(line)) return false;                                    // documented candidate prefetch
  if (DEPRECATED_SCRAPERS.has(base)) return false;                                   // deprecated scraper (documented above)
  return CHAMPIONS_TABLE.test(windowText);                                           // only a champions-table name= lookup is a violation
};

// champKey(<var>.name) is combatant-side (forbidden) UNLESS it is the build-time recipeKey derivation from a
// resolved DB row (marked) or the var is a known catalog row rather than a combatant.
const isAllowedChampKey = (line) =>
  /canonical name → key/.test(line)                        // the two documented id→canonical→key stampings
  || /combatantKey/.test(line)                              // already the right helper
  || /champKey\((cat|bossCat|ch|row|dbChamp|champ)\.name\)/.test(line); // catalog DB row, not a combatant

const RAW_NAME = /\.(eq|in)\('name'|[?&]name=eq\.|(?:where|and)\b[^\n]*\bname\s*=\s*'|ch\.name\s*=\s*'/;
const CHAMPKEY_NAME = /champKey\([a-zA-Z_][a-zA-Z0-9_]*\.name\)/;

const violations = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!EXTS.has(path.extname(e.name)) || e.name === SELF) continue;
    const rel = path.relative(REPO, full).replace(/\\/g, '/');
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const ln = i + 1;
      if (rel.startsWith('lib/sim/') && CHAMPKEY_NAME.test(line) && !isAllowedChampKey(line)) {
        violations.push({ rel, ln, rule: 'A: combatant champKey(x.name) — use combatantKey()', line: line.trim() });
      }
      if (RAW_NAME.test(line)) {
        const windowText = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
        if (isChampionRawName(line, e.name, windowText)) {
          violations.push({ rel, ln, rule: 'B: raw-name champion lookup — resolve via the registry to champions.id', line: line.trim() });
        }
      }
    });
  }
}
for (const d of SCAN_DIRS) { const p = path.join(REPO, d); if (fs.existsSync(p)) walk(p); }

// QA_JSON line so tools/model-qa.mjs can classify this as a spec rung (a violation BLOCKS the ladder).
console.log('QA_JSON ' + JSON.stringify({
  rung: 'champion-identity', pass: violations.length ? 0 : 1, fail: violations.length,
  failures: violations.map(v => `${v.rel}:${v.ln} ${v.rule}`),
}));

if (violations.length) {
  console.error(`\n❌ champion-identity guardrail — ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  ${v.rel}:${v.ln}  [${v.rule}]\n      ${v.line.slice(0, 120)}`);
  console.error('\nEvery champion lookup must resolve a name/alias → champions.id via lib/champion-names.js, then act on the id.');
  console.error('If a match is a legitimate non-champion (dungeon/tags) or documented exception, add a `registry-exempt` note or extend the allowlist in this file with a reason.\n');
  process.exit(1);
}
console.log('✅ champion-identity guardrail: no raw-name champion lookups or combatant-side name keys. One protocol holds.');
