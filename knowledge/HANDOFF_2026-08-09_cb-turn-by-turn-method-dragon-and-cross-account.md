# HANDOFF 2026-08-09 — Turn-by-turn hand-calc method (CB done), next: Dragon + a different account

## TL;DR

We built an **independent, turn-by-turn hand-calc of a Clan Boss battle** (`tools/handcalc/cb.mjs`) and
**walked it action-by-action against a real DonaHilvi video**. That method — comparing each *action* to a
labelled *real observation* — found and fixed a stack of errors that aggregate totals had been hiding, and got
the model to **0.97× on the total with Ninja/Mikey nailed out-of-sample**. This is the first dungeon proven
calibratable to per-action reality, and the method is what we're carrying forward.

**Durable memory:** [[cb-handcalc-turn-by-turn-calibration-2026-08-09]] (full validated findings + the discipline
notes). This handoff = how to continue into **Dragon** and into **a different account's CB team**.

---

## What the method is (and why it beat the engine)

- The hand-calc is deterministic (EV, not RNG) and small (~200 lines, every number traceable). Those two
  properties are what make per-action comparison *possible*; the "by hand" framing is not the point.
- **A total is underdetermined** — many wrong models fit it because errors cancel (we sat at 0.97× total while
  Xeno was 0.64× and the direct-dealers were 1.4×). **A turn-by-turn trace is overdetermined** — each action,
  under known conditions, is a near-controlled experiment that localises the error to one mechanic.
- **IMPLEMENT, DON'T FIT.** Mike caught me fitting twice (3-turn poison → it's 2; booked counter-poison → his
  Xeno is unbooked). Every real fix came from his narration, not from tuning to the total.
- **No reliable automated ground truth exists.** The per-action battle-reader blobs are uncracked (tried many
  times). The per-hero capture has been deemed unreliable (duplicates; only captures occasionally). ⇒ **The human
  is the sensor.** This is not a blocker — it *forces* the right architecture: implement the game's mechanics,
  verify turn-by-turn on a bounded set of diverse cases, and trust generalisation (an implemented model needs
  data to *verify*, not to *learn*).

## Why one calibration generalises to new teams

- **The enemy is fixed** — boss DEF/rotation/HP/SPD/mechanics don't change when you swap champs, so the whole
  enemy calibration applies to *every* team for free.
- **Champion kits are champion-specific, and the library COMPOUNDS across all dungeons** — a champ verified for
  CB is verified for Dragon/Spider/etc.
- **Interactions emerge** from the implementation (you don't enumerate synergies — they're computed).
- **Edge:** a team only exercises the mechanics it uses. The DEF≈0 bug was invisible to a poison carrier (poison
  is DEF-independent); only the direct hits exposed it. ⇒ **harden each dungeon with a few DELIBERATELY DIVERSE
  teams** (poison / direct-nuke / control), which exercise the different mechanic classes. A new team that reveals
  a gap = progress, not failure.

---

## The tool (state as of this session)

- `tools/handcalc/cb.mjs` — the engine. Env knobs: `TRACE=N` (action-by-action log through boss turn N),
  `BOSSDEF=` / `BOSSSPD=` overrides, `DBG=1` (slot/uptime/placement diagnostics).
- `tools/handcalc/stats.mjs` — independent effective-stats from the roster snapshot (imports nothing from `lib`).
- `tools/handcalc/KITS.md` — clause-by-clause kit spec (🟢 modelled / 🟡 partial / 🔴 deferred).
- `tools/handcalc/DUNGEON_TEMPLATE.md` — **the repeatable process playbook** for calibrating any new dungeon
  (principle, reusable-vs-per-dungeon split, step-by-step, checklist, gotchas). Follow this for Dragon.
- Reads `gestal-sync/output/DonaHilvi_a6261acc35588c94.json` (re-sync with `cd gestal-sync && node sync.js`
  after the player clicks Refresh in Gestal; watch for the STALE warning).
- Boss = data-grounded block: **SPD 140, RES 90, HP 194,130,000** (confirmed `clan_boss_stats`/`CLAN_BOSS_REVIEW.md §6`),
  **DEF ≈ 0** (turn-by-turn hits), ATK via `CB_BOSS_HIT=2460`; rotation **Flesh Wither→Dark Nova→Crushing Force**.

## CB open items (finish the dungeon)

1. ⭐ **Xeno turn-count / scheduler laps.** Xeno's hits, rotation freq, and poison ticks all match, but reality
   gives him **22 moves by boss turn 16** vs my **~18** — *below* even pure-speed (172 vs boss 140 → ~19.7). The
   TM scheduler is losing his laps: Ninja A1 (+15% self TM vs boss) and Artor A2 (+15% team TM) aren't converting
   to extra turns. Debug the discrete TM overflow / how the +15% bumps are applied. This is the last big Xeno lever.
2. **Leader speed aura.** Model hardcodes `LEADER_ACC=70`. Ezio-lead battles need **+19% of BASE SPD** to all
   allies (auras scale base only). This changes turn count (why battle 3 @ 13.54M > battle 2 @ 12.39M).
