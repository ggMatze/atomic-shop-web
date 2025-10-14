const overlay = document.getElementById('item-overlay');

// Globale Variablen für die Galerie
let galleryImages = [];
let galleryCurrent = 0;
let shopGrid;
function attachTileClickHandlers() {
  const tiles = document.querySelectorAll('.shop-tile');
  tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      overlay.classList.remove('hidden');
      document.getElementById('currency-select').disabled = true;
      const item = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));

      // Images-Array sauber aufbauen
      let images = [];
      if (Array.isArray(item.images)) {
        images = item.images.slice();
      } else if (Array.isArray(item.carouselImages)) {
        images = item.carouselImages
          .filter(img => img && img.directory && img.imageName)
          .map(img => buildImageUrl(img.directory, img.imageName))
          .filter(Boolean);
      }

      
      if (
        item.primaryImage &&
        item.primaryImage.directory &&
        item.primaryImage.imageName
      ) {
        const primaryImgUrl = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
        if (primaryImgUrl && !images.includes(primaryImgUrl)) {
          images.unshift(primaryImgUrl);
        }
      }

      let storefrontImage = '';
      if (item.storefrontImage) {
        storefrontImage = item.storefrontImage;
      } else if (item.primaryImage && item.primaryImage.directory && item.primaryImage.imageName) {
        storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      }

      if (storefrontImage && !images.includes(storefrontImage)) {
        images.unshift(storefrontImage);
      }

      // Setze die globalen Variablen
      galleryImages = images;
      galleryCurrent = 0;

      // Zeige die Galerie
      renderGallery(galleryImages, galleryCurrent);

      // Remove handler on overlay close
      overlay.addEventListener('transitionend', function cleanup() {
        if (overlay.classList.contains('hidden')) {
          document.removeEventListener('keydown', carouselKeyHandler);
          overlay.removeEventListener('transitionend', cleanup);
        }
      });

      // Split description and disclaimer
      let description = '';
      let disclaimer = '';
      if (item.itemDesc) {
        // Normalize line breaks
        const lines = item.itemDesc.replace(/\r\n/g, '\n').split('\n');
        let foundDisclaimer = false;
        let descLines = [];
        let disclaimerLines = [];
        for (let line of lines) {
          if (!foundDisclaimer && line.trim().startsWith('-')) {
            foundDisclaimer = true;
          }
          if (foundDisclaimer) {
            if (line.trim()) disclaimerLines.push(line.trim());
          } else {
            descLines.push(line);
          }
        }
        description = descLines.join('\n').trim();
        disclaimer = disclaimerLines.join('\n').trim();
      }

      // Set overlay content
      document.querySelector('.overlay-title').textContent = item.title || 'No title';
      document.querySelector('.overlay-description').innerHTML = (description || '').replace(/\n/g, '<br>');
      document.getElementById('overlay-disclaimer').innerHTML = disclaimer ? `<div class="disclaimer-header">- DISCLAIMER -</div><div class="disclaimer-text">${disclaimer.replace(/\n/g, '<br>')}</div>` : '';

      // Includes
      if (item.includes && Array.isArray(item.includes) && item.includes.length > 0) {
        document.querySelector('.overlay-includes').textContent = 'Includes ' + item.includes.join(', ');
      } else {
        document.querySelector('.overlay-includes').textContent = '';
      }
      const includesList = document.querySelector('.overlay-items');
      if (includesList) {
        includesList.innerHTML = '';
        if (item.includes && Array.isArray(item.includes)) {
          item.includes.forEach(inc => {
            includesList.innerHTML += `<li>${inc}</li>`;
          });
        }
      }

      // Prices
      // Get the clicked tile (inside your click handler)
      const atomOriginal = Number(tile.getAttribute('data-atom-original')) || 0;
      const atomFinal = Number(tile.getAttribute('data-atom-final')) || 0;
      const discount = Number(tile.getAttribute('data-discount')) || 0;

      const convert = (atomAmount) => {
        if (currentCurrency === 'atoms') return Math.round(atomAmount);
        return (atomAmount * currencyData[currentCurrency].rate).toFixed(2);
      };

      // Always show original cost
      document.getElementById('price-original').textContent = convert(atomOriginal);

      // Always show final cost
      document.getElementById('price-final').textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);

      // Show the discount amount (original - final), or 0 if none
      const discountAmount = discount > 0 ? convert(atomOriginal - atomFinal) : 0;
      document.getElementById('price-discount').textContent = discountAmount;

      // Use static share button and input from HTML
      const shareBtn = document.getElementById('overlay-link-btn');
      const shareBox = document.getElementById('overlay-link-box');
      if (shareBtn && shareBox) {
        // Reset shareBox state
        shareBox.style.display = 'none';
        shareBtn.onclick = function(e) {
          e.stopPropagation();
          let tab = document.querySelector('.tab-nav-scroll .tab.active');
          let tabIndex = tab ? tab.getAttribute('data-tab-index') : '0';
          let tabParam = tabIndex === 'preview' ? 'preview' : (isNaN(Number(tabIndex)) ? tabIndex : Number(tabIndex) + 1);
          let url = `${window.location.origin}${window.location.pathname}?tab=${tabParam}&item=${item.itemID}`;
          shareBox.value = url;
          shareBox.style.display = '';
          shareBox.focus();
          shareBox.select();
          try { document.execCommand('copy'); } catch (e) {}
        };
        shareBox.onblur = function() {
          shareBox.style.display = 'none';
        };
        overlay.onclick = function(e) {
          if (e.target !== shareBox && e.target !== shareBtn) {
            shareBox.style.display = 'none';
          }
        };
      }

      // Show expired/disabled message in overlay for custom tab items
      const overlayMsg = document.getElementById('overlay-expired-msg');
      if (overlayMsg) overlayMsg.remove();
      if (item.disabled || item.expired) {
        const msg = document.createElement('div');
        msg.id = 'overlay-expired-msg';
        msg.className = 'overlay-expired-msg';
        msg.textContent = 'This deal expired and cannot be purchased in the game anymore.';
        overlay.appendChild(msg);
      }
    });
  });
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    overlay.classList.add('hidden');
    document.getElementById('currency-select').disabled = false;
  }
});
document.querySelector('.overlay-button').addEventListener('click', () => {
  overlay.classList.add('hidden');
  document.getElementById('currency-select').disabled = false;
});

