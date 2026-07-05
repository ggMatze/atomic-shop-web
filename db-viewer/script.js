let dbData = [];
let displayedItems = [];
let itemsPerPage = 15;
let nextItemIndex = 0;
let allCategories = [];
let externalEdidKeywords = {};
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const statsText = document.getElementById('statsText');
const errorContainer = document.getElementById('errorContainer');

//fetching json
 fetch('/data/edidkeywords.json')
  .then(res => res.json())
  .then(data => {
    externalEdidKeywords = data;
  })
  .catch(() => {
    externalEdidKeywords = {};
  })
  .finally(() => {
    loadDatabase();
  });

// Store item data by EDID for overlay access and bundle resolution
const itemDataStore = new Map();
const itemLookupByEdid = new Map();
const itemLookupByShareId = new Map();

// Valid categories to filter by
const validCategories = new Set([
    'CAMP', 'Clothing', 'Kits', 'Beds', 'Collectors', 'Defenses', 'PipBoy', 'Floors/Foundation', 'Roof', 'Doors','Armor', 'Apparel', 'Skins', 'Floor', 'Decoration', 'Wall', 'Ceiling', 'Lights', 'Utility', 'Weapons', 'Weaponmodel', 'Furniture', 'Entertainment', 'Bundle', 'Powerarmor', 'Settlement', 'Workshop', 'Vendors','Hairstyle', 'Structures', 'Headwear', 'Outfit', 'Player Icons', 'Emotes', 'Owned'
]);

// Grouped categories for filters
const filterGroups = {
    'CAMP': ['Kits','Floors/Foundation', 'Roofs', 'Wallpaper','Doors', 'Decoration', 'Floordecor','Walldecor','Signs','Vendors','Lights','Machinery','Power Connectors','Power Generators','Furniture','Beds','Stash','Displays','Shelters','Structures','Defenses','Allies', 'Utility', 'Collectron'],
    'Skins': ['C.A.M.P.','Clothing', 'Headwear', 'Armor', 'Backpack' , 'PipBoy', 'Lootbags', 'Camera', 'Weapons', 'Weapon Skins', 'Weapon Models', 'Powerarmor', 'Tents'],
    'Apparel': ['Outfits', 'Headwear', 'Underarmor', 'Armor', 'PipBoy', 'Flairs', 'Backpack'],
    'Player Appearance': ['Hairstyle', 'Tattoos', 'Facepaint'],
    'Photo Mode': [ 'Frames', 'Pose', 'Vanity Lights'],
    'Seasons': ['Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5', 'Season 6', 'Season 7', 'Season 8', 'Season 9', 'Season 10', 'Season 11', 'Season 12', 'Season 13', 'Season 14', 'Season 15', 'Season 16', 'Season 17', 'Season 18', 'Season 19', 'Season 20', 'Season 21', 'Season 22', 'Season 23', 'Season 24', 'Season 25'],
    'Mini Seasons': ['Appalachian Outlaws', 'Marvelous Fishing Excursion', 'Night at the Morgue', 'Weapons Expert Extraordinaire', 'Sunset Stranger', 'Love Hurts'],
    'Other': ['Player Icons', 'Titles', 'Emotes', 'Bundle', '\u200BCut Content','Misc','Bobbers', 'Support Item List (279/311)','P2W', 'No Image'],
    'Owned': ['Owned'],
};

// Custom filters based on arbitrary item key:value data.
const customCategoryFilters = {
    // Example: item.cBadge === 'new' will add category 'New'
    '\u200BCut Content': ['cBadge:cut'],
};

const OWNED_STORAGE_KEY = 'atomicShopOwnedIds';
let ownedIdsCache = null;

function invalidateOwnedIdsCache() {
    ownedIdsCache = null;
}

function normalizeOwnedId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function getOwnedStorageIds() {
    if (ownedIdsCache) return ownedIdsCache;

    try {
        const raw = localStorage.getItem(OWNED_STORAGE_KEY);
        if (!raw) return ownedIdsCache = new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return ownedIdsCache = new Set();
        return ownedIdsCache = new Set(parsed
            .map(id => String(id || '').trim())
            .filter(Boolean)
            .map(id => id.toLowerCase())
        );
    } catch (e) {
        return ownedIdsCache = new Set();
    }
}

