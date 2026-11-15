// ERP integration — connect ANY ERP / accounting / shop system, three ways (use one or all):
//  1. PULL   the desk reads a REST / JSON / OData address (or a CSV export link) of the ERP every few minutes.
//  2. PUSH   the ERP sends orders to the desk:  POST /api/erp/push  with the API key (and may read them back: GET /api/erp/orders).
//  3. HOOKS  the desk tells the ERP when an order's status is changed here (webhook, or any request with your own body).
// Orders from an ERP are ordinary orders: they show in Overview, Find PO, Order tracking and are answered on WhatsApp.
const crypto = require('crypto');
const store = require('./store');
const orders = require('./orders');

const box = () => (store.db.erp = store.db.erp || { connections: [], push: { enabled: false, hash: '', hint: '', last: 0, lastCount: 0, lastError: '' }, hooks: [] });
const norm = orders.norm;
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

// ---------- ready-made starting points (check the field names against your own system) ----------
const PRESETS = [
  { id: 'rest', label: 'Any REST / JSON API', hint: 'Paste the address that returns your orders as JSON.', kind: 'rest', url: '', listPath: '', auth: 'bearer', map: {} },
  { id: 'csv', label: 'CSV export link', hint: 'Any ERP that can export orders to a CSV file at a web address (or on a shared drive link).', kind: 'csv', url: '', auth: 'none', map: {} },
  { id: 'erpnext', label: 'ERPNext / Frappe', hint: 'Address: https://YOUR-SITE/api/resource/Sales Order?fields=["name","customer","status","po_no","transaction_date","delivery_date"]&limit_page_length=1000. Header Authorization = token API_KEY:API_SECRET.', kind: 'rest', url: 'https://YOUR-SITE/api/resource/Sales Order?fields=["name","customer","status","po_no","transaction_date","delivery_date"]&limit_page_length=1000', listPath: 'data', auth: 'header', authName: 'Authorization', authValue: 'token API_KEY:API_SECRET', map: { orderId: 'name', po: 'po_no', customer: 'customer', status: 'status', orderDate: 'transaction_date' } },
  { id: 'bc', label: 'Microsoft Dynamics 365 Business Central', hint: 'Address: https://api.businesscentral.dynamics.com/v2.0/TENANT/ENVIRONMENT/api/v2.0/companies(ID)/salesOrders. Use a Bearer access token.', kind: 'rest', url: 'https://api.businesscentral.dynamics.com/v2.0/TENANT/ENVIRONMENT/api/v2.0/companies(COMPANY-ID)/salesOrders', listPath: 'value', next: '@odata.nextLink', auth: 'bearer', map: { orderId: 'number', po: 'externalDocumentNumber', customer: 'customerName', status: 'status', orderDate: 'orderDate' } },
  { id: 'sap', label: 'SAP S/4HANA / Business One (OData)', hint: 'Address: https://YOUR-SAP/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json. Basic sign-in.', kind: 'rest', url: 'https://YOUR-SAP/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder?$format=json', listPath: 'd.results', next: 'd.__next', auth: 'basic', map: { orderId: 'SalesOrder', po: 'PurchaseOrderByCustomer', customer: 'SoldToParty', status: 'OverallSDProcessStatus', orderDate: 'SalesOrderDate' } },
  { id: 'odoo', label: 'Odoo (JSON-2 API)', hint: 'Method POST to https://YOUR-ODOO/json/2/sale.order/search_read with an API key as Bearer token and body {"fields":["name","partner_id","state","client_order_ref","date_order"],"limit":1000}.', kind: 'rest', method: 'POST', url: 'https://YOUR-ODOO/json/2/sale.order/search_read', body: '{"fields":["name","partner_id","state","client_order_ref","date_order"],"limit":1000}', listPath: '', auth: 'bearer', map: { orderId: 'name', po: 'client_order_ref', customer: 'partner_id', status: 'state', orderDate: 'date_order' } },
  { id: 'push', label: 'My ERP will send the orders (Push API)', hint: 'No address needed here: use the Push API box below and give the key to your ERP developer.', kind: 'none' },
];