document.addEventListener('keydown', function(e) {
  if (!overlay.classList.contains('hidden') && e.key === "Tab") {
    overlay.classList.add('hidden');
    document.getElementById('currency-select').disabled = false;
    e.preventDefault(); // Prevent tabbing away if desired
  }
});

document.addEventListener("DOMContentLoaded", async function () {
  shopGrid = document.querySelector('.shop-grid');
  const tabNavScroll = document.querySelector('.tab-nav-scroll');
  if (!tabNavScroll || !shopGrid) return;

  // --- Load daily replacements FIRST ---
  const dailyReplacementsResponse = await fetch('dailyitems.json');
  const dailyReplacementsData = await dailyReplacementsResponse.json();
  window.dailyReplacements = dailyReplacementsData.DailyReplacements || [];
  window.dailySalesByWeek = dailyReplacementsData.DailySalesByWeek || {};
  window.dailySalesWeekMeta = dailyReplacementsData.DailySalesWeekMeta || {};

  // --- Now load storepagedata ---
  const response = await fetch('storepagedata.json');
  const storeData = await response.json();
  const pages = storeData.StorePageData.pages;

  // Render tabs
  tabNavScroll.innerHTML = '';
  pages.forEach((page, idx) => {
    const [title, subtitle] = page.name.split(/\\n|\n/);
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab';
    tabDiv.setAttribute('data-tab-index', idx);

    const tabImg =
      (page.image?.imageName && page.image?.directory
        ? buildImageUrl(page.image.directory, page.image.imageName)
        : '') ||
      page.image?.assocMediaPayload?.url || '';

    tabDiv.innerHTML = `
      <img src="${tabImg}" alt="${title}">
      <div class="tab-label">
        <div class="tab-title">${title || ''}</div>
        <div class="tab-subtitle">${subtitle || ''}</div>
      </div>
    `;
    tabNavScroll.appendChild(tabDiv);
  });

  // After loading dailyReplacementsData:
  const showDailyTab = !!dailyReplacementsData.showDailyTab;

  // ...after rendering store tabs...
  if (showDailyTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab';
    tabDiv.setAttribute('data-tab-index', 'preview');
    tabDiv.innerHTML = `
      <img src="images/tabs/week.webp" alt="Daily">
      <div class="tab-label">
        <div class="tab-title">Preview</div>
        <div class="tab-subtitle">The upcoming daily offers</div>
      </div>
    `;
    tabNavScroll.appendChild(tabDiv);
  }

  function renderTab(tabIdx) {
    const page = pages[tabIdx];

    // Only swap in the "S.P.E.C.I.A.L \n Free and Special Offers" tab
    if (page.name && page.name.includes('S.P.E.C.I.A.L')) {
      // Replace daily offer (itemID 2316440) with paid sale from DailySalesByWeek
      const offerIdx = page.items.findIndex(i => i.itemID === 2316440);
      const offerReplacement = getActivePaidSale(2316440);
      if (offerIdx !== -1) {
        if (offerReplacement) {
          page.items[offerIdx] = { ...offerReplacement };
        } else {
          // Remove the item if no replacement is active or in the future
          page.items.splice(offerIdx, 1);
        }
      }
      // Replace daily free (itemID 2316946)
      const freeIdx = page.items.findIndex(i => i.itemID === 2316946);
      const freeReplacement = getActiveReplacement(2316946);
      if (freeIdx !== -1) {
        if (freeReplacement) {
          page.items[freeIdx] = { ...freeReplacement };
        } else {
          page.items.splice(freeIdx, 1);
        }
      }
    }

    shopGrid.innerHTML = '';
    // Show share button again for normal tabs
  const linkBtn = document.getElementById('overlay-link-btn');
  if (linkBtn) linkBtn.style.display = '';

    (page.items || []).forEach((item, idx) => {
      // Default to no discount
      let priceFinal = item.lowestPurchasablePrice?.Amount ?? item.lowestPurchasablePrice?.amount ?? 0;
      let priceOriginal = item.highPrice?.originalAmount ?? priceFinal;
      let discount = 0;

      if (priceOriginal > priceFinal && priceFinal > 0) {
        discount = Math.round(100 - (priceFinal / priceOriginal) * 100);
      }
      // If lowestPurchasablePrice.amount == 0, but lowPrice.amount == lowPrice.originalAmount, use that price (no discount)
      else if (item.lowestPurchasablePrice?.amount === item.highPrice?.originalAmount) {
        priceFinal = item.lowestPurchasablePrice.amount;
        priceOriginal = item.highPrice.originalAmount;
        discount = 0;
      }
      // Otherwise, fallback to original price (no discount)
      // (prevents showing a "fake" discount when lowestPurchasablePrice.amount is 0)
      else {
        priceFinal = item.lowestPurchasablePrice?.originalAmount ?? 0;
        priceOriginal = item.highPrice?.originalAmount ?? 0;
        discount = 0;
      }

      // isNew: item.isNew
      const isNew = !!item.isNew;
      // isZeus (Fallout 1st): item.isZeus
      const isZeus = !!item.isZeus;

      const isClown = !!item.isClown; // Add isClown flag

      // Timer: item.lowPrice.ltoTimer (if > 0)
      const expires = (item.lowPrice?.isLto && item.lowPrice?.ltoTimer)
        ? renderTimerHTML(item.lowPrice.ltoTimer)
        : '';

      // Currency conversion
      const currency = currencyData[currentCurrency];
      const convert = (atomAmount) => {
        if (currentCurrency === 'atoms') return Math.round(atomAmount);
        return (atomAmount * currencyData[currentCurrency].rate).toFixed(2);
      };

      // Always use Atom values for conversion!
      const atomPriceOriginal = item.highPrice?.originalAmount ?? 0;
      let atomPriceFinal = atomPriceOriginal;
      if (item.lowestPurchasablePrice?.amount > 0) {
        atomPriceFinal = item.lowestPurchasablePrice.amount;
      } else if (item.lowestPurchasablePrice?.amount === item.highPrice?.originalAmount) {
        atomPriceFinal = item.lowestPurchasablePrice.amount;
      } else {
        atomPriceFinal = item.highPrice?.originalAmount ?? 0;
      }

      const oldPrice = discount > 0 ? `<span class="old-price">${convert(atomPriceOriginal)}</span>` : '';
      const currentPrice = atomPriceFinal === 0
        ? `<span class="free-badge">FREE</span>`
        : `<span class="current-price">${convert(atomPriceFinal)}</span>`;

      // New label HTML
      let newLabel = '';
      if (item.isNew === 1 || item.isNew === true) {
        newLabel = `<span class="new-label">NEW</span>`;
      } else if (item.isNew === 2) {
        newLabel = `<span class="newish-label">NEW*</span>`; // or whatever text you want
      }

      // Includes: item.dynamicBundleItems[].szItemName
      const includes = (item.dynamicBundleItems || []).map(i => i.szItemName);

      // Images:
      // Storefront image: item.primaryImage.imageName (converted to WEBP) or item.primaryImage.assocMediaPayload.url
      let storefrontImage = '';
      if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
        storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
      }

      const storefrontImageSrc = storefrontImage || '';

      // Carousel images: item.carouselImages[].imageName (converted to WEBP) or item.carouselImages[].assocMediaPayload.url
      const images = (item.carouselImages || []).map(img =>
        buildImageUrl(img.directory, img.imageName)
      ).filter(Boolean);

  // --- TILE SIZE LOGIC FOR NORMAL TABS ---
  // First 3 tiles are LARGE, rest are SMALL (ignore item.tileSize override)
  const tileSize = (idx < 3 ? "large" : "small");
  // --- END TILE SIZE LOGIC FOR NORMAL TABS ---
      const tileClass = `shop-tile ${tileSize}`;

      // --- TILE HTML ---
      let clownLabel = '';
      if (item.isClown === true) {
        clownLabel = `<span class="clown-label" title="Bethesda made a fool of themselves again!"></span>`;
      }

      const tileDisabled = item.disabled === true ? 'tile-disabled' : '';

      // Before your shopGrid.innerHTML +=
      const dateLabel = renderDateRange(item);

      shopGrid.innerHTML += `
        <div class="${tileClass} ${tileDisabled}" 
             data-item='${JSON.stringify({
               title: item.itemName,
               itemDesc: item.itemDesc,
               includes,
               storefrontImage,
               images,
               priceOriginal,
               priceFinal,
               discount,
               isNew,
               isZeus,
               isClown: !!item.isClown,
               disabled: !!item.disabled,
               itemID: item.itemID // Make sure itemID is included
             }).replace(/'/g, "&apos;")}'
             data-atom-original="${priceOriginal}" 
             data-atom-final="${priceFinal}"
             data-discount="${discount}">
          <div class="tile-img">
          
            <img src="${storefrontImageSrc}" alt="${item.itemName}"
   onerror="if(!this.src.endsWith('_l.webp')){this.src=this.src.replace('.webp','_l.webp');}else{this.onerror=null;}" />
          </div>
          ${clownLabel}
          <div class="tile-price">
            <span class="old-price"></span>
            ${currentPrice}
          </div>
          <div class="tile-badge">
            <span class="discount"></span>
            ${newLabel}
            </div>
          ${expires}
          <div class="tile-1st hidden">&nbsp;</div>
          ${expires}
          <div class="tile-footer ${tileSize}">${tileSize === 'large' ? item.itemName : item.itemNameShort}</div>
        </div>
      `;

      const tile = shopGrid.lastElementChild;
      let isExpired = false;
      if (
        item.lowPrice &&
        item.lowPrice.isLto === true &&
        typeof item.lowPrice.ltoTimer === "string" &&
        !isNaN(Date.parse(item.lowPrice.ltoTimer))
      ) {
        const expires = new Date(item.lowPrice.ltoTimer);
        if (expires < new Date()) {
          isExpired = true;
          tile.classList.add('tile-expired');
          // Label einfügen (z.B. oben rechts)
          const expiredLabel = document.createElement('div');
          expiredLabel.className = 'tile-expired-label';
          expiredLabel.textContent = 'updating soon';
          tile.appendChild(expiredLabel);
        }
      }
    });

    // Fallout 1st badge handling
    setTimeout(() => {
      const tileEls = shopGrid.querySelectorAll('.shop-tile');
      tileEls.forEach((tile) => {
        const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
        const firstDiv = tile.querySelector('.tile-1st');
        if (firstDiv) {
          if (data.isZeus) {
            firstDiv.classList.remove('hidden');
          } else {
            firstDiv.classList.add('hidden');
          }
        }
      });
    }, 0);

    attachTileClickHandlers();
    updateTilePrices();
    hideLoadingOverlayWhenReady(); 
  }

  // Attach click handlers to tabs
  const tabs = document.querySelectorAll('.tab-nav-scroll .tab');
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      // Remove .active from all tabs
      document.querySelectorAll('.tab-nav-scroll .tab').forEach(tab => tab.classList.remove('active'));
      // Add .active to the clicked tab
      document.querySelectorAll('.tab-nav-scroll .tab')[idx].classList.add('active');

      // Update the URL to reflect the selected tab (1-based)
      const tabIndex = tab.getAttribute('data-tab-index');
      let tabParam = tabIndex;
      if (!isNaN(Number(tabIndex))) {
        tabParam = Number(tabIndex) + 1;
      }
      const url = new URL(window.location);
      url.searchParams.set('tab', tabParam);
      url.searchParams.delete('item'); // Remove item param when switching tabs
      window.history.replaceState({}, '', url);

      if (tabIndex === 'preview') {
        renderCustomDailyTab();
      } else {
        renderTab(idx);
      }
    });
  });

