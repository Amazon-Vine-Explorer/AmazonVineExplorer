// ==UserScript==
// @name         Vine Viewer Database Converter
// @namespace    http://tampermonkey.net/
// @version      0.2.5
// @updateURL    https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/DataBaseMigrator.user.js
// @downloadURL  https://raw.githubusercontent.com/Amazon-Vine-Explorer/AmazonVineExplorer/main/DataBaseMigrator.user.js
// @description  Converts VineViewer Database to Vine Explorer Database
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


'use strict';


try {
    

const DATABASE_NAME = 'VineVoiceExplorer';
const DATABASE_VERSION = 2;
const OBJECT_STORE_NAME = `${DATABASE_NAME}_Objects`;

const VV_DATABASE_NAME = 'VineData';
const VV_DATABASE_VERSION = 2;
const VV_OBJECT_STORE_NAME = `Products`;

const database = new Object(); // Create database Object
const vv_database = new Object(); // Create database Object

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


database.init = (cb) => {
    database._request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    
    database._request.onerror = (event) => {
        consolePrintLine('Error, could not open Database');
    }

    database._request.onsuccess = (event) => {
        database._db = event.target.result;
        cb(true);
    }

    database._request.onupgradeneeded = function (event) {
        console.log('running onupgradeneeded');
        // Get a reference to the request related to this event
        const _request = event.target;

        // Get a reference to the IDBDatabase object for this request
        const _db = _request.result;

        if (!_db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
            console.log('Database needs to be created...');
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
database.add = (obj, cb = () => {}) => {
  if (!database._db) return;
  const _transaction = database._db.transaction([OBJECT_STORE_NAME], 'readwrite');
  const _store = _transaction.objectStore(OBJECT_STORE_NAME);
  const request = _store.add(obj);

  request.onerror = function (e) {
    console.error('Error', e.target.error.name);
  };
  request.onsuccess = function (e) {
    // console.log(`Created Database Entry for ${obj.data_recommendation_id}`);
    cb(true);
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
        // console.log('Record updated successfully');
        callback(true);
    };

    request.onerror = (event) => {
        console.error('Error updating record:', event.target.error.name);
        callback(false);
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

vv_database.init = (cb) => {
    vv_database._request = indexedDB.open(VV_DATABASE_NAME, VV_DATABASE_VERSION);
    
    vv_database._request.onerror = (event) => {
        consolePrintLine('Error, could not open Database');
    }

    vv_database._request.onsuccess = (event) => {
        vv_database._db = event.target.result;
        cb(true);
    }

    vv_database._request.onupgradeneeded = function (event) {
        console.log('running onupgradeneeded');
    }
};

vv_database.getAllKeys = (callback) => {
    if (!vv_database._db) return;

    const transaction = vv_database._db.transaction([VV_OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(VV_OBJECT_STORE_NAME);
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

vv_database.get = (id, callback = () => {}) => {
    if (!vv_database._db || !id) return;
    
    const transaction = vv_database._db.transaction([VV_OBJECT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(VV_OBJECT_STORE_NAME);
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

// JavaScript, um den Head und das Popup-Fenster hinzuzufügen
document.head.innerHTML = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            background-color: rgba(0, 0, 0, 0.5);
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh; /* 100% der Bildschirmhöhe */
        }

        #popup {
            width: 600px;
            padding: 20px;
            background-color: white;
            border-radius: 10px; /* Leicht abgerundete Ecken */
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); /* Schatten für das Popup */
            text-align: left; /* Linksbündige Textausrichtung */
            font-family: 'Courier New', monospace; /* Monospace-Schriftart für Konsolen-Look */
            color: black;
        }

        h1 {
            margin-top: 0; /* Oberen Abstand der Überschrift entfernen */
        }

        #outputTextarea {
            width: calc(100% - 20px); /* 100% Breite abzüglich 20px (10px auf jeder Seite) für den Rand */
            height: 200px; /* Festgelegte Höhe für das Konsolen-Look Textfeld */
            background-color: #000; /* Schwarzer Hintergrund */
            color: #00ff00; /* Helle grüne Textfarbe */
            outline: none; /* Kein Fokus-Rahmen */
            padding: 10px; /* Innenabstand für den Text */
            margin-top: 10px; /* Oberen Abstand für die Textarea */
            resize: none; /* Deaktiviere das Ändern der Größe durch Benutzer */
            overflow: auto; /* Aktiviere das Scrollen, wenn der Text über die Höhe hinausgeht */
        }

        #inputField {
            width: calc(100% - 20px); /* 100% Breite abzüglich 20px (10px auf jeder Seite) für den Rand */
            margin-top: 10px; /* Oberen Abstand für das Eingabefeld */
            padding: 10px; /* Innenabstand für das Eingabefeld */
        }
    </style>
`;

document.body.innerHTML = `
    <div id="popup">
        <h1>Database Converter</h1>
        <p>Hi there, don't be scared, all is fine. The Amazon site content is hidden for database migration.</p>
        <textarea id="outputTextarea" readonly></textarea>
        <input type="text" id="inputField" placeholder="Input">
    </div>
`;

let CONVERTING = false;
let FINISHED = false;

document.getElementById('inputField').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const inputValue = (event.target.value).toLowerCase();
        console.log('Input:', inputValue);
        event.target.value = '';
        event.preventDefault();

        if (inputValue == 'start' && !CONVERTING) {
            startDBConversation()
        } else if (inputValue == 'deleteold' && FINISHED) {
            indexedDB.deleteDatabase(VV_DATABASE_NAME);
        } else if (inputValue == 'export' && FINISHED) {
            downloadDatabase();
        } else if (inputValue == 'import') {
            importDatabase(IMPORT_DB);
        } else {
            consolePrintLine('Unknown Command');
        }
    }
});

function consolePrintLine(text) {consolePrint(`${text || ''}\n`)}

function consolePrint(text) {
    const textarea = document.getElementById("outputTextarea");
    const currentContent = textarea.value;
    textarea.value = (currentContent == '') ? text : currentContent + text;
    textarea.scrollTop = textarea.scrollHeight;
}

function consoleReplace(oldText, newText) {
    const textarea = document.getElementById("outputTextarea");
    const currentContent = textarea.value;
    textarea.value = (textarea.value).replace(oldText, newText)
}

function downloadDatabase() {
    consolePrintLine('Create Database Dump...');

    database.getAll((db) => {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 4)));
        element.setAttribute('download', 'AmazonVineExplorerDatabase.json');

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    })
    
}


/* NEW START----------------------------------------------------------
{
    "id": "A1PA6795UKMFR9#B008D2JYFO#vine.enrollment.cf0601cf-c8e3-4f47-ba50-e949ce8aa5a7",
    "link": "/dp/B008D2JYFO",
    "description_full": "Maximex Haarlos schön Enthaarungscreme 30 ml, hemmt den Haarwuchs, beruhigt die gereizte Haut, pflegend und feuchtigkeitsspendend, für jeden Hauttyp",
    "description_short": "Maximex Haarlos schön Enthaarungscreme 30 ml, hem…",
    "data_recommendation_id": "A1PA6795UKMFR9#B008D2JYFO#vine.enrollment.cf0601cf-c8e3-4f47-ba50-e949ce8aa5a7",
    "data_recommendation_type": "VENDOR_VINE_FOR_ALL",
    "data_img_url": "https://m.media-amazon.com/images/I/31tkby0uFAL._SS210_.jpg",
    "data_img_alt": "",
    "data_asin": "B008D2JYFO",
    "isFav": false,
    "isNew": false,
    "ts_firstSeen": 1700877083,
    "ts_lastSeen": 1700877083,
    "notSeenCounter": 0,
    "order_success": false,
    "generated_short": false
}
NEW END----------------------------------------------------------
OLD START----------------------------------------------------------
    "ID": "A1PA6795UKMFR9#B008D2JYFO#vine.enrollment.cf0601cf-c8e3-4f47-ba50-e949ce8aa5a7",
    "Titel": "Maximex Haarlos schön Enthaarungscreme 30 ml, hemmt den Haarwuchs, beruhigt die gereizte Haut, pflegend und feuchtigkeitsspendend, für jeden Hauttyp",
    "Link": "https://www.amazon.de/dp/B008D2JYFO",
    "BildURL": "https://m.media-amazon.com/images/I/31tkby0uFAL._SS210_.jpg",
    "Button": "<input data-asin=\"B008D2JYFO\" data-is-parent-asin=\"false\" data-recommendation-id=\"A1PA6795UKMFR9#B008D2JYFO#vine.enrollment.cf0601cf-c8e3-4f47-ba50-e949ce8aa5a7\" data-recommendation-type=\"VENDOR_VINE_FOR_ALL\" class=\"a-button-input\" type=\"submit\" aria-labelledby=\"a-autoid-14-announce\"><span class=\"a-button-text\" aria-hidden=\"true\" id=\"a-autoid-14-announce\">Weitere Details</span>",
    "Datum": "23.11.2023, 01:10:01",
    "Favorit": false
}
OLD END----------------------------------------------------------*/

function finish() {
    FINISHED = true;
    consolePrintLine();
    consolePrintLine('We have finished the Database Convert');
    consolePrintLine();
    consolePrintLine('Now u can use the following commands:');
    consolePrintLine('deleteold  | Delete the Old Database');
    consolePrintLine('export     | To Export and download the converted Database');
    consolePrintLine();
    consolePrintLine('Don´t forget to disable this Script if you are done.');
}

// Timestamp in Seconds
function linuxTimeStamp () {
  return Math.floor(Date.now() / 1000)
}

function extractDataFromHTML(htmlString) {
    // Erstelle ein temporäres DOM-Element
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;

    // Extrahiere die gewünschten Daten
    const dataAsin = tempElement.querySelector('input').getAttribute('data-asin');
    const recommendationType = tempElement.querySelector('input').getAttribute('data-recommendation-type');

    // Gib die extrahierten Daten zurück
    return {
        dataAsin: dataAsin,
        recommendationType: recommendationType
    };
}

function convertProduct(vvProd) {
    const _extractedData = extractDataFromHTML(vvProd.Button.replace('\\', ''));
    const _timeStamp = ((new Date(vvProd.Datum)).getTime() / 1000);

    const _newProduct = new Product(vvProd.ID);
    _newProduct.link = `/dp/${vvProd.Link.replace(/.+\/dp\//, '')}`;
    _newProduct.description_full = vvProd.Titel;
    _newProduct.description_short = `${_newProduct.description_full.substr(0,50)}...`;
    _newProduct.data_recommendation_id = vvProd.ID;
    _newProduct.data_recommendation_type = _extractedData.recommendationType;
    _newProduct.data_img_url = vvProd.BildURL;
    _newProduct.data_img_alt = '';
    _newProduct.data_asin = _extractedData.dataAsin;
    _newProduct.isFav = vvProd.Favorit;
    _newProduct.isNew = false;
    _newProduct.ts_firstSeen = _timeStamp;
    _newProduct.ts_lastSeen = _timeStamp;
    _newProduct.generated_short = true;

    return _newProduct;
}

function updateEntrys(_machingKeys, cb) {
    if (_machingKeys.length == 0) {
        cb();
        return;
    }    

    consolePrint('Updating maching Products...');
    let _returned = 0;
    for (let i = 0; i < _machingKeys.length; i++) {
        const _currKey = _machingKeys[i];
        vv_database.get(_currKey, (_vvProd) => {
            database.get(_currKey, (_veProd) => {
                if (!_veProd.isFav) _veProd.isFav = (_vvProd.Favorit) ? true : false;
                database.update(_veProd, () => {
                    _returned++;
                    consoleReplace(/Updating maching Products.+/, `Updating maching Products (${_returned}/${_machingKeys.length})`);
                    if (_returned == _machingKeys.length) { // All Updates Done ;) Lets start with the "hard" work for conveting VV Products tp VE Products
                        consoleReplace(/Updating maching Products.+/, `Updating maching Products DONE\n`);
                        cb();
                    }
                })
            })
        })
    }
}

function convertOld(_noMachKeys, cb) {
    if (_noMachKeys.length == 0) {
        cb();
        return;
    }    

    consolePrintLine('Convert Products from Vine Vewer Database to Vine Explorer Database');
    consolePrint('Convert Products...');
    let _returned = 0;
    for (let j = 0; j < _noMachKeys.length; j++) {
        const _currNmKey = _noMachKeys[j];
        vv_database.get(_currNmKey, (oldProd) => {
            database.add(convertProduct(oldProd), () => {
                _returned++;
                consoleReplace(/Convert Products.+/, `Convert Products (${_returned}/${_noMachKeys.length})`);
                if (_returned == _noMachKeys.length) {
                    consoleReplace(/Convert Products.+/, `Convert Products DONE\n`);
                    cb();
                }
            });
        })
    }

}

function startDBConversation() {
    consolePrintLine('Init....');
    consolePrint('Try to Connect to VineExplorer Database...');
    database.init((_ret) => {
        consolePrintLine('connected');
        consolePrint('Try to Connect to VineVewer Database...');
        vv_database.init((_ret) => {
            consolePrintLine('connected');
            consolePrint('Read VineViewer keys...');
            vv_database.getAllKeys((_vvKeys) => {
                consolePrintLine(`found ${_vvKeys.length}`);
                consolePrint('Read VineExplorer keys...');
                database.getAllKeys((_veKeys) => {
                    consolePrintLine(`found ${_veKeys.length}`);
                    consolePrint(`Try to find maching Products...`);
                    const _machingKeys = [];
                    const _noMachKeys = [];
                    for (let i = 0; i < _vvKeys.length; i++){
                        if (_veKeys.includes(_vvKeys[i])) {
                            _machingKeys.push(_vvKeys[i]);
                        } else {
                            _noMachKeys.push(_vvKeys[i]);
                        }
                    }
                    consolePrintLine(`found ${_machingKeys.length} Products that are alredy in Vine Explorer Database and ${_noMachKeys.length} who needs to get full converted`);
                    updateEntrys(_machingKeys, () => {
                        convertOld(_noMachKeys, () => {
                            finish();
                        })
                    })
                })
            })
        })
    });
}

function importDatabase(newDB) {
    consolePrintLine()
    const _newDBLength = newDB.length;
    database.init(()=> {
        database.getAllKeys((_keys) => {
            for (let i = 0; i < _newDBLength; i++) {
                const _currEntry = newDB[i];
                if (!_keys.includes(_currEntry.id)) database.add(_currEntry);
            }
        })
    });
}


consolePrintLine('Hi There, first of all pls disable "VineViewer" AND "VineExplorer" !!\nIf u checked this u can start. I will wait until you are ready to start.\nplease type "start" in the input line to start the database conversation');

} catch (error) {
    consolePrintLine(`ERROR ${error}`);
}