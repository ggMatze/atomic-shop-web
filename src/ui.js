// UI module: overlay and gallery logic
import { buildImageUrl } from './utils.js';

// We'll expose functions on window.__ui for legacy script.js to call
function renderGallery(images, current = 0) {
  if (window.__gallery && typeof window.__gallery.renderGallery === 'function') {
    return window.__gallery.renderGallery(images, current);
  }
  // Fallback: basic minimal rendering if gallery module missing
  const mainImage = document.getElementById('main-image');
  if (mainImage && images && images[ current ]) mainImage.src = images[current];
}

function attachTileClickHandlers() {
  const overlay = document.getElementById('item-overlay');
  const tiles = document.querySelectorAll('.shop-tile');

  const decodeHtmlEntities = (str) => {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  };

  const stripScriptTags = (html) => {
    if (!html) return '';
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  };

  const transformShortTags = (html) => {
    if (!html) return '';
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\[#([0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/\#\]/g, function(_, hex, inner) {
      return `<span style="color:#${hex}">${inner}</span>`;
    });
    html = html.replace(/\[([a-zA-Z][\w-]*)\]([\s\S]*?)\[\/\1\]/g, function(_, cls, inner) {
      return `<span class="${cls}">${inner}</span>`;
    });
    return html;
  };

  tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      const currencySelect = document.getElementById('currency-select');
      if (currencySelect) currencySelect.disabled = true;

      // parse item
      let item = null;
      const dataAttr = tile.getAttribute('data-item');
      if (dataAttr) {
        try {
          item = JSON.parse(dataAttr.replace(/&apos;/g, "'"));
        } catch (err) {
          console.error('Failed to parse data-item JSON for tile', err, dataAttr);
        }
      }
      if (!item) item = { title: tile.querySelector('.tile-footer') ? tile.querySelector('.tile-footer').textContent.trim() : 'No title', itemDesc: '', includes: [], storefrontImage: '', images: [] };

      // build images
      let images = [];
      if (Array.isArray(item.images)) images = item.images.slice();
      else if (Array.isArray(item.carouselImages)) images = item.carouselImages.filter(img => img && img.directory && img.imageName).map(img => buildImageUrl(img.directory, img.imageName)).filter(Boolean);
      if (item.primaryImage && item.primaryImage.directory && item.primaryImage.imageName) {
        const primary = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
        if (primary && !images.includes(primary)) images.unshift(primary);
      }
      let storefrontImage = '';
      if (item.storefrontImage) storefrontImage = item.storefrontImage;
      else if (item.primaryImage && item.primaryImage.directory && item.primaryImage.imageName) storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      if (storefrontImage && !images.includes(storefrontImage)) images.unshift(storefrontImage);

      // gallery
      if (window.__gallery && typeof window.__gallery.renderGallery === 'function') window.__gallery.renderGallery(images, 0);
      else renderGallery(images, 0);

      // cleanup keyboard handler when overlay closes
      overlay.addEventListener('transitionend', function cleanup() {
        if (overlay.classList.contains('hidden')) {
          if (window.__gallery && typeof window.__gallery.carouselKeyHandler === 'function') document.removeEventListener('keydown', window.__gallery.carouselKeyHandler);
          else document.removeEventListener('keydown', carouselKeyHandler);
          overlay.removeEventListener('transitionend', cleanup);
        }
      });

      // Description/disclaimer (deterministic split)
      let description = '';
      let disclaimer = '';
      if (item.itemDesc) {
        const normalized = String(item.itemDesc).replace(/\r\n/g, '\n').replace(/\n/g, '\n').replace(/\r\n/g, '\n');
        const splitMatch = normalized.match(/\n{2,}/);
        if (!splitMatch) {
          description = normalized.trim();
        } else {
          const idx = splitMatch.index;
          description = normalized.slice(0, idx).trim();
          const rest = normalized.slice(idx).replace(/^\n+/, '');
          const dashChars = '-\u2010-\u2015–—\u2212';
          const dashStartRe = new RegExp('^[' + dashChars + ']\\s*');
          const dashEndRe = new RegExp('\\s*[' + dashChars + ']\\s*$');
          const rawParas = rest.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
          // Exclude auto-generated 'Includes ...' paragraphs that sometimes end up in the
          // original data but should not be shown in the disclaimer. Also ignore common
          // variants like 'Bundle includes:' (case-insensitive).
          const filteredParas = rawParas.filter(p => !/^(?:Bundle includes:|Bundle includes|Includes)\b/i.test(p));
          const cleanParas = filteredParas.map(p => p.split(/\n+/).map(l => l.replace(/^<br>/i, '').trim()).map(l => l.replace(dashStartRe, '').replace(dashEndRe, '').trim()).filter(Boolean).join('\n')).filter(Boolean);
          disclaimer = cleanParas.join('\n\n').trim();
        }
      }

      // render title
      const titleEl = document.querySelector('.overlay-title');
      if (titleEl) titleEl.textContent = item.title || item.itemName || 'No title';

      // render description
      const descEl = document.querySelector('.overlay-description');
      if (descEl) {
        const decoded = decodeHtmlEntities(description || '');
        const safe = transformShortTags(stripScriptTags(decoded));
        const paras = String(safe).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        descEl.innerHTML = paras.length ? paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') : '';
      }

      // render disclaimer
      const disclaimerEl = document.getElementById('overlay-disclaimer');
      if (disclaimerEl) {
        const decoded = decodeHtmlEntities(disclaimer || '');
        const safe = transformShortTags(stripScriptTags(decoded));
        const parasD = String(safe).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (parasD.length) {
          // For better spacing on short bullet-like lines we split single-newlines
          // inside each disclaimer paragraph into separate <p class="disclaimer-line"> elements
          const inner = parasD.map(p => {
            const sub = p.split(/\n+/).map(s => s.trim()).filter(Boolean);
            return sub.map(line => `<p class="disclaimer-line">${line.replace(/\n/g, '<br>')}</p>`).join('');
          }).join('<div class="disclaimer-paragraph-sep"></div>');
          disclaimerEl.innerHTML = `<div class="disclaimer-header">- DISCLAIMER -</div><div class="disclaimer-text">${inner}</div>`;
        } else {
          disclaimerEl.innerHTML = '';
        }
      }

      // includes
      // includes: render as one-line with inline spans annotated with data-include-index
      const includesEl = document.querySelector('.overlay-includes');
      const includesList = document.querySelector('.overlay-items');
      if (includesList) {
        includesList.innerHTML = '';
        if (item.includes && Array.isArray(item.includes)) item.includes.forEach(inc => { includesList.innerHTML += `<li>${inc}</li>`; });
      }
      if (includesEl) {
        const items = (item.includes && Array.isArray(item.includes)) ? item.includes : (Array.isArray(item.dynamicBundleItems) ? item.dynamicBundleItems.map(x => x.szItemName || '') : []);
        if (items && items.length) {
          const parts = items.map((inc, idx) => `<span class="include-item" data-include-index="${idx}">${inc}</span>`);
          includesEl.innerHTML = 'Includes ' + parts.join(', ');
          overlay._includeListEls = Array.from(includesEl.querySelectorAll('.include-item'));
        } else {
          includesEl.innerHTML = '';
          overlay._includeListEls = [];
        }
      }

      // build mapping from gallery images array -> dynamicBundleItems index
      // so we can highlight by index. We map by exact URL match first, fallback to basename.
      try {
        const carouselImgs = Array.isArray(item.carouselImages) ? item.carouselImages.map(img => buildImageUrl(img.directory, img.imageName)).filter(Boolean) : [];
        const basename = (u) => { if (!u) return ''; const parts = u.split('/'); return parts[parts.length - 1].toLowerCase(); };
        overlay._imageToIncludeIndex = (images || []).map(imgUrl => {
          if (!imgUrl) return null;
          const exact = carouselImgs.indexOf(imgUrl);
          if (exact >= 0) return exact;
          const b = basename(imgUrl);
          for (let j = 0; j < carouselImgs.length; j++) if (basename(carouselImgs[j]) === b) return j;
          return null;
        });
      } catch (e) { overlay._imageToIncludeIndex = []; }

      // highlight updater: toggle .include-highlight on matching include index
      const updateHighlight = () => {
        try {
          const includeEls = overlay._includeListEls || [];
          const mainImg = document.getElementById('main-image');
          let idx = null;
          if (mainImg && mainImg.dataset && typeof mainImg.dataset.galleryIndex !== 'undefined') {
            const v = Number(mainImg.dataset.galleryIndex);
            if (!Number.isNaN(v)) idx = v;
          }
          // if we got a gallery-aligned index, highlight directly
          if (idx != null) {
            includeEls.forEach(el => el.classList.toggle('include-highlight', Number(el.getAttribute('data-include-index')) === idx));
            return;
          }
          // otherwise try mapping via overlay._imageToIncludeIndex using galleryState.current
          if (window.__gallery && window.__gallery._state) {
            const cur = window.__gallery._state.current;
            const map = overlay._imageToIncludeIndex || [];
            const bundleIdx = (typeof map[cur] !== 'undefined') ? map[cur] : null;
            includeEls.forEach(el => el.classList.toggle('include-highlight', Number(el.getAttribute('data-include-index')) === bundleIdx));
          }
        } catch (e) { /* ignore */ }
      };

      // observe main-image src / data changes to update highlight
      const mainImageEl = document.getElementById('main-image');
      if (mainImageEl) {
        if (overlay._mainImageObserver) overlay._mainImageObserver.disconnect();
        overlay._mainImageObserver = new MutationObserver(() => updateHighlight());
        overlay._mainImageObserver.observe(mainImageEl, { attributes: true, attributeFilter: ['src', 'data-gallery-index'] });
        updateHighlight();
      }

      // prices (tile + overlay)
      const atomOriginal = Number(tile.getAttribute('data-atom-original')) || (item.priceOriginal || 0);
      const atomFinal = Number(tile.getAttribute('data-atom-final')) || (item.priceFinal || 0);
      const discount = Number(tile.getAttribute('data-discount')) || (item.discount || 0);
      let cur = 'usd';
      const selectEl = document.getElementById('currency-select');
      if (selectEl) cur = selectEl.value;
      else if (window.__data && typeof window.__data.getSavedCurrency === 'function') { const saved = window.__data.getSavedCurrency(); if (saved) cur = saved; }
      const currencyData = (window.__data && window.__data.currencyData) ? window.__data.currencyData : {};
      const convert = (atomAmount) => { if (cur === 'atoms') return Math.round(atomAmount); const rate = currencyData[cur] ? currencyData[cur].rate : 1; return (atomAmount * rate).toFixed(2); };

      // update overlay price boxes (ids expected by the markup)
      try {
        const priceOrigEl = document.getElementById('price-original');
        const priceDiscEl = document.getElementById('price-discount');
        const priceFinalEl = document.getElementById('price-final');
        const discountAmount = (discount > 0) ? convert(atomOriginal - atomFinal) : 0;
        if (priceOrigEl) priceOrigEl.textContent = atomOriginal > 0 ? convert(atomOriginal) : '0';
        if (priceDiscEl) priceDiscEl.textContent = discountAmount;
        if (priceFinalEl) priceFinalEl.textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);
      } catch (e) { /* ignore overlay missing in some contexts */ }

      // update tile-local price elements to keep grid consistent
      const oldPriceEl = tile.querySelector('.old-price');
      const currentPriceEl = tile.querySelector('.current-price');
      const discountEl = tile.querySelector('.discount');
      if (oldPriceEl) { if (discount > 0) { oldPriceEl.textContent = convert(atomOriginal); oldPriceEl.style.display = ''; } else { oldPriceEl.textContent = ''; oldPriceEl.style.display = 'none'; } }
      if (currentPriceEl) currentPriceEl.textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);
      else { const freeEl = tile.querySelector('.free-badge'); if (freeEl) freeEl.textContent = atomFinal === 0 ? 'FREE' : convert(atomFinal); }
  if (discountEl) { if (discount > 0) { discountEl.textContent = `${discount}%`; discountEl.style.display = ''; } else { discountEl.textContent = ''; discountEl.style.display = 'none'; } }

      // share button
      const shareBtn = document.getElementById('overlay-link-btn');
      const shareBox = document.getElementById('overlay-link-box');
      if (shareBtn && shareBox) {
        shareBox.style.display = 'none';
        shareBtn.onclick = function(e) {
          e.stopPropagation();
          let tab = document.querySelector('.tab-nav-scroll .tab.active');
          let tabIndex = tab ? tab.getAttribute('data-tab-index') : '0';
          let tabId = tab ? tab.getAttribute('data-tab-id') : null;
          let tabParam;
          if (tabIndex === 'preview') tabParam = 'preview';
          else if (tabId) tabParam = tabId;
          else tabParam = isNaN(Number(tabIndex)) ? tabIndex : Number(tabIndex) + 1;
          let url = `${window.location.origin}${window.location.pathname}?tab=${tabParam}&item=${item.itemID}`;
          shareBox.value = url; shareBox.style.display = ''; shareBox.focus(); shareBox.select(); try { document.execCommand('copy'); } catch (e) {}
        };
        shareBox.onblur = function() { shareBox.style.display = 'none'; };
        overlay.onclick = function(e) { if (e.target !== shareBox && e.target !== shareBtn) { shareBox.style.display = 'none'; } };
      }

      // expired/disabled
      const overlayMsg = document.getElementById('overlay-expired-msg'); if (overlayMsg) overlayMsg.remove();
      if (item.disabled || item.expired) { const msg = document.createElement('div'); msg.id = 'overlay-expired-msg'; msg.className = 'overlay-expired-msg'; msg.textContent = 'This deal expired and cannot be purchased in the game anymore.'; overlay.appendChild(msg); }
    });
  });
}

