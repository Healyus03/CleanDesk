/*
Global script for the Electron main process.
Provides file-organization rules, watched-folder management, and auto-organize features.
Main functions and responsibilities:
- createWindow(): create the BrowserWindow and load the renderer URL.
- ensureRulesHaveIds(): migration helper to ensure rules have stable ids and enabled flags.
- readWatched()/writeWatched(): manage the persisted watched-folders list.
- organizeFolder(folderPath): apply rules to move files inside a folder and append to a log.
- emitAutoLog(folderPath, log): send auto-organize log entries to the renderer.
- emitAutoRunning(): notify renderer about currently active auto-organize paths.
- startAutoForPath(folderPath, intervalMs): start watching a folder using chokidar if available, otherwise poll. (fallback)
- IPC handlers: load/save rules, logs, select folder, load/save watched list, start/stop auto-organize, get-auto-running.
*/

// Handle Squirrel events (installation, updates, uninstallation) on Windows
// This will quit the app after handling installation/update events
if (require('electron-squirrel-startup')) {
  process.exit(0);
}

const { app, BrowserWindow, ipcMain, dialog } = require("electron");

// Additional Squirrel event handling for Windows installer
if (process.platform === 'win32') {
  const handleSquirrelEvent = () => {
    if (process.argv.length === 1) {
      return false;
    }

    const appFolder = require('path').resolve(process.execPath, '..');
    const rootAtomFolder = require('path').resolve(appFolder, '..');
    const updateDotExe = require('path').resolve(rootAtomFolder, 'Update.exe');
    const exeName = require('path').basename(process.execPath);

    const spawn = function(command, args) {
      let spawnedProcess;
      try {
        spawnedProcess = require('child_process').spawn(command, args, { detached: true });
      } catch (error) {
        console.error('Spawn error:', error);
      }
      return spawnedProcess;
    };

    const spawnUpdate = function(args) {
      return spawn(updateDotExe, args);
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
        // This is called when the installer is done with the old version
        process.exit(0);
        return true;
    }

    return false;
  };

  if (handleSquirrelEvent()) {
    // Squirrel event handled, app will quit
    process.exit(0);
  }
}
const path = require("path");
const fs = require("fs");
const crypto = require('crypto');
const { Tray, Menu, nativeImage } = require('electron');

let appTray = null;

// Stop all auto-organize watchers (used by tray toggle and IPC)
async function stopAllAuto() {
    try {
        for (const [p, state] of Array.from(watchers.entries())) {
            try { if (state.watcher) await state.watcher.close(); } catch (e) {}
            if (state.debounceTimer) clearTimeout(state.debounceTimer);
            if (state.autoInterval) clearInterval(state.autoInterval);
            watchers.delete(p);
        }
    } catch (e) {
        console.error('stopAllAuto error', e);
    }
    // Broadcast new state
    emitAutoRunning();
}

// Build/update the tray menu so it reflects whether auto-organize is running
function updateTrayMenu() {
    if (!appTray) return;
    const autoOn = (watchers && watchers.size > 0);

    const template = [
        {
            label: 'Show CleanDesk', click: () => {
                if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); }
            }
        },
        { type: 'separator' },
        {
            label: 'Auto-organize', type: 'checkbox', checked: autoOn, click: async () => {
                try {
                    if (autoOn) {
                        await stopAllAuto();
                    } else {
                        await startAutoFromWatched();
                    }
                } catch (e) {
                    console.error('Failed to toggle auto-organize from tray', e);
                }
                // Rebuild menu after toggling
                try { updateTrayMenu(); } catch (e) {}
            }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.quit(); } }
    ];

    try {
        const menu = Menu.buildFromTemplate(template);
        appTray.setContextMenu(menu);
    } catch (e) {
        console.error('Failed to set tray menu', e);
    }
}

