const { readRows, sheetNames } = require('./xlsx');
const store = require('./store');
const courier = require('./courier');

// key, label shown in the app, header names that are recognised automatically
const FIELDS = [
  ['pr', 'P.R no (requisition)', ['pr no', 'p r no', 'pr', 'pr number', 'p r number', 'purchase requisition', 'requisition no', 'requisition', 'req no', 'req number', 'req']],
  ['po', 'PO no', ['po no', 'po number', 'po', 'p o no', 'p o', 'purchase order', 'purchase order no']],
  ['cn', 'CN no (consignment / tracking)', ['cn no', 'cn number', 'cn', 'c n no', 'consignment no', 'consignment number', 'consignment', 'tracking', 'tracking no', 'tracking number', 'tracking id', 'awb', 'awb no', 'docket no', 'booking no']],
  ['orderId', 'Order ID (other reference)', ['order id', 'orderid', 'order no', 'order number', 'order', 'id', 'reference', 'ref']],
  ['courier', 'Courier', ['courier', 'courier name', 'carrier', 'shipping company', 'shipper']],
  ['receivedBy', 'Received by (name of the person who took delivery)', ['received by', 'received by name', 'receiver', 'receiver name', 'receiving person', 'receiving person name', 'received person', 'recipient', 'recipient name', 'delivered to', 'signed by', 'pod name', 'delivery person', 'delivery man']],
  ['status', 'Status', ['status', 'order status', 'state', 'stage']],
  ['customer', 'Customer name', ['customer name', 'customer', 'name', 'client']],
  ['phone', 'Customer phone', ['customer phone', 'phone', 'mobile', 'whatsapp', 'contact', 'phone number', 'mobile number', 'whatsapp number']],
  ['organization', 'Organization', ['organization', 'organisation', 'company', 'org', 'business']],
  ['link', 'Tracking link (web address)', ['tracking link', 'tracking url', 'link', 'url']],
  ['orderDate', 'Order / DC date (used for "Added today" on the Overview)', ['dc date', 'd c date', 'dc dt', 'delivery challan date', 'order date', 'po date', 'p o date', 'date of order', 'order dt', 'po dt', 'order placed', 'order received date', 'booking date']],
  ['updated', 'Last updated', ['last updated', 'updated', 'updated at', 'last update', 'date']],
  ['notes', 'Notes', ['notes', 'note', 'remarks', 'comment', 'comments', 'details']],
];
const KEYS = FIELDS.map(f => f[0]);
const ID_KEYS = ['orderId', 'po', 'pr', 'cn'];

