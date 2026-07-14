import { preloadRewardedAd, showRewardedAd } from './ads.js';
import { initRosterFlow, showRosterScreen } from './roster.js';
import { initTestMode, isTestMode } from './test-mode.js';

// Unregister service worker on localhost so code changes are always fresh
if ('serviceWorker' in navigator && location.hostname === 'localhost') {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

// ── Screen navigation ──────────────────────────────────────────────────────
const screens = {
  upload:  document.getElementById('screen-upload'),
  confirm: document.getElementById('screen-confirm'),
  loading: document.getElementById('screen-loading'),
  results: document.getElementById('screen-results'),
  ad:      document.getElementById('screen-ad'),
  error:   document.getElementById('screen-error'),
};

const ROSTER_SCREEN_IDS = ['screen-rarity', 'screen-grid', 'screen-verify'];

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  ROSTER_SCREEN_IDS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ── Upload / preview ───────────────────────────────────────────────────────
const fileInput     = document.getElementById('file-input');
const uploadLabel   = document.getElementById('upload-label');
const previewWrap   = document.getElementById('preview-wrap');
const previewImg    = document.getElementById('preview-img');
const btnChange     = document.getElementById('btn-change');
const contentSelect = document.getElementById('content-select');
const btnAnalyse    = document.getElementById('btn-analyse');

let selectedFile    = null;
let parsedChampions = [];  // set after vision step, used in confirm + match step

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile = file;
  previewImg.src = URL.createObjectURL(file);
  uploadLabel.classList.add('hidden');
  previewWrap.classList.remove('hidden');
  updateAnalyseBtn();
});

btnChange.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewWrap.classList.add('hidden');
  uploadLabel.classList.remove('hidden');
  updateAnalyseBtn();
});

const btnManual = document.getElementById('btn-manual-entry');

contentSelect.addEventListener('change', updateAnalyseBtn);

function updateAnalyseBtn() {
  btnAnalyse.disabled = !(selectedFile && contentSelect.value);
  btnManual.disabled  = !contentSelect.value;
}

btnManual.addEventListener('click', async () => {
  btnManual.disabled = true;
  btnManual.textContent = 'Loading champion list…';
  await loadChampionList();
  btnManual.disabled = false;
  btnManual.textContent = 'Or enter my roster manually →';
  parsedChampions = [];
  renderConfirmScreen([]);
  showScreen('confirm');
});

// ── Champion list (loaded once, used for dropdowns) ────────────────────────
let championsByRarity = {};  // { Legendary: ['Arbiter', ...], Epic: [...], ... }

async function loadChampionList() {
  if (Object.keys(championsByRarity).length) return;  // already loaded
  try {
    const res = await fetch('/api/champions');
    if (!res.ok) return;
    const body = await res.json();
    championsByRarity = body.byRarity || {};
  } catch { /* non-fatal — dropdowns fall back to text inputs */ }
}

// ── Step 1: Parse screenshot ───────────────────────────────────────────────
btnAnalyse.addEventListener('click', runParseStep);

function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise(resolve => {
    const done = (result) => { resolved || (resolved = true, resolve(result)); };
    let resolved = false;

    // Safety net — if anything hangs, fall back to original file after 4s
    const timeout = setTimeout(() => done(file), 4000);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          done(blob ? new File([blob], 'screenshot.jpg', { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', quality);
      } catch { done(file); }
    };
    img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); done(file); };
    img.src = url;
  });
}

async function runParseStep() {
  showScreen('loading');
  cycleLoadingMessage(parseMessages);

  try {
    const compressed = await compressImage(selectedFile);
    const imageData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });

    // Fetch champion list and parse screenshot in parallel
    const [, parseRes] = await Promise.all([
      loadChampionList(),
      fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, mimeType: 'image/jpeg' }),
      }),
    ]);

    const body = await parseRes.json().catch(() => ({}));
    if (!parseRes.ok) throw new Error(body.error || `Server error ${parseRes.status}`);

    clearLoadingTimer();
    parsedChampions = body.champions || [];
    renderConfirmScreen(parsedChampions);
    showScreen('confirm');
  } catch (err) {
    clearLoadingTimer();
    document.getElementById('error-msg').textContent =
      err.message || 'Could not read screenshot. Please try again.';
    showScreen('error');
  }
}

