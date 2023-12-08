// ==UserScript==
// @name         Amazon Vine Explorer
// @namespace    http://tampermonkey.net/
// @version      0.9.0.3
// @updateURL    https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js
// @downloadURL  https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js
// @description  Better View, Search and Explore for Amazon Vine Products - Vine Voices Edition
// @author       MarkusSR1984, Christof121
// @match        *://www.amazon.de/*
// @match        *://www.amazon.com/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/vine_logo.png
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/globals.js
// @require      https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/class_db_handler.js
// @require      https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/class_product.js

// ==/UserScript==

/* 
    Versioning: 
    a.b.c[.d]

    a => Hauptversion(Major), änerdt sich nur bei breaking oder anderen gravirenden änderungen. Solle In diesem Fall also die 1 nie überschreiten.
    b => Feature(Minor), ändert sich nur wenn neue Features hinzukommen oder gößere umstellungen im Hintergrund passiert sind
    c => Patch, kleinere Änderungen oder "größere" Bugfixes
    d => Micro(OPTIONAL), kleine Bugfixes die nur wenige Zeilen Code beinhalten. Wird normalerweise nicht an die Versionnummer angehängt und nur in ausnahmefällen verwendet. Wie z.B. 0.6.4.1 - Das war nur eine Fehlerhafte Variablendeklaration. musste aber public gehen weil es ein Breaking Bug war



    Sammlung der Ideen:
    - Datenbank Import und Export, Idee von "Finding_Won_Ton_Chin" - MyDeals
    - Pageination nach oben schieben || Kopieren
    - Tooltipp mit der langen Beschreibung auf der kurzen
    - Bestellte Produkte mit Tag versehen ?
    - Verstecken des Footers und der Producktvorschläge am Unteren Rand der Seite
    - Automatisches Bestellen via Prioliste ?!?

    Todo:

    - Zum Löschen markierten Produkten die Information hinzufügen wann sie gelöscht werden

    - Zu den TOP Buttons die Anzahl der Elemente in der jeweiligen Kategorie hinzufügen
    - Reload der Neue Produkte Seite nach einem Click auf "Alle als gesehen Markieren"

    - Originale Pagination auf den eigenen Seiten verstecken
    - Last Seen Update 
    - Changelog hinzufügen
*/

'use strict';
console.log(`Init Vine Voices Explorer ${AVE_VERSION}`);

/**
 * On witch page are we atm ? PAGETYPE
 */
let currentMainPage;

loadSettings();
fastStyleChanges();

let searchInputTimeout;
let backGroundScanTimeout;

let TimeouteScrollTilesBufferArray = [];

// Make some things accessable from console
unsafeWindow.ave = {
    classes: [
        DB_HANDLER = DB_HANDLER
    ],
    config: SETTINGS,
    event: ave_eventhandler,
};


