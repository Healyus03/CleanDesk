/**
 * watchers.js
 * Manages file system watchers for auto-organize functionality
 */

const fs = require('fs');

class WatcherManager {
    constructor(organizer) {
        this.organizer = organizer;
        this.watchers = new Map();
    }

    /**
     * Emit auto-organize log to renderer
     */
    emitAutoLog(mainWindow, folderPath, log) {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auto-organize-log', { folderPath, log });
        }
    }

    /**
     * Emit currently running watchers to renderer and update tray
     */
    emitAutoRunning(mainWindow, updateTrayMenuFn) {
        try {
            const paths = Array.from(this.watchers.keys());
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('auto-running-changed', paths);
            }
        } catch (e) {
            console.error('Error emitting auto-running:', e);
        }
        // Update the tray menu to reflect running state
        try {
            if (updateTrayMenuFn) updateTrayMenuFn();
        } catch (e) {}
    }

    /**
     * Start auto-organize for a specific folder path
     */
    async startAutoForPath(folderPath, intervalMs = 5000, mainWindow = null, updateTrayMenuFn = null) {
        if (this.watchers.has(folderPath)) {
            return true;
        }

        if (!fs.existsSync(folderPath)) {
            return false;
        }

        const state = { watcher: null, debounceTimer: null, autoInterval: null };

        const runAndEmit = async () => {
            const log = await this.organizer.organizeFolder(folderPath);
            this.emitAutoLog(mainWindow, folderPath, log);
        };

        try {
            const chokidar = require('chokidar');

            const watcher = chokidar.watch(folderPath, {
                ignoreInitial: true,
                depth: 0,
                awaitWriteFinish: {
                    stabilityThreshold: 800,
                    pollInterval: 100
                }
            });

            const trigger = () => {
                if (state.debounceTimer) clearTimeout(state.debounceTimer);
                state.debounceTimer = setTimeout(() => {
                    runAndEmit();
                    state.debounceTimer = null;
                }, 400);
            };

            watcher.on('add', trigger);
            watcher.on('change', trigger);
            watcher.on('addDir', trigger);
            watcher.on('unlink', trigger);

            await runAndEmit();

            state.watcher = watcher;
            this.watchers.set(folderPath, state);
            this.emitAutoRunning(mainWindow, updateTrayMenuFn);
            return true;
        } catch (err) {
            // Fallback to polling if chokidar is not available
            const runOnce = async () => { await runAndEmit(); };
            runOnce();
            state.autoInterval = setInterval(runOnce, intervalMs);
            this.watchers.set(folderPath, state);
            this.emitAutoRunning(mainWindow, updateTrayMenuFn);
            return true;
        }
    }

    /**
     * Start auto-organize for all watched folders
     */
    async startAutoFromWatched(mainWindow = null, updateTrayMenuFn = null) {
        try {
            const watchedList = this.organizer.readWatched();
            if (!Array.isArray(watchedList) || watchedList.length === 0) return;

            for (const w of watchedList) {
                if (w && (typeof w.enabled === 'undefined' || w.enabled === true) && w.path) {
                    try {
                        await this.startAutoForPath(w.path, 5000, mainWindow, updateTrayMenuFn);
                    } catch (e) {
                        console.error('Failed to start watcher for', w.path, e);
                    }
                }
            }
        } catch (e) {
            console.error('startAutoFromWatched error', e);
        }
        // Ensure UI/menu is updated when watchers start
        this.emitAutoRunning(mainWindow, updateTrayMenuFn);
    }

    /**
     * Stop auto-organize for a specific folder or all folders
     */
    async stopAutoOrganize(folderPath = null, mainWindow = null, updateTrayMenuFn = null) {
        if (folderPath) {
            const state = this.watchers.get(folderPath);
            if (!state) return true;

            try {
                if (state.watcher) await state.watcher.close();
            } catch (e) {}

            if (state.debounceTimer) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = null;
            }
            if (state.autoInterval) {
                clearInterval(state.autoInterval);
                state.autoInterval = null;
            }
            this.watchers.delete(folderPath);
            this.emitAutoRunning(mainWindow, updateTrayMenuFn);
            return true;
        }

        // Stop all watchers
        for (const [p, state] of this.watchers.entries()) {
            try {
                if (state.watcher) await state.watcher.close();
            } catch (e) {}
            if (state.debounceTimer) clearTimeout(state.debounceTimer);
            if (state.autoInterval) clearInterval(state.autoInterval);
            this.watchers.delete(p);
        }
        this.emitAutoRunning(mainWindow, updateTrayMenuFn);
        return true;
    }

    /**
     * Get list of currently running watchers
     */
    getRunningWatchers() {
        try {
            return Array.from(this.watchers.keys());
        } catch (err) {
            return [];
        }
    }

    /**
     * Check if any watchers are currently running
     */
    isAutoRunning() {
        return this.watchers && this.watchers.size > 0;
    }
}

module.exports = WatcherManager;

