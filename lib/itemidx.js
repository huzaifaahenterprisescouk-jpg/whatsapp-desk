// DC items, tracked AUTOMATICALLY  (left menu: "DC items sync").
//
// Nobody adds items by hand any more. The desk reads the sheet / ERP that holds the items of ALL your DCs, on a schedule:
//   * "sheet"   an Excel / CSV / Google Sheets link (OneDrive, SharePoint ...) or a folder path; EVERY tab of the workbook is read
//   * "upload"  an Excel / CSV file uploaded once (use it when the link needs a Microsoft sign-in you have not set up)
//   * "erp"     a REST / JSON / CSV address of your ERP that returns the item lines of all DCs
//   * "lookup"  an ERP address with {dc} {po} {pr} in it, called for one DC at a time (when it is opened, or for all DCs in one go)
// Every item row is indexed by the DC no, PO no and P.R / requisition no written on it (columns, or the "DC # / PO # / REQ #" block
// above an invoice-style table). Company report -> open a DC -> its items are found by itself.
//
// Item status (Pending / Delivered / Short / Returned) is kept separately (db.itemSync.state), so a re-read never loses it.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cfg = require('./config'), store = require('./store');
const xlsx = require('./xlsx'), erp = require('./erp'), sync = require('./sync'), ms = require('./msgraph'), dcitems = require('./dcitems');

const dir = path.join(path.dirname(cfg.dataFile), 'itemsync'), fileIdx = path.join(dir, 'index.json');
const KINDS = ['dc', 'po', 'pr'], KIND_LABEL = { dc: 'DC no', po: 'PO no', pr: 'P.R no', erp: 'ERP lookup' };
const box = () => {
  const b = (store.db.itemSync = store.db.itemSync || {});
  b.sources = b.sources || []; b.match = b.match || { dc: true, po: true, pr: true }; b.state = b.state || {};
  if (b.fillDown === undefined) b.fillDown = true; if (b.checkCompany === undefined) b.checkCompany = true; if (!b.lookupHours) b.lookupHours = 12;
  return b;
};
const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const tick = () => new Promise(r => setImmediate(r));

// ---------- numbers: "0998" = "998", "63423.0" = "63423", "DC-63423" also answers to "63423" ----------
const nkey = v => String(v == null ? '' : v).trim().replace(/\.0+$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');
const okKey = k => k.length >= 3 && /\d/.test(k) && !/^0+$/.test(k);
function variants(v) { const k = nkey(v); if (!okKey(k)) return []; const out = [k], m = /^[A-Z]{1,5}(\d{3,})$/.exec(k); if (m) out.push(m[1].replace(/^0+(?=\d)/, '')); return out; }
function keysOf(cell) { const out = []; for (const part of String(cell || '').split(/[\s,;&\n]+/)) for (const k of variants(part)) if (!out.includes(k)) out.push(k); return out; }
const nco = v => String(v || '').toLowerCase().replace(/^m\s*\/\s*s\.?\s+/, '').replace(/\b(ltd|limited|pvt|private|co|company|inc|llc)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
const sameCo = (a, b) => { a = nco(a); b = nco(b); return !a || !b || a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))); };

// ---------- what a column / label means ----------
const R = {
  dc: t => /^(dc|d c|dc (no|num|number|nos)|d c (no|number)|delivery challan( (no|number))?|challan( (no|number))?|delivery note( no)?|dc ref)$/.test(t),
  po: t => (/(^| )(po|p o|pono|purchase order)( |$)/.test(t) && !/(date|amount|value|qty|quantity|item|line|status|by|name)/.test(t)) || /^(po|p o|pono|po (no|num|number)|p o (no|number)|purchase order( (no|number))?|customer po|client po)$/.test(t),
  pr: t => (/(^| )(pr|p r|req|reqno|requisition|indent)( |$)/.test(t) && !/(date|amount|value|qty|quantity|item|line|status|by|name|person|dept|department)/.test(t)) || /^(pr|p r|pr (no|num|number)|p r (no|number)|req|req (no|num|number)|reqno|requisition( (no|number))?|purchase requisition( (no|number))?)$/.test(t),
  cc: t => /^(br|br no|br code|branch|branch (code|no)|cost (code|centre|center)|branch cost code)$/.test(t) || (/(^| )(branch|cost|br)( |$)/.test(t) && /(^| )(code|centre|center)( |$)/.test(t)),
  desc: t => /^(name of items?|items?( name| description| details?)?|description( of goods)?|goods description|product( name)?|particulars|material( description)?|article)$/.test(t),
  code: t => /^(items? code|iem code|exp code|exp|item no|item number|code|sku|material code|product code|part (no|number))$/.test(t),
  qty: t => /(^| )(qty|quantity|qnty|deno|pcs|pieces)( |$)/.test(t) && !/amount|price|rate|value/.test(t),
  unit: t => /^(unit|uom|units|unit of measure|unit of measurement)$/.test(t),
  price: t => /^(unit price|price|rate|unit rate|sale price|selling price)$/.test(t),
  total: t => /^(total|total amount|line total|gross amount)$/.test(t) || (/(total|amount)/.test(t) && /incl/.test(t)),
  amt: t => /(amount|value)/.test(t) && /(excl|ex |before)/.test(t) && !/incl/.test(t),
  taxp: t => /^(tax|gst|s ?tax|sales tax|tax (percent|rate|percentage)|gst (percent|rate)|tax pct)$/.test(t),
  taxv: t => /^(tax|gst|s ?tax|sales tax) (value|amount|amt)$/.test(t),
  inv: t => /^(invoice|invoice (no|num|number)|inv (no|num|number)|bill (no|num|number)|bill)$/.test(t),
  company: t => /^(company|company name|organi[sz]ation|party( name)?|bill to|client( name)?|buyer|customer name)$/.test(t),
};
// printed-paper facts that sit in columns of the DC sheet: Deliver-To (address), PERSON, CONTACT (phone), DATE
const X = {
  ad: t => /^(deliver to|delivery to|deliver address|delivery address|delivered to|ship to|shipping address|address|deliver to address|delivery location)$/.test(t),
  ct: t => /^(person|person name|contact person|contact person name|contact name|attention|attn|receiver|receiver name|received by|name of person|name of receiver|customer person|concern person|concerned person|contact name person)$/.test(t) || (/(^| )(person|attn|attention|receiver)( |$)/.test(t) && !/(^| )(no|number|phone|mobile|cell|tel|cnic|email)( |$)/.test(t)),
  ph: t => /^(contact|contact no|contact number|contact nos|contact num|phone|phone no|phone number|mobile|mobile no|mobile number|cell|cell no|cell number|tel|tel no|telephone|telephone no|person contact|person contact no|person phone|person mobile|contact person no|contact person number|contact person phone|contact person mobile|contact person cell)$/.test(t) || (/(^| )(phone|mobile|cell|tel|telephone)( |$)/.test(t) && !/(^| )(email|mail)( |$)/.test(t)),
  dt: t => /^(date|dc date|challan date|delivery date|order date|dated)$/.test(t),
}, XROLES = Object.keys(X);
const ORDER = ['dc', 'po', 'pr', 'cc', 'desc', 'code', 'qty', 'unit', 'price', 'amt', 'taxp', 'taxv', 'total', 'inv', 'company'], MULTI = new Set(['dc', 'po', 'pr', 'cc']);
const ROLE_LABEL = { dc: 'DC no', po: 'PO no', pr: 'P.R / Req no', cc: 'Branch / cost code', desc: 'Item', code: 'Item code', qty: 'Qty', unit: 'Unit', price: 'Price', amt: 'Amount excl. tax', taxp: 'Tax %', taxv: 'Tax value', total: 'Total', inv: 'Invoice no', company: 'Company' };

