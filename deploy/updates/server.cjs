const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const root = process.env.FAETHON_RELEASE_DIR || '/data';
const pending = path.join(root, 'pending');
const releases = path.join(root, 'releases');
const token = process.env.FAETHON_PUBLISH_TOKEN || '';
if (token.length < 32) throw new Error('FAETHON_PUBLISH_TOKEN must be at least 32 characters.');
fs.mkdirSync(pending, { recursive: true }); fs.mkdirSync(releases, { recursive: true });
let publishing = false;
const allowedName = name => /^Faethon-Setup-[0-9A-Za-z.+-]+-x64\.exe(?:\.blockmap)?$/.test(name) || name === 'latest.yml';
function authenticated(req) {
  const provided = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] || '';
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b);
}
function respond(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'" });
  res.end(body);
}
async function hashFile(file) {
  const hash = crypto.createHash('sha512');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('base64');
}
async function upload(req, res, name) {
  if (!allowedName(name)) return respond(res, 400, 'Unsupported filename');
  if (publishing) return respond(res, 409, 'Publication in progress');
  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 1 || length > 1024 * 1024 * 1024) return respond(res, 413, 'File size must be 1 byte to 1 GiB');
  const temporary = path.join(pending, `.${crypto.randomUUID()}.uploading`);
  let written = 0;
  try {
    req.on('data', chunk => { written += chunk.length; if (written > length) req.destroy(); });
    await pipeline(req, fs.createWriteStream(temporary, { flags: 'wx' }));
    if (written !== length) throw new Error('Incomplete upload');
    await fsp.rename(temporary, path.join(pending, name));
    respond(res, 200, JSON.stringify({ name, bytes: written }), 'application/json');
  } catch (error) { await fsp.rm(temporary, { force: true }); if (!res.destroyed) respond(res, 400, error.message); }
}
async function publish(res) {
  if (publishing) return respond(res, 409, 'Publication in progress');
  publishing = true;
  try {
    const yaml = await fsp.readFile(path.join(pending, 'latest.yml'), 'utf8');
    const version = yaml.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/m)?.[1];
    const installer = yaml.match(/^path:\s*(Faethon-Setup-[0-9A-Za-z.+-]+-x64\.exe)\s*$/m)?.[1];
    const expected = yaml.match(/^sha512:\s*([A-Za-z0-9+/=]+)\s*$/m)?.[1];
    if (!version || !installer || !expected || !installer.includes(`-${version}-`)) throw new Error('latest.yml has an invalid version, installer, or hash.');
    if (await hashFile(path.join(pending, installer)) !== expected) throw new Error('Installer SHA-512 does not match latest.yml.');
    for (const name of [installer, `${installer}.blockmap`]) {
      const source = path.join(pending, name), target = path.join(releases, name);
      if (!fs.existsSync(source)) { if (name.endsWith('.blockmap')) continue; throw new Error(`Missing ${name}`); }
      if (fs.existsSync(target) && await hashFile(source) !== await hashFile(target)) throw new Error(`A different release already uses ${name}.`);
      if (!fs.existsSync(target)) await fsp.rename(source, target); else await fsp.rm(source);
    }
    await fsp.rename(path.join(pending, 'latest.yml'), path.join(releases, 'latest.yml'));
    respond(res, 200, JSON.stringify({ version, installer }), 'application/json');
  } catch (error) { respond(res, 400, error.message); }
  finally { publishing = false; }
}
async function serveFile(req, res, name) {
  if (!allowedName(name)) return respond(res, 404, 'Not found');
  const file = path.join(releases, name);
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) return respond(res, 404, 'Not found');
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Number(range[2]) : stat.size - 1;
    if (req.headers.range && (!range || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= stat.size)) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return;
    }
    const headers = { 'Content-Type': name.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream', 'Content-Length': end - start + 1,
      'Cache-Control': name === 'latest.yml' ? 'no-store' : 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file, { start, end }).pipe(res);
  } catch { respond(res, 404, 'Not found'); }
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/faethon/')) return await serveFile(req, res, decodeURIComponent(pathname.slice('/faethon/'.length)));
    if (req.method === 'GET' && pathname === '/admin') return respond(res, 200, await fsp.readFile(path.join(__dirname, 'admin.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && pathname === '/admin.js') return respond(res, 200, await fsp.readFile(path.join(__dirname, 'admin.js')), 'text/javascript; charset=utf-8');
    if (pathname.startsWith('/admin/')) {
      if (!authenticated(req)) return respond(res, 401, 'Invalid publishing token');
      if (req.method === 'PUT' && pathname.startsWith('/admin/upload/')) return await upload(req, res, decodeURIComponent(pathname.slice('/admin/upload/'.length)));
      if (req.method === 'POST' && pathname === '/admin/publish') return await publish(res);
      if (req.method === 'GET' && pathname === '/admin/status') return respond(res, 200, JSON.stringify({ published: fs.existsSync(path.join(releases, 'latest.yml')), pending: await fsp.readdir(pending) }), 'application/json');
    }
    respond(res, 404, 'Not found');
  } catch (error) { respond(res, 500, error.message); }
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
