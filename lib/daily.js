// End-of-day report of what the bot / AI / team did: you pick WHICH sections you want, the period, and whether it is e-mailed.
// Data comes from the chats (messages) plus a small event log (tracking lookups, hand-offs, calls, menu sections) the bot writes as it works.
const store = require('./store');
const reports = require('./reports');
const { writeRows } = require('./xlsx');
const dpdf = require('./dailypdf');

const SECTIONS = [
  { key: 'dcalerts', title: 'DC alerts (pending dispatch)', hint: 'Who is warned about DCs still pending dispatch after N days, and which DCs are overdue right now, per person and company' },
  { key: 'summary', title: 'Summary of the day', hint: 'Numbers: customers, messages, bot / AI / team replies, response time, tracking, calls, sections used' },
  { key: 'questions', title: 'What customers asked', hint: 'Every customer message with who answered it (AI, menu bot or a team member) and the answer' },
  { key: 'tracking', title: 'Tracking requests', hint: 'Who asked to track an order, what they searched and whether it was found' },
  { key: 'followup', title: 'Needs follow-up', hint: 'Chats where the customer is still waiting for any answer (current status)' },
  { key: 'handoffs', title: 'Handed to the team', hint: 'Chats and call requests the bot passed to a team member' },
  { key: 'team', title: 'Team performance', hint: 'Replies, chats and response time per team member' },
  { key: 'orgs', title: 'By organization', hint: 'Activity per company: customers, messages, answers, tracking, hand-offs' },
  { key: 'topics', title: 'AI insights', hint: 'Gemini / Claude reads the day\'s questions: top topics, problems, suggestions (needs the AI key; one small request)' },
];
const DEF = { sections: ['summary', 'questions', 'tracking', 'followup', 'team', 'dcalerts'], period: 'today', auto: { enabled: false, time: '18:00', recipients: [], pdf: true, excel: true }, lastRunDay: '', lastRun: null };
const cfg = () => { const c = store.db.daily || {}, r = { ...DEF, ...c, auto: { ...DEF.auto, ...(c.auto || {}) } }; if (c.sections && !c.dcaSeen && !r.sections.includes('dcalerts')) r.sections = [...r.sections, 'dcalerts']; return r; };   // existing installs get the DC alerts section once (they can untick it)
const isMail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function setCfg(b) {
  const c = store.db.daily = cfg(); b = b || {}; c.dcaSeen = true;
  if (Array.isArray(b.sections)) c.sections = SECTIONS.map(s => s.key).filter(k => b.sections.includes(k));
  if (['today', 'yesterday', 'last7'].includes(b.period)) c.period = b.period;
  if (b.auto) {
    const a = c.auto, x = b.auto;
    if (x.enabled !== undefined) a.enabled = !!x.enabled;
    if (/^\d{2}:\d{2}$/.test(x.time || '')) a.time = x.time;
    if (x.recipients !== undefined) a.recipients = String(Array.isArray(x.recipients) ? x.recipients.join(',') : x.recipients).split(/[\s,;]+/).map(s => s.trim()).filter(isMail);
    if (x.pdf !== undefined) a.pdf = !!x.pdf;
    if (x.excel !== undefined) a.excel = !!x.excel;
  }
  store.save(); return c;
}

// ---------- event log (written by the bot) ----------
function log(conv, type, data) {
  try {
    const L = store.db.botLog = store.db.botLog || [];
    L.push({ ts: Date.now(), phone: conv.phone, name: conv.name || '', org: conv.orgName || '', type, ...(data || {}) });
    if (L.length > 30000) L.splice(0, L.length - 25000);
  } catch { /* the report log must never break a chat */ }
}

