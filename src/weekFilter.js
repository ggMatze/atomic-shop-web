// Week Filter module: handles show/hide weeks in preview tab
// Exposes functions on window.__weekFilter for legacy script.js to call

function initWeekFilter() {
  const filterContainer = document.getElementById('week-filter-controls');
  const checkboxesContainer = document.getElementById('week-checkboxes-container');
  
  if (!filterContainer || !checkboxesContainer) return;

  // Load saved week visibility from localStorage
  function getSavedWeekVisibility() {
    const saved = localStorage.getItem('weekVisibility');
    return saved ? JSON.parse(saved) : null;
  }

  function saveWeekVisibility(visibility) {
    localStorage.setItem('weekVisibility', JSON.stringify(visibility));
  }

  // Build and render the checkboxes based on DailySalesWeekMeta and actual available weeks
  function renderWeekCheckboxes() {
    const weekMeta = window.dailySalesWeekMeta || {};
    // Only consider weeks that actually have data in DailySalesByWeek
    const dataWeeks = Object.keys(window.dailySalesByWeek || {}).filter(k => Array.isArray(window.dailySalesByWeek[k]) && window.dailySalesByWeek[k].length > 0);
    const metaWeeks = Object.keys(weekMeta);
    // Merge meta and data keys but only keep weeks that have actual data
    const weeks = [...new Set([...metaWeeks, ...dataWeeks])].filter(k => dataWeeks.includes(k)).sort();

    // Clean saved visibility entries for weeks that no longer exist
    try {
      const saved = getSavedWeekVisibility();
      if (saved) {
        let changed = false;
        Object.keys(saved).forEach(k => { if (!weeks.includes(k)) { delete saved[k]; changed = true; } });
        if (changed) saveWeekVisibility(saved);
      }
    } catch (e) { /* ignore */ }

    // If there's zero or only one week available, hide the week filter entirely
    if (weeks.length <= 1) {
      filterContainer.style.display = 'none';
      return;
    }

    checkboxesContainer.innerHTML = '';
    // Normalize saved visibility to booleans so old string values like 'false' don't cause mismatches
    const rawSavedVisibility = getSavedWeekVisibility() || {};
    const savedVisibility = {};
    Object.keys(rawSavedVisibility).forEach(k => {
      const v = rawSavedVisibility[k];
      if (v === true || v === 'true' || v === 1 || v === '1') savedVisibility[k] = true;
      else if (v === false || v === 'false' || v === 0 || v === '0') savedVisibility[k] = false;
      // ignore other values
    });

    // If normalization changed the shape, persist the cleaned values back to localStorage
    try {
      const rawStr = JSON.stringify(rawSavedVisibility);
      const normStr = JSON.stringify(savedVisibility);
      if (rawStr !== normStr) saveWeekVisibility(savedVisibility);
    } catch (e) { /* ignore */ }

    weeks.forEach(weekKey => {
      const isHiddenByDefault = weekMeta[weekKey]?.hidden === true;
      const isChecked = (savedVisibility[weekKey] !== undefined) ? Boolean(savedVisibility[weekKey]) : !isHiddenByDefault;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'week-checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `week-checkbox-${weekKey}`;
      checkbox.checked = isChecked;
      checkbox.dataset.weekKey = weekKey;

      const label = document.createElement('label');
      label.htmlFor = `week-checkbox-${weekKey}`;
      label.textContent = weekKey;

      checkbox.addEventListener('change', () => {
        // Prevent unchecking the last visible week so the preview never becomes empty
        const allCheckboxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]');
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        if (checkedCount === 0) {
          // revert the change and persist that at least one week must stay checked
          checkbox.checked = true;
          // optional: visual feedback could be added here
          return;
        }

        const visibility = getSavedWeekVisibility() || {};
        visibility[weekKey] = checkbox.checked;
        saveWeekVisibility(visibility);

        // Re-render the preview tab
        if (window.__tabs && typeof window.__tabs.renderCustomDailyTab === 'function') {
          window.__tabs.renderCustomDailyTab();
          // Re-attach tile click handlers
          if (window.__ui && typeof window.__ui.attachTileClickHandlers === 'function') {
            window.__ui.attachTileClickHandlers();
          }
        }
      });

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      checkboxesContainer.appendChild(itemDiv);
    });

    filterContainer.style.display = 'block';
  }

  // Show/hide the filter box based on current tab
  function updateFilterVisibility(tabIndex) {
    if (tabIndex === 'preview') {
      filterContainer.style.display = 'block';
    } else {
      filterContainer.style.display = 'none';
    }
  }

  // Expose functions
  window.__weekFilter = window.__weekFilter || {};
  window.__weekFilter.initWeekFilter = initWeekFilter;
  window.__weekFilter.renderWeekCheckboxes = renderWeekCheckboxes;
  window.__weekFilter.updateFilterVisibility = updateFilterVisibility;
  window.__weekFilter.getSavedWeekVisibility = getSavedWeekVisibility;
}

// Initialize immediately on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWeekFilter);
} else {
  initWeekFilter();
}
