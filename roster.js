// ── roster.js — Champion selection UI (Screens 1–4) ──────────────────────────
// Plain ES module, no framework. Imported by app.js.
// Manages device identity, champion loading, roster saving, and content selection.
//
// NOTE: auth.js (which loads supabase-js from a CDN) is imported LAZILY inside
// fetchAutoRoster — never statically — so a CDN/auth failure can't break the whole
// app's module load. The app must still render (local read / manual entry) if the
// auth layer is unavailable.

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
// Per-champion boss-mastery answer maps to mastery_tier: 'Complete' = has Warmaster/Giant
// Slayer, 'None' = doesn't. (resolveBossMastery bridges 'Complete' + level 60 → has_boss_mastery.)
const MASTERY_TIERS = ['None', 'Complete'];
const CB_DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Brutal', 'Nightmare', 'UNM'];

// ── State ─────────────────────────────────────────────────────────────────────
let championsByRarity = {};   // { Legendary: [{id, name, portrait_url}], ... }
let roster = {};              // { champion_id: { level, stars, gear_tier, ... } }
let currentRarity = null;
let currentChampionForSheet = null;
let accountLevel = null;
let championsLoaded = false;

// Auto-populated roster from the Gestal export (null = not available; fall back to
// manual selection). When present, recommendations use these instead of Supabase.
let gestalUserChampions = null;  // match-engine-ready userChampions[]
let gestalContext = null;        // { account, roster, battleHistory } for the prompt

// champion id → { name, rarity, portrait_url } for rendering verification cards.
const championDetails = new Map();
// Where the detail sheet returns after save/remove: 'verify' (edit) or 'rarity' (setup).
let sheetReturnTo = 'rarity';
const RARITY_WEIGHT = { Mythical: 6, Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };
// Content options shown but not yet recommendable (no stage data seeded).
// Fire Knight seeded + approved stages 1-25; Ice Golem seeded stages 10-20. Both recommendable.
const CONTENT_UNAVAILABLE = new Set();

// Populates championDetails from the loaded champion list (covers the manual path;
// the auto-load paths also add entries directly from their richer data).
function captureChampionDetails() {
  for (const rarity of Object.keys(championsByRarity)) {
    for (const c of championsByRarity[rarity]) {
      if (!championDetails.has(c.id)) {
        championDetails.set(c.id, { name: c.name, rarity, portrait_url: c.portrait_url ?? null });
      }
    }
  }
}

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
const ROSTER_SCREENS = ['screen-rarity', 'screen-grid', 'screen-verify'];
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

// ── Gestal auto-population ─────────────────────────────────────────────────────
// Tries to load the player's real roster + battle history from the local Gestal
// export. Returns true if a roster was auto-populated.
// Fetches the auto-populated roster, preferring the signed-in user's Supabase-synced
// roster (/api/my-roster — works for any deployed PC user) and falling back to the
// local Gestal-file read (/api/gestal-context — the dev box, where the server sits on
// the same machine as Gestal). Both return the same { userChampions, context } shape.
// ── Sign-in control (magic-link auth) ──────────────────────────────────────────
// Renders "Sign in" for anonymous users and "Signed in as <email> · Sign out" for
// authenticated ones. Signing in is what unlocks profiles + Gestal sync; anonymous
// users keep working with their single device roster.
async function renderAuthControl() {
  const el = document.getElementById('auth-control');
  if (!el) return;
  let session = null;
  try {
    const { getSession } = await import('./auth.js');
    session = await getSession();
  } catch { el.textContent = ''; return; }

  el.textContent = '';
  if (session?.user) {
    const span = document.createElement('span');
    span.className = 'auth-status';
    span.textContent = `Signed in as ${session.user.email ?? 'you'}`;
    const out = document.createElement('button');
    out.className = 'btn-text';
    out.textContent = 'Sign out';
    out.onclick = async () => {
      try { const { signOut } = await import('./auth.js'); await signOut(); } catch {}
      // Return to the fresh, new-visitor home: clear the roster + drop to the
      // champion-selection start, so signing out doesn't leave the account's
      // champions on screen.
      activeProfileId = null;
      gestalUserChampions = null;
      gestalContext = null;
      roster = {};
      document.getElementById('profile-switcher-wrap')?.classList.add('hidden');
      renderAuthControl();
      renderRarityScreen();
      showRosterScreen('screen-rarity');
    };
    el.append(span, document.createTextNode(' · '), out);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn-text';
    btn.textContent = 'Sign in to sync & use profiles';
    btn.onclick = signInFlow;
    el.appendChild(btn);
  }
}