// ── Confirm screen ─────────────────────────────────────────────────────────
const RARITIES = ['Mythical', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];

function rarityColor(r) {
  return { Common:'#aaa', Uncommon:'#4caf50', Rare:'#2196f3',
           Epic:'#9c27b0', Legendary:'#ff9800', Mythical:'#e94560' }[r] ?? '#aaa';
}

function buildNameDropdown(champ, index) {
  const rarity  = champ.rarity || '';
  const options = championsByRarity[rarity] || [];

  if (!options.length) {
    // Fallback to text input if champion list didn't load or unknown rarity
    const input = document.createElement('input');
    input.type = 'text';
    input.value = champ.name || '';
    input.placeholder = 'Champion name';
    input.addEventListener('change', e => { parsedChampions[index].name = e.target.value.trim(); });
    return input;
  }

  const sel = document.createElement('select');
  sel.className = 'champ-select';

  // Blank option first (in case AI name doesn't match)
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '— pick a name —';
  sel.appendChild(blank);

  for (const name of options) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === champ.name) opt.selected = true;
    sel.appendChild(opt);
  }

  sel.addEventListener('change', e => { parsedChampions[index].name = e.target.value; });
  return sel;
}

function renderConfirmScreen(champions) {
  const list = document.getElementById('confirm-list');
  list.innerHTML = '';

  champions.forEach((champ, i) => {
    const li = document.createElement('li');

    // Rarity badge
    const badge = document.createElement('span');
    badge.className = 'rarity-badge';
    badge.textContent = (champ.rarity || '?')[0];  // first letter: L, E, R, etc.
    badge.title = champ.rarity || 'Unknown rarity';
    badge.style.cssText = `background:${rarityColor(champ.rarity)};color:#fff;
      border-radius:4px;padding:1px 5px;font-size:0.7rem;font-weight:700;flex-shrink:0`;
    li.appendChild(badge);

    // Rarity selector (small)
    const rarSel = document.createElement('select');
    rarSel.className = 'rarity-select';
    rarSel.title = 'Change rarity';
    rarSel.style.cssText = 'background:var(--bg);color:var(--muted);border:none;font-size:0.75rem;width:82px;flex-shrink:0';
    for (const r of RARITIES) {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = r;
      if (r === champ.rarity) o.selected = true;
      rarSel.appendChild(o);
    }
    rarSel.addEventListener('change', e => {
      parsedChampions[i].rarity = e.target.value;
      renderConfirmScreen(parsedChampions);  // re-render so name dropdown updates
    });
    li.appendChild(rarSel);

    // Name dropdown
    li.appendChild(buildNameDropdown(champ, i));

    // Level input
    const lvlInput = document.createElement('input');
    lvlInput.type = 'number';
    lvlInput.min = 1; lvlInput.max = 60;
    lvlInput.value = champ.level || 1;
    lvlInput.title = 'Level';
    lvlInput.style.cssText = 'width:38px;background:transparent;border:none;border-bottom:1px solid var(--muted);color:var(--muted);font-size:0.75rem;text-align:center;flex-shrink:0';
    lvlInput.addEventListener('change', e => { parsedChampions[i].level = parseInt(e.target.value) || 1; });
    li.appendChild(lvlInput);

    // Stars input
    const starInput = document.createElement('input');
    starInput.type = 'number';
    starInput.min = 1; starInput.max = 6;
    starInput.value = champ.stars || 1;
    starInput.title = 'Stars';
    starInput.style.cssText = 'width:28px;background:transparent;border:none;border-bottom:1px solid var(--muted);color:var(--muted);font-size:0.75rem;text-align:center;flex-shrink:0';
    starInput.addEventListener('change', e => { parsedChampions[i].stars = parseInt(e.target.value) || 1; });
    li.appendChild(starInput);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      parsedChampions.splice(i, 1);
      renderConfirmScreen(parsedChampions);
    });
    li.appendChild(removeBtn);

    list.appendChild(li);
  });
}

document.getElementById('btn-add-champion').addEventListener('click', () => {
  parsedChampions.push({ name: '', rarity: 'Rare', level: 1, stars: 1 });
  renderConfirmScreen(parsedChampions);
  const sels = document.querySelectorAll('#confirm-list select.champ-select');
  sels[sels.length - 1]?.focus();
});

