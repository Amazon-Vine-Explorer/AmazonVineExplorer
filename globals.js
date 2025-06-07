'use strict';
if (window.top != window.self) return; //don't run on frames or iframes

// Constants Needed for some things
const AVE_VERSION = (GM_info?.script?.version)
const AVE_TITLE = (GM_info?.script?.name);
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;
const SITE_IS_VINE = /https?:\/\/(www\.)?amazon(\.co)?\.[a-z]{2,}\/vine\//.test(window.location.href);
const SITE_IS_SHOPPING = /https?:\/\/(www\.)?amazon(\.co)?\.[a-z]{2,}\/(?!vine)(?!gp\/video)(?!music)/.test(window.location.href);
const AVE_SESSION_ID = generateSessionID();

/**
 * Is this Browser Tab / Window the Master Instance ??
 */
let AVE_IS_THIS_SESSION_MASTER = false;

// Obsolete sobald der Backgroundscan läuft
const INIT_AUTO_SCAN = (localStorage.getItem('AVE_INIT_AUTO_SCAN') == 'true') ? true : false;
const AUTO_SCAN_IS_RUNNING = (localStorage.getItem('AVE_AUTO_SCAN_IS_RUNNING') == 'true') ? true : false;
const AUTO_SCAN_PAGE_CURRENT = parseInt(localStorage.getItem('AVE_AUTO_SCAN_PAGE_CURRENT')) || -1
const AUTO_SCAN_PAGE_MAX = parseInt(localStorage.getItem('AVE_AUTO_SCAN_PAGE_MAX')) || -1
const PAGE_LOAD_TIMESTAMP = Date.now();

// Obsolete sobald die Datenbank über Tampermonkey läuft
const DATABASE_NAME = 'VineVoiceExplorer';
const DATABASE_OBJECT_STORE_NAME = `${DATABASE_NAME}_Objects`;
const DATABASE_VERSION = 3;

// Make some things accessable from console
unsafeWindow.ave = {};

class AVE_EVENTHANDLER {

