/*
  script.js — Legacy orchestrator / bootstrap

  Purpose: keep this file minimal. It wires up the page on DOMContentLoaded
  and provides thin delegators to the modularized implementations under
  `src/` which expose APIs on window.__tabs, window.__ui, window.__overlay, etc.

  Do not add feature logic here — move behavior into the appropriate module
  (tabs, ui, overlay, gallery, utils, audio, dataLoader). Comments are kept
  minimal to make the orchestrator's role clear.
*/

const overlay = document.getElementById('item-overlay');

// Gallery globals (kept for backwards compatibility; gallery module should own these)
let galleryImages = [];
let galleryCurrent = 0;
let shopGrid;

// Delegators to modular implementations (provide safe fallbacks)
function attachTileClickHandlers() {
  if (window.__ui && window.__ui.attachTileClickHandlers) {
    window.__ui.attachTileClickHandlers();
    return;
  }
  console.warn('attachTileClickHandlers: window.__ui.attachTileClickHandlers not available');
}

function renderGallery(images, current = 0) {
  if (window.__ui && window.__ui.renderGallery) return window.__ui.renderGallery(images, current);
  console.warn('renderGallery: window.__ui.renderGallery not available');
}

function carouselKeyHandler(e) {
  if (window.__ui && window.__ui.carouselKeyHandler) return window.__ui.carouselKeyHandler(e);
}

document.addEventListener('DOMContentLoaded', function() {
  if (window.__tabs && typeof window.__tabs.initTabs === 'function') {
    try { window.__tabs.initTabs(); } catch (e) { console.error('Error initializing tabs:', e); }
  } else {
    console.warn('Tabs module not available: window.__tabs.initTabs');
  }
  // Initialize currency selector from data module
  try {
    const select = document.getElementById('currency-select');
    if (window.__data && select) {
      const saved = window.__data.getSavedCurrency();
      const cur = saved || (select.value || 'usd');
      select.value = cur;
      document.body.classList.add(cur + '-currency');
      select.addEventListener('change', function(e) {
        // update body class
        document.body.className = document.body.className
          .split(' ')
          .filter(c => !c.endsWith('-currency'))
          .join(' ');
        const newCur = e.target.value;
        document.body.classList.add(newCur + '-currency');
        if (window.__data && typeof window.__data.saveCurrency === 'function') window.__data.saveCurrency(newCur);
        // update visible prices
        try { if (window.__ui && typeof window.__ui.updateTilePrices === 'function') window.__ui.updateTilePrices(); } catch (err) { console.error('updateTilePrices failed', err); }
      });
    }
  } catch (err) { console.error('currency init error', err); }

  // Start timer updates (from utils)
  try { if (window.__utils && typeof window.__utils.startTimerUpdates === 'function') window.__utils.startTimerUpdates(); } catch (err) { console.error('startTimerUpdates failed', err); }
});

// Function to render the custom daily tab — delegate to tabs module if available
function renderCustomDailyTab() {
  if (window.__tabs && typeof window.__tabs.renderCustomDailyTab === 'function') {
    try { window.__tabs.renderCustomDailyTab(); } catch (e) { console.error('renderCustomDailyTab failed', e); }
    return;
  }

  // Fallback: if tabs module missing, try to initialize tabs which will render the preview tab
  if (window.__tabs && typeof window.__tabs.initTabs === 'function') {
    try { window.__tabs.initTabs(); } catch (e) { console.error('initTabs fallback failed', e); }
  }
}
// Add this function to render the date range
function renderDateRange(item) {
  const startDate = item.startTime ? new Date(item.startTime) : null;
  const endDate = item.endTime ? new Date(item.endTime) : null;
  const dateLabel = (startDate && endDate)
    ? `<div class="tile-dates">${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &ndash;<br> ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>`
    : '';

  return dateLabel;
}

// Currency data and persistence are provided by src/data.js (window.__data)
// Timer helpers are provided by src/utils.js (window.__utils)

// Timer functions are in window.__utils: startTimerUpdates() is started on DOMContentLoaded below

document.addEventListener("keydown", function(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  // ...existing code...
});

// Tab keyboard/scroll behavior moved into src/tabs.js (initTabKeyHandlers)

let current = 0;
const mainImage = document.getElementById("main-image");
const leftStrip = document.getElementById("left-strip");
const rightStrip = document.getElementById("right-strip");

