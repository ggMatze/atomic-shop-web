/**
 * Wishlist Module
 * Manages user wishlist and notifies when wishlist items become available in the atomic shop
 */

let storeData = null;
let itemsDb = null;
let wishlistItems = new Set();

/**
 * Load store data and items database
 */
async function loadWishlistData() {
  try {
    if (!storeData) {
      const storeRes = await fetch('data/storepagedata.json');
      storeData = await storeRes.json();
    }
    if (!itemsDb) {
      const itemsRes = await fetch('data/items-db.json');
      itemsDb = await itemsRes.json();
    }
    return true;
  } catch (e) {
    console.error('[wishlist] Failed to load data:', e);
    return false;
  }
}

/**
 * Get wishlist from localStorage
 */
function getWishlist() {
  try {
    const stored = localStorage.getItem('atomic-shop-wishlist');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[wishlist] Failed to parse wishlist from localStorage:', e);
    return [];
  }
}

/**
 * Save wishlist to localStorage
 */
function saveWishlist(items) {
  try {
    localStorage.setItem('atomic-shop-wishlist', JSON.stringify(items));
    wishlistItems = new Set(items.map(i => String(i).toLowerCase()));
  } catch (e) {
    console.error('[wishlist] Failed to save wishlist:', e);
  }
}

/**
 * Add item to wishlist
 */
export function addToWishlist(itemId) {
  const list = getWishlist();
  const idStr = String(itemId).toLowerCase();
  if (!list.find(i => String(i).toLowerCase() === idStr)) {
    list.push(itemId);
    saveWishlist(list);
    console.log('[wishlist] Added to wishlist:', itemId);
    updateWishlistButton();
  }
}

/**
 * Remove item from wishlist
 */
export function removeFromWishlist(itemId) {
  const list = getWishlist();
  const filtered = list.filter(i => String(i).toLowerCase() !== String(itemId).toLowerCase());
  saveWishlist(filtered);
  console.log('[wishlist] Removed from wishlist:', itemId);
  updateWishlistButton();
}

/**
 * Check if item is in wishlist
 */
export function isInWishlist(itemId) {
  return wishlistItems.has(String(itemId).toLowerCase());
}

/**
 * Find all available wishlist items in the current store rotation
 */
function findAvailableWishlistItems() {
  if (!storeData || !itemsDb) return [];

  const available = [];
  const wishlist = getWishlist();
  wishlistItems = new Set(wishlist.map(i => String(i).toLowerCase()));

  if (!Array.isArray(storeData.items)) return available;

  storeData.items.forEach(item => {
    const itemEdid = (item.EDID || item.edid || '').toLowerCase();
    const itemEntmName = (item.entmName || '').toLowerCase();
    const itemId = String(item.itemID || '').toLowerCase();

    // Check if this item is in wishlist
    let isWishlistItem = false;
    if (itemEdid && wishlistItems.has(itemEdid)) isWishlistItem = true;
    if (itemEntmName && wishlistItems.has(itemEntmName)) isWishlistItem = true;
    if (itemId && wishlistItems.has(itemId)) isWishlistItem = true;

    if (isWishlistItem) {
      available.push({
        itemId: item.itemID,
        itemName: item.itemName,
        EDID: item.EDID || item.edid,
        entmName: item.entmName,
        bundleItems: item.dynamicBundleItems || [],
        price: item.lowPrice?.atomPrice || 0,
        originalPrice: item.lowPrice?.baseAtomPrice || 0,
        discount: item.lowPrice?.discount || 0
      });
    }

    // Also check bundle contents
    if (Array.isArray(item.dynamicBundleItems)) {
      item.dynamicBundleItems.forEach(bundleEntry => {
        const bundleEdid = (bundleEntry.EDID || bundleEntry.edid || '').toLowerCase();
        const bundleEntmName = (bundleEntry.entmName || '').toLowerCase();
        const bundleId = String(bundleEntry.itemID || '').toLowerCase();

        let isBundleWishlistItem = false;
        if (bundleEdid && wishlistItems.has(bundleEdid)) isBundleWishlistItem = true;
        if (bundleEntmName && wishlistItems.has(bundleEntmName)) isBundleWishlistItem = true;
        if (bundleId && wishlistItems.has(bundleId)) isBundleWishlistItem = true;

        if (isBundleWishlistItem) {
          // Add the parent bundle as the container for this wishlist item
          if (!available.find(a => a.itemId === item.itemID)) {
            available.push({
              itemId: item.itemID,
              itemName: item.itemName,
              EDID: item.EDID || item.edid,
              entmName: item.entmName,
              bundleItems: item.dynamicBundleItems || [],
              price: item.lowPrice?.atomPrice || 0,
              originalPrice: item.lowPrice?.baseAtomPrice || 0,
              discount: item.lowPrice?.discount || 0,
              wishlistItemInBundle: bundleEntry.szItemName || bundleEntry.entmName
            });
          }
        }
      });
    }
  });

  return available;
}

