// Quotations: a shared letterhead (company name, address, logo, signature ... any team member can change it) and the quotes
// made on it. Every quote keeps its own copy of the letterhead, so changing the shared one never rewrites an old quotation.
const crypto = require('crypto');
const store = require('./store');
const { render, totals, jpegInfo, layoutOf } = require('./quotepdf');

let SEED = {}; try { SEED = require('./quote-seed.json'); } catch {}

// first-run letterhead (taken from the M.R. Enterprises quotation form); everything is editable in the app
const DEFAULT_CFG = () => ({
  title: 'QUOTATION FORM', company: 'M.R. ENTERPRISES', address: '78/ B1 BLOCK 6 P.E.C.H.S NEAR IMAM AHMED ROAD KARACHI.',
  lines: 'UAN : 111-122-222\nN.T.N # 3956216-6', logo: SEED.logo || '', signature: SEED.signature || '',
  signer: 'FURQAN MAKKI', signerCompany: 'M.R. ENTERPRISES', color: '#2e75b6', currency: '',
  thanks: 'Thank you for your business!', terms: 'FREE PACKING AND HANDLING\nDELIVERY AT YOUR DOOR STEP\nDELIVERY WILL BE MADE IN 2 WORKING DAYS',
  validDays: 14, gst: 18, unit: 'EACH', prefix: 'QT-', next: 1,
});

// optional table columns: Qty, Unit and GST % can be switched off (Description, Unit price and Total always show)
// The columns are an ordered list: { k, on, l } = which column, shown or not, and its heading. x1 / x2 are free-text columns you name yourself.
const COL_DEF = [['desc', 'Description'], ['qty', 'Qty'], ['unit', 'Unit'], ['price', 'Unit price'], ['gst', 'GST %'], ['total', 'Total'], ['x1', 'Custom 1'], ['x2', 'Custom 2'], ['x3', 'Custom 3'], ['x4', 'Custom 4']];
const COL_FIXED = new Set(['desc', 'price', 'total']); // these always show (they can still be renamed and moved)
const ALL_COLS = { qty: true, unit: true, gst: true };
// per-column look (Customize layout): width in points (0 = automatic), alignment (l / c / r, '' = the column's usual), font size (0 = table size), bold
const colStyle = e => ({ w: e.k === 'desc' ? 0 : Math.max(0, Math.min(300, Math.round(num(e.w, 0)))), a: ['l', 'c', 'r'].includes(e.a) ? e.a : '', sz: Math.max(0, Math.min(14, num(e.sz, 0))), b: e.b !== false && e.b !== 0 && e.b !== 'false' });
const colsClean = v => {
  const lab = Object.fromEntries(COL_DEF), legacy = v && !Array.isArray(v) ? v : null, src = Array.isArray(v) ? v : [], out = [], seen = new Set();
  for (const e of src) { if (!e || lab[e.k] === undefined || seen.has(e.k)) continue; seen.add(e.k); out.push({ k: e.k, on: COL_FIXED.has(e.k) || e.on !== false && e.on !== 0, l: str(e.l, 20).trim() || lab[e.k], ...colStyle(e) }); }
  for (const [k, l] of COL_DEF) if (!seen.has(k)) out.push({ k, l, on: COL_FIXED.has(k) || (legacy ? legacy[k] !== false : !k.startsWith('x')), ...colStyle({ k }) });
  return out;
};
const colFlags = cols => Object.fromEntries(colsClean(cols).map(c => [c.k, c.on]));
const str = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, max);
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : d; };
const img = v => { const s = String(v || ''); return s === '' || (jpegInfo(s) && s.length < 2.5e6) ? s : null; }; // JPEG data URL, or empty
const colour = v => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '#2e75b6';

function cfg() {
  const db = store.db;
  if (!db.quoteCfg) { db.quoteCfg = DEFAULT_CFG(); store.save(); }
  return db.quoteCfg;
}
function quotes() { const db = store.db; if (!Array.isArray(db.quotes)) db.quotes = []; return db.quotes; }

