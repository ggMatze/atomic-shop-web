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
      // Restore default overlay content state when closed by background click
      document.querySelector('.overlay-content')?.classList.remove('hidden');
      document.getElementById('overlay-faq')?.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
    }
  });
//Clicking Close button
  const overlayBtn = document.querySelector('.overlay-button');
  if (overlayBtn) {
    overlayBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      // Restore default overlay content state when closed via close button
      document.querySelector('.overlay-content')?.classList.remove('hidden');
      document.getElementById('overlay-faq')?.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
    });
  }
//Using tab key
  document.addEventListener('keydown', function(e) {
    if (!overlay.classList.contains('hidden') && e.key === 'Tab') {
      overlay.classList.add('hidden');
      // Restore default overlay content state when closed via Tab key
      document.querySelector('.overlay-content')?.classList.remove('hidden');
      document.getElementById('overlay-faq')?.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
      e.preventDefault();
    }
  });

  // FAQ link
  const faqLink = document.getElementById('faq-link');
  if (faqLink) faqLink.addEventListener('click', function(e) {
    e.preventDefault();
    const faqEl = document.getElementById('overlay-faq');
    if (!faqEl) return;


    (async () => {
      let faqData = null;
      try {
        if (window.__dataLoader && typeof window.__dataLoader.loadFAQ === 'function') {
          faqData = await window.__dataLoader.loadFAQ();
        } else {
          const res = await fetch('data/faq.json');
          if (res.ok) faqData = await res.json();
        }
      } catch (err) {
        faqData = null;
      }

      try {
        // Keep a reference to the static close button so we can re-attach it
        const closeBtn = faqEl.querySelector('#faq-close-btn');
        if (closeBtn) closeBtn.remove();

        if (faqData && Array.isArray(faqData.items)) {
          // Clear only the FAQ content area (we removed the button above)
          faqEl.innerHTML = '';

          const h = document.createElement('h2');
          h.textContent = faqData.title || 'Questions you might have';
          faqEl.appendChild(h);

          const ul = document.createElement('ul');
          faqData.items.forEach(it => {
            const li = document.createElement('li');
            const q = document.createElement('strong'); q.textContent = (it.q || ''); li.appendChild(q);
            li.appendChild(document.createElement('br'));
            const ans = document.createElement('span');
           
            // Declare placeholder and replacement in outer scope so we can swap the HTML back
            // after running inline formatting. Use a placeholder that does NOT contain
            // underscores or asterisks (so our markdown regexes won't touch it).
            const SHARE_PLACEHOLDER = '[[[SHAREICONTOKEN]]]';
            let shareReplacement = (window.__data && window.__data.SHARE_ICON_HTML) || '<span></span>';
            try {
              let raw = it.a || '';
              try {
                raw = String(raw).replace(/\[share-icon\]/g, SHARE_PLACEHOLDER);
              } catch (err) {}

              if (/<[a-z][\s\S]*>/i.test(raw)) {
                // If the answer already contains HTML, trust it and render as-is.
                ans.innerHTML = raw;
              } else {
               // Normalize newlines
               raw = String(raw).replace(/\r\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
               // Helper: escape HTML and apply simple inline markdown-like tokens
               const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
               const applyInlineMarkup = s => {
                 let safe = escapeHtml(s);
                 // *bold* -> <strong>
                 safe = safe.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
                 // _underline_ -> <u>
                 safe = safe.replace(/_(.*?)_/g, '<u>$1</u>');
                 // `code` -> <code>
                 safe = safe.replace(/`(.*?)`/g, '<code>$1</code>');
                 return safe;
               };

                if (raw.indexOf('\n') !== -1) {
                  // preserve paragraphs and line breaks, applying inline markup per-paragraph
                  const formatted = raw.split(/\n{2,}/).map(p => {
                    // convert remaining single newlines to <br> after applying inline markup for that paragraph
                    return applyInlineMarkup(p).replace(/\n/g, '<br>');
                  }).join('<p></p>');
                  ans.innerHTML = formatted;
                } else {
                  // Single line: apply inline markup and render
                  ans.innerHTML = applyInlineMarkup(raw);
                }
              }
            } catch (err) {
              ans.textContent = it.a || '';
            }
            // If we used the placeholder, swap it back to the real SVG/html after formatting
            try {
              if (typeof SHARE_PLACEHOLDER !== 'undefined' && ans.innerHTML && ans.innerHTML.indexOf(SHARE_PLACEHOLDER) !== -1) {
                ans.innerHTML = ans.innerHTML.split(SHARE_PLACEHOLDER).join(shareReplacement);
              }
            } catch (err) { /* ignore replacement errors */ }
            li.appendChild(ans);
            if (it.url) {
              try {
                const a = document.createElement('a');
                a.href = it.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = it.urlLabel || it.url;
                a.style.display = 'block';
                a.style.marginTop = '8px';
                li.appendChild(a);
              } catch (err) { /* ignore malformed urls */ }
            }
            ul.appendChild(li);
          });
          faqEl.appendChild(ul);

        }

        if (closeBtn) faqEl.appendChild(closeBtn);
      } catch (e) {
      }

      overlay.classList.remove('hidden');
      document.querySelector('.overlay-content')?.classList.add('hidden');
      faqEl.classList.remove('hidden');
    })();
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
