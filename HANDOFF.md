# Session Handoff — 2026-07-06

Written for a fresh Claude Code instance to resume where we left off. Read alongside
`CLAUDE.md`, `SOURCE_HIERARCHY.md`, `STRATEGY.md`, `KNOWN_GAPS.md`, and the persistent
memory files (`~/.claude/projects/.../memory/`, indexed by `MEMORY.md`). This doc is a
snapshot; if it disagrees with the code or git, trust the code.

---

## 1. TL;DR — where we are

Long, wide-ranging session across five threads: (1) data-sourcing policy, (2) a raid.guide
bulk skill-text scrape, (3) a **champion-role reconciliation** from the master spreadsheet,
(4) **Doom Tower** modeling (now parked), and (5) a deep **local static-data cache**
investigation that ended in a clear negative result.

**Most important operational fact:** a pile of committed-seed-style SQL was produced but
**NONE of it has been applied to the live DB** — Mike runs it in Supabase. See §4.

**Most important research conclusion:** the local Raid static-data blob is a **partial,
fixed download — it does NOT grow when you view champions in-game** (proven with a Banner
Lords experiment). It is not a viable bulk source for skill mechanics. Don't re-investigate
"browse the index to fill the cache" — it's disproven (§6).

---

## 2. Git / file state

- All work this session was **file writes** (seeds, docs, Desktop CSVs, tools). **No git
  commits were made this session** (user didn't ask; "commit only when asked").
- Repo root is `C:\Users\in2ge\OneDrive\Desktop\RSL-coach\repo`. The Desktop parent
  (`...\RSL-coach\`) holds user-facing CSVs/SQL that are NOT in the repo.

---

## 3. What was done this session

### 3.1 Data-sourcing policy (CLAUDE.md + SOURCE_HIERARCHY.md)
- Confirmed: even the user's "updated" rules still **forbid automated scraping** of
  HellHades/AyumiLove/Gestal. Human reading of *factual* data from them is fine; bots are not.
- Revised the CLAUDE.md "Data sourcing — hard rules" section (factual-vs-editorial split).
- Created **`SOURCE_HIERARCHY.md`** (canonical) and appended the full **"Source hierarchy
  for skill data (champion tags)"** section into CLAUDE.md. Key rules: Tier 1 (in-game
  Index / patch notes / Fandom / raid.guide), Tier 2 (hand-read community sites for facts +
  unbooked back-calc formula), Tier 3 (no editorial/YouTube). **Ascension default REVERSED:
  `ascension_required = 3` for all passives + gated auras unless an unascended screenshot
  proves no padlock.** `source_type` values already all allowed by the DB CHECK constraint.

### 3.2 raid.guide bulk skill scrape
- Modified `tools/scrape-champion-tags.js`: added **raw-text dump** (`skill-text-raidguide.json`),
  a **derived-slug fallback** (recovers champs not on `/stats/`), the **Rare+ scope filter**,
  and fixed a resume-merge bug (`.skills`→`.entries`).
- Ran `--all`. Result: **543 of 939 Rare+ champions (58%)** → `output/skill-text-raidguide.json`
  (1,795 skill entries, clean text) + `output/champion-tags-proposed.sql` (**1,585 proposed
  tags — NOT reviewed/applied**) + `output/auras.sql`. The 396 gap = mostly Legendary + all
  35 Mythical (raid.guide has zero Mythical pages).

### 3.3 Champion-role reconciliation (the big one) — Desktop deliverables
- Exported the master spreadsheet (`~/Downloads/RAID Master Database v4.0…xlsx`) tabs to
  `Desktop\RSL-coach\champions_tab.csv` (933 champs) and `skills_tab.csv` (26 champs only).
- Discovered the **spreadsheet uses full epithet names** ("Aleksandr the Sharpshooter") but
  the **DB uses short names** ("Aleksandr"). Built prefix+suffix reconciliation.
- Final: **`update_roles_reconciled.sql`** (1 INSERT for Gracchos Turn-drake + **914 role
  UPDATEs**, 0 conflicts, keyed to real DB names). Supersedes `update_roles.sql`/`verify_roles.sql`.
- Ambiguous picks (10) → user confirmed → **`seeds/42_ambiguous_roles_resolved.sql`** (9 UPDATEs;
  corrected `Acolyte of the Slither`→`Slither`; **`Alice`=Support flagged** vs spreadsheet's
  Attack; `Sentinel` deliberately excluded — see §5).
- New/fixed champion rows: **`seeds/40_gracchos_turn_drake.sql`** (was mis-suffix-matched to
  `Drake`), **`seeds/43_ronda_affinity_fix.sql`** (Spirit→Magic). `Jotun` = existing DB
  `Jotunn` (spelling variant, updated in-place, no new row). True gaps were all crossover/boss
  entities, not real champions.

### 3.4 Doom Tower — modeling STARTED then PARKED
- Scope reversed to in-scope (`STRATEGY.md` updated). Structure confirmed from in-game:
  **120 floors, boss every 10th (12 boss floors), Floor 120 = master rotation boss, 4 rotating
  bosses/cycle, Normal(~150-180)/Hard(~250-350), 12 secret rooms.** **Cursed City** and
  **Grim Forest** are SEPARATE modes/dungeons (each its own tab).
- Seeds: **`44_doom_tower_dungeon.sql`** (dungeon row), **`45_doom_tower_stages_phases.sql`**
  (24 boss-floor stages Normal/Hard + generic boss phases). Model is **floor-centric**;
  rotating boss handled at boss-phase level.
- **PARKED by user.** See memory `doom-tower-modeling.md`. Al-Naemeh (Sand Devil), Astranyx
  (Dark Fae), Bommal (Dreadhorn) = DT bosses; Leshun (Entangled One) = Grim Forest boss —
  **all bosses, NOT champions.** Current live DT boss = Frost Spider (no kit yet).

### 3.5 Local static-data cache — investigated, negative result (§6)

---

## 4. DB apply status
**APPLIED 2026-07-06 (via REST — direct pg is down):** the role reconciliation + seeds 42/43.
- `update_roles_reconciled.sql` (Gracchos INSERT + 914 role UPDATEs) — committed as
  **`seeds/46_champion_roles_from_master.sql`** for reconstructability.
- `seeds/42_ambiguous_roles_resolved.sql` (9 roles), `seeds/43_ronda_affinity_fix.sql` (Ronda→Magic).
- Verified live: 928 champions have roles, Alice=Attack, Ronda=Magic, Gracchos Turn-drake=HP,
  925 statements applied with 0 errors / 0 no-ops.

**STILL NOT applied (intentional):**
- `output/champion-tags-proposed.sql` — 1,585 proposed tags, **needs human review first** (no auto-merge).
- `repo/seeds/44_` + `45_` — Doom Tower dungeon + stages (parked; apply only if resuming DT).
- `seeds/40_gracchos_turn_drake.sql` — redundant (Gracchos already applied via the reconciled SQL).

---

## 5. Open decisions / follow-ups
1. **`Sentinel`** (from the ambiguous list): spreadsheet has bare "Sentinel" (Rare/HP) but DB
   has only `Sunken Sentinel` + `Sepulcher Sentinel` (both distinct, already handled). Bare
   Sentinel = a gap or the known Sentinel mis-seed. Needs user decision (seed new vs fix mis-seed).
2. **Doom Tower** (if unparked): needs boss kits (have only Al-Naemeh's full kit), the boss→floor
   rotation mapping, and per-floor N/H thresholds. Frost Spider kit = highest-value next input.
3. **396 raid.guide-gap champions** (incl. 35 Mythical): fill via in-game Index (hand) + Fandom.
4. **skills_tab.csv** master spreadsheet only covers 26 champions — mostly empty.

(Resolved 2026-07-06: `Alice` role = **Attack** — seed 42 corrected.)

---

## 6. Local static-data cache — the investigation & its conclusion (do not repeat)
Path: `%LOCALAPPDATA%Low\Plarium\Raid_ Shadow Legends\static-data\<ver>\<hash>` (a ~5.7MB
MessagePack blob; also mirrored in `<ver>.zip`).
- **Format cracked:** msgpack container; champion + skill NAMES decode 100% clean (507
  champions extractable). Skill DESCRIPTIONS are **LZ77 back-reference compressed** against a
  global window — decompressor **partially reverse-engineered but NOT finished** (literals
  <0x80, back-ref tokens `[off_lo][off_hi][len]`). `[P]` suffix in skill names = passive flag.
- **KILLER finding:** the blob is a **partial fixed download, NOT a per-view cache.** Viewing
  all Rare+ Banner Lords + restarting changed the blob's md5 but it got *smaller* and coverage
  didn't move (still 9 truly-absent, ~50 skill descriptions). File-mtime check after viewing:
  only telemetry + one event banner changed, no champion data written anywhere. **So "browse
  the index to populate the cache" is DISPROVEN.**
- The blob has a **structured skill table** (skillIds + numeric fields like cooldown/max-book-
  level) but **0 of 209 owned skills have their description text** in it.
- **Gestal** has skill IDs + book levels (`{skillId, level, maxLevel}`) — **no descriptions.**
  Its `skillId` == the game's SkillTypeId (useful champion→skill mapping for owned champs).
- **Conclusion:** local files are a partial dead end for skill *mechanics*. The reliable bulk
  source is **raid.guide (543, done) + Fandom + hand-reading** per SOURCE_HIERARCHY.md. The
  memory-reader `--skills` path was already a dead end (transient skill-info structs).

---

## 7. New/changed files this session
**Repo:** `CLAUDE.md` (data-sourcing + source-hierarchy), `SOURCE_HIERARCHY.md` (new),
`STRATEGY.md` (Doom Tower in-scope), `tools/scrape-champion-tags.js` (raw dump/slug-fallback/
Rare+ scope), `seeds/40,42,43,44,45`, `output/skill-text-raidguide.json`,
`output/champion-tags-proposed.sql`, `output/auras.sql`.
**Desktop (`RSL-coach\`):** `champions_tab.csv`, `skills_tab.csv`, `update_roles_reconciled.sql`,
`ambiguous_roles.txt`, `unresolved_roles_gaps.txt`, `cache_champions.csv`,
`cache_champions_with_rarity.csv`, `cache_skill_names.csv`, `cache_unmatched_names.txt`,
(superseded: `update_roles.sql`, `verify_roles.sql`, `suffix_resolved_confirm.txt`).
**Memory:** `champion-scope-rare-plus.md` (new), `doom-tower-modeling.md` (new),
`ascension-and-awakening.md` (updated — default now 3).

---

## 8. Suggested next actions
1. Have Mike apply `update_roles_reconciled.sql` + seeds 40/42/43 in Supabase (resolve
   `Sentinel` + confirm `Alice` first).
2. Human-review `output/champion-tags-proposed.sql` before any tags go live (no auto-merge).
3. Fill the 396 raid.guide-gap champions from in-game Index / Fandom (per SOURCE_HIERARCHY.md).
4. Resume Doom Tower only when the user provides boss kits + rotation mapping + thresholds.
