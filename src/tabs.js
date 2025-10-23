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

  function renderTab(tabIdx) {
    const page = pages[tabIdx];
    if (!page) return;

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

    (page.items || []).forEach((item, idx) => {
      // Determine atom denominated prices (original & final) in a consistent way
    // Determine atom denominated prices (original & final) in a consistent way.
    // Some feeds use `Amount` (capital A) while others use `amount`.
    const atomPriceOriginal = item.highPrice?.originalAmount ?? 0;
    let atomPriceFinal = atomPriceOriginal;
    const lpAmount = item.lowestPurchasablePrice?.Amount ?? item.lowestPurchasablePrice?.amount;
    const lpNum = lpAmount != null ? Number(lpAmount) : NaN;
    if (isFinite(lpNum) && lpNum > 0) atomPriceFinal = lpNum;
    else if (lpAmount === item.highPrice?.originalAmount) atomPriceFinal = lpAmount;
    else atomPriceFinal = item.highPrice?.originalAmount ?? 0;

      // Compute discount based on atom values
      let discount = 0;
      if (atomPriceOriginal > atomPriceFinal && atomPriceFinal > 0) {
        discount = Math.round(100 - (atomPriceFinal / atomPriceOriginal) * 100);
      }

      const isNew = !!item.isNew;
      const isZeus = !!item.isZeus;
      const isClown = !!item.isClown;

      const expires = (item.lowPrice?.isLto && item.lowPrice?.ltoTimer) ? renderTimerHTML(item.lowPrice.ltoTimer) : '';

  const oldPrice = discount > 0 ? `<span class="old-price">${convert(atomPriceOriginal)}</span>` : '';
  const currentPrice = atomPriceFinal === 0 ? `<span class="free-badge">FREE</span>` : `<span class="current-price">${convert(atomPriceFinal)}</span>`;

      let newLabel = '';
      if (item.isNew === 1 || item.isNew === true) newLabel = `<span class="new-label">NEW</span>`;
      else if (item.isNew === 2) newLabel = `<span class="newish-label">NEW*</span>`;

      const includes = (item.dynamicBundleItems || []).map(i => i.szItemName);
      let storefrontImage = '';
      if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      const storefrontImageSrc = storefrontImage || '';
      const images = (item.carouselImages || []).map(img => buildImageUrl(img.directory, img.imageName)).filter(Boolean);

      const tileSize = (idx < 3 ? 'large' : 'small');
      const tileClass = `shop-tile ${tileSize}`;
      let clownLabel = '';
      if (item.isClown === true) clownLabel = `<span class="clown-label" title="Bethesda made a fool of themselves again!"></span>`;
      const tileDisabled = item.disabled === true ? 'tile-disabled' : '';
      const dateLabel = renderDateRange(item);

      // Determine if the item is expired (LTO timer in the past) for normal tabs
      let isExpired = false;
      if (item.lowPrice && item.lowPrice.isLto === true && typeof item.lowPrice.ltoTimer === 'string' && !isNaN(Date.parse(item.lowPrice.ltoTimer))) {
        const expiresAt = new Date(item.lowPrice.ltoTimer);
        if (expiresAt < new Date()) isExpired = true;
      }

      // Prepare safe JSON for embedding in data-item attribute: escape single quotes and normalize newlines
      const dataItemObj = { title: item.itemName, itemDesc: item.itemDesc, includes, storefrontImage, images, priceOriginal: atomPriceOriginal, priceFinal: atomPriceFinal, discount, isNew, isZeus, isClown: !!item.isClown, disabled: !!item.disabled, expired: isExpired, itemID: item.itemID };
      let dataItemStr = JSON.stringify(dataItemObj);
      // Replace single quotes to avoid breaking attribute and normalize newlines to literal \n
      dataItemStr = dataItemStr.replace(/'/g, "&apos;").replace(/\r\n|\n|\\n/g, "\\n");

      shopGridEl.innerHTML += `
        <div class="${tileClass} ${tileDisabled}"
             data-item='${dataItemStr}'
             data-atom-original="${atomPriceOriginal}"
             data-atom-final="${atomPriceFinal}"
             data-discount="${discount}">
          <div class="tile-img">
            <img src="${storefrontImageSrc}" alt="${item.itemName}" onerror="if(!this.src.endsWith('_l.webp')){this.src=this.src.replace('.webp','_l.webp');}else{this.onerror=null;}" />
          </div>
          ${clownLabel}
          <div class="tile-price">
            <span class="old-price"></span>
            ${currentPrice}
          </div>
          <div class="tile-badge">
            <span class="discount"></span>
            ${newLabel}
          </div>
          ${expires}
          <div class="tile-1st hidden">&nbsp;</div>
          <div class="tile-footer ${tileSize}">${tileSize === 'large' ? item.itemName : item.itemNameShort}</div>
        </div>
      `;
      // After inserting tile, if it's expired mark it visually (normal tabs use LTO timer)
      try {
        const tile = shopGridEl.lastElementChild;
        if (isExpired && tile) {
          tile.classList.add('tile-expired');
          const expiredLabel = document.createElement('div');
          expiredLabel.className = 'tile-expired-label';
          expiredLabel.textContent = 'updating soon';
          tile.appendChild(expiredLabel);
        }
      } catch (e) { /* ignore */ }
    });

    // small deferred post-processing (e.g., Zeus badge)
    setTimeout(() => {
      const tileEls = shopGridEl.querySelectorAll('.shop-tile');
      tileEls.forEach((tile) => {
        const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
        const firstDiv = tile.querySelector('.tile-1st');
        if (firstDiv) {
          if (data.isZeus) firstDiv.classList.remove('hidden');
          else firstDiv.classList.add('hidden');
        }
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
      const isClown = !!item.isClown;

      const expires = (item.lowPrice?.isLto && item.lowPrice?.ltoTimer) ? renderTimerHTML(item.lowPrice.ltoTimer) : '';

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

      const oldPrice = discount > 0 ? `<span class="old-price">${convert(atomPriceOriginal)}</span>` : '';
      const currentPrice = atomPriceFinal === 0 ? `<span class="free-badge">FREE</span>` : `<span class="current-price">${convert(atomPriceFinal)}</span>`;

      let newLabel = '';
      if (item.isNew === 1 || item.isNew === true) newLabel = `<span class="new-label">NEW</span>`;
      else if (item.isNew === 2) newLabel = `<span class="newish-label">NEW*</span>`;

      const includes = (item.dynamicBundleItems || []).map(i => i.szItemName);
      let storefrontImage = '';
      if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      const storefrontImageSrc = storefrontImage || '';
      const images = (item.carouselImages || []).map(img => buildImageUrl(img.directory, img.imageName)).filter(Boolean);

  const tileSize = item.tileSize || (idx < 3 ? 'small' : 'large');
      const tileClass = `shop-tile ${tileSize}`;
      let clownLabel = '';
      if (item.isClown === true) clownLabel = `<span class="clown-label" title="Bethesda made a fool of themselves again!"></span>`;
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
          ${clownLabel}
          <div class="tile-price">
            <span class="old-price"></span>
            ${currentPrice}
          </div>
          <div class="tile-badge">
            <span class="discount"></span>
            ${newLabel}
          </div>
          ${dateLabel}
          <div class="tile-1st hidden">&nbsp;</div>
          <div class="tile-footer ${tileSize}">${tileSize === 'small' ? item.itemName : item.itemNameShort}</div>
        </div>
      `;
    });

    // Deferred post-processing (Zeus badge)
    setTimeout(() => {
      const tileEls = shopGridEl.querySelectorAll('.shop-tile');
      tileEls.forEach(tile => {
        try {
          const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
          const firstDiv = tile.querySelector('.tile-1st');
          if (firstDiv) {
            if (data.isZeus) firstDiv.classList.remove('hidden'); else firstDiv.classList.add('hidden');
          }
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
