import { buildImageUrl } from './utils.js';

// Gallery module: manages gallery images and keyboard navigation
const galleryState = {
  images: [],
  current: 0
};

// Tracks per-image current c-index and caches known-missing variants to avoid re-requesting
galleryState._cIndexMap = {}; // key -> current c number (0 = base/_l)
galleryState._cMissing = {}; // key -> Set of missing numbers
galleryState._cAvailable = {}; // key -> Set of discovered available numbers
galleryState._cOriginal = {}; // key -> original main-image src when opened

let itemsDbCache = null;
let itemsDbPromise = null;

function normalizeLookupValue(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function resolveItemsDbUrl() {
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '';
  const base = pathname.replace(/\/[^/]*$/, '/');
  const candidates = [];

  if (window.location.protocol === 'file:') {
    candidates.push(new URL('../data/items-db.json', window.location.href).toString());
    candidates.push('/data/items-db.json');
  } else {
    candidates.push(new URL('data/items-db.json', `${origin}${base}`).toString());
    candidates.push(new URL('/data/items-db.json', origin).toString());
    candidates.push(new URL('items-db.json', `${origin}${base}`).toString());
    candidates.push(new URL('/items-db.json', origin).toString());
  }

  return candidates.find(Boolean) || null;
}

async function loadItemsDb() {
  if (itemsDbCache !== null) return itemsDbCache;
  if (itemsDbPromise) return itemsDbPromise;

  itemsDbPromise = (async () => {
    try {
      const dbUrl = resolveItemsDbUrl();
      if (!dbUrl) throw new Error('No items DB URL resolved');
      const response = await fetch(dbUrl);
      if (!response.ok) throw new Error(`Failed to fetch items db (${response.status})`);
      const items = await response.json();
      itemsDbCache = Array.isArray(items) ? items : [];
      return itemsDbCache;
    } catch (e) {
      console.warn('[gallery] failed to load items db for bundle images', e);
      itemsDbCache = [];
      return itemsDbCache;
    }
  })();

  return itemsDbPromise;
}

function resolveBundleEntryImage(entry, itemsDb) {
  if (!entry || !Array.isArray(itemsDb) || !itemsDb.length) return null;

  const idCandidates = [];
  const directId = entry?.EDID || entry?.edid || entry?.entmName || entry?.entm || entry?.id || entry?.itemID;
  if (directId != null && String(directId).trim()) idCandidates.push(String(directId).trim());

  console.log('[resolveBundleEntryImage] Looking for entry:', { directId, entmName: entry?.entmName, szItemName: entry?.szItemName, idCandidates });

  // If we have an ID candidate, ONLY match by ID (don't fall back to name matching)
  if (idCandidates.length > 0) {
    const match = itemsDb.find((dbEntry) => {
      if (!dbEntry) return false;

      const dbIds = [dbEntry.EDID, dbEntry.edid, dbEntry.entmName, dbEntry.entm, dbEntry.id, dbEntry.itemID]
        .filter(value => value != null && String(value).trim())
        .map(value => normalizeLookupValue(value));

      return idCandidates.some(candidate => dbIds.includes(normalizeLookupValue(candidate)));
    });

    if (match) {
      console.log('[resolveBundleEntryImage] Found match by ID:', { dbEDID: match.EDID, primaryImage: match.primaryImage?.imageName });
      const image = match.primaryImage;
      if (image && image.imageName && image.directory) {
        console.log('[resolveBundleEntryImage] Returning image:', { imageName: image.imageName, directory: image.directory, matchedEDID: match.EDID });
        return { directory: image.directory, imageName: image.imageName, entmId: directId };
      }
      return null;
    }
    console.log('[resolveBundleEntryImage] NO MATCH FOUND for ID:', { directId, szItemName: entry?.szItemName });
    return null;
  }

  // Fallback: if NO ID was provided, try name matching
  const nameCandidate = normalizeLookupValue(entry?.szItemName || entry?.itemName || entry?.name);
  if (!nameCandidate) return null;

  const match = itemsDb.find((dbEntry) => {
    if (!dbEntry) return false;
    const dbNames = [dbEntry.itemName, dbEntry.itemNameShort, dbEntry.title, dbEntry.name]
      .filter(value => value != null && String(value).trim())
      .map(value => normalizeLookupValue(value));

    return dbNames.includes(nameCandidate);
  });

  if (!match) {
    console.log('[resolveBundleEntryImage] NO MATCH FOUND for name:', { nameCandidate, szItemName: entry?.szItemName });
    return null;
  }

  console.log('[resolveBundleEntryImage] Found match by name (fallback):', { nameCandidate, dbItemName: match.itemName, primaryImage: match.primaryImage?.imageName });
  const image = match.primaryImage;
  if (image && image.imageName && image.directory) {
    console.log('[resolveBundleEntryImage] Returning image:', { imageName: image.imageName, directory: image.directory });
    return { directory: image.directory, imageName: image.imageName, entmId: directId };
  }

  return null;
}

function buildItemImageAssets(item, itemsDb = null) {
  const db = Array.isArray(itemsDb) ? itemsDb : itemsDbCache;
  const resolvedImages = [];

  const explicitImages = Array.isArray(item?.images)
    ? item.images.filter(value => typeof value === 'string' && value.trim())
    : [];
  explicitImages.forEach((value) => {
    const normalized = value.trim();
    if (normalized) resolvedImages.push({ directory: '', imageName: normalized, explicit: true });
  });

  if (item?.storefrontImage) {
    const normalized = String(item.storefrontImage).trim();
    if (normalized) resolvedImages.push({ directory: '', imageName: normalized, explicit: true });
  }

  if (item?.primaryImage?.imageName && item.primaryImage.directory) {
    resolvedImages.push({ directory: item.primaryImage.directory, imageName: item.primaryImage.imageName });
  }

  console.log('[buildItemImageAssets] Processing dynamicBundleItems:', item?.dynamicBundleItems?.length || 0);
  if (Array.isArray(item?.dynamicBundleItems)) {
    item.dynamicBundleItems.forEach((bundleEntry, idx) => {
      const resolved = resolveBundleEntryImage(bundleEntry, db || []);
      console.log(`[buildItemImageAssets] Bundle item ${idx}:`, { entmName: bundleEntry?.entmName, resolved });
      if (resolved) {
        resolvedImages.push(resolved);
      }
    });
  }

  console.log('[buildItemImageAssets] resolvedImages before dedup:', resolvedImages.length, resolvedImages);

  const uniqueImages = [];
  const seen = new Set();
  resolvedImages.forEach((img) => {
    const normalizedValue = (img.explicit ? img.imageName : buildImageUrl(img.directory, img.imageName)) || '';
    
    // If this is a bundle item with an entmId, ALWAYS keep it even if same image
    // Different item IDs should display separately in carousel even with identical images
    if (img.entmId) {
      const dedupeKey = `${normalizedValue}|${img.entmId}`.toLowerCase();
      console.log('[buildItemImageAssets] Bundle item with ID:', { imageName: img.imageName, entmId: img.entmId, dedupeKey });
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        uniqueImages.push(img);
      }
      return;
    }
    
    // For non-bundle items, deduplicate on image URL only
    const key = normalizedValue.toLowerCase();
    console.log('[buildItemImageAssets] Dedup check (non-bundle):', { normalizedValue, isDuplicate: seen.has(key) });
    if (!normalizedValue || seen.has(key)) return;
    seen.add(key);
    uniqueImages.push(img);
  });

  console.log('[buildItemImageAssets] uniqueImages after dedup:', uniqueImages.length, uniqueImages);

  const storefrontImage = uniqueImages.length
    ? (uniqueImages[0].explicit ? uniqueImages[0].imageName : buildImageUrl(uniqueImages[0].directory, uniqueImages[0].imageName))
    : '';

  const images = uniqueImages
    .map(img => (img.explicit ? img.imageName : buildImageUrl(img.directory, img.imageName)))
    .filter(Boolean);

  console.log('[buildItemImageAssets] Final images array:', images);
  return { storefrontImage, images };
}

function probeImageUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function getVariantCandidateUrls(src) {
  const urls = [];
  const parsed = _parseVariantBase(src);
  if (!parsed) return urls;

  const addBasePath = (basePath) => {
    if (!basePath) return;
    for (let n = 1; n <= 8; n++) {
      urls.push(_buildCVariant(basePath, parsed.ext, n));
    }
  };

  addBasePath(parsed.basePath);

  const directory = String(parsed.dir || '').replace(/\/+$/, '');
  const lastSegment = (directory.split('/').filter(Boolean).pop() || '').toLowerCase();
  if (lastSegment === 'floordecoration') {
    const altDir = directory.replace(/\/floordecoration$/i, '/utility');
    if (altDir && altDir !== directory) addBasePath(`${altDir}/${parsed.baseName}`);
  } else if (lastSegment === 'utility') {
    const altDir = directory.replace(/\/utility$/i, '/floordecoration');
    if (altDir && altDir !== directory) addBasePath(`${altDir}/${parsed.baseName}`);
  }

  return urls.filter(Boolean);
}

async function resolveItemGalleryImages(item, itemsDb = null) {
  const { storefrontImage, images } = buildItemImageAssets(item, itemsDb);
  
  // Images array from buildItemImageAssets already contains storefrontImage as first item
  // and is properly deduplicated with entmId awareness. Just add variant candidates.
  const galleryImages = images.filter(Boolean);
  
  const primaryImage = galleryImages[0] || '';
  if (primaryImage) {
    for (const candidate of getVariantCandidateUrls(primaryImage)) {
      if (!candidate || galleryImages.includes(candidate)) continue;
      const exists = await probeImageUrl(candidate);
      if (exists) galleryImages.push(candidate);
    }
  }

  return { storefrontImage, images: galleryImages };
}

