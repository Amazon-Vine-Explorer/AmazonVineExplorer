// ==UserScript==
// @name         Amazon Vine Explorer
// @namespace    http://tampermonkey.net/
// @version      0.11.18
// @updateURL    https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js
// @downloadURL  https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/VineExplorer.user.js
// @description  Better View, Search and Explore for Amazon Vine Products - Vine Voices Edition
// @author       MarkusSR1984, Christof121, Olum-hack, Deburau, adripo
// @match        https://www.amazon.com/*
// @match        https://www.amazon.ca/*
// @match        https://www.amazon.co.uk/*
// @match        https://www.amazon.de/*
// @match        https://www.amazon.fr/*
// @match        https://www.amazon.it/*
// @match        https://www.amazon.es/*
// @match        https://www.amazon.co.jp/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/deburau/AmazonVineExplorer/main/vine_logo.png
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @require      globals.js
// @require      class_db_handler.js
// @require      class_product.js
// @require      https://raw.githubusercontent.com/eligrey/FileSaver.js/v2.0.4/src/FileSaver.js
// @require      https://raw.githubusercontent.com/Christof121/VineFetchFix/main/fetchfix.js
// ==/UserScript==

/*
    Versioning:
    a.b.c[.d]

    a => Hauptversion(Major), ändert sich nur bei breaking oder anderen gravirenden änderungen. Solle In diesem Fall also die 1 nie überschreiten.
    b => Feature(Minor), ändert sich nur wenn neue Features hinzukommen oder gößere umstellungen im Hintergrund passiert sind
    c => Patch, kleinere Änderungen oder "größere" Bugfixes
    d => Micro(OPTIONAL), kleine Bugfixes die nur wenige Zeilen Code beinhalten. Wird normalerweise nicht an die Versionnummer angehängt und nur in ausnahmefällen verwendet. Wie z.B. 0.6.4.1 - Das war nur eine Fehlerhafte Variablendeklaration. musste aber public gehen weil es ein Breaking Bug war

    Sammlung der Ideen:
    - Pageination nach oben schieben || Kopieren
    - Tooltipp mit der langen Beschreibung auf der kurzen
    - Bestellte Produkte mit Tag versehen ?
    - Automatisches Bestellen via Prioliste ?!?

    Todo:
*/

/*
    global
        AUTO_SCAN_IS_RUNNING,
        AUTO_SCAN_PAGE_CURRENT,
        AUTO_SCAN_PAGE_MAX,
        AVE_IS_THIS_SESSION_MASTER,
        AVE_TITLE,
        AVE_VERSION,
        DATABASE_NAME,
        DATABASE_OBJECT_STORE_NAME,
        DATABASE_VERSION,
        DB_HANDLER:writable,
        INIT_AUTO_SCAN,
        PAGE_LOAD_TIMESTAMP,
        Product,
        SECONDS_PER_DAY,
        SECONDS_PER_WEEK,
        SETTINGS,
        SETTINGS_USERCONFIG_DEFINES,
        SITE_IS_SHOPPING,
        SITE_IS_VINE,
        addBranding,
        ave_eventhandler,
        fastStyleChanges,
        loadSettings,
        toTimestamp,
        toUnixTimestamp,
        unixTimeStamp,
        unsafeWindow,
        waitForHtmlElmement,
        waitForHtmlElementPromise,
*/

'use strict';
console.log(`Init Vine Voices Explorer ${AVE_VERSION}`);

/**
 * On witch page are we atm ? PAGETYPE
 * @type {PAGETYPE}
 */
let currentMainPage;

loadSettings();
fastStyleChanges();

let searchInputTimeout;
let backGroundScanTimeout;

let TimeouteScrollTilesBufferArray = [];
let BackGroundScanIsRunning = false;

// Make some things accessable from console
unsafeWindow.ave = {
    classes: [
        DB_HANDLER = DB_HANDLER
    ],
    config: SETTINGS,
    event: ave_eventhandler,
};

let database;
(async () => {
    try {
        database = await DB_HANDLER.init(DATABASE_NAME, DATABASE_OBJECT_STORE_NAME, DATABASE_VERSION);

        let _execLock = false;
        console.log('Lets Check where we are....');
        if (SITE_IS_VINE){
            console.log('We are on Amazon Vine'); // We are on the amazon vine site
            if(SETTINGS.DarkMode){
                waitForHtmlElmement('body', () => {
                    injectDarkMode();
                })
            }

            const urlParams = new URLSearchParams(window.location.search);
            const aveData = urlParams.get('vine-data');
            let aveShareData = localStorage.getItem('ave-share-details');
            if(aveData || aveShareData){
                let _data = aveShareData ? JSON.parse(aveShareData) : (aveData ? JSON.parse(aveData) : null);
                waitForHtmlElmement('body', () => {
                    let aveShareElementTmp = document.createElement('div');
                    aveShareElementTmp.style.display = "none";
                    aveShareElementTmp.innerHTML = `
                <span class="a-button a-button-primary vvp-details-btn" id="a-autoid-0">
                <span class="a-button-inner">
                <input data-asin="${_data.asin}" data-is-parent-asin="${_data.isParentAsin}" data-is-pre-release="${_data.data_is_pre_release ?? false}" data-recommendation-id="${_data.recommendationId}" data-recommendation-type="VENDOR_TARGETED" class="a-butt[...]
                <span class="a-button-text" aria-hidden="true" id="a-autoid-0-announce">Weitere Details
                </span>
                </span>
                </span>
                `;
                    document.body.appendChild(aveShareElementTmp);
                    setTimeout(() => {
                        aveShareElementTmp.querySelector('input').click();
                        setTimeout(() => {
                            localStorage.removeItem('ave-share-details');
                        }, 200);
                    }, 500);
                })
            }
            addAveSettingsTab();
            addAVESettingsMenu();
            waitForHtmlElmement('.vvp-details-btn', () => {
                if (_execLock) return;
                _execLock = true;
                addBranding();
                detectCurrentPageType();
                let _tileCount = 0;
                const _initialWaitForAllTiles = setInterval(() => {
                    const _count = document.getElementsByClassName('vvp-details-btn').length;
                    if (_count > _tileCount) {
                        _tileCount = _count;
                    } else {
                        clearInterval(_initialWaitForAllTiles);
                        init(true);
                    }
                }, 100);
            });
            waitForHtmlElmement('.vvp-no-offers-msg', () => { // Empty Page ?!?!
                if (_execLock) return;
                _execLock = true;
                if(SETTINGS.DarkMode){
                    waitForHtmlElmement('body', () => {
                        injectDarkMode();
                    })
                }
                addBranding();
                init(false);
            });
        } else if (SITE_IS_SHOPPING) {
            console.log('We are on Amazon Shopping');
            _execLock = true;
            waitForHtmlElmement('body', () => {
                addBranding();
            });
            useEnrollmentData();

            function useEnrollmentData() {
                const urlParams = new URLSearchParams(window.location.search);
                const aveData = urlParams.get('vine-data');
                if (aveData) {
                    const enrollmentData = JSON.parse(decodeURIComponent(aveData));
                    localStorage.setItem('ave-share-details', JSON.stringify(enrollmentData));
                    window.open(`${window.location.origin}/vine/vine-items`, '_blank');
                }
            }
        }
    } catch (err) {
        console.error(`Something was going wrong while init database :'(`, err);
        return;
    }
})();

unsafeWindow.ave.database = database;

let oldCountOfNewItems = 0;

let showDbUpdateLogoTimeout = null;
let showDbUpdateLogoIcon = null;

ave_eventhandler.on('ave-database-changed', () => {
    if (SETTINGS.DebugLevel > 1) console.info('EVENT - Database has new Data for us! we should look what has changed');
    updateNewProductsBtn();

    if (showDbUpdateLogoTimeout) clearTimeout(showDbUpdateLogoTimeout);
    if (!showDbUpdateLogoIcon) showDbUpdateLogoIcon = addDBLoadingSymbol();

    showDbUpdateLogoTimeout = setTimeout(() => {
        if (showDbUpdateLogoIcon) showDbUpdateLogoIcon.remove();
        showDbUpdateLogoTimeout = null;
        showDbUpdateLogoIcon = null;
    }, 5000);


})

window.onscroll = () => { // ONSCROLL Event handler
    var _top = 5;
    stickElementToTopScrollEVhandler('ave-btn-allseen', `${_top}px`);
    _top = _top + 35;

    if(SETTINGS.EnableBtnMarkAllAsSeen) {
        stickElementToTopScrollEVhandler('ave-btn-db-allseen', `${_top}px`);
        _top = _top + 35;
    }

    stickElementToTopScrollEVhandler('ave-btn-backtotop', `${_top}px`);

    if (currentMainPage == PAGETYPE.ALL) handleInfiniteScroll();


};

let blockHandleInfiniteScroll = false;
let infiniteScrollLastPreloadedPage = 1;
let infiniteScrollMaxPreloadPage = 125; // Hardcoded for scrolltest, must lated get extracted from Pagination
let inifiniteScrollBlockAppend = false;
let infiniteScrollTilesBufferArray = [];


function injectDarkMode() {

    const _darkModeIgnoreBackgroundColor = `
    i,
    span.a-declarative *,
    #navbar-main *,
    #ave-btn-allseen *,
    #ave-btn-db-allseen *,
    #ave-btn-backtotop *,
    #ave-branding-text,
    #ave-brandig-text,
    .animated-progress *,
    .a-switch.a-declarative,
    .vvp-reviews-table--actions-col *,
    .a-tab-heading,
    .a-tab-heading a,
    .ave-favorite-star,
    .vvp-item-tile,
    .vvp-item-tile-content,
    .vvp-item-tile-content *,
    .a-popover-lgtbox,
    .a-modal-scroller.a-declarative,
    #ave-btn-favorites *,
    #ave-btn-list-new *,
    .ave-settings-label-switch *,
    .a-last *
    `
    const _darkModeIgnoreColor = `
    span.a-declarative *,
    #navbar-main *,
    #ave-btn-allseen *,
    #ave-btn-db-allseen *,
    #ave-btn-backtotop *,
    #ave-branding-text,
    #ave-brandig-text,
    .a-switch.a-declarative,
    .vvp-reviews-table--actions-col *,
    .vvp-details-btn *,
    .vvp-header-link *,
    .a-link-normal,
    #ave-btn-favorites *,
    #ave-btn-list-new *,
    .a-last *
    `

    const _darkModeIgnoreIcons = `
    #vvp-feedback-star-rating
    `

    const darkCSS = `
    :root{
      --primary-color: ${SETTINGS.DarkModeColor};
      --secondary-color: ${SETTINGS.DarkModeBackgroundColor};
    }

    .ave-color, .ave-color *:not(${_darkModeIgnoreColor}){
      color: var(--primary-color) !important;
    }
    .ave-background-color, .ave-background-color *:not(${_darkModeIgnoreBackgroundColor}){
      background-color: var(--secondary-color) !important;
    }
    .a-expander-content-fade,
    .a-popover-footer::before,
    .a-popover-wrapper::after
    {
      background: none !important;
    }
    i:not(${_darkModeIgnoreIcons}){
      background-color: transparent !important;
      filter: invert(1) !important;
    }
    `
    // Erstelle ein neues Style-Element
    var styleElement = document.createElement('style');
    styleElement.type = 'text/css';

    // Füge die CSS-Variable und den Wert am Anfang des Style-Elements hinzu
    styleElement.textContent = darkCSS;

    // Füge das Style-Element am Anfang des <head>-Tags hinzu
    document.head.insertBefore(styleElement, document.head.firstChild);
    document.body.classList.add('ave-color','ave-background-color');
}

function handleInfiniteScroll() {
    if (SETTINGS.DebugLevel > 10) console.log('Called handleInfiniteScroll()');
    if (!inifiniteScrollBlockAppend) {
        inifiniteScrollBlockAppend = true;
        // setTimeout(async ()=> {},10);
        appendInfiniteScrollTiles(()=>{inifiniteScrollBlockAppend = false;})
    }

    if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
        if (blockHandleInfiniteScroll) return;
        blockHandleInfiniteScroll = true;

        const _maxScrollHeight = Math.max(document.body.scrollHeight - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight);

        if (SETTINGS.DebugLevel > 10) console.log(`handleInfiniteScroll(): _maxScrollHeight: ${_maxScrollHeight} window.scrollY+inner: ${window.scrollY + window.innerHeight}`);

        if (_maxScrollHeight > (window.scrollY + (window.innerHeight * 2))){
            blockHandleInfiniteScroll = false;
            return;
        } else if (infiniteScrollTilesBufferArray.length < 1000 && infiniteScrollLastPreloadedPage < infiniteScrollMaxPreloadPage) {
            const _baseUrl = (/(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(window.location.href))[1];
            infiniteScrollLastPreloadedPage++;
            getTilesFromURL(`${_baseUrl}?queue=encore&pn=&cn=&page=${infiniteScrollLastPreloadedPage}`, (tiles) =>{
                infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles);

                blockHandleInfiniteScroll = false;
                if (infiniteScrollTilesBufferArray.length < 500) handleInfiniteScroll();
            });
        } else {
            blockHandleInfiniteScroll = false;
        }
    }
}

function getUrlParameter(name) {
    const _queryString = window.location.search;
    const _urlParams = new URLSearchParams(_queryString);
    return _urlParams.get(name);
}

function detectCurrentPageType(){
    if (/http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items$/.test(window.location.href)) {
        currentMainPage = PAGETYPE.ORIGINAL_LAST_CHANCE;
    } else if (getUrlParameter('queue') == 'last_chance') {
        currentMainPage = PAGETYPE.ORIGINAL_LAST_CHANCE;
    } else if (getUrlParameter('queue') == 'potluck') {
        currentMainPage = PAGETYPE.OROGINAL_POTLUCK;
    } else if (getUrlParameter('queue') == 'encore') {
        currentMainPage = PAGETYPE.ORIGINAL_SELLER;
    }

    // alert(`currentMainPage is: ${currentMainPage}`);

    // getUrlParameter('ave-subpage');

}