async function signInFlow() {
  const email = (window.prompt('Enter your email — we’ll send a one-tap sign-in link:') || '').trim();
  if (!email) return;
  try {
    const { sendMagicLink } = await import('./auth.js');
    await sendMagicLink(email);
    window.alert('Check your email for a sign-in link, and open it on this device to finish.');
  } catch (e) {
    window.alert('Could not send the sign-in link: ' + (e?.message || 'unknown error'));
  }
}

// ── Profile switcher ───────────────────────────────────────────────────────────
// Signed-in users can have multiple named rosters (profiles), populated manually
// or by Gestal import. The switcher lists them and flips the active one. It stays
// HIDDEN for anonymous/local users (no profiles), so the device-roster flow is
// untouched.
let activeProfileId = null;
let profilesWired   = false;

async function loadProfileSwitcher() {
  const wrap = document.getElementById('profile-switcher-wrap');
  const sel  = document.getElementById('profile-switcher');
  if (!wrap || !sel) return;

  let profiles = [];
  let signedIn = false;
  try {
    const { getSession } = await import('./auth.js');
    const session = await getSession();
    if (session?.access_token) {
      signedIn = true;
      const res = await fetch('/api/profiles', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) profiles = (await res.json()).profiles ?? [];
    }
  } catch { /* treat as anonymous */ }

  // Anonymous users have no profiles — hide the switcher entirely.
  if (!signedIn) { wrap.classList.add('hidden'); return; }

  // Signed in: always show the switcher so "+ Add" is reachable, even with 0 profiles.
  if (profiles.length && !activeProfileId) {
    activeProfileId = (profiles.find(p => p.is_default) ?? profiles[0]).id;
  }
  sel.innerHTML = '';
  if (!profiles.length) {
    const opt = document.createElement('option');
    opt.textContent = 'No profiles yet — add one →';
    opt.disabled = true; opt.selected = true;
    sel.appendChild(opt);
  } else {
    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.population_method === 'gestal' ? ' (synced)' : '');
      if (p.id === activeProfileId) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  wrap.classList.remove('hidden');

  if (!profilesWired) {
    profilesWired = true;
    sel.addEventListener('change', async () => {
      if (!sel.value) return;
      activeProfileId = sel.value;
      await loadGestalContext();
      renderVerifyScreen();
    });
    document.getElementById('btn-add-profile')?.addEventListener('click', addManualProfile);
  }
}

async function addManualProfile() {
  const name = (window.prompt('Name this profile (e.g. "Main Account", "F2P Alt"):') || '').trim();
  if (!name) return;
  try {
    const { getSession } = await import('./auth.js');
    const session = await getSession();
    if (!session?.access_token) { window.alert('Sign in to create profiles.'); return; }
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name, method: 'manual' }),
    });
    if (!res.ok) { window.alert('Could not create profile.'); return; }
    activeProfileId = (await res.json()).profile?.id ?? activeProfileId;
    await loadProfileSwitcher();   // refresh list with the new profile selected
    renderVerifyScreen();          // empty manual profile → 0 champions; use Edit Roster to add
  } catch { window.alert('Could not create profile.'); }
}

