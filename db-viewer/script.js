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

const keywordLabelOverrides = {
    'Support Item List': 'Support Item List'
};

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
const overlayGalleryCache = new Map();
const overlayImageProbeCache = new Map();
const overlayImageProbePromiseCache = new Map();

// Valid categories to filter by
const validCategories = new Set([
    'CAMP', 'Clothing', 'Kits', 'Beds', 'Collectors', 'Defenses', 'PipBoy', 'Floors/Foundation', 'Roof', 'Doors','Armor', 'Apparel', 'Skins', 'Floor', 'Decoration', 'Wall', 'Ceiling', 'Lights', 'Utility', 'Weapons', 'Weaponmodel', 'Furniture', 'Entertainment', 'Bundle', 'Powerarmor', 'Settlement', 'Workshop', 'Vendors','Hairstyle', 'Structures', 'Headwear', 'Outfit', 'Player Icons', 'Emotes', 'Owned', 'Favorites/Wished'
]);

// Grouped categories for filters
const filterGroups = {
    'CAMP': ['Kits','Floors/Foundation', 'Roofs', 'Wallpaper','Doors', 'Decoration', 'Floordecor','Walldecor','Signs','Vendors','Lights','Machinery','Power Connectors','Power Generators','Furniture','Beds','Stash','Displays','Shelters','Structures','Defenses','Allies', 'Utility', 'Collectron'],
    'Skins': ['C.A.M.P.','Clothing', 'Headwear', 'Armor', 'Wood Armor','Leather Armor','Metal Armor','Robot Armor','Marine Armor','Scout Armor','Combat Armor','Civil Engineer Armor','Recon Armor','Secret Service Armor','Backpack' , 'PipBoy', 'Lootbags', 'Camera', 'Weapons', 'Weapon Skins', 'Weapon Models', 'Powerarmor', 'Tents'],
    'Apparel': ['Outfits', 'Headwear', 'Underarmor', 'Armor','PipBoy', 'Flairs', 'Backpack'],
    'Player Appearance': ['Hairstyle', 'Tattoos', 'Facepaint'],
    'Photo Mode': [ 'Frames', 'Pose', 'Vanity Lights'],
    'Seasons': ['Season 1', 'Season 2', 'Season 3', 'Season 4', 'Season 5', 'Season 6', 'Season 7', 'Season 8', 'Season 9', 'Season 10', 'Season 11', 'Season 12', 'Season 13', 'Season 14', 'Season 15', 'Season 16', 'Season 17', 'Season 18', 'Season 19', 'Season 20', 'Season 21', 'Season 22', 'Season 23', 'Season 24', 'Season 25'],
    'Mini Seasons': ['Appalachian Outlaws', 'Marvelous Fishing Excursion', 'Night at the Morgue', 'Weapons Expert Extraordinaire', 'Sunset Stranger', 'Love Hurts', 'Sock Hop' ],
    'Other': ['Player Icons', 'Titles', 'Emotes', 'Bundles', 'Sets', '\u200BCut Content','Misc','Bobbers', 'Support Item List','P2W', 'No Image'],
    'My Items': ['Owned', 'Favorites/Wished'],
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
    // Always read fresh from localStorage to ensure UI filters reflect changes
    try {
        const raw = localStorage.getItem(OWNED_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed
            .map(id => String(id || '').trim())
            .filter(Boolean)
            .map(id => id.toLowerCase())
        );
    } catch (e) {
        return new Set();
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

const FAVORITE_STORAGE_KEY = 'atomicShopFavoriteIds';
let favoriteIdsCache = null;

function invalidateFavoriteIdsCache() {
    favoriteIdsCache = null;
}

function getFavoriteStorageIds() {
    // Always read fresh from localStorage to ensure UI filters reflect changes
    try {
        const raw = localStorage.getItem(FAVORITE_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed
            .map(id => String(id || '').trim())
            .filter(Boolean)
            .map(id => id.toLowerCase())
        );
    } catch (e) {
        return new Set();
    }
}

function isItemFavorite(item, favoriteIds = null) {
    const favSet = favoriteIds || getFavoriteStorageIds();
    if (!favSet.size) return false;

    const candidates = new Set();
    if (item.EDID) candidates.add(item.EDID.trim().toLowerCase());
    if (item.itemID != null) candidates.add(String(item.itemID).trim().toLowerCase());
    if (item.itemName) candidates.add(normalizeOwnedId(item.itemName));
    if (item.name) candidates.add(normalizeOwnedId(item.name));
    if (item.itemNameShort) candidates.add(normalizeOwnedId(item.itemNameShort));

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (favSet.has(candidate)) return true;
        if (favSet.has(normalizeOwnedId(candidate))) return true;
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
        'Outfits': ['_apparel_outfit_'],
        'Headwear': ['_headwear_'],
        'Armor': ['_armorskin_'],
        'Wood Armor': ['_armorskin_wood_'],
        'Leather Armor': ['_armorskin_leather_'],
        'Metal Armor': ['_armorskin_metal_'],
        'Robot Armor': ['_armorskin_robot_'],
        'Marine Armor': ['_armorskin_marine_'],
        'Scout Armor': ['_armorskin_scout_'],
        'Combat Armor': ['_armorskin_combat_'],
        'Civil Engineer Armor': ['_armorskin_civilengineer_'],
        'Recon Armor': ['_armorskin_recon_'],
        'Secret Service Armor': ['_armorskin_secretservice_'],
        'CAMP': ['_camp_'],
        'C.A.M.P.': ['_deployable_'],
        'Wallpaper': ['_wallpaper_'],
        'Kits': ['_entm_camp_kit_'],
        'Vendors': ['_camp_vendor_'],
        'Roofs': ['_roofs_', '_roof_', '_grassroofkit'],
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
        'P2W': ['SCORE_COEN_','atx_entm_bndl_fallout_1st_weekly_consumable_bundle'],
        'Beds': ['_bed_'],
        'Misc': ['_account_'],
        '\u200BCut Content': ['zzz', 'reuse','armorskin_wood_nw','_armorskin_metal_nw','_armorskin_marine_nw','_armorskin_scout_nw',
                            '_outfit_nukagirloutfit_'
        ],
        'Bundles': ['_bndl_', '_bundle_', '_bundle','FlagWaving_PrideAssortment'],
        'Sets': ['entm_set_'],
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
        'Love Hurts': ['_miniseason_lovehurts_'],
        'Sock Hop': ['_miniseason_2026_sockhop_']
    };

    Object.assign(edidCategoryKeywords, externalEdidKeywords);

    if (item.EDID) {
        const edid = item.EDID.toLowerCase();

        // Check each category's keywords
        for (const [category, keywords] of Object.entries(edidCategoryKeywords)) {
            const isExternalCategory = Object.prototype.hasOwnProperty.call(externalEdidKeywords, category);
            if (keywords.some(keyword => {
                const normalizedKeyword = String(keyword).toLowerCase();
                return isExternalCategory
                    ? edid === normalizedKeyword
                    : edid.includes(normalizedKeyword);
            })) {
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

function getSupportItemListHint() {
    const supportCheckbox = document.querySelector('#filter-panel input[type="checkbox"][data-category="Support Item List"]');
    if (!supportCheckbox || supportCheckbox.dataset.state !== 'included') return '';

    const hasOtherIncludedFilters = [...document.querySelectorAll('#filter-panel input[type="checkbox"][data-category]')]
        .some(checkbox => checkbox.value !== 'Support Item List' && checkbox.dataset.state === 'included');
    if (hasOtherIncludedFilters) return '';

    const supportLinks = [
        { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.5em" height="1.5em" fill="currentColor" style="vertical-align: middle;" aria-label="Steam" role="img"> <path d="M568 320C568 457 456.8 568 319.6 568C205.8 568 110 491.7 80.6 387.6L175.8 426.9C182.2 459 210.7 483.3 244.7 483.3C283.9 483.3 316.6 450.9 314.9 409.8L399.4 349.6C451.5 350.9 495.2 308.7 495.2 256.1C495.2 204.5 453.2 162.6 401.5 162.6C349.8 162.6 307.8 204.6 307.8 256.1L307.8 257.3L248.6 343C233.1 342.1 217.9 346.4 205.1 355.1L72 300.1C82.2 172.4 189.1 72 319.6 72C456.8 72 568 183 568 320zM227.7 448.3L197.2 435.7C202.8 447.3 212.5 456.5 224.4 461.5C251.3 472.7 282.2 459.9 293.4 433.1C298.8 420.1 298.9 405.8 293.5 392.8C288.1 379.8 278 369.6 265 364.2C252.1 358.8 238.3 359 226.1 363.6L257.6 376.6C277.4 384.8 286.8 407.5 278.5 427.3C270.2 447.2 247.5 456.5 227.7 448.3zM401.5 193.8C435.9 193.8 463.8 221.7 463.8 256.1C463.8 290.5 435.9 318.4 401.5 318.4C367.1 318.4 339.2 290.5 339.2 256.1C339.2 221.7 367.1 193.8 401.5 193.8zM401.6 302.8C427.4 302.8 448.4 281.8 448.4 256C448.4 230.2 427.4 209.2 401.6 209.2C375.8 209.2 354.8 230.2 354.8 256C354.8 281.8 375.8 302.8 401.6 302.8z"/> </svg>', url: 'https://help.bethesda.net/#en/home/product/1129/category/14/platform1/6/subcategory/954/question/yes/subcat3/904' },
        { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.5em" height="1.5em" fill="currentColor" style="vertical-align: middle;" aria-label="Microsoft Store" role="img"> <path d="M96 96L310.6 96L310.6 310.6L96 310.6L96 96zM329.4 96L544 96L544 310.6L329.4 310.6L329.4 96zM96 329.4L310.6 329.4L310.6 544L96 544L96 329.4zM329.4 329.4L544 329.4L544 544L329.4 544L329.4 329.4z"/> </svg>', url: 'https://help.bethesda.net/#en/home/product/1129/category/14/platform1/3/subcategory/954/question/yes/subcat3/904' },
        { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.5em" height="1.5em" fill="currentColor" style="vertical-align: middle;" aria-label="XBox" role="img"> <path d="M433.9 382.2C478.2 436.5 498.6 481 488.3 500.9C480.4 516 431.6 545.5 395.7 556.8C366.1 566.1 327.3 570.1 295.3 567C257.1 563.3 218.4 549.6 185.2 528C157.3 509.8 151 502.3 151 487.4C151 457.5 183.9 405.1 240.2 345.3C272.2 311.4 316.7 271.6 321.6 272.7C331 274.8 405.9 347.8 433.9 382.2zM252.6 207.8C222.9 180.9 194.5 153.9 166.2 144.4C151 139.3 149.9 139.6 137.5 152.5C108.3 182.9 84 232.2 77.2 274.9C71.8 309.1 71.1 318.7 73 335.4C78.6 385.9 90.3 420.8 113.5 456.3C123 470.9 125.6 473.6 122.8 466.2C118.6 455.2 122.5 428.7 132.3 402.2C146.6 363.2 186.2 289.3 252.6 207.8zM564.2 271.3C547.3 191.3 496.7 141 489.6 141C482.3 141 465.4 147.5 453.6 154.9C430.3 169.4 412.6 186.3 389.3 207.7C431.7 261 491.5 347.1 512.2 410C519 430.7 521.9 451.1 519.6 462.3C517.9 470.8 517.9 470.8 521 466.9C527.1 459.2 540.9 435.6 546.4 423.4C553.8 407.2 561.4 383.2 565 364.7C569.3 342.2 568.9 293.9 564.2 271.3zM205.3 107C253 104.5 315 141.5 319.6 142.4C320.3 142.5 330 138.2 341.2 132.7C405.1 101.6 435.2 106.9 448.6 107.5C384.7 68.2 295.9 57.5 214.7 95.8C191.3 106.9 190.7 107.7 205.3 107z"/> </svg>', url: 'https://help.bethesda.net/#en/home/product/1129/category/14/platform1/1/subcategory/954/question/yes/subcat3/904' },
        { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.5em" height="1.5em" fill="currentColor" style="vertical-align: middle;" aria-label="PlayStation" role="img"> <path d="M603 436.3C591.7 450.5 564.2 460.6 564.2 460.6L359.1 534.2L359.1 479.9L510 426.1C527.1 420 529.8 411.3 515.8 406.7C501.9 402.1 476.7 403.4 459.6 409.6L359.1 445.1L359.1 388.7C382.3 380.9 406.2 375.1 434.8 371.9C475.7 367.4 525.7 372.5 565 387.4C609.2 401.4 614.2 422.1 603 436.3zM378.6 343.8L378.6 204.8C378.6 188.5 375.6 173.5 360.3 169.2C348.6 165.4 341.3 176.3 341.3 192.6L341.3 540.5L247.5 510.7L247.5 96C287.4 103.4 345.5 120.9 376.7 131.4C456.2 158.7 483.1 192.7 483.1 269.2C483.1 343.7 437.1 372 378.6 343.8zM75.3 474.2C29.9 461.4 22.3 434.7 43 419.4C62.1 405.2 94.7 394.5 94.7 394.5L229.2 346.7L229.2 401.2L132.4 435.8C115.3 441.9 112.7 450.6 126.6 455.2C140.5 459.8 165.7 458.5 182.8 452.3L229.2 435.4L229.2 484.2C177.6 493.5 127.8 491.5 75.3 474.2z"/> </svg>', url: 'https://help.bethesda.net/#en/home/product/1129/category/14/platform1/19/subcategory/954/question/yes/subcat3/904' }
    ];

    const linksHtml = supportLinks.map(({ icon, url }) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${icon}</a>`
    ).join(' · ');

    return `You can buy any of the shown items via Bethesda's support: ${linksHtml}`;
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

function getTextSearchTerms(item) {
    if (!item) return { edid: '', name: '', shortName: '' };

    return {
        edid: (item._lowerEDID || (item.EDID || '').toLowerCase()),
        name: (item._lowerName || (item.itemName || item.name || '').toLowerCase()),
        shortName: (item._lowerShortName || (item.itemNameShort || '').toLowerCase())
    };
}

function itemMatchesTextSearch(item, lowerQuery) {
    if (!item) return false;

    const { edid, name, shortName } = getTextSearchTerms(item);
    return edid.includes(lowerQuery) || name.includes(lowerQuery) || shortName.includes(lowerQuery);
}

function hasDynamicBundleContents(item) {
    return !!item && Array.isArray(item.dynamicBundleItems) && item.dynamicBundleItems.length > 0;
}

function normalizeReferenceValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
}

function itemMatchesReference(item, candidate) {
    if (!item || !candidate) return false;
    if (item === candidate) return true;

    const itemEdid = normalizeReferenceValue(item.EDID || item.edid || item.id || item.entmName || item.entm || item.itemID);
    const candidateEdid = normalizeReferenceValue(candidate.EDID || candidate.edid || candidate.id || candidate.entmName || candidate.entm || candidate.itemID);

    if (itemEdid && candidateEdid) {
        return itemEdid === candidateEdid;
    }

    if (!itemEdid && !candidateEdid) {
        const itemName = normalizeReferenceValue(item.itemName || item.name || item.resolvedName || item.oldName);
        const candidateName = normalizeReferenceValue(candidate.itemName || candidate.name || candidate.resolvedName || candidate.oldName);
        const itemShortName = normalizeReferenceValue(item.itemNameShort || item.resolvedShortName || item.shortName);
        const candidateShortName = normalizeReferenceValue(candidate.itemNameShort || candidate.resolvedShortName || candidate.shortName);

        return (itemName && candidateName && itemName === candidateName) ||
            (itemShortName && candidateShortName && itemShortName === candidateShortName);
    }

    return false;
}

function entryMatchesItem(entry, item) {
    if (!entry || !item) return false;

    if (entry.record && itemMatchesReference(item, entry.record)) return true;

    const entryId = normalizeReferenceValue(entry.id || entry.EDID || entry.edid || entry.entmName || entry.entm || entry.itemID);
    const entryName = normalizeReferenceValue(entry.resolvedName || entry.oldName || entry.name || entry.itemName);
    const entryShortName = normalizeReferenceValue(entry.resolvedShortName || entry.shortName);

    const itemEdid = normalizeReferenceValue(item.EDID || item.edid || item.id || item.entmName || item.entm || item.itemID);
    const itemName = normalizeReferenceValue(item.itemName || item.name || item.resolvedName || item.oldName);
    const itemShortName = normalizeReferenceValue(item.itemNameShort || item.resolvedShortName || item.shortName);

    if (entryId && itemEdid) {
        return entryId === itemEdid;
    }

    if (!entryId && !itemEdid) {
        return (entryName && itemName && entryName === itemName) ||
            (entryShortName && itemShortName && entryShortName === itemShortName);
    }

    return false;
}

function getBundleContentsMatches(item, candidates) {
    if (!hasDynamicBundleContents(item)) return [];

    return resolveDynamicBundleItems(item)
        .map(entry => entry?.record)
        .filter(record => !!record && candidates.includes(record));
}

function getContainingBundleMatches(item, candidates) {
    if (!item) return [];

    return candidates.filter(candidate => {
        if (candidate === item || !hasDynamicBundleContents(candidate)) return false;

        return resolveDynamicBundleItems(candidate).some(entry => entryMatchesItem(entry, item));
    });
}

// Search function
function search(query) {
    let results = dbData;
    
    const { included, excluded } = getSelectedCategories();
    
    // Apply category filters
    const ownsFilterUsed = included.includes('Owned') || excluded.includes('Owned');
    const favoritesFilterUsed = included.includes('Favorites/Wished') || excluded.includes('Favorites/Wished');
    const ownedIds = ownsFilterUsed ? getOwnedStorageIds() : null;
    const favoriteIds = favoritesFilterUsed ? getFavoriteStorageIds() : null;

    if (included.length > 0 || excluded.length > 0) {
        results = results.filter(item => {
            const itemCats = item._categories || getItemCategories(item);
            
            // If categories are included, item must have at least one
            if (included.length > 0) {
                const hasIncluded = included.some(cat => {
                    if (cat === 'Owned') return isItemOwned(item, ownedIds);
                    if (cat === 'Favorites/Wished') return isItemFavorite(item, favoriteIds);
                    return itemCats.includes(cat);
                });
                if (!hasIncluded) return false;
            }
            
            // If categories are excluded, item must not have any
            if (excluded.length > 0) {
                const hasExcluded = excluded.some(cat => {
                    if (cat === 'Owned') return isItemOwned(item, ownedIds);
                    if (cat === 'Favorites/Wished') return isItemFavorite(item, favoriteIds);
                    return itemCats.includes(cat);
                });
                if (hasExcluded) return false;
            }
            
            return true;
        });
    }
    
    let expandedReason = '';

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
            const directMatches = results.filter(item => itemMatchesTextSearch(item, lowerQuery));

            if (directMatches.length === 1) {
                const onlyMatch = directMatches[0];
                const expandedMatches = [onlyMatch];
                const extraMatches = [];

                if (hasDynamicBundleContents(onlyMatch)) {
                    extraMatches.push(...getBundleContentsMatches(onlyMatch, results));
                    if (extraMatches.length > 0) {
                        expandedReason = 'additionally showing items included in this bundle';
                    }
                } else {
                    extraMatches.push(...getContainingBundleMatches(onlyMatch, results));
                    if (extraMatches.length > 0) {
                        expandedReason = 'additionally showing bundles that include this item';
                    }
                }

                expandedMatches.push(...extraMatches);
                results = expandedMatches.filter((item, index, arr) => arr.indexOf(item) === index);
            } else {
                results = directMatches;
            }
        }
    }
    
    const supportHint = getSupportItemListHint();
    const hintMessages = [expandedReason, supportHint].filter(Boolean);

    statsText.innerHTML = `Found ${results.length} of ${dbData.length} items${hintMessages.length ? ` <span class="search-expansion-hint">${hintMessages.join('<br>')}</span>` : ''}`;
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

function getMatchingKeywordLabel(item) {
    if (!item || !item.EDID) return '';

    const edid = String(item.EDID).toLowerCase();

    for (const [category, keywords] of Object.entries(externalEdidKeywords)) {
        if (!Array.isArray(keywords)) continue;
        const matches = keywords.some(keyword => String(keyword).toLowerCase() === edid);
        if (!matches) continue;

        return 'Available for purchase via Bethesda\'s support.';
    }

    return '';
}

function buildKeywordLabelMarkup(item) {
    const label = getMatchingKeywordLabel(item);
    if (!label) return '';
    return `<div class="overlay-keyword-label">${escapeAttr(label)}</div>`;
}

function buildTileKeywordMarkup(item) {
    const label = getMatchingKeywordLabel(item);
    if (!label) return '';
    return 'supportlist';
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
const overlayKeywordTags = document.getElementById('overlay-keyword-tags');
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

function getVariantCandidateUrls(directory, imageName) {
    const urls = [];
    if (!directory || !imageName) return urls;

    const parsed = parseVariantBase(imageName);
    if (!parsed) return urls;

    const baseDirectories = [String(directory).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')];
    const lastSegment = (baseDirectories[0].split('/').filter(Boolean).pop() || '').toLowerCase();
    if (lastSegment === 'floordecoration') {
        const altDir = baseDirectories[0].replace(/\/floordecoration$/i, '/utility');
        if (altDir && altDir !== baseDirectories[0]) baseDirectories.push(altDir);
    } else if (lastSegment === 'utility') {
        const altDir = baseDirectories[0].replace(/\/utility$/i, '/floordecoration');
        if (altDir && altDir !== baseDirectories[0]) baseDirectories.push(altDir);
    }

    baseDirectories.forEach((dir) => {
        const normalizedDir = String(dir).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
        for (let i = 1; i <= 16; i++) {
            const variantName = buildVariantName(parsed.base, parsed.ext, i);
            urls.push(getImagePath(normalizedDir, variantName));
        }
    });

    return urls;
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
        const variantUrls = getVariantCandidateUrls(item.primaryImage.directory, item.primaryImage.imageName);
        const maxChecks = 6;
        for (const variantUrl of variantUrls.slice(0, maxChecks)) {
            const imageExists = await checkImageExists(variantUrl);
            if (imageExists && !images.includes(variantUrl)) {
                images.push(variantUrl);
            }
            if (images.length >= 8) break;
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
    const normalizedUrl = typeof url === 'string' ? url.trim() : '';
    if (!normalizedUrl) return Promise.resolve(false);

    if (overlayImageProbeCache.has(normalizedUrl)) {
        return Promise.resolve(overlayImageProbeCache.get(normalizedUrl));
    }

    if (overlayImageProbePromiseCache.has(normalizedUrl)) {
        return overlayImageProbePromiseCache.get(normalizedUrl);
    }

    const probePromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            overlayImageProbeCache.set(normalizedUrl, true);
            resolve(true);
        };
        img.onerror = () => {
            overlayImageProbeCache.set(normalizedUrl, false);
            resolve(false);
        };
        img.src = normalizedUrl;
    });

    overlayImageProbePromiseCache.set(normalizedUrl, probePromise);
    probePromise.finally(() => {
        overlayImageProbePromiseCache.delete(normalizedUrl);
    });

    return probePromise;
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

function getOverlayGalleryCacheKey(item) {
    if (!item || typeof item !== 'object') return '';

    const parts = [];
    const pushValue = (value) => {
        if (value == null || value === '') return;
        const normalized = String(value).trim().toLowerCase();
        if (normalized) parts.push(normalized);
    };

    pushValue(item.EDID || item.edid || item.id);
    pushValue(item.itemName || item.itemNameShort || item.name || item.title);
    if (item.primaryImage) {
        pushValue(item.primaryImage.directory);
        pushValue(item.primaryImage.imageName);
    }

    if (Array.isArray(item.dynamicBundleItems)) {
        item.dynamicBundleItems.forEach((entry) => {
            pushValue(entry?.EDID || entry?.edid || entry?.entmName || entry?.entm || entry?.id || entry?.itemID);
            pushValue(entry?.szItemName || entry?.itemName || entry?.name);
        });
    }

    return parts.join('|');
}

// Open overlay with item data
async function openOverlay(item) {
    currentOverlayItem = item;
    
    const bundleEntries = resolveDynamicBundleItems(item);
    const bundleCarouselImages = buildBundleCarouselImages(item);
    const cacheKey = getOverlayGalleryCacheKey(item);

    if (cacheKey && overlayGalleryCache.has(cacheKey)) {
        currentGalleryImages = overlayGalleryCache.get(cacheKey).slice();
        currentGalleryIndex = 0;
    } else {
        // Start with the primary and explicit carousel images so the overlay opens immediately.
        currentGalleryImages = [];
        currentGalleryIndex = 0;

        const initialGalleryImages = [];
        if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
            const primaryUrl = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
            if (primaryUrl) initialGalleryImages.push(primaryUrl);
        }

        const carouselSource = bundleCarouselImages.length ? bundleCarouselImages : item.carouselImages;
        if (Array.isArray(carouselSource)) {
            const carouselSeen = new Set();
            for (const carousel of carouselSource) {
                if (carousel && carousel.imageName && carousel.directory) {
                    const carouselUrl = getImagePath(carousel.directory, carousel.imageName);
                    if (!carouselUrl) continue;
                    const isPrimaryDuplicate = carouselUrl === initialGalleryImages[0];
                    if (!carouselSeen.has(carouselUrl) && (isPrimaryDuplicate || !initialGalleryImages.includes(carouselUrl))) {
                        initialGalleryImages.push(carouselUrl);
                    }
                    carouselSeen.add(carouselUrl);
                }
            }
        }

        currentGalleryImages = initialGalleryImages;
    }

    if (cacheKey && !overlayGalleryCache.has(cacheKey) && currentGalleryImages.length) {
        overlayGalleryCache.set(cacheKey, currentGalleryImages.slice());
    }

    // Populate overlay content
    currentGalleryImages = [];
    currentGalleryIndex = 0;

    const initialGalleryImages = [];
    if (item.primaryImage && item.primaryImage.imageName && item.primaryImage.directory) {
        const primaryUrl = getImagePath(item.primaryImage.directory, item.primaryImage.imageName);
        if (primaryUrl) initialGalleryImages.push(primaryUrl);
    }

    const carouselSource = bundleCarouselImages.length ? bundleCarouselImages : item.carouselImages;
    if (Array.isArray(carouselSource)) {
        const carouselSeen = new Set();
        for (const carousel of carouselSource) {
            if (carousel && carousel.imageName && carousel.directory) {
                const carouselUrl = getImagePath(carousel.directory, carousel.imageName);
                if (!carouselUrl) continue;
                const isPrimaryDuplicate = carouselUrl === initialGalleryImages[0];
                if (!carouselSeen.has(carouselUrl) && (isPrimaryDuplicate || !initialGalleryImages.includes(carouselUrl))) {
                    initialGalleryImages.push(carouselUrl);
                }
                carouselSeen.add(carouselUrl);
            }
        }
    }

    currentGalleryImages = initialGalleryImages;
    
    // Populate overlay content
    if (overlayKeywordTags) {
        overlayKeywordTags.innerHTML = buildKeywordLabelMarkup(item);
    }
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
            <div class="db-info-row" id="info" title="EDID/ENTM of bundles aren't offical ( _bndl_, _entm_set_ )">EDID/ENTM:<br><code class="db-info-code">${edid}</code></div>
            <div class="db-info-row">Price:<br><code class="db-info-code">${priceDisplay}</code></div>
            <div class="db-info-row">Primary Image:<br><code class="db-info-code">${primaryImageName}</code></div>
            <div class="db-info-row">Directory:<br><code class="db-info-code">${primaryImageDir}</code></div>
            <div class="db-info-row" id="db-carousel-count">Carousel Images:<br><code class="db-info-code">${actualCarouselCount}</code></div>
            ${bundleHTML}
        `;
    }
    
    // Render gallery
    renderGallery();
    
    // Show overlay
    requestAnimationFrame(() => {
        if (currentOverlayItem !== item) return;
        overlay.classList.remove('hidden');
    });
    updateUrlForCurrentItem(item);

    // Populate additional carousel variants in the background after the overlay is visible.
    void detectCarouselVariants(item, bundleCarouselImages.length ? bundleCarouselImages : null).then((detectedImages) => {
        if (currentOverlayItem !== item) return;
        if (!detectedImages.length) return;

        const hasNewImages = detectedImages.some((url) => !currentGalleryImages.includes(url));
        if (hasNewImages) {
            currentGalleryImages = detectedImages;
            currentGalleryIndex = Math.min(currentGalleryIndex, Math.max(0, currentGalleryImages.length - 1));
            if (cacheKey) overlayGalleryCache.set(cacheKey, currentGalleryImages.slice());
            renderGallery();

            const carouselCount = document.querySelector('#db-carousel-count .db-info-code');
            if (carouselCount) {
                carouselCount.textContent = String(Math.max(0, currentGalleryImages.length - 1));
            }
        }
    });
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
    if (overlayKeywordTags) {
        overlayKeywordTags.innerHTML = '';
    }
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
    const tileKeywordClass = buildTileKeywordMarkup(item);

    // Store item data for later access
    if (item.EDID) {
        itemDataStore.set(item.EDID, item);
    }

    const footerName = [item.itemName, item.itemNameShort, item.name]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || 'N/A';

    const bundleCount = item.dynamicBundleItems.length;

    return `
        <div class="shop-tile small ${tileKeywordClass}" style="cursor: pointer; position: relative;" data-item-edid="${item.EDID || ''}" data-keyword-label="${escapeAttr(getMatchingKeywordLabel(item))}">
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

// React to storage changes from other tabs/windows (localStorage changes)
window.addEventListener('storage', (e) => {
    if (!e) return;
    if (e.key === OWNED_STORAGE_KEY || e.key === FAVORITE_STORAGE_KEY || e.key === null) {
        // re-run search to apply updated filters
        search(searchInput.value);
    }
});

// Keep browser scroll restoration manual so returning to the tab does not jump.
window.history.scrollRestoration = 'manual';

function rememberCurrentScrollPosition() {
    try {
        sessionStorage.setItem('atomicShopDbViewerLastScroll', JSON.stringify({
            x: window.scrollX,
            y: window.scrollY
        }));
    } catch (e) {
        // Ignore storage failures and keep the page behavior intact.
    }
}

window.addEventListener('scroll', rememberCurrentScrollPosition, { passive: true });

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        rememberCurrentScrollPosition();
    }
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
