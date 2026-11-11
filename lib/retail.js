// Retail shops: accounts (from a QuickBooks export or created in WhatsApp), price list, invoices.
//
// Three data files can be linked (OneDrive / folder path) or uploaded as Excel or CSV:
//   accounts  = customer list         (QuickBooks: Reports > Customer Contact List, plus an "Account No" column)
//   products  = products / price list (QuickBooks: Products and Services list)
//   invoices  = open invoices         (QuickBooks: Open Invoices report)
// New shops that register in WhatsApp get an account number such as RT-SD-0004, are kept in db.retail.registered,
// appended to data/retail-new-shops.csv, and can be exported as a QuickBooks-importable customer CSV.
const fs = require('fs'), path = require('path');
const store = require('./store');
const cfgFile = require('./config');
const sync = require('./sync');
const orders = require('./orders');
const qbo = require('./qbo');
const { readRows, sheetNames } = require('./xlsx');

const KINDS = ['accounts', 'products', 'invoices'];
const DEFAULT_REGIONS = [
  { name: 'Sindh', code: 'SD', aliases: ['karachi', 'hyderabad'], agentId: '' }, { name: 'Punjab', code: 'PB', aliases: ['lahore'], agentId: '' },
  { name: 'Khyber Pakhtunkhwa', code: 'KP', aliases: ['kpk', 'peshawar'], agentId: '' }, { name: 'Balochistan', code: 'BL', aliases: ['quetta'], agentId: '' }, { name: 'Other', code: 'OT', aliases: [], agentId: '' },
];
function R() {
  const db = store.db; db.retail = db.retail || {};
  const r = db.retail;
  r.regions = r.regions || DEFAULT_REGIONS.map(x => ({ ...x }));
  r.prefix = r.prefix || 'RT'; r.currency = r.currency === undefined ? 'Rs' : r.currency; r.autoApprove = !!r.autoApprove;
  r.files = r.files || {}; for (const k of KINDS) r.files[k] = r.files[k] || { url: '', minutes: 30, lastSync: 0, lastError: '', count: 0, name: '' };
  r.accounts = r.accounts || []; r.products = r.products || []; r.invoices = r.invoices || []; r.registered = r.registered || [];
  r.qbo = r.qbo || { accounts: [], products: [], invoices: [] }; // live data read from QuickBooks Online (lib/qbo.js)
  return r;
}

// ---------- reading QuickBooks exports ----------
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const normId = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const digits = s => String(s || '').replace(/\D/g, '');
const num = s => { const n = parseFloat(String(s || '').replace(/[^0-9.\-()]/g, '').replace(/^\((.*)\)$/, '-$1')); return Number.isFinite(n) ? n : 0; };
const money = n => { const c = R().currency; return `${c ? c + ' ' : ''}${(+n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`; };