async function fetchAutoRoster() {
  // 1. Signed in → the roster from THIS user's account (profiles/rsl_accounts).
  // Lazy-import auth so a CDN/auth load failure can't blank the app.
  let signedIn = false;
  try {
    const { getSession } = await import('./auth.js');
    const session = await getSession();
    if (session?.access_token) {
      signedIn = true;
      const url = activeProfileId
        ? `/api/my-roster?profile=${encodeURIComponent(activeProfileId)}`
        : '/api/my-roster';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.userChampions) && body.userChampions.length) {
          if (body.stale?.isStale)
            console.warn(`[roster] imported roster is ${body.stale.minutes} min stale — Refresh Gestal + re-import for current gear.`);
          return body;
        }
      }
    }
  } catch { /* auth/config unavailable → treat as not signed in */ }

  // 2. Local Gestal-file read — ANONYMOUS/dev only. A signed-in user must NOT get
  // the dev box's local export (that's a stale/other account, e.g. DonCobb07);
  // their roster comes solely from their own account above. Signed-in + no roster
  // → return null so the app lands on the home/profile-create flow instead.
  if (!signedIn) {
    try {
      const res = await fetch('/api/gestal-context');
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.userChampions) && body.userChampions.length) return body;
      }
    } catch { /* none available */ }
  }

  return null;
}

