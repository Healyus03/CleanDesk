const { contextBridge, ipcRenderer } = require("electron");

// helper to safely invoke IPC if available
const safeInvoke = (channel, ...args) => {
    if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
        return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error('IPC invoke not available'));
};

contextBridge.exposeInMainWorld("electronAPI", {
    loadRules: () => safeInvoke("load-rules"),
    saveRules: (rules) => safeInvoke("save-rules", rules),
    loadLog: () => safeInvoke("load-log"),
    selectFolder: () => safeInvoke("select-folder"),
    startAuto: (folderPath, intervalMs) => safeInvoke('start-auto-organize', folderPath, intervalMs),
    stopAuto: (folderPath) => safeInvoke('stop-auto-organize', folderPath),
    getAutoRunning: () => safeInvoke('get-auto-running'),
    loadWatched: () => safeInvoke('load-watched'),
    saveWatched: (watched) => safeInvoke('save-watched', watched),
    getAutostartEnabled: () => safeInvoke('get-autostart-enabled'),
    setAutostartEnabled: (enabled) => safeInvoke('set-autostart-enabled', enabled),
    onAutoOrganizeLog: (cb) => {
        if (ipcRenderer && typeof ipcRenderer.on === 'function') {
            // payload now is { folderPath, log }
            ipcRenderer.on('auto-organize-log', (_, payload) => cb(payload));
        }
    },
    onAutoRunningChanged: (cb) => {
        if (ipcRenderer && typeof ipcRenderer.on === 'function') {
            ipcRenderer.on('auto-running-changed', (_, paths) => cb(paths));
        }
    }
});
