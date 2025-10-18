// Gallery module: manages gallery images and keyboard navigation
const galleryState = {
  images: [],
  current: 0
};

function renderGallery(images, current = 0) {
  galleryState.images = images || [];
  galleryState.current = current || 0;

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

  // Left images
  leftStrip.innerHTML = '';
  const leftImages = galleryState.images.slice(Math.max(0, galleryState.current - 3), galleryState.current);
  leftImages.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Left ${galleryState.current - 3 + index}`;
    img.onclick = () => renderGallery(galleryState.images, galleryState.current - (leftImages.length - index));
    leftStrip.appendChild(img);
  });

  // Right images
  rightStrip.innerHTML = '';
  const rightImages = galleryState.images.slice(galleryState.current + 1, galleryState.current + 4);
  rightImages.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Right ${galleryState.current + 1 + index}`;
    img.onclick = () => renderGallery(galleryState.images, galleryState.current + 1 + index);
    rightStrip.appendChild(img);
  });
}

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