function isItemOwned(item, ownedIds = null) {
    const ownedSet = ownedIds || getOwnedStorageIds();
    if (!ownedSet.size) return false;

    const candidates = new Set();
    if (item.EDID) candidates.add(item.EDID.trim().toLowerCase());
    if (item.itemID != null) candidates.add(String(item.itemID).trim().toLowerCase());
    if (item.itemName) candidates.add(normalizeOwnedId(item.itemName));
    if (item.name) candidates.add(normalizeOwnedId(item.name));
    if (item.itemNameShort) candidates.add(normalizeOwnedId(item.itemNameShort));

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (ownedSet.has(candidate)) return true;
        if (ownedSet.has(normalizeOwnedId(candidate))) return true;
    }

    return false;
}

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
            'Structures': ['structures'],
            'Defenses': ['defenses'],
            'Allies': ['ally'],
            'Tents': ['tents'],
            'Floors/Foundation': ['floors'],
            'Roofs': ['roof'],
            'Wallpaper': ['wallpaper'],
            'Stash': ['stash'],
            'Displays': ['displays', 'display'],
            'Clothing': ['outfit'],
            /*'Apparel': ['outfit', 'underarmor', 'headwear', 'backpack', 'pipboy'],*/
            'Outfits': ['outfit'],
            'Armor': ['armorskin'],
            /*'Skins': ['armorskin', 'cameraskin', 'weaponskin', 'pipboy', 'weaponmodel', 'lootbags'],*/
            'Underarmor': ['underarmor'],
            'Headwear': ['headwear'],
            'Backpack': ['backpack'],
            'Flairs': ['flair'],
            'Weapons': ['weaponskin', 'weaponmodel','weapon'],
            /*'Weaponmodel': ['weaponmodel'],*/
            'PipBoy': ['pipboy'],
            'Powerarmor': ['powerarmor'],
            'Hairstyle': ['hairstyle'],
            'Tattoos': ['tattoo'],
            'Facepaint': ['facepaint'],
            'Pose': ['photopose'],
            /*'Photomode': ['photoframe', 'photovanitylight', 'photopose'],*/
            'Player Icons': ['playericons'],
            'Emotes': ['emotes'],
            'P2W': ['storefront/utility','events'],
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
        'C.A.M.P.': ['_deployable_'],
        'Kits': ['_entm_camp_kit_'],
        'Roofs': ['_roofs_', '_roof_'],
        'Power Generators': ['_generator_'],
        'Power Connectors': ['_powerconnectors_'],
        'Camera': ['_cameraskin_'],
        'Tents': ['_survivaltent_'],
        'Underarmor': ['_underarmor_'],
        'Signs': ['_sign_', '_neonsigns_'],
        'Doors': ['_door_'],
        'Weapons': ['_weaponskin_', '_weaponmodel_', '_weapons_'],
        'Weapon Models': ['_weaponmodel_'],
        'Weapon Skins': ['_weaponskin_'],
        'Skins': ['_skin_'],
        'Emotes': ['_emotes_'],
        'Collectron': ['_collectron_'],
        'Foundations': ['_foundation_'],
        'Floors': ['_floor_'],
        'Utility': ['_camp_utility_'],
        'Beds': ['_bed_'],
        'Misc': ['_account_'],
        '\u200BCut Content': ['zzz', 'reuse','armorskin_wood_nw','_armorskin_metal_nw','_armorskin_marine_nw','_armorskin_scout_nw',
                            '_outfit_nukagirloutfit_'
        ],
        'Bundle': ['_bndl_'],
        'Vanity Lights': ['_vanitylight_'],
        'Frames': ['_photomode_frame_'],
        'Player Icons': ['_playericon_'],
        'Bobbers': ['_rodbobber_'],

        'Season 1': ['score_s1_'],
        'Season 2': ['score_s2_'],
        'Season 3': ['score_s3_'],
        'Season 4': ['score_s4_'],
        'Season 5': ['score_s5_'],
        'Season 6': ['score_s6_'],
        'Season 7': ['score_s7_'],
        'Season 8': ['score_s8_'],
        'Season 9': ['score_s9_'],
        'Season 10': ['score_s10_'],
        'Season 11': ['score_s11_'],
        'Season 12': ['score_s12_'],
        'Season 13': ['score_s13_'],
        'Season 14': ['score_s14_'],
        'Season 15': ['score_s15_'],
        'Season 16': ['score_s16_'],
        'Season 17': ['score_s17_'],
        'Season 18': ['score_s18_'],
        'Season 19': ['score_s19_'],
        'Season 20': ['score_s20_'],
        'Season 21': ['score_s21_'],
        'Season 22': ['score_s22_'],
        'Season 23': ['score_s23_'],
        'Season 24': ['score_s24_'],
        'Season 25': ['score_s25_'],

        'Appalachian Outlaws': ['_appalachianoutlaws_'],
        'Marvelous Fishing Excursion': ['_mmmfe_'],
        'Night at the Morgue': ['_nightatthemorgue_'],
        'Weapons Expert Extraordinaire': ['_weaponsexpert_'],
        'Sunset Stranger': ['_sunsetstranger_'],
        'Love Hurts': ['_miniseason_lovehurts_']
    };

    Object.assign(edidCategoryKeywords, externalEdidKeywords);

    if (item.EDID) {
        const edid = item.EDID.toLowerCase();

        // Check each category's keywords
        for (const [category, keywords] of Object.entries(edidCategoryKeywords)) {
            if (keywords.some(keyword => edid.includes(keyword))) {
                categories.add(category);
            }
        }
    }

    // Custom category filters by DB key/value pairs.
    for (const [category, conditions] of Object.entries(customCategoryFilters)) {
        if (conditions.some(condition => matchesItemCondition(item, condition))) {
            categories.add(category);
        }
    }
    
    // Check for image validation issues
    if (!item.primaryImage || item.primaryImage === null) {
        categories.add('No Image');
    } else if (typeof item.primaryImage === 'object') {
        const { imageName, directory } = item.primaryImage;
        
        // Check for missing parts
        if (!imageName) {
            categories.add('Missing Directory');
        }
        if (!directory) {
            categories.add('Missing Directory');
        }
        
        // Check for invalid path structure
        if (imageName && directory) {
            // Check if path looks suspicious
            if (!directory.includes('textures') && !directory.includes('media') && !directory.includes('storefront')) {
                categories.add('Invalid Image Path');
            }
        }
    } else {
        // primaryImage is not an object
        categories.add('Invalid Image Path');
    }
    
    return Array.from(categories);
}