async function loadGestalContext() {
  try {
    const body = await fetchAutoRoster();
    if (!body) return false;

    gestalUserChampions = body.userChampions;
    gestalContext       = body.context ?? null;

    // Mirror into the in-memory `roster` (keyed by DB champion id) so the existing
    // content-screen summary and counts work without the manual UI.
    roster = {};
    for (const uc of gestalUserChampions) {
      if (uc.champion?.id != null) {
        roster[uc.champion.id] = {
          level:           uc.level,
          stars:           uc.stars,
          gear_tier:       uc.gear_tier ?? 'Starter',
          ascension_level: uc.ascension_level ?? 0,
          mastery_tier:    uc.mastery_tier ?? 'None',
          is_booked:       uc.is_booked ?? false,
        };
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ── Entry point (called from app.js on load) ──────────────────────────────────
export async function initRosterFlow() {
  // Sign-in control is in the persistent header — render it once on load so it
  // shows on every screen (home/rarity included), not just the verify screen.
  renderAuthControl();
  try {
    // Prefer the real account: auto-populate from the Gestal export if available.
    const [autoLoaded] = await Promise.all([
      loadGestalContext(),
      loadChampions(),
    ]);

    if (autoLoaded) {
      // Capture identity (name/rarity/portrait) for cards from the auto-loaded data.
      captureChampionDetails();
      for (const uc of gestalUserChampions) {
        if (uc.champion) championDetails.set(uc.champion.id, {
          name: uc.champion.name, rarity: uc.champion.rarity, portrait_url: uc.champion.portrait_url ?? null,
        });
      }
      renderVerifyScreen();
      showRosterScreen('screen-verify');
      return;
    }

    const saved = await loadSavedRoster();

    if (saved.length > 0) {
      // Returning player — rebuild in-memory roster and land on the verification screen
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
          championDetails.set(uc.champion.id, {
            name: uc.champion.name, rarity: uc.champion.rarity, portrait_url: uc.champion.portrait_url ?? null,
          });
        }
      }
      captureChampionDetails();
      renderVerifyScreen();
      showRosterScreen('screen-verify');
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
      captureChampionDetails();
      renderVerifyScreen();
      showRosterScreen('screen-verify');
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
      sheetReturnTo = 'rarity';
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

  card.addEventListener('click', () => { sheetReturnTo = 'rarity'; openDetailSheet(champ, rarity); });
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

  // Ascension level (0–6, defaults to 0)
  const ascInput = qs('#sheet-ascension', sheet);
  if (ascInput) ascInput.value = existing?.ascension_level ?? 0;

  // Mastery tier
  const masteryVal = existing?.mastery_tier ?? 'None';
  renderMastery(sheet, masteryVal);

  // Booked toggle — default YES for Rares (cheap/abundant books → credit max skills, INS-0003);
  // No for Epic/Legendary/Mythical (scarce books). A saved value always wins.
  const bookedChk = qs('#sheet-booked', sheet);
  if (bookedChk) bookedChk.checked = existing?.is_booked ?? (rarity === 'Rare');

  // Masteries only matter for level-60 champs (Warmaster/Giant Slayer unlock at 60): show the
  // boss-mastery question only then, and re-evaluate when the level input changes.
  updateMasteryVisibility(sheet);
  const lvlEl = qs('#sheet-level', sheet);
  if (lvlEl) lvlEl.oninput = () => updateMasteryVisibility(sheet);

  // Lore of Steel (only show if mastery = Complete)
  updateLoreVisibility(sheet);
  const masteryBtns = sheet.querySelectorAll('[data-mastery]');
  masteryBtns.forEach(btn => {
    btn.addEventListener('click', () => updateLoreVisibility(sheet));
  });

  // Buttons
  const addBtn = qs('#sheet-add-btn', sheet);
  if (addBtn) {
    addBtn.disabled = false;
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
    star.addEventListener('click', () => { renderStars(root, i); updateMasteryVisibility(root); });
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

// The boss-mastery question is only meaningful for 6★ champions (masteries are gated on
// ascension, not level — a 6★ at level 1 can have them). Below 6★ we hide the row and force
// mastery to 'None' so a champ can't be credited with a mastery it can't have.
function updateMasteryVisibility(root) {
  const row = qs('#sheet-mastery-row', root);
  if (!row) return;
  const show = getStars(root) >= 6;
  row.style.display = show ? '' : 'none';
  if (!show) { renderMastery(root, 'None'); updateLoreVisibility(root); }
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
    if (champ.name) championDetails.set(champ.id, {
      name: champ.name, rarity, portrait_url: champ.portrait_url ?? championDetails.get(champ.id)?.portrait_url ?? null,
    });
    updateCardSelected(champ.id, true);
    closeDetailSheet();
    if (sheetReturnTo === 'verify') {
      renderVerifyScreen();
      showRosterScreen('screen-verify');
    } else {
      refreshRarityScreen();
      showRosterScreen('screen-rarity');
    }
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
    if (sheetReturnTo === 'verify') {
      renderVerifyScreen();
      showRosterScreen('screen-verify');
    } else {
      refreshRarityScreen();
    }
  } catch { /* non-fatal — UI stays open */ }
}

// ── Roster Verification (default landing) ───────────────────────────────────────
function renderVerifyScreen() {
  const screen = document.getElementById('screen-verify');
  if (!screen) return;

  // Sign-in control + profile switcher (switcher stays hidden for anonymous users).
  renderAuthControl();
  loadProfileSwitcher();

  // Greeting (profile name) + rarity summary
  const greeting = qs('#roster-greeting', screen);
  if (greeting) {
    const name = gestalContext?.account?.displayName;
    greeting.textContent = name ? `Good to see you ${name}` : 'Your roster';
  }
  const summary = qs('#roster-summary', screen);
  if (summary) {
    const parts = RARITIES
      .map(r => {
        const count = Object.keys(roster).filter(id => championDetails.get(id)?.rarity === r).length;
        return count > 0 ? `${count} ${r}` : null;
      })
      .filter(Boolean);
    const base = parts.join(' · ') || `${totalRosterCount()} champions`;
    const untaggedCount = gestalContext?.roster?.untagged?.length ?? 0;
    summary.textContent = 'I see you have ' +
      (untaggedCount > 0 ? `${base} · ${untaggedCount} not yet in database` : base);
  }

  const editBtn = qs('#btn-edit-roster', screen);
  if (editBtn) editBtn.onclick = () => { renderRarityScreen(); showRosterScreen('screen-rarity'); };

  // Bulk "book all max-level" — flags every Lv60 champ as fully booked in one tap (the common case).
  const bookAllBtn = qs('#btn-book-all', screen);
  if (bookAllBtn) bookAllBtn.onclick = async () => {
    bookAllBtn.disabled = true; const prev = bookAllBtn.textContent; bookAllBtn.textContent = 'Booking…';
    const n = await bookAllRares();
    bookAllBtn.disabled = false; bookAllBtn.textContent = n > 0 ? `✓ Booked ${n} Rares` : '📖 Rares already booked';
    setTimeout(() => { bookAllBtn.textContent = prev; }, 2000);
  };

  // Champion cards (sorted level desc, then rarity desc)
  const list  = qs('#verify-list', screen);
  const empty = qs('#verify-empty', screen);
  const cards = getVerificationCards();
  if (list) {
    list.innerHTML = '';
    for (const c of cards) list.appendChild(buildVerifyCard(c));
    list.classList.toggle('hidden', cards.length === 0);
  }
  empty?.classList.toggle('hidden', cards.length > 0);

  const addBtn = qs('#btn-verify-add', screen);
  if (addBtn) addBtn.onclick = () => { renderRarityScreen(); showRosterScreen('screen-rarity'); };

  // Footer
  const count = qs('#verify-count', screen);
  if (count) count.textContent = `${cards.length} champion${cards.length === 1 ? '' : 's'}`;
  const recBtn = qs('#btn-verify-recommend', screen);
  if (recBtn) recBtn.onclick = openContentSheet;
}

// Assembles sorted card data from roster state + champion identity.
function getVerificationCards() {
  return Object.entries(roster)
    .map(([id, state]) => {
      const d = championDetails.get(id) ?? {};
      return {
        id,
        name:            d.name ?? 'Unknown champion',
        rarity:          d.rarity ?? null,
        portrait_url:    d.portrait_url ?? null,
        level:           state.level ?? 1,
        stars:           state.stars ?? 1,
        ascension_level: state.ascension_level ?? 0,
        gear_tier:       state.gear_tier ?? 'Starter',
        mastery_tier:    state.mastery_tier ?? 'None',
        is_booked:       state.is_booked ?? false,
      };
    })
    .sort((a, b) =>
      (b.level - a.level) ||
      ((RARITY_WEIGHT[b.rarity] ?? 0) - (RARITY_WEIGHT[a.rarity] ?? 0)) ||
      a.name.localeCompare(b.name)
    );
}

function buildVerifyCard(c) {
  const card = document.createElement('button');
  card.className = 'verify-card';
  card.style.setProperty('--rarity-color', RARITY_COLOR[c.rarity] ?? '#888');

  // Portrait: show a letter placeholder by default; swap in the image only once it
  // actually loads. A null URL (or a 404) cleanly leaves the letter showing.
  const img = document.createElement('div');
  img.className = 'verify-portrait portrait-placeholder';
  img.textContent = c.name.charAt(0).toUpperCase();
  if (c.portrait_url) {
    const im = document.createElement('img');
    im.className = 'verify-portrait-img';
    im.alt = '';
    im.onload = () => {
      img.classList.remove('portrait-placeholder');
      img.textContent = '';
      img.appendChild(im);
    };
    im.src = c.portrait_url; // onerror: do nothing → letter placeholder remains
  }

  const info = document.createElement('div');
  info.className = 'verify-info';

  const top = document.createElement('div');
  top.className = 'verify-card-top';
  const name = document.createElement('span');
  name.className = 'verify-name';
  name.textContent = c.name;
  const stars = document.createElement('span');
  stars.className = 'verify-stars';
  // Match the game: ascended stars are magenta, the rest gold. ascension_level
  // magenta stars fill from the left, remaining rank stars stay gold.
  const rank = Math.max(1, Math.min(6, c.stars));
  const asc  = Math.max(0, Math.min(rank, c.ascension_level ?? 0));
  if (asc > 0) {
    const ascStar = document.createElement('span');
    ascStar.className = 'star-ascended';
    ascStar.textContent = '★'.repeat(asc);
    stars.appendChild(ascStar);
  }
  if (rank - asc > 0) stars.appendChild(document.createTextNode('★'.repeat(rank - asc)));
  top.append(name, stars);

  const meta = document.createElement('span');
  meta.className = 'verify-meta';
  // Ascension is shown by the magenta stars; gear is account-level. Meta = level only.
  const bits = [`Lv ${c.level}`];
  meta.textContent = bits.join('  |  ');

  info.append(top, meta);

  // Book badge — flag fully-booked champs right on the list. Gold = booked, faint = not.
  // Tapping the badge toggles booked (and persists) WITHOUT opening the detail sheet.
  const badge = document.createElement('span');
  badge.className = 'verify-book-badge' + (c.is_booked ? ' booked' : '');
  badge.textContent = '📖';
  badge.title = c.is_booked ? 'Fully booked (tap to unset)' : 'Not booked (tap to mark fully booked)';
  badge.setAttribute('role', 'button');
  badge.addEventListener('click', async (e) => {
    e.stopPropagation();               // don't open the detail sheet
    const now = await toggleBooked(c.id);
    c.is_booked = now;
    badge.classList.toggle('booked', now);
    badge.title = now ? 'Fully booked (tap to unset)' : 'Not booked (tap to mark fully booked)';
  });

  card.append(img, info, badge);

  // Mastery badge — 6★ champs can carry full masteries (Warmaster/Giant Slayer), the CB damage
  // gate. Shown ONLY for 6★ (masteries are star-gated, not level). Tap toggles it WITHOUT opening
  // the detail sheet — same minimal-friction pattern as the book badge.
  if ((c.stars ?? 0) >= 6) {
    const hasM = () => String(c.mastery_tier).toLowerCase() === 'complete';
    const mBadge = document.createElement('span');
    mBadge.className = 'verify-mastery-badge' + (hasM() ? ' has-mastery' : '');
    mBadge.textContent = '⚔️';
    const setTitle = () => { mBadge.title = hasM()
      ? 'Full masteries (Warmaster / Giant Slayer) — tap to unset'
      : 'No boss masteries — tap to mark full'; };
    setTitle();
    mBadge.setAttribute('role', 'button');
    mBadge.addEventListener('click', async (e) => {
      e.stopPropagation();               // don't open the detail sheet
      const now = await toggleMastery(c.id);
      c.mastery_tier = now ? 'Complete' : 'None';
      mBadge.classList.toggle('has-mastery', now);
      setTitle();
    });
    card.append(mBadge);
  }

  card.addEventListener('click', () => {
    sheetReturnTo = 'verify';
    openDetailSheet({ id: c.id, name: c.name, portrait_url: c.portrait_url }, c.rarity);
  });
  return card;
}

// Persist a single champion's is_booked toggle (full record, same shape as saveChampion).
// Optimistic: updates local state first, reverts on failure. Returns the new booked state.
async function toggleBooked(champId) {
  const s = roster[champId];
  if (!s) return false;
  const next = !s.is_booked;
  s.is_booked = next;
  try {
    const res = await fetch('/api/user-champions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: DEVICE_ID, champion_id: champId,
        level: s.level, stars: s.stars, ascension_level: s.ascension_level,
        gear_tier: s.gear_tier, mastery_tier: s.mastery_tier, is_booked: next }),
    });
    if (!res.ok) throw new Error('save failed');
  } catch { s.is_booked = !next; return !next; } // revert
  return next;
}

// Toggle full boss masteries (Complete ↔ None) inline from the card, persisting immediately.
// Returns the new "has full masteries" boolean. Mirrors toggleBooked.
async function toggleMastery(champId) {
  const s = roster[champId];
  if (!s) return false;
  const wasComplete = String(s.mastery_tier).toLowerCase() === 'complete';
  const next = !wasComplete;
  s.mastery_tier = next ? 'Complete' : 'None';
  try {
    const res = await fetch('/api/user-champions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: DEVICE_ID, champion_id: champId,
        level: s.level, stars: s.stars, ascension_level: s.ascension_level,
        gear_tier: s.gear_tier, mastery_tier: s.mastery_tier, is_booked: s.is_booked }),
    });
    if (!res.ok) throw new Error('save failed');
  } catch { s.mastery_tier = wasComplete ? 'Complete' : 'None'; return wasComplete; } // revert
  return next;
}

