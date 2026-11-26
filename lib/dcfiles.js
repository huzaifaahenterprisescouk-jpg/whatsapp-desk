// DC files section (left menu "DC files"): one entry per DC, each with a company, any number of links (OneDrive / SharePoint / web)
// and uploaded sheets / files, and the items inside it (tracked one by one). Independent of the order sheets.
// Records live in db.dcFiles; uploaded / downloaded files in data/dcfiles/<file id>.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cfg = require('./config'), store = require('./store');
const dcdocs = require('./dcdocs'), dcitems = require('./dcitems'), itemidx = require('./itemidx');

let idx = null;
const dir = path.join(path.dirname(cfg.dataFile), 'dcfiles');
const MAX = 15 * 1024 * 1024;
const all = () => (store.db.dcFiles = Array.isArray(store.db.dcFiles) ? store.db.dcFiles : []);
const str = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const rid = () => crypto.randomBytes(6).toString('hex');
const safe = s => String(s || '').replace(/[^\w.\- ()]+/g, '_').slice(0, 80);

const view = r => ({ id: r.id, company: r.company, dc: r.dc, po: r.po, note: r.note, links: r.links, files: r.files.map(f => ({ id: f.id, name: f.name, ext: f.ext, size: f.size, via: f.via, at: f.at })),
  items: r.items, summary: dcitems.summary(r.items), by: r.by, createdAt: r.createdAt, updatedAt: r.updatedAt });
const row = r => { const v = view(r); delete v.items; delete v.links; v.linkCount = r.links.length; v.fileCount = r.files.length; return v; };
const get = id => all().find(r => r.id === id) || null;

function create(b, by) {
  const company = str(b.company, 120); if (!company) throw new Error('Choose or type the company.');
  const r = { id: 'd_' + rid(), company, dc: str(b.dc, 60), po: str(b.po, 60), note: str(b.note, 500), links: [], files: [], items: dcitems.clean(b.items), by: by || '', createdAt: Date.now(), updatedAt: Date.now() };
  all().push(r); (idx = null, store.save()); return r;
}
function update(id, b) {
  const r = get(id); if (!r) throw new Error('DC not found.');
  if (b.company !== undefined) { const c = str(b.company, 120); if (!c) throw new Error('Choose or type the company.'); r.company = c; }
  if (b.dc !== undefined) r.dc = str(b.dc, 60); if (b.po !== undefined) r.po = str(b.po, 60); if (b.note !== undefined) r.note = str(b.note, 500);
  if (b.items !== undefined) r.items = dcitems.clean(b.items);
  r.updatedAt = Date.now(); (idx = null, store.save()); return r;
}
function remove(id) {
  const a = all(), i = a.findIndex(r => r.id === id); if (i < 0) return;
  for (const f of a[i].files) { try { fs.unlinkSync(path.join(dir, f.id)); } catch { /* gone */ } }
  a.splice(i, 1); (idx = null, store.save());
}

function addFile(id, name, buf, by, via = 'upload') {
  const r = get(id); if (!r) throw new Error('DC not found.');
  if (!buf || !buf.length) throw new Error('The file is empty.'); if (buf.length > MAX) throw new Error('The file is larger than 15 MB.');
  const t = dcdocs.kindOf(buf, name); if (!t) throw new Error('Upload a PDF, a picture, or a Word / Excel / CSV file.');
  if (r.files.length >= 30) throw new Error('Up to 30 files per DC.');
  const sum = crypto.createHash('sha1').update(buf).digest('hex'), dup = r.files.find(f => f.sum === sum); if (dup) return dup;
  const f = { id: 'f_' + rid(), name: safe(name) || `DC.${t.ext}`, ext: t.ext, size: buf.length, via, by: by || '', at: Date.now(), sum };
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f.id), buf);
  r.files.push(f); r.updatedAt = Date.now(); (idx = null, store.save()); return f;
}
function removeFile(fid) {
  for (const r of all()) { const i = r.files.findIndex(f => f.id === fid); if (i >= 0) { r.files.splice(i, 1); try { fs.unlinkSync(path.join(dir, fid)); } catch { /* gone */ } (idx = null, store.save()); return r; } }
  throw new Error('File not found.');
}
const ownerOfFile = fid => all().find(r => r.files.some(f => f.id === fid)) || null;
function readFile(fid) {
  const r = ownerOfFile(fid), f = r && r.files.find(x => x.id === fid); if (!f) throw new Error('File not found.');
  const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', csv: 'text/csv' };
  return { ...f, type: MIME[f.ext] || 'application/octet-stream', buf: fs.readFileSync(path.join(dir, fid)) };
}