function _keyForSrc(src) {
  return src || '';
}

function _parseVariantBase(src) {
  if (!src || typeof src !== 'string') return null;
  try {
    const parts = src.split('/');
    const filename = parts.pop();
    const dir = parts.join('/');
    const m = filename.match(/^(.*?)(?:_(?:l|c\d+))?(\.[^.]+)$/i);
    if (!m) return { dir, base: dir ? dir + '/' + filename : filename, ext: '' };
    const baseName = m[1];
    const ext = m[2] || '';
    const basePath = (dir ? dir + '/' : '') + baseName;
    return { dir, baseName, ext, basePath };
  } catch (e) { return null; }
}

function _buildCVariant(basePath, ext, n) {
  return (basePath || '') + (n > 0 ? `_c${n}` : '_l') + (ext || '');
}

function _isVariantInCarousel(url) {
  if (!url) return false;
  if (!galleryState.images || !galleryState.images.length) return false;
  const base = (url + '').split('/').pop();
  try {
    for (const img of galleryState.images) {
      if (!img) continue;
      if (img === url) return true;
      if (typeof img === 'string' && img.endsWith(base)) return true;
      try {
        const a = new URL(img, location.href).href;
        const b = new URL(url, location.href).href;
        if (a === b) return true;
      } catch (e) { /* ignore malformed URLs */ }
    }
  } catch (e) {}
  return false;
}

function _probeVariant(url, cbSuccess, cbFail) {
  const img = new Image();
  img.onload = function() { cbSuccess && cbSuccess(url); };
  img.onerror = function() { cbFail && cbFail(url); };
  img.src = url;
}

function _scanVariants(key, basePath, ext, maxProbe = 16) {
  return new Promise((resolve) => {
    const avail = galleryState._cAvailable[key] = galleryState._cAvailable[key] || new Set();
    const missingSet = galleryState._cMissing[key] = galleryState._cMissing[key] || new Set();
    const tasks = [];
    for (let n = 0; n <= maxProbe; n++) {
      if (avail.has(n) || missingSet.has(n)) continue;
      ((n) => {
        const url = _buildCVariant(basePath, ext, n);
        tasks.push(new Promise(res => {
          _probeVariant(url, () => { avail.add(n); res({ n, found: true }); }, () => { missingSet.add(n); res({ n, found: false }); });
        }));
      })(n);
    }
    if (!tasks.length) return resolve(Array.from(avail).sort((a, b) => a - b));
    Promise.all(tasks).then(() => resolve(Array.from(avail).sort((a, b) => a - b)));
  });
}