// the letterhead part (also used for a single quotation)
function cleanHead(h, base) {
  h = h || {}; base = base || {};
  const pick = (k, max) => (h[k] === undefined ? str(base[k], max) : str(h[k], max));
  const logo = h.logo === undefined ? base.logo || '' : img(h.logo), sig = h.signature === undefined ? base.signature || '' : img(h.signature);
  if (logo === null) throw new Error('The logo must be a picture (PNG, JPG ...).');
  if (sig === null) throw new Error('The signature / stamp must be a picture (PNG, JPG ...).');
  return {
    title: pick('title', 60), company: pick('company', 120), address: pick('address', 300), lines: pick('lines', 600), logo, signature: sig,
    signer: pick('signer', 80), signerCompany: pick('signerCompany', 120), color: colour(h.color === undefined ? base.color : h.color), currency: pick('currency', 8).trim(),
  };
}
const HEAD_KEYS = ['title', 'company', 'address', 'lines', 'logo', 'signature', 'signer', 'signerCompany', 'color', 'currency'];

function getCfg() { return cfg(); }
function setCfg(b) {
  const c = cfg(), h = cleanHead(b, c);
  Object.assign(c, h);
  if (b.thanks !== undefined) c.thanks = str(b.thanks, 300);
  if (b.terms !== undefined) c.terms = str(b.terms, 2000);
  if (b.validDays !== undefined) c.validDays = Math.max(0, Math.min(365, Math.round(num(b.validDays, 14))));
  if (b.gst !== undefined) c.gst = Math.max(0, Math.min(100, num(b.gst, 18)));
  if (b.unit !== undefined) c.unit = str(b.unit, 20);
  if (b.cols !== undefined) c.cols = colsClean(b.cols);
  if (b.layout !== undefined) c.layout = layoutOf(b.layout);
  if (b.prefix !== undefined) c.prefix = str(b.prefix, 12);
  if (b.next !== undefined) c.next = Math.max(1, Math.round(num(b.next, c.next)));
  store.save(); return c;
}

// today in the desk's time zone (TZ is set in config.js), as yyyy-mm-dd
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nextNo = () => { const c = cfg(); const no = `${c.prefix || ''}${new Date().getFullYear()}-${String(c.next || 1).padStart(4, '0')}`; return no; };


