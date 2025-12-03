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
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require('crypto');

const RULES_FILE = path.join(__dirname, "data/rules.json");
const LOG_FILE = path.join(__dirname, "data/log.json");
const WATCHED_FILE = path.join(__dirname, "data/watched.json");

let mainWindow = null;
const watchers = new Map();

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

// ensure files exist
if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, JSON.stringify([]));
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));
if (!fs.existsSync(WATCHED_FILE)) fs.writeFileSync(WATCHED_FILE, JSON.stringify({ watched: [] }, null, 2));

// ensure rules have stable ids and enabled flag
function ensureRulesHaveIds() {
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
}
ensureRulesHaveIds();

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
