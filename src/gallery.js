// Gallery module: manages gallery images and keyboard navigation
const galleryState = {
  images: [],
  current: 0
};

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
  // set data-gallery-index relative to carousel offset when applicable
  try {
    // prefer an explicit carouselOffset if provided; otherwise try to auto-detect
    let cOff = Number.isFinite(galleryState._carouselOffset) ? galleryState._carouselOffset : 0;
    // Auto-detect a leading primaryImage (common: md5 .dds in atomic_shop_media) so
    // only the carouselImages (following the primary) get an index.
    if (!cOff && galleryState.images && galleryState.images.length && typeof galleryState.images[0] === 'string') {
      try {
        const first = galleryState.images[0];
        const basename = (first.split('/').pop() || first).toLowerCase();
        if (/^[0-9a-f]{32}\./i.test(basename) || /atomic_shop_media/.test(first)) {
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
        if (/^[0-9a-f]{32}\./i.test(basename) || /atomic_shop_media/.test(first)) {
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
  if (e.key && e.key.toLowerCase() === 'a' && galleryState.current > 0) {
    galleryState.current--;
    renderGallery(galleryState.images, galleryState.current);
    e.preventDefault();
  }
  if (e.key && e.key.toLowerCase() === 'd' && galleryState.current < galleryState.images.length - 1) {
    galleryState.current++;
    renderGallery(galleryState.images, galleryState.current);
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
