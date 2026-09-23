// Build on the development machine; the target PC needs neither Node nor .NET.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'artifacts'), { recursive: true });
const output = mkdtempSync(join(root, 'artifacts', 'windows-'));
const web = mkdtempSync(join(tmpdir(), 'faethon-web-'));
const env = { ...process.env };
const localSdk = join(root, '.tools', 'dotnet');
if (existsSync(join(localSdk, process.platform === 'win32' ? 'dotnet.exe' : 'dotnet'))) {
  env.DOTNET_ROOT = localSdk;
  env.PATH = `${localSdk}${delimiter}${env.PATH ?? ''}`;
}
function run(command, args, cwd = root) {
  const npm = process.platform === 'win32' && command === 'npm';
  const result = spawnSync(npm ? 'npm.cmd' : command, args, { cwd, env, stdio: 'inherit', shell: npm });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed (${result.status})`);
}
// Never replace the wwwroot of an app already running in this checkout.
run('npm', ['ci'], join(root, 'src/Web'));
run('npm', ['run', 'typecheck'], join(root, 'src/Web'));
run('npm', ['exec', '--', 'vite', 'build', '--outDir', web], join(root, 'src/Web'));
for (const [project, folder] of [['Api', 'api'], ['PrintAgent', 'print-agent']]) {
  const name = project === 'Api' ? 'Faethon.Api' : 'Faethon.PrintAgent';
  run('dotnet', ['publish', `src/${project}/${name}.csproj`, '-c', 'Release', '-r', 'win-x64',
    '--self-contained', 'true', '-p:OpenApiGenerateDocuments=false', '-o', join(output, folder)]);
}
rmSync(join(output, 'api', 'wwwroot'), { recursive: true, force: true });
cpSync(web, join(output, 'api', 'wwwroot'), { recursive: true });
rmSync(web, { recursive: true });
cpSync(join(root, 'legacy'), join(output, 'legacy'), { recursive: true, filter: p => !p.includes(`${join('legacy', 'working')}`) });
cpSync(join(root, 'scripts', 'windows'), output, { recursive: true });
cpSync(join(root, 'docs', 'windows-deployment.md'), join(output, 'READ-ME.md'));
console.log(`\nWindows x64 package: ${output}\nCopy the complete folder to the Windows PC and follow READ-ME.md.`);