// ---------- periods ----------
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOf = (y, m, d) => new Date(y, m, d).getTime();
function range(period, date) {
  const n = new Date(); let y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
  const label = t => new Date(t).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { [y, m, d] = date.split('-').map(Number); m -= 1; const f = startOf(y, m, d); return { from: f, to: startOf(y, m, d + 1), label: label(f), multi: false }; }
  if (period === 'yesterday') { const f = startOf(y, m, d - 1); return { from: f, to: startOf(y, m, d), label: label(f), multi: false }; }
  if (period === 'last7') { const f = startOf(y, m, d - 6); return { from: f, to: startOf(y, m, d + 1), label: `Last 7 days (${new Date(f).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(startOf(y, m, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`, multi: true }; }
  const f = startOf(y, m, d); return { from: f, to: startOf(y, m, d + 1), label: label(f), multi: false };
}

// ---------- helpers ----------
const hm = (t, multi) => { const d = new Date(t); return (multi ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' : '') + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dur = ms => { const m = Math.round(ms / 60000); if (m < 1) return '< 1 min'; if (m < 60) return m + ' min'; const h = Math.floor(m / 60); return h < 48 ? h + ' h ' + (m % 60) + ' m' : Math.round(h / 24) + ' days'; };
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const who = c => (c && c.name && c.name !== c.phone ? c.name + ' · ' : '') + '+' + (c ? c.phone : '');
const agentName = id => { const a = store.db.agents.find(x => x.id === id); return a ? a.name : ''; };
const NOISE = /^(menu|0|start|restart|change|call|phone|contact|hi|hello|salam|assalam o alaikum|ok|okay|thanks|thank you|shukriya|\d{1,2})$/i;
const MEDIA = m => m.media ? (m.media.kind === 'audio' ? '🎤 Voice message' : m.media.kind === 'image' ? '📷 Photo' : m.media.kind === 'video' ? '🎬 Video' : '📎 ' + (m.media.name || 'File')) : '';
const answeredBy = a => !a ? 'No reply yet' : a.ai ? 'AI' : a.from === 'bot' ? 'Menu bot' : a.from === 'agent' ? (a.agentName || 'Team') : a.from === 'phone' ? 'Team (phone)' : 'Team';

// everything the sections need, computed once per report
function gather(from, to) {
  const convs = store.db.conversations, byPhone = new Map();
  const active = new Set();
  for (const m of store.db.messages) { if (m.ts >= from && m.ts < to && m.dir !== 'sys') active.add(m.phone); }
  for (const m of store.db.messages) if (active.has(m.phone) || (m.ts >= from && m.ts < to)) { (byPhone.get(m.phone) || byPhone.set(m.phone, []).get(m.phone)).push(m); }
  const G = { qa: [], inN: 0, botOut: 0, aiOut: 0, teamOut: 0, calls: 0, shops: 0, newCust: 0, customers: new Set(), human: [], perAgent: {}, perOrg: {}, from, to };
  const orgOf = c => (c && (c.orgName || c.retailName)) || 'Unknown';
  const bumpOrg = (c, k) => { const o = orgOf(c), r = G.perOrg[o] = G.perOrg[o] || { customers: new Set(), inN: 0, bot: 0, ai: 0, team: 0, track: 0, handoff: 0 }; if (k === 'cust') r.customers.add(c.phone); else r[k]++; };
  for (const [phone, list] of byPhone) {
    const conv = convs[phone]; if (!conv || conv.isGroup) continue;
    list.sort((a, b) => a.ts - b.ts);
    if (conv.createdAt >= from && conv.createdAt < to) G.newCust++;
    let pending = 0;
    list.forEach((m, i) => {
      const inRange = m.ts >= from && m.ts < to;
      if (m.dir === 'in') { if (!pending) pending = m.ts; }
      else if (m.dir === 'out' && (m.from === 'agent' || m.from === 'phone') && pending) {
        if (inRange) { const ag = m.from === 'agent' ? (m.agentName || agentName(m.agentId) || 'Team') : 'Phone (typed on the linked number)'; G.human.push({ ms: m.ts - pending, agent: ag }); (G.perAgent[ag] = G.perAgent[ag] || { replies: 0, chats: new Set(), times: [] }).times.push(m.ts - pending); }
        pending = 0;
      }
      if (!inRange) return;
      if (m.dir === 'sys') { if (/New retail shop registered/i.test(m.text || '')) G.shops++; return; }
      if (m.dir === 'in') {
        G.inN++; G.customers.add(phone); bumpOrg(conv, 'cust'); bumpOrg(conv, 'inN');
        const txt = String(m.text || '').trim();
        if (txt ? !NOISE.test(txt) : !!m.media) {
          const ans = list.slice(i + 1).find(x => x.dir === 'out');
          G.qa.push({ ts: m.ts, conv, q: txt || MEDIA(m), by: answeredBy(ans), a: ans ? (ans.text || MEDIA(ans)) : '' });
        }
      } else if (m.dir === 'out') {
        if (m.from === 'bot') { if (m.ai) { G.aiOut++; bumpOrg(conv, 'ai'); } else { G.botOut++; bumpOrg(conv, 'bot'); } }
        else { G.teamOut++; bumpOrg(conv, 'team'); if (m.from === 'agent') { const ag = m.agentName || agentName(m.agentId) || 'Team', r = G.perAgent[ag] = G.perAgent[ag] || { replies: 0, chats: new Set(), times: [] }; r.replies++; r.chats.add(phone); } }
      }
    });
  }
  const ev = (store.db.botLog || []).filter(e => e.ts >= from && e.ts < to && convs[e.phone] && !convs[e.phone].isGroup);
  G.track = ev.filter(e => e.type === 'track'); G.sections = ev.filter(e => e.type === 'section'); G.handoffs = ev.filter(e => e.type === 'handoff'); G.callsLog = ev.filter(e => e.type === 'call');
  G.calls = G.callsLog.length;
  for (const e of G.track) bumpOrg(convs[e.phone], 'track');
  for (const e of G.handoffs) bumpOrg(convs[e.phone], 'handoff');
  G.qa.sort((a, b) => a.ts - b.ts); G.resolved = Object.values(convs).filter(c => !c.isGroup && c.resolvedAt >= from && c.resolvedAt < to).length;
  // chats where the customer wrote last and nobody has answered yet (state right now)
  G.waiting = [];
  const lastBy = new Map(); for (const m of store.db.messages) if (m.dir !== 'sys') lastBy.set(m.phone, m);   // one pass: the last real message of every chat
  for (const c of Object.values(convs)) {
    if (c.isGroup || c.status === 'resolved') continue;
    const last = lastBy.get(c.phone);
    if (last && last.dir === 'in') G.waiting.push({ conv: c, last });
  }
  G.waiting.sort((a, b) => a.last.ts - b.last.ts);
  return G;
}

const card = (label, value, sub) => ({ label, value: String(value), sub: sub || '' });
const SEC_NAMES = { guide: 'Information / guide', org: 'Told us their organization', track: 'Track my order', human: 'Talk to our team', retail: 'Retail account', call: 'Call our team', ai: 'Chat with bot' };

const BUILDERS = {
  summary(G) {
    const avg = G.human.length ? G.human.reduce((a, x) => a + x.ms, 0) / G.human.length : 0, slow = G.human.reduce((a, x) => Math.max(a, x.ms), 0);
    const found = G.track.filter(e => e.found > 0).length;
    const use = {}; for (const e of G.sections) use[e.section] = (use[e.section] || 0) + 1;
    return {
      cards: [card('Customers who wrote', G.customers.size, `${G.newCust} new`), card('Messages received', G.inN), card('AI answers', G.aiOut), card('Menu bot messages', G.botOut), card('Team replies', G.teamOut),
        card('Tracking lookups', G.track.length, `${found} found · ${G.track.length - found} not found`), card('Handed to team', G.handoffs.length), card('Call requests', G.calls), card('Chats resolved', G.resolved), card('New shops registered', G.shops),
        card('Avg team response', G.human.length ? dur(avg) : '—', G.human.length ? `slowest ${dur(slow)}` : 'no team replies'), card('Waiting for an answer now', G.waiting.length)],
      lists: Object.keys(use).length ? [{ title: 'Menu sections customers used', items: Object.entries(use).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${SEC_NAMES[k] || k}: ${n}`) }] : [],
    };
  },
  questions(G, R) {
    const rows = G.qa.slice(0, 500).map(x => [hm(x.ts, R.multi), who(x.conv), (x.conv.orgName || x.conv.retailName || ''), cut(x.q, 300), x.by, cut(x.a, 220)]);
    return { note: G.qa.length > 500 ? `Showing the first 500 of ${G.qa.length} questions.` : (G.qa.length ? `${G.qa.length} customer message${G.qa.length === 1 ? '' : 's'} (menu numbers and greetings are left out).` : 'No customer questions in this period.'), tables: [{ columns: [['Time', 7], ['Customer', 16], ['Organization', 12], ['Question', 30], ['Answered by', 12], ['Answer', 28]], rows }] };
  },
  tracking(G, R) {
    const found = G.track.filter(e => e.found > 0).length, asked = G.sections.filter(e => e.section === 'track').length;
    return {
      cards: [card('Asked to track', asked), card('Looked up', G.track.length), card('Found', found), card('Not found', G.track.length - found)],
      tables: [{ columns: [['Time', 7], ['Customer', 18], ['Organization', 16], ['Searched for', 20], ['Result', 14]], rows: G.track.map(e => [hm(e.ts, R.multi), who(store.db.conversations[e.phone]), e.scope || e.org || '', cut(e.q, 60), e.found > 0 ? `Found ${e.found} order${e.found === 1 ? '' : 's'}` : 'Not found']) }],
      note: G.track.length ? '' : 'No tracking lookups in this period.',
    };
  },
  followup(G) {
    return { note: 'Status right now (not at the end of the chosen day). Customers whose last message has not been answered by anyone.', tables: [{ columns: [['Customer', 20], ['Organization', 16], ['Assigned to', 14], ['Customer\'s last message', 34], ['Waiting', 10]], rows: G.waiting.slice(0, 300).map(w => [who(w.conv), w.conv.orgName || w.conv.retailName || '', agentName(w.conv.agentId) || 'Nobody yet', cut(w.last.text || MEDIA(w.last), 200), dur(Date.now() - w.last.ts)]) }] };
  },
  handoffs(G, R) {
    const rows = [...G.handoffs, ...G.callsLog].sort((a, b) => a.ts - b.ts).map(e => { const c = store.db.conversations[e.phone]; return [hm(e.ts, R.multi), who(c), c.orgName || c.retailName || '', e.type === 'call' ? 'Voice call link sent' : (e.agent || 'Nobody on duty'), e.type === 'call' ? 'Asked for a call' : (e.why || 'Asked for a person'), c.status === 'resolved' ? 'Resolved' : c.status === 'waiting' ? 'Waiting' : c.status === 'assigned' ? 'With ' + (agentName(c.agentId) || 'team') : 'Bot']; });
    return { note: rows.length ? '' : 'Nobody was passed to the team in this period.', tables: [{ columns: [['Time', 7], ['Customer', 20], ['Organization', 14], ['Assigned to', 14], ['Reason', 16], ['Status now', 12]], rows }] };
  },
  team(G) {
    const open = {}; for (const c of Object.values(store.db.conversations)) if (!c.isGroup && c.status === 'assigned' && c.agentId) open[agentName(c.agentId)] = (open[agentName(c.agentId)] || 0) + 1;
    const wait = {}; for (const w of G.waiting) { const n = agentName(w.conv.agentId) || 'Nobody yet'; wait[n] = (wait[n] || 0) + 1; }
    const names = [...new Set([...Object.keys(G.perAgent), ...store.db.agents.filter(a => a.active).map(a => a.name)])];
    const rows = names.map(n => { const r = G.perAgent[n] || { replies: 0, chats: new Set(), times: [] }, t = r.times; return [n, r.replies, r.chats.size, t.length ? dur(t.reduce((a, b) => a + b, 0) / t.length) : '—', t.length ? dur(Math.max(...t)) : '—', open[n] || 0, wait[n] || 0]; }).sort((a, b) => b[1] - a[1]);
    if (wait['Nobody yet']) rows.push(['(not assigned)', 0, 0, '—', '—', 0, wait['Nobody yet']]);
    return { tables: [{ columns: [['Team member', 18], ['Replies sent', 10], ['Chats replied to', 12], ['Avg response', 12], ['Slowest', 10], ['Open chats now', 12], ['Waiting now', 10]], rows }] };
  },
  dcalerts() {
    const R = require('./dcalerts').report();
    return {
      note: R.persons ? 'Right now (not only the chosen day): DCs that are still Pending dispatch after the days set in Settings → DC pending alerts.' : 'No DC alert is set yet. The administrator can add one in Settings → DC pending alerts.',
      cards: R.persons ? [{ ...card('Pending past the limit', R.total, 'DCs overdue right now · each DC counted once · click to open them'), link: R.all }, card('People alerted', R.persons), card('Companies overdue', R.companies)] : [],
      tables: R.persons ? [
        { title: 'Who is alerted', columns: [['Person', 18], ['Companies', 16], ['After', 8], ['Alert', 8], ['Shows', 22], ['Overdue DCs', 11]], rows: R.people, links: { col: 5, rows: R.plinks } },
        { title: 'Overdue DCs per company', columns: [['Person', 18], ['Company', 26], ['Pending DCs', 11], ['Oldest DC date', 14], ['After', 8]], rows: R.rows, links: { col: 2, rows: R.rlinks } }] : [],
    };
  },
  orgs(G) {
    const rows = Object.entries(G.perOrg).map(([o, r]) => [o, r.customers.size, r.inN, r.ai, r.bot, r.team, r.track, r.handoff]).sort((a, b) => b[2] - a[2]);
    return { note: rows.length ? '' : 'No activity in this period.', tables: [{ columns: [['Organization', 22], ['Customers', 10], ['Messages in', 10], ['AI answers', 10], ['Bot answers', 10], ['Team replies', 12], ['Tracking', 9], ['Handed over', 10]], rows }] };
  },
  async topics(G) {
    const ai = require('./ai');
    if (!ai.available()) return { note: 'AI insights need an AI key. Add your Gemini key under Settings → AI assistant (any chat → AI settings).' };
    const qs = G.qa.map(x => cut(x.q, 160)).filter(q => q.length > 3).slice(-150);
    if (!qs.length) return { note: 'No customer questions to analyse in this period.' };
    let j; try { j = await ai.insights(qs); } catch (e) { return { note: 'The AI could not write the insights: ' + e.message }; }
    if (!j) return { note: 'The AI did not return usable insights. Try again.' };
    const arr = v => (Array.isArray(v) ? v : []).map(x => cut(typeof x === 'string' ? x : JSON.stringify(x), 240)).slice(0, 8);
    return {
      note: 'Written by AI from the customers\' questions. Please review before acting on it.',
      tables: [{ columns: [['Topic', 24], ['Approx. questions', 12], ['Example', 40]], rows: (Array.isArray(j.topics) ? j.topics : []).slice(0, 10).map(t => [cut(t.topic, 80), t.count == null ? '' : String(t.count), cut(t.example, 160)]) }],
      lists: [{ title: 'Problems / complaints noticed', items: arr(j.problems) }, { title: 'Suggestions', items: arr(j.suggestions) }].filter(l => l.items.length),
    };
  },
};

// the whole report (JSON used by the screen, the PDF, the Excel file and the e-mail)
async function build(sel) {
  const c = cfg(), keys = (Array.isArray(sel && sel.sections) ? sel.sections : c.sections).filter(k => BUILDERS[k]);
  const R = range((sel && sel.period) || c.period, sel && sel.date), G = gather(R.from, R.to);
  const sections = [];
  for (const def of SECTIONS.filter(s => keys.includes(s.key))) sections.push({ key: def.key, title: def.title, cards: [], tables: [], lists: [], note: '', ...(await BUILDERS[def.key](G, R)) });
  return { title: 'Daily report', business: store.db.settings.businessName, label: R.label, generatedAt: Date.now(), sections };
}
const fileBase = r => `daily-report-${dayKey(new Date(r.generatedAt))}`;
function toExcel(r) {
  const g = [[r.title + ' — ' + r.label], [r.business], []];
  for (const s of r.sections) {
    g.push([s.title.toUpperCase()]); if (s.note) g.push([s.note]);
    for (let i = 0; i < s.cards.length; i += 1) g.push([s.cards[i].label, s.cards[i].value, s.cards[i].sub]);
    for (const t of s.tables) { if (t.rows.length) { if (t.title) g.push([String(t.title).toUpperCase()]); g.push(t.columns.map(c => c[0])); t.rows.forEach(x => g.push(x.map(v => String(v)))); } }
    for (const l of s.lists) { g.push([l.title]); l.items.forEach(i => g.push(['• ' + i])); }
    g.push([]);
  }
  const width = Math.max(...g.map(x => x.length), 1);
  return writeRows(g.map(x => { const y = x.slice(); while (y.length < width) y.push(''); return y; }), 'Daily report', [], [22, 22, 18, 28, 16, 34, 12, 12].slice(0, width));
}
const files = (r, o) => [...(!o || o.pdf !== false ? [{ filename: fileBase(r) + '.pdf', type: 'application/pdf', content: dpdf.build(r) }] : []), ...(!o || o.excel !== false ? [{ filename: fileBase(r) + '.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: toExcel(r) }] : [])];

function mailBody(r) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const sum = r.sections.find(s => s.key === 'summary'), cards = sum ? sum.cards : [];
  const text = `${r.title} — ${r.label}\n\n` + (cards.length ? cards.map(c => `${c.label}: ${c.value}${c.sub ? ' (' + c.sub + ')' : ''}`).join('\n') : r.sections.map(s => s.title).join('\n')) + `\n\nThe full report is attached.\n— ${r.business}`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;color:#10201d"><div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:700">${esc(r.title)}<div style="font-size:13px;font-weight:500;opacity:.9">${esc(r.label)}</div></div><div style="border:1px solid #e4e9e7;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${cards.length ? `<table style="border-collapse:collapse;width:100%;font-size:14px">${cards.map(c => `<tr><td style="padding:6px 0;border-top:1px solid #e4e9e7">${esc(c.label)}</td><td style="padding:6px 0;border-top:1px solid #e4e9e7;text-align:right;font-weight:700">${esc(c.value)}${c.sub ? ` <span style="font-weight:400;color:#5b6b67;font-size:12px">${esc(c.sub)}</span>` : ''}</td></tr>`).join('')}</table>` : `<p>Sections: ${esc(r.sections.map(s => s.title).join(', '))}</p>`}<p style="margin:16px 0 0;color:#8a9893;font-size:12px">The full report is attached. Sent by ${esc(r.business)}.</p></div></div>`;
  return { text, html };
}
async function send(sel, to, o) {
  const c = cfg(), list = (to && to.length ? to : c.auto.recipients).filter(isMail);
  if (!list.length) throw new Error('Add at least one e-mail address first.');
  const r = await build(sel), { text, html } = mailBody(r);
  await reports.sendMail({ to: list, subject: `${store.db.settings.businessName} — daily report ${r.label}`, text, html, attachments: files(r, o || c.auto) });
  return { sent: list.length, label: r.label };
}

// automatic end-of-day e-mail
let timer;
function tick() {
  const c = cfg(), a = c.auto, now = new Date();
  if (!a.enabled || !a.recipients.length || c.lastRunDay === dayKey(now)) return;
  const [h, m] = a.time.split(':').map(Number), due = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
  if (due < 0 || due >= 90) return;
  const d = store.db.daily = cfg(); d.lastRunDay = dayKey(now);   // claim first: never send twice
  send({ period: 'today', sections: c.sections }, a.recipients, a)
    .then(x => { d.lastRun = { ts: Date.now(), ok: true, note: `Sent to ${x.sent} address${x.sent === 1 ? '' : 'es'}` }; store.save(); })
    .catch(e => { d.lastRun = { ts: Date.now(), ok: false, note: e.message }; store.save(); console.error('Daily report failed:', e.message); });
}
function start() { clearInterval(timer); timer = setInterval(tick, 20000); setTimeout(tick, 4000); }

module.exports = { SECTIONS, cfg, setCfg, log, build, files, send, start, fileBase };
