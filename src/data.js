export const currencyData = {
  atoms: { symbol: '⚛', rate: 1 },               // Atoms (in-game currency)
  usd: { symbol: '$', rate: 4.99 / 500 },        // United States Dollar — 500 atoms = $4.99
  eur: { symbol: '€', rate: 4.99 / 500 },        // Euro — 500 atoms = €4.99
  gbp: { symbol: '£', rate: 3.99 / 500 },        // British Pound Sterling — 500 atoms = £3.99
  cad: { symbol: 'C$', rate: 6.49 / 500 },       // Canadian Dollar — 500 atoms = C$6.49
  jpy: { symbol: '¥', rate: 550 / 500 },         // Japanese Yen — 500 atoms = ¥550
  cny: { symbol: '¥', rate: 20 / 500 },          // Chinese Yuan (CNY) — 500 atoms = ¥20
  hkd: { symbol: 'HK$', rate: 39 / 500 },        // Hong Kong Dollar — 500 atoms = HK$39
  twd: { symbol: 'NT$', rate: 150 / 500 },      // Taiwan Dollar (TWD) — 500 atoms = NT$150
  aud: { symbol: 'A$', rate: 7.95 / 500 },       // Australian Dollar — 500 atoms = A$7.95
  krw: { symbol: '₩', rate: 5770 / 500 },        // South Korean Won — 500 atoms = ₩5770
  inr: { symbol: '₹', rate: 399 / 500 },         // Indian Rupee — 500 atoms = ₹399
  mxn: { symbol: 'MX$', rate: 89 / 500 },        // Mexican Peso — 500 atoms = Mex$89
  brl: { symbol: 'R$', rate: 19.99 / 500 },      // Brazilian Real — 500 atoms = R$19.99
  rub: { symbol: '₽', rate: 0 / 500 /*no listing*/ } // Russian Ruble — N/A / no listing on SteamDB
};

const STORAGE_KEY = 'selectedCurrency';

export function getSavedCurrency() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && currencyData[v] ? v : null;
  } catch (e) {
    return null;
  }
}

export function saveCurrency(key) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch (e) {}
}

// Backwards-compatible exposure
if (typeof window !== 'undefined') {
  window.__data = window.__data || {};
  window.__data.currencyData = currencyData;
  window.__data.getSavedCurrency = getSavedCurrency;
  window.__data.saveCurrency = saveCurrency;
}
