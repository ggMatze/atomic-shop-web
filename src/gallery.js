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
}

export { renderGallery, carouselKeyHandler, galleryState };