const FIELDS = {
  accounts: [
    ['id', ['account no', 'account number', 'account id', 'account', 'acct no', 'acct', 'customer id', 'customer no', 'customer number', 'customer code', 'shop id', 'shop no', 'retailer id', 'id', 'code']],
    ['name', ['customer', 'customer name', 'shop name', 'shop', 'name', 'company name', 'company', 'display name', 'retailer', 'client name', 'client', 'party name', 'party']],
    ['contact', ['contact', 'contact name', 'full name', 'owner', 'owner name', 'contact person', 'attention']],
    ['phone', ['phone', 'phone numbers', 'phone number', 'mobile', 'mobile no', 'cell', 'cell no', 'contact no', 'contact number', 'main phone', 'telephone', 'tel']],
    ['email', ['email', 'e mail', 'main email']],
    ['address', ['address', 'billing address', 'bill to', 'bill address', 'shipping address', 'ship to', 'street', 'street address']],
    ['city', ['city', 'town', 'billing city']],
    ['region', ['region', 'state', 'province', 'state province', 'area', 'territory', 'zone', 'billing state']],
    ['balance', ['balance', 'open balance', 'balance total', 'outstanding', 'outstanding balance', 'amount due', 'total balance', 'receivable']],
  ],
  products: [
    ['name', ['product', 'product name', 'item', 'item name', 'product service', 'product service name', 'name', 'description', 'sales description']],
    ['sku', ['sku', 'item code', 'code', 'product code', 'item no', 'part no']],
    ['price', ['price', 'sales price', 'unit price', 'rate', 'selling price', 'retail price', 'mrp', 'amount']],
    ['category', ['category', 'type', 'group', 'item type', 'class', 'product category']],
    ['unit', ['unit', 'uom', 'unit of measure', 'pack', 'size']],
    ['region', ['region', 'area', 'state', 'province', 'territory', 'zone']],
    ['account', ['account no', 'account number', 'account id', 'customer id', 'shop id', 'shop']],
  ],
  invoices: [
    ['account', ['account no', 'account number', 'account id', 'customer id', 'customer no', 'customer', 'customer name', 'name', 'shop name', 'shop']],
    ['no', ['invoice no', 'invoice number', 'invoice', 'num', 'number', 'doc number', 'doc no', 'transaction no', 'ref no', 'no']],
    ['date', ['date', 'invoice date', 'txn date', 'transaction date']],
    ['due', ['due date', 'due']],
    ['amount', ['amount', 'total', 'total amount', 'invoice amount', 'original amount', 'debit']],
    ['open', ['open balance', 'balance', 'amount due', 'outstanding', 'due amount', 'remaining', 'balance due']],
    ['status', ['status', 'payment status']],
  ],
};

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const head = text.split(/\r?\n/, 1)[0], d = [',', ';', '\t'].map(c => [c, head.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// Finds the header row and column positions, trying every tab; returns [{field: value}] objects.
function readTable(buf, kind) {
  const defs = FIELDS[kind], known = new Set(defs.flatMap(f => f[1]));
  const sets = buf.length > 3 && buf.readUInt32LE(0) === 0x04034b50 ? sheetNames(buf).map(n => readRows(buf, n)) : [parseCsv(buf.toString('utf8'))];
  let best = null;
  for (const rows of sets) rows.slice(0, 20).forEach((r, i) => { const sc = r.filter(c => known.has(norm(c))).length; if (sc >= 2 && (!best || sc > best.sc)) best = { sc, rows, i }; });
  if (!best) throw new Error(`Could not find the column headings. For ${kind} the file needs headings such as: ${defs.slice(0, 5).map(f => f[1][0]).join(', ')}…`);
  const headers = best.rows[best.i].map(h => norm(h)), idx = {}, used = new Set();
  for (const [k, aliases] of defs) { const i = headers.findIndex((h, j) => !used.has(j) && aliases.includes(h)); if (i >= 0) { idx[k] = i; used.add(i); } }
  const out = [];
  for (const r of best.rows.slice(best.i + 1)) {
    if (!r.some(c => String(c || '').trim())) continue;
    const o = {}; for (const [k] of defs) o[k] = idx[k] !== undefined ? String(r[idx[k]] ?? '').replace(/\s+/g, ' ').trim() : '';
    out.push(o);
  }
  return { rows: out, idx };
}

function importFile(kind, buf) {
  const r = R(), { rows, idx } = readTable(buf, kind);
  if (kind === 'accounts') {
    if (idx.id === undefined) throw new Error('The customer list needs an "Account No" column (the number a shop will type in WhatsApp). In QuickBooks add it as a custom field or number your customers, then export again.');
    if (idx.name === undefined) throw new Error('The customer list needs a "Customer" (shop name) column.');
    const seen = new Set(), list = [];
    for (const o of rows) { const id = normId(o.id); if (!id || !o.name || seen.has(id)) continue; seen.add(id); list.push({ id: o.id, name: o.name, contact: o.contact, phone: o.phone, email: o.email, address: o.address, city: o.city, region: o.region, balance: o.balance === '' ? null : num(o.balance) }); }
    r.accounts = list; return list.length;
  }
  if (kind === 'products') {
    if (idx.name === undefined) throw new Error('The price list needs a "Product" (or "Item") column.');
    r.products = rows.filter(o => o.name).map(o => ({ name: o.name, sku: o.sku, price: o.price === '' ? null : num(o.price), category: o.category, unit: o.unit, region: o.region, account: o.account })).slice(0, 30000);
    return r.products.length;
  }
  if (idx.account === undefined) throw new Error('The invoice list needs a "Customer" or "Account No" column.');
  r.invoices = rows.filter(o => o.account && (o.no || o.amount || o.open)).map(o => {
    const amount = num(o.amount), paid = /paid|closed/i.test(o.status) && !/unpaid|not paid/i.test(o.status);
    return { account: o.account, no: o.no, date: o.date, due: o.due, amount, open: o.open !== '' ? num(o.open) : paid ? 0 : amount, status: o.status };
  }).slice(0, 60000);
  return r.invoices.length;
}

// ---------- the three data files: link or upload ----------
const running = new Set(), lastTry = new Map();
function setFile(kind, b) {
  const f = R().files[kind]; if (!f) throw new Error('Unknown file');
  const url = sync.cleanLink(b.url);
  if (b.url !== undefined) f.url = url;
  if (b.minutes !== undefined) f.minutes = Math.min(1440, Math.max(1, +b.minutes || 30));
  store.save(); return f;
}
async function syncFile(kind) {
  const f = R().files[kind]; if (!f || !f.url) throw new Error('Paste the share link (or folder path) of the file first.');
  if (running.has(kind)) throw new Error('A sync is already running.');
  running.add(kind); lastTry.set(kind, Date.now());
  try { const n = importFile(kind, await sync.fetchSheet(f.url, { csv: true })); Object.assign(f, { lastSync: Date.now(), lastError: '', count: n }); store.save(); return n; }
  catch (e) { f.lastError = e.message; store.save(); throw e; }
  finally { running.delete(kind); }
}
function uploadFile(kind, buf) {
  const f = R().files[kind]; if (f.url) throw new Error('This file is read from a link. Remove the link first to upload by hand.');
  const n = importFile(kind, buf); Object.assign(f, { lastSync: Date.now(), lastError: '', count: n }); store.save(); return n;
}
function clearFile(kind) { const r = R(); r[kind] = []; Object.assign(r.files[kind], { url: '', lastSync: 0, lastError: '', count: 0 }); store.save(); }
let ticker = null;
function start() {
  clearInterval(ticker);
  ticker = setInterval(() => { for (const k of KINDS) { const f = R().files[k]; if (f.url && !running.has(k) && Date.now() - (lastTry.get(k) || f.lastSync || 0) >= Math.max(1, f.minutes) * 60000) syncFile(k).catch(e => console.error(`Retail ${k} sync failed:`, e.message)); } }, 30000);
}

// ---------- regions ----------
const regionList = () => R().regions;
function regionOf(raw) {
  const t = norm(raw); if (!t) return null;
  const hit = regionList().find(g => [g.name, g.code, ...(g.aliases || [])].some(n => { n = norm(n); return n && (n === t || (t.length >= 4 && n.includes(t)) || (n.length >= 4 && t.includes(n))); }));
  return hit || null;
}
const regionName = acc => (regionOf(acc.region) || {}).name || acc.region || '';
function cleanRegions(list) {
  const out = [], codes = new Set();
  for (const g of Array.isArray(list) ? list : []) {
    const name = String(g.name || '').trim(); if (!name) continue;
    let code = String(g.code || name.slice(0, 2)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'XX'; while (codes.has(code)) code += 'X'; codes.add(code);
    out.push({ name: name.slice(0, 40), code, aliases: (Array.isArray(g.aliases) ? g.aliases : String(g.aliases || '').split(',')).map(s => String(s).trim()).filter(Boolean).slice(0, 12), agentId: String(g.agentId || '') });
  }
  if (!out.length) throw new Error('Keep at least one region.');
  return out.slice(0, 10); // WhatsApp lists hold 10 choices
}
function setConfig(b) {
  const r = R();
  if (b.regions) r.regions = cleanRegions(b.regions);
  if (b.prefix !== undefined) r.prefix = String(b.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'RT';
  if (b.currency !== undefined) r.currency = String(b.currency).trim().slice(0, 6);
  if (b.autoApprove !== undefined) r.autoApprove = !!b.autoApprove;
  store.save(); return { regions: r.regions, prefix: r.prefix, currency: r.currency, autoApprove: r.autoApprove };
}

// ---------- accounts ----------
const all = () => {
  const r = R(), seen = new Set(), out = [];
  for (const a of [...r.registered.map(a => ({ ...a, source: 'chat' })), ...r.qbo.accounts.map(a => ({ ...a, source: 'qbo' })), ...r.accounts.map(a => ({ ...a, source: 'file' }))]) { const k = normId(a.id); if (seen.has(k)) continue; seen.add(k); out.push(a); }
  return out;
};
const allProducts = () => { const r = R(); return [...r.qbo.products, ...r.products]; };
const allInvoices = () => { const r = R(); return [...r.qbo.invoices, ...r.invoices]; };
const byId = id => { const k = normId(id); return k ? all().find(a => normId(a.id) === k) || null : null; };
function findInText(text) {
  const t = String(text || '').trim(); if (normId(t).length < 3) return null;
  let a = byId(t); if (a) return a;
  for (const tok of t.split(/[\s,;:]+/)) { if (normId(tok).length >= 3 && (a = byId(tok))) return a; }
  return null;
}
const last9 = s => digits(s).slice(-9);
const phonesOf = a => String(a.phone || '').split(/[,;/]|\s{2,}/).map(digits).filter(d => d.length >= 7);
function phoneMatches(a, wa) { const w = last9(wa); return w.length >= 7 && phonesOf(a).some(p => p.slice(-9) === w); }
function last4Matches(a, text) { const d = digits(text); if (d.length < 4) return false; const t = d.slice(-Math.min(d.length, 9)); return phonesOf(a).some(p => p.endsWith(t)); }
const byPhone = wa => all().find(a => phoneMatches(a, wa)) || null;

function invoicesOf(a) {
  const id = normId(a.id), nm = norm(a.name);
  return allInvoices().filter(i => normId(i.account) === id || norm(i.account) === nm);
}
function balanceOf(a) { const inv = invoicesOf(a); if (inv.length) return inv.reduce((s, i) => s + (i.open || 0), 0); return a.balance === null || a.balance === undefined ? null : +a.balance; }
function productsFor(a) {
  const id = normId(a.id), rg = regionOf(a.region);
  return allProducts().filter(p => {
    if (p.account) return normId(p.account) === id;
    if (!p.region || /^(all|any)$/i.test(p.region)) return true;
    const pr = regionOf(p.region); return rg && pr ? pr.name === rg.name : norm(p.region) === norm(a.region);
  });
}

// ---------- registering a new shop ----------
function nextId(region) {
  const r = R(), code = region.code, re = new RegExp(`^${r.prefix}-${code}-(\\d+)$`, 'i');
  let n = Math.max(0, ...all().map(a => { const m = re.exec(String(a.id).trim()); return m ? +m[1] : 0; })) + 1, id;
  do { id = `${r.prefix}-${code}-${String(n++).padStart(4, '0')}`; } while (byId(id));
  return id;
}
const csvCell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
function appendToFile(a) {
  try {
    const f = path.join(path.dirname(cfgFile.dataFile), 'retail-new-shops.csv'), head = ['Account No', 'Shop name', 'Contact', 'Phone', 'Address', 'City', 'Region', 'Status', 'Created', 'WhatsApp number'];
    const line = [a.id, a.name, a.contact, a.phone, a.address, a.city, a.region, a.status, new Date(a.createdAt).toISOString(), a.waPhone].map(csvCell).join(',') + '\n';
    fs.appendFileSync(f, (fs.existsSync(f) ? '' : head.join(',') + '\n') + line);
  } catch (e) { console.error('Could not write retail-new-shops.csv:', e.message); }
}
function register(d, waPhone) {
  const r = R(), region = regionOf(d.region) || r.regions[r.regions.length - 1];
  const a = { id: nextId(region), name: d.name, contact: d.contact || '', phone: d.phone || waPhone, email: '', address: d.address, city: d.city || '', region: region.name, balance: 0, status: r.autoApprove ? 'approved' : 'pending', createdAt: Date.now(), waPhone };
  r.registered.push(a); store.save(); appendToFile(a);
  qbo.pushShop(a).catch(e => console.error('QuickBooks push failed:', e.message)); // no-op when QuickBooks Online is not connected
  return a;
}
function updateRegistered(id, b) {
  const a = R().registered.find(x => normId(x.id) === normId(id)); if (!a) throw new Error('Only shops created in WhatsApp can be edited here. Change file shops in QuickBooks.');
  for (const k of ['name', 'contact', 'phone', 'address', 'city', 'region']) if (b[k] !== undefined) a[k] = String(b[k]).trim();
  if (b.status && ['pending', 'approved'].includes(b.status)) a.status = b.status;
  if (!a.name) throw new Error('The shop needs a name.'); store.save(); return a;
}
function removeRegistered(id) { const r = R(), n = r.registered.length; r.registered = r.registered.filter(x => normId(x.id) !== normId(id)); if (r.registered.length === n) throw new Error('Shop not found.'); store.save(); }

// CSV that QuickBooks Online's customer import can read (map the columns on its import screen if your template differs).
function exportNew(which) {
  const list = R().registered.filter(a => which === 'all' || (which === 'approved' ? a.status === 'approved' : a.status === 'pending'));
  const head = ['Customer Display Name', 'Company', 'Phone', 'Billing Address Line 1', 'City', 'State', 'Notes'];
  return [head, ...list.map(a => [a.name, a.name, a.phone, a.address, a.city, a.region, `Account No: ${a.id}${a.contact ? ' | Contact: ' + a.contact : ''}`])].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------- what a shop sees in WhatsApp ----------
function detailsText(a) {
  const L = [`🏪 *${a.name}*`, `Account no: *${a.id}*`];
  const rg = regionName(a); if (rg) L.push(`Region: ${rg}`);
  const rep = (store.db.agents.find(x => x.id === ((regionOf(a.region) || {}).agentId)) || {}).name; if (rep) L.push(`Your sales person: ${rep}`);
  if (a.contact) L.push(`Contact: ${a.contact}`);
  if (a.phone) L.push(`Phone: ${a.phone}`);
  const addr = [a.address, a.city].filter(Boolean).join(', '); if (addr) L.push(`Address: ${addr}`);
  if (a.email) L.push(`Email: ${a.email}`);
  if (a.status === 'pending') L.push('\n⏳ Your new account is being confirmed by our team. You can already use it.');
  return L.join('\n');
}
function balanceText(a) {
  const bal = balanceOf(a), inv = invoicesOf(a).filter(i => i.open > 0).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const L = [`💰 *${a.name}* — balance`];
  L.push(bal === null ? 'Outstanding balance: not available yet' : `Outstanding balance: *${money(bal)}*`);
  if (inv.length) { L.push('\nOpen invoices:'); for (const i of inv.slice(0, 6)) L.push(`• ${i.no || 'Invoice'}${i.date ? ' · ' + i.date : ''}${i.due ? ' · due ' + i.due : ''} — ${money(i.open)}${i.open !== i.amount && i.amount ? ' of ' + money(i.amount) : ''}`); if (inv.length > 6) L.push(`…and ${inv.length - 6} more.`); }
  else if (bal !== null && bal > 0) L.push('Ask our team for the invoice list.'); else if (bal !== null) L.push('No open invoices. Thank you! 🙏');
  return L.join('\n');
}
function productsText(a, term) {
  let list = productsFor(a); const t = norm(term);
  if (t) list = list.filter(p => norm([p.name, p.sku, p.category].join(' ')).includes(t));
  if (!list.length) return t ? `No products matching "${term}". Send *products* to see the list.` : 'Our product list for your region is not loaded yet. Please ask our team.';
  const L = [`🛒 *Products & prices* — ${regionName(a) || a.name}${t ? ` (“${term}”)` : ''}`];
  let last = '';
  for (const p of list.slice(0, 20)) { if (p.category && p.category !== last) { L.push(`\n*${p.category}*`); last = p.category; } L.push(`• ${p.name}${p.unit ? ' (' + p.unit + ')' : ''}${p.price !== null ? ' — ' + money(p.price) : ''}`); }
  if (list.length > 20) L.push(`\n…and ${list.length - 20} more. Search with e.g. *products soap*.`);
  return L.join('\n');
}
function ordersFor(a, wa) {
  const nm = norm(a.name), seen = new Set(), out = [];
  for (const o of [...orders.findByPhone(wa), ...store.db.orders.filter(o => [o.customer, o.organization, o.company].some(x => norm(x) === nm) || (a.phone && phonesOf(a).some(p => o.phone && digits(o.phone).slice(-9) === p.slice(-9))))]) { if (!seen.has(o)) { seen.add(o); out.push(o); } }
  return out;
}
function ordersText(a, wa) {
  const l = ordersFor(a, wa); if (!l.length) return 'We could not find any orders for your shop in the tracking sheets. Send a PO / CN number, or choose *Talk to our team*.';
  return `📦 Orders for *${a.name}*:\n\n` + l.slice(0, 5).map(o => orders.formatOrder(o, { links: true })).join('\n\n') + (l.length > 5 ? `\n\n…and ${l.length - 5} more. Send a specific PO / CN number to see it.` : '');
}

// ---------- who may see which region ----------
// The administrator sees every region. A team member sees only the regions the administrator gave them (Team page);
// shops, balances, invoices and chats of other regions are hidden from them.
const validCodes = () => new Set(regionList().map(g => g.code));
const cleanCodes = list => { const ok = validCodes(); return [...new Set((Array.isArray(list) ? list : []).map(String).filter(c => ok.has(c)))]; };
function scopeOf(me) { if (!me || me.role === 'admin') return null; return cleanCodes(me.retailRegions); } // null = everything
const inScope = (a, scope) => !scope || scope.includes((regionOf(a.region) || {}).code);
const canSeeRegion = (me, regionName) => { const sc = scopeOf(me); return !sc || sc.includes((regionOf(regionName) || {}).code); };

// ---------- for the dashboard ----------
function view(me) {
  const r = R(), scope = scopeOf(me), list = all().filter(a => inScope(a, scope));
  const regions = scope ? r.regions.filter(g => scope.includes(g.code)) : r.regions;
  return {
    scoped: !!scope,
    config: { regions, prefix: r.prefix, currency: r.currency, autoApprove: r.autoApprove },
    files: scope ? {} : Object.fromEntries(KINDS.map(k => [k, { ...r.files[k], loaded: r[k].length }])),
    qbo: scope ? null : qbo.publicStatus(),
    counts: scope ? { file: list.filter(a => a.source !== 'chat').length, chat: list.filter(a => a.source === 'chat').length, pending: list.filter(a => a.source === 'chat' && a.status === 'pending').length }
      : { file: r.accounts.length + r.qbo.accounts.length, chat: r.registered.length, pending: r.registered.filter(a => a.status === 'pending').length },
    accounts: list.slice(0, 4000).map(a => ({ id: a.id, name: a.name, contact: a.contact, phone: a.phone, address: a.address, city: a.city, region: regionName(a), balance: balanceOf(a), source: a.source, status: a.status || 'approved', createdAt: a.createdAt || 0, qb: !!a.qbId, qbError: a.qbError || '' })),
  };
}

module.exports = { R, KINDS, view, scopeOf, cleanCodes, canSeeRegion, setConfig, setFile, syncFile, uploadFile, clearFile, start, byId, findInText, byPhone, phoneMatches, last4Matches, regionOf, regionName, regionList,
  register, updateRegistered, removeRegistered, exportNew, detailsText, balanceText, productsText, ordersText, balanceOf, norm };
