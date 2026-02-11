/**
 * Configuration Loader
 * Loads website metadata, timestamps, and news from config.json
 * and applies them to the page
 */

async function loadConfig() {
  try {
    const response = await fetch('data/config.json');
    if (!response.ok) throw new Error('Failed to load config.json');
    
    const config = await response.json();

    // Apply meta tags
    applyMetaTags(config.meta);

    // Apply timestamps
    applyTimestamps(config.timestamps);

    // Expose config globally for other scripts to use
    window.__config = config;
    
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function applyMetaTags(meta) {
  // Default values for fields you don't frequently change
  const defaults = {
    themeColor: '#ffd454',
    ogDescription: 'Transparent pricing, correct images, and user-friendly info for the Fallout 76 Atomic Shop.',
    author: 'Transparent Atomic Shop',
    twitterCard: 'summary_large_image'
  };

  // Apply theme-color (default if not in config)
  updateOrCreateMetaTag('name', 'theme-color', defaults.themeColor);

  // Apply frequently-changed fields
  if (meta.ogTitle) {
    updateOrCreateMetaTag('property', 'og:title', meta.ogTitle);
  }

  // Apply og:description (default if not in config)
  updateOrCreateMetaTag('property', 'og:description', defaults.ogDescription);

  if (meta.ogSiteName) {
    updateOrCreateMetaTag('property', 'og:site_name', meta.ogSiteName);
  }

  // Apply author (default if not in config)
  updateOrCreateMetaTag('name', 'author', defaults.author);

  // Single image URL used for both og:image and twitter:image
  if (meta.image) {
    updateOrCreateMetaTag('property', 'og:image', meta.image);
    updateOrCreateMetaTag('name', 'twitter:image:src', meta.image);
  }

  // Apply twitter:card (default if not in config)
  updateOrCreateMetaTag('name', 'twitter:card', defaults.twitterCard);
}

function applyTimestamps(timestamps) {
  const format = iso => new Date(iso).toLocaleString(undefined, { 
    dateStyle: 'short', 
    timeStyle: 'short' 
  });

  const nodes = document.querySelectorAll('#last-updated');
  if (nodes.length > 0) {
    // first occurrence = "last updated"
    nodes[0].textContent = format(timestamps.lastUpdated);

    // second occurrence (if present) = "next update"
    if (nodes[1]) {
      nodes[1].textContent = format(timestamps.nextScheduled);
    } else {
      // if HTML only has one element with that id, append a next-update line after it
      nodes[0].insertAdjacentHTML('afterend',
        '<br><span id="next-updated">' + format(timestamps.nextScheduled) + '</span>');
    }
  }

  // Also store in window for other scripts to access
  window.__timestamps = timestamps;
}

function updateOrCreateMetaTag(attrName, attrValue, content) {
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  
  if (tag) {
    tag.content = content;
  } else {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    tag.content = content;
    document.head.appendChild(tag);
  }
}

// Auto-load config when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadConfig);
} else {
  loadConfig();
}