document.getElementById('btn-confirm-back').addEventListener('click', resetToUpload);

document.getElementById('btn-confirm-roster').addEventListener('click', runMatchStep);

// ── Step 2: Match + explain ────────────────────────────────────────────────
async function runMatchStep() {
  // Filter out empty names
  const roster = parsedChampions.filter(c => c.name?.trim());
  if (!roster.length) {
    alert('Please add at least one champion name.');
    return;
  }

  showScreen('loading');
  cycleLoadingMessage(matchMessages);

  try {
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champions: roster, content: contentSelect.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);

    clearLoadingTimer();
    renderResults(body);
    showScreen('results');
  } catch (err) {
    clearLoadingTimer();
    document.getElementById('error-msg').textContent =
      err.message || 'Something went wrong. Please try again.';
    showScreen('error');
  }
}

// ── Loading messages ───────────────────────────────────────────────────────
const parseMessages = [
  'Reading your roster…',
  'Scanning champion cards…',
  'Identifying champions…',
  'Almost done reading…',
];
const matchMessages = [
  'Matching champions to dungeon goals…',
  'Checking your roster against requirements…',
  'Writing your recommendation…',
];
let loadingTimer;
let timerInterval;
let timerStart;

function cycleLoadingMessage(messages) {
  let i = 0;
  const el = document.getElementById('loading-msg');
  const timerEl = document.getElementById('loading-timer');
  el.textContent = messages[0];
  timerStart = Date.now();
  timerEl.textContent = '0s';
  timerInterval = setInterval(() => {
    timerEl.textContent = Math.floor((Date.now() - timerStart) / 1000) + 's';
  }, 1000);
  loadingTimer = setInterval(() => {
    i = (i + 1) % messages.length;
    el.textContent = messages[i];
  }, 2500);
}

function clearLoadingTimer() {
  clearInterval(loadingTimer);
  clearInterval(timerInterval);
}

// ── Outcome feedback ───────────────────────────────────────────────────────
let pendingOutcomeId = null; // row id returned by POST /api/recommendation-outcomes

async function recordOutcome(outcome, failureReason) {
  if (!pendingOutcomeId) return;
  const id = pendingOutcomeId;
  pendingOutcomeId = null;
  await fetch('/api/recommendation-outcomes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, outcome, failure_reason: failureReason ?? null }),
  }).catch(() => {});
}

document.getElementById('btn-cleared').addEventListener('click', async () => {
  await recordOutcome('cleared');
  document.getElementById('feedback-section').classList.add('hidden');
  document.getElementById('feedback-thanks').classList.remove('hidden');
  document.getElementById('feedback-thanks').classList.add('show-inline');
});

document.getElementById('btn-didnt-work').addEventListener('click', () => {
  document.getElementById('failure-reason-panel').classList.remove('hidden');
  document.getElementById('btn-cleared').classList.add('hidden');
  document.getElementById('btn-didnt-work').classList.add('hidden');
});

document.querySelectorAll('.reason-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await recordOutcome('failed', btn.dataset.reason);
    document.getElementById('failure-reason-panel').classList.add('hidden');
    document.getElementById('feedback-prompt') &&
      (document.querySelector('#feedback-section .feedback-prompt').classList.add('hidden'));
    document.getElementById('feedback-thanks').classList.remove('hidden');
  });
});

