(function () {
  const STORAGE_KEY_IDS = 'atomicShopOwnedIds';
  const STORAGE_KEY_NAMES = 'atomicShopOwnedNames';
  const TILE_SELECTOR = '.shop-tile';
  const BADGE_CLASS = 'owned-badge';
  const BUNDLE_MARKER_CLASS = 'owned-bundle-marker';
  const ATTR_OWNED = 'data-owned-badge';
  const ATTR_STATE = 'data-owned-state';
  let itemsDbUrl = null;

  const state = {
    ownedIdSet: new Set(),
    ownedNameSet: new Set(),
    dbNameIndex: new Map(),
    dbLoading: false,
    dbLoaded: false,
    dbError: false
  };

  const IMPORT_BUTTON_ID = 'owned-tracker-import';
  const IMPORT_MESSAGE_ID = 'owned-tracker-import-msg';

  let lastCookieOwnedIds = '';
  let lastCookieOwnedNames = '';

  function normalizeName(value) {
    if (!value && value !== 0) return '';
    return String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201C\u201D"'`]/g, '')
      .replace(/[^a-z0-9\s\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getCookieDomain() {
    const hostname = window.location.hostname || '';
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return '';
    if (hostname.endsWith('.atomicshop.fyi') || hostname === 'atomicshop.fyi') return '.atomicshop.fyi';
    return '';
  }

  function readCookieValue(key) {
    const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
    return cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
  }

  function isCookieValueSafe(value) {
    return typeof value === 'string' && encodeURIComponent(value).length <= 3800;
  }

  function readSharedValue(key) {
    let localValue = '';
    try {
      localValue = localStorage.getItem(key) || '';
    } catch (e) {
      console.warn('[owned-tracker] localStorage read failed', e);
    }

    if (localValue) {
      return localValue;
    }

    const cookieValue = readCookieValue(key);
    if (cookieValue) {
      try {
        localStorage.setItem(key, cookieValue);
      } catch (e) {
        // ignore write failure
      }
    }

    return cookieValue;
  }

  function setupImportButton() {
    const importButton = document.getElementById(IMPORT_BUTTON_ID);
    if (!importButton) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    importButton.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        showImportMessage('No file selected.', true);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch (e) {
          showImportMessage('Invalid JSON file.', true);
          return;
        }

        if (!Array.isArray(parsed)) {
          showImportMessage('JSON must be an array of item IDs.', true);
          return;
        }

        const count = saveOwnedIds(parsed);
        loadOwnedIds();
        loadOwnedNames();
        loadDatabaseIndex()
          .then(() => decorateAllStoreTiles())
          .catch(() => decorateAllStoreTiles())
          .finally(() => showImportMessage(`Imported ${count} owned item ID(s).`, false));
      };

      reader.onerror = () => showImportMessage('Could not read file.', true);
      reader.readAsText(file, 'UTF-8');
    });
  }

  function refreshOwnedCookieState() {
    const cookieIds = readCookieValue(STORAGE_KEY_IDS);
    const cookieNames = readCookieValue(STORAGE_KEY_NAMES);

    if (cookieIds !== lastCookieOwnedIds || cookieNames !== lastCookieOwnedNames) {
      lastCookieOwnedIds = cookieIds;
      lastCookieOwnedNames = cookieNames;
      decorateAllStoreTiles();
    }
  }

  function installCookieSync() {
    window.addEventListener('focus', refreshOwnedCookieState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshOwnedCookieState();
    });

    if (typeof window.setInterval === 'function') {
      setInterval(refreshOwnedCookieState, 5000);
    }
  }

  function writeSharedValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[owned-tracker] localStorage write failed', e);
    }

    const cookieDomain = getCookieDomain();
    if (!cookieDomain || !isCookieValueSafe(value)) return;

    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; domain=${cookieDomain}`;
  }

  function saveOwnedIds(ids) {
    const normalizedIds = Array.from(new Set(
      (Array.isArray(ids) ? ids : [])
        .map(id => (id || '').toString().trim())
        .filter(Boolean)
    ));

    writeSharedValue(STORAGE_KEY_IDS, JSON.stringify(normalizedIds));
    state.ownedIdSet = new Set(normalizedIds);
    return normalizedIds.length;
  }

  function showImportMessage(text, isError) {
    const msg = document.getElementById(IMPORT_MESSAGE_ID);
    if (msg) {
      msg.textContent = text;
      msg.style.color = isError ? '#f88' : '#a9d18e';
      setTimeout(() => {
        if (msg.textContent === text) msg.textContent = '';
      }, 5000);
    } else if (isError) {
      alert(text);
    }
  }

  function clearSharedValue(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[owned-tracker] localStorage clear failed', e);
    }

    const cookieDomain = getCookieDomain();
    if (!cookieDomain) return;

    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax; domain=${cookieDomain}`;
  }

  function parseStoredArray(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function loadOwnedIds() {
    const stored = parseStoredArray(readSharedValue(STORAGE_KEY_IDS));
    state.ownedIdSet = new Set(
      stored.map(id => String(id).trim()).filter(Boolean)
    );
    return state.ownedIdSet;
  }

  function loadOwnedNames() {
    const stored = parseStoredArray(readSharedValue(STORAGE_KEY_NAMES));
    state.ownedNameSet = new Set(stored.map(normalizeName).filter(Boolean));
    return state.ownedNameSet;
  }

  function resolveItemsDbUrl() {
    if (itemsDbUrl) return itemsDbUrl;

    const candidates = [];
    const origin = window.location.origin || '';
    const pathname = window.location.pathname || '';
    const base = pathname.replace(/\/[^/]*$/, '/');

    if (window.location.protocol === 'file:') {
      candidates.push(new URL('../data/items-db.json', window.location.href).toString());
      candidates.push('/data/items-db.json');
    } else {
      candidates.push(new URL('data/items-db.json', `${origin}${base}`).toString());
      candidates.push(new URL('/data/items-db.json', origin).toString());
      candidates.push(new URL('items-db.json', `${origin}${base}`).toString());
      candidates.push(new URL('/items-db.json', origin).toString());
    }

    itemsDbUrl = candidates.find(url => url);
    return itemsDbUrl;
  }

  function parseTileData(tile) {
    const raw = tile.getAttribute('data-item');
    if (!raw) return null;
    try {
      return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    } catch (e) {
      return null;
    }
  }

  function extractTileDirectCandidates(tile, tileData) {
    const ids = new Set();
    const names = new Set();

    if (tileData) {
      const directIdFields = [tileData.itemID, tileData.EDID, tileData.edid, tileData.itemId, tileData.id];
      directIdFields.forEach(value => {
        if (value != null && value !== '') ids.add(String(value).trim());
      });

      const directNameFields = [tileData.title, tileData.itemName, tileData.name, tileData.itemNameShort];
      directNameFields.forEach(value => {
        if (value) names.add(normalizeName(value));
      });
    }

    const attrEdid = tile.getAttribute('data-item-edid');
    if (attrEdid) ids.add(String(attrEdid).trim());

    const attrId = tile.getAttribute('data-item-id');
    if (attrId) ids.add(String(attrId).trim());

    const footer = tile.querySelector('.tile-footer');
    if (footer && footer.textContent) {
      names.add(normalizeName(footer.textContent));
    }

    return {
      ids: Array.from(ids).filter(Boolean),
      names: Array.from(names).filter(Boolean)
    };
  }

  function extractIncludedEntryNames(tileData) {
    const names = new Set();

    if (tileData && Array.isArray(tileData.includes)) {
      tileData.includes.forEach(value => {
        if (value) names.add(normalizeName(value));
      });
    }

    if (tileData && Array.isArray(tileData.dynamicBundleItems)) {
      tileData.dynamicBundleItems.forEach(value => {
        if (value && (value.szItemName || value.itemName || value.name)) {
          names.add(normalizeName(value.szItemName || value.itemName || value.name));
        }
      });
    }

    return Array.from(names).filter(Boolean);
  }

  function entryMatchesOwned(entryName) {
    const normalized = normalizeName(entryName);
    if (!normalized) return false;
    if (state.ownedNameSet.has(normalized)) return true;
    if (!state.dbNameIndex.size || !state.ownedIdSet.size) return false;

    const ids = state.dbNameIndex.get(normalized);
    if (!ids) return false;
    return Array.from(ids).some(id => state.ownedIdSet.has(String(id).trim()));
  }

  function getOwnedIncludedEntries(tileData) {
    return extractIncludedEntryNames(tileData).filter(entryMatchesOwned);
  }

  function syncOverlayOwnedIncludes() {
    const items = document.querySelectorAll('.overlay-includes .include-item, .overlay-items li');
    if (!items.length) return;

    items.forEach(el => {
      const owned = entryMatchesOwned(el.textContent || '');
      el.classList.toggle('owned-include-item', owned);
      if (owned) {
        el.style.textDecoration = 'line-through';
        el.style.color = '#a7a786';
      } else {
        el.style.textDecoration = '';
        el.style.opacity = '';
        el.style.color = '';
      }
    });
  }

  async function loadDatabaseIndex() {
    if (state.dbLoading || state.dbLoaded) return state.dbNameIndex;
    state.dbLoading = true;

    try {
      const dbUrl = resolveItemsDbUrl();
      if (!dbUrl) throw new Error('No items DB URL resolved');
      const response = await fetch(dbUrl);
      if (!response.ok) throw new Error('Failed to fetch items db');
      const items = await response.json();
      state.dbNameIndex = new Map();

      if (Array.isArray(items)) {
        items.forEach(item => {
          const candidateNames = new Set();
          if (item.itemName) candidateNames.add(normalizeName(item.itemName));
          if (item.itemNameShort) candidateNames.add(normalizeName(item.itemNameShort));
          if (item.name) candidateNames.add(normalizeName(item.name));
          if (item.EDID) candidateNames.add(normalizeName(item.EDID));
          if (item.edid) candidateNames.add(normalizeName(item.edid));

          candidateNames.forEach(name => {
            if (!name) return;
            const ids = state.dbNameIndex.get(name) || new Set();
            if (item.EDID || item.edid) ids.add(String(item.EDID || item.edid).trim());
            if (item.itemID != null) ids.add(String(item.itemID).trim());
            state.dbNameIndex.set(name, ids);
          });
        });
      }
    } catch (e) {
      console.warn('[owned-tracker] failed to load DB index', e);
      state.dbNameIndex = new Map();
      state.dbError = true;
    } finally {
      state.dbLoading = false;
      state.dbLoaded = true;
    }

    return state.dbNameIndex;
  }

  function tileHasOwnedId(tileData, tile) {
    const { ids } = extractTileDirectCandidates(tile, tileData);
    return ids.some(id => {
      const normalized = String(id).trim();
      if (!normalized) return false;
      return state.ownedIdSet.has(normalized);
    });
  }

  function tileHasDbOwnedId(tileData, tile) {
    if (!state.dbNameIndex.size || !state.ownedIdSet.size) return false;
    const { names } = extractTileDirectCandidates(tile, tileData);
    return names.some(name => {
      const ids = state.dbNameIndex.get(name);
      if (!ids) return false;
      return Array.from(ids).some(id => state.ownedIdSet.has(String(id).trim()));
    });
  }

  function tileHasOwnedName(tileData, tile) {
    if (!state.ownedNameSet.size) return false;
    const { names } = extractTileDirectCandidates(tile, tileData);
    return names.some(name => state.ownedNameSet.has(name));
  }

  function isTileOwned(tile) {
    const tileData = parseTileData(tile);
    if (!tileData) return false;
    if (tileHasOwnedId(tileData, tile)) return true;
    if (tileHasDbOwnedId(tileData, tile)) return true;
    return tileHasOwnedName(tileData, tile);
  }

  function decorateStoreTile(tile) {
    if (!tile) return;

    const tileData = parseTileData(tile);
    const owned = isTileOwned(tile);
    const ownedIncludes = tileData ? getOwnedIncludedEntries(tileData).length > 0 : false;
    const existingBadge = tile.querySelector(`.${BADGE_CLASS}`);
    const existingMarker = tile.querySelector(`.${BUNDLE_MARKER_CLASS}`);

    if (owned) {
      if (!existingBadge) {
        const badge = document.createElement('div');
        badge.className = BADGE_CLASS;
        badge.textContent = '(OWNED)';

        const priceContainer = tile.querySelector('.tile-price');
        if (priceContainer) {
          priceContainer.appendChild(badge);
        } else {
          tile.appendChild(badge);
        }
      }
      if (existingMarker) existingMarker.remove();
    } else if (ownedIncludes) {
      if (existingBadge) existingBadge.remove();
      if (!existingMarker) {
        const marker = document.createElement('span');
        marker.className = BUNDLE_MARKER_CLASS;
        marker.textContent = '*';
        marker.title = 'Includes owned item';
        marker.style.display = 'inline-block';
        marker.style.verticalAlign = 'middle';
        marker.style.marginLeft = '2px';
        marker.style.fontSize = 'inherit';
        marker.style.fontWeight = 'inherit';
        marker.style.lineHeight = 'inherit';
        marker.style.opacity = '0.95';

        const priceContainer = tile.querySelector('.tile-price');
        const priceValueEl = tile.querySelector('.tile-price .current-price') || tile.querySelector('.tile-price .old-price') || priceContainer;
        if (priceValueEl) {
          priceValueEl.appendChild(marker);
        } else {
          tile.appendChild(marker);
        }
      }
    } else {
      if (existingBadge) existingBadge.remove();
      if (existingMarker) existingMarker.remove();
    }

    tile.classList.toggle('owned-state-owned', owned);
    tile.classList.toggle('owned-state-partial', !owned && ownedIncludes);
    tile.classList.toggle('owned-state-none', !owned && !ownedIncludes);
    tile.setAttribute(ATTR_OWNED, owned ? 'true' : (ownedIncludes ? 'partial' : 'false'));
    tile.setAttribute(ATTR_STATE, owned ? 'owned' : (ownedIncludes ? 'partial' : 'none'));
  }

  function decorateAllStoreTiles() {
    loadOwnedIds();
    loadOwnedNames();
    document.querySelectorAll(TILE_SELECTOR).forEach(tile => decorateStoreTile(tile));
    syncOverlayOwnedIncludes();
  }

  function installGridObserver() {
    const grid = document.querySelector('.shop-grid');
    if (!grid) return;

    const observer = new MutationObserver(() => {
      decorateAllStoreTiles();
    });
    observer.observe(grid, { childList: true, subtree: true });
  }

  function wrapTabsRender() {
    if (!window.__tabs || typeof window.__tabs.renderTab !== 'function') return false;
    if (window.__tabs.__ownedTrackerWrapped) return true;

    const originalRenderTab = window.__tabs.renderTab.bind(window.__tabs);
    window.__tabs.renderTab = function (...args) {
      const result = originalRenderTab(...args);
      decorateAllStoreTiles();
      return result;
    };
    window.__tabs.__ownedTrackerWrapped = true;
    return true;
  }

  function setupStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY_IDS || event.key === STORAGE_KEY_NAMES) {
        decorateAllStoreTiles();
      }
    });
  }

  function syncOverlayOwnedMessage(tile) {
    const overlay = document.getElementById('item-overlay');
    const msgEl = document.getElementById('overlay-expired-msg');
    const stateValue = tile ? tile.getAttribute(ATTR_STATE) : '';
    const owned = stateValue === 'owned';
    const partial = stateValue === 'partial';

    if (msgEl) msgEl.remove();
    if (!overlay || overlay.classList.contains('hidden') || (!owned && !partial)) return;

    const msg = document.createElement('div');
    msg.id = 'overlay-expired-msg';
    msg.className = 'overlay-expired-msg';
    msg.style.color = '#a7a786';

    if (owned) {
      msg.textContent = 'You own this item.';
    } else {
      const tileData = tile ? parseTileData(tile) : null;
      const ownedIncludesCount = tileData ? getOwnedIncludedEntries(tileData).length : 0;
      const noun = ownedIncludesCount === 1 ? 'item' : 'items';
      msg.textContent = `You own ${ownedIncludesCount} ${noun} of this bundle, so the ingame bundle price is reduced.`;
    }

    overlay.appendChild(msg);
  }

  function installOverlaySync() {
    document.addEventListener('click', (event) => {
      const tile = event.target && event.target.closest && event.target.closest(TILE_SELECTOR);
      if (!tile) return;
      window.setTimeout(() => syncOverlayOwnedIncludes(), 0);
      window.setTimeout(() => syncOverlayOwnedIncludes(), 80);
      window.setTimeout(() => syncOverlayOwnedMessage(tile), 0);
      window.setTimeout(() => syncOverlayOwnedMessage(tile), 80);
    });
  }

  function init() {
    decorateAllStoreTiles();
    installGridObserver();
    setupStorageListener();
    installOverlaySync();
    wrapTabsRender();

    if (!window.__tabs || !window.__tabs.__ownedTrackerWrapped) {
      const interval = setInterval(() => {
        if (wrapTabsRender()) {
          clearInterval(interval);
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 3000);
    }

    window.__ownedTracker = window.__ownedTracker || {};
    window.__ownedTracker.refresh = decorateAllStoreTiles;
    window.__ownedTracker.reloadDbIndex = loadDatabaseIndex;

    lastCookieOwnedIds = readCookieValue(STORAGE_KEY_IDS);
    lastCookieOwnedNames = readCookieValue(STORAGE_KEY_NAMES);
    installCookieSync();
    setupImportButton();

    if (state.ownedIdSet.size) {
      loadDatabaseIndex().then(() => decorateAllStoreTiles()).catch(() => decorateAllStoreTiles());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
