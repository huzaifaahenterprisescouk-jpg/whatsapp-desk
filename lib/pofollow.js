// PO follow-up: DCs that were DISPATCHED but still have NO PO number.
//  * pending()   the list (a DC = DC no + branch code + address; PO / P.R may be empty)
//  * addPo()     the admin types a received PO; it is kept in the app (and written to the Excel PO column when possible)
//  * rules       "send the list (PDF + Excel) to the person who makes the PO" at a time of day, and keep reminding
//                every N hours until every DC has its PO. A DC leaves the list the moment it has a PO (typed here or in Excel).
const store = require('./store');
const orders = require('./orders');
const writeback = require('./writeback');
const reports = require('./reports');
const { pdfTable } = require('./pdf');
const { writeRows } = require('./xlsx');
const dcdocs = require('./dcdocs');

const rules = () => (store.db.poRules = store.db.poRules || []);
const added = () => (store.db.poAdded = store.db.poAdded || []);
const seen = () => (store.db.poSeen = store.db.poSeen || {});
const emailRe = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const keyOf = o => `${o.src}|${orders.normId(o.dc)}`;
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null; };
const fmtDay = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const ERR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i;
const val = (...vs) => { for (const v of vs) { const t = String(v == null ? '' : v).trim(); if (t && !ERR.test(t) && !/^(-+|n\/?a|nil|none)$/i.test(t)) return t; } return ''; };

// Dispatched = the order sheet says dispatched / shipped / delivered, or it has a dispatch date / CN (see orders.classOf).
const hasNoPo = o => !val(o.po);
// The full list is worked out once and reused for a few seconds (the page, every reminder card and every download used to
// scan all orders again). It is dropped at once whenever a PO is added / removed or a reminder is sent.
let cache = null;
const bust = () => { cache = null; };
function base() {
  if (cache && cache.orders === store.db.orders && cache.n === store.db.orders.length && Date.now() - cache.t < 4000) return cache.list;
  const out = [], sn0 = seen(), todayN = dayNum(today());
  for (const o of store.db.orders) {
    if (!o.dc || !hasNoPo(o) || orders.classOf(o) !== 'dispatched') continue;
    const k = keyOf(o), sn = sn0[k] || (sn0[k] = { first: Date.now(), reminders: 0, last: 0 });
    const disp = orders.parseDay(o.updated) || o.orderDay || new Date(sn.first).toISOString().slice(0, 10);
    out.push({
      key: k, src: o.src, row: o.row || 0, orderId: o.orderId, company: o.company || o.organization || '', org: o.organization || '', dc: o.dc,
      dcDate: o.orderDay || '', branch: o.branch || '', address: o.address || '', req: val(o.pr), dispatchDay: disp,
      days: Math.max(0, todayN - (dayNum(disp) ?? todayN)), courier: val(o.courier), cn: val(o.cn),
      reminders: sn.reminders || 0, lastReminder: sn.last || 0,
    });
  }
  out.sort((a, b) => b.days - a.days || String(a.company).localeCompare(b.company) || String(a.dc).localeCompare(b.dc, undefined, { numeric: true }));
  cache = { orders: store.db.orders, n: store.db.orders.length, t: Date.now(), list: out };
  return out;
}
function pending(companies) {
  const names = (companies || []).map(s => String(s).toLowerCase()), all = base();
  if (!names.length) return all;
  return all.filter(p => names.includes(p.company.toLowerCase()) || names.includes(p.org.toLowerCase()));
}

async function addPo({ src, dc, po }, by) {
  po = String(po || '').trim().slice(0, 60); dc = String(dc || '').trim();
  if (!po) throw new Error('Type the PO number.');
  if (!/\d/.test(po)) throw new Error('A PO number must contain digits, e.g. JS-71349.');
  const o = store.db.orders.find(x => x.src === src && orders.normId(x.dc) === orders.normId(dc));
  if (!o) throw new Error(`DC ${dc} was not found. Press Sync now (Order tracking) and try again.`);
  const dup = store.db.orders.find(x => x !== o && x.src === src && orders.normId(x.po) === orders.normId(po));
  const r = await writeback.setPo(o, po);
  o.po = po; o.poManual = true;
  const list = added(), old = list.findIndex(x => x.src === src && orders.normId(x.dc) === orders.normId(dc));
  const rec = { id: old >= 0 ? list[old].id : store.nextId('po'), src, dc, po, company: o.company || '', branch: o.branch || '', address: o.address || '', at: Date.now(), by: by || '', where: r.where };
  if (old >= 0) list[old] = rec; else list.unshift(rec);
  store.db.poAdded = list.slice(0, 2000); bust(); store.save();
  return { rec, why: r.why || '', duplicate: dup ? `Note: PO ${po} is already used by DC ${dup.dc || dup.orderId}.` : '' };
}
function removePo(id) {
  const rec = added().find(x => x.id === id); if (!rec) throw new Error('Not found.');
  store.db.poAdded = added().filter(x => x !== rec);
  const o = store.db.orders.find(x => x.src === rec.src && orders.normId(x.dc) === orders.normId(rec.dc));
  if (o && o.poManual) { o.po = ''; delete o.poManual; }
  bust(); store.save(); return rec;
}