function createTray() {
    // Use only the single dedicated Windows icon file in project root.
    const icoPath = path.join(__dirname, 'CleanDesk.ico');

    if (!fs.existsSync(icoPath)) {
        console.error('CleanDesk.ico not found at expected path:', icoPath);
        appTray = null;
        return;
    }

    let trayIconImage = null;
    try {
        trayIconImage = nativeImage.createFromPath(icoPath);
        if (!trayIconImage || trayIconImage.isEmpty()) {
            console.error('Loaded CleanDesk.ico but nativeImage is empty:', icoPath);
            appTray = null;
            return;
        }
    } catch (e) {
        console.error('Failed to create nativeImage from CleanDesk.ico:', e);
        appTray = null;
        return;
    }

    try {
        // For .ico files, keep their embedded sizes; do not attempt multi-fallback resizing.
        appTray = new Tray(trayIconImage);
    } catch (e) {
        console.error('Failed to create Tray from CleanDesk.ico:', e);
        appTray = null;
        return;
    }

    appTray.setToolTip('CleanDesk');
    appTray.on('double-click', () => {
        if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); }
    });

    // Initial population of tray menu
    updateTrayMenu();
}

let DATA_DIR;
let RULES_FILE;
let LOG_FILE;
let WATCHED_FILE;
let PACKAGED_DATA_DIR; // will be set during app.whenReady()

let mainWindow = null;
const watchers = new Map();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
            devTools: !app.isPackaged // disable DevTools in packaged builds
        }
    });

    // Load URL depending on whether the app is packaged or running in dev mode.
    // During development we run a CRA dev server at http://localhost:3000.
    // When packaged, the renderer build is included in the asar archive
    if (app.isPackaged) {
        // Use loadFile when packaged to avoid issues with file:// URL resolution
        mainWindow.loadFile(path.join(__dirname, 'renderer', 'build', 'index.html'))
            .catch(err => console.error('Failed to load packaged index.html', err));
    } else {
        mainWindow.loadURL('http://localhost:3000')
            .catch(err => console.error('Failed to load dev server at http://localhost:3000', err));
    }

    // Log any loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed to load:', validatedURL, errorCode, errorDescription);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Page loaded successfully');
        try { mainWindow.webContents.closeDevTools(); } catch (e) {}
    });
}

// Helper to create user data files if missing
function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, JSON.stringify([]));
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));
    if (!fs.existsSync(WATCHED_FILE)) fs.writeFileSync(WATCHED_FILE, JSON.stringify({ watched: [] }, null, 2));
}

// Migrate packaged data files (first-run): copy from app folder to userData if user files don't exist
function migratePackagedDataIfNeeded() {
    try {
        if (!fs.existsSync(PACKAGED_DATA_DIR)) return;
        const packagedRules = path.join(PACKAGED_DATA_DIR, 'rules.json');
        const packagedLog = path.join(PACKAGED_DATA_DIR, 'log.json');
        const packagedWatched = path.join(PACKAGED_DATA_DIR, 'watched.json');

        if (!fs.existsSync(RULES_FILE) && fs.existsSync(packagedRules)) fs.copyFileSync(packagedRules, RULES_FILE);
        if (!fs.existsSync(LOG_FILE) && fs.existsSync(packagedLog)) fs.copyFileSync(packagedLog, LOG_FILE);
        if (!fs.existsSync(WATCHED_FILE) && fs.existsSync(packagedWatched)) fs.copyFileSync(packagedWatched, WATCHED_FILE);
    } catch (e) {
        console.error('Error migrating packaged data:', e);
    }
}

// ensure rules have stable ids and enabled flag
function ensureRulesHaveIds() {
    try {
        let rules = JSON.parse(fs.readFileSync(RULES_FILE));
        let changed = false;
        rules = rules.map((r, idx) => {
            const copy = Object.assign({}, r);
            if (!copy.id) {
                copy.id = copy.name ? `${copy.name.replace(/\s+/g, '_')}_${idx}` : `rule_${idx + 1}_${crypto.randomBytes(4).toString('hex')}`;
                changed = true;
            }
            if (typeof copy.enabled === 'undefined') {
                copy.enabled = true;
                changed = true;
            }
            return copy;
        });
        if (changed) fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    } catch (e) {
        console.error('ensureRulesHaveIds error:', e);
    }
}