function updateFilterIndicator() {
    const btn = document.getElementById('filter-toggle');

    const count = [...document.querySelectorAll('#filter-panel input[data-category]')]
        .filter(cb => cb.dataset.state && cb.dataset.state !== 'unchecked')
        .length;

    btn.classList.toggle('has-active-filters', count > 0);
    btn.dataset.count = count || '';
}

// Save checkbox states to localStorage
function saveFilterStates() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"][data-category]');
    const states = {};
    checkboxes.forEach(checkbox => {
        states[checkbox.dataset.category] = checkbox.dataset.state;
    });
    localStorage.setItem('filterStates', JSON.stringify(states));
}

// Load checkbox states from localStorage
function loadFilterStates() {
    const saved = localStorage.getItem('filterStates');
    return saved ? JSON.parse(saved) : {};
}

// Apply state to a checkbox (handles data-state, checked, and indeterminate)
function applyCheckboxState(checkbox, state) {
    const previousState = checkbox.dataset.state;
    checkbox.dataset.state = state;
    checkbox.checked = state === 'included';
    checkbox.indeterminate = state === 'excluded';
    
    // Force DOM re-render by triggering a style recalculation
    void checkbox.offsetHeight;
    
    const computedChecked = checkbox.checked;
    const computedIndeterminate = checkbox.indeterminate;
    const isVisible = checkbox.offsetParent !== null;
    
    console.log(`[Checkbox State] ${checkbox.value || checkbox.dataset.category || 'group'}: ${previousState} → ${state}`);
    console.log(`  Properties: checked=${computedChecked}, indeterminate=${computedIndeterminate}`);
    console.log(`  DOM visible: ${isVisible}, tagName: ${checkbox.tagName}, type: ${checkbox.type}`);
    console.log(`  Element:`, checkbox);
    updateFilterIndicator();
}

// Reset all filters
function resetFilters() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        applyCheckboxState(checkbox, 'unchecked');
    });
    localStorage.removeItem('filterStates');
    search(searchInput.value);
}