async function parseTileData(tile) {
    if (SETTINGS.DebugLevel > 12) console.log(`Called parseTileData(`, tile, ')');

    const _id = tile.getAttribute('data-recommendation-id');
    const _ret = await database.getById(_id);

    if (_ret) {
        _ret.gotFromDB = true;
        _ret.ts_lastSeen = unixTimeStamp();
        _ret.notSeenCounter = 0;
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): got DB Entry`);
        await database.update(_ret);
        return _ret;
    }

    await waitForHtmlElementPromise('.vvp-item-tile-content', tile);
    const _div_vpp_item_tile_content = tile.getElementsByClassName('vvp-item-tile-content')[0];

    await waitForHtmlElementPromise('img', _div_vpp_item_tile_content);
    const _div_vpp_item_tile_content_img = _div_vpp_item_tile_content.getElementsByTagName('img')[0];

    await waitForHtmlElementPromise('.vvp-item-product-title-container', _div_vpp_item_tile_content);
    const _div_vvp_item_product_title_container = _div_vpp_item_tile_content.getElementsByClassName('vvp-item-product-title-container')[0];

    await waitForHtmlElementPromise('a', _div_vvp_item_product_title_container);
    const _div_vvp_item_product_title_container_a = _div_vvp_item_product_title_container.getElementsByTagName('a')[0];

    await waitForHtmlElementPromise('.a-button-inner', _div_vpp_item_tile_content);
    const _div_vpp_item_tile_content_button_inner = _div_vpp_item_tile_content.getElementsByClassName('a-button-inner')[0];

    await waitForHtmlElementPromise('input', _div_vpp_item_tile_content_button_inner);
    const _div_vpp_item_tile_content_button_inner_input = _div_vpp_item_tile_content_button_inner.getElementsByTagName('input')[0];

    if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 6`);

    const _newProduct = new Product(_id);
    _newProduct.data_recommendation_id = _id;
    _newProduct.data_img_url = tile.getAttribute('data-img-url');
    _newProduct.data_img_alt = _div_vpp_item_tile_content_img.getAttribute('alt') || "";
    _newProduct.link = _div_vvp_item_product_title_container_a.getAttribute('href');
    _newProduct.description_full = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-full')[0].textContent;

    _newProduct.data_asin = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-asin');
    _newProduct.data_recommendation_type = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-recommendation-type');
    _newProduct.data_asin_is_parent = (_div_vpp_item_tile_content_button_inner_input.getAttribute('data-is-parent-asin') == 'true');
    _newProduct.data_is_pre_release = (_div_vpp_item_tile_content_button_inner_input.getAttribute('data-is-pre-release') == 'true');
    _newProduct.description_short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;

    // If short description is empty, try to fetch it with retries
    if (_newProduct.description_short == '') {
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): we don´t have a short description`);
        let _timeLoopCounter = 0;
        const _maxLoops = Math.round(SETTINGS.FetchRetryMaxTime / SETTINGS.FetchRetryTime);
        const _halfdelay = (SETTINGS.FetchRetryTime / 2);

        while (_timeLoopCounter++ < _maxLoops) {
            await new Promise(res => setTimeout(res, _halfdelay + Math.round(Math.random() * _halfdelay * 2)));
            const _short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;
            if (_short != "") {
                _newProduct.description_short = _short;
                return _newProduct;
            }
        }
        _newProduct.description_short = `${_newProduct.description_full.substr(0,50)}...`;
        _newProduct.generated_short = true;
        return _newProduct;
    } else {
        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): END`);
        return _newProduct;
    }
}

function reloadPageWithSubpageTarget(target) {
    if (window.location.href.includes('?')) {
        window.location.href = window.location.href + `&ave-subpage=${target}`;
    } else {
        window.location.href = window.location.href + `?ave-subpage=${target}`;
    }
}

function addLeftSideButtons(forceClean) {
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');

    if (forceClean) _nodesContainer.innerHTML = '';

    const _div = _nodesContainer.appendChild(document.createElement('div'));
    _div.setAttribute('class', 'parent-node');

    _div.appendChild(document.createElement('p')); // A bit of Space above our Buttons

    const _setAllSeenBtn = createButton('Seite als gesehen markieren','ave-btn-allseen',  `width: 240px; background-color: ${SETTINGS.BtnColorMarkCurrSiteAsSeen};`, () => {

        if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
        markAllCurrentSiteProductsAsSeen();
        window.scrollTo(0, 0);
    });
    _div.appendChild(_setAllSeenBtn);

    if(SETTINGS.EnableBtnMarkAllAsSeen) {
        const _setAllSeenDBBtn = createButton('Alle als gesehen markieren','ave-btn-db-allseen', `left: 0; width: 240px; background-color: ${SETTINGS.BtnColorMarkAllAsSeen};`, () => {

            if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
            setTimeout(() => {
                database.getNewEntries().then((prodsArr) => {
                    const _prodsArryLength = prodsArr.length;
                    for (let i = 0; i < _prodsArryLength; i++) {
                        const _currProd = prodsArr[i];
                        if (_currProd.isNew) {
                            _currProd.isNew = 0;
                            database.update(_currProd);
                        }
                    }
                })
            }, 30);
        });
        _div.appendChild(_setAllSeenDBBtn);
    }

    const _backToTopBtn = createButton('Zum Seitenanfang','ave-btn-backtotop',  `width: 240px; background-color: ${SETTINGS.BtnColorBackToTop};`, () => {

        if (SETTINGS.DebugLevel > 10) console.log('Clicked back to Top Button');
        window.scrollTo(0, 0);
    });
    _div.appendChild(_backToTopBtn);

    // const _clearDBBtn = createButton('Datenbank Bereinigen', 'background-color: orange;', () => {
    //     if (SETTINGS.DebugLevel > 10) console.log('Clicked clear DB Button');
    //     cleanUpDatabase();
    // });

    // _nodesContainer.appendChild(_clearDBBtn);
}

function markAllCurrentSiteProductsAsSeen(cb = () => {}) {
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;

    let _returned = 0;
    for (let i = 0; i < _tilesLength; i++) {
        const _tile = _tiles[i];
        const _id = _tile.getAttribute('data-recommendation-id');
        database.getById(_id).then((prod) => {
            prod.isNew = 0;
            database.update(prod).then( () => {
                updateTileStyle(prod);
                _returned++;
                if (_returned == _tilesLength) cb();
            })
        })
    }
}

function markAllCurrentDatabaseProductsAsSeen(cb = () => {}) {
    if (SETTINGS.DebugLevel > 10) console.log('Called markAllCurrentDatabaseProductsAsSeen()');
    database.getNewEntries().then((prods) => {
        const _prodsLength = prods.length;
        let _returned = 0;
        if (SETTINGS.DebugLevel > 10) console.log(`markAllCurrentDatabaseProductsAsSeen() - Got ${_prodsLength} Products with Tag isNew`);
        if (_prodsLength == 0) {
            cb(true);
            return;
        }
        for (let i = 0; i < _prodsLength; i++) {
            const _currProd = prods[i];
            _currProd.isNew = 0;
            database.update(_currProd, ()=> {
                if (SETTINGS.DebugLevel > 10) console.log(`markAllCurrentDatabaseProductsAsSeen() - Updated ${_currProd.id}`);
                _returned++
                if (_returned == _prodsLength) cb(true);
            })
        }
    });
}

function createButton(text, id, style, clickHandler){
    const _btnSpan = document.createElement('span');
    _btnSpan.setAttribute('id', id);
    _btnSpan.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _btnSpan.setAttribute('aria-checked', 'true');
    _btnSpan.style.marginLeft = '0';
    _btnSpan.style.marginTop = '5px';
    _btnSpan.innerHTML = `
        <span class="a-button-inner" style="${style || ''}">
            <span class="a-button-text">${text}</span>
        </span>
    `;
    _btnSpan.addEventListener('click', (ev) => {
        if (clickHandler) {
            clickHandler(ev);
        } else {
            alert('\r\nHier gibt es nix zu sehen.\r\nZumindest noch nicht :P');
        }
    });
    return _btnSpan;
}

async function createTileFromProduct(product, btnID, cb) {
    if (!product && SETTINGS.DebugLevel > 10) console.error(`createTileFromProduct got no valid product element`);
    return new Promise((resolve, reject) => {
        const _btnAutoID = btnID || Math.round(Math.random() * 10000);

        const _tile = document.createElement('div');
        _tile.setAttribute('class', 'vvp-item-tile');
        _tile.setAttribute('data-recommendation-id', product.data_recommendation_id);
        _tile.setAttribute('data-img-url', product.data_img_url);
        _tile.setAttribute('style', (product.notSeenCounter > 0) ? SETTINGS.CssProductRemovalTag : (product.isFav) ? SETTINGS.CssProductNewTag : (product.isNew) ? SETTINGS.CssProductNewTag : SETTINGS.CssProductDefault);
        _tile.innerHTML =`
            <div class="vvp-item-tile-content">
                <img alt="${product.data_img_alt}" src="${product.data_img_url}">
                <div class="vvp-item-product-title-container">
                    <a class="a-link-normal" target="_blank" rel="noopener" href="${product.link}">
                        <span class="a-truncate" data-a-word-break="normal" data-a-max-rows="2" data-a-overflow-marker="&amp;hellip;" style="line-height: 1.3em !important; max-height: 2.6em;" data-a-recalculate="false" data-a-updated="true">
                            <span class="a-truncate-full a-offscreen">${product.description_full}</span>
                            <span class="a-truncate-cut" aria-hidden="true" style="height: 2.6em;">${product.description_short}</span>
                        </span>
                    </a>
                </div>
                <span class="a-button a-button-primary vvp-details-btn" id="a-autoid-${_btnAutoID}">
                    <span class="a-button-inner">
                        <input data-asin="${product.data_asin}" data-is-parent-asin="${product.data_asin_is_parent}" data-is-pre-release="${product.data_is_pre_release ?? false}" data-recommendation-id="${product.data_recommendation_id}" data-recommendation-type="${product.data_recommendation_type}" class="a-button-input" type="submit" aria-labelledby="a-autoid-${_btnAutoID}-announce">
                        <span class="a-button-text" aria-hidden="true" id="a-autoid-${_btnAutoID}-announce">Weitere Details</span>
                    </span>
                </span>
            </div>
        `;
        _tile.prepend(createFavStarElement(product, btnID));
        _tile.prepend(createTimeSeenElement(product, btnID));
        _tile.prepend(createShareElement(product, btnID));
        waitForHtmlElmement('.vvp-item-product-title-container', (_elem) => {
            insertHtmlElementAfter(_elem, createTaxInfoElement(product, btnID));
        }, _tile)
        // insertHtmlElementAfter((_tile.getElementsByClassName('vvp-item-product-title-container')[0]), createTaxInfoElement(product, btnID));
        if (cb) cb(_tile);
        resolve(_tile);
    })
}

function createFavStarElement(prod, index = Math.round(Math.random()* 10000)) {
    const _favElement = document.createElement('div');
    _favElement.setAttribute("id", `p-fav-${index || Math.round(Math.random() * 5000)}`);
    _favElement.classList.add('ave-favorite-star');
    _favElement.style.cssText = SETTINGS.CssProductFavStar();
    _favElement.textContent = '★';
    if (prod.isFav) _favElement.style.color = SETTINGS.FavStarColorChecked; // SETTINGS.FavStarColorChecked = Gelb;
    return _favElement;
}

function createFirstSeenElement(prod, index = Math.round(Math.random()* 10000)) {
    return createTimeSeenElement(prod, index, true);
}

function createTimeSeenElement(prod, index = Math.round(Math.random()* 10000), showFirstSeen) {
    const _showFirstSeen = showFirstSeen === false || showFirstSeen === true ? showFirstSeen : SETTINGS.ShowFirstSeen || false;

    const _timeSeenElement = document.createElement('div');
    _timeSeenElement.setAttribute("id", `ave-p-timeSeen-${index || Math.round(Math.random() * 5000)}`);
    _timeSeenElement.classList.add('ave-last-seen');
    if (_showFirstSeen) {
        _timeSeenElement.textContent = 'First seen: ' + timeAgo(new Date(toTimestamp(prod.ts_firstSeen)));
    } else {
        _timeSeenElement.textContent = 'Last seen: ' + timeAgo(new Date(toTimestamp(prod.ts_lastSeen)));
    }
    _timeSeenElement.style.float = 'left';
    _timeSeenElement.style.display = 'flex';
    return _timeSeenElement;
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years ago";
    }
    if (interval === 1) {
        return interval + " year ago";
    }

    const months = Math.floor(seconds / 2628000);
    if (months > 1) {
        return months + " months ago";
    }
    if (months === 1) {
        return months + " month ago";
    }

    const days = Math.floor(seconds / 86400);
    if (days > 1) {
        return days + " days ago";
    }
    if (days === 1) {
        return days + " day ago";
    }

    const hours = Math.floor(seconds / 3600);
    if (hours > 1) {
        return hours + " hours ago";
    }
    if (hours === 1) {
        return hours + " hour ago";
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes > 1) {
        return minutes + " minutes ago";
    }
    if (minutes === 1) {
        return minutes + " minute ago";
    }

    return "just now";
}

function createShareElement(prod, index = Math.round(Math.random()* 10000)) {
    const _shareElement = document.createElement('div');
    _shareElement.setAttribute("id", `ave-p-share-${index || Math.round(Math.random() * 5000)}`);
    _shareElement.classList.add('ave-share');
    _shareElement.textContent = '🔗';
    _shareElement.style.float = 'left';
    _shareElement.style.display = 'flex';
    _shareElement.style.margin = '0';
    _shareElement.style.cursor = 'pointer';
    return _shareElement;
}

let run = 0;
function shareEventHandlerClick(event, _data){
    if(_data.recommendation_id){
        if (SETTINGS.DebugLevel > 1) console.log("[AVE]",_data);
        const newUrl = `${window.location.origin}/dp/${_data.asin}?vine-data=${encodeURIComponent(JSON.stringify({
            asin: _data.asin,
            isParentAsin: _data.parent_asin,
            recommendationId: _data.recommendation_id,
            tax: _data.tax,
        }))}`;


        const urlParams = new URLSearchParams(window.location.search);
        let queueParam = currentMainPage;
        //let queueParam = urlParams.get('queue');
        let pageParam = urlParams.get('page');
        if(pageParam == null){pageParam = 1}
        let page = ""

        switch(queueParam){
            case PAGETYPE.OROGINAL_POTLUCK:
                queueParam = "Mein FSE"
                page = `Seite: ${pageParam}`
                break;
            case PAGETYPE.ORIGINAL_LAST_CHANCE:
                queueParam = "Verfügbar für Alle"
                page = `Seite: ${pageParam}`
                break;
            case PAGETYPE.ORIGINAL_SELLER:
                queueParam = "Zusätzliche Artikel"
                page = `Seite: ${pageParam}`
                break;
            default:
                queueParam = ""
                page = ``
                break;

        }

        let shareText = `
${queueParam}
${page}
${_data.tax}

${newUrl}`

        const cursorPosition = event.target.selectionStart;
        const inputRect = event.target.getBoundingClientRect();

        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        let avePopup = document.createElement('div');
        avePopup.style.position = 'absolute';
        avePopup.style.zIndex = '9999';
        avePopup.style.padding = '5px'
        avePopup.style.top = `${inputRect.top + scrollY}px`;
        avePopup.style.left = `${inputRect.left + scrollX}px`;
        avePopup.style.border = '5px solid black';
        avePopup.style.borderRadius = '100vh';
        avePopup.style.backgroundColor = 'white'
        avePopup.style.transform = 'translate(-50%, -100%)'
        avePopup.style.opacity = '0';
        avePopup.style.transition = "opacity 0.2s ease-in-out";

        navigator.clipboard.writeText(shareText).then(() => {
            avePopup.innerText = "Text wurde in die Zwischenablage kopiert."
        }).catch(err => {
            avePopup.innerText = `Fehler beim Kopieren in die Zwischenablage: ${err}`
        });

        document.body.appendChild(avePopup);

        // Timeout 0ms for the next Event Cycle -> Give time to render
        setTimeout(()=> {
                avePopup.style.opacity = '1';
            }, 0);

        setTimeout(()=> {
            avePopup.style.opacity = '0';
            setTimeout(()=> {
                avePopup.remove();
            }, 200);
        }, 3500);

    }
}

