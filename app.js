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

contentSelect.addEventListener('change', updateAnalyseBtn);

function updateAnalyseBtn() {
  btnAnalyse.disabled = !(selectedFile && contentSelect.value);
}

// ── Step 1: Parse screenshot ───────────────────────────────────────────────
btnAnalyse.addEventListener('click', runParseStep);

async function runParseStep() {
  showScreen('loading');
  document.getElementById('loading-msg').textContent = 'Reading your roster…';

  try {
    const form = new FormData();
    form.append('screenshot', selectedFile);
    const res = await fetch('/api/parse', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);

    parsedChampions = body.champions || [];
    renderConfirmScreen(parsedChampions);
    showScreen('confirm');
  } catch (err) {
    document.getElementById('error-msg').textContent =
      err.message || 'Could not read screenshot. Please try again.';
    showScreen('error');
  }
}

// ── Confirm screen ─────────────────────────────────────────────────────────
function renderConfirmScreen(champions) {
  const list = document.getElementById('confirm-list');
  list.innerHTML = '';
  champions.forEach((champ, i) => {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = champ.name || '';
    input.placeholder = 'Champion name';
    input.addEventListener('change', e => { parsedChampions[i].name = e.target.value.trim(); });

    const meta = document.createElement('span');
    meta.style.cssText = 'font-size:0.8rem;color:var(--muted);flex-shrink:0';
    meta.textContent = `Lv${champ.level} ★${champ.stars}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      parsedChampions.splice(i, 1);
      renderConfirmScreen(parsedChampions);
    });

    li.appendChild(input);
    li.appendChild(meta);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

document.getElementById('btn-add-champion').addEventListener('click', () => {
  parsedChampions.push({ name: '', level: 60, stars: 6 });
  renderConfirmScreen(parsedChampions);
  // Focus the new input
  const inputs = document.querySelectorAll('#confirm-list input');
  inputs[inputs.length - 1]?.focus();
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
  cycleLoadingMessage();

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
const loadingMessages = [
  'Matching champions to dungeon goals…',
  'Checking your roster against requirements…',
  'Writing your recommendation…',
];
let loadingTimer;

function cycleLoadingMessage() {
  let i = 0;
  const el = document.getElementById('loading-msg');
  el.textContent = loadingMessages[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    el.textContent = loadingMessages[i];
  }, 2000);
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