// Populate filter checkboxes
function populateFilters() {
    const panel = document.getElementById('filter-panel');
    panel.innerHTML = '';
    const savedStates = loadFilterStates();
    
    // Create a container for the group buttons (top row)
    const groupButtonsContainer = document.createElement('div');
    groupButtonsContainer.className = 'filter-group-buttons';
    
    // Create a container for the accordion panels
    const accordionContainer = document.createElement('div');
    accordionContainer.className = 'filter-accordion';
    
    panel.appendChild(groupButtonsContainer);
    panel.appendChild(accordionContainer);
    
    Object.entries(filterGroups).forEach(([groupName, categories]) => {
        // Create group checkbox that will go on the button
        const groupCheckbox = document.createElement('input');
        groupCheckbox.type = 'checkbox';
        groupCheckbox.value = groupName;
        groupCheckbox.id = `group-checkbox-${groupName.replace(/\s+/g, '-')}`;
        groupCheckbox.className = 'group-checkbox-button';
        
        // Create group button (top row)
        const groupButton = document.createElement('button');
        groupButton.className = 'filter-group-button';
        groupButton.dataset.group = groupName;
        
        // Add checkbox and text to button
        const buttonSpan = document.createElement('span');
        buttonSpan.textContent = `${groupName}`;
        
        groupButton.appendChild(groupCheckbox);
        groupButton.appendChild(buttonSpan);
        
        // Create accordion panel
        const accordionPanel = document.createElement('div');
        accordionPanel.className = 'filter-accordion-panel';
        accordionPanel.dataset.group = groupName;
        
        // Create hidden checkbox (for state tracking)
        const hiddenGroupCheckbox = document.createElement('input');
        hiddenGroupCheckbox.type = 'checkbox';
        hiddenGroupCheckbox.id = `group-checkbox-hidden-${groupName.replace(/\s+/g, '-')}`;
        hiddenGroupCheckbox.style.display = 'none';
        accordionPanel.appendChild(hiddenGroupCheckbox);
        
        // Create divider header with group name
        const dividerHeader = document.createElement('div');
        dividerHeader.className = 'filter-divider-header';
        dividerHeader.innerHTML = `<span class="divider-text">${groupName}</span>`;
        accordionPanel.appendChild(dividerHeader);
        
        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'filter-panel-items';
        
        categories.forEach(cat => {
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
            applyCheckboxState(checkbox, savedState);
            updateFilterIndicator();
            // Three-state cycling using data attribute as source of truth
            checkbox.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const currentState = checkbox.dataset.state;
                
                setTimeout(() => {
                    let newState = 'unchecked';
                    if (currentState === 'unchecked') {
                        newState = 'included';
                    } else if (currentState === 'included') {
                        newState = 'excluded';
                    }
                    // else stays 'unchecked'
                    
                    applyCheckboxState(checkbox, newState);
                    
                    // Update group checkbox visual state
                    const childCheckboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
                    const childStates = Array.from(childCheckboxes).map(cb => cb.dataset.state);
                    const allIncluded = childStates.every(s => s === 'included');
                    const allExcluded = childStates.every(s => s === 'excluded');
                    const allUnchecked = childStates.every(s => s === 'unchecked');
                    
                    let groupState = 'unchecked';
                    if (allIncluded) {
                        groupState = 'included';
                    } else if (allExcluded) {
                        groupState = 'excluded';
                    } else if (!allUnchecked) {
                        // Mixed states: show as indeterminate
                        groupState = 'excluded';
                    }
                    applyCheckboxState(hiddenGroupCheckbox, groupState);
                    // Also update button checkbox
                    groupCheckbox.checked = hiddenGroupCheckbox.checked;
                    groupCheckbox.indeterminate = hiddenGroupCheckbox.indeterminate;
                    groupCheckbox.dataset.state = hiddenGroupCheckbox.dataset.state;
                    
                    saveFilterStates();
                    search(searchInput.value);
                }, 0);
            });
            
            itemsContainer.appendChild(label);
        });
        
        accordionPanel.appendChild(itemsContainer);
        
        // Calculate group state based on children states
        const childStates = categories.map(cat => savedStates[cat] || 'unchecked');
        const allIncluded = childStates.every(s => s === 'included');
        const allExcluded = childStates.every(s => s === 'excluded');
        const allUnchecked = childStates.every(s => s === 'unchecked');
        
        let groupState = 'unchecked';
        if (allIncluded) {
            groupState = 'included';
        } else if (allExcluded) {
            groupState = 'excluded';
        } else if (!allUnchecked) {
            // Mixed states: show as indeterminate
            groupState = 'excluded';
        }
        
        applyCheckboxState(hiddenGroupCheckbox, groupState);
        updateFilterIndicator();
        // Sync button checkbox with hidden checkbox
        groupCheckbox.checked = hiddenGroupCheckbox.checked;
        groupCheckbox.indeterminate = hiddenGroupCheckbox.indeterminate;
        groupCheckbox.dataset.state = hiddenGroupCheckbox.dataset.state;
        
        // Group checkbox listener
        groupCheckbox.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            updateFilterIndicator();
            const currentState = hiddenGroupCheckbox.dataset.state || 'unchecked';
            
            setTimeout(() => {
                let newState = 'unchecked';
                if (currentState === 'unchecked') {
                    newState = 'included';
                } else if (currentState === 'included') {
                    newState = 'excluded';
                }
                // else stays 'unchecked'
                
                applyCheckboxState(hiddenGroupCheckbox, newState);
                // Sync button checkbox
                groupCheckbox.checked = hiddenGroupCheckbox.checked;
                groupCheckbox.indeterminate = hiddenGroupCheckbox.indeterminate;
                groupCheckbox.dataset.state = hiddenGroupCheckbox.dataset.state;
               
                // Set all children to newState
                const childCheckboxes = itemsContainer.querySelectorAll('input[type="checkbox"]');
                childCheckboxes.forEach(cb => {
                    applyCheckboxState(cb, newState);
                });
                
                saveFilterStates();
                search(searchInput.value);
            }, 0);
        });
        
        // Add group button to top row
        groupButtonsContainer.appendChild(groupButton);
        
        // Add accordion panel
        accordionContainer.appendChild(accordionPanel);
        
        // Toggle behavior (allow multiple panels open)
        groupButton.addEventListener('click', () => {
            accordionPanel.classList.toggle('active');
            groupButton.classList.toggle('active');
        });
    });
}


