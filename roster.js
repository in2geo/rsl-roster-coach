// ── roster.js — Champion selection UI (Screens 1–4) ──────────────────────────
// Plain ES module, no framework. Imported by app.js.
// Manages device identity, champion loading, roster saving, and content selection.

// ── Device identity ───────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('rsl_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('rsl_device_id', id);
  }
  return id;
}

const DEVICE_ID = getDeviceId();

// ── Constants ─────────────────────────────────────────────────────────────────
const RARITIES = ['Mythical', 'Legendary', 'Epic', 'Rare'];
const RARITY_COLOR = {
  Mythical:  '#E53935',
  Legendary: '#FFB700',
  Epic:      '#9C27B0',
  Rare:      '#2196F3',
};
const GEAR_TIERS   = ['Starter', 'Dungeon', 'Strong', 'God Tier'];
const MASTERY_TIERS = ['None', 'Basic', 'Complete'];
const CB_DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Brutal', 'Nightmare', 'UNM'];

// ── State ─────────────────────────────────────────────────────────────────────
let championsByRarity = {};   // { Legendary: [{id, name, portrait_url}], ... }
let roster = {};              // { champion_id: { level, stars, gear_tier, ... } }
let currentRarity = null;
let currentChampionForSheet = null;
let accountLevel = null;
let championsLoaded = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function qs(sel, root = document) { return root.querySelector(sel); }

function rarityCount(rarity) {
  if (!championsByRarity[rarity]) return 0;
  return championsByRarity[rarity].filter(c => roster[c.id]).length;
}

function totalRosterCount() {
  return Object.keys(roster).length;
}

// ── Screen visibility ─────────────────────────────────────────────────────────
const ROSTER_SCREENS = ['screen-rarity', 'screen-grid', 'screen-content'];
const LEGACY_SCREENS = ['screen-upload','screen-confirm','screen-loading','screen-results','screen-ad','screen-error'];

export function showRosterScreen(name) {
  [...ROSTER_SCREENS, ...LEGACY_SCREENS].forEach(id =>
    document.getElementById(id)?.classList.add('hidden')
  );
  document.getElementById(name)?.classList.remove('hidden');
}

// ── Champion data loading ──────────────────────────────────────────────────────
async function loadChampions() {
  if (championsLoaded) return;
  const res = await fetch('/api/champions');
  if (!res.ok) throw new Error('Could not load champion list');
  const body = await res.json();
  championsByRarity = body.byRarity ?? {};
  championsLoaded = true;
}

