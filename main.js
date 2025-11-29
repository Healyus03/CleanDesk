const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require('crypto');

const RULES_FILE = path.join(__dirname, "data/rules.json");
const LOG_FILE = path.join(__dirname, "data/log.json");
const WATCHED_FILE = path.join(__dirname, "data/watched.json");

let mainWindow = null;
// per-folder watchers map: folderPath -> { watcher, autoInterval, debounceTimer }
const watchers = new Map();

// --- Application ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(createWindow);

// Helper: ensure files exist
if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, JSON.stringify([]));
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));
if (!fs.existsSync(WATCHED_FILE)) fs.writeFileSync(WATCHED_FILE, JSON.stringify({ watched: [] }, null, 2));

// Migration: ensure rules have stable ids and enabled flag
function ensureRulesHaveIds() {
    let rules = JSON.parse(fs.readFileSync(RULES_FILE));
    let changed = false;
    rules = rules.map((r, idx) => {
        const copy = Object.assign({}, r);
        if (!copy.id) {
            // generate stable-ish id
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
}
ensureRulesHaveIds();

// Helper: read watched list
function readWatched() {
    try {
        return JSON.parse(fs.readFileSync(WATCHED_FILE)).watched || [];
    } catch (err) {
        return [];
    }
}

// Helper: write watched list
function writeWatched(watched) {
    fs.writeFileSync(WATCHED_FILE, JSON.stringify({ watched }, null, 2));
}

// Helper: organize a folder according to rules. Returns the combined log (existing + new entries).
async function organizeFolder(folderPath) {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE));
    const existingLog = JSON.parse(fs.readFileSync(LOG_FILE));
    const newEntries = [];

    console.log('organizeFolder: starting for', folderPath);

    if (!fs.existsSync(folderPath)) {
        console.log('organizeFolder: folder does not exist', folderPath);
        return existingLog;
    }

    // load per-folder overrides
    const watchedList = readWatched();
    const folderEntry = watchedList.find(w => w.path === folderPath);

    // If this watched folder is disabled, skip organizing
    if (folderEntry && folderEntry.enabled === false) {
        console.log('organizeFolder: skipping disabled watched folder', folderPath);
        return existingLog;
    }

    const overrides = (folderEntry && folderEntry.ruleOverrides) ? folderEntry.ruleOverrides : {};

    let files = [];
    try {
        files = fs.readdirSync(folderPath);
    } catch (err) {
        console.log('organizeFolder: error reading directory', folderPath, err && err.message);
        return existingLog;
    }

    console.log('organizeFolder:', folderPath, 'scanning', files.length, 'entries');

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        try {
            if (!fs.lstatSync(fullPath).isFile()) continue;
        } catch (err) {
            continue;
        }

        for (const rule of rules) {
            // decide enabled state: global enabled flag then apply per-folder override if present
            let enabled = !(rule.enabled === false);
            if (overrides && Object.prototype.hasOwnProperty.call(overrides, rule.id)) {
                enabled = !!overrides[rule.id];
            }
            if (!enabled) continue;

            let match = false;
            if (rule.type && file.endsWith(rule.type)) match = true;
            if (rule.namePattern && file.startsWith(rule.namePattern)) match = true;

            if (match) {
                const destFolder = path.join(folderPath, rule.destination);
                if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                try {
                    fs.renameSync(fullPath, path.join(destFolder, file));
                    const entry = { file, movedTo: rule.destination, timestamp: new Date(), folder: folderPath };
                    newEntries.push(entry);
                    console.log('organizeFolder:', folderPath, 'moved', file, '->', rule.destination);
                } catch (err) {
                    console.log('organizeFolder: error moving file', fullPath, err && err.message);
                    // ignore move errors for now
                }
                break;
            }
        }
    }

    const combined = existingLog.concat(newEntries);
    fs.writeFileSync(LOG_FILE, JSON.stringify(combined, null, 2));
    console.log('organizeFolder: finished for', folderPath, 'movedEntries=', newEntries.length);
    return combined;
}

// --- IPC handlers ---
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

// New IPC: load/save watched
ipcMain.handle("load-watched", async () => {
    return readWatched();
});

