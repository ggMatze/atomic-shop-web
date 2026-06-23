// Centralized JSON loader for store/daily/news data
export async function loadDailyAndStore() {
  const results = {};
  try {
    const dailyRes = await fetch('/data/dailyitems.json');
    results.dailyReplacementsData = dailyRes.ok ? await dailyRes.json() : {};
  } catch (e) {
    results.dailyReplacementsData = {};
  }
  try {
    const storeRes = await fetch('/data/storepagedata.json');
    results.storeData = storeRes.ok ? await storeRes.json() : {};
  } catch (e) {
    results.storeData = {};
  }
  return results;
}

export async function loadNews() {
  try {
    const res = await fetch('/data/config.json');
    if (!res.ok) return null;
    const config = await res.json();
    // Always return the news object (overlay will decide how to display expiry)
    return config.news || null;
  } catch (e) {
    return null;
  }
}

// Backwards-compatible exposure
if (typeof window !== 'undefined') {
  window.__dataLoader = window.__dataLoader || {};
  window.__dataLoader.loadDailyAndStore = loadDailyAndStore;
  window.__dataLoader.loadNews = loadNews;
}
