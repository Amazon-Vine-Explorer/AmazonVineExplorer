console.log('loaded db_handler.js');
class DB_HANDLER {
    #version;
    #dbName;
    #storeName;
    #db;
    #eventDelayTimeout;

    /**
    * Db Handler to easy use of IndexedDB Object Store Databases
    * @constructor
    * @param {string} dbName Name your Database
    * @param {string} [storeName] Object Store Name
    * @param {number} [version] Object Store Name
    * @param {function} [cb] Callback function executes when database initialisation is done
    * @return {DB_HANDLER} DBHANDLER Object
    */

    constructor(dbName, storeName, version) {
        if (!dbName) throw new Error(`CLASS DB_HANDLER needs a name for the database to init: example:  const db = new DB_HANDLER('AnyName')`);
        this.#dbName = dbName;
        this.#version = version || 1;
        this.#storeName = storeName || dbName + '_ObjectStore';
        // Note: do NOT call async code here!
    }

    // The async static initializer
    static async init(dbName, storeName, version) {
        const instance = new DB_HANDLER(dbName, storeName, version);
        await instance.#init();
        return instance;
    }

    /**
     * Class Internal DB Init Function
     * @async
     * @returns {Promise<string>}
     */
    async #init() {
        return new Promise((resolve, reject) => {
            const _request = indexedDB.open(this.#dbName, this.#version);
            const _storeName = this.#storeName; // private class variable is not accessable inside _request functions

            console.log('IndexedDB init()');

            _request.onerror = (event) => {
                reject(event);
                console.error(event);
                throw new Error('Indexed DB has an Error');
            }

            _request.onblocked = (event) => {
                reject(event);
                console.warn(event);
                throw new Error('IndexedDB is blocked');
            }

            _request.onsuccess = (event) => {
                this.#db = event.target.result;
                resolve(event.target.result);
            }

            _request.onupgradeneeded = (event) => {
                console.log(`DB_HANDLER: Database has to be created or Updated`);
                console.log(JSON.stringify(event, null, 4));
                console.log(event);

                const _req = event.target;
                const _db = _req.result;
                let _store;

                if (!_db.objectStoreNames.contains(_storeName)) {
                    if (SETTINGS.DebugLevel > 10) console.log('Database needs to be created...');
                    _store = _db.createObjectStore(_storeName, { keyPath: 'id' });
                } else {
                    // Get a reference to the implicit transaction for this request
                    // @type IDBTransaction
                    const _transaction = _req.transaction;

                    // Now, get a reference to the existing object store
                    // @type IDBObjectStore
                    _store = _transaction.objectStore(_storeName);
                }

                console.log(`Updating Database from Version ${event.oldVersion} to ${event.newVersion}`);

                if (!_store.indexNames.contains('isNew')) {
                    _store.createIndex('isNew', 'isNew', { unique: false });
                }

                if (!_store.indexNames.contains('isFav')) {
                    _store.createIndex('isFav', 'isFav', { unique: false });
                }

                if (!_store.indexNames.contains('data_asin')) {
                    // if new db, don't check for duplicate asins
                    if (event.oldVersion === 0){
                        _store.createIndex('data_asin', 'data_asin', { unique: true });
                    }
                    else if (this.#checkForDuplicatedASIN()) {
                        _store.createIndex('data_asin', 'data_asin', { unique: true });
                    }
                }
            }
        })
    };

    /**
    * DB ASIN CHECKER
    * @param {function} [cb] Callback function executes when database query is done
    */
    #checkForDuplicatedASIN() {
        const _request = this.#getStore().openCursor();

