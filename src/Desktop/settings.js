const $ = id => document.getElementById(id);
const desktop = window.faethonDesktop;
function toggle() { $('remote').classList.toggle('hidden', $('mode').value !== 'remote'); }
$('mode').addEventListener('change', toggle);
desktop.getSettings().then(value => {
  $('mode').value = value.mode || 'local'; $('backend-url').value = value.backendUrl || '';
  $('token').value = value.token || ''; $('queues').value = (value.queues || []).join('\n');
  $('dispatch').checked = !!value.dispatchEnabled; $('login').checked = !!value.startAtLogin; toggle();
}).catch(error => $('error').textContent = error.message);
$('save').addEventListener('click', async () => {
  $('error').textContent = ''; $('save').disabled = true;
  try {
    await desktop.saveSettings({ mode: $('mode').value, backendUrl: $('backend-url').value, token: $('token').value, queues: $('queues').value, dispatchEnabled: $('dispatch').checked, startAtLogin: $('login').checked });
    window.close();
  } catch (error) { $('error').textContent = error.message || String(error); }
  finally { $('save').disabled = false; }
});