function createTaxInfoElement(prod, index = Math.round(Math.random()* 10000)) {
    if (SETTINGS.DebugLevel > 10) ('Called createTaxInfo()');
    let _currencySymbol = '';
    if (prod.data_tax_currency && prod.data_tax_currency == 'EUR') _currencySymbol = '€';

    const _taxElement = document.createElement('span');
    _taxElement.setAttribute("id", `ave-taxinfo-${index}`);
    _taxElement.style.cssText = 'position: relative; transform: translate(0px, -30px); width: fit-content; right: 0px;';

    const _taxElement_span = document.createElement('span');
    _taxElement_span.setAttribute("id", `ave-taxinfo-${index}-text`);
    _taxElement_span.classList.add('ave-taxinfo-text');
    const _prize = prod.data_estimated_tax_prize;
    if (SETTINGS.DebugLevel > 10) console.log('Called createTaxInfo(): We have a Taxprize of: ', _prize);
    _taxElement_span.innerText = `Tax Price: ${(typeof(_prize) == 'number') ? Intl.NumberFormat(undefined, {minimumFractionDigits: 2}).format(_prize) : '--.--'} ${_currencySymbol}`;
    if (SETTINGS.DebugLevel > 10) console.log('createTaxInfo(): After innerText');

    _taxElement.appendChild(_taxElement_span);
    if (SETTINGS.DebugLevel > 10) console.log('createTaxInfo(): END', _taxElement);
    return _taxElement;
}

function insertHtmlElementAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

async function createProductSite(siteType, productArray, cb) {
    if (!productArray) return;

    const _showFirstSeen = SETTINGS.ShowFirstSeen || false;
    productArray = sort_by_key(productArray, _showFirstSeen ? 'ts_firstSeen' : 'ts_lastSeen');

    const _productArrayLength = productArray.length;
    const _fastCount = Math.min(_productArrayLength, SETTINGS.MaxItemsPerPage);
    if (SETTINGS.DebugLevel > 10) console.log(`Create Overview for ${_productArrayLength} Products`);


    // Remove Pagination
    const _pagination = document.querySelector('.a-pagination')
    if (_pagination) _pagination.remove();

    const _contentContainer = document.querySelector('.a-section.vvp-tab-content');
    if(_contentContainer.querySelector('.vvp-no-offers-msg')){
        _contentContainer.querySelector('.vvp-no-offers-msg').remove();
        let _tileStructure = document.createElement('div');
        _tileStructure.classList = 'a-section vvp-items-container';
        _tileStructure.innerHTML = `
        <div id="vvp-browse-nodes-container">
        </div>
        <div id="vvp-items-grid-container">
        <p>
        </p>
        <div id="vvp-items-grid" class="a-section">
        </div>
        </div>`;

        _contentContainer.appendChild(_tileStructure);
    };

    // Cear Left Nodes Container
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    if (_nodesContainer) _nodesContainer.innerHTML = '';


    // Items Grid Container
    const _tilesContainer = document.getElementById('vvp-items-grid-container');
    if (!_tilesContainer) reloadPageWithSubpageTarget(siteType);

    // Edit Top Line
    if (_tilesContainer) {
        const _topLine = _tilesContainer.getElementsByTagName('p')[0];
        _topLine.innerHTML = `<p>Anzeigen von <strong>${_fastCount}</strong> von <strong>${_productArrayLength}</strong> Ergebnissen</p>`
    }

    const _tilesGrid = document.getElementById('vvp-items-grid');
    if (!_tilesGrid) reloadPageWithSubpageTarget(siteType);
    _tilesGrid.innerHTML = '';

    let _index = 0;
    let _returned = 0;

    for (; _index < _fastCount; _index++) {
        createTileFromProduct(productArray[_index], _index, (tile) => {
            _tilesGrid.append(tile);
            _returned++;
            if (SETTINGS.DebugLevel > 10) console.log(`Created Tile (${_returned}/${_fastCount})`);
            if (_returned == _fastCount) cb(true);
        });
    }

    addLeftSideButtons(true);
}

async function createInfiniteScrollSite(siteType, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called createInfiniteScrollSite()`);

    // Remove Pagination
    const _pagination = document.querySelector('.a-pagination')
    if (_pagination) _pagination.remove();

    const _contentContainer = document.querySelector('.a-section.vvp-tab-content');
    if(_contentContainer.querySelector('.vvp-no-offers-msg')){
        _contentContainer.querySelector('.vvp-no-offers-msg').remove();
        let _tileStructure = document.createElement('div');
        _tileStructure.classList = 'a-section vvp-items-container';
        _tileStructure.innerHTML = `
        <div id="vvp-browse-nodes-container">
        </div>
        <div id="vvp-items-grid-container">
        <p>
        </p>
        <div id="vvp-items-grid" class="a-section">
        </div>
        </div>`;

        _contentContainer.appendChild(_tileStructure);
    };

    // Cear Left Nodes Container
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    if (_nodesContainer) _nodesContainer.innerHTML = '';

    // Items Grid Container
    const _tilesContainer = document.getElementById('vvp-items-grid-container');
    if (!_tilesContainer) reloadPageWithSubpageTarget(siteType);

    // Edit Top Line
    if (_tilesContainer) {
        const _topLine = _tilesContainer.getElementsByTagName('p')[0];
        _topLine.innerHTML = ''
    }

    const _tilesGrid = document.getElementById('vvp-items-grid');
    if (!_tilesGrid) reloadPageWithSubpageTarget(siteType);
    _tilesGrid.innerHTML = '';

    addLeftSideButtons(true);
    cb(_tilesGrid);
}

async function appendInfiniteScrollTiles(cb = ()=>{}){
    // So lange tiles hinzufügen bis wir wieder über dem sichtbaren bereich sind
    if (SETTINGS.DebugLevel > 10) console.log('appendInfiniteScrollTiles(): ', infiniteScrollTilesBufferArray);
    const _tilesContainer = document.getElementById('vvp-items-grid');

    // setTimeout(async () => {
    let _stopCreation = false;
    let _createdCount = 0;
    while (infiniteScrollTilesBufferArray.length > 0 && !_stopCreation) {
        const _tile = infiniteScrollTilesBufferArray.shift();
        if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
            _tilesContainer.appendChild(_tile);
            parseTileData(_tile).then((_product) => {
                if (SETTINGS.DebugLevel > 14) console.log('Come Back from parseTileData <<<<<<<<<< INFINITYSCROLL <<<<<<<<<<<<<<<<<<<<<<<', _tile, _product);
                addStyleToTile(_tile, _product);
                addTileEventhandlers(_tile);
            });
        } else {
            createTileFromProduct(_tile).then((_elem) => {
                _tilesContainer.appendChild(_elem);
                addTileEventhandlers(_elem);
            })
        }



        if (_createdCount++ >= 100) _stopCreation = true;

        const _maxScrollHeight = Math.max(document.body.scrollHeight - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight);
        if (_maxScrollHeight > (window.scrollY + (window.innerHeight * 2))) _stopCreation = true;

        if (SETTINGS.DebugLevel > 10) console.log(`appendInfiniteScrollTiles(): Inside WHILE: _maxScrollHeigt: ${_maxScrollHeight} currPosition ${window.scrollY}`);
    }

    if (SETTINGS.DebugLevel > 10) console.log(`appendInfiniteScrollTiles(): After WHILE: left tile to create: ${infiniteScrollTilesBufferArray.length}`);
    cb(true);

    // },100);
}

/**
 * AVE PAGETYPE ENUM
 * @readonly
 * @enum {number}
 */
const PAGETYPE = {
    NEW_ITEMS: 0,
    FAVORITES: 1,
    ALL: 2,
    SEARCH_RESULT: 9,

    OROGINAL_POTLUCK: 100,
    ORIGINAL_LAST_CHANCE: 101,
    ORIGINAL_SELLER: 102
}

function createNewSite(type, data) {
    // Unhightlight nav buttons
    const _btnContainer = document.getElementById('vvp-items-button-container');
    const _selected = _btnContainer.getElementsByClassName('a-button-selected');
    for (let i = 0; i < _selected.length; i++) {
        const _btn = _selected[i];
        _btn.classList.remove("a-button-selected");
        _btn.classList.add("a-button-normal");
        _btn.removeAttribute('aria-checked');
    }


    switch(type) {
        case PAGETYPE.NEW_ITEMS:{
            currentMainPage = PAGETYPE.NEW_ITEMS;
            database.getNewEntries().then((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('ave-btn-list-new');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.FAVORITES:{
            currentMainPage = PAGETYPE.FAVORITES;
            database.getFavEntries().then((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('ave-btn-favorites');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.ALL:{
            currentMainPage = PAGETYPE.ALL;
            createInfiniteScrollSite(currentMainPage,(tilesContainer) => {
                const _baseUrl = (/(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(window.location.href))[1];
                const _preloadPages = ['potluck', 'last_chance', 'encore']
                infiniteScrollLastPreloadedPage = 1;
                infiniteScrollMaxPreloadPage = 100;
                infiniteScrollTilesBufferArray = [];

                if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
                    getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[0]}`, (tiles1) =>{
                        infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles1);
                        appendInfiniteScrollTiles();
                        getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[1]}`, (tiles2) =>{
                            infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles2);
                            appendInfiniteScrollTiles();
                            getTilesFromURL(`${_baseUrl}?queue=${_preloadPages[2]}`, (tiles3) =>{
                                infiniteScrollTilesBufferArray = infiniteScrollTilesBufferArray.concat(tiles3);
                                appendInfiniteScrollTiles();
                                setTimeout(()=> {
                                    handleInfiniteScroll(); // Just to trigger first preloads
                                }, 500);
                            })
                        })
                    })
                } else {
                    database.getAll().then((prodArr) => {
                        const _showFirstSeen = SETTINGS.ShowFirstSeen || false;
                        prodArr = sort_by_key(prodArr, _showFirstSeen ? 'ts_firstSeen' : 'ts_lastSeen');
                        infiniteScrollTilesBufferArray = prodArr;
                        appendInfiniteScrollTiles();
                    });
                }
            });
            break;
        }
        case PAGETYPE.SEARCH_RESULT:{
            currentMainPage = PAGETYPE.SEARCH_RESULT;
            createProductSite(type, data, () => {
                initTileEventHandlers();
            });
            break;
        }
    }
}


let lastGetTilesFromURLQuerry = 0;
function getTilesFromURL(url, cb = (tilesArray) => {}) {
    if (lastGetTilesFromURLQuerry + SETTINGS.PageLoadMinDelay > Date.now()) {
        const _delay =  Math.max(1, lastGetTilesFromURLQuerry + SETTINGS.PageLoadMinDelay - Date.now());
        console.warn(`getTilesFromURL() DELAYED for ${_delay}ms`)
        setTimeout(() => {getTilesFromURL(url, cb)}, _delay);
        return;
    }
    GM.xmlHttpRequest({
        method: "GET",
        url: url,
        onload: function(response) {
            const _parser = new DOMParser();
            const _doc = _parser.parseFromString(response.responseText, "text/html");
            lastGetTilesFromURLQuerry = Date.now();
            waitForHtmlElmement('#vvp-items-grid', (itemsContainer) => {
                if (SETTINGS.DebugLevel > 10) console.log('getTileFromURL(): itemsContainer:', itemsContainer);
                // cb(itemsContainer.getElementsByClassName('vvp-item-tile'));
                const _retArr = [];
                const _elemArr = itemsContainer.querySelectorAll('.vvp-item-tile');
                for (let i = 0; i < _elemArr.length; i++){
                    _retArr.push(_elemArr[i].cloneNode(true));
                }
                cb(_retArr);

                const _paginationData = getPageinationData();
                if (_paginationData) infiniteScrollMaxPreloadPage = _pageinationData.maxPage;
            }, _doc);
        }
    })
}

let lastBtnEventhandlerClickTimeStamp = 0;
function btnEventhandlerClick(event, data) {
    if (lastBtnEventhandlerClickTimeStamp + 1000 >= Date.now()) return;
    lastBtnEventhandlerClickTimeStamp = Date.now();
    if (SETTINGS.DebugLevel > 10) console.log(`called btnEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.getById(data.recommendation_id).then(async (prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`btnEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isNew = 0;
                requestProductDetails(prod).then((_newProd) => {
                    database.update(_newProd || prod).then( () => {
                        updateTileStyle(_newProd || prod);
                    });
                })
            }
        })
    }
}

function favStarEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called favStarEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.getById(data.recommendation_id).then((prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`favStarEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isFav = 1 - prod.isFav;
                database.update(prod).then(() => {
                    updateTileStyle(prod);
                });
            }
        })
    }
}

/**
 * Updates Style and Text of a Product Tile
 * @param {Product} prod
 * @returns
 */
function updateTileStyle(prod) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called updateTileStyle(${JSON.stringify(prod, null, 4)})`);
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;

    if (SETTINGS.DebugLevel > 10) console.log(`Searching for tile with id ${prod.id}`);
    for (let i = 0; i < _tilesLength; i++) {
        const _tile = _tiles[i];
        const _id = _tile.getAttribute('data-recommendation-id');

        if (_id == prod.data_recommendation_id) {
            if (SETTINGS.DebugLevel > 10) console.log(`Found Tile with id: ${prod.id}`);
            _tile.setAttribute('style', (prod.isFav) ? SETTINGS.CssProductFavTag : (prod.isNew) ? SETTINGS.CssProductNewTag : SETTINGS.CssProductDefault);
            const _favStar = _tile.querySelector('.ave-favorite-star');
            _favStar.style.color = (prod.isFav) ? SETTINGS.FavStarColorChecked : 'white'; // SETTINGS.FavStarColorChecked = Gelb;

            const _taxValue = prod.data_estimated_tax_prize;
            if (typeof(_taxValue) == 'number') {
                const _taxValueElem = _tile.querySelector('.ave-taxinfo-text');
                _taxValueElem.innerText = (_taxValueElem.innerText).replace('--.--', _taxValue);
            }
            return;
        }
    }
}

// Adds Eventhandler to Product Buttons
function initTileEventHandlers() {
    if (SETTINGS.DebugLevel > 10) console.log('Called inttTileEventHandlers() >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tileLength = _tiles.length;
    for(let i = 0; i < _tileLength; i++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Tile ${i}`);
        const _currTile = _tiles[i];
        //console.log('init');
        addTileEventhandlers(_currTile);
    }
}