// Keyboard-Handler for overlay/gallery: delegate to the UI module
document.addEventListener('keydown', function(e) {
  // Only handle when overlay is open
  if (overlay.classList.contains('hidden')) return;

  // If the UI module provides a carouselKeyHandler, delegate to it
  if (window.__ui && typeof window.__ui.carouselKeyHandler === 'function') {
    try {
      window.__ui.carouselKeyHandler(e);
      // Prevent default for A/D navigation to avoid accidental page actions
      if (e.key && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd')) e.preventDefault();
    } catch (err) {
      console.error('Error in carouselKeyHandler:', err);
    }
    return;
  }

  // Fallback: if UI module not available, try using legacy gallery globals
  if (!galleryImages || !galleryImages.length) return;
  if (e.key && e.key.toLowerCase() === 'a' && galleryCurrent > 0) {
    galleryCurrent--;
    renderGallery(galleryImages, galleryCurrent);
  }
  if (e.key && e.key.toLowerCase() === 'd' && galleryCurrent < galleryImages.length - 1) {
    galleryCurrent++;
    renderGallery(galleryImages, galleryCurrent);
  }
});

// Delegate gallery rendering to gallery module
function renderGallery(images, current = 0) {
  if (window.__gallery && typeof window.__gallery.renderGallery === 'function') {
    try { window.__gallery.renderGallery(images, current); } catch (e) { console.error('gallery.renderGallery failed', e); }
    return;
  }
  // fallback: no-op
}

// Image URL builder moved to src/utils.js — tabs/ui call that helper now.

// Function to update prices on all tiles based on currentCurrency
// Delegate tile price updates to UI module
if (window.__ui && typeof window.__ui.updateTilePrices === 'function') {
  try { window.__ui.updateTilePrices(); } catch (e) { console.error('updateTilePrices failed', e); }
}

// Audio controls moved to src/audio.js (exposed as window.__audio.initAudio)
document.addEventListener('DOMContentLoaded', function() {
  if (window.__audio && typeof window.__audio.initAudio === 'function') {
    try { window.__audio.initAudio(); } catch (e) { console.error('initAudio failed', e); }
  }
});

function getActiveReplacement(itemID) {
  if (window.__tabs && typeof window.__tabs.getActiveReplacement === 'function') {
    return window.__tabs.getActiveReplacement(itemID);
  }
  // Fallback: minimal local behavior (avoid breaking if module missing)
  const now = simulatedNow ? simulatedNow.getTime() : Date.now();
  const candidates = (window.dailyReplacements || []).filter(r => r.replaceItemID === itemID);
  return candidates[0] || null;
}

function getActivePaidSale(itemID) {
  if (window.__tabs && typeof window.__tabs.getActivePaidSale === 'function') {
    return window.__tabs.getActivePaidSale(itemID);
  }
  // Fallback: minimal local behavior
  let candidates = [];
  Object.values(window.dailySalesByWeek || {}).forEach(weekArr => {
    candidates = candidates.concat(weekArr.filter(r => r.replaceItemID === itemID));
  });
  return candidates[0] || null;
}

// Overlay-related handlers are now provided by src/overlay.js and exposed as window.__overlay
if (window.__overlay && typeof window.__overlay.initOverlay === 'function') {
  try { window.__overlay.initOverlay(); } catch (e) { console.error('initOverlay error', e); }
}

if (window.__overlay && typeof window.__overlay.showNewsNotice === 'function') {
  document.addEventListener('DOMContentLoaded', function() { try { window.__overlay.showNewsNotice(); } catch (e) {} });
}

let simulatedNow = null; // Set this to a Date object to simulate, or null for real time
//simulatedNow = new Date('2025-07-31T23:05:30.000Z');

document.addEventListener("DOMContentLoaded", showNewsNotice);

function isLtoExpired(item) {
  // Only treat as expired if isLto is true AND ltoTimer is a valid date string in the past
  if (!item.lowPrice || !item.lowPrice.isLto) return false;
  const ltoTimer = item.lowPrice.ltoTimer;
  if (typeof ltoTimer !== 'string' || isNaN(Date.parse(ltoTimer))) return false;
  return new Date(ltoTimer) < new Date();
}


// Place this helper at the bottom of your script, outside of any other function
// At the end of renderTab and renderCustomDailyTab, after all tiles are rendered:
attachTileClickHandlers();
try { if (window.__ui && typeof window.__ui.updateTilePrices === 'function') window.__ui.updateTilePrices(); } catch (e) { console.error('updateTilePrices failed', e); }
if (window.__overlay && typeof window.__overlay.hideLoadingOverlayWhenReady === 'function') window.__overlay.hideLoadingOverlayWhenReady();
if (window.__overlay && typeof window.__overlay.openOverlayFromUrlIfNeeded === 'function') window.__overlay.openOverlayFromUrlIfNeeded();
