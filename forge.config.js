const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: 'CleanDesk',
    // include the data folder as an extra resource so packaged defaults are available at runtime
    extraResource: [path.resolve(__dirname, 'data')],
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
        name: "CleanDesk",
        authors: "Cebbe",
        description: "CleanDesk — automatic file organizer desktop app",
        setupExe: "CleanDesk-Setup.exe",
        setupIcon: path.resolve(__dirname, 'renderer', 'public', 'favicon.ico')
      }
    },
    {
      name: "@electron-forge/maker-zip",
      config: {}
    }
  ]
};