function addTileEventhandlers(_currTile) {
    if (SETTINGS.DebugLevel > 10) console.log('Tile Event Handler');
    // const _favStar = _currTile.querySelector('.ave-favorite-star');
    const _btn = _currTile.querySelector('.vvp-details-btn input');

    const _data = new Object()
    _data.asin = _btn.getAttribute('data-asin');
    _data.parent_asin = _btn.getAttribute('data-is-parent-asin');
    _data.recommendation_id = _btn.getAttribute('data-recommendation-id');
    waitForHtmlElmement('[id^="ave-taxinfo-"]', (elem) => {
        _data.tax = _currTile.querySelector('[id^="ave-taxinfo-"] > span').textContent;
    });

    const _childs = _btn.childNodes;
    _btn.addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});

    for(let j = 0; j < _childs.length; j++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Children ${j} of Tile ${_currTile}`);
        _childs[j].addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});
    }

    waitForHtmlElmement('.ave-favorite-star', (elem) => {
        elem.addEventListener('click', (event) => {favStarEventhandlerClick(event, _data)});
    }, _currTile);

    waitForHtmlElmement('.ave-share', (elem) => {
        elem.addEventListener('click', (event) => {shareEventHandlerClick(event, _data)});
    }, _currTile);
}

function completeDelayedInit() {
    initTileEventHandlers();
}


function showAutoScanScreen(text) {
    const _overlay = document.createElement('div');
    _overlay.style.position = 'fixed';
    _overlay.style.top = '0';
    _overlay.style.left = '0';
    _overlay.style.width = '100%';
    _overlay.style.height = '100%';
    _overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Grauer Hintergrund mit Transparenz
    _overlay.style.zIndex = '1000'; // Stelle sicher, dass das Overlay über anderen Elementen liegt

    const _text = document.createElement('div');
    _text.style.position = 'absolute';
    _text.style.top = '50%';
    _text.style.left = '50%';
    _text.style.transform = 'translate(-50%, -50%)';
    _text.style.color = 'orange'; // Textfarbe
    _text.style.textAlign = 'center';
    _text.style.fontSize = '50px'; // Ändere die Schriftgröße hier
    _text.style.lineHeight = "1";
    _text.style.zIndex = '1001';
    _text.innerHTML = `<p id="ave-autoscan-text">${text}</p>`;

    document.body.appendChild(_overlay);
    document.body.appendChild(_text);
}

function updateAutoScanScreenText(text = '') {
    const _elem = document.getElementById('ave-autoscan-text');
    _elem.textContent = text;
}

function addAveSettingsTab(){
    waitForHtmlElmement('.vvp-tab-set-container > ul', (_upperButtonsContainer) => {
        const _upperSettingsButton = document.createElement('li');
        _upperSettingsButton.id = 'vvp-ave-settings-tab';
        _upperSettingsButton.classList = 'a-tab-heading';
        _upperSettingsButton.role = 'presentation';
        _upperSettingsButton.innerHTML += `<a role="tab" aria-selected="false" tabindex="-1">AVE Einstellungen</a>`;

        _upperSettingsButton.addEventListener('click',function(){
            const _upperButtons = document.body.querySelectorAll('.a-tab-container.vvp-tab-set-container > ul > li');
            _upperButtons.forEach(element => element.classList.remove('a-active'));

            const _contentContainer = document.body.querySelectorAll('.a-tab-container.vvp-tab-set-container > div');
            _contentContainer.forEach(element => element.classList.add('a-hidden'));
            if (SETTINGS.DebugLevel > 1) console.log(_contentContainer);

            _upperSettingsButton.classList.add('a-active');
            const _settingsContent = document.body.querySelector('[data-a-name="ave-settings"]');
            _settingsContent.classList.remove('a-hidden');

            const _settingsContainer = _settingsContent.querySelector('#ave-settings-container');
            if (SETTINGS.DebugLevel > 1) console.log(_settingsContainer);
            for (const elem of SETTINGS_USERCONFIG_DEFINES) {
                if (SETTINGS.DebugLevel > 1) console.log('Creating Settings Menu Element: ', elem);
                _settingsContainer.appendChild(createSettingsMenuElement(elem));
            }

        });

        _upperButtonsContainer.appendChild(_upperSettingsButton);

    })
}

function addAVESettingsMenu(){
    waitForHtmlElmement('.a-tab-container.vvp-tab-set-container', (_tabContainer) => {
        //const _tabContainer = document.body.querySelector('.a-tab-container.vvp-tab-set-container');

        const _boxContainer = document.createElement('div');
        _boxContainer.setAttribute('data-a-name', 'ave-settings');
        _boxContainer.classList = 'a-box a-box-tab a-tab-content a-hidden';
        _boxContainer.role = 'tabpanel';
        _boxContainer.tabindex = '0';

        const _contentContainer = document.createElement('div');
        _contentContainer.classList = 'a-box-inner'

        _boxContainer.appendChild(_contentContainer);
        _tabContainer.appendChild(_boxContainer);

        _contentContainer.innerHTML = `
    <style>
    :root {
  --toggleSliderSize: 1;
  --numberBorder: 1px;
  --numberPadding: 2px;
  --itemHeight: 21px;
}
.ave-settings-container {
  display: grid;
}

.ave-settings-container label {
  padding: 0;
}

.ave-settings-container input[type="number"] {
  width: 75px;
  height: 21px;
  border: var(--numberBorder) solid #888C8C;
  padding: var(--numberPadding);
}

.ave-settings-container input[type="color"] {
  width: 30px;
  padding: 0;
  border: 1px solid darkgrey;
  border-radius: 6px;
  cursor: pointer;
  height: var(--itemHeight);
}

.ave-settings-container input[type="text"] {
  width: 500px;
}

.ave-settings-item{
  display: inline-flex;
  align-items: center;
  margin: 5px 0;
  height: var(--itemHeight);
}

.ave-item-left {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ave-item-right {

}

.ave-item-right > label {

}

.ave-settings-item > * >.ave-settings-label-setting {
  margin-left: 5px;
}

.ave-settings-item > * >.ave-settings-label-setting:hover{
  color: red;
}

/* Add this attribute to the element that needs a tooltip */
[data-ave-tooltip] {
  position: relative;
  z-index: 2;
  cursor: pointer;
}

/* Hide the tooltip content by default */
[data-ave-tooltip]:before,
[data-ave-tooltip]:after {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

/* Position tooltip above the element */
[data-ave-tooltip]:before {
  position: absolute;
  bottom: -50%;
  /*left: calc(150% + 10px);*/
  margin-bottom: 5px;
  margin-left: calc(100% + 10px);
  padding: 7px;
  width: 160px;
  -webkit-border-radius: 3px;
  -moz-border-radius: 3px;
  border-radius: 3px;
  background-color: hsla(0, 0%, 20%, 0.9);
  color: #fff;
  content: attr(data-ave-tooltip);
  text-align: center;
  font-size: 14px;
  line-height: 1.2;
}

/* Triangle hack to make tooltip look like a speech bubble */
[data-ave-tooltip]:after {
  position: absolute;
  bottom: 25%;
  /*left: 50%;*/
  margin-left: calc(0% + 5px);
  width: 0;
  border-right: 5px solid hsla(0, 0%, 20%, 0.9);
  border-bottom: 5px solid transparent;
  border-top: 5px solid transparent;
  content: " ";
  font-size: 0;
  line-height: 0;
}

/* Show tooltip content on hover */
[data-ave-tooltip]:hover:before,
[data-ave-tooltip]:hover:after,
[data-ave-tooltip]:focus-within:before,
[data-ave-tooltip]:focus-within:after{
  visibility: visible;
  opacity: 1;
}

.ave-settings-label-switch{
  position: relative;
  display: inline-block;
  width: calc(var(--toggleSliderSize) * 30px);
  height: calc(var(--toggleSliderSize) * 17px);
}

.ave-settings-switch-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: calc(var(--toggleSliderSize) * 17px);
}

.ave-settings-switch-toggle-slider:before{
  position: absolute;
  content: "";
  height: calc(var(--toggleSliderSize) * 13px);
  width: calc(var(--toggleSliderSize) * 13px);
  left: calc(var(--toggleSliderSize) * 2px);
  bottom: calc(var(--toggleSliderSize) * 2px);
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .ave-settings-switch-toggle-slider {
  background-color: #2196F3;
}

input:checked + .ave-settings-switch-toggle-slider:before {
  transform: translateX(calc(var(--toggleSliderSize) * 13px));
}

.ave-settings-label-switch input{
  display: none
}

.ave-keyword-wrapper {
  margin: 25px 0;
}

.ave-keyword-input {
  width: fit-content;
}

.ave-keyword-input button {
font-weight: bold;
}

.ave-keyword-list-wrapper {
  margin-top: 10px;
}

.ave-keyword-list-wrapper table {
  border-collapse: collapse;
  width: 500px;
}

.ave-keyword-list-wrapper > table td {
  border: 1px solid #000000;
  text-align: left;
  padding: 8px;
}

.ave-keyword-list-wrapper > table td:first-child {
  width: 25px;
  text-align: center;
  vertical-align: middle;
}

.ave-keyword-list-wrapper > table tr:nth-child(even) {
  background-color: #dddddd;
}

.ave-keyword-list-wrapper #list-delete {
  width: 75px;
  text-align: center;
}

.ave-keyword-list-wrapper > table button {
  display: flex;
  margin: auto;
  background-color: inherit;
  border: none;
}

.ave-input-button {
  border: none;
  background: none;
  margin: 3px;
}

::-webkit-color-swatch-wrapper {
  padding: 0;
}

::-webkit-color-swatch{
  border: 0;
  border-radius: 5px;
}

::-moz-color-swatch,
::-moz-focus-inner{
  border: 0;
}

::-moz-focus-inner{
  padding: 0;
}
    </style>

    <div id="ave-settings-header" style="margin-bottom: 10px"><h3>Einstellungen ${AVE_TITLE} - Version ${AVE_VERSION}</h3></div>
    <div id="ave-settings-container" class="ave-settings-container">


</div>
    `;
    })
}

function createSettingsMenuElement(dat){
    const _elem = document.createElement('div');
    if (dat.key) _elem.setAttribute('ave-config-key', dat.key);
    _elem.classList.add('ave-settings-item');

    if (dat.type == 'bool') {// Boolean Value

        const _elem_item_left = document.createElement('div');
        _elem_item_left.classList.add('ave-item-left');
        const _elem_item_left_label = document.createElement('label');
        _elem_item_left_label.classList.add('ave-settings-label-switch');
        const _elem_item_left_label_input = document.createElement('input');
        _elem_item_left_label_input.type = 'checkbox';
        _elem_item_left_label_input.className = 'ave-input-binary';
        _elem_item_left_label_input.setAttribute('ave-data-key', dat.key);
        // _elem_item_left_label_input.setAttribute('checked', SETTINGS[dat.key])
        // _elem_item_left_label_input.value = `${SETTINGS[dat.key]}`;
        _elem_item_left_label_input.checked = SETTINGS[dat.key];
        _elem_item_left_label_input.addEventListener('click', (event) => {console.log('This is a Boolean Value Input', event); SETTINGS[dat.key] = event.target.checked; SETTINGS.save();})

        const _elem_item_left_label_span = document.createElement('span');
        _elem_item_left_label_span.classList.add('ave-settings-switch-toggle-slider');

        _elem_item_left_label.appendChild(_elem_item_left_label_input);
        _elem_item_left_label.appendChild(_elem_item_left_label_span);
        _elem_item_left.appendChild(_elem_item_left_label);
        _elem.appendChild(_elem_item_left);

        const _elem_item_right = document.createElement('div');
        _elem_item_right.classList.add('ave-item-right');
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${(dat.description && dat.description != '') ? dat.description : dat.name}">${dat.name}</label>`

        _elem.appendChild(_elem_item_right);

    } else if (dat.type == 'number') { // Number Value

        const _elem_item_left = document.createElement('div');
        _elem_item_left.classList.add('ave-item-left');
        const _elem_item_left_input = document.createElement('input');
        _elem_item_left_input.type = 'number';
        _elem_item_left_input.className = 'ave-input-number';
        _elem_item_left_input.setAttribute('ave-data-key', dat.key);
        _elem_item_left_input.setAttribute('value', SETTINGS[dat.key]);
        //_elem_item_left_input.setAttribute('onInput', 'this.style.width = "calc(" + (this.value.length + 1) + "ch + 30px)";')
        if (!isNaN(dat.min)) _elem_item_left_input.setAttribute('min', dat.min);
        if (!isNaN(dat.max)) _elem_item_left_input.setAttribute('max', dat.max);
        _elem_item_left_input.addEventListener('change', (event) => {
            const _value = event.target.value;
            const _min = parseFloat(event.target.min);
            const _max = parseFloat(event.target.max);
            console.log('This is a Number Value Input', event);

            if(_value <= _max && _value >= _min){
                console.log("Eingabe Valid");
                SETTINGS[dat.key] = parseInt(event.target.value);
                SETTINGS.save();
            }else{
                console.log("Eingabe Fehlerhaft");
            }

        })
        _elem_item_left_input.addEventListener('input', (event) => {
            const _value = event.target.value;
            const _min = parseFloat(event.target.min);
            const _max = parseFloat(event.target.max);

            if(_value <= _max && _value >= _min){
                event.target.style.borderColor = 'inherit';
                event.target.style.color = 'inherit';
            }else{
                event.target.style.borderColor = 'red';
                event.target.style.color = 'red';
            }
        })
        _elem_item_left.appendChild(_elem_item_left_input);
        _elem.appendChild(_elem_item_left);

        const _elem_item_right = document.createElement('div');
        _elem_item_right.classList.add('ave-item-right');
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${(dat.description && dat.description != '') ? dat.description : dat.name}">${dat.name}</label>`

        _elem.appendChild(_elem_item_right);

    } else if (dat.type == 'button') { // Number Value

        const _elem_item_left = document.createElement('div');

        _elem_item_left.classList.add('ave-item-left');


        const _elem_item_left_input_label  = document.createElement('label');
        _elem_item_left_input_label.setAttribute('data-ave-tooltip', (dat.description && dat.description != '') ? dat.description : dat.name);
        _elem_item_left_input_label.setAttribute('class', 'a-button');
        _elem_item_left_input_label.style.width = "250px";
        if (dat.bgColor) _elem_item_left_input_label.style.backgroundColor = dat.bgColor;
        const _elem_item_left_input = document.createElement('button');
        _elem_item_left_input.type = 'button';
        _elem_item_left_input.className = 'ave-input-button';

        // _elem_item_left_input.setAttribute('ave-data-key', dat.key);
        _elem_item_left_input.innerText = dat.name;
        //_elem_item_left_input.setAttribute('data-ave-tooltip',dat.description);
        _elem_item_left_input.addEventListener('click', (event) => {console.log('This is a button Input', event); if(dat.btnClick) dat.btnClick();})

        _elem_item_left_input_label.appendChild(_elem_item_left_input);
        _elem_item_left.appendChild(_elem_item_left_input_label);
        _elem.appendChild(_elem_item_left);

        // const _elem_item_right = document.createElement('div');
        // _elem_item_right.classList.add('ave-item-right');
        // _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${dat.description}">${dat.name}</label>`

        // _elem.appendChild(_elem_item_right);


    } else if (dat.type == 'color') {

        const _elem_item_left = document.createElement('div');
        _elem_item_left.classList.add('ave-item-left');
        const _elem_item_left_input = document.createElement('input');
        _elem_item_left_input.type = 'color';
        _elem_item_left_input.className = 'ave-input-color';
        _elem_item_left_input.setAttribute('ave-data-key', dat.key);
        _elem_item_left_input.setAttribute('value', colorToHex(SETTINGS[dat.key]));
        _elem_item_left_input.addEventListener('change', (event) => {console.log('This is a Color Value Input', event); SETTINGS[dat.key] = event.target.value; SETTINGS.save();})
        _elem_item_left.appendChild(_elem_item_left_input);
        _elem.appendChild(_elem_item_left);

        const _elem_item_right = document.createElement('div');
        _elem_item_right.classList.add('ave-item-right');
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${(dat.description && dat.description != '') ? dat.description : dat.name}">${dat.name}</label>`

        _elem.appendChild(_elem_item_right);

    } else if (dat.type == 'title'){
        const _elem_spacer_horizontal = document.createElement('hr');
        _elem_spacer_horizontal.style.width = '100%';

        const _elem_spacer_title = document.createElement('h4');
        _elem_spacer_title.textContent = dat.name;

        _elem.style.height = 'fit-content';
        _elem.style.display = 'flex';
        _elem.style.flexWrap = 'wrap';
        _elem.appendChild(_elem_spacer_horizontal);
        _elem.appendChild(_elem_spacer_title);
    } else if (dat.type == 'keywords') {
        _elem.classList.remove('ave-settings-item');
        _elem.classList.add('ave-keyword-wrapper');
        _elem.innerHTML = `<h4>${dat.name}</h4>`;
        const _elem_keyword_input = document.createElement('div');
        _elem_keyword_input.innerHTML = '<span></span>';
        _elem_keyword_input.classList.add('ave-keyword-input');


        const _elem_keyword_input_label = document.createElement('label');
        _elem_keyword_input_label.setAttribute('data-ave-tooltip', dat.description);

        const _elem_keyword_input_input = document.createElement('textarea');
        _elem_keyword_input_input.setAttribute('cols', 70);
        _elem_keyword_input_input.setAttribute('rows', 1);
        _elem_keyword_input_input.setAttribute('placeholder', dat.inputPlaceholder);
        _elem_keyword_input_input.addEventListener('change', (elm, ev) => {
            if (SETTINGS.DebugLevel > 1) console.log('EVENTHANDLER CHANGE:', elm, 'event:', ev);
            const _value = elm.target.value.trim();
            if (_value && _value.length > 0) {
                for (let _key of _value.split('\n')) {
                    _key = _key.trim();
                    if (_key.length === 0) {
                        continue;
                    }
                    if (!SETTINGS[dat.key].includes(_key)) {
                        SETTINGS[dat.key].push(_key);
                    }
                }
            }
            SETTINGS.save();
            elm.target.value = '';
            const _table = document.getElementById(dat.key);
            _table.innerHTML = '';
            for (let i = 0; i < SETTINGS[dat.key].length; i++) {
                _table.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
            }
        })
        // const _elem_keyword_input_button = document.createElement('button');
        // _elem_keyword_input_button.innerText = '+';
        _elem_keyword_input_label.appendChild(_elem_keyword_input_input);
        _elem_keyword_input.appendChild(_elem_keyword_input_label);
        // _elem_keyword_input.appendChild(_elem_keyword_input_button);
        _elem.appendChild(_elem_keyword_input);

        const _elem_keyword_list = document.createElement('div');
        _elem_keyword_list.classList.add('ave-keyword-list-wrapper');
        const _elem_keyword_list_table = document.createElement('table');
        const _elem_keyword_list_table_tbody = document.createElement('tbody');
        _elem_keyword_list_table_tbody.setAttribute('id', dat.key);
        for (let i = 0; i < SETTINGS[dat.key].length; i++){
            _elem_keyword_list_table_tbody.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
        }
        _elem_keyword_list_table.appendChild(_elem_keyword_list_table_tbody);
        _elem_keyword_list.appendChild(_elem_keyword_list_table);
        _elem.appendChild(_elem_keyword_list);
    }

    return _elem;
}

