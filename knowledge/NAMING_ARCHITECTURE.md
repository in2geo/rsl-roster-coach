# Champion Naming & Identity — architecture, root cause, and the fix

**Status:** design doc (2026-07-18). Written after a session that removed 75 junk/dup/fake
rows and repeatedly hit the naming problem. This is the durable plan to fix it "once and
for all." Supersedes ad-hoc alias work; see also the champion-identity memories.

---

## 1. How it actually works today (the map)

There are **two identity systems**. One is correct-by-design but incomplete; the other is
a fragile fallback that ends up doing most of the work.

### Columns / tables that hold a name
| Where | What it is |
|---|---|
| `champions.name` | The **one** canonical name column. Meant to be the champion's name; today it is inconsistent (short `Ash'nar`, garbled `Ashnar Dragonsoul`, or full) depending on which import wrote it. |
| `champion_aliases.alias` → `champion_id` | Every **alternate** string. 498 rows: `long_name` 269, `shortform` 127, `truncation` 91, `spelling`/`misspelling` 11. |
| `champions.type_id` | The game's stable `baseTypeId` — a NUMBER, name-independent. The *intended* identity key. |

There is **no** `long_name` column on `champions` and **no** `champion_names` localization
table (it does not exist in live — a 404). Everything is `name` + `aliases` + `type_id`.

### Which key the code queries
- **Roster / Gestal / battle matching:** `type_id` **first**, `name` **as fallback** —
  literally `dbByTypeId.get(...) ?? dbByName.get(norm(g.name))`
  (`lib/gestal-context.js:169`, `lib/battle-pipeline.js:50`).
- **Frontend champion picker:** the champion `id` (UUID) — not the name.
- **Text inputs** (patch notes, NL): the resolver in `lib/champion-names.js`
  (case-insensitive; a canonical `name` wins over an alias with the same key; one alias →
  one champion, ambiguous excluded at seed time).

So **name is not supposed to be the identity key.** `type_id` is.

---

## 2. Root cause — why it keeps breaking

`type_id` is populated on **only 240 of 946 champions (25%)**. For the other **75%** the
code falls through to **name matching** — and `name` has (a) no defined rule for what it
should contain and (b) values imported from 4+ inconsistent sources (a 2026-06-24 ChatGPT
bulk load, Gestal, the worksheet, and a "Google AI Overview"). Every naming bug we have hit
is a symptom of this one fact:

- **Apostrophe-masked duplicates** — `K'Leth` vs `Losan KLeth`, `Krok'mar` vs
  `KrokMar the Devourer`, `Ma'Shalled` vs `MaShalled`. A name got inserted twice under two
  spellings because nothing forbids it.
- **Garbled survivors** — `Packmaster Shyek`, `KrokMar the Devourer` (apostrophe stripped).
- **Fabricated rows** — `Nson`, `Fimo`, `Jorad Wolfhart` from an AI Overview, invisible
  because the roster was never reconciled to ground truth.
- **Owned champions that don't resolve** — 81 champions in the Gestal exports bridge to NO
  DB champion by name or alias (e.g. `Leminisi the Goldwing`, `Spiritwalker`, `Hungerer`),
  so a real owned champion silently fails to match.

---

## 3. `type_id` is a SEPARATE, narrow concern — not the naming fix

