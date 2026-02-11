/**
 * Configuration Loader
 * Loads timestamps and news from data/config.json and exposes the config
 * Meta tags are managed directly inside the HTML (index.html) to ensure
 * embedded scripts and third-party widgets load reliably.
 */

async function loadConfig() {
  try {
    const response = await fetch('data/config.json');
    if (!response.ok) throw new Error('Failed to load config.json');
    
    const config = await response.json();

    // Apply timestamps if present
    if (config.timestamps) {
      applyTimestamps(config.timestamps);
    }

    // Expose config globally for other scripts to use
    window.__config = config;
    
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function applyTimestamps(timestamps) {
  if (!timestamps) return;

  const format = iso => {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  };

  const nodes = document.querySelectorAll('#last-updated');
  if (nodes.length > 0) {
    nodes[0].textContent = format(timestamps.lastUpdated);

    if (nodes[1]) {
      nodes[1].textContent = format(timestamps.nextScheduled);
    } else {
      nodes[0].insertAdjacentHTML('afterend',
        '<br><span id="next-updated">' + format(timestamps.nextScheduled) + '</span>');
    }
  }

  window.__timestamps = timestamps;
}

// Auto-load config when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadConfig);
} else {
  loadConfig();
}
