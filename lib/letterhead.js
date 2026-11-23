// Letterheads for the printed Bill / DC: one profile per company (name, address, NTN, GST, phone, logo, stamp, bank lines, notes...).
// Edited by the administrator in "DC items sync -> Letterheads". A profile lists the company names it is used for; the one with no names is the default.
const crypto = require('crypto');
const store = require('./store');

const str = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const img = v => { v = String(v || ''); return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 900000 ? v : ''; };
const nco = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const box = () => { const d = store.db; if (!Array.isArray(d.letterheads)) d.letterheads = []; return d.letterheads; };
const DEFAULT = { name: 'M.R. ENTERPRISES', address: '78/ B1 BLOCK 6 P.E.C.H.S NEAR IMAM AHMED ROAD KARACHI UAN : 111 122 222', ntn: '3956216-6', gst: '3277876151206', phone: '021- 34555883', mobile: '0300 2760602',
  extra: '', bank: 'BANK : BANK -ALFALAH\nACC # : PK68ALFH0018001007085078\nBRANCH : PAPER MARKET BRANCH', billNote: '', dcNote: 'If you have any query regarding this delivery challan contact to our representative with in 7 working days.', sig: 'Collect by, Check by, Pack by' };

// Where the printed parts sit: { bill: { ids: { dx, dy, s, hide } }, dc: {...} }. dx / dy in mm from the normal place, s = size in %, hide = not printed.
const PARTS = ['title', 'name', 'addr', 'logo', 'hdrimg', 'tax', 'contact', 'date', 'ids', 'ms', 'ad', 'ph', 'ct', 'bank', 'totals', 'stamp', 'sig', 'note'];
function layout(v) {
  const out = {}, mm = x => Math.max(-250, Math.min(250, Math.round((+x || 0) * 2) / 2));
  for (const kind of ['bill', 'dc']) {
    const src = v && typeof v === 'object' ? v[kind] : null; if (!src || typeof src !== 'object') continue; const o = {};
    for (const k of PARTS) { const e = src[k]; if (!e || typeof e !== 'object') continue; const r = {}, dx = mm(e.dx), dy = mm(e.dy), sc = Math.max(30, Math.min(300, Math.round(+e.s || 100)));
      if (dx) r.dx = dx; if (dy) r.dy = dy; if (sc !== 100) r.s = sc; if (e.hide) r.hide = 1; if (Object.keys(r).length) o[k] = r; }
    if (Object.keys(o).length) out[kind] = o;
  }
  return out;
}
function clean(b, old) {
  b = b || {}; const o = old || {};
  const f = (k, n) => (b[k] !== undefined ? str(b[k], n) : (o[k] || ''));
  const im = k => (b[k] !== undefined ? img(b[k]) : (o[k] || ''));
  const num = (k, d) => { const v = b[k] !== undefined ? parseFloat(b[k]) : o[k]; return isFinite(v) ? Math.max(0, Math.min(120, v)) : d; };
  return { id: o.id || 'lh_' + crypto.randomBytes(4).toString('hex'), label: f('label', 80) || f('name', 120) || 'Letterhead', match: f('match', 600),
    name: f('name', 120), address: f('address', 300), ntn: f('ntn', 40), gst: f('gst', 40), phone: f('phone', 60), mobile: f('mobile', 60), extra: f('extra', 400),
    bank: f('bank', 500), billNote: f('billNote', 600), dcNote: f('dcNote', 400), sig: f('sig', 120),
    logo: im('logo'), headerImage: im('headerImage'), stamp: im('stamp'),
    layout: b.layout !== undefined ? layout(b.layout) : (o.layout || {}), blankHeader: b.blankHeader !== undefined ? !!b.blankHeader : !!o.blankHeader, topMm: num('topMm', 0), bottomMm: num('bottomMm', 0), isDefault: !!o.isDefault };
}
function ensure() { const a = box(); if (!a.some(p => p.isDefault)) a.unshift({ ...clean({ ...DEFAULT, label: 'Default (all other companies)' }, null), id: 'lh_default', isDefault: true }); return a; }
const list = () => ensure();
function forCompany(co) {
  const a = ensure(), k = nco(co);
  if (k) for (const p of a) { if (p.isDefault) continue; for (const n of String(p.match || '').split(/[,\n;]+/).map(nco).filter(x => x.length >= 3)) if (k === n || k.includes(n) || n.includes(k)) return p; }
  return a.find(p => p.isDefault) || a[0];
}
function save(id, b) {
  const a = ensure();
  if (id) { const i = a.findIndex(p => p.id === id); if (i < 0) throw new Error('Letterhead not found.'); const n = clean(b, a[i]); if (a[i].isDefault) { n.isDefault = true; n.match = ''; } a[i] = n; store.save(); return n; }
  if (a.length >= 60) throw new Error('Up to 60 letterheads.');
  const n = clean(b, null); a.push(n); store.save(); return n;
}
function remove(id) { const a = ensure(), i = a.findIndex(p => p.id === id); if (i < 0) return; if (a[i].isDefault) throw new Error('The default letterhead cannot be deleted.'); a.splice(i, 1); store.save(); }
module.exports = { list, forCompany, save, remove };