// --- Handle tab from URL ---
let initialTabKey = null;
const urlParams = new URLSearchParams(window.location.search);
let tabParam = urlParams.get('tab');
const itemParam = urlParams.get('item');
if (tabParam && !isNaN(Number(tabParam))) {
  initialTabKey = String(Number(tabParam) - 1); // 1-based to 0-based
} else if (tabParam) {
  initialTabKey = tabParam;
}

  // Auto-load tab based on key or fallback
  let targetTab = tabs[0];
  if (initialTabKey !== null) {
    targetTab = Array.from(tabs).find(tab => {
      const idx = tab.getAttribute('data-tab-index');
      return idx === initialTabKey;
    }) || tabs[0];
  }
  targetTab.classList.add('active');
  // Scroll tab into view if needed
  setTimeout(() => {
    targetTab.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
  }, 0);
  const tabIndex = targetTab.getAttribute('data-tab-index');
  if (tabIndex === 'preview') {
    renderCustomDailyTab();
  } else {
    renderTab(Number(tabIndex));
  }

// After rendering the tab, open the overlay if needed
if (itemParam) {
  setTimeout(() => {
    const tiles = document.querySelectorAll('.shop-tile');
    for (let tile of tiles) {
      const dataItemAttr = tile.getAttribute('data-item');
      if (!dataItemAttr) continue;
      const data = JSON.parse(dataItemAttr.replace(/&apos;/g, "'"));
      if (String(data.itemID) === itemParam) {
        tile.click();
        break;
      }
    }
  }, 300); // Wait a bit to ensure tiles are rendered
}
});