// Bulk: mark every RARE champ as fully booked — Rare books are cheap/abundant (INS-0003), so this is
// the safe common case. Deliberately NOT level-based: level ≠ booked, and Legendary books are scarce so
// most Lv60 Legendaries are NOT booked — those are flagged individually via the per-card badge.
async function bookAllRares() {
  const targets = Object.entries(roster)
    .filter(([id, s]) => championDetails.get(id)?.rarity === 'Rare' && !s.is_booked);
  for (const [id] of targets) await toggleBooked(id);
  renderVerifyScreen(); // re-render so every badge reflects the change
  return targets.length;
}

// ── Content selection (bottom sheet, opened from verify) ────────────────────────
let contentSheetWired = false;

function openContentSheet() {
  const sheet = document.getElementById('content-sheet');
  const backdrop = document.getElementById('content-sheet-backdrop');
  if (!sheet || !backdrop) return;
  if (!contentSheetWired) { wireContentSheet(sheet); contentSheetWired = true; }
  backdrop.classList.remove('hidden');
  sheet.classList.add('open');
  backdrop.onclick = closeContentSheet;
}

function closeContentSheet() {
  document.getElementById('content-sheet')?.classList.remove('open');
  document.getElementById('content-sheet-backdrop')?.classList.add('hidden');
}