// ---------- Companies: the customers you quote. Their "Quote to" details are saved once; each has its own quotation serial ----------
function companies() { const db = store.db; if (!Array.isArray(db.quoteCompanies)) db.quoteCompanies = []; return db.quoteCompanies; }
const defCols = () => colsClean(cfg().cols);
const defLayout = () => layoutOf(cfg().layout);
// each of your own companies can have its own letterhead (name, address, NTN lines, logo, stamp ...) and GST %; blank = the shared default letterhead
const headFor = co => cleanHead(co && co.head ? co.head : {}, cfg());
const gstFor = co => co && co.gst != null ? co.gst : cfg().gst;
const getCompany = id => companies().find(c => c.id === id) || null;
const initials = n => { const w = String(n || '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean); const s = w.length > 1 ? w.map(x => x[0]).join('') : (w[0] || '').slice(0, 4); return s.toUpperCase().slice(0, 6); };
// number for this company's next quotation, e.g. HBL-2026-0003 (each company counts on its own)
const companyNo = c => `${c.prefix || ''}${new Date().getFullYear()}-${String(c.next || 1).padStart(4, '0')}`;
function companyClean(b, base) {
  base = base || {}; const pick = (k, max) => (b[k] === undefined ? str(base[k], max) : str(b[k], max));
  const name = pick('name', 120).trim(); if (!name) throw new Error('Type the company name.');
  const prefix = b.prefix === undefined && base.prefix !== undefined ? base.prefix : str(b.prefix, 16).replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || `${initials(name)}-`;
  return {
    name, prefix, toLines: pick('toLines', 800), email: pick('email', 200).trim(), phone: pick('phone', 40).trim(),
    next: Math.max(1, Math.round(num(b.next, base.next || 1))), validDays: b.validDays === undefined || b.validDays === '' ? (base.validDays == null ? null : base.validDays) : Math.max(0, Math.min(365, Math.round(num(b.validDays, 14)))),
    thanks: pick('thanks', 300), terms: pick('terms', 2000), note: pick('note', 300),
    assigned: b.assigned === undefined ? (base.assigned || []) : [...new Set((Array.isArray(b.assigned) ? b.assigned : []).map(x => str(x, 40)).filter(Boolean))].slice(0, 200), // team members who may quote this company
    cols: b.cols === undefined ? (base.cols || null) : (b.cols ? colsClean(b.cols) : null), // null = use the default columns
    head: b.head === undefined ? (base.head || null) : (b.head ? cleanHead(b.head, cfg()) : null), // null = the default letterhead
    gst: b.gst === undefined ? (base.gst == null ? null : base.gst) : (b.gst === '' || b.gst === null ? null : Math.max(0, Math.min(100, num(b.gst, 0)))),
    layout: b.layout === undefined ? (base.layout || null) : (b.layout ? layoutOf(b.layout) : null), // table style + sections; null = the default layout
  };
}
const companyList = () => companies().map(c => ({ ...c, quotes: quotes().filter(q => q.companyId === c.id).length })).sort((a, b) => a.name.localeCompare(b.name));
function saveCompany(id, b) {
  if (id) { const c = getCompany(id); if (!c) throw new Error('Company not found'); Object.assign(c, companyClean(b, c), { updatedAt: Date.now() }); store.save(); return c; }
  const c = { id: 'c_' + crypto.randomBytes(5).toString('hex'), ...companyClean(b, null), createdAt: Date.now(), updatedAt: Date.now() };
  companies().push(c); store.save(); return c;
}
function removeCompany(id) { const a = companies(), i = a.findIndex(c => c.id === id); if (i >= 0) { a.splice(i, 1); quotes().forEach(q => { if (q.companyId === id) q.companyId = ''; }); store.save(); } } // old quotations keep their own text

// a fresh quotation, ready to fill in: today's date, the shared letterhead, default terms
function blank(companyId) {
  const c = cfg(), co = companyId ? getCompany(companyId) : null, head = headFor(co), cols = co && co.cols ? co.cols : defCols(), layout = co && co.layout ? layoutOf(co.layout) : defLayout(); // a company brings its saved Quote-to details, its own number, and its own terms if it has any
  return { id: '', companyId: co ? co.id : '', no: co ? companyNo(co) : nextNo(), date: today(), validDays: co && co.validDays != null ? co.validDays : c.validDays, toLines: co ? co.toLines : '', cols, layout, items: [{ desc: '', qty: 1, unit: c.unit || 'EACH', price: 0, gst: colFlags(cols).gst ? gstFor(co) : 0, x1: '', x2: '', x3: '', x4: '' }],
    thanks: (co && co.thanks) || c.thanks || '', terms: (co && co.terms) || c.terms || '', head, sent: [] };
}

function cleanItems(items, cols) {
  cols = colFlags(cols); // a column that is switched off counts as 1 (qty) / 0 (GST), so hidden numbers never change the total
  return (Array.isArray(items) ? items : []).slice(0, 300).map(i => ({ desc: str(i && i.desc, 400), qty: cols.qty ? Math.max(0, num(i && i.qty, 1)) : 1, unit: str(i && i.unit, 20), price: Math.max(0, num(i && i.price, 0)), gst: cols.gst ? Math.max(0, Math.min(100, num(i && i.gst, 0))) : 0, x1: str(i && i.x1, 80), x2: str(i && i.x2, 80), x3: str(i && i.x3, 80), x4: str(i && i.x4, 80) }))
    .filter(i => i.desc.trim() || i.price);
}
function clean(b, base) {
  base = base || {}; const cols = b.cols !== undefined ? colsClean(b.cols) : base.cols ? colsClean(base.cols) : defCols();
  const companyId = b.companyId !== undefined ? (getCompany(b.companyId) ? b.companyId : '') : base.companyId || '';
  return {
    cols, layout: b.layout !== undefined ? layoutOf(b.layout) : base.layout ? layoutOf(base.layout) : defLayout(),
    companyId,
    no: str(b.no !== undefined ? b.no : base.no, 40).trim() || nextNo(), date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : base.date || today(),
    validDays: Math.max(0, Math.min(365, Math.round(num(b.validDays, base.validDays || 0)))), toLines: str(b.toLines !== undefined ? b.toLines : base.toLines, 800),
    items: cleanItems(b.items !== undefined ? b.items : base.items, cols), thanks: str(b.thanks !== undefined ? b.thanks : base.thanks, 300), terms: str(b.terms !== undefined ? b.terms : base.terms, 2000),
    head: cleanHead(b.head, base.head || headFor(getCompany(companyId))), // a new quotation starts from its company's letterhead; team members cannot change it
  };
}

const summary = q => { const t = totals(q.items), co = q.companyId ? getCompany(q.companyId) : null; return { id: q.id, no: q.no, companyId: q.companyId || '', company: co ? co.name : '', email: co ? co.email : '', date: q.date, to: String(q.toLines || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2).join(' · '), items: (q.items || []).length, total: t.total, currency: (q.head || {}).currency || '', sentCount: (q.sent || []).length, lastSent: (q.sent || []).slice(-1)[0] || null, by: q.by || '', updatedAt: q.updatedAt || q.createdAt || 0 }; };
const list = () => quotes().map(summary).sort((a, b) => b.updatedAt - a.updatedAt);
const get = id => quotes().find(q => q.id === id) || null;

function save(id, b, by) {
  const arr = quotes();
  if (id) {
    const q = get(id); if (!q) throw new Error('Quotation not found');
    Object.assign(q, clean(b, q)); q.updatedAt = Date.now(); store.save(); return q;
  }
  const q = { id: 'q_' + crypto.randomBytes(5).toString('hex'), ...clean(b, null), sent: [], by: by || '', createdAt: Date.now(), updatedAt: Date.now() };
  // the number counter moves on when the number the person used is the one the app suggested
  const co = q.companyId ? getCompany(q.companyId) : null;
  if (co) { if (q.no === companyNo(co)) co.next = (co.next || 1) + 1; } else { const c = cfg(); if (q.no === nextNo()) c.next = (c.next || 1) + 1; }
  arr.push(q); store.save(); return q;
}
function duplicate(id, by) {
  const q = get(id); if (!q) throw new Error('Quotation not found');
  const c = cfg(), co = q.companyId ? getCompany(q.companyId) : null, copy = { ...JSON.parse(JSON.stringify(q)), id: 'q_' + crypto.randomBytes(5).toString('hex'), no: co ? companyNo(co) : nextNo(), date: today(), sent: [], by: by || q.by, createdAt: Date.now(), updatedAt: Date.now() };
  if (co) co.next = (co.next || 1) + 1; else c.next = (c.next || 1) + 1; quotes().push(copy); store.save(); return copy;
}
function remove(id) { const a = quotes(), i = a.findIndex(q => q.id === id); if (i >= 0) { a.splice(i, 1); store.save(); } }
function markSent(id, via, to, by) { const q = get(id); if (!q) return; q.sent = q.sent || []; q.sent.push({ via, to, by: by || '', at: Date.now() }); q.sent = q.sent.slice(-30); store.save(); }

const slug = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const fileName = q => `Quotation-${slug(q.no) || 'draft'}${slug((q.head || {}).company) ? '-' + slug(q.head.company) : ''}.pdf`;
const pdf = q => render(q);

module.exports = { companyList, getCompany, saveCompany, removeCompany, getCfg, setCfg, blank, save, duplicate, remove, get, list, markSent, pdf, fileName, clean, totals, today };