        const existingDataAsinValues = [];
        _request.onsuccess = (event) => {
            const _cursor = event.target.result;
            if (_cursor) {
                existingDataAsinValues.push(_cursor.key);
                _cursor.continue();
            } else {
                const uniqueDataAsinValues = Array.from(new Set(existingDataAsinValues));

                if (existingDataAsinValues.length !== uniqueDataAsinValues.length) {
                    console.warn('Duplikate in "data_asin" gefunden. Bereinigen oder löschen Sie die Datenbank');
                    return false;
                } else {
                    // Keine Duplikate gefunden, Sie können den Index jetzt als eindeutig markieren
                    // const uniqueIndex = _storeOS.createIndex('data_asin', 'data_asin', { unique: true });
                    return true;
                }
            }
        };
        _request.onerror = (event) => { cb([]); throw new Error(`DB_HANDLER.#checkForDuplicatedAsin: ${event.target.error.name}`); };
    };

    /**
     * Fires the Event ave-database-changed when any writeaccess has happend
     */
    #fireDataChangedEvent() {
        if (this.#eventDelayTimeout) clearTimeout(this.#eventDelayTimeout);
        this.#eventDelayTimeout = setTimeout(() => {
            ave_eventhandler.emit('ave-database-changed');
            this.#eventDelayTimeout = null;
        }, 250);
    }

    /**
    * Get Object Store Object
    * @param {boolean} [rw] Set to true if u want to create a writeable access
    * @return {object} Object Store Object
    */
    #getStore(rw = false) {
        if (!this.#db) throw new Error('DB_HANDLER.#getStore: Database Object is not defined');
        const _transaction = this.#db.transaction([this.#storeName], (rw) ? 'readwrite' : 'readonly');
        const _store = _transaction.objectStore(this.#storeName);
        return _store;
    }

    /**
    * Add Object to Database
    * @async
    * @param {object} dbName Name your Database
    * @returns {Promise<void>}
    */
    async add(obj) {
        return new Promise((resolve, reject) => {
            if (typeof (obj) != 'object') reject('DB_HANDLER.add(): obj is not defined or is not type of object');

            const _request = this.#getStore(true).add(obj);

            _request.onerror = (event) => {
                if (`${event.target.error}`.includes('data_asin')) {
                    console.error('Tryed to ADD New Product with existing ASIN ???', obj);
                    // reject(event.target.error);
                    // return;
                }

                reject(`DB_HANDLER.add(): ${event.target.error}`);
            };

            _request.onsuccess = (event) => {
                resolve();
                this.#fireDataChangedEvent();
            };
        })
    };

    /**
    * Get Object by ID
    * @async
    * @param {string} id Object ID
    * @returns {Promise<Product>}
    */
    async get(id) {
        return new Promise((resolve, reject) => {
            if (typeof (id) != 'string') reject('DB_HANDLER.get(): id is not defined or is not typeof string');

            const _request = this.#getStore().get(id);
            _request.onerror = (event) => { reject(`DB_HANDLER.add(): ${event.target.error}`); };
            _request.onsuccess = (event) => { resolve(event.target.result); };
        })
    };

    /**
    * Get Object by ID
    * If the entry is not found by the given ID, the ID is deconstructed to get the ASIN.
    * If an entry exists with this ASIN, it is returned
    * @async
    * @param {string} id Object ID
    * @returns {Promise<Product>}
    */
    async getById(id) {
        return new Promise((_resolve, _reject) => {
            this.get(id)
                .then((_prod) => {
                    if (_prod) {
                        if (SETTINGS.DebugLevel > 10) console.info(`got object with ID "${id}": "${_prod}"`);
                        _resolve(_prod);
                    } else {
                        const _data_asin = id.split('#')[1];
                        if (SETTINGS.DebugLevel > 1) console.debug(`object with ID "${id}" not found, trying to get it with ASIN "${_data_asin}"`);
                        this.getByASIN(_data_asin)
                            .then((_prod) => {
                                if (_prod) {
                                    if (SETTINGS.DebugLevel > 1) console.debug(`got object with ID "${id}" and ASIN "${_data_asin}": "${_prod}"`);
                                // } else {
                                //     console.warn(`object with ID "${id}" and ASIN "${_data_asin}" not found`);
                                }

                                _resolve(_prod);
                            })
                            .catch((_error) => {
                                console.error(`failed to get object with ID "${id}" and ASIN "${_data_asin}": "${_error}"`);
                                _reject(_error)
                            });
                    }
                })
                .catch((_error) => {
                    console.error(`failed to get object with ID "${id}": "${_error}"`);
                    _reject(_error)
                });
        });
    };

    /**
    * Get Object by ASIN
    * @async
    * @param {string} asin ASIN
    * @returns {Promise<Product>}
    */
    async getByASIN(asin) {
        return new Promise((resolve, reject) => {
            if (typeof (asin) != 'string') reject('DB_HANDLER.get(): asin is not defined or is not typeof string');

            const _index = this.#getStore().index('data_asin');
            const _request = _index.get(asin);
            _request.onerror = (event) => { reject(`DB_HANDLER.add(): ${event.target.error.name}`); };
            _request.onsuccess = (event) => { resolve(event.target.result); };
        })
    };

    /**
    * Update Object
    * @async
    * @param {object} obj Object to update
    * @returns {Promise<void>}
    */
    async update(obj) {
        return new Promise((resolve, reject) => {
            if (SETTINGS.DebugLevel > 1) console.log('Called DB_HANDLER:update()');
            if (typeof (obj) != 'object') reject('DB_HANDLER.update(): obj is not defined or is not type of object');
            // console.log('Called DB_HANDLER:update() Stage 2');

            const _request = this.#getStore(true).put(obj);
            // console.log('Called DB_HANDLER:update() Stage 3');

            _request.onerror = (event) => {
                // console.log('DB_HANDLER:update() --> had an Error');
                reject(event.target.error);
            };

            _request.onsuccess = (event) => {
                // console.log('Called DB_HANDLER:update() --> success');
                this.#fireDataChangedEvent();
                resolve();
            }
        })
    };

    /**
    * Query Database for Searchstring
    * @async
    * @param {(string|array)} query String to find
    * @returns {Promise<Product[]>}
    */
    async query(query) {
        return new Promise((resolve, reject) => {
            if (typeof (query) != 'string' && !Array.isArray(query)) reject('DB_HANDLER.query(): query is not defined or is not typeof string or array');

            const _request = this.#getStore().openCursor();
            const _result = [];

            // Use a Array of words for search
            const _keys = (typeof (query) == 'string') ? [query] : query;
            for (let _key of _keys) { _key = _key.toLowerCase(); }

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;
                if (_cursor) {
                    const _descriptionFull = (_cursor.value.description_full || '').toLowerCase();

                    if (_keys.every((_key) => _descriptionFull.includes(_key))) {
                        _result.push(_cursor.value);
                    }

                    _cursor.continue();

                } else { // No more entries
                    resolve(_result);
                }
            };

            _request.onerror = (event) => {
                reject('Error querying records:', event.target.error.name);
            };
        })
    };


    /**
     * Get all keys from Database
     * @async
     * @returns {Promise<string[]>}
     */
    async getAllKeys() {
        return new Promise((resolve, reject) => {
            const _request = this.#getStore().getAllKeys();
            _request.onsuccess = (event) => { resolve(event.target.result); };
            _request.onerror = (event) => { reject(`DB_HANDLER.getAllKeys(): ${event.target.error.name}`) };
        })
    };

    /**
     * Get all new "unseen" products from Database
     * @async
     * @returns {Promise<Product[]>}
     */
    async getNewEntries() {
        return new Promise((resolve, reject) => {
            const _result = [];
            const _onlyTrue = IDBKeyRange.only(1);
            const _request = this.#getStore().index('isNew').openCursor(_onlyTrue);

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;

                if (_cursor) {
                    _result.push(_cursor.value);
                    _cursor.continue();
                } else { // No more entries
                    resolve(_result);
                }
            };
            _request.onerror = (event) => { reject(`DB_HANDLER.getNewEntries(): ${event.target.error.name}`); };
        })
    };

    /**
     * Get all Favorite products from Database
     * @async
     * @returns {Promise<Product[]>}
     */
    async getFavEntries(cb) {
        return new Promise((resolve, reject) => {
            const _result = [];
            const _onlyTrue = IDBKeyRange.only(1);
            const _request = this.#getStore().index('isFav').openCursor(_onlyTrue);

            _request.onsuccess = (event) => {
                const _cursor = event.target.result;

                if (_cursor) {
                    _result.push(_cursor.value);
                    _cursor.continue();
                } else { // No more entries
                    resolve(_result);
                }
            };
            _request.onerror = (event) => { reject(`DB_HANDLER.getFavEntries(): ${event.target.error.name}`); };
        })
    };

    /**
     * Get all the Objects stored in our DB
     * @returns {Promise<Product[]>}
     */
    getAll() {
        return new Promise((resolve, reject) => {
            const _request = this.#getStore().getAll();
            _request.onsuccess = (event) => { resolve(event.target.result); };
            _request.onerror = (event) => { reject(`DB_HANDLER.getAll(): ${event.target.error.name}`); };
        })
    }

    /**
    * Removes Object with given ID from Database
    * @async
    * @param {string} id Object ID
    * @returns {Promise<void>}
    */
    async removeID(id) {
        return new Promise((resolve, reject) => {
            if (typeof (id) != 'string') (reject('DB_HANDLER.removeID(): id is not defined or is not typeof string'));

            const _request = this.#getStore(true).delete(id);
            _request.onsuccess = (event) => {
                resolve();
                this.#fireDataChangedEvent();
            };
            _request.onerror = (event) => { reject(`DB_HANDLER.removeID(): ${event.target.error.name}`); };
        })
    };

    /**
     * Imports the database, i.e. delete all existing entries and add new ones
     * @async
    * @returns {Promise<void>}
     */
    async import(datas) {
        return new Promise((resolve, reject) => {
            if (datas === null) {
                reject('DB_HANDLER.import(): datas is null');
            }

            if (typeof datas[Symbol.iterator] !== 'function') {
                reject('DB_HANDLER.import(): datas is not iterable');
            }

            const _store = this.#getStore(true);
            const _clearRequest = _store.clear();
            _clearRequest.onsuccess = () => {
                let _addRequest;
                for (const data of datas) {
                    _addRequest = _store.add(data);
                    _addRequest.onerror = (event) => { reject(`DB_HANDLER.import().add(): ${event.target.error.name}`); };
                }
                if (_addRequest){
                    _addRequest.onsuccess = () => {
                        resolve();
                    }
                } else{
                    resolve();
                }
            };

            _clearRequest.onerror = (event) => { reject(`DB_HANDLER.import().clear(): ${event.target.error.name}`); };
        })
    }

    /**
    * Returns the total number of records.
    * @async
    * @returns {Promise<Number>}
    */
    async count() {
        return new Promise((resolve, reject) => {
            const _request = this.#getStore().count();
            _request.onsuccess = (event) => { resolve(event.target.result); };
            _request.onerror = (event) => { reject(`DB_HANDLER.count(): ${event.target.error.name}`); };
        });
    }

    /**
    * Deletes the entire database.
    * @async
    * @returns {Promise<void>}
    */
    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.#dbName);

            deleteRequest.onerror = (event) => {
                reject(event);
                console.error(event);
                throw new Error('Error deleting the database');
            };

            deleteRequest.onsuccess = () => {
                this.#db = null; // Reset the reference to the database
                resolve();
            };
        });
    }
}