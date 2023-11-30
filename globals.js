'use strict';
if (window.top != window.self) return; //don't run on frames or iframes

// Constants Needed for some things
const VVE_VERSION = (/@version\s+([0-9+.]+)/.exec(GM_info.scriptMetaStr)[1]) || 'ERR';
const SECONDS_PER_WEEK = 604800 / 2;
const SECONDS_PER_DAY = 86400;

// Obsolete sobald der Backgroundscan läuft
const INIT_AUTO_SCAN = (localStorage.getItem('INIT_AUTO_SCAN') == 'true') ? true : false;
const AUTO_SCAN_IS_RUNNING = (localStorage.getItem('AUTO_SCAN_IS_RUNNING') == 'true') ? true : false;
const AUTO_SCAN_PAGE_CURRENT = parseInt(localStorage.getItem('AUTO_SCAN_PAGE_CURRENT')) || -1 
const AUTO_SCAN_PAGE_MAX = parseInt(localStorage.getItem('AUTO_SCAN_PAGE_MAX')) || -1 
const PAGE_LOAD_TIMESTAMP = Date.now();

// Obsolete sobald die Datenbank über Tampermonkey läuft
const DATABASE_NAME = 'VineVoiceExplorer';
const DATABASE_OBJECT_STORE_NAME = `${DATABASE_NAME}_Objects`;
const DATABASE_VERSION = 2;

class SETTINGS_DEFAULT {
    EnableFullWidth = true;
    DisableFooter = true;
    DisableSuggestions = true;
    FavBtnColor = 'rgb(255, 255, 102)';
    FavStarColorDefault = 'white';
    FavStarColorChecked = '#ffe143';
    NotSeenMaxCount = 5;
    PageLoadMinDelay = 750;
    DebugLevel = 0;
    MaxItemsPerPage = 500;
    FetchRetryTime = 50;
    FetchRetryMaxTime = 5000;

    CssProductNewTag = "border: 2mm ridge rgba(218, 247, 166, .6); background-color: rgba(218, 247, 166, .2)";
    CssProductSaved = "border: 2mm ridge rgba(105, 163, 0, .6); background-color: rgba(105, 163, 0, .2)";
    CssProductFavTag = "border: 2mm ridge rgba(255, 255, 102, .6); background-color: rgba(255, 255, 102, .2)";
    CssProductRemovalTag = "border: 2mm ridge rgba(255, 87, 51, .6); background-color: rgba(255, 87, 51, .2)";
    CssProductDefault = "border: 2mm ridge rgba(173,216,230, .6); background-color: rgba(173,216,230, .2)";

    constructor() {
        unsafeWindow.addEventListener('vve-save-cofig', () => {
            console.log('Got Save Event');
            this.save(true);
        })
    }

    CssProductFavStar() {
        return `float: right; display: flex; margin: 0px; color: ${this.FavStarColorDefault}; height: 0px; font-size: 25px; text-shadow: black -1px 0px, black 0px 1px, black 1px 0px, black 0px -1px; cursor: pointer;`;
    }
    
    save(local) {
        if (local) {
            console.warn('Saving Config:', this);
            return GM_setValue('VVE_SETTINGS', this);
        } else {
            unsafeWindow.dispatchEvent(new Event('vve-save-cofig')); // A little trick to beat the Namespace Problem ;)
        }
    }
}

const SETTINGS = new SETTINGS_DEFAULT();

/**
  * Load Settings from GM Storage
  */ 
function loadSettings() {
    const _settingsStore = GM_getValue('VVE_SETTINGS', {});
    console.log('Got Settings from GM:', _settingsStore);
    const _keys = Object.keys(_settingsStore);
    const _keysLength = _keys.length;

    for (let i = 0; i < _keysLength; i++) {
        const _currKey = _keys[i];

        if (!SETTINGS.hasOwnProperty(_currKey)) {
            SETTINGS[_currKey] = _settingsStore[_currKey];
        }
    }
}

/**
  * Save Settings to GM Storage
  */ 
function saveSettings() {
    GM.setValue('VVE_SETTINGS', SETTINGS).then(() => {'DONE ;)'});
}

/**
  * Timestamp in Seconds
  * @return {number} unixTimestamp
  */ 
function unixTimeStamp () {
    return Math.floor(Date.now() / 1000)
}

/**
    * Convert Millis Timestamp to Seconds Timestamp
    * @param {number} now Millis Timestamp as from Date.now();
    * @return {number} unix Timestamp
    */ 
function toUnixTimestamp(now) {
    return Math.floor(now / 1000)
}


/**
    * Convert Seconds Timestamp to Millis Timestamp
    * @param {number} unixTimestamp unix Timestamp
    * @return {number} Millis Timestamp as from Date.now();
    */ 
function toTimestamp(unixTimestamp) {
    return (unixTimestamp * 1000);
}


/**
    * Waits until a HTML Element exists ans fires callback if it is found
    * @param {string} selector querySelector
    * @param {function} cb Callback Function 
    */ 
async function waitForHtmlElmement(selector, cb) {
    if (typeof(selector) != 'string') throw new Error('waitForHtmlElement(): selector is not defined or is not type of string');
    if (typeof(cb) != 'function') throw new Error('waitForHtmlElement(): cb is not defined or is not type of string');

    if (document.querySelector(selector)) {
        cb(document.querySelector(selector));
    }

    const _observer = new MutationObserver(mutations => {
        if (document.querySelector(selector)) {
            _observer.disconnect();
            cb(document.querySelector(selector));
        }
    });

    _observer.observe(document.body || document, {
        childList: true,
        subtree: true
    });
}


/**
    * This Function will Monitor and fire Style Changes asap
    */ 
async function fastStyleChanges() {
    if (SETTINGS.EnableFullWidth) {
        waitForHtmlElmement('.vvp-body', (elem) => {
            elem.style.maxWidth = '100%';
        });
    }

    if (SETTINGS.DisableSuggestions) {
                      //rhf-frame
        waitForHtmlElmement('.copilot-secure-display', (elem) => {
            elem.style.display = 'none';
            // elem.style.visibility = 'hidden';
        });
    }

    if (SETTINGS.DisableFooter) {
        waitForHtmlElmement('#navFooter', (elem) => {
            elem.style.display = 'none';
            elem.style.visibility = 'hidden';
        });
    }
}