/**
 * Show wishlist modal with available items
 */
function showWishlistModal() {
  const available = findAvailableWishlistItems();

  if (!available.length) {
    alert('No items from your wishlist are currently available.');
    return;
  }

  // Create modal overlay
  let modal = document.getElementById('wishlist-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wishlist-modal';
    modal.className = 'wishlist-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #1a1a1a;
      border: 2px solid #00ff00;
      padding: 30px;
      border-radius: 8px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: #00ff00;
    `;

    content.innerHTML = `
      <h2 style="margin-top: 0; text-align: center; font-size: 24px; border-bottom: 1px solid #00ff00; padding-bottom: 15px;">
        ✨ Wishlist Items Available
      </h2>
      <div id="wishlist-items-list" style="margin: 20px 0;"></div>
      <div style="text-align: center; margin-top: 30px;">
        <button id="wishlist-close-btn" style="
          padding: 10px 20px;
          background: #00ff00;
          color: #000;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
        ">Close</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById('wishlist-close-btn').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Populate items list
  const itemsList = document.getElementById('wishlist-items-list');
  itemsList.innerHTML = available
    .map(item => {
      const discountHtml = item.discount > 0 ? `<span style="color: #ff6600;"> -${item.discount}%</span>` : '';
      const bundleNote = item.wishlistItemInBundle ? `<br><small style="color: #888;">Part of bundle: ${item.wishlistItemInBundle}</small>` : '';
      return `
        <div style="
          margin: 15px 0;
          padding: 15px;
          background: rgba(0, 255, 0, 0.1);
          border-left: 3px solid #00ff00;
          border-radius: 4px;
        ">
          <div style="font-weight: bold; font-size: 16px;">${item.itemName}</div>
          <div style="font-size: 14px; margin-top: 5px;">
            Price: <strong>${item.price} Atoms</strong>${item.originalPrice > item.price ? ` <span style="text-decoration: line-through; color: #888;">${item.originalPrice}</span>` : ''}${discountHtml}
          </div>
          ${bundleNote}
        </div>
      `;
    })
    .join('');

  // Show modal with fade-in effect
  modal.style.display = 'flex';
  modal.style.animation = 'fadeIn 0.3s ease-in';
}

/**
 * Update wishlist button visibility based on available items
 */
async function updateWishlistButton() {
  const btn = document.getElementById('wishlist-btn');
  if (!btn) return;

  const available = findAvailableWishlistItems();

  if (available.length > 0) {
    btn.hidden = false;
    btn.style.display = 'flex';
    btn.title = `${available.length} wishlist item(s) available`;
    
    // Add a count badge if not already there
    let badge = btn.querySelector('.wishlist-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'wishlist-count';
      badge.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ff4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      `;
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
    badge.textContent = available.length;
  } else {
    btn.hidden = true;
    btn.style.display = 'none';
  }
}

/**
 * Initialize wishlist module
 */
export async function initWishlist() {
  console.log('[wishlist] Initializing...');

  // Wait for button to exist
  let btn = document.getElementById('wishlist-btn');
  let retries = 0;
  while (!btn && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    btn = document.getElementById('wishlist-btn');
    retries++;
  }

  if (!btn) {
    console.warn('[wishlist] Wishlist button not found in DOM after retries');
    return;
  }

  console.log('[wishlist] Button found:', btn);

  // Load data
  const loaded = await loadWishlistData();
  if (!loaded) {
    console.warn('[wishlist] Failed to load data, wishlist disabled');
    return;
  }

  // Load wishlist from localStorage
  const wishlist = getWishlist();
  wishlistItems = new Set(wishlist.map(i => String(i).toLowerCase()));
  console.log('[wishlist] Loaded', wishlist.length, 'items from localStorage');

  // Update button visibility
  await updateWishlistButton();

  // Add click handler
  btn.addEventListener('click', (e) => {
    console.log('[wishlist] Button clicked');
    e.preventDefault();
    e.stopPropagation();
    showWishlistModal();
  });

  console.log('[wishlist] Initialized successfully');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  console.log('[wishlist] DOM not ready, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', initWishlist);
} else {
  console.log('[wishlist] DOM ready, initializing immediately');
  initWishlist();
}