const isUrl = v => /^https?:\/\/\S+$/i.test(String(v || '').trim());
const LINKY = /image|photo|picture|pod\b|proof|link|url|attachment|file/i;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = s => String(s || '').replace(/\D/g, '');
const normId = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// A date typed or formatted in a sheet -> 'YYYY-MM-DD' (day-first, as used in Pakistan: 11/11/2026, 11-Nov-2026, 2026-11-11, 11.11.26). '' if it is not a date.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function parseDay(v) {
  const t = String(v == null ? '' : v).trim(); if (!t) return '';
  const ok = (y, m, d) => { if (y < 100) y += 2000; const dt = new Date(Date.UTC(y, m - 1, d)); return y >= 2000 && y < 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''; };
  let m;
  if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(t))) return ok(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-\/. ](\d{1,2})[-\/. ](\d{2,4})/.exec(t))) return ok(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[-\/. ]*([A-Za-z]{3,9})[-\/., ]*(\d{2,4})/.exec(t)) && MON[m[2].slice(0, 4).toLowerCase()] || (m && MON[m[2].slice(0, 3).toLowerCase()])) return ok(+m[3], MON[m[2].slice(0, 4).toLowerCase()] || MON[m[2].slice(0, 3).toLowerCase()], +m[1]);
  if ((m = /^([A-Za-z]{3,9})[-\/. ]*(\d{1,2})[,]?[-\/. ]*(\d{4})/.exec(t)) && (MON[m[1].slice(0, 4).toLowerCase()] || MON[m[1].slice(0, 3).toLowerCase()])) return ok(+m[3], MON[m[1].slice(0, 4).toLowerCase()] || MON[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return '';
}
// Dispatched / Self / Pending: the three groups the Overview and Find PO count.
//  self = collected by the customer or delivered by your own people (status or courier says self / collection / pick-up),
//  dispatched = sent out (dispatched, shipped, out for delivery, delivered, or it already has a CN / tracking number),
//  pending = anything not sent yet (Pending, Pending dispatch, Confirmed, Processing, Packed, On hold, empty ...). Cancelled / returned are "other".
const SELF_RE = /\bself\b|collect|pick[\s-]?up|walk[\s-]?in|own (rider|vehicle|delivery|driver)|by hand/i;
function classOf(o) {
  const st = String(o.status || '').toLowerCase(), cn = String(o.cn || '').trim().toLowerCase();
  if (/cancel|return|reject|refund/.test(st)) return 'other';
  if (/pending/.test(st)) return 'pending';
  if (SELF_RE.test(st) || SELF_RE.test(String(o.courier || '')) || cn === 'self') return 'self';
  if (/dispatch|ship|deliver|transit|courier|booked|handed|complete/.test(st)) return 'dispatched';
  if (cn && !/^(-|n\/?a|nil|none|pending)$/.test(cn)) return 'dispatched';
  return 'pending';
}
// Billed in ERP: the status says billed / invoiced, or a column called Bill / Invoice (bill no, invoice no, billed ...) has a real value.
// "Remaining" in the app = not billed yet.
const BILL_COL = /bill|invoice/i, NOT_BILLED = /^(-+|n\/?a|nil|none|no|pending|not billed|unbilled|not yet|0)$/i;
function billedOf(o) {
  const st = String(o.status || '');
  if (/un-?billed|not billed|not invoiced/i.test(st)) return false;
  if (/\bbilled\b|invoiced/i.test(st)) return true;
  return (o.extra || []).some(([l, v]) => { if (!BILL_COL.test(String(l))) return false; const t = String(v == null ? '' : v).trim(); return !!t && !NOT_BILLED.test(t); });
}
const ERR_CELL = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!|SPILL!|CALC!)$/i;
// A real DC = it has a DC no AND a branch (cost) code AND an address (description). Rows that only hold a pre-filled DC number are not DCs.
const DC_NO_H = h => /^(dc|d c|dc no|d c no|dc number|dc #|dc num|delivery challan|delivery challan no|delivery challan number)$/.test(norm(h));
const BRANCH_H = h => /branch code|cost code|^br( code| no)?$|^branch$|^cost centre$|^cost center$/.test(norm(h));
const ADDR_H = h => /address|^description$|^location$/.test(norm(h)) && !/email|e mail/.test(norm(h));
const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// How to read the sheet: which tab, which row holds the headers (0 = find it automatically), which column is which.
// Every company sheet ("source") keeps its own settings in source.cfg.
const DEFAULT_CFG = { sheet: '', headerRow: 0, map: {}, show: [] };
const getCfg = src => ({ ...DEFAULT_CFG, ...((src && src.cfg) || {}) });
function cleanCfg(x) {
  const map = {}; for (const k of KEYS) if (x.map && typeof x.map[k] === 'string' && x.map[k]) map[k] = x.map[k];
  return { sheet: String(x.sheet || ''), headerRow: Math.max(0, Math.min(50, +x.headerRow || 0)), map, show: (Array.isArray(x.show) ? x.show : []).map(String).slice(0, 30) };
}
function setCfg(src, x) { src.cfg = cleanCfg(x); store.save(); return src.cfg; }

const KNOWN = new Set(FIELDS.flatMap(f => f[2]));
function headerScore(rows) { let best = -1, score = 1; rows.slice(0, 25).forEach((r, i) => { const sc = r.filter(c => KNOWN.has(norm(c))).length; if (sc > score) { score = sc; best = i; } }); return { best, score: best >= 0 ? score : 0 }; }
function autoHeader(rows) {
  const { best } = headerScore(rows); if (best >= 0) return best;
  const first = rows.findIndex(r => r.filter(Boolean).length >= 3); return first >= 0 ? first : 0;
}

// Reads one worksheet and works out the columns. Never throws because of missing columns, so the setup screen can still show them.
function analyze(buffer, cfgIn) {
  const cfg = { ...DEFAULT_CFG, ...cfgIn }, sheets = sheetNames(buffer);
  let sheet = sheets.includes(cfg.sheet) ? cfg.sheet : '', all;
  if (sheet) all = readRows(buffer, sheet);
  else { // no tab chosen yet: use the one whose headers look most like an order sheet
    let top = -1; for (const n of sheets) { const rows = readRows(buffer, n), sc = headerScore(rows).score; if (sc > top) { top = sc; sheet = n; all = rows; } }
  }
  if (all.filter(r => r.some(Boolean)).length < 2) throw new Error(`The tab "${sheet}" is empty. Pick another tab, or add a header row and at least one order.`);
  // formula errors (#N/A, #REF! ...) are "empty", never a value: a blank DC row must not look dispatched / delivered
  all = all.map(r => r.map(c => (typeof c === 'string' && ERR_CELL.test(c.trim())) ? '' : c));
  const hi = cfg.headerRow > 0 ? Math.min(cfg.headerRow - 1, all.length - 1) : autoHeader(all);
  const width = Math.max(...all.slice(hi, hi + 60).map(r => r.length), 1), seen = {};
  const headers = Array.from({ length: width }, (_, i) => { let h = String(all[hi][i] || '').replace(/\s+/g, ' ').trim() || `Column ${colName(i)}`; if (seen[h]) h += ` (${++seen[h]})`; else seen[h] = 1; return h; });
  const idx = {}, guess = {};
  const dcI = headers.findIndex(DC_NO_H), brI = headers.findIndex(BRANCH_H);
  let adI = headers.findIndex(h => /address/i.test(h) && ADDR_H(h)); if (adI < 0) adI = headers.findIndex(ADDR_H);
  const dcMode = dcI >= 0 && brI >= 0 && adI >= 0; // this sheet is a DC register: only complete rows are DCs
  for (const [k, , aliases] of FIELDS) {
    const want = cfg.map[k]; if (want === '-') continue;
    let i = want ? headers.indexOf(want) : -1; if (i < 0) i = headers.findIndex(h => aliases.includes(norm(h)));
    // an image / photo column is its own column ("image link"): it can never be used as Last updated, Tracking link ... (older settings may say so)
    if (i >= 0 && /image|photo|picture/i.test(headers[i])) { i = want ? headers.findIndex(h => aliases.includes(norm(h)) && !/image|photo|picture/i.test(h)) : -1; }
    if (i >= 0) { idx[k] = i; guess[k] = headers[i]; }
  }
  if (idx.orderId !== undefined && !cfg.map.orderId && ['po', 'pr', 'cn'].some(k => idx[k] !== undefined)) { delete idx.orderId; delete guess.orderId; }
  const used = new Set(Object.values(idx)), dispIdx = headers.findIndex(h => /dispatch/i.test(h));
  // EVERY other column of the sheet is kept (reports can pick any of them). Customers on WhatsApp only see the
  // useful ones: the columns ticked in \"Columns\", else address / dates / packages ... plus any link or image column.
  const rest = headers.map((_, i) => i).filter(i => !used.has(i) && !/^Column /.test(headers[i])), nice = rest.filter(i => /address|location|branch|city|date|package|pieces|qty|quantity|weight|item|product|description|invoice|dc no|cost/i.test(headers[i]));
  const linky = rest.filter(i => LINKY.test(headers[i]));
  const custIdx = new Set(cfg.show.length ? cfg.show.map(h => headers.indexOf(h)).filter(i => i >= 0) : [...(nice.length ? nice : rest), ...linky].slice(0, 16));
  const showIdx = (cfg.show.length ? [...new Set([...custIdx, ...rest])] : rest).slice(0, 60);
  // columns the importer mapped to a field but the DC table has no column for (phone, notes, received by, order id, dates, link):
  // they must still be offered in the \"Columns\" menu, so keep their values too.
  const SHOWN_BY_TABLE = new Set(['po', 'pr', 'cn', 'courier', 'status', 'customer', 'organization']);
  const mappedShow = [...new Set(Object.entries(idx).filter(([k]) => !SHOWN_BY_TABLE.has(k)).map(([, i]) => i))].filter(i => !rest.includes(i));
  const body = all.slice(hi + 1), hasVal = i => body.some(r => String(r[i] == null ? '' : r[i]).trim());
  // every column of the sheet, in sheet order, for the Columns menu (columns the table already has are left out; an untitled column only if it holds data)
  const skipIdx = new Set(Object.entries(idx).filter(([k]) => SHOWN_BY_TABLE.has(k)).map(([, i]) => i));
  const allHeaders = headers.map((h, i) => [h, i]).filter(([h, i]) => !skipIdx.has(i) && (!/^Column /.test(h) || hasVal(i))).map(([h]) => h).slice(0, 200);
  const orders = [];
  for (const [ri, r] of all.slice(hi + 1).entries()) {
    if (!r.some(c => String(c == null ? '' : c).trim())) continue; // a completely empty row
    const o = {}; for (const k of KEYS) o[k] = idx[k] !== undefined ? String(r[idx[k]] || '').trim() : '';
    {
      const cell = i => i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : '', dc = cell(dcI), br = cell(brI), ad = cell(adI);
      if (dcMode && (!dc || !br || !ad)) continue; // DC number alone (or half-filled) is not a DC yet: PO / P.R may be empty, these three may not
      if (dc) o.dc = dc; if (br) o.branch = /^\d{1,3}$/.test(br) ? br.padStart(4, '0') : br; if (ad) o.address = ad.slice(0, 300);
    }
    if (norm(o.po) === 'po' || norm(o.cn) === 'tracking') continue; // a repeated header row
    // a row with no PO / P.R / CN yet is still an entry (it is counted in Excel too): keep it under its Excel row number
    o.orderId = o.orderId || o.po || o.pr || o.cn || (o.dc ? `DC ${o.dc}` : `Row ${hi + 2 + ri}`);
    const disp = dispIdx >= 0 ? String(r[dispIdx] || '').trim() : '';
    if (!o.status && o.receivedBy) o.status = 'Delivered'; // someone signed for it
    if (!o.status) o.status = o.cn.toLowerCase() === 'self' ? 'Self collection' : (o.cn || disp) ? 'Dispatched' : 'Pending dispatch';
    // a web address mapped to \"Last updated\" by mistake is a link column, not a date: keep it as a link
    if (isUrl(o.updated)) { (o._moved = o._moved || []).push([headers[idx.updated] || 'Image link', o.updated.slice(0, 2000), 1]); o.updated = ''; }
    o.row = hi + 2 + ri; // its Excel row number (so the app can write a change back into that row)
    o.orderDay = parseDay(o.orderDate); // the day the order / DC was made, read from the sheet itself
    o.updated = o.updated || disp;
    o.extra = [...(o._moved || []), ...showIdx.map(i => { const v0 = String(r[i] || '').trim(), v = (LINKY.test(headers[i]) && urlOf(v0)) || v0; return [headers[i], isUrl(v) ? v.slice(0, 2000) : v.slice(0, 200), custIdx.has(i) ? 1 : 0]; }).filter(([, v]) => v)]; delete o._moved;
    o.mapped = mappedShow.map(i => [headers[i], String(r[i] == null ? '' : r[i]).trim().slice(0, 2000)]).filter(([, v]) => v);
    // untitled columns that hold data are not in `rest` (it skips \"Column X\"): keep them as well
    for (const [i, h] of headers.entries()) if (/^Column /.test(h) && !used.has(i)) { const v = String(r[i] == null ? '' : r[i]).trim(); if (v) o.mapped.push([h, v.slice(0, 200)]); }
    orders.push(o);
  }
  // where each editable field lives in the sheet (0-based column), so a change made in the app can be written back
  const cols = {}; for (const k of ['status', 'courier', 'cn', 'receivedBy', 'notes', 'po', 'pr', 'orderId']) if (idx[k] !== undefined) cols[k] = idx[k];
  const dateCol = dispIdx >= 0 && !used.has(dispIdx) ? dispIdx : (idx.updated !== undefined && /updat/i.test(headers[idx.updated]) ? idx.updated : -1); if (dateCol >= 0) cols.date = dateCol;
  return { dcMode, sheets, sheet, cols, headerRow: hi + 1, headers, guess, orders, hasDate: idx.orderDate !== undefined, hasId: ID_KEYS.some(k => idx[k] !== undefined), extraHeaders: rest.map(i => headers[i]).slice(0, 80), allHeaders };
}

function parseSheet(buffer, cfg) {
  const a = analyze(buffer, cfg);
  if (!a.hasId) throw new Error('Could not find a PO no, P.R no, CN no or Order ID column. Open "Sheet & columns" and pick them.');
  return { dcMode: a.dcMode, orders: a.orders, columns: Object.keys(a.guess), extraHeaders: a.extraHeaders, allHeaders: a.allHeaders, hasDate: a.hasDate, sheet: a.sheet, cols: a.cols };
}

// For the setup screen: tabs, headers, current guess and a preview of what customers will receive.
function inspect(buffer, cfg) {
  const a = analyze(buffer, cfg);
  return { sheets: a.sheets, sheet: a.sheet, headerRow: a.headerRow, headers: a.headers, guess: a.guess, count: a.orders.length, hasId: a.hasId,
    preview: a.orders.slice(0, 3).map(formatOrder), fields: FIELDS.map(f => ({ key: f[0], label: f[1] })) };
}

const keyOf = o => [o.po, o.pr, o.cn, o.orderId].map(normId).join('|');
// Reads one company's sheet. Only THAT company's orders are replaced / merged; the other sheets are untouched.
function importOrders(buffer, mode, src) {
  const { orders, columns, extraHeaders, allHeaders, hasDate, sheet, cols, dcMode } = parseSheet(buffer, getCfg(src));
  src.wb = { sheet, cols }; // tab + columns for writing changes back
  src.dcMode = !!dcMode; // true = a DC register (DC no + branch code + address): only complete rows count as DCs
  src.hasDate = hasDate; // false = no DC date / order date column found: the Overview tells the admin to pick one in "Sheet & columns"
  src.headers = extraHeaders; // every column of the sheet, so reports can list it even while it is still empty
  src.allHeaders = allHeaders; // every column for the DC table's Columns menu
  src.mapped = columns; // standard fields (PO, CN, courier ...) this sheet really has
  const db = store.db;
  // remember when each order first appeared, so the admin can see what was added today. The very first read of a sheet is the
  // starting point (addedAt 0), not "new"; later syncs stamp only rows that were not there before.
  const before = new Map(db.orders.filter(o => o.src === src.id).map(o => [keyOf(o), o])), first = before.size === 0, now = Date.now();
  const added = new Map((db.poAdded || []).filter(x => x.src === src.id).map(x => [normId(x.dc), x]));
  for (const o of orders) { if (!o.po && o.dc && added.has(normId(o.dc))) { o.po = added.get(normId(o.dc)).po; o.poManual = true; } }
  for (const o of orders) { o.src = src.id; o.company = src.name; o.organization = o.organization || src.name; const old = before.get(keyOf(o)); o.addedAt = old ? (old.addedAt || 0) : first ? 0 : now; }
  const others = db.orders.filter(o => o.src !== src.id);
  let mine = orders;
  if (mode === 'merge') {
    const byId = new Map(db.orders.filter(o => o.src === src.id).map(o => [keyOf(o), o]));
    for (const o of orders) byId.set(keyOf(o), o);
    mine = [...byId.values()];
  }
  db.orders = [...others, ...mine];
  store.save();
  return { count: orders.length, total: mine.length, columns };
}

function findByPhone(phone, pool = store.db.orders) {
  const d = digits(phone); if (d.length < 7) return [];
  const tail = d.slice(-9);
  return pool.filter(o => { const p = digits(o.phone); return p && p.slice(-9) === tail; });
}
// match a PO no, P.R no, CN no or order id (numbers that are too short, or words like "self", never match)
function idsOf(o) { return [o.orderId, ...['po', 'pr', 'cn'].map(k => o[k]).filter(v => v && /\d/.test(v) && normId(v).length >= 4)].map(normId).filter(Boolean); }
function findById(q, pool = store.db.orders) {
  const id = normId(q); if (id.length < 3) return [];
  return pool.filter(o => idsOf(o).includes(id));
}

// The same PO number can exist in two companies' sheets. If we know which company the customer is from,
// show only that company's rows (when there are any); otherwise show every match.
function prefer(hits, names) {
  const ns = (names || []).map(norm).filter(n => n.length >= 3); if (!ns.length || !hits.length) return hits;
  const same = a => { a = norm(a); return a && ns.some(n => a === n || (n.length >= 4 && a.includes(n)) || (a.length >= 4 && n.includes(a))); };
  const mine = hits.filter(o => same(o.company) || same(o.organization));
  return mine.length ? mine : hits;
}

// Pull a plausible PO / PR / CN / order id / phone out of free text (searches ALL company sheets).
// With `pool` (one organization's orders) ONLY those orders are searched, so nothing from another company can show up.
function lookup(text, orgNames, pool) {
  const t = String(text || '').trim(), P = pool || store.db.orders, pick = h => (pool ? h : prefer(h, orgNames));
  let hits = findById(t, P);
  if (hits.length) return pick(hits);
  for (const tok of t.split(/[\s,;:]+/)) { hits = findById(tok, P); if (hits.length) return pick(hits); }
  if (digits(t).length >= 9) { hits = findByPhone(t, P); if (hits.length) return pick(hits); }
  return [];
}
const looksLikeId = (text, pool) => String(text || '').split(/[\s,;:]+/).some(tok => /\d{4,}/.test(tok) && findById(tok, pool || store.db.orders).length);
// a message that is just a number (PO / P.R / CN) and not a company name
const looksLikeNumber = text => /^[\s#.:-]*[A-Za-z]{0,4}[-\s]?\d[\d\s-]{2,}\s*$/.test(String(text || '').trim());

// SharePoint / OneDrive-for-work links download the file straight away when they end in ?download=1 (taps on a phone save the picture).
// The web address inside a cell, however it was typed: with other words around it, without https://, on several lines.
function urlOf(v) {
  const t = String(v || '').trim(); let m = /https?:\/\/[^\s<>"']+/i.exec(t);
  if (m) return m[0].replace(/[.,;:\]]+$/, '');
  return /^(www\.|(?:[\w-]+\.)?(?:drive|docs)\.google\.com\/|[\w-]+\.sharepoint\.com\/|1drv\.ms\/|onedrive\.live\.com\/)\S+$/i.test(t) ? 'https://' + t : '';
}
function dlLink(u) { try { const x = new URL(u); if (/sharepoint\.com$/i.test(x.hostname) && !x.searchParams.has('download')) x.searchParams.set('download', '1'); return x.toString(); } catch { return u; } }
// The web addresses of an order as button labels: [{ text: 'Show image' | 'Track order' | 'Open link', url }]
function linkButtons(o) {
  // every web address of the order, however it was typed in the sheet (with or without https://)
  const out = [], seen = new Set(), add = (text, raw) => { const u = urlOf(raw); const url = u ? dlLink(u) : ''; if (isUrl(url) && !seen.has(url)) { seen.add(url); out.push({ text, url }); } };
  if (urlOf(o.link)) add('Track order', o.link); else { const t = courier.trackUrl(o); if (t) add('Track order', t); }
  for (const [l, v, vis] of o.extra || []) if (vis !== 0 && urlOf(v)) add(/image|photo|picture|pod|proof/i.test(l) ? 'Show image' : 'Open link', v);
  if (urlOf(o.updated)) add('Show image', o.updated);
  return out;
}
// Files (pictures, PDFs) behind the link columns of an order: [{ label, url }] — sent to the customer as real WhatsApp attachments.
function fileLinks(o) { return (o.extra || []).filter(([l, v, vis]) => vis !== 0 && isUrl(v) && LINKY.test(l)).map(([l, v]) => ({ label: l, url: v })); }

const STATUS_ICON = { confirmed: '✅', processing: '⚙️', packed: '📦', shipped: '🚚', dispatched: '🚚', 'out for delivery': '🛵', delivered: '🎉', cancelled: '❌', returned: '↩️', 'on hold': '⏸️', pending: '⏳', 'pending dispatch': '⏳', 'self collection': '🏬' };
const icon = s => STATUS_ICON[String(s || '').toLowerCase()] || '📋';

// opts.links = true prints web addresses in the text (for plain-text uses). By default they are left out: the bot sends
// them as tappable buttons ("Show image", "Track order") instead, so the long address is never shown.
function formatOrder(o, opts) {
  const withLinks = !!(opts && typeof opts === 'object' && opts.links);
  const ids = [['PO no', o.po], ['PR no', o.pr], ['CN no', o.cn], ['Order ID', o.orderId !== o.po && o.orderId !== o.pr && o.orderId !== o.cn ? o.orderId : '']].filter(([, v]) => v);
  const [tl, tv] = ids[0] || ['Order', o.orderId];
  const lines = [`${icon(o.status)} *${tl} ${tv}* — *${o.status || 'Received'}*`];
  if (o.company && (store.db.sources || []).length > 1) lines.push(`Company: ${o.company}`);
  for (const [l, v] of ids.slice(1)) lines.push(`${l}: ${v}`);
  if (o.customer) lines.push(`Customer: ${o.customer}`);
  if (o.courier) lines.push(`Courier: ${o.courier}`);
  if (o.receivedBy) lines.push(`Received by: ${o.receivedBy}`);
  if (o.link) { if (!/^https?:/i.test(o.link)) lines.push(`Tracking no: ${o.link}`); else if (withLinks) lines.push(`🔗 Track here: ${dlLink(o.link)}`); }
  else if (withLinks) { const t = courier.trackUrl(o); if (t) lines.push(`🔗 Track here: ${t}`); }
  for (const [l, v, vis] of o.extra || []) {
    if (vis === 0) continue; // columns kept only for reports
    if (isUrl(v)) { if (withLinks) lines.push(`${/image|photo|picture|pod|proof/i.test(l) ? '📷' : '🔗'} ${l}: ${dlLink(v)}`); } else lines.push(`${l}: ${v}`);
  }
  if (o.notes) lines.push(`Note: ${o.notes}`);
  if (isUrl(o.updated)) { if (withLinks) lines.push(`📷 Image link: ${dlLink(o.updated)}`); }
  else if (o.updated) lines.push(`Last updated: ${o.updated}`);
  return lines.join('\n');
}

module.exports = { FIELDS, keyOf, normId, classOf, billedOf, parseDay, trackUrl: courier.trackUrl, importOrders, lookup, looksLikeId, looksLikeNumber, fileLinks, linkButtons, isUrl, urlOf, LINKY, norm, dlLink, findByPhone, formatOrder, digits, normId, getCfg, setCfg, cleanCfg, inspect };
