/**
 * squirrel.js
 * Handles Squirrel events for Windows installer
 */

const path = require('path');
const { spawn } = require('child_process');

class SquirrelHandler {
    /**
     * Handle Squirrel events on Windows
     * Returns true if a Squirrel event was handled (app should quit)
     */
    static handleSquirrelEvent() {
        if (process.platform !== 'win32') {
            return false;
        }

        if (process.argv.length === 1) {
            return false;
        }

        const appFolder = path.resolve(process.execPath, '..');
        const rootAtomFolder = path.resolve(appFolder, '..');
        const updateDotExe = path.resolve(rootAtomFolder, 'Update.exe');
        const exeName = path.basename(process.execPath);

        const spawnUpdate = function(args) {
            let spawnedProcess;
            try {
                spawnedProcess = spawn(updateDotExe, args, { detached: true });
            } catch (error) {
                console.error('Spawn error:', error);
            }
            return spawnedProcess;
        };

        const squirrelEvent = process.argv[1];
        switch (squirrelEvent) {
            case '--squirrel-install':
            case '--squirrel-updated':
                // Create shortcuts on install/update
                spawnUpdate(['--createShortcut', exeName]);
                setTimeout(() => process.exit(0), 1000);
                return true;

            case '--squirrel-uninstall':
                // Remove shortcuts on uninstall
                spawnUpdate(['--removeShortcut', exeName]);
                setTimeout(() => process.exit(0), 1000);
                return true;

            case '--squirrel-obsolete':
                // Called when installer is done with old version
                process.exit(0);
                return true;
        }

        return false;
    }
}

module.exports = SquirrelHandler;