// ---------- reading values out of the ERP's records ----------
function dig(obj, path) {
  if (obj == null || !path) return undefined;
  if (typeof obj === 'object' && path in obj) return obj[path];
  let cur = obj; for (const p of String(path).split('.')) { if (cur == null) return undefined; cur = Array.isArray(cur) && /^\d+$/.test(p) ? cur[+p] : cur[p]; }
  return cur;
}
// anything -> short text. Objects use their name ({ id: 5, name: "Acme" } / Odoo [5, "Acme"]), "/Date(1700000000000)/" and epoch numbers become dates.
function text(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'string' ? v[1] : v.map(text).filter(Boolean).join(', ');
  if (typeof v === 'object') return text(v.name || v.display_name || v.label || v.title || v.displayName || v.value || v.code || v.id || '');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim(), m = /^\/Date\((-?\d+)/.exec(s); if (m) return new Date(+m[1]).toISOString().slice(0, 10);
  return s;
}
const asDay = v => { if (typeof v === 'number' && v > 1e9) return new Date(v < 1e12 ? v * 1000 : v).toISOString().slice(0, 10); return orders.parseDay(text(v)) || ''; };
function flat(rec) { // { "customer.name": "Acme", "po": "123" } two levels deep
  const out = {};
  for (const [k, v] of Object.entries(rec || {})) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) { for (const [k2, v2] of Object.entries(v)) if (v2 == null || typeof v2 !== 'object') out[k + '.' + k2] = v2; }
    else out[k] = v;
  }
  return out;
}

// one ERP record -> one order of the desk
function toOrder(rec, conn) {
  const map = (conn && conn.map) || {}, fl = flat(rec), o = {}, used = new Set();
  for (const [k, , aliases] of orders.FIELDS) {
    let key = map[k] === '-' ? '' : map[k] || '';
    if (!key) key = Object.keys(fl).find(h => h === k || aliases.includes(norm(h))) || '';
    if (key) used.add(key);
    o[k] = k === 'orderDate' ? clip(key ? text(dig(rec, key)) : '', 40) : clip(key ? text(dig(rec, key)) : '', 300);
    if (k === 'orderDate' && key) o._day = asDay(dig(rec, key));
  }
  o.orderId = o.orderId || o.po || o.pr || o.cn || '';
  if (!o.orderId) return null; // nothing to identify the order by
  if (!o.status) o.status = o.cn && o.cn.toLowerCase() === 'self' ? 'Self collection' : o.cn ? 'Dispatched' : 'Pending dispatch';
  o.orderDay = o._day || orders.parseDay(o.orderDate); delete o._day;
  const company = o.organization || (conn && (conn.company || conn.name)) || 'ERP';
  o.organization = company; o.company = company;
  const nice = /address|location|branch|city|date|package|pieces|qty|quantity|weight|item|product|description|invoice|dc no|cost|total|amount/i;
  o.extra = Object.entries(fl).filter(([k, v]) => !used.has(k) && !used.has(k.split('.')[0]) && v != null && text(v) !== '').slice(0, 60).map(([k, v]) => [k, clip(text(v), 200), nice.test(k) ? 1 : 0]);
  return o;
}

// write a batch of orders into the desk. 'replace' = this source's orders are exactly this batch; 'merge' = add / update (matched by PO / P.R / CN / order id)
function commit(list, src, mode) {
  const db = store.db, key = orders.keyOf, now = Date.now();
  const mine = db.orders.filter(o => o.src === src), before = new Map(mine.map(o => [key(o), o])), first = !mine.length;
  const fresh = list.map(o => { const old = before.get(key(o)); return { ...o, src, addedAt: old ? (old.addedAt || 0) : first ? 0 : now, updated: o.updated || new Date().toISOString().slice(0, 10) }; });
  const others = db.orders.filter(o => o.src !== src);
  let keep = fresh;
  if (mode === 'merge') { const by = new Map(mine.map(o => [key(o), o])); for (const o of fresh) by.set(key(o), { ...(by.get(key(o)) || {}), ...o }); keep = [...by.values()]; }
  db.orders = [...others, ...keep]; store.save(); return { count: fresh.length, total: keep.length };
}