// ── Saved roster check ────────────────────────────────────────────────────────
async function loadSavedRoster() {
  const res = await fetch(`/api/user-champions?user_id=${DEVICE_ID}`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.champions ?? [];
}

// ── Entry point (called from app.js on load) ──────────────────────────────────
export async function initRosterFlow() {
  try {
    const [saved] = await Promise.all([
      loadSavedRoster(),
      loadChampions(),
    ]);

    if (saved.length > 0) {
      // Returning player — rebuild in-memory roster and go to content screen
      for (const uc of saved) {
        if (uc.champion?.id) {
          roster[uc.champion.id] = {
            db_id:          uc.id,
            level:          uc.level,
            stars:          uc.stars,
            gear_tier:      uc.gear_tier ?? 'Starter',
            ascension_level: uc.ascension_level ?? 0,
            mastery_tier:   uc.mastery_tier ?? 'None',
            is_booked:      uc.is_booked ?? false,
          };
        }
      }
      renderContentScreen();
      showRosterScreen('screen-content');
    } else {
      renderRarityScreen();
      showRosterScreen('screen-rarity');
    }
  } catch {
    // On error, default to rarity screen so the player can still use the app
    renderRarityScreen();
    showRosterScreen('screen-rarity');
  }
}

// ── Screen 1: Rarity Selection ────────────────────────────────────────────────
function renderRarityScreen() {
  const screen = document.getElementById('screen-rarity');
  if (!screen) return;

  // Account level input
  const lvlInput = qs('#roster-account-level', screen);
  if (lvlInput) {
    lvlInput.value = accountLevel ?? '';
    lvlInput.addEventListener('change', e => {
      accountLevel = parseInt(e.target.value, 10) || null;
    });
  }

  // Rarity buttons
  RARITIES.forEach(rarity => {
    const btn = qs(`[data-rarity="${rarity}"]`, screen);
    if (!btn) return;
    updateRarityButton(btn, rarity);
    btn.addEventListener('click', () => openGridScreen(rarity));
  });

  updateDoneButton(screen);

  const done = qs('#btn-roster-done', screen);
  if (done) {
    done.onclick = () => {
      renderContentScreen();
      showRosterScreen('screen-content');
    };
  }
}

function updateRarityButton(btn, rarity) {
  const countEl = btn.querySelector('.rarity-count');
  if (countEl) countEl.textContent = rarityCount(rarity);
}

function updateDoneButton(screen) {
  const done = qs('#btn-roster-done', screen);
  if (done) done.disabled = totalRosterCount() < 3;
}

function refreshRarityScreen() {
  const screen = document.getElementById('screen-rarity');
  if (!screen) return;
  RARITIES.forEach(rarity => {
    const btn = qs(`[data-rarity="${rarity}"]`, screen);
    if (btn) updateRarityButton(btn, rarity);
  });
  updateDoneButton(screen);
}

// ── Screen 2: Portrait Grid ────────────────────────────────────────────────────
async function openGridScreen(rarity) {
  currentRarity = rarity;
  // Retry champion load if it failed or was skipped during init
  if (!championsLoaded) {
    try { await loadChampions(); } catch { /* grid shows empty state gracefully */ }
  }
  renderGridScreen(rarity);
  showRosterScreen('screen-grid');
}

function renderGridScreen(rarity) {
  const screen = document.getElementById('screen-grid');
  if (!screen) return;

  const title = qs('#grid-title', screen);
  if (title) {
    title.textContent = rarity;
    title.style.color = RARITY_COLOR[rarity];
  }

  const searchInput = qs('#grid-search', screen);
  const suggest     = qs('#grid-suggestions', screen);
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      renderSuggestions(rarity, q, suggest, searchInput);
      renderGrid(rarity, q);
    };
    // Clear suggestions when input is blurred (slight delay so tap on suggestion registers)
    searchInput.onblur = () => setTimeout(() => suggest && (suggest.innerHTML = ''), 150);
  }

  renderGrid(rarity, '');

  const doneBtn = qs('#btn-grid-done', screen);
  if (doneBtn) {
    doneBtn.onclick = () => {
      refreshRarityScreen();
      showRosterScreen('screen-rarity');
    };
  }
}

function renderSuggestions(rarity, query, container, input) {
  if (!container) return;
  if (!query) { container.innerHTML = ''; return; }

  const matches = (championsByRarity[rarity] ?? [])
    .filter(c => c.name.toLowerCase().includes(query))
    .slice(0, 8);

  if (!matches.length) { container.innerHTML = ''; return; }

  container.innerHTML = '';
  for (const champ of matches) {
    const item = document.createElement('button');
    item.className = 'suggestion-item';
    // Bold the matching portion
    const idx  = champ.name.toLowerCase().indexOf(query);
    const pre  = champ.name.slice(0, idx);
    const hit  = champ.name.slice(idx, idx + query.length);
    const post = champ.name.slice(idx + query.length);
    item.innerHTML = `${pre}<strong>${hit}</strong>${post}`;
    item.addEventListener('mousedown', e => {
      e.preventDefault(); // prevent blur firing before click
      input.value = champ.name;
      container.innerHTML = '';
      renderGrid(rarity, ''); // show full grid
      openDetailSheet(champ, rarity);
    });
    container.appendChild(item);
  }
}

function renderGrid(rarity, query) {
  const grid = document.getElementById('portrait-grid');
  if (!grid) return;

  const champions = (championsByRarity[rarity] ?? [])
    .filter(c => !query || c.name.toLowerCase().includes(query));

  if (!champions.length) {
    grid.innerHTML = '<p class="grid-empty">No champions found.</p>';
    return;
  }

  grid.innerHTML = '';
  for (const champ of champions) {
    const card = buildPortraitCard(champ, rarity);
    grid.appendChild(card);
  }
}

