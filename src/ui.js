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
  tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      document.getElementById('currency-select').disabled = true;
      let item = null;
      const dataAttr = tile.getAttribute('data-item');
      if (dataAttr) {
        try {
          item = JSON.parse(dataAttr.replace(/&apos;/g, "'"));
        } catch (err) {
          console.error('Failed to parse data-item JSON for tile', err, dataAttr);
        }
      }
      // Fallback minimal item if parsing failed
      if (!item) {
        item = {
          title: tile.querySelector('.tile-footer') ? tile.querySelector('.tile-footer').textContent.trim() : 'No title',
          itemDesc: '',
          includes: [],
          storefrontImage: '',
          images: []
        };
      }

      // Build images array
      let images = [];
      if (Array.isArray(item.images)) {
        images = item.images.slice();
      } else if (Array.isArray(item.carouselImages)) {
        images = item.carouselImages
          .filter(img => img && img.directory && img.imageName)
          .map(img => buildImageUrl(img.directory, img.imageName))
          .filter(Boolean);
      }

      if (item.primaryImage && item.primaryImage.directory && item.primaryImage.imageName) {
        const primaryImgUrl = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
        if (primaryImgUrl && !images.includes(primaryImgUrl)) images.unshift(primaryImgUrl);
      }

      let storefrontImage = '';
      if (item.storefrontImage) storefrontImage = item.storefrontImage;
      else if (item.primaryImage && item.primaryImage.directory && item.primaryImage.imageName) {
        storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      }
      if (storefrontImage && !images.includes(storefrontImage)) images.unshift(storefrontImage);

      // Delegate gallery rendering to gallery module
      if (window.__gallery && typeof window.__gallery.renderGallery === 'function') {
        window.__gallery.renderGallery(images, 0);
      } else {
        renderGallery(images, 0);
      }

      // Cleanup keyboard when overlay closes
      overlay.addEventListener('transitionend', function cleanup() {
        if (overlay.classList.contains('hidden')) {
          if (window.__gallery && typeof window.__gallery.carouselKeyHandler === 'function') {
            document.removeEventListener('keydown', window.__gallery.carouselKeyHandler);
          } else {
            document.removeEventListener('keydown', carouselKeyHandler);
          }
          overlay.removeEventListener('transitionend', cleanup);
        }
      });

      // Description / disclaimer
      let description = '';
      let disclaimer = '';
      if (item.itemDesc) {
        // Normalize escaped newlines and preserve paragraphs
        const normalized = String(item.itemDesc)
          .replace(/\\r\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\r\n/g, '\n');

        // Split into paragraphs on two+ newlines, then keep single newlines as <br>
        const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length === 0) {
          description = '';
        } else if (paragraphs.length === 1) {
          description = paragraphs[0];
        } else {
          // Heuristic: last paragraph(s) that begin with '-' are disclaimers
          let pDisclaimer = [];
          let pDesc = [];
          for (let p of paragraphs) {
            if (p.trim().startsWith('-')) pDisclaimer.push(p.trim());
            else pDesc.push(p);
          }
          description = pDesc.join('\n\n').trim();
          disclaimer = pDisclaimer.join('\n\n').trim();
        }
      }

      // Title: prefer explicit item.title, fall back to itemName
      document.querySelector('.overlay-title').textContent = item.title || item.itemName || 'No title';
      // Render description: allow simple HTML tags (e.g. <strong>, <b>, <a>, <span class=...>)
      // Strategy: decode HTML entities (in case the JSON was escaped), remove script tags,
      // then convert paragraphs to <p>..</p> and single newlines to <br>.
      const descEl = document.querySelector('.overlay-description');
      const disclaimerEl = document.getElementById('overlay-disclaimer');

      function decodeHtmlEntities(str) {
        if (!str) return '';
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
      }

      function stripScriptTags(html) {
        if (!html) return '';
        // remove any <script>...</script> blocks (basic but effective for our trusted sources)
        return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
      }

      // Transform short custom tags into HTML:
      // - [name]...[/name] => <span class="name">...</span>
      // - [#rrggbb]...[/#] => <span style="color:#rrggbb">...</span>
      // - **bold** => <strong>bold</strong>
      function transformShortTags(html) {
        if (!html) return '';
        // **bold** -> <strong>
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // [#hex]...[/#] -> inline color
        html = html.replace(/\[#([0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/\#\]/g, function(_, hex, inner) {
          return `<span style="color:#${hex}">${inner}</span>`;
        });
        // [name]...[/name] -> class-based span (allow letters, numbers, -, _)
        html = html.replace(/\[([a-zA-Z][\w-]*)\]([\s\S]*?)\[\/\1\]/g, function(_, cls, inner) {
          return `<span class="${cls}">${inner}</span>`;
        });
        return html;
      }

  const decodedDesc = decodeHtmlEntities(description || '');
  const safeDesc = transformShortTags(stripScriptTags(decodedDesc));
      if (descEl) {
        const paras = String(safeDesc).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (paras.length === 0) descEl.innerHTML = '';
        else descEl.innerHTML = paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      }

      if (disclaimerEl) {
  const decodedDis = decodeHtmlEntities(disclaimer || '');
  const safeDis = transformShortTags(stripScriptTags(decodedDis));
        const parasD = String(safeDis).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        disclaimerEl.innerHTML = parasD.length ? `<div class="disclaimer-header">- DISCLAIMER -</div><div class="disclaimer-text">${parasD.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : '';
      }

      if (item.includes && Array.isArray(item.includes) && item.includes.length > 0) {
        document.querySelector('.overlay-includes').textContent = 'Includes ' + item.includes.join(', ');
      } else {
        document.querySelector('.overlay-includes').textContent = '';
      }
      const includesList = document.querySelector('.overlay-items');
      if (includesList) {
        includesList.innerHTML = '';
        if (item.includes && Array.isArray(item.includes)) item.includes.forEach(inc => { includesList.innerHTML += `<li>${inc}</li>`; });
      }

      // Prices
      const atomOriginal = Number(tile.getAttribute('data-atom-original')) || 0;
      const atomFinal = Number(tile.getAttribute('data-atom-final')) || 0;
      const discount = Number(tile.getAttribute('data-discount')) || 0;
      // Robust currency lookup: prefer the selector value, otherwise saved currency, else 'usd'
      const selectEl = document.getElementById('currency-select');
      let cur = 'usd';
      if (selectEl) cur = selectEl.value;
      else if (window.__data && typeof window.__data.getSavedCurrency === 'function') {
        const saved = window.__data.getSavedCurrency(); if (saved) cur = saved;
      }
      const currencyData = (window.__data && window.__data.currencyData) ? window.__data.currencyData : {};
      const convert = (atomAmount) => {
        if (cur === 'atoms') return Math.round(atomAmount);
        const rate = currencyData[cur] ? currencyData[cur].rate : 1;
        return (atomAmount * rate).toFixed(2);
      };
      document.getElementById('price-original').textContent = convert(atomOriginal);
      document.getElementById('price-final').textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);
      const discountAmount = discount > 0 ? convert(atomOriginal - atomFinal) : 0;
      document.getElementById('price-discount').textContent = discountAmount;

      // Share button
      const shareBtn = document.getElementById('overlay-link-btn');
      const shareBox = document.getElementById('overlay-link-box');
      if (shareBtn && shareBox) {
        shareBox.style.display = 'none';
        shareBtn.onclick = function(e) {
          e.stopPropagation();
          let tab = document.querySelector('.tab-nav-scroll .tab.active');
          let tabIndex = tab ? tab.getAttribute('data-tab-index') : '0';
          let tabParam = tabIndex === 'preview' ? 'preview' : (isNaN(Number(tabIndex)) ? tabIndex : Number(tabIndex) + 1);
          let url = `${window.location.origin}${window.location.pathname}?tab=${tabParam}&item=${item.itemID}`;
          shareBox.value = url; shareBox.style.display = ''; shareBox.focus(); shareBox.select(); try { document.execCommand('copy'); } catch (e) {}
        };
        shareBox.onblur = function() { shareBox.style.display = 'none'; };
        overlay.onclick = function(e) { if (e.target !== shareBox && e.target !== shareBtn) { shareBox.style.display = 'none'; } };
      }

      // Expired/disabled message
      const overlayMsg = document.getElementById('overlay-expired-msg');
      if (overlayMsg) overlayMsg.remove();
      if (item.disabled || item.expired) {
        const msg = document.createElement('div');
        msg.id = 'overlay-expired-msg';
        msg.className = 'overlay-expired-msg';
        msg.textContent = 'This deal expired and cannot be purchased in the game anymore.';
        overlay.appendChild(msg);
      }
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
        discountEl.textContent = `${discount}`;
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
