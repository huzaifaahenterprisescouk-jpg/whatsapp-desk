// Keeps each company's order list in step with its shared OneDrive / SharePoint Excel file (or a file in a folder).
// One "source" = one company sheet (e.g. BAFL). Syncing a source only replaces THAT company's orders.
const fs = require('fs');
const store = require('./store');
const orders = require('./orders');
const ms = require('./msgraph');

const list = () => (store.db.sources = store.db.sources || []);
const get = id => list().find(s => s.id === id);
const lastBuf = new Map(), running = new Set(), lastTry = new Map();

const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: '*/*' };
const isZip = b => b.length > 3 && b.readUInt32LE(0) === 0x04034b50;
// A CSV export (e.g. from QuickBooks) is also accepted where a caller asks for it; HTML sign-in pages never are.
const looksCsv = b => { if (!b.length) return false; const t = b.subarray(0, 2000); return !t.includes(0) && /[,;\t]/.test(t.toString('utf8')) && !/^\s*<(!doctype|html)/i.test(t.toString('utf8')); };
const accepts = opts => b => isZip(b) || (opts && opts.csv && looksCsv(b));
const b64u = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
const apiUrl = u => `https://api.onedrive.com/v1.0/shares/u!${b64u(u)}/root/content`;
const withDl = u => { const d = new URL(u); d.searchParams.set('download', '1'); return d.toString(); };


// Follow redirects manually and return every address passed through (the final page often needs a sign-in, earlier hops do not).
async function followHops(start) {
  const out = []; let cur = new URL(start);
  try {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(cur, { headers: H, redirect: 'manual', signal: AbortSignal.timeout(20000) }); try { await r.body.cancel(); } catch {}
      const loc = r.status >= 300 && r.status < 400 && r.headers && r.headers.get('location'); if (!loc) break;
      cur = new URL(loc, cur); out.push(cur);
    }
  } catch { /* use whatever we collected */ }
  return out;
}

// Every address worth trying for a pasted link, best first. Newer 1drv.ms/x/c/... links are often refused by the
// classic shares API, so we also follow the short link and try the direct-download forms.
async function candidates(link) {
  const u = new URL(link.trim()), host = u.hostname.toLowerCase(), live = host.endsWith('onedrive.live.com'), out = [];
  if (live && /^\/(embed|download|view\.aspx)/i.test(u.pathname)) { const d = new URL(u); d.pathname = '/download'; out.push(['direct download link', d.toString()]); }
  if (host === '1drv.ms' || live || host.endsWith('livefilestorage.com')) {
    out.push(['OneDrive API', apiUrl(u.toString())]);
    if (host === '1drv.ms') {
      const clean = new URL(u.origin + u.pathname); for (const k of ['e', 'authkey']) if (u.searchParams.has(k)) clean.searchParams.set(k, u.searchParams.get(k));
      out.push(['download flag', withDl(u.toString())]);
      out.push(['download flag (clean link)', withDl(clean.toString())]);
      out.push(['OneDrive API (clean link)', apiUrl(clean.toString())]);
      out.push(['OneDrive API (bare link)', apiUrl(u.origin + u.pathname)]);
      // newer personal links: 1drv.ms/x/c/<cid>/<token> is the same file as onedrive.live.com/:x:/g/personal/<cid>/<token>
      const nm = /^\/[a-z]\/c\/([0-9a-f]+)\/([^/]+)/i.exec(u.pathname);
      if (nm) { const p = new URL(`https://onedrive.live.com/:x:/g/personal/${nm[1].toUpperCase()}/${nm[2]}`); if (u.searchParams.get('e')) p.searchParams.set('e', u.searchParams.get('e'));
        out.push(['personal link download', withDl(p.toString())]); out.push(['personal link API', apiUrl(p.toString())]); }
      // follow the short link one step at a time and try every address it passes through
      let chain; const hops = () => chain || (chain = followHops(u));
      for (let i = 0; i < 4; i++) {
        out.push([`redirect step ${i + 1} download`, async () => { const h = (await hops())[i]; return h && withDl(h.toString()); }]);
        out.push([`redirect step ${i + 1} API`, async () => { const h = (await hops())[i]; return h && apiUrl(h.toString()); }]);
      }
      out.push(['direct download', async () => { for (const f of await hops()) { const resid = f.searchParams.get('resid') || f.searchParams.get('id'), key = f.searchParams.get('authkey'), cid = f.searchParams.get('cid');
        if (resid) return `https://onedrive.live.com/download?${cid ? 'cid=' + encodeURIComponent(cid) + '&' : ''}resid=${encodeURIComponent(resid)}${key ? '&authkey=' + encodeURIComponent(key) : ''}`; } return null; }]);
      out.push(['personal download page', async () => { for (const f of await hops()) { const g = (f.searchParams.get('sourcedoc') || '').replace(/[{}]/g, '');
        if (g) return `${f.origin}${f.pathname.replace(/\/[^/]*$/, '/download.aspx')}?UniqueId=${encodeURIComponent(g)}`; } return null; }]);
      return out;
    }
    out.push(['download flag', withDl(u.toString())]);
  } else out.push(['link', host.endsWith('sharepoint.com') ? withDl(u.toString()) : u.toString()]);
  return out;
}

