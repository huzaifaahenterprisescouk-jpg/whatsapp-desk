// DC + quotation documents kept per DC (for the PO follow-up mails).
//  * add()        the admin uploads the DC / quotation file by hand (PDF, picture, Word, Excel)
//  * autoFetch()  the app gets them itself: (1) a link column of the order sheet ("DC copy", "Quotation" ...) or
//                 (2) the ERP address typed in Settings (with {dc} {branch} {po} {pr} {company} placeholders)
//  * attachments() what goes into the mail of that DC
// Files live in data/dcdocs/<id>; the list per DC lives in db.dcDocs[key] (key = pofollow key = "<sheet id>|<dc>").
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cfg = require('./config');
const store = require('./store');
const orders = require('./orders');
const { sniff } = require('./files');
const ms = require('./msgraph');

const dir = path.join(path.dirname(cfg.dataFile), 'dcdocs');
const MAX = 15 * 1024 * 1024, PER_KIND = 8;
const box = () => (store.db.dcDocs = store.db.dcDocs || {});
const OFFICE = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', csv: 'text/csv' };
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', ...OFFICE };
const KINDS = { dc: 'DC', quote: 'Quotation' };
const safe = s => String(s || '').replace(/[^\w.\- ()]+/g, '_').slice(0, 80);
const keyOf = o => `${o.src}|${orders.normId(o.dc)}`;
const findOrder = key => store.db.orders.find(o => o.dc && keyOf(o) === key);

const settings = () => { const s = (store.db.settings.erpDocs = store.db.settings.erpDocs || {}); return s; };
function setSettings(b) {
  const clean = u => { u = String(u || '').trim().slice(0, 500); if (u && !/^https?:\/\//i.test(u)) throw new Error('The address must start with http:// or https://'); return u; };
  const s = settings(); s.dcUrl = clean(b.dcUrl); s.quoteUrl = clean(b.quoteUrl);
  s.header = String(b.header || '').trim().slice(0, 600); s.auto = b.auto !== false; store.save(); return s;
}

function kindOf(buf, name) {
  const k = sniff(buf); if (k) return k;
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  if (OFFICE[ext] && buf.length > 8 && (buf.toString('latin1', 0, 2) === 'PK' || buf.readUInt32BE(0) === 0xd0cf11e0 || ext === 'csv')) return { mime: OFFICE[ext], ext };
  return null;
}

function list(key) { return (box()[key] || []).map(d => ({ id: d.id, kind: d.kind, name: d.name, size: d.size, at: d.at, by: d.by, via: d.via, ext: d.ext })); }
function count(key) { const a = box()[key]; if (!a || !a.length) return { dc: 0, quote: 0 }; return { dc: a.filter(d => d.kind === 'dc').length, quote: a.filter(d => d.kind === 'quote').length }; }

function add(key, kind, name, buf, by, via = 'upload') {
  if (!KINDS[kind]) throw new Error('Choose DC or Quotation.');
  if (!findOrder(key)) throw new Error('That DC was not found. Press Sync now and try again.');
  if (!buf || !buf.length) throw new Error('The file is empty.');
  if (buf.length > MAX) throw new Error('The file is larger than 15 MB.');
  const t = kindOf(buf, name); if (!t) throw new Error('Upload a PDF, a picture, or a Word / Excel file.');
  const a = (box()[key] = box()[key] || []);
  if (a.filter(d => d.kind === kind).length >= PER_KIND) throw new Error(`Up to ${PER_KIND} ${KINDS[kind].toLowerCase()} files per DC. Remove one first.`);
  const sum = crypto.createHash('sha1').update(buf).digest('hex');
  const dup = a.find(d => d.kind === kind && d.sum === sum); if (dup) return dup; // same file again: keep one copy
  const id = crypto.randomBytes(9).toString('hex');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, id), buf);
  const rec = { id, kind, name: safe(name) || `${KINDS[kind]}.${t.ext}`, ext: t.ext, size: buf.length, at: Date.now(), by: by || '', via, sum };
  a.push(rec); store.save(); return rec;
}
function find(id) { for (const a of Object.values(box())) { const d = a.find(x => x.id === id); if (d) return d; } return null; }
function read(id) { const d = find(id); if (!d) throw new Error('File not found.'); return { ...d, type: MIME[d.ext] || 'application/octet-stream', buf: fs.readFileSync(path.join(dir, id)) }; }
function remove(id) {
  for (const [k, a] of Object.entries(box())) { const i = a.findIndex(x => x.id === id); if (i >= 0) { a.splice(i, 1); if (!a.length) delete box()[k]; try { fs.unlinkSync(path.join(dir, id)); } catch { /* already gone */ } store.save(); return true; } }
  throw new Error('File not found.');
}

