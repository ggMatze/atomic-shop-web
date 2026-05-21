// No dynamic `legacyIndex` lookup; use the static fallback list if present.
// Keep an empty fallback here so filenames are not hardcoded in source.
const LEGACY_STORE_FILES = [];

function isoWeekStart(year, week) {
  // Return a Date for the Monday of the given ISO week/year (UTC-based)
  const y = Number(year);
  const w = Number(week);
  // Jan 4th is always in week 1
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() === 0) ? 7 : jan4.getUTCDay();
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  // shift to Tuesday (files are created on Tuesday)
  const oneDay = 86400000;
  const target = new Date(week1Monday.getTime() + (w - 1) * 7 * 86400000 + oneDay);
  return target;
}

function formatLegacyLabel(fileName) {

  // Try several filename patterns to extract week, year and optional suffix (a/b)
  let week = null, year = null, suffix = '';
  let m = fileName.match(/(\d{1,2})w(\d{2,4})([ab])?\.json/i);
  if (m) { week = m[1]; year = m[2]; suffix = m[3] || ''; }
  else {
    m = fileName.match(/(\d{1,2})([ab])?w(\d{2,4})/i);
    if (m) { week = m[1]; suffix = m[2] || ''; year = m[3]; }
    else {
      m = fileName.match(/(\d{1,2})a(\d{2,4})w/i); // handles patterns like 38a25w
      if (m) { week = m[1]; year = m[2]; suffix = 'a'; }
    }
  }

  if (week && year) {
    // Normalize two-digit years to 2000+
    if (year.length === 2) year = String(2000 + Number(year));
    const dt = isoWeekStart(Number(year), Number(week));
    const formatted = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const suff = suffix ? ` ${suffix.toUpperCase()}` : '';
    return `${formatted}${suff}`;
  }

  return fileName;
}

function getLegacyStoreUrl(fileName) {
  return `old-data/${encodeURIComponent(fileName)}`;
}

// Lightweight discovery: try directory HTML listings only.
// This does NOT attempt to fetch `legacyIndex.json`.
async function fetchLegacyFiles() {
  const candidates = [
    'old-data/',
    '/old-data/'
  ];

  for (const c of candidates) {
    try {
      const res = await fetch(c);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';

      // Only parse HTML directory listings
      if (!contentType.includes('text/html')) continue;

      const text = await res.text();
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a'));
        const hrefs = anchors.map(a => a.getAttribute('href') || '').map(h => h.replace(/^\/+/, '')).filter(Boolean);
        const found = Array.from(new Set(hrefs)).filter(h => /(storepage|storepagedata).*\.json$/i.test(h));
        if (found.length) return found;
      } catch (e) {
        const matches = Array.from(text.matchAll(/href\s*=\s*"([^"]+)"/ig)).map(m => m[1]).filter(Boolean);
        const found = Array.from(new Set(matches)).map(h => h.replace(/^\/+/, '')).filter(h => /(storepage|storepagedata).*\.json$/i.test(h));
        if (found.length) return found;
      }

    } catch (e) {
      // ignore and try next
    }
  }

  return [];
}

function cleanupLegacyLto(storeData) {
  if (!storeData || typeof storeData !== 'object') return storeData;
  const copied = JSON.parse(JSON.stringify(storeData));
  const pages = copied?.StorePageData?.pages;
  if (!Array.isArray(pages)) return copied;

  pages.forEach(page => {
    const items = Array.isArray(page.items) ? page.items : [];
    items.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (item.lowPrice && typeof item.lowPrice === 'object') {
        delete item.lowPrice.ltoTimer;
        delete item.lowPrice.ltoType;
        item.lowPrice.isLto = false;
      }
      delete item.ltoTimer;
      delete item.ltoType;
      item.isLto = false;
      delete item.endTime;
    });
  });

  return copied;
}

async function loadLegacyStoreData(fileName) {
  // Accept either a full path/URL or a bare filename. Try the current
  // `old-data` variants so this works on your renamed directory.
  const candidates = [];
  const raw = String(fileName || '');
  // If it already looks like a path/URL, try it as-is first
  if (raw.includes('/') || raw.includes('%')) candidates.push(raw);
  // Common directory variants
  candidates.push(`old-data/${raw}`);
  candidates.push(`/old-data/${raw}`);
  // Encoded filename variants
  try { candidates.push(`old-data/${encodeURIComponent(raw)}`); } catch (e) { /* ignore */ }

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      return cleanupLegacyLto(data);
    } catch (e) {
      // try next candidate
      continue;
    }
  }

  throw new Error(`Failed to fetch legacy file ${fileName} from candidates: ${candidates.join(', ')}`);
}

