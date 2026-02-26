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
// DST helpers: automatically detect Eastern Daylight/Standard Time per-date.
// Manual overrides via window.__siteConfig.dstHourOffset are intentionally ignored
// to avoid stale page-level overrides causing incorrect remaining-time math.

// Determine DST offset hours for America/New_York for a specific date.
// Returns 4 when the date falls in Eastern Daylight Time (UTC-4),
// 5 when in Eastern Standard Time (UTC-5).
function getDstHourOffsetForDate(dateLike) {
  // Try to detect via Intl: format the given instant in America/New_York and inspect the timeZoneName (EDT/EST)
  try {
    const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
    if (isNaN(d.getTime())) return 4; // fallback
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(d);
    const tzn = (parts.find(p => p.type === 'timeZoneName') || {}).value || '';
    if (typeof tzn === 'string' && tzn.toUpperCase().includes('DT')) return 4; // EDT
    return 5; // EST
  } catch (e) {
    // Intl/timeZone not supported -> fallback to +4
    return 4;
  }
}

function getDstAdjustedDate(input) {
  // input can be a Date or a string
  const raw = (input instanceof Date) ? new Date(input.getTime()) : new Date(input);
  if (isNaN(raw.getTime())) return raw; // invalid date -> return as-is (NaN)
  // compute offset hours for this specific date (allows switching between EDT/EST based on date)
  const hours = getDstHourOffsetForDate(raw);
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
    timeText = `${t.days} Days`;
  } else if (t.hours > 0) {
    timeText = `${t.hours} Hours`;
  } else if (t.minutes > 0) {
    timeText = `${t.minutes} Mins`;
  } else {
    timeText = `${t.seconds} Secs`;
  }
  return `<div class="tile-timer" title="Time until this item leaves the shop." data-expires="${expiresAt}">
    <span class="timer-text">
      <span class="line1">limited time!</span><br>
      <span class="line2">${timeText}</span>
    </span>
  </div>`;
}

export function renderSecondaryTimerHTML(expiresAt) {
  const t = getTimeRemaining(expiresAt);
  if (t.expired) return '';
  let timeText;
  if (t.days > 0) {
    timeText = `${t.days} ${t.days === 1 ? 'Day' : 'Days'}`;
  } else if (t.hours > 0) {
    timeText = `${t.hours} ${t.hours === 1 ? 'Hour' : 'Hours'}`;
  } else if (t.minutes > 0) {
    timeText = `${t.minutes} ${t.minutes === 1 ? 'Min' : 'Mins'}`;
  } else {
    timeText = `${t.seconds} ${t.seconds === 1 ? 'Sec' : 'Secs'}`;
  }
  return `<div class="tile-timer-secondary" title="Time until discount expires." data-expires="${expiresAt}">
    <span class="timer-text">
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
  if (typeof ltoTimer !== 'string') return false;
  const timerDate = getDstAdjustedDate(ltoTimer);
  if (!(timerDate instanceof Date) || isNaN(timerDate.getTime())) return false;
  return timerDate.getTime() < Date.now();
}

// Backwards-compatible exposure for the existing monolithic script
if (typeof window !== 'undefined') {
  window.__utils = window.__utils || {};
  window.__utils.buildImageUrl = buildImageUrl;
  window.__utils.getTimeRemaining = getTimeRemaining;
  window.__utils.renderTimerHTML = renderTimerHTML;
  window.__utils.renderSecondaryTimerHTML = renderSecondaryTimerHTML;
  window.__utils.renderDateRange = renderDateRange;
}

if (typeof window !== 'undefined') {
  window.__utils.isLtoExpired = isLtoExpired;
}

// Expose DST/date helpers so other modules can use the same adjusted logic
if (typeof window !== 'undefined') {
  window.__utils.getDstAdjustedDate = getDstAdjustedDate;
  window.__utils.getDstHourOffsetForDate = getDstHourOffsetForDate;
  window.__utils.debugParse = function(input) {
    try {
      const d = (input instanceof Date) ? input : new Date(input);
      const off = getDstHourOffsetForDate(d);
      const adjusted = getDstAdjustedDate(d);
      console.log('raw:', d.toISOString(), 'offsetHours:', off, 'adjusted:', adjusted.toISOString());
      return { raw: d, offsetHours: off, adjusted };
    } catch (e) { console.error('debugParse error', e); return null; }
  };
}

// Update all tile timers in the DOM
export function updateAllTimers() {
  // update both primary and secondary timer elements
  document.querySelectorAll('.tile-timer[data-expires], .tile-timer-secondary[data-expires]').forEach(el => {
    const expiresAt = el.getAttribute('data-expires');
    const t = getTimeRemaining(expiresAt);
    const line2 = el.querySelector('.line2');
    if (!line2) return;
    if (t.expired) {
      line2.textContent = 'expired';
      return;
    }
    if (t.days > 0) {
      line2.textContent = `${t.days} ${t.days === 1 ? 'Day' : 'Days'}`;
    } else if (t.hours > 0) {
      line2.textContent = `${t.hours} ${t.hours === 1 ? 'Hour' : 'Hours'}`;
    } else if (t.minutes > 0) {
      line2.textContent = `${t.minutes} ${t.minutes === 1 ? 'Min' : 'Mins'}`;
    } else {
      line2.textContent = `${t.seconds} ${t.seconds === 1 ? 'Sec' : 'Secs'}`;
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
