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

## 3. The `type_id` ceiling (audited 2026-07-18)

`type_id` is learned only from Gestal exports, which cover **only owned champions**:

| | count |
|---|---|
| champions | 946 |
| `type_id` set | 240 |
| `type_id` NULL | 706 |
| &nbsp;&nbsp;— fillable now from the 5 exports (owned) | **83** |
| &nbsp;&nbsp;— hard gap (unowned by all 5 accounts) | **623** (617 Rare+) |

**Conclusion:** Gestal alone maxes out near **323/946 (34%)**. The 623 unowned champions
need an **external `baseTypeId` source** — the game's own champion definitions (a *passive*
read of the local client data, permitted as factual game data; NOT memory injection), or a
Tier-2 community datamine read by hand. That is a real project, not a quick backfill.

Therefore `type_id` completion is the long-term ideal, **but it cannot be the near-term
cure.** The near-term cure is name hygiene + a schema guard, which work regardless of
`type_id`.

---

## 4. The fix — two pillars

### Pillar A — Name hygiene (near-term cure; do this first)
Stops the duplicate/garble class permanently, independent of `type_id`.

1. **One rule for `champions.name`:** the exact **full in-game name, verbatim** (e.g.
   `Ash'nar Dragonsoul`). Nothing else. Short display names, garbled spellings, and old
   forms all become **aliases**.
2. **Grid reconciliation** (the `Champions/<faction>/*.png` archive is the ground-truth
   master list): for each faction, the true set of in-game names. Reconcile `champions.name`
   against it → fix every garbled name to canonical, auto-generate aliases for the variants,
   and surface both **fakes** (in DB, not in game) and **missing** (in game, not in DB —
   Aria the Golden Hope, Xanthe Seaflower, Leminisi the Goldwing, …). NB the grids are a
   point-in-time snapshot, so "in DB not in grid" = fake **or** newly-added; disambiguate by
   source + payload, never blanket-delete (see the 2026-07-18 handoff).
3. **Schema guard so it can't regress:**
   - `create unique index on champions (game_id, <normalized_name>)` where normalized =
     `lower(regexp_replace(name,'[^a-z0-9]','','g'))` → makes `K'Leth`/`Losan KLeth` and
     `Ma'Shalled`/`MaShalled` **impossible to insert twice**.
   - unique index on normalized `alias` per game.
   - keep the existing `champions (game_id, type_id)` unique index.

### Pillar B — Complete `type_id` (long-term; makes matching fully name-proof)
1. **Re-run the Gestal backfill** (`tools/generate-type-id-backfill.mjs`) → +83 now
   (240 → ~323). Emit as a NEW seed (do not clobber the applied seed 127).
2. **Reconcile the 81 owned-but-unresolved names** — these are real, owned, and carry a
   `baseTypeId`. Fix their DB name / add the alias (Pillar A) so the bridge resolves them,
   which also fills their `type_id`.
3. **Source the 623 unowned `baseTypeId`s** from the game's own champion data (passive read)
   or a hand-read datamine. This is the only way to reach 100%, and it is a scoped project of
   its own — not a prerequisite for Pillar A.

---

## 5. One-sentence answer
**Make `type_id` the identity key and complete it over time; in the meantime demote `name`
to a single canonical in-game string with everything else as aliases, reconcile it against
the grid master list, and add a normalized-uniqueness constraint so masked duplicates can
never come back.**

## 6. Concrete next steps (in order)
1. **Grid reconciliation** (Pillar A.2) — read the ~89 grids → master list → fakes + missing
   + garbled-name fixes. Highest leverage; also feeds Pillar B.2.
2. **Normalized-uniqueness migration** (Pillar A.3) — after the reconciliation cleans
   existing collisions, add the constraint to lock it.
3. **Re-run type_id backfill** (Pillar B.1) as a new seed → +83.
4. Decide whether/when to pursue the game-data `baseTypeId` read for the 623 (Pillar B.3).