function createSettingsKeywordsTableElement(dat, index, entry){
    const _tableRow = document.createElement('tr');
    _tableRow.setAttribute('index', index);
    const _tableRow_td1 = document.createElement('td');
    const _tableRow_td1_button = document.createElement('button');
    _tableRow_td1_button.innerHTML = `<i class="a-icon a-icon-close"></i>`;
    _tableRow_td1_button.setAttribute('ave-data-keyword', entry);
    _tableRow_td1_button.addEventListener('click', (elm, ev) =>{
        // console.log('DELETE_BTN:: ', elm)
        SETTINGS[dat.key].splice(index, 1);
        SETTINGS.save();
        const _table = document.getElementById(dat.key);
        _table.innerHTML = '';
        for (let i = 0; i < SETTINGS[dat.key].length; i++){
            _table.appendChild(createSettingsKeywordsTableElement(dat, i, SETTINGS[dat.key][i]));
        }
    });
    _tableRow_td1.appendChild(_tableRow_td1_button);
    _tableRow.appendChild(_tableRow_td1);
    const _tableRow_td2 = document.createElement('td');
    _tableRow_td2.innerText = entry;
    _tableRow.appendChild(_tableRow_td2);
    return _tableRow;
}

function addOverlays() { // Old Settings Code
    const _overlayBackground = document.createElement('div');
    _overlayBackground.style.position = 'fixed';
    _overlayBackground.style.backgroundColor = '#000000b0';
    _overlayBackground.style.zIndex = '1750';
    _overlayBackground.style.width = '100%';
    _overlayBackground.style.height = '100%';
    _overlayBackground.style.top = '0';

    document.body.appendChild(_overlayBackground);

    const _settingsDiv = document.createElement('div');
    _settingsDiv.style.position = 'fixed';
    _settingsDiv.style.zIndex = '1750';
    _settingsDiv.style.width = '100%';
    _settingsDiv.style.height = '100%';
    _settingsDiv.style.top = '0';
    _settingsDiv.style.display = 'flex';
    _settingsDiv.style.justifyContent = 'center';
    _settingsDiv.style.alignItems = 'center';

    _settingsDiv.innerHTML = `
    <style>
    .ave-setting {
    padding: 0 0 7px;
    }
    </style>
    <div style="background-color: white;border-radius: 8px;width: 50%;min-width: 250px;height: 75%;overflow: hidden;">
      <div id="settingsInner"width: 100%; height: 100%;"> <!--- Inner Start -->
        <div id="settingsNav" style="background-color: #F0F2F2;border-bottom: 1px solid #D5D9D9;display: flex;height: 50px;align-items: center;padding: 0 24px;"> <!--- Nav Start -->
         <div style="color: #444;font-size: 16px;font-weight: 700;">Amazon Vine Explorer Einstellungen</div>
         <div style="color: #444;margin-left: auto;width: 50px;height: 50px;display: flex;justify-content: center;align-items: center;font-weight: 600;font-size: larger;cursor: pointer;transform: translate(50%, 0);">
           <i class="a-icon a-icon-close"></i>
         </div>
        </div> <!--- Nav End -->
        <div style="padding: 16px 24px;color: #0F111"> <!--- Content Start -->
        <div class="ave-setting">
          <input type="number" value="${SETTINGS.DebugLevel}" onchange="console.log('Setting Changed')"> - Debug Level
        </div>
        <div class="ave-setting">
        <input type="checkbox" checked="${SETTINGS.EnableFullWidth}" onchange="console.log('Setting Changed')"> - Full Width
        </div>
        <div class="ave-setting">
        <input type="checkbox" checked="${SETTINGS.DisableFooter}" onchange="console.log('Setting Changed')"> - Disable Footer
        </div>
        <div class="ave-setting">
        <input type="checkbox" checked="${SETTINGS.DisableSuggestions}" onchange="console.log('Setting Changed')"> - Disable Suggestions
        </div>
        <div class="ave-setting">
        <input type="checkbox" checked="${SETTINGS.DisableFooterShopping}" onchange="console.log('Setting Changed')"> - Disable Footer Shopping
        </div>
        <div class="ave-setting">
        <input type="checkbox" checked="${SETTINGS.DisableSuggestionsShopping}" onchange="console.log('Setting Changed')"> - Disable Suggestions Shopping
        </div>
        </div> <!--- Content End -->
        <div> <!--- Footer Start -->
        </div> <!--- Footer End -->
      </div> <!--- Inner End -->
    </div>
`

    document.body.appendChild(_settingsDiv);
}

function componentToHex(c) {
    const _c = Math.min(c, 255)
    const _hex = _c.toString(16);
    return _hex.length == 1 ? "0" + _hex : _hex;
}

function rgbToHex(r, g, b){
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function rgbaToHex(r, g, b, a){
    return "#" + componentToHex(a) + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function colorToHex(color) {
    const _color = color.replace(/\s/g,''); // Remove all spaces
    let _cache;

    if (_color == 'white'){
        return '#ffffff';
    } else if (_color == 'black'){
        return '#000000';
    } else if ((_cache = /rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(_color))){ // rgb(0,0,0)
        return rgbToHex(_cache[1], _cache[2], _cache[3]);
    } else if ((_cache = /rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(_color))){ // rgba(0,0,0,0)
        return rgbaToHex(_cache[1], _cache[2], _cache[3], _cache[4]);
    } else if (/#[0-9a-fA-F]{6}|[0-9a-fA-F]{8}$/.exec(_color)){ // #000000
        return _color;
    }

}

ave.colorToHex = colorToHex;

function addDBCleaningSymbol(){
    const _cleaningDiv = document.createElement('div');
    _cleaningDiv.style.width = "25px";
    _cleaningDiv.style.height = "25px";
    // _cleaningDiv.style.position = 'absolute';
    _cleaningDiv.style.position = 'fixed';
    _cleaningDiv.style.zIndex = '9999';
    _cleaningDiv.style.left = '10px';
    _cleaningDiv.style.bottom = '35px';

    _cleaningDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-cleaning {
      transform: translate(35%, -140%) scale(0.7);
    }
    .ave-cleaning svg {
      animation: rotate 2s linear infinite;
    }
    @keyframes rotate {
      0% {
        transform: translateX(-100%);
      }
      50% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-100%);
      }
    }
    </style>
    <div id="dbVector" class="ave-db"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M20 18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V13.974C4.50221 14.5906 5.21495 15.1029 6.00774 15.4992C7.58004 16.2854 9.69967 16.75 12 16.75C14.3003 16.75 16.42 16.2854 17.9923 15.4992C18.7851 15.1029 19.4978 14.5906 20 13.974V18Z" fill="#1C274C"></path> <path d="M12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.7851 9.10285 19.4978 8.59059 20 7.97397V12C20 12.5 18.2143 13.5911 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.5 13.5683 4 12.5 4 12V7.97397C4.50221 8.59059 5.21495 9.10285 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75Z" fill="#1C274C"></path> <path d="M17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C6.16384 7.95596 5.00637 7.31492 4.2015 6.27935C4.06454 6.10313 4.00576 5.87853 4.03988 5.65798C4.06283 5.50969 4.0948 5.35695 4.13578 5.26226C4.82815 3.40554 8.0858 2 12 2C15.9142 2 19.1718 3.40554 19.8642 5.26226C19.9052 5.35695 19.9372 5.50969 19.9601 5.65798C19.9942 5.87853 19.9355 6.10313 19.7985 6.27935C18.9936 7.31492 17.8362 7.95596 17.3214 8.15761Z" fill="#1C274C"></path> </g></svg></div>
    <div id="loadingVector" class="ave-cleaning"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Lupe: https://www.svgrepo.com/svg/532552/search-alt-2
    document.body.appendChild(_cleaningDiv);
    return _cleaningDiv;
}

function addDBLoadingSymbol(){
    const _loadingDiv = document.createElement('div');
    _loadingDiv.style.width = "25px";
    _loadingDiv.style.height = "25px";
    // _loadingDiv.style.position = 'absolute';
    _loadingDiv.style.position = 'fixed';
    _loadingDiv.style.zIndex = '9999';
    _loadingDiv.style.left = '10px';
    _loadingDiv.style.bottom = '35px';

    _loadingDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-loading {
      transform: translate(35%, -140%) scale(0.7);
    }
    .ave-loading svg {
      animation: rotate 1s linear infinite;
    }
    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    </style>
    <div id="dbVector" class="ave-db"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M20 18C20 20.2091 16.4183 22 12 22C7.58172 22 4 20.2091 4 18V13.974C4.50221 14.5906 5.21495 15.1029 6.00774 15.4992C7.58004 16.2854 9.69967 16.75 12 16.75C14.3003 16.75 16.42 16.2854 17.9923 15.4992C18.7851 15.1029 19.4978 14.5906 20 13.974V18Z" fill="#1C274C"></path> <path d="M12 10.75C14.3003 10.75 16.42 10.2854 17.9923 9.49925C18.7851 9.10285 19.4978 8.59059 20 7.97397V12C20 12.5 18.2143 13.5911 17.3214 14.1576C15.9983 14.8192 14.118 15.25 12 15.25C9.88205 15.25 8.00168 14.8192 6.67856 14.1576C5.5 13.5683 4 12.5 4 12V7.97397C4.50221 8.59059 5.21495 9.10285 6.00774 9.49925C7.58004 10.2854 9.69967 10.75 12 10.75Z" fill="#1C274C"></path> <path d="M17.3214 8.15761C15.9983 8.81917 14.118 9.25 12 9.25C9.88205 9.25 8.00168 8.81917 6.67856 8.15761C6.16384 7.95596 5.00637 7.31492 4.2015 6.27935C4.06454 6.10313 4.00576 5.87853 4.03988 5.65798C4.06283 5.50969 4.0948 5.35695 4.13578 5.26226C4.82815 3.40554 8.0858 2 12 2C15.9142 2 19.1718 3.40554 19.8642 5.26226C19.9052 5.35695 19.9372 5.50969 19.9601 5.65798C19.9942 5.87853 19.9355 6.10313 19.7985 6.27935C18.9936 7.31492 17.8362 7.95596 17.3214 8.15761Z" fill="#1C274C"></path> </g></svg></div>
    <div id="loadingVector" class="ave-loading"><svg viewBox="-0.8 -0.8 17.60 17.60" xmlns="http://www.w3.org/2000/svg" fill="none" class="hds-flight-icon--animation-loading" stroke="#000000" stroke-width="0.8"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g fill="#000000" fill-rule="evenodd" clip-rule="evenodd"> <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z" opacity=".2"></path> <path d="M7.25.75A.75.75 0 018 0a8 8 0 018 8 .75.75 0 01-1.5 0A6.5 6.5 0 008 1.5a.75.75 0 01-.75-.75z"></path> </g> </g></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Loading: https://www.svgrepo.com/svg/448500/loading
    document.body.appendChild(_loadingDiv);
    return _loadingDiv;
}

