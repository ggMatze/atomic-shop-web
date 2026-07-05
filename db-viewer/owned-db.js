(function () {
  const STORAGE_KEY = 'atomicShopOwnedIds';
  const TILE_SELECTOR = '.shop-tile';
  const BADGE_CLASS = 'owned-badge';
  const CHECKBOX_CLASS = 'owned-checkbox';
  const CHECKBOX_WRAPPER_CLASS = 'owned-checkbox-wrapper';

  function readSharedValue(key) {
    try {
      const localValue = localStorage.getItem(key);
      return localValue !== null ? localValue : '';
    } catch (e) {
      console.warn('owned-db: localStorage read failed', e);
      return '';
    }
  }

  function writeSharedValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('owned-db: localStorage write failed', e);
    }
  }

  function clearSharedValue(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('owned-db: localStorage clear failed', e);
    }
  }

  function parseStoredIds(value) {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim())
        : [];
    } catch (e) {
      return [];
    }
  }

  function getStoredIds() {
    try {
      return parseStoredIds(readSharedValue(STORAGE_KEY));
    } catch (e) {
      return [];
    }
  }

  function saveStoredIds(ids) {
    const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim())));
    writeSharedValue(STORAGE_KEY, JSON.stringify(uniqueIds));
    updateStoredItemCount();
  }

  function normalizeFallback(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function getTileId(tile) {
    const edid = tile.getAttribute('data-item-edid');
    if (edid && edid.trim()) return edid.trim();

    const rawDataItem = tile.getAttribute('data-item');
    if (rawDataItem) {
      try {
        const itemData = JSON.parse(rawDataItem.replace(/&apos;/g, "'"));
        if (itemData?.EDID || itemData?.edid) return String(itemData.EDID || itemData.edid).trim();
        if (itemData?.title) return normalizeFallback(itemData.title);
        if (Array.isArray(itemData?.includes) && itemData.includes.length) return normalizeFallback(itemData.includes[0]);
      } catch (e) {
        // ignore
      }
    }

    const footer = tile.querySelector('.tile-footer');
    if (footer && footer.textContent) return normalizeFallback(footer.textContent);

    return null;
  }

  let hoverOverlay = null;
  let overlayTileId = null;
  let currentHoverTile = null;
  let hideOverlayTimer = null;
  let hoverActive = false;
  let initialized = false;
  let isDecorating = false;
  let clearConfirmActive = false;
  let clearConfirmTimer = null;

  function createHoverOverlay() {
    if (hoverOverlay) return hoverOverlay;

    hoverOverlay = document.createElement('div');
    hoverOverlay.id = 'owned-hover-overlay';
    hoverOverlay.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = CHECKBOX_CLASS;
    input.setAttribute('aria-label', 'Mark item as owned');
    input.addEventListener('change', (event) => {
      if (!overlayTileId) return;
      const stored = new Set(getStoredIds());
      if (event.target.checked) {
        stored.add(overlayTileId);
        console.debug('owned-db: checked', overlayTileId);
      } else {
        stored.delete(overlayTileId);
        console.debug('owned-db: unchecked', overlayTileId);
      }
      saveStoredIds(Array.from(stored));
      decorateViewerTiles();
    });

    const label = document.createElement('label');
    label.className = CHECKBOX_WRAPPER_CLASS;
    label.appendChild(input);

    const text = document.createElement('span');
    text.textContent = 'Owned';
    label.appendChild(text);
    hoverOverlay.appendChild(label);

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

    hoverOverlay.addEventListener('mouseenter', keepOverlayVisible);
    hoverOverlay.addEventListener('mousemove', keepOverlayVisible);
    hoverOverlay.addEventListener('mouseleave', beginHideOverlay);

    hoverOverlay.addEventListener('pointerenter', keepOverlayVisible);
    hoverOverlay.addEventListener('pointermove', keepOverlayVisible);
    hoverOverlay.addEventListener('pointerleave', beginHideOverlay);

    document.body.appendChild(hoverOverlay);
    return hoverOverlay;
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
    const overlay = createHoverOverlay();
    const rect = tile.getBoundingClientRect();
    overlay.style.left = `${window.scrollX + rect.left + 8}px`;
    overlay.style.top = `${window.scrollY + rect.top + 8}px`;
    overlay.style.display = 'inline-flex';
    const checkbox = overlay.querySelector(`.${CHECKBOX_CLASS}`);
    if (checkbox) {
      checkbox.checked = new Set(getStoredIds()).has(tileId);
    }
  }

  function hideHoverOverlay() {
    if (!hoverOverlay) return;
    hoverOverlay.style.display = 'none';
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
    if (!hoverOverlay || !tile) return;
    const rect = tile.getBoundingClientRect();
    hoverOverlay.style.left = `${window.scrollX + rect.left + 8}px`;
    hoverOverlay.style.top = `${window.scrollY + rect.top + 8}px`;
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

    if (owned === hasBadge) return;

    if (owned) {
      const badge = document.createElement('div');
      badge.className = BADGE_CLASS;
      badge.textContent = '(OWNED)';
      priceEl.appendChild(badge);
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
    countEl.textContent = `Marked as owned: ${getStoredIds().length}`;
  }

  function showPanelMessage(text, isError) {
    const msg = document.getElementById('owned-db-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = isError ? '#f88' : '#a9d18e';
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
        <button id="owned-db-clear" type="button">Clear Owned</button>
      </div>
      <div id="owned-db-msg" class="owned-db-msg"></div>
      <div id="owned-db-count" class="owned-db-count">Stored owned items: 0</div>
    `;

    document.body.appendChild(panel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    panel.appendChild(fileInput);

    document.getElementById('owned-db-export').addEventListener('click', () => {
      const ids = getStoredIds();
      console.debug('owned-db: export', ids);
      const json = JSON.stringify(ids, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'owned-items.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      updateStoredItemCount();
      showPanelMessage(`Exported ${ids.length} item ID(s).`);
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
        if (!Array.isArray(parsed)) {
          showPanelMessage('JSON must be an array of item IDs.', true);
          return;
        }
        saveStoredIds(parsed);
        decorateViewerTiles();
        showPanelMessage(`Imported ${parsed.filter(id => typeof id === 'string' && id.trim()).length} item ID(s).`);
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
        decorateViewerTiles();
        updateStoredItemCount();
        showPanelMessage('Cleared owned items.');
        clearButton.textContent = 'Clear Owned';
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
  }

  function initControls() {
    createImportExportPanel();
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

    decorateViewerTiles();
    installResultObserver();
    setupHoverOverlayDelegation();
    initControls();
    updateStoredItemCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  window.addEventListener('load', init, { once: true });
})();
