const LEGACY_STORE_FILES = [];

/* -------------------- FILE GENERATION -------------------- */

function generateLegacyFileList() {
  const years = ["25", "26"];
  const MAX_INDEX = 60;

  const files = [];

  for (const year of years) {
    for (let i = 1; i <= MAX_INDEX; i++) {
      const idx = String(i).padStart(2, "0");

      files.push(`storepagedata${idx}w${year}.json`);
      files.push(`storepagedata${idx}w${year}a.json`);
      files.push(`storepagedata${idx}w${year}b.json`);
    }
  }

  return files;
}

/* -------------------- EXISTING FILE CHECK -------------------- */

async function filterExistingFiles(list) {
  const results = await Promise.all(
    list.map(async (file) => {
      try {
        const res = await fetch(`/old-data/${file}`, { cache: "no-store" });
        return res.ok ? file : null;
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}

/* -------------------- LABEL FORMAT -------------------- */

function formatLegacyLabel(fileName) {
  const m = fileName.match(/(\d{2})w(\d{2})([ab])?/i);
  if (!m) return fileName;

  const index = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const suffix = m[3] || "";

  const dt = isoWeekStart(year, index);

  const formatted = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return suffix ? `${formatted} ${suffix.toUpperCase()}` : formatted;
}

/* -------------------- ISO HELPERS -------------------- */

function isoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
}

/* -------------------- LTO CLEANER (ROBUST) -------------------- */

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

/* -------------------- LOAD FILE -------------------- */

function loadLegacyStoreData(fileName) {
  return fetch(`/old-data/${fileName}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
}

/* -------------------- INSTALL LOADER -------------------- */

function installLegacyStoreLoader() {
  const original =
    window.__dataLoader?.loadDailyAndStore?.bind(window.__dataLoader)
    || function () {
      return Promise.resolve({ storeData: {}, dailyReplacementsData: {} });
    };

  window.__legacyStoreSwitcher = {
    selectedLegacyFile: "",
    isLegacyMode: false
  };

  window.__dataLoader = window.__dataLoader || {};
  window.__dataLoader._originalLoadDailyAndStore = original;

  window.__dataLoader.loadDailyAndStore = async function () {
    const base = await original();
    const file = window.__legacyStoreSwitcher.selectedLegacyFile;

    if (!file) return base;

    const legacy = await loadLegacyStoreData(file);
    if (!legacy) return base;

    const cleaned = cleanupLegacyLto(legacy);

    return {
      ...base,
      storeData: cleaned
    };
  };
}

/* -------------------- DROPDOWN -------------------- */

async function createLegacyDropdown() {
  const menu = document.querySelector(".menu-left");
  if (!menu) return;

  const files = LEGACY_STORE_FILES.length
    ? LEGACY_STORE_FILES
    : await filterExistingFiles(generateLegacyFileList());

  const wrapper = document.createElement("div");
  wrapper.className = "legacy-store-selector";

  wrapper.innerHTML = `
    <label></label>
    <select id="legacy-data-select">
      <option value="">Now / Live</option>
      ${files.map(f => `
        <option value="${f}">
          ${formatLegacyLabel(f)}
        </option>
      `).join("")}
    </select>
  `;

  menu.prepend(wrapper);

  const select = wrapper.querySelector("#legacy-data-select");

  select.addEventListener("change", async () => {
    window.__legacyStoreSwitcher.selectedLegacyFile = select.value;
    window.__legacyStoreSwitcher.isLegacyMode = !!select.value;

    if (window.__tabs?.initTabs) {
      await window.__tabs.initTabs();
    }
  });
}

/* -------------------- INIT -------------------- */

function initLegacyStoreSwitcher() {
  const wait = () => {
    const menu = document.querySelector(".menu-left");

    if (!menu) return setTimeout(wait, 200);

    installLegacyStoreLoader();
    createLegacyDropdown();
  };

  wait();
}

document.addEventListener("DOMContentLoaded", initLegacyStoreSwitcher);