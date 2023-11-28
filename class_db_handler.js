console.log('loaded db_handler.js');
class DB_HANDLER {
    #version = 2;
    #dbName;
    #storeName;
    #db;

    /**
    * Db Handler to easy use of IndexedDB Object Store Databases
    * @constructor
    * @param {string} dbName Name your Database
    * @param {string} [storeName] Object Store Name
    * @param {function} [cb] Callback function executes when database initialisation is done
    * @return {DB_HANDLER} DBHANDLER Object
    */ 
    constructor(dbName, storeName, cb = (sucess, err) => {}) {
        if (!dbName) throw new Error(`CLASS DB_HANDLER needs a name for the database to init: exampe:  const db = new DB_HANDLER('AnyName')`);
        this.#dbName = dbName
        this.#storeName = storeName || dbName + '_ObjectStore';
        this.#init(cb);
    }

    // Private Init
    async #init(cb) {
       const _request = indexedDB.open(this.#dbName, this.#version);
       const _storeName = this.#storeName; // private class variable is not accessable inside _request functions
        
        _request.onerror = (event) => {
            cb(undefined, true)
            throw new Error(event);
        }

        _request.onsuccess = (event) => {
            this.#db = event.target.result;
            cb(event.target.result);
        }

        _request.onupgradeneeded = function (event) {
            console.log(`DB_HANDLER: Database has to be created or Updated`);
            
            const _req = event.target;
            const _db = _req.result;

            if (!_db.objectStoreNames.contains(_storeName)) {
                if (SETTINGS.DebugLevel > 0) console.log('Database needs to be created...');
                const _storeOS = _db.createObjectStore(_storeName, { keyPath: 'id' });
                _storeOS.createIndex('isNew', 'isNew', { unique: false });
                _storeOS.createIndex('isFav', 'isFav', { unique: false });
            } else {
                // Get a reference to the implicit transaction for this request
                // @type IDBTransaction
                const _transaction = _req.transaction;

                // Now, get a reference to the existing object store
                // @type IDBObjectStore
                const _store = _transaction.objectStore(_storeName);

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

    /**
    * Get Object Store Object
    * @param {boolean} [rw] Set to true if u want to create a writeable access
    * @return {object} Object Store Object
    */
    #getStore(rw = false) {
        if (!this.#db) throw new Error('DB_HANDLER.#getStore: Database Object is not defined');
        const _transaction = this.#db.transaction([this.#storeName], (rw) ? 'readwrite':'readonly');
        const _store = _transaction.objectStore(this.#storeName);
        return _store;
    }

    /**
    * Add Object to Database
    * @async
    * @param {object} dbName Name your Database
    * @param {function} [cb] Callback function executes when database is successfull created
    */ 
    async add(obj, cb = () => {}) {
        if (typeof(obj) != 'object') throw new Error('DB_HANDLER.add(): obj is not defined or is not type of object');

        const _request = this.#getStore(true).add(obj);

        _request.onerror = function (event) {
            throw new Error(`DB_HANDLER.add(): ${event.target.error.name}`);
        };
        
        _request.onsuccess = function (event) {
            cb(true);
        };
    };

    /**
    * Get Object by ID
    * @async
    * @param {string} id Object ID
    * @param {function} cb Callback function executes when database query is done returns result or undefined
    */ 
    async get(id, cb){
        if (typeof(id) != 'string') throw new Error('DB_HANDLER.get(): id is not defined or is not typeof string');
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.get(): cb is not defined or is not typeof function');
        
        const _request = this.#getStore().get(id)
        _request.onerror = (event) => {cb(); throw new Error(`DB_HANDLER.add(): ${event.target.error.name}`);};
        _request.onsuccess = (event) => {cb(event.target.result);};
    };

    /**
    * Update Object
    * @async
    * @param {object} obj Object to update
    * @param {function} [cb] Callback function executes when object update is done
    */ 
    async update(obj, cb){
        console.log('Called DB_HANDLER:update()');
        if (typeof(obj) != 'object') throw new Error('DB_HANDLER.update(): obj is not defined or is not type of object');
        console.log('Called DB_HANDLER:update() Stage 2');

        const _request = this.#getStore(true).put(obj);
        console.log('Called DB_HANDLER:update() Stage 3');

        _request.onerror = (event) => {
            console.log('DB_HANDLER:update() --> had an Error');
            cb(); 
            throw new Error(`DB_HANDLER.update(): ${event.target.error.name}`)
            ;};
        _request.onsuccess = (event) => {
            console.log('Called DB_HANDLER:update() --> success');
            cb(true);
        }
    };

    /**
    * Query Database for Searchstring
    * @async
    * @param {string} queryText String to find
    * @param {function} cb Callback function executes when database query is done
    */ 
    async query(queryTxt, cb){
        if (typeof(queryTxt) != 'string') throw new Error('DB_HANDLER.query(): queryText is not defined or is not typeof string');
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.query(): cb is not defined or is not typeof function');

        const _request = this.#getStore().openCursor();
        const _result = [];

        _request.onsuccess = (event) => {
            const _cursor = event.target.result;

            if (_cursor) {
                const _descriptionFull = (_cursor.value.description_full || '').toLowerCase();
                const _queryLower = queryTxt.toLowerCase();

                if (_descriptionFull.includes(_queryLower)) {
                    _result.push(_cursor.value);
                }

                _cursor.continue();

            } else { // No more entries
                cb(_result);
            }
        };

        _request.onerror = (event) => {
            console.error('Error querying records:', event.target.error.name);
            cb([]);
        };
    };


   /**
    * Get all keys from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getAllKeys(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getAllKeys(): cb is not defined or is not typeof function');

        const _request = this.#getStore().getAllKeys();
        _request.onsuccess = (event) => {cb(event.target.result);};
        _request.onerror = (event) => {cb([]); throw new Error(`DB_HANDLER.getAllKeys(): ${event.target.error.name}`)};
    };


   /**
    * Get all new "unseen" products from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getNewEntries(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getNewEntries(): cb is not defined or is not typeof function');
        const _result = [];
        const _request = this.#getStore().openCursor();

        _request.onsuccess = (event) => {
            const _cursor = event.target.result;

            if (_cursor) {
                if (_cursor.value.isNew) {
                    _result.push(_cursor.value);
                }

                _cursor.continue();
            } else { // No more entries
                cb(_result);
            }
        };
        _request.onerror = (event) => {cb([]); throw new Error(`DB_HANDLER.getNewEntrys(): ${event.target.error.name}`);};
    };

   /**
    * Get all Favorite products from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getFavEntries(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getNewEntries(): cb is not defined or is not typeof function');
        const _result = [];
        const _request = this.#getStore().openCursor();

        _request.onsuccess = (event) => {
            const _cursor = event.target.result;

            if (_cursor) {
                if (_cursor.value.isFav) {
                    _result.push(_cursor.value);
                }

                _cursor.continue();
            } else { // No more entries
                cb(_result);
            }
        };
        _request.onerror = (event) => {cb([]); throw new Error(`DB_HANDLER.getNewEntrys(): ${event.target.error.name}`);};
    };
    
   /**
    * Get all the Objects stored in our DB
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getAll(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getAll(): cb is not defined or is not typeof function');
        const _result = [];
        const _request = this.#getStore().openCursor();

        _request.onsuccess = (event) => {
            const _cursor = event.target.result;
            if (_cursor) {
                _result.push(_cursor.value);
                _cursor.continue();
            } else { // No more entries
                cb(_result);
            }
        };

        _request.onerror = (event) => {cb([]); throw new Error(`DB_HANDLER.getAll(): ${event.target.error.name}`);};
    };

    /**
    * Removes Object with given ID from Database
    * @async
    * @param {string} id Object ID
    * @param {function} [cb] Callback function executes when database query is done returns result or undefined
    */ 
    async removeID(id, cb){
        if (typeof(id) != 'string') throw new Error('DB_HANDLER.removeID(): id is not defined or is not typeof string');

        const _request = this.#getStore(true).delete(id);
        _request.onsuccess = (event) => {
            cb(true);
        };

        _request.onerror = (event) => {cb(); throw new Error(`DB_HANDLER.removeID(): ${event.target.error.name}`);};
    };
}




