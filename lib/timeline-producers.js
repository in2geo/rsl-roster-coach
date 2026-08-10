// ── lib/timeline-producers.js ────────────────────────────────────────────────
// Map the producer typeIds in a captured in-battle timeline (battle-log entry
// `timeline.boss.trace[].byProducer`) to champion NAMES, so the per-kind debuff
// breakdown reads "Xenomorph: 6" instead of "10123: 6".
//
// SELF-CONTAINED: the watcher already resolves typeId→name for the team into the
// entry's `heroes[]` (see RslBattleReader RosterLookup), so we map from that — no
// DB / roster load. This is NOT a name lookup (CLAUDE.md registry rule is about
// resolving NAMES → champion); we resolve an already-captured typeId → its already-
// resolved name. Producers not on the team (a summon, or the boss's own typeId that
// shows up on self-applied effects) fall back to a labeled typeId.

/**
 * typeId → champion name from the entry's resolved heroes, plus a label for the boss.
 * @param {{heroes?:Array<{typeId:number,name:string}>, timeline?:{boss?:{typeId:number}}}} entry
 * @returns {Map<number,string>}
 */
export function buildProducerNameMap(entry) {
  const map = new Map();
  for (const h of entry?.heroes ?? []) if (h?.typeId != null && h?.name) map.set(h.typeId, h.name);
  const bossTid = entry?.timeline?.boss?.typeId;
  if (bossTid != null && !map.has(bossTid)) map.set(bossTid, `(boss ${bossTid})`);
  return map;
}

/**
 * Re-key a `{typeId: count}` breakdown to `{name: count}`. Unknown producers become
 * `(typeId N)` rather than being dropped (so a summon/uncaptured producer stays visible).
 */
export function nameByProducer(byProducer, nameMap) {
  const out = {};
  for (const [tid, count] of Object.entries(byProducer ?? {})) {
    const name = nameMap.get(Number(tid)) ?? `(typeId ${tid})`;
    out[name] = (out[name] ?? 0) + count;
  }
  return out;
}

/**
 * The boss debuff timeline with named producers + HP scaled off the Fixed divisor:
 * [{ tSec, hp, debuffs, byName:{championName:count} }]. Null if the entry has no timeline.
 */
export function namedBossDebuffTimeline(entry) {
  const tl = entry?.timeline;
  if (!tl?.boss?.trace) return null;
  const nameMap = buildProducerNameMap(entry);
  const div = tl.fixedDivisor || 1;
  return tl.boss.trace.map((pt) => ({
    tSec: pt.tSec,
    hp: Math.round((pt.hp ?? 0) / div),
    debuffs: pt.debuffs ?? 0,
    byName: nameByProducer(pt.byProducer, nameMap),
  }));
}