// Function to render the custom daily tab
function renderCustomDailyTab() {
  if (!shopGrid) return;
  shopGrid.innerHTML = '';
  // Hide share button and box in overlay for custom tab
  const shareBtn = document.getElementById('overlay-link-btn');
  const shareBox = document.getElementById('overlay-link-box');
  //if (shareBtn) shareBtn.style.display = 'none';
  //if (shareBox) shareBox.style.display = 'none';

  // Collect all paid sales from all weeks
  let paidItems = [];
  Object.entries(window.dailySalesByWeek).forEach(([weekKey, weekArr]) => {
    if (
      !window.dailySalesWeekMeta ||
      !window.dailySalesWeekMeta[weekKey] ||
      window.dailySalesWeekMeta[weekKey].hidden !== true
    ) {
      paidItems = paidItems.concat(weekArr);
    }
  });

  paidItems.forEach((item, idx) => {
    // --- Copy your tile rendering logic from renderTab here ---
    let priceFinal = item.lowestPurchasablePrice?.Amount ?? item.lowestPurchasablePrice?.amount ?? 0;
    let priceOriginal = item.highPrice?.originalAmount ?? priceFinal;
    let discount = 0;

    if (priceOriginal > priceFinal && priceFinal > 0) {
      discount = Math.round(100 - (priceFinal / priceOriginal) * 100);
    } else if (item.lowestPurchasablePrice?.amount === item.highPrice?.originalAmount) {
      priceFinal = item.lowestPurchasablePrice.amount;
      priceOriginal = item.highPrice.originalAmount;
      discount = 0;
    } else {
      priceFinal = item.lowestPurchasablePrice?.originalAmount ?? 0;
      priceOriginal = item.highPrice?.originalAmount ?? 0;
      discount = 0;
    }

    const isNew = !!item.isNew;
    const isZeus = !!item.isZeus;
    const isClown = !!item.isClown;

    const expires = (item.lowPrice?.isLto && item.lowPrice?.ltoTimer)
      ? renderTimerHTML(item.lowPrice.ltoTimer)
      : '';

    const convert = (atomAmount) => {
      if (currentCurrency === 'atoms') return Math.round(atomAmount);
      return (atomAmount * currencyData[currentCurrency].rate).toFixed(2);
    };

    const atomPriceOriginal = item.highPrice?.originalAmount ?? 0;
    let atomPriceFinal = atomPriceOriginal;
    if (item.lowestPurchasablePrice?.amount > 0) {
      atomPriceFinal = item.lowestPurchasablePrice.amount;
    } else if (item.lowestPurchasablePrice?.amount === item.highPrice?.originalAmount) {
      atomPriceFinal = item.lowestPurchasablePrice.amount;
    } else {
      atomPriceFinal = item.highPrice?.originalAmount ?? 0;
    }

    const oldPrice = discount > 0 ? `<span class="old-price">${convert(atomPriceOriginal)}</span>` : '';
    const currentPrice = atomPriceFinal === 0
      ? `<span class="free-badge">FREE</span>`
      : `<span class="current-price">${convert(atomPriceFinal)}</span>`;

    let newLabel = '';
    if (item.isNew === 1 || item.isNew === true) {
      newLabel = `<span class="new-label">NEW</span>`;
    } else if (item.isNew === 2) {
      newLabel = `<span class="newish-label">NEW*</span>`;
    }

    const includes = (item.dynamicBundleItems || []).map(i => i.szItemName);

    let storefrontImage = '';
    if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
      storefrontImage = buildImageUrl(item.primaryImage.directory, item.primaryImage.imageName);
    }
    const storefrontImageSrc = storefrontImage || '';

    const images = (item.carouselImages || []).map(img =>
      buildImageUrl(img.directory, img.imageName)
    ).filter(Boolean);

  // --- TILE SIZE LOGIC FOR WEEKLY OFFERS TAB ---
  // First 3 tiles are SMALL, rest are LARGE
  const tileSize = item.tileSize || (idx < 3 ? "small" : "large");
  // --- END TILE SIZE LOGIC FOR WEEKLY OFFERS TAB ---
    const tileClass = `shop-tile ${tileSize}`;

    let clownLabel = '';
    if (item.isClown === true) {
      clownLabel = `<span class="clown-label" title="Bethesda made a fool of themselves again!"></span>`;
    }

    // Check if the item is expired (endTime in the past)
    let isExpired = false;
    if (item.endTime && !isNaN(Date.parse(item.endTime))) {
      const end = new Date(item.endTime);
      if (end < new Date()) {
        isExpired = true;
      }
    }

    const tileDisabled = (item.disabled === true || isExpired) ? 'tile-disabled' : '';

    // Before your shopGrid.innerHTML +=
    const dateLabel = renderDateRange(item);

    shopGrid.innerHTML += `
      <div class="${tileClass} ${tileDisabled}" 
           data-item='${JSON.stringify({
             title: item.itemName,
             itemDesc: item.itemDesc,
             includes,
             storefrontImage,
             images,
             priceOriginal,
             priceFinal,
             discount,
             isNew,
             isZeus,
             isClown: !!item.isClown,
             disabled: !!item.disabled,
             itemID: item.itemID, // Make sure itemID is included
             expired: isExpired // Add expired flag for overlay message
           }).replace(/'/g, "&apos;")}'

           data-atom-original="${priceOriginal}" 
           data-atom-final="${priceFinal}"
           data-discount="${discount}">
        <div class="tile-img">
          <img src="${storefrontImageSrc}" alt="${item.itemName}"
 onerror="if(!this.src.endsWith('_l.webp')){this.src=this.src.replace('.webp','_l.webp');}else{this.onerror=null;}" />
        </div>
        ${clownLabel}
        <div class="tile-price">
          <span class="old-price"></span>
          ${currentPrice}
        </div>
        <div class="tile-badge">
          <span class="discount"></span>
          ${newLabel}
        </div>
        ${dateLabel}
        <div class="tile-1st hidden">&nbsp;</div>
        <div class="tile-footer ${tileSize}">${tileSize === 'small' ? item.itemName : item.itemNameShort}</div>
      </div>
    `;

    
  });

  setTimeout(() => {
    const tileEls = shopGrid.querySelectorAll('.shop-tile');
    tileEls.forEach((tile) => {
      const data = JSON.parse(tile.getAttribute('data-item').replace(/&apos;/g, "'"));
      const firstDiv = tile.querySelector('.tile-1st');
      if (firstDiv) {
        if (data.isZeus) {
          firstDiv.classList.remove('hidden');
        } else {
          firstDiv.classList.add('hidden');
        }
      }
    });
  }, 0);

  attachTileClickHandlers();
  updateTilePrices();
  hideLoadingOverlayWhenReady();
  openOverlayFromUrlIfNeeded();
}
// Add this function to render the date range
function renderDateRange(item) {
  const startDate = item.startTime ? new Date(item.startTime) : null;
  const endDate = item.endTime ? new Date(item.endTime) : null;
  const dateLabel = (startDate && endDate)
    ? `<div class="tile-dates">${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &ndash;<br> ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>`
    : '';

  return dateLabel;
}

