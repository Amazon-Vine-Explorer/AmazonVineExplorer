// ==UserScript==
// @name         Amazon Vine Explorer
// @namespace    http://tampermonkey.net/
// @version      0.7.1
// @updateURL    https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js
// @downloadURL  https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js
// @description  Better View and Search and Explore for Vine Products - Vine Voices Edition
// @author       MarkusSR1984
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
// @grant        GM.openInTab
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
console.log(`Init Vine Voices Explorer ${VVE_VERSION}`);

/**
 * On witch page are we atm ? PAGETYPE
 */
let currentMainPage;

loadSettings();
fastStyleChanges();

let productDBIds = [];
let searchInputTimeout;
let backGroundScanInterval;



// Make some things accessable from console
unsafeWindow.vve = {
    classes: [
        DB_HANDLER = DB_HANDLER
    ],
    config: SETTINGS,
    event: vve_eventhandler,
};


const database = new DB_HANDLER(DATABASE_NAME, DATABASE_OBJECT_STORE_NAME, DATABASE_VERSION, (res, err) => {
    if (err) {
        console.error(`Somithing was going wrong while init database :'(`);
        return;
    } else {
        database.getAllKeys((keys) => {
            if (SETTINGS.DebugLevel > 10) console.log('All keys:', keys);
            productDBIds = keys;
            
            let _execLock = false;
            console.log('Lets Check where we are....');
            if (SITE_IS_VINE){
                 console.log('We are on Amazon Vine'); // We are on the amazon vine site
                waitForHtmlElmement('.vvp-details-btn', () => {
                    if (_execLock) return;
                    _execLock = true;
                    addBranding();
                    detectCurrentPageType();
                    init(true);
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
    	});
    }
});

unsafeWindow.vve.database = database;

let oldCountOfNewItems = 0;

let showDbUpdateLogoTimeout = null;
let showDbUpdateLogoIcon = null;

vve_eventhandler.on('vve-database-changed', () => {
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
    stickElementToTopScrollEVhandler('vve-btn-allseen', 5);

    if (currentMainPage = PAGETYPE.ALL) handleInfiniteScroll();


};

function handleInfiniteScroll() {
    


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
    
    // getUrlParameter('vve-subpage');

}


// Check if Product exists in our Database or if it is a new one
function existsProduct(id) { 
    if (SETTINGS.DebugLevel > 10) console.log(`Called existsProduct(${id})`);
    return (productDBIds.lastIndexOf(id) != -1);
}


async function parseTileData(tile, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called parseTileData(${tile})`);

    const _id = tile.getAttribute('data-recommendation-id');

    
    if (existsProduct(_id)) {
        database.get(_id, (_ret) => {
            _ret.gotFromDB = true;
            _ret.ts_lastSeen = unixTimeStamp();
            cb(_ret);
        });


        return;
    } // Fast exit if Product is in our DB

    const _div_vpp_item_tile_content                    = tile.getElementsByClassName('vvp-item-tile-content')[0];
    const _div_vpp_item_tile_content_img                = _div_vpp_item_tile_content.getElementsByTagName('img')[0];
    const _div_vvp_item_product_title_container         = _div_vpp_item_tile_content.getElementsByClassName('vvp-item-product-title-container')[0];
    const _div_vvp_item_product_title_container_a       = _div_vvp_item_product_title_container.getElementsByTagName('a')[0];
    const _div_vpp_item_tile_content_button_inner       = _div_vpp_item_tile_content.getElementsByClassName('a-button-inner')[0];
    const _div_vpp_item_tile_content_button_inner_input = _div_vpp_item_tile_content_button_inner.getElementsByTagName('input')[0];

    const _newProduct = new Product(_id);
    // _newProduct.id = _id;
    
    
    // while(!_div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent) {}

    _newProduct.data_recommendation_id = _id;
    _newProduct.data_img_url = tile.getAttribute('data-img-url');
    _newProduct.data_img_alt = _div_vpp_item_tile_content_img.getAttribute('alt') || "";
    _newProduct.link = _div_vvp_item_product_title_container_a.getAttribute('href');
    _newProduct.description_full = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-full')[0].textContent;
    
    _newProduct.data_asin = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-asin');
    _newProduct.data_recommendation_type = _div_vpp_item_tile_content_button_inner_input.getAttribute('data-recommendation-type');
    _newProduct.description_short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;
    
    
    if (_newProduct.description_short == '') {
        let _timeLoopCounter = 0;
        const _maxLoops = Math.round(SETTINGS.FetchRetryMaxTime / SETTINGS.FetchRetryTime);
        const _halfdelay = (SETTINGS.FetchRetryTime / 2)
        function timeLoop() {
            if (_timeLoopCounter++ < _maxLoops){
                    setTimeout(() => {
                        const _short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;
                        if (_short != ""){ 
                            _newProduct.description_short = _short;
                            cb(_newProduct);
                        } else {
                            timeLoop();
                        }
                    }, _halfdelay + Math.round(Math.random() * _halfdelay * 2));
                } else {
                    _newProduct.description_short = `${_newProduct.description_full.substr(0,50)}...`;
                    _newProduct.generated_short = true;
                    cb(_newProduct);
                }
            }
        timeLoop();
        } else {
            cb(_newProduct);
        }
        
    // if (SETTINGS.DebugLevel > 10) console.log(`parseTileData(${tile}) RETURNS :: ${JSON.stringify(_newProduct, null, 4)}`);
}



function reloadPageWithSubpageTarget(target) {
    if (window.location.href.includes('?')) {
        window.location.href = window.location.href + `&vve-subpage=${target}`;
    } else {
        window.location.href = window.location.href + `?vve-subpage=${target}`;
    }
}

function addLeftSideButtons(forceClean) {
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    
    if (forceClean) _nodesContainer.innerHTML = '';
    
    
    _nodesContainer.appendChild(document.createElement('p')); // A bit of Space above our Buttons

    const _setAllSeenBtn = createButton('Alle als gesehen markieren','vve-btn-allseen',  'background-color: lime;', () => {
        
        if (SETTINGS.DebugLevel > 10) console.log('Clicked All Seen Button');
        markAllCurrentSiteProductsAsSeen();
    });
    

    _nodesContainer.appendChild(_setAllSeenBtn);

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
            database.get(_id, (prod) => {
                prod.isNew = false;
                database.update(prod, () => {
                    updateTileStyle(prod);
                    _returned++;
                    if (_returned == _tilesLength) cb();
                })
            })
        }
}

function markAllCurrentDatabaseProductsAsSeen(cb = () => {}) {
    if (SETTINGS.DebugLevel > 10) console.log('Called markAllCurrentDatabaseProductsAsSeen()');
    database.getNewEntries((prods) => {
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
                    <input data-asin="${product.data_asin}" data-is-parent-asin="false" data-recommendation-id="${product.data_recommendation_id}" data-recommendation-type="${product.data_recommendation_type}" class="a-button-input" type="submit" aria-labelledby="a-autoid-${_btnAutoID}-announce">
                    <span class="a-button-text" aria-hidden="true" id="a-autoid-${_btnAutoID}-announce">Weitere Details</span>
                </span>
            </span>
        </div>
    `;
    _tile.prepend(createFavStarElement(product, btnID));
    cb(_tile);
}

function createFavStarElement(prod, index) {
    const _favElement = document.createElement('div');
    _favElement.setAttribute("id", `p-fav-${index || Math.round(Math.random() * 5000)}`);
    _favElement.classList.add('vve-favorite-star');
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
            database.getNewEntries((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('vve-btn-list-new');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.FAVORITES:{
            currentMainPage = PAGETYPE.FAVORITES;
            database.getFavEntries((_prodArr) => {
                createProductSite(type, _prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('vve-btn-favorites');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.ALL:{
            currentMainPage = PAGETYPE.ALL;
            // createProductSite(type, data, () => {
            //     initTileEventHandlers();
            // });
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


function btnEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called btnEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.get(data.recommendation_id, (prod) => {
            if (prod) {
                prod.isNew = false;
                database.update(prod, () => {
                    updateTileStyle(prod);
                });
            }
        })
    }
}

function favStarEventhandlerClick(event, data) {
    if (SETTINGS.DebugLevel > 10) console.log(`called favStarEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
    if (data.recommendation_id) {
        database.get(data.recommendation_id, (prod) => {
            if (prod) {
                prod.isFav = !prod.isFav;
                database.update(prod, () => {
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
            const _favStar = _tile.querySelector('.vve-favorite-star');
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

    const _btns = document.querySelectorAll('.vvp-details-btn input');
    const _btnsLength = _btns.length;
    
    // Thats Fucking Messy, but i don´t have an better solution for this atm. :'((((((
    for(let i = 0; i < _tileLength; i++) {
        if (SETTINGS.DebugLevel > 10) console.log(`Adding Eventhandler to Tile ${i}`);
        const _currTile = _tiles[i];
        
        const _favStar = _currTile.querySelector('.vve-favorite-star');
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
        
        waitForHtmlElmement('.vve-favorite-star', (elem) => {
            _favStar.addEventListener('click', (event) => {favStarEventhandlerClick(event, _data)});
        }, _currTile);
        
        
    }        
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
    _text.innerHTML = `<p id="vve-autoscan-text">${text}</p>`;

    document.body.appendChild(_overlay);
    document.body.appendChild(_text);
}

function updateAutoScanScreenText(text = '') {
    const _elem = document.getElementById('vve-autoscan-text');
    _elem.textContent = text;
}

function addBranding() {
    // const _overlay = document.createElement('div');
    // _overlay.style.position = 'fixed';
    // _overlay.style.top = '0';
    // _overlay.style.left = '0';
    // _overlay.style.width = '100%';
    // _overlay.style.height = '100%';
    // _overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Grauer Hintergrund mit Transparenz
    // _overlay.style.zIndex = '1000'; // Stelle sicher, dass das Overlay über anderen Elementen liegt
    // document.body.appendChild(_overlay);

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
    _text.innerHTML = `<p id="vve-brandig-text">VineExplorer - ${VVE_VERSION}</p>`;

    
    document.body.appendChild(_text);
}


function addOverlays() {
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
    database.getAll((prodArr) => {
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
                
                database.removeID(_currEntry.id, (ret) => {
                    if (ret) productDBIds.splice(productDBIds.indexOf(_currEntry.id), 1) // Remove it also from our array
                    _deleted++;
                    _localReturn();
                });
            } else if (!_needUpdate){
                _localReturn();
            } else {
                
                database.update(_currEntry, (ret) => {_updated++ ; _localReturn();});
            }
        }
    });
}

function initBackgroundScan() {
    if (SETTINGS.DebugLevel > 10) console.log('Called initBackgroundScan()');
    const _baseUrl = (/(http[s]{0,1}\:\/\/[w]{0,3}.amazon.[a-z]{1,}\/vine\/vine-items)/.exec(window.location.href))[1];
    
     // Create iFrame if not exists
    if (!document.querySelector('#vve-iframe-backgroundloader')) {
        if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): create iFrame');
        const iframe = document.createElement('iframe');
            iframe.src = encodeURI(`${_baseUrl}?queue=encore&pn=&cn=&page=1`);
            iframe.id = 'vve-iframe-backgroundloader';
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
        const _pageinationData = getPageinationData(document.querySelector('#vve-iframe-backgroundloader').contentWindow.document);
        if (_pageinationData) {
            clearInterval(_paginatinWaitLoop);
            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): pagination WaitLoop');

            if (!localStorage.getItem('BACKGROUND_SCAN_IS_RUNNING') || true) {
                if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan(): init localStorage Variables');
                localStorage.setItem('BACKGROUND_SCAN_PAGE_MAX',_pageinationData.maxPage);
                localStorage.setItem('BACKGROUND_SCAN_IS_RUNNING', true);
                localStorage.setItem('BACKGROUND_SCAN_PAGE_CURRENT', 1);
                localStorage.setItem('BACKGROUND_SCAN_STAGE', 0);
            } 
            
            let _loopIsWorking = false;
            let _subStage = 0;
            const _stageZeroSites = ['queue=potluck', 'queue=last_chance']
            
            backGroundScanInterval = setInterval(() => {
                if (_loopIsWorking) return;
                _loopIsWorking = true;

                let _backGroundScanStage = parseInt(localStorage.getItem('BACKGROUND_SCAN_STAGE')) || 0;
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
                            _subStage = parseInt(localStorage.getItem('BACKGROUND_SCAN_PAGE_CURRENT'));
                            if (SETTINGS.DebugLevel > 10) console.log('initBackgroundScan().loop.case.1 with _subStage: ', _subStage);
                            if (_subStage < (parseInt(localStorage.getItem('BACKGROUND_SCAN_PAGE_MAX')) || 0)) {
                                backGroundTileScanner(`${_baseUrl}?queue=encore&pn=&cn=&page=${_subStage + 1}` , () => {_scanFinished()});
                                _subStage++
                                localStorage.setItem('BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                            } else {
                                _subStage = 0;
                                _backGroundScanStage++;
                                _scanFinished();
                            }
                        break;            }
                        case 2: {   // qerry about other values (tax, real prize, ....) ~ 20 - 30 Products then loopover to stage 1
                                _subStage = 0;
                                _backGroundScanStage++;
                                _scanFinished();
                            break;
                        }   
                        default: {
                            cleanUpDatabase(() => {
                                _backGroundScanStage = 0;
                                _subStage = 0;
                                _scanFinished();
                            })
                            //clearInterval(backGroundScanInterval);
                        }
                }
                function _scanFinished() {
                    if (SETTINGS.DebugLevel > 10) console.log(`initBackgroundScan()._scanFinished()`);
                    localStorage.setItem('BACKGROUND_SCAN_STAGE', _backGroundScanStage);
                    localStorage.setItem('BACKGROUND_SCAN_PAGE_CURRENT', _subStage);
                    _loopIsWorking = false;
                }
            }, SETTINGS.BackGroundScanDelayPerPage);
        }
    }, 250);
}

function backGroundTileScanner(url, cb) {
    if (SETTINGS.DebugLevel > 10) console.log(`Called backgroundTileScanner(${url})`);
    const _iconLoading = addLoadingSymbol();
    const _iframeDoc = document.querySelector('#vve-iframe-backgroundloader').contentWindow.document;
    vve.backGroundIFrame = _iframeDoc;
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
                for (let i = 0; i < _tilesLength; i++) {
                    parseTileData(_tiles[i], (prod) => {
                        _returned++;
                        if (!prod.gotFromDB) database.add(prod);
                        if (SETTINGS.DebugLevel > 10) console.log(`BACKGROUNDSCAN => Got TileData Back: Tile ${_returned}/${_tilesLength} =>`, prod);
                        if (_returned == _tilesLength) {cb(true); _iconLoading.remove()};
                    })
                }
            } else {
                if (SETTINGS.DebugLevel > 10) console.log(`BACKGROUNDSCAN => We dont have to do here anything => resume autoscan`);
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
        localStorage.setItem('INIT_AUTO_SCAN', false);
        localStorage.setItem('AUTO_SCAN_IS_RUNNING', true);
        localStorage.setItem('AUTO_SCAN_PAGE_MAX',_pageiDat.maxPage);
        localStorage.setItem('AUTO_SCAN_PAGE_CURRENT', 1);
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
        localStorage.setItem('AUTO_SCAN_PAGE_CURRENT', _nextPage);
        setTimeout(() => {
            window.location.href = window.location.href.replace(/=[0-9]+/, `=${_nextPage}`);
        }, _delay);
    } else { // We are done ;)
        updateAutoScanScreenText('Success, cleaning up Database...');
        cleanUpDatabase(()=> {
            localStorage.setItem('AUTO_SCAN_IS_RUNNING', false);
            localStorage.setItem('AUTO_SCAN_PAGE_MAX', -1);
            localStorage.setItem('AUTO_SCAN_PAGE_CURRENT', -1);
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

            const _elemInitialTop = parseInt(_elem.getAttribute('vve-data-default-top'));
            if (!_elemInitialTop) {_elem.setAttribute('vve-data-default-top', (window.scrollY + _elemRect.top)); return;}

            if (SETTINGS.DebugLevel > 10) console.log(`### scrollY:${window.scrollY} maxScrollHeigt ${maxScrollHeight} initialTop: ${_elemInitialTop}`);

            if (window.scrollY >= (_elemInitialTop - dist)) {
                _elem.style.position = "fixed";
                _elem.style.top = '5px';
            } else {
                _elem.style.position = "static";
            }
        })
    }
}

let lastDesktopNotifikationTimestamp = 0;

function updateNewProductsBtn() {
    if (SETTINGS.DebugLevel > 1) console.log('Called updateNewProductsBtn()');
    database.getNewEntries((prodArr) => { 
        const _btnBadge = document.getElementById('vve-new-items-btn-badge');
        const _pageTitle = document.title.replace(/^[0-9]+/, '').trim();
        const _prodArrLength = prodArr.length;
        if (SETTINGS.DebugLevel > 1) console.log(`updateNewProductsBtn(): Got Database Response: ${_prodArrLength} New Items`);

        if (_prodArrLength > 0) {
            _btnBadge.style.display = 'inline-block';
            _btnBadge.innerText = _prodArrLength;
            document.title = `${_prodArrLength} ${_pageTitle}`;
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
                        desktopNotifikation(`Amazon Vine Explorer - ${VVE_VERSION}`, _prod.description_full, _prod.data_img_url, true);
                        _notifyed = true;
                    }                    
                        break;
                }        
            }
        

            if (!_notifyed && _prodArrLength > oldCountOfNewItems){ 
                if (unixTimeStamp() - lastDesktopNotifikationTimestamp >= SETTINGS.DesktopNotifikationDelay) {
                    oldCountOfNewItems = _prodArrLength;
                    lastDesktopNotifikationTimestamp = unixTimeStamp();

                    desktopNotifikation(`Amazon Vine Explorer - ${VVE_VERSION}` , `Es wurden ${_prodArrLength} neue Vine Produkte gefunden`);
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
    
    if (Notification.permission === 'granted') {
        const _notification = new Notification(title, {
            body: message,
            icon: (!requireInteraction) ? _vineLogo : _vineLogoImp,
            image: image || 'https://m.media-amazon.com/images/G/01/vine/website/vine_logo_title._CB1556578328_.png',
            tag: `vve-notify-${Math.round(Math.random()* 10000000)}`,
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

unsafeWindow.vve.DN = desktopNotifikation;

function createNavButton(mainID, text, textID, color, onclick, badgeId, badgeValue) {
    const _btn = document.createElement('span');
    _btn.setAttribute('id', mainID);
    _btn.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _btn.addEventListener('click', onclick);

    const _btnInner = document.createElement('span');
    _btnInner.classList.add('a-button-inner');
    _btnInner.style.backgroundColor = color;
    _btn.append(_btnInner);

    const _btnInnerText = document.createElement('span');
    _btnInnerText.setAttribute('id', textID);
    _btnInnerText.classList.add('a-button-text');
    _btnInnerText.innerText = text;
    _btnInner.append(_btnInnerText);

    if (badgeId) {
        const _btnInnerBadge = document.createElement('span');
        _btnInnerBadge.setAttribute('id', badgeId)
        _btnInnerBadge.style.backgroundColor = 'red';
        _btnInnerBadge.style.color = 'white';
        _btnInnerBadge.style.minWidth = '20px';
        _btnInnerBadge.style.width =  '40px';
        _btnInnerBadge.style.display = 'inline-block';
        _btnInnerBadge.style.textAlign = 'center';
        _btnInnerBadge.style.borderRadius = '10px';
        // _btnInnerBadge.style.transform = 'translate(-75%, -100%)';
        _btnInnerBadge.style.zIndex = '50';
        _btnInnerBadge.style.position = 'relativ';
        // _btnInnerBadge.style.padding = '5px';
        _btnInnerBadge.style.marginLeft = '5px';

        _btnInnerBadge.innerText = badgeValue;
        _btnInnerText.append(_btnInnerBadge);
    }

    return _btn;
}


function init(hasTiles) {
    // Get all Products on this page ;)
    
    if (AUTO_SCAN_IS_RUNNING) showAutoScanScreen(`Autoscan is running...Page (${AUTO_SCAN_PAGE_CURRENT}/${AUTO_SCAN_PAGE_MAX})`);
    
    const _vveSubpageRequest = getUrlParameter('vve-subpage');
    if (SETTINGS.DebugLevel > 10) console.log(`Got Subpage Parameter`, _vveSubpageRequest)
    
    if (_vveSubpageRequest) createNewSite(parseInt(_vveSubpageRequest));

    if (hasTiles) {
        const _tiles = document.getElementsByClassName('vvp-item-tile');
        const _tilesLength = _tiles.length;
        let _countdown = 0;
        const _parseStartTime = Date.now();
        for (let i = 0; i < _tilesLength; i++) {
            const _currTile = _tiles[i];
            _currTile.style.cssText = "background-color: yellow;";
            parseTileData(_currTile, (_product) => {
                if (SETTINGS.DebugLevel > 10) console.log(`Got TileData Back: `, _product);
                
                _countdown++;
                const _tilesToDoCount = _tilesLength - _countdown;
                if (SETTINGS.DebugLevel > 10) console.log(`==================================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Waiting for ${_tilesToDoCount} more tiles to get parsed`)
                if (SETTINGS.DebugLevel > 10 && _tilesToDoCount == 0) console.log(`==================================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Parsing ${_tilesLength} has taken ${Date.now() - _parseStartTime} ms`);

                if (!_product.gotFromDB) { // We have a new one ==> Save it to our Database ;)
                    database.add(_product);
                    _currTile.style.cssText = SETTINGS.CssProductSaved;
                    _currTile.classList.add('vve-element-saved');
                } else {
                    let _style = SETTINGS.CssProductDefault;
                    if(_product.isNew) {
                        _style = SETTINGS.CssProductNewTag;
                        _currTile.classList.add('vve-element-new');
                    }
                    if(_product.isFav) {
                        _style = SETTINGS.CssProductFavTag;
                        _currTile.classList.add('vve-element-fav');
                    }
                    _currTile.style.cssText = _style;
                    
                    // Update Timestamps
                }
                _currTile.prepend(createFavStarElement(_product, i));

            if (_tilesToDoCount == 0) {
                    if(INIT_AUTO_SCAN) {
                        startAutoScan();
                    } else if (AUTO_SCAN_IS_RUNNING) {
                        handleAutoScan();
                    } else {
                        completeDelayedInit();
                    }
                }
            });
        }
    } else {
        if (SETTINGS.DebugLevel > 10) console.log(`init(): NO TILES TO PARSE ON THIS SITE => SKIP`);
    }

    
    if (AUTO_SCAN_IS_RUNNING) return;
    
    const _searchbarContainer = document.getElementById('vvp-items-button-container');

    _searchbarContainer.appendChild(createNavButton('vve-btn-favorites', 'Alle', '', '', () => {createNewSite(PAGETYPE.ALL);}));
    _searchbarContainer.appendChild(createNavButton('vve-btn-favorites', 'Favoriten', '', SETTINGS.FavBtnColor, () => {createNewSite(PAGETYPE.FAVORITES);}));
    _searchbarContainer.appendChild(createNavButton('vve-btn-list-new', 'Neue Einträge', 'vve-new-items-btn','lime', () => {createNewSite(PAGETYPE.NEW_ITEMS);}, 'vve-new-items-btn-badge', '-'));

    updateNewProductsBtn();


    // Searchbar
    const _searchBarSpan = document.createElement('span');
    _searchBarSpan.setAttribute('class', 'vve-search-container');
    _searchBarSpan.style.cssText = `margin: 0.5em;`;
    // _searchBarSpan.innerHTML = `<input type="text" style="width: 30em;" placeholder="Suche Vine Produkte" name="vve-search">`;

    const _searchBarInput = document.createElement('input');
    _searchBarInput.setAttribute('type', 'text');
    _searchBarInput.setAttribute('placeholder', 'Suche Vine Produkte');
    _searchBarInput.setAttribute('name', 'vve-search');
    _searchBarInput.style.cssText = `width: 30em;`;
    _searchBarInput.addEventListener('keyup', (ev) => {
        const _input = _searchBarInput.value
        if (SETTINGS.DebugLevel > 10) console.log(`Updated Input: ${_input}`);
        if (_input.length >= 3) {
            if (searchInputTimeout) clearTimeout(searchInputTimeout);
            searchInputTimeout = setTimeout(() => {
                database.query(_input, (_objArr) => {
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
    if (!SETTINGS.EnableBackgroundScan) _searchbarContainer.appendChild(createNavButton('vve-btn-updateDB', 'Update Database', 'vve-btn-updateDB-text','lime', () => {localStorage.setItem('INIT_AUTO_SCAN', true); window.location.href = "vine-items?queue=encore";}));

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
        _btn.setAttribute('style', 'background-color: lime');
        _btn.addEventListener('click', () => {
            markAllCurrentSiteProductsAsSeen(() => {
                window.location.href = (_nextBtnLink);
            });
        })

        const _btn_a = document.createElement('a');
        _btn_a.innerHTML = 'Alle als gesehen markieren und Nächste<span class="a-letter-space"></span><span class="a-letter-space"></span><span class="larr">→</span>';

        _btn.appendChild(_btn_a);
        _pageinationContainer.appendChild(_btn);
    }
}