// ── Account-level gear context (gear tier + Great Hall/Arena + masteries) ───────
// One setting for the whole roster (not per-champion). Stored in localStorage for
// the immediate UI, and best-effort persisted to the profile when signed in.
const GEAR_CTX_KEY = 'rsl_gear_ctx';
const GEAR_CTX_DEFAULTS = { gear_tier: 'fair', account_development: 'fair', masteries: 'none' };

function loadGearCtx() {
  try { return { ...GEAR_CTX_DEFAULTS, ...JSON.parse(localStorage.getItem(GEAR_CTX_KEY) || '{}') }; }
  catch { return { ...GEAR_CTX_DEFAULTS }; }
}

function readGearCtx(sheet) {
  return {
    gear_tier:           qs('#ctx-gear .pill.active', sheet)?.dataset.gear      ?? GEAR_CTX_DEFAULTS.gear_tier,
    account_development: qs('#ctx-account .pill.active', sheet)?.dataset.account ?? GEAR_CTX_DEFAULTS.account_development,
    masteries:           qs('#ctx-mastery .pill.active', sheet)?.dataset.mastery ?? GEAR_CTX_DEFAULTS.masteries,
  };
}

function saveGearCtx(ctx) {
  localStorage.setItem(GEAR_CTX_KEY, JSON.stringify(ctx));
  if (session?.access_token && activeProfileId) {
    fetch('/api/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        id: activeProfileId, gear_tier: ctx.gear_tier,
        account_development: ctx.account_development, masteries_default: ctx.masteries,
      }),
    }).catch(() => {});
  }
}

