// ── tools/export-runs.mjs ────────────────────────────────────────────────────
// Export run_reconciliations to a flat, review-friendly CSV (opens in Excel /
// Google Sheets). One row per run, JSON columns unpacked into readable cells.
// Run it any time to refresh: node tools/export-runs.mjs [outfile.csv]
// Default output: <Desktop>/run-reconciliations.csv

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const OUT = process.argv[2] || path.join(os.homedir(), 'OneDrive', 'Desktop', 'run-reconciliations.csv');

const client = new pg.Client({ connectionString: env.SUPABASE_POOLER_URL });
await client.connect();
const { rows } = await client.query('select * from run_reconciliations order by battle_captured_at desc nulls last');
await client.end();

const j = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };
const team = (v) => (j(v) || []).map(c => `${c.name}(${c.gear_tier ?? '?'})`).join(', ');
const fielded = (v) => (j(v) || []).map(c => `${c.name}${c.survived === false ? '✗' : c.survived === true ? '✓' : ''}`).join(', ');
const list = (v) => (j(v) || []).join('  |  ');
const mat = (v) => { const m = j(v) || {}; return `${m.champions ?? '?'}ch ${m.lvl60 ?? '?'}@60 ${m.ascensions ?? '?'}asc`; };

// review-ordered columns: identity → verdict → prediction vs reality → the ⑤ questions
const COLS = [
  ['Account', r => r.display_name],
  ['Content', r => r.content],
  ['Classification', r => r.classification],
  ['Status', r => r.status],
  ['Won', r => r.successful === true ? 'WON' : r.successful === false ? 'lost' : ''],
  ['Rec floor', r => r.recommended_floor],
  ['Actual floor', r => r.actual_floor],
  ['Floor vs rec', r => r.floor_vs_recommended],
  ['Confidence %', r => r.predicted_confidence_pct],
  ['Duration s', r => r.duration_seconds],
  ['Turns', r => r.turns],
  ['Team match', r => r.team_match != null ? `${r.team_match}/5` : ''],
  ['Off-spec', r => r.off_spec ? 'YES' : ''],
  ['Spec margin', r => r.spec_margin != null ? Number(r.spec_margin).toFixed(2) : ''],
  ['Predicted limiter', r => r.predicted_limiting_factor],
  ['Recommended team', r => team(r.recommended_team)],
  ['Leader', r => r.leader_name],
  ['Team fielded (✓/✗)', r => fielded(r.team_fielded)],
  ['Account maturity', r => mat(r.account_maturity)],
  ['⑤ Tells us', r => r.result_summary],
  ['⑤ What worked', r => list(r.confirmed_capabilities)],
  ['⑤ Confirm why?', r => r.evidence],
  ['⑤ Didn’t work', r => list(r.refuted_assumptions)],
  ['⑤ Fix layer', r => r.feedback_layer],
  ['⑤ Proposed change', r => r.proposed_change],
  ['Captured at', r => r.battle_captured_at],
];

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const lines = [COLS.map(c => cell(c[0])).join(',')];
for (const r of rows) lines.push(COLS.map(c => cell(c[1](r))).join(','));
fs.writeFileSync(OUT, '﻿' + lines.join('\r\n')); // BOM so Excel reads UTF-8

const analyzed = rows.filter(r => r.result_summary).length;
console.log(`wrote ${rows.length} runs (${analyzed} with ⑤ analysis) → ${OUT}`);