// ---------- rules (who gets the mail, when, how often) ----------
const arr = v => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(s => String(s).trim()).filter(Boolean);
function clean(b, old = {}) {
  const r = {
    id: old.id || store.nextId('pr'), name: String(b.name || '').trim().slice(0, 80), enabled: b.enabled !== false,
    companies: arr(b.companies), recipients: arr(b.recipients).map(s => s.toLowerCase()), cc: arr(b.cc).map(s => s.toLowerCase()),
    subject: String(b.subject || '').trim().slice(0, 150), message: String(b.message || '').trim().slice(0, 2000),
    time: /^\d{2}:\d{2}$/.test(b.time) ? b.time : '10:00', untilTime: /^\d{2}:\d{2}$/.test(b.untilTime) ? b.untilTime : '17:00',
    repeatHours: Math.max(0, Math.min(72, +b.repeatHours || 0)), days: arr(b.days).map(Number).filter(d => d >= 0 && d <= 6),
    pdf: b.pdf !== false, excel: b.excel !== false, mode: ['list', 'each', 'both'].includes(b.mode) ? b.mode : (old.mode || 'list'), skipNoDocs: !!b.skipNoDocs, minDays: Math.max(0, Math.min(365, Math.floor(+b.minDays) || 0)),
    lastRun: old.lastRun || null, lastRunDay: old.lastRunDay || '', lastSentAt: old.lastSentAt || 0, sentToday: old.sentToday || 0,
  };
  if (!r.name) throw new Error('Give this reminder a name, e.g. "PO reminder - Purchase dept".');
  if (!r.days.length) r.days = [1, 2, 3, 4, 5, 6, 0];
  if (r.mode !== 'each' && !r.pdf && !r.excel) throw new Error('Choose PDF, Excel or both.');
  r.cc = [...new Set(r.cc)].filter(e => !r.recipients.includes(e));
  const bad = [...r.recipients, ...r.cc].find(e => !emailRe.test(e)); if (bad) throw new Error(`"${bad}" is not a valid email address.`);
  if (!r.recipients.length) throw new Error('Add the email of the person who makes the PO.');
  return r;
}

