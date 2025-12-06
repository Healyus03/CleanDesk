/**
 * main.js
 * Main entry point for the Electron application
 * Orchestrates all application modules and handles app lifecycle
 */

// Handle Squirrel events (installation, updates, uninstallation) on Windows
if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app } = require('electron');
const path = require('path');

// Import custom modules
const SquirrelHandler = require('./main/squirrel');
const DataStore = require('./main/dataStore');
const Organizer = require('./main/organizer');
const WatcherManager = require('./main/watchers');
const TrayManager = require('./main/tray');
const WindowManager = require('./main/window');
const IPCManager = require('./main/ipc');

// Handle Squirrel events on Windows
if (SquirrelHandler.handleSquirrelEvent()) {
    process.exit(0);
}

// Initialize managers
const dataStore = new DataStore(app);
const trayManager = new TrayManager();
const windowManager = new WindowManager(app);

let organizer = null;
let watcherManager = null;
let ipcManager = null;

// Ensure the app does not quit when all windows are closed
app.on('window-all-closed', () => {
    // Keep running in background (tray)
});

// Set quitting flag when app is about to quit
app.on('before-quit', () => {
    trayManager.setQuitting(true);
});

/**
 * Stop all auto-organize watchers
 */
async function stopAllAuto() {
    try {
        await watcherManager.stopAutoOrganize(
            null,
            windowManager.getWindow(),
            updateTrayMenu
        );
    } catch (e) {
        console.error('stopAllAuto error', e);
    }
}

/**
 * Start auto-organize from watched folders list
 */
async function startAutoFromWatched() {
    await watcherManager.startAutoFromWatched(
        windowManager.getWindow(),
        updateTrayMenu
    );
}

/**
 * Update tray menu to reflect current state
 */
function updateTrayMenu() {
    const autoOn = watcherManager.isAutoRunning();
    trayManager.updateTrayMenu(autoOn);
}

/**
 * Show or create the main window
 */
function showWindow() {
    if (!windowManager.hasWindow()) {
        createWindow();
    } else {
        windowManager.showWindow();
    }
}

/**
 * Toggle auto-organize on/off
 */
async function toggleAutoOrganize() {
    try {
        const autoOn = watcherManager.isAutoRunning();
        if (autoOn) {
            await stopAllAuto();
        } else {
            await startAutoFromWatched();
        }
    } catch (e) {
        console.error('Failed to toggle auto-organize from tray', e);
    }
    updateTrayMenu();
}

/**
 * Quit the application
 */
function quitApp() {
    trayManager.setQuitting(true);
    app.quit();
}

/**
 * Create the main application window
 */
function createWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');
    const iconPath = path.join(__dirname, 'CleanDesk.ico');
    windowManager.createWindow(preloadPath, iconPath, trayManager);
}

/**
 * Create system tray icon
 */
function createTray() {
    const iconPath = path.join(__dirname, 'CleanDesk.ico');
    trayManager.createTray(iconPath, showWindow, toggleAutoOrganize, quitApp);
    updateTrayMenu();
}

/**
 * Check if app should start hidden
 */
function shouldStartHidden() {
    let startedHidden;
    try {
        const loginSettings = app.getLoginItemSettings ? app.getLoginItemSettings() : {};
        const settingsArgs = Array.isArray(loginSettings.args) ? loginSettings.args : [];
        startedHidden = process.argv.includes('--hidden') || settingsArgs.includes('--hidden');
    } catch (e) {
        startedHidden = process.argv.includes('--hidden');
    }
    return startedHidden;
}

/**
 * Initialize the application when ready
 */
app.whenReady().then(() => {
    // Initialize data store and ensure data files exist
    dataStore.initialize();
    dataStore.ensureDataFiles();

    // Initialize organizer with file paths
    organizer = new Organizer(
        dataStore.getRulesFile(),
        dataStore.getLogFile(),
        dataStore.getWatchedFile()
    );

    // Ensure rules have IDs
    organizer.ensureRulesHaveIds();

    // Initialize watcher manager
    watcherManager = new WatcherManager(organizer);

    // Initialize IPC manager
    ipcManager = new IPCManager(organizer, watcherManager, app);
    ipcManager.registerHandlers(windowManager, updateTrayMenu);

    // Create the tray
    createTray();

    // Check if should start hidden
    if (!shouldStartHidden()) {
        // Normal interactive start: show the window
        createWindow();
    } else {
        // Hidden start: run quietly in background with tray only
        startAutoFromWatched();
    }
});