// ---------- 1. PULL ----------
function csvRows(t) { // small RFC-4180 reader
  const rows = []; let row = [], cur = '', q = false; t = String(t).replace(/^﻿/, '');
  const delim = ((t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length) ? ';' : (t.split('\n')[0].includes('\t') ? '\t' : ',');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === delim) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  const head = (rows.shift() || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
  return rows.filter(r => r.some(c => String(c).trim())).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}
function reqOf(conn, url) {
  const h = { Accept: 'application/json, text/csv, */*', 'User-Agent': 'WhatsAppDesk-ERP/1.0' }; let u = url || conn.url;
  const a = conn.auth || 'none';
  if (a === 'bearer' && conn.token) h.Authorization = 'Bearer ' + conn.token;
  else if (a === 'basic') h.Authorization = 'Basic ' + Buffer.from((conn.user || '') + ':' + (conn.pass || '')).toString('base64');
  else if (a === 'header' && conn.authName) h[conn.authName] = conn.authValue || '';
  else if (a === 'query' && conn.authName) { const x = new URL(u); x.searchParams.set(conn.authName, conn.authValue || ''); u = x.toString(); }
  for (const [k, v] of Object.entries(conn.headers || {})) if (k && v != null) h[k] = String(v);
  const method = (conn.method || 'GET').toUpperCase(), init = { method, headers: h, signal: AbortSignal.timeout(45000), redirect: 'follow' };
  if (method !== 'GET' && conn.body) { init.body = conn.body; h['Content-Type'] = h['Content-Type'] || 'application/json'; }
  return [u, init];
}
async function fetchPage(conn, url) {
  if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('The address must start with http:// or https://');
  const [u, init] = reqOf(conn, url); let r;
  try { r = await fetch(u, init); } catch (e) { throw new Error(e.name === 'TimeoutError' ? 'The ERP did not answer within 45 seconds.' : 'Could not reach the ERP: ' + (e.cause && e.cause.code ? e.cause.code : e.message)); }
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 60e6) throw new Error('The ERP answer is larger than 60 MB. Narrow the request (date filter / limit).');
  const body = buf.toString('utf8');
  if (!r.ok) throw new Error(`The ERP answered ${r.status}${/401|403/.test(r.status) ? ' (not allowed: check the key / password)' : ''}: ${body.replace(/\s+/g, ' ').slice(0, 160)}`);
  return body;
}
async function fetchAll(conn, limitPages = 200) {
  if (conn.kind === 'csv') return csvRows(await fetchPage(conn, conn.url));
  const out = []; let url = conn.url;
  for (let page = 1; page <= limitPages; page++) {
    let body = await fetchPage(conn, url), j; try { j = JSON.parse(body); } catch { throw new Error('The ERP did not return JSON. First 100 characters: ' + body.replace(/\s+/g, ' ').slice(0, 100)); }
    let list = conn.listPath ? dig(j, conn.listPath) : Array.isArray(j) ? j : (Object.values(j || {}).find(Array.isArray) || (j && typeof j === 'object' && Object.values(j).map(v => v && typeof v === 'object' && Object.values(v).find(Array.isArray)).find(Boolean)));
    if (!Array.isArray(list)) throw new Error(conn.listPath ? `No list found at "${conn.listPath}" in the ERP answer.` : 'Could not find the list of orders in the ERP answer. Type where it is in "List is at" (for example data or value).');
    out.push(...list); if (out.length > 200000) break;
    let nxt = '';
    if (conn.next) { nxt = text(dig(j, conn.next)); if (nxt && !/^https?:/i.test(nxt)) nxt = new URL(nxt, url).toString(); }
    else if (conn.pageParam && list.length >= (+conn.pageSize || 1)) { const x = new URL(conn.url); x.searchParams.set(conn.pageParam, String(page + 1)); if (conn.sizeParam && conn.pageSize) x.searchParams.set(conn.sizeParam, String(conn.pageSize)); nxt = x.toString(); }
    if (!nxt || !list.length || nxt === url) break; url = nxt;
  }
  return out;
}
const srcId = c => 'erp_' + c.id;
const running = new Set();
async function pull(id) {
  const c = box().connections.find(x => x.id === id); if (!c) throw new Error('Connection not found.');
  if (running.has(id)) throw new Error('A sync is already running.'); running.add(id);
  try {
    const rows = await fetchAll(c), list = rows.map(r => toOrder(r, c)).filter(Boolean);
    if (rows.length && !list.length) throw new Error('The ERP returned records but none has an order number. Choose the PO / Order ID field in "Field mapping".');
    const r = commit(list, srcId(c), 'replace'); Object.assign(c, { lastSync: Date.now(), lastError: '', lastCount: r.count }); store.save(); return r;
  } catch (e) { c.lastError = e.message; c.lastFailed = Date.now(); store.save(); throw e; }
  finally { running.delete(id); }
}
// try the connection without importing: first records, the fields found, and what the desk would make of them
async function test(conn) {
  const rows = await fetchAll({ ...conn }, 1), sample = rows[0] ? flat(rows[0]) : {};
  const fields = [...new Set(rows.slice(0, 20).flatMap(r => Object.keys(flat(r))))].slice(0, 120);
  const preview = rows.slice(0, 3).map(r => toOrder(r, conn)).filter(Boolean).map(o => ({ orderId: o.orderId, po: o.po, pr: o.pr, cn: o.cn, status: o.status, customer: o.customer, company: o.company, day: o.orderDay, class: orders.classOf(o) }));
  return { count: rows.length, fields, sample: Object.fromEntries(Object.entries(sample).slice(0, 30).map(([k, v]) => [k, clip(text(v), 80)])), preview };
}