function _updateVariantIndicator(key) {
  try {
    const titleEl = document.querySelector('.overlay-title');
    if (!titleEl) return;
    let indicator = document.getElementById('c-variant-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'c-variant-indicator';
      indicator.className = 'c-variant-indicator';
      titleEl.parentNode.insertBefore(indicator, titleEl.nextSibling);
    }
    const mainImage = document.getElementById('main-image');
    if (!mainImage) { indicator.classList.remove('visible'); return; }

    // Only show indicator for carousel images (i.e. items that can be cycled)
    if (!mainImage.hasAttribute('data-gallery-index')) { indicator.classList.remove('visible'); return; }

    const avail = galleryState._cAvailable[key];
    // Show the hint only if there is at least one candidate not already in the carousel
    let hasCandidate = false;
    if (avail && avail.size) {
      const parsedMain = _parseVariantBase(mainImage.src);
      if (parsedMain) {
        for (const n of avail) {
          const url = _buildCVariant(parsedMain.basePath, parsedMain.ext, n);
          if (!_isVariantInCarousel(url)) { hasCandidate = true; break; }
        }
      }
      const origUrl = galleryState._cOriginal[key];
      if (!hasCandidate && origUrl && origUrl !== mainImage.src) {
        if (!_isVariantInCarousel(origUrl)) hasCandidate = true;
      }
    }
    if (hasCandidate) {
      indicator.textContent = 'W/S or ▲/▼ to alternate images';
      indicator.classList.add('visible');
      mainImage.classList.add('has-variants');
    } else {
      indicator.classList.remove('visible');
      mainImage.classList.remove('has-variants');
    }
  } catch (e) { /* no-op */ }
}