    /**
    * AVE Eventhandler
    * A very basic and simple eventhandler/wrapper
    * @constructor
    * @return {AVE_EVENTHANDLER} AVE_EVENTHANDLER Object
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
const ave_eventhandler = new AVE_EVENTHANDLER();

function addBranding() {
    const _isMasterSession = AVE_IS_THIS_SESSION_MASTER && SITE_IS_VINE;

    const _oldElem = document.getElementById('ave-branding-text');
    if (_oldElem) _oldElem.remove();

    const _brandingStyle = document.createElement('style');
    _brandingStyle.innerHTML = `
  .ave-x-wrapper {
    width: 100%;
    position: absolute;
    top: -20px;
    right: 0px;
    display: none;
  }

  .ave-close-x {
    cursor: pointer;
    width: fit-content;
    height: fit-content;
    margin-left: auto;
    background-color: ${(_isMasterSession) ? 'rgba(218, 247, 166, .75)': 'rgba(255, 100, 100, .75)'};
    justify-content: center;
    display: flex;
    padding: 3px;
    border: 1px solid black;
    border-radius: 5px;
  }

  .ave-branding-wrapper:hover .ave-x-wrapper {
    display: flex;
  }

  #ave-brandig-text {
    padding: 0;
    margin: 0;
  }

    `;
    document.body.appendChild(_brandingStyle);

    const _text = document.createElement('div');
    _text.id = 'ave-branding-text';
    _text.classList.add('ave-branding-wrapper');
    _text.style.position = 'fixed';
    _text.style.bottom = '10px';
    _text.style.left = '10px';
    // _text.style.transform = 'translate(-50%, -50%)';
    _text.style.color = 'blue'; // Textfarbe
    _text.style.backgroundColor = (_isMasterSession) ? 'rgba(218, 247, 166, .75)': 'rgba(255, 100, 100, .75)';
    _text.style.textAlign = 'left';
    _text.style.fontSize = '20px'; // Ändere die Schriftgröße hier
    _text.style.zIndex = '2000';
    _text.style.borderRadius = '3px';
    _text.innerHTML = `
    <p id="ave-brandig-text">
      ${AVE_TITLE}${(_isMasterSession) ? ' - Master': ''} - ${AVE_VERSION}
    </p>
    <div class="ave-x-wrapper">
      <div class="ave-close-x" id="ave-branding-x">
        <i class="a-icon a-icon-close"></i>
      </div>
    </div>
    `;


    document?.body?.appendChild(_text);

    const _brandingClose = document.getElementById('ave-branding-x');

    _brandingClose.addEventListener('click', function() {
        var brandingWrapper = document.getElementById('ave-branding-text');
        brandingWrapper.style.display = 'none';
    });
}

unsafeWindow.ave.addBranding = addBranding;

setTimeout(() => {
    if (!localStorage.getItem('AVE_SESSIONS')) {
        localStorage.setItem("AVE_SESSIONS", JSON.stringify([{id: AVE_SESSION_ID, ts: Date.now()}]));
    } else {
        const _sessions = JSON.parse(localStorage.AVE_SESSIONS);
        let _isMasterInstance = SITE_IS_VINE;
        for (const _session of _sessions) {
            if (_session.master) _isMasterInstance = false;
        }
        AVE_IS_THIS_SESSION_MASTER = _isMasterInstance;
        _sessions.push({id: AVE_SESSION_ID, ts: Date.now(), master: _isMasterInstance});
        localStorage.setItem('AVE_SESSIONS', JSON.stringify(_sessions));
        addBranding();
    }

    setInterval(() => { //
        const _sessions = JSON.parse(localStorage.getItem('AVE_SESSIONS', '[]'))
        let _noValidMaster = false;
        let _ownIndex = -1;
        for (let i = 0; i < _sessions.length; i++) {
            const _session = _sessions[i];
            if (_session.id == AVE_SESSION_ID){
                _session.ts = Date.now();
                _ownIndex = i;
            } else if (_session.ts + 2500 < Date.now()) { // We have found a Invalid Session => Handle this
                if (_session.master && SITE_IS_VINE) { // Should we takeover Master ? ONLY IF WE ARE ON VINE SITE
                    _noValidMaster = true;
                    _sessions.splice(_sessions.indexOf(_session), 1);
                } else {
                    _sessions.splice(_sessions.indexOf(_session), 1);
                }
            }
        }

        if (!AVE_IS_THIS_SESSION_MASTER && (_noValidMaster || _sessions.length == 1)) {
            AVE_IS_THIS_SESSION_MASTER = true;
            _sessions[_ownIndex].master = true;
            addBranding();
            console.log('WE TOOK OVER MASTER SESSION TO OUR CURRENT');
            initBackgroundScan();
            // More Handling NEEDED ????
        }
        localStorage.setItem("AVE_SESSIONS", JSON.stringify(_sessions));
    }, 1000);


}, Math.round(Math.random() * 100));


window.onbeforeunload = function () {
    console.log('CLOSE OR RELOAD SESSION - REMOVE OUR SESSION ID FROM ARRAY');
    const _sessions = JSON.parse(localStorage.AVE_SESSIONS);
    for (let i = 0; i < _sessions.length; i++) {
        const _elem = _sessions[i];
        if (_elem.id == AVE_SESSION_ID) {
            _sessions.splice(i, 1);
            localStorage.setItem('AVE_SESSIONS', JSON.stringify(_sessions));
            console.log('SESSION ID GOT REMOVED');
            return;
        }
    }
    return 'Realy ?'
}


// All Config Options that should shown to the User
const SETTINGS_USERCONFIG_DEFINES = [];
SETTINGS_USERCONFIG_DEFINES.push({type: 'title', name: 'Amazon Vine', description: 'Tooltip Description of this Setting'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableFullWidth', type: 'bool', name: 'Enable Full Width', description: 'Uses the full width of the display'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DarkMode', type: 'bool', name: 'Enable Dark Mode (reload required atm)', description: 'Switches between Amazon Light Theme and AVE Dark Mode (reload required atm)'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableAmazonNavbar', type: 'bool', name: 'Disable Amazon Navbar', description: 'Disables the Amazon Navbar'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableCategories', type: 'bool', name: 'Disable Categories', description: 'Disables the Categories of the Amazon Vine Page'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableFooter', type: 'bool', name: 'Disable Footer', description: 'Disables the Footer of the Amazon Vine Page'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableSuggestions', type: 'bool', name: 'Disable Suggestions', description: 'Disables Suggestions on the Amazon Vine Page'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableBtnPotLuck', type: 'bool', name: 'Disable Button Potluck', description: 'Disables the Section Button PotLuck(FSE)'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableBtnLastChance', type: 'bool', name: 'Disable Button Last Chance', description: 'Disables the Section Button Last Chance(VFA)'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableBtnSeller', type: 'bool', name: 'Disable Button Seller', description: 'Disables the Section Button Seller(ZA)'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableTopLogoChange', type: 'bool', name: 'Enable Top Logo Change', description: 'Enables the Change of the top logo to our AVE Logo'});

SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableBtnAll', type: 'bool', name: 'Enable Button All Products', description: 'Enable &quot;All Products&quot; Button'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnablePaginationTop', type: 'bool', name: 'Enable Pagination on top', description: 'Enable Pagination to be displayed on top for ZA page' });
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableBackgroundScan', type: 'bool', name: 'Enable Background Scan', description: 'Enables the Background scan, if disabled you will find a Button for Autoscan on the Vine Website'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableInfiniteScrollLiveQuerry', type: 'bool', name: 'Enable Infiniti Scroll Live Querry', description: 'If enabled the Products of the All Products Page will get querryd from Amazon directls otherwise they will get loaded from Database(faster)'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableDesktopNotifikation', type: 'bool', name: 'Enable Desktop Notifications', description: 'Enable Desktop Notifications if new Products are detected'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'EnableBtnMarkAllAsSeen', type: 'bool', name: 'Enable Button Mark all as seen', description: 'Enable the Button Mark all as seen'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'ShowFirstSeen', type: 'bool', name: 'Show first seen instead of last seen', description: 'Instead of the &quot;Last seen&quot; date in the product box show the date, the item was first seen'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DesktopNotifikationKeywords', type: 'keywords', name: 'Desktop Notification Highlight Keywords', inputPlaceholder: 'Type in your highlight keywords one per line and click outside to submit', description: 'Create a List of words u want to Highlight if Product desciption containes one or more of them'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BackGroundScanDelayPerPage', type: 'number', min: 2000, max: 20000, name: 'Background Scan Per Page Min Delay(Milliseconds)', description: 'Minimal Delay per Page load of Background Scan'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BackGroundScannerRandomness', type: 'number', min: 100, max: 10000, name: 'Background Scan Randomness per Page(Milliseconds)', description: 'A Value that gives the maximal range for the Randomy added delay per page load'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DesktopNotifikationDelay', type: 'number', min: 0, max: 3600, name: 'Desktop Notifikation Delay (Seconds)', description: 'Minimal time between desktop notifikations, exept notifikations for keyword matches. A value of 0 disables this notifications.'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'SearchBarInputDelay', type: 'number', min: 100, max: 1000, name: 'Search Bar Input Delay until auto search(Milliseconds)', description: 'When typing in the search bar, start searching when no key pressed this long milliseconds'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'NotSeenMaxCount', type: 'number', min: 0, max: 9, name: 'Not Seen Max Count after which items get removed from the database', description: 'If an item ist not found more often than this during full background scans, it will be removed from the database'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'MaxItemsPerPage', type: 'number', min: 20, max: 1000, name: 'Maximum items per page', description: 'Maximum items that will show up one one page'});

SETTINGS_USERCONFIG_DEFINES.push({type: 'title', name: 'Colors and Styles', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorNewProducts', type: 'color', name: 'Button Color New Products', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorMarkCurrSiteAsSeen', type: 'color', name: 'Button Color Mark Current Site As Seen', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorMarkAllAsSeen', type: 'color', name: 'Button Color Mark All As Seen', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorBackToTop', type: 'color', name: 'Button Color Back To Top', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorUpdateDB', type: 'color', name: 'Button Color Update Database', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorAllProducts', type: 'color', name: 'Button Color All Products', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'BtnColorFavorites', type: 'color', name: 'Button Color Favorites', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'FavStarColorDefault', type: 'color', name: 'Color Favorite Star unchecked', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'FavStarColorChecked', type: 'color', name: 'Color Favorite Star checked', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DarkModeBackgroundColor', type: 'color', name: 'Dark Mode Background Color', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DarkModeColor', type: 'color', name: 'Dark Mode Text Color', description: ''});

SETTINGS_USERCONFIG_DEFINES.push({type: 'title', name: 'Amazon Shopping', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableFooterShopping', type: 'bool', name: 'Disable Footer', description: 'Disables the Footer of the Amazon Shopping Page'});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DisableSuggestionsShopping', type: 'bool', name: 'Disable Suggestions', description: 'Disables the Suggestions of the Amazon Shopping Page'});

SETTINGS_USERCONFIG_DEFINES.push({type: 'title', name: 'Settings for Developers and Testers', description: ''});
SETTINGS_USERCONFIG_DEFINES.push({key: 'DebugLevel', type: 'number', min: 0, max: 15, name: 'Debuglevel', description: ''});

SETTINGS_USERCONFIG_DEFINES.push({type: 'button', name: 'RESET SETTINGS TO DEFAULT', bgColor: 'rgb(255,128,0)', description: 'It does what it says', btnClick: () => {SETTINGS.reset(); window.location.href = window.location.href} });
SETTINGS_USERCONFIG_DEFINES.push({type: 'button', name: 'DATABSE EXPORT >>>', bgColor: 'lime', description: 'Export the entire Database', btnClick: () => {exportDatabase();}});
SETTINGS_USERCONFIG_DEFINES.push({type: 'button', name: 'DATABSE IMPORT <<<', bgColor: 'yellow', description: 'Clear the current database and import data from an earlier exported file. Data is imported as is, i.e. there is no validation. Please wait for the completion notification after clicking the button', btnClick: () => {importDatabase();}});
SETTINGS_USERCONFIG_DEFINES.push({type: 'button', name: 'DELETE DATABSE', bgColor: 'rgb(255,0,0)', description: 'A USER DOES NOT NEED TO DO THIS ! ITS ONLY FOR DEVELOPMENT PURPOSES', btnClick: () => {database.deleteDatabase().then(() => {window.location.href = window.location.href})}});

class SETTINGS_DEFAULT {
    EnableFullWidth = true;
    DarkMode = false;
    DisableAmazonNavbar = false;
    DisableCategories = false;
    DisableFooter = true;
    DisableSuggestions = true;
    DisableFooterShopping = false;
    DisableSuggestionsShopping = false;
    DisableBtnPotLuck = false;
    DisableBtnLastChance = false;
    DisableBtnSeller = false;
    EnableTopLogoChange = true;
    EnableBackgroundScan = true;
    EnableInfiniteScrollLiveQuerry = false;
    EnableDesktopNotifikation = false;
    EnableBtnAll = true;
    EnablePaginationTop = true;
    EnableBtnMarkAllAsSeen = true;
    ShowFirstSeen = false;

    BtnColorFavorites = '#ffe143';
    BtnColorNewProducts = '#00FF00';
    BtnColorMarkCurrSiteAsSeen = '#00FF00';
    BtnColorMarkAllAsSeen = '#FFA28E';
    BtnColorBackToTop = '#FFFFFF'
    BtnColorUpdateDB = '#00FF00';
    BtnColorAllProducts = '#FFFFFF';

    FavStarColorDefault = 'white';
    FavStarColorChecked = '#ffe143';

    DarkModeBackgroundColor = '#191919';
    DarkModeColor = '#FFFFFF';

    NotSeenMaxCount = 5;
    PageLoadMinDelay = 750;
    DebugLevel = 0;
    MaxItemsPerPage = 500;
    FetchRetryTime = 50;
    FetchRetryMaxTime = 5000;
    BackGroundScanDelayPerPage = 6000;
    BackGroundScannerRandomness = 6000;
    DesktopNotifikationDelay = 60;
    SearchBarInputDelay = 500;
    DesktopNotifikationKeywords = [];

    CssProductNewTag = "border: 2mm ridge rgba(218, 247, 166, .6); background-color: rgba(218, 247, 166, .2)";
    CssProductSaved = "border: 2mm ridge rgba(105, 163, 0, .6); background-color: rgba(105, 163, 0, .2)";
    CssProductFavTag = "border: 2mm ridge rgba(255, 255, 102, .6); background-color: rgba(255, 255, 102, .2)";
    CssProductRemovalTag = "border: 2mm ridge rgba(255, 87, 51, .6); background-color: rgba(255, 87, 51, .2)";
    CssProductDefault = "border: 2mm ridge rgba(173,216,230, .6); background-color: rgba(173,216,230, .2)";

    constructor() {
        ave_eventhandler.on('ave-save-cofig', () => {
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
            return GM_setValue('AVE_SETTINGS', this);
        } else {
            ave_eventhandler.emit('ave-save-cofig'); // A little trick to beat the Namespace Problem ;)
        }
    }

    reset() {
        GM_setValue('AVE_SETTINGS', new SETTINGS_DEFAULT());
    }
}

const SETTINGS = new SETTINGS_DEFAULT();

/**
  * Load Settings from GM Storage
  */
function loadSettings() {
    const _settingsStore = GM_getValue('AVE_SETTINGS', {});
    console.log('Got Settings from GM:(', typeof(_settingsStore),')', _settingsStore);
    if (typeof(_settingsStore) == 'object' && _settingsStore != null && _settingsStore != undefined) {
        const _keys = Object.keys(_settingsStore);
        const _keysLength = _keys.length;

        for (let i = 0; i < _keysLength; i++) {
            const _currKey = _keys[i];
            console.log(`Restore Setting: ${_currKey} with Value: ${_settingsStore[_currKey]}`)
            SETTINGS[_currKey] = _settingsStore[_currKey];
        }
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
        return;
    }

    const _observer = new MutationObserver(mutations => {
        if (altDocument.querySelector(selector)) {
            _observer.disconnect();
            cb(altDocument.querySelector(selector));
            return;
        }
    });

    _observer.observe(altDocument.body || altDocument, {
        childList: true,
        subtree: true
    });
}

// Wrap waitForHtmlElmement in a Promise to use it with async/await
function waitForHtmlElementPromise(selector, altDocument = document) {
    return new Promise((resolve, reject) => {
        waitForHtmlElmement(selector, resolve, altDocument);
        setTimeout(() => {
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, 10000); // 10 seconds timeout
    });
}

// Function to find the active menu button (used for top pagination)
async function findActiveMenuButton() {
    // Array of menu IDs
    const buttonIds = [
        'vvp-items-button--recommended',
        'vvp-items-button--all',
        'vvp-items-button--seller'
    ];

    for (const id of buttonIds) {
        try {
            const buttonSpan = await waitForHtmlElementPromise(`#${id}`);
            const innerSpan = buttonSpan.querySelector('.a-button-inner');
            if (innerSpan) {
                const link = innerSpan.querySelector('a');
                if (link && link.getAttribute('aria-checked') === 'true') {
                    return id;
                } else {
                    console.warn(`findActiveMenuButton(): link is null or undefined for ${id}`);
                }
            } else {
                console.warn(`findActiveMenuButton(): innerSpan is null or undefined for ${id}`);
            }
        } catch (error) {
            console.warn(`findActiveMenuButton(): buttonSpan is null or undefined for ${id}`, error);
        }
    }

    return null;
}

/**
 *  Wait for given amount of milliseconds
 *  USE ONLY IN ASYNC FUNCTIONS
 *  await delay(1000); for wait one second
 * @param {number} milliseconds
 * @returns
 */
async function delay(milliseconds) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, milliseconds);
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