ipcMain.handle("save-watched", async (_, watched) => {
    writeWatched(watched);
    return true;
});

// Helper to emit logs with folder context
function emitAutoLog(folderPath, log) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('auto-organize-log', { folderPath, log });
    }
}

// Helper to emit current auto-running paths
function emitAutoRunning() {
    try {
        const paths = Array.from(watchers.keys());
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('auto-running-changed', paths);
        }
    } catch (e) {
        // ignore
    }
}

// Helper to start a watcher for a single folder path. Returns true if started or already watching, false otherwise.
async function startAutoForPath(folderPath, intervalMs = 5000) {
    // if already watching this folder, no-op
    if (watchers.has(folderPath)) {
        console.log('startAutoForPath: already watching', folderPath);
        return true;
    }

    // ensure directory exists
    if (!fs.existsSync(folderPath)) {
        console.log('startAutoForPath: folder does not exist, skipping', folderPath);
        return false;
    }

    // per-folder state
    const state = { watcher: null, debounceTimer: null, autoInterval: null };

    const runAndEmit = async () => {
        console.log('startAutoForPath: runAndEmit for', folderPath);
        const log = await organizeFolder(folderPath);
        emitAutoLog(folderPath, log);
    };

    // Prefer chokidar if installed
    try {
        const chokidar = require('chokidar');
        console.log('startAutoForPath: using chokidar watcher for', folderPath);

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

        // initial run
        await runAndEmit();

        state.watcher = watcher;
        watchers.set(folderPath, state);
        console.log('startAutoForPath: watcher started for', folderPath);
        // notify renderer of change
        emitAutoRunning();
        return true;
    } catch (err) {
        console.log('startAutoForPath: chokidar not available for', folderPath, 'falling back to polling:', err && err.message);
        // chokidar not available, fall back to polling
        const runOnce = async () => { await runAndEmit(); };
        runOnce();
        state.autoInterval = setInterval(runOnce, intervalMs);
        watchers.set(folderPath, state);
        console.log('startAutoForPath: polling every', intervalMs, 'ms for', folderPath);
        // notify renderer of change
        emitAutoRunning();
        return true;
    }
}

// Start auto-organize for a specific folderPath (or all enabled watched if called without path)
ipcMain.handle("start-auto-organize", async (_, folderPath, intervalMs = 5000) => {
    // If no folderPath provided, start auto for all enabled watched folders
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
                    // ignore individual failures
                }
            }
        }
        // notify renderer of final state
        emitAutoRunning();
        return anyStarted;
    }

    // If a specific folderPath was provided, ensure we don't start auto for a disabled watched entry
    const watchedList = readWatched();
    const folderEntry = watchedList.find(w => w.path === folderPath);
    if (folderEntry && folderEntry.enabled === false) {
        console.log('start-auto-organize: refusing to start auto for disabled folder', folderPath);
        return false;
    }

    // start for the single path
    const res = await startAutoForPath(folderPath, intervalMs);
    // ensure renderer sees updated list
    emitAutoRunning();
    return res;
});

// Stop auto-organize for a specific folderPath, or stop all if none provided
ipcMain.handle("stop-auto-organize", async (_, folderPath) => {
    if (folderPath) {
        const state = watchers.get(folderPath);
        if (!state) return true;
        try { if (state.watcher) await state.watcher.close(); } catch (e) {}
        if (state.debounceTimer) { clearTimeout(state.debounceTimer); state.debounceTimer = null; }
        if (state.autoInterval) { clearInterval(state.autoInterval); state.autoInterval = null; }
        watchers.delete(folderPath);
        // notify renderer
        emitAutoRunning();
        return true;
    }

    // stop all watchers
    for (const [p, state] of watchers.entries()) {
        try { if (state.watcher) await state.watcher.close(); } catch (e) {}
        if (state.debounceTimer) clearTimeout(state.debounceTimer);
        if (state.autoInterval) clearInterval(state.autoInterval);
        watchers.delete(p);
    }
    // notify renderer
    emitAutoRunning();
    return true;
});

// New IPC: return array of folder paths that currently have auto-organize active
ipcMain.handle('get-auto-running', async () => {
    try {
        return Array.from(watchers.keys());
    } catch (err) {
        return [];
    }
});

