// Contact + tracking helpers:
//  * search()      find orders by PO / P.R / CN / order id (partial numbers work) and return who to call
//  * handlerOf()   the team member who looks after an organization (main person, then backup)
//  * suggestion()  when the customer's last message is a tracking question, prepare the reply a team member can send with one tap
const store = require('./store');
const orders = require('./orders');
const writeback = require('./writeback');

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = s => String(s || '').replace(/\D/g, '');
const agentById = id => store.db.agents.find(a => a.id === id);

// a phone number the way WhatsApp wants it (country code, digits only). Local Pakistani numbers (03xx…) become 92 3xx…
function waNumber(p) {
  let d = digits(p); if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  return d;
}
const contactOf = a => a ? { id: a.id, name: a.name, role: a.role === 'admin' ? 'Administrator' : (a.title || 'Team member'), phone: waNumber(a.phone), active: a.active !== false } : null;

function orgFor(name) {
  const n = norm(name); if (!n) return null;
  const hit = (store.db.organizations || []).find(o => [o.name, ...(o.aliases || [])].some(x => { const v = norm(x); return v && (v === n || (v.length >= 4 && (n.includes(v) || v.includes(n)))); }));
  return hit || null;
}
// who handles this organization (main person first, then backup if the main person is off duty)
function handlerOf(orgName) {
  const o = orgFor(orgName); if (!o) return { org: null, handler: null, backup: null };
  const main = agentById(o.agentId), backup = agentById(o.backupAgentId);
  const handler = main && main.active ? main : backup && backup.active ? backup : main || backup || null;
  return { org: o, handler: contactOf(handler), backup: contactOf(handler === backup ? main : backup) };
}

function describe(o) {
  let h = handlerOf(o.organization); if (!h.org) h = handlerOf(o.company); // sheet name is often the company name (e.g. BAFL)
  return {
    orderId: o.orderId, po: o.po || '', pr: o.pr || '', cn: o.cn || '', status: o.status || 'Pending', company: o.company || o.organization || '',
    customer: o.customer || '', customerPhone: waNumber(o.phone), courier: o.courier || '', receivedBy: o.receivedBy || '', link: o.link || '', trackUrl: orders.isUrl(o.link) ? orders.dlLink(o.link) : orders.trackUrl(o), updated: o.updated || '', notes: o.notes || '',
    organization: h.org ? h.org.name : (o.organization || o.company || ''), handler: h.handler, backup: h.backup,
    added: o.addedAt || 0, cls: orders.classOf(o), billed: orders.billedOf(o), day: o.orderDay || '',
    details: (o.extra || []).filter(([, v, vis]) => vis !== 0 && v && !orders.isUrl(v)).map(([l, v]) => [l, String(v)]),
    links: (o.extra || []).filter(([l, v, vis]) => vis !== 0 && orders.isUrl(v)).map(([l, v]) => [l, orders.dlLink(v)]),
    text: orders.formatOrder(o, { links: true }), src: o.src || '', row: o.row || 0, edit: writeback.capability(o), editedBy: o.editedBy || '',
    sheet: [...(o.extra || []), ...(o.mapped || [])].map(([l, v]) => [l, String(v)]), // every column of the sheet row (for the table's Columns menu)
  };
}

// partial match: "3668" finds PO 366809. Exact matches are listed first.
function search(q, limit = 30, allow) {
  const raw = String(q || '').trim(); if (raw.length < 2) return [];
  const id = orders.normId(raw), d = digits(raw), t = norm(raw);
  const scored = [];
  for (const o of store.db.orders) {
    if (allow && !allow(o)) continue;
    const ids = [o.orderId, o.po, o.pr, o.cn].filter(Boolean).map(orders.normId);
    let sc = 0;
    if (id && ids.includes(id)) sc = 100;
    else if (id.length >= 3 && ids.some(v => v.includes(id))) sc = 60;
    else if (d.length >= 7 && digits(o.phone).slice(-9) === d.slice(-9)) sc = 50;
    else if (t.length >= 3 && [o.customer, o.company, o.organization].some(x => norm(x).includes(t))) sc = 30;
    if (sc) scored.push([sc, o]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, o]) => describe(o));
}

