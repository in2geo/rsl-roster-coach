// ── tools/analyze-runs.mjs ───────────────────────────────────────────────────
// The ⑤ pass: for each reconciled run with empty analysis, ask the LLM
// (lib/run-analysis.js) to draft answers to the feedback questions and write them
// as status='candidate' for human confirm/reject. Only touches rows where
// result_summary is null (never overwrites a confirmed/edited analysis).
//
// Usage: node tools/analyze-runs.mjs [--limit N]   (default 8; LLM calls cost tokens)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
const { analyzeRun } = await import('../lib/run-analysis.js');

const LIMIT = Number((process.argv.find(a => a.startsWith('--limit='))?.split('=')[1]) ?? 8);
const EVIDENCE = new Set(['time', 'survival', 'damage_attribution', 'aggregate_proxy', 'none']);
const LAYER = new Set(['structural', 'numeric', 'data_quality', 'none']);

const client = new pg.Client({ connectionString: env.SUPABASE_POOLER_URL });
await client.connect();

// pull a spread across classifications so the first pass shows variety
const { rows } = await client.query(`
  select id, display_name, content, account_maturity, recommended_team, leader_name,
         recommended_floor, predicted_confidence_pct, verdict_band, predicted_limiting_factor,
         successful, actual_floor, floor_vs_recommended, duration_seconds, turns,
         team_fielded, team_match, off_spec, spec_margin, classification
  from run_reconciliations
  where result_summary is null
  order by classification, battle_captured_at desc
  limit $1`, [LIMIT]);

console.log(`analyzing ${rows.length} runs…\n`);
let ok = 0;
for (const r of rows) {
  const { id, ...run } = r;
  let a; try { a = await analyzeRun(run); } catch (e) { console.log(`  ✗ ${run.content}: ${e.message}`); continue; }
  if (!a) { console.log(`  ✗ ${run.content}: unparseable`); continue; }
  const evidence = EVIDENCE.has(a.evidence) ? a.evidence : 'none';
  const layer = LAYER.has(a.feedback_layer) ? a.feedback_layer : 'none';
  await client.query(
    `update run_reconciliations set
       result_summary=$2, confirmed_capabilities=$3, evidence=$4,
       refuted_assumptions=$5, feedback_layer=$6, proposed_change=$7, status='candidate'
     where id=$1`,
    [id, a.result_summary ?? null, JSON.stringify(a.confirmed_capabilities ?? []),
     evidence, JSON.stringify(a.refuted_assumptions ?? []), layer, a.proposed_change ?? null]);
  ok++;
  console.log(`● ${run.display_name} ${run.content} [${run.classification}]`);
  console.log(`   tells us: ${a.result_summary}`);
  console.log(`   worked:   ${(a.confirmed_capabilities ?? []).join('; ') || '—'}`);
  console.log(`   confirm?: ${evidence}   |   failed: ${(a.refuted_assumptions ?? []).join('; ') || '—'}`);
  console.log(`   fix:      [${layer}] ${a.proposed_change ?? '—'}\n`);
}
await client.end();
console.log(`drafted ⑤ for ${ok}/${rows.length} runs (status=candidate).`);