`type_id` (the game's `baseTypeId`) is needed **only** to match EXTERNAL game data — Gestal
exports and the battle-reader — back to our rows (the roster-*import* feature). It is NOT
needed for naming, dedup, or the recommendation engine (which selects champions by their
`id` UUID). The internal identity key already exists and is complete: the row **UUID** (and,
in the worksheet, the frozen `C`-scheme **Stable Champion ID**). **So the naming fix does not
depend on `type_id` or on Gestal at all.** An earlier draft of this doc conflated the two;
this section supersedes it.

For completeness, the `type_id` audit (2026-07-18): 240/946 set; of 706 NULL, only **83** are
fillable from the 5 Gestal exports (owned), **623** are unowned and would need a passive read
of the game's own champion data. Pursue that **only** if/when the Gestal-import feature needs
wider coverage — it is decoupled from everything below.

---

## 4. The fix — reconcile three sources we ALREADY have (no Gestal)

The master list is not Gestal. It is the **worksheet authoring tab** (completeness) arbitrated
by the **grid archive** (correctness). Both are already on disk.

| Source | What it provides | Caveat |
|---|---|---|
| **Worksheet `Champions` tab** (967 rows, `Stable Champion ID`, `Form` base/alt ×33) | the COMPLETE expected roster + a stable internal id + two-form structure | ChatGPT-generated; names are the SAME garbled forms the DB inherited (`Ashnar Dragonsoul`, `Packmaster Shyek`, `Losan KLeth`) — **not** a name-truth source |
| **Grid archive** `Champions/<faction>/*.png` (Tier-1 game) | canonical NAME spelling (apostrophes) + existence ground truth | point-in-time snapshot (a few champions post-date it) |
| **Live DB** (946 rows) | current state to correct | carries the garbled names + any fakes |

**Note:** the fakes (`Nson`, `Fimo`, `Jorad Wolfhart`) did NOT come from the authoring tab —
they entered via a DB import (a "Google AI Overview") and appear only in the worksheet's
`DB_Champions` mirror. Several are garbles of real champions (`Jorad Wolfhart` = the real
`Fjorad Wolfheart`, in the DB as `Fjorad`, Dwarves Mythical).

### Step 1 — One rule for `champions.name`
`champions.name` = the exact **full in-game name, verbatim** (e.g. `Ash'nar Dragonsoul`).
Short display names, garbled spellings, and old forms all become **aliases**.

### Step 2 — Three-way reconciliation
Join worksheet ∪ grids ∪ DB on normalized name (+ faction). Produce:
- **name fixes** — DB/worksheet garble → the grid's canonical spelling (`Ashnar Dragonsoul`
  → `Ash'nar Dragonsoul`, `Fjorad` → `Fjorad Wolfheart`), old spelling kept as alias.
- **fakes** — in DB, not in worksheet-authoring AND not in any grid → delete (disambiguate
  "not in grid but real/new" by source + payload; never blanket-delete).
- **missing** — in worksheet/grid, not in DB → add (Aria the Golden Hope, Xanthe Seaflower,
  Leminisi the Goldwing, …).

### Step 3 — Schema guard so it can't regress
- `create unique index on champions (game_id, <normalized_name>)` where normalized =
  `lower(regexp_replace(name,'[^a-z0-9]','','g'))` → makes `K'Leth`/`Losan KLeth` and
  `Ma'Shalled`/`MaShalled` **impossible to insert twice**.
- unique index on normalized `alias` per game.
- keep the existing `champions (game_id, type_id)` unique index.

---

## 5. One-sentence answer
**Define `champions.name` as the single canonical in-game name (everything else an alias),
reconcile it from the two sources we already have — the worksheet authoring tab for the
complete roster, the grid archive for correct spelling and existence — and add a
normalized-uniqueness constraint so masked duplicates can never come back; `type_id`/Gestal
is a separate, optional concern for the import feature only.**

## 6. Concrete next steps (in order)
1. **Build the reconciliation table** (Step 2) — worksheet authoring tab ∪ grids ∪ DB on
   normalized name+faction → three output lists: name-fixes, fakes, missing. Highest leverage.
2. **Apply name-fixes** as a seed — rename to canonical, garbled spelling → alias.
3. **Resolve fakes/missing** with review (fakes disambiguated by source+payload).
4. **Normalized-uniqueness migration** (Step 3) — after collisions are cleaned, add the
   constraint to lock it so this can never regress.
5. *(Optional, decoupled)* re-run the Gestal `type_id` backfill as a new seed (+83) only if the
   import feature needs it — not part of the naming fix.
