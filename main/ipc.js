/**
 * ipc.js
 * IPC communication handlers between main and renderer processes
 */

const { ipcMain, dialog } = require('electron');

class IPCManager {
    constructor(organizer, watcherManager, app) {
        this.organizer = organizer;
        this.watcherManager = watcherManager;
        this.app = app;
    }

    /**
     * Register all IPC handlers
     */
    registerHandlers(windowManager, updateTrayMenuFn) {
        // Load rules
        ipcMain.handle("load-rules", async () => {
            return this.organizer.loadRules();
        });

        // Save rules
        ipcMain.handle("save-rules", async (_, rules) => {
            return this.organizer.saveRules(rules);
        });

        // Organize files in a folder
        ipcMain.handle("organize-files", async (_, folderPath) => {
            return await this.organizer.organizeFolder(folderPath);
        });

        // Load log
        ipcMain.handle("load-log", async () => {
            return this.organizer.loadLog();
        });

        // Select folder dialog
        ipcMain.handle("select-folder", async () => {
            const result = await dialog.showOpenDialog({
                properties: ["openDirectory"]
            });
            if (result.canceled) return null;
            return result.filePaths[0];
        });

        // Load watched folders
        ipcMain.handle("load-watched", async () => {
            return this.organizer.readWatched();
        });

        // Save watched folders
        ipcMain.handle("save-watched", async (_, watched) => {
            this.organizer.writeWatched(watched);
            return true;
        });

        // Start auto-organize
        ipcMain.handle("start-auto-organize", async (_, folderPath, intervalMs = 5000) => {
            const mainWindow = windowManager.getWindow();

            if (!folderPath) {
                // Start for all watched folders
                const watchedList = this.organizer.readWatched();
                if (!Array.isArray(watchedList) || watchedList.length === 0) return false;

                let anyStarted = false;
                for (const w of watchedList) {
                    if (w && (typeof w.enabled === 'undefined' || w.enabled === true) && w.path) {
                        try {
                            const ok = await this.watcherManager.startAutoForPath(
                                w.path,
                                intervalMs,
                                mainWindow,
                                updateTrayMenuFn
                            );
                            if (ok) anyStarted = true;
                        } catch (e) {
                            console.error('Error starting auto-organize:', e);
                        }
                    }
                }
                this.watcherManager.emitAutoRunning(mainWindow, updateTrayMenuFn);
                return anyStarted;
            }

            // Start for specific folder
            const watchedList = this.organizer.readWatched();
            const folderEntry = watchedList.find(w => w.path === folderPath);
            if (folderEntry && folderEntry.enabled === false) {
                return false;
            }

            const res = await this.watcherManager.startAutoForPath(
                folderPath,
                intervalMs,
                mainWindow,
                updateTrayMenuFn
            );
            this.watcherManager.emitAutoRunning(mainWindow, updateTrayMenuFn);
            return res;
        });

        // Stop auto-organize
        ipcMain.handle("stop-auto-organize", async (_, folderPath) => {
            const mainWindow = windowManager.getWindow();
            return await this.watcherManager.stopAutoOrganize(
                folderPath,
                mainWindow,
                updateTrayMenuFn
            );
        });

        // Get currently running auto-organize watchers
        ipcMain.handle('get-auto-running', async () => {
            return this.watcherManager.getRunningWatchers();
        });

        // Get autostart enabled status
        ipcMain.handle('get-autostart-enabled', async () => {
            try {
                const settings = this.app.getLoginItemSettings();
                return settings.openAtLogin;
            } catch (err) {
                return false;
            }
        });

        // Set autostart enabled
        ipcMain.handle('set-autostart-enabled', async (_, enabled) => {
            try {
                if (enabled) {
                    this.app.setLoginItemSettings({
                        openAtLogin: true,
                        openAsHidden: true,
                        path: process.execPath,
                        args: ['--hidden']
                    });
                } else {
                    this.app.setLoginItemSettings({
                        openAtLogin: false,
                        path: process.execPath,
                        args: []
                    });
                }
                return true;
            } catch (err) {
                console.error('Failed to set autostart:', err);
                return false;
            }
        });
    }
}

module.exports = IPCManager;