3. **Within-champion polish.** Ezio slightly over (poison attribution). Direct-dealers over at DEF=0 in *total*
   even though *hits* match — likely turn-count + WM rate (0.60 is a soft assumption). Reconcile via more turns.
4. **PORT into `lib/sim/clan_boss.js`** — DEF≈0, the FW→DN→CF rotation, boss SPD 140, the verified kits. The
   hand-calc is the instrument; the engine is the product. Nothing reaches players until this lands.

Validation set to preserve: **9.0M** (old gear) · **12.39M** (Mikey/ACC) · **13.54M** (Ezio/+19% SPD).
Per-hit anchors already in the code header: Xeno A2 crit 27,170 / A1 crit 19,543 / HP-burn 75k / Rip&Claw 30,371.

---

## NEXT STEP A — Dragon dungeon

**Read `DRAGON_REVIEW.md` in full FIRST** (hard rule) and the Dragon cold-start memory chain
([[dragon-boss-model-correction-2026-08-04]] → [[montecarlo-dragon-path-unified-2026-08-04]] →
[[dragon16-donahilvi-pool-calibration-2026-08-02]] → [[unified-speed-model-and-cc-cooldown-2026-08-02]]).

1. **Refactor first (small):** split `cb.mjs` into a **shared core** (stats engine, TM scheduler, champion kit
   library, DoT/damage formulas, TRACE harness, reality-compare report) + a **per-dungeon plug-in** (enemy stat
   blocks, enemy kit + rotation, wave structure). Or clone to `dragon.mjs` for the first pass and factor later —
   but the goal is that Dragon is a *plug-in*, not a rewrite. **The real test of the whole approach is whether
   Dragon costs LESS than CB did** because the champion library + framework carry over.
2. **Build the Dragon enemy packet** from `DRAGON_REVIEW.md` + dragon stat data: Hellrazor kit (Swipe ~3×,
   Wave-of-Fire ~3.4×, Scorch = **%maxHP escalating**, Inhale→Scorch), the **purple bar** (~10% MaxHP/hit,
   escalating; DoT counts toward it), affinity/rotation, and the **waves before the boss**. Boss stats from the
   dragon `*_stats` data the same way we grounded CB's (don't placeholder — pull confirmed SPD/HP/RES).
3. **Reuse the champion library.** The DonaHilvi Dragon pool is largely the same champs already modelled; verify
   any new ones from `seeds/*.sql`/DB **verbatim** before trusting KITS.
4. **Get 1–3 real Dragon videos from Mike**, walk turn-by-turn exactly like CB: confirm the boss rotation, pin
   the boss DEF from direct hits, confirm Scorch/purple-bar escalation against per-turn numbers, reconcile per-hero.
5. Dragon is a **survival race** too (team wipes to escalating Scorch), so the CB survival scaffolding transfers.
   Anchor: `test/golden/dragon-donahilvi-pool-current.json`. ⚠ don't inflate masteries to close a survival gap —
   find the mechanic (recurring lesson).

## NEXT STEP B — A different account's CB team (the generalisation test)

This is the payoff test: **does a NEW team slot into the calibrated CB and predict well?**

1. **Pick a diverse team** from a different account — ideally one that leans on a **mechanic DonaHilvi's team
   didn't** (e.g. a direct-nuke or Decrease-DEF-heavy comp rather than poison), so it exercises a different
   mechanic class. Accounts available in `gestal-sync/output/` (DonBambus, DonThor, DonBrogni, DonGnut, GuapoDonni,
   DonCobb07, TicoTholin) — re-sync fresh first.
2. **Run the hand-calc with that roster:** point the snapshot path at the account file, set `NAMES` to the team,
   update `LS`/`MASTERY` (lifesteal set + Warmaster/Giant-Slayer) and the leader aura for that team.
3. **Expected outcomes (both are wins):**
   - Champions already in the library + same mechanic classes → **should predict well** = generalisation confirmed.
   - New champions → model their kits (verbatim from source) = library grows.
   - A new mechanic class → may **expose a gap** the poison team hid (like DEF≈0 was hidden). That's how we find
     the next bug.
4. **Get the real result from Mike** (result screen per-hero + a few turn-by-turn frames if a champ needs
   localising) and reconcile. Watch specifically: does the **enemy** calibration (DEF≈0, rotation, SPD 140) hold
   unchanged across teams? It should — that's the thing that makes one calibration worth so much.

---

## Working agreements to keep (Mike's, this session)

- Walk the video; **don't fit the total.** If a number's off, find the *mechanic*, and say so.
- **Build enemies from data like champions** — grounded stat blocks, not placeholders (the boss SPD/DEF miss came
  from guessed values).
- **Verify kit facts from source** (`seeds/*.sql` verbatim / DB) before trusting `KITS.md`.
- Don't over-read screenshots — ask if something looks off (a stray on-screen number burned an hour once).
- The human is the sensor; keep the manual verification **bounded** (one-time per mechanic; champions compound).
