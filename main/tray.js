/**
 * tray.js
 * Manages the system tray icon and menu
 */

const { Tray, Menu, nativeImage } = require('electron');
const fs = require('fs');

class TrayManager {
    constructor() {
        this.appTray = null;
        this.isQuitting = false;
    }

    /**
     * Create the system tray icon
     */
    createTray(iconPath, onShowWindow, onToggleAuto, onQuit) {
        if (!fs.existsSync(iconPath)) {
            console.error('Tray icon not found at:', iconPath);
            this.appTray = null;
            return false;
        }

        let trayIconImage = null;
        try {
            trayIconImage = nativeImage.createFromPath(iconPath);
            if (!trayIconImage || trayIconImage.isEmpty()) {
                console.error('Loaded icon but nativeImage is empty:', iconPath);
                this.appTray = null;
                return false;
            }
        } catch (e) {
            console.error('Failed to create nativeImage:', e);
            this.appTray = null;
            return false;
        }

        try {
            this.appTray = new Tray(trayIconImage);
        } catch (e) {
            console.error('Failed to create Tray:', e);
            this.appTray = null;
            return false;
        }

        this.appTray.setToolTip('CleanDesk');
        this.appTray.on('double-click', onShowWindow);

        // Store callbacks for menu updates
        this.onShowWindow = onShowWindow;
        this.onToggleAuto = onToggleAuto;
        this.onQuit = onQuit;

        return true;
    }

    /**
     * Update the tray menu to reflect current state
     */
    updateTrayMenu(autoOn) {
        if (!this.appTray) return;

        const template = [
            {
                label: 'Show CleanDesk',
                click: this.onShowWindow
            },
            { type: 'separator' },
            {
                label: 'Auto-organize',
                type: 'checkbox',
                checked: autoOn,
                click: this.onToggleAuto
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: this.onQuit
            }
        ];

        try {
            const menu = Menu.buildFromTemplate(template);
            this.appTray.setContextMenu(menu);
        } catch (e) {
            console.error('Failed to set tray menu:', e);
        }
    }

    /**
     * Get the tray instance
     */
    getTray() {
        return this.appTray;
    }

    /**
     * Set quitting flag
     */
    setQuitting(value) {
        this.isQuitting = value;
    }

    /**
     * Get quitting flag
     */
    isAppQuitting() {
        return this.isQuitting;
    }

    /**
     * Destroy the tray icon
     */
    destroy() {
        if (this.appTray) {
            try {
                this.appTray.destroy();
            } catch (e) {
                console.error('Error destroying tray:', e);
            }
            this.appTray = null;
        }
    }
}

module.exports = TrayManager;

