let dbData = [];
let displayedItems = [];
let itemsPerPage = 15;
let nextItemIndex = 0;
let allCategories = [];
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const statsText = document.getElementById('statsText');
const errorContainer = document.getElementById('errorContainer');

// Store item data by EDID for overlay access
const itemDataStore = new Map();

// Valid categories to filter by
const validCategories = new Set([
    'CAMP', 'Clothing', 'Kits', 'Beds', 'Collectors', 'Defenses', 'PipBoy', 'Floors/Foundation', 'Roof', 'Doors','Armor', 'Apparel', 'Skins', 'Floor', 'Decoration', 'Wall', 'Ceiling', 'Lights', 'Utility', 'Weapons', 'Weaponmodel', 'Furniture', 'Entertainment', 'Bundle', 'Powerarmor', 'Settlement', 'Workshop', 'Vendors','Hairstyle', 'Structures', 'Headwear', 'Outfit', 'Playericons', 'Emotes'
]);

// Get categories for an item
function getItemCategories(item) {
    const categories = new Set();
    
    // Try to get categories from directory path first (most reliable)
    if (item.primaryImage && item.primaryImage.directory) {
        const dir = item.primaryImage.directory.toLowerCase();
        const parts = dir.split('/').filter(p => p);
        
        // Reverse mapping: category -> directories that apply to it
        const directoryToCategories = {
            'Titles': ['playertitles', 'camptitles'],
            /*'CAMP': ['camptitles', 'floordecoration', 'flags', 'signs', 'statues', 'doors', 'walldecoration', 'ceilingdecoration', 'vendors', 'lights', 'machinery', 'furniture', 'beds', 'kits', 'shelters', 'defenses', 'ally', 'floors', 'roof', 'wallpaper', 'stash', 'displays', 'camp/utility'],*/
            'Floordecor': ['floordecoration', 'flags', 'statues'],
            'Decoration': ['floordecoration', 'flags', 'signs', 'statues', 'walldecoration', 'ceilingdecoration', 'lights', 'furniture', 'beds', 'wallpaper', 'stash', 'displays'],
            'Signs': ['signs'],
            'Doors': ['doors'],
            'Walldecor': ['walldecoration', 'ceilingdecoration'],
            'Vendors': ['vendors'],
            'Lights': ['lights'],
            'Machinery': ['machinery'],
            'Furniture': ['furniture', 'beds'],
            'Beds': ['beds'],
            'Kits': ['kits', 'roof'],
            'Shelters': ['shelters'],
            'Structures': ['shelters', 'structures'],
            'Defenses': ['defenses'],
            'NPCs': ['ally'],
            'Floors/Foundation': ['floors'],
            'Roof': ['roof'],
            'Wallpaper': ['wallpaper'],
            'Containers': ['stash', 'displays'],
            'Displays': ['displays'],
            'Clothing': ['outfit'],
            /*'Apparel': ['outfit', 'underarmor', 'headwear', 'backpack', 'pipboy'],*/
            'Outfit': ['outfit'],
            'Armor': ['armorskin', 'underarmor'],
            /*'Skins': ['armorskin', 'cameraskin', 'weaponskin', 'pipboy', 'weaponmodel', 'lootbags'],*/
            /*'Underarmor': ['underarmor'],*/
            'Headwear': ['headwear'],
            'Backpack': ['backpack'],
            'Flairs': ['flair'],
            /*'Weapons': ['weaponskin', 'weaponmodel'],*/
            /*'Weaponmodel': ['weaponmodel'],*/
            'PipBoy': ['pipboy'],
            'Powerarmor': ['powerarmor'],
            'Hairstyle': ['hairstyle'],
            'Character': ['facepaint', 'tattoo', 'hairstyle', 'photopose'],
            'Tattoos': ['tattoo'],
            'Facepaint': ['facepaint'],
            'Pose': ['photopose'],
            'Photomode': ['photoframe', 'photovanitylight', 'photopose'],
            'Playericons': ['playericons'],
            'Emotes': ['emotes'],
            'P2W': ['tents', 'storefront/utility'],
            'Lootbags': ['lootbags']
        };
        
        // Process directory parts
        parts.forEach(p => {
            // Check exact matches first
            if (validCategories.has(p)) {
                categories.add(p);
                return;
            }
            
            // Check which categories apply to this directory
            for (const [category, directories] of Object.entries(directoryToCategories)) {
                if (directories.includes(p)) {
                    categories.add(category);
                }
            }
        });
        
        // Detect utility items
        if (dir.includes('/camp/utility/')) {
            categories.add('Utility');
            categories.add('CAMP');
        } else if (dir.includes('/storefront/utility/')) {
            categories.add('P2W');
        }
    }
    
    // Also check EDID for additional category detection
    // Map categories to keywords - easily customizable
    const edidCategoryKeywords = {
        'Apparel': ['_apparel_', '_outfit_'],
        'CAMP': ['_camp_'],
        'Weapons': ['_weaponskin_', '_weaponmodel_'],
        'Weapon Models': ['_weaponmodel_'],
        'Weapon Skins': ['_weaponskin_'],
        'Skins': ['_skin_'],
        'Emotes': ['_emotes_'],
        'Collectors': ['_collector_', '_collectron_'],
        'Foundations': ['_foundation_'],
        'Floors': ['_floor_'],
        '\u200BCut Content': ['zzz', 'reuse']
    };
    
    if (item.EDID) {
        const edid = item.EDID.toLowerCase();
        
        // Check each category's keywords
        for (const [category, keywords] of Object.entries(edidCategoryKeywords)) {
            if (keywords.some(keyword => edid.includes(keyword))) {
                categories.add(category);
            }
        }
    }
    
    return Array.from(categories);
}