function installLegacyStoreLoader() {
  const originalLoader = window.__dataLoader && typeof window.__dataLoader.loadDailyAndStore === 'function'
    ? window.__dataLoader.loadDailyAndStore.bind(window.__dataLoader)
    : async () => ({ dailyReplacementsData: {}, storeData: {} });

  window.__legacyStoreSwitcher = window.__legacyStoreSwitcher || {
    selectedLegacyFile: '',
    isLegacyMode: false
  };

  window.__dataLoader = window.__dataLoader || {};
  window.__dataLoader._originalLoadDailyAndStore = originalLoader;

  window.__dataLoader.loadDailyAndStore = async function() {
    const baseResult = await originalLoader();
    const selectedFile = window.__legacyStoreSwitcher.selectedLegacyFile;
    if (!selectedFile) return baseResult;

    try {
      const legacyStoreData = await loadLegacyStoreData(selectedFile);
      return {
        ...baseResult,
        storeData: legacyStoreData
      };
    } catch (error) {
      console.warn('[legacyStoreSwitcher] Could not load legacy store file:', selectedFile, error);
      return baseResult;
    }
  };
}

async function createLegacyDropdown() {
  const menuRight = document.querySelector('.menu-left');
  if (!menuRight) return;
  // Sort files by parsed week/year -> date, then by suffix (A/B)
  function parseMeta(fn) {
    let week = null, year = null, suffix = '';
    let m = fn.match(/(\d{1,2})w(\d{2,4})([ab])?\.json/i);
    if (m) { week = m[1]; year = m[2]; suffix = m[3] || ''; }
    else {
      m = fn.match(/(\d{1,2})([ab])?w(\d{2,4})/i);
      if (m) { week = m[1]; suffix = m[2] || ''; year = m[3]; }
      else {
        m = fn.match(/(\d{1,2})a(\d{2,4})w/i);
        if (m) { week = m[1]; year = m[2]; suffix = 'a'; }
      }
    }
    if (!week || !year) return null;
    if (year.length === 2) year = String(2000 + Number(year));
    const dt = isoWeekStart(Number(year), Number(week));
    return { ts: dt.getTime(), suffix: (suffix || '').toUpperCase() };
  }

  // If the static list is empty, attempt dynamic discovery via directory listing
  let rawList = LEGACY_STORE_FILES.slice();
  if (!rawList.length) {
    const discovered = await fetchLegacyFiles();
    if (Array.isArray(discovered) && discovered.length) rawList = discovered;
  }

  // Normalize entries: strip any path component and decode URI parts so the
  // option values are just the base filenames (e.g. storepagedata02w26.json).
  const sourceList = Array.from(new Set(rawList.map(s => {
    try {
      const dec = decodeURIComponent(String(s));
      const parts = dec.split(/[\\/]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : dec;
    } catch (e) {
      const parts = String(s).split(/[\\/]/).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(s);
    }
  }).filter(Boolean)));

  const sortedFiles = sourceList.slice().sort((a, b) => {
    const ma = parseMeta(a);
    const mb = parseMeta(b);
    if (ma && mb) {
      if (ma.ts !== mb.ts) return ma.ts - mb.ts;
      // same week: put plain first, then A, then B
      const sa = ma.suffix || '';
      const sb = mb.suffix || '';
      if (sa === sb) return a.localeCompare(b);
      if (!sa) return -1;
      if (!sb) return 1;
      return sa.localeCompare(sb);
    }
    if (ma && !mb) return -1;
    if (!ma && mb) return 1;
    return a.localeCompare(b);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'legacy-store-selector';
  if (!sortedFiles.length) {
    wrapper.innerHTML = `
      <label for="legacy-data-select">&nbsp;</label>
      <select id="legacy-data-select">
        <option value="">Now / Live</option>
      </select>
    `;
  } else {
    wrapper.innerHTML = `
      <label for="legacy-data-select">&nbsp;</label>
      <select id="legacy-data-select">
        <option value="">Now / Live</option>
        ${sortedFiles.map(name => `<option value="${name}">${formatLegacyLabel(name)}</option>`).join('')}
      </select>
    `;
  }

  const select = wrapper.querySelector('#legacy-data-select');
  select.addEventListener('change', async () => {
    window.__legacyStoreSwitcher.selectedLegacyFile = select.value;
    window.__legacyStoreSwitcher.isLegacyMode = !!select.value;

    if (window.__tabs && typeof window.__tabs.initTabs === 'function') {
      await window.__tabs.initTabs();
    }
  });

  menuRight.insertBefore(wrapper, menuRight.firstChild);
}

function initLegacyStoreSwitcher() {
  installLegacyStoreLoader();
  createLegacyDropdown();
}

document.addEventListener('DOMContentLoaded', initLegacyStoreSwitcher);
