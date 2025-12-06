/**
 * window.js
 * Manages the main application window
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
    constructor(app) {
        this.app = app;
        this.mainWindow = null;
    }

    /**
     * Create the main application window
     */
    createWindow(preloadPath, iconPath, trayManager) {
        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            autoHideMenuBar: true,
            icon: iconPath,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: preloadPath,
                devTools: !this.app.isPackaged
            }
        });

        // Load URL depending on whether the app is packaged or running in dev mode
        if (this.app.isPackaged) {
            this.mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'build', 'index.html'))
                .catch(err => console.error('Failed to load packaged index.html', err));
        } else {
            this.mainWindow.loadURL('http://localhost:3000')
                .catch(err => console.error('Failed to load dev server at http://localhost:3000', err));
        }

        // Log any loading errors
        this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error('Failed to load:', validatedURL, errorCode, errorDescription);
        });

        this.mainWindow.webContents.on('did-finish-load', () => {
            console.log('Page loaded successfully');
            try {
                this.mainWindow.webContents.closeDevTools();
            } catch (e) {}
        });

        // Hide to tray instead of closing
        this.mainWindow.on('close', (e) => {
            if (trayManager && !trayManager.isAppQuitting()) {
                e.preventDefault();
                try {
                    this.mainWindow.hide();
                } catch (err) {}
            }
        });

        // Cleanup reference when actually closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        return this.mainWindow;
    }

    /**
     * Get the main window instance
     */
    getWindow() {
        return this.mainWindow;
    }

    /**
     * Show the main window
     */
    showWindow() {
        if (!this.mainWindow) {
            return false;
        }
        this.mainWindow.show();
        this.mainWindow.focus();
        return true;
    }

    /**
     * Hide the main window
     */
    hideWindow() {
        if (this.mainWindow) {
            this.mainWindow.hide();
        }
    }

    /**
     * Check if window exists
     */
    hasWindow() {
        return this.mainWindow !== null;
    }
}

module.exports = WindowManager;