// ── Render results ─────────────────────────────────────────────────────────
function renderResults(data) {
  lastResult = data;

  // Spider's Den Normal: show "Your best Spider's Den target is Stage X" heading
  const resultHeading = document.getElementById('result-heading');
  if (data.stage_number_attempted != null && data.content_label?.includes("Spider's Den — Stage")) {
    resultHeading.innerHTML = `Your best Spider's Den target is <span id="result-content-name">Stage ${data.stage_number_attempted}</span>`;
  } else {
    resultHeading.innerHTML = `Your team for <span id="result-content-name">${data.content_label || ''}</span>`;
  }

  const teamList = document.getElementById('team-list');
  teamList.innerHTML = '';
  const leaderName = data.leader?.name ?? null;
  (data.team || []).forEach(champ => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = `rarity-dot ${champ.rarity || ''}`;
    li.appendChild(dot);
    li.append(`${champ.name} — Lv ${champ.level} ★${champ.stars}`);
    if (champ.name === leaderName) {
      const badge = document.createElement('span');
      badge.className = 'leader-badge';
      badge.textContent = 'Leader';
      li.appendChild(badge);
    }
    teamList.appendChild(li);
  });

  // Leader skill (aura) — in RSL only the leader's aura is active for the team.
  document.querySelector('.leader-note')?.remove();
  if (data.leader?.aura_summary) {
    const l = data.leader;
    const summary = String(l.aura_summary).replace(/\bin in\b/gi, 'in').trim();
    const restr = l.restriction ? ` (${l.restriction})` : '';
    teamList.insertAdjacentHTML('afterend',
      `<p class="leader-note"><strong>Leader skill:</strong> put <strong>${leaderName}</strong> in the leader slot — ${summary}${restr}</p>`);
  }

  const confDisplay = document.getElementById('confidence-display');
  const confValue   = document.getElementById('confidence-pct-value');
  if (data.confidence_pct != null) {
    confValue.textContent = `${data.confidence_pct}%`;
    confDisplay.classList.remove('hidden');
  } else {
    confDisplay.classList.add('hidden');
  }

  const explanationEl = document.getElementById('explanation-text');
  explanationEl.textContent = data.explanation || '';
  document.querySelector('.event-fallback-note')?.remove();
  document.querySelector('.not-ready-note')?.remove();
  if (data.event_fallback_note) {
    explanationEl.insertAdjacentHTML('afterend',
      `<p class="event-fallback-note">${data.event_fallback_note}</p>`);
  }
  if (data.not_ready_note) {
    explanationEl.insertAdjacentHTML('afterend',
      `<p class="not-ready-note">${data.not_ready_note}</p>`);
  }

  // Gaps hidden behind Gate 1 — revealed after "Go deeper" ad
  document.getElementById('gaps-section').classList.add('hidden');
  document.getElementById('deep-section')?.remove();

  // Show Gate 1 + Gate 3 buttons
  document.getElementById('btn-deeper').classList.remove('hidden');
  document.getElementById('btn-failure').classList.remove('hidden');

  // Reset and show feedback section
  document.getElementById('feedback-section').classList.remove('hidden');
  document.getElementById('btn-cleared').classList.remove('hidden');
  document.getElementById('btn-didnt-work').classList.remove('hidden');
  document.getElementById('failure-reason-panel').classList.add('hidden');
  document.getElementById('feedback-thanks').classList.add('hidden');

  // Insert outcome row (outcome = null; updated when player responds)
  if (lastMatchParams?.deviceId) {
    const teamSnapshot = (data.team ?? []).map(c => ({
      name: c.name, rarity: c.rarity, level: c.level, stars: c.stars,
    }));
    const rosterSnapshot = (lastMatchParams.userChampions ?? []).map(uc => ({
      champion_id: uc.champion?.id,
      name:        uc.champion?.name,
      level:       uc.level,
      stars:       uc.stars,
      gear_tier:   uc.gear_tier,
      mastery_tier: uc.mastery_tier,
    }));
    fetch('/api/recommendation-outcomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:                lastMatchParams.deviceId,
        dungeon_stage_id:       data.dungeon_stage_id ?? null,
        stage_number_attempted: data.stage_number_attempted ?? null,
        verdict:                data.verdict ?? null,
        verdict_band:           data.verdict_band ?? null,
        confidence_pct:         data.confidence_pct ?? null,
        recommended_team:       teamSnapshot,
        roster_snapshot:        rosterSnapshot,
      }),
    })
      .then(r => r.json())
      .then(b => { if (b.id) pendingOutcomeId = b.id; })
      .catch(() => {});
  }
}

