'use strict';
if (window.top != window.self) return; //don't run on frames or iframes

// Constants Needed for some things
const VVE_VERSION = (/@version\s+([0-9+.]+)/.exec(GM_info.scriptMetaStr)[1]) || 'ERR';
const SECONDS_PER_WEEK = 604800 / 2;
const SECONDS_PER_DAY = 86400;
const SITE_IS_VINE = /http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\//.test(window.location.href);
const SITE_IS_SHOPPING = /http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/(?!vine)(?!gp\/video)(?!music)/.test(window.location.href);

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

class VVE_EVENTHANDLER {
    
     /**
    * VVE Eventhandler
    * A very basic and simple eventhandler/wrapper
    * @constructor
    * @return {VVE_EVENTHANDLER} VVE_EVENTHANDLER Object
    */ 
    constructor(){}
    
    /**
    * Fire out an Event
    * @param {string} eventName Thats the Name of the Event u want to fire
    */
    emit(eventName) {
        unsafeWindow.dispatchEvent(new Event(eventName));
    }

    /**
     * Add a Eventlistener
     * @param {string} eventName Thats the Name of the Event u want to listen for
     * @param {function} cb Thats the function who gets calles in case of this event
     */
    on(eventName, cb) {
        unsafeWindow.addEventListener(eventName, cb);
    }
}
const vve_eventhandler = new VVE_EVENTHANDLER();

class SETTINGS_DEFAULT {
    EnableFullWidth = true;
    DisableFooter = true;
    DisableSuggestions = true;
    DisableFooterShopping = false;
    DisableSuggestionsShopping = false;
    EnableBackgroundScan = true;
    EnableDesktopNotifikation = false;
    FavBtnColor = 'rgb(255, 255, 102)';
    FavStarColorDefault = 'white';
    FavStarColorChecked = '#ffe143';
    NotSeenMaxCount = 5;
    PageLoadMinDelay = 750;
    DebugLevel = 0;
    MaxItemsPerPage = 500;
    FetchRetryTime = 50;
    FetchRetryMaxTime = 5000;
    BackGroundScanDelayPerPage = 4000;
    BackGroundScannerRandomness = 4000;
    DesktopNotifikationDelay = 60;
    DesktopNotifikationKeywords = [];

    CssProductNewTag = "border: 2mm ridge rgba(218, 247, 166, .6); background-color: rgba(218, 247, 166, .2)";
    CssProductSaved = "border: 2mm ridge rgba(105, 163, 0, .6); background-color: rgba(105, 163, 0, .2)";
    CssProductFavTag = "border: 2mm ridge rgba(255, 255, 102, .6); background-color: rgba(255, 255, 102, .2)";
    CssProductRemovalTag = "border: 2mm ridge rgba(255, 87, 51, .6); background-color: rgba(255, 87, 51, .2)";
    CssProductDefault = "border: 2mm ridge rgba(173,216,230, .6); background-color: rgba(173,216,230, .2)";

    constructor() {
        vve_eventhandler.on('vve-save-cofig', () => {
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
            vve_eventhandler.emit('vve-save-cofig'); // A little trick to beat the Namespace Problem ;)
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
        console.log(`Restore Setting: ${_currKey} with Value: ${_settingsStore[_currKey]}`)
        SETTINGS[_currKey] = _settingsStore[_currKey];
    }
}

/**
  * Save Settings to GM Storage
  */ 
function saveSettings() {
    SETTINGS.save();
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
    * @param {object} [altDocument] Alternativ document root
    */ 
async function waitForHtmlElmement(selector, cb, altDocument = document) {
    if (typeof(selector) != 'string') throw new Error('waitForHtmlElement(): selector is not defined or is not type of string');
    if (typeof(cb) != 'function') throw new Error('waitForHtmlElement(): cb is not defined or is not type of string');

    if (altDocument.querySelector(selector)) {
        cb(altDocument.querySelector(selector));
    }

    const _observer = new MutationObserver(mutations => {
        if (altDocument.querySelector(selector)) {
            _observer.disconnect();
            cb(altDocument.querySelector(selector));
        }
    });

    _observer.observe(altDocument.body || altDocument, {
        childList: true,
        subtree: true
    });
}


/**
    * This Function will Monitor and fire Style Changes asap
    */ 
async function fastStyleChanges() {
  
    if (SITE_IS_VINE) {
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
    } else if (SITE_IS_SHOPPING) {

        if (SETTINGS.DisableSuggestionsShopping) {
                        //rhf-frame
            waitForHtmlElmement('#rhf', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });
        }

        if (SETTINGS.DisableFooterShopping) {
            waitForHtmlElmement('#navFooter', (elem) => {
                elem.style.display = 'none';
                elem.style.visibility = 'hidden';
            });
        }
    }


}
