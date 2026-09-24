// Produce a Windows x64 Electron installer and update feed in artifacts/desktop-release.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'artifacts', 'desktop-stage');
const web = mkdtempSync(join(tmpdir(), 'faethon-desktop-web-'));
const desktop = join(root, 'src', 'Desktop');
const version = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8')).version;
const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}` };
const sdk = join(root, '.tools', 'dotnet');
if (existsSync(join(sdk, 'dotnet.exe'))) { env.DOTNET_ROOT = sdk; env.PATH = `${sdk}${delimiter}${env.PATH ?? ''}`; }
function run(command, args, cwd = root) {
  if (command === 'npm' && env.FAETHON_NPM_CLI) {
    const result = spawnSync(process.execPath, [env.FAETHON_NPM_CLI, ...args], { cwd, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm failed (${result.status})`);
    return;
  }
  const cmd = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: cmd === 'npm.cmd' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
if (process.platform !== 'win32') throw new Error('The production installer is built and tested on Windows.');
if (env.FAETHON_RELEASE_TAG && env.FAETHON_RELEASE_TAG !== `v${version}`) throw new Error(`Tag must match package version v${version}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
try {
  run('npm', ['ci'], join(root, 'src', 'Web'));
  run('npm', ['exec', '--', 'tsc', '--noEmit'], join(root, 'src', 'Web'));
  run('npm', ['exec', '--', 'vite', 'build', '--outDir', web], join(root, 'src', 'Web'));
  for (const [project, folder] of [['Api', 'api'], ['PrintAgent', 'print-agent']]) {
    const name = project === 'Api' ? 'Faethon.Api' : 'Faethon.PrintAgent';
    run('dotnet', ['publish', `src/${project}/${name}.csproj`, '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true', '-p:OpenApiGenerateDocuments=false', `-p:Version=${version}`, '-o', join(stage, folder)]);
  }
  rmSync(join(stage, 'api', 'wwwroot'), { recursive: true, force: true });
  cpSync(web, join(stage, 'api', 'wwwroot'), { recursive: true });
  cpSync(join(root, 'legacy'), join(stage, 'legacy'), { recursive: true, filter: p => !p.includes(`${join('legacy', 'working')}`) });
  cpSync(join(root, 'scripts', 'windows', 'Setup-Desktop.ps1'), join(stage, 'Setup-Desktop.ps1'));
  run('npm', ['ci'], desktop);
  run('npm', ['run', 'dist', '--', '--config', 'electron-builder.cjs'], desktop);
} finally { rmSync(web, { recursive: true, force: true }); }
console.log(`Desktop release v${version}: ${join(root, 'artifacts', 'desktop-release')}`);
