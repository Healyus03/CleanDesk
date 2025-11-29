const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const RULES_FILE = path.join(__dirname, "data/rules.json");
const LOG_FILE = path.join(__dirname, "data/log.json");

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    win.loadURL("http://localhost:3000");


}

app.whenReady().then(createWindow);

// --- IPC handlers ---
ipcMain.handle("load-rules", async () => {
    if (!fs.existsSync(RULES_FILE)) fs.writeFileSync(RULES_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(RULES_FILE));
});

ipcMain.handle("save-rules", async (_, rules) => {
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
    return true;
});

ipcMain.handle("organize-files", async (_, folderPath) => {
    const rules = JSON.parse(fs.readFileSync(RULES_FILE));
    const log = [];
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const fullPath = path.join(folderPath, file);
        if (!fs.lstatSync(fullPath).isFile()) continue;

        for (const rule of rules) {
            let match = false;
            if (rule.type && file.endsWith(rule.type)) match = true;
            if (rule.namePattern && file.startsWith(rule.namePattern)) match = true;

            if (match) {
                const destFolder = path.join(folderPath, rule.destination);
                if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder);
                fs.renameSync(fullPath, path.join(destFolder, file));
                log.push({ file, movedTo: rule.destination, timestamp: new Date() });
                break;
            }
        }
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
    return log;
});

ipcMain.handle("load-log", async () => {
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(LOG_FILE));
});

const { dialog } = require("electron");

ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) return null;
    return result.filePaths[0];
});