// no number typed, only filters (company / status group / dates): the matching orders, newest first
function list(allow, limit = 60) {
  const all = store.db.orders.filter(o => !allow || allow(o)).sort((a, b) => String(b.orderDay || '').localeCompare(String(a.orderDay || '')) || (b.addedAt || 0) - (a.addedAt || 0));
  return { total: all.length, rows: all.slice(0, limit).map(describe) };
}

// ---------- auto suggestion inside a chat ----------
const TRACK_WORDS = /\b(track|tracking|status|where|dispatch(ed)?|deliver(y|ed)?|shipment|shipped|parcel|consignment|cn|po|p\.?\s?r|pr|req|order|kahan|kab|update)\b/i;
function orgNamesOf(conv) {
  const o = conv.orgId && store.db.organizations.find(x => x.id === conv.orgId);
  const names = o ? [o.name, ...(o.aliases || [])] : conv.orgName && !conv.retailId ? [conv.orgName] : [];
  if (conv.retailName) names.push(conv.retailName);
  return names;
}
function lastWaiting(conv) {
  const msgs = store.db.messages.filter(m => m.phone === conv.phone && m.dir !== 'sys');
  const last = msgs[msgs.length - 1];
  return last && last.dir === 'in' ? last : null; // only while the customer is still waiting for an answer
}
function suggestion(conv) {
  if (!conv || conv.status === 'resolved') return null;
  const m = lastWaiting(conv); if (!m) return null;
  const text = m.text || '';
  const names = orgNamesOf(conv);
  let found = orders.lookup(text, names), reason = '';
  if (found.length) reason = 'The customer sent a PO / P.R / CN number';
  else if (TRACK_WORDS.test(text)) {
    found = orders.findByPhone(conv.phone); reason = found.length ? 'The customer asked about an order (orders on this phone number)' : '';
    if (!found.length && names.length) { found = store.db.orders.filter(o => { const c = norm(o.company || o.organization); return c && names.some(n => { n = norm(n); return n.length >= 3 && (c === n || c.includes(n) || n.includes(c)); }); }).slice(-3).reverse(); reason = found.length ? `The customer asked about an order (latest for ${names[0]})` : ''; }
  }
  if (!found.length) return TRACK_WORDS.test(text) ? { reason: 'The customer asked about tracking, but no order matches yet. Ask for the PO / P.R / CN number.', orders: [], text: 'Please share your *PO number*, *P.R number* or *CN (tracking) number* and I will check it for you right away.', since: m.ts } : null;
  const list = found.slice(0, 5);
  return { reason, orders: list.map(describe), since: m.ts, text: list.map(o => orders.formatOrder(o, { links: true })).join('\n\n') + (found.length > 5 ? `\n\n…and ${found.length - 5} more. Tell me a specific PO / CN number to see it.` : '') };
}

// what to say when a customer asks to call someone
function callText(conv) {
  const a = agentById(conv.agentId) || (conv.orgId && (() => { const o = store.db.organizations.find(x => x.id === conv.orgId); return o && agentById(o.agentId); })()) || (conv.orgName && handlerOf(conv.orgName).handler && agentById(handlerOf(conv.orgName).handler.id));
  if (!a) return null;
  const n = waNumber(a.phone);
  if (!n) return `*${a.name}* looks after your account. They will call or message you as soon as they are free. 🙏`;
  return `📞 *${a.name}* looks after your account.\n\nCall: +${n}\nWhatsApp: https://wa.me/${n}`;
}

module.exports = { list, search, handlerOf, suggestion, describe, callText, waNumber, contactOf, orgFor };
