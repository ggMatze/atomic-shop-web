(function () {
  const STORAGE_KEY = 'atomicShopOwnedIds';
  const FAVORITE_STORAGE_KEY = 'atomicShopFavoriteIds';
  const TILE_SELECTOR = '.shop-tile';
  const BADGE_CLASS = 'owned-badge';
  const CHECKBOX_CLASS = 'owned-checkbox';
  const CHECKBOX_WRAPPER_CLASS = 'owned-checkbox-wrapper';
  const OWNED_TOGGLE_CLASS = 'owned-check-toggle';
  const OWNED_TOGGLE_ACTIVE_CLASS = 'active';
  const FAVORITE_TOGGLE_CLASS = 'favorite-heart-toggle';
  const FAVORITE_TOGGLE_ACTIVE_CLASS = 'active';

  // Relay for cross-domain sync
  let relayWindow = null;
  let relayReady = false;
  let relayDataReceived = false;
  const relayQueue = [];
  let relayDataPromise = new Promise(resolve => {
    window.__relayDataResolve = resolve;
  });

  function resolveRelayUrl() {
    const protocol = window.location.protocol;
    // Always use the root domain for the relay
    return protocol + '//atomicshop.fyi/owned-relay.html';
  }

  function initRelay() {
    const relayUrl = resolveRelayUrl();
    const relayIframe = document.createElement('iframe');
    relayIframe.id = 'owned-relay-iframe';
    relayIframe.style.display = 'none';
    relayIframe.src = relayUrl;
    document.body.appendChild(relayIframe);

    relayWindow = relayIframe.contentWindow;

    // Listen for relay responses
    window.addEventListener('message', (event) => {
      if (event.source !== relayWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'RELAY_DATA') {
        // Store relay data in local storage so it persists
        if (data.ownedIds) {
          writeSharedValue(STORAGE_KEY, data.ownedIds);
        }
        if (data.favoriteIds) {
          writeSharedValue(FAVORITE_STORAGE_KEY, data.favoriteIds);
        }
        
        // Update our stored state from relay data
        const ownedData = parseStoredIds(data.ownedIds);
        const favData = parseStoredIds(data.favoriteIds);
        lastCookieValue = data.ownedIds;
        lastFavoriteCookieValue = data.favoriteIds;
        
        // Mark that we've received relay data
        if (!relayDataReceived) {
          relayDataReceived = true;
          if (window.__relayDataResolve) {
            window.__relayDataResolve();
          }
        }
        
        decorateViewerTiles();
      }
    });

    setTimeout(() => {
      relayReady = true;
      if (relayWindow) {
        relayWindow.postMessage({ type: 'RELAY_REGISTER' }, '*');
        // Flush queued messages
        while (relayQueue.length) {
          relayWindow.postMessage(relayQueue.shift(), '*');
        }
      }
    }, 500);
  }

  function sendToRelay(message) {
    if (relayReady && relayWindow) {
      relayWindow.postMessage(message, '*');
    } else {
      relayQueue.push(message);
    }
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

  let lastCookieValue = '';
  let lastFavoriteCookieValue = '';

  function isCookieValueSafe(value) {
    return typeof value === 'string' && encodeURIComponent(value).length <= 3800;
  }

  function readSharedValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      console.warn('owned-db: localStorage read failed', e);
      return '';
    }
  }

  function refreshStoredState() {
    const currentOwnedValue = readSharedValue(STORAGE_KEY);
    const currentFavoriteValue = readSharedValue(FAVORITE_STORAGE_KEY);
    if (currentOwnedValue !== lastCookieValue || currentFavoriteValue !== lastFavoriteCookieValue) {
      lastCookieValue = currentOwnedValue;
      lastFavoriteCookieValue = currentFavoriteValue;
      decorateViewerTiles();
      if (overlayTileId) {
        syncHoverOverlayState(overlayTileId);
      }
      updateStoredItemCount();
    }
  }

  function installCookieSync() {
    window.addEventListener('focus', refreshStoredState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshStoredState();
    });

    if (typeof window.setInterval === 'function') {
      setInterval(refreshStoredState, 5000);
    }
  }

  function writeSharedValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('owned-db: localStorage write failed', e);
    }

    const cookieDomain = getCookieDomain();
    if (!cookieDomain || !isCookieValueSafe(value)) {
      // Still sync to relay even if can't set cookie
      if (key === STORAGE_KEY) {
        sendToRelay({ type: 'RELAY_UPDATE_OWNED', ownedIds: value });
      } else if (key === FAVORITE_STORAGE_KEY) {
        sendToRelay({ type: 'RELAY_UPDATE_FAVORITES', favoriteIds: value });
      }
      return;
    }

    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax; domain=${cookieDomain}`;

    // Also sync to relay for cross-domain sharing
    if (key === STORAGE_KEY) {
      sendToRelay({ type: 'RELAY_UPDATE_OWNED', ownedIds: value });
    } else if (key === FAVORITE_STORAGE_KEY) {
      sendToRelay({ type: 'RELAY_UPDATE_FAVORITES', favoriteIds: value });
    }
  }

  function clearSharedValue(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('owned-db: localStorage clear failed', e);
    }

    const cookieDomain = getCookieDomain();
    if (cookieDomain) {
      document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax; domain=${cookieDomain}`;
    }
    
    // Sync clear to relay
    if (key === STORAGE_KEY) {
      sendToRelay({ type: 'RELAY_CLEAR_OWNED' });
    } else if (key === FAVORITE_STORAGE_KEY) {
      sendToRelay({ type: 'RELAY_CLEAR_FAVORITES' });
    }
  }

  function normalizeTrackedId(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function normalizeIdArray(ids) {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids
      .filter(id => typeof id === 'string' && id.trim())
      .map(id => normalizeTrackedId(id))
      .filter(Boolean)));
  }

  function parseStoredIds(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return normalizeIdArray(parsed);
    } catch (e) {
      return [];
    }
  }

  function getStoredIds(storageKey = STORAGE_KEY) {
    try {
      return parseStoredIds(readSharedValue(storageKey));
    } catch (e) {
      return [];
    }
  }

  function saveStoredIds(ids, storageKey = STORAGE_KEY) {
    const uniqueIds = normalizeIdArray(ids);
    writeSharedValue(storageKey, JSON.stringify(uniqueIds));
    updateStoredItemCount();
  }

  function getFavoriteIds() {
    return getStoredIds(FAVORITE_STORAGE_KEY);
  }

  function saveFavoriteIds(ids) {
    saveStoredIds(ids, FAVORITE_STORAGE_KEY);
  }

  function getStoredTrackingData() {
    return {
      owned: getStoredIds(STORAGE_KEY),
      favorites: getFavoriteIds()
    };
  }

  function saveStoredTrackingData(data) {
    const owned = normalizeIdArray(data && data.owned);
    const favorites = normalizeIdArray(data && data.favorites);
    saveStoredIds(owned, STORAGE_KEY);
    saveStoredIds(favorites, FAVORITE_STORAGE_KEY);
    updateStoredItemCount();
  }

  function getMatchedItemIds() {
    if (typeof displayedItems !== 'undefined' && Array.isArray(displayedItems) && displayedItems.length > 0) {
      return Array.from(new Set(displayedItems
        .map(getItemIdFromRecord)
        .filter(Boolean)));
    }

    const results = document.getElementById('results');
    if (!results) return [];
    return Array.from(new Set(Array.from(results.querySelectorAll(TILE_SELECTOR)).map(getTileId).filter(Boolean)));
  }

  function getItemIdFromRecord(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.EDID && String(item.EDID).trim()) return normalizeTrackedId(item.EDID);
    if (item.edid && String(item.edid).trim()) return normalizeTrackedId(item.edid);
    if (item.itemID != null && String(item.itemID).trim()) return normalizeTrackedId(item.itemID);

    const textFields = [item.itemName, item.itemNameShort, item.name, item.title]
      .filter(field => typeof field === 'string' && field.trim())
      .sort((a, b) => b.length - a.length);

    if (textFields.length) {
      return normalizeTrackedId(textFields[0]);
    }

    return null;
  }

  function updateOwnedStateForMatchedItems(owned) {
    const matchedIds = getMatchedItemIds();
    if (!matchedIds.length) {
      showPanelMessage('No matched items found.', true);
      return;
    }

    const stored = new Set(getStoredIds());
    matchedIds.forEach(id => {
      if (owned) stored.add(id);
      else stored.delete(id);
    });

    saveStoredIds(Array.from(stored));
    decorateViewerTiles();
    showPanelMessage(`${owned ? 'Marked' : 'Unmarked'} ${matchedIds.length} matched item(s) as ${owned ? 'owned' : 'not owned'}.`);
  }

  function updateFavoriteStateForMatchedItems(favorited) {
    const matchedIds = getMatchedItemIds();
    if (!matchedIds.length) {
      showPanelMessage('No matched items found.', true);
      return;
    }

    const stored = new Set(getFavoriteIds());
    matchedIds.forEach(id => {
      if (favorited) stored.add(id);
      else stored.delete(id);
    });

    saveFavoriteIds(Array.from(stored));
    decorateViewerTiles();
    showPanelMessage(`${favorited ? 'Added' : 'Removed'} ${matchedIds.length} matched item(s) to ${favorited ? 'favorites' : 'favorites list'}.`);
  }

  function toggleFavoriteForTile(tileId) {
    if (!tileId) return;

    const stored = new Set(getFavoriteIds());
    if (stored.has(tileId)) {
      stored.delete(tileId);
    } else {
      stored.add(tileId);
    }

    saveFavoriteIds(Array.from(stored));
    decorateViewerTiles();
  }

  let ownedControlsVisible = false;

  function normalizeFallback(value) {
    return normalizeTrackedId(value);
  }

  function setOwnedControlsVisibility(visible) {
    ownedControlsVisible = Boolean(visible);
    const panel = document.getElementById('owned-db-panel');
    const bulkPanel = document.getElementById('owned-db-bulk-panel');
    const toggleBtn = document.getElementById('owned-db-toggle-btn');
    if (panel) panel.style.display = ownedControlsVisible ? 'flex' : 'none';
    if (bulkPanel) bulkPanel.style.display = ownedControlsVisible ? 'flex' : 'none';
    if (toggleBtn) {
      toggleBtn.textContent = ownedControlsVisible ? 'Item Tracking －' : 'Item Tracking ＋';
    }
    updatePanelPositions();
  }

  function toggleOwnedControlsVisibility() {
    setOwnedControlsVisibility(!ownedControlsVisible);
  }

  function getTileId(tile) {
    const edid = tile.getAttribute('data-item-edid');
    if (edid && edid.trim()) return normalizeTrackedId(edid);

    const rawDataItem = tile.getAttribute('data-item');
    if (rawDataItem) {
      try {
        const itemData = JSON.parse(rawDataItem.replace(/&apos;/g, "'"));
        if (itemData?.EDID || itemData?.edid) return normalizeTrackedId(itemData.EDID || itemData.edid);
        if (itemData?.title) return normalizeTrackedId(itemData.title);
        if (Array.isArray(itemData?.includes) && itemData.includes.length) return normalizeTrackedId(itemData.includes[0]);
      } catch (e) {
        // ignore
      }
    }

    const footer = tile.querySelector('.tile-footer');
    if (footer && footer.textContent) return normalizeTrackedId(footer.textContent);

    return null;
  }

  let ownedHoverOverlay = null;
  let wishlistHoverOverlay = null;
  let overlayTileId = null;
  let currentHoverTile = null;
  let hideOverlayTimer = null;
  let hoverActive = false;
  let initialized = false;
  let isDecorating = false;
  let clearConfirmActive = false;
  let clearConfirmTimer = null;

  function attachHoverOverlayBehavior(overlay) {
    const keepOverlayVisible = () => {
      hoverActive = true;
      if (hideOverlayTimer) {
        clearTimeout(hideOverlayTimer);
        hideOverlayTimer = null;
      }
    };

    const beginHideOverlay = () => {
      hoverActive = false;
      scheduleHideOverlay();
    };

    overlay.addEventListener('mouseenter', keepOverlayVisible);
    overlay.addEventListener('mousemove', keepOverlayVisible);
    overlay.addEventListener('mouseleave', beginHideOverlay);

    overlay.addEventListener('pointerenter', keepOverlayVisible);
    overlay.addEventListener('pointermove', keepOverlayVisible);
    overlay.addEventListener('pointerleave', beginHideOverlay);
  }

  function createHoverOverlay() {
    if (ownedHoverOverlay && wishlistHoverOverlay) return;

    if (!ownedHoverOverlay) {
      ownedHoverOverlay = document.createElement('div');
      ownedHoverOverlay.id = 'owned-hover-overlay';
      ownedHoverOverlay.style.display = 'none';

      const ownedButton = document.createElement('button');
      ownedButton.type = 'button';
      ownedButton.className = OWNED_TOGGLE_CLASS;
      ownedButton.setAttribute('aria-label', 'Mark item as owned');
      ownedButton.setAttribute('aria-pressed', 'false');
      ownedButton.title = 'Mark Owned';
      ownedButton.innerHTML = ` <svg viewBox="0 0 24 24" aria-hidden="true"> <path d="M8.5 18.5L2.5 12.5L5.3 9.7L8.5 12.9L18.7 2.7L21.5 5.5L8.5 18.5Z"></path> </svg>`;
      ownedButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!overlayTileId) return;
        const stored = new Set(getStoredIds());
        if (stored.has(overlayTileId)) {
          stored.delete(overlayTileId);
        } else {
          stored.add(overlayTileId);
        }
        saveStoredIds(Array.from(stored));
        decorateViewerTiles();
        syncHoverOverlayState(overlayTileId);
      });
      ownedHoverOverlay.appendChild(ownedButton);
      attachHoverOverlayBehavior(ownedHoverOverlay);
      document.body.appendChild(ownedHoverOverlay);
    }

    if (!wishlistHoverOverlay) {
      wishlistHoverOverlay = document.createElement('div');
      wishlistHoverOverlay.id = 'wished-hover-overlay';
      wishlistHoverOverlay.style.display = 'none';

      const favoriteButton = document.createElement('button');
      favoriteButton.type = 'button';
      favoriteButton.className = FAVORITE_TOGGLE_CLASS;
      favoriteButton.setAttribute('aria-label', 'Mark item as favorite');
      favoriteButton.setAttribute('aria-pressed', 'false');
      favoriteButton.title = 'Favorite/Wish';
      favoriteButton.innerHTML = ` <svg viewBox="0 0 24 24" aria-hidden="true"> <path d="M12 21s-7.5-4.35-10-8.5C-.5 8 2 3.5 6 3.5c2.2 0 4.2 1.2 6 3.2 1.8-2 3.8-3.2 6-3.2 4 0 6.5 4.5 4 9-2.5 4.15-10 8.5-10 8.5z"> </path> </svg>`;
      favoriteButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!overlayTileId) return;
        toggleFavoriteForTile(overlayTileId);
        syncHoverOverlayState(overlayTileId);
      });
      wishlistHoverOverlay.appendChild(favoriteButton);
      attachHoverOverlayBehavior(wishlistHoverOverlay);
      document.body.appendChild(wishlistHoverOverlay);
    }
  }

  function showHoverOverlay(tile) {
    const tileId = getTileId(tile);
    if (!tileId) {
      hideHoverOverlay();
      return;
    }
    overlayTileId = tileId;
    currentHoverTile = tile;
    hoverActive = true;
    createHoverOverlay();
    const rect = tile.getBoundingClientRect();
    ownedHoverOverlay.style.left = `${window.scrollX + rect.left + 5}px`;
    ownedHoverOverlay.style.top = `${window.scrollY + rect.top + 8}px`;
    ownedHoverOverlay.style.display = 'inline-flex';

    wishlistHoverOverlay.style.left = `${window.scrollX + rect.right - 53}px`;
    wishlistHoverOverlay.style.top = `${window.scrollY + rect.top + 8}px`;
    wishlistHoverOverlay.style.display = 'inline-flex';

    syncHoverOverlayState(tileId);
  }

  function syncHoverOverlayState(tileId) {
    if (!ownedHoverOverlay && !wishlistHoverOverlay) return;
    const ownedButton = ownedHoverOverlay ? ownedHoverOverlay.querySelector(`.${OWNED_TOGGLE_CLASS}`) : null;
    if (ownedButton) {
      const isOwned = new Set(getStoredIds()).has(tileId);
      ownedButton.classList.toggle(OWNED_TOGGLE_ACTIVE_CLASS, isOwned);
      ownedButton.setAttribute('aria-pressed', String(isOwned));
      ownedButton.setAttribute('aria-label', isOwned ? 'Remove from owned' : 'Add to owned');
    }
    const favoriteButton = wishlistHoverOverlay ? wishlistHoverOverlay.querySelector(`.${FAVORITE_TOGGLE_CLASS}`) : null;
    if (favoriteButton) {
      const isFavorite = new Set(getFavoriteIds()).has(tileId);
      favoriteButton.classList.toggle(FAVORITE_TOGGLE_ACTIVE_CLASS, isFavorite);
      favoriteButton.setAttribute('aria-pressed', String(isFavorite));
      favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    }
  }

  function hideHoverOverlay() {
    if (ownedHoverOverlay) ownedHoverOverlay.style.display = 'none';
    if (wishlistHoverOverlay) wishlistHoverOverlay.style.display = 'none';
    overlayTileId = null;
    currentHoverTile = null;
    hoverActive = false;
  }

  function scheduleHideOverlay() {
    if (hideOverlayTimer) clearTimeout(hideOverlayTimer);
    hideOverlayTimer = setTimeout(() => {
      if (!hoverActive) {
        hideHoverOverlay();
      }
    }, 160);
  }

  function updateHoverOverlayPosition(tile) {
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    if (ownedHoverOverlay) {
      ownedHoverOverlay.style.left = `${window.scrollX + rect.left + 5}px`;
      ownedHoverOverlay.style.top = `${window.scrollY + rect.top + 8}px`;
    }
    if (wishlistHoverOverlay) {
      wishlistHoverOverlay.style.left = `${window.scrollX + rect.right - 53}px`;
      wishlistHoverOverlay.style.top = `${window.scrollY + rect.top + 8}px`;
    }
  }

  function setupHoverOverlayDelegation() {
    const results = document.getElementById('results');
    if (!results) return;

    results.addEventListener('pointermove', (event) => {
      const tile = event.target.closest(TILE_SELECTOR);
      if (!tile || !results.contains(tile)) {
        scheduleHideOverlay();
        return;
      }
      if (tile !== currentHoverTile) {
        showHoverOverlay(tile);
      } else {
        updateHoverOverlayPosition(tile);
      }
      hoverActive = true;
      if (hideOverlayTimer) {
        clearTimeout(hideOverlayTimer);
        hideOverlayTimer = null;
      }
    });

    results.addEventListener('pointerleave', () => {
      hoverActive = false;
      scheduleHideOverlay();
    });
  }

  function setTileState(tile, ownedIds) {
    const tileId = getTileId(tile);
    if (!tileId) return;

    const owned = ownedIds.has(tileId);
    const priceEl = tile.querySelector('.tile-price');
    if (!priceEl) return;

    const existingBadge = tile.querySelector(`.${BADGE_CLASS}`);
    const hasBadge = Boolean(existingBadge);

    if (owned) {
      if (!existingBadge) {
        const badge = document.createElement('div');
        badge.className = BADGE_CLASS;
        badge.textContent = '(OWNED)';
        priceEl.appendChild(badge);
      }
    } else if (existingBadge) {
      existingBadge.remove();
    }

  }

  function decorateViewerTiles() {
    if (isDecorating) return;
    isDecorating = true;
    try {
      const ownedIds = new Set(getStoredIds());
      const tiles = Array.from(document.querySelectorAll(TILE_SELECTOR));
      tiles.forEach(tile => setTileState(tile, ownedIds));
    } finally {
      isDecorating = false;
    }
  }

  function updateStoredItemCount() {
    const countEl = document.getElementById('owned-db-count');
    if (!countEl) return;
    countEl.textContent = `Owned: ${getStoredIds().length} • Favorites: ${getFavoriteIds().length}`;
    updateBulkPanelPosition();
  }

  function updatePanelPositions() {
    const togglePanel = document.getElementById('owned-db-toggle-panel');
    const panel = document.getElementById('owned-db-panel');
    const bulkPanel = document.getElementById('owned-db-bulk-panel');
    const toggleRect = togglePanel ? togglePanel.getBoundingClientRect() : { bottom: 10 };
    if (panel) {
      panel.style.top = `${Math.max(toggleRect.bottom + 10, 20)}px`;
    }
    if (panel && bulkPanel) {
      const panelRect = panel.getBoundingClientRect();
      bulkPanel.style.top = `${Math.max(panelRect.bottom + 10, toggleRect.bottom + 20)}px`;
    }
  }

  function updateBulkPanelPosition() {
    updatePanelPositions();
  }

  function showPanelMessage(text, isError) {
    const msg = document.getElementById('owned-db-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = isError ? '#f88' : '#a9d18e';
    updateBulkPanelPosition();
  }

  function createImportExportPanel() {
    if (document.getElementById('owned-db-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'owned-db-panel';
    panel.className = 'menu-right owned-db-panel';

    panel.innerHTML = `
      <div class="owned-db-actions">
        <button id="owned-db-import" type="button">Import JSON</button>
        <button id="owned-db-export" type="button">Export JSON</button>
        <button id="owned-db-clear" type="button">Clear Lists</button>
      </div>
      <div id="owned-db-msg" class="owned-db-msg"></div>
      <div id="owned-db-count" class="owned-db-count">Owned: 0 • Favorites: 0</div>
    `;

    document.body.appendChild(panel);

    const bulkPanel = document.createElement('div');
    bulkPanel.id = 'owned-db-bulk-panel';
    bulkPanel.className = 'menu-right owned-db-panel';
    bulkPanel.style.top = '220px';
    bulkPanel.innerHTML = `
      <div class="owned-db-actions">
        <div class="owned-db-count">For current filter/search</div>
        <button id="owned-db-mark-matches-owned" type="button">Mark Matches Owned</button>
        <button id="owned-db-unmark-matches-owned" type="button">Mark Matches Not Owned</button>
       
      </div>
    `;
    document.body.appendChild(bulkPanel);
    updatePanelPositions();
    window.addEventListener('resize', updatePanelPositions);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    panel.appendChild(fileInput);

    document.getElementById('owned-db-export').addEventListener('click', () => {
      const data = getStoredTrackingData();
      const ownedIds = data.owned;
      const favoriteIds = data.favorites;
      const payload = {
        owned: ownedIds,
        favorites: favoriteIds
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tracked-items.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      updateStoredItemCount();
      showPanelMessage(`Exported ${ownedIds.length} owned and ${favoriteIds.length} favorite item ID(s).`);
    });

    document.getElementById('owned-db-import').addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        showPanelMessage('No file selected.', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
          console.debug('owned-db: import file parsed', parsed);
        } catch (e) {
          showPanelMessage('Invalid JSON file.', true);
          return;
        }
        if (Array.isArray(parsed)) {
          saveStoredTrackingData({ owned: parsed, favorites: [] });
          decorateViewerTiles();
          showPanelMessage(`Imported ${parsed.filter(id => typeof id === 'string' && id.trim()).length} item ID(s) into owned list.`);
          return;
        }

        if (parsed && typeof parsed === 'object') {
          const owned = Array.isArray(parsed.owned) ? parsed.owned : [];
          const favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
          saveStoredTrackingData({ owned, favorites });
          decorateViewerTiles();
          showPanelMessage(`Imported ${owned.filter(id => typeof id === 'string' && id.trim()).length} owned and ${favorites.filter(id => typeof id === 'string' && id.trim()).length} favorite item ID(s).`);
          return;
        }

        showPanelMessage('JSON must be an array of item IDs or an object with owned/favorites arrays.', true);
      };
      reader.onerror = () => showPanelMessage('Could not read file.', true);
      reader.readAsText(file, 'UTF-8');
    });

    const clearButton = document.getElementById('owned-db-clear');
    clearButton.addEventListener('click', () => {
      if (clearConfirmActive) {
        clearConfirmActive = false;
        if (clearConfirmTimer) {
          clearTimeout(clearConfirmTimer);
          clearConfirmTimer = null;
        }
        clearSharedValue(STORAGE_KEY);
        clearSharedValue(FAVORITE_STORAGE_KEY);
        decorateViewerTiles();
        updateStoredItemCount();
        showPanelMessage('Cleared owned and favorite items.');
        clearButton.textContent = 'Clear Lists';
        return;
      }

      clearConfirmActive = true;
      showPanelMessage('Click clear again to confirm.', true);
      if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
      clearConfirmTimer = setTimeout(() => {
        clearConfirmActive = false;
        clearConfirmTimer = null;
        showPanelMessage('');
      }, 2500);
    });

    document.getElementById('owned-db-mark-matches-owned').addEventListener('click', () => {
      updateOwnedStateForMatchedItems(true);
    });

    document.getElementById('owned-db-unmark-matches-owned').addEventListener('click', () => {
      updateOwnedStateForMatchedItems(false);
    });

  }

  function createTogglePanel() {
    if (document.getElementById('owned-db-toggle-panel')) return;

    const togglePanel = document.createElement('div');
    togglePanel.id = 'owned-db-toggle-panel';
    togglePanel.className = 'menu-right owned-db-panel';
    togglePanel.style.top = '20px';
    const buttonText = ownedControlsVisible ? 'item tracking ⛛' : 'item tracking ⛛';
    togglePanel.innerHTML = `
      <div class="owned-db-actions">
        <button id="owned-db-toggle-btn" type="button">${buttonText}</button>
      </div>
    `;

    document.body.appendChild(togglePanel);
    document.getElementById('owned-db-toggle-btn').addEventListener('click', toggleOwnedControlsVisibility);
    updatePanelPositions();
  }

  function initControls() {
    createTogglePanel();
    createImportExportPanel();
    setOwnedControlsVisibility(ownedControlsVisible);
  }

  let decorateTimer = null;

  function scheduleDecorateViewerTiles() {
    if (decorateTimer) return;
    decorateTimer = setTimeout(() => {
      decorateTimer = null;
      console.debug('owned-db: scheduled decorateViewerTiles');
      decorateViewerTiles();
    }, 100);
  }

  function installResultObserver() {
    const results = document.getElementById('results');
    if (!results) return;
    const observer = new MutationObserver(() => {
      if (isDecorating) return;
      scheduleDecorateViewerTiles();
    });
    observer.observe(results, { childList: true, subtree: true });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    initRelay();
    
    // Wait for relay data with a timeout, then decorate
    Promise.race([
      relayDataPromise,
      new Promise(resolve => setTimeout(resolve, 2000))
    ]).then(() => {
      decorateViewerTiles();
      updateStoredItemCount();
    });
    
    installResultObserver();
    setupHoverOverlayDelegation();
    initControls();
    lastCookieValue = readSharedValue(STORAGE_KEY);
    lastFavoriteCookieValue = readSharedValue(FAVORITE_STORAGE_KEY);
    installCookieSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('load', init, { once: true });
})();