// A file on this server (e.g. a folder kept in step with OneDrive by Synology Cloud Sync) instead of a web link.
const isPath = l => /^(file:|\/|[A-Za-z]:[\\/])/.test(l.trim());
function readLocal(l, opts) {
  const f = l.trim().replace(/^file:\/\//, ''); let b;
  try { b = fs.readFileSync(f); } catch (e) { throw new Error(e.code === 'ENOENT' ? `File not found: ${f}. Check the path and that the folder is shared with the app (see README).` : `Cannot read ${f}: ${e.message}`); }
  if (!accepts(opts)(b)) throw new Error(`${f} is not an Excel (.xlsx)${opts && opts.csv ? ' or CSV' : ''} file.`); return b;
}

async function fetchSheet(link, opts) {
  const ok = accepts(opts);
  if (isPath(link)) return readLocal(link, opts);
  const notes = []; let denied = 0;
  // 1) Signed in with the Microsoft app (client) ID: read the file through Microsoft Graph. Works for private links too.
  const viaMs = ms.signedIn();
  if (viaMs) {
    const u = new URL(link.trim()), tries = [['Microsoft sign-in', u.toString()]];
    if (u.hostname.toLowerCase() === '1drv.ms') (await followHops(u)).slice(0, 2).forEach((h, i) => tries.push([`Microsoft sign-in (redirect ${i + 1})`, h.toString()]));
    for (const [name, l] of tries) {
      try { return await ms.downloadShare(l, ok); }
      catch (e) { notes.push(`${name}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`); if (/error (400|401|403|404)/.test(e.message)) denied++; if (/sign-in expired|Not signed in/.test(e.message)) break; }
    }
  }
  // 2) Anonymous download tricks (only work when the link is truly public).
  for (const [name, src] of await candidates(link)) {
    try {
      const url = typeof src === 'function' ? await src() : src; if (!url) continue;
      const res = await fetch(url, { redirect: 'follow', headers: H, signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        let why = ''; try { const t = (await res.text()).slice(0, 400), j = /"code"\s*:\s*"([^"]+)"/.exec(t), m = /"message"\s*:\s*"([^"]{0,90})/.exec(t); why = j ? ` ${j[1]}${m ? ' – ' + m[1] : ''}` : ''; } catch {}
        notes.push(`${name}: error ${res.status}${why}`); if ([400, 401, 403, 404].includes(res.status)) denied++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (ok(buf)) return buf;
      notes.push(`${name}: not an Excel file`);
    } catch (e) { notes.push(`${name}: ${e.name === 'TimeoutError' ? 'timed out' : 'no connection'}`); }
  }
  const tried = ` (tried: ${notes.join('; ')})`;
  if (denied) throw new Error(viaMs
    ? 'Microsoft would not give this file to the account you signed in with. Make sure that account can open the link in a browser (or ask the owner to share the file with it), then press Sync now.' + tried
    : 'OneDrive would not hand this file to the app without a Microsoft sign-in. Fix: open "Microsoft sign-in" on this page, enter your Microsoft app (client) ID and sign in once. After that every OneDrive / SharePoint link works, even private ones. Or upload the Excel file by hand meanwhile.' + tried);
  throw new Error('That link did not return an Excel file. Use the .xlsx file itself (not a folder or a sign-in page).' + tried);
}

async function syncNow(id) {
  const s = get(id); if (!s) throw new Error('That sheet no longer exists.');
  if (!s.url) throw new Error('Paste the share link (or folder path) of the Excel file first.');
  if (running.has(id)) throw new Error('A sync is already running for this sheet.');
  running.add(id); lastTry.set(id, Date.now());
  try {
    const buf = await fetchSheet(s.url); lastBuf.set(id, buf);
    const r = orders.importOrders(buf, 'replace', s); // throws before changing anything if the sheet is unreadable
    Object.assign(s, { lastSync: Date.now(), lastError: '', lastCount: r.count });
    store.save();
    return r;
  } catch (e) {
    s.lastError = e.message; s.lastFailed = Date.now(); store.save();
    throw e;
  } finally { running.delete(id); }
}

// The file as last downloaded (for the columns setup screen); downloads it if we have none yet.
async function currentBuffer(id) { const s = get(id); if (!s || !s.url) throw new Error('No synced file. Choose an Excel file instead.'); if (!lastBuf.has(id)) lastBuf.set(id, await fetchSheet(s.url)); return lastBuf.get(id); }

// One timer checks every sheet; each one is re-read when its own interval has passed.
let ticker = null;
function tick() {
  for (const s of list()) {
    if (!s.url || running.has(s.id)) continue;
    const due = Date.now() - (lastTry.get(s.id) || s.lastSync || 0) >= Math.max(1, +s.minutes || 5) * 60000;
    if (due) syncNow(s.id).catch(e => console.error(`Sheet sync failed (${s.name}):`, e.message));
  }
}
function start() { clearInterval(ticker); ticker = setInterval(tick, 20000); tick(); }

// People often paste the whole <iframe ...> embed code; pull the address out of it.
function cleanLink(text) {
  let t = String(text || '').trim(); const m = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(t); if (m) t = m[1];
  return t.replace(/&amp;/gi, '&').trim();
}
function checkLink(url) { if (url && !isPath(url)) { try { new URL(url); } catch { throw new Error('That does not look like a web link or a file path.'); } } }

const view = s => ({ id: s.id, name: s.name, url: s.url || '', minutes: s.minutes || 5, lastSync: s.lastSync || 0, lastError: s.lastError || '', lastCount: s.lastCount || 0,
  orders: store.db.orders.filter(o => o.src === s.id).length, syncing: running.has(s.id) });

function add({ name, url, minutes }) {
  name = String(name || '').trim(); if (!name) throw new Error('Give the sheet a name, e.g. the company: BAFL.');
  if (list().some(s => s.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a sheet called "${name}".`);
  url = cleanLink(url); checkLink(url);
  const s = { id: store.nextId('s'), name, url, minutes: Math.min(1440, Math.max(1, +minutes || 5)), cfg: {}, lastSync: 0, lastError: '', lastCount: 0 };
  list().push(s); store.save(); return s;
}
function update(id, b) {
  const s = get(id); if (!s) throw new Error('Sheet not found.');
  if (b.name !== undefined) {
    const n = String(b.name).trim(); if (!n) throw new Error('The name cannot be empty.');
    if (list().some(x => x !== s && x.name.toLowerCase() === n.toLowerCase())) throw new Error(`There is already a sheet called "${n}".`);
    if (n !== s.name) { for (const o of store.db.orders) if (o.src === s.id) { if (o.organization === s.name) o.organization = n; o.company = n; } s.name = n; }
  }
  if (b.url !== undefined) { const u = cleanLink(b.url); checkLink(u); if (u !== s.url) { s.url = u; lastBuf.delete(id); } }
  if (b.minutes !== undefined) s.minutes = Math.min(1440, Math.max(1, +b.minutes || 5));
  store.save(); return s;
}
function remove(id) {
  const s = get(id); if (!s) throw new Error('Sheet not found.');
  store.db.sources = list().filter(x => x !== s); store.db.orders = store.db.orders.filter(o => o.src !== id); lastBuf.delete(id); lastTry.delete(id); store.save();
}

module.exports = { looksCsv, list, get, view, add, update, remove, currentBuffer, syncNow, start, cleanLink, candidates, fetchSheet };