// Move app startup initialization to whenReady so we can use app.getPath('userData')
app.whenReady().then(() => {
    DATA_DIR = path.join(app.getPath('userData'), 'data'); // per-user writable data dir
    RULES_FILE = path.join(DATA_DIR, "rules.json");
    LOG_FILE = path.join(DATA_DIR, "log.json");
    WATCHED_FILE = path.join(DATA_DIR, "watched.json");

    // Determine packaged data directory properly: when packaged, resources are in process.resourcesPath
    if (app.isPackaged) {
        PACKAGED_DATA_DIR = path.join(process.resourcesPath, 'data');
    } else {
        PACKAGED_DATA_DIR = path.join(__dirname, 'data');
    }

    // If packaged files exist in the app folder, copy them to user data on first run
    migratePackagedDataIfNeeded();
    ensureDataFiles();
    ensureRulesHaveIds();

    // Create the tray first so the app always has an icon in the tray
    createTray();

    // If the app was launched with --hidden (we register this when enabling autostart),
    // don't show the main window — run quietly in the background with tray icon only.
    const startedHidden = process.argv.includes('--hidden');
    if (!startedHidden) {
        createWindow();
    } else {
        // Start background auto-organize for any watched folders so the app actually does its job while hidden
        startAutoFromWatched();
    }
});

function readWatched() {
    try {
        return JSON.parse(fs.readFileSync(WATCHED_FILE)).watched || [];
    } catch (err) {
        return [];
    }
}

function writeWatched(watched) {
    fs.writeFileSync(WATCHED_FILE, JSON.stringify({ watched }, null, 2));
}

async function organizeFolder(folderPath) {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE));
    const existingLog = JSON.parse(fs.readFileSync(LOG_FILE));
    const newEntries = [];

    if (!fs.existsSync(folderPath)) {
        return existingLog;
    }

    const watchedList = readWatched();
    const folderEntry = watchedList.find(w => w.path === folderPath);

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

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        try {
            if (!fs.lstatSync(fullPath).isFile()) continue;
        } catch (err) {
            continue;
        }

        for (const rule of rules) {
            let enabled = !(rule.enabled === false);
            if (overrides && Object.prototype.hasOwnProperty.call(overrides, rule.id)) {
                enabled = !!overrides[rule.id];
            }
            if (!enabled) continue;

            const fileName = file;
            const fileLower = (typeof fileName === 'string') ? fileName.toLowerCase() : '';
            let match = false;
            if (rule.type && typeof rule.type === 'string') {
                const ruleType = rule.type.toLowerCase();
                if (fileLower.endsWith(ruleType)) match = true;
            }
            if (rule.namePattern && typeof rule.namePattern === 'string') {
                const rp = rule.namePattern.toLowerCase();
                if (fileLower.startsWith(rp)) match = true;
            }

            if (match) {
                const destFolder = path.join(folderPath, rule.destination);
                if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                try {
                    fs.renameSync(fullPath, path.join(destFolder, file));
                    const entry = { file, movedTo: rule.destination, timestamp: new Date(), folder: folderPath };
                    newEntries.push(entry);
                } catch (err) {
                }
                break;
            }
        }
    }

    const combined = existingLog.concat(newEntries);
    fs.writeFileSync(LOG_FILE, JSON.stringify(combined, null, 2));
    return combined;
}

ipcMain.handle("load-rules", async () => {
    ensureRulesHaveIds();
    return JSON.parse(fs.readFileSync(RULES_FILE));
});

ipcMain.handle("save-rules", async (_, rules) => {
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    return true;
});

ipcMain.handle("organize-files", async (_, folderPath) => {
    return await organizeFolder(folderPath);
});

ipcMain.handle("load-log", async () => {
    return JSON.parse(fs.readFileSync(LOG_FILE));
});

ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle("load-watched", async () => {
    return readWatched();
});

ipcMain.handle("save-watched", async (_, watched) => {
    writeWatched(watched);
    return true;
});

function emitAutoLog(folderPath, log) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('auto-organize-log', { folderPath, log });
    }
}

