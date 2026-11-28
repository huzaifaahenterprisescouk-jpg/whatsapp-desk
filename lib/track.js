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

// P.R number: the mapped field, else any sheet column headed P.R / PR / P.R no (the header "P.R" used to be left unmapped, so searches missed it)
const PR_H = /^(p r|pr|p r no|pr no|p r number|pr number)$/;
function prOf(o) {
  if (o.pr) return o.pr;
  for (const [l, v] of [...(o.extra || []), ...(o.mapped || [])]) { const t = String(v == null ? '' : v).trim(); if (t && PR_H.test(norm(l)) && !/^#/.test(t)) return t; }
  return '';
}
function describe(o) {
  let h = handlerOf(o.organization); if (!h.org) h = handlerOf(o.company); // sheet name is often the company name (e.g. BAFL)
  return {
    orderId: o.orderId, po: o.po || '', pr: prOf(o), cn: o.cn || '', status: o.status || 'Pending', company: o.company || o.organization || '',
    customer: o.customer || '', customerPhone: waNumber(o.phone), courier: o.courier || '', receivedBy: o.receivedBy || '', parcelCount: o.parcelCount || '', link: o.link || '', trackUrl: orders.isUrl(o.link) ? orders.dlLink(o.link) : ((orders.parcelsOf(o)[0] || {}).trackUrl || orders.trackUrl(o)), courierUrl: (orders.parcelsOf(o)[0] || {}).trackUrl || orders.trackUrl(o) || '', updated: o.updated || '', notes: o.notes || '',
    organization: h.org ? h.org.name : (o.organization || o.company || ''), handler: h.handler, backup: h.backup,
    added: o.addedAt || 0, cls: orders.classOf(o), billed: orders.billedOf(o), day: o.orderDay || '', dispatchDay: orders.dispatchDayOf(o), parcels: orders.parcelsOf(o),   // parcels: [{ n, cn, courier, day, date, trackUrl }] when the CN cell holds 1+ CNs
    details: (o.extra || []).filter(([, v, vis]) => vis !== 0 && v && !orders.isUrl(v)).map(([l, v]) => [l, String(v)]),
    links: (o.extra || []).filter(([l, v, vis]) => vis !== 0 && orders.isUrl(v)).map(([l, v]) => [l, orders.dlLink(v)]),
    text: orders.formatOrder(o, { links: true }), src: o.src || '', row: o.row || 0, dcKey: o.dc ? `${o.src}|${orders.normId(o.dc)}` : '', dcItemCount: o.dc ? require('./dcfiles').countForOrder(o) : 0, edit: writeback.capability(o), editedBy: o.editedBy || '',
    sheet: [...(o.extra || []), ...(o.mapped || [])].map(([l, v]) => [l, String(v)]), // every column of the sheet row (for the table's Columns menu)
  };
}

// Every value of an order that can be searched: the standard fields AND every column of the sheet row
// (DC no, branch code, branch name, branch address, city, BR no, items, dates, notes ...). Returns [[label, value], ...]
function fieldsOf(o) {
  const out = [], add = (l, v) => { v = String(v == null ? '' : v).trim(); if (v && !/^#(N\/A|REF!|VALUE!)/i.test(v)) out.push([l, v]); };
  add('Order ID', o.orderId); add('PO', o.po); add('P.R', prOf(o)); add('CN', o.cn); add('DC', o.dc);
  add('Company', o.company); add('Organization', o.organization); add('Customer', o.customer); add('Phone', o.phone);
  add('Status', o.status); add('Courier', o.courier); add('Received by', o.receivedBy); add('Notes', o.notes);
  add('Branch', o.branch); add('Address', o.address); add('Order date', o.orderDay); add('Dispatch date', orders.dispatchDayOf(o));
  for (const [l, v] of [...(o.extra || []), ...(o.mapped || [])]) add(l, v);   // hidden columns are searched too
  return out;
}
const comp = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// "habib branch 0123" -> every word must be found somewhere in the order (in any column, any order); returns the matched [label, value] pairs or null
function wordsHit(tokens, fields) {
  const nv = fields.map(([, v]) => norm(v)), cv = fields.map(([, v]) => comp(v)), hits = new Map();
  for (const tk of tokens) {
    const t = norm(tk), c = comp(tk); if (!t && !c) continue;
    let found = false;
    for (let i = 0; i < fields.length; i++) {
      if ((t && nv[i].includes(t)) || (c.length >= 3 && cv[i].includes(c))) { found = true; hits.set(i, fields[i]); }
    }
    if (!found) return null;
  }
  return [...hits.values()];
}

// Search everything: PO / P.R / CN / order id (partial numbers work), DC no, branch code, branch address, customer, company,
// phone and any other column of the sheet. Exact ids are listed first, then partial ids, then the rest.
function search(q, limit = 30, allow) {
  const raw = String(q || '').trim(); if (raw.length < 2) return [];
  const id = orders.normId(raw), d = digits(raw), t = norm(raw), tokens = raw.replace(/["']/g, ' ').split(/[\s,;]+/).filter(Boolean);
  const scored = [];
  for (const o of store.db.orders) {
    if (allow && !allow(o)) continue;
    const f = fieldsOf(o), ids = [o.orderId, o.po, prOf(o), o.cn, o.dc, ...orders.splitCns(o.cn)].filter(Boolean).map(orders.normId);
    let sc = 0, matched = null;
    // the whole number typed equals a value of the row (DC no, PO, P.R, CN, branch code ... in any column): an exact hit
    if (id.length >= 3 && (ids.includes(id) || f.some(([, v]) => comp(v) === id))) { sc = 100; const m = f.filter(([, v]) => comp(v) === id); if (m.length && !ids.includes(id)) matched = m; }
    else if (id.length >= 3 && ids.some(v => v.includes(id))) sc = 60;
    else if (d.length >= 7 && digits(o.phone).slice(-9) === d.slice(-9)) sc = 50;
    else if (t.length >= 3 && [o.customer, o.company, o.organization].some(x => norm(x).includes(t))) sc = 30;
    else { const h = wordsHit(tokens, f); if (h) { sc = 20 + Math.min(h.length, 5); matched = h; } }   // found in any other column (branch code, address ...)
    if (sc) scored.push([sc, o, matched]);
  }
  // a number that matches exactly: show only those, not the partial / similar ones (63422 must not bring 62422 or 163422)
  if (scored.some(x => x[0] === 100)) { for (let i = scored.length - 1; i >= 0; i--) if (scored[i][0] !== 100) scored.splice(i, 1); }
  // nothing found for a long number: offer numbers that differ by ONE digit (a typo such as 449640 for 449690)
  if (!scored.length && id.length >= 5) {
    for (const o of store.db.orders) {
      if (allow && !allow(o)) continue;
      const ids = [o.orderId, o.po, prOf(o), o.cn, o.dc, ...orders.splitCns(o.cn)].filter(Boolean).map(orders.normId);
      if (ids.some(v => v.length === id.length && [...v].filter((c, i) => c !== id[i]).length === 1)) scored.push([20, o]);
    }
    return scored.slice(0, limit).map(([, o]) => ({ ...describe(o), near: true }));
  }
  const day = o => String(o.orderDay || '');
  return scored.sort((a, b) => b[0] - a[0] || day(b[1]).localeCompare(day(a[1])) || (b[1].addedAt || 0) - (a[1].addedAt || 0)).slice(0, limit)
    .map(([, o, m]) => { const r = describe(o); if (m) r.matched = m.slice(0, 4).map(([l, v]) => [l, v.length > 90 ? v.slice(0, 90) + '…' : v]); return r; });
}

// no number typed, only filters (company / status group / dates): the matching orders, newest first
function list(allow, limit = 60) {
  const all = store.db.orders.filter(o => !allow || allow(o)).sort((a, b) => String(b.orderDay || '').localeCompare(String(a.orderDay || '')) || (b.addedAt || 0) - (a.addedAt || 0));
  return { total: all.length, rows: all.slice(0, limit).map(describe) };
}

// DC files: one page of the DCs of the allowed companies, newest first. q = words that must all be found, in one field (field = DC / PO / P.R / CN / company / a sheet column) or in any field.
// Returns the rows of this page, how many DCs match, how many DCs there are without the text filter, and the sheets the pool comes from.
function fieldValue(o, field) {
  switch (field) {
    case 'dcno': return [o.dc]; case 'po': return [o.po, o.orderId]; case 'pr': return [prOf(o)]; case 'cn': return [o.cn]; case 'company': return [o.company, o.organization];
    case 'customer': return [o.customer]; case 'courier': return [o.courier]; case 'status': return [o.status]; case 'date': return [o.orderDay];
    case 'billing': return [orders.billedOf(o) ? 'Billed in ERP' : 'Non billed'];
  }
  if (String(field).startsWith('d:')) { const want = String(field).slice(2); return [...(o.extra || []), ...(o.mapped || [])].filter(([l]) => l === want).map(([, v]) => v); }
  return fieldsOf(o).map(([, v]) => v);
}
function page(allow, { q = '', field = '', offset = 0, limit = 100 } = {}) {
  const pool = store.db.orders.filter(o => !allow || allow(o)).sort((a, b) => String(b.orderDay || '').localeCompare(String(a.orderDay || '')) || (b.addedAt || 0) - (a.addedAt || 0));
  const words = String(q || '').toLowerCase().split(/\s+/).map(comp).filter(Boolean);
  const hit = !words.length ? pool : pool.filter(o => { const h = comp(fieldValue(o, field).join(' ')); return words.every(w => h.includes(w)); });
  return { total: hit.length, pool: pool.length, srcs: [...new Set(pool.map(o => o.src))], rows: hit.slice(offset, offset + limit).map(describe) };
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

module.exports = { page, list, search, handlerOf, suggestion, describe, callText, waNumber, contactOf, orgFor };
