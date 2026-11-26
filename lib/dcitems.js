// The items of a DC, tracked one by one (Company report -> open a DC -> "DC file & items").
//  * The DC file itself (PDF / picture / Word / Excel) is stored by lib/dcdocs.js (kind "dc").
//  * The items live in db.dcItems[key]  (key = dcdocs.keyOf(order) = "<sheet id>|<dc no>").
//  * parseFile() reads items out of an Excel / CSV DC file, parseText() out of text pasted from Excel.
//    PDFs and pictures are kept as the DC file; their items are pasted or typed in.
const crypto = require('crypto');
const store = require('./store');
const xlsx = require('./xlsx');

const box = () => (store.db.dcItems = store.db.dcItems || {});
const STATUS = ['pending', 'delivered', 'short', 'returned'];
const str = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const dcNo = v => String(v == null ? '' : v).trim().replace(/\.0+$/, '').slice(0, 60);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };

function clean(items) {
  return (Array.isArray(items) ? items : []).slice(0, 500).map(i => {
    const qty = Math.max(0, num(i && i.qty)), status = STATUS.includes(i && i.status) ? i.status : 'pending';
    let got = Math.max(0, num(i && i.got));
    if (status === 'delivered' && !got) got = qty;            // "delivered" with no number = everything arrived
    if (status === 'pending') got = 0;
    return { id: str(i && i.id, 20) || crypto.randomBytes(5).toString('hex'), dc: dcNo(i && i.dc), desc: str(i && i.desc, 400), qty, unit: str(i && i.unit, 20), got, status, note: str(i && i.note, 300) };
  }).filter(i => i.desc);
}
function summary(items) {
  const n = items.length, c = s => items.filter(i => i.status === s).length;
  return { count: n, delivered: c('delivered'), short: c('short'), returned: c('returned'), pending: c('pending'), qty: items.reduce((a, i) => a + i.qty, 0), got: items.reduce((a, i) => a + i.got, 0) };
}
function get(key) { const r = box()[key]; const items = r ? r.items : []; return { items, summary: summary(items), updatedAt: r ? r.updatedAt : 0, by: r ? r.by : '' }; }
function set(key, items, by) {
  const list = clean(items);
  if (!list.length) delete box()[key]; else box()[key] = { items: list, updatedAt: Date.now(), by: by || '' };
  store.save(); return get(key);
}
function count(key) { const r = box()[key]; return r ? r.items.length : 0; }

// ---------- reading a sheet of rows (Excel / pasted) ----------
const HEAD = {
  dc: /^(d\.?\s?c\.?\s*(no\.?|number|#|nos?)?|dc\s*#|challan\s*(no\.?|number|#)?|delivery\s*challan(\s*(no\.?|number|#))?|delivery\s*note(\s*no\.?)?)$/i,
  desc: /^(item|items|item\s*(name|description|details?)|description|descriptions?|product|particulars?|details?|material|article|name)$/i,
  qty: /^(qty|quantity|qnty|pcs|pieces|nos|no\.? of units|units?\s*qty|order(ed)?\s*qty)$/i,
  unit: /^(unit|uom|units?)$/i,
  got: /^(delivered|delivered\s*qty|received|recd|supplied)$/i,
  price: /^(unit\s*price|price|rate|unit\s*rate)$/i,
};
function fromRows(rows) {
  rows = (rows || []).map(r => (r || []).map(c => str(c, 400))).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  let hi = -1, map = {};
  for (let i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) {            // a header row names at least a description column and one more
    const m = {}; rows[i].forEach((c, j) => { for (const k of Object.keys(HEAD)) if (m[k] === undefined && HEAD[k].test(c.trim())) m[k] = j; });
    if (m.desc !== undefined && Object.keys(m).length >= 2) { hi = i; map = m; }
  }
  if (hi < 0) { // no header: Description, Qty, Unit, Price (a first column of plain numbers is skipped as "S.No")
    const sn = rows.every(r => /^\d{1,4}\.?$/.test(r[0] || '')) && (rows[0] || []).length > 2 ? 1 : 0;
    map = { desc: sn, qty: sn + 1, unit: sn + 2 };
  }
  let lastDc = '';
  return rows.slice(hi + 1).map(r => {
    const g = k => (map[k] === undefined ? '' : r[map[k]] || '');
    if (map.dc !== undefined && g('dc').trim()) lastDc = dcNo(g('dc'));   // a DC number written once above its items applies to the rows below it
    return { dc: map.dc === undefined ? '' : lastDc, desc: g('desc'), qty: num(g('qty')) || (map.qty === undefined || g('qty') === '' ? 1 : 0), unit: g('unit'), got: num(g('got')), price: num(g('price')) };
  }).filter(i => i.desc && !/^(total|grand total|sub\s*total)\b/i.test(i.desc));
}
function parseText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  const tab = lines.some(l => l.includes('\t'));
  return fromRows(lines.map(l => tab ? l.split('\t') : l.split(',')));
}
function parseFile(buf, name) {
  const ext = (String(name || '').split('.').pop() || '').toLowerCase();
  if (ext === 'csv' || ext === 'txt') return parseText(buf.toString('utf8'));
  if (ext === 'xlsx' || ext === 'xlsm') { try { return fromRows(xlsx.readRows(buf)); } catch { return []; } }
  return [];
}
module.exports = { get, set, count, clean, summary, parseText, parseFile, STATUS };
