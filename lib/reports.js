// Scheduled reports: pick rows + columns from the order sheet, build PDF + Excel, email them.
const store = require('./store');
const orders = require('./orders');
const { pdfTable } = require('./pdf');
const { writeRows } = require('./xlsx');
const mailer = require('./mailer');

const COLUMNS = [
  { key: 'po', label: 'PO no' }, { key: 'pr', label: 'P.R no' }, { key: 'cn', label: 'CN no' },
  { key: 'customer', label: 'Customer' }, { key: 'phone', label: 'Phone' },
  { key: 'organization', label: 'Organization' }, { key: 'company', label: 'Company sheet' }, { key: 'status', label: 'Status' }, { key: 'courier', label: 'Courier' }, { key: 'receivedBy', label: 'Received by' },
  { key: 'link', label: 'Tracking link' }, { key: 'updated', label: 'Last updated' }, { key: 'notes', label: 'Notes' },
  { key: 'orderId', label: 'Other reference' },
];
// Anything else in the company sheet (address, branch, quantity ...) can be picked too: its key is "x:" + the sheet's column name.
const DEFAULT_COLS = ['po', 'pr', 'cn', 'customer', 'organization', 'status', 'courier', 'link', 'updated', 'notes'];
const isUrl = v => /^https?:\/\/\S+$/i.test(String(v || '').trim());
// Every extra column of every company sheet, in the order of the sheet (headings are remembered at each sync, so
// columns that are still empty, or that you add to your Excel later, are listed too).
function extraColumns() {
  const s = new Set(); for (const src of store.db.sources || []) for (const h of src.headers || []) s.add(h);
  for (const o of store.db.orders) for (const [h] of o.extra || []) s.add(h);
  return [...s].map(h => ({ key: 'x:' + h, label: h }));
}
// The main columns, always in this order: DC no, PO no, P.R no, Branch code, Branch address, Person name, Contact no,
// Dispatch date, CN no, Courier name, Parcels, Image link. Sheet columns are found by their heading; a column that your
// sheet does not have yet (e.g. person name) simply appears once you add it. Everything else follows, to tick as needed.
const BRANCH_RE = /\bbr\b|branch code|cost code|br\.? ?no/i;
const ROLES = [['x', /^dc\b|dc no|delivery challan/i], ['k', 'po'], ['k', 'pr'], ['x', BRANCH_RE], ['x', /address|location/i],
  ['x', /person|receiver|consignee|contact name|^name$|customer name/i, 'customer'], ['x', /contact|phone|mobile|cell|whatsapp/i, 'phone'], ['x', /dispatch/i], ['k', 'cn'], ['k', 'courier'], ['x', /package|parcel|pieces|\bpcs\b/i], ['x', /image|photo|picture/i]];
function layout() {
  const ex = extraColumns(), used = new Set(), main = [];
  for (const [t, a, fb] of ROLES) {
    let c = t === 'k' ? COLUMNS.find(x => x.key === a) : ex.find(x => !used.has(x.key) && a.test(x.label)) || (fb && { ...COLUMNS.find(x => x.key === fb), fallback: true });
    if (c && !used.has(c.key)) { used.add(c.key); main.push(c); }
  }
  const rest = [...COLUMNS, ...ex].filter(c => !used.has(c.key));
  return { main, rest, order: [...main, ...rest].map(c => c.key) };
}
// Which columns each bank / company sheet really has: its own sheet headings plus the standard fields it fills.
// Keyed by lower-case name of the sheet AND of the organization values found in its orders.
function byOrg() {
  const out = {};
  for (const src of store.db.sources || []) {
    const mine = store.db.orders.filter(o => o.src === src.id), keys = new Set();
    for (const h of src.headers || []) keys.add('x:' + h);
    for (const k of src.mapped || []) if (COLUMNS.some(c => c.key === k)) keys.add(k);
    for (const o of mine) {
      for (const c of COLUMNS) if (String(o[c.key] || '').trim() && !(c.key === 'orderId')) keys.add(c.key);
      for (const [h] of o.extra || []) keys.add('x:' + h);
    }
    for (const n of new Set([src.name, ...mine.map(o => o.organization)].filter(Boolean))) {
      const k = n.toLowerCase(); out[k] = [...new Set([...(out[k] || []), ...keys])];
    }
  }
  return out;
}
// Bank / company names only (the sheets), never the branch names that sit in an "Organization" column.
function companies() { return [...new Set((store.db.sources || []).map(s => s.name).filter(Boolean))]; }
const colDef = k => COLUMNS.find(c => c.key === k) || (String(k).startsWith('x:') ? { key: k, label: k.slice(2) } : null);
// Value of one cell. "Other reference" only shows when it is a real, separate reference (not a copy of the PO / P.R / CN).
function cellValue(o, c) {
  if (c.key.startsWith('x:')) { const h = c.key.slice(2), e = (o.extra || []).find(x => x[0] === h); return e ? e[1] : ''; }
  const v = o[c.key] ?? '';
  if (c.key === 'orderId') return [o.po, o.pr, o.cn].includes(v) ? '' : v;
  return v;
}
const emailRe = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

