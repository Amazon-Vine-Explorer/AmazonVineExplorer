// ==UserScript==
// @name         Amazon Vine Explorer
// @namespace    http://tampermonkey.net/
// @version      0.5.1
// @updateURL    https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/VineExplorer.user.js
// @downloadURL  https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/mainVineExplorer.user.js
// @description  Better View and Search and Explore for Vine Products - Vine Voices Edition
// @author       MarkusSR1984
// @match        *://www.amazon.de/vine/*
// @match        *://amazon.de/vine/*
// @match        *://www.amazon.de/-/en/vine/*
// @license      MIT
// @icon         https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/vine_logo.png
// @run-at       document-idle
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        unsafeWindow
// ==/UserScript==

/* 
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
    - Automatisches Datenbank Cleanup
    - Last Seen Update 
    - Löschen von Produkten die nicht mehr in Vine verfügbar sind
    - Changelog hinzufügen
*/


'use strict';

const VVE_VERSION = '0.5.1';

const FAV_BTN_COLOR = localStorage.getItem('FAV_BTN_COLOR') || "rgb(255, 255, 102)";
const CSS_PRODUCT_NEWTAG = localStorage.getItem('CSS_PRODUCT_NEWTAG') || "border: 2mm ridge rgba(218, 247, 166, .6); background-color: rgba(218, 247, 166, .2)";
const CSS_PRODUCT_SAVED = localStorage.getItem('CSS_PRODUCT_SAVED') || "border: 2mm ridge rgba(105, 163, 0, .6); background-color: rgba(105, 163, 0, .2)";
const CSS_PRODUCT_FAV = localStorage.getItem('CSS_PRODUCT_FAV') || "border: 2mm ridge rgba(255, 255, 102, .6); background-color: rgba(255, 255, 102, .2)";
const CSS_PRODUCT_MARKED_REMOVAL = localStorage.getItem('CSS_PRODUCT_FAV') || "border: 2mm ridge rgba(255, 87, 51, .6); background-color: rgba(255, 87, 51, .2)";
const CSS_PRODUCT_DEFAULT = localStorage.getItem('CSS_PRODUCT_DEFAULT') || "";

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
const OBJECT_STORE_NAME = `${DATABASE_NAME}_Objects`;
const SECONDS_PER_WEEK = 604800 / 2;
const SECONDS_PER_DAY = 86400;
const NOT_SEEN_COUNT_MAX = 5;



const FETCH_RETRY_TIME = localStorage.getItem('FETCH_RETRY_TIME') || 50; // Retry all 50 ms if all data are ready to read, ! shot description delay of amazon :'(
const FETCH_RETRY_MAX_TIME = localStorage.getItem('FETCH_RETRY_MAX_TIME') || 5000; // After this time in ms the parser abort to try to get all data and creates the Missing data himself but sets a flag that we now later that there was anything wrong

if (DEBUG) console.log("Init VineExplorer");


class Product {
  
    id;
    link;
    description_full;
    description_short;
    data_recommendation_id;
    data_recommendation_type;
    data_img_url;
    data_img_alt;
    data_asin;

    isFav = false;
    isNew = true;
    gotRemoved = false;
    ts_firstSeen = linuxTimeStamp();
    ts_lastSeen = linuxTimeStamp();
    notSeenCounter = 0;
    order_success = false;
    generated_short = false;
    gotFromDB = undefined;
    constructor(id) {
        this.id = id;
    };
}



const database = new Object(); // Create database Object
let local_lang; // Local Language
let db;         // Database Object
// let productDB;  // Database Transaction
let productDBIds = [];

// Check if Product exists in our Database or if it is a new one
function existsProduct(id) { 
    if (DEBUG) console.log(`Called existsProduct(${id})`);
    return (productDBIds.lastIndexOf(id) != -1);
}

// Timestamp in Seconds
function linuxTimeStamp () {
  return Math.floor(Date.now() / 1000)
}

// Convert Millis Timestamp to Seconds Timestamp
function toLinuxTimestamp(now) {
    return Math.floor(now / 1000)
}

// Convert Seconds Timestamp to Millis Timestamp
function toTimestamp(_linuxTimestamp) {
    return (_linuxTimestamp * 1000);
}


