// DC alerts: the administrator says WHO is told about pending-dispatch DCs that are older than N days, and for WHICH companies.
// Stored in the database as db.dcAlerts = { rules: [{ id, agentId, orgs: ['o_1', 'x:name', ... | '*'], days, on }] }.
// A company is the same key the Company report uses (organization id, or 'x:<name>' for a sheet company that has no organization yet);
// '*' means every company.
const store = require('./store');

const R = () => { const d = store.db; if (!d.dcAlerts || !Array.isArray(d.dcAlerts.rules)) d.dcAlerts = { rules: [] }; return d.dcAlerts; };
const rules = () => R().rules;

function clean(list, agentIds) {
  const out = [], seen = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || !agentIds.has(String(r.agentId || ''))) continue;
    let orgs = [...new Set((Array.isArray(r.orgs) ? r.orgs : []).map(x => String(x).slice(0, 200)).filter(Boolean))];
    if (orgs.includes('*')) orgs = ['*'];
    if (!orgs.length) continue;
    const days = Math.min(60, Math.max(1, Math.floor(+r.days) || 1));
    const id = String(r.id || '').slice(0, 40) || store.nextId('da');
    if (seen.has(id)) continue; seen.add(id);
    out.push({ id, agentId: String(r.agentId), orgs, days, on: r.on !== false });
  }
  return out;
}
function set(list, agentIds) { R().rules = clean(list, agentIds); store.save(); return R().rules; }