// Get selected categories
function getSelectedCategories() {
    const checkboxes = document.querySelectorAll('#filter-panel input[type="checkbox"][data-category]');
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
        const response = await fetch('/data/items-db.json');
        if (!response.ok) throw new Error('Failed to load database');
        dbData = await response.json();
        
        // Precompute categories and lowercase text for faster repeated searches
        const catSet = new Set();
       dbData.forEach((item, i) => {
    try {
        item._categories = getItemCategories(item) || [];

        item._lowerEDID = (item.EDID || '').toLowerCase();
        item._lowerName = ((item.itemName || item.name) || '').toLowerCase();
        item._lowerShortName = (item.itemNameShort || '').toLowerCase();

        if (item.EDID) {
            itemLookupByEdid.set(item._lowerEDID, item);
        }

        const shareIdBase = getShareIdFromValue(item.EDID || item.itemName || item.name || String(i));
        if (shareIdBase) {
            let shareId = shareIdBase;
            let collisionIndex = 1;
            while (itemLookupByShareId.has(shareId) && itemLookupByShareId.get(shareId) !== item) {
                shareId = hashStringToHex(`${shareIdBase}:${collisionIndex}`);
                collisionIndex += 1;
            }
            item._shareId = shareId;
            itemLookupByShareId.set(shareId, item);
        }

        (item._categories || []).forEach(cat => catSet.add(cat));
    } catch (e) {
        console.log("BROKEN ITEM AT INDEX:", i, item, e);
    }
});
        allCategories = Array.from(catSet).sort();
        
        populateFilters();
        updateFilterIndicator();
        statsText.textContent = `Loaded ${dbData.length} items`;

        const initialSearch = getSearchParamFromUrl();
        if (initialSearch) {
            searchInput.value = initialSearch;
            updateClearButtonVisibility();
        }

        search(searchInput.value);
        processShareLink();
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
    const ownsFilterUsed = included.includes('Owned') || excluded.includes('Owned');
    const ownedIds = ownsFilterUsed ? getOwnedStorageIds() : null;

    if (included.length > 0 || excluded.length > 0) {
        results = results.filter(item => {
            const itemCats = item._categories || getItemCategories(item);
            
            // If categories are included, item must have at least one
            if (included.length > 0) {
                const hasIncluded = included.some(cat => {
                    if (cat === 'Owned') return isItemOwned(item, ownedIds);
                    return itemCats.includes(cat);
                });
                if (!hasIncluded) return false;
            }
            
            // If categories are excluded, item must not have any
            if (excluded.length > 0) {
                const hasExcluded = excluded.some(cat => {
                    if (cat === 'Owned') return isItemOwned(item, ownedIds);
                    return itemCats.includes(cat);
                });
                if (hasExcluded) return false;
            }
            
            return true;
        });
    }
    
    // Apply text search
    if (query.trim()) {
        const lowerQuery = query.toLowerCase();
        const shareIdCandidate = lowerQuery.replace(/^0x/, '');
        if (/^[0-9a-f]{6}$/.test(shareIdCandidate)) {
            const shareItem = getItemByShareId(shareIdCandidate);
            if (shareItem) {
                results = [shareItem];
            } else {
                results = [];
            }
        } else {
            results = results.filter(item => {
                const edid = item._lowerEDID || (item.EDID || '').toLowerCase();
                const name = item._lowerName || (item.itemName || item.name || '').toLowerCase();
                const shortName = item._lowerShortName || (item.itemNameShort || '').toLowerCase();
                return edid.includes(lowerQuery) || name.includes(lowerQuery) || shortName.includes(lowerQuery);
            });
        }
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

function normalizeEdid(value) {
    return (typeof value === 'string' && value.trim()) ? value.trim().toLowerCase() : '';
}

function hashStringToHex(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0').slice(-6);
}

function getShareIdFromValue(value) {
    const normalized = normalizeEdid(value || '');
    return normalized ? hashStringToHex(normalized) : null;
}

function getItemByEdid(edid) {
    if (!edid) return null;
    return itemLookupByEdid.get(normalizeEdid(edid)) || null;
}

function getItemByShareId(shareId) {
    if (!shareId) return null;
    const normalized = String(shareId).toLowerCase().replace(/^0x/, '');
    return itemLookupByShareId.get(normalized) || null;
}

function getShareIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let itemParam = params.get('item') || '';
    if (!itemParam && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, '');
        itemParam = hash.startsWith('item=') ? hash.split('=')[1] : hash;
    }
    return itemParam ? itemParam.toLowerCase().replace(/^0x/, '') : null;
}

function getShareUrlForItem(item) {
    const params = new URLSearchParams(window.location.search);
    params.set('item', item._shareId);
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?${params.toString()}`;
}

function updateUrlForCurrentItem(item) {
    if (!item || !item._shareId) return;
    history.replaceState(null, '', getShareUrlForItem(item));
}

function getSearchParamFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const searchValue = params.get('search') || '';
    return searchValue.trim();
}

function setSearchParamInUrl(value) {
    const params = new URLSearchParams(window.location.search);
    if (value && value.trim()) {
        params.set('search', value.trim().replace(/\s+/g, ' '));
    } else {
        params.delete('search');
    }
    const hash = window.location.hash || '';
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
    history.replaceState(null, '', newUrl);
}

let searchUrlUpdateTimer;
const searchUrlUpdateDelay = 1200;

function scheduleSearchUrlUpdate(value) {
    clearTimeout(searchUrlUpdateTimer);
    searchUrlUpdateTimer = setTimeout(() => setSearchParamInUrl(value), searchUrlUpdateDelay);
}

function updateSearchUrlImmediately(value) {
    clearTimeout(searchUrlUpdateTimer);
    setSearchParamInUrl(value);
}

function removeItemParamFromUrl() {
    const params = new URLSearchParams(window.location.search);
    params.delete('item');
    const hash = window.location.hash || '';
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`;
    history.replaceState(null, '', newUrl);
}

