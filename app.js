import { preloadRewardedAd, showRewardedAd } from './ads.js';

// ── Screen navigation ──────────────────────────────────────────────────────
const screens = {
  upload:  document.getElementById('screen-upload'),
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

let selectedFile = null;

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

// ── Analyse ────────────────────────────────────────────────────────────────
btnAnalyse.addEventListener('click', runAnalysis);

const loadingMessages = [
  'Reading your roster…',
  'Matching champions to dungeon goals…',
  'Writing your recommendation…',
];
let loadingTimer;

async function runAnalysis() {
  showScreen('loading');
  cycleLoadingMessage();

  try {
    const result = await callAnalyseAPI(selectedFile, contentSelect.value);
    clearInterval(loadingTimer);
    renderResults(result);
    showScreen('results');
  } catch (err) {
    clearInterval(loadingTimer);
    document.getElementById('error-msg').textContent =
      err.message || 'Something went wrong. Please try again.';
    showScreen('error');
  }
}

function cycleLoadingMessage() {
  let i = 0;
  const el = document.getElementById('loading-msg');
  el.textContent = loadingMessages[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % loadingMessages.length;
    el.textContent = loadingMessages[i];
  }, 2000);
}

// ── API call ───────────────────────────────────────────────────────────────
// Replace '/api/analyse' with your actual Vercel serverless function URL.
async function callAnalyseAPI(imageFile, contentKey) {
  const form = new FormData();
  form.append('screenshot', imageFile);
  form.append('content', contentKey);

  const res = await fetch('/api/analyse', { method: 'POST', body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }

  return res.json();
}

// ── Render results ─────────────────────────────────────────────────────────
// Expected API response shape:
// {
//   content_label: "Spider's Den",
//   team: [{ name, rarity, stars, level }],
//   explanation: "string",
//   gaps: ["string", ...]   // may be empty
// }
function renderResults(data) {
  const contentNames = {
    campaign:   "Campaign",
    spider:     "Spider's Den",
    clan_boss:  "Clan Boss",
  };

  document.getElementById('result-content-name').textContent =
    data.content_label || contentNames[contentSelect.value] || '';

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
document.getElementById('btn-deeper').addEventListener('click', () => {
  showScreen('ad');
});

document.getElementById('btn-restart').addEventListener('click', resetToUpload);

document.getElementById('btn-watch-ad').addEventListener('click', async () => {
  const btn = document.getElementById('btn-watch-ad');
  btn.disabled = true;
  btn.textContent = 'Loading ad…';

  const earned = await showRewardedAd();

  btn.disabled = false;
  btn.textContent = 'Watch ad';

  if (earned) {
    showDeepAnalysis();
  } else {
    // Ad wasn't available or was dismissed — return to results without reward
    showScreen('results');
  }
});

document.getElementById('btn-skip-ad').addEventListener('click', () => {
  showScreen('results');
});

document.getElementById('btn-error-retry').addEventListener('click', resetToUpload);

function resetToUpload() {
  selectedFile = null;
  fileInput.value = '';
  previewWrap.classList.add('hidden');
  uploadLabel.classList.remove('hidden');
  contentSelect.value = '';
  updateAnalyseBtn();
  showScreen('upload');
}

// ── Deep analysis (unlocked after rewarded ad) ─────────────────────────────
// Extend this with a second API call (e.g. POST /api/deeper) that returns
// level-up priorities, next farming targets, etc.
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

  // TODO: call /api/deeper with the current matchResult to populate #deep-text
}

// ── Init ───────────────────────────────────────────────────────────────────
preloadRewardedAd();

// ── PWA service worker ─────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}
