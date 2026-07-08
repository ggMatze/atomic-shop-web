(function () {
  const BRIDGE_ORIGIN = 'https://db.atomicshop.fyi';
  const BRIDGE_URL = `${BRIDGE_ORIGIN}/db-viewer/bridge.html`;
  const STORAGE_KEYS = ['wishlist', 'tracked', 'owned'];

  let iframe = null;
  let ready = false;
  let pendingMessages = [];
  let initialized = false;

  function createIframe() {
    if (iframe) return iframe;

    iframe = document.createElement('iframe');
    iframe.src = BRIDGE_URL;
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    document.body.appendChild(iframe);
    return iframe;
  }

  function normalizeData(data) {
    const result = {
      wishlist: [],
      tracked: [],
      owned: []
    };

    if (!data || typeof data !== 'object') return result;

    STORAGE_KEYS.forEach((key) => {
      const value = data[key];
      if (Array.isArray(value)) {
        result[key] = value;
      } else if (value && typeof value === 'object') {
        result[key] = [value];
      }
    });

    return result;
  }

  function readLocalData() {
    const result = {};
    STORAGE_KEYS.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          result[key] = Array.isArray(parsed) ? parsed : [];
        } else {
          result[key] = [];
        }
      } catch (e) {
        result[key] = [];
      }
    });

    return result;
  }

  function persistLocalData(data) {
    const normalized = normalizeData(data);
    STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify(normalized[key] || []));
      } catch (e) {
        console.warn('[iframe-sync] Failed to persist local storage', e);
      }
    });
    return normalized;
  }

  function flushQueue() {
    if (!ready || !iframe || !iframe.contentWindow) return;
    while (pendingMessages.length) {
      const message = pendingMessages.shift();
      iframe.contentWindow.postMessage(message, BRIDGE_ORIGIN);
    }
  }

  function sendMessage(message) {
    if (!iframe) createIframe();
    if (!ready || !iframe.contentWindow) {
      pendingMessages.push(message);
      return;
    }
    iframe.contentWindow.postMessage(message, BRIDGE_ORIGIN);
  }

  function requestData() {
    sendMessage({ type: 'GET_DATA', payload: {} });
  }

  function setData(data) {
    sendMessage({ type: 'SET_DATA', payload: normalizeData(data) });
  }

  function updateItem(section, item, add = true) {
    sendMessage({
      type: 'UPDATE_ITEM',
      payload: {
        section,
        item,
        add
      }
    });
  }

  function applyRemoteData(data) {
    const normalized = persistLocalData(data);
    window.dispatchEvent(new CustomEvent('iframe-sync:data', { detail: normalized }));
    return normalized;
  }

  function handleBridgeMessage(event) {
    if (!event || event.origin !== BRIDGE_ORIGIN) return;
    const message = event.data || {};

    if (!message || typeof message !== 'object') return;

    if (message.type === 'READY') {
      ready = true;
      flushQueue();
      return;
    }

    if (message.type === 'DATA') {
      applyRemoteData(message.payload || {});
      return;
    }

    if (message.type === 'SET_ACK' || message.type === 'UPDATE_ACK' || message.type === 'ACK') {
      window.dispatchEvent(new CustomEvent('iframe-sync:ack', { detail: message.payload || {} }));
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    createIframe();
    window.addEventListener('message', handleBridgeMessage);

    iframe.addEventListener('load', () => {
      requestData();
    });

    window.addEventListener('load', () => {
      requestData();
    });

    window.__iframeSync = {
      requestData,
      setData,
      updateItem,
      getState: readLocalData,
      isReady: () => ready
    };

    window.addEventListener('storage', () => {
      window.dispatchEvent(new CustomEvent('iframe-sync:local-change', { detail: readLocalData() }));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
