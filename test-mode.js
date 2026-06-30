// ── test-mode.js — developer toggle to bypass the rewarded-ad gate ───────────
// OFF by default and persisted in localStorage, so it never affects real users.
// When ON, the ad-gate modal is skipped and gated actions run immediately (the
// server-side gate is still satisfied via /api/verify-ad, so the flow works end
// to end without watching/clicking an ad).
//
// Turn it on/off:
//   • URL:     append ?test=1 (on) or ?test=0 (off) — applied, then stripped.
//   • Console: rslTestMode(true) / rslTestMode(false) / rslTestMode() to read.
//   • Badge:   when on, a "TEST MODE" badge shows bottom-left; click it to turn off.

const KEY = 'rsl_test_mode';

export function isTestMode() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setTestMode(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  renderBadge();
  return isTestMode();
}

function renderBadge() {
  let el = document.getElementById('test-mode-badge');
  if (isTestMode()) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'test-mode-badge';
      el.textContent = 'TEST MODE · ad gate off';
      el.title = 'Click to turn test mode off';
      el.style.cssText =
        'position:fixed;bottom:8px;left:8px;z-index:99999;background:#E8A33D;color:#1a1a1a;' +
        'font:600 11px/1 system-ui,sans-serif;padding:6px 9px;border-radius:6px;cursor:pointer;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.4);opacity:.92;';
      el.addEventListener('click', () => setTestMode(false));
      document.body.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}

/** Call once on load: applies any ?test= param, exposes the console toggle, draws the badge. */
export function initTestMode() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('test')) {
      const v = p.get('test');
      setTestMode(v === '1' || v === 'true' || v === 'on');
      p.delete('test');
      const qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
  } catch { /* ignore */ }

  window.rslTestMode = (on) => (on === undefined ? isTestMode() : setTestMode(on));
  renderBadge();
}