const list = () => (store.db.reports = store.db.reports || []);
const mailCfg = () => (store.db.mail = store.db.mail || { host: '', port: 587, security: 'starttls', user: '', pass: '', from: '', fromName: '' });
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const slug = s => String(s || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';

// Which day(s) an order must have been updated on:  any | on (exactly N days ago: 0 = today, 1 = yesterday) | last (the last N days, today included)
const isoDay = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
function cleanDate(f) {
  if (['date', 'range'].includes(f.dateMode)) {
    const from = isoDay(f.dateFrom), to = f.dateMode === 'range' ? isoDay(f.dateTo) || from : from;
    if (from) return { dateMode: f.dateMode, dateDays: 0, dateFrom: from, dateTo: to < from ? from : to, updatedWithinDays: '' };
  }
  let mode = ['any', 'on', 'last'].includes(f.dateMode) ? f.dateMode : '', days = Math.max(0, Math.min(3650, Math.floor(+f.dateDays) || 0));
  if (!mode) { const w = f.updatedWithinDays; if (w !== '' && w != null) { mode = 'last'; days = Math.max(0, +w || 0); } else mode = 'any'; }
  return { dateMode: mode, dateDays: mode === 'any' ? 0 : days, dateFrom: '', dateTo: '', updatedWithinDays: '' };
}
function clean(b, old = {}) {
  const f = b.filter || {};
  const arr = v => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(s => String(s).trim()).filter(Boolean);
  const r = {
    id: old.id || store.nextId('r'),
    name: String(b.name || '').trim().slice(0, 80),
    enabled: b.enabled !== false,
    filter: { organizations: arr(f.organizations), statuses: arr(f.statuses), ...cleanDate(f), dateField: String(f.dateField || '').slice(0, 80), search: String(f.search || '').trim() },
    columns: [...new Set(arr(b.columns).filter(k => colDef(k)))],
    customOrder: !!b.customOrder, labels: Object.fromEntries(Object.entries(b.labels && typeof b.labels === 'object' ? b.labels : {}).map(([k, v]) => [k, String(v).trim().slice(0, 40)]).filter(([k, v]) => v && colDef(k))),
    pdf: b.pdf !== false, excel: b.excel !== false,
    recipients: arr(b.recipients).map(s => s.toLowerCase()),
    cc: arr(b.cc).map(s => s.toLowerCase()), bcc: arr(b.bcc).map(s => s.toLowerCase()),
    subject: String(b.subject || '').trim().slice(0, 150), message: String(b.message || '').trim().slice(0, 2000),
    time: /^\d{2}:\d{2}$/.test(b.time) ? b.time : '09:00',
    days: arr(b.days).map(Number).filter(d => d >= 0 && d <= 6),
    skipIfEmpty: !!b.skipIfEmpty,
    lastRun: old.lastRun || null, lastRunDay: old.lastRunDay || '',
  };
  if (!r.name) throw new Error('Give the report a name.');
  if (!r.columns.length) r.columns = DEFAULT_COLS;
  if (!r.days.length) r.days = [0, 1, 2, 3, 4, 5, 6];
  if (!r.pdf && !r.excel) throw new Error('Choose PDF, Excel or both.');
  r.cc = [...new Set(r.cc)].filter(e => !r.recipients.includes(e)); r.bcc = [...new Set(r.bcc)].filter(e => !r.recipients.includes(e) && !r.cc.includes(e));
  const bad = [...r.recipients, ...r.cc, ...r.bcc].find(e => !emailRe.test(e));
  if (bad) throw new Error(`"${bad}" is not a valid email address.`);
  if (!r.recipients.length) throw new Error('Add at least one email address.');
  return r;
}

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 864e5);
// Turns "2026-11-02", "02/11/2026" (day first), "2 Nov 2026", "Nov 2, 2026", Excel serial numbers (46032), timestamps ... into a calendar-day number; null when it is not a date.
const localDay = t => { const d = new Date(t); return dayNum(d.getFullYear(), d.getMonth(), d.getDate()); };
function parseDay(v) {
  const s = String(v == null ? '' : v).replace(/^['"\s]+|['"\s]+$/g, ''); let m; if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) return Math.floor(+s) - 25569; // Excel date number
  if (/^\d{13}$/.test(s)) return localDay(+s); if (/^\d{10}$/.test(s)) return localDay(+s * 1000); // timestamp
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return dayNum(+m[1], m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) return dayNum(+m[3] < 100 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1]);
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[ \-\/.]+([A-Za-z]{3})[a-z]*\.?[ \-,\/.]+(\d{2,4})/)) && MON[m[2].toLowerCase()] !== undefined) return dayNum(+m[3] < 100 ? 2000 + +m[3] : +m[3], MON[m[2].toLowerCase()], +m[1]);
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.?[ \-]+(\d{1,2})(?:st|nd|rd|th)?,?[ \-]+(\d{4})/)) && MON[m[1].toLowerCase()] !== undefined) return dayNum(+m[3], MON[m[1].toLowerCase()], +m[2]);
  if (s.length < 8 || /^[\d.,\s]+$/.test(s) || !/[A-Za-z]/.test(s)) return null; // bare numbers like "5" or "12.5" are not dates
  const t = Date.parse(s); if (isNaN(t)) return null; return localDay(t);
}
const todayNum = () => { const d = new Date(); return dayNum(d.getFullYear(), d.getMonth(), d.getDate()); };

