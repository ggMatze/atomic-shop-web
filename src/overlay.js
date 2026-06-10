// Overlay module: handles overlay open/close, FAQ, news notice, and loading overlay
const NEWS_DISMISS_KEY = 'newsDismissMap';
const NEWS_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default

function _isNewsDismissed(newsId) {
  try {
    const raw = localStorage.getItem(NEWS_DISMISS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw || '{}');
    const e = map && map[newsId];
    if (!e) return false;
    if (e.permanent) return true;
    if (e.expiresAt == null) return false;
    if (Date.now() > e.expiresAt) {
      // expired dismissal -> remove entry
      delete map[newsId];
      localStorage.setItem(NEWS_DISMISS_KEY, JSON.stringify(map));
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

function _dismissNews(newsId, ttl = NEWS_DISMISS_TTL_MS, permanent = false) {
  try {
    const raw = localStorage.getItem(NEWS_DISMISS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[newsId] = { dismissedAt: Date.now(), expiresAt: permanent ? null : (ttl ? Date.now() + ttl : null), permanent: !!permanent };
    localStorage.setItem(NEWS_DISMISS_KEY, JSON.stringify(map));
  } catch (err) { /* ignore */ }
}

function _getNewsDismissEntry(newsId) {
  try {
    const raw = localStorage.getItem(NEWS_DISMISS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw || '{}');
    const e = map && map[newsId];
    if (!e) return null;
    if (e.permanent) return e;
    if (e.expiresAt == null) return e;
    if (Date.now() > e.expiresAt) {
      // expired dismissal -> remove entry
      delete map[newsId];
      localStorage.setItem(NEWS_DISMISS_KEY, JSON.stringify(map));
      return null;
    }
    return e;
  } catch (err) {
    return null;
  }
}

function _updateNewsButtonVisibility(news, noticeEl) {
  const btn = document.getElementById('news-btn');
  if (!btn) return;
  // hide when no news, or when notice is visible
  if (!news || (noticeEl && !noticeEl.classList.contains('hidden'))) {
    btn.style.display = 'none';
    // clear styling state
    btn.classList.remove('news-dismissed-permanent', 'news-dismissed-ttl');
    btn.removeAttribute('data-news-dismiss');
    btn.title = 'News';
    return;
  }

  // show the button so the user can re-open dismissed/visible news
  btn.style.display = '';

  // Update appearance based on dismissal state (permanent or temporary)
  try {
    const entry = _getNewsDismissEntry(String(news.id || ''));
    if (entry && entry.permanent) {
      btn.classList.add('news-dismissed-permanent');
      btn.classList.remove('news-dismissed-ttl');
      btn.setAttribute('data-news-dismiss', 'permanent');
      btn.title = 'News (dismissed)';
    } else if (entry && entry.expiresAt != null) {
      btn.classList.add('news-dismissed-ttl');
      btn.classList.remove('news-dismissed-permanent');
      btn.setAttribute('data-news-dismiss', 'ttl');
      btn.title = 'News (hidden temporarily)';
    } else {
      btn.classList.remove('news-dismissed-permanent', 'news-dismissed-ttl');
      btn.removeAttribute('data-news-dismiss');
      btn.title = 'News';
    }
  } catch (err) {
    // ignore errors here and ensure sane defaults
    btn.classList.remove('news-dismissed-permanent', 'news-dismissed-ttl');
    btn.removeAttribute('data-news-dismiss');
    btn.title = 'News';
  }
}

async function showNewsNotice(options = { force: false }) {
  try {
    const news = (window.__dataLoader && (await window.__dataLoader.loadNews())) || null;
    const notice = document.getElementById('news-notice');
    if (!notice) return;

    if (!news) {
      // No news: ensure button is hidden and return
      _updateNewsButtonVisibility(null, notice);
      return;
    }

    // Populate content
    const header = document.getElementById('news-header');
    const title = document.getElementById('news-title');
    const text = document.getElementById('news-text');
    if (!header || !title || !text) return;

    header.textContent = news.header || '';
    title.textContent = news.title || '';
    const rawText = String(news.text || '')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n');
    text.innerHTML = rawText.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>')).join('<p></p>');

    // store current news id on the notice and determine whether to show automatically based on dismissal TTL
    notice.dataset.newsId = String(news.id || '');
    const alreadyDismissed = _isNewsDismissed(news.id);
    if (!options.force && alreadyDismissed) {
      notice.classList.add('hidden');
    } else {
      notice.classList.remove('hidden');
    }

    // wire close button to hide permanently until manually reopened via the news button
    const closeBtn = document.getElementById('news-close');
    if (closeBtn) {
      closeBtn.onclick = function() {
        notice.classList.add('hidden');
        _dismissNews(news.id, 0, true); // permanent until changed manually
        _updateNewsButtonVisibility(news, notice);
      };
    }

    // Setup hide-for-X-days button (text and action comes from config.json)
    const hideBtn = document.getElementById('news-hide-ttl');
    if (hideBtn) {
      let days = null;
      if (typeof news.dismissTtlDays === 'number' && isFinite(news.dismissTtlDays) && news.dismissTtlDays >= 0) days = Math.round(news.dismissTtlDays);
      else if (typeof news.dismissTtlMs === 'number' && isFinite(news.dismissTtlMs) && news.dismissTtlMs >= 0) days = Math.round(news.dismissTtlMs / (24*60*60*1000));
      if (days !== null) {
        hideBtn.style.display = '';
        hideBtn.textContent = `… for ${days} day${days !== 1 ? 's' : ''}`;
        hideBtn.onclick = function() {
          const ttl = days * 24 * 60 * 60 * 1000;
          _dismissNews(news.id, ttl, false);
          notice.classList.add('hidden');
          _updateNewsButtonVisibility(news, notice);
        };
      } else {
        hideBtn.style.display = 'none';
      }
    }

    // Update button visibility now (if notice visible, button will be hidden inside helper)
    _updateNewsButtonVisibility(news, notice);

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

// Save current URL and set canonical /faq path for sharing
function saveUrlAndShowFaqPath() {
  try {
    // Determine and remember a sensible "previous" URL (remove any existing faq flag)
    const cur = new URL(window.location);
    // Build previous URL by deleting a bare 'faq' flag if present
    if (cur.searchParams.has('faq')) {
      cur.searchParams.delete('faq');
      // normalize: if no search params left, clear the search string
      const searchStr = cur.searchParams.toString();
      const prevPath = cur.pathname.replace(/\/$/, '') || '/';
      const prevHref = window.location.origin + prevPath + (searchStr ? ('?' + searchStr) : '') + (cur.hash || '');
      window._prevUrlBeforeFaq = prevHref;
    } else {
      window._prevUrlBeforeFaq = window.location.href;
    }

    // canonical FAQ query flag (no value) at current pathname
    const p = String(window.location.pathname || '/').replace(/\/$/, '') || '/';
    window.history.replaceState({}, '', p + '?faq');
  } catch (e) { /* ignore */ }
}

// Restore previously saved URL (if any) - only if FAQ was open
function restoreUrlAfterFaq() {
  try {
    // only restore if FAQ overlay was actually shown (indicated by _prevUrlBeforeFaq being set)
    const faqEl = document.getElementById('overlay-faq');
    if (faqEl && !faqEl.classList.contains('hidden') && window._prevUrlBeforeFaq) {
      window.history.replaceState({}, '', window._prevUrlBeforeFaq);
      delete window._prevUrlBeforeFaq;
    }
  } catch (e) { /* ignore */ }
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
      try { restoreUrlAfterFaq(); } catch (e) { /* ignore */ }
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
      try { restoreUrlAfterFaq(); } catch (e) { /* ignore */ }
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
      try { restoreUrlAfterFaq(); } catch (e) { /* ignore */ }
      // Restore default overlay content state when closed via Tab key
      document.querySelector('.overlay-content')?.classList.remove('hidden');
      document.getElementById('overlay-faq')?.classList.add('hidden');
      const sel = document.getElementById('currency-select'); if (sel) sel.disabled = false;
      e.preventDefault();
    }
  });

  // News button (header): open current news when clicked or activated via keyboard
  const newsBtn = document.getElementById('news-btn');
  if (newsBtn) {
    newsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      try { showNewsNotice({ force: true }); } catch (err) { console.error('showNewsNotice failed', err); }
    });
    newsBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newsBtn.click(); }
    });
  }

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
          faqEl.innerHTML = '<div class="credits">Credits: Font made from <a target="_blank" href="http://www.onlinewebfonts.com/fonts">Web Fonts</a> is licensed by CC BY 4.0, <a target="_blank" href="https://trello.com/b/efC7d87N/sugarbombsrads-infographics">SugarBombsRADS</a>, <a target="_blank" href="https://www.youtube.com/c/MisterChurch">MisterChurch</a>, <a target="_blank" href="https://www.theduchessflame.com/">TheDuchessFlame</a> and others for inspiration and contributions.</div>';

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

      try { saveUrlAndShowFaqPath(); } catch (e) { /* ignore */ }
      overlay.classList.remove('hidden');
      document.querySelector('.overlay-content')?.classList.add('hidden');
      faqEl.classList.remove('hidden');
    })();
  });