function revealGate1() {
  if (!lastResult) return;

  const gapsList = document.getElementById('gaps-list');
  const gapsSection = document.getElementById('gaps-section');
  gapsList.innerHTML = '';
  (lastResult.gaps || []).forEach(g => {
    const li = document.createElement('li');
    li.textContent = g;
    gapsList.appendChild(li);
  });
  if (lastResult.gaps?.length) {
    gapsSection.classList.remove('hidden');
  }

  const pct    = lastResult.confidence_pct;
  const pctRef = pct != null ? `That ${pct}% reflects` : 'Your result reflects';

  document.getElementById('deep-section')?.remove();
  document.getElementById('explanation-text').insertAdjacentHTML('afterend', `
    <section id="deep-section" class="deep-section">
      <h3>What to level up next</h3>
      <p>${pctRef} the gaps below. Focus on them in order — each one is blocking your team from clearing the next stage. Start with the first gap and work down the list.</p>
    </section>
  `);

  // Hide "Go deeper" once revealed
  document.getElementById('btn-deeper').classList.add('hidden');
}

function showFailureDiagnosis() {
  document.getElementById('failure-section')?.remove();
  document.getElementById('btn-failure').insertAdjacentHTML('beforebegin', `
    <section id="failure-section" class="failure-section">
      <h3>Failure diagnosis</h3>
      <p class="failure-question">Did your team survive past the first wave?</p>
      <div class="failure-btns">
        <button class="btn-secondary failure-yes" data-q="1">Yes</button>
        <button class="btn-secondary failure-no" data-q="1">No</button>
      </div>
      <p id="failure-result" class="failure-result hidden"></p>
    </section>
  `);

  document.querySelectorAll('.failure-yes, .failure-no').forEach(btn => {
    btn.addEventListener('click', e => {
      const survived = e.target.classList.contains('failure-yes');
      const result = document.getElementById('failure-result');
      result.textContent = survived
        ? 'Your champions are surviving but not dealing enough damage. Try improving gear tier or adding a champion with an ATK debuff.'
        : 'Your team is dying too fast. Focus on RES gear so your debuffs land, or add a healer/shield champion to survive the opener.';
      result.classList.remove('hidden');
      document.querySelector('.failure-question').classList.add('hidden');
      document.querySelector('.failure-btns').classList.add('hidden');
    });
  });

  // Hide "This team failed" once diagnosis is shown
  document.getElementById('btn-failure').classList.add('hidden');
}

// ── Ad gate modal ──────────────────────────────────────────────────────────
// pendingAction: what to do after the player watches the ad
// type: 'match' (Gate 2 — second content piece) | 'deeper' (Gate 1) | 'failure' (Gate 3)
let pendingAction = null;
let lastMatchParams = null; // { contentKey, options, deviceId, userChampions }
let lastResult = null;      // stored after every successful match for gate reveals

const adModal    = document.getElementById('ad-modal');
const adModalMsg = document.getElementById('ad-modal-msg');

function showAdModal(message, action) {
  // Test mode: skip the ad entirely and run the gated action straight away.
  if (isTestMode()) { runGatedAction(action); return; }
  pendingAction = action;
  adModalMsg.textContent = message;
  adModal.classList.remove('hidden');
}

// Satisfies the server-side gate (records the view) then runs the gated action.
// Shared by the "Watch ad" button and the test-mode bypass.
async function runGatedAction(action) {
  if (!action) return;
  const deviceId = lastMatchParams?.deviceId ?? action.params?.deviceId;
  if (deviceId) {
    await fetch('/api/verify-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: deviceId }),
    }).catch(() => {});
  }
  if (action.type === 'match') {
    await runRosterMatch(action.params, true); // post-ad retry — cap at one to prevent gate loops
  } else if (action.type === 'deeper') {
    revealGate1();
    showScreen('results');
  } else if (action.type === 'failure') {
    showFailureDiagnosis();
    showScreen('results');
  }
}

function hideAdModal() {
  adModal.classList.add('hidden');
  pendingAction = null;
}

document.getElementById('btn-modal-cancel').addEventListener('click', hideAdModal);

document.getElementById('btn-modal-watch').addEventListener('click', async () => {
  const btn = document.getElementById('btn-modal-watch');
  btn.disabled = true;
  btn.textContent = 'Loading ad…';

  // Placeholder — real AdMob SDK replaces this block
  await new Promise(r => setTimeout(r, 800));
  const verified = true;

  btn.disabled = false;
  btn.textContent = 'Watch ad';

  if (!verified) { hideAdModal(); return; }

  hideAdModal();
  const action = pendingAction;
  pendingAction = null;
  await runGatedAction(action);
});

