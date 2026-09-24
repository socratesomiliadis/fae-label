const path = require('node:path');
const url = process.env.FAETHON_UPDATE_URL || 'https://faethon-updates.sohub.digital/faethon/';
if (!url.startsWith('https://')) throw new Error('FAETHON_UPDATE_URL must be HTTPS');
module.exports = {
  appId: 'gr.faethon.labeller',
  productName: 'Faethon',
  directories: { output: path.resolve(__dirname, '../../artifacts/desktop-release') },
  files: ['main.cjs', 'runtime.cjs', 'preload.cjs', 'setup.html', 'setup.js', 'settings.html', 'settings.js', 'desktop.css', 'package.json'],
  extraResources: [{ from: path.resolve(__dirname, '../../artifacts/desktop-stage'), to: '.', filter: ['**/*'] }],
  win: { target: ['nsis'], executableName: 'Faethon', signExecutable: false, icon: path.join(__dirname, 'build', 'icon.svg') },
  nsis: { oneClick: true, perMachine: false, createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: 'Faethon', artifactName: 'Faethon-Setup-${version}-${arch}.${ext}' },
  publish: [{ provider: 'generic', url }]
};
