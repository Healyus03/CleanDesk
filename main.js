const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const RULES_FILE = path.join(__dirname, "data/rules.json");
const LOG_FILE = path.join(__dirname, "data/log.json");

let mainWindow = null;
let autoInterval = null; // polling fallback
let watcher = null; // chokidar watcher
let debounceTimer = null;

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

// Helper: organize a folder according to rules. Returns the combined log (existing + new entries).
async function organizeFolder(folderPath) {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE));
    const existingLog = JSON.parse(fs.readFileSync(LOG_FILE));
    const newEntries = [];

    if (!fs.existsSync(folderPath)) return existingLog;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        try {
            if (!fs.lstatSync(fullPath).isFile()) continue;
        } catch (err) {
            continue;
        }

        for (const rule of rules) {
            let match = false;
            if (rule.type && file.endsWith(rule.type)) match = true;
            if (rule.namePattern && file.startsWith(rule.namePattern)) match = true;

            if (match) {
                const destFolder = path.join(folderPath, rule.destination);
                if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });
                try {
                    fs.renameSync(fullPath, path.join(destFolder, file));
                    const entry = { file, movedTo: rule.destination, timestamp: new Date() };
                    newEntries.push(entry);
                } catch (err) {
                    // ignore move errors for now
                }
                break;
            }
        }
    }

    const combined = existingLog.concat(newEntries);
    fs.writeFileSync(LOG_FILE, JSON.stringify(combined, null, 2));
    return combined;
}

// --- IPC handlers ---
ipcMain.handle("load-rules", async () => {
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

// Try to use chokidar watcher when available; fall back to polling interval.
ipcMain.handle("start-auto-organize", async (_, folderPath, intervalMs = 5000) => {
    if (!folderPath) return false;

    // stop existing watcher / interval
    if (watcher) {
        try { watcher.close(); } catch (e) {}
        watcher = null;
    }
    if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
    }

    // Helper to run and emit
    const runAndEmit = async () => {
        const log = await organizeFolder(folderPath);
        if (mainWindow) mainWindow.webContents.send('auto-organize-log', log);
    };

    // Prefer chokidar if installed
    try {
        const chokidar = require('chokidar');
        console.log('start-auto-organize: using chokidar watcher');

        // create watcher but ignore destination subfolders to avoid loops
        // We'll watch only top-level of the folder (depth: 0) and ignore node_modules etc.
        watcher = chokidar.watch(folderPath, {
            ignoreInitial: true,
            depth: 0,
            awaitWriteFinish: {
                stabilityThreshold: 800,
                pollInterval: 100
            }
        });

        const trigger = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                runAndEmit();
                debounceTimer = null;
            }, 400);
        };

        watcher.on('add', trigger);
        watcher.on('change', trigger);
        watcher.on('addDir', trigger);
        watcher.on('unlink', trigger);

        // Run an initial organize once
        runAndEmit();
        return true;
    } catch (err) {
        console.log('start-auto-organize: chokidar not available, falling back to polling:', err && err.message);
        // chokidar not available, fall back to polling
        const runOnce = async () => {
            await runAndEmit();
        };
        runOnce();
        autoInterval = setInterval(runOnce, intervalMs);
        console.log('start-auto-organize: polling every', intervalMs, 'ms');
        return true;
    }
});

ipcMain.handle("stop-auto-organize", async () => {
    if (watcher) {
        try { await watcher.close(); } catch (e) {}
        watcher = null;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
    }
    return true;
});
