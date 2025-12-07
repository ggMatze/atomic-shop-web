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

  // Build and render the checkboxes based on DailySalesWeekMeta
  function renderWeekCheckboxes() {
    const weekMeta = window.dailySalesWeekMeta || {};
    const weeks = Object.keys(weekMeta).sort();
    
    if (weeks.length === 0) {
      filterContainer.style.display = 'none';
      return;
    }

    checkboxesContainer.innerHTML = '';
    const savedVisibility = getSavedWeekVisibility();

    weeks.forEach(weekKey => {
      const isHiddenByDefault = weekMeta[weekKey]?.hidden === true;
      const isChecked = savedVisibility ? (savedVisibility[weekKey] !== false) : !isHiddenByDefault;

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
  window.__weekFilter.renderWeekCheckboxes = renderWeekCheckboxes;
  window.__weekFilter.updateFilterVisibility = updateFilterVisibility;
  window.__weekFilter.getSavedWeekVisibility = getSavedWeekVisibility;
}

export { initWeekFilter };