function buildPortraitCard(champ, rarity) {
  const selected = !!roster[champ.id];
  const card = document.createElement('button');
  card.className = 'portrait-card' + (selected ? ' selected' : '');
  card.setAttribute('data-champion-id', champ.id);
  card.style.setProperty('--rarity-color', RARITY_COLOR[rarity] ?? '#888');

  const img = document.createElement('div');
  img.className = 'portrait-img';
  if (champ.portrait_url) {
    img.style.backgroundImage = `url('${champ.portrait_url}')`;
  } else {
    img.classList.add('portrait-placeholder');
    img.textContent = champ.name.charAt(0).toUpperCase();
  }

  const check = document.createElement('div');
  check.className = 'portrait-check';
  check.textContent = '✓';

  const name = document.createElement('span');
  name.className = 'portrait-name';
  name.textContent = champ.name;

  card.appendChild(img);
  card.appendChild(check);
  card.appendChild(name);

  card.addEventListener('click', () => openDetailSheet(champ, rarity));
  return card;
}

function updateCardSelected(championId, selected) {
  const card = qs(`[data-champion-id="${championId}"]`);
  if (!card) return;
  card.classList.toggle('selected', selected);
}

// ── Screen 3: Champion Detail Sheet ───────────────────────────────────────────
function openDetailSheet(champ, rarity) {
  currentChampionForSheet = champ;
  const sheet    = document.getElementById('detail-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (!sheet || !backdrop) return;

  const existing = roster[champ.id] ?? null;

  // Portrait + name
  const sheetImg = qs('#sheet-portrait', sheet);
  if (sheetImg) {
    if (champ.portrait_url) {
      sheetImg.style.backgroundImage = `url('${champ.portrait_url}')`;
      sheetImg.classList.remove('portrait-placeholder');
      sheetImg.textContent = '';
    } else {
      sheetImg.style.backgroundImage = '';
      sheetImg.classList.add('portrait-placeholder');
      sheetImg.textContent = champ.name.charAt(0).toUpperCase();
    }
  }
  const sheetName = qs('#sheet-champion-name', sheet);
  if (sheetName) {
    sheetName.textContent = champ.name;
    sheetName.style.color = RARITY_COLOR[rarity] ?? 'var(--text)';
  }

  // Level
  const lvlInput = qs('#sheet-level', sheet);
  if (lvlInput) lvlInput.value = existing?.level ?? 1;

  // Stars
  const starsVal = existing?.stars ?? 3;
  renderStars(sheet, starsVal);

  // Gear tier
  const gearVal = existing?.gear_tier ?? 'Starter';
  renderGearTier(sheet, gearVal);

  // Advanced fields (collapsed by default)
  const advToggle = qs('#sheet-advanced-toggle', sheet);
  const advPanel  = qs('#sheet-advanced-panel', sheet);
  if (advToggle && advPanel) {
    advPanel.classList.add('hidden');
    advToggle.textContent = 'Advanced ▸';
    advToggle.onclick = () => {
      const open = !advPanel.classList.contains('hidden');
      advPanel.classList.toggle('hidden', open);
      advToggle.textContent = open ? 'Advanced ▸' : 'Advanced ▾';
    };
  }

  // Ascension level (0–6, defaults to stars − 1)
  const ascInput = qs('#sheet-ascension', sheet);
  if (ascInput) ascInput.value = existing?.ascension_level ?? Math.max(0, starsVal - 1);

  // Mastery tier
  const masteryVal = existing?.mastery_tier ?? 'None';
  renderMastery(sheet, masteryVal);

  // Booked toggle
  const bookedChk = qs('#sheet-booked', sheet);
  if (bookedChk) bookedChk.checked = existing?.is_booked ?? false;

  // Lore of Steel (only show if mastery = Complete)
  updateLoreVisibility(sheet);
  const masteryBtns = sheet.querySelectorAll('[data-mastery]');
  masteryBtns.forEach(btn => {
    btn.addEventListener('click', () => updateLoreVisibility(sheet));
  });

  // Buttons
  const addBtn = qs('#sheet-add-btn', sheet);
  if (addBtn) {
    addBtn.textContent = existing ? 'Save changes' : 'Add to roster';
    addBtn.onclick = () => saveChampion(champ, rarity, sheet);
  }

  // Remove button (only shown if already in roster)
  const removeBtn = qs('#sheet-remove-btn', sheet);
  if (removeBtn) {
    removeBtn.classList.toggle('hidden', !existing);
    removeBtn.onclick = () => removeChampion(champ);
  }

  const cancelBtn = qs('#sheet-cancel-btn', sheet);
  if (cancelBtn) cancelBtn.onclick = closeDetailSheet;

  backdrop.classList.remove('hidden');
  sheet.classList.add('open');
  backdrop.onclick = closeDetailSheet;
}

function closeDetailSheet() {
  const sheet    = document.getElementById('detail-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (sheet)    sheet.classList.remove('open');
  if (backdrop) backdrop.classList.add('hidden');
  currentChampionForSheet = null;
}

function renderStars(root, value) {
  const container = qs('#sheet-stars', root);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= 6; i++) {
    const star = document.createElement('button');
    star.className = 'star-btn' + (i <= value ? ' active' : '');
    star.textContent = '★';
    star.setAttribute('data-star', i);
    star.addEventListener('click', () => renderStars(root, i));
    container.appendChild(star);
  }
}

function getStars(root) {
  const active = root.querySelectorAll('.star-btn.active');
  return active.length || 1;
}

function renderGearTier(root, value) {
  const container = qs('#sheet-gear-tier', root);
  if (!container) return;
  GEAR_TIERS.forEach(tier => {
    const btn = qs(`[data-gear="${tier}"]`, container);
    if (btn) btn.classList.toggle('active', tier === value);
  });
  // Wire clicks (idempotent — onclick replaces previous)
  GEAR_TIERS.forEach(tier => {
    const btn = qs(`[data-gear="${tier}"]`, container);
    if (btn) btn.onclick = () => renderGearTier(root, tier);
  });
}

function getGearTier(root) {
  const btn = qs('#sheet-gear-tier .active', root);
  return btn?.dataset.gear ?? 'Starter';
}

function renderMastery(root, value) {
  const container = qs('#sheet-mastery', root);
  if (!container) return;
  MASTERY_TIERS.forEach(tier => {
    const btn = qs(`[data-mastery="${tier}"]`, container);
    if (btn) btn.classList.toggle('active', tier === value);
  });
  MASTERY_TIERS.forEach(tier => {
    const btn = qs(`[data-mastery="${tier}"]`, container);
    if (btn) btn.onclick = () => { renderMastery(root, tier); updateLoreVisibility(root); };
  });
}

function getMastery(root) {
  const btn = qs('#sheet-mastery .active', root);
  return btn?.dataset.mastery ?? 'None';
}

function updateLoreVisibility(root) {
  const loreRow = qs('#sheet-lore-row', root);
  if (!loreRow) return;
  const mastery = getMastery(root);
  loreRow.classList.toggle('hidden', mastery !== 'Complete');
}

async function saveChampion(champ, rarity, sheet) {
  const addBtn = qs('#sheet-add-btn', sheet);
  if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Saving…'; }

  const level          = parseInt(qs('#sheet-level', sheet)?.value, 10) || 1;
  const stars          = getStars(sheet);
  const gear_tier      = getGearTier(sheet);
  const ascension_level = parseInt(qs('#sheet-ascension', sheet)?.value, 10) || 0;
  const mastery_tier   = getMastery(sheet);
  const is_booked      = qs('#sheet-booked', sheet)?.checked ?? false;

  try {
    const res = await fetch('/api/user-champions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: DEVICE_ID,
        champion_id: champ.id,
        level, stars, ascension_level, gear_tier, mastery_tier, is_booked,
      }),
    });
    if (!res.ok) throw new Error('Save failed');

    roster[champ.id] = { level, stars, gear_tier, ascension_level, mastery_tier, is_booked };
    updateCardSelected(champ.id, true);
    closeDetailSheet();
    refreshRarityScreen();
    showRosterScreen('screen-rarity');
  } catch {
    if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Try again'; }
  }
}