// Save checkbox states to localStorage
function saveFilterStates() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"]');
    const states = {};
    checkboxes.forEach(checkbox => {
        states[checkbox.value] = checkbox.dataset.state;
    });
    localStorage.setItem('filterStates', JSON.stringify(states));
}

// Load checkbox states from localStorage
function loadFilterStates() {
    const saved = localStorage.getItem('filterStates');
    return saved ? JSON.parse(saved) : {};
}

// Reset all filters
function resetFilters() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.dataset.state = 'unchecked';
        checkbox.checked = false;
        checkbox.indeterminate = false;
    });
    localStorage.removeItem('filterStates');
    search(searchInput.value);
}

// Populate filter checkboxes
function populateFilters() {
    const panel = document.getElementById('filter-panel');
    panel.innerHTML = '';
    
    const savedStates = loadFilterStates();
    
    allCategories.forEach(cat => {
        const label = document.createElement('label');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat;
        checkbox.dataset.category = cat;
        
        const span = document.createElement('span');
        span.textContent = cat;
        
        label.appendChild(checkbox);
        label.appendChild(span);
        
        // Load saved state or default to unchecked
        const savedState = savedStates[cat] || 'unchecked';
        checkbox.dataset.state = savedState;
        
        if (savedState === 'included') {
            checkbox.checked = true;
            checkbox.indeterminate = false;
        } else if (savedState === 'excluded') {
            checkbox.checked = false;
            checkbox.indeterminate = true;
        } else {
            checkbox.checked = false;
            checkbox.indeterminate = false;
        }
        
        // Three-state cycling using data attribute as source of truth
        checkbox.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const currentState = checkbox.dataset.state;
            
            setTimeout(() => {
                if (currentState === 'unchecked') {
                    // Unchecked -> Included (checked)
                    checkbox.dataset.state = 'included';
                    checkbox.checked = true;
                    checkbox.indeterminate = false;
                } else if (currentState === 'included') {
                    // Included (checked) -> Excluded (indeterminate/dash)
                    checkbox.dataset.state = 'excluded';
                    checkbox.checked = false;
                    checkbox.indeterminate = true;
                } else if (currentState === 'excluded') {
                    // Excluded (indeterminate) -> Unchecked
                    checkbox.dataset.state = 'unchecked';
                    checkbox.checked = false;
                    checkbox.indeterminate = false;
                }
                
                saveFilterStates();
                search(searchInput.value);
            }, 0);
        });
        
        panel.appendChild(label);
    });
}

// Get selected categories
function getSelectedCategories() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"]');
    const included = [];
    const excluded = [];
    
    checkboxes.forEach(checkbox => {
        const state = checkbox.dataset.state;
        if (state === 'included') {
            included.push(checkbox.value);
        } else if (state === 'excluded') {
            excluded.push(checkbox.value);
        }
    });
    
    return { included, excluded };
}

