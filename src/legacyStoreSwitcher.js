const LEGACY_STORE_FILES = [];

function parseLegacyFileName(fileName) {
  const m = fileName.match(/^storepagedata(\d{2})w(\d{2})([ab])?\.json$/i);
  if (!m) return null;
  return {
    year: 2000 + Number(m[2]),
    week: Number(m[1]),
    suffix: m[3] || ''
  };
}

function getLegacyFileDate(fileName) {
  const parsed = parseLegacyFileName(fileName);
  if (!parsed) return null;
  return isoWeekStart(parsed.year, parsed.week);
}

function compareLegacyFileNames(a, b) {
  const leftDate = getLegacyFileDate(a);
  const rightDate = getLegacyFileDate(b);

  if (leftDate && rightDate) {
    const diff = rightDate.getTime() - leftDate.getTime();
    if (diff !== 0) return diff;
  } else if (leftDate) {
    return 1;
  } else if (rightDate) {
    return -1;
  }

  const left = parseLegacyFileName(a);
  const right = parseLegacyFileName(b);
  if (!left || !right) return a.localeCompare(b);

  const order = ['', 'a', 'b'];
  return order.indexOf(left.suffix) - order.indexOf(right.suffix);
}

async function fetchLegacyFileList() {
  if (LEGACY_STORE_FILES.length) return LEGACY_STORE_FILES;
  try {
    const res = await fetch('/old-data/legacy-store-files.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Unable to load legacy file manifest');

    const list = await res.json();
    if (Array.isArray(list) && list.length) {
      list.sort(compareLegacyFileNames);
      LEGACY_STORE_FILES.push(...list);
      return LEGACY_STORE_FILES;
    }

    console.warn('Legacy file manifest loaded but contained no entries.');
  } catch (err) {
    console.error('Unable to load legacy file manifest:', err);
  }

  return [];
}

/* -------------------- LABEL -------------------- */


function formatLegacyLabel(fileName) {
  const parsed = parseLegacyFileName(fileName);
  if (!parsed) return fileName;

  const dt = isoWeekStart(parsed.year, parsed.week);
  const formatted = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  return parsed.suffix ? `${formatted} ${parsed.suffix.toUpperCase()}` : formatted;
}

function isoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  // Atomic Shop labels use Tuesday updates, so shift the ISO week start forward one day.
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000 + 86400000);
}

/* -------------------- LTO CLEANUP -------------------- */

function deepCleanupLto(obj) {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) deepCleanupLto(item);
    return;
  }

  if (obj.lowPrice && typeof obj.lowPrice === "object") {
    obj.lowPrice.ltoTimer = null;
    obj.lowPrice.ltoType = null;
    obj.lowPrice.isLto = false;
  }

  obj.ltoTimer = null;
  obj.ltoType = null;
  obj.endTime = null;
  obj.isLto = false;

  for (const key in obj) {
    const val = obj[key];
    if (val && typeof val === "object") {
      deepCleanupLto(val);
    }
  }
}

function cleanupLegacyLto(data) {
  if (!data || typeof data !== "object") return data;

  const cloned = structuredClone
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));

  deepCleanupLto(cloned);

  return cloned;
}

/* -------------------- LOAD -------------------- */