async function removeChampion(champ) {
  try {
    await fetch('/api/user-champions', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: DEVICE_ID, champion_id: champ.id }),
    });
    delete roster[champ.id];
    updateCardSelected(champ.id, false);
    closeDetailSheet();
    refreshRarityScreen();
  } catch { /* non-fatal — UI stays open */ }
}

// ── Screen 4: Content Selection ────────────────────────────────────────────────
function renderContentScreen() {
  const screen = document.getElementById('screen-content');
  if (!screen) return;

  // Roster summary
  const summary = qs('#roster-summary', screen);
  if (summary) {
    const parts = RARITIES
      .map(r => {
        const count = Object.keys(roster).filter(id =>
          (championsByRarity[r] ?? []).some(c => c.id === id)
        ).length;
        return count > 0 ? `${count} ${r}` : null;
      })
      .filter(Boolean);
    summary.textContent = parts.join(' · ') || `${totalRosterCount()} champions`;
  }

  // Edit roster link
  const editLink = qs('#btn-edit-roster', screen);
  if (editLink) {
    editLink.onclick = () => {
      renderRarityScreen();
      showRosterScreen('screen-rarity');
    };
  }

  // Spider stage toggle
  const spider9  = qs('#spider-stage-9', screen);
  const spider10 = qs('#spider-stage-10', screen);
  [spider9, spider10].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      spider9?.classList.remove('active');
      spider10?.classList.remove('active');
      btn.classList.add('active');
    });
  });
  if (spider9) spider9.classList.add('active'); // default to stage 9

  // Clan Boss difficulty
  const cbBtns = screen.querySelectorAll('[data-difficulty]');
  cbBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cbBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  // Default to Normal
  const defaultDiff = qs('[data-difficulty="Normal"]', screen);
  if (defaultDiff) defaultDiff.classList.add('active');

  // Content toggle (Spider vs Clan Boss)
  const spiderSection = qs('#content-spider', screen);
  const cbSection     = qs('#content-clan-boss', screen);
  const spiderTab = qs('[data-content="spider"]', screen);
  const cbTab     = qs('[data-content="clan_boss"]', screen);

  function setContent(key) {
    spiderSection?.classList.toggle('hidden', key !== 'spider');
    cbSection?.classList.toggle('hidden', key !== 'clan_boss');
    spiderTab?.classList.toggle('active', key === 'spider');
    cbTab?.classList.toggle('active', key === 'clan_boss');
  }
  setContent('spider');
  if (spiderTab) spiderTab.onclick = () => setContent('spider');
  if (cbTab)     cbTab.onclick     = () => setContent('clan_boss');

  // Get recommendation button
  const recBtn = qs('#btn-get-recommendation', screen);
  if (recBtn) {
    recBtn.onclick = () => requestRecommendation(screen);
  }
}

async function requestRecommendation(screen) {
  // Determine content key + options
  const spiderActive = !qs('#content-spider', screen)?.classList.contains('hidden');
  let contentKey, options = {};

  if (spiderActive) {
    const stageBtn = qs('#content-spider .stage-btn.active', screen);
    const stage = stageBtn?.dataset.stage ?? '9';
    contentKey = stage === '10' ? 'spider' : 'spider_beginner';
  } else {
    const diffBtn = qs('[data-difficulty].active', screen);
    contentKey = 'clan_boss';
    options.boss_affinity = null; // player hasn't specified today's affinity
  }

  // Dispatch to existing match flow in app.js via a custom event
  document.dispatchEvent(new CustomEvent('rsl:request-recommendation', {
    detail: { contentKey, options, deviceId: DEVICE_ID },
  }));
}
