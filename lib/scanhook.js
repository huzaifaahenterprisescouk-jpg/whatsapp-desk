// ScanSheet -> Desk BACKUP: every entry the team saves in the ScanSheet app is pushed here (POST /webhooks/scan).
// Entries are NOT orders: they are never counted in the Overview / Company report / Order tracking. They are kept in db.scanLog and written to
// files in the backup folder (default data/scan-backup, on the Synology volume), and the "Scan backup" page compares them with the company
// sheets so you can see what is missing or different in the original sheet and add it.
// Set SCAN_TOKEN in .env and the same word as DESK_TOKEN in scansheet.php.
const crypto = require('crypto');
const store = require('./store'), orders = require('./orders'), cfg = require('./config'), sync = require('./sync');
const SRC_ID = 'scansheet';
const { normId } = orders;

const fs = require('fs'), path = require('path');
const log = () => (store.db.scanLog = store.db.scanLog || []);
const backupDir = () => process.env.SCAN_BACKUP_DIR || path.join(path.dirname(cfg.dataFile), 'scan-backup');
// Older versions stored scan entries as orders in a "Scan sheet" source. Move them to the backup so they stop counting as DCs.
function migrate() {
  const db = store.db; if (db.scanMigrated) return;
  const old = (db.orders || []).filter(o => o.src === SRC_ID);
  for (const o of old) log().push({ id: (o.scanIds || [])[0] || 'o' + (o.row || log().length + 1), at: o.addedAt || Date.now(), day: o.orderDay || o.updated || '', dc: o.dc || '', po: o.po || '', pr: o.pr || '', cn: o.cn || '', courier: o.courier || '', organization: o.organization || '', branch: o.branch || '', address: o.address || '', phone: o.phone || '', customer: o.customer || '', notes: o.notes || '', by: o.scannedBy || '', extra: o.extra || [], scanIds: o.scanIds || [] });
  if (old.length) db.orders = db.orders.filter(o => o.src !== SRC_ID);
  const i = sync.list().findIndex(x => x.id === SRC_ID); if (i >= 0) sync.list().splice(i, 1);
  db.scanMigrated = true; store.save();
}
const CSV_COLS = [['Date', e => e.day], ['Company', e => e.organization], ['DC', e => e.dc], ['PO', e => e.po], ['P.R', e => e.pr], ['CN', e => e.cn], ['Courier', e => e.courier], ['Branch', e => e.branch], ['Address', e => e.address], ['Phone', e => e.phone], ['Customer', e => e.customer], ['Notes', e => e.notes], ['Entered by', e => e.by], ['Links', e => (e.extra || []).filter(x => orders.isUrl(x[1])).map(x => x[1]).join(' ')]];
const csvCell = v => { v = String(v == null ? '' : v); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
// every received entry is also appended to files in the backup folder: scan-YYYY-MM.csv (opens in Excel) and scan-all.jsonl (full detail)
function writeBackup(e) {
  try {
    const d = backupDir(); fs.mkdirSync(d, { recursive: true });
    const f = path.join(d, 'scan-' + (e.day || new Date().toISOString().slice(0, 10)).slice(0, 7) + '.csv');
    if (!fs.existsSync(f)) fs.writeFileSync(f, '\ufeff' + CSV_COLS.map(c => c[0]).join(',') + '\r\n');
    fs.appendFileSync(f, CSV_COLS.map(c => csvCell(c[1](e))).join(',') + '\r\n');
    fs.appendFileSync(path.join(d, 'scan-all.jsonl'), JSON.stringify({ savedAt: new Date().toISOString(), ...e }) + '\n');
  } catch (err) { console.error('Scan backup file:', err.message); }
}
// how each scan entry compares with the company sheets: in the sheet / missing from it / found but the CN differs
const DC_LABEL = /^(d\.?\s?c\.?|delivery challan|challan)\s*(no\.?|number|#)?$/i;
function compare(entries) {
  const byCn = new Map(), byDc = new Map();
  for (const o of store.db.orders) {
    if (o.src === SRC_ID) continue;
    const cn = normId(o.cn); if (cn) { const a = byCn.get(cn) || []; a.push(o); byCn.set(cn, a); }
    const dcs = new Set([o.dc, ...[...(o.extra || []), ...(o.mapped || [])].filter(x => DC_LABEL.test(String(x[0]).trim())).map(x => x[1])].map(normId).filter(Boolean));
    for (const d of dcs) { const a = byDc.get(d) || []; a.push(o); byDc.set(d, a); }
  }
  return entries.map(e => {
    const cn = normId(e.cn), dc = normId(e.dc), org = normId(e.organization);
    let hit = (cn && (byCn.get(cn) || [])[0]) || null;
    if (!hit && dc) hit = (byDc.get(dc) || []).find(o => !org || normId(o.organization) === org || normId(o.company) === org) || null;
    if (!hit) return { ...e, state: 'missing' };
    const sc = normId(hit.cn);
    return { ...e, state: cn && sc && cn !== sc ? 'differs' : cn && !sc ? 'nocn' : 'ok', sheet: hit.company || hit.organization || '', sheetCn: hit.cn || '' };
  });
}
function list() { migrate(); return compare(log().slice().sort((a, b) => (b.at || 0) - (a.at || 0))); }
const authOk = tok => { const a = Buffer.from(String(tok || '')), b = Buffer.from(String(cfg.scanToken || '')); return !!b.length && a.length === b.length && crypto.timingSafeEqual(a, b); };

// which desk field a scan-form field belongs to (by its label)
function kindOf(label, type) {
  const l = String(label || '').trim();
  if (type === 'image') return 'image';
  if (/entered by/i.test(l)) return 'by';
  if (type !== 'dropdown' && /\bd\s?\.?\s?c\b|challan/i.test(l)) return 'dc';
  if (/\bcn\b|consignment|tracking/i.test(l)) return 'cn';
  if (type === 'dropdown' && /compan|bank/i.test(l) || /^(compan|bank|organi[sz]ation)/i.test(l)) return 'organization';
  if (/\bp\.?\s?o\b|purchase order/i.test(l)) return 'po';
  if (/\bp\.?\s?r\b/i.test(l)) return 'pr';
  if (/courier|carrier/i.test(l)) return 'courier';
  if (/branch/i.test(l)) return 'branch';
  if (/address|location/i.test(l)) return 'address';
  if (/phone|mobile|whatsapp/i.test(l)) return 'phone';
  if (/customer|client/i.test(l)) return 'customer';
  if (/note|remark/i.test(l)) return 'notes';
  return '';
}

// what the desk knows about the link, for the indicator on the Order tracking page
const st = () => (store.db.scanState = store.db.scanState || { total: 0, lastAt: 0, lastOrderId: '', days: {}, badAt: 0, badWhy: '' });
const dayKey = () => new Date().toISOString().slice(0, 10);
function noteBad(why) { const s = st(); s.badAt = Date.now(); s.badWhy = why; store.save(); }
function status() {
  const s = st(), t = dayKey();
  return { backupDir: backupDir(), entries: log().length, tokenSet: !!cfg.scanToken, path: '/webhooks/scan', total: s.total || 0, today: (s.days && s.days[t]) || 0, lastAt: s.lastAt || 0, lastOrderId: s.lastOrderId || '', badAt: s.badAt || 0, badWhy: s.badWhy || '' };
}
function receive(body) {
  const vals = Array.isArray(body.values) ? body.values : [];
  const m = {}, extra = [];
  for (const v of vals) {
    const value = String(v && v.value == null ? '' : v.value).trim(), label = String(v.label || '').trim(); if (!value || !label) continue;
    const k = kindOf(label, v.type);
    if (k === 'image') { if (orders.isUrl(value)) extra.push([label, value.slice(0, 2000), 1]); }
    else if (k === 'by') extra.push([label, value.slice(0, 200), 1]);
    else if (k && !m[k]) m[k] = value.slice(0, k === 'address' ? 300 : 200);
    else extra.push([label, value.slice(0, 200), 1]);
  }
  const id = m.dc || m.po || m.pr || m.cn;
  if (!id) return { ok: true, skipped: 'The entry has no DC / PO / P.R / CN number.' };
  migrate();
  const eid = String(body.entryId || '').slice(0, 64), day = orders.parseDay(body.time) || new Date().toISOString().slice(0, 10), org = m.organization || '';
  const mine = log();
  let o = mine.find(x => eid && (x.scanIds || []).includes(eid)); if (o) return { ok: true, duplicate: true };
  o = mine.find(x => (m.dc && normId(x.dc) === normId(m.dc) && normId(x.organization) === normId(org)) || (m.cn && normId(x.cn) === normId(m.cn)));
  const isNew = !o;
  if (!o) { o = { id: eid || 'e' + Date.now(), at: Date.now(), day, dc: '', po: '', pr: '', cn: '', courier: '', organization: '', branch: '', address: '', phone: '', customer: '', notes: '', by: '', extra: [], scanIds: [] }; mine.push(o); }
  for (const k of ['dc', 'po', 'pr', 'cn', 'courier', 'branch', 'address', 'phone', 'customer', 'notes']) if (m[k]) o[k] = m[k];
  if (org) o.organization = org;
  o.orderId = o.dc || o.po || o.pr || o.cn;
  const have = new Map((o.extra || []).map(e => [e[0], e])); for (const e of extra) have.set(e[0], e); o.extra = [...have.values()];
  o.scanIds = [...(o.scanIds || []), eid].filter(Boolean).slice(-20);
  o.by = (extra.find(e => /entered by/i.test(e[0])) || [])[1] || o.by || String(body.person || '');
  { const s = st(), t = dayKey(); s.total = (s.total || 0) + 1; s.lastAt = Date.now(); s.lastOrderId = o.orderId; s.days = { [t]: ((s.days || {})[t] || 0) + 1 }; }
  store.save(); writeBackup(o);
  return { ok: true, created: isNew, orderId: o.orderId };
}

// ---- AUTO-FIX LOOP: an entry the ScanSheet app saved but the company's OneDrive sheet does not have is added to that sheet ----
// Every few minutes: re-read each company sheet, find the entries still "Missing in sheet" (older than the grace time, so the NAS has had
// its own chance to write them), and add them below the last row. Each entry is added once; the next re-read shows it as "In sheet".
const ms = require('./msgraph');
const GRACE_MS = (+process.env.SCAN_AUTOFIX_MIN || 15) * 60000;
const fx = { running: false, lastAt: 0, lastAdded: 0, totalAdded: 0, lastErr: '' };
const imgOf = e => ((e.extra || []).find(x => /^https?:/i.test(String(x[1]))) || [])[1] || '';
function sourceFor(org) {
  const w = normId(org); if (!w) return null;
  const all = sync.list().filter(s => s.url && !/^(file:|\/|[A-Za-z]:[\\/])/.test(String(s.url).trim()));
  return all.find(s => normId(s.name) === w) || all.find(s => store.db.orders.some(o => o.src === s.id && (normId(o.organization) === w || normId(o.company) === w))) || all.find(s => normId(s.name).includes(w) || w.includes(normId(s.name))) || null;
}
// one cell value for each header of the company's sheet
function rowFor(e, headers) {
  const F = orders.FIELDS;
  return headers.map(h0 => {
    const h = String(h0 || ''), n = orders.norm(h);
    if (orders.DC_NO_H(h)) return e.dc || '';
    if (orders.BRANCH_H(h)) return e.branch || '';
    if (orders.ADDR_H(h)) return e.address || '';
    if (/image|photo|picture|scan/i.test(h) || orders.LINKY.test(h)) return imgOf(e);
    if (/^(entered by|by|scanned by)$/.test(n)) return e.by || '';
    for (const [k, , aliases] of F) if (['pr', 'po', 'cn', 'courier', 'customer', 'phone', 'organization', 'notes'].includes(k) && aliases.includes(n)) return e[k] || '';
    if (/^(date|dc date|d c date|order date|dc dt)$/.test(n)) return e.day || '';
    const x = (e.extra || []).find(z => orders.norm(z[0]) === n && !/^https?:/i.test(String(z[1])));
    return x ? x[1] : '';
  });
}
async function autoFix(force, onlyIds) {
  const pick = e => e.state === 'missing' && !e.fixed && !e.skip && (!onlyIds || onlyIds.has(e.id)) && (force || Date.now() - (e.at || 0) >= GRACE_MS);
  if (fx.running) return { busy: true };
  fx.running = true; fx.lastErr = ''; let added = 0; const errs = [];
  try {
    if (!ms.signedIn()) throw new Error('Not signed in with Microsoft (Order tracking page), so the desk cannot add rows to the sheets.');
    // 1) fresh copy of every company sheet that has a missing entry
    const need = new Set();
    for (const e of list()) if (pick(e)) { const s = sourceFor(e.organization); if (s) need.add(s.id); }
    for (const id of need) { try { await sync.syncNow(id, true); } catch (er) { errs.push(`${(sync.get(id) || {}).name}: ${er.message}`); need.delete(id); } }
    // 2) what is still missing after the fresh read is added, one sheet at a time
    const todo = list().filter(pick).reverse();
    for (const e of todo) {
      const s = sourceFor(e.organization), mine = log().find(x => x.id === e.id); if (!mine) continue;
      if (!s) { mine.fixErr = `No company sheet found for "${e.organization || 'no company'}".`; continue; }
      if (!need.has(s.id)) continue; // its sheet could not be read just now: try again at the next round
      if (!s.wb || !s.wb.headers || !s.wb.sheet) { mine.fixErr = `Press Sync now once on "${s.name}" so the desk learns its columns.`; continue; }
      try {
        const values = rowFor(e, s.wb.headers); if (!values.some(v => String(v).trim())) throw new Error('Nothing to write.');
        await ms.appendRow(s.url, { sheet: s.wb.sheet, headerRow: s.wb.headerRow, values });
        mine.fixed = { at: Date.now(), src: s.name }; mine.fixErr = ''; added++;
        const st0 = store.db.scanState; if (st0) st0.fixedTotal = (st0.fixedTotal || 0) + 1;
      } catch (er) { mine.fixErr = er.message; errs.push(`${e.dc || e.cn}: ${er.message}`); }
    }
    store.save();
    for (const id of need) { try { await sync.syncNow(id, true); } catch { /* the regular timer will read it */ } }
  } catch (er) { errs.push(er.message); }
  fx.running = false; fx.lastAt = Date.now(); fx.lastAdded = added; fx.totalAdded += added; fx.lastErr = errs.slice(0, 3).join(' | ');
  return { added, error: fx.lastErr };
}
// bulk actions from the Scan backup page: exclude (never added to a sheet, kept in the backup), restore, delete from the backup, or add now
async function bulk(ids, action) {
  const set = new Set((Array.isArray(ids) ? ids : []).map(String)); if (!set.size) return { changed: 0 };
  migrate(); const l = log(); let changed = 0;
  if (action === 'delete') { const keep = l.filter(x => !set.has(String(x.id))); changed = l.length - keep.length; l.length = 0; l.push(...keep); }
  else if (action === 'skip' || action === 'unskip') { for (const x of l) if (set.has(String(x.id))) { if (action === 'skip') x.skip = { at: Date.now() }; else delete x.skip; changed++; } }
  else if (action === 'add') { for (const x of l) if (set.has(String(x.id)) && x.skip) { delete x.skip; } store.save(); const r = await autoFix(true, set); return { ...r, changed: r.added || 0 }; }
  else throw new Error('Unknown action');
  store.save(); return { changed };
}
function startFix() { if (process.env.SCAN_AUTOFIX === 'off') return; setInterval(() => autoFix(false).catch(() => {}), 5 * 60000); setTimeout(() => autoFix(false).catch(() => {}), 60000); }
const fixStatus = () => ({ on: process.env.SCAN_AUTOFIX !== 'off', graceMin: GRACE_MS / 60000, ...fx });

module.exports = { receive, authOk, noteBad, status, list, migrate, backupDir, SRC_ID, CSV_COLS, autoFix, startFix, fixStatus, bulk };