// The date an order is judged by: the picked sheet column, or (default) its last updated / dispatch date.
function rawDate(o, field) {
  if (!field) return o.updated || ((o.extra || []).find(e => /dispatch/i.test(e[0]) && parseDay(e[1]) !== null) || [])[1];
  const e = (o.extra || []).find(x => x[0] === field); return e ? e[1] : '';
}
function select(r, stats) {
  const f = r.filter; const q = (f.search || '').toLowerCase();
  const orgs = f.organizations.map(s => s.toLowerCase()), sts = f.statuses.map(s => s.toLowerCase());
  const d = cleanDate(f), t = todayNum();
  return store.db.orders.filter(o => {
    if (orgs.length && !orgs.includes(String(o.organization || '').toLowerCase()) && !orgs.includes(String(o.company || '').toLowerCase())) return false;
    if (sts.length && !sts.includes(String(o.status || 'Pending').toLowerCase())) return false;
    if (d.dateMode !== 'any') {
      const n = parseDay(rawDate(o, f.dateField)); if (n === null) { if (stats) stats.noDate++; return false; }
      if (d.dateMode === 'date' || d.dateMode === 'range') { if (n < parseDay(d.dateFrom) || n > parseDay(d.dateTo)) return false; }
      else if (d.dateMode === 'on' ? n !== t - d.dateDays : !(n >= t - d.dateDays && n <= t)) return false;
    }
    if (q && !Object.values(o).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
}
// Live check for the report form: how many orders match, and how many were left out because the chosen column has no readable date.
function preview(b) {
  const f = (b && b.filter) || {}, arr = v => (Array.isArray(v) ? v : []).map(String);
  const r = { filter: { organizations: arr(f.organizations), statuses: arr(f.statuses), ...cleanDate(f), dateField: String(f.dateField || ''), search: String(f.search || '').trim() } };
  const stats = { noDate: 0 }, rows = select(r, stats);
  return { matching: rows.length, noDate: stats.noDate };
}
// Columns the "Date taken from" list offers: every column of the ticked sheet(s); the ones that hold dates are listed first.
function dateCols() {
  const st = {}; for (const o of store.db.orders) for (const [h, v] of o.extra || []) { if (!String(v).trim()) continue; const x = st[h] = st[h] || { n: 0, d: 0 }; x.n++; if (parseDay(v) !== null) x.d++; }
  const mk = h => ({ label: h, date: /date|day|time|dispatch|updated/i.test(h) || (!!st[h] && st[h].d / st[h].n >= 0.5) });
  const bySheet = {}; for (const [k, keys] of Object.entries(byOrg())) bySheet[k] = keys.filter(x => x.startsWith('x:')).map(x => mk(x.slice(2)));
  return { bySheet, all: extraColumns().map(c => mk(c.label)) };
}

// The columns of a report: reports saved with the old "Order ID" column now show PO / P.R / CN instead, and columns that are empty for every order are left out.
function resolveCols(r, rows) {
  let keys = [...r.columns];
  if (keys.includes('orderId') && !keys.some(k => ['po', 'pr', 'cn'].includes(k))) keys.splice(keys.indexOf('orderId'), 0, 'po', 'pr', 'cn');
  const order = layout().order; // output always follows the fixed order above
  let cols = [...new Set(keys)]; if (!r.customOrder) cols.sort((a, b) => { const x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); }); cols = cols.map(k => { const d = colDef(k); return d && r.labels && r.labels[k] ? { ...d, label: r.labels[k], renamed: true } : d; }).filter(Boolean);
  return cols; // every column you ticked is included, even when it is still empty (e.g. Dispatch date before dispatch)
}

function build(r) {
  const rows = select(r), cols = resolveCols(r, rows);
  // Branch code is always 4 digits in reports (5 becomes 0005, 812 becomes 0812); longer or non-numeric codes stay as they are.
  const isBranch = c => c.key.startsWith('x:') && !c.renamed && BRANCH_RE.test(c.label), pad4 = v => /^\d{1,3}$/.test(v) ? v.padStart(4, '0') : v;
  const grid = rows.map(o => cols.map(c => { const v = String(cellValue(o, c)).trim(); if (isBranch(c)) return pad4(v); const u = (/^https?:/i.test(v) || orders.LINKY.test(c.label)) ? orders.urlOf(v) : ''; return u || v; }));
  // the branch code column is narrow, titled "Branch code" and centred
  const shownCols = cols.map(c => isBranch(c) ? { ...c, label: 'Branch code', narrow: true, align: 'center' } : c), centered = shownCols.map((c, i) => c.align === 'center' ? i : -1).filter(i => i >= 0);
  const day = today(), base = `${slug(r.name)}-${day}`, biz = store.db.settings.businessName;
  const files = [];
  if (r.excel) files.push({ filename: base + '.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: writeRows([shownCols.map(c => c.label), ...grid], r.name.slice(0, 28), centered) });
  if (r.pdf) files.push({ filename: base + '.pdf', type: 'application/pdf', content: pdfTable({ title: r.name, subtitle: `${biz} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${rows.length} order${rows.length === 1 ? '' : 's'}`, columns: shownCols, rows: grid, footer: `${biz} · generated automatically` }) });
  const byStatus = {}; rows.forEach(o => { const s = o.status || 'Pending'; byStatus[s] = (byStatus[s] || 0) + 1; });
  return { rows, files, byStatus };
}

function emailBody(r, b) {
  const biz = store.db.settings.businessName;
  const intro = r.message || 'Please find the latest report attached.';
  const lines = Object.entries(b.byStatus).map(([s, n]) => `${s}: ${n}`);
  const text = `${intro}\n\n${r.name} — ${b.rows.length} order(s)\n${lines.join('\n')}\n\n— ${biz}`;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#10201d"><div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">${esc(r.name)}</div>
  <div style="border:1px solid #e4e9e7;border-top:0;padding:20px;border-radius:0 0 12px 12px"><p style="margin:0 0 14px;white-space:pre-wrap">${esc(intro)}</p>
  <p style="margin:0 0 8px;font-size:28px;font-weight:800">${b.rows.length} <span style="font-size:14px;font-weight:500;color:#5b6b67">order${b.rows.length === 1 ? '' : 's'} in this report</span></p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">${Object.entries(b.byStatus).map(([s, n]) => `<tr><td style="padding:6px 0;border-top:1px solid #e4e9e7">${esc(s)}</td><td style="padding:6px 0;border-top:1px solid #e4e9e7;text-align:right;font-weight:700">${n}</td></tr>`).join('')}</table>
  <p style="margin:16px 0 0;color:#8a9893;font-size:12px">The full list is attached. Sent automatically by ${esc(biz)}.</p></div></div>`;
  return { text, html };
}

// Reports are sent from (1) the Gmail mailbox picked in "Email settings", else (2) the account typed there, else
// (3) the first Gmail mailbox added under Email, so one mailbox set-up is enough.
const mailboxes = () => ((store.db.inbox || {}).accounts || []).filter(a => a.user && a.pass);
const fromMailbox = a => ({ host: a.smtpHost || 'smtp.gmail.com', port: +a.smtpPort || 587, security: +a.smtpPort === 465 ? 'ssl' : 'starttls', user: a.user, pass: a.pass, from: a.user, fromName: a.fromName || a.label || '', source: 'mailbox', label: a.label || a.user });
function effectiveCfg() {
  const c = mailCfg(), box = mailboxes();
  const pick = c.accountId && box.find(a => a.id === c.accountId); if (pick) return fromMailbox(pick);
  if (c.host && c.from) return { ...c, source: 'settings' };
  const a = box.find(x => x.enabled !== false) || box[0]; return a ? fromMailbox(a) : null;
}
const friendly = e => /535|Username and Password not accepted|Invalid credentials|AUTH/i.test(e.message) ? 'The mail server refused the login. For Gmail make sure the App password (16 letters) is correct and 2-Step Verification is on. (' + e.message + ')' : e.message;
async function sendMail(msg) {
  const c = effectiveCfg();
  if (!c) throw new Error('Set up the email account first (Email settings, or add a Gmail mailbox under Email).');
  try { return await mailer.send(c, msg); } catch (e) { throw new Error(friendly(e)); }
}

async function run(r, { manual } = {}) {
  const b = build(r);
  if (!manual && r.skipIfEmpty && !b.rows.length) { r.lastRun = { ts: Date.now(), ok: true, count: 0, note: 'Skipped: no matching orders' }; r.lastRunDay = today(); store.save(); return r.lastRun; }
  const subject = (r.subject || `${r.name} — ${today()}`).replace('{date}', today()).replace('{count}', b.rows.length);
  try {
    const { text, html } = emailBody(r, b);
    await sendMail({ to: r.recipients, cc: r.cc || [], bcc: r.bcc || [], subject, text, html, attachments: b.files });
    r.lastRun = { ts: Date.now(), ok: true, count: b.rows.length, note: `Sent to ${r.recipients.length + (r.cc || []).length + (r.bcc || []).length} ${r.recipients.length + (r.cc || []).length + (r.bcc || []).length === 1 ? 'person' : 'people'}` };
  } catch (e) { r.lastRun = { ts: Date.now(), ok: false, count: b.rows.length, note: e.message }; }
  if (!manual) r.lastRunDay = today();
  store.save();
  if (!r.lastRun.ok) throw new Error(r.lastRun.note);
  return r.lastRun;
}

let timer;
function tick() {
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  for (const r of list()) {
    if (!r.enabled || r.lastRunDay === today(now) || !r.days.includes(now.getDay())) continue;
    const [h, m] = r.time.split(':').map(Number), due = mins - (h * 60 + m);
    if (due >= 0 && due < 90) run(r).catch(e => console.error(`Report "${r.name}" failed:`, e.message));
  }
}
function start() { clearInterval(timer); timer = setInterval(tick, 20000); setTimeout(tick, 3000); }

module.exports = { byOrg, companies, layout, mailboxes, COLUMNS, DEFAULT_COLS, extraColumns, cleanDate, list, mailCfg, effectiveCfg, clean, build, run, start, sendMail, select, preview, dateCols, parseDay };