        if (SETTINGS.DisableAmazonNavbar) {
            waitForHtmlElmement('#navbar-main', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });

            waitForHtmlElmement('#skiplink', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });

            waitForHtmlElmement('#vvp-logo-link > img', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });

            waitForHtmlElmement('#vvp-header', (elem) => {
                elem.style.marginTop = '0';
                elem.style.marginBottom = '0';
                //elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });

            waitForHtmlElmement('.a-container.vvp-body > .a-section:not(#vvp-header)', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });

            waitForHtmlElmement('.a-tab-container.vvp-tab-set-container', (elem) => {
                elem.style.marginTop = '0';
                //elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });
        }

        if (SETTINGS.DisableCategories) {
            waitForHtmlElmement('#vvp-browse-nodes-container', (elem) => {
                elem.style.display = 'none';
                //elem.style.visibility = 'hidden';
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

        if (SETTINGS.DisableBtnPotLuck) {
            waitForHtmlElmement('#vvp-items-button--recommended', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });
        }

        if (SETTINGS.DisableBtnLastChance) {
            waitForHtmlElmement('#vvp-items-button--all', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });
        }

        if (SETTINGS.DisableBtnSeller) {
            waitForHtmlElmement('#vvp-items-button--seller', (elem) => {
                elem.style.display = 'none';
                // elem.style.visibility = 'hidden';
            });
        }

        if (SETTINGS.EnableTopLogoChange) {
            waitForHtmlElmement('#vvp-logo-link > img', (elem) => {
                elem.src = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/vine_logo_notification_image.png';
                elem.style.height = '100px';
            });

        }

        if (SETTINGS.EnablePaginationTop) {
            const activeButtonId = await findActiveMenuButton();
            if (activeButtonId) {
                console.log('EnablePaginationTop: Active menu button ID:', activeButtonId);
                if (activeButtonId == "vvp-items-button--seller") {
                    waitForHtmlElmement('div.a-text-center[role="navigation"]', (elem) => {
                        var clonedDiv = elem.cloneNode(true);
                        //clonedDiv.style.marginTop = '-25px';
                        clonedDiv.style.marginBottom = '10px';
                        var parentContainer = document.getElementById('vvp-items-grid-container');
                        if (parentContainer) {
                            var pTag = parentContainer.querySelector('p');
                            var vvpItemsGridDiv = document.getElementById('vvp-items-grid');
                            if (pTag && vvpItemsGridDiv) {
                                parentContainer.insertBefore(clonedDiv, vvpItemsGridDiv);
                            } else {
                                console.error('EnablePaginationTop: Required elements not found inside the parent container.');
                            }
                        } else {
                            console.error('EnablePaginationTop: Parent container not found.');
                        }
                    });
                }
            } else {
                console.log('EnablePaginationTop: No active menu button found.');
            }
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

/**
 * Generates a randomly generated Session ID to identify different Tabs and Windows
 * @returns {string} Session ID
 */
function generateSessionID() {
    return 'aaaa-aaaaa-AVE-SESSION-aaaaaaa-aaaaaaaa'.replace(/[a]/g, ( c ) => { return Math.round(Math.random() * 36).toString(36) });
}
