'use strict';

const VVE_VERSION = (/@version\s+([0-9+.]+)/.exec(GM_info.scriptMetaStr)[1]) || 'ERR';

//GM_getValue(key, defaultValue)

const FAV_BTN_COLOR = localStorage.getItem('FAV_BTN_COLOR') || "rgb(255, 255, 102)";
const CSS_PRODUCT_NEWTAG = localStorage.getItem('CSS_PRODUCT_NEWTAG') || "border: 2mm ridge rgba(218, 247, 166, .6); background-color: rgba(218, 247, 166, .2)";
const CSS_PRODUCT_SAVED = localStorage.getItem('CSS_PRODUCT_SAVED') || "border: 2mm ridge rgba(105, 163, 0, .6); background-color: rgba(105, 163, 0, .2)";
const CSS_PRODUCT_FAV = localStorage.getItem('CSS_PRODUCT_FAV') || "border: 2mm ridge rgba(255, 255, 102, .6); background-color: rgba(255, 255, 102, .2)";
const CSS_PRODUCT_MARKED_REMOVAL = localStorage.getItem('CSS_PRODUCT_FAV') || "border: 2mm ridge rgba(255, 87, 51, .6); background-color: rgba(255, 87, 51, .2)";
const CSS_PRODUCT_DEFAULT = localStorage.getItem('CSS_PRODUCT_DEFAULT') || "border: 2mm ridge rgba(173,216,230, .6); background-color: rgba(173,216,230, .2)";

const FAV_STAR_COLOR_DEFAULT = localStorage.getItem('FAV_STAR_COLOR_DEFAULT') || 'white'
const FAV_STAR_COLOR_CHECKED = localStorage.getItem('FAV_STAR_COLOR_CHECKED') || '#ffe143' // Gelb
const CSS_PRODUCT_FAV_STAR = `float: right; display: flex; margin: 0px; color: ${FAV_STAR_COLOR_DEFAULT}; height: 0px; font-size: 25px; text-shadow: black -1px 0px, black 0px 1px, black 1px 0px, black 0px -1px; cursor: pointer;`;

const MAX_ITEMS_PER_PAGE = parseInt(localStorage.getItem('MAX_ITEMS_PER_PAGE')) || 500;
const DEBUG = localStorage.getItem('DEBUG') || false;
const INIT_AUTO_SCAN = (localStorage.getItem('INIT_AUTO_SCAN') == 'true') ? true : false;
const AUTO_SCAN_IS_RUNNING = (localStorage.getItem('AUTO_SCAN_IS_RUNNING') == 'true') ? true : false;
const AUTO_SCAN_PAGE_CURRENT = parseInt(localStorage.getItem('AUTO_SCAN_PAGE_CURRENT')) || -1 
const AUTO_SCAN_PAGE_MAX = parseInt(localStorage.getItem('AUTO_SCAN_PAGE_MAX')) || -1 
const PAGE_LOAD_MIN_DELAY = localStorage.getItem('PAGE_LOAD_MIN_DELAY') || 750;
const PAGE_LOAD_TIMESTAMP = Date.now();

const DATABASE_NAME = 'VineVoiceExplorer';
const DATABASE_VERSION = 2;
const DATABASE_OBJECT_STORE_NAME = `${DATABASE_NAME}_Objects`;
const SECONDS_PER_WEEK = 604800 / 2;
const SECONDS_PER_DAY = 86400;
const NOT_SEEN_COUNT_MAX = 5;

const FETCH_RETRY_TIME = localStorage.getItem('FETCH_RETRY_TIME') || 50; // Retry all 50 ms if all data are ready to read, ! shot description delay of amazon :'(
const FETCH_RETRY_MAX_TIME = localStorage.getItem('FETCH_RETRY_MAX_TIME') || 5000; // After this time in ms the parser abort to try to get all data and creates the Missing data himself but sets a flag that we now later that there was anything wrong

const SETTINGS_DEFAULT = {
    EnableFullWidth: true,
    DisableFooter: true,
    DisableSuggestions: true,
}

const SETTINGS = localStorage.getItem('VVE_SETTINGS') || SETTINGS_DEFAULT

/**
  * Checks if loadad Settings Object has all needed propertys
  */ 
function initSettings() {
    const _keys = Object.keys(SETTINGS_DEFAULT);
    const _keysLength = _keys.length;

    for (let i = 0; i < _keysLength; i++) {
        const _currKey = _keys[i];

        if (!SETTINGS.hasOwnProperty(_currKey)) {
            SETTINGS[_currKey] = SETTINGS_DEFAULT[_currKey];
        }
    }
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