// ---------- connections (add / edit) ----------
const SECRETS = ['token', 'pass', 'authValue'];
const view = c => ({ id: c.id, name: c.name, kind: c.kind || 'rest', preset: c.preset || '', url: c.url || '', method: c.method || 'GET', body: c.body || '', listPath: c.listPath || '', next: c.next || '', pageParam: c.pageParam || '', sizeParam: c.sizeParam || '', pageSize: c.pageSize || '',
  auth: c.auth || 'none', user: c.user || '', authName: c.authName || '', headers: c.headers || {}, map: c.map || {}, company: c.company || '', minutes: c.minutes || 15, enabled: c.enabled !== false,
  has: Object.fromEntries(SECRETS.map(k => [k, !!c[k]])), lastSync: c.lastSync || 0, lastError: c.lastError || '', lastCount: c.lastCount || 0, orders: store.db.orders.filter(o => o.src === srcId(c)).length, syncing: running.has(c.id) });
function save(id, b) {
  const list = box().connections; let c = id ? list.find(x => x.id === id) : null; if (id && !c) throw new Error('Connection not found.');
  const name = clip(b.name, 60).trim(); if (!name && !c) throw new Error('Give the connection a name, e.g. the ERP: Odoo.');
  if (!c) { c = { id: store.nextId('erp'), enabled: true, minutes: 15 }; list.push(c); }
  if (name) { if (list.some(x => x !== c && x.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a connection called "${name}".`); c.name = name; }
  for (const k of ['kind', 'preset', 'url', 'method', 'body', 'listPath', 'next', 'pageParam', 'sizeParam', 'user', 'authName', 'company', 'auth']) if (b[k] !== undefined) c[k] = clip(b[k], 4000).trim();
  if (c.kind !== 'csv') c.kind = 'rest';
  if (!['none', 'bearer', 'basic', 'header', 'query'].includes(c.auth)) c.auth = 'none';
  if (!['GET', 'POST'].includes((c.method || 'GET').toUpperCase())) c.method = 'GET'; else c.method = (c.method || 'GET').toUpperCase();
  if (c.url && !/^https?:\/\//i.test(c.url)) throw new Error('The address must start with http:// or https://');
  for (const k of SECRETS) if (b[k] !== undefined && b[k] !== '') c[k] = clip(b[k], 2000); else if (b['clear_' + k]) c[k] = '';
  if (b.pageSize !== undefined) c.pageSize = Math.max(0, Math.min(5000, +b.pageSize || 0)) || '';
  if (b.minutes !== undefined) c.minutes = Math.max(1, Math.min(1440, +b.minutes || 15));
  if (b.enabled !== undefined) c.enabled = !!b.enabled;
  if (b.map && typeof b.map === 'object') c.map = Object.fromEntries(Object.entries(b.map).filter(([k, v]) => orders.FIELDS.some(f => f[0] === k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, clip(v, 120).trim()]));
  if (b.headers && typeof b.headers === 'object') c.headers = Object.fromEntries(Object.entries(b.headers).filter(([k, v]) => k.trim() && /^[\w-]+$/.test(k.trim()) && v != null && String(v) !== '').slice(0, 20).map(([k, v]) => [k.trim(), clip(v, 1000)]));
  store.save(); return c;
}
function remove(id) { const c = box().connections.find(x => x.id === id); if (!c) throw new Error('Connection not found.'); box().connections = box().connections.filter(x => x !== c); store.db.orders = store.db.orders.filter(o => o.src !== srcId(c)); store.save(); }

// ---------- 2. PUSH (the ERP calls us) ----------
const sha = k => crypto.createHash('sha256').update(String(k)).digest('hex');
function newKey() { const p = box().push, key = 'wd_' + crypto.randomBytes(24).toString('hex'); p.hash = sha(key); p.hint = key.slice(0, 7) + '…' + key.slice(-4); p.enabled = true; store.save(); return key; }
function pushStatus() { const p = box().push; return { enabled: !!p.enabled && !!p.hash, hasKey: !!p.hash, hint: p.hint || '', last: p.last || 0, lastCount: p.lastCount || 0, lastError: p.lastError || '', total: store.db.orders.filter(o => o.src === 'erp_push').length }; }
function setPush(b) { const p = box().push; if (b.enabled !== undefined) p.enabled = !!b.enabled && !!p.hash; if (b.removeKey) { p.hash = ''; p.hint = ''; p.enabled = false; } store.save(); return pushStatus(); }
function keyOk(req) {
  const p = box().push; if (!p.enabled || !p.hash) return false;
  const h = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.headers['x-api-key'] || '');
  if (!h) return false; const a = Buffer.from(sha(h)), b = Buffer.from(p.hash); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// body: { "company": "BAFL", "mode": "merge" | "replace", "orders": [ { ... } ] }  or just an array of orders. Field names are recognised automatically (po, po_no, "PO Number", cn, tracking, status, customer ...).
function receive(body) {
  const p = box().push;
  try {
    const arr = Array.isArray(body) ? body : Array.isArray(body && body.orders) ? body.orders : body && typeof body === 'object' && (body.po || body.orderId || body.order_id || body.cn) ? [body] : null;
    if (!arr) throw new Error('Send {"orders":[ ... ]} or an array of orders.'); if (arr.length > 20000) throw new Error('At most 20,000 orders per request.');
    const conn = { name: 'ERP', company: clip(body && !Array.isArray(body) ? body.company : '', 80), map: body && body.map && typeof body.map === 'object' ? body.map : {} };
    const list = arr.map(r => toOrder(r && typeof r === 'object' ? r : {}, conn)).filter(Boolean);
    const mode = body && body.mode === 'replace' ? 'replace' : 'merge';
    const r = commit(list, 'erp_push', mode); Object.assign(p, { last: Date.now(), lastCount: r.count, lastError: '' }); store.save();
    return { ok: true, received: arr.length, accepted: list.length, skipped: arr.length - list.length, total: r.total };
  } catch (e) { p.lastError = e.message; p.last = Date.now(); store.save(); throw e; }
}

// ---------- 3. HOOKS (the desk tells the ERP) ----------
const fill = (t, o) => String(t || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => JSON.stringify(String(o[k] == null ? '' : o[k])).slice(1, -1));
const payload = (o, ev, by) => ({ event: ev, at: new Date().toISOString(), by: by || '', order: { orderId: o.orderId, po: o.po || '', pr: o.pr || '', cn: o.cn || '', status: o.status || '', class: orders.classOf(o), courier: o.courier || '', customer: o.customer || '', company: o.company || o.organization || '', notes: o.notes || '', updated: o.updated || '' } });
async function fire(h, o, ev, by) {
  const pl = payload(o, ev, by), flatO = { ...pl.order, event: ev, by: by || '' };
  const body = h.body ? fill(h.body, flatO) : JSON.stringify(pl), hd = { 'Content-Type': 'application/json', 'User-Agent': 'WhatsAppDesk-Hook/1.0', ...(h.headers || {}) };
  if (h.secret) hd['X-Desk-Signature'] = 'sha256=' + crypto.createHmac('sha256', h.secret).update(body).digest('hex');
  if (h.authName && h.authValue) hd[h.authName] = h.authValue;
  try {
    const r = await fetch(h.url, { method: h.method || 'POST', headers: hd, body, signal: AbortSignal.timeout(15000) }); const t = (await r.text()).slice(0, 160);
    Object.assign(h, { lastAt: Date.now(), lastStatus: r.status, lastError: r.ok ? '' : `The ERP answered ${r.status}: ${t.replace(/\s+/g, ' ')}` }); store.save(); return r.ok;
  } catch (e) { Object.assign(h, { lastAt: Date.now(), lastStatus: 0, lastError: 'Could not reach the ERP: ' + e.message }); store.save(); return false; }
}
function notify(o, ev, by) { for (const h of box().hooks) if (h.enabled !== false && h.url && (!h.events || !h.events.length || h.events.includes(ev))) fire(h, o, ev, by).catch(() => {}); }
const hookView = h => ({ id: h.id, name: h.name, url: h.url, method: h.method || 'POST', events: h.events || ['order.status'], body: h.body || '', authName: h.authName || '', hasAuth: !!h.authValue, hasSecret: !!h.secret, enabled: h.enabled !== false, lastAt: h.lastAt || 0, lastStatus: h.lastStatus || 0, lastError: h.lastError || '' });
function saveHook(id, b) {
  const list = box().hooks; let h = id ? list.find(x => x.id === id) : null; if (id && !h) throw new Error('Hook not found.');
  if (!h) { h = { id: store.nextId('hook'), enabled: true, events: ['order.status'] }; list.push(h); }
  if (b.name !== undefined) h.name = clip(b.name, 60).trim() || 'ERP hook';
  if (b.url !== undefined) { const u = clip(b.url, 1000).trim(); if (!/^https?:\/\//i.test(u)) throw new Error('The address must start with http:// or https://'); h.url = u; }
  if (b.method !== undefined) h.method = ['POST', 'PUT', 'PATCH'].includes(String(b.method).toUpperCase()) ? String(b.method).toUpperCase() : 'POST';
  if (b.body !== undefined) h.body = clip(b.body, 4000);
  if (b.authName !== undefined) h.authName = clip(b.authName, 60).trim();
  if (b.authValue) h.authValue = clip(b.authValue, 1000); if (b.clearAuth) h.authValue = '';
  if (b.secret) h.secret = clip(b.secret, 200); if (b.clearSecret) h.secret = '';
  if (Array.isArray(b.events)) h.events = b.events.filter(e => ['order.status'].includes(e));
  if (b.enabled !== undefined) h.enabled = !!b.enabled;
  if (!h.url) { box().hooks = list.filter(x => x !== h); throw new Error('Give the address the ERP listens on.'); }
  store.save(); return h;
}
const removeHook = id => { box().hooks = box().hooks.filter(h => h.id !== id); store.save(); };
const hookById = id => box().hooks.find(h => h.id === id);
const sampleOrder = () => ({ orderId: 'TEST-1', po: 'PO-0001', pr: '', cn: '123456789', status: 'Dispatched', courier: 'TCS', customer: 'Test customer', company: 'Test company', notes: 'This is a test from WhatsApp Desk', updated: new Date().toISOString().slice(0, 10) });

// ---------- schedule ----------
let ticker = null;
function tick() {
  for (const c of box().connections) {
    if (c.enabled === false || !c.url || running.has(c.id)) continue;
    if (Date.now() - (c.lastFailed && c.lastFailed > (c.lastSync || 0) ? c.lastFailed : c.lastSync || 0) >= Math.max(1, +c.minutes || 15) * 60000) pull(c.id).catch(e => console.error(`ERP sync failed (${c.name}):`, e.message));
  }
}
function start() { clearInterval(ticker); ticker = setInterval(tick, 30000); setTimeout(tick, 4000); }

const overview = () => ({ connections: box().connections.map(view), push: pushStatus(), hooks: box().hooks.map(hookView), presets: PRESETS, fields: orders.FIELDS.map(f => ({ key: f[0], label: f[1] })) });
module.exports = { overview, save, remove, pull, test, view, newKey, setPush, keyOk, receive, saveHook, removeHook, hookById, hookView, fire, notify, sampleOrder, start, toOrder, csvRows, dig, text, commit, PRESETS };
