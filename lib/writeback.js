// Edit button on a DC: change status / courier / CN / dispatch date / received by / notes in the app AND in the company's Excel sheet.
//  * OneDrive / SharePoint link  -> written through Microsoft Graph (needs the Microsoft sign-in with edit permission)
//  * a file path on this server  -> the .xlsx file is changed in place
//  * a sheet that was uploaded by hand (no link) -> only the app's copy changes (there is no sheet to write to)
// Before anything is written the row is checked (PO / P.R / CN still match), so a sorted or edited sheet can never get the wrong row changed.
const fs = require('fs');
const store = require('./store');
const sync = require('./sync');
const ms = require('./msgraph');
const xl = require('./xlsx');
const orders = require('./orders');

const isPath = l => /^(file:|\/|[A-Za-z]:[\\/])/.test(String(l || '').trim());
const LABEL = { status: 'Status', courier: 'Courier', cn: 'CN no', receivedBy: 'Received by', notes: 'Notes', date: 'Dispatch date' };
const EDITABLE = ['status', 'courier', 'cn', 'date', 'receivedBy', 'notes'];

// What can be edited for this order and, when nothing, why not (shown to the user).
function capability(o) {
  if (!o || !o.src) return { can: false, fields: [], reason: 'This order does not come from a company sheet.' };
  const s = sync.get(o.src); if (!s) return { can: false, fields: [], reason: 'The company sheet no longer exists.' };
  if (!s.url) return { can: true, local: true, fields: EDITABLE, reason: '' }; // uploaded by hand: only the app's copy
  if (!s.wb || !s.wb.cols) return { can: false, fields: [], reason: 'Press "Sync now" once so the app learns this sheet\'s columns.' };
  if (!o.row) return { can: false, fields: [], reason: 'Press "Sync now" once so the app learns this row\'s place in the sheet.' };
  const fields = EDITABLE.filter(k => s.wb.cols[k] !== undefined);
  if (!fields.length) return { can: false, fields: [], reason: 'This sheet has no Status, Courier or CN column to write to.' };
  if (!isPath(s.url) && !ms.signedIn()) return { can: true, fields, signin: true, reason: 'Sign in with Microsoft (Order tracking) so the app can change the Excel file.' };
  return { can: true, fields, reason: '' };
}

const chain = new Map(); // one write at a time per sheet
const serial = (id, fn) => { const run = (chain.get(id) || Promise.resolve()).catch(() => {}).then(fn); chain.set(id, run.catch(() => {})); return run; };

// the value as it should be written in the sheet
function cellText(k, v) { v = String(v == null ? '' : v).trim(); return k === 'date' ? (orders.parseDay(v) || v) : v; }

async function writeSheet(s, o, cells) {
  const cols = s.wb.cols, sheet = s.wb.sheet;
  // the columns that identify the row: they must still hold what we loaded, or the sheet moved
  const check = ['po', 'pr', 'cn', 'orderId'].filter(k => cols[k] !== undefined && String(o[k] || '').trim() && !/^Row \d+$/.test(o[k])).map(k => [cols[k], o[k]]);
  const verify = vals => { for (const [c, want] of check) if (orders.normId(vals[c]) !== orders.normId(want)) throw new Error('This row of the sheet has changed since it was loaded (someone edited or sorted the Excel file). Press Sync now, then try again.'); };
  const patch = buf => { verify(xl.rowValues(buf, sheet, o.row)); return xl.patchCells(buf, sheet, o.row, cells); };
  if (isPath(s.url)) {
    const f = s.url.trim().replace(/^file:\/\//, ''); let buf;
    try { buf = fs.readFileSync(f); } catch (e) { throw new Error(`Cannot read ${f}: ${e.message}`); }
    const out = patch(buf), tmp = f + '.tmp-' + process.pid;
    try { fs.writeFileSync(tmp, out); fs.renameSync(tmp, f); } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw new Error(`Cannot write to ${f}: ${e.code === 'EACCES' || e.code === 'EROFS' ? 'the folder is read-only for the app (share it with write access, see README)' : e.message}`); }
    return 'file';
  }
  if (!ms.signedIn()) throw new Error('Sign in with Microsoft first (Order tracking → Microsoft sign-in) so the app can change the Excel file.');
  const r = await ms.editRow(s.url, { sheet, row: o.row, cells, check, patch });
  return r.via;
}

// changes: { status, courier, cn, date, receivedBy, notes } (only the keys that changed)
async function edit(o, changes, by) {
  const cap = capability(o); if (!cap.can) throw new Error(cap.reason);
  const s = sync.get(o.src), set = {};
  for (const k of EDITABLE) if (changes[k] !== undefined && cap.fields.includes(k)) { const v = cellText(k, changes[k]); if (v !== String(k === 'date' ? (o.updated || '') : o[k] || '').trim()) set[k] = v; }
  if (!Object.keys(set).length) throw new Error('Nothing was changed.');
  if (set.status !== undefined && !set.status) throw new Error('Pick a status.');
  return serial(o.src, async () => {
    let where = 'app';
    if (s.url) {
      const cells = Object.entries(set).map(([k, value]) => ({ col: s.wb.cols[k], value }));
      where = await writeSheet(s, o, cells); // throws before the app's copy is touched
    }
    const was = o.status;
    for (const [k, v] of Object.entries(set)) { if (k === 'date') o.updated = v; else o[k] = v; }
    if (!(s.wb && s.wb.cols && s.wb.cols.status !== undefined) && set.status === undefined) o.status = o.cn.toLowerCase() === 'self' ? 'Self collection' : o.cn ? 'Dispatched' : 'Pending dispatch';
    o.editedBy = by || ''; o.editedAt = Date.now();
    store.save();
    return { o, statusChanged: o.status !== was, where, set };
  });
}

module.exports = { capability, edit, LABEL, EDITABLE };
