// Overlay module: handles overlay open/close, FAQ, news notice, and loading overlay
async function showNewsNotice() {
  try {
    const news = (window.__dataLoader && (await window.__dataLoader.loadNews())) || null;
    if (!news) return;
    const lastSeen = localStorage.getItem('newsNoticeSeen');
    if (lastSeen === news.id) return; // Already seen

    const header = document.getElementById('news-header');
    const title = document.getElementById('news-title');
    const text = document.getElementById('news-text');
    if (!header || !title || !text) return;

    header.textContent = news.header || '';
    title.textContent = news.title || '';
    // Normalize escaped newlines and preserve paragraphs
    const rawText = String(news.text || '')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    text.innerHTML = rawText.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>')).join('<p></p>');
    const notice = document.getElementById('news-notice');
    if (!notice) return;
    notice.classList.remove('hidden');

    document.getElementById('news-close').onclick = function() {
      notice.classList.add('hidden');
      localStorage.setItem('newsNoticeSeen', news.id);
    };
  } catch (e) {
    // ignore
  }
}

// Hides the loading overlay once all shop images are loaded
function hideLoadingOverlayWhenReady() {
  const shopGrid = document.querySelector('.shop-grid');
  const images = shopGrid ? shopGrid.querySelectorAll('img') : [];
  console.debug('hideLoadingOverlayWhenReady: images found=', images.length);
  let loaded = 0;
  if (!images.length) {
    const lo = document.getElementById('loading-overlay');
    if (lo) lo.style.display = 'none';
    return;
  }
  images.forEach(img => {
    if (img.complete || img.naturalWidth !== 0) {
      loaded++;
      if (loaded === images.length) {
        const lo = document.getElementById('loading-overlay'); if (lo) lo.style.display = 'none';
      }
    } else {
      img.addEventListener('load', () => {
        loaded++;
        if (loaded === images.length) { const lo = document.getElementById('loading-overlay'); if (lo) lo.style.display = 'none'; }
      });
      img.addEventListener('error', () => {
        loaded++;
        if (loaded === images.length) { const lo = document.getElementById('loading-overlay'); if (lo) lo.style.display = 'none'; }
      });
    }
  });
}

// Initializes overlay event handlers
function initOverlay() {

  window.__overlay = window.__overlay || {};
  if (window.__overlay._inited) return;
  window.__overlay._inited = true;

  const overlay = document.getElementById('item-overlay');
  if (!overlay) return;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
    }
  });
//Clicking Close button
  const overlayBtn = document.querySelector('.overlay-button');
  if (overlayBtn) {
    overlayBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
    });
  }
//Using tab key
  document.addEventListener('keydown', function(e) {
    if (!overlay.classList.contains('hidden') && e.key === 'Tab') {
      overlay.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
      e.preventDefault();
    }
  });

// FAQ link
  const faqLink = document.getElementById('faq-link');
  if (faqLink) faqLink.addEventListener('click', function(e) {
    e.preventDefault();
    overlay.classList.remove('hidden');
    document.querySelector('.overlay-content')?.classList.add('hidden');
    document.getElementById('overlay-faq')?.classList.remove('hidden');
  });
// FAQ close button
  const faqClose = document.getElementById('faq-close-btn');
  if (faqClose) faqClose.addEventListener('click', function() {
    overlay.classList.add('hidden');
    document.querySelector('.overlay-content')?.classList.remove('hidden');
    document.getElementById('overlay-faq')?.classList.add('hidden');
  });
}
// Opens overlay for item specified in URL parameter "item"
function openOverlayFromUrlIfNeeded() {
  if (window._overlayOpenedFromUrl) return;
  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  if (!itemParam) return;
  window._overlayOpenedFromUrl = true;
  const tiles = document.querySelectorAll('.shop-tile');
  for (let tile of tiles) {
    const dataItemAttr = tile.getAttribute('data-item');
    if (!dataItemAttr) continue;
    const data = JSON.parse(dataItemAttr.replace(/&apos;/g, "'"));
    if (String(data.itemID) === itemParam) { tile.click(); break; }
  }
}

// Expose API for legacy script
if (typeof window !== 'undefined') {
  window.__overlay = window.__overlay || {};
  window.__overlay.initOverlay = initOverlay;
  window.__overlay.hideLoadingOverlayWhenReady = hideLoadingOverlayWhenReady;
  window.__overlay.showNewsNotice = showNewsNotice;
  window.__overlay.openOverlayFromUrlIfNeeded = openOverlayFromUrlIfNeeded;
}

export { initOverlay, hideLoadingOverlayWhenReady, showNewsNotice, openOverlayFromUrlIfNeeded };