// a header row = names an item column and at least one more thing we know. Returns { role: [column numbers] } or null.
function headerRoles(row, ov) {
  const cols = {};
  (row || []).forEach((c, j) => {
    const t = norm(c); if (!t || t.length > 40) return; let role = '';
    if (ov) for (const [r, h] of Object.entries(ov)) if (h && norm(h) === t) { role = r; break; }
    if (!role) for (const r of ORDER) if (R[r](t)) { role = r; break; }
    if (!role) for (const r of XROLES) if (X[r](t)) { role = r; break; }
    if (!role) return;
    if (MULTI.has(role)) (cols[role] = cols[role] || []).push(j); else if (!cols[role]) cols[role] = [j];
  });
  if (!cols.desc) { const j = (row || []).findIndex(c => /^(name|label|product id)$/.test(norm(c))); if (j >= 0 && (cols.qty || cols.dc || cols.po || cols.pr)) cols.desc = [j]; }
  return cols.desc && (cols.qty || cols.unit || cols.price || cols.dc || cols.po || cols.pr) ? cols : null;
}

// "DC # 63617", "PO # 409092", "REQ # 339683", "BRANCH/COST CODE 0998", "M/S BANK AL-FALAH LTD" written above an invoice-style table
function scanBlock(rows, from, to, base) {
  const out = { dc: [...(base && base.dc || [])], po: [...(base && base.po || [])], pr: [...(base && base.pr || [])], cc: [...(base && base.cc || [])], company: (base && base.company) || '', inv: (base && base.inv) || '', dt: (base && base.dt) || '', ad: (base && base.ad) || '', ct: (base && base.ct) || '', ph: (base && base.ph) || '', rpo: (base && base.rpo) || '', rpr: (base && base.rpr) || '', rcc: (base && base.rcc) || '' };
  for (let a = Math.max(0, from); a < to; a++) {
    const r = rows[a] || [];
    for (let c = 0; c < r.length; c++) {
      const t = clip(r[c], 120); if (!t) continue;
      const ms_ = /^m\s*\/\s*s\.?\s+(.+)$/i.exec(t); if (ms_) { if (!out.company) out.company = ms_[1].trim().slice(0, 120); continue; }
      // facts printed on the paper itself: the date, the customer's address, the contact person and phone (used by Print bill / Print DC)
      if (!out.dt && /^(\d{1,2}[-\/ ][A-Za-z]{3,9}[-\/ ]\d{2,4}|\d{4}-\d{2}-\d{2})$/.test(t)) { out.dt = t; continue; }
      if (!out.ct && /^(mr|mrs|ms|miss|dr|sir)\.?\s+\S/i.test(t) && t.length < 50) { out.ct = t; continue; }
      if (!out.ph && /^\+?\d[\d\s.\-\/()]{8,}$/.test(t) && t.replace(/\D/g, '').length >= 9 && /[\s.\-\/()]|^0|^\+/.test(t)) { out.ph = t; continue; }
      if (out.ph && out.ad && !out.ct && /^[A-Za-z][A-Za-z .'\-]{4,48}$/.test(t) && !ORDER.some(k => R[k](norm(t))) && !/^(sales tax invoice|delivery challan|bank account)/i.test(t)) { out.ct = t; continue; }   // the name written under the phone: "ADNAN AHMED KHAN CCO"
      if (!out.ad && out.company && t.length >= 25 && !/[:#]/.test(t) && !/^(sales tax invoice|delivery challan|bank account)/i.test(t) && !ORDER.some(k => R[k](norm(t)))) { out.ad = t; continue; }
      let label = t, val = ''; const m = /^([^:#]{1,30})\s*[:#]+\s*(\S.{0,60})$/.exec(t);
      if (m) { label = m[1]; val = m[2]; } else for (let d = c + 1; d < r.length; d++) if (clip(r[d], 80)) { val = clip(r[d], 80); break; }
      const lt = norm(label); let role = ''; for (const k of ['dc', 'po', 'pr', 'cc']) if (R[k](lt)) { role = k; break; }
      if (!role && /^invoice( (no|num|number))?$/.test(lt) && val && !out.inv) { out.inv = clip(val, 40); continue; }
      if (!role || !val) continue;
      if (ORDER.some(k => R[k](norm(val)))) continue;                       // the "value" is another label
      { const rk = 'r' + role; if (rk !== 'rdc' && !out[rk]) out[rk] = clip(val, 40); }                  // as written ("0998"), for the printed PO / REQ / branch lines
      if (role === 'cc') { const k = nkey(val); if (k && !out.cc.includes(k)) out.cc.push(k); } else for (const k of keysOf(val)) if (!out[role].includes(k)) out[role].push(k);
    }
  }
  return out;
}

const EDIT_ROLES = ['desc', 'code', 'qty', 'unit', 'price', 'amt', 'taxp', 'taxv', 'total'];

// ---------- one tab (or one ERP answer) -> item rows ----------
function extractTab(rows, tab, s, base) {
  const lastRaw = {}, ov = s.cols || {}, st = box(), items = [], info = { name: tab, rows: rows.length, items: 0, blocks: 0, note: '', cols: '', doc: tabDoc(tab) };
  let i = 0, prevEnd = 0, unkeyed = 0; const cell = (r, j) => j === undefined ? '' : clip(r[j], 600);
  while (i < rows.length) {
    const hr = headerRoles(rows[i], ov); if (!hr) { i++; continue; }
    info.blocks++; if (!info.cols) info.cols = ORDER.filter(k => hr[k]).map(k => `${ROLE_LABEL[k]}: ${hr[k].map(j => clip(rows[i][j], 30)).join(' + ')}`).join(' · ');
    const blk = scanBlock(rows, Math.max(prevEnd, i - 30), i, base), last = {}; let j = i + 1, lastItem = i;
    for (; j < rows.length; j++) {
      const r = rows[j] || []; if (!r.length) continue;
      if (R.desc(norm(r[hr.desc[0]])) && headerRoles(r, ov)) break;          // the same table starts again (next invoice / next page)
      let desc = cell(r, hr.desc[0]), code = hr.code ? cell(r, hr.code[0]) : ''; if (!desc) continue;
      const lines = desc.split('\n').map(x => x.trim()).filter(Boolean);       // "STAPLER 24/6\n10000401": the item code sits on the second line
      if (lines.length > 1 && /^[A-Za-z]{0,4}\d{4,}[A-Za-z0-9-]*$/.test(lines[lines.length - 1])) { const tail = lines.pop(); if (!/\d/.test(code)) code = tail; }
      desc = lines.join(' ');
      if (/^(grand\s*|sub\s*|net\s*)?total\b|^amount in words|^rupees\b|^note\b/i.test(desc) || !/[A-Za-z؀-ۿ]/.test(desc)) continue;
      const qraw = hr.qty ? cell(r, hr.qty[0]) : ''; if (hr.qty && qraw === '') continue;
      // the DC no written on this row's own DC column (not copied down)
      let rowDc = []; for (const c of hr.dc || []) for (const k of keysOf(cell(r, c))) rowDc.push(k);
      // the DC / PO / REQ lines written ABOVE the table belong only to rows of that DC. A row that carries a different DC no of its own is another DC's row:
      // before, such a block was added to every row of a long table, so one DC showed thousands of other DCs' items.
      const blkOk = !blk.dc.length || !rowDc.length || blk.dc.some(k => rowDc.includes(k));
      const keys = {};
      for (const role of KINDS) {
        let got = []; for (const c of hr[role] || []) for (const k of keysOf(cell(r, c))) if (!got.includes(k)) got.push(k);
        if (got.length) last[role] = got; else if (st.fillDown && hr[role] && last[role]) got = last[role];
        if (blkOk && (!got.length || rowDc.length)) for (const k of blk[role]) if (!got.includes(k)) got = got.concat(k);   // only for a row without a number of its own, or a row of this very DC
        keys[role] = got;
      }
      if (!keys.dc.length && !keys.po.length && !keys.pr.length) { unkeyed++; continue; }
      const real = v => { v = clip(v, 40).replace(/\.0+$/, ''); return /^[0\s.\-]*$/.test(v) || /^(n\/?a|nil|null|none|-+)$/i.test(v) ? '' : v; };      // "0", "0.0", "-", "N/A" = nothing written
      const raw = {}; for (const role of ['po', 'pr', 'cc']) { let v = ''; for (const c of hr[role] || []) { v = real(cell(r, c)); if (v) break; } raw[role] = v; }          // this row's own value only (first column that really has one): copying down from the row above would give a DC the PO / REQ of the DC before it
      const rv = (role, n) => { for (const c of hr[role] || []) { const v = cell(r, c); if (v) return clip(v, n || 300); } return ''; };
      const xdate = v => { const n = +v; if (/^\d{5}(\.\d+)?$/.test(String(v).trim()) && n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 864e5); return `${String(d.getUTCDate()).padStart(2, '0')}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; } return v; };
      // a column of this DC sheet (Deliver-To / PERSON / CONTACT / DATE) is that DC's own value; the block above the table is only used when the sheet has no such column
      const hh = { iv: blk.inv, dt: hr.dt ? xdate(rv('dt', 30)) : blk.dt, ad: hr.ad ? rv('ad') : blk.ad, ct: hr.ct ? rv('ct', 60) : blk.ct, ph: hr.ph ? rv('ph', 40) : blk.ph, po: raw.po || (blkOk && blk.rpo) || '', pr: raw.pr || (blkOk && blk.rpr) || '', cc: raw.cc || (blkOk && blk.rcc) || '' };
      const cc = [...new Set([...(hr.cc || []).map(c => nkey(cell(r, c))), ...blk.cc].filter(Boolean))], company = (hr.company && cell(r, hr.company[0])) || s.company || blk.company || '';
      const cx = {}; for (const role of EDIT_ROLES) if (hr[role]) cx[role] = hr[role][0];                  // where each value sits in the sheet (for writing an edit back)
      const kc = [[hr.desc[0], cell(r, hr.desc[0])]]; { const dcol = (hr.dc || []).find(c => cell(r, c)); if (dcol !== undefined) kc.push([dcol, cell(r, dcol)]); }  // cells that must still hold this text before anything is written
      items.push({ x: { c: cx, k: kc }, d: desc.slice(0, 300), c: clip(code, 40), q: num(qraw) || (qraw === '' ? 1 : 0), u: hr.unit ? cell(r, hr.unit[0]).slice(0, 20) : '', p: hr.price ? num(cell(r, hr.price[0])) : 0, t: hr.total ? num(cell(r, hr.total[0])) : 0, a: hr.amt ? num(cell(r, hr.amt[0])) : 0, tp: hr.taxp ? clip(cell(r, hr.taxp[0]), 12) : '', tv: hr.taxv ? num(cell(r, hr.taxv[0])) : 0,
        dc: keys.dc, po: keys.po, pr: keys.pr, cc, co: company.slice(0, 120), tab, r: j + 1, iv: hr.inv ? clip(cell(r, hr.inv[0]), 40) : '', h: Object.values(hh).some(Boolean) ? hh : undefined });
      lastItem = j;
    }
    prevEnd = lastItem + 1; i = Math.max(j, i + 1);
  }
  info.items = items.length;
  info.note = !info.blocks ? 'No heading row with an item column was found.' : !items.length ? (unkeyed ? `${unkeyed} item rows were found but none has a DC / PO / P.R number.` : 'A heading was found but no item rows under it.') : unkeyed ? `${unkeyed} rows skipped (no DC / PO / P.R number).` : '';
  return { items, info };
}

// ERP records (objects) -> a table the same reader understands
function tableFrom(recs, s) {
  let list = recs;
  if (s.itemsPath) {                                                         // order lines nested inside each DC / order record
    list = []; for (const rec of recs) { const lines = erp.dig(rec, s.itemsPath), parent = erp.flat(rec);
      for (const k of Object.keys(parent)) if (Array.isArray(parent[k])) delete parent[k];
      const par = { ...parent, ...Object.fromEntries(Object.entries(parent).map(([k, v]) => ['parent.' + k, v])) };
      if (Array.isArray(lines)) for (const ch of lines) list.push({ ...par, ...erp.flat(ch && typeof ch === 'object' ? ch : { name: ch }) }); }
  } else list = recs.map(r => erp.flat(r));
  const head = [...new Set(list.slice(0, 2000).flatMap(r => Object.keys(r)))].slice(0, 200);
  return [head, ...list.map(r => head.map(k => { const v = r[k]; return v == null || typeof v === 'object' ? '' : erp.text(v); }))];
}

// ---------- the index ----------
let IDX = { dc: new Map(), po: new Map(), pr: new Map() }, INV = new Set(), DATA = {}, BYID = new Map(), COV = null, LOOK = new Map();
const getSrc = id => box().sources.find(s => s.id === id);
function finalize(items, sid) {
  const occ = new Map();
  for (const it of items) { it.s = sid; const base = `${sid}|${it.tab}|${it.dc[0] || it.po[0] || it.pr[0]}|${nkey(it.d)}|${it.c}`, n = (occ.get(base) || 0) + 1; occ.set(base, n);
    it.i = crypto.createHash('sha1').update(base + '|' + n).digest('hex').slice(0, 12); }
  return items;
}
function rebuild() {
  IDX = { dc: new Map(), po: new Map(), pr: new Map() }; BYID = new Map(); INV = new Set();
  for (const [sid, arr] of Object.entries(DATA)) {
    const src = getSrc(sid); if (!src || src.enabled === false) continue;
    for (const it of arr) { BYID.set(it.i, it); if (it.iv) { const k = nkey(it.iv); if (okKey(k)) INV.add(k); } for (const kind of KINDS) for (const k of it[kind]) { let a = IDX[kind].get(k); if (!a) IDX[kind].set(k, a = []); a.push(it); } }
  }
  COV = null;
}
let saveT = null;
function persist() {
  clearTimeout(saveT); saveT = setTimeout(() => {
    try { fs.mkdirSync(dir, { recursive: true }); const tmp = fileIdx + '.tmp';
      fs.writeFile(tmp, JSON.stringify({ v: 2, items: DATA, lookup: Object.fromEntries(LOOK) }), e => { if (e) return console.error('itemsync save failed:', e.message); fs.rename(tmp, fileIdx, () => {}); }); }
    catch (e) { console.error('itemsync save failed:', e.message); }
  }, 600);
}
function load() {
  try { const j = JSON.parse(fs.readFileSync(fileIdx, 'utf8')); DATA = j.v === 2 ? (j.items || {}) : {}; LOOK = new Map(Object.entries(j.lookup || {})); } catch { DATA = {}; LOOK = new Map(); }
  for (const sid of Object.keys(DATA)) if (!getSrc(sid)) delete DATA[sid];
  rebuild();
}

// ---------- finding the items of one DC ----------
const branchOk = (it, o) => !it.cc.length || !o.branch || it.cc.includes(nkey(o.branch));
function pickGroup(list) {                                                  // the same items often sit on several tabs (BILLS, WITH BC, OVERALL ...): show one copy
  const g = new Map(); for (const it of list) { const k = it.s + '|' + it.tab; if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
  let best = null; for (const a of g.values()) if (!best || a.length > best.length) best = a;
  return best.slice().sort((a, b) => a.r - b.r).slice(0, 500);   // a DC never has thousands of lines: more means the sheet was misread, and drawing them would freeze the page
}
const lookKey = (src, o) => `${src.id}|${nkey(o.dc) || nkey(o.po) || nkey(o.pr)}`;
const lookups = () => box().sources.filter(s => s.kind === 'lookup' && s.enabled !== false && s.url);
// one workbook can hold both sheets ("FROM DC" and "BILLS"): a tab named after the DC is read only for Print DC, a tab named after the bill / invoice only for Print bill
const tabDoc = t => { const x = norm(t), d = /(^| )(dc|dcs|challan|challans|delivery|deliveries)( |$)/.test(x), b = /bill|invoice|(^| )inv( |$)|sales tax/.test(x); return d && !b ? 'dc' : b && !d ? 'bill' : ''; };
const docOk = (it, doc) => { if (!doc) return true; const d = (getSrc(it.s) || {}).doc || 'both'; if (d !== 'both') return d === doc; const td = tabDoc(it.tab); return !td || td === doc; };
function find(o, doc, loose) {                                              // loose: a DC number is ours alone, so it may match even when the company name on the sheet is written differently
  if (!doc) { const r = find(o, 'bill'); return r.items.length ? r : find(o, 'dc'); }   // the screen shows the bill sheet (it has the prices), else the DC sheet
  const st = box(), co = o.organization || o.company || '';
  for (const kind of KINDS) {
    if (st.match[kind] === false) continue;
    let list = []; for (const k of variants(o[kind])) { const a = IDX[kind].get(k); if (a) { list = a; break; } }
    if (!list.length) continue;
    list = list.filter(it => docOk(it, doc) && (kind === 'dc' || branchOk(it, o)) && (!st.checkCompany || (loose && kind === 'dc') || sameCo(it.co, co)));
    const own = doc ? list.filter(it => tabDoc(it.tab) === doc) : []; if (own.length) list = own;      // a tab named after this document wins over neutral tabs
    if (list.length) return { via: kind, items: pickGroup(list) };
  }
  for (const src of lookups()) { const c = LOOK.get(lookKey(src, o)); if (c && c.items.length) return { via: 'erp', items: c.items }; }
  return { via: '', items: [] };
}
// can this item be changed in its sheet, and which fields?
const isPath = l => /^(file:|\/|[A-Za-z]:[\\/])/.test(String(l || '').trim());
const codeInDesc = it => { const raw = (it.x && it.x.k && it.x.k[0] && it.x.k[0][1]) || '', ls = String(raw).split('\n').map(x => x.trim()).filter(Boolean); return ls.length > 1 && !!it.c && ls[ls.length - 1] === it.c; };
function editInfo(it) {
  const src = getSrc(it.s);
  if (!src || !(src.kind === 'sheet' || src.kind === 'upload')) return { ok: false, why: 'This item comes from your ERP, so it can only be changed there.' };
  if (!it.x || !it.x.c) return { ok: false, why: 'Open DC items sync and press "Sync now" once, so the app learns where this item sits in the sheet.' };
  if (src.kind === 'sheet' && /docs\.google\.com/i.test(src.url || '')) return { ok: false, why: 'This sheet is a Google Sheet; the app can only change Excel files (OneDrive / SharePoint or a file on the server).' };
  if (src.kind === 'sheet' && !isPath(src.url) && !ms.signedIn()) return { ok: false, why: 'Sign in with Microsoft (Order tracking) so the app can change the Excel file.' };
  const fields = EDIT_ROLES.filter(k => it.x.c[k] !== undefined || (k === 'code' && codeInDesc(it)));
  return { ok: true, fields, sheet: src.name, tab: it.tab, row: it.r };
}
function view(it, via) {
  const sv = box().state[it.i] || {}, src = getSrc(it.s);
  return { edit: editInfo(it), id: it.i, recId: 'auto', desc: it.d, code: /\d/.test(it.c || '') ? it.c : '', exp: /^0+$/.test(it.c || '') ? '' : (it.c || ''), qty: it.q, unit: it.u, price: it.p, total: it.t, amt: it.a || 0, taxp: it.tp || '', taxv: it.tv || 0, status: sv.s || 'pending', got: sv.g || 0, note: sv.n || '', auto: true, via, viaLabel: KIND_LABEL[via] || '', tab: it.tab, src: src ? src.name : '' };
}
const itemsFor = o => { const f = find(o); return f.items.map(it => view(it, f.via)); };
const count = o => find(o).items.length;

// ---------- Company report: search by item ----------
// "stapler 24/6" -> every word must be found in the item name or item code (part of a word works: "stap" finds STAPLER).
// Returns { hit(name, code), test(order) } or null when nothing usable was typed.
//   test(order)  does one of the items of this DC match?
function itemMatcher(q) {
  const ws = norm(q).split(' ').filter(Boolean); if (!ws.length || norm(q).length < 2) return null;
  const hit = (d, c) => { const h = norm(String(d || '') + ' ' + String(c || '')), hc = h.replace(/ /g, ''); return ws.every(w => h.includes(w) || hc.includes(w.replace(/ /g, ''))); };
  // which DC / PO / P.R numbers have a matching item anywhere in the index (so a DC without one is skipped without reading its items)
  const cand = { dc: new Set(), po: new Set(), pr: new Set() };
  for (const [sid, arr] of Object.entries(DATA)) {
    const src = getSrc(sid); if (!src || src.enabled === false) continue;
    for (const it of arr) if (hit(it.d, it.c)) for (const kind of KINDS) for (const k of it[kind]) cand[kind].add(k);
  }
  const look = lookups().length > 0;                                          // items fetched per DC from an ERP are not in the index: those DCs are always checked
  const test = o => {
    if (!look && !KINDS.some(kind => variants(o[kind]).some(v => cand[kind].has(v)))) return false;
    return find(o).items.some(it => hit(it.d, it.c));
  };
  return { hit, test };
}
// the items AND the printed facts (invoice no, date, address, contact) of one DC, from the DC sheet (doc 'dc') or the invoice / bill sheet (doc 'bill')
function docFor(o, doc) {
  const dk = doc === 'dc' ? 'dc' : 'bill'; let f = find(o, dk); if (!f.items.length) f = find(o, dk, true);
  const headOf = list => { const hd = {}; for (const it of list) { const h = it.h || {}; for (const k of ['iv', 'dt', 'ad', 'ct', 'ph', 'po', 'pr', 'cc']) if (!hd[k] && (h[k] || (k === 'iv' && it.iv))) hd[k] = (k === 'iv' && it.iv) || h[k]; } return hd; };
  const head = headOf(f.items);
  { const other = find(o, dk === 'dc' ? 'bill' : 'dc'), oh = headOf(other.items); for (const k of ['ad', 'ct', 'ph', 'po', 'pr', 'cc']) if (!head[k] && oh[k]) head[k] = oh[k]; }
  // still blank: look at every tab of every source that lists this DC no (WITH BC, OVERALL DATA ...), whatever the company is called there
  if (['ad', 'ct', 'ph', 'po', 'pr', 'cc'].some(k => !head[k])) { const all = []; for (const v of variants(o.dc)) for (const it of IDX.dc.get(v) || []) all.push(it); const ah = headOf(all); for (const k of ['ad', 'ct', 'ph', 'po', 'pr', 'cc']) if (!head[k] && ah[k]) head[k] = ah[k]; }
  // a "REQ" cell that really holds an invoice number (or this DC's own number) is not a requisition: leave it blank
  if (head.pr) { const k = nkey(head.pr); if (INV.has(k) || k === nkey(o.dc) || (head.iv && k === nkey(head.iv))) head.pr = ''; }
  return { items: f.items.map(it => view(it, f.via)), head, via: f.via, found: f.items.length > 0 };
}
// ---------- editing an item: the change is written into the original Excel sheet, then the app's copy follows ----------
const sheetChain = new Map();                                               // one write at a time per source
const serial = (id, fn) => { const run = (sheetChain.get(id) || Promise.resolve()).catch(() => {}).then(fn); sheetChain.set(id, run.catch(() => {})); return run; };
const nz = v => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9؀-ۿ]/g, '');
const r2 = n => Math.round((+n + Number.EPSILON) * 100) / 100;
function reid(sid) {                                                        // a changed name / code changes the item's id: its status, received qty and note move with it
  const arr = DATA[sid] || [], before = arr.map(x => x.i), st = box().state, moved = [];
  finalize(arr, sid); arr.forEach((x, n) => { if (before[n] !== x.i && st[before[n]]) moved.push([before[n], x.i, st[before[n]]]); });
  for (const [o] of moved) delete st[o]; for (const [, n, v] of moved) st[n] = v; rebuild();
}
async function editItem(id, ch, by, manual) {
  const it = BYID.get(id); if (!it) throw new Error('Item not found. Press "Sync now" on the DC items sync page.');
  const info = editInfo(it); if (!info.ok) throw new Error(info.why);
  const src = getSrc(it.s), cols = it.x.c, inDesc = codeInDesc(it) && cols.code === undefined, man = new Set(manual || []);
  const want = {}; // field -> new value (only what really changed)
  if (ch.desc !== undefined) { const v = clip(ch.desc, 300); if (!v) throw new Error('The item name cannot be empty.'); if (v !== it.d) want.desc = v; }
  if (ch.code !== undefined) { const v = clip(ch.code, 40); if (v !== (it.c || '')) want.code = v; }
  if (ch.unit !== undefined) { const v = clip(ch.unit, 20); if (v !== (it.u || '')) want.unit = v; }
  if (ch.qty !== undefined) { const v = num(ch.qty); if (v < 0) throw new Error('The quantity cannot be negative.'); if (v !== it.q) want.qty = v; }
  if (ch.price !== undefined) { const v = num(ch.price); if (v < 0) throw new Error('The price cannot be negative.'); if (v !== it.p) want.price = v; }
  if (ch.taxp !== undefined) { const v = num(String(ch.taxp).replace(/%/g, '')); if (v < 0 || v > 100) throw new Error('Tax % must be between 0 and 100.'); if (v !== num(String(it.tp).replace(/%/g, '')) * (/^0?\.\d+$/.test(String(it.tp).trim()) ? 100 : 1)) want.taxp = v; }
  for (const [k, f] of [['amt', 'a'], ['taxv', 'tv'], ['total', 't']]) if (ch[k] !== undefined) { const v = num(ch[k]); if (v < 0) throw new Error('Amounts cannot be negative.'); if (r2(v) !== r2(it[f] || 0)) want[k] = r2(v); }
  if (!Object.keys(want).length) throw new Error('Nothing was changed.');
  for (const k of Object.keys(want)) if (!['amt', 'taxv', 'total'].includes(k) && !info.fields.includes(k)) throw new Error(`This sheet has no ${ROLE_LABEL[k] || k} column, so it cannot be changed here.`);
  // the cells to write
  const cells = []; let descCell = null;
  if (want.desc !== undefined || (inDesc && want.code !== undefined)) { const d = want.desc !== undefined ? want.desc : it.d, c = inDesc ? (want.code !== undefined ? want.code : it.c) : ''; descCell = { col: cols.desc, value: d + (c ? '\n' + c : '') }; cells.push(descCell); }
  if (want.code !== undefined && !inDesc && cols.code !== undefined) cells.push({ col: cols.code, value: want.code });
  if (want.unit !== undefined && cols.unit !== undefined) cells.push({ col: cols.unit, value: want.unit });
  if (want.qty !== undefined) cells.push({ col: cols.qty, value: want.qty, num: true });
  if (want.price !== undefined) cells.push({ col: cols.price, value: want.price, num: true });
  if (want.taxp !== undefined) { const was = String(it.tp || '').trim(), v = want.taxp; cells.push({ col: cols.taxp, value: /%/.test(was) ? v + '%' : /^0?\.\d+$/.test(was) ? v / 100 : v, num: !/%/.test(was) }); }
  for (const [k, f] of [['amt', 'a'], ['taxv', 'tv'], ['total', 't']]) if (want[k] !== undefined && cols[k] !== undefined) cells.push({ col: cols[k], value: want[k], num: true, soft: !man.has(k) });
  const check = it.x.k.filter(([, t]) => String(t || '').trim()).map(([c, t]) => [c, t]);
  const verify = vals => { for (const [c, w] of check) if (nz(clip((vals || [])[c], 600)) !== nz(w)) throw new Error('This row of the sheet has changed since it was read (someone edited or sorted the Excel file). Press Sync now on DC items sync, then try again.'); };
  const patch = buf => { if (!isZip(buf)) throw new Error('This sheet is a CSV file; only Excel (.xlsx) files can be changed.'); verify(xlsx.rowValues(buf, it.tab, it.r)); return xlsx.patchCells(buf, it.tab, it.r, cells, { recalc: true }); };
  const where = await serial(it.s, async () => {
    if (src.kind === 'upload' || isPath(src.url)) {
      const f = src.kind === 'upload' ? upPath(src.id) : src.url.trim().replace(/^file:\/\//, ''); let buf;
      try { buf = fs.readFileSync(f); } catch (e) { throw new Error(`Cannot read the sheet: ${e.message}`); }
      const out = patch(buf), tmp = f + '.tmp-' + process.pid;
      try { fs.writeFileSync(tmp, out); fs.renameSync(tmp, f); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* none */ } throw new Error(`Cannot write to the sheet: ${e.code === 'EACCES' || e.code === 'EROFS' ? 'the folder is read-only for the app (share it with write access, see README)' : e.message}`); }
      return 'file';
    }
    if (!ms.signedIn()) throw new Error('Sign in with Microsoft first (Order tracking → Microsoft sign-in) so the app can change the Excel file.');
    return (await ms.editRow(src.url, { sheet: it.tab, row: it.r, cells, check, patch })).via;
  });
  // the sheet took it: the app's copy follows (worked-out cells follow the new qty / price)
  if (want.desc !== undefined) it.d = want.desc; if (want.code !== undefined) it.c = want.code; if (want.unit !== undefined) it.u = want.unit;
  if (want.qty !== undefined) it.q = want.qty; if (want.price !== undefined) it.p = want.price;
  if (want.taxp !== undefined) { const was = String(it.tp || '').trim(); it.tp = /%/.test(was) ? want.taxp + '%' : /^0?\.\d+$/.test(was) ? String(want.taxp / 100) : String(want.taxp); }
  if (want.amt !== undefined) it.a = want.amt; if (want.taxv !== undefined) it.tv = want.taxv; if (want.total !== undefined) it.t = want.total;
  it.eb = by || ''; it.ea = Date.now();
  if (want.desc !== undefined || want.code !== undefined) { it.x.k[0] = [it.x.k[0][0], descCell ? descCell.value : (want.desc !== undefined ? want.desc : it.x.k[0][1])]; }
  if (want.desc !== undefined || want.code !== undefined) reid(it.s); else COV = null;
  src.lastHash = ''; src.lastError = ''; store.save(); persist();
  return { item: view(BYID.get(it.i) || it, ''), where, written: cells.length };
}

function setState(id, ch) {
  const it = BYID.get(id) || [...LOOK.values()].flatMap(c => c.items).find(x => x.i === id); if (!it) throw new Error('Item not found. Press "Sync now" on the DC items sync page.');
  const cur = box().state[id] || {}, one = dcitems.clean([{ id, desc: it.d, qty: it.q, unit: it.u, status: ch.status !== undefined ? ch.status : cur.s, got: ch.got !== undefined ? ch.got : cur.g, note: ch.note !== undefined ? ch.note : cur.n }])[0];
  if (one.status === 'pending' && !one.note) delete box().state[id]; else box().state[id] = { s: one.status, g: one.got, n: one.note };
  store.save(); return view(it, '');
}

// ---------- reading a source ----------
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
const isZip = b => b.length > 3 && b.readUInt32LE(0) === 0x04034b50;
const upPath = id => path.join(dir, 'upload-' + id);
function googleExport(u) { const m = /^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/i.exec(String(u || '')); return m ? `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx` : u; }
function connOf(s, url) { return { ...s, kind: s.format === 'csv' ? 'csv' : 'rest', url: url || s.url, headers: {}, method: s.method || 'GET', next: s.next || '' }; }
const running = new Set(), lastTry = new Map();

async function readSource(s, buf) {
  const only = (s.tabs || []).map(norm).filter(Boolean), out = [], infos = []; let rows;
  if (isZip(buf)) {
    for (const name of xlsx.sheetNames(buf)) {
      // a tab named after the DC or the bill ("FROM DC", "BILLS") is always read, so one sheet feeds both Print DC and Print bill; the list only limits the other tabs
      if (only.length && !only.includes(norm(name)) && !tabDoc(name)) { infos.push({ name, rows: 0, items: 0, note: 'Not in the list of tabs to read.', skipped: true, doc: '' }); continue; }
      let r; try { r = xlsx.readRows(buf, name); } catch (e) { infos.push({ name, rows: 0, items: 0, note: 'Could not read this tab.' }); continue; }
      const x = extractTab(r, name, s); out.push(...x.items); infos.push(x.info); await tick();
    }
  } else {
    rows = erp.csvRows(buf.toString('utf8')); const x = extractTab(tableFrom(rows, {}), 'CSV', s); out.push(...x.items); infos.push(x.info);
  }
  return { items: out, tabs: infos };
}

async function syncSource(id, force) {
  const s = getSrc(id); if (!s) throw new Error('Source not found.');
  if (s.kind === 'lookup') return lookupAll();
  if (running.has(id)) throw new Error('A sync is already running for this source.'); running.add(id); lastTry.set(id, Date.now());
  try {
    let res, hash;
    if (s.kind === 'erp') {
      if (!s.url) throw new Error('Paste the ERP address first.');
      const recs = await erp.fetchAll(connOf(s), 200); hash = md5(JSON.stringify(recs).slice(0, 5e7) + JSON.stringify(s.cols || {}));
      if (!force && s.lastHash === hash && DATA[id]) { Object.assign(s, { lastSync: Date.now(), lastError: '' }); store.save(); return { unchanged: true, items: DATA[id].length }; }
      const x = extractTab(tableFrom(recs, s), 'ERP', s); res = { items: x.items, tabs: [x.info] };
    } else {
      let buf;
      if (s.kind === 'upload') { try { buf = fs.readFileSync(upPath(id)); } catch { throw new Error('Upload the Excel / CSV file first.'); } }
      else { if (!s.url) throw new Error('Paste the link (or folder path) of the sheet first.'); buf = await sync.fetchSheet(googleExport(s.url), { csv: true }); }
      hash = md5(buf) + md5(JSON.stringify(['v66', s.cols || {}, s.tabs || [], s.company || '', box().fillDown]));
      if (!force && s.lastHash === hash && DATA[id]) { Object.assign(s, { lastSync: Date.now(), lastError: '' }); store.save(); return { unchanged: true, items: DATA[id].length }; }
      res = await readSource(s, buf);
    }
    if (!res.items.length) {
      // nothing recognised: keep the old items, report why per tab
      Object.assign(s, { lastError: 'No items were recognised in this source. ' + (res.tabs.map(t => `${t.name}: ${t.note || 'nothing'}`).join(' | ')).slice(0, 500), lastFailed: Date.now(), tabsInfo: res.tabs }); store.save();
      throw new Error(s.lastError);
    }
    DATA[id] = finalize(res.items, id); rebuild(); persist();
    const keys = new Set(res.items.map(it => it.dc[0] || it.po[0] || it.pr[0])); Object.assign(s, { lastSync: Date.now(), lastError: '', lastHash: hash, lastCount: res.items.length, dcCount: keys.size, tabsInfo: res.tabs }); store.save();
    return { items: res.items.length, dcs: keys.size, tabs: res.tabs };
  } catch (e) { s.lastError = e.message; s.lastFailed = Date.now(); store.save(); throw e; }
  finally { running.delete(id); }
}

// ---------- ERP: one DC at a time ----------
const inflight = new Map();
const fillTpl = (tpl, o, enc) => String(tpl || '').replace(/\{(dc|po|pr|branch|company)\}/gi, (_, k) => { const v = String({ dc: o.dc, po: o.po, pr: o.pr, branch: o.branch, company: o.organization || o.company }[k.toLowerCase()] || ''); return enc ? encodeURIComponent(v) : JSON.stringify(v).slice(1, -1); });
async function fetchLookup(src, o) {
  const key = lookKey(src, o); if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const conn = connOf(src, fillTpl(src.url, o, true)); if (src.body) conn.body = fillTpl(src.body, o, false);
    const recs = await erp.fetchAll(conn, 1), base = { dc: variants(o.dc), po: variants(o.po), pr: variants(o.pr), cc: [], company: o.organization || o.company || '' };
    const x = extractTab(tableFrom(recs, src), 'ERP', { ...src, company: src.company || '' }, base);
    LOOK.set(key, { at: Date.now(), items: finalize(x.items, src.id) }); persist(); COV = null;
    Object.assign(src, { lastSync: Date.now(), lastError: '' }); return x.items.length;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p); return p;
}
async function ensureLookup(o) {
  let f = find(o); if (f.items.length || !(o.dc || o.po || o.pr)) return f;
  for (const src of lookups()) {
    const c = LOOK.get(lookKey(src, o)); if (c && Date.now() - c.at < (c.items.length ? box().lookupHours : 1) * 3600e3) continue;
    try { await fetchLookup(src, o); } catch (e) { src.lastError = e.message; src.lastFailed = Date.now(); store.save(); }
    f = find(o); if (f.items.length) break;
  }
  return f;
}
let JOB = { running: false, done: 0, total: 0, found: 0, errors: 0, stop: false, started: 0, finished: 0 };
async function lookupAll() {
  if (JOB.running) throw new Error('Already running.'); if (!lookups().length) throw new Error('Add an "ERP lookup" source first.');
  const seen = new Set(), todo = (store.db.orders || []).filter(o => { const k = nkey(o.dc || o.po || o.pr); if (!k || seen.has(k)) return false; seen.add(k); return !find(o).items.length; });
  JOB = { running: true, done: 0, total: todo.length, found: 0, errors: 0, stop: false, started: Date.now(), finished: 0 };
  (async () => {
    const work = async () => { for (let o; !JOB.stop && (o = todo.shift());) { try { const f = await ensureLookup(o); if (f.items.length) JOB.found++; } catch { JOB.errors++; } JOB.done++; } };
    await Promise.all([work(), work(), work(), work()]); JOB.running = false; JOB.finished = Date.now(); persist(); store.save();
  })();
  return { started: true, total: JOB.total };
}
const stopJob = () => { JOB.stop = true; };

// ---------- sources (add / edit) ----------
const SECRETS = ['token', 'pass', 'authValue'];
const view_ = s => ({ id: s.id, name: s.name, kind: s.kind, url: s.url || '', minutes: s.minutes || 15, enabled: s.enabled !== false, company: s.company || '', doc: s.doc || 'both', tabs: (s.tabs || []).join(', '), cols: s.cols || {},
  format: s.format || 'json', method: s.method || 'GET', body: s.body || '', listPath: s.listPath || '', itemsPath: s.itemsPath || '', next: s.next || '', pageParam: s.pageParam || '', sizeParam: s.sizeParam || '', pageSize: s.pageSize || '',
  auth: s.auth || 'none', user: s.user || '', authName: s.authName || '', has: Object.fromEntries(SECRETS.map(k => [k, !!s[k]])),
  lastSync: s.lastSync || 0, lastError: s.lastError || '', items: s.kind === 'lookup' ? [...LOOK.entries()].filter(([k, c]) => k.startsWith(s.id + '|') && c.items.length).length : (DATA[s.id] || []).length, dcs: s.dcCount || 0, tabsInfo: s.tabsInfo || [], syncing: running.has(s.id), hasFile: s.kind === 'upload' && fs.existsSync(upPath(s.id)), uploadedName: s.uploadedName || '' });
function saveSource(id, b) {
  const list = box().sources; let s = id ? list.find(x => x.id === id) : null; if (id && !s) throw new Error('Source not found.');
  const name = clip(b.name, 60); if (!name && !s) throw new Error('Give the source a name, e.g. "Bills sheet" or "Odoo items".');
  if (!s) { const kind = ['sheet', 'upload', 'erp', 'lookup'].includes(b.kind) ? b.kind : 'sheet'; s = { id: store.nextId('is'), kind, enabled: true, minutes: kind === 'lookup' ? 0 : 15 }; list.push(s); }
  if (name) { if (list.some(x => x !== s && x.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a source called "${name}".`); s.name = name; }
  for (const k of ['url', 'company', 'method', 'body', 'listPath', 'itemsPath', 'next', 'pageParam', 'sizeParam', 'user', 'authName', 'auth', 'format']) if (b[k] !== undefined) s[k] = clip(b[k], 4000);
  if (s.kind === 'sheet' && s.url) s.url = sync.cleanLink(s.url);
  if (s.url && s.kind !== 'upload' && !/^https?:\/\//i.test(s.url) && !(s.kind === 'sheet' && /^(file:|\/|[A-Za-z]:[\\/])/.test(s.url))) { if (s.kind !== 'sheet') throw new Error('The address must start with http:// or https://'); throw new Error('That does not look like a web link or a file path.'); }
  if (s.kind === 'lookup' && s.url && !/\{(dc|po|pr)\}/i.test(s.url + (s.body || ''))) throw new Error('A lookup address must contain {dc}, {po} or {pr} - it is replaced by the number of the DC being opened. Example: https://erp.example.com/api/dc/{dc}/items');
  if (!['none', 'bearer', 'basic', 'header', 'query'].includes(s.auth || 'none')) s.auth = 'none'; s.auth = s.auth || 'none';
  s.format = s.format === 'csv' ? 'csv' : 'json'; s.method = String(s.method || 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
  for (const k of SECRETS) if (b[k] !== undefined && b[k] !== '') s[k] = clip(b[k], 2000); else if (b['clear_' + k]) s[k] = '';
  if (b.doc !== undefined) s.doc = ['dc', 'bill'].includes(b.doc) ? b.doc : 'both';
  if (b.minutes !== undefined) s.minutes = Math.max(1, Math.min(1440, +b.minutes || 15));
  if (b.enabled !== undefined) s.enabled = !!b.enabled;
  if (b.tabs !== undefined) s.tabs = (Array.isArray(b.tabs) ? b.tabs : String(b.tabs).split(/[,\n]/)).map(x => clip(x, 60)).filter(Boolean).slice(0, 30);
  if (b.cols && typeof b.cols === 'object') s.cols = Object.fromEntries(Object.entries(b.cols).filter(([k, v]) => ORDER.includes(k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, clip(v, 60)]));
  store.save(); rebuild(); return s;
}
function removeSource(id) {
  const s = getSrc(id); if (!s) throw new Error('Source not found.');
  box().sources = box().sources.filter(x => x !== s); delete DATA[id]; for (const k of [...LOOK.keys()]) if (k.startsWith(id + '|')) LOOK.delete(k);
  try { fs.unlinkSync(upPath(id)); } catch { /* none */ } store.save(); rebuild(); persist();
}
async function saveUpload(id, name, buf) {
  const s = getSrc(id); if (!s || s.kind !== 'upload') throw new Error('Source not found.');
  if (!buf || !buf.length) throw new Error('The file is empty.'); if (!isZip(buf) && !/[,;\t]/.test(buf.subarray(0, 2000).toString('utf8'))) throw new Error('Upload an Excel (.xlsx) or CSV file.');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(upPath(id), buf); s.uploadedName = clip(name, 120); s.lastHash = ''; store.save();
  return syncSource(id, true);
}

function setSettings(b) {
  const st = box();
  if (b.match && typeof b.match === 'object') for (const k of KINDS) if (b.match[k] !== undefined) st.match[k] = !!b.match[k];
  if (b.fillDown !== undefined) st.fillDown = !!b.fillDown; if (b.checkCompany !== undefined) st.checkCompany = !!b.checkCompany;
  if (b.lookupHours !== undefined) st.lookupHours = Math.max(1, Math.min(720, +b.lookupHours || 12));
  store.save(); COV = null; return overview();
}

// ---------- how well are the desk's DCs covered? ----------
function coverage() {
  if (COV && Date.now() - COV.at < 15000) return COV;
  const seen = new Set(), via = { dc: 0, po: 0, pr: 0, erp: 0 }, avail = { dc: 0, po: 0, pr: 0 }, missing = []; let total = 0, matched = 0;
  for (const o of store.db.orders || []) {
    if (!o.dc) continue; const k = (o.src || '') + '|' + nkey(o.dc); if (seen.has(k)) continue; seen.add(k); total++;
    const f = find(o); if (f.items.length) { matched++; via[f.via]++; } else if (missing.length < 12) missing.push({ dc: o.dc, po: o.po || '', pr: o.pr || '', company: o.organization || o.company || '' });
    for (const kind of KINDS) if (variants(o[kind]).some(x => IDX[kind].has(x))) avail[kind]++;
  }
  return (COV = { at: Date.now(), total, matched, via, avail, missing });
}
// "why does DC x show no items?": the orders that match the number, and what the index holds for it
function check(q) {
  const ks = variants(q); if (!ks.length) throw new Error('Type a DC, PO or P.R number.');
  const ords = (store.db.orders || []).filter(o => KINDS.some(kind => variants(o[kind]).some(v => ks.includes(v)))).slice(0, 5);
  const hits = {}; for (const kind of KINDS) { const g = new Map(); for (const k of ks) for (const it of IDX[kind].get(k) || []) { const gk = it.s + '|' + it.tab; const e = g.get(gk) || { src: (getSrc(it.s) || {}).name || '', tab: it.tab, n: 0, company: it.co, sample: it.d }; e.n++; g.set(gk, e); } hits[kind] = [...g.values()]; }
  return { key: ks[0], hits, orders: ords.map(o => { const f = find(o); return { dc: o.dc || '', po: o.po || '', pr: o.pr || '', branch: o.branch || '', company: o.organization || o.company || '', found: f.items.length, via: f.via, viaLabel: KIND_LABEL[f.via] || '' }; }) };
}
function overview() {
  const st = box(), c = coverage(), items = Object.values(DATA).reduce((a, x) => a + x.length, 0);
  return { settings: { match: st.match, fillDown: st.fillDown, checkCompany: st.checkCompany, lookupHours: st.lookupHours }, sources: st.sources.map(view_), coverage: c, items, indexed: { dc: IDX.dc.size, po: IDX.po.size, pr: IDX.pr.size }, job: { ...JOB }, msSignedIn: ms.signedIn(), hasLookup: lookups().length > 0 };
}

// ---------- schedule ----------
let ticker = null;
function tickAll() {
  for (const s of box().sources) {
    if (s.enabled === false || s.kind === 'lookup' || running.has(s.id)) continue;
    if (s.kind === 'upload' ? !fs.existsSync(upPath(s.id)) : !s.url) continue;
    const missing = !DATA[s.id] && s.lastCount > 0;                           // the saved index is gone (new server): read it again at once
    const due = s.kind === 'upload' ? missing : Date.now() - Math.max(lastTry.get(s.id) || 0, s.lastFailed && s.lastFailed > (s.lastSync || 0) ? s.lastFailed : s.lastSync || 0) >= Math.max(1, +s.minutes || 15) * 60000;
    if (due || missing) syncSource(s.id).catch(e => console.error(`DC items sync failed (${s.name}):`, e.message));
  }
}
function start() { load(); clearInterval(ticker); ticker = setInterval(tickAll, 30000); setTimeout(tickAll, 5000); }


// The sheet attached to a company in "DC items sync": a source whose company / name matches the company, else the one DC sheet that has no company set.
// Returns { id, name, link } (link = web address only; local paths and uploaded files are never sent) or null.
function sheetFor(...names) {
  const web = x => /^https?:\/\//i.test(x.url || '') && x.kind === 'sheet' && x.enabled !== false && x.doc !== 'bill';
  const list = box().sources.filter(web), ns = names.filter(Boolean);
  const eq = (a, b) => { a = nco(a); b = nco(b); return !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a)))); };
  let best = null, top = 0;
  for (const x of list) {
    let sc = 0;
    for (const n of ns) { if (x.company && eq(x.company, n)) sc = Math.max(sc, 3); if (eq(x.name, n)) sc = Math.max(sc, 2); }
    if (sc > top) { top = sc; best = x; }
  }
  if (!best) best = list.filter(x => !x.company).sort((a, b) => (b.doc === 'dc') - (a.doc === 'dc'))[0] || null;
  return best ? { id: best.id, name: best.name, link: best.url } : null;
}
module.exports = { sheetFor, docFor, start, load, overview, setSettings, saveSource, removeSource, saveUpload, syncSource, lookupAll, stopJob, check, itemsFor, count, itemMatcher, find, setState, ensureLookup, editItem, editInfo,
  // exposed for tests
  extractTab, headerRoles, scanBlock, keysOf, variants, nkey, tableFrom, readSource, finalize, _index: () => ({ IDX, DATA }) };
