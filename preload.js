const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    loadRules: () => ipcRenderer.invoke("load-rules"),
    saveRules: (rules) => ipcRenderer.invoke("save-rules", rules),
    organizeFiles: (folderPath) => ipcRenderer.invoke("organize-files", folderPath),
    loadLog: () => ipcRenderer.invoke("load-log"),
    selectFolder: () => ipcRenderer.invoke("select-folder")
});