// Currency symbols and conversion rates (example rates, adjust as needed)
/*const currencyData = {
  atoms: { symbol: '⚛', rate: 1 },
  usd: { symbol: '$', rate: 0.00998 },
  eur: { symbol: '€', rate: 0.00998 },
  gbp: { symbol: '£', rate: 0.00798 },
  cad: { symbol: 'C$', rate: 0.01298 },
  jpy: { symbol: '¥', rate: 1.1 },
  cny: { symbol: '¥', rate: 0.04 },
  hkd: { symbol: 'HK$', rate: 0.078 }
};*/
const currencyData = {
  atoms: { symbol: '⚛', rate: 1 },
  usd: { symbol: '$', rate: 4.99 / 500 },        // ≈ 100.2 atoms/USD
  eur: { symbol: '€', rate: 4.99 / 500 },        // ≈ 100.2 atoms/€
  gbp: { symbol: '£', rate: 3.99 / 500 },        // ≈ 125.3 atoms/£
  cad: { symbol: 'C$', rate: 6.49 / 500 },       // ≈ 77.0 atoms/C$
  jpy: { symbol: '¥', rate: 550 / 500 },         // ≈ 0.91 atoms/¥
  cny: { symbol: '¥', rate: 20 / 500 },          // ≈ 25.0 atoms/¥
  hkd: { symbol: 'HK$', rate: 39 / 500 },         // ≈ 12.8 atoms/HK$
  twd: { symbol: 'NT$', rate: 150 / 500 },      // ≈ 3.33 atoms/NT$
  aud: { symbol: 'A$', rate: 7.95 / 500 },       // ≈ 62.9 atoms/A$
  krw: { symbol: '₩', rate: 5770 / 500 },        // ≈ 0.087 atoms/₩
  inr: { symbol: '₹', rate: 399 / 500 },         // ≈ 1.25 atoms/₹
  mxn: { symbol: 'MX$', rate: 89 / 500 },        // ≈ 5.62 atoms/MX$
  brl: { symbol: 'R$', rate: 19.99 / 500 },      // ≈ 25.0 atoms/R$
  rub: { symbol: '₽', rate: 0 / 500 /*no listing*/ } // N/A—price currently not set for Russia on SteamDB
};
// Restore currency from localStorage if available
let currentCurrency = 'usd';
const savedCurrency = localStorage.getItem('selectedCurrency');
if (savedCurrency && currencyData[savedCurrency]) {
  currentCurrency = savedCurrency;
}
document.body.classList.add(currentCurrency + '-currency');
document.getElementById('currency-select').value = currentCurrency;