function addLoadingSymbol(){
    const _loadingDiv = document.createElement('div');
    _loadingDiv.style.width = "25px";
    _loadingDiv.style.height = "25px";
    // _loadingDiv.style.position = 'absolute';
    _loadingDiv.style.position = 'fixed';
    _loadingDiv.style.zIndex = '9999';
    _loadingDiv.style.left = '10px';
    _loadingDiv.style.bottom = '35px';

    _loadingDiv.innerHTML = `
    <style>
    .ave-db {
    }
    .ave-loading {

    }
    .ave-loading svg {
      animation: rotate 2s linear infinite;
    }
    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(-360deg);
      }
    }
    </style>
    <div id="loadingVector" class="ave-loading"><svg fill="none" viewBox="0 0 24 24" id="update-alt" data-name="Line Color" xmlns="http://www.w3.org/2000/svg" class="icon line-color"><path id="primary" d="M5.07,8A8,8,0,0,1,20,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><path id="primary-2" data-name="primary" d="M18.93,16A8,8,0,0,1,4,12" style="fill: none; stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path><polyline id="secondary" points="5 3 5 8 10 8" style="fill: none; stroke: rgb(44, 169, 188); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline><polyline id="secondary-2" data-name="secondary" points="19 21 19 16 14 16" style="fill: none; stroke: rgb(44, 169, 188); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></polyline></svg></div>
    `;
    //Vector used
    //Vector DB: https://www.svgrepo.com/svg/525311/database
    //Vector Loading: https://www.svgrepo.com/svg/448500/loading
    document.body.appendChild(_loadingDiv);
    return _loadingDiv;
}

function getPageinationData(localDocument = document) {
    if (SETTINGS.DebugLevel > 10) console.log('Called getPageinationData()');
    const _ret = new Object();
    const _paginationContainer = localDocument.querySelector('.a-pagination');
    if (!_paginationContainer) return;
    if (!_paginationContainer.lastChild) return;

    let _currChild = _paginationContainer.lastChild;

    while ((!_ret.href || !_ret.maxPage) && _currChild) {
        const _curr = _currChild.firstChild;

        if (_curr && typeof _curr.hasAttribute === "function") {
            if (_curr.hasAttribute('href')) _ret.href = _curr.getAttribute('href').replace(/=[0-9]+/, '=');
            if (parseInt(_curr.text)) _ret.maxPage = parseInt(_curr.text);
        }
        _currChild = _currChild.previousSibling
    }
    return _ret;
}

// CleanUp and Fix Database Entrys
async function cleanUpDatabase(cb = () => {}) {
    if (SETTINGS.DebugLevel > 10) console.log('Called cleanUpDatabase()');
    const _dbCleanIcon = addDBCleaningSymbol();

    database.getAll().then((prodArr) => {

        const _prodArrLength = prodArr.length;
        const _workersProms = [];
        if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking ${_prodArrLength} Entrys`);

        let _updated = 0;
        let _deleted = 0;
        let _vendorCleanupDate = toUnixTimestamp(localStorage.getItem('AVE_CLEANUP_LAST_TIME') || 0);
        let _normalCleanupDate = _vendorCleanupDate;
        if (_vendorCleanupDate < unixTimeStamp() - SECONDS_PER_DAY) {
            // potluck removal starts at last cleanup time or after a day, whichever comes later
            _vendorCleanupDate = unixTimeStamp() - SECONDS_PER_DAY;
        }
        if (_normalCleanupDate < unixTimeStamp() - SECONDS_PER_WEEK) {
            // normal removal starts at last cleanup time or after 7 days, whichever comes later
            _normalCleanupDate = unixTimeStamp() - SECONDS_PER_WEEK;
        }

        let secondsBeforeCleanup = SETTINGS.HoursBeforeCleanup * 3600;
        let currentTimeStamp = unixTimeStamp();

        for (const _currEntry of prodArr) {
            _workersProms.push(new Promise((resolve, reject) => {
                let _needUpdate = false;
                if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking Entry ${_currEntry.id} `);

                // Checking Product Vars
                if (!_currEntry.ts_firstSeen){
                    _currEntry.ts_firstSeen = (unixTimeStamp() - Math.round(Math.random() * (SECONDS_PER_WEEK / 2)));
                    _needUpdate = true;
                    if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} had no valid firstseen timestamp. fixed`);
                }

                if (!_currEntry.ts_lastSeen) {
                    _currEntry.ts_lastSeen = (_currEntry.ts_firstSeen + SECONDS_PER_DAY);
                    _needUpdate = true;
                    if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} had no valid lastseen timestamp. fixed`);
                }

                let _notSeenCounter = _currEntry.notSeenCounter;
                if (_currEntry.data_recommendation_type == 'VENDOR_TARGETED' &&  _currEntry.ts_lastSeen < _vendorCleanupDate) { // If PotLuck start revoving after 1 day
                    _notSeenCounter++;
                    if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} increased notSeenCounter to ${_notSeenCounter}`);
                } else if (_currEntry.ts_lastSeen < _normalCleanupDate) { // Normal Product Start Removing after 1 week
                    _notSeenCounter++;
                    if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} increased notSeenCounter to ${_notSeenCounter}`);
                }

                if (_currEntry.notSeenCounter != _notSeenCounter) {
                    if (SETTINGS.DebugLevel > 14) console.log(`cleanUpDatabase() - Entry ${_currEntry.id} update notSeenCounter from ${_currEntry.notSeenCounter} to ${_notSeenCounter}`);
                    _currEntry.notSeenCounter = _notSeenCounter;
                    _needUpdate = true;
                }

                if ((_currEntry.notSeenCounter > 0 && currentTimeStamp - _currEntry.ts_lastSeen >= secondsBeforeCleanup || _currEntry.forceRemove) && !_currEntry.isFav) {
                    if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Removing Entry ${_currEntry.id}`);

                    database.removeID(_currEntry.id).then((ret) => {
                        _deleted++;
                        resolve()
                    });
                } else if (!_needUpdate){
                    resolve()
                } else {
                    database.update(_currEntry).then((ret) => {_updated++; resolve();});
                }
            }))
        }

        Promise.allSettled(_workersProms).then(() => {
            if (SETTINGS.DebugLevel > 0) console.log(`Databasecleanup Finished: Entrys:${_prodArrLength} Updated:${_updated} Deleted:${_deleted}`);
            _dbCleanIcon.remove();
            // store current date
            localStorage.setItem('AVE_CLEANUP_LAST_TIME', Date.now());
            cb(true);
        })

    });
}

unsafeWindow.ave.dbCleanup = cleanUpDatabase;

function exportDatabase() {
    console.log('Create Database Dump...');

    database.getAll().then((db) => {
        try{
            console.log("Creating db export JSON as BLOB (uncompressed)");
            const dbBlob = new Blob([JSON.stringify(db, null, 4)], {type: "application/json;charset=utf-8"});

            console.log("Emulating download file using saveAs script to export JSON file (uncompressed)");
            saveAs(dbBlob, "AmazonVineExplorerDatabase.json");

        } catch (error) {
            console.log("Oops, there was an error exporting AVE user database");
            console.log(error);
        }
    });
}


/**
 * Opens a file selector dialog and imports a database from a JSON file.
 * @async
 * @returns {Promise<void>}
 */
async function importDatabase() {
    return new Promise((resolve, reject) => {
        // Create an input element of type "file"
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';

        // Set up an event listener for when a file is selected
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];

            if (file) {
                const enableBackgroundScan = SETTINGS.EnableBackgroundScan;
                SETTINGS.EnableBackgroundScan = false;
                if (backGroundScanTimeout) {
                    console.log('Stopping background scan');
                    clearTimeout(backGroundScanTimeout);
                    backGroundScanTimeout = null;
                }

                try {
                    const jsonData = await readFile(file);
                    database.import(jsonData)
                    .then(() => {
                        console.log('Data imported successfully.');
                        alert('Data imported successfully');
                        resolve();
                    })
                    .catch((error) => {
                        console.error('Error importing data:', error);
                        alert(`Error importing data: ${error}`);
                        reject(error);
                    })
                    .finally(() => {
                        SETTINGS.EnableBackgroundScan = enableBackgroundScan;
                        BackGroundScanIsRunning = false;
                        localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', 0);
                        localStorage.setItem('AVE_BACKGROUND_SCAN_IS_RUNNING', false);
                        initBackgroundScan();
                    });

                } catch (error) {
                    SETTINGS.EnableBackgroundScan = enableBackgroundScan;
                    console.error('Error importing data:', error);
                    alert(`Error importing data: ${error}`);
                    reject(error);
                }
            }
        });

        // Trigger a click event to open the file selector dialog
        fileInput.click();
    });
}

unsafeWindow.ave.importDB = importDatabase;

/**
 * Reads the content of a file as text.
 * @param {File} file - The file to read.
 * @returns {Promise<string>} - A Promise that resolves to the file content as a string.
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            resolve(JSON.parse(event.target.result));
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsText(file);
    });
}

function initBackgroundScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called initBackgroundScan()');
    if  (BackGroundScanIsRunning) {console.warn('initBackgroundScan(): Backgroundscan is already running => Exit');return;}
    if  (!SETTINGS.EnableBackgroundScan) {console.warn('initBackgroundScan(): Backgroundscan is disabled => Exit');return;}
    if (!AVE_IS_THIS_SESSION_MASTER) {console.warn('initBackgroundScan(): This Instance is not the Master Session! => don´t start BackgroundScan'); return;}
    BackGroundScanIsRunning = true;
    const _baseUrl = (/(http[s]{0,1}:\/\/[w]{0,3}.amazon.[a-z]{1,}.{0,1}[a-z]{0,}\/vine\/vine-items)/.exec(window.location.href))[1];

    showBackgroundScanScreen('Start Background Scanner');

    const _paginatinWaitLoop = setInterval(() => {

        const _maxPage = localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX') || 100;
        if (_maxPage) {
            clearInterval(_paginatinWaitLoop);
            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): pagination WaitLoop');

            if (!(localStorage.getItem('AVE_BACKGROUND_SCAN_IS_RUNNING') == 'true')) {
                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): init localStorage Variables');
                localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_MAX', _maxPage);
                localStorage.setItem('AVE_BACKGROUND_SCAN_IS_RUNNING', true);
                localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', 0);
                localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', 0);
                localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
            }

            let _loopIsWorking = false;
            let _subStage = 0;
            let _PageMax = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX')) || 0;
            const _stageZeroSites = ['queue=potluck', 'queue=last_chance']

            backGroundScanTimeout = setTimeout(initBackgroundScanSubFunctionScannerLoop, SETTINGS.BackGroundScanDelayPerPage);
            function initBackgroundScanSubFunctionScannerLoop(){
                let startTime = performance.now(); // Get the Starttime to calculate the speed

                if (_loopIsWorking) return;
                _loopIsWorking = true;

                if (!(localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true')) {
                    let _fastTimeWaitingMS = Date.now() - (localStorage.getItem('AVE_FAST_SCAN_LAST_TIME') || 0);
                    let _fastTimeWaitingMin = _fastTimeWaitingMS / 1000 / 60;
                    let _startFastScan = true;
                    if (_fastTimeWaitingMin < 5) {
                        _startFastScan = false;
                    }
                    if (!(localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE') > 0)) {
                        _startFastScan = false;
                    }
                    if (!(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX') > 0)) {
                        _startFastScan = false;
                    }
                    if (localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE') == 1 && !(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT') > 0)) {
                        _startFastScan = false;
                    }

                    if (_startFastScan) {
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): starting fast scan');
                        localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', true);
                        localStorage.setItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT1', -1);
                        localStorage.setItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT2', -1);
                        localStorage.setItem('AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT', localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT'));
                        localStorage.setItem('AVE_LAST_BACKGROUND_SCAN_STAGE', localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE'));
                        localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', 0);
                        localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', 0);
                    } else {
                        localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
                    }
                }

                let TimeWaitingMS = Date.now() - (localStorage.getItem('AVE_BACKGROUND_SCAN_LAST_TIME') || 0);
                let TimeWaitingMin = TimeWaitingMS / 1000 / 60;

                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): TimeWaitingMin ', TimeWaitingMin);

                let _backGroundScanStage

                //Nach 10 Stunden wird neu gestartet
                if(TimeWaitingMin > 600) {
                    _backGroundScanStage = 0;
                    _subStage = 0;
                    localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', Date.now());
                    localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
                } else {
                    _backGroundScanStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE')) || 0;
                    _subStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT')) || 0;
                }

                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): loop with _backgroundScanStage ', _backGroundScanStage, ' and Substage: ', _subStage);

                let _scannerName;
                if (localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true') {
                    _scannerName = 'Fast Scanner';
                } else {
                    _scannerName = 'Background Scanner';
                }

                // Create iFrame if not exists
                if (!document.querySelector('#ave-iframe-backgroundloader')) {
                    // Create iFrame only if scan is running
                    if (!(_backGroundScanStage == 4)) {
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): create iFrame');
                        const iframe = document.createElement('iframe');
                        iframe.id = 'ave-iframe-backgroundloader';
                        iframe.style.position = 'fixed';
                        iframe.style.top = '0';
                        iframe.style.left = '-10000';
                        iframe.style.width = '100%';
                        iframe.style.height = '100%';
                        iframe.style.display = 'none';
                        iframe.style.zIndex = '100';
                        document.body.appendChild(iframe);
                    }
                }

                switch (_backGroundScanStage) {
                    case 0:{ // potluck, last_chance
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage);
                        if (_stageZeroSites[_subStage]) {
                            updateBackgroundScanScreenText(`${_scannerName} ${_stageZeroSites[_subStage].replace('queue=', '')} Page: ${_subStage + 1} / ${_PageMax}`);
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage, ' inside IF');
                            backGroundTileScanner(`${_baseUrl}?${_stageZeroSites[_subStage]}` , (newCount) => {_scanFinished(newCount)});
                            _subStage++
                        } else {
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage, ' inside ELSE');
                            _subStage = 0;
                            _backGroundScanStage++;
                            _scanFinished();
                        }
                        break;
                    }
                    case 1: { // queue=encore | queue=encore&pn=&cn=&page=2...x
                        _subStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT')) || 0;
                        
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 update PAGE_MAX');

                        let _pagedate = getPageinationData(document.querySelector('#ave-iframe-backgroundloader').contentWindow.document);
                        if (_pagedate) {
                            _PageMax = _pagedate.maxPage;
                            localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_MAX', _PageMax);
                        }
                        else {
                            _PageMax = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX')) || 0;
                        }

                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 with _subStage: ', _subStage);

                        //Wenn die maximale Seitenzahl nicht erreicht ist, wird gescannt
                        if (_subStage < _PageMax) {
                            updateBackgroundScanScreenText(`${_scannerName} encore Page: ${_subStage + 1} / ${_PageMax}`);
                            backGroundTileScanner(`${_baseUrl}?queue=encore&pn=&cn=&page=${_subStage + 1}` , (newCount) => {_scanFinished(newCount)});
                            _subStage++
                            localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                        } else {
                            localStorage.setItem('AVE_BACKGROUND_SCAN_LAST_TIME', Date.now());
                            _subStage = 0;
                            _backGroundScanStage++;
                            _scanFinished();
                        }
                        break;
                    }
                    case 2: { // qerry about other values (tax, real prize, ....) ~ 20 - 30 Products then loopover to stage 1

                        //Disaled due to Bugs fetching the Tax
                        _backGroundScanStage++;
                        _scanFinished();
                        break;

                        // if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.2 with _subStage: ', _subStage);
                        // database.getAll().then((products) => {
                        //     const _needUpdate = [];
                        //     const _randCount = Math.round(Math.random() * 4);
                        //     for (const _prod of products) {
                        //         if (_needUpdate.length < _randCount) {
                        //             if (typeof(_prod.data_estimated_tax_prize) != 'number') _needUpdate.push(_prod);
                        //         } else {
                        //             break;
                        //         }
                        //     }

                        //     const _promises = [];

                        //     for (const _prod of _needUpdate) {
                        //         requestProductDetails(_prod).then((_newProd) => {
                        //             _promises.push(database.update(_newProd));
                        //         });
                        //     }

                        //     Promise.all(_promises).then(() => {
                        //         _scanFinished();
                        //         _subStage++;
                        //     }).catch(() => {
                        //         console.error('There was an error while updating an product in database');
                        //         _scanFinished();
                        //         _subStage++;
                        //     });
                        // });

                        // if (_subStage++ >= 10)
                        // {
                        //     _subStage = 0;
                        //     _backGroundScanStage++;
                        //     _scanFinished();
                        // }
                        // break;
                    }
                    case 3: {
                        cleanUpDatabase();
                        _backGroundScanStage++;
                        _scanFinished();
                        break;
                    }
                    case 4: {
                        updateBackgroundScanScreenText(`${_scannerName} Time Waiting: ${_timeConversion(SETTINGS.IdlePeriodAfterScan * 60 * 1000 - TimeWaitingMS)}`);

                        if(TimeWaitingMin > SETTINGS.IdlePeriodAfterScan)
                        {
                            _backGroundScanStage = 0;
                            _subStage = 0;
                        }
                        _scanFinished();
                        break;
                    }
                }

                function _scanFinished(newCount) {
                    if (SETTINGS.DebugLevel > 10) console.log(`initBackgroundScan()._scanFinished(): newCount=${newCount} _backGroundScanStage=${_backGroundScanStage} _subStage=${_subStage} AVE_FAST_SCAN_IS_RUNNING=${localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING')}`);
                    localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', _backGroundScanStage);
                    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                    _loopIsWorking = false;

                    if (localStorage.getItem('AVE_FAST_SCAN_IS_RUNNING') == 'true') {
                        let _stopFastScan = false;

                        const _backGroundScanStage = localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE') || 0;
                        const _lastBackGroundScanStage = localStorage.getItem('AVE_LAST_BACKGROUND_SCAN_STAGE') || 0;
                        const _lastScanPageCurrent = localStorage.getItem('AVE_LAST_BACKGROUND_SCAN_PAGE_CURRENT') || 0;
                        const _scanPageCurrent = localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT') || 0;
                        if (_backGroundScanStage > 1) {
                            _stopFastScan = true;
                        }
                        if (_backGroundScanStage > 0 && newCount === 0 && localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT1') == 0 && localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT2') == 0) {
                            _stopFastScan = true;
                        }
                        if (_backGroundScanStage == 1 && _lastBackGroundScanStage == 1 && _scanPageCurrent > 0 && _scanPageCurrent >= _lastScanPageCurrent) {
                            _stopFastScan = true;
                        }

                        if(_backGroundScanStage > 0 && newCount >= 0) {
                            localStorage.setItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT2', localStorage.getItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT1'));
                            localStorage.setItem('AVE_FAST_SCAN_PREVIOUS_NEW_COUNT1', newCount);
                        }

                        if (_stopFastScan) {
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): stopping fast scan');
                            localStorage.setItem('AVE_FAST_SCAN_IS_RUNNING', false);
                            localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _lastScanPageCurrent);
                            localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', _lastBackGroundScanStage);
                            localStorage.setItem('AVE_FAST_SCAN_LAST_TIME', Date.now());
                        }
                    }

                    let delay = SETTINGS.BackGroundScanDelayPerPage + Math.round(Math.random() * SETTINGS.BackGroundScannerRandomness)
                    let timeElapsed = performance.now() - startTime;
                    if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): Scantime: ', timeElapsed, ' Delay: ', delay);

                    backGroundScanTimeout = setTimeout(initBackgroundScanSubFunctionScannerLoop, delay);
                }

                function _timeConversion(duration) {
                    const portions = [];

                    const msInHour = 1000 * 60 * 60;
                    const hours = Math.trunc(duration / msInHour);
                    if (hours > 0) {
                        portions.push(hours + 'h');
                        duration = duration - (hours * msInHour);
                    }

                    const msInMinute = 1000 * 60;
                    const minutes = Math.trunc(duration / msInMinute);
                    if (minutes > 0) {
                        portions.push(minutes + 'm');
                        duration = duration - (minutes * msInMinute);
                    }

                    const seconds = Math.trunc(duration / 1000);
                    if (seconds > 0) {
                        portions.push(seconds + 's');
                    }

                    return portions.join(' ');
                }
            }
        }
    }, 250); //scan every 250ms
}

