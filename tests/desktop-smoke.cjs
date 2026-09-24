const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('../src/Web/node_modules/playwright');

test('packaged Electron app opens first-run setup without production data', async () => {
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'faethon-desktop-smoke-'));
  const exe = path.resolve(__dirname, '../artifacts/desktop-release/win-unpacked/Faethon.exe');
  const desktop = await _electron.launch({ executablePath: exe, env: { ...process.env, LOCALAPPDATA: isolated }, timeout: 30000 });
  try {
    const window = await desktop.firstWindow();
    await window.getByRole('heading', { name: 'Set up Faethon' }).waitFor();
    await window.locator('#mode').selectOption('remote');
    assert.equal(await window.locator('#remote').isVisible(), true);
    assert.equal(await window.locator('#local').isVisible(), false);
    await window.locator('#mode').selectOption('local');
    await window.locator('#pg-bin').fill('C:\\missing-postgres-bin');
    await window.locator('#pg-password').fill('test password');
    await window.locator('#submit').click();
    await window.getByRole('alert').getByText(/command-line tool missing/).waitFor();
    assert.equal(await window.locator('#submit').isEnabled(), true);
  } finally { await desktop.close(); fs.rmSync(isolated, { recursive: true, force: true }); }
});