// Load database
async function loadDatabase() {
    try {
        const response = await fetch('../data/items-db.json');
        if (!response.ok) throw new Error('Failed to load database');
        dbData = await response.json();
        
        // Collect all unique categories
        const catSet = new Set();
        dbData.forEach(item => {
            getItemCategories(item).forEach(cat => catSet.add(cat));
        });
        allCategories = Array.from(catSet).sort();
        
        populateFilters();
        
        statsText.textContent = `Loaded ${dbData.length} items`;
        search(searchInput.value);
    } catch (error) {
        errorContainer.innerHTML = `<div class="error">Error loading database: ${error.message}</div>`;
        statsText.textContent = 'Failed to load database';
    }
}

// Search function
function search(query) {
    let results = dbData;
    
    const { included, excluded } = getSelectedCategories();
    
    // Apply category filters
    if (included.length > 0 || excluded.length > 0) {
        results = results.filter(item => {
            const itemCats = getItemCategories(item);
            
            // If categories are included, item must have at least one
            if (included.length > 0) {
                const hasIncluded = included.some(cat => itemCats.includes(cat));
                if (!hasIncluded) return false;
            }
            
            // If categories are excluded, item must not have any
            if (excluded.length > 0) {
                const hasExcluded = excluded.some(cat => itemCats.includes(cat));
                if (hasExcluded) return false;
            }
            
            return true;
        });
    }
    
    // Apply text search
    if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        results = results.filter(item => {
            const edid = (item.EDID || '').toLowerCase();
            const name = (item.itemName || '').toLowerCase();
            return edid.includes(lowerQuery) || name.includes(lowerQuery);
        });
    }
    
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
    
    // Attach click handlers to newly added tiles
    attachTileClickHandlers();

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
            // Load next batch - reduce to 10 for subsequent loads
            itemsPerPage = 10;
            loadMoreItems();
        }
    }, { rootMargin: '50px' });

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

// Badge for cut stuff
const badgeKeywordMapping = [
    { keyword: 'zzz', className: 'cut-label', label: 'CUT', title: 'Cut content' },
    { keyword: 'reuse', className: 'cut-label', label: 'CUT', title: 'cut i guess' },
    
];

function getItemBadges(item) {
    if (!item || !item.EDID) return '';
    const edid = (item.EDID || '').toLowerCase();
    return badgeKeywordMapping
        .filter(rule => edid.includes(rule.keyword))
        .map(rule => `<span class="${rule.className}" title="${rule.title}">${rule.label}</span>`)
        .join('');
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    search(e.target.value);
});

// ===== OVERLAY FUNCTIONALITY =====

let currentOverlayItem = null;
let currentGalleryImages = [];
let currentGalleryIndex = 0;

const overlay = document.getElementById('item-overlay');
const overlayTitle = document.querySelector('.overlay-title');
const overlayDescription = document.querySelector('.overlay-description');
const overlayDisclaimer = document.querySelector('.overlay-disclaimer');
const overlayDbInfo = document.getElementById('overlay-db-info');
const mainImage = document.getElementById('main-image');
const leftStrip = document.getElementById('left-strip');
const rightStrip = document.getElementById('right-strip');
const overlayCloseBtn = document.querySelector('.overlay-close');
const overlayButton = document.querySelector('.overlay-button');

// Parse variant filename to get base name and extension
function parseVariantBase(filename) {
    if (!filename) return null;
    const match = filename.match(/^(.*?)(?:_(?:l|c\d+))?(\.\w+)$/i);
    if (!match) return null;
    return { base: match[1], ext: match[2] };
}

// Build variant filename (n=0 means _l, n>0 means _cN)
function buildVariantName(base, ext, variantNum) {
    return base + (variantNum === 0 ? '_l' : `_c${variantNum}`) + ext;
}