document.getElementById('currency-select').addEventListener('change', function(e) {
  // Remove all currency classes before adding the new one
  document.body.className = document.body.className
    .split(' ')
    .filter(c => !c.endsWith('-currency'))
    .join(' ');

  currentCurrency = e.target.value;
  document.body.classList.add(currentCurrency + '-currency');
  updateTilePrices();

  // Save to localStorage
  localStorage.setItem('selectedCurrency', currentCurrency);
});

function getTimeRemaining(expiresAt) {
  const now = new Date();
  const end = new Date(expiresAt);
  const diff = end - now;
  if (diff <= 0) return { expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

function renderTimerHTML(expiresAt) {
  const t = getTimeRemaining(expiresAt);
  if (t.expired) return '';
  let timeText;
  if (t.days > 0) {
    timeText = `${t.days} day${t.days > 1 ? 's' : ''}`;
  } else if (t.hours > 0) {
    timeText = `${t.hours} Hours`;
  } else if (t.minutes > 0) {
    timeText = `${t.minutes} Minutes`;
  } else {
    timeText = `${t.seconds} Seconds`;
  }
  return `<div class="tile-timer" data-expires="${expiresAt}">
    <span class="timer-text">
      <span class="line1">limited time!</span><br>
      <span class="line2">${timeText}</span>
    </span>
  </div>`;
}

function updateAllTimers() {
  document.querySelectorAll('.tile-timer[data-expires]').forEach(el => {
    const expiresAt = el.getAttribute('data-expires');
    const t = getTimeRemaining(expiresAt);
    const line2 = el.querySelector('.line2');
    if (!line2) return;
    if (t.expired) {
      line2.textContent = 'expired';
      return;
    }
    if (t.days > 0) {
      line2.textContent = `${t.days} day${t.days > 1 ? 's' : ''}`;
    } else if (t.hours > 0) {
      line2.textContent = `${t.hours} hours`;
    } else if (t.minutes > 0) {
      line2.textContent = `${t.minutes} minutes`;
    } else {
      line2.textContent = `${t.seconds} seconds`;
    }
  });
}
setInterval(updateAllTimers, 1000);

document.addEventListener("keydown", function(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  // ...existing code...
});

// --- Tab-Scroll Autorepeat für A/D ---
let tabScrollTimers = { a: null, d: null };
let tabScrollActive = { a: false, d: false };
const tabScrollDelay = 350; // ms bis zum ersten Repeat
const tabScrollInterval = 120; // ms zwischen weiteren Scrolls

function scrollTabNav(direction) {
  const tabNavScroll = document.querySelector('.tab-nav-scroll');
  if (!tabNavScroll) return;
  const tabs = tabNavScroll.querySelectorAll('.tab');
  let activeIdx = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
  // Only scroll the tabNavScroll container, do not change .active class
  const tabWidth = tabs[activeIdx] ? tabs[activeIdx].offsetWidth + 10 : 270;
  if (direction === 'a') tabNavScroll.scrollLeft -= tabWidth;
  if (direction === 'd') tabNavScroll.scrollLeft += tabWidth;
  // Optionally, you can scroll the next/prev tab into view without changing .active
  // But do not add .active to them
  // This keeps the yellow border only on the selected tab
}

document.addEventListener('keydown', function(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  // Only allow tab navigation scroll if overlay is hidden
  if (!overlay || overlay.classList.contains('hidden')) {
    if ((e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D')) {
      const dir = e.key.toLowerCase();
      if (!tabScrollActive[dir]) {
        tabScrollActive[dir] = true;
        scrollTabNav(dir); // sofort scrollen
        // Nach kurzer Pause wiederholen
        tabScrollTimers[dir] = setTimeout(function repeat() {
          scrollTabNav(dir);
          tabScrollTimers[dir] = setInterval(() => scrollTabNav(dir), tabScrollInterval);
        }, tabScrollDelay);
      }
      e.preventDefault();
    }
  }
});

document.addEventListener('keyup', function(e) {
  if ((e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D')) {
    const dir = e.key.toLowerCase();
    tabScrollActive[dir] = false;
    if (tabScrollTimers[dir]) {
      clearTimeout(tabScrollTimers[dir]);
      clearInterval(tabScrollTimers[dir]);
      tabScrollTimers[dir] = null;
    }
  }
});

let current = 0;
const mainImage = document.getElementById("main-image");
const leftStrip = document.getElementById("left-strip");
const rightStrip = document.getElementById("right-strip");

// Keyboard-Handler nur einmal registrieren!
document.addEventListener('keydown', function(e) {
  if (overlay.classList.contains('hidden')) return;
  if (!galleryImages.length) return;
  if (e.key.toLowerCase() === "a" && galleryCurrent > 0) {
    galleryCurrent--;
    renderGallery(galleryImages, galleryCurrent);
  }
  if (e.key.toLowerCase() === "d" && galleryCurrent < galleryImages.length - 1) {
    galleryCurrent++;
    renderGallery(galleryImages, galleryCurrent);
  }
});

function renderGallery(images, current = 0) {
  galleryImages = images;
  galleryCurrent = current;

  const mainImage = document.getElementById("main-image");
  const leftStrip = document.getElementById("left-strip");
  const rightStrip = document.getElementById("right-strip");
  if (!mainImage || !leftStrip || !rightStrip) return;

  mainImage.onerror = function() {
    // Only try _l.webp if not already tried
    if (!this.src.endsWith('_l.webp')) {
      const fallbackSrc = this.src.replace('.webp', '_l.webp');
      // Update the galleryImages array so all strips use the fallback
      galleryImages[current] = fallbackSrc;
      this.src = fallbackSrc;
    } else {
      this.onerror = null; // Prevent infinite loop
    }
  };
  mainImage.src = images[current];

  // Left images
  leftStrip.innerHTML = "";
  const leftImages = images.slice(Math.max(0, current - 3), current);
  leftImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Left ${current - 3 + index}`;
    img.onclick = () => {
      renderGallery(images, current - (leftImages.length - index));
    };
    leftStrip.appendChild(img);
  });

  // Right images
  rightStrip.innerHTML = "";
  const rightImages = images.slice(current + 1, current + 4);
  rightImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Right ${current + 1 + index}`;
    img.onclick = () => {
      renderGallery(images, current + 1 + index);
    };
    rightStrip.appendChild(img);
  });
}

function buildImageUrl(directory, imageName) {
  if (!directory || !imageName) return '';
  if (/^https?:\/\//.test(imageName)) return imageName;
  let dir = directory.toLowerCase();
  let name = imageName.toLowerCase();
  if (!name.endsWith('.webp')) {
    name = name.replace('.dds', '.webp').replace('.png', '.webp');
  }
  return dir + name;
}

/* Images-Array sauber aufbauen
let images = [];
if (Array.isArray(item.images)) {
  images = item.images.slice();
} else if (Array.isArray(item.carouselImages)) {
  images = item.carouselImages
    .filter(img => img && img.directory && img.imageName)
    .map(img => buildImageUrl(img.directory, img.imageName))
    .filter(Boolean);
}

// If no images found, use placeholder
if (images.length === 0) {
  images = ['images/no-image.webp']; // Or leave empty to show broken image for debugging
}*/


function updateTilePrices() {
  document.querySelectorAll('.shop-tile').forEach(tile => {
    const atomOriginal = Number(tile.getAttribute('data-atom-original')) || 0;
    const atomFinal = Number(tile.getAttribute('data-atom-final')) || 0;
    const discount = Number(tile.getAttribute('data-discount')) || 0;

    const convert = (atomAmount) => {
      if (currentCurrency === 'atoms') return Math.round(atomAmount);
      return (atomAmount * currencyData[currentCurrency].rate).toFixed(2);
    };

    const oldPriceEl = tile.querySelector('.old-price');
    const currentPriceEl = tile.querySelector('.current-price');
    const discountEl = tile.querySelector('.discount');

    // Show original price only if there is a discount
    if (oldPriceEl) {
      if (discount > 0) {
        oldPriceEl.textContent = convert(atomOriginal);
        oldPriceEl.style.display = '';
      } else {
        oldPriceEl.textContent = '';
        oldPriceEl.style.display = 'none';
      }
    }

    // Always show the final price
    if (currentPriceEl) currentPriceEl.textContent = atomFinal === 0 ? 'Free' : convert(atomFinal);

    // Show discount badge only if there is a discount
    if (discountEl) {
      if (discount > 0) {
        discountEl.textContent = `-${discount}`;
        discountEl.style.display = '';
      } else {
        discountEl.textContent = '';
        discountEl.style.display = 'none';
      }
    }
  });
}

// Initiales Update der Preise
updateTilePrices();

const audio = document.getElementById('bg-music');
const muteBtn = document.getElementById('mute-btn');
const volumeSlider = document.getElementById('volume-slider');
document.body.addEventListener('click', () => {
  audio.muted = true;
  audio.play();
  audio.volume = (0.3);
}, { once: true });

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  muteBtn.innerHTML = audio.muted ? '🔇&#xFE0E;' : '🔈&#xFE0E;';

  if (!audio.muted) audio.play();
});

volumeSlider.addEventListener('input', () => {
  audio.volume = volumeSlider.value;
  if (audio.volume == 0) {
    audio.muted = true;
    muteBtn.innerHTML = '🔇&#xFE0E;';
  } else {
    audio.muted = false;
    muteBtn.innerHTML = '🔈&#xFE0E;';
    audio.play();
  }
});

function getActiveReplacement(itemID) {
  const now = simulatedNow ? simulatedNow.getTime() : Date.now();
  const candidates = dailyReplacements.filter(r => r.replaceItemID === itemID);

  // --- DEBUG LOGGING ---
  console.log('Simulated now:', new Date(now).toISOString());
  candidates.forEach(r => {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    console.log(
      r.itemName,
      'start:', r.startTime,
      'end:', r.endTime,
      'active:', start <= now && now < end
    );
  });

  // Find the one where startTime <= now < endTime
  let active = candidates.find(r => {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    return start <= now && now < end;
  });

  // If none active, show the last item whose startTime is before now
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) <= now)
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] || null;
  }

  // If still none, show the next future item
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) > now)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0] || null;
  }

  return active;
}