function processShareLink() {
    const shareId = getShareIdFromUrl();
    if (!shareId) return;
    const item = getItemByShareId(shareId);
    if (item) {
        openOverlay(item);
    }
}

function resolveDynamicBundleEntry(entry) {
    if (!entry) return null;

    if (typeof entry === 'string') {
        return {
            id: null,
            oldName: entry,
            resolvedName: entry,
            resolvedShortName: entry,
            primaryImage: null,
            carouselImages: [],
            source: 'string'
        };
    }

    const id = entry.EDID || entry.entmName || entry.edid || entry.entm || entry.id || null;
    const oldName = entry.szItemName || entry.name || entry.itemName || '';
    const record = id ? getItemByEdid(id) : null;
    const resolvedName = record?.itemName || oldName || id || 'Unknown Item';
    const resolvedShortName = record?.itemNameShort || record?.itemName || oldName || '';
    const primaryImage = record?.primaryImage || entry.primaryImage || null;
    const carouselImages = Array.isArray(record?.carouselImages) ? record.carouselImages : (Array.isArray(entry.carouselImages) ? entry.carouselImages : []);

    return {
        id: id || null,
        oldName: oldName || null,
        resolvedName,
        resolvedShortName,
        primaryImage,
        carouselImages,
        source: record ? 'resolved' : 'fallback',
        record,
        originalEntry: entry
    };
}

function resolveDynamicBundleItems(item) {
    if (!item || !Array.isArray(item.dynamicBundleItems)) return [];
    return item.dynamicBundleItems.map(resolveDynamicBundleEntry).filter(Boolean);
}

function buildBundleCarouselImages(item) {
    const bundleItems = resolveDynamicBundleItems(item);
    return bundleItems
        .map(bundleEntry => {
            const image = bundleEntry.primaryImage || (Array.isArray(bundleEntry.carouselImages) ? bundleEntry.carouselImages[0] : null);
            if (image && image.directory && image.imageName) {
                return { directory: image.directory, imageName: image.imageName };
            }
            return null;
        })
        .filter(Boolean);
}

// Badge for cut stuff
const badgeKeywordMapping = [
    { keyword: 'zzz', className: 'cut-label', label: 'CUT', title: 'Cut content' },
    { keyword: 'reuse', className: 'cut-label', label: 'CUT', title: 'cut i guess' },
    
];

function getItemBadges(item) {
    if (!item || !item.EDID) return '';
    const edid = (item.EDID || '').toLowerCase();
    const seen = new Set();
    const badges = [];

    for (const rule of badgeKeywordMapping) {
        if (!edid.includes(rule.keyword)) continue;

        // Use className+label as a de-duplication key so identical badges
        // (e.g. multiple rules mapping to the same "CUT" badge) only
        // render once.
        const key = `${rule.className}|${rule.label}`;
        if (seen.has(key)) continue;

        seen.add(key);
        badges.push(`<span class="${rule.className}" title="${rule.title}">${rule.label}</span>`);
    }

    // If no keyword-based badges were produced, support a custom badge
    // via a DB field `cBadge` (e.g. "cBadge":"unreleased"). The badge
    // is rendered as an empty span with `data-badge` so CSS can set text
    // with `content: attr(data-badge)` or override per-class with
    // `content: '...'`.
    if (badges.length === 0 && item.cBadge) {
        const text = String(item.cBadge).trim();
        if (text) {
            const cls = `custom-badge badge-${sanitizeBadgeClass(text)}`;
            badges.push(`<span class="${cls}" data-badge="${escapeAttr(text)}"></span>`);
        }
    }

    return badges.join('');
}

// Helper: produce a safe classname from arbitrary text
function sanitizeBadgeClass(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'custom';
}

// Helper: escape double quotes for use in data attributes
function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
}

function matchesItemCondition(item, condition) {
    if (!condition) return false;
    const [rawKey, ...rawValueParts] = condition.split(':');
    const key = rawKey.trim();
    const value = rawValueParts.join(':').trim().toLowerCase();
    if (!key) return false;

    const field = item[key];
    if (field === undefined || field === null) return false;
    if (value === '') return true;

    const normalize = (v) => String(v).toLowerCase();

    if (typeof field === 'string' || typeof field === 'number') {
        return normalize(field).includes(value);
    }
    if (Array.isArray(field)) {
        return field.some(v => normalize(v).includes(value));
    }
    if (typeof field === 'object') {
        return JSON.stringify(field).toLowerCase().includes(value);
    }
    return false;
}

let searchDebounceTimer;
const searchDebounceDelay = 200;

