// Bootstrap: import core small modules so legacy `script.js` can use window.__utils and window.__data
import * as utils from './utils.js';
import * as data from './data.js';
import * as dataLoader from './dataLoader.js';
import * as ui from './ui.js';
import * as tabs from './tabs.js';
import * as overlay from './overlay.js';
import * as gallery from './gallery.js';
import * as audio from './audio.js';

// Re-export to window for non-module legacy code
if (typeof window !== 'undefined') {
  window.__utils = { ...window.__utils, ...utils };
  window.__data = { ...window.__data, ...data };
  window.__dataLoader = { ...window.__dataLoader, ...dataLoader };
  window.__ui = { ...window.__ui, ...ui };
  window.__tabs = { ...window.__tabs, ...tabs };
  window.__overlay = { ...window.__overlay, ...overlay };
  window.__gallery = { ...window.__gallery, ...gallery };
  window.__audio = { ...window.__audio, ...audio };
}

export default { utils, data, dataLoader };
