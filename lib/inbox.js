// Shared email inbox, fully integrated with Gmail (IMAP + Gmail extensions), several mailboxes at once.
// Gmail mode reads "All Mail" so every label is visible; read/unread, star, Done (= archive) and labels are written back to Gmail.
// Non-Gmail servers fall back to the INBOX with read/star sync only.
const fs = require('fs'), path = require('path');
const store = require('./store'), imap = require('./imap'), mailer = require('./mailer'), bot = require('./bot'), cfg = require('./config'), signature = require('./signature');

const FILES = () => path.join(path.dirname(cfg.dataFile), 'mail');
const norm = s => String(s || '').toLowerCase();
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isGm = a => typeof a.gmail === 'boolean' ? a.gmail : /gmail|googlemail/i.test(a.host);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function newAcc(x) {
  return { id: 'acc_' + rid(), label: '', host: 'imap.gmail.com', port: 993, user: '', pass: '', smtpHost: 'smtp.gmail.com', smtpPort: 587, fromName: '', enabled: true, minutes: 2, days: 14, orgId: '', uidv: 0, lastUid: 0, lastSync: 0, lastError: '', ...x };
}
function box() {
  const b = (store.db.inbox = store.db.inbox || {}); b.accounts = b.accounts || []; b.threads = b.threads || []; b.mails = b.mails || [];
  if (b.user && !b.accounts.length) { // migrate the earlier single-mailbox version
    const a = newAcc({ ...Object.fromEntries(['user', 'pass', 'host', 'port', 'smtpHost', 'smtpPort', 'fromName', 'minutes', 'days', 'enabled'].map(k => [k, b[k]]).filter(([, v]) => v !== undefined)), label: b.user });
    b.accounts.push(a); b.threads.forEach(t => { t.accountId = a.id; t.labels = t.labels || []; }); b.mails.forEach(m => { m.accountId = a.id; m.seen = true; m.labels = m.labels || []; });
    for (const k of ['user', 'pass', 'host', 'port', 'smtpHost', 'smtpPort', 'fromName', 'minutes', 'days', 'enabled', 'lastUid', 'lastSync', 'lastError']) delete b[k];
    store.save();
  }
  return b;
}
// ---------- routing rules: sender domain / address -> person (optionally per mailbox) ----------
const rules = () => (box().rules = box().rules || []);
const pats = r => String(r.pattern || '').split(/[\s,;]+/).map(x => norm(x).replace(/^\*?@?/, m => m).trim()).filter(Boolean);
function ruleOwner(accountId, email) {
  const from = norm(email), dom = from.split('@')[1] || '';
  for (const r of rules()) {
    if (r.accountId && r.accountId !== accountId) continue;
    const a = bot.agentById(r.agentId); if (!a || !a.active) continue;
    for (const p0 of pats(r)) { const p = p0.replace(/^\*/, ''); if (p.includes('@') && !p.startsWith('@') ? from === p : (dom === p.replace(/^@/, '') || dom.endsWith('.' + p.replace(/^@/, '')))) return a; }
  }
  return null;
}
const acct = id => box().accounts.find(a => a.id === id);
let quiet = false; // true while old mail is being loaded: the screen updates but shows no "New email" popups
const emit = t => bot.bus.emit('event', { type: 'mail', thread: view(t), quiet });
// Gmail sorts by the time a mail ARRIVED (INTERNALDATE), not by the Date header the sender wrote (which can be hours off or in the future).
const mkey = m => Math.min(m.idate || m.date || 0, Date.now() + 300000);
const mailsOf = t => box().mails.filter(m => m.threadId === t.id).sort((x, y) => mkey(x) - mkey(y));

// ---------- routing ----------
function matchOrg(email, subject) {
  const from = norm(email), dom = from.split('@')[1] || '';
  for (const o of store.db.organizations) for (const e of (o.emails || []).map(norm).filter(Boolean)) {
    const d = e.replace(/^@/, ''); if (e.includes('@') ? from === e : dom === d || dom.endsWith('.' + d)) return o;
  }
  const subj = norm(subject);
  return store.db.organizations.find(o => [o.name, ...(o.aliases || [])].some(n => norm(n).length >= 3 && subj.includes(norm(n)))) || null;
}
const ownerOf = o => { if (!o) return null; for (const id of [o.agentId, o.backupAgentId]) { const a = bot.agentById(id); if (a && a.active) return a; } return null; };

// ---------- who should get this mail? (sender, then CC / To, then the original sender inside a forwarded mail) ----------
// Your own company's addresses ("internal") are skipped: if a colleague forwards or CCs a client's mail to you,
// the client (or the person in CC) decides who handles it.
const internal = () => (box().internal = box().internal || []);
const setInternal = list => { box().internal = [...new Set((Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/)).map(x => norm(x).replace(/^\*?@?/, '')).filter(Boolean))]; store.save(); return internal(); };
function isInternal(email) {
  const e = norm(email), dom = e.split('@')[1] || ''; if (!e) return true;
  if (box().accounts.some(a => norm(a.user) === e)) return true; // our own mailboxes
  return internal().some(p => p.includes('@') ? e === p : dom === p || dom.endsWith('.' + p));
}
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
function forwardedFrom(text) { // "From: Name <a@b.com>" lines of a forwarded / quoted original
  const out = []; for (const line of String(text || '').slice(0, 60000).split('\n')) { const m = line.match(/^\W*(?:from|de|von)\s*:\s*(.+)$/i); if (m) (m[1].match(EMAIL_RE) || []).forEach(e => out.push(norm(e))); if (out.length >= 10) break; }
  return out;
}
function candidates(m, out) {
  const list = out ? [...m.to, ...m.cc].map(x => x.email) : [m.from.email, ...(m.replyTo ? [m.replyTo] : []), ...m.to.map(x => x.email), ...m.cc.map(x => x.email), ...forwardedFrom(m.text)];
  return [...new Set(list.map(norm).filter(e => e && !box().accounts.some(a => norm(a.user) === e)))]; // never our own mailboxes
}
function routeMail(a, m, out) {
  const dedicated = a.orgId && store.db.organizations.find(o => o.id === a.orgId);
  for (const c of candidates(m, out)) {
    const mine = isInternal(c); // colleagues: only an explicit rule counts, never the company match
    const o = ruleOwner(a.id, c); if (o) return { org: dedicated || (mine ? null : matchOrg(c, '')), owner: o, via: c };
    if (mine) continue;
    const org = dedicated || matchOrg(c, ''); const own = ownerOf(org); if (own) return { org, owner: own, via: c };
  }
  const org = dedicated || matchOrg('', m.subject); return { org, owner: ownerOf(org), via: '' };
}

