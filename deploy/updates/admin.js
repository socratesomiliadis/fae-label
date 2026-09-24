const $ = id => document.getElementById(id);
const status = message => { $('status').textContent += `${message}\n`; };
async function request(path, method, body) {
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${$('token').value}` }, body });
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  return text;
}
$('upload').onclick = async () => {
  $('upload').disabled = true; $('status').textContent = '';
  try {
    const files = [...$('files').files].sort((a, b) => (a.name === 'latest.yml') - (b.name === 'latest.yml'));
    if (!files.length) throw new Error('Select release files first.');
    for (const file of files) { status(`Uploading ${file.name} (${file.size} bytes)…`); await request(`/admin/upload/${encodeURIComponent(file.name)}`, 'PUT', file); status(`Uploaded ${file.name}`); }
    status('Files are staged. Review them, then select Publish.');
  } catch (error) { status(`ERROR: ${error.message}`); }
  finally { $('upload').disabled = false; }
};
$('publish').onclick = async () => {
  $('publish').disabled = true;
  try { status('Verifying and publishing…'); status(await request('/admin/publish', 'POST')); status('Verify /faethon/latest.yml before installing.'); }
  catch (error) { status(`ERROR: ${error.message}`); }
  finally { $('publish').disabled = false; }
};