// FAQ close button
  const faqClose = document.getElementById('faq-close-btn');
  if (faqClose) faqClose.addEventListener('click', function() {
    overlay.classList.add('hidden');
    try { restoreUrlAfterFaq(); } catch (e) { /* ignore */ }
    document.querySelector('.overlay-content')?.classList.remove('hidden');
    document.getElementById('overlay-faq')?.classList.add('hidden');
  });
}
// Opens overlay for item specified in URL parameter "item"
function openOverlayFromUrlIfNeeded() {
  if (window._overlayOpenedFromUrl) return;
  const url = new URL(window.location);
  const urlParams = url.searchParams;
  const itemParam = urlParams.get('item');

  if (itemParam) {
    window._overlayOpenedFromUrl = true;
    const tiles = document.querySelectorAll('.shop-tile');
    for (let tile of tiles) {
      const dataItemAttr = tile.getAttribute('data-item');
      if (!dataItemAttr) continue;
      const data = JSON.parse(dataItemAttr.replace(/&apos;/g, "'"));
      if (String(data.itemID) === itemParam) { tile.click(); break; }
    }
    return;
  }

  // If URL path is /faq open FAQ overlay
  try {
    // open when search contains a bare 'faq' flag (e.g. /?faq or &faq)
    if (/[?&]faq(?:$|&)/.test(String(url.search || ''))) {
      const faqLink = document.getElementById('faq-link');
      if (faqLink) faqLink.click();
    }
  } catch (e) { /* ignore */ }
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
