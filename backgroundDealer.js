'use strict';

// ── backgroundDealer.js ────────────────────────────────────────────────────
// Handles dealer background using local image assets.
// Completely independent from game logic — communicates only via
// window.DealerBackground public API.
// ──────────────────────────────────────────────────────────────────────────

const KEY_GENDER   = 'spider_dealer_gender';
const IMAGE_COUNT  = 5;
const IMAGE_BASE   = 'public/images/';

// ── Internal state ─────────────────────────────────────────────────────────
let _gender = localStorage.getItem(KEY_GENDER) || 'female';

// Track last-used index per gender to avoid consecutive repeats
const _lastIdx = { female: -1, male: -1 };

// ── Image selection ────────────────────────────────────────────────────────
function pickImage(gender) {
  let idx;
  do {
    idx = Math.floor(Math.random() * IMAGE_COUNT) + 1;
  } while (idx === _lastIdx[gender] && IMAGE_COUNT > 1);
  _lastIdx[gender] = idx;
  return `${IMAGE_BASE}${gender}-${idx}.jpg`;
}

// ── Background application ─────────────────────────────────────────────────
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
    applyBackground(pickImage(_gender));
  },

  /** Called when player clicks Restart */
  regenerate() {
    applyBackground(pickImage(_gender));
  },

  /** Called when player switches gender */
  setGender(gender) {
    if (!['female', 'male'].includes(gender)) return;
    _gender = gender;
    localStorage.setItem(KEY_GENDER, gender);
    syncGenderUI(gender);
    applyBackground(pickImage(gender));
  },
};

// ── DOM wiring ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Gender selector buttons
  document.querySelectorAll('.dealer-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.DealerBackground.setGender(btn.dataset.gender);
    });
  });

  // Kick off on page load
  window.DealerBackground.init();
});
