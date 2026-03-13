'use strict';

// ── backgroundDealer.js ────────────────────────────────────────────────────
// Handles AI-generated dealer background via fal.ai (Nano Banana 2).
// Completely independent from game logic — communicates only via
// window.DealerBackground public API and a custom DOM event.
// ──────────────────────────────────────────────────────────────────────────

const FAL_ENDPOINT   = 'https://fal.run/fal-ai/nano-banana-2';
const KEY_APIKEY     = 'spider_fal_apikey';
const KEY_GENDER     = 'spider_dealer_gender';

const PROMPTS = {
  female:
    'A beautiful professional casino dealer dealing cards at a green felt poker table, ' +
    'elegant female dealer wearing a crisp uniform, cinematic lighting, shallow depth of field, ' +
    'photorealistic casino atmosphere, dramatic overhead casino lights, rich colors, ' +
    'wide angle, cinematic composition',
  male:
    'A professional male casino dealer dealing cards at a green felt poker table, ' +
    'confident male dealer wearing a crisp uniform, cinematic lighting, shallow depth of field, ' +
    'photorealistic casino atmosphere, dramatic overhead casino lights, rich colors, ' +
    'wide angle, cinematic composition',
};

// ── Internal state ─────────────────────────────────────────────────────────
let _gender      = localStorage.getItem(KEY_GENDER) || 'female';
let _generating  = false;

// ── Core: generate + set background ───────────────────────────────────────
async function generate(gender) {
  const apiKey = localStorage.getItem(KEY_APIKEY);
  if (!apiKey) { showKeyModal(); return; }
  if (_generating) return;

  _generating = true;
  setSpinner(true);
  setStatus('Generating dealer…');

  try {
    const res = await fetch(FAL_ENDPOINT, {
      method:  'POST',
      headers: {
        'Authorization': 'Key ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        prompt:        PROMPTS[gender] || PROMPTS.female,
        aspect_ratio:  '16:9',
        output_format: 'jpeg',
        num_images:    1,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(KEY_APIKEY);
      throw new Error('invalid_key');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'api_error_' + res.status);
    }

    const data     = await res.json();
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) throw new Error('no_image_in_response');

    applyBackground(imageUrl);
    setStatus('');
  } catch (err) {
    console.warn('[DealerBackground] generation failed:', err.message);
    applyFallback();
    if (err.message === 'invalid_key') {
      showKeyModal('Invalid API key — please enter a valid fal.ai key.');
    } else {
      setStatus('Background unavailable');
    }
  } finally {
    _generating = false;
    setSpinner(false);
  }
}

function applyBackground(url) {
  const bg  = document.getElementById('dealer-background');
  const img = new Image();
  img.onload = () => {
    bg.style.backgroundImage = `url('${url}')`;
    bg.classList.remove('fallback');
    bg.classList.add('loaded');
  };
  img.onerror = () => applyFallback();
  img.src = url;
}

function applyFallback() {
  const bg = document.getElementById('dealer-background');
  bg.style.backgroundImage = '';
  bg.classList.add('fallback');
  bg.classList.remove('loaded');
}

// ── Spinner & status ───────────────────────────────────────────────────────
function setSpinner(on) {
  const el = document.getElementById('dealer-spinner');
  if (el) el.classList.toggle('hidden', !on);
}

function setStatus(msg) {
  const el = document.getElementById('dealer-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

// ── API-key modal ──────────────────────────────────────────────────────────
function showKeyModal(msg) {
  const modal = document.getElementById('apikey-modal');
  const info  = document.getElementById('apikey-modal-info');
  if (msg && info) info.textContent = msg;
  modal.classList.remove('hidden');
  document.getElementById('apikey-input').focus();
}

function hideKeyModal() {
  document.getElementById('apikey-modal').classList.add('hidden');
  document.getElementById('apikey-modal-info').textContent =
    'Get your free API key at fal.ai/dashboard';
}

// ── Gender UI ──────────────────────────────────────────────────────────────
function syncGenderUI(gender) {
  document.querySelectorAll('.dealer-gender-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.gender === gender);
  });
}

// ── Public API (window.DealerBackground) ──────────────────────────────────
window.DealerBackground = {

  /** Called once on page load */
  init() {
    _gender = localStorage.getItem(KEY_GENDER) || 'female';
    syncGenderUI(_gender);
    const hasKey = !!localStorage.getItem(KEY_APIKEY);
    if (hasKey) {
      generate(_gender);
    } else {
      applyFallback();
      showKeyModal();
    }
  },

  /** Called when player clicks Restart (regenerates image) */
  regenerate() {
    generate(_gender);
  },

  /** Called when player switches gender */
  setGender(gender) {
    if (!['female', 'male'].includes(gender)) return;
    _gender = gender;
    localStorage.setItem(KEY_GENDER, gender);
    syncGenderUI(gender);
    generate(gender);
  },
};

// ── DOM wiring (runs after DOMContentLoaded) ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Gender selector buttons
  document.querySelectorAll('.dealer-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.DealerBackground.setGender(btn.dataset.gender);
    });
  });

  // API key modal — Save
  document.getElementById('apikey-save').addEventListener('click', () => {
    const key = document.getElementById('apikey-input').value.trim();
    if (!key) return;
    localStorage.setItem(KEY_APIKEY, key);
    hideKeyModal();
    generate(_gender);
  });

  // API key modal — Enter key
  document.getElementById('apikey-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('apikey-save').click();
  });

  // API key modal — Cancel
  document.getElementById('apikey-cancel').addEventListener('click', () => {
    hideKeyModal();
    applyFallback();
  });

  // Settings cog in header (shows key modal so user can change key)
  const cogBtn = document.getElementById('btn-dealer-settings');
  if (cogBtn) {
    cogBtn.addEventListener('click', () => showKeyModal());
  }

  // Kick off on page load
  window.DealerBackground.init();
});