function getActivePaidSale(itemID) {
  const now = simulatedNow ? simulatedNow.getTime() : Date.now();
  let candidates = [];
  // Collect all sales from all weeks
  Object.values(window.dailySalesByWeek || {}).forEach(weekArr => {
    candidates = candidates.concat(weekArr.filter(r => r.replaceItemID === itemID));
  });

  // Find the one where startTime <= now < endTime
  let active = candidates.find(r => {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    return start <= now && now < end;
  });

  // If none active, show the last item whose startTime is before now
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) <= now)
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))[0] || null;
  }

  // If still none, show the next future item
  if (!active) {
    active = candidates
      .filter(r => Date.parse(r.startTime) > now)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0] || null;
  }

  return active;
}

document.getElementById('faq-link').addEventListener('click', function(e) {
  e.preventDefault();
  document.getElementById('item-overlay').classList.remove('hidden');
  document.querySelector('.overlay-content').classList.add('hidden');
  document.getElementById('overlay-faq').classList.remove('hidden');
});

document.getElementById('faq-close-btn').addEventListener('click', function() {
  document.getElementById('item-overlay').classList.add('hidden');
  document.querySelector('.overlay-content').classList.remove('hidden');
  document.getElementById('overlay-faq').classList.add('hidden');
});

function hideLoadingOverlayWhenReady() {
  const shopGrid = document.querySelector('.shop-grid');
  const images = shopGrid ? shopGrid.querySelectorAll('img') : [];
  let loaded = 0;
  if (!images.length) {
    document.getElementById('loading-overlay').style.display = 'none';
    return;
  }
  images.forEach(img => {
    // If already loaded or errored, count as loaded
    if (img.complete || img.naturalWidth !== 0) {
      loaded++;
      if (loaded === images.length) {
        document.getElementById('loading-overlay').style.display = 'none';
      }
    } else {
      img.addEventListener('load', () => {
        loaded++;
        if (loaded === images.length) {
          document.getElementById('loading-overlay').style.display = 'none';
        }
      });
      img.addEventListener('error', () => {
        loaded++;
        if (loaded === images.length) {
          document.getElementById('loading-overlay').style.display = 'none';
        }
      });
    }
  });
}

