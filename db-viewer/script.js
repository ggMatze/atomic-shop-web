let dbData = [];
let displayedItems = [];
let itemsPerPage = 50;
let nextItemIndex = 0;
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const statsText = document.getElementById('statsText');
const errorContainer = document.getElementById('errorContainer');

// Load database
async function loadDatabase() {
    try {
        const response = await fetch('../data/items-db.json');
        if (!response.ok) throw new Error('Failed to load database');
        dbData = await response.json();
        statsText.textContent = `Loaded ${dbData.length} items`;
        resetAndRender(dbData);
    } catch (error) {
        errorContainer.innerHTML = `<div class="error">Error loading database: ${error.message}</div>`;
        statsText.textContent = 'Failed to load database';
    }
}

// Search function
function search(query) {
    if (!query.trim()) {
        resetAndRender(dbData);
        return;
    }

    const lowerQuery = query.toLowerCase();
    const results = dbData.filter(item => {
        const edid = (item.EDID || '').toLowerCase();
        const name = (item.itemName || '').toLowerCase();
        const desc = (item.desc || '').toLowerCase();
        
        return edid.includes(lowerQuery) || name.includes(lowerQuery) || desc.includes(lowerQuery);
    });

    statsText.textContent = `Found ${results.length} of ${dbData.length} items`;
    resetAndRender(results);
}

// Reset and render initial batch
function resetAndRender(items) {
    displayedItems = items;
    nextItemIndex = 0;
    resultsContainer.innerHTML = '';
    loadMoreItems();
}

// Load next batch of items
function loadMoreItems() {
    if (nextItemIndex >= displayedItems.length) {
        // All items loaded
        if (nextItemIndex > 0) {
            setupIntersectionObserver();
        }
        return;
    }

    const endIndex = Math.min(nextItemIndex + itemsPerPage, displayedItems.length);
    const itemsToAdd = displayedItems.slice(nextItemIndex, endIndex);
    
    const html = itemsToAdd.map(item => createItemCard(item)).join('');
    resultsContainer.innerHTML += html;
    
    nextItemIndex = endIndex;

    // Setup observer to load more when scrolling
    if (nextItemIndex < displayedItems.length) {
        setupIntersectionObserver();
    }
}

// Setup intersection observer for infinite scroll
function setupIntersectionObserver() {
    const lastCard = resultsContainer.lastElementChild;
    if (!lastCard) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && nextItemIndex < displayedItems.length) {
            observer.disconnect();
            // Load next batch - reduce to 25 for subsequent loads
            itemsPerPage = 25;
            loadMoreItems();
        }
    }, { rootMargin: '500px' });

    observer.observe(lastCard);
}

// Normalize image path
function getImagePath(directory, imageName) {
    if (!directory || !imageName) return '';
    
    let dir = directory.toLowerCase().replace(/\\/g, '/').replace(/\/+/g, '/');
    // Remove leading slash for relative path
    if (dir.startsWith('/')) { dir = dir.substring(1); }
    // Ensure directory ends with /
    if (!dir.endsWith('/')) { dir = dir + '/'; }
    
    return `../${dir}${imageName}`;
}

// Create item card
function createItemCard(item) {
    const hasCarousel = item.carouselImages && item.carouselImages.length > 0;
    const hasPrimaryImage = item.primaryImage && item.primaryImage.imageName;
    
    let primaryImageHtml = '<div class="item-image placeholder">No image</div>';
    
    if (hasPrimaryImage) {
        const imgPath = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
        if (imgPath) {
            primaryImageHtml = `<div class="item-image"><img src="${imgPath}" alt="Primary" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`;
        }
    }

    const carouselHtml = hasCarousel ? `
        <div class="carousel-preview">
            <div style="font-size: 11px; color: #666; margin-bottom: 6px;">Images (${item.carouselImages.length}):</div>
            <div class="carousel-thumbs">
                ${item.carouselImages.map((img, idx) => {
                    const imgPath = getImagePath(img.directory, img.imageName);
                    return imgPath ? `<img class="carousel-thumb" src="${imgPath}" alt="Image ${idx + 1}" loading="lazy" onerror="this.style.display='none'" title="${img.imageName}">` : '';
                }).join('')}
            </div>
        </div>
    ` : '';

    const priceDisplay = item.highPriceOriginal ? `<span class="meta-tag">⚛ ${item.highPriceOriginal}</span>` : 
                         item.price ? `<span class="meta-tag">⚛ ${item.price}</span>` : '';

    return `
        <div class="item-card">
            ${primaryImageHtml}
            <div class="item-title">${item.itemName || 'N/A'}</div>
            <div class="item-edid">${item.EDID}</div>
            <div class="item-desc">${item.desc || ''}</div>
            <div class="item-meta">
                ${hasCarousel ? `<span class="meta-tag">📸 ${item.carouselImages.length}</span>` : ''}
                ${priceDisplay}
            </div>
            ${carouselHtml}
        </div>
    `;
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    search(e.target.value);
});

// Initialize
loadDatabase();