const database = new DB_HANDLER(DATABASE_NAME, DATABASE_OBJECT_STORE_NAME, DATABASE_VERSION, (res, err) => {
    if (err) {
        console.error(`Somithing was going wrong while init database :'(`);
        return;
    } else {
        let _execLock = false;
        console.log('Lets Check where we are....');
        if (SITE_IS_VINE){
            console.log('We are on Amazon Vine'); // We are on the amazon vine site
            addAveSettingsTab();
            addAVESettingsMenu();
            waitForHtmlElmement('.vvp-details-btn', () => {
                if (_execLock) return;
                _execLock = true;
                addBranding();
                detectCurrentPageType();

                let _tileCount = 0;
                const _initialWaitForAllTiles = setInterval(() => {
                    const _count = document.getElementsByClassName('vvp-details-btn').length // Buttons take a bit more time as tiles
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
                addBranding();
                init(false);
            });
        } else if (SITE_IS_SHOPPING) {
            console.log('We are on Amazon Shopping'); // We are on normal amazon shopping - maybe i hve forgotten any other site then we have to add it as not here
            _execLock = true;
            addBranding(); // For now, olny show that the script is active
        }
    }
});

unsafeWindow.ave.database = database;

let oldCountOfNewItems = 0;

let showDbUpdateLogoTimeout = null;
let showDbUpdateLogoIcon = null;

ave_eventhandler.on('ave-database-changed', () => {
    console.warn('EVENT - Database has new Data for us! we should look what has changed');
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
    stickElementToTopScrollEVhandler('ave-btn-allseen', '5px');
    stickElementToTopScrollEVhandler('ave-btn-db-allseen', '40px');
    stickElementToTopScrollEVhandler('ave-btn-backtotop', '75px');

    if (currentMainPage == PAGETYPE.ALL) handleInfiniteScroll();


};

let blockHandleInfiniteScroll = false;
let infiniteScrollLastPreloadedPage = 1;
let infiniteScrollMaxPreloadPage = 125; // Hardcoded for scrolltest, must lated get extracted from Pagination
let inifiniteScrollBlockAppend = false;
let infiniteScrollTilesBufferArray = [];

function handleInfiniteScroll() {
    console.log('Called handleInfiniteScroll()');
    if (!inifiniteScrollBlockAppend) {
        inifiniteScrollBlockAppend = true;
        // setTimeout(async ()=> {},10);
        appendInfiniteScrollTiles(()=>{inifiniteScrollBlockAppend = false;})
    }

    if (SETTINGS.EnableInfiniteScrollLiveQuerry) {
        if (blockHandleInfiniteScroll) return;
        blockHandleInfiniteScroll = true;

        const _maxScrollHeight = Math.max(document.body.scrollHeight - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight);

        console.log(`handleInfiniteScroll(): _maxScrollHeight: ${_maxScrollHeight} window.scrollY+inner: ${window.scrollY + window.innerHeight}`);

        if (_maxScrollHeight > (window.scrollY + (window.innerHeight * 2))){
            blockHandleInfiniteScroll = false;  
            return;
        } else if (infiniteScrollTilesBufferArray.length < 1000 && infiniteScrollLastPreloadedPage < infiniteScrollMaxPreloadPage) {
            const _baseUrl = (/(http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\/vine-items)/.exec(window.location.href))[1];
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
    if (/http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\/vine-items$/.test(window.location.href)) {
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
    return new Promise((resolve, reject) => {
                if (SETTINGS.DebugLevel > 5) console.log(`Called parseTileData(`, tile, ')');

        const _id = tile.getAttribute('data-recommendation-id');

        database.get(_id).then((_ret) => {
            if (_ret) {
                _ret.gotFromDB = true;
                _ret.ts_lastSeen = unixTimeStamp();
                if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): got DB Entry`);
                resolve(_ret);
            } else {
                //We have to wait for a lot of Stuff
                waitForHtmlElmement('.vvp-item-tile-content',async () => {
                    const _div_vpp_item_tile_content  = tile.getElementsByClassName('vvp-item-tile-content')[0];
                    if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 1`);
                    waitForHtmlElmement('img', async () => {
                        const _div_vpp_item_tile_content_img = _div_vpp_item_tile_content.getElementsByTagName('img')[0];
                        if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 2`);
                        waitForHtmlElmement('.vvp-item-product-title-container', async () => {
                            const _div_vvp_item_product_title_container = _div_vpp_item_tile_content.getElementsByClassName('vvp-item-product-title-container')[0];
                            if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 3`);
                            waitForHtmlElmement('a', async () => {
                                const _div_vvp_item_product_title_container_a = _div_vvp_item_product_title_container.getElementsByTagName('a')[0];
                                if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 4`);
                                waitForHtmlElmement('.a-button-inner', async () => {
                                    const _div_vpp_item_tile_content_button_inner = _div_vpp_item_tile_content.getElementsByClassName('a-button-inner')[0];
                                    if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): wait 5`);
                                    waitForHtmlElmement('input', async () => {
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

                                        _newProduct.description_short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;


                                        if (_newProduct.description_short == '') {
                                            if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): we don´t have a shot description`);
                                            let _timeLoopCounter = 0;
                                            const _maxLoops = Math.round(SETTINGS.FetchRetryMaxTime / SETTINGS.FetchRetryTime);
                                            const _halfdelay = (SETTINGS.FetchRetryTime / 2)
                                            function timeLoop() {
                                                if (_timeLoopCounter++ < _maxLoops){
                                                    setTimeout(() => {
                                                        const _short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;
                                                        if (_short != ""){
                                                            _newProduct.description_short = _short;
                                                            resolve(_newProduct);
                                                        } else {
                                                            timeLoop();
                                                        }
                                                    }, _halfdelay + Math.round(Math.random() * _halfdelay * 2));
                                                } else {
                                                    _newProduct.description_short = `${_newProduct.description_full.substr(0,50)}...`;
                                                    _newProduct.generated_short = true;
                                                    resolve(_newProduct);
                                                }
                                            }
                                            timeLoop();
                                        } else {
                                            if (SETTINGS.DebugLevel > 14) console.log(`parseTileData(): END`);
                                            resolve(_newProduct);
                                        }

                                        // if (SETTINGS.DebugLevel > 10) console.log(`parseTileData(${tile}) RETURNS :: ${JSON.stringify(_newProduct, null, 4)}`);

                                    }, _div_vpp_item_tile_content_button_inner)
                                }, _div_vpp_item_tile_content)
                            }, _div_vvp_item_product_title_container)
                        }, _div_vpp_item_tile_content);
                    }, _div_vpp_item_tile_content);
                }, tile)
            }
        });
    })
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


    _nodesContainer.appendChild(document.createElement('p')); // A bit of Space above our Buttons

    const _setAllSeenBtn = createButton('Aktuelle Seite als gesehen markieren','ave-btn-allseen',  `width: 240px; background-color: ${SETTINGS.BtnColorMarkCurrSiteAsSeen};`, () => {

        if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
        markAllCurrentSiteProductsAsSeen();
    });

    const _setAllSeenDBBtn = createButton('Alle als gesehen markieren','ave-btn-db-allseen', `left: 0; width: 240px; background-color: ${SETTINGS.BtnColorMarkAllAsSeen};`, () => {

        if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
        setTimeout(() => {
            database.getAll().then((prodsArr) => {
                const _prodsArryLength = prodsArr.length;
                for (let i = 0; i < _prodsArryLength; i++) {
                    const _currProd = prodsArr[i];
                    _currProd.isNew = false;
                    database.update(_currProd);
                }
            })
        }, 30);
    });

    const _backToTopBtn = createButton('Zum Seitenanfang','ave-btn-backtotop',  `width: 240px; background-color: ${SETTINGS.BtnColorBackToTop};`, () => {

        if (SETTINGS.DebugLevel > 10) console.log('Clicked back to Top Button');
        window.scrollTo(0, 0);
    });




    _nodesContainer.appendChild(_setAllSeenBtn);
    _nodesContainer.appendChild(_setAllSeenDBBtn);
    _nodesContainer.appendChild(_backToTopBtn);

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
        database.get(_id).then((prod) => {
            prod.isNew = false;
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
            _currProd.isNew = false;
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
                        <input data-asin="${product.data_asin}" data-is-parent-asin="${product.data_asin_is_parent}" data-recommendation-id="${product.data_recommendation_id}" data-recommendation-type="${product.data_recommendation_type}" class="a-button-input" type="submit" aria-labelledby="a-autoid-${_btnAutoID}-announce">
                        <span class="a-button-text" aria-hidden="true" id="a-autoid-${_btnAutoID}-announce">Weitere Details</span>
                    </span>
                </span>
            </div>
        `;
        _tile.prepend(createFavStarElement(product, btnID));
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

async function createProductSite(siteType, productArray, cb) {
    if (!productArray) return;

    const _productArrayLength = productArray.length;
    const _fastCount = Math.min(_productArrayLength, SETTINGS.MaxItemsPerPage);
    if (SETTINGS.DebugLevel > 10) console.log(`Create Overview for ${_productArrayLength} Products`);


    // Remove Pagination
    const _pagination = document.querySelector('.a-pagination')
    if (_pagination) _pagination.remove();

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

async function createInfiniteScrollSite(cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called createInfiniteScrollSite()`);

    // Remove Pagination
    const _pagination = document.querySelector('.a-pagination')
    if (_pagination) _pagination.remove();

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
    console.log('appendInfiniteScrollTiles(): ', infiniteScrollTilesBufferArray);
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

        console.log(`appendInfiniteScrollTiles(): Inside WHILE: _maxScrollHeigt: ${_maxScrollHeight} currPosition ${window.scrollY}`);
    }

    console.log(`appendInfiniteScrollTiles(): After WHILE: left tile to create: ${infiniteScrollTilesBufferArray.length}`);
    cb(true);

    // },100);
}


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
            createInfiniteScrollSite((tilesContainer) => {
                const _baseUrl = (/(http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\/vine-items)/.exec(window.location.href))[1];
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
                console.log('getTileFromURL(): itemsContainer:', itemsContainer);
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

function btnEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called btnEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.get(data.recommendation_id).then(async (prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`btnEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isNew = false;
                requestProductDetails(prod).then((_newProd) => {
                    database.update(_newProd || prod).then( () => {
                        updateTileStyle(prod);
                    });
                })
            }
        })
    }
}

function favStarEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called favStarEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.get(data.recommendation_id).then((prod) => {
            if (SETTINGS.DebugLevel > 10) console.log(`favStarEventhandlerClick() got respose from DB:`, prod);
            if (prod) {
                prod.isFav = !prod.isFav;
                database.update(prod).then(() => {
                    updateTileStyle(prod);
                });
            }
        })
    }
}


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
        addTileEventhandlers(_currTile);
    }        
}

function addTileEventhandlers(_currTile) {
    const _favStar = _currTile.querySelector('.ave-favorite-star');
    const _btn = _currTile.querySelector('.vvp-details-btn input');

    const _data = new Object()
    _data.asin = _btn.getAttribute('data-asin');
    _data.recommendation_id = _btn.getAttribute('data-recommendation-id');


    const _childs = _btn.childNodes;
    _btn.addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});

    for(let j = 0; j < _childs.length; j++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Children ${j} of Tile ${i}`);
        _childs[j].addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});
    }

    waitForHtmlElmement('.ave-favorite-star', (elem) => {
        _favStar.addEventListener('click', (event) => {favStarEventhandlerClick(event, _data)});
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

function addBranding() {

    const _text = document.createElement('div');
    _text.style.position = 'fixed';
    _text.style.bottom = '10px';
    _text.style.left = '10px';
    // _text.style.transform = 'translate(-50%, -50%)';
    _text.style.color = 'blue'; // Textfarbe
    _text.style.backgroundColor = 'rgba(218, 247, 166, .75)';
    _text.style.textAlign = 'left';
    _text.style.fontSize = '20px'; // Ändere die Schriftgröße hier
    _text.style.zIndex = '2000';
    _text.style.borderRadius = '3px';
    _text.innerHTML = `<p id="ave-brandig-text">${AVE_TITLE} - ${AVE_VERSION}</p>`;


    document.body.appendChild(_text);
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
            console.log(_contentContainer);

            _upperSettingsButton.classList.add('a-active');
            const _settingsContent = document.body.querySelector('[data-a-name="ave-settings"]');
            _settingsContent.classList.remove('a-hidden');

            const _settingsContainer = _settingsContent.querySelector('#ave-settings-container');
            console.log(_settingsContainer);
            for (const elem of SETTINGS_USERCONFIG_DEFINES) {
                console.log('Creating Settings Menu Element: ', elem);
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
        console.log(_tabContainer);

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
  border: 1px solid darfgrey;
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
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${dat.description}">${dat.name}</label>`

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
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${dat.description}">${dat.name}</label>`

        _elem.appendChild(_elem_item_right);

    } else if (dat.type == 'button') { // Number Value

        const _elem_item_left = document.createElement('div');
        
        _elem_item_left.classList.add('ave-item-left');


        const _elem_item_left_input_label  = document.createElement('label');
        _elem_item_left_input_label.setAttribute('data-ave-tooltip', dat.description);
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
        _elem_item_right.innerHTML = `<label class="ave-settings-label-setting" data-ave-tooltip="${dat.description}">${dat.name}</label>`

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

        const _elem_keyword_input_input = document.createElement('input');
        _elem_keyword_input_input.setAttribute('type', 'text');
        _elem_keyword_input_input.setAttribute('placeholder', dat.inputPlaceholder);
        _elem_keyword_input_input.addEventListener('change', (elm, ev) => {
            console.log('EVENTHANDLER CHANGE:', elm, 'event:', ev);
            const _value = elm.target.value.trim();
            if (_value && _value.length > 0 && !SETTINGS[dat.key].includes(_value)) SETTINGS[dat.key].push(_value);
            SETTINGS.save();
            elm.target.value = '';
            const _table = document.getElementById(dat.key);
            _table.innerHTML = '';
            for (let i = 0; i < SETTINGS[dat.key].length; i++){
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
        if (true) SETTINGS[dat.key].splice(index, 1);
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
    } else if (_cache = /rgb\(([\d]+),([\d]+),([\d]+)\)/.exec(_color)){ // rgb(0,0,0)
        return rgbToHex(_cache[1], _cache[2], _cache[3]);
    } else if (_cache = /rgba\(([\d]+),([\d]+),([\d]+),([\d]+|[\d]*.[\d]+)\)/.exec(_color)){ // rgba(0,0,0,0)
        return rgbaToHex(_cache[1], _cache[2], _cache[3], _cache[4]);
    } else if (/\#[0-9a-fA-F]{6}|[0-9a-fA-F]{8}$/.exec(_color)){ // #000000
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
        const _curr = _currChild.childNodes[0];

        if (_curr.hasAttribute('href')) _ret.href = _curr.getAttribute('href').replace(/=[0-9]+/, '=');
        if (parseInt(_curr.text)) _ret.maxPage = parseInt(_curr.text);
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
        if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking ${_prodArrLength} Entrys`);

        let _returned = 0;
        let _updated = 0;
        let _deleted = 0;

        const _localReturn = () => { // Dirty, I'm so fucking dirty, but its needed to speed things up
            _returned++
            if (_returned == _prodArrLength) {
                if (SETTINGS.DebugLevel > 10) console.log(`Databasecleanup Finished: Entrys:${_returned} Updated:${_updated} Deleted:${_deleted}`);
                _dbCleanIcon.remove();
                cb(true);
            }
        }

        for (let i = 0; i < _prodArrLength; i++) {
            const _currEntry = prodArr[i];
            let _needUpdate = false;
            if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Checking Entry ${_currEntry.id} `);

            // Checking Product Vars
            if (!_currEntry.ts_firstSeen){
                _currEntry.ts_firstSeen = (unixTimeStamp() - Math.round(Math.random() * (SECONDS_PER_WEEK / 2)));
                _needUpdate = true;
            }

            if (!_currEntry.ts_lastSeen) {
                _currEntry.ts_lastSeen = (_currEntry.ts_firstSeen + SECONDS_PER_DAY);
                _needUpdate = true;
            }


            const _notSeenCounter = (_currEntry.ts_lastSeen > (unixTimeStamp() - SECONDS_PER_WEEK)) ? 0 : _currEntry.notSeenCounter + 1;
            if (_currEntry.notSeenCounter != _notSeenCounter) {
                _currEntry.notSeenCounter = _notSeenCounter;
                _needUpdate = true;
            }

            if (_currEntry.notSeenCounter > SETTINGS.NotSeenMaxCount && !_currEntry.isFav) {
                if (SETTINGS.DebugLevel > 10) console.log(`cleanUpDatabase() - Removing Entry ${_currEntry.id}`);

                database.removeID(_currEntry.id).then((ret) => {
                    _deleted++;
                    _localReturn();
                });
            } else if (!_needUpdate){
                _localReturn();
            } else {

                database.update(_currEntry).then((ret) => {_updated++ ; _localReturn();});
            }
        }
    });
}

function exportDatabase() {
    console.log('Create Database Dump...');

    database.getAll().then((db) => {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 4)));
        element.setAttribute('download', 'AmazonVineExplorerDatabase.json');

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    })
    
}

function initBackgroundScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called initBackgroundScan()');
    const _baseUrl = (/(http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\/vine-items)/.exec(window.location.href))[1];

    // Create iFrame if not exists
    if (!document.querySelector('#ave-iframe-backgroundloader')) {
        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): create iFrame');
        const iframe = document.createElement('iframe');
        iframe.src = encodeURI(`${_baseUrl}?queue=encore&pn=&cn=&page=1`);
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

    const _paginatinWaitLoop = setInterval(() => {
        const _pageinationData = getPageinationData(document.querySelector('#ave-iframe-backgroundloader').contentWindow.document);
        if (_pageinationData) {
            clearInterval(_paginatinWaitLoop);
            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): pagination WaitLoop');

            if (!(localStorage.getItem('AVE_BACKGROUND_SCAN_IS_RUNNING') == true)) {
                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): init localStorage Variables');
                localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_MAX',_pageinationData.maxPage);
                localStorage.setItem('AVE_BACKGROUND_SCAN_IS_RUNNING', true);
                localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', 1);
                localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', 0);
            } 

            let _loopIsWorking = false;
            let _subStage = 0;
            const _stageZeroSites = ['queue=potluck', 'queue=last_chance']

            backGroundScanTimeout = setTimeout(initBackgroundScanSubFunctionScannerLoop, SETTINGS.BackGroundScanDelayPerPage);
            function initBackgroundScanSubFunctionScannerLoop(){
                if (_loopIsWorking) return;
                _loopIsWorking = true;

                let _backGroundScanStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_STAGE')) || 0;
                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): loop with _backgroundScanStage ', _backGroundScanStage, ' and Substage: ', _subStage);

                switch (_backGroundScanStage) {
                    case 0:{    // potluck, last_chance
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage);
                        if (_stageZeroSites[_subStage]) {
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage, ' inside IF');
                            backGroundTileScanner(`${_baseUrl}?${_stageZeroSites[_subStage]}` , (elm) => {_scanFinished()});
                            _subStage++
                        } else {
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.0 with _subStage: ', _subStage, ' inside ELSE');
                            _subStage = 0;
                            _backGroundScanStage++;
                            _scanFinished();
                        }
                        break;
                    }
                    case 1: {   // queue=encore | queue=encore&pn=&cn=&page=2...x
                        _subStage = parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT'));
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 with _subStage: ', _subStage);
                        if (_subStage < (parseInt(localStorage.getItem('AVE_BACKGROUND_SCAN_PAGE_MAX')) || 0)) {
                            backGroundTileScanner(`${_baseUrl}?queue=encore&pn=&cn=&page=${_subStage + 1}` , () => {_scanFinished()});
                            _subStage++
                            localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                        } else {
                            _subStage = 0;
                            _backGroundScanStage++;
                            _scanFinished();
                        }
                        break;
                    }
                    case 2: {   // qerry about other values (tax, real prize, ....) ~ 20 - 30 Products then loopover to stage 1
                        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.2 with _subStage: ', _subStage);
                        database.getAll().then((products) => {
                            const _needUpdate = [];
                            const _randCount = Math.round(Math.random() * 3);
                            for (_prod of products) {
                                if (_needUpdate.length < 3) {
                                    if (!_prod.data_estimated_tax_prize) _needUpdate.push(_prod);
                                } else {
                                    break;
                                }
                            }

                            const _promises = [];

                            for (_prod of _needUpdate) {
                                requestProductDetails(_prod).then((_newProd) => {
                                    _promises.push(database.update(_newProd));
                                });
                            }

                            Promise.all(_promises).then(() => {
                                _scanFinished();
                                _subStage++;
                            }).catch(() => {
                                console.error('There was an error while updating an product in database');
                                _scanFinished();
                                _subStage++;
                            });
                        });

                        if (_subStage++ >= 10)
                        {
                            _subStage = 0;
                            _backGroundScanStage++;
                            _scanFinished();
                        }
                        break;
                    }
                    default: {
                        cleanUpDatabase(() => {
                            _backGroundScanStage = 0;
                            _subStage = 0;
                            _scanFinished();
                        })
                        //clearInterval(backGroundScanTimeout);
                    }
                }
                function _scanFinished() {
                    if (SETTINGS.DebugLevel > 10) console.log(`initBackgroundScan()._scanFinished()`);
                    localStorage.setItem('AVE_BACKGROUND_SCAN_STAGE', _backGroundScanStage);
                    localStorage.setItem('AVE_BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                    _loopIsWorking = false;
                    backGroundScanTimeout = setTimeout(initBackgroundScanSubFunctionScannerLoop, SETTINGS.BackGroundScanDelayPerPage + Math.round(Math.random() * SETTINGS.BackGroundScannerRandomness));
                }
            }            
        }
    }, 250);
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
                let _returned = 0;
                const _tilesProm = []
                for (let i = 0; i < _tilesLength; i++) {
                    _tilesProm.push(parseTileData(_tiles[i]).then((prod) => {
                        _returned++;
                        if (SETTINGS.DebugLevel > 14) console.log(`BACKGROUNDSCAN => Got TileData Back: Tile ${_returned}/${_tilesLength} =>`, prod);
                        if (!prod.gotFromDB) database.add(prod);
                        
                    }))
                }

                Promise.allSettled(_tilesProm).then(() => {
                    cb(true);
                    _iconLoading.remove();
                });
            } else {
                if (SETTINGS.DebugLevel > 10) console.log(`BACKGROUNDSCAN => We dont have anything to do here anything => resume autoscan`);
                cb(true); // We dont have to do here anything
                _iconLoading.remove();
            }
        }
    }, 100);
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
        const _pageTitle = document.title.replace(/^[^\|]*\|/, '').trim();
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

        if (SETTINGS.EnableDesktopNotifikation) {

            if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Insige IF`);

            let _notifyed = false;
            const _configKeyWords = SETTINGS.DesktopNotifikationKeywords;


            for (let i = 0; i < _prodArrLength; i++) {
                const _prod = prodArr[i];
                const _descFull = _prod.description_full.toLowerCase();

                if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Deescription: ${_descFull} for keys: `, _configKeyWords);
                const _configkeyWordsLength = _configKeyWords.length;

                for (let j = 0; j < _configkeyWordsLength; j++) {
                    const _currKey = _configKeyWords[j].toLowerCase(); 
                    if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Search Product Deescription for Keyword: ${_currKey}`);
                    if (_descFull.includes(_currKey)) {
                        desktopNotifikation(`Amazon Vine Explorer - ${AVE_VERSION}`, _prod.description_full, _prod.data_img_url, true);
                        _notifyed = true;
                    }                    
                    break;
                }        
            }


            if (!_notifyed && _prodArrLength > oldCountOfNewItems){ 
                if (unixTimeStamp() - lastDesktopNotifikationTimestamp >= SETTINGS.DesktopNotifikationDelay) {
                    oldCountOfNewItems = _prodArrLength;
                    lastDesktopNotifikationTimestamp = unixTimeStamp();

                    desktopNotifikation(`Amazon Vine Explorer - ${AVE_VERSION}` , `Es wurden ${_prodArrLength} neue Vine Produkte gefunden`);
                } 
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
    _btn.setAttribute('class', 'a-button a-button-normal a-button-toggle');
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
}


async function requestProductDetails(prod) {
    return new Promise(async (resolve, reject) => {
        if (prod.data_asin_is_parent) {// Lets get the Childs first
            fetch(`${window.location.origin}/vine/api/recommendations/${prod.id}`.replace(/#/g, '%23')).then(r => r.json()).then(async (res) => {
                if (res.error) reject(ret.error.exceptionType);
                const _data = res.result;
                console.log('DATA:', _data)
                prod.data_childs = _data.variations || [];
                const _promArray = new Array();
                prod.data_estimated_tax_prize = prod.data_estimated_tax_prize || 0;
                for (_child of prod.data_childs) {
                    _promArray.push(fetch(`${window.location.origin}/vine/api/recommendations/${(prod.id).replace(/#/g, '%23')}/item/${_child.asin}`.replace(/#/g, '%23')).then(r => r.json()).then((childData) => {
                        console.log('CHILD_DATA:', childData);
                        if (!childData.error) {

                            // Copy over all returned datapoints od child asin
                            for (_datapoint of Object.keys(childData.result)) {
                                _child[_datapoint] = childData.result[_datapoint];
                            }

                            if (prod.data_estimated_tax_prize < _child.taxValue) {
                                prod.data_estimated_tax_prize = _child.taxValue;
                                prod.data_tax_currency = _child.taxCurrency;
                            }
                        }
                    }))
                }
                Promise.all(_promArray).then((values) => {
                    console.log('All fetches returned: ', values);
                    resolve(prod);
                });
            })
        } else {
            fetch(`${window.location.origin}/vine/api/recommendations/${prod.id}/item/${prod.data_asin}`.replace(/#/g, '%23')).then(r => r.json()).then(ret => {
                console.log('RETURN:', ret);
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

            Promise.allSettled(_tilePorms).then(() => {
                if(INIT_AUTO_SCAN) {
                    startAutoScan();
                } else if (AUTO_SCAN_IS_RUNNING) {
                    handleAutoScan();
                } else {
                    completeDelayedInit();
                }
            })
        }
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
    _searchBarSpan.style.cssText = `margin: 0.5em;`;
    // _searchBarSpan.innerHTML = `<input type="text" style="width: 30em;" placeholder="Suche Vine Produkte" name="ave-search">`;

    const _searchBarInput = document.createElement('input');
    _searchBarInput.setAttribute('type', 'search');
    _searchBarInput.setAttribute('placeholder', 'Suche Vine Produkte');
    _searchBarInput.setAttribute('name', 'ave-search');
    _searchBarInput.style.cssText = `width: 30em;`;
    _searchBarInput.addEventListener('keyup', (ev) => {
        const _input = _searchBarInput.value
        if (SETTINGS.DebugLevel > 10) console.log(`Updated Input: ${_input}`);
        if (_input.length >= 3) {
            if (searchInputTimeout) clearTimeout(searchInputTimeout);
            searchInputTimeout = setTimeout(() => {
                database.query(_input.split(' ')).then((_objArr) => {
                    if (SETTINGS.DebugLevel > 10) console.log(`Found ${_objArr.length} Items with this Search`);
                    createNewSite(PAGETYPE.SEARCH_RESULT, _objArr);
                    searchInputTimeout = null;
                }) 
            }, 250);
        }
    });


    _searchBarSpan.appendChild(_searchBarInput);
    _searchbarContainer.appendChild(_searchBarSpan);


    // Manual Autoscan and Backgroundscan can not run together, so don´t create the button
    if (!SETTINGS.EnableBackgroundScan) _searchbarContainer.appendChild(createNavButton('ave-btn-updateDB', 'Update Database', 'ave-btn-updateDB-text',SETTINGS.BtnColorUpdateDB, () => {localStorage.setItem('AVE_INIT_AUTO_SCAN', true); window.location.href = "vine-items?queue=encore";}));

    if (hasTiles) addLeftSideButtons();

    if (SETTINGS.EnableBackgroundScan) initBackgroundScan();

    // Modify Pageination if exists
    const _pageinationContainer = document.getElementsByClassName('a-pagination')[0];
    if (_pageinationContainer) {
        if (SETTINGS.DebugLevel > 10) console.log('Manipulating Pageination');

        const _nextBtn = _pageinationContainer.lastChild;
        const _isNextBtnDisabled = (_nextBtn.getAttribute('class') != 'a-last');
        const _nextBtnLink = _nextBtn.lastChild.getAttribute('href');

        if (!_isNextBtnDisabled) {
            _nextBtn.setAttribute('class', 'a-normal');
        }

        const _btn = document.createElement('li');
        _btn.setAttribute('class', 'a-last');
        _btn.addEventListener('click', () => {
            markAllCurrentSiteProductsAsSeen(() => {
                window.location.href = (_nextBtnLink);
            });
        })

        const _btn_a = document.createElement('a');
        _btn_a.setAttribute('style', 'background-color: lime');
        _btn_a.innerHTML = 'Alle als gesehen markieren und Nächste<span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';

        _btn.appendChild(_btn_a);
        _pageinationContainer.appendChild(_btn);
    }
}