async function showNewsNotice() {
  try {
    const res = await fetch('news.json');
    if (!res.ok) return;
    const news = await res.json();
    const lastSeen = localStorage.getItem('newsNoticeSeen');
    if (lastSeen === news.id) return; // Already seen

    document.getElementById('news-header').textContent = news.header || '';
    document.getElementById('news-title').textContent = news.title || '';
    // Replace \n with <br> for line breaks in the notice text
    document.getElementById('news-text').innerHTML = (news.text || '').replace(/\n/g, '<br>');
    const notice = document.getElementById('news-notice');
    notice.classList.remove('hidden'); // <-- show

    document.getElementById('news-close').onclick = function() {
      notice.classList.add('hidden'); // <-- hide
      localStorage.setItem('newsNoticeSeen', news.id);
    };
  } catch (e) {
    // ignore errors
  }
}

let simulatedNow = null; // Set this to a Date object to simulate, or null for real time
//simulatedNow = new Date('2025-07-31T23:05:30.000Z');

document.addEventListener("DOMContentLoaded", showNewsNotice);

function isLtoExpired(item) {
  // Only treat as expired if isLto is true AND ltoTimer is a valid date string in the past
  if (!item.lowPrice || !item.lowPrice.isLto) return false;
  const ltoTimer = item.lowPrice.ltoTimer;
  if (typeof ltoTimer !== 'string' || isNaN(Date.parse(ltoTimer))) return false;
  return new Date(ltoTimer) < new Date();
}


// Place this helper at the bottom of your script, outside of any other function
function openOverlayFromUrlIfNeeded() {
  if (window._overlayOpenedFromUrl) return;
  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  if (!itemParam) return;
  // Only run once per page load
  window._overlayOpenedFromUrl = true;
  const tiles = document.querySelectorAll('.shop-tile');
  for (let tile of tiles) {
    const dataItemAttr = tile.getAttribute('data-item');
    if (!dataItemAttr) continue;
    const data = JSON.parse(dataItemAttr.replace(/&apos;/g, "'"));
    if (String(data.itemID) === itemParam) {
      tile.click();
      break;
    }
  }
}

// At the end of renderTab and renderCustomDailyTab, after all tiles are rendered:
attachTileClickHandlers();
updateTilePrices();
hideLoadingOverlayWhenReady();
openOverlayFromUrlIfNeeded();
