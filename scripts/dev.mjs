// Shared development entry point for Windows and macOS. No npm packages required.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] ?? 'start';
const commands = ['start', 'prepare', 'build', 'test', 'db', 'db-stop'];
if (!commands.includes(command)) {
  console.error(`Usage: node scripts/dev.mjs [${commands.join('|')}]`);
  process.exit(1);
}
const windows = process.platform === 'win32';
const localDotnet = join(root, '.tools', 'dotnet', windows ? 'dotnet.exe' : 'dotnet');
const dotnet = existsSync(localDotnet) ? localDotnet : 'dotnet';
const env = { ...process.env };
if (existsSync(localDotnet)) {
  env.DOTNET_ROOT = dirname(localDotnet);
  env.PATH = `${dirname(localDotnet)}${delimiter}${env.PATH ?? ''}`;
}
const port = env.FAETHON_DB_PORT ?? '55440';
const apiPort = env.FAETHON_API_PORT ?? '5080';
for (const value of [port, apiPort]) {
  if (!/^\d+$/.test(value) || +value < 1 || +value > 65535) throw Error('Ports must be integers from 1 to 65535.');
}
const connection = `Host=127.0.0.1;Port=${port};Username=faethon_test;Password=faethon_local_dev`;
const state = join(root, 'data', 'portable');
Object.assign(env, {
  ConnectionStrings__Database: `${connection};Database=faethon_local`,
  FAETHON_TEST_DATABASE: env.FAETHON_TEST_DATABASE ?? connection,
  Storage: join(state, 'storage'),
  Urls: `http://localhost:${apiPort}`,
  Backup__Enabled: 'false',
  Backup__Directory: join(state, 'backups'),
  Logging__LogLevel__Microsoft: 'Warning',
});
const pgCandidates = [
  join(root, '.tools/postgres/pgsql/bin/pg_dump.exe'),
  '/opt/homebrew/opt/libpq/bin/pg_dump', '/usr/local/opt/libpq/bin/pg_dump',
];
env.Backup__PgDump = env.FAETHON_PG_DUMP ?? pgCandidates.find(existsSync) ?? 'pg_dump';
env.FAETHON_PG_DUMP = env.Backup__PgDump;

async function run(program, args, cwd = root) {
  // Windows npm is a cmd shim; only fixed, internal npm arguments reach the shell.
  const npmOnWindows = windows && program === 'npm';
  const child = spawn(npmOnWindows ? 'npm.cmd' : program, args, {
    cwd, env, stdio: 'inherit', shell: npmOnWindows,
  });
  const stop = () => child.kill('SIGINT');
  process.on('SIGINT', stop);
  try {
    await new Promise((accept, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? accept() : reject(Error(`${program} exited (${signal ?? code}).`)));
    });
  } finally { process.off('SIGINT', stop); }
}
function listening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port: +port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}
async function database() {
  // Compose reuses its existing container and volume; it never touches other projects.
  await run('docker', ['compose', 'up', '-d', '--wait', 'db']);
}
async function build() {
  await run(dotnet, ['--version']);
  const web = join(root, 'src/Web');
  if (!existsSync(join(web, 'node_modules'))) await run('npm', ['ci'], web);
  await run('npm', ['run', 'build'], web);
  await run(dotnet, ['build', 'Faethon.slnx', '--nologo']);
}
try {
  if (command === 'db-stop') await run('docker', ['compose', 'stop', 'db']);
  else if (command === 'db') await database();
  else if (command === 'build') await build();
  else if (command === 'test') {
    await build();
    await database();
    await run(env.FAETHON_PG_DUMP, ['--version']);
    await run(dotnet, ['test', 'tests/Faethon.Tests', '--no-build', '--nologo']);
    await run('npm', ['exec', '--', 'playwright', 'install', 'chromium'], join(root, 'src/Web'));
    await run('npm', ['test'], join(root, 'src/Web'));
  } else {
    // Check before building: wwwroot belongs to any currently running API too.
    if (await listening(apiPort)) throw Error(`Port ${apiPort} is already in use. Reuse the running app or stop it before preparing/starting another instance.`);
    const importDir = env.FAETHON_IMPORT_SOURCE && resolve(env.FAETHON_IMPORT_SOURCE);
    if (importDir) for (const name of ['PROIONTA.xlsx', 'SYNTAGES.xlsx']) {
      if (!existsSync(join(importDir, name))) throw Error(`Missing import workbook: ${join(importDir, name)}`);
    }
    await build();
    await database();
    mkdirSync(state, { recursive: true });
    const api = join(root, 'src/Api');
    const assembly = join(api, 'bin/Debug/net10.0/Faethon.Api.dll');
    await run(dotnet, [assembly, '--initialize'], api);
    const marker = join(state, 'initial-import.complete');
    if (importDir && !existsSync(marker)) {
      await run(dotnet, [assembly, '--import', importDir], api);
      writeFileSync(marker, 'Initial workbook import completed. Use the application for later imports.\n');
    }
    const assetsMarker = join(state, 'legacy-assets.complete');
    if (!existsSync(assetsMarker)) {
      await run(dotnet, [assembly, '--legacy-assets', join(root, 'legacy')], api);
      writeFileSync(assetsMarker, 'Legacy assets imported.\n');
    }
    if (command === 'start') {
      env.SetupToken = env.SetupToken || randomBytes(24).toString('hex');
      console.log(`\nOpen ${env.Urls}\nFirst-run setup key: ${env.SetupToken}\nCtrl+C stops the API; the database remains running.`);
      if (!importDir && !existsSync(marker)) console.log('No workbooks supplied. Set FAETHON_IMPORT_SOURCE or import through the application.');
      await run(dotnet, [assembly], api);
    } else console.log('Preparation complete. The API was not started.');
  }
} catch (error) {
  console.error(`\n${error.message}\nSee docs/running-locally.md for prerequisites and configuration.`);
  process.exitCode = 1;
}