// ---------- html bodies ----------
function cleanHtml(h, files) {
  h = h.replace(/cid:([^"'\s)>]+)/gi, (m, id) => { const f = files.find(x => x.cid === id && x.size < 3e6); return f ? `data:${f.type};base64,${f.data.toString('base64')}` : m; });
  return h.replace(/<(script|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?(script|iframe|object|embed|base|link|meta|form|input|button)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, 'blocked:');
}

// ---------- state helpers ----------
function applyMeta(m, uid, x) {
  if (m.pend && Date.now() < m.pend && m.uid === uid) return false; // you just changed this here; Gmail is still being updated, so don't let a stale poll undo it
  const seen = /\\Seen/.test(x.flags), flagged = /\\Flagged/.test(x.flags), labels = x.labels || [];
  const changed = m.uid !== uid || m.seen !== seen || m.flagged !== flagged || (m.labels || []).join('|') !== labels.join('|');
  m.uid = uid; m.seen = seen; m.flagged = flagged; m.labels = labels; if (x.thrid) m.thrid = x.thrid; return changed;
}
function recompute(t) {
  const ms = mailsOf(t), a = acct(t.accountId);
  t.count = ms.length; t.unread = ms.filter(m => !m.seen).length; t.starred = ms.some(m => m.flagged); t.sent = ms.some(m => m.dir === 'out'); t.important = ms.some(m => (m.labels || []).includes('\\Important')); t.hasFiles = ms.some(m => (m.files || []).length);
  t.labels = [...new Set(ms.flatMap(m => m.labels || []).filter(l => !l.startsWith('\\')))];
  if (a && isGm(a) && ms.some(m => m.uid)) t.status = ms.some(m => (m.labels || []).includes('\\Inbox')) ? 'open' : 'resolved';
  const last = ms[ms.length - 1]; if (last) { t.updatedAt = mkey(last); t.snippet = last.text.replace(/\s+/g, ' ').slice(0, 120); }
}
// bulk loading of old mail: the screen updates but nobody gets "New email" pop-ups (the flag is only set while ingest runs, never across an await)
function ingestQuiet(a, uid, x, m) { quiet = true; try { return ingest(a, uid, x, m); } finally { quiet = false; } }
function ingest(a, uid, x, m) {
  const b = box(), labels = x.labels || []; if (labels.includes('\\Draft')) return false;
  const out = labels.includes('\\Sent') || m.from.email === norm(a.user);
  const ex = m.messageId && b.mails.find(y => y.accountId === a.id && y.messageId === m.messageId);
  if (ex) { if (!ex.idate && x.idate) ex.idate = x.idate; applyMeta(ex, uid, x); const t = b.threads.find(y => y.id === ex.threadId); if (t) { recompute(t); emit(t); } return false; }
  const refs = (m.inReplyTo + ' ' + m.references).split(/\s+/).filter(Boolean);
  const prev = b.mails.find(y => y.accountId === a.id && ((x.thrid && y.thrid === x.thrid) || (y.messageId && refs.includes(y.messageId))));
  let t = prev && b.threads.find(y => y.id === prev.threadId); const id = rid();
  if (!t) {
    const other = out ? (m.to[0] || { email: '', name: '' }) : m.from;
    const r0 = routeMail(a, m, out), org = r0.org, owner = r0.owner;
    t = { id: 't' + id, accountId: a.id, thrid: x.thrid || '', subject: m.subject.replace(/^((re|fw|fwd):\s*)+/i, ''), orgId: org ? org.id : '', agentId: owner ? owner.id : '', via: r0.via && r0.via !== norm(other.email) ? r0.via : '', status: 'open', starred: false, unread: 0, updatedAt: 0, who: other.name || other.email, whoEmail: other.email, snippet: '', count: 0, labels: [] };
    b.threads.push(t);
  }
  const files = m.files.slice(0, 20).map((f, i) => { if (f.size > 15e6) return null; fs.mkdirSync(path.join(FILES(), id), { recursive: true }); fs.writeFileSync(path.join(FILES(), id, String(i)), f.data); return { i, name: f.name, type: f.type, size: f.size, inline: !!f.cid && f.name === 'inline-image' }; }).filter(Boolean);
  let hasHtml = false;
  if (m.html && m.html.length < 6e5) { fs.mkdirSync(path.join(FILES(), id), { recursive: true }); fs.writeFileSync(path.join(FILES(), id, 'body.html'), cleanHtml(m.html, m.files)); hasHtml = true; }
  const rec = { id, threadId: t.id, accountId: a.id, thrid: x.thrid || '', uid, dir: out ? 'out' : 'in', from: m.from, to: m.to, cc: m.cc, replyTo: m.replyTo, subject: m.subject, text: m.text.slice(0, quiet ? 40000 : 100000), date: m.date, idate: x.idate || 0, messageId: m.messageId, references: m.references, files: files.filter(f => !f.inline), hasHtml };
  applyMeta(rec, uid, x); b.mails.push(rec); recompute(t); if (!quiet && !out) t.newAt = Date.now(); emit(t); return true; // newAt: the screen flashes it and keeps it on top
}

// ---------- sync with Gmail ----------
const busy = new Set();
const userLabels = boxes => boxes.filter(f => !/\\Noselect/i.test(f.flags) && f.label && !/^(INBOX$|\[)/i.test(f.label)).map(f => f.label).sort((x, y) => x.localeCompare(y));
async function folderOf(c, a, lite) {
  if (!isGm(a)) return 'INBOX';
  if (lite && a.allMail) return a.allMail; // pushing a change: no need to list every label again
  const boxes = await c.list(); a.gmLabels = userLabels(boxes); // every label that exists in Gmail, even with no mail in it yet
  return (a.allMail = (boxes.find(f => /\\All\b/i.test(f.flags)) || { name: '[Gmail]/All Mail' }).name);
}
const lastFull = new Map();
// Loads ALL the older mail of the mailbox (not only the first few days), newest first, in the background on its own connection,
// several mails per round trip, so it never delays the 10-second check for new mail.
const backList = new Map(), backRunning = new Set();
const progress = a => ({ type: 'mailprog', accountId: a.id, left: a.backDone ? 0 : (a.backLeft || 0), total: a.backTotal || 0, done: !!a.backDone });
const emitProgress = a => bot.bus.emit('event', progress(a));
async function backfillRun(a, budgetMs) {
  if (a.loadAll === false || a.backDone || backRunning.has(a.id)) return;
  backRunning.add(a.id); const deadline = Date.now() + budgetMs; let c;
  try {
    c = await imap.connect(a); const gm = isGm(a), sel = await c.select(await folderOf(c, a, true));
    if (a.uidv && sel.uidv && a.uidv !== sel.uidv) return; // the sync resets everything on its next round
    if (!a.backUid) { const us = box().mails.filter(m => m.accountId === a.id && m.uid).map(m => m.uid); a.backUid = us.length ? Math.min(...us) : a.lastUid || 0; }
    if (a.backUid <= 1) { a.backDone = true; a.backLeft = 0; emitProgress(a); return; }
    let list = backList.get(a.id);
    if (!list) {
      const have = new Set(box().mails.filter(m => m.accountId === a.id && m.uid).map(m => m.uid));
      list = (await c.search(`UID 1:${a.backUid - 1}`)).filter(u => !have.has(u)).sort((x, y) => y - x); backList.set(a.id, list);
      a.backTotal = list.length + box().mails.filter(m => m.accountId === a.id).length;
    }
    while (list.length && Date.now() < deadline && a.loadAll !== false) {
      const todo = list.slice(0, 60), metas = new Map((await c.meta(todo.join(','), gm)).map(x => [x.uid, x]));
      for (let k = 0; k < todo.length; k += 8) {
        const part = todo.slice(k, k + 8), raws = await c.fetchMany(part.filter(u => metas.has(u)));
        for (const uid of part) { const raw = raws.get(uid); if (raw) { try { ingestQuiet(a, uid, metas.get(uid), imap.parseMail(raw)); } catch (e) { console.error('mail backfill:', e.message); } } }
      }
      list.splice(0, todo.length); a.backUid = Math.min(a.backUid, ...todo); a.backLeft = list.length; store.save(); emitProgress(a);
    }
    if (!list.length) { a.backDone = true; a.backLeft = 0; backList.delete(a.id); store.save(); emitProgress(a); }
  } catch (e) { console.error('mail backfill:', e.message); a.backError = e.message; }
  finally { backRunning.delete(a.id); if (c) c.close(); }
}
async function syncAccount(a, opt = {}) {
  const b = box(); if (busy.has(a.id)) return { added: 0 }; if (!a.user || !a.pass) throw new Error('Set up the mailbox first.');
  busy.add(a.id); let c, added = 0; const fresh = [], firstSync = !a.lastUid;
  try {
    c = await imap.connect(a); const gm = isGm(a), sel = await c.select(await folderOf(c, a));
    if (a.uidv && sel.uidv && a.uidv !== sel.uidv) { a.lastUid = 0; a.backUid = 0; a.backDone = false; backList.delete(a.id); if (a.loadAll !== false) a.backLeft = 0; b.mails.forEach(m => { if (m.accountId === a.id) m.uid = null; }); }
    a.uidv = sel.uidv; const since = new Date(Date.now() - a.days * 864e5);
    const uids = (a.lastUid ? (await c.search(`UID ${a.lastUid + 1}:*`)).filter(u => u > a.lastUid) : await c.search(`SINCE ${since.getDate()}-${MON[since.getMonth()]}-${since.getFullYear()}`)).sort((x, y) => x - y);
    const todo = firstSync ? uids.slice(-60) : uids.slice(0, 60), metas = new Map(todo.length ? (await c.meta(todo.join(','), gm)).map(x => [x.uid, x]) : []);
    for (const uid of todo) {
      const x = metas.get(uid), raw = x && await c.fetch(uid); if (raw && ingest(a, uid, x, imap.parseMail(raw))) { added++; fresh.push(b.mails[b.mails.length - 1]); }
      a.lastUid = uid; if (firstSync && (!a.backUid || uid < a.backUid)) a.backUid = uid; store.save();
    }
    // bring read / star / label / archive / delete changes made in Gmail into the app
    // (the cheap 10-second poll only looks for new mail; flag/label changes are reconciled every 30 seconds)
    const full = !opt.quick || Date.now() - (lastFull.get(a.id) || 0) >= 30000; if (full) lastFull.set(a.id, Date.now());
    const known = full ? b.mails.filter(m => m.accountId === a.id && m.uid && m.date >= since.getTime() - 864e5) : [];
    if (known.length) {
      const by = new Map((await c.meta(`${Math.min(...known.map(m => m.uid))}:*`, gm)).map(x => [x.uid, x])), touched = new Set(), changed = new Set();
      for (const m of known) { const x = by.get(m.uid); if (!x && (b.threads.find(y => y.id === m.threadId) || {}).trashed) continue; if (!x) { b.mails = b.mails.filter(y => y !== m); fs.rmSync(path.join(FILES(), m.id), { recursive: true, force: true }); touched.add(m.threadId); changed.add(m.threadId); } else if (applyMeta(m, m.uid, x)) { touched.add(m.threadId); changed.add(m.threadId); } }
      for (const id of changed) { const t = b.threads.find(y => y.id === id); if (!t) continue; if (!mailsOf(t).length) b.threads = b.threads.filter(y => y !== t); else { recompute(t); emit(t); } }
    }
    a.lastError = '';
    if (fresh.length && !firstSync) await runFilters(fresh).catch(e => console.error('mail filters:', e.message)); // team members' filters (like Gmail's)
  } catch (e) { a.lastError = e.message; throw e; }
  finally { busy.delete(a.id); a.lastSync = Date.now(); if (c) c.close(); store.save(); }
  return { added };
}
async function sync(id) {
  const list = id ? [acct(id)].filter(Boolean) : box().accounts.filter(a => a.enabled); let added = 0, err = '';
  if (!list.length) throw new Error('Add a mailbox first.');
  for (const a of list) { try { added += (await syncAccount(a)).added; } catch (e) { err = `${a.user}: ${e.message}`; } }
  if (err && !added && list.length === 1) throw new Error(err.replace(/^[^:]*: /, '')); return { added, error: err };
}
const POLL_MS = 10000; // new mail is fetched automatically every 10 seconds
const failedAt = new Map();
function start() {
  setInterval(() => runScheduled().catch(() => {}), 20000);
  setInterval(() => { for (const a of box().accounts) if (a.enabled && a.user && a.pass && a.lastUid && !a.backDone && a.loadAll !== false && !backRunning.has(a.id) && Date.now() - (failedAt.get('b' + a.id) || 0) >= 60000) backfillRun(a, 55000).then(() => { if (a.backError) { failedAt.set('b' + a.id, Date.now()); a.backError = ''; } }); }, 3000);
  setInterval(() => {
    for (const a of box().accounts) {
      if (!a.enabled || !a.user || !a.pass || busy.has(a.id)) continue;
      if (a.lastError && Date.now() - (failedAt.get(a.id) || 0) < 60000) continue; // back off for a minute after an error (e.g. wrong password)
      syncAccount(a, { quick: true }).then(() => failedAt.delete(a.id)).catch(() => failedAt.set(a.id, Date.now()));
    }
  }, POLL_MS);
}

// ---------- search like Gmail ----------
// 1) "local": instant, runs over every mail already loaded here with the same operators Gmail has (lib/search.js).
// 2) "gmail": Gmail itself runs the query (X-GM-RAW) over ALL mail, every hit that is not loaded yet is fetched, so nothing is missed.
const searchLib = require('./search');
function gmailQuery(q) {
  return String(q || '').replace(/\bin:(bin)\b/gi, 'in:trash').replace(/\bin:(done|archive[d]?)\b/gi, '-in:inbox').replace(/\bis:(done|archived)\b/gi, '-in:inbox')
    .replace(/\bin:star(?:red)?\b/gi, 'is:starred').replace(/\bin:all\b/gi, 'in:anywhere').replace(/\b(?:org|assigned):\S+/gi, '').trim();
}
function localSearch(me, q, accId) {
  const by = new Map(); for (const m of box().mails) { const l = by.get(m.threadId); if (l) l.push(m); else by.set(m.threadId, [m]); }
  const accU = new Map(box().accounts.map(a => [a.id, norm(a.user)]));
  const threads = box().threads.filter(t => canSee(t, me) && (!accId || t.accountId === accId)).map(t => ({ t: forViewer(t, me), ms: by.get(t.id) || [] }));
  return searchLib.run(q, threads, { userOf: m => accU.get(m.accountId) || '', labelsOf: t => t.labels || [], orgName: t => (store.db.organizations.find(o => o.id === t.orgId) || {}).name || '' }).map(t => t.id);
}
const searchCache = new Map(); // account + query -> { uids, at }: the same search is not repeated while the rest of its hits are still loading
async function remoteSearch(me, q, accId, mode) {
  q = String(q || '').trim(); if (!q) return { ids: [], total: 0 };
  const local = localSearch(me, q, accId);
  if (mode === 'local') return { ids: local, total: local.length, local: true };
  const raw = gmailQuery(q), sc = searchLib.scope(searchLib.parse(q)), ids = new Set(); let loadedNow = 0, pending = 0, hits = 0, err = '';
  const accs = box().accounts.filter(x => x.enabled && x.user && x.pass && isGm(x) && (!accId || x.id === accId));
  if (!accs.length || !raw) return { ids: local, total: local.length, local: true };
  const started = Date.now();
  for (const a of accs) {
    let c; try {
      const ck = a.id + '|' + raw; let hit = searchCache.get(ck); c = await imap.connect(a); await c.select(await folderOf(c, a));
      if (!hit || Date.now() - hit.at > 120000) { hit = { uids: (/[^\x20-\x7e]/.test(raw) ? await c.rawSearch(raw) : await c.search('X-GM-RAW "' + raw.replace(/([\\"])/g, '\\$1') + '"')).sort((x, y) => y - x), at: Date.now() }; searchCache.set(ck, hit); if (searchCache.size > 40) searchCache.delete(searchCache.keys().next().value); }
      const uids = hit.uids.slice(0, 5000); hits += uids.length;
      const have = new Set(box().mails.filter(m => m.accountId === a.id && m.uid).map(m => m.uid)), missing = uids.filter(u => !have.has(u));
      for (let k = 0; k < missing.length && Date.now() - started < 20000; k += 40) { // fetch the hits that are not loaded yet, newest first, several per round trip
        const part = missing.slice(k, k + 40), metas = new Map((await c.meta(part.join(','), true)).map(x => [x.uid, x]));
        for (let j = 0; j < part.length; j += 8) { const sub = part.slice(j, j + 8), raws = await c.fetchMany(sub.filter(u => metas.has(u))); for (const uid of sub) { const body = raws.get(uid); if (body) try { if (ingestQuiet(a, uid, metas.get(uid), imap.parseMail(body))) loadedNow++; } catch {} } }
        store.save();
      }
      const byUid = new Map(box().mails.filter(m => m.accountId === a.id && m.uid).map(m => [m.uid, m]));
      for (const u of uids) { const m = byUid.get(u); if (m) { const t = box().threads.find(y => y.id === m.threadId); if (t && canSee(t, me)) ids.add(t.id); } else pending++; }
    } catch (e) { err = e.message; }
    finally { try { c && c.close(); } catch {} }
  }
  if (err && !ids.size) return { ids: local, total: local.length, local: true, error: err };
  // the Bin and Spam are not part of Gmail's "All Mail", so those hits come from what is stored here
  if (sc.trash || sc.spam) for (const id of local) { const t = box().threads.find(y => y.id === id); if (t && (t.trashed || t.spam)) ids.add(id); }
  return { ids: [...ids], total: ids.size, loaded: loadedNow, pending, hits, error: err };
}

// ---------- reading ----------
const view = (t, ms = mailsOf(t)) => {
  const atts = []; let attTotal = 0; // attachments of the newest mails first, so the list can show Gmail-style chips
  if (ms.some(m => (m.files || []).length)) for (const m of [...ms].sort((x, y) => y.date - x.date)) for (const f of m.files || []) { attTotal++; if (atts.length < 12) atts.push({ mid: m.id, i: f.i, name: f.name, type: f.type, size: f.size }); }
  return { ...t, atts, attTotal, size: ms.reduce((n, m) => n + (m.text || '').length + (m.files || []).reduce((k, f) => k + (f.size || 0), 0), 0), sent: ms.some(m => m.dir === 'out'), hasFiles: attTotal > 0, orgName: (store.db.organizations.find(o => o.id === t.orgId) || {}).name || '', accountLabel: (acct(t.accountId) || {}).label || '' }; };
const canSee = (t, me) => me.role === 'admin' || t.agentId === me.id || (t.sharedWith || []).includes(me.id);
const list = me => { // group the mails by conversation once (instead of re-scanning every mail for every conversation)
  const by = new Map(); for (const m of box().mails) { const l = by.get(m.threadId); if (l) l.push(m); else by.set(m.threadId, [m]); }
  return box().threads.filter(t => canSee(t, me)).sort((a, b) => b.updatedAt - a.updatedAt).map(t => forViewer(view(t, by.get(t.id) || []), me));
};
const get = (id, me) => { const t = box().threads.find(x => x.id === id); return t && canSee(t, me) ? t : null; };
const messages = t => mailsOf(t).map(m => { if (m.sentHtml) return { ...m, html: m.sentHtml }; if (!m.hasHtml) return m; try { return { ...m, html: fs.readFileSync(path.join(FILES(), m.id, 'body.html'), 'utf8') }; } catch { return m; } });
function file(mailId, i, me) {
  const m = box().mails.find(x => x.id === mailId), t = m && get(m.threadId, me), f = t && m.files.find(x => x.i === +i);
  return f ? { ...f, path: path.join(FILES(), m.id, String(f.i)) } : null;
}

// ---------- changes written back to Gmail ----------
const kept = new Map(), pushQ = new Map(); // mailbox id -> { c, timer } (open connection) / queue of changes
async function getConn(a) {
  const k = kept.get(a.id); if (k && k.c.alive()) { clearTimeout(k.timer); return k; }
  const c = await imap.connect(a); await c.select(await folderOf(c, a, true)); const n = { c, timer: 0 }; kept.set(a.id, n); return n;
}
function freeConn(a, k, bad) {
  clearTimeout(k.timer); if (bad) { try { k.c.close(); } catch {} if (kept.get(a.id) === k) kept.delete(a.id); return; }
  k.timer = setTimeout(() => { try { k.c.close(); } catch {} if (kept.get(a.id) === k) kept.delete(a.id); }, 90000); // keep it open for 90 s so the next click is instant
}
async function pushOnce(a, ops) {
  const k = await getConn(a); try { const gm = isGm(a); for (const [uids, item, vals, gmOnly] of ops) if (uids.length && (gm || !gmOnly)) for (let i = 0; i < uids.length; i += 100) await k.c.store(uids.slice(i, i + 100), item, vals); freeConn(a, k); } catch (e) { freeConn(a, k, true); throw e; }
}
function push(a, ops) {
  const p = (pushQ.get(a.id) || Promise.resolve()).catch(() => {}).then(() => pushOnce(a, ops).catch(() => pushOnce(a, ops))); // one retry on a fresh connection
  pushQ.set(a.id, p); return p;
}
async function act(t, me, action, body = {}, collect = null) {
  const a = acct(t.accountId), ms = mailsOf(t), uids = l => l.filter(m => m.uid).map(m => m.uid).slice(0, 40), ops = [];
  if (action !== 'assign' && action !== 'purge') ms.forEach(m => { m.pend = Date.now() + 60000; });
  const lastIn = [...ms].reverse().find(m => m.dir === 'in') || ms[ms.length - 1], lastOne = ms[ms.length - 1];
  if (action === 'read') { const l = ms.filter(m => !m.seen); l.forEach(m => m.seen = true); ops.push([uids(l), '+FLAGS', '\\Seen']); }
  else if (action === 'unread') { lastIn.seen = false; ops.push([uids([lastIn]), '-FLAGS', '\\Seen']); }
  else if (action === 'star') { if (t.starred) { const l = ms.filter(m => m.flagged); l.forEach(m => m.flagged = false); ops.push([uids(l), '-FLAGS', '\\Flagged']); } else { lastOne.flagged = true; ops.push([uids([lastOne]), '+FLAGS', '\\Flagged']); } }
  else if (action === 'resolve') { const l = ms.filter(m => (m.labels || []).includes('\\Inbox')); l.forEach(m => m.labels = m.labels.filter(x => x !== '\\Inbox')); t.status = 'resolved'; ops.push([uids(l), '-X-GM-LABELS', '\\Inbox', true]); }
  else if (action === 'reopen') { lastIn.labels = [...(lastIn.labels || []), '\\Inbox']; t.status = 'open'; ops.push([uids([lastIn]), '+X-GM-LABELS', '\\Inbox', true]); }
  else if (action === 'label' && usePriv(me)) { // the admin hid the Gmail labels: team members keep their own private labels (never written to Gmail)
    const name = cleanLabel(body.label), p = priv(me.id);
    if (body.add !== false) { if (!p.names.includes(name)) p.names.push(name); p.threads[t.id] = [...new Set([...(p.threads[t.id] || []), name])]; } else p.threads[t.id] = (p.threads[t.id] || []).filter(x => x !== name);
    if (!p.threads[t.id].length) delete p.threads[t.id];
  }
  else if (action === 'label') {
    const name = String(body.label || '').trim().replace(/["\\]/g, ''); if (!name || name.startsWith('\\')) throw new Error('Enter a label name');
    if (a && !isGm(a)) throw new Error('Labels need a Gmail mailbox');
    if (body.add !== false && me && me.role !== 'admin' && !perms().createLabels && !labelNames().has(name)) throw new Error('Only the admin can create new labels. Pick an existing one.');
    ms.forEach(m => { m.labels = body.add === false ? (m.labels || []).filter(x => x !== name) : [...new Set([...(m.labels || []), name])]; });
    ops.push([uids(ms), body.add === false ? '-X-GM-LABELS' : '+X-GM-LABELS', imap.qlabel(name), true]);
  } else if (action === 'important') { const on = !t.important; ms.forEach(m => { m.labels = on ? [...new Set([...(m.labels || []), '\\Important'])] : (m.labels || []).filter(x => x !== '\\Important'); }); ops.push([uids(ms), on ? '+X-GM-LABELS' : '-X-GM-LABELS', '\\Important', true]); }
  else if (action === 'trash') { t.trashed = true; t.trashedAt = Date.now(); ops.push([uids(ms), '+X-GM-LABELS', '\\Trash', true]); }
  else if (action === 'restore') { t.trashed = false; t.spam = false; ops.push([uids(ms), '-X-GM-LABELS', '\\Trash', true], [uids(ms), '-X-GM-LABELS', '\\Spam', true]); }
  else if (action === 'spam') { t.spam = true; t.trashed = false; ops.push([uids(ms), '+X-GM-LABELS', '\\Spam', true]); }
  else if (action === 'purge') { if (!t.trashed) throw new Error('Only conversations in the Bin can be deleted forever'); for (const m of ms) fs.rmSync(path.join(FILES(), m.id), { recursive: true, force: true }); box().mails = box().mails.filter(m => m.threadId !== t.id); box().threads = box().threads.filter(y => y !== t); store.save(); bot.bus.emit('event', { type: 'mail', thread: { ...view(t), gone: true } }); return {}; }
  else if (action === 'assign') { const x = bot.agentById(body.agentId); if (!x) throw new Error('Choose a team member'); t.agentId = x.id; t.manual = true; }
  recompute(t); if (action === 'resolve' && !(a && isGm(a))) t.status = 'resolved'; if (action === 'reopen' && !(a && isGm(a))) t.status = 'open';
  store.save(); emit(t);
  if (collect) { collect.push({ a, ops, ms }); return {}; }
  if (a && ops.some(o => o[0].length)) { // the screen already shows the change; Gmail is updated in the background (the user no longer waits for it)
    const mine = ms.slice();
    push(a, ops).then(() => { mine.forEach(m => { m.pend = Date.now() + 5000; }); store.save(); }).catch(e => { mine.forEach(m => { delete m.pend; }); console.error('Gmail update failed:', e.message); });
  } else ms.forEach(m => { delete m.pend; });
  return {};
}


// ---------- team permissions, labels and filters (like Gmail's "Create filter") ----------
// Each filter belongs to the person who made it and only touches conversations that are theirs
// (the admin's filters cover the admin's own and unassigned conversations). The admin's routing rules above are separate and unchanged.
const perms = () => ({ filters: true, createLabels: true, deleteLabels: false, showGmailLabels: true, ...(box().perms || {}) });
function setPerms(x = {}) { const b = box(); b.perms = { ...perms(), ...Object.fromEntries(['filters', 'createLabels', 'deleteLabels', 'showGmailLabels'].filter(k => x[k] !== undefined).map(k => [k, !!x[k]])) }; store.save(); return perms(); }
function labelNames(accountId) {
  const s = new Set();
  for (const a of box().accounts) if (!accountId || a.id === accountId) (a.gmLabels || []).forEach(l => s.add(l));
  for (const t of box().threads) if (!accountId || t.accountId === accountId) (t.labels || []).forEach(l => s.add(l));
  return s;
}
// Admin switch "Show the original Gmail labels to the team": when it is OFF, team members don't see the labels that already exist in Gmail;
// they make labels of their own (kept in the app, private to each person, never written to Gmail) and filter their mail with them.
const privRead = id => (box().plabels || {})[id] || { names: [], threads: {} };
const priv = id => { const p = (box().plabels = box().plabels || {}); p[id] = p[id] || { names: [], threads: {} }; return p[id]; };
const usePriv = me => !!me && me.role !== 'admin' && !perms().showGmailLabels;
const seesGmail = me => !me || me.role === 'admin' || perms().showGmailLabels;
function forViewer(v, me) { // the conversation as THIS person should see its labels
  if (!me) return v; const own = privRead(me.id).threads[v.id] || [];
  return seesGmail(me) && !own.length ? v : { ...v, labels: [...new Set([...(seesGmail(me) ? v.labels || [] : []), ...own])] };
}
const labelsFor = me => [...new Set([...(seesGmail(me) ? labelNames() : []), ...privRead(me.id).names])].sort((x, y) => x.localeCompare(y));
const cleanLabel = n => { n = String(n || '').trim().replace(/["\\]/g, ''); if (!n || n.startsWith('\\') || n.startsWith('[') || /^inbox$/i.test(n)) throw new Error('Enter a label name'); return n; };
async function createLabel(me, name, accountId) {
  name = cleanLabel(name);
  if (usePriv(me)) { const p = priv(me.id); if (!p.names.includes(name)) p.names.push(name); p.names.sort((x, y) => x.localeCompare(y)); store.save(); return { labels: labelsFor(me) }; }
  if (me.role !== 'admin' && !perms().createLabels) throw new Error('Only the admin can create labels.');
  const accs = box().accounts.filter(a => a.enabled && a.user && a.pass && isGm(a) && (!accountId || a.id === accountId)); if (!accs.length) throw new Error('Add a Gmail mailbox first.');
  for (const a of accs) {
    if ((a.gmLabels || []).includes(name)) continue;
    const c = await imap.connect(a); try { await c.create(name); } catch (e) { if (!/exist/i.test(e.message)) throw e; } finally { c.close(); }
    a.gmLabels = [...new Set([...(a.gmLabels || []), name])].sort((x, y) => x.localeCompare(y));
  }
  store.save(); return { labels: [...labelNames()].sort((x, y) => x.localeCompare(y)) };
}
async function deleteLabel(me, name) {
  name = cleanLabel(name);
  if (usePriv(me)) { const p = priv(me.id); p.names = p.names.filter(l => l !== name); const touched = Object.keys(p.threads).filter(id => p.threads[id].includes(name)); for (const id of touched) { p.threads[id] = p.threads[id].filter(l => l !== name); if (!p.threads[id].length) delete p.threads[id]; const t = box().threads.find(x => x.id === id); if (t) emit(t); } store.save(); return {}; }
  if (me.role !== 'admin' && !perms().deleteLabels) throw new Error('Only the admin can delete labels.');
  const b = box(); let err = '';
  for (const a of b.accounts.filter(x => x.enabled && x.user && x.pass && isGm(x) && (x.gmLabels || []).includes(name))) {
    try { const c = await imap.connect(a); try { await c.remove(name); } finally { c.close(); } a.gmLabels = a.gmLabels.filter(l => l !== name); } catch (e) { if (!/not exist|nonexistent/i.test(e.message)) err = e.message; else a.gmLabels = a.gmLabels.filter(l => l !== name); }
  }
  const touched = new Set(); for (const m of b.mails) if ((m.labels || []).includes(name)) { m.labels = m.labels.filter(l => l !== name); touched.add(m.threadId); }
  for (const id of touched) { const t = b.threads.find(x => x.id === id); if (t) { recompute(t); emit(t); } }
  store.save(); if (err) throw new Error('Removed here, but Gmail said: ' + err); return {};
}

const filters = () => (box().filters = box().filters || []);
function cleanCriteria(c = {}) {
  const o = {}; for (const k of ['from', 'to', 'subject', 'has', 'not']) { const v = String(c[k] || '').trim().slice(0, 300); if (v) o[k] = v; }
  if (+c.sizeBytes > 0 && ['gt', 'lt'].includes(c.sizeOp)) { o.sizeOp = c.sizeOp; o.sizeBytes = Math.round(+c.sizeBytes); }
  if (c.attach) o.attach = true;
  if (!Object.keys(o).length) throw new Error('Add at least one thing to match (From, To, Subject, words, size or attachment).');
  return o;
}
function cleanActions(x = {}) {
  const o = {}; for (const k of ['archive', 'read', 'star', 'trash', 'important', 'notImportant']) if (x[k]) o[k] = true;
  if (x.label) o.label = cleanLabel(x.label);
  if (o.important && o.notImportant) delete o.notImportant;
  if (!Object.keys(o).length) throw new Error('Choose at least one action.');
  return o;
}
// Gmail-style words: all words must appear, "quoted phrases", a OR b, -excluded
const qtoks = s => { const out = []; String(s || '').replace(/(-?)"([^"]+)"|(\S+)/g, (_, neg, q, w) => { out.push(q !== undefined ? { neg: !!neg, t: q } : w.length > 1 && w[0] === '-' ? { neg: true, t: w.slice(1) } : { neg: false, t: w }); }); return out; };
const textTest = (hay, q) => { hay = hay.toLowerCase(); return String(q || '').split(/\s+OR\s+/i).some(g => qtoks(g).every(k => !k.t || hay.includes(k.t.toLowerCase()) !== k.neg)); };
const people = l => (l || []).map(x => `${x.name || ''} ${x.email || ''}`).join(' ');
const msgSize = m => (m.text || '').length + (m.files || []).reduce((n, f) => n + (f.size || 0), 0);
function msgMatches(c, m) {
  if (m.dir !== 'in') return false;
  const all = [m.subject, m.text, people([m.from]), people(m.to), people(m.cc)].join(' ');
  if (c.from && !textTest(people([m.from]), c.from)) return false;
  if (c.to && !textTest(people(m.to) + ' ' + people(m.cc), c.to)) return false;
  if (c.subject && !textTest(m.subject || '', c.subject)) return false;
  if (c.has && !textTest(all, c.has)) return false;
  if (c.not && qtoks(c.not).some(k => k.t && all.toLowerCase().includes(k.t.toLowerCase()))) return false;
  if (c.attach && !(m.files || []).length) return false;
  if (c.sizeBytes && (c.sizeOp === 'gt' ? !(msgSize(m) > c.sizeBytes) : !(msgSize(m) < c.sizeBytes))) return false;
  return true;
}
const inScope = (t, owner) => t.agentId === owner.id || (!t.agentId && owner.role === 'admin');
async function applyTo(t, owner, a, collect) {
  const as = { ...owner, role: 'admin' }; // permissions were checked when the filter was made
  if (a.archive && t.status === 'open') await act(t, as, 'resolve', {}, collect);
  if (a.read && t.unread) await act(t, as, 'read', {}, collect);
  if (a.star && !t.starred) await act(t, as, 'star', {}, collect);
  if (a.label) { if (usePriv(owner)) { if (!(privRead(owner.id).threads[t.id] || []).includes(a.label)) await act(t, owner, 'label', { label: a.label, add: true }, collect); } else if (!(t.labels || []).includes(a.label)) await act(t, as, 'label', { label: a.label, add: true }, collect); }
  if (a.important && !t.important) await act(t, as, 'important', {}, collect);
  if (a.notImportant && t.important) await act(t, as, 'important', {}, collect);
  if (a.trash && !t.trashed) await act(t, as, 'trash', {}, collect);
}
async function flush(collected) { // one Gmail call per kind of change, not one per conversation
  const by = new Map(); let err = '';
  for (const { a, ops, ms } of collected) {
    if (!a) continue; const g = by.get(a.id) || { a, ops: new Map(), ms: [] }; by.set(a.id, g); g.ms.push(...ms);
    for (const [uids, item, vals, gm] of ops) { const k = item + '|' + vals + '|' + !!gm, e = g.ops.get(k) || [new Set(), item, vals, gm]; uids.forEach(u => e[0].add(u)); g.ops.set(k, e); }
  }
  for (const g of by.values()) {
    const ops = [...g.ops.values()].map(([s, i, v, gm]) => [[...s], i, v, gm]).filter(o => o[0].length);
    if (ops.length) { try { await push(g.a, ops); g.ms.forEach(m => { m.pend = Date.now() + 5000; }); } catch (e) { err = e.message; g.ms.forEach(m => { delete m.pend; }); } } else g.ms.forEach(m => { delete m.pend; });
  }
  store.save(); return err;
}
async function runFilters(newMails) { // called for every freshly arrived email
  const fl = filters().filter(f => f.enabled !== false); if (!fl.length) return;
  const collected = [];
  for (const m of newMails) {
    const t = box().threads.find(x => x.id === m.threadId); if (!t || m.dir !== 'in') continue;
    for (const f of fl) { const owner = bot.agentById(f.ownerId); if (!owner || !owner.active || (f.accountId && f.accountId !== m.accountId) || !inScope(t, owner) || !msgMatches(f.criteria, m)) continue; await applyTo(t, owner, f.actions, collected); }
  }
  if (collected.length) await flush(collected);
}
const matching = (owner, criteria, accountId) => box().threads.filter(t => !t.trashed && !t.spam && inScope(t, owner) && (!accountId || t.accountId === accountId) && mailsOf(t).some(m => msgMatches(criteria, m)));
const countMatches = (me, criteria, accountId) => matching(me, cleanCriteria(criteria), accountId || '').length;
async function applyFilterNow(f) { // "also apply to N matching conversations"
  const owner = bot.agentById(f.ownerId); if (!owner) return { n: 0 };
  const list = matching(owner, f.criteria, f.accountId), collected = []; for (const t of list) await applyTo(t, owner, f.actions, collected);
  const err = await flush(collected); return { n: list.length, warn: err ? 'Done here, but Gmail could not be updated: ' + err : '' };
}
function saveFilter(me, id, x = {}) {
  if (me.role !== 'admin' && !perms().filters) throw new Error('The admin has turned filters off for the team.');
  const list = filters(); let f = id && list.find(y => y.id === id); if (id && (!f || (f.ownerId !== me.id && me.role !== 'admin'))) throw new Error('Filter not found');
  const criteria = x.criteria || !f ? cleanCriteria(x.criteria) : f.criteria, actions = x.actions || !f ? cleanActions(x.actions) : f.actions;
  if (actions.label && me.role !== 'admin' && !usePriv(me) && !perms().createLabels && !labelNames().has(actions.label)) throw new Error('Only the admin can create new labels. Pick an existing one.');
  if (!f) { f = { id: 'f_' + rid(), ownerId: me.id, created: Date.now() }; list.push(f); }
  Object.assign(f, { criteria, actions, accountId: x.accountId !== undefined ? String(x.accountId || '') : f.accountId || '', enabled: x.enabled !== undefined ? !!x.enabled : f.enabled !== false });
  store.save(); return f;
}
function removeFilter(me, id) { const f = filters().find(y => y.id === id); if (!f || (f.ownerId !== me.id && me.role !== 'admin')) throw new Error('Filter not found'); box().filters = filters().filter(y => y !== f); store.save(); }
const listFilters = me => filters().filter(f => me.role === 'admin' || f.ownerId === me.id).map(f => ({ ...f, ownerName: (bot.agentById(f.ownerId) || {}).name || '' }));

// ---------- sending ----------
async function send(t, me, o) {
  const b = box(), a = t ? acct(t.accountId) : acct(o.accountId) || b.accounts.find(x => x.enabled);
  if (!a || !a.user || !a.pass) throw new Error('The mailbox is not set up yet.');
  const ms = t ? mailsOf(t) : [], last = [...ms].reverse().find(x => x.dir === 'in') || ms[ms.length - 1], self = norm(a.user);
  let to = o.to, cc = o.cc || [], bcc = o.bcc || [], subject = o.subject;
  if (t) {
    if (o.forward) to = o.to || [];
    else if (!to || !to.length) to = [last ? (last.dir === 'in' ? last.replyTo || last.from.email : (last.to[0] || {}).email) : t.whoEmail];
    if (o.replyAll && last) cc = [...new Set([...last.to, ...last.cc].map(x => x.email))].filter(e => e !== self && !to.includes(e));
    subject = /^re:/i.test(t.subject) ? t.subject : 'Re: ' + t.subject;
    if (o.forward) { subject = /^fwd?:/i.test(t.subject) ? t.subject : 'Fwd: ' + t.subject; }
  }
  // forwarding inside a conversation: the person who handles the ORIGINAL sender's organization / domain (routing rules, then organizations)
  // gets a copy by email (as Bcc) and the conversation shows up in their Mail
  let handlerCopy = null;
  if (t && o.forward && o.copyHandler !== false) {
    const src = ms.find(x => x.dir === 'in') || ms[0], r = src ? routeMail(a, src, src.dir === 'out') : { owner: null };
    const h = r.owner || ownerOf(store.db.organizations.find(x => x.id === t.orgId));
    if (h && h.id !== me.id) {
      if (t.agentId !== h.id) t.sharedWith = [...new Set([...(t.sharedWith || []), h.id])];
      const em = norm(h.email), all = [...(to || []), ...cc, ...bcc].map(norm);
      if (em && !all.includes(em)) { bcc = [...bcc, em]; handlerCopy = { name: h.name, emailed: true, org: r.org ? r.org.name : '' }; }
      else handlerCopy = { name: h.name, emailed: !!em, noEmail: !em, org: r.org ? r.org.name : '' };
    }
  }
  to = (to || []).filter(Boolean); if (!to.length) throw new Error('Add at least one recipient.'); if (!String(o.text || '').trim()) throw new Error('The message is empty.');
  const messageId = `<${rid()}.${Math.random().toString(36).slice(2, 8)}@${a.user.split('@')[1] || 'localhost'}>`;
  const headers = {}; if (last && last.messageId) { headers['In-Reply-To'] = last.messageId; headers.References = ((last.references || '') + ' ' + last.messageId).trim(); }
  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeHtml = h => String(h || '').replace(/<(script|iframe|object|embed|style|link|meta|form)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?(script|iframe|object|embed|style|link|meta|form|base)\b[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, 'blocked:');
  const bodyHtml = o.html ? `<div style="font-family:Arial,sans-serif;font-size:14px">${safeHtml(o.html)}</div>` : `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${escH(o.text)}</div>`;
  const sg = o.noSignature ? null : signature.block(me); // the sender's own signature (text + optional GIF)
  const attachments = (o.attachments || []).slice(0, 10).map(x => ({ filename: String(x.filename || 'file').replace(/["\r\n]/g, ''), type: x.type || 'application/octet-stream', content: Buffer.from(x.b64 || '', 'base64') }));
  await mailer.send({ host: a.smtpHost, port: a.smtpPort, security: +a.smtpPort === 465 ? 'ssl' : 'starttls', user: a.user, pass: a.pass, from: a.user, fromName: `${me.name}${a.fromName ? ' – ' + a.fromName : ''}` },
    { to, cc, bcc, headers, messageId, subject, text: o.text + (sg ? sg.text : ''), html: bodyHtml + (sg ? sg.html : ''), attachments, inline: sg ? sg.inline : [] });
  if (!t) {
    const org = (a.orgId && store.db.organizations.find(x => x.id === a.orgId)) || matchOrg(to[0], subject);
    t = { id: 't' + rid(), accountId: a.id, thrid: '', subject, orgId: org ? org.id : '', agentId: me.id, status: 'open', starred: false, unread: 0, updatedAt: 0, who: to[0], whoEmail: to[0], snippet: '', count: 0, labels: [] }; b.threads.push(t);
  }
  const sid = rid(); attachments.forEach((x, i) => { try { fs.mkdirSync(path.join(FILES(), sid), { recursive: true }); fs.writeFileSync(path.join(FILES(), sid, String(i)), x.content); } catch {} }); // keep what was sent so it can be previewed / opened later
  b.mails.push({ id: sid, threadId: t.id, accountId: a.id, thrid: '', uid: null, dir: 'out', by: me.name, from: { name: me.name, email: a.user }, to: to.map(email => ({ name: '', email })), cc: cc.map(email => ({ name: '', email })), bcc: bcc.map(email => ({ name: '', email })), subject, text: o.text, date: Date.now(), messageId, references: headers.References || '', files: attachments.map((x, i) => ({ i, name: x.filename, type: x.type, size: x.content.length })), sent: true, seen: true, labels: ['\\Sent'], sentHtml: o.html ? safeHtml(o.html) + (sg ? sg.storedHtml : '') : '' });
  t.status = 'open'; t.agentId = t.agentId || me.id; recompute(t); store.save(); emit(t);
  if (t.unread) await act(t, me, 'read').catch(() => {});
  return { ...view(t), handlerCopy };
}

// ---------- mailbox accounts ----------
const publicAcc = a => ({ id: a.id, label: a.label || a.user, user: a.user, host: a.host, port: a.port, smtpHost: a.smtpHost, smtpPort: a.smtpPort, fromName: a.fromName, enabled: a.enabled, minutes: a.minutes, days: a.days, orgId: a.orgId, hasPass: !!a.pass, loadAll: a.loadAll !== false, backDone: !!a.backDone, backLeft: a.backLeft || 0, backTotal: a.backTotal || 0, lastSync: a.lastSync, lastError: a.lastError, gmail: isGm(a), total: box().threads.filter(t => t.accountId === a.id).length });
const accounts = () => box().accounts.map(publicAcc);
function saveAccount(id, x) {
  const b = box(); let a = id && acct(id);
  if (id && !a) throw new Error('Mailbox not found');
  if (!a) { if (!String(x.user || '').includes('@')) throw new Error('Enter the email address'); if (!x.pass) throw new Error('Enter the app password'); a = newAcc({}); b.accounts.push(a); }
  for (const k of ['label', 'host', 'smtpHost', 'user', 'fromName']) if (x[k] !== undefined) a[k] = String(x[k]).trim();
  for (const k of ['port', 'smtpPort']) if (+x[k]) a[k] = +x[k];
  if (x.pass) a.pass = String(x.pass).replace(/\s/g, ''); if (+x.minutes) a.minutes = Math.min(60, Math.max(1, +x.minutes)); if (+x.days) a.days = Math.min(90, Math.max(1, +x.days)); if (x.loadAll !== undefined) { a.loadAll = !!x.loadAll; if (a.loadAll) a.backDone = false; }
  if (typeof x.gmail === 'boolean') a.gmail = x.gmail; if (x.enabled !== undefined) a.enabled = !!x.enabled; if (x.orgId !== undefined) a.orgId = String(x.orgId);
  if (!a.label) a.label = a.user; if (x.user !== undefined || x.host !== undefined) { a.lastUid = 0; a.uidv = 0; }
  store.save(); return a;
}
function removeAccount(id) {
  const b = box(), ids = new Set(b.mails.filter(m => m.accountId === id).map(m => m.id));
  for (const m of ids) fs.rmSync(path.join(FILES(), m), { recursive: true, force: true });
  b.mails = b.mails.filter(m => m.accountId !== id); b.threads = b.threads.filter(t => t.accountId !== id); b.accounts = b.accounts.filter(a => a.id !== id); store.save();
}
function saveRule(id, x) {
  const list = rules(); let r = id && list.find(y => y.id === id); if (id && !r) throw new Error('Rule not found');
  const pattern = String(x.pattern || '').trim(); if (!pattern) throw new Error('Enter a domain (like hilton.com) or an email address');
  if (!bot.agentById(x.agentId)) throw new Error('Choose a team member');
  if (x.accountId && !acct(x.accountId)) throw new Error('Mailbox not found');
  if (!r) { r = { id: 'r_' + rid() }; list.push(r); }
  Object.assign(r, { pattern, accountId: x.accountId || '', agentId: x.agentId }); store.save(); return r;
}
const removeRule = id => { box().rules = rules().filter(r => r.id !== id); store.save(); };
// re-route existing conversations (skips ones someone handed over by hand)
function applyRules() {
  let n = 0;
  for (const t of box().threads) {
    if (t.manual) continue; const first = mailsOf(t).find(m => m.dir === 'in') || mailsOf(t)[0]; if (!first) continue;
    const a = acct(t.accountId); if (!a) continue; const r = routeMail(a, first, first.dir === 'out');
    // rules may move a conversation; mail nobody has picked up yet also gets the company's person
    const viaRule = r.via && ruleOwner(t.accountId, r.via);
    if (r.owner && r.owner.id !== t.agentId && (viaRule || !t.agentId)) { t.agentId = r.owner.id; if (r.org && !t.orgId) t.orgId = r.org.id; if (r.via && r.via !== norm(t.whoEmail)) t.via = r.via; n++; emit(t); }
  }
  store.save(); return n;
}
// ---------- drafts & scheduled sends (per person) ----------
const drafts = me => (box().drafts = box().drafts || []).filter(d => d.agentId === me.id).sort((a, b) => b.updatedAt - a.updatedAt);
function saveDraft(me, x) {
  const all = (box().drafts = box().drafts || []); let d = x.id && all.find(y => y.id === x.id && y.agentId === me.id);
  if (!d) { d = { id: 'd_' + rid(), agentId: me.id }; all.push(d); }
  Object.assign(d, { accountId: x.accountId || '', to: x.to || [], cc: x.cc || [], bcc: x.bcc || [], subject: String(x.subject || ''), html: String(x.html || '').slice(0, 400000), updatedAt: Date.now() }); store.save(); return d;
}
const removeDraft = (me, id) => { box().drafts = (box().drafts || []).filter(d => !(d.id === id && d.agentId === me.id)); store.save(); };
const scheduled = me => (box().scheduled = box().scheduled || []).filter(d => d.agentId === me.id).sort((a, b) => a.sendAt - b.sendAt).map(({ attachments, ...r }) => ({ ...r, files: (attachments || []).length }));
function schedule(me, x) {
  const at = +x.sendAt; if (!at || at < Date.now() + 30000) throw new Error('Pick a time in the future');
  const to = (x.to || []).filter(Boolean); if (!to.length) throw new Error('Add at least one recipient.');
  const r = { id: 's_' + rid(), agentId: me.id, sendAt: at, accountId: x.accountId, to, cc: x.cc || [], bcc: x.bcc || [], subject: String(x.subject || '(no subject)'), text: x.text, html: x.html, attachments: x.attachments || [] };
  (box().scheduled = box().scheduled || []).push(r); store.save(); return r;
}
const cancelScheduled = (me, id) => { box().scheduled = (box().scheduled || []).filter(d => !(d.id === id && d.agentId === me.id)); store.save(); };
async function runScheduled() {
  const due = (box().scheduled || []).filter(r => r.sendAt <= Date.now() && !r.busy);
  for (const r of due) {
    r.busy = true; const me = bot.agentById(r.agentId);
    try { await send(null, me, r); box().scheduled = box().scheduled.filter(y => y !== r); }
    catch (e) { r.busy = false; r.error = e.message; r.sendAt = Date.now() + 10 * 60000; }
    store.save();
  }
}
module.exports = { progress, remoteSearch, forViewer, labelsFor, perms, setPerms, labelNames, createLabel, deleteLabel, listFilters, saveFilter, removeFilter, countMatches, applyFilterNow, drafts, saveDraft, removeDraft, scheduled, schedule, cancelScheduled, rules, saveRule, removeRule, applyRules, internal, setInternal, sync, start, list, get, messages, file, send, act, accounts, saveAccount, removeAccount, acct, publicAcc, ingest, matchOrg };
