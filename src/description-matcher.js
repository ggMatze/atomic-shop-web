// description-matcher.js - Standalone script for auto-assigning descriptions
// Load this script in your HTML: <script src="src/description-matcher.js"></script>

// Common words to use for splitting merged strings
const COMMON_WORDS = ['station', 'police', 'diner', 'vendor', 'structure', 'item', 'camp', 'decor', 'lights', 'decoration', 'furniture', 'wall', 'floor', 'roof', 'ceiling', 'door', 'stairs', 'ramp', 'bridge', 'light', 'sign', 'banner', 'rug', 'carpet', 'chair', 'table', 'bed', 'stove', 'sink', 'toilet', 'barrel', 'crate', 'shelf', 'cabinet', 'locker', 'safe', 'plan', 'recipe', 'magazine', 'book'];

// Helper function to normalize strings for matching
function normalizeForMatch(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/_entm_/g, '_') // Remove _ENTM_ from EDIDs
        .replace(/\.[^.]+$/, '') // Remove file extension
        .replace(/_c\d+$/, '') // Remove _c1, _c2, etc.
        .replace(/_l$/, ''); // Remove _l suffix if present
}

// Extract words from a string by splitting on underscores and merged words
function extractWords(str) {
    let allWords = [];
    let parts = str.split('_');
    
    parts.forEach(part => {
        // Try to split merged words using the common words dictionary
        let remaining = part;
        let words = [];
        
        // Iteratively extract known words from the end
        while (remaining.length > 2) {
            let found = false;
            // Try to match common words at the end
            for (let word of COMMON_WORDS) {
                if (remaining.endsWith(word) && remaining.length > word.length) {
                    words.unshift(word);
                    remaining = remaining.substring(0, remaining.length - word.length);
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        
        if (remaining) words.unshift(remaining);
        allWords.push(...words.filter(w => w.length > 1));
    });
    
    return new Set(allWords);
}

// Load items-db.json synchronously and create lookup tables
let edidToDescMap = new Map();
let imageLookup = new Map(); // Fast lookup by normalized image name

try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/items-db.json', false); // Synchronous
    xhr.send();
    if (xhr.status === 200) {
        const parsed = JSON.parse(xhr.responseText);
        if (Array.isArray(parsed)) {
            parsed.forEach(item => {
                if (item.EDID) {
                    const normalized = normalizeForMatch(item.EDID);
                    edidToDescMap.set(normalized, item.desc);
                    
                    // Extract words and create lookup variations
                    const words = extractWords(normalized);
                    const wordList = Array.from(words).sort();
                    
                    // Store the full item with both desc and disclaimer
                    const storedItem = {
                        desc: item.desc,
                        disclaimer: item.disclaimer || ''
                    };
                    
                    // Add variations to lookup
                    // 1. Exact normalized EDID
                    imageLookup.set(normalized, storedItem);
                    
                    // 2. Merged version (all words concatenated)
                    const merged = wordList.join('');
                    imageLookup.set(merged, storedItem);
                    
                    // 3. Underscore-separated version
                    const underscored = wordList.join('_');
                    imageLookup.set(underscored, storedItem);
                }
            });
        }
    }
    console.log(`Loaded items-db.json with ${edidToDescMap.size} entries and ${imageLookup.size} lookup variations`);
} catch (error) {
    console.warn('Failed to load items-db.json:', error);
}

// Function to apply updates to storeData
function applyUpdates(storeData) {
    let updated = 0;
    storeData.StorePageData.pages.forEach(page => {
        page.items.forEach(item => {
            // Detect bundles: items with populated dynamicBundleItems
            const isBundle = item.dynamicBundleItems && item.dynamicBundleItems.length > 0;
            
            // For bundles, set preferDB to false by default (unless explicitly set to true)
            // This prevents automatic DB description matching for bundles
            if (isBundle && item.preferDB !== true) {
                return; // Skip bundle unless explicitly marked for DB
            }
            
            // Skip if preferDB is explicitly false
            if (item.preferDB === false) return;
            
            let matchedItem = null;
            
            if (isBundle) {
                // For bundles: search by name with atx_bndl_ prefix
                const bundleNames = [item.itemName, item.itemNameShort].filter(n => n);
                
                for (let bundleName of bundleNames) {
                    // Generate expected EDID format
                    const expectedEdid = `atx_bndl_${bundleName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
                    
                    // Search lookup by exact EDID match
                    matchedItem = imageLookup.get(expectedEdid);
                    if (matchedItem) break;
                }
            } else {
                // For non-bundles: use image-based matching
                const images = [item.primaryImage, ...item.carouselImages].filter(img => img && img.imageName);
                images.forEach(img => {
                    const normalizedImage = normalizeForMatch(img.imageName);
                    
                    // Fast lookup first
                    let lookupItem = imageLookup.get(normalizedImage);
                    
                    // If not found, try extracting words and creating variations
                    if (!lookupItem) {
                        const imageWords = extractWords(normalizedImage);
                        const imageWordList = Array.from(imageWords).sort();
                        
                        // Try merged variation
                        const merged = imageWordList.join('');
                        lookupItem = imageLookup.get(merged);
                        
                        // Try underscored variation
                        if (!lookupItem) {
                            const underscored = imageWordList.join('_');
                            lookupItem = imageLookup.get(underscored);
                        }
                    }
                    
                    if (lookupItem && !matchedItem) {
                        matchedItem = lookupItem;
                    }
                });
            }
            
            if (matchedItem) {
                const matchedDesc = matchedItem.desc;
                const matchedDisclaimer = matchedItem.disclaimer;
                
                // Split at first double newline, add ' ✓' to description part
                const splitMatch = matchedDesc.match(/\n{2,}/);
                let finalDesc = matchedDesc;
                if (splitMatch) {
                    const idx = splitMatch.index;
                    const description = matchedDesc.slice(0, idx) + ' ✓';
                    const rest = matchedDesc.slice(idx);
                    finalDesc = description + rest;
                } else {
                    finalDesc = matchedDesc + ' ✓';
                }
                
                // Append DB disclaimer (always, to override or supplement)
                if (matchedDisclaimer && matchedDisclaimer.trim()) {
                    finalDesc = finalDesc + '\n\n' + matchedDisclaimer;
                }
                
                item.itemDesc = finalDesc;
                updated++;
            }
        });
    });
    console.log(`Applied auto-descriptions to ${updated} items`);
   
    return storeData;
}

// Override fetch to intercept storepagedata.json requests
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
    if (url.includes('storepagedata.json')) {
        const response = await originalFetch(url, options);
        const data = await response.json();
        const updatedData = applyUpdates(data);
        return new Response(JSON.stringify(updatedData), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'content-type': 'application/json' }
        });
    }
    return originalFetch(url, options);
};

console.log('Description Matcher loaded. Fetch for storepagedata.json is now intercepted to apply auto-descriptions.');