async function parseTileData(tile, cb) {
    if (DEBUG) console.log(`Called parseTileData(${tile})`);

    const _id = tile.getAttribute('data-recommendation-id');

    
    if (existsProduct(_id)) {
        
        database.get(_id, (_ret) => {
            _ret.gotFromDB = true;
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
    // _newProduct.ts_firstSeen = linuxTimeStamp();
    // _newProduct.ts_lastSeen = linuxTimeStamp();
    _newProduct.description_short = _div_vvp_item_product_title_container_a.getElementsByClassName('a-truncate-cut')[0].textContent;
    
    
    if (_newProduct.description_short == '') {
        let _timeLoopCounter = 0;
        const _maxLoops = Math.round(FETCH_RETRY_MAX_TIME / FETCH_RETRY_TIME);
        const _halfdelay = (FETCH_RETRY_TIME / 2)
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
        
    // if (DEBUG) console.log(`parseTileData(${tile}) RETURNS :: ${JSON.stringify(_newProduct, null, 4)}`);
}



/* SuccessBox
<div id="vvp-generic-order-success-msg" class="a-box a-alert a-alert-success" aria-live="polite" aria-atomic="true"><div class="a-box-inner a-alert-container"><h4 class="a-alert-heading">Erfolgreich!</h4><i class="a-icon a-icon-alert"></i><div class="a-alert-content">Ihre Produktanfrage wurde übermittelt.</div></div></div>
*/


/* Seitliche Eingliederung
<div id="vvp-browse-nodes-container">
    <p>
        <a class="a-link-normal" href="/vine/vine-items?queue=last_chance">Alle anzeigen</a></p>

    <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=80084031">Baumarkt</a><span> (14)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=340846031">Lebensmittel &amp; Getränke</a><span> (11)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=64187031">Drogerie &amp; Körperpflege</a><span> (8)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=3167641">Küche, Haushalt &amp; Wohnen</a><span> (6)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=16435051">Sport &amp; Freizeit</a><span> (4)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=84230031">Kosmetik</a><span> (4)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=562066">Elektronik &amp; Foto</a><span> (2)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=340852031">Haustier</a><span> (2)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=192416031">Bürobedarf &amp; Schreibwaren</a><span> (1)</span>
            </div>
        <div class="parent-node">
                <a class="a-link-normal" href="/vine/vine-items?queue=last_chance&amp;pn=355007011">Baby</a><span> (1)</span>
            </div>
        </div>
*/ // ENDE Seitliche Eingliederung

/* Item Grid Container
<div id="vvp-items-grid-container">
        <p>Anzeigen von <strong>1 -1</strong> von <strong>1</strong> Ergebnissen</p>
        
        <div id="vvp-items-grid" class="a-section">
        
         **** ITEM TILES SPACE ******
        </div>
    </div></div>

*/ // ENDE Item Grind Container


function addLeftSideButtons(forceClean) {
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    
    if (forceClean) _nodesContainer.innerHTML = '';
    
    
    _nodesContainer.appendChild(document.createElement('p')); // A bit of Space above our Buttons

    const _setAllSeenBtn = createButton('Alle als gesehen markieren', 'background-color: lime;', () => {
        if (DEBUG) console.log('Clicked All Seen Button');
        markAllCurrentSiteProductsAsSeen();
    });

    _nodesContainer.appendChild(_setAllSeenBtn);

    // const _clearDBBtn = createButton('Datenbank Bereinigen', 'background-color: orange;', () => {
    //     if (DEBUG) console.log('Clicked clear DB Button');
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
    if (DEBUG) console.log('Called markAllCurrentDatabaseProductsAsSeen()');
    database.getNewEntries((prods) => {
        const _prodsLength = prods.length;
        let _returned = 0;
        if (DEBUG) console.log(`markAllCurrentDatabaseProductsAsSeen() - Got ${_prodsLength} Products with Tag isNew`);
        if (_prodsLength == 0) {
            cb(true);
            return;
        }
        for (let i = 0; i < _prodsLength; i++) {
            const _currProd = prods[i];
            _currProd.isNew = false;
            database.update(_currProd, ()=> {
                if (DEBUG) console.log(`markAllCurrentDatabaseProductsAsSeen() - Updated ${_currProd.id}`);
                _returned++
                if (_returned == _prodsLength) cb(true);
            })
        }
    });
}

function createButton(text, style, clickHandler){
    const _btnSpan = document.createElement('span');
    _btnSpan.setAttribute('id', 'vve-btn-updateDB');
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
    if (!product && DEBUG) console.error(`createTileFromProduct got no valid product element`);
    const _btnAutoID = btnID || Math.round(Math.random() * 10000);
    
    const _tile = document.createElement('div');
    _tile.setAttribute('class', 'vvp-item-tile');
    _tile.setAttribute('data-recommendation-id', product.data_recommendation_id);
    _tile.setAttribute('data-img-url', product.data_img_url);
    _tile.setAttribute('style', (product.notSeenCounter > 0) ? CSS_PRODUCT_MARKED_REMOVAL : (product.isFav) ? CSS_PRODUCT_FAV : (product.isNew) ? CSS_PRODUCT_NEWTAG : CSS_PRODUCT_DEFAULT);
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
    _favElement.style.cssText = CSS_PRODUCT_FAV_STAR;
    _favElement.textContent = '★';
    if (prod.isFav) _favElement.style.color = FAV_STAR_COLOR_CHECKED; // FAV_STAR_COLOR_CHECKED = Gelb;
    return _favElement;
}


async function createProductSite(productArray, cb) {
    if (!productArray) return;
    
    const _productArrayLength = productArray.length;
    const _fastCount = Math.min(_productArrayLength, MAX_ITEMS_PER_PAGE);
    if (DEBUG) console.log(`Create Overview for ${_productArrayLength} Products`);

    // Lear / Fill Left Nodes Container
    const _nodesContainer = document.getElementById('vvp-browse-nodes-container');
    _nodesContainer.innerHTML = '';

    // Items Grid Container
    const _tilesContainer = document.getElementById('vvp-items-grid-container');

    // Edit Top Line
    const _topLine = _tilesContainer.getElementsByTagName('p')[0];
    _topLine.innerHTML = `<p>Anzeigen von <strong>${_fastCount}</strong> von <strong>${_productArrayLength}</strong> Ergebnissen</p>`
                                                
    const _tilesGrid = document.getElementById('vvp-items-grid');
    _tilesGrid.innerHTML = '';
    
    let _index = 0;
    let _returned = 0;

    for (; _index < _fastCount; _index++) {
        createTileFromProduct(productArray[_index], _index, (tile) => {
            _tilesGrid.append(tile);
            _returned++;
            if (DEBUG) console.log(`Created Tile (${_returned}/${_fastCount})`);
            if (_returned == _fastCount) cb(true);
        });
    }

    addLeftSideButtons(true);
    // if (_productArrayLength >= _fastCount) {
    //     setTimeout(() => {
    //         for (; _index < _productArrayLength; _index++) {
    //             createTileFromProduct(productArray[_index], _index, (tile) => {
    //                 _tilesGrid.append(tile);
    //             });
    //         }
    //     }, 1000);
    // }
}

const PAGETYPE = {
    NEW_ITEMS: 0,
    FAVORITES: 1,
    
    SEARCH_RESULT: 99,
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
            database.getNewEntries((_prodArr) => {
                createProductSite(_prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('vve-btn-list-new');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.FAVORITES:{
            database.getFavEntries((_prodArr) => {
                createProductSite(_prodArr, () => {
                    initTileEventHandlers();
                    const _btn = document.getElementById('vve-btn-favorites');
                    _btn.classList.add('a-button-selected');
                    _btn.setAttribute('aria-checked', true);
                });
            })
            break;
        }
        case PAGETYPE.SEARCH_RESULT:{
            createProductSite(data, () => {
                initTileEventHandlers();
            });
            break;
        }
    }


}


function btnEventhandlerClick(event, data) {
    if (DEBUG) console.log(`called btnEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
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
    if (DEBUG) console.log(`called favStarEventhandlerClick(${JSON.stringify(event)}, ${JSON.stringify(data)})`);
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
    if (DEBUG) console.log(`Called updateTileStyle(${JSON.stringify(prod)})`);
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;

    for (let i = 0; i < _tilesLength; i++) {
        const _tile = _tiles[i];
        const _id = _tile.getAttribute('data-recommendation-id');
        if (_id == prod.data_recommendation_id) {
            _tile.setAttribute('style', (prod.isFav) ? CSS_PRODUCT_FAV : (prod.isNew) ? CSS_PRODUCT_NEWTAG : CSS_PRODUCT_DEFAULT);
            const _favStar = _tile.querySelector('.vve-favorite-star');
            _favStar.style.color = (prod.isFav) ? FAV_STAR_COLOR_CHECKED : 'white'; // FAV_STAR_COLOR_CHECKED = Gelb;
            return;
        }
    }
}

// Adds Eventhandler to Product Buttons
function initTileEventHandlers() {
    if (DEBUG) console.log('Called inttTileEventHandlers() >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tileLength = _tiles.length;

    const _btns = document.querySelectorAll('.vvp-details-btn input');
    const _btnsLength = _btns.length;
    
    // Thats Fucking Messy, but i don´t have an better solution for this atm. :'((((((
    for(let i = 0; i < _tileLength; i++) {
        if (DEBUG) console.log(`Adding Eventhandler to Tile ${i}`);
        const _currTile = _tiles[i];
        
        const _favStar = _currTile.querySelector('.vve-favorite-star');
        const _btn = _currTile.querySelector('.vvp-details-btn input');

        const _data = new Object()
        _data.asin = _btn.getAttribute('data-asin');
        _data.recommendation_id = _btn.getAttribute('data-recommendation-id');
        
        
        const _childs = _btn.childNodes;
        _btn.addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});
    
        for(let j = 0; j < _childs.length; j++) {
            if (DEBUG) console.log(`Adding Eventhandler to Children ${j} of Tile ${i}`);
            _childs[j].addEventListener('click', (event) => {btnEventhandlerClick(event, _data)});
        }
    
        _favStar.addEventListener('click', (event) => {favStarEventhandlerClick(event, _data)});
        
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

function addBrandig() {
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
    _text.style.zIndex = '999';
    _text.style.borderRadius = '3px';
    _text.innerHTML = `<p id="vve-brandig-text">VineExplorer - ${VVE_VERSION}</p>`;

    
    document.body.appendChild(_text);
}

function getPageinationData() {
    if (DEBUG) console.log('Called getPageinationData()');
    const _ret = new Object();
    const _paginationContainer = document.querySelector('.a-pagination');
    
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
function cleanUpDatabase(cb = () => {}) {
    if (DEBUG) console.log('Called cleanUpDatabase()');
    database.getAll((prodArr) => {
        const _prodArrLength = prodArr.length;
        if (DEBUG) console.log(`cleanUpDatabase() - Checking ${_prodArrLength} Entrys`);
        
        let _returned = 0;
        for (let i = 0; i < _prodArrLength; i++) {
            const _currEntry = prodArr[i];
            let _needUpdate = false;
            if (DEBUG) console.log(`cleanUpDatabase() - Checking Entry ${_currEntry.id} `);
            
            // Checking Product Vars
            if (!_currEntry.ts_firstSeen){
                _currEntry.ts_firstSeen = (linuxTimeStamp() - Math.round(Math.random() * (SECONDS_PER_WEEK / 2)));
                _needUpdate = true;
            }
            
            if (!_currEntry.ts_lastSeen) {
                _currEntry.ts_lastSeen = (_currEntry.ts_firstSeen + SECONDS_PER_DAY);
                _needUpdate = true;
            }

            
            const _notSeenCounter = (_currEntry.ts_lastSeen > (linuxTimeStamp() - SECONDS_PER_WEEK)) ? 0 : _currEntry.notSeenCounter + 1;
            if (_currEntry.notSeenCounter != _notSeenCounter) {
                _currEntry.notSeenCounter = _notSeenCounter;
                _needUpdate = true;
            }

            if (_currEntry.notSeenCounter > NOT_SEEN_COUNT_MAX && !_currEntry.isFav) {
                if (DEBUG) console.log(`cleanUpDatabase() - Removing Entry ${_currEntry.id}`);
                database.removeID(_currEntry.id, (callback) => {_returned++;});
            } else if (!_needUpdate){
                _returned++;
            } else {
                database.update(_currEntry, () => {_returned++});
            }

            if (_returned == _prodArrLength) {
                if (DEBUG) console.log(`cleanUpDatabase() - FINISHED`);
                cb(true);
            }
        }
    });
}


function startAutoScan() {
    if (DEBUG) console.log('Called startAutoScan()');
    showAutoScanScreen('Init Autoscan, please wait...');
    markAllCurrentDatabaseProductsAsSeen(() => {
        if (DEBUG) console.log('startAutoScan() - Got Callback from markAllCurrentDatabaseProductsAsSeen()');
        const _pageiDat = getPageinationData();
        localStorage.setItem('INIT_AUTO_SCAN', false);
        localStorage.setItem('AUTO_SCAN_IS_RUNNING', true);
        localStorage.setItem('AUTO_SCAN_PAGE_MAX',_pageiDat.maxPage);
        localStorage.setItem('AUTO_SCAN_PAGE_CURRENT', 1);
        setTimeout(() => {
            const _url = `${_pageiDat.href}1`;
            if (DEBUG) console.log(`Loding new Page ${_url}`)
            window.location.href = _url;
        }, 5000);
    })
}


function handleAutoScan() {
    let _href;
    const _delay = Math.max(PAGE_LOAD_MIN_DELAY - (Date.now() - PAGE_LOAD_TIMESTAMP), 0) + 500;
    if (DEBUG) console.log(`handleAutoScan() - _delay: ${_delay}`);
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
                updateAutoScanScreenText('Finished Database\nupdate and cleanup\n\nPage reloading incoming... pleae wait');
                setTimeout(()=> {
                    window.location.href = window.location.href.replace(/=[0-9]+/, '=1');
                }, 10000);
            }, _delay + 2000);
        });
    }
}

function init() {
    // Get all Products on this page ;)
    if (AUTO_SCAN_IS_RUNNING) showAutoScanScreen(`Autoscan is running...Page (${AUTO_SCAN_PAGE_CURRENT}/${AUTO_SCAN_PAGE_MAX})`);
    const _tiles = document.getElementsByClassName('vvp-item-tile');
    const _tilesLength = _tiles.length;
    let _countdown = 0;
    const _parseStartTime = Date.now();
    for (let i = 0; i < _tilesLength; i++) {
        const _currTile = _tiles[i];
        _currTile.style.cssText = "background-color: yellow;";
         parseTileData(_currTile, (_product) => {
            // console.log(`Got TileData Back: ${JSON.stringify(_product, null, 4)}`);
            
            // _currTile.style.cssText = `background-color: ${!_product.generated_short ? 'lightgreen': 'lightblue'};`;
            
            _countdown++;
            const _tilesToDoCount = _tilesLength - _countdown;
            if (DEBUG) console.log(`==================================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Waiting for ${_tilesToDoCount} more tales to get parsed`)
            if (DEBUG && _tilesToDoCount == 0) console.log(`==================================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>Parsing ${_tilesLength} has taken ${Date.now() - _parseStartTime} ms`);

            if (!_product.gotFromDB) { // We have a new one ==> Save it to our Database ;)
                database.add(_product);
                _currTile.style.cssText = CSS_PRODUCT_SAVED;
            } else {
                let _style = CSS_PRODUCT_DEFAULT;
                if(_product.isNew) _style = CSS_PRODUCT_NEWTAG;
                if(_product.isFav) _style = CSS_PRODUCT_FAV;
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
    
    if (AUTO_SCAN_IS_RUNNING) return;

    // Detect Browser Language
    let _lang;
    if(navigator.browserLanguage){
        _lang = navigator.browserLanguage;
    }else{
        _lang = navigator.language;
    }
    local_lang = _lang.substr(0,2).toLowerCase();
    
    const _searchbarContainer = document.getElementById('vvp-items-button-container');
    // Add Searchbar and all other stuff from this script ;)

    // Favorites Button
    const _favBtnSpan = document.createElement('span');
    _favBtnSpan.setAttribute('id', 'vve-btn-favorites');
    _favBtnSpan.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _favBtnSpan.innerHTML = `
        <span class="a-button-inner" style="background-color: ${FAV_BTN_COLOR}">
            <span class="a-button-text">${'Favoriten'}</span>
        </span>
    `;
    _favBtnSpan.addEventListener('click', (ev) => {
        createNewSite(PAGETYPE.FAVORITES);
    });

    _searchbarContainer.appendChild(_favBtnSpan);


    // Update DB Button
    const _showNewBtnSpan = document.createElement('span');
    _showNewBtnSpan.setAttribute('id', 'vve-btn-list-new');
    _showNewBtnSpan.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _showNewBtnSpan.innerHTML = `
        <span class="a-button-inner">
            <span class="a-button-text" id="vve-new-items-btn">Neue Produkte</span>
        </span>
    `;
    _showNewBtnSpan.addEventListener('click', (ev) => {
        createNewSite(PAGETYPE.NEW_ITEMS);
    });

    _searchbarContainer.appendChild(_showNewBtnSpan);

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
        if (DEBUG) console.log(`Updated Input: ${_input}`);
        if (_input.length >= 3) {
            database.query(_input, (_objArr) => {
                if (DEBUG) console.log(`Found ${_objArr.length} Items with this Search`);

                // for (let i = 0; i < _objArr.length; i++) {
                //     console.log(`Item${i}: => ${_objArr[i].description_full}`);
                // }
                createNewSite(PAGETYPE.SEARCH_RESULT, _objArr);
            }) 
        }
    });

    _searchBarSpan.appendChild(_searchBarInput);
    _searchbarContainer.appendChild(_searchBarSpan);


    // Update DB Button
    const _updateDBBtnSpan = document.createElement('span');
    _updateDBBtnSpan.setAttribute('id', 'vve-btn-updateDB');
    _updateDBBtnSpan.setAttribute('class', 'a-button a-button-normal a-button-toggle');
    _updateDBBtnSpan.setAttribute('aria-checked', 'true');
    _updateDBBtnSpan.innerHTML = `
        <span class="a-button-inner" style="background-color: lime">
            <span class="a-button-text">Update Database</span>
        </span>
    `;
    _updateDBBtnSpan.addEventListener('click', (ev) => {
        localStorage.setItem('INIT_AUTO_SCAN', true);
        window.location.href = "vine-items?queue=encore";
    });

    _searchbarContainer.appendChild(_updateDBBtnSpan);

    addLeftSideButtons();

    // Modify Pageination if exists
    const _pageinationContainer = document.getElementsByClassName('a-pagination')[0];
    if (_pageinationContainer) {
        if (DEBUG) console.log('Manipulating Pageination');
        
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


// Init database
database.init = (cb) => {
    addBrandig();
    database._request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    
    database._request.onerror = (event) => {
        console.log("Fehler beim Öffnen der Datenbank");
    }

    database._request.onsuccess = (event) => {
        if (DEBUG) console.log("Verbindung zur Datenbank hergestellt");
        database._db = event.target.result;
        cb(true);
    }

    database._request.onupgradeneeded = function (event) {
        if (DEBUG) console.log('running onupgradeneeded');
        // Get a reference to the request related to this event
        const _request = event.target;

        // Get a reference to the IDBDatabase object for this request
        const _db = _request.result;

        if (!_db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
            if (DEBUG) console.log('Database needs to be created...');
            const _storeOS = _db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
            _storeOS.createIndex('isNew', 'isNew', { unique: false });
            _storeOS.createIndex('isFav', 'isFav', { unique: false });
        } else {
            // Get a reference to the implicit transaction for this request
            // @type IDBTransaction
            const _transaction = _request.transaction;

            // Now, get a reference to the existing object store
            // @type IDBObjectStore
            const _store = _transaction.objectStore(OBJECT_STORE_NAME);

            switch(event.oldVersion) { // existing db version
                //case 0: // We had to Create the DB, but this case should never happen
                case 1: { // Update DB from Verion 1 to 2
                    // Add index for New and Favorites
                    _store.createIndex('isNew', 'isNew', { unique: false });
                    _store.createIndex('isFav', 'isFav', { unique: false });
                }
                default: {
                    console.error(`There was any Unknown Error while Updating Database from ${event.oldVersion} to ${DATABASE_VERSION}`);
                }
            }
        }
    };
};

// Fügt einen Datensatz zu den Datenbank hinzu
database.add = (obj) => {
  if (!database._db) return;
  const _transaction = database._db.transaction([OBJECT_STORE_NAME], 'readwrite');
  const _store = _transaction.objectStore(OBJECT_STORE_NAME);
  const request = _store.add(obj);

  request.onerror = function (e) {
    console.error('Error', e.target.error.name);
  };
  request.onsuccess = function (e) {
    if (DEBUG) console.log(`Created Database Entry for ${obj.data_recommendation_id}`);
  };
};


database.get = (id, callback = () => {}) => {
    if (!database._db || !id) return;
    
    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (event) => {
        const result = event.target.result;
        callback(result);
    };

    request.onerror = (event) => {
        console.error('Error getting DB entry:', event.target.error.name);
        callback(null);
    };
};

// Updated den Datensatz in der Datenbank
database.update = (obj, callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.put(obj);

    request.onsuccess = (event) => {
        if (DEBUG) console.log('Record updated successfully');
        callback(true);
    };

    request.onerror = (event) => {
        console.error('Error updating record:', event.target.error.name);
        callback(false);
    };
};
// Suche nach Einträgen, deren description_full-String den queryTxt enthält, und gibt die Objekte als Array zurück
database.query = (queryTxt, callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const result = [];
    const cursorRequest = store.openCursor();

    cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
            const descriptionFull = (cursor.value.description_full || '').toLowerCase();
            const queryLower = queryTxt.toLowerCase();

            if (descriptionFull.includes(queryLower)) {
                result.push(cursor.value);
            }

            cursor.continue();
        } else {
            // No more entries
            callback(result);
        }
    };

    cursorRequest.onerror = (event) => {
        console.error('Error querying records:', event.target.error.name);
        callback([]);
    };
};


// Gibt alle Schlüssel als Array zurück
database.getAllKeys = (callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = (event) => {
        const result = event.target.result;
        callback(result);
    };

    request.onerror = (event) => {
        console.error('Error getting keys:', event.target.error.name);
        callback([]);
    };
};

// Gibt alle Einträge zurück, bei denen isNew gleich true ist
database.getNewEntries = (callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const result = [];
    const cursorRequest = store.openCursor();

    cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
            if (cursor.value.isNew) {
                result.push(cursor.value);
            }

            cursor.continue();
        } else {
            // No more entries
            callback(result);
        }
    };

    cursorRequest.onerror = (event) => {
        console.log('Error get NEW Entrys:', event.target.error.name);
        callback([]);
    };
};

// Gibt alle Einträge zurück, bei denen isFav gleich true ist
database.getFavEntries = (callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const result = [];
    const cursorRequest = store.openCursor();

    cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
            if (cursor.value.isFav) {
                result.push(cursor.value);
            }

            cursor.continue();
        } else {
            // No more entries
            callback(result);
        }
    };

    cursorRequest.onerror = (event) => {
        console.log('Error get NEW Entrys:', event.target.error.name);
        callback([]);
    };
};

database.getAll = (callback) => {
    if (!database._db) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);

    const result = [];
    const cursorRequest = store.openCursor();

    cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            result.push(cursor.value);
            cursor.continue();
        } else {
            // No more entries
            callback(result);
        }
    };

    cursorRequest.onerror = (event) => {
        console.error('Error querying records:', event.target.error.name);
        callback([]);
    };
};

database.removeID = (id, callback) => {
    if (!database._db || !id) return;

    const transaction = database._db.transaction([OBJECT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = (event) => {
        if (DEBUG) console.log(`Record with ID ${id} removed successfully`);
        callback(true);
    };

    request.onerror = (event) => {
        console.error('Error removing record:', event.target.error.name);
        callback(false);
    };
};

// Start all of the Trash :P
database.init((_ret) => {
    if (!_ret) {
        console.error(`Somithins was going wrong while init database :'(`);
        return;
    } else {
        database.getAllKeys((keys) => {
            if (DEBUG) console.log('All keys:', keys);
            productDBIds = keys;
            init();
    });
    }
});
