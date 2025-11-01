import { buildImageUrl, renderTimerHTML, renderDateRange } from './utils.js';

async function initTabs() {
  const shopGrid = document.querySelector('.shop-grid');
  const tabNavScroll = document.querySelector('.tab-nav-scroll');
  if (!tabNavScroll || !shopGrid) return;

  // Horizontal wheel behavior for tabs (rate-limited)
  let tabScrollWheelCooldown = false;
  tabNavScroll.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (tabScrollWheelCooldown) return;
    tabScrollWheelCooldown = true;
    setTimeout(() => { tabScrollWheelCooldown = false; }, 180);

    const tabs = tabNavScroll.querySelectorAll('.tab');
    let activeIdx = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
    const tabWidth = tabs[activeIdx] ? tabs[activeIdx].offsetWidth + 10 : 270;
    if (e.deltaY > 0) tabNavScroll.scrollLeft += tabWidth;
    else if (e.deltaY < 0) tabNavScroll.scrollLeft -= tabWidth;
  }, { passive: false });

  // Load data from centralized loader
  const { dailyReplacementsData = {}, storeData = {} } = (window.__dataLoader && window.__dataLoader.loadDailyAndStore)
    ? await window.__dataLoader.loadDailyAndStore()
    : { dailyReplacementsData: {}, storeData: {} };
  window.dailyReplacements = dailyReplacementsData.DailyReplacements || [];
  // Also expose Fallout First replacements if present
  window.dailyReplacements1st = dailyReplacementsData.DailyReplacements1st || [];
  window.dailySalesByWeek = dailyReplacementsData.DailySalesByWeek || {};
  window.dailySalesWeekMeta = dailyReplacementsData.DailySalesWeekMeta || {};

  const pages = (storeData.StorePageData && storeData.StorePageData.pages) || [];

  // Render tabs
  tabNavScroll.innerHTML = '';
  pages.forEach((page, idx) => {
    // Normalize both actual newlines and escaped "\\n" sequences coming from JSON
    const rawName = (page.name || '')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    const nameParts = rawName.split('\n').map(p => p.trim()).filter(Boolean);
    const title = nameParts[0] || '';
    const subtitle = nameParts.slice(1).join(' ') || '';
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab';
    tabDiv.setAttribute('data-tab-index', idx);

    const tabImg = (page.image?.imageName && page.image?.directory
      ? buildImageUrl(page.image.directory, page.image.imageName)
      : '') || page.image?.assocMediaPayload?.url || '';

    tabDiv.innerHTML = `
      <img src="${tabImg}" alt="${title}">
      <div class="tab-label">
        <div class="tab-title">${title || ''}</div>
        <div class="tab-subtitle">${subtitle || ''}</div>
      </div>
    `;
    tabNavScroll.appendChild(tabDiv);
  });

  const showDailyTab = !!dailyReplacementsData.showDailyTab;
  if (showDailyTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab';
    tabDiv.setAttribute('data-tab-index', 'preview');
    tabDiv.innerHTML = `
      <img src="media/tabs/week.webp" alt="Daily">
      <div class="tab-label">
        <div class="tab-title">Preview</div>
        <div class="tab-subtitle">The upcoming daily offers</div>
      </div>
    `;
    tabNavScroll.appendChild(tabDiv);
  }

  function convert(atomAmount) {
    const select = document.getElementById('currency-select');
    let cur = 'usd';
    if (select) cur = select.value;
    else if (window.__data && typeof window.__data.getSavedCurrency === 'function') {
      const saved = window.__data.getSavedCurrency();
      if (saved) cur = saved;
    }
    if (cur === 'atoms') return Math.round(atomAmount);
    const rate = (window.__data && window.__data.currencyData && window.__data.currencyData[cur]) ? window.__data.currencyData[cur].rate : 1;
    return (atomAmount * rate).toFixed(2);
  }

  // Compute tile sizes for a page's items while respecting explicit overrides.
  // Will demote non-forced 'large' tiles to 'small' if needed to keep rows <= 3 on a 6-column grid.
  function computeTileSizes(items, options = {}) {
    const COLS = 6;
    if (!Array.isArray(items)) return [];
    const forced = items.map(it => (it && typeof it.tileSize === 'string') ? it.tileSize.toLowerCase() : null);

    // options: { defaultTile: 'large'|'small', initialLargeCount: number }
  // Default to 'small' unless explicitly requested 'large' via options
  const defaultTile = options.defaultTile === 'large' ? 'large' : 'small';
    const initialLargeCount = typeof options.initialLargeCount === 'number' ? options.initialLargeCount : 3;

    // start with explicit or default sizes
    const sizes = items.map((it, idx) => {
      const f = forced[idx];
      if (f === 'small' || f === 'large') return f;
      if (defaultTile === 'small') return 'small';
      return idx < initialLargeCount ? 'large' : 'small';
    });

    // Simulator that places tiles into a grid of COLS columns and arbitrary rows.
    // Large tiles occupy a 2x2 block (span 2 columns x span 2 rows). Small occupy 1x1.
    function simulateRows(sArr) {
      const grid = [];
      const ensureRows = (n) => { while (grid.length < n) grid.push(new Array(COLS).fill(false)); };

      const placeSmall = () => {
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!grid[r][c]) { grid[r][c] = true; return { r, c }; }
          }
        }
        // need a new row
        ensureRows(grid.length + 1);
        grid[grid.length - 1][0] = true;
        return { r: grid.length - 1, c: 0 };
      };

      const placeLarge = () => {
        // try existing rows first
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c <= COLS - 2; c++) {
            ensureRows(r + 2);
            if (!grid[r][c] && !grid[r][c + 1] && !grid[r + 1][c] && !grid[r + 1][c + 1]) {
              grid[r][c] = grid[r][c + 1] = grid[r + 1][c] = grid[r + 1][c + 1] = true;
              return { r, c };
            }
          }
        }
        // append two rows and place at first columns
        ensureRows(grid.length + 2);
        const rr = grid.length - 2;
        grid[rr][0] = grid[rr][1] = grid[rr + 1][0] = grid[rr + 1][1] = true;
        return { r: rr, c: 0 };
      };

      for (let s of sArr) {
        if (s === 'large') placeLarge(); else placeSmall();
      }

      // compute used rows (last row index that contains any true)
      let last = -1;
      for (let r = grid.length - 1; r >= 0; r--) {
        if (grid[r].some(v => v)) { last = r; break; }
      }
      return last + 1; // rows count
    }

  let rows = simulateRows(sizes);
    if (rows <= 3) return sizes;

    // Demote non-forced large tiles (prefer later items first) until rows <= 3 or none left
    while (rows > 3) {
      let demoted = false;
      for (let i = items.length - 1; i >= 0; i--) {
        if (!forced[i] && sizes[i] === 'large') {
          sizes[i] = 'small';
          demoted = true;
          break;
        }
      }
      if (!demoted) break;
      rows = simulateRows(sizes);
    }

    return sizes;
  }

  // Build the HTML for a single tile. Centralized so main and preview rendering match.
  function buildTileHTML(item, tileSize, idx, options = {}) {
    const tileDisabled = (item && (item.disabled === true)) ? 'tile-disabled' : '';

    // Price resolution (improved): prefer lowPrice.amount (LTO) when present,
    // then lowestPurchasablePrice (both "Amount" and "amount" variants),
    // finally fall back to highPrice/originalAmount.
    const lp = item?.lowPrice;
    const lowest = item?.lowestPurchasablePrice;
    const high = item?.highPrice;

    // atom values (store uses various casing across datasets)
    const lowAmount = (lp && typeof lp.amount === 'number') ? lp.amount : 0;
    const lowIsLto = !!(lp && lp.isLto);
    const lowestAmount = (lowest && (typeof lowest.Amount === 'number')) ? lowest.Amount : ((lowest && typeof lowest.amount === 'number') ? lowest.amount : 0);
    const highOriginal = (high && (typeof high.originalAmount === 'number')) ? high.originalAmount : ((high && typeof high.amount === 'number') ? high.amount : 0);

    let atomPriceFinal = 0;
    let atomPriceOriginal = highOriginal || 0;
    // priority: lowPrice.amount (if >0) -> lowestPurchasablePrice -> highOriginal
    if (lowAmount > 0) atomPriceFinal = lowAmount;
    else if (lowestAmount > 0) atomPriceFinal = lowestAmount;
    else atomPriceFinal = atomPriceOriginal;

    // Compute discount and display prices (original vs final)
    let priceFinal = atomPriceFinal;
    let priceOriginal = atomPriceOriginal;
    let discount = 0;
    if (priceOriginal > 0 && priceFinal > 0 && priceOriginal > priceFinal) {
      discount = Math.round(100 - (priceFinal / priceOriginal) * 100);
    }

    // Image selection: prefer primaryImage, then carousel, then other shapes
    let storefrontImage = '';
    if (item?.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
      storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
    } else if (item?.image && item.image.imageName && item.image.directory) {
      storefrontImage = buildImageUrl(item.image.directory, item.image.imageName);
    } else if (item?.carouselImages && item.carouselImages.length) {
      const first = item.carouselImages[0];
      if (first?.imageName && first?.directory) storefrontImage = buildImageUrl(first.directory, first.imageName);
    }
    const storefrontImageSrc = storefrontImage || '';

    const images = (item?.carouselImages || []).map(img => (img?.directory && img?.imageName) ? buildImageUrl(img.directory, img.imageName) : null).filter(Boolean);

    const currentPriceHTML = atomPriceFinal === 0
      ? `<span class="free-badge">FREE</span>`
      : `<span class="current-price">${convert(atomPriceFinal)}</span>`;

    const newLabel = (item?.isNew === 1 || item?.isNew === true) ? '<span class="new-label">NEW</span>' : '';

    // For preview pages (options.useEndTime === true) show a date-range label.
    // For normal tabs show a limited-time timer if the item has an LTO (lowPrice.ltoTimer).
    let expiresHTML = '';
    if (options && options.useEndTime) {
      expiresHTML = renderDateRange(item);
    } else if (item?.lowPrice?.isLto && item?.lowPrice?.ltoTimer) {
      expiresHTML = renderTimerHTML(item.lowPrice.ltoTimer);
    }

    const dataItem = {
      title: item?.itemName,
      itemDesc: item?.itemDesc,
      includes: (item?.dynamicBundleItems || []).map(i => i.szItemName),
      storefrontImage,
      images,
      priceOriginal: priceOriginal,
      priceFinal: priceFinal,
      discount,
      isNew: !!item?.isNew,
      isZeus: !!item?.isZeus,
      isClown: !!item?.isClown,
      disabled: !!item?.disabled,
      itemID: item?.itemID,
      expired: !!(item?.endTime && !isNaN(Date.parse(item.endTime)) && new Date(item.endTime) < new Date())
    };

    const dataItemStr = JSON.stringify(dataItem).replace(/'/g, "&apos;");

    return `
      <div class="shop-tile ${tileSize} ${tileDisabled}"
           data-item='${dataItemStr}'
           data-atom-original="${priceOriginal}"
           data-atom-final="${priceFinal}"
           data-discount="${discount}">
        <div class="tile-img">
          <img src="${storefrontImageSrc}" alt="${(item && item.itemName) || ''}" onerror="if(!this.src.endsWith('_l.webp')){this.src=this.src.replace('.webp','_l.webp');}else{this.onerror=null;}" />
        </div>
        <div class="tile-badge">
          <span class="discount"></span>
          ${newLabel}
        </div>
        <div class="tile-badge-r">
          <span class="tile-1st hidden">&nbsp;</span>
          <span class="clown-label hidden" title="Bethesda made a fool of themselves again!">&nbsp;</span>
        </div>
        <div class="tile-price">
          <span class="old-price"></span>
          ${currentPriceHTML}
        </div>
  ${expiresHTML}
        <div class="tile-footer ${tileSize}">${tileSize === 'large' ? ((item && item.itemName) || '') : ((item && item.itemNameShort) || (item && item.itemName) || '')}</div>
      </div>
    `;
  }

  function renderTab(tabIdx) {
    const page = pages[tabIdx];
    if (!page) return;

    // Dev trace: number of items for this tab
    try { console.debug('[renderTab] rendering tab', { tabIdx, title: page.name, itemCount: (page.items || []).length }); } catch (e) {}

    // Handle SPECIAL replacements dynamically
    // If the page is the S.P.E.C.I.A.L tab, allow replacements for any itemID that matches
    if (page.name && page.name.includes('S.P.E.C.I.A.L')) {
      // Helper to find replacement candidates for an itemID from both paid sales and free replacements
      function findReplacementCandidate(itemID) {
        // First check paid sales (weekly collections)
        const paid = window.getActivePaidSale ? window.getActivePaidSale(itemID) : null;
        if (paid) return paid;
        // Next check free replacements list
        const free = window.getActiveReplacement ? window.getActiveReplacement(itemID) : null;
        if (free) return free;
        // No active replacement found
        return null;
      }

      // For each item slot on the page, if the itemID has replacement candidates in the datasets
      // then either substitute the active replacement or remove the slot if candidates exist but none active.
      // We'll consult the raw candidate pools to know whether candidates exist at all.
      const hasPaidCandidatesFor = (id) => {
        // search all weekly sales for candidates
        const allPaid = Object.values(window.dailySalesByWeek || {}).flat();
        const idNum = Number(id);
        return allPaid.some(r => Number(r.replaceItemID) === idNum);
      };
      const hasFreeCandidatesFor = (id) => {
        const idNum = Number(id);
        const pool = (window.dailyReplacements || []).concat(window.dailyReplacements1st || []);
        return pool.some(r => Number(r.replaceItemID) === idNum);
      };

      // Walk items and build a new array to replace page.items
      const newItems = [];
      (page.items || []).forEach(origItem => {
        const idRaw = origItem && origItem.itemID;
        if (idRaw == null) {
          newItems.push(origItem);
          return;
        }
        const id = Number(idRaw);
        if (isNaN(id)) {
          // non-numeric ids we don't handle here
          newItems.push(origItem);
          return;
        }

        const activeReplacement = findReplacementCandidate(id);
        // Diagnostic logging to help trace replacement decisions
        try {
          /* eslint-disable no-console */
          console.debug('[SPECIAL replace] slot:', { rawId: idRaw, numericId: id, active: !!activeReplacement });
          if (activeReplacement) console.debug('[SPECIAL replace] using replacement:', { replaceItemID: activeReplacement.replaceItemID, itemName: activeReplacement.itemName });
        } catch (e) { /* ignore logging errors */ }
        if (activeReplacement) {
          // use the active replacement
          newItems.push({ ...activeReplacement });
          return;
        }

        // no active replacement; check if there were candidates at all
        const hadCandidates = hasPaidCandidatesFor(id) || hasFreeCandidatesFor(id);
        if (hadCandidates) {
          // candidates existed but none are active -> remove the slot (do not push)
          return;
        }

        // otherwise keep original item
        newItems.push(origItem);
      });

      page.items = newItems;
    }

    const shopGridEl = document.querySelector('.shop-grid');
    if (!shopGridEl) return;
    shopGridEl.innerHTML = '';

    const sizes = computeTileSizes(page.items || []);
    (page.items || []).forEach((item, idx) => {
      const tileSize = sizes[idx] || 'small';
      shopGridEl.innerHTML += buildTileHTML(item, tileSize, idx);
      // After inserting tile, if it's expired mark it visually (buildTileHTML included expired flag in data-item)
      try {
        const tile = shopGridEl.lastElementChild;
        const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
        if (data && data.expired && tile) {
          tile.classList.add('tile-expired');
          const expiredLabel = document.createElement('div');
          expiredLabel.className = 'tile-expired-label';
          expiredLabel.textContent = 'updating soon';
          tile.appendChild(expiredLabel);
        }
      } catch (e) { /* ignore */ }
    });

    // small deferred post-processing (Zeus + clown badges)
    setTimeout(() => {
      const tileEls = shopGridEl.querySelectorAll('.shop-tile');
      tileEls.forEach((tile) => {
        const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
        // Zeus / 1st badge: toggle hidden class based on data.isZeus
        const firstDiv = tile.querySelector('.tile-1st');
        if (firstDiv) firstDiv.classList.toggle('hidden', !data.isZeus);
        // Clown badge(s): there may be multiple .clown-label elements (inline or in the right-badge container)
        tile.querySelectorAll('.clown-label').forEach(n => n.classList.toggle('hidden', !data.isClown));
      });
    }, 0);

  // wire up overlay + prices + loading overlay
  if (window.__ui && window.__ui.attachTileClickHandlers) window.__ui.attachTileClickHandlers();
  try { if (window.__ui && typeof window.__ui.updateTilePrices === 'function') window.__ui.updateTilePrices(); } catch (e) { console.error('updateTilePrices error', e); }
  // Use overlay module to hide loading overlay when ready
  try { if (window.__overlay && typeof window.__overlay.hideLoadingOverlayWhenReady === 'function') window.__overlay.hideLoadingOverlayWhenReady(); } catch (e) { console.error('hideLoadingOverlayWhenReady error', e); }
  // Also allow overlay module to open overlays from URL
  try { if (window.__overlay && typeof window.__overlay.openOverlayFromUrlIfNeeded === 'function') window.__overlay.openOverlayFromUrlIfNeeded(); } catch (e) { console.error('openOverlayFromUrlIfNeeded error', e); }
  }

  // Attach click handlers to tabs
  const tabs = document.querySelectorAll('.tab-nav-scroll .tab');
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-nav-scroll .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-nav-scroll .tab')[idx].classList.add('active');
      const tabIndex = tab.getAttribute('data-tab-index');
      let tabParam = tabIndex;
      if (!isNaN(Number(tabIndex))) tabParam = Number(tabIndex) + 1;
      const url = new URL(window.location);
      url.searchParams.set('tab', tabParam);
      url.searchParams.delete('item');
      window.history.replaceState({}, '', url);
      if (tabIndex === 'preview') renderCustomDailyTab(); else renderTab(idx);
    });
  });

  // Handle tab from URL
  let initialTabKey = null;
  const urlParams = new URLSearchParams(window.location.search);
  let tabParam = urlParams.get('tab');
  const itemParam = urlParams.get('item');
  if (tabParam && !isNaN(Number(tabParam))) initialTabKey = String(Number(tabParam) - 1);
  else if (tabParam) initialTabKey = tabParam;

  let targetTab = tabs[0];
  if (initialTabKey !== null) {
    targetTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab-index') === initialTabKey) || tabs[0];
  }
  targetTab.classList.add('active');
  setTimeout(() => { targetTab.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'}); }, 0);
  const ti = targetTab.getAttribute('data-tab-index');
  if (ti === 'preview') renderCustomDailyTab(); else renderTab(Number(ti));

  // If item param present open overlay after small delay
  if (itemParam) {
    setTimeout(() => {
      const tiles = document.querySelectorAll('.shop-tile');
      for (let tile of tiles) {
        const dataItemAttr = tile.getAttribute('data-item');
        if (!dataItemAttr) continue;
        const data = JSON.parse(dataItemAttr.replace(/&apos;/g, "'"));
        if (String(data.itemID) === itemParam) { tile.click(); break; }
      }
    }, 300);
  }

  // Ensure tab key handlers (A/D) are initialized
  try { if (window.__tabs && typeof window.__tabs.initTabKeyHandlers === 'function') window.__tabs.initTabKeyHandlers(); } catch (e) { console.error('initTabKeyHandlers failed', e); }
}

// Tab keyboard A/D autorepeat behavior (moved from legacy script)
function initTabKeyHandlers() {
  if (typeof window === 'undefined') return;
  window.__tabs = window.__tabs || {};
  if (window.__tabs._tabKeyInited) return;
  window.__tabs._tabKeyInited = true;

  let tabScrollTimers = { a: null, d: null };
  let tabScrollActive = { a: false, d: false };
  const tabScrollDelay = 350;
  const tabScrollInterval = 120;

  function scrollTabNav(direction) {
    const tabNavScroll = document.querySelector('.tab-nav-scroll');
    if (!tabNavScroll) return;
    const tabs = tabNavScroll.querySelectorAll('.tab');
    let activeIdx = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
    const tabWidth = tabs[activeIdx] ? tabs[activeIdx].offsetWidth + 10 : 270;
    if (direction === 'a') tabNavScroll.scrollLeft -= tabWidth;
    if (direction === 'd') tabNavScroll.scrollLeft += tabWidth;
  }

  document.addEventListener('keydown', function(e) {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (!document.getElementById('item-overlay') || !document.getElementById('item-overlay').classList.contains('hidden')) return;
    if ((e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D')) {
      const dir = e.key.toLowerCase();
      if (!tabScrollActive[dir]) {
        tabScrollActive[dir] = true;
        scrollTabNav(dir);
        tabScrollTimers[dir] = setTimeout(function repeat() {
          scrollTabNav(dir);
          tabScrollTimers[dir] = setInterval(() => scrollTabNav(dir), tabScrollInterval);
        }, tabScrollDelay);
      }
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function(e) {
    if ((e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D')) {
      const dir = e.key.toLowerCase();
      tabScrollActive[dir] = false;
      if (tabScrollTimers[dir]) {
        clearTimeout(tabScrollTimers[dir]);
        clearInterval(tabScrollTimers[dir]);
        tabScrollTimers[dir] = null;
      }
    }
  });
}

// Expose init helper
if (typeof window !== 'undefined') {
  window.__tabs = window.__tabs || {};
  window.__tabs.initTabKeyHandlers = initTabKeyHandlers;
}

  function renderCustomDailyTab() {
    const shopGridEl = document.querySelector('.shop-grid');
    if (!shopGridEl) return;
    shopGridEl.innerHTML = '';

    // Collect all paid sales from all weeks, respecting hidden meta
    let paidItems = [];
    Object.entries(window.dailySalesByWeek || {}).forEach(([weekKey, weekArr]) => {
      if (!window.dailySalesWeekMeta || !window.dailySalesWeekMeta[weekKey] || window.dailySalesWeekMeta[weekKey].hidden !== true) {
        paidItems = paidItems.concat(weekArr);
      }
    });

    (paidItems || []).forEach((item, idx) => {
      const atomPriceOriginal = item.highPrice?.originalAmount ?? 0;
      let atomPriceFinal = atomPriceOriginal;
      const lpAmount = item.lowestPurchasablePrice?.Amount ?? item.lowestPurchasablePrice?.amount;
      const lpNum = lpAmount != null ? Number(lpAmount) : NaN;
      if (isFinite(lpNum) && lpNum > 0) atomPriceFinal = lpNum;
      else if (lpAmount === item.highPrice?.originalAmount) atomPriceFinal = lpAmount;
      else atomPriceFinal = item.highPrice?.originalAmount ?? 0;

      let discount = 0;
      if (atomPriceOriginal > atomPriceFinal && atomPriceFinal > 0) {
        discount = Math.round(100 - (atomPriceFinal / atomPriceOriginal) * 100);
      }

      const isNew = !!item.isNew;
      const isZeus = !!item.isZeus;

      const convert = (atomAmount) => {
        const select = document.getElementById('currency-select');
        let cur = 'usd';
        if (select) cur = select.value;
        else if (window.__data && typeof window.__data.getSavedCurrency === 'function') {
          const saved = window.__data.getSavedCurrency(); if (saved) cur = saved;
        }
        if (cur === 'atoms') return Math.round(atomAmount);
        const rate = (window.__data && window.__data.currencyData && window.__data.currencyData[cur]) ? window.__data.currencyData[cur].rate : 1;
        return (atomAmount * rate).toFixed(2);
      };

  // Preview only shows sale items; always display a numeric current price (no FREE badge)
  const currentPrice = `<span class="current-price">${convert(atomPriceFinal)}</span>`;

  // Preview only shows previously-on-sale items; never show NEW markers here
  const newLabel = '';

      const includes = (item.dynamicBundleItems || []).map(i => i.szItemName);
      let storefrontImage = '';
      if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      const storefrontImageSrc = storefrontImage || '';
      const images = (item.carouselImages || []).map(img => buildImageUrl(img.directory, img.imageName)).filter(Boolean);

  // Allow per-item override via `item.tileSize` but only accept explicit 'small' or 'large' (case-insensitive).
  // Default to 'small' unless explicitly forced via item.tileSize.
  const forcedSize = (typeof item.tileSize === 'string') ? item.tileSize.toLowerCase() : null;
  const tileSize = (forcedSize === 'small' || forcedSize === 'large') ? forcedSize : 'small';
    const tileClass = `shop-tile ${tileSize}`;
  // clown handled via right-side badge container; don't inject separate inline span
      // For the custom/preview tab, treat items as expired if endTime is in the past
      let isExpired = false;
      if (item.endTime && !isNaN(Date.parse(item.endTime))) {
        const end = new Date(item.endTime);
        if (end < new Date()) isExpired = true;
      }
      const tileDisabled = (item.disabled === true || isExpired) ? 'tile-disabled' : '';
      const dateLabel = renderDateRange(item);

  // Safe JSON for embedding in attribute
  const dataItemObj = { title: item.itemName, itemDesc: item.itemDesc, includes, storefrontImage, images, priceOriginal: atomPriceOriginal, priceFinal: atomPriceFinal, discount, isNew, isZeus, isClown: !!item.isClown, disabled: !!item.disabled, expired: isExpired, itemID: item.itemID };
      let dataItemStr = JSON.stringify(dataItemObj).replace(/'/g, "&apos;").replace(/\r\n|\n|\\n/g, "\\n");

      shopGridEl.innerHTML += `
        <div class="${tileClass} ${tileDisabled}"
             data-item='${dataItemStr}'
             data-atom-original="${atomPriceOriginal}"
             data-atom-final="${atomPriceFinal}"
             data-discount="${discount}">
          <div class="tile-img">
            <img src="${storefrontImageSrc}" alt="${item.itemName}" onerror="if(!this.src.endsWith('_l.webp')){this.src=this.src.replace('.webp','_l.webp');}else{this.onerror=null;}" />
          </div>
          <div class="tile-price">
            <span class="old-price"></span>
            ${currentPrice}
          </div>
          <div class="tile-badge">
            <span class="discount"></span>
            ${newLabel}
          </div>
          ${dateLabel}
          <div class="tile-footer ${tileSize}">${tileSize === 'large' ? item.itemName : item.itemNameShort}</div>
        </div>
      `;
    });

    // Deferred post-processing (Zeus + clown badges)
    setTimeout(() => {
      const tileEls = shopGridEl.querySelectorAll('.shop-tile');
      tileEls.forEach(tile => {
        try {
          const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
          const firstDiv = tile.querySelector('.tile-1st');
          if (firstDiv) firstDiv.classList.toggle('hidden', !data.isZeus);
          tile.querySelectorAll('.clown-label').forEach(n => n.classList.toggle('hidden', !data.isClown));
        } catch (e) { /* ignore parse errors */ }
      });
    }, 0);

    // Wire up overlay + prices + loading overlay
    if (window.__ui && window.__ui.attachTileClickHandlers) window.__ui.attachTileClickHandlers();
    try { if (window.__ui && typeof window.__ui.updateTilePrices === 'function') window.__ui.updateTilePrices(); } catch (e) { console.error('updateTilePrices error', e); }
    try { if (window.__overlay && typeof window.__overlay.hideLoadingOverlayWhenReady === 'function') window.__overlay.hideLoadingOverlayWhenReady(); } catch (e) { console.error('hideLoadingOverlayWhenReady error', e); }
    try { if (window.__overlay && typeof window.__overlay.openOverlayFromUrlIfNeeded === 'function') window.__overlay.openOverlayFromUrlIfNeeded(); } catch (e) { console.error('openOverlayFromUrlIfNeeded error', e); }
  }

// Expose API
if (typeof window !== 'undefined') {
  window.__tabs = window.__tabs || {};
  window.__tabs.initTabs = initTabs;
  window.__tabs.renderTab = () => {}; // placeholder
  window.__tabs.renderCustomDailyTab = renderCustomDailyTab;
}

export { initTabs, renderCustomDailyTab };

// Provide helpers for finding active replacements/paid sales (moved from legacy script)
function getActiveReplacement(itemID) {
  const now = window.simulatedNow ? window.simulatedNow.getTime() : Date.now();
  const idNum = Number(itemID);
  const pool = (window.dailyReplacements || []).concat(window.dailyReplacements1st || []);
  const candidates = pool.filter(r => Number(r.replaceItemID) === idNum);

  // Find the one where startTime <= now < endTime
  let active = candidates.find(r => {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    return start <= now && now < end;
  });

  // If none active, show the last item whose startTime is before now
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) <= now)
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] || null;
  }

  // If still none, show the next future item
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) > now)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0] || null;
  }

  return active;
}
// Similar to getActiveReplacement but for paid sales from weekly collections
function getActivePaidSale(itemID) {
  const now = window.simulatedNow ? window.simulatedNow.getTime() : Date.now();
  let candidates = [];
  // Collect all sales from all weeks
  Object.values(window.dailySalesByWeek || {}).forEach(weekArr => {
    candidates = candidates.concat(weekArr.filter(r => Number(r.replaceItemID) === Number(itemID)));
  });

  // Find the one where startTime <= now < endTime
  let active = candidates.find(r => {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    return start <= now && now < end;
  });

  // If none active, show the last item whose startTime is before now
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) <= now)
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] || null;
  }

  // If still none, show the next future item
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) > now)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0] || null;
  }

  return active;
}

if (typeof window !== 'undefined') {
  window.__tabs = window.__tabs || {};
  window.__tabs.getActiveReplacement = getActiveReplacement;
  window.__tabs.getActivePaidSale = getActivePaidSale;
  // Backwards-compat: some legacy code checks window.getActivePaidSale / window.getActiveReplacement
  window.getActiveReplacement = getActiveReplacement;
  window.getActivePaidSale = getActivePaidSale;
}
