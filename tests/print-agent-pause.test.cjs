const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('desktop-managed print helper pauses before shutdown', async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'faethon-agent-pause-'));
  const exe = path.resolve(__dirname, '../artifacts/desktop-stage/print-agent/Faethon.PrintAgent.exe');
  fs.writeFileSync(path.join(data, 'agent.json'), JSON.stringify({ Backend: 'http://127.0.0.1:5080', Token: '', Ledger: path.join(data, 'ledger'), AllowedQueues: [], DispatchEnabled: false }));
  const child = spawn(exe, ['--desktop-managed'], { cwd: path.dirname(exe), env: { ...process.env, FAETHON_DATA_DIR: data, DOTNET_ENVIRONMENT: 'Production' }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  try {
    const paused = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Pause timed out: ${output}`)), 15000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('FAETHON_AGENT_PAUSED')) { clearTimeout(timeout); resolve(); } });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Helper exited ${code}: ${output}`)); });
    });
    child.stdin.write('pause\n');
    await paused;
    child.stdin.end();
    const exitCode = await new Promise(resolve => child.once('exit', resolve));
    assert.equal(exitCode, 0);
  } finally { if (child.exitCode === null) child.kill(); fs.rmSync(data, { recursive: true, force: true }); }
});
