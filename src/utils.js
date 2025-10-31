// Utilities used across the app
export function buildImageUrl(directory, imageName) {
  if (!directory || !imageName) return '';
  if (/^https?:\/\//.test(imageName)) return imageName;
  let dir = directory.toLowerCase();
  let name = imageName.toLowerCase();
  if (!name.endsWith('.webp')) {
    name = name.replace('.dds', '.webp').replace('.png', '.webp');
  }
  return dir + name;
}
// DST/offset helper: allows applying a small, reversible hour offset to parsed store times.
// Set window.__siteConfig = window.__siteConfig || {}; then set window.__siteConfig.dstHourOffset = 1 (or -1) to adjust.
function getDstHourOffset() {
  if (typeof window === 'undefined') return 0;
  const cfg = window.__siteConfig || {};
  const v = Number(cfg.dstHourOffset);
  return Number.isFinite(v) ? v : 0;
}

function getDstAdjustedDate(input) {
  // input can be a Date or a string
  const raw = (input instanceof Date) ? new Date(input.getTime()) : new Date(input);
  if (isNaN(raw.getTime())) return raw; // invalid date -> return as-is (NaN)
  const hours = getDstHourOffset();
  if (!hours) return raw;
  return new Date(raw.getTime() + hours * 60 * 60 * 1000);
}
// Returns time remaining until expiresAt (ISO string), or expired flag
export function getTimeRemaining(expiresAt) {
  const now = new Date();
  const end = getDstAdjustedDate(expiresAt);
  const diff = end - now;
  if (diff <= 0) return { expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

// Renders HTML for a tile timer given an expiration time
export function renderTimerHTML(expiresAt) {
  const t = getTimeRemaining(expiresAt);
  if (t.expired) return '';
  let timeText;
  if (t.days > 0) {
    timeText = `${t.days} day${t.days > 1 ? 's' : ''}`;
  } else if (t.hours > 0) {
    timeText = `${t.hours} Hours`;
  } else if (t.minutes > 0) {
    timeText = `${t.minutes} Minutes`;
  } else {
    timeText = `${t.seconds} Seconds`;
  }
  return `<div class="tile-timer" data-expires="${expiresAt}">
    <span class="timer-text">
      <span class="line1">limited time!</span><br>
      <span class="line2">${timeText}</span>
    </span>
  </div>`;
}

// Renders date range HTML for item with startTime and endTime
export function renderDateRange(item) {
  const startDate = item.startTime ? getDstAdjustedDate(item.startTime) : null;
  const endDate = item.endTime ? getDstAdjustedDate(item.endTime) : null;
  const dateLabel = (startDate && endDate)
    ? `<div class="tile-dates">${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &ndash;<br> ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>`
    : '';

  return dateLabel;
}

export function isLtoExpired(item) {
  if (!item.lowPrice || !item.lowPrice.isLto) return false;
  const ltoTimer = item.lowPrice.ltoTimer;
  if (typeof ltoTimer !== 'string' || isNaN(Date.parse(ltoTimer))) return false;
  return getDstAdjustedDate(ltoTimer) < new Date();
}

// Backwards-compatible exposure for the existing monolithic script
if (typeof window !== 'undefined') {
  window.__utils = window.__utils || {};
  window.__utils.buildImageUrl = buildImageUrl;
  window.__utils.getTimeRemaining = getTimeRemaining;
  window.__utils.renderTimerHTML = renderTimerHTML;
  window.__utils.renderDateRange = renderDateRange;
}

if (typeof window !== 'undefined') {
  window.__utils.isLtoExpired = isLtoExpired;
}

// Update all tile timers in the DOM
export function updateAllTimers() {
  document.querySelectorAll('.tile-timer[data-expires]').forEach(el => {
    const expiresAt = el.getAttribute('data-expires');
    const t = getTimeRemaining(expiresAt);
    const line2 = el.querySelector('.line2');
    if (!line2) return;
    if (t.expired) {
      line2.textContent = 'expired';
      return;
    }
    if (t.days > 0) {
      line2.textContent = `${t.days} day${t.days > 1 ? 's' : ''}`;
    } else if (t.hours > 0) {
      line2.textContent = `${t.hours} hours`;
    } else if (t.minutes > 0) {
      line2.textContent = `${t.minutes} minutes`;
    } else {
      line2.textContent = `${t.seconds} seconds`;
    }
  });
}

// Start a repeating timer to update timers every second. Returns interval id.
export function startTimerUpdates() {
  updateAllTimers();
  return setInterval(updateAllTimers, 1000);
}

if (typeof window !== 'undefined') {
  window.__utils.updateAllTimers = updateAllTimers;
  window.__utils.startTimerUpdates = startTimerUpdates;
}