function emitAutoRunning() {
    try {
        const paths = Array.from(watchers.keys());
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auto-running-changed', paths);
        }
    } catch (e) {
    }
    // Update the tray menu to reflect running state
    try { if (appTray) updateTrayMenu(); } catch (e) {}
}

async function startAutoForPath(folderPath, intervalMs = 5000) {
    if (watchers.has(folderPath)) {
        return true;
    }

    if (!fs.existsSync(folderPath)) {
        return false;
    }

    const state = { watcher: null, debounceTimer: null, autoInterval: null };

    const runAndEmit = async () => {
        const log = await organizeFolder(folderPath);
        emitAutoLog(folderPath, log);
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
        watchers.set(folderPath, state);
        emitAutoRunning();
        return true;
    } catch (err) {
        const runOnce = async () => { await runAndEmit(); };
        runOnce();
        state.autoInterval = setInterval(runOnce, intervalMs);
        watchers.set(folderPath, state);
        emitAutoRunning();
        return true;
    }
}

async function startAutoFromWatched() {
    try {
        const watchedList = readWatched();
        if (!Array.isArray(watchedList) || watchedList.length === 0) return;
        for (const w of watchedList) {
            if (w && (typeof w.enabled === 'undefined' || w.enabled === true) && w.path) {
                try { await startAutoForPath(w.path); } catch (e) { console.error('Failed to start watcher for', w.path, e); }
            }
        }
    } catch (e) {
        console.error('startAutoFromWatched error', e);
    }
    // Ensure UI/menu is updated when watchers start
    emitAutoRunning();
}

ipcMain.handle("start-auto-organize", async (_, folderPath, intervalMs = 5000) => {
    if (!folderPath) {
        const watchedList = readWatched();
        if (!Array.isArray(watchedList) || watchedList.length === 0) return false;
        let anyStarted = false;
        for (const w of watchedList) {
            if (w && (typeof w.enabled === 'undefined' || w.enabled === true) && w.path) {
                try {
                    const ok = await startAutoForPath(w.path, intervalMs);
                    if (ok) anyStarted = true;
                } catch (e) {
                }
            }
        }
        emitAutoRunning();
        return anyStarted;
    }

    const watchedList = readWatched();
    const folderEntry = watchedList.find(w => w.path === folderPath);
    if (folderEntry && folderEntry.enabled === false) {
        return false;
    }

    const res = await startAutoForPath(folderPath, intervalMs);
    emitAutoRunning();
    return res;
});

ipcMain.handle("stop-auto-organize", async (_, folderPath) => {
    if (folderPath) {
        const state = watchers.get(folderPath);
        if (!state) return true;
        try { if (state.watcher) await state.watcher.close(); } catch (e) {}
        if (state.debounceTimer) { clearTimeout(state.debounceTimer); state.debounceTimer = null; }
        if (state.autoInterval) { clearInterval(state.autoInterval); state.autoInterval = null; }
        watchers.delete(folderPath);
        emitAutoRunning();
        return true;
    }

    for (const [p, state] of watchers.entries()) {
        try { if (state.watcher) await state.watcher.close(); } catch (e) {}
        if (state.debounceTimer) clearTimeout(state.debounceTimer);
        if (state.autoInterval) clearInterval(state.autoInterval);
        watchers.delete(p);
    }
    emitAutoRunning();
    return true;
});

ipcMain.handle('get-auto-running', async () => {
    try {
        return Array.from(watchers.keys());
    } catch (err) {
        return [];
    }
});

ipcMain.handle('get-autostart-enabled', async () => {
    try {
        const settings = app.getLoginItemSettings();
        return settings.openAtLogin;
    } catch (err) {
        return false;
    }
});

ipcMain.handle('set-autostart-enabled', async (_, enabled) => {
    try {
        if (enabled) {
            // Register the app to open at login and pass a flag so we can keep it hidden at startup
            app.setLoginItemSettings({
                openAtLogin: true,
                openAsHidden: true,
                path: process.execPath,
                args: ['--hidden']
            });
        } else {
            app.setLoginItemSettings({
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
