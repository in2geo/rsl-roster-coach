# Dragon's Lair — content build + 10-20 gap review

Two things here: **(1)** the new Stages 1-9 & 21-25 (proposed, extending the live 10-20), and **(2)** a **doc-vs-built comparison** of the existing 10-20 that found four real gaps. For your reviewer to approve/adjust.

**Status:** new rows are `proposed`; the engine reads only `approved`, so nothing is live until sign-off. Dragon already auto-scans for the best stage.

---

## 1. Source mechanics (Hellrazor, Normal)

- **Swipe:** AoE + 50% Decrease ATK (2t). **Wall of Fire (CD3):** AoE + two 5% Poison (3t) + 25% Weaken (2t).
- **Inhale (CD3):** depletes Hellrazor's Turn Meter and unlocks the secret skill **Scorch**, turning part of his HP purple. The purple bar is **~10% of Hellrazor's MAX HP** (⚠ CORRECTED 2026-08-04 from an earlier "exactly 20%": a stage-10 solo replay showed Mikey's single Boo-Yah of ~22,930 clearing it vs boss maxHP 221,775 = ~10%, and the in-game Scorch text says only "a portion/chunk of his HP" — no % stated. The 20% figure made the sim's teams fail the Scorch race every cycle and inflated turns ~2×. Now `PURPLE_BAR_PCT` in `lib/sim/dragon.js`; reproduces Scorch-interrupted ~96% at stage 10, matching reality). **Clear the purple bar with damage** or Scorch fires next turn (**AoE + 1-turn Stun**); enough damage re-locks Scorch. **If the bar is cleared, the interrupted-Scorch turn is WASTED** — Hellrazor takes NO fall-back skill (no Swipe/Wall of Fire); his Turn Meter resets to 0 and the team gets a fresh window to cycle skills (Mike, verified in-game 2026-07-26; encoded in `lib/sim/dragon.js`, asserted by `tools/model-boss.mjs`). **Scorch is active from stage 7** — so Stages 1-6 are a simpler fight with no purple-bar race. ⚠ Because Stages 21-25 Normal + **all Hard** cap %MaxHP-damage skills at 10% of boss HP per hit (Almighty Strength), a single %MaxHP nuke can no longer break the purple bar there — it takes **≥2 hits** (or raw burst / Poison / HP Burn).
- **Immune** to Stun/Freeze/Sleep/Provoke/Fear + **Decrease Turn Meter AND Decrease SPD** — you can't slow him; speed up your own team instead.
- **Stages 21-25 only:** Almighty Strength (%MaxHP damage capped at 10%) + Almighty Persistence (Turn Meter −50%).
- **Affinity rotation:** Magic 1/5/9/13/17/20/22 · Force 2/6/10/14/18/21/25 · Spirit 3/7/11/15/19/24 · Void 4/8/12/16/23.

---

## 2. New stages (proposed)

Every stage is wave + boss, mirroring the live 10-20.

### Stages 1-6 — beginner, no Scorch
- **Wave:** clear it — `AoE Stun` · `AoE Freeze` · `AoE Decrease Turn Meter` · `AoE Damage` · *(info)* preserve HP/cooldowns
- **Boss:**
  - Deal steady damage (no purple-bar race yet): `Poison` · `HP Burn` · `High burst AoE damage`
  - Amplify: `Decrease Defense + Weaken` · `Decrease Defense only`
  - Survive his debuffs: `Cleanse` · `Block Debuffs` · `Continuous Heal` · `Decrease Attack on Hellrazor` · `Revive` · `Ally Protection`
  - *(info)* immune to Decrease TM & Decrease SPD
- **Floor:** ACC ~100

### Stages 7-9 — Scorch active (like 10-14)
Same as 1-6, but the damage goal becomes **"clear the Scorch bar before he acts."** **Floors:** ACC ~130 · RES ~200

### Stages 21-25 — Scorch + endgame passives
Same shape; the Scorch-bar goal notes that **%MaxHP nukes are capped** (Almighty Strength) so raw burst / Poison / HP Burn clear the bar. **Floors:** ACC ~250 · RES ~300. **Boss exceptions:** Almighty Strength, Almighty Persistence.

*(All floors are judgment calls — the doc's stat table is an image — flagged CALIBRATION NEEDED. RES ~300 is the doc's one concrete number.)*

---

## 3. Doc-vs-built comparison — 4 gaps in the LIVE 10-20

The doc confirms the existing 10-20 model (Inhale/Scorch, Decrease TM+SPD immunity, Swipe/Wall-of-Fire debuffs, clear-the-bar damage, Decrease DEF+Weaken, Cleanse/Decrease-ATK survival), **but the 10-20 model is missing four things the doc calls for:**

| # | Missing at 10-20 | Doc says |
|---|---|---|
| 1 | **`Block Debuffs`** on the survival goal | "a Support who can apply Block Debuff buff … to prevent all the Poisons, Weaken and Decrease Attack" |
| 2 | **`Revive`** on the survival goal | "if your team is dying easily, include a Reviver …" |
| 3 | **`Ally Protection`** on the survival goal | "… or a champion who can provide Ally Protection" |
| 4 | **A `RES` threshold (~300 at stage 20)** | "high resist stat (e.g. 300 Resist for Dungeon 20) to resist those Stun, Poison, and Weaken" |

*(Minor: the 10-20 Scorch boss-exception over-states it as "DEF-ignoring AoE + unresistable Stun" — the doc says only "AoE + 1-turn Stun." And a pre-existing `proposed` "AoE Decrease Turn Meter (resistible)" skeleton sits on the 10-20 wave goal.)*

**I built the new 1-9/21-25 stages WITH the complete set** (Block Debuffs / Revive / Ally Protection on survival + the RES floor), so they're already correct. The question is whether to **backfill these four into 10-20** too (a small seed, like the Fire Knight doc-gap fixes).

---

## 4. Please decide (per item)

**A. Mechanics correct?** Inhale→Scorch (purple bar, re-lock on damage), Scorch-from-stage-7 (so 1-6 simpler), Decrease TM + Decrease SPD immunity, Swipe/Wall-of-Fire debuffs, the 21-25 passives, affinity rotation.

**B. New-stage floors** (ACC 100 / 130 / 250; RES 200 / 300) — accept as placeholders or supply real numbers?

**C. The four 10-20 gaps (§3)** — backfill `Block Debuffs` / `Revive` / `Ally Protection` + a RES floor into the live 10-20? (Recommended — the doc calls for them and they're absent.) Also: fix the over-stated Scorch wording, and tag-or-drop the pre-existing "AoE Decrease Turn Meter (resistible)" skeleton?

**D. Go-live** — on sign-off I flip the new stages `proposed → approved` (Dragon already auto-scans). If you approve C, I fold the 10-20 backfill into the same pass.

Counts (new content): 14 stages · 84 goals · 210 solutions · **0 tagless** · floors + boss exceptions per tier. Nothing is live until you approve.