const forUser = id => rules().filter(r => r.on && r.agentId === id);
// every company key this person was given (so they may open those DCs in Company report even if another person looks after the company)
function orgSet(id) { const s = new Set(); for (const r of forUser(id)) for (const o of r.orgs) s.add(o); return s; }
// 'YYYY-MM-DD' of the day N days before today (desk time zone, see config.js)
function dayBefore(n) { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// the alert of one person: per company, how many DCs are still pending dispatch although the DC date is N or more days back
function compute(me, db, orders, groupOf, seen) {   // seen (optional Set): collects every overdue order, so a report can count each DC once even when two people are told about it
  const rs = forUser(me.id); if (!rs.length) return { items: [], total: 0, rules: 0 };
  const memo = new Map(), by = new Map(), cut = new Map(rs.map(r => [r.id, dayBefore(r.days)]));
  for (const o of db.orders) {
    const day = o.orderDay; if (!day || orders.classOf(o) !== 'pending') continue;
    const g = groupOf(o, memo);
    let to = '', days = 0;
    for (const r of rs) if ((r.orgs[0] === '*' || r.orgs.includes(g.key)) && day <= cut.get(r.id) && cut.get(r.id) > to) { to = cut.get(r.id); days = r.days; } // the widest rule wins
    if (!to) continue;
    if (seen) seen.add(o);
    let it = by.get(g.key); if (!it) by.set(g.key, it = { key: g.key, name: g.name, count: 0, oldest: day, to, days });
    it.count++; if (day < it.oldest) it.oldest = day; if (to > it.to) { it.to = to; it.days = days; }
  }
  const items = [...by.values()].sort((a, b) => a.oldest.localeCompare(b.oldest) || b.count - a.count);
  return { items, total: items.reduce((n, i) => n + i.count, 0), rules: rs.length };
}

// ---- each person's own way of being told: mute, and WHEN the alert card shows ----
//   mode 'always' (default): shows whenever something is pending (and again when the numbers change)
//   mode 'every'           : shows again every N minutes (15 - 1440)
//   mode 'times'           : shows only at the times of day the person chose (e.g. 09:00, 14:00, 17:00)
//   muteUntil (ms) / off   : nothing pops up (the number on Company report stays) until the time passes / the person turns it on again
const PREF_DEF = { mode: 'always', every: 60, times: ['09:00', '14:00'], muteUntil: 0, off: false };
function prefs(id) {
  const d = store.db; d.dcAlertPrefs = d.dcAlertPrefs || {};
  const p = { ...PREF_DEF, ...(d.dcAlertPrefs[id] || {}) };
  return { mode: ['always', 'every', 'times'].includes(p.mode) ? p.mode : 'always', every: Math.min(1440, Math.max(15, Math.round(+p.every) || 60)), times: cleanTimes(p.times), muteUntil: +p.muteUntil > Date.now() ? +p.muteUntil : 0, off: !!p.off };
}
const cleanTimes = a => [...new Set((Array.isArray(a) ? a : []).map(String).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0, 12);
function setPrefs(id, b) {
  const cur = prefs(id), n = { ...cur }; b = b || {};
  if (['always', 'every', 'times'].includes(b.mode)) n.mode = b.mode;
  if (b.every !== undefined) n.every = Math.min(1440, Math.max(15, Math.round(+b.every) || cur.every));
  if (b.times !== undefined) n.times = cleanTimes(b.times);
  if (b.muteUntil !== undefined) n.muteUntil = Math.max(0, Math.min(Date.now() + 366 * 864e5, Math.round(+b.muteUntil) || 0));
  if (b.off !== undefined) n.off = !!b.off;
  if (n.mode === 'times' && !n.times.length) n.times = PREF_DEF.times;
  store.db.dcAlertPrefs[id] = n; store.save(); return prefs(id);
}

// ---- the report (Daily report): who is alerted, for which companies, and what is pending right now ----
let ctx = null;
const bind = c => { ctx = c; };
function report() {
  const db = store.db, byAgent = new Map(), name = id => (db.agents.find(a => a.id === id) || {}).name || id;
  for (const r of rules()) { if (!byAgent.has(r.agentId)) byAgent.set(r.agentId, []); byAgent.get(r.agentId).push(r); }
  const people = [], rows = [], rlinks = [], plinks = [], seen = new Set(), SEP = '\u001f'; let maxTo = '';
  for (const [id, rs] of byAgent) {
    const on = rs.filter(r => r.on), p = prefs(id), res = ctx && on.length ? compute({ id }, db, ctx.orders, ctx.groupOf, seen) : { items: [], total: 0 };
    const when = p.off ? 'Muted (turned off)' : p.muteUntil ? 'Muted until ' + new Date(p.muteUntil).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : p.mode === 'times' ? 'At ' + p.times.join(', ') : p.mode === 'every' ? 'Every ' + p.every + ' min' : 'Always';
    people.push([name(id), rs.some(r => r.orgs[0] === '*') ? 'All companies' : String(new Set(rs.flatMap(r => r.orgs)).size) + ' compan' + (new Set(rs.flatMap(r => r.orgs)).size === 1 ? 'y' : 'ies'), Math.min(...rs.map(r => r.days)) + ' day' + (Math.min(...rs.map(r => r.days)) === 1 ? '' : 's'), on.length ? 'On' : 'Paused', when, res.total]);
    plinks.push(res.total ? { org: res.items.map(i => i.key).join(SEP), to: res.items.reduce((m, i) => i.to > m ? i.to : m, '') } : null);
    for (const it of res.items) { rows.push([name(id), it.name, it.count, it.oldest, it.days + ' day' + (it.days === 1 ? '' : 's')]); rlinks.push({ org: it.key, to: it.to }); if (it.to > maxTo) maxTo = it.to; }
  }
  // every DC counted once, however many people are told about it
  const memo = new Map(), keys = new Map(); for (const o of seen) { const g = ctx.groupOf(o, memo); keys.set(g.key, g.name); }
  return { people, rows, total: seen.size, persons: byAgent.size, companies: keys.size, rlinks, plinks, all: seen.size ? { org: [...keys.keys()].join(SEP), to: maxTo } : null };
}

module.exports = { rules, set, forUser, orgSet, compute, dayBefore, prefs, setPrefs, bind, report };
