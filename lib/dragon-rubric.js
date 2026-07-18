// lib/dragon-rubric.js — the POOL allocation + bucket membership for DRAGON'S LAIR. SHADOW.
//
// Mike's rubric, 2026-07-18, refined against TIER-1 in-game evidence (Hellrazor's skill card and the
// game's own Strategy tab). Dragon was chosen as the first non-CB content because its goals are close
// to Clan Boss — single boss, land debuffs, survive its debuffs — while adding the thing CB lacks:
// WAVES. And unlike CB, dungeon keys are plentiful, so it can actually be tested.
//
// ── WHAT HELLRAZOR ACTUALLY DOES (verbatim, in-game) ─────────────────────────
//   Swipe        50% [Decrease ATK] on all enemies, 2 turns
//   Wall of Fire TWO 5% [Poison] debuffs (3 turns) + 25% [Weaken] (2 turns)
//   Inhale       fully depletes a target's Turn Meter; unlocks Scorch
//   Scorch       AoE, damage based on [Enemy MAX HP], + team-wide [Stun] 1 turn
//   Unfaltering Speed [P]  immune to [Decrease SPD] AND Turn Meter reduction
//   Almighty Immunity [P]  immune to [Stun] [Freeze] [Sleep] [Provoke] [Block Active Skills]
//                          [Block Passive Skills] [Fear] [True Fear] [Petrification] [Berserk]
//                          [Enfeeble] [Nullify] [Ensnare] [Fatigue] [Hunter's Gaze], and to
//                          cooldown-INCREASING effects.
//
// ── THE STRUCTURAL IDEA (Mike's, and it is neat) ─────────────────────────────
// Dragon is two phases (waves → boss) but the model needs NO phase machinery, because wave-clearing
// is expressed as its own BUCKET ("Crowd Control / wave management", 20). CC tags fill the wave job;
// everything else is boss-facing. The boss's immunity list therefore does NOT devalue CC — those tags
// were never aimed at him. This is why `Decrease Speed` sits in CC rather than Tempo: the boss is
// explicitly immune, but it works fine on waves.
//
// ── THE INHALE/SCORCH BURST CHECK — NO SEPARATE GATE (RULED, Mike 2026-07-18) ─
// The mechanic: "when the boss uses Inhale, a chunk of his HP bar will be marked purple. Deal that
// much damage before his next turn and Scorch will lock down again." Claude proposed modelling this
// as a standalone GATE (like the Fire Knight shield check). Mike: "#3 is usually just covered by
// damage. if you have enough damage it doesn't affect you" — which is exactly the game's own second
// option: "or just have a team that deals so much damage there's not a problem."
// So NO separate gate: a team with a full Damage bucket clears the window as a side effect. One
// fewer mechanism, and it keeps the pool honest ("all the parts make a whole") instead of bolting a
// special case onto one content.
// CAVEAT worth remembering: "enough damage" is still a THRESHOLD, and the Damage bucket currently
// measures capability rather than magnitude — so the model cannot yet VERIFY a team clears it. That
// is the same magnitude gap as everywhere else, not a Dragon-specific problem.
//
// Separately: Scorch's Stun "can't be blocked or resisted", so RES and `Block Debuffs` do NOT prevent
// it and only `Cleanse` answers it after the fact. See the poison_management note below.

export const DRAGON_ALLOCATION = {
  damage: 20, crowd_control: 20, poison_management: 15, amplification: 15, mitigation: 15, tempo: 15,
};

export const DRAGON_BUCKETS = {
  // "we want all the damage types with an emphasis on poison" (Mike). The emphasis is not a
  // preference — the game names it: "At later Stages, [Poison] and [HP Burn] debuffs are a good way
  // to make that happen" (i.e. to meet the Inhale burst check). See DAMAGE_LANE_WEIGHT below.
  damage: ['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis', 'Enemy Max HP Damage', 'Poison Explosion',
           'Single Target Damage', 'AoE Damage', 'Multi-Hit A1',
           'Reflect Damage', 'Counterattack', 'Ally Attack'],

  // WAVE MANAGEMENT. Everything here is dead on Hellrazor and alive on the waves — which is the whole
  // point of the bucket. `Decrease Speed` moved here from Tempo (RULED) for exactly that reason.
  crowd_control: ['Freeze', 'AoE Freeze', 'Stun', 'AoE Stun', 'Sleep', 'AoE Sleep', 'Provoke',
                  'Fear', 'True Fear', 'Sheep', 'Petrification', 'Ensnare', 'Seal', 'Master Seal',
                  'Hex', 'Decrease Turn Meter', 'AoE Decrease Turn Meter',
                  'AoE Decrease Turn Meter (Resistible)', 'Block Active Skills',
                  'Block Passive Skills', 'Increase Enemy Cooldowns', 'Fatigue', 'Decrease Speed'],

  // Sustain is LUMPED IN HERE (Mike). Covers the whole "keep the team functional" job against a boss
  // that stacks Decrease ATK + double Poison + Weaken + an unresistable Stun.
  // NOTE the internal asymmetry: `Block Debuffs` cannot stop Scorch's Stun ("can't be blocked or
  // resisted") while `Cleanse` removes it after. They are NOT interchangeable on this content.
  poison_management: ['Cleanse', 'Block Debuffs',
                      'Healer', 'AoE Heal', 'Continuous Heal', 'Leech', 'Revive', 'Revive on Death'],

  amplification: ['Decrease Defense', 'AoE Decrease Defense', 'Weaken', 'Poison Sensitivity',
                  'Increase Debuff Duration', 'Debuff Activation',
                  'Increase Attack', 'Increase C.Rate', 'Increase C.DMG', 'Increase ACC'],

  // Mike put Shield + Block Damage here rather than with the heals — absorption is boss-facing damage
  // prevention, restoration is part of the debuff-recovery job above.
  mitigation: ['Decrease Attack', 'Shield', 'AoE Shield', 'Block Damage', 'Taunt', 'Intercept',
               'Ally Protection', 'Magma Shield', 'Stone Skin', 'Unkillable',
               'Increase Defense', 'Increase RES', 'Decrease C.Rate', 'Decrease C.DMG', 'Decrease ACC'],

  // Your own turn economy. `Decrease Speed` is NOT here (boss immune — see CC).
  tempo: ['Increase Speed', 'Increase Turn Meter', 'Fervor', 'Reset Cooldowns'],
};

// Within the 20-point Damage bucket, DoT outweighs direct damage. PROPOSED SPLIT, not yet ruled —
// adjust if Mike wants it steeper.
export const DAMAGE_LANE_WEIGHT = { dot: 0.60, direct: 0.40 };
export const DOT_TAGS = new Set(['Poison', 'HP Burn', 'Poison Cloud', 'Necrosis',
                                 'Enemy Max HP Damage', 'Poison Explosion']);

// Nothing is "dead" on Dragon the way CC is dead on CB — the boss's immunities are covered by routing
// those tags into the wave bucket instead. Kept as an explicit empty set so the contrast with CB is
// visible rather than accidental.
export const DEAD_ON_DRAGON = new Set([]);