function loadLegacyStoreData(fileName) {
  return fetch(`/old-data/${fileName}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
}

/* -------------------- WARNING BANNER -------------------- */

function ensureLegacyWarning() {
  let el = document.getElementById("legacy-warning-banner");

  if (!el) {
    el = document.createElement("div");
    el.id = "legacy-warning-banner";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "legacy-warning-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => {
      el.style.display = "none";
    });

    el.appendChild(closeBtn);

    const notice = document.createElement("div");
    notice.textContent = "You are viewing old shop data. Some content may be missing or inaccurate.";
    el.appendChild(notice);

    const sub = document.createElement("div");
    sub.textContent = "To return to the current store, select 'Now / Live' from the dropdown.";
    sub.className = "legacy-warning-subtext";
    el.appendChild(sub);

    document.body.appendChild(el);
  }

  return el;
}

function updateLegacyWarning(isLegacy) {
  const el = ensureLegacyWarning();
  if (!el) return;
  el.style.display = isLegacy ? "block" : "none";
}

/* -------------------- LOADER HOOK -------------------- */

let legacyStoreLoaderInstalled = false;

function isLegacySwitcherReady() {
  return window.__dataLoader && typeof window.__dataLoader.loadDailyAndStore === 'function' &&
         window.__tabs && typeof window.__tabs.initTabs === 'function';
}

function waitForLegacySwitcherReady(timeout = 10000) {
  return new Promise((resolve) => {
    if (isLegacySwitcherReady()) return resolve(true);

    const start = Date.now();
    const interval = setInterval(() => {
      if (isLegacySwitcherReady()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeout) {
        clearInterval(interval);
        resolve(false);
      }
    }, 150);
  });
}

async function installLegacyStoreLoader() {
  if (legacyStoreLoaderInstalled) return;
  legacyStoreLoaderInstalled = true;

  await waitForLegacySwitcherReady();

  const original =
    window.__dataLoader?.loadDailyAndStore?.bind(window.__dataLoader)
    || function () {
      return Promise.resolve({ storeData: {}, dailyReplacementsData: {} });
    };

  window.__legacyStoreSwitcher = window.__legacyStoreSwitcher || {
    selectedLegacyFile: "",
    isLegacyMode: false
  };

  window.__dataLoader = window.__dataLoader || {};
  window.__dataLoader._originalLoadDailyAndStore = original;

  window.__dataLoader.loadDailyAndStore = async function () {
    const base = await original();
    const file = window.__legacyStoreSwitcher.selectedLegacyFile;

    if (!file) {
      updateLegacyWarning(false);
      return base;
    }

    const legacy = await loadLegacyStoreData(file);
    if (!legacy) return base;

    const cleaned = cleanupLegacyLto(legacy);

    updateLegacyWarning(true);

    return {
      ...base,
      storeData: cleaned
    };
  };
}

/* -------------------- DROPDOWN -------------------- */

async function populateLegacyDropdownOptions(select) {
  if (!select || select.dataset.legacyOptionsInitialized === "true") return;
  select.dataset.legacyOptionsInitialized = "true";

  const files = (await fetchLegacyFileList()).slice().sort(compareLegacyFileNames);

  for (const file of files) {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = formatLegacyLabel(file);
    select.appendChild(option);
  }
}

async function createLegacyDropdown() {
  const menu = document.querySelector(".menu-left");
  if (!menu) return;

  const wrapper = document.createElement("div");
  wrapper.className = "legacy-store-selector";

  wrapper.innerHTML = `
    <label></label>
    <select id="legacy-data-select">
      <option value="">Now / Live</option>
    </select>
  `;

  menu.prepend(wrapper);

  const select = wrapper.querySelector("#legacy-data-select");
  if (!select) return;

  const loadOptions = async () => {
    select.style.cursor = "wait";
    try {
      await populateLegacyDropdownOptions(select);
    } finally {
      select.style.cursor = "";
    }
  };

  // Preload legacy option entries after setup, but load legacy data only when the user selects an entry.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadOptions, { timeout: 2000 });
  } else {
    setTimeout(loadOptions, 1500);
  }

  select.addEventListener("focus", loadOptions, { once: true });
  select.addEventListener("pointerdown", loadOptions, { once: true });

  select.addEventListener("change", async () => {
    const file = select.value;

    if (!legacyStoreLoaderInstalled) {
      await installLegacyStoreLoader();
    }

    window.__legacyStoreSwitcher.selectedLegacyFile = file;
    window.__legacyStoreSwitcher.isLegacyMode = !!file;

    updateLegacyWarning(!!file);

    if (window.__tabs?.initTabs) {
      await window.__tabs.initTabs();
    }
  });
}

/* -------------------- INIT -------------------- */

function initLegacyStoreSwitcher() {
  const waitForMenu = (callback) => {
    const menu = document.querySelector(".menu-left");
    if (menu) return callback(menu);
    setTimeout(() => waitForMenu(callback), 200);
  };

  const setup = async () => {
    await waitForLegacySwitcherReady();
    waitForMenu(() => createLegacyDropdown());
  };

  const scheduleSetup = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(setup, { timeout: 2000 });
    } else {
      setTimeout(setup, 1500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSetup);
  } else {
    scheduleSetup();
  }
}

document.addEventListener("DOMContentLoaded", initLegacyStoreSwitcher);