function wireGearCtx(sheet) {
  const ctx = loadGearCtx();
  const groups = [
    ['#ctx-gear', 'gear', 'gear_tier'],
    ['#ctx-account', 'account', 'account_development'],
    ['#ctx-mastery', 'mastery', 'masteries'],
  ];
  for (const [sel, attr, field] of groups) {
    const grp = qs(sel, sheet);
    if (!grp) continue;
    const pills = [...grp.querySelectorAll('.pill')];
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset[attr] === ctx[field]);
      p.onclick = () => {
        pills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        saveGearCtx(readGearCtx(sheet));
      };
    });
  }
}

function wireContentSheet(sheet) {
  const modeNormal = qs('#spider-mode-normal', sheet);
  const modeHard   = qs('#spider-mode-hard', sheet);
  const hardNote   = qs('#spider-hard-note', sheet);
  function setSpiderMode(mode) {
    const isHard = mode === 'hard';
    modeNormal?.classList.toggle('active', !isHard);
    modeHard?.classList.toggle('active', isHard);
    hardNote?.classList.toggle('hidden', !isHard);
  }
  setSpiderMode('normal');
  if (modeNormal) modeNormal.onclick = () => setSpiderMode('normal');
  if (modeHard)   modeHard.onclick   = () => setSpiderMode('hard');

  const cbBtns = sheet.querySelectorAll('[data-difficulty]');
  cbBtns.forEach(btn => btn.addEventListener('click', () => {
    cbBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));

  // Content tabs → show the matching section. Ice Golem / Fire Knight are pending a
  // stage-data seed, so the recommend button is disabled while they're selected.
  const SECTION = {
    spider:        'content-spider',
    clan_boss:     'content-clan-boss',
    ice_golem:     'content-ice_golem',
    fire_knight:   'content-fire_knight',
    dragon:        'content-dragon',
    event_dungeon: 'content-event_dungeon',
  };
  const tabs   = [...sheet.querySelectorAll('.content-tab')];
  const recBtn = qs('#btn-get-recommendation', sheet);

  function setContent(key) {
    for (const [k, id] of Object.entries(SECTION)) {
      qs('#' + id, sheet)?.classList.toggle('hidden', k !== key);
    }
    tabs.forEach(t => t.classList.toggle('active', t.dataset.content === key));
    if (recBtn) recBtn.disabled = CONTENT_UNAVAILABLE.has(key);
  }
  setContent('spider');
  tabs.forEach(t => { t.onclick = () => setContent(t.dataset.content); });

  // Fire Knight / Ice Golem have no stage picker — the engine auto-scans for the
  // highest clearable stage (same as Spider's Den).

  wireGearCtx(sheet);

  qs('#btn-content-cancel', sheet)?.addEventListener('click', closeContentSheet);
  if (recBtn) recBtn.onclick = () => { closeContentSheet(); requestRecommendation(sheet); };
}

async function requestRecommendation(sheet) {
  // Determine content key + options from the active content tab.
  const key = qs('.content-tab.active', sheet)?.dataset.content ?? 'spider';
  let contentKey, options = {};

  if (key === 'spider') {
    const isHard = qs('#spider-mode-hard', sheet)?.classList.contains('active');
    contentKey = isHard ? 'spider_hard' : 'spider';
  } else if (key === 'clan_boss') {
    contentKey = 'clan_boss';
    options.difficulty = qs('[data-difficulty].active', sheet)?.dataset.difficulty ?? 'Normal';
    options.boss_affinity = null;
  } else if (key === 'event_dungeon') {
    contentKey = 'event_dungeon';
  } else if (key === 'ice_golem' || key === 'fire_knight' || key === 'dragon') {
    // No stage picker — the engine auto-scans for the highest clearable stage.
    contentKey = key;
  } else {
    return; // unknown content tab
  }

  // Account-level gear context → engine options (gear_tier / account_development / masteries).
  Object.assign(options, readGearCtx(sheet));

  // Dispatch to existing match flow in app.js via a custom event.
  // When auto-populated from Gestal, carry the real roster + battle-history context
  // so app.js sends them straight to /api/match (bypassing the Supabase round-trip).
  document.dispatchEvent(new CustomEvent('rsl:request-recommendation', {
    detail: {
      contentKey,
      options,
      deviceId: DEVICE_ID,
      userChampions: gestalUserChampions,
      context:       gestalContext,
    },
  }));
}
