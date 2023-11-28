console.log('loaded class_rdb_handler.js');
class RDB_HANDLER {
    #dbName;
    #ramDB;
    #needsSaveToStorage = false;

    /**
    * Db Handler to easy use of RamDB with GM PermaStore
    * @constructor
    * @param {string} dbName Name your Database
    * @param {function} [cb] Callback function executes when database initialisation is done
    * @return {DB_HANDLER} DBHANDLER Object
    */ 
    constructor(dbName, cb = (sucess) => {}) {
        if (!dbName) throw new Error(`CLASS DB_HANDLER needs a name for the database to init: exampe:  const db = new DB_HANDLER('AnyName')`);
        this.#dbName = dbName
        this.#init(cb);
    }

    // Private Init
    async #init(cb) {
       GM.getValue(this.#dbName, new Object).then((data) => {
            this.#ramDB = data;
            cb(true);
       });
    };

    /**
    * Add Object to Database
    * @async
    * @param {object} dbName Name your Database
    * @param {function} [cb] Callback function executes when database is successfull created
    */ 
    async add(obj, cb = () => {}) {
        if (typeof(obj) != 'object') throw new Error('RDB_HANDLER.add(): obj is not defined or is not type of object');
        if (typeof(obj.id) != 'string') throw new Error('RDB_HANDLER.add(): Object is no valid Product');

        this.#ramDB[obj.id] = obj;
        this.#needsSaveToStorage = true;
        cb(true);
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
        cb((this.#ramDB[id] || false));
    };

    /**
    * Update Object
    * @async
    * @param {object} obj Object to update
    * @param {function} [cb] Callback function executes when object update is done
    */ 
    async update(obj, cb = () => {}){
        if (typeof(obj) != 'object') throw new Error('RDB_HANDLER.add(): obj is not defined or is not type of object');
        if (typeof(obj.id) != 'string') throw new Error('RDB_HANDLER.add(): Object is no valid Product');

        this.#ramDB[obj.id] = obj;
        this.#needsSaveToStorage = true;
        cb(true);
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
        const _res = [];
        
        this.getAllKeys((keys) => {
            const _keysLength = keys.length;
            const _queryLower = queryTxt.toLowerCase();

            for (let i = 0; i < _keysLength; i++) {
                const _currObj = this.#ramDB[keys[i]];
                
                const _descriptionFull = (_currObj.description_full || '').toLowerCase();

                if (_descriptionFull.includes(_queryLower)) {
                    _res.push(_currObj);
                }
            }
            cb(_res);
        });
    };


   /**
    * Get all keys from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getAllKeys(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getAllKeys(): cb is not defined or is not typeof function');
        cb(Object.keys(this.#ramDB));
    };


   /**
    * Get all new "unseen" products from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getNewEntries(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getNewEntries(): cb is not defined or is not typeof function');
        const _res = [];
        
        this.getAllKeys((keys) => {
            const _keysLength = keys.length;

            for (let i = 0; i < _keysLength; i++) {
                const _currObj = this.#ramDB[keys[i]];
                if (_currObj.isNew) {_res.push(_currObj);}
            }
            cb(_res);
        });
    };

   /**
    * Get all Favorite products from Database
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getFavEntries(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getNewEntries(): cb is not defined or is not typeof function');
        const _res = [];
        
        this.getAllKeys((keys) => {
            const _keysLength = keys.length;

            for (let i = 0; i < _keysLength; i++) {
                const _currObj = this.#ramDB[keys[i]];
                if (_currObj.isFav) {_res.push(_currObj);}
            }
            cb(_res);
        });
    };
    
   /**
    * Get all the Objects stored in our DB
    * @async
    * @param {function} cb Callback function executes when database query is done
    */     
    async getAll(cb){
        if (typeof(cb) != 'function') throw new Error('DB_HANDLER.getAll(): cb is not defined or is not typeof function');
        const _res = [];
        
        this.getAllKeys((keys) => {
            const _keysLength = keys.length;

            for (let i = 0; i < _keysLength; i++) {
                const _currObj = this.#ramDB[keys[i]];
                if (_currObj) {_res.push(_currObj);}
            }
            cb(_res);
        });
    };

    /**
    * Removes Object with given ID from Database
    * @async
    * @param {string} id Object ID
    * @param {function} [cb] Callback function executes when database query is done returns result or undefined
    */ 
    async removeID(id, cb){
        if (typeof(id) != 'string') throw new Error('DB_HANDLER.removeID(): id is not defined or is not typeof string');
        
        if (this.#ramDB[id]) {
            delete this.#ramDB[id];
            cb(true);
        } else {
            cb();
        }
    };

    #saveInProcess = false;
    #saveLoop = setInterval(() => {
        if (!this.#saveInProcess && this.#needsSaveToStorage){
            this.#saveInProcess = true;
            GM.setValue(this.#dbName, this.#ramDB).then((data) => {this.#needsSaveToStorage = false; this.#saveInProcess = false;});
        }
    }, 2000);
}




