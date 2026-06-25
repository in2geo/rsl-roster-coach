import { preloadRewardedAd, showRewardedAd } from './ads.js';

// ── Screen navigation ──────────────────────────────────────────────────────
const screens = {
  upload:  document.getElementById('screen-upload'),
  confirm: document.getElementById('screen-confirm'),
  loading: document.getElementById('screen-loading'),
  results: document.getElementById('screen-results'),
  ad:      document.getElementById('screen-ad'),
  error:   document.getElementById('screen-error'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
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
    const form = new FormData();
    form.append('screenshot', compressed);

    // Fetch champion list and parse screenshot in parallel
    const [, parseRes] = await Promise.all([
      loadChampionList(),
      fetch('/api/parse', { method: 'POST', body: form }),
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

function cycleLoadingMessage(messages) {
  let i = 0;
  const el = document.getElementById('loading-msg');
  el.textContent = messages[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % messages.length;
    el.textContent = messages[i];
  }, 2500);
}

function clearLoadingTimer() { clearInterval(loadingTimer); }

// ── Render results ─────────────────────────────────────────────────────────
function renderResults(data) {
  document.getElementById('result-content-name').textContent = data.content_label || '';

  const teamList = document.getElementById('team-list');
  teamList.innerHTML = '';
  (data.team || []).forEach(champ => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = `rarity-dot ${champ.rarity || ''}`;
    li.appendChild(dot);
    li.append(`${champ.name} — Lv ${champ.level} ★${champ.stars}`);
    teamList.appendChild(li);
  });

  document.getElementById('explanation-text').textContent = data.explanation || '';

  const gapsSection = document.getElementById('gaps-section');
  const gapsList    = document.getElementById('gaps-list');
  gapsList.innerHTML = '';
  if (data.gaps && data.gaps.length) {
    data.gaps.forEach(g => {
      const li = document.createElement('li');
      li.textContent = g;
      gapsList.appendChild(li);
    });
    gapsSection.classList.remove('hidden');
  } else {
    gapsSection.classList.add('hidden');
  }
}

// ── Results buttons ────────────────────────────────────────────────────────
document.getElementById('btn-deeper').addEventListener('click', () => showScreen('ad'));
document.getElementById('btn-restart').addEventListener('click', resetToUpload);

document.getElementById('btn-watch-ad').addEventListener('click', async () => {
  const btn = document.getElementById('btn-watch-ad');
  btn.disabled = true;
  btn.textContent = 'Loading ad…';
  const earned = await showRewardedAd();
  btn.disabled = false;
  btn.textContent = 'Watch ad';
  if (earned) showDeepAnalysis();
  else showScreen('results');
});

document.getElementById('btn-skip-ad').addEventListener('click', () => showScreen('results'));
document.getElementById('btn-error-retry').addEventListener('click', resetToUpload);

function resetToUpload() {
  selectedFile = null;
  parsedChampions = [];
  fileInput.value = '';
  previewWrap.classList.add('hidden');
  uploadLabel.classList.remove('hidden');
  contentSelect.value = '';
  updateAnalyseBtn();
  showScreen('upload');
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

// ── Init ───────────────────────────────────────────────────────────────────
preloadRewardedAd();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