function backGroundTileScanner(url, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called backgroundTileScanner(${url})`);
    const _iconLoading = addLoadingSymbol();
    const _iframeDoc = document.querySelector('#ave-iframe-backgroundloader').contentWindow.document;
    ave.backGroundIFrame = _iframeDoc;
    _iframeDoc.location.href = url;
    const _loopDelay = setInterval(() => {
        if (SETTINGS.DebugLevel > 10) console.log(`backgroundTileScanner(): check if we have tiles to read...`);
        const _tiles =_iframeDoc.querySelectorAll('.vvp-item-tile');
        if (_tiles) {
            if (SETTINGS.DebugLevel > 10) console.log(`backgroundTileScanner(): Found first Tile`);
            const _tilesLength = _tiles.length;
            if (SETTINGS.DebugLevel > 10) console.log(`BackgroundsScan Querryd: ${url} and got ${_tilesLength} Tiles`);
            clearInterval(_loopDelay);
            if (_tilesLength > 0) {
                let _newCount = 0;
                let _returned = 0;
                const _tilesProm = []
                for (let i = 0; i < _tilesLength; i++) {
                    _tilesProm.push(parseTileData(_tiles[i]).then((prod) => {
                        _returned++;
                        if (SETTINGS.DebugLevel > 14) console.log(`BACKGROUNDSCAN => Got TileData Back: Tile ${_returned}/${_tilesLength} =>`, prod);
                        if (!prod.gotFromDB) {
                            ++_newCount;
                            database.add(prod);
                        }
                    }))
                }

                Promise.allSettled(_tilesProm).then(() => {
                    cb(_newCount);
                    _iconLoading.remove();
                });
            } else {
                if (SETTINGS.DebugLevel > 10) console.log(`BACKGROUNDSCAN => We dont have anything to do here anything => resume autoscan`);
                cb(); // We dont have to do here anything
                _iconLoading.remove();
            }
        }
    }, 100);
}

function showBackgroundScanScreen(text) {

    const _text = document.createElement('div');
    _text.style.position = 'fixed';
    _text.style.bottom = '35px';
    _text.style.left = '35px';
    _text.style.color = 'orange'; // Textfarbe
    _text.style.textAlign = 'center';
    _text.style.fontSize = '10px'; // Ändere die Schriftgröße hier
    _text.style.lineHeight = "1";
    _text.style.zIndex = '9999';
    _text.innerHTML = `<p id="ave-backgroundscan-text">${text}</p>`;

    document.body.appendChild(_text);
}

function updateBackgroundScanScreenText(text = '') {
    const _elem = document.getElementById('ave-backgroundscan-text');
    _elem.textContent = text;
}

function startAutoScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called startAutoScan()');
    showAutoScanScreen('Init Autoscan, please wait...');
    markAllCurrentDatabaseProductsAsSeen(() => {
        if (SETTINGS.DebugLevel > 10) console.log('startAutoScan() - Got Callback from markAllCurrentDatabaseProductsAsSeen()');
        const _pageiDat = getPageinationData();
        localStorage.setItem('AVE_INIT_AUTO_SCAN', false);
        localStorage.setItem('AVE_AUTO_SCAN_IS_RUNNING', true);
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_MAX',_pageiDat.maxPage);
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', 1);
        setTimeout(() => {
            const _url = `${_pageiDat.href}1`;
            if (SETTINGS.DebugLevel > 10) console.log(`Loding new Page ${_url}`)
            window.location.href = _url;
        }, 5000);
    })
}

function handleAutoScan() {
    let _href;
    const _delay = Math.max(SETTINGS.PageLoadMinDelay - (Date.now() - PAGE_LOAD_TIMESTAMP), 0) + 500;
    if (SETTINGS.DebugLevel > 10) console.log(`handleAutoScan() - _delay: ${_delay}`);
    if (AUTO_SCAN_PAGE_CURRENT < AUTO_SCAN_PAGE_MAX) {
        const _nextPage = AUTO_SCAN_PAGE_CURRENT + 1;
        localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', _nextPage);
        setTimeout(() => {
            window.location.href = window.location.href.replace(/=[0-9]+/, `=${_nextPage}`);
        }, _delay);
    } else { // We are done ;)
        updateAutoScanScreenText('Success, cleaning up Database...');
        cleanUpDatabase(()=> {
            localStorage.setItem('AVE_AUTO_SCAN_IS_RUNNING', false);
            localStorage.setItem('AVE_AUTO_SCAN_PAGE_MAX', -1);
            localStorage.setItem('AVE_AUTO_SCAN_PAGE_CURRENT', -1);
            setTimeout(() => {
                updateAutoScanScreenText('Finished Database\nupdate and cleanup\n\nPage reloading incoming... please wait');
                setTimeout(()=> {
                    window.location.href = window.location.href.replace(/=[0-9]+/, '=1');
                }, 10000);
            }, _delay + 2000);
        });
    }
}

function stickElementToTopScrollEVhandler(elemID, dist) {
    const _elem = document.getElementById(elemID);
    if (_elem) {
        const maxScrollHeight = Math.max(
            document.body.scrollHeight - window.innerHeight,
            document.documentElement.scrollHeight - window.innerHeight
        );

        requestAnimationFrame(() => {
            const _elemRect = _elem.getBoundingClientRect();

            const _elemInitialTop = parseInt(_elem.getAttribute('ave-data-default-top'));
            if (!_elemInitialTop) {_elem.setAttribute('ave-data-default-top', (window.scrollY + _elemRect.top)); return;}

            if (SETTINGS.DebugLevel > 10) console.log(`### scrollY:${window.scrollY} maxScrollHeigt ${maxScrollHeight} initialTop: ${_elemInitialTop}`);

            if (window.scrollY >= (_elemInitialTop - parseInt(dist))) {
                _elem.style.position = "fixed";
                _elem.style.top = dist;
            } else {
                _elem.style.position = "static";
            }
        })
    }
}

let lastDesktopNotifikationTimestamp = 0;

function updateNewProductsBtn() {
    if (AUTO_SCAN_IS_RUNNING) return;
    if (SETTINGS.DebugLevel > 1) console.log('Called updateNewProductsBtn()');
    database.getNewEntries().then((prodArr) => {
        const _btnBadge = document.getElementById('ave-new-items-btn-badge');
        const _pageTitle = document.title.replace(/^[^|]*\|/, '').trim();
        const _prodArrLength = prodArr.length;
        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Got Database Response: ${_prodArrLength} New Items`);

        if (_prodArrLength > 0) {
            _btnBadge.style.display = 'inline-block';
            _btnBadge.innerText = _prodArrLength;
            document.title = `${_prodArrLength} | ${_pageTitle}`;
        } else {
            _btnBadge.style.display = 'none';
            _btnBadge.innerText = '';
            document.title = `${_pageTitle}`;
        }

        let _notifyed = false;
        if (SETTINGS.EnableDesktopNotifikation && SETTINGS.DesktopNotifikationKeywords?.length > 0) {

            if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Inside IF`);

            const _configKeyWords = SETTINGS.DesktopNotifikationKeywords;

            // see https://stackoverflow.com/questions/874709/converting-user-input-string-to-regular-expression
            var stringToRegex = (s, m) => ((m = s.match(/^\/(.*?)\/([gimsuy]*)$/))) ? new RegExp(m[1], m[2].split('').filter((i, p, s) => s.indexOf(i) === p).join('')) : undefined;

            for (let i = 0; i < _prodArrLength; i++) {
                const _prod = prodArr[i];
                const _descFull = _prod.description_full.toLowerCase();

                if (_prod.isNotified){
                    if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Skipping Product which was already notified: ${_descFull}`);
                    continue;
                }

                if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Description: ${_descFull} for keys: `, _configKeyWords);
                const _configkeyWordsLength = _configKeyWords.length;

                for (let j = 0; j < _configkeyWordsLength; j++) {
                    const _currKey = _configKeyWords[j].toLowerCase();
                    let _keyFound = false;
                    const _regExp = stringToRegex(_currKey);
                    if (_regExp !== undefined) {
                        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Description for Regular Expression: ${_regExp}`);
                       _keyFound = _regExp.test(_descFull);
                    }
                    else {
                        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Description for Keyword: ${_currKey}`);
                        _keyFound = _descFull.includes(_currKey);
                    }
                    if (_keyFound) {
                        desktopNotifikation(`Amazon Vine Explorer - ${AVE_VERSION}`, _prod.description_full, _prod.data_img_url, true, function(event) {
                            event.preventDefault();
                            window.open(window.location.origin + _prod.link, '_blank');
                          });
                        _notifyed = true;
                        _prod.isNotified = true;
                        database.update(_prod);
                        break;
                    }
                }
            }
        }
        if (SETTINGS.EnableDesktopNotifikation && SETTINGS.DesktopNotifikationDelay > 0 && !_notifyed && _prodArrLength > oldCountOfNewItems){
            if (unixTimeStamp() - lastDesktopNotifikationTimestamp >= SETTINGS.DesktopNotifikationDelay) {
                oldCountOfNewItems = _prodArrLength;
                lastDesktopNotifikationTimestamp = unixTimeStamp();

                desktopNotifikation(`Amazon Vine Explorer - ${AVE_VERSION}` , `Es wurden ${_prodArrLength} neue Vine Produkte gefunden`);
            }
        }
    })
}