// Auto-detect carousel variants (c1, c2, c3, etc.)
async function detectCarouselVariants(item) {
    const images = [];
    
    // Add primary image first
    if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
        const primaryUrl = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
        if (primaryUrl) {
            images.push(primaryUrl);
        }
        
        // Add any existing carousel images from DB
        if (item.carouselImages && Array.isArray(item.carouselImages)) {
            for (const carousel of item.carouselImages) {
                if (carousel.imageName && carousel.directory) {
                    const carouselUrl = getImagePath(carousel.directory, carousel.imageName);
                    if (carouselUrl && !images.includes(carouselUrl)) {
                        images.push(carouselUrl);
                    }
                }
            }
        }
        
        // Try to find c1, c2, c3 variants based on primary image name
        const baseFileName = item.primaryImage.imageName;
        const directory = item.primaryImage.directory;
        const parsed = parseVariantBase(baseFileName);
        
        if (parsed) {
            // Try up to 16 variants
            for (let i = 1; i <= 16; i++) {
                const variantName = buildVariantName(parsed.base, parsed.ext, i);
                const variantUrl = getImagePath(directory, variantName);
                
                // Check if image exists
                const imageExists = await checkImageExists(variantUrl);
                if (imageExists && !images.includes(variantUrl)) {
                    images.push(variantUrl);
                } else if (!imageExists) {
                    // Stop searching after first missing variant to save time
                    if (i > 3) break;
                }
            }
        }
    }
    
    return images;
}

const input = document.getElementById('searchInput');

// create datalist dynamically (no HTML change needed)
const datalist = document.createElement('datalist');
datalist.id = 'searchHistory';
document.body.appendChild(datalist);
input.setAttribute('list', 'searchHistory');

let typingTimer;
const delay = 600;

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    datalist.innerHTML = history.map(v => `<option value="${v}">`).join('');
}

function saveSearch(value) {
    value = value.trim();
    if (value.length < 3) return; // avoid junk

    let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');

    if (!history.includes(value)) {
        history.unshift(value);
        history = history.slice(0, 10);
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }
}

// debounce typing
input.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        saveSearch(input.value);
        loadHistory();
    }, delay);
});

// fallback when leaving input
input.addEventListener('blur', () => {
    saveSearch(input.value);
    loadHistory();
});

loadHistory();

// Check if image exists by attempting to load it
function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Parse description and disclaimer from desc field (similar to original overlay logic)
function parseDescriptionAndDisclaimer(itemDesc) {
    let description = '';
    let disclaimer = '';
    
    if (itemDesc) {
        const normalized = String(itemDesc)
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '\n')
            .replace(/\r\n/g, '\n');
        
        const splitMatch = normalized.match(/\n{2,}/);
        if (!splitMatch) {
            description = normalized.trim();
        } else {
            const idx = splitMatch.index;
            description = normalized.slice(0, idx).trim();
            const rest = normalized.slice(idx).replace(/^\n+/, '');
            const rawParas = rest.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
            disclaimer = rawParas.join('\n\n').trim();
        }
    }
    
    return { description, disclaimer };
}