const COLS = [['DC no', 'dc'], ['DC date', 'dcDate'], ['Branch code', 'branch'], ['Branch address', 'address'], ['Req / P.R no', 'req'], ['Dispatch date', 'dispatchDay'], ['Waiting (days)', 'days'], ['Company', 'company'], ['Reminders', 'reminders']];
const cellOf = (p, k) => k === 'dcDate' || k === 'dispatchDay' ? fmtDay(p[k]) : String(p[k] ?? '');
function files(list, r, title) {
  const day = today(), base = `dc-without-po-${day}`, biz = store.db.settings.businessName;
  const grid = list.map(p => COLS.map(([, k]) => cellOf(p, k)));
  const out = [];
  if (!r || r.excel) out.push({ filename: base + '.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: writeRows([COLS.map(c => c[0]), ...grid], 'DC without PO', [0, 1, 2, 6, 8], [10, 12, 11, 44, 14, 13, 10, 18, 10]) });
  if (!r || r.pdf) out.push({ filename: base + '.pdf', type: 'application/pdf', content: pdfTable({ title: title || 'Dispatched DCs without a Purchase Order', subtitle: `${biz} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${list.length} DC${list.length === 1 ? '' : 's'}`, columns: COLS.map(([l, k]) => ({ label: l, width: k === 'address' ? 40 : k === 'company' ? 16 : 0, narrow: ['dc', 'dcDate', 'branch', 'dispatchDay', 'days', 'reminders'].includes(k), align: ['dc', 'dcDate', 'branch', 'dispatchDay', 'days', 'reminders'].includes(k) ? 'center' : undefined })), rows: grid, footer: `${biz} · please make the purchase orders` }) });
  return out;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function mailBody(r, list, n) {
  const biz = store.db.settings.businessName, oldest = Math.max(0, ...list.map(p => p.days));
  const intro = r.message || (n > 1 ? 'This is a reminder: the DCs below were dispatched but we still have not received a Purchase Order. Kindly make the purchase orders and send the PO numbers to us.' : 'The DCs below have been dispatched, but there is no Purchase Order for them yet. Kindly make the purchase orders and send the PO numbers to us.');
  const text = `${intro}\n\n${list.length} DC(s) without PO (oldest waiting ${oldest} day(s)):\n${list.slice(0, 60).map(p => `DC ${p.dc} · Branch ${p.branch} · ${p.address} · waiting ${p.days}d`).join('\n')}${list.length > 60 ? `\n... and ${list.length - 60} more (see the attached file)` : ''}\n\nThe full list is attached.\n\n— ${biz}`;
  const th = 'padding:6px 8px;text-align:left;background:#0f766e;color:#fff;font-size:12px', td = 'padding:6px 8px;border-top:1px solid #e4e9e7;font-size:13px';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:760px;color:#10201d"><div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">${n > 1 ? `Reminder #${n}: ` : ''}Kindly make the Purchase Orders</div>
  <div style="border:1px solid #e4e9e7;border-top:0;padding:20px;border-radius:0 0 12px 12px"><p style="margin:0 0 14px;white-space:pre-wrap">${esc(intro)}</p>
  <p style="margin:0 0 10px;font-size:26px;font-weight:800">${list.length} <span style="font-size:14px;font-weight:500;color:#5b6b67">DC${list.length === 1 ? '' : 's'} dispatched without a PO · oldest waiting ${oldest} day${oldest === 1 ? '' : 's'}</span></p>
  <table style="border-collapse:collapse;width:100%"><tr><th style="${th}">DC</th><th style="${th}">Branch</th><th style="${th}">Address</th><th style="${th}">Req / P.R</th><th style="${th}">Days</th></tr>${list.slice(0, 40).map(p => `<tr><td style="${td}">${esc(p.dc)}</td><td style="${td}">${esc(p.branch)}</td><td style="${td}">${esc(p.address)}</td><td style="${td}">${esc(p.req)}</td><td style="${td}">${p.days}</td></tr>`).join('')}</table>
  ${list.length > 40 ? `<p style="color:#5b6b67;font-size:13px">… and ${list.length - 40} more. The complete list is in the attached PDF and Excel file.</p>` : ''}
  <p style="margin:16px 0 0;color:#8a9893;font-size:12px">Sent automatically by ${esc(biz)}. You will keep receiving this reminder until a PO is entered for every DC.</p></div></div>`;
  return { text, html };
}

// ---------- the mail of ONE DC: its DC copy + its quotation attached ----------
function dcMail(r, p, n, docs) {
  const biz = store.db.settings.businessName, esc2 = esc;
  const intro = (r && r.message) || (n > 1 ? 'This is a reminder: the DC below was dispatched but we still have not received a Purchase Order. Kindly make the purchase order and send us the PO number.' : 'The DC below has been dispatched, but there is no Purchase Order for it yet. Kindly make the purchase order and send us the PO number. The DC copy and quotation are attached.');
  const rows = [['DC no', p.dc], ['Branch code', p.branch], ['Branch address', p.address], ['Req / P.R no', p.req], ['Dispatched', fmtDay(p.dispatchDay)], ['Waiting', `${p.days} day${p.days === 1 ? '' : 's'}`], ['Company', p.company]].filter(x => x[1]);
  const att = docs.length ? docs.map(d => d.filename).join(', ') : 'none (no DC / quotation file is stored for this DC)';
  const text = `${intro}\n\n${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}\n\nAttached: ${att}\n\n— ${biz}`;
  const td = 'padding:6px 10px;border-top:1px solid #e4e9e7;font-size:13.5px';
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;color:#10201d"><div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">${n > 1 ? `Reminder #${n}: ` : ''}PO needed for DC ${esc2(p.dc)}</div>
  <div style="border:1px solid #e4e9e7;border-top:0;padding:20px;border-radius:0 0 12px 12px"><p style="margin:0 0 14px;white-space:pre-wrap">${esc2(intro)}</p>
  <table style="border-collapse:collapse;width:100%">${rows.map(([l, v]) => `<tr><td style="${td};font-weight:700;width:150px;color:#5b6b67">${esc2(l)}</td><td style="${td}">${esc2(v)}</td></tr>`).join('')}</table>
  <p style="margin:14px 0 0;font-size:13px">📎 <b>Attached:</b> ${esc2(att)}</p>
  <p style="margin:12px 0 0;color:#8a9893;font-size:12px">Sent by ${esc2(biz)}.${r ? ' You will keep receiving this reminder until the PO is entered.' : ''}</p></div></div>`;
  return { text, html };
}
// Sends the mail of one DC. r = the reminder rule (or null for a hand-made mail with to / cc).
async function sendDc(p, { r, to, cc, note, fetchMissing = true } = {}) {
  const docs = await dcdocs.attachments(p.key, { fetchMissing });
  const n = (p.reminders || 0) + 1, rcpt = to || (r && r.recipients) || [];
  if (!rcpt.length) throw new Error('Add the email of the person who makes the PO.');
  const subject = ((r && r.subject && r.mode !== 'both') ? r.subject : (n > 1 ? 'Reminder #{n}: PO needed for DC {dc} - {branch}' : 'Kindly make the PO for DC {dc} - {branch}')).replace('{n}', n).replace('{count}', 1).replace('{date}', today()).replace('{dc}', p.dc).replace('{branch}', p.branch);
  const { text, html } = dcMail(note ? { message: note } : r, p, n, docs);
  await reports.sendMail({ to: rcpt, cc: cc || (r && r.cc) || [], subject, text, html, attachments: docs.map(({ filename, type, content }) => ({ filename, type, content })) });
  const sn = seen()[p.key]; if (sn) { sn.reminders = (sn.reminders || 0) + 1; sn.last = Date.now(); } bust(); store.save();
  return { docs: docs.length };
}
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

async function run(r, { manual } = {}) {
  const list = pending(r.companies).filter(p => p.days >= (r.minDays || 0));
  if (!list.length) { r.lastRun = { ts: Date.now(), ok: true, count: 0, note: 'Nothing to send: every dispatched DC has a PO.' }; if (!manual) r.lastRunDay = today(); store.save(); return r.lastRun; }
  const mode = r.mode || 'list', notes = []; let sent = 0, failed = 0, noDocs = 0, skipped = 0, firstErr = '';
  try {
    if (mode === 'list' || mode === 'both') {
      const n = Math.max(...list.map(p => p.reminders)) + 1;
      const subject = (r.subject || (n > 1 ? 'Reminder #{n}: {count} DC(s) dispatched without PO - kindly make the purchase order' : 'Kindly make the purchase order - {count} DC(s) dispatched without PO')).replace('{n}', n).replace('{count}', list.length).replace('{date}', today());
      const { text, html } = mailBody(r, list, n);
      await reports.sendMail({ to: r.recipients, cc: r.cc || [], subject, text, html, attachments: files(list, r, r.name) });
      sent++;
      if (mode === 'list') { for (const p of list) { const sn = seen()[p.key]; if (sn) { sn.reminders = (sn.reminders || 0) + 1; sn.last = Date.now(); } } notes.push(`list of ${list.length} DC${list.length === 1 ? '' : 's'}`); }
    }
    if (mode === 'each' || mode === 'both') {
      const todo = list.slice(0, 60); // one mail per DC; at most 60 per run so the mail account is not flooded (the rest go in the next run)
      for (const p of todo) {
        if (r.skipNoDocs) { const c = dcdocs.count(p.key); if (!c.dc && !c.quote) { try { await dcdocs.autoFetch(p.key, 'ERP'); } catch { /* none */ } const c2 = dcdocs.count(p.key); if (!c2.dc && !c2.quote) { skipped++; continue; } } }
        try { const x = await sendDc(p, { r, fetchMissing: true }); sent++; if (!x.docs) noDocs++; }
        catch (e) { failed++; firstErr = firstErr || e.message; if (/refused the login|Set up the email/i.test(e.message)) break; }
        await sleep(250);
      }
      notes.push(`${todo.length - failed - skipped} DC mail${todo.length - failed - skipped === 1 ? '' : 's'}`);
      if (list.length > todo.length) notes.push(`${list.length - todo.length} more next time`);
    }
    if (sent === 0 && failed) throw new Error(firstErr);
    r.lastSentAt = Date.now(); r.sentToday = (r.lastRunDay === today() ? r.sentToday : 0) + 1;
    r.lastRun = { ts: r.lastSentAt, ok: !failed, count: list.length, note: `Sent: ${notes.join(', ')}${noDocs ? ` · ${noDocs} without DC / quotation file` : ''}${skipped ? ` · ${skipped} skipped (no documents)` : ''}${failed ? ` · ${failed} failed: ${firstErr}` : ''}` };
  } catch (e) { r.lastRun = { ts: Date.now(), ok: false, count: list.length, note: e.message }; }
  r.lastRunDay = today(); bust(); store.save();
  if (!r.lastRun.ok && !sent) throw new Error(r.lastRun.note);
  return r.lastRun;
}

const mins = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
let timer;
function tick() {
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  for (const r of rules()) {
    if (!r.enabled || !r.days.includes(now.getDay())) continue;
    const start = mins(r.time), end = Math.max(mins(r.untilTime), start + 90);
    if (m < start || m > end) continue;
    const sentToday = r.lastRunDay === today(now);
    const due = !sentToday || (r.repeatHours > 0 && Date.now() - (r.lastSentAt || 0) >= r.repeatHours * 3600e3);
    if (due) run(r).catch(e => console.error(`PO reminder "${r.name}" failed:`, e.message));
  }
}
function start() { clearInterval(timer); timer = setInterval(tick, 30000); setTimeout(tick, 5000); }

module.exports = { bust, sendDc, pending, addPo, removePo, rules, added, clean, run, files, start, hasNoPo };
