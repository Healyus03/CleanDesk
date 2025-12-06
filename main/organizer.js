/**
 * organizer.js
 * Handles file organization logic and rule management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Organizer {
    constructor(rulesFile, logFile, watchedFile) {
        this.RULES_FILE = rulesFile;
        this.LOG_FILE = logFile;
        this.WATCHED_FILE = watchedFile;
    }

    /**
     * Ensure all rules have unique IDs and enabled flags
     */
    ensureRulesHaveIds() {
        try {
            let rules = JSON.parse(fs.readFileSync(this.RULES_FILE));
            let changed = false;
            rules = rules.map((r, idx) => {
                const copy = Object.assign({}, r);
                if (!copy.id) {
                    copy.id = copy.name
                        ? `${copy.name.replace(/\s+/g, '_')}_${idx}`
                        : `rule_${idx + 1}_${crypto.randomBytes(4).toString('hex')}`;
                    changed = true;
                }
                if (typeof copy.enabled === 'undefined') {
                    copy.enabled = true;
                    changed = true;
                }
                return copy;
            });
            if (changed) {
                fs.writeFileSync(this.RULES_FILE, JSON.stringify(rules, null, 2));
            }
        } catch (e) {
            console.error('ensureRulesHaveIds error:', e);
        }
    }

    /**
     * Read rules from disk
     */
    loadRules() {
        this.ensureRulesHaveIds();
        return JSON.parse(fs.readFileSync(this.RULES_FILE));
    }

    /**
     * Save rules to disk
     */
    saveRules(rules) {
        fs.writeFileSync(this.RULES_FILE, JSON.stringify(rules, null, 2));
        return true;
    }

    /**
     * Read watched folders from disk
     */
    readWatched() {
        try {
            return JSON.parse(fs.readFileSync(this.WATCHED_FILE)).watched || [];
        } catch (err) {
            return [];
        }
    }

    /**
     * Save watched folders to disk
     */
    writeWatched(watched) {
        fs.writeFileSync(this.WATCHED_FILE, JSON.stringify({ watched }, null, 2));
    }

    /**
     * Load log entries from disk
     */
    loadLog() {
        return JSON.parse(fs.readFileSync(this.LOG_FILE));
    }

    /**
     * Check if a file matches a rule
     */
    _fileMatchesRule(fileName, rule) {
        const fileLower = (typeof fileName === 'string') ? fileName.toLowerCase() : '';
        let match = false;

        // Check file extension
        if (rule.type && typeof rule.type === 'string') {
            const ruleType = rule.type.toLowerCase();
            if (fileLower.endsWith(ruleType)) match = true;
        }

        // Check name pattern
        if (rule.namePattern && typeof rule.namePattern === 'string') {
            const rp = rule.namePattern.toLowerCase();
            if (fileLower.startsWith(rp)) match = true;
        }

        return match;
    }

    /**
     * Organize files in a folder based on rules
     */
    async organizeFolder(folderPath) {
        const rules = this.loadRules();
        const existingLog = this.loadLog();
        const newEntries = [];

        if (!fs.existsSync(folderPath)) {
            return existingLog;
        }

        const watchedList = this.readWatched();
        const folderEntry = watchedList.find(w => w.path === folderPath);

        // Skip if folder is disabled
        if (folderEntry && folderEntry.enabled === false) {
            return existingLog;
        }

        const overrides = (folderEntry && folderEntry.ruleOverrides) ? folderEntry.ruleOverrides : {};

        let files = [];
        try {
            files = fs.readdirSync(folderPath);
        } catch (err) {
            return existingLog;
        }

        // Process each file
        for (const file of files) {
            const fullPath = path.join(folderPath, file);

            // Skip non-files
            try {
                if (!fs.lstatSync(fullPath).isFile()) continue;
            } catch (err) {
                continue;
            }

            // Apply rules
            for (const rule of rules) {
                // Check if rule is enabled (globally or per-folder override)
                let enabled = !(rule.enabled === false);
                if (overrides && Object.prototype.hasOwnProperty.call(overrides, rule.id)) {
                    enabled = !!overrides[rule.id];
                }
                if (!enabled) continue;

                // Check if file matches rule
                if (this._fileMatchesRule(file, rule)) {
                    const destFolder = path.join(folderPath, rule.destination);

                    // Create destination folder if needed
                    if (!fs.existsSync(destFolder)) {
                        fs.mkdirSync(destFolder, { recursive: true });
                    }

                    // Move the file
                    try {
                        fs.renameSync(fullPath, path.join(destFolder, file));
                        const entry = {
                            file,
                            movedTo: rule.destination,
                            timestamp: new Date(),
                            folder: folderPath
                        };
                        newEntries.push(entry);
                    } catch (err) {
                        console.error('Error moving file:', err);
                    }
                    break; // Stop after first matching rule
                }
            }
        }

        // Update log
        const combined = existingLog.concat(newEntries);
        fs.writeFileSync(this.LOG_FILE, JSON.stringify(combined, null, 2));
        return combined;
    }
}

module.exports = Organizer;

