const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRuntime } = require('./runtime.cjs');

const dataDir = path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Faethon');
app.setPath('userData', dataDir);
const resourceDir = process.env.FAETHON_RESOURCE_DIR || (app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../../artifacts/desktop-stage'));
const runtime = createRuntime(dataDir, resourceDir);
const desktopPath = path.join(dataDir, 'desktop.json');
const agentPath = path.join(dataDir, 'agent.json');
let window, tray, updateReady = false, shuttingDown = false, starting = false;
app.on('web-contents-created', (_event, contents) => {
  contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
});

function readJson(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); }
function config() { return readJson(desktopPath); }
function baseUrl(c) { return c.mode === 'remote' ? c.backendUrl : 'http://127.0.0.1:5080'; }
function isHttpsUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.search && !url.hash; } catch { return false; } }
function validateRemote(url) { if (!isHttpsUrl(url)) throw new Error('Enter an HTTPS backend URL without credentials, query, or fragment.'); return new URL(url).origin; }
function icon() {
  const pixels = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4;
    const white = (x >= 4 && x <= 6 && y >= 3 && y <= 12) || (y >= 3 && y <= 5 && x >= 4 && x <= 12) || (y >= 7 && y <= 9 && x >= 4 && x <= 10);
    pixels[i] = white ? 255 : 51; pixels[i + 1] = white ? 255 : 85; pixels[i + 2] = white ? 255 : 33; pixels[i + 3] = 255;
  }
  return nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
}
function fileWindow(file, width, height) {
  const view = new BrowserWindow({ width, height, minWidth: Math.min(width, 640), minHeight: Math.min(height, 520), title: 'Faethon', icon: icon(), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  view.loadFile(path.join(__dirname, file));
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return view;
}
function showSetup() { if (window && !window.isDestroyed()) window.close(); window = fileWindow('setup.html', 760, 700); window.on('close', () => { window = null; }); }
function showError(error) {
  dialog.showMessageBoxSync({ type: 'error', title: 'Faethon could not start', message: error.message || String(error), detail: `Check ${path.join(dataDir, 'logs')} and PostgreSQL, then use Open Faethon to retry.` });
}
async function startApp() {
  if (starting) return;
  starting = true;
  try {
    const c = config();
    if (!c.mode) { showSetup(); return; }
    if (c.mode === 'remote') c.backendUrl = validateRemote(c.backendUrl);
    if (c.mode === 'local' && !fs.existsSync(path.join(dataDir, 'api.json'))) { showSetup(); return; }
    await runtime.start(c.mode, c.backendUrl);
    if (window && !window.isDestroyed()) window.destroy();
    const url = baseUrl(c);
    window = new BrowserWindow({ width: 1360, height: 900, minWidth: 1000, minHeight: 680, title: 'Faethon', icon: icon(), show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    window.webContents.on('will-navigate', (event, next) => { if (!next.startsWith(url + '/') && next !== url) event.preventDefault(); });
    window.webContents.setWindowOpenHandler(({ url: next }) => next.startsWith(url + '/') ? { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } } : { action: 'deny' });
    window.on('close', event => { if (!shuttingDown) { event.preventDefault(); window.hide(); } });
    window.once('ready-to-show', () => window.show());
    await window.loadURL(url);
    rebuildTray();
    scheduleUpdates();
  } catch (error) { await runtime.stopAll(); showError(error); }
  finally { starting = false; }
}
function showMain() { if (!window || window.isDestroyed()) { startApp(); return; } window.show(); window.focus(); }
function rebuildTray() {
  if (!tray) { tray = new Tray(icon()); tray.setToolTip('Faethon'); tray.on('double-click', showMain); }
  const c = config();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Faethon', click: showMain },
    { label: 'Printer and connection settings', click: () => fileWindow('settings.html', 680, 620) },
    { label: 'Check for updates', click: () => checkUpdates(true) },
    { label: 'Install downloaded update', enabled: updateReady, click: installUpdate },
    { type: 'separator' },
    { label: 'Start when I sign in', type: 'checkbox', checked: !!c.startAtLogin, click: item => { c.startAtLogin = item.checked; writeJson(desktopPath, c); app.setLoginItemSettings({ openAtLogin: item.checked }); } },
    { type: 'separator' }, { label: 'Quit', click: () => app.quit() }
  ]));
}
async function checkUpdates(manual = false) {
  if (!app.isPackaged) { if (manual) dialog.showMessageBoxSync({ message: 'Updates can be checked after installing a packaged release.' }); return; }
  try { const result = await autoUpdater.checkForUpdates(); if (manual && !result?.updateInfo) dialog.showMessageBoxSync({ message: 'No update is available.' }); }
  catch (e) { if (manual) showError(e); }
}
function scheduleUpdates() {
  if (!app.isPackaged || scheduleUpdates.started) return;
  scheduleUpdates.started = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('update-downloaded', async () => {
    updateReady = true; rebuildTray();
    const answer = await dialog.showMessageBox({ type: 'info', title: 'Faethon update ready', message: 'An update is ready. Install it now?', detail: 'Printing must be idle and a backup will be created first.', buttons: ['Install now', 'Later'], defaultId: 1 });
    if (answer.response === 0) installUpdate();
  });
  setTimeout(() => checkUpdates(), 5000);
  setInterval(() => checkUpdates(), 6 * 60 * 60 * 1000);
}
async function installUpdate() {
  if (!updateReady || shuttingDown) return;
  try {
    const c = config();
    await runtime.stopAgent();
    const ledger = path.join(dataDir, 'print-ledger');
    if (fs.existsSync(ledger) && fs.readdirSync(ledger).some(name => name.endsWith('.json') && readJson(path.join(ledger, name)).Status === 'dispatching')) throw new Error('A print submission is unresolved in the ledger. Check its output before updating.');
    if (c.mode === 'local') {
      const active = await runtime.updateReadiness();
      if (!Number.isInteger(active) || active > 0) throw new Error(`${active || 'Unknown number of'} print job(s) are active. Resolve them before updating.`);
      await runtime.backup();
    }
    await runtime.stopAll();
    shuttingDown = true;
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    shuttingDown = false;
    showError(e);
    const c = config();
    try { await runtime.start(c.mode, c.backendUrl); } catch (restartError) { showError(restartError); }
  }
}
function allowedSender(event, file) { return event.senderFrame?.url === pathToFileURL(path.join(__dirname, file)).href; }
ipcMain.handle('desktop:choose-import', async event => { if (!allowedSender(event, 'setup.html')) throw new Error('Invalid sender'); const result = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return result.canceled ? '' : result.filePaths[0]; });
ipcMain.handle('desktop:postgres-download', async event => { if (!allowedSender(event, 'setup.html')) throw new Error('Invalid sender'); await shell.openExternal('https://www.postgresql.org/download/windows/'); });
ipcMain.handle('desktop:setup-local', async (event, request) => {
  if (!allowedSender(event, 'setup.html')) throw new Error('Invalid sender');
  const output = await runtime.setup({ pgBin: String(request.pgBin || ''), adminPassword: String(request.adminPassword || ''), importDirectory: String(request.importDirectory || '') });
  const line = output.trim().split(/\r?\n/).at(-1);
  const result = JSON.parse(line);
  writeJson(desktopPath, { mode: 'local', startAtLogin: !!request.startAtLogin });
  app.setLoginItemSettings({ openAtLogin: !!request.startAtLogin });
  rebuildTray();
  return result;
});
ipcMain.handle('desktop:setup-remote', async (event, request) => {
  if (!allowedSender(event, 'setup.html')) throw new Error('Invalid sender');
  const url = validateRemote(String(request.backendUrl || ''));
  if (!fs.existsSync(agentPath)) writeJson(agentPath, { Backend: url, Token: '', Ledger: path.join(dataDir, 'print-ledger'), AllowedQueues: [], DispatchEnabled: false });
  writeJson(desktopPath, { mode: 'remote', backendUrl: url, startAtLogin: !!request.startAtLogin });
  app.setLoginItemSettings({ openAtLogin: !!request.startAtLogin });
  rebuildTray();
  return {};
});
ipcMain.handle('desktop:open', event => { if (!allowedSender(event, 'setup.html')) throw new Error('Invalid sender'); startApp(); });
ipcMain.handle('desktop:get-settings', event => { if (!allowedSender(event, 'settings.html')) throw new Error('Invalid sender'); const a = readJson(agentPath); return { ...config(), token: a.Token || '', queues: a.AllowedQueues || [], dispatchEnabled: !!a.DispatchEnabled }; });
ipcMain.handle('desktop:save-settings', async (event, values) => {
  if (!allowedSender(event, 'settings.html')) throw new Error('Invalid sender');
  const mode = values.mode === 'remote' ? 'remote' : 'local';
  if (mode === 'local' && !fs.existsSync(path.join(dataDir, 'api.json'))) throw new Error('The local database has not been configured.');
  const backendUrl = mode === 'remote' ? validateRemote(String(values.backendUrl || '')) : undefined;
  const queues = String(values.queues || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const token = String(values.token || '').trim();
  if (values.dispatchEnabled && (!token || !queues.length)) throw new Error('Pairing token and at least one printer queue are required to enable printing.');
  const c = { mode, backendUrl, startAtLogin: !!values.startAtLogin };
  const a = { Backend: baseUrl(c), Token: token, Ledger: path.join(dataDir, 'print-ledger'), AllowedQueues: queues, DispatchEnabled: !!values.dispatchEnabled };
  await runtime.stopAll();
  writeJson(desktopPath, c); writeJson(agentPath, a);
  app.setLoginItemSettings({ openAtLogin: c.startAtLogin });
  await startApp();
  rebuildTray();
  return true;
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showMain);
  app.whenReady().then(() => { rebuildTray(); startApp(); });
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => { if (shuttingDown) return; event.preventDefault(); shuttingDown = true; runtime.stopAll().finally(() => app.quit()); });
}