// Open overlay with item data
async function openOverlay(item) {
    currentOverlayItem = item;
    
    // Detect carousel variants
    currentGalleryImages = await detectCarouselVariants(item);
    currentGalleryIndex = 0;
    
    // Populate overlay content
    overlayTitle.textContent = item.itemName || 'Item';
    
    // Parse and display description
    const { description, disclaimer: parsedDisclaimer } = parseDescriptionAndDisclaimer(item.desc || '');
    overlayDescription.textContent = description || 'No description available';
    
    // Use item.disclaimer first, then fall back to parsed disclaimer from desc
    const disclaimerText = item.disclaimer || parsedDisclaimer || '';
    
    // Render disclaimer with header
    if (disclaimerText) {
        overlayDisclaimer.innerHTML = `<div class="disclaimer-header">- DISCLAIMER -</div><div class="disclaimer-text">${disclaimerText.replace(/\n/g, '<br>')}</div>`;
        overlayDisclaimer.style.display = 'block';
    } else {
        overlayDisclaimer.innerHTML = '';
        overlayDisclaimer.style.display = 'none';
    }
    
// remove old includes (this is the only thing you were missing)
document.querySelectorAll('.overlay-includes').forEach(el => el.remove());

// Display dynamic bundle items if they exist
const bundleItems = (item.dynamicBundleItems && Array.isArray(item.dynamicBundleItems)) 
    ? item.dynamicBundleItems.map(b => b.EDID || b.szItemName || '') 
    : [];

if (bundleItems.length > 0) {
    const bundleHTML = '<div class="overlay-includes"><strong>Includes:</strong> ' + 
        bundleItems.map(itemId => `<span class="bundle-item">${itemId}</span>`).join(', ') + 
        '</div>';

    overlayDescription.insertAdjacentHTML('afterend', bundleHTML);
}
    
    // Populate DB Info Panel
    if (overlayDbInfo) {
        const dbInfoContent = document.getElementById('db-info-content');
        let primaryImageName = (item.primaryImage ? item.primaryImage.imageName : 'N/A').toLowerCase();
        // Replace .webp with .dds for display
        primaryImageName = primaryImageName.replace(/\.webp$/i, '.dds');
        const primaryImageDir = (item.primaryImage ? item.primaryImage.directory : 'N/A').toLowerCase();
        // Use actual detected carousel count (total images - 1 for primary)
        const actualCarouselCount = Math.max(0, currentGalleryImages.length - 1);
        const edid = (item.EDID || 'N/A').toLowerCase();
        const price = item.highPriceOriginal || item.price || null;
        const priceDisplay = price ? `⚛ ${price}` : 'No price recorded';
        
        let bundleHTML = '';
        if (bundleItems.length > 0) {
            const bundleItemsList = bundleItems.map(itemId => `<code class="db-info-code">${itemId}</code>`).join('<br>');
            bundleHTML = `<div class="db-info-row">Bundle Items:<br>${bundleItemsList}</div>`;
        }
        
        dbInfoContent.innerHTML = `
            <div>Item Name:<br><code class="db-info-code">${item.itemName || 'N/A'}</code></div>
            <div class="db-info-row">EDID/ENTM:<br><code class="db-info-code">${edid}</code></div>
            <div class="db-info-row">Price:<br><code class="db-info-code">${priceDisplay}</code></div>
            <div class="db-info-row">Primary Image:<br><code class="db-info-code">${primaryImageName}</code></div>
            <div class="db-info-row">Directory:<br><code class="db-info-code">${primaryImageDir}</code></div>
            <div class="db-info-row">Carousel Images:<br><code class="db-info-code">${actualCarouselCount}</code></div>
            ${bundleHTML}
        `;
    }
    
    // Render gallery
    renderGallery();
    
    // Show overlay
    overlay.classList.remove('hidden');
}

// Render gallery with current images (based on original gallery.js logic)
function renderGallery() {
    if (currentGalleryImages.length === 0) {
        mainImage.src = '../../media/items/default-item.webp';
        mainImage.onerror = () => {
            mainImage.src = '../../media/items/default-item.webp';
        };
        leftStrip.innerHTML = '';
        rightStrip.innerHTML = '';
        return;
    }
    
    // Set main image
    const currentImg = currentGalleryImages[currentGalleryIndex];
    mainImage.src = currentImg;
    mainImage.onerror = () => {
        mainImage.onerror = null;
        mainImage.src = '../../media/items/default-item.webp';
    };
    
    // Populate left strip with up to 3 previous images
    leftStrip.innerHTML = '';
    const leftImages = currentGalleryImages.slice(
        Math.max(0, currentGalleryIndex - 3),
        currentGalleryIndex
    );
    leftImages.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Previous ${index + 1}`;
        img.onerror = () => { img.style.display = 'none'; };
        img.addEventListener('click', () => {
            currentGalleryIndex = Math.max(0, currentGalleryIndex - (leftImages.length - index));
            renderGallery();
        });
        leftStrip.appendChild(img);
    });
    
    // Populate right strip with up to 3 next images
    rightStrip.innerHTML = '';
    const rightImages = currentGalleryImages.slice(
        currentGalleryIndex + 1,
        currentGalleryIndex + 4
    );
    rightImages.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Next ${index + 1}`;
        img.onerror = () => { img.style.display = 'none'; };
        img.addEventListener('click', () => {
            currentGalleryIndex = Math.min(currentGalleryImages.length - 1, currentGalleryIndex + 1 + index);
            renderGallery();
        });
        rightStrip.appendChild(img);
    });
}

// Close overlay
function closeOverlay() {
    overlay.classList.add('hidden');
    currentOverlayItem = null;
    currentGalleryImages = [];
    currentGalleryIndex = 0;
}

// Keyboard navigation

