const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: 'CleanDesk',
    icon: path.resolve(__dirname, 'CleanDesk.ico'),
    win32metadata: {
      CompanyName: 'Cebbe',
      FileDescription: 'CleanDesk — automatic file organizer desktop app',
      ProductName: 'CleanDesk'
    },
    extraResource: [
      path.resolve(__dirname, 'CleanDesk.ico')
    ],
    ignore: [
      /^\/renderer\/src/,
      /^\/renderer\/public/,
      /^\/renderer\/node_modules/,
      /^\/renderer\/package\.json/,
      /^\/renderer\/postcss\.config\.js/,
      /^\/renderer\/tailwind\.config\.js/,
      /^\/out/,
      /^\/tmp/,
      /^\/.git/,
      /^\/staging/
    ]
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "cleandesk",
        authors: "Cebbe",
        description: "CleanDesk — automatic file organizer desktop app",
        setupExe: "CleanDesk-Setup.exe",
        setupIcon: path.resolve(__dirname, 'CleanDesk.ico'),
        iconUrl: path.resolve(__dirname, 'CleanDesk.ico'),
        exe: 'CleanDesk.exe',
        noMsi: true
      }
    },
    {
      name: "@electron-forge/maker-zip",
      config: {}
    }
  ]
};
