const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function createRuntime(dataDir, resourceDir) {
  const apiExe = path.join(resourceDir, 'api', 'Faethon.Api.exe');
  const agentExe = path.join(resourceDir, 'print-agent', 'Faethon.PrintAgent.exe');
  const env = { ...process.env, FAETHON_DATA_DIR: dataDir, FAETHON_RESOURCE_DIR: resourceDir, DOTNET_ENVIRONMENT: 'Production', ASPNETCORE_ENVIRONMENT: 'Production' };
  fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
  let api = null, agent = null, agentPaused = false;
  function command(file, args, options = {}) {
    const child = spawn(file, args, { cwd: path.dirname(file), env: { ...env, ...options.env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.stdin.end(options.input || '');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error(`${path.basename(file)} timed out`)); }, options.timeout || 180000);
      child.on('error', e => { clearTimeout(timeout); reject(e); });
      child.on('exit', code => {
        clearTimeout(timeout);
        if (code === 0) resolve(output);
        else reject(new Error((error || output || `${path.basename(file)} exited ${code}`).trim()));
      });
    });
  }
  function managed(file, args, label, extraEnv = {}) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stdout = fs.createWriteStream(path.join(dataDir, 'logs', `${label}-${stamp}.log`));
    const stderr = fs.createWriteStream(path.join(dataDir, 'logs', `${label}-${stamp}-error.log`));
    const child = spawn(file, args, { cwd: path.dirname(file), env: { ...env, ...extraEnv }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.pipe(stdout); child.stderr.pipe(stderr);
    child.on('error', e => stderr.write(`${e.stack || e}\n`));
    child.on('exit', () => { stdout.end(); stderr.end(); });
    return child;
  }
  async function waitForApi(child) {
    for (let i = 0; i < 40; i++) {
      if (child.exitCode !== null) throw new Error('The API stopped during startup. Check the Faethon logs.');
      try {
        const response = await fetch('http://127.0.0.1:5080/api/setup', { signal: AbortSignal.timeout(1500) });
        if (response.ok) return;
      } catch { /* retry */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('The API did not become ready. Check PostgreSQL and the Faethon logs.');
  }
  async function start(mode, backendUrl) {
    if (mode === 'local' && (!api || api.exitCode !== null)) {
      await command(apiExe, ['--initialize'], { timeout: 180000 });
      api = managed(apiExe, ['--desktop-managed'], 'api');
      await waitForApi(api);
    }
    const agentConfig = path.join(dataDir, 'agent.json');
    if ((!agent || agent.exitCode !== null) && fs.existsSync(agentConfig) && JSON.parse(fs.readFileSync(agentConfig, 'utf8')).DispatchEnabled) {
      agent = managed(agentExe, ['--desktop-managed'], 'agent', mode === 'remote' ? { FAETHON_REMOTE_BACKEND: backendUrl } : {});
      agentPaused = false;
    }
  }
  async function stop(child) {
    if (!child || child.exitCode !== null) return;
    const finished = new Promise(resolve => child.once('exit', resolve));
    child.stdin.end();
    await Promise.race([finished, new Promise(resolve => setTimeout(resolve, 15000))]);
    if (child.exitCode === null) { child.kill(); await finished; }
  }
  async function pauseAgent() {
    if (!agent || agent.exitCode !== null || agentPaused) return;
    const child = agent;
    await new Promise((resolve, reject) => {
      let received = '';
      const cleanup = () => { clearTimeout(timer); child.stdout.off('data', onData); child.off('exit', onExit); };
      const onData = chunk => { received += chunk.toString(); if (received.includes('FAETHON_AGENT_PAUSED')) { cleanup(); agentPaused = true; resolve(); } else if (received.length > 4096) received = received.slice(-100); };
      const onExit = () => { cleanup(); reject(new Error('Print helper exited while pausing.')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('The print helper is still busy. Try updating after printing finishes.')); }, 120000);
      child.stdout.on('data', onData); child.once('exit', onExit); child.stdin.write('pause\n');
    });
  }
  async function stopAgent() { await pauseAgent(); const child = agent; agent = null; agentPaused = false; await stop(child); }
  async function stopAll() { await stopAgent(); const child = api; api = null; await stop(child); }
  async function updateReadiness() {
    const output = await command(apiExe, ['--update-readiness']);
    return Number(output.match(/ACTIVE_PRINT_JOBS:(\d+)/)?.[1] ?? NaN);
  }
  async function backup() { return await command(apiExe, ['--backup'], { timeout: 600000 }); }
  async function setup(request) {
    const script = path.join(resourceDir, 'Setup-Desktop.ps1');
    return await command('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { input: JSON.stringify(request), timeout: 600000 });
  }
  return { start, stopAll, stopAgent, updateReadiness, backup, setup,
    get agentRunning() { return !!agent && agent.exitCode === null; }, get apiRunning() { return !!api && api.exitCode === null; } };
}
module.exports = { createRuntime };