document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;

    if (e.key === 'Tab') {
        closeOverlay();
        e.preventDefault();
    } 
    // left (A or ArrowLeft)
    else if ((e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') && currentGalleryIndex > 0) {
        currentGalleryIndex--;
        renderGallery();
        e.preventDefault();
    } 
    // right (D or ArrowRight)
    else if ((e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') && currentGalleryIndex < currentGalleryImages.length - 1) {
        currentGalleryIndex++;
        renderGallery();
        e.preventDefault();
    }
});

// Event listeners for overlay controls
overlayCloseBtn.addEventListener('click', closeOverlay);
overlayButton.addEventListener('click', closeOverlay);
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
        closeOverlay();
    }
});

// Add click handlers to tiles
function attachTileClickHandlers() {
    const tiles = document.querySelectorAll('.shop-tile');
    tiles.forEach(tile => {
        // Skip if already has listener
        if (tile.__overlayHandlerAttached) return;
        
        tile.style.cursor = 'pointer';
        tile.addEventListener('click', function() {
            const edid = this.getAttribute('data-item-edid');
            if (edid && itemDataStore.has(edid)) {
                const item = itemDataStore.get(edid);
                openOverlay(item);
            }
        });
        tile.__overlayHandlerAttached = true;
    });
}

// Update createItemCard to store data and enable clicks
function createItemCard(item) {
    const hasCarousel = item.carouselImages && item.carouselImages.length > 0;
    const hasPrimaryImage = item.primaryImage && item.primaryImage.imageName;
    
   let primaryImageHtml;

if (hasPrimaryImage) {
    const imgPath = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
    primaryImageHtml = `
        <div class="item-image">
            <img 
                src="${imgPath}" 
                alt="Primary" 
                loading="lazy"
                onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=&quot;placeholder&quot;>No image</span>';"
            >
        </div>
    `;
} else {
    primaryImageHtml = `
        <div class="placeholder">
            No image
        </div>
    `;
}

    const priceDisplay = item.highPriceOriginal ? `<span class="current-price">⚛ ${item.highPriceOriginal}</span>` : 
                         item.price ? `<span class="current-price">⚛ ${item.price}</span>` : '';

    const badgeHTML = getItemBadges(item);
    
    // Store item data for later access
    if (item.EDID) {
        itemDataStore.set(item.EDID, item);
    }
    
    return `
        <div class="shop-tile small" style="cursor: pointer; position: relative;" data-item-edid="${item.EDID || ''}">
            ${badgeHTML ? `<div class="tile-badge-container">${badgeHTML}</div>` : ''}
            <div class="tile-img" style="width: 100%; height: 100%;"> ${primaryImageHtml || '<img src="../../textures/atomic_shop_media/face8fe153089c98d6b27ddf4bf729fb.webp" alt="Primary" loading="lazy"'}</div>
            <div class="tile-price">
                ${hasCarousel ? `<span class="old-price">📸 ${item.carouselImages.length}</span>` : ''}
                <div class="current-price">${priceDisplay || '⚛ -'}</div></div>
            <div class="tile-footer small">${item.itemName || 'N/A'}</div>
        </div>
    `;
}
// ===== INITIALIZATION =====

// Event listeners
searchInput.addEventListener('input', (e) => {
    search(e.target.value);
});

document.getElementById('filter-toggle').addEventListener('click', () => {
    document.getElementById('filter-panel').classList.toggle('hidden');
});

// Add reset button if it doesn't exist
const filterToggleBtn = document.getElementById('filter-toggle');
const filterPanel = document.getElementById('filter-panel');

if (filterToggleBtn && !document.getElementById('filter-reset')) {
    const resetBtn = document.createElement('button');
    resetBtn.id = 'filter-reset';
    resetBtn.textContent = ""; // Unicode reset symbol
    resetBtn.title = 'Reset Filters';
    resetBtn.style.cssText = window.getComputedStyle(filterToggleBtn).cssText;
    
    // Insert after filter-toggle button
    filterToggleBtn.parentNode.insertBefore(resetBtn, filterToggleBtn.nextSibling);
    
    resetBtn.addEventListener('click', resetFilters);
}

document.getElementById('filter-panel').addEventListener('change', () => {
    search(searchInput.value);
});

// Initialize
loadDatabase();

document.getElementById("go-ufas").addEventListener("click", () => {
    window.open("../", "_blank");
});