/**
 * Send a Desktop Notifikation
 * @param {string} title
 * @param {string} message
 * @param {string} icon
 *
 */
function desktopNotifikation(title, message, image = null, requireInteraction = null, onClick = () => {}) {
    const _vineLogo = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/vine_logo.png';
    const _vineLogoImp = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/vine_logo_important.png'
    const _defaultImage = 'https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/dev-main/vine_logo_notification_image.png'

    if (Notification.permission === 'granted') {
        const _notification = new Notification(title, {
            body: message,
            icon: (!requireInteraction) ? _vineLogo : _vineLogoImp,
            image: image || _defaultImage,
            tag: (requireInteraction) ? `ave-notify-${Math.round(Math.random()* 10000000)}`: 'ave-notify',
            requireInteraction: requireInteraction,
        });

        _notification.onclick = onClick;
    } else {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                console.log('Berechtigung für Benachrichtigungen erhalten!');
                desktopNotifikation(title, message, icon, onclick);
            }
        });
    }
}

function createNavButton(mainID, text, textID, color, onclick, badgeId, badgeValue) {
    const _btn = document.createElement('span');
    _btn.setAttribute('id', mainID);
    _btn.setAttribute('class', 'a-button a-button-normal a-button-toggle vvp-items-button');
    _btn.addEventListener('click', onclick);

    const _btnInner = document.createElement('span');
    _btnInner.classList.add('a-button-inner');
    _btnInner.style.backgroundColor = color;
    _btnInner.style.display = 'flex';
    _btn.append(_btnInner);

    const _btnInnerText = document.createElement('span');
    _btnInnerText.setAttribute('id', textID);
    _btnInnerText.classList.add('a-button-text');
    _btnInnerText.innerText = text;
    _btnInner.append(_btnInnerText);

    if (badgeId) {
        const _btnInnerBadge = document.createElement('span');
        _btnInnerBadge.setAttribute('id', badgeId)
        _btnInnerBadge.setAttribute('class', 'a-button-text')
        _btnInnerBadge.style.backgroundColor = 'red';
        _btnInnerBadge.style.color = 'white';
        _btnInnerBadge.style.display = 'inline-block';
        _btnInnerBadge.style.textAlign = 'center';
        // _btnInnerBadge.style.transform = 'translate(-75%, -100%)';
        _btnInnerBadge.style.zIndex = '50';
        _btnInnerBadge.style.position = 'relativ';
        // _btnInnerBadge.style.padding = '5px';

        _btnInnerBadge.innerText = badgeValue;
        _btnInner.append(_btnInnerBadge);
    }

    return _btn;
}

function addStyleToTile(_currTile, _product) {

    if (!_product.gotFromDB) { // We have a new one ==> Save it to our Database ;)
        database.add(_product);
        _currTile.style.cssText = SETTINGS.CssProductSaved;
        _currTile.classList.add('ave-element-saved');
    } else {
        let _style = SETTINGS.CssProductDefault;
        if(_product.isNew) {
            _style = SETTINGS.CssProductNewTag;
            _currTile.classList.add('ave-element-new');
        }
        if(_product.isFav) {
            _style = SETTINGS.CssProductFavTag;
            _currTile.classList.add('ave-element-fav');
        }
        _currTile.style.cssText = _style;

        // Update Timestamps
    }
    _currTile.prepend(createFavStarElement(_product));
    _currTile.prepend(createFirstSeenElement(_product));
    _currTile.prepend(createShareElement(_product));
    // insertHtmlElementAfter((_currTile.getElementsByClassName('vvp-item-product-title-container')[0]), createTaxInfoElement(_product));
    waitForHtmlElmement('.vvp-item-product-title-container', (_elem) => {
        insertHtmlElementAfter(_elem, createTaxInfoElement(_product));
    }, _currTile)

}

async function requestProductDetails(prod) {
    return new Promise(async (resolve, reject) => {
        if (prod.data_asin_is_parent) {// Lets get the Childs first
            fetch(`${window.location.origin}/vine/api/recommendations/${prod.id}`.replace(/#/g, '%23')).then(r => r.json()).then(async (res) => {
                if (res.error) {
                    if (res.error.exceptionType == 'ITEM_NOT_IN_ENROLLMENT') {
                        prod.forceRemove = true;
                        resolve(prod);
                    } else {
                        console.error('requestProductDetails():ERROR:', res.error);
                        reject(res.error.exceptionType);
                    }
                }
                const _data = res.result;
                if (SETTINGS.DebugLevel > 1) console.log('DATA:', _data)
                prod.data_childs = _data.variations || [];
                resolve(prod);
                //
                // avoid getting temporarily blocked
                // thank you Olum-hack
                //
                // const _promArray = new Array();
                // prod.data_estimated_tax_prize = prod.data_estimated_tax_prize || 0;
                // for (const _child of prod.data_childs) {
                //     _promArray.push(fetch(`${window.location.origin}/vine/api/recommendations/${(prod.id).replace(/#/g, '%23')}/item/${_child.asin}`.replace(/#/g, '%23')).then(r => r.json()).then((childData) => {
                //         console.log('CHILD_DATA:', childData);
                //         if (!childData.error) {

                //             // Copy over all returned datapoints od child asin
                //             for (const _datapoint of Object.keys(childData.result)) {
                //                 _child[_datapoint] = childData.result[_datapoint];
                //             }

                //             if (prod.data_estimated_tax_prize < _child.taxValue) {
                //                 prod.data_estimated_tax_prize = _child.taxValue;
                //                 prod.data_tax_currency = _child.taxCurrency;
                //             }
                //         }
                //     }))
                // }
                // Promise.all(_promArray).then((values) => {
                //     console.log('All fetches returned: ', values);
                //     resolve(prod);
                // });
            })
        } else {
            fetch(`${window.location.origin}/vine/api/recommendations/${prod.id}/item/${prod.data_asin}`.replace(/#/g, '%23')).then(r => r.json()).then(ret => {
                if (SETTINGS.DebugLevel > 1) console.log('RETURN:', ret);
                if (ret.error) {
                    reject(ret.error.exceptionType) // => "ITEM_NOT_IN_ENROLLMENT"
                } else {
                    const data = ret.result;
                    prod.data_feature_bullets = data.featureBullets;
                    prod.data_contributors = data.byLineContributors;
                    prod.data_catalogSize = data.catalogSize;
                    prod.data_tax_currency = data.taxCurrency;
                    prod.data_estimated_tax_prize = data.taxValue;
                    prod.data_limited_quantity = data.limitedQuantity;
                    resolve(prod);
                }
            })
        }
    })
}

function init(hasTiles) {
    // Get all Products on this page ;)

    if (AUTO_SCAN_IS_RUNNING) showAutoScanScreen(`Autoscan is running...Page (${AUTO_SCAN_PAGE_CURRENT}/${AUTO_SCAN_PAGE_MAX})`);

    const _aveSubpageRequest = getUrlParameter('ave-subpage');
    if (SETTINGS.DebugLevel > 10) console.log(`Got Subpage Parameter`, _aveSubpageRequest)

    if (_aveSubpageRequest) createNewSite(parseInt(_aveSubpageRequest));

    if (hasTiles) {
        const _tiles = document.getElementsByClassName('vvp-item-tile');

        const _tilesLength = _tiles.length;
        const _tilePorms = [];
        const _parseStartTime = Date.now();
        for (let i = 0; i < _tilesLength; i++) {
            const _currTile = _tiles[i];
            _currTile.style.cssText = "background-color: yellow;";
            _tilePorms.push(parseTileData(_currTile).then((_product) => {
                if (SETTINGS.DebugLevel > 14) console.log('Come Back from parseTileData <<<<<<<<<< INIT <<<<<<<<<<<<<<<<<<<<<<<', _currTile, _product);
                addStyleToTile(_currTile, _product);

            }));
        }
        Promise.allSettled(_tilePorms).then(() => {
            if(INIT_AUTO_SCAN) {
                startAutoScan();
            } else if (AUTO_SCAN_IS_RUNNING) {
                handleAutoScan();
            } else {
                completeDelayedInit();
            }
        })
    } else {
        if (SETTINGS.DebugLevel > 10) console.log(`init(): NO TILES TO PARSE ON THIS SITE => SKIP`);
    }

    if (AUTO_SCAN_IS_RUNNING) return;

    const _searchbarContainer = document.getElementById('vvp-items-button-container');

    _searchbarContainer.appendChild(createNavButton('ave-btn-favorites', 'Alle Produkte', '', SETTINGS.BtnColorAllProducts, () => {createNewSite(PAGETYPE.ALL);}));
    _searchbarContainer.appendChild(createNavButton('ave-btn-favorites', 'Favoriten', '', SETTINGS.BtnColorFavorites, () => {createNewSite(PAGETYPE.FAVORITES);}));
    _searchbarContainer.appendChild(createNavButton('ave-btn-list-new', 'Neue Einträge', 'ave-new-items-btn', SETTINGS.BtnColorNewProducts, () => {createNewSite(PAGETYPE.NEW_ITEMS);}, 'ave-new-items-btn-badge', '-'));

    updateNewProductsBtn();

    // Searchbar
    const _searchBarSpan = document.createElement('span');
    _searchBarSpan.setAttribute('class', 'ave-search-container');
    _searchBarSpan.style.cssText = `margin-left: 0.5em;`;
    // _searchBarSpan.innerHTML = `<input type="text" style="width: 30em;" placeholder="Suche Vine Produkte" name="ave-search">`;

    const _searchBarInput = document.createElement('input');
    _searchBarInput.setAttribute('type', 'search');
    _searchBarInput.setAttribute('placeholder', 'Suche Vine Produkte');
    _searchBarInput.setAttribute('name', 'ave-search');
    _searchBarInput.style.cssText = `width: 15em;`;
    _searchBarInput.addEventListener('keyup', (ev) => {
        const _input = _searchBarInput.value.toLowerCase();
        if (SETTINGS.DebugLevel > 10) console.log(`Updated Input: ${_input}`);
        if (_input.length >= 2) {
            if (searchInputTimeout) clearTimeout(searchInputTimeout);
            searchInputTimeout = setTimeout(() => {
                database.query(_input.split(' ')).then((_objArr) => {
                    if (SETTINGS.DebugLevel > 10) console.log(`Found ${_objArr.length} Items with this Search`);
                    createNewSite(PAGETYPE.SEARCH_RESULT, _objArr);
                    searchInputTimeout = null;
                })
            }, ev.key === 'Enter' ? 1 : SETTINGS.SearchBarInputDelay);
        }
    });

    _searchBarSpan.appendChild(_searchBarInput);
    _searchbarContainer.appendChild(_searchBarSpan);

    // Deactivatet due to Bugs
    // Manual Autoscan and Backgroundscan can not run together, so don´t create the button
    //if (!SETTINGS.EnableBackgroundScan) _searchbarContainer.appendChild(createNavButton('ave-btn-updateDB', 'Update Database', 'ave-btn-updateDB-text',SETTINGS.BtnColorUpdateDB, () => {localStorage.setItem('AVE_INIT_AUTO_SCAN', true); window.location.href = "vine-items?queue=encore";}));

    if (hasTiles) addLeftSideButtons();

    if (SETTINGS.EnableBackgroundScan) initBackgroundScan();

    // Modify Pageination if exists
    const _pageinationContainer = document.getElementsByClassName('a-pagination')[0];
    if (_pageinationContainer) {
        if (SETTINGS.DebugLevel > 10) console.log('Manipulating Pageination');

        const _nextBtn = _pageinationContainer.lastChild;
        const _isNextBtnDisabled = _nextBtn.classList.contains('a-disabled');
        const _nextBtnLink = _nextBtn.lastChild.getAttribute('href');
        const _btn = _nextBtn.cloneNode(true);
        const anchorTag = _btn.querySelector('a');

        //const _aveNextPageButtonText = 'Alle als gesehen markieren und Nächste <span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';
        const _aveNextPageButtonText = 'Gelesen <span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';

        const _AveNextArrow = document.createElement('style');
        _AveNextArrow.type = 'text/css';
        _AveNextArrow.innerHTML = `.ave-arrow::after{border-style: solid; border-width: 2px 2px 0 0; content: ''; padding: 2.5px; visibility: visible; display: inline-block; position: relative; left: -9px; top: -1px; transform: rotate(45deg);}`;


        if (!_isNextBtnDisabled) {
            _nextBtn.setAttribute('class', 'a-normal');
            _nextBtn.querySelector('span.larr').style.visibility = 'hidden';
            _nextBtn.querySelector('span.larr').classList.add('ave-arrow');
        }

        if (anchorTag) {
            anchorTag.innerHTML = _aveNextPageButtonText;
        }
        else {
            //_btn.innerHTML = _aveNextPageButtonText;
            _btn.innerHTML = 'Gelesen'
        }

        _btn.style.color = 'unset';
        _btn.style.backgroundColor = 'lime';
        _btn.style.borderRadius = '8px';
        _btn.style.cursor = 'pointer';

        _btn.addEventListener('click', () => {
            markAllCurrentSiteProductsAsSeen(() => {
                if(!_nextBtn.classList.contains('a-disabled')){
                    window.location.href = (_nextBtnLink);
                }
            });
        })

        _pageinationContainer.appendChild(_btn);
        _pageinationContainer.appendChild(_AveNextArrow);
    }
}

//Sort Items by key
function sort_by_key(array, key, order)
{
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        const multiplier = order === "asc" ? 1 : -1;
        return ((x < y) ? -1 : ((x > y) ? 1 : 0))*multiplier;
    });
}