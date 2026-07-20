#!/usr/bin/env node
// tools/rec-vs-reality.mjs — THE RECOMMENDATION vs WHAT ACTUALLY HAPPENED, with the reason.
//
// Answers one question per (account, dungeon): what stage does the engine recommend, what stage has
// the player actually cleared, and WHY did the engine stop where it did?
//
// ACTUAL = the highest stage with a captured VICTORY (retreats excluded — an abandoned run is not a
// loss, and `finishCause: "Retreat"` currently grades as a defeat elsewhere).
// RECOMMENDED = a live `matchRoster` run, i.e. the number a player would actually be shown.
// WHY = the binding constraint at the FIRST stage above the recommendation — the thing that stopped
// the scan climbing. That is the actionable half: "recommended 6" tells you nothing, "RES 105 vs a
// declared floor of 300, so confidence 59 < the 80 cutoff" tells you exactly what to fix.
//
// Usage: node --env-file=.env.local tools/rec-vs-reality.mjs [AccountName]
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { matchRoster } from '../lib/match-engine.js';

const supabase = createClient((process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
  process.env.SUPABASE_SERVICE_KEY, { global: { fetch } });
const ONLY = process.argv[2];

const CONTENTS = [
  { key: 'dragon',      dungeon: "Dragon's Lair" },
  { key: 'ice_golem',   dungeon: "Ice Golem's Peak" },
  { key: 'fire_knight', dungeon: "Fire Knight's Castle" },
  { key: 'spider',      dungeon: "Spider's Den" },
];

const { data: champs } = await supabase.from('champions')
  .select('id,name,type_id,rarity,faction,affinity,base_hp,base_atk,base_def,base_spd,base_acc,base_res,champion_tags(tag_id,status,tags(name,bypasses_accuracy_check))')
  .eq('game_id', 'raid_shadow_legends');
const byType = {}, byName = {};
for (const c of champs) { if (c.type_id != null) byType[c.type_id] = c; byName[c.name.toLowerCase()] = c; }
const RANK = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3 };
const gearTierFor = c => c.level >= 60 && (c.stars || 0) >= 6 ? 'Strong' : c.level >= 50 ? 'Dungeon' : 'Starter';

const log = JSON.parse(fs.readFileSync('gestal-sync/RslBattleReader/output/battle-log.json', 'utf8'));
const battles = Array.isArray(log) ? log : (log.battles ?? log.entries ?? []);
// NB: `??` does NOT catch NaN, so an unparseable stage label would leak NaN into Math.max and
// print "NaN" as the actual clear. Guard explicitly.
const stageNum = b => {
  const n = b.stageNumber ?? Number(String(b.stage ?? '').match(/Stage (\d+)/)?.[1]);
  return Number.isFinite(n) ? n : null;
};

const rows = [];
for (const f of fs.readdirSync('gestal-sync/output').filter(x => x.endsWith('.json') && !/gear-corpus/.test(x))) {
  const snap = JSON.parse(fs.readFileSync(`gestal-sync/output/${f}`, 'utf8'));
  if (ONLY && !(snap.displayName ?? '').toLowerCase().includes(ONLY.toLowerCase())) continue;

  const roster = [];
  for (const c of snap.champions ?? []) {
    if (!RANK[c.rarity]) continue;
    const champ = byType[c.baseTypeId] ?? byName[(c.name || '').toLowerCase()];
    if (!champ) continue;
    roster.push({ id: `${c.heroId}`, level: c.level, stars: c.stars,
      ascension_level: c.ascensionLevel ?? (c.stars ? c.stars - 1 : 0), gear_tier: gearTierFor(c),
      mastery_tier: 'None', is_booked: c.rarity === 'Rare', awakening_level: c.awakenLevel ?? 0, champion: champ });
  }
  if (roster.length < 5) continue;

  for (const { key, dungeon } of CONTENTS) {
    // ACTUAL — highest captured victory, retreats excluded.
    const mine = battles.filter(b => b.displayName === snap.displayName && b.dungeon === dungeon
      && b.result === 'Victory' && !/retreat/i.test(b.finishCause ?? '') && stageNum(b) != null);
    const actual = mine.length ? Math.max(...mine.map(stageNum)) : null;

    const r = await matchRoster(roster, key).catch(e => ({ error: e.message }));
    if (r.error) { rows.push({ acct: snap.displayName, dungeon, rec: 'ERR', actual, why: r.error }); continue; }
    const rec = r.stage_number_attempted ?? null;

    // WHY — evaluate the first stage ABOVE the recommendation and report what bound it.
    /* REPORT THE SCAN'S OWN DATA, not a re-evaluation.
     * An earlier cut called `evaluateTeam` on the stage above and printed its verdict — which
     * produced the self-contradictory "conf 84 < 80". The two are NOT the same quantity:
     * `evaluateTeam` scores a FIXED team and skips `applyAffinityToConfidence`, while the scan
     * re-selects a team per stage and applies affinity. Comparing one to the other's cutoff is
     * meaningless. `r` already carries the scan's real numbers for the stage it settled on. */
    const worst = (r.threshold_results ?? [])
      .map(t => ({ ...t, rel: t.acc_reliability ?? t.reliability }))
      .filter(t => typeof t.rel === 'number')
      .sort((a, b) => a.rel - b.rel)[0];
    const bits = [];
    if ((r.gaps ?? []).length) bits.push(`GAP: ${r.gaps[0].slice(0, 52)}`);
    if (worst) bits.push(`weakest ${worst.stat?.toUpperCase()} ${worst.estimated_value ?? '?'}/${worst.threshold_value ?? '?'} = ${Math.round(worst.rel * 100)}% of floor`);
    bits.push(`conf ${r.confidence_pct ?? '?'} (${r.verdict_band ?? '?'})`);
    const why = bits.join(' · ');
    rows.push({ acct: snap.displayName, dungeon, rec, actual, why });
  }
}

const pad = (s, n) => String(s ?? '—').padEnd(n);
console.log('\n' + pad('ACCOUNT', 12) + pad('DUNGEON', 21) + pad('REC', 5) + pad('ACTUAL', 8) + pad('Δ', 6) + 'WHY THE ENGINE STOPPED THERE');
console.log('─'.repeat(140));
for (const r of rows) {
  const d = (typeof r.rec === 'number' && typeof r.actual === 'number') ? (r.actual - r.rec) : null;
  const dTxt = d == null ? '—' : (d > 0 ? `+${d}` : `${d}`);
  console.log(pad(r.acct, 12) + pad(r.dungeon, 21) + pad(r.rec, 5) + pad(r.actual, 8) + pad(dTxt, 6) + r.why);
}
console.log('\nΔ = actual − recommended.  POSITIVE means the engine UNDER-recommends (player clears higher).');