// several links at once: each is kept as a link, and a copy of the file is downloaded when the link allows it (its items are read from Excel / CSV)
async function addLinks(id, urls, by) {
  const r = get(id); if (!r) throw new Error('DC not found.');
  const out = [], found = [];
  for (const u of (Array.isArray(urls) ? urls : String(urls || '').split(/\s+/)).map(x => String(x).trim()).filter(Boolean).slice(0, 20)) {
    if (!/^https?:\/\/\S+$/i.test(u)) { out.push({ url: u, ok: false, error: 'Not a web address' }); continue; }
    let link = r.links.find(l => l.url === u); if (!link) { link = { id: 'l_' + rid(), url: u.slice(0, 1500), at: Date.now(), by: by || '' }; r.links.push(link); }
    try {
      const f = await dcdocs.fetchLinkFile(u), file = addFile(id, `DC-${safe(r.dc || r.company)}-${r.files.length + 1}.${f.ext}`, f.buf, by, 'link'); link.fileId = file.id;
      if (['xlsx', 'csv'].includes(f.ext)) found.push(...dcitems.parseFile(f.buf, 'x.' + f.ext));
      out.push({ url: u, ok: true, copy: true });
    } catch (e) { out.push({ url: u, ok: true, copy: false, note: 'Saved as a link only (could not download a copy).' }); }
  }
  r.updatedAt = Date.now(); (idx = null, store.save());
  return { results: out, items: dcitems.clean(found.map(i => ({ ...i, status: 'pending' }))) };
}
function removeLink(id, lid) { const r = get(id); if (!r) throw new Error('DC not found.'); r.links = r.links.filter(l => l.id !== lid); (idx = null, store.save()); return r; }

// ---- the Company report asks: which items belong to this DC number? ----
const nid = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nco = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sameCo = (a, b) => { a = nco(a); b = nco(b); return !a || !b || a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))); };
// re-read every Excel / CSV file of a DC record: the DC column of the sheet gives each item its DC number (old items keep their status)
function rescan(r) {
  r.scanned = 1; const found = [];
  for (const f of r.files) { if (!['xlsx', 'csv'].includes(f.ext)) continue; try { found.push(...dcitems.parseFile(fs.readFileSync(path.join(dir, f.id)), 'x.' + f.ext)); } catch { /* unreadable */ } }
  if (!found.length || !found.some(i => i.dc)) return false;
  const old = new Map(r.items.map(i => [nco(i.desc), i])), used = new Set();
  r.items = dcitems.clean(found.map(i => { const o = old.get(nco(i.desc)); if (o && !used.has(o.id)) { used.add(o.id); return { ...i, id: o.id, status: o.status, got: o.got, note: o.note }; } return { ...i, status: 'pending' }; }));
  r.updatedAt = Date.now(); (idx = null, store.save()); return true;
}
let idxSig = "";
function index() {
  const sig = all().map(r => r.id + r.updatedAt + (r.scanned ? 's' : '')).join('|');
  if (idx && sig === idxSig) return idx;
  for (const r of all()) if (!r.scanned && r.files.length) rescan(r);
  idx = new Map(); idxSig = all().map(r => r.id + r.updatedAt + (r.scanned ? 's' : '')).join('|');
  for (const r of all()) for (const it of r.items) { const k = nid(it.dc || r.dc); if (!k) continue; if (!idx.has(k)) idx.set(k, []); idx.get(k).push({ ...it, recId: r.id, company: r.company }); }
  return idx;
}
const itemsForDc = (dc, company) => (index().get(nid(dc)) || []).filter(i => sameCo(i.company, company));
// the Company report asks for a whole DC (order): items added by hand in "DC files" first, otherwise the ones read automatically from the items sheet / ERP
const itemsForOrder = o => { const own = itemsForDc(o.dc, o.organization || o.company); return own.length ? own : itemidx.itemsFor(o); };
const countForOrder = o => { const own = itemsForDc(o.dc, o.organization || o.company).length; return own || itemidx.count(o); };
async function itemsForOrderAsync(o) { const own = itemsForDc(o.dc, o.organization || o.company); if (own.length) return own; await itemidx.ensureLookup(o); return itemidx.itemsFor(o); }
// Company report "search by item": the same rule as the items shown for a DC (items added by hand win, otherwise the ones read automatically).
// Returns { test(order) } or null when nothing usable was typed. The hand-made items are read once per search, not once per DC.
function itemSearch(q) {
  const auto = itemidx.itemMatcher(q); if (!auto) return null;
  const ix = index(), mine = o => (ix.get(nid(o.dc)) || []).filter(i => sameCo(i.company, o.organization || o.company));
  return {
    test: o => { const own = mine(o); return own.length ? own.some(i => auto.hit(i.desc, '')) : auto.test(o); },
  };
}
// change the status / received quantity / note of items (from the Company report)
function setItemStatus(recId, itemId, ch) {
  if (recId === 'auto') return itemidx.setState(itemId, ch);              // an item read automatically from the items sheet / ERP
  const r = get(recId), it = r && r.items.find(i => i.id === itemId); if (!it) throw new Error('Item not found.');
  const one = dcitems.clean([{ ...it, ...ch }])[0]; Object.assign(it, one, { id: it.id }); r.updatedAt = Date.now(); (idx = null, store.save()); return it;
}

// edit an item added by hand in "DC files" (name, qty, unit, note): there is no Excel sheet behind it, so only the app's copy changes
function editItem(recId, itemId, ch) {
  const r = get(recId), it = r && r.items.find(i => i.id === itemId); if (!it) throw new Error('Item not found.');
  const one = dcitems.clean([{ ...it, desc: ch.desc !== undefined ? ch.desc : it.desc, qty: ch.qty !== undefined ? ch.qty : it.qty, unit: ch.unit !== undefined ? ch.unit : it.unit }])[0];
  if (!one) throw new Error('The item name cannot be empty.');
  Object.assign(it, one, { id: it.id }); r.updatedAt = Date.now(); (idx = null, store.save()); return it;
}

module.exports = { itemSearch, editItem, itemsForDc, itemsForOrder, countForOrder, itemsForOrderAsync, setItemStatus, rescan, all, get, view, row, create, update, remove, addFile, removeFile, readFile, ownerOfFile, addLinks, removeLink };