// ── Results buttons ────────────────────────────────────────────────────────
document.getElementById('btn-deeper').addEventListener('click', () => {
  showAdModal(
    'Watch a short video to unlock deeper analysis — gap list, farming locations, and AI settings.',
    { type: 'deeper' }
  );
});

document.getElementById('btn-failure').addEventListener('click', () => {
  showAdModal(
    'Watch a short video to get your failure diagnosis — we\'ll identify exactly what went wrong.',
    { type: 'failure' }
  );
});

document.getElementById('btn-restart').addEventListener('click', returnToContentScreen);
document.getElementById('btn-error-retry').addEventListener('click', returnToContentScreen);

function returnToContentScreen() {
  // If the player came from the roster flow, send them back to the verification screen.
  // Fall back to the legacy upload screen only if no roster flow was active.
  if (lastMatchParams) {
    showRosterScreen('screen-verify');
  } else {
    resetToUpload();
  }
}

function resetToUpload() {
  // The legacy screenshot-upload flow is retired — "start over" re-enters the
  // roster flow (verification screen) instead of showing the upload screen.
  selectedFile = null;
  parsedChampions = [];
  initRosterFlow();
}

function showDeepAnalysis() {
  const el = document.getElementById('explanation-text');
  el.insertAdjacentHTML('afterend', `
    <section class="deep-section">
      <h3 style="font-size:0.8rem;font-weight:700;text-transform:uppercase;
                 letter-spacing:0.08em;color:var(--muted);margin-bottom:0.5rem;">
        What to level up next
      </h3>
      <p id="deep-text" style="font-size:0.95rem;line-height:1.6;color:var(--text)">
        Loading deeper analysis…
      </p>
    </section>
  `);
  showScreen('results');
}

// ── Roster recommendation dispatch ────────────────────────────────────────
// roster.js fires this event when the player taps "Get recommendation".
document.addEventListener('rsl:request-recommendation', async e => {
  const { contentKey, options, deviceId, userChampions, context } = e.detail;
  showScreen('loading');
  cycleLoadingMessage(matchMessages);

  try {
    let champions = userChampions;        // auto-populated from Gestal, if available
    let ctx       = context ?? null;

    // Fall back to the manually-saved Supabase roster when there's no Gestal export.
    if (!Array.isArray(champions) || !champions.length) {
      const rosterRes = await fetch(`/api/user-champions?user_id=${deviceId}`);
      const rosterBody = await rosterRes.json().catch(() => ({}));
      if (!rosterRes.ok) throw new Error(rosterBody.error || 'Could not load roster');
      champions = rosterBody.champions ?? [];
      ctx = null;
    }

    const params = {
      contentKey,
      options: options ?? {},
      deviceId,
      userChampions: champions,
      context: ctx,
    };
    lastMatchParams = params;
    await runRosterMatch(params);
  } catch (err) {
    clearLoadingTimer();
    document.getElementById('error-msg').textContent =
      err.message || 'Something went wrong. Please try again.';
    showScreen('error');
  }
});

async function runRosterMatch(params, adRetried = false) {
  const { contentKey, options, deviceId, userChampions, context } = params;

  const res = await fetch('/api/match', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userChampions,
      content: contentKey,
      options,
      user_id: deviceId,
      context: context ?? null,
    }),
  });
  const body = await res.json().catch(() => ({}));

  clearLoadingTimer();

  // Gate hit — show ad modal over the verification screen
  if (body.requiresAd) {
    // Loop guard: if we ALREADY satisfied the ad and the server still gates us, do NOT
    // re-trigger — that recursion (match → verify-ad → match → …) is the infinite loop
    // that flickered the roster screen. Surface it instead of spinning forever.
    if (adRetried) {
      showRosterScreen('screen-verify');
      document.getElementById('error-msg').textContent =
        'The ad gate could not be cleared. Please refresh and try again.';
      showScreen('error');
      return;
    }
    showRosterScreen('screen-verify');
    showAdModal(body.message || 'Watch a short video to unlock this recommendation.', {
      type: 'match',
      params,
    });
    return;
  }

  if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);

  renderResults(body);
  showScreen('results');
}

// ── Init ───────────────────────────────────────────────────────────────────
preloadRewardedAd();
initTestMode();
initRosterFlow();

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