// Attempts to find and show a c-variant relative to the currently displayed main image.
// delta: +1 or -1 to move forward/back. Will skip cached-missing numbers. Stops if none found.
function cycleCVariant(delta) {
  const mainImage = document.getElementById('main-image');
  if (!mainImage) return;
  const src = galleryState.images[galleryState.current] || mainImage.src;
  const key = _keyForSrc(src);
  // determine carousel offset to know whether current image is a carousel image
  const cOff = Number.isFinite(galleryState._carouselOffset) ? galleryState._carouselOffset : 0;
  const carouselIndex = (typeof galleryState.current === 'number') ? (galleryState.current - cOff) : NaN;
  if (!Number.isFinite(carouselIndex) || carouselIndex < 0) return; // skip primary images
  // extra guard: only allow cycling when main-image has an explicit data-gallery-index
  if (!mainImage.hasAttribute('data-gallery-index')) return;

  const parsed = _parseVariantBase(src);
  if (!parsed) return;
  const { basePath, ext } = parsed;

  // ensure we have discovered available variants for this base; probe up to 8 variants when unknown
  const ensureScan = () => {
    const avail = galleryState._cAvailable[key];
    if (avail && avail.size) return Promise.resolve(Array.from(avail).sort((a, b) => a - b));
    return _scanVariants(key, basePath, ext, 8);
  };

  ensureScan().then(found => {
    if (!found || !found.length) return;
    // build candidates (id,url), excluding variants already present in galleryState.images
    const candidates = [];
    const nums = (found || []).slice().sort((a, b) => a - b);
    nums.forEach(n => {
      const url = _buildCVariant(basePath, ext, n);
      if (_isVariantInCarousel(url)) return; // skip if already in carousel
      candidates.push({ id: n, url });
    });
    // include the exact original URL shown when opening this item so we can wrap back to it
    const origUrl = galleryState._cOriginal[key];
    if (origUrl && candidates.findIndex(c => c.url === origUrl) === -1) {
      candidates.push({ id: 'ORIG', url: origUrl });
    }
    if (!candidates.length) return; // nothing to cycle

    // determine current index by exact URL match if possible
    let curIdx = candidates.findIndex(c => c.url === mainImage.src);
    if (curIdx === -1) {
      // fallback: use remembered numeric index
      const curVal = (typeof galleryState._cIndexMap[key] === 'number') ? galleryState._cIndexMap[key] : null;
      if (curVal !== null) curIdx = candidates.findIndex(c => c.id === curVal);
      if (curIdx === -1) curIdx = 0;
    }
    const nextIdx = ((curIdx + (delta > 0 ? 1 : -1)) + candidates.length) % candidates.length;
    const pick = candidates[nextIdx];
    if (!pick) return;
    galleryState._cIndexMap[key] = (typeof pick.id === 'number') ? pick.id : galleryState._cIndexMap[key];
    if (pick.id === 'ORIG') mainImage.removeAttribute('data-c-number'); else mainImage.setAttribute('data-c-number', String(pick.id));
    mainImage.src = pick.url;
    try { _updateVariantIndicator(key); } catch (e) {}
  }).catch(() => {});
}
// Renders the gallery with given images and highlights the current image
function renderGallery(images, current = 0, opts = {}) {
  galleryState.images = images || [];
  galleryState.current = current || 0;
  // accept optional carouselOffset to allow ui to expose carousel-aligned index
  galleryState._carouselOffset = (opts && typeof opts.carouselOffset === 'number') ? opts.carouselOffset : (galleryState._carouselOffset || 0);

  const mainImage = document.getElementById('main-image');
  const leftStrip = document.getElementById('left-strip');
  const rightStrip = document.getElementById('right-strip');
  if (!mainImage || !leftStrip || !rightStrip) return;

  mainImage.onerror = function() {
    if (!this.src.endsWith('_l.webp')) {
      const fallbackSrc = this.src.replace('.webp', '_l.webp');
      galleryState.images[galleryState.current] = fallbackSrc;
      this.src = fallbackSrc;
    } else {
      this.onerror = null;
    }
  };
  mainImage.src = galleryState.images[galleryState.current];
  // remember the exact original URL shown for this image (used for wrapping back)
  try {
    const origKey = _keyForSrc(galleryState.images[galleryState.current]);
    galleryState._cOriginal[origKey] = mainImage.src;
  } catch (e) {}
  // clear any c-variant marker when switching to a new base image
  mainImage.removeAttribute('data-c-number');
  // add click handler to cycle variants (forward by +1 on each click)
  mainImage.onclick = function(e) {
    e.stopPropagation();
    cycleCVariant(+1);
  };
  // ensure the inline W/S indicator is present/updated and kick off a background scan
  try {
    const origKey2 = _keyForSrc(galleryState.images[galleryState.current]);
    _updateVariantIndicator(origKey2);
    const parsedScan = _parseVariantBase(mainImage.src);
    if (parsedScan) {
      const { basePath, ext } = parsedScan;
      _scanVariants(origKey2, basePath, ext, 8).then(() => _updateVariantIndicator(origKey2));
    }
  } catch (e) {}
  // set data-gallery-index relative to carousel offset when applicable
  try {
    // prefer an explicit carouselOffset if provided; otherwise try to auto-detect
    let cOff = Number.isFinite(galleryState._carouselOffset) ? galleryState._carouselOffset : 0;
    // Auto-detect a leading primaryImage so only the carouselImages (following) get an index.
    // Detection patterns: (1) md5 hash filename, (2) atomic_shop_media, (3) first image from media/ and rest from textures/
    if (!cOff && galleryState.images && galleryState.images.length && typeof galleryState.images[0] === 'string') {
      try {
        const first = galleryState.images[0];
        const basename = (first.split('/').pop() || first).toLowerCase();
        let isPrimary = false;
        
        // Pattern 1: md5 hash or atomic_shop_media
        if (/^[0-9a-f]{32}\./i.test(basename) || /atomic_shop_media/.test(first)) {
          isPrimary = true;
        }
        // Pattern 2: first from media/bundles/ and rest from textures/ = primary + carousels
        else if (/media\/bundles?\//.test(first) && galleryState.images.length > 1) {
          const hasTexturesCarousel = galleryState.images.slice(1).some(img => 
            typeof img === 'string' && /textures\/atx\/storefront\//.test(img)
          );
          if (hasTexturesCarousel) isPrimary = true;
        }
        
        if (isPrimary) {
          cOff = 1;
          galleryState._carouselOffset = 1;
        }
      } catch (e) {}
    }
    const carouselIndex = galleryState.current - cOff;
    if (Number.isFinite(carouselIndex) && carouselIndex >= 0) mainImage.setAttribute('data-gallery-index', String(carouselIndex));
    else mainImage.removeAttribute('data-gallery-index');
  } catch (e) {}

  // Left images
  leftStrip.innerHTML = '';
  const leftImages = galleryState.images.slice(Math.max(0, galleryState.current - 3), galleryState.current);
  leftImages.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Left ${galleryState.current - 3 + index}`;
    img.onclick = () => renderGallery(galleryState.images, galleryState.current - (leftImages.length - index), { carouselOffset: galleryState._carouselOffset });
    leftStrip.appendChild(img);
  });

  // Right images
  rightStrip.innerHTML = '';
  const rightImages = galleryState.images.slice(galleryState.current + 1, galleryState.current + 4);
  rightImages.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Right ${galleryState.current + 1 + index}`;
    img.onclick = () => renderGallery(galleryState.images, galleryState.current + 1 + index, { carouselOffset: galleryState._carouselOffset });
    rightStrip.appendChild(img);
  });
  // update data-gallery-index on thumbnails where possible
  try {
    let cOff = Number.isFinite(galleryState._carouselOffset) ? galleryState._carouselOffset : 0;
    if (!cOff && galleryState.images && galleryState.images.length && typeof galleryState.images[0] === 'string') {
      try {
        const first = galleryState.images[0];
        const basename = (first.split('/').pop() || first).toLowerCase();
        let isPrimary = false;
        
        // Pattern 1: md5 hash or atomic_shop_media
        if (/^[0-9a-f]{32}\./i.test(basename) || /atomic_shop_media/.test(first)) {
          isPrimary = true;
        }
        // Pattern 2: first from media/bundles/ and rest from textures/ = primary + carousels
        else if (/media\/bundles?\//.test(first) && galleryState.images.length > 1) {
          const hasTexturesCarousel = galleryState.images.slice(1).some(img => 
            typeof img === 'string' && /textures\/atx\/storefront\//.test(img)
          );
          if (hasTexturesCarousel) isPrimary = true;
        }
        
        if (isPrimary) {
          cOff = 1;
          galleryState._carouselOffset = 1;
        }
      } catch (e) {}
    }
    // left strip images
    Array.from(leftStrip.querySelectorAll('img')).forEach((img, i) => {
      const target = galleryState.current - (leftImages.length - i);
      const ci = target - cOff;
      if (Number.isFinite(ci) && ci >= 0) img.setAttribute('data-gallery-index', String(ci)); else img.removeAttribute('data-gallery-index');
    });
    Array.from(rightStrip.querySelectorAll('img')).forEach((img, i) => {
      const target = galleryState.current + 1 + i;
      const ci = target - cOff;
      if (Number.isFinite(ci) && ci >= 0) img.setAttribute('data-gallery-index', String(ci)); else img.removeAttribute('data-gallery-index');
    });
  } catch (e) {}
}