// Event listeners
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        search(e.target.value);
        scheduleSearchUrlUpdate(e.target.value);
    }, searchDebounceDelay);
    updateClearButtonVisibility();
});
searchInput.addEventListener('blur', () => {
    updateSearchUrlImmediately(searchInput.value);
});

// Clear search button functionality
const clearSearchBtn = document.getElementById('clearSearchBtn');
function updateClearButtonVisibility() {
    if (searchInput.value.trim() !== '') {
        clearSearchBtn.style.display = 'block';
        searchInput.classList.add('has-clear-btn');
    } else {
        clearSearchBtn.style.display = 'none';
        searchInput.classList.remove('has-clear-btn');
    }
}

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    updateClearButtonVisibility();
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        search('');
        updateSearchUrlImmediately('');
    }, searchDebounceDelay);
    searchInput.focus();
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
const overlayShareBtn = document.getElementById('overlay-link-btn');
const overlayLinkBox = document.getElementById('overlay-link-box');
const mainImage = document.getElementById('main-image');
const leftStrip = document.getElementById('left-strip');
const rightStrip = document.getElementById('right-strip');
const overlayCloseBtn = document.querySelector('.overlay-close');
const overlayCloseTextBtn = document.getElementById('overlay-close-text-btn');

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
async function detectCarouselVariants(item, carouselImagesOverride = null) {
    const images = [];
    const hasExplicitCarousel = Array.isArray(item.carouselImages) && item.carouselImages.length > 0;
    const hasDynamicBundle = Array.isArray(item.dynamicBundleItems) && item.dynamicBundleItems.length > 0;
    const skipAutoVariants = hasExplicitCarousel || hasDynamicBundle || Array.isArray(carouselImagesOverride);

    const carouselSource = Array.isArray(carouselImagesOverride) ? carouselImagesOverride : item.carouselImages;
    if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
        const primaryUrl = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
        if (primaryUrl) {
            images.push(primaryUrl);
        }
    }

    if (carouselSource && Array.isArray(carouselSource)) {
        const carouselSeen = new Set();
        for (const carousel of carouselSource) {
            if (carousel && carousel.imageName && carousel.directory) {
                const carouselUrl = getImagePath(carousel.directory, carousel.imageName);
                if (!carouselUrl) continue;

                const isPrimaryDuplicate = carouselUrl === images[0];
                if (!carouselSeen.has(carouselUrl)) {
                    if (isPrimaryDuplicate || !images.includes(carouselUrl)) {
                        images.push(carouselUrl);
                    }
                }
                carouselSeen.add(carouselUrl);
            }
        }
    }

    if (!skipAutoVariants && item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
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
    
    const bundleEntries = resolveDynamicBundleItems(item);
    const bundleCarouselImages = buildBundleCarouselImages(item);

    // Detect carousel variants
    currentGalleryImages = await detectCarouselVariants(item, bundleCarouselImages.length ? bundleCarouselImages : null);
    currentGalleryIndex = 0;
    
    // Populate overlay content
    overlayTitle.textContent = item.itemName || item.itemNameShort || item.name || 'Item';
    
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
const bundleItems = bundleEntries.map(entry => {
    return entry.resolvedName || entry.oldName || 'Unknown Item';
});

if (bundleItems.length > 0) {
    const bundleHTML = '<div class="overlay-includes"><strong>Includes:</strong> ' + 
        bundleItems.map((itemName, idx) => `<span class="bundle-item include-item" data-include-index="${idx}">${itemName}</span>`).join(', ') + 
        '</div>';

    overlayDescription.insertAdjacentHTML('afterend', bundleHTML);
    overlay._includeListEls = Array.from(document.querySelectorAll('.overlay-includes .include-item'));
    overlay._bundleImageMap = bundleEntries.map((entry, idx) => {
        const image = entry.primaryImage || (Array.isArray(entry.carouselImages) ? entry.carouselImages[0] : null);
        const url = image && image.directory && image.imageName ? getImagePath(image.directory, image.imageName) : null;
        return { idx, url: url ? url.toLowerCase() : null };
    });
} else {
    overlay._includeListEls = [];
    overlay._bundleImageMap = [];
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
        const displayName = item.itemName || item.name || item.itemNameShort || 'N/A';
        const displayShortName = item.itemNameShort || 'N/A';
        const shareLink = item._shareId ? getShareUrlForItem(item) : '';
        const shareId = item._shareId ? `#${item._shareId}` : 'N/A';
        
        let bundleHTML = '';
        if (bundleItems.length > 0) {
            const bundleItemsList = bundleItems.map(itemId => `<code class="db-info-code">${itemId}</code>`).join('<br>');
            bundleHTML = `<div class="db-info-row">Bundle Items:<br>${bundleItemsList}</div>`;
        }
        
        dbInfoContent.innerHTML = `
            <div>Full Name:<br><code class="db-info-code">${displayName}</code></div>
            <div class="db-info-row">Short Name:<br><code class="db-info-code">${displayShortName}</code></div>
            <div class="db-info-row" id="info" title="EDID/ENTM of bundles aren't offical ( _bndl_ )">EDID/ENTM:<br><code class="db-info-code">${edid}</code></div>
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
    updateUrlForCurrentItem(item);
}

function copyShareLink() {
    if (!currentOverlayItem || !currentOverlayItem._shareId) return;
    const shareUrl = getShareUrlForItem(currentOverlayItem);
    if (overlayLinkBox) {
        overlayLinkBox.value = shareUrl;
        overlayLinkBox.style.display = '';
        overlayLinkBox.focus();
        overlayLinkBox.select();
        try { document.execCommand('copy'); } catch (e) {}
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Share link copied to clipboard');
        }).catch(() => {
            prompt('Copy this share link:', shareUrl);
        });
    } else {
        prompt('Copy this share link:', shareUrl);
    }
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

    updateBundleHighlight();
}

function updateBundleHighlight() {
    const includeEls = overlay._includeListEls || [];
    if (!includeEls.length || !overlay._bundleImageMap) return;
    if (currentGalleryIndex === 0) {
        includeEls.forEach(el => el.classList.remove('include-highlight'));
        return;
    }

    const basename = (url) => {
        if (!url) return '';
        const parts = url.split('/');
        return parts[parts.length - 1].toLowerCase();
    };

    const mainUrl = mainImage && mainImage.src ? mainImage.src.toLowerCase() : '';
    const mainName = basename(mainUrl);

    let activeIndex = null;
    for (const mapping of overlay._bundleImageMap) {
        if (!mapping.url) continue;
        if (basename(mapping.url) === mainName) {
            activeIndex = mapping.idx;
            break;
        }
    }

    includeEls.forEach(el => {
        const idx = Number(el.getAttribute('data-include-index'));
        el.classList.toggle('include-highlight', idx === activeIndex);
    });
}

// Close overlay
function closeOverlay() {
    overlay.classList.add('hidden');
    currentOverlayItem = null;
    currentGalleryImages = [];
    currentGalleryIndex = 0;
    removeItemParamFromUrl();
}

// Keyboard navigation

document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;

    if (e.key === 'Tab' || e.key === 'Escape') {
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
if (overlayCloseTextBtn) {
    overlayCloseTextBtn.addEventListener('click', closeOverlay);
}
if (overlayShareBtn) {
    overlayShareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyShareLink();
    });
}
if (overlayLinkBox) {
    overlayLinkBox.onblur = () => {
        overlayLinkBox.style.display = 'none';
    };
}
overlay.addEventListener('click', (e) => {
    if (overlayLinkBox && e.target !== overlayLinkBox && e.target !== overlayShareBtn) {
        overlayLinkBox.style.display = 'none';
    }
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

    // 🔒 safety normalization (prevents all undefined crashes)
    item.dynamicBundleItems = Array.isArray(item.dynamicBundleItems) ? item.dynamicBundleItems : [];
    item.carouselImages = Array.isArray(item.carouselImages) ? item.carouselImages : [];

    const hasCarousel = item.carouselImages.length > 0;
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

    const priceDisplay = item.highPriceOriginal
        ? `<span class="current-price">⚛ ${item.highPriceOriginal}</span>`
        : item.price
            ? `<span class="current-price">⚛ ${item.price}</span>`
            : '';

    const badgeHTML = getItemBadges(item);

    // Store item data for later access
    if (item.EDID) {
        itemDataStore.set(item.EDID, item);
    }

    const footerName = [item.itemName, item.itemNameShort, item.name]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || 'N/A';

    const bundleCount = item.dynamicBundleItems.length;

    return `
        <div class="shop-tile small" style="cursor: pointer; position: relative;" data-item-edid="${item.EDID || ''}">
            ${badgeHTML ? `<div class="tile-badge-container">${badgeHTML}</div>` : ''}

            <div class="tile-img" style="width: 100%; height: 100%;">
                ${primaryImageHtml}
            </div>

            <div class="tile-price">
                ${bundleCount > 0
                    ? `<span class="old-price" title="Item count in a Bundle or Set">${bundleCount}</span>`
                    : ''}
                <div class="current-price">${priceDisplay || '⚛ -'}</div>
            </div>

            <div class="tile-footer small">${footerName}</div>
        </div>
    `;
}
// ===== INITIALIZATION =====

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

document.getElementById("go-ufas").addEventListener("click", () => {
    window.open(window.location.origin.replace("db.", "uf."), "_blank");

});

const scrollBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
        scrollBtn.style.display = "block";
    } else {
        scrollBtn.style.display = "none";
    }
});

function scrollToTop() {
    const start = window.scrollY;
    const duration = 250; // tweak this (200–400 feels good)
    const startTime = performance.now();

    function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // easing (fast start, soft stop)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        window.scrollTo(0, start * (1 - easeOut));

        if (progress < 1) {
            requestAnimationFrame(animateScroll);
        }
    }

    requestAnimationFrame(animateScroll);
}
