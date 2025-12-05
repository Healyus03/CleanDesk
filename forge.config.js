const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: 'CleanDesk',
    // include the data folder and the app icon as extra resources so packaged defaults are available at runtime
    extraResource: [
      path.resolve(__dirname, 'data'),
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