// Touch event handling for swipe navigation on mobile devices
const swipeArea = document.querySelector('.center-image');

let startX = 0;
let startY = 0;

swipeArea.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
}, { passive: true });

swipeArea.addEventListener('touchend', (e) => {
  const touch = e.changedTouches[0];
  const diffX = touch.clientX - startX;
  const diffY = touch.clientY - startY;

  const threshold = 50; // minimum swipe distance

  // horizontal swipe
  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > threshold && galleryState.current > 0) {
      // swipe right → previous
      galleryState.current--;
      renderGallery(galleryState.images, galleryState.current);
    } else if (diffX < -threshold && galleryState.current < galleryState.images.length - 1) {
      // swipe left → next
      galleryState.current++;
      renderGallery(galleryState.images, galleryState.current);
    }
  }
  // vertical swipe
  else {
    if (diffY < -threshold) {
      // swipe up
      cycleCVariant(+1);
    } else if (diffY > threshold) {
      // swipe down
      cycleCVariant(-1);
    }
  }
}, { passive: true });


// Handles keyboard navigation within the gallery overlay
function carouselKeyHandler(e) {
  const overlay = document.getElementById('item-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (!galleryState.images || !galleryState.images.length) return;

  const key = e.key.toLowerCase();

  // left (A or ArrowLeft)
  if ((key === 'a' || e.key === 'ArrowLeft') && galleryState.current > 0) {
    galleryState.current--;
    renderGallery(galleryState.images, galleryState.current);
    e.preventDefault();
  }

  // right (D or ArrowRight)
  if ((key === 'd' || e.key === 'ArrowRight') && galleryState.current < galleryState.images.length - 1) {
    galleryState.current++;
    renderGallery(galleryState.images, galleryState.current);
    e.preventDefault();
  }

  // up (W or ArrowUp)
  if (key === 'w' || e.key === 'ArrowUp') {
    cycleCVariant(+1);
    e.preventDefault();
  }

  // down (S or ArrowDown)
  if (key === 's' || e.key === 'ArrowDown') {
    cycleCVariant(-1);
    e.preventDefault();
  }
}

// Expose API
if (typeof window !== 'undefined') {
  window.__gallery = window.__gallery || {};
  window.__gallery.renderGallery = renderGallery;
  window.__gallery.carouselKeyHandler = carouselKeyHandler;
  window.__gallery._state = galleryState;
  window.__gallery.loadItemsDb = loadItemsDb;
  window.__gallery.buildItemImageAssets = buildItemImageAssets;
}

export { renderGallery, carouselKeyHandler, galleryState, buildItemImageAssets, resolveItemGalleryImages, loadItemsDb };