// ---------- getting them from the sheet / ERP ----------
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: '*/*' };
const fill = (tpl, o) => tpl.replace(/\{(dc|branch|po|pr|company)\}/gi, (_, k) => encodeURIComponent({ dc: o.dc, branch: o.branch, po: o.po, pr: o.pr, company: o.company }[k.toLowerCase()] || ''));
function parseHeader(s) { const i = String(s || '').indexOf(':'); return i > 0 ? { [s.slice(0, i).trim()]: s.slice(i + 1).trim() } : {}; }
async function download(link, extra) {
  const tries = [];
  if (ms.signedIn()) tries.push(async () => ms.downloadShare(link, b => b.length > 0));
  tries.push(async () => { const r = await fetch(link, { headers: { ...H, ...extra }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('error ' + r.status); return Buffer.from(await r.arrayBuffer()); });
  for (const t of tries) { try { const b = await t(); if (b.length <= MAX && sniff(b)) return b; } catch { /* next way */ } }
  return null;
}
const extOf = b => (sniff(b) || {}).ext || 'pdf';

// returns { dc, quote } = how many files were added from the sheet / ERP for this DC (only for kinds that have none yet)
async function autoFetch(key, by) {
  const o = findOrder(key); if (!o) throw new Error('That DC was not found.');
  const have = count(key), got = { dc: 0, quote: 0 }, s = settings(), hdr = parseHeader(s.header);
  const jobs = [];
  for (const [l, v, vis] of o.extra || []) { // link columns of the sheet
    if (vis === 0 || !orders.isUrl(v)) continue;
    if (/quot|qtn|estimate/i.test(l)) jobs.push(['quote', String(v), l]); else if (/\b(dc|challan|delivery)\b/i.test(l)) jobs.push(['dc', String(v), l]);
  }
  if (s.dcUrl) jobs.push(['dc', fill(s.dcUrl, o), 'DC']);
  if (s.quoteUrl) jobs.push(['quote', fill(s.quoteUrl, o), 'Quotation']);
  const done = new Set();
  await Promise.all(['dc', 'quote'].map(async kind => {
    if (have[kind]) return;
    for (const [k, link, label] of jobs.filter(j => j[0] === kind)) {
      if (done.has(kind)) break;
      const b = await download(link, /^https?:\/\/(?!.*(sharepoint|onedrive|1drv))/i.test(link) ? hdr : {});
      if (b) { try { add(key, kind, `${KINDS[kind]}-${safe(o.dc)}.${extOf(b)}`, b, by || 'ERP', 'erp'); got[kind]++; done.add(kind); } catch { /* try next link */ } }
    }
  }));
  return got;
}
// the attachments for the mail of ONE DC (fetches from the sheet / ERP first when nothing was uploaded yet)
async function attachments(key, { fetchMissing = true } = {}) {
  const c = count(key), s = settings();
  if (fetchMissing && s.auto !== false && (!c.dc || !c.quote)) { try { await autoFetch(key, 'ERP'); } catch { /* mail goes without */ } }
  const a = box()[key] || [], out = [], dcNo = (findOrder(key) || {}).dc || '';
  for (const kind of ['dc', 'quote']) {
    const fs_ = a.filter(d => d.kind === kind);
    fs_.forEach((d, i) => {
      let buf; try { buf = fs.readFileSync(path.join(dir, d.id)); } catch { return; }
      const nice = `${KINDS[kind]}-${safe(dcNo)}${fs_.length > 1 ? '-' + (i + 1) : ''}.${d.ext}`;
      out.push({ filename: nice, type: MIME[d.ext] || 'application/octet-stream', content: buf, kind });
    });
  }
  return out;
}
module.exports = { add, list, count, read, remove, find, autoFetch, attachments, settings, setSettings, keyOf, findOrder, KINDS };
