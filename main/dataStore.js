/**
 * dataStore.js
 * Manages data directory and file paths for the application
 */

const fs = require('fs');
const path = require('path');

class DataStore {
    constructor(app) {
        this.app = app;
        this.DATA_DIR = null;
        this.RULES_FILE = null;
        this.LOG_FILE = null;
        this.WATCHED_FILE = null;
    }

    /**
     * Initialize data directory and file paths
     */
    initialize() {
        this.DATA_DIR = path.join(this.app.getPath('userData'), 'data');
        this.RULES_FILE = path.join(this.DATA_DIR, 'rules.json');
        this.LOG_FILE = path.join(this.DATA_DIR, 'log.json');
        this.WATCHED_FILE = path.join(this.DATA_DIR, 'watched.json');
    }

    /**
     * Ensure all data files exist with default content
     */
    ensureDataFiles() {
        if (!fs.existsSync(this.DATA_DIR)) {
            fs.mkdirSync(this.DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(this.RULES_FILE)) {
            fs.writeFileSync(this.RULES_FILE, JSON.stringify([]));
        }
        if (!fs.existsSync(this.LOG_FILE)) {
            fs.writeFileSync(this.LOG_FILE, JSON.stringify([]));
        }
        if (!fs.existsSync(this.WATCHED_FILE)) {
            fs.writeFileSync(this.WATCHED_FILE, JSON.stringify({ watched: [] }, null, 2));
        }
    }

    /**
     * Get the rules file path
     */
    getRulesFile() {
        return this.RULES_FILE;
    }

    /**
     * Get the log file path
     */
    getLogFile() {
        return this.LOG_FILE;
    }

    /**
     * Get the watched folders file path
     */
    getWatchedFile() {
        return this.WATCHED_FILE;
    }

    /**
     * Get the data directory path
     */
    getDataDir() {
        return this.DATA_DIR;
    }
}

module.exports = DataStore;

