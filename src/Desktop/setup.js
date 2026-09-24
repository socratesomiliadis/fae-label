const $ = id => document.getElementById(id);
const desktop = window.faethonDesktop;
$('mode').addEventListener('change', () => { const remote = $('mode').value === 'remote'; $('local').classList.toggle('hidden', remote); $('remote').classList.toggle('hidden', !remote); });
$('postgres-link').addEventListener('click', () => desktop.postgresDownload());
$('choose-import').addEventListener('click', async () => { $('import-dir').value = await desktop.chooseImport(); });
$('submit').addEventListener('click', async () => {
  $('error').textContent = ''; $('submit').disabled = true; $('submit').textContent = 'Setting up…';
  try {
    const remote = $('mode').value === 'remote';
    const result = remote
      ? await desktop.setupRemote({ backendUrl: $('backend-url').value, startAtLogin: $('login').checked })
      : await desktop.setupLocal({ pgBin: $('pg-bin').value, adminPassword: $('pg-password').value, importDirectory: $('import-dir').value, startAtLogin: $('login').checked });
    $('pg-password').value = '';
    $('done').classList.remove('hidden');
    $('submit').closest('.card').classList.add('hidden');
    if (remote) $('key-intro').textContent = 'The remote server is configured. Sign in with your existing account.';
    $('setup-key').textContent = result.setupToken || '';
  } catch (error) { $('error').textContent = error.message || String(error); }
  finally { $('submit').disabled = false; $('submit').textContent = 'Set up Faethon'; }
});
$('open').addEventListener('click', () => desktop.open());