// carouselKeyHandler fallback (delegates to gallery module when available)
function carouselKeyHandler(e) {
  if (window.__gallery && typeof window.__gallery.carouselKeyHandler === 'function') {
    return window.__gallery.carouselKeyHandler(e);
  }
  const overlayElem = document.getElementById('item-overlay');
  if (!overlayElem || overlayElem.classList.contains('hidden')) return;
  // minimal fallback: try to move main image src if left/right clicked (not robust)
}

// Expose API
if (typeof window !== 'undefined') {
  window.__ui = window.__ui || {};
  window.__ui.renderGallery = renderGallery;
  window.__ui.attachTileClickHandlers = attachTileClickHandlers;
  window.__ui.carouselKeyHandler = carouselKeyHandler;
}

export { renderGallery, attachTileClickHandlers, carouselKeyHandler };

// Tile badge / price updater
function updateTilePrices() {
  const select = document.getElementById('currency-select');
  let cur = 'usd';
  if (select) cur = select.value;
  else if (window.__data && typeof window.__data.getSavedCurrency === 'function') {
    const saved = window.__data.getSavedCurrency();
    if (saved) cur = saved;
  }
  const currencyData = (window.__data && window.__data.currencyData) ? window.__data.currencyData : {};

  document.querySelectorAll('.shop-tile').forEach(tile => {
    const atomOriginal = Number(tile.getAttribute('data-atom-original')) || 0;
    const atomFinal = Number(tile.getAttribute('data-atom-final')) || 0;
    const discount = Number(tile.getAttribute('data-discount')) || 0;

    const convert = (atomAmount) => {
      if (cur === 'atoms') return Math.round(atomAmount);
      const rate = currencyData[cur] ? currencyData[cur].rate : 1;
      return (atomAmount * rate).toFixed(2);
    };

    const oldPriceEl = tile.querySelector('.old-price');
    const currentPriceEl = tile.querySelector('.current-price');
    const discountEl = tile.querySelector('.discount');

    if (oldPriceEl) {
      if (discount > 0) {
        oldPriceEl.textContent = convert(atomOriginal);
        oldPriceEl.style.display = '';
      } else {
        oldPriceEl.textContent = '';
        oldPriceEl.style.display = 'none';
      }
    }

    // Update current price (handle both .current-price and .free-badge cases)
    if (currentPriceEl) {
      currentPriceEl.textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);
    } else {
      // If current-price element is missing (e.g. free-badge used), update free-badge if present
      const freeEl = tile.querySelector('.free-badge');
      if (freeEl) freeEl.textContent = atomFinal === 0 ? 'FREE' : convert(atomFinal);
    }

    // Show discount badge only if there is a discount (prefix with '-')
    if (discountEl) {
      if (discount > 0) {
        discountEl.textContent = `${discount}%`;
        discountEl.style.display = '';
      } else {
        discountEl.textContent = '';
        discountEl.style.display = 'none';
      }
    }
  });
}

if (typeof window !== 'undefined') {
  window.__ui = window.__ui || {};
  window.__ui.updateTilePrices = updateTilePrices;
}
