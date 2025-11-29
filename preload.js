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
    organizeFiles: (folderPath) => safeInvoke("organize-files", folderPath),
    loadLog: () => safeInvoke("load-log"),
    selectFolder: () => safeInvoke("select-folder"),
    startAutoOrganize: (folderPath, intervalMs) => safeInvoke('start-auto-organize', folderPath, intervalMs),
    stopAutoOrganize: () => safeInvoke('stop-auto-organize'),
    startAuto: (folderPath, intervalMs) => safeInvoke('start-auto-organize', folderPath, intervalMs),
    stopAuto: () => safeInvoke('stop-auto-organize'),
    onAutoOrganizeLog: (cb) => {
        if (ipcRenderer && typeof ipcRenderer.on === 'function') {
            ipcRenderer.on('auto-organize-log', (_, log) => cb(log));
        }
    }
});
