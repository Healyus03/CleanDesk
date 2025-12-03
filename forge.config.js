module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    ignore: [
      /^\/renderer\/src/,
      /^\/renderer\/public/,
      /^\/renderer\/node_modules/,
      /^\/renderer\/package\.json/,
      /^\/renderer\/postcss\.config\.js/,
      /^\/renderer\/tailwind\.config\.js/,
      /^\/out/,
      /^\/tmp/,
      /^\/\.git/,
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
        setupExe: "CleanDesk-Setup.exe"
      }
    },
    {
      name: "@electron-forge/maker-zip",
      config: {}
    }
  ]
};

