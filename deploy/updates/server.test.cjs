const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');

test('reviewed installer becomes public only after hash-checked publication', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faethon-updates-'));
  const token = 'test-only-publisher-secret-with-32-characters';
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { env: { ...process.env, FAETHON_RELEASE_DIR: root, FAETHON_PUBLISH_TOKEN: token, PORT: String(port) }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(`${base}/admin`); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
    const installer = 'Faethon-Setup-0.1.0-x64.exe';
    const bytes = Buffer.from('test installer bytes');
    const hash = crypto.createHash('sha512').update(bytes).digest('base64');
    const headers = { Authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${base}/faethon/latest.yml`)).status, 404);
    assert.equal((await fetch(`${base}/admin/upload/${installer}`, { method: 'PUT', body: bytes })).status, 401);
    assert.equal((await fetch(`${base}/admin/upload/${installer}`, { method: 'PUT', headers, body: bytes })).status, 200);
    const wrong = `version: 0.1.0\npath: ${installer}\nsha512: ${Buffer.alloc(64).toString('base64')}\n`;
    assert.equal((await fetch(`${base}/admin/upload/latest.yml`, { method: 'PUT', headers, body: wrong })).status, 200);
    assert.equal((await fetch(`${base}/admin/publish`, { method: 'POST', headers })).status, 400);
    assert.equal((await fetch(`${base}/faethon/latest.yml`)).status, 404);
    const correct = `version: 0.1.0\npath: ${installer}\nsha512: ${hash}\n`;
    assert.equal((await fetch(`${base}/admin/upload/latest.yml`, { method: 'PUT', headers, body: correct })).status, 200);
    assert.equal((await fetch(`${base}/admin/publish`, { method: 'POST', headers })).status, 200);
    assert.equal(await (await fetch(`${base}/faethon/latest.yml`)).text(), correct);
    assert.deepEqual(Buffer.from(await (await fetch(`${base}/faethon/${installer}`)).arrayBuffer()), bytes);
    const partial = await fetch(`${base}/faethon/${installer}`, { headers: { Range: 'bytes=0-3' } });
    assert.equal(partial.status, 206);
    assert.equal(await partial.text(), 'test');
    const nextInstaller = 'Faethon-Setup-0.1.1-x64.exe';
    const nextBytes = Buffer.from('replacement installer bytes');
    const nextHash = crypto.createHash('sha512').update(nextBytes).digest('base64');
    const nextFeed = `version: 0.1.1\npath: ${nextInstaller}\nsha512: ${nextHash}\n`;
    assert.equal((await fetch(`${base}/admin/upload/${nextInstaller}`, { method: 'PUT', headers, body: nextBytes })).status, 200);
    assert.equal((await fetch(`${base}/admin/upload/latest.yml`, { method: 'PUT', headers, body: nextFeed })).status, 200);
    assert.equal((await fetch(`${base}/admin/publish`, { method: 'POST', headers })).status, 200);
    assert.equal(await (await fetch(`${base}/faethon/latest.yml`)).text(), nextFeed);
    assert.deepEqual(Buffer.from(await (await fetch(`${base}/faethon/${installer}`)).arrayBuffer()), bytes);
  } finally { child.kill(); fs.rmSync(root, { recursive: true, force: true }); }
});
