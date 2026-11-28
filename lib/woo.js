// WordPress / WooCommerce: pulls the shop's orders and products, sends the customer a PDF order confirmation on WhatsApp when a new
// order arrives, and lets the team send products (as a catalog card or a picture + price + link).
//
// Connect once: WooCommerce → Settings → Advanced → REST API → Add key (Read access is enough) → paste the Store address,
// Consumer key and Consumer secret in the desk (Store → Connection). Optional: a WooCommerce webhook (Order created) pointing at
// https://YOUR-DESK/webhooks/woo makes new orders arrive at once instead of within a few minutes.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const store = require('./store'), appCfg = require('./config'), invoice = require('./invoice'), courier = require('./courier');
const bot = () => require('./bot'), wa = () => require('./whatsapp');

const DEF = {
  url: '', key: '', secret: '', webhookSecret: '', minutes: 5, autoPdf: true, sendStatuses: 'processing,on-hold,completed', countryCode: '92',
  catalogId: '', idFormat: 'fb', storeName: '',
  storeCurrency: '', baseCurrency: '', showCurrency: '', rateMode: 'auto', manualRate: 0, markup: 0, roundWhole: true, rate: { value: 0, at: 0, pair: '', error: '' },
  msg: 'Hi {name}, thank you for your order *#{number}* at {business}! 🎉\nYour order confirmation (PDF) is attached.\n*Total: {total}*',
  brand: { name: '', address: '', phone: '', email: '', website: '', taxId: '', color: '#0f766e', footer: '', thanks: '', title: 'Order confirmation' },
  lastSync: 0, lastProducts: 0, lastError: '', counts: { products: 0, orders: 0 },
  auth: 'basic', route: 'pretty',           // what worked last time with this host: Basic header or ?consumer_key=, /wp-json/ or ?rest_route= (found automatically)
  requireApproval: true,                    // every WhatsApp message to a customer waits for the administrator to approve it
  notify: { on: true, events: { processing: false, 'on-hold': false, completed: true, cancelled: true, refunded: true, failed: false, tracking: true }, msgs: {} },
};
const EVENTS = { new: 'New order', processing: 'Processing', 'on-hold': 'On hold', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Payment failed', tracking: 'Shipped / tracking added' };
const MSG_DEF = {
  processing: 'Hi {name}, your order *#{number}* is now being prepared. 📦\n*Total: {total}*',
  'on-hold': 'Hi {name}, your order *#{number}* is on hold for now. We will message you as soon as it moves again.',
  completed: 'Hi {name}, your order *#{number}* is complete. Thank you for shopping with {business}! 🙏{tracking}',
  cancelled: 'Hi {name}, your order *#{number}* has been cancelled. If you did not ask for this, please reply to this message and we will help you.',
  refunded: 'Hi {name}, your order *#{number}* has been refunded (*{total}*). It reaches you in the time your bank / payment provider takes.',
  failed: 'Hi {name}, the payment for your order *#{number}* did not go through. Reply here and we will help you complete it.',
  tracking: 'Hi {name}, your order *#{number}* is on its way 🚚{tracking}',
};
const W = () => {
  const w = (store.db.woo = store.db.woo || {});
  for (const k of Object.keys(DEF)) if (w[k] === undefined) w[k] = JSON.parse(JSON.stringify(DEF[k]));
  w.brand = { ...DEF.brand, ...w.brand };
  w.notify = { ...DEF.notify, ...(w.notify || {}) }; w.notify.events = { ...DEF.notify.events, ...(w.notify.events || {}) }; w.notify.msgs = w.notify.msgs || {};
  if (!w.webhookSecret) { w.webhookSecret = crypto.randomBytes(16).toString('hex'); store.save(); }
  return w;
};
const configured = () => { const w = W(); return !!(w.url && w.key && w.secret); };
const orders = () => (store.db.wooOrders = store.db.wooOrders || {});
const LOGO = () => path.join(path.dirname(appCfg.dataFile), 'brand-logo.bin');
const logoBuf = () => { try { return fs.readFileSync(LOGO()); } catch { return null; } };

// ---------- settings ----------
function publicStatus() {
  const w = W();
  return { url: w.url, key: w.key, hasSecret: !!w.secret, webhookSecret: w.webhookSecret, minutes: w.minutes, autoPdf: w.autoPdf, sendStatuses: w.sendStatuses, countryCode: w.countryCode,
    catalogId: w.catalogId, idFormat: w.idFormat, msg: w.msg, brand: w.brand, hasLogo: !!logoBuf(), storeName: w.storeName, connected: configured(), lastSync: w.lastSync, lastProducts: w.lastProducts,
    lastError: w.lastError, requireApproval: w.requireApproval, notify: { on: w.notify.on, events: w.notify.events, msgs: { ...MSG_DEF, ...w.notify.msgs }, defaults: MSG_DEF, labels: EVENTS }, pending: outbox().filter(x => x.state === 'pending').length, currency: currencyStatus(), counts: { products: (store.db.wooProducts || []).length, orders: Object.keys(orders()).length }, apiMode: wa().mode(), businessName: store.db.settings.businessName };
}
const cleanUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/\/(wp-admin|wp-json|wp-login\.php)(\/.*)?$/i, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); };
function setConfig(b) {
  const w = W();
  if (b.url !== undefined) { const n = cleanUrl(b.url); if (n !== w.url) { w.auth = 'basic'; w.route = 'pretty'; } w.url = n; }
  if (b.key !== undefined) w.key = String(b.key).trim();
  if (b.secret) w.secret = String(b.secret).trim();
  if (b.minutes !== undefined) w.minutes = Math.min(1440, Math.max(1, +b.minutes || 5));
  if (b.autoPdf !== undefined) w.autoPdf = !!b.autoPdf;
  if (b.requireApproval !== undefined) w.requireApproval = !!b.requireApproval;
  if (b.notify && typeof b.notify === 'object') {
    if (b.notify.on !== undefined) w.notify.on = !!b.notify.on;
    if (b.notify.events && typeof b.notify.events === 'object') for (const k of Object.keys(DEF.notify.events)) if (b.notify.events[k] !== undefined) w.notify.events[k] = !!b.notify.events[k];
    if (b.notify.msgs && typeof b.notify.msgs === 'object') for (const k of Object.keys(MSG_DEF)) if (b.notify.msgs[k] !== undefined) { const t = String(b.notify.msgs[k]).slice(0, 800).trim(); if (t && t !== MSG_DEF[k]) w.notify.msgs[k] = t; else delete w.notify.msgs[k]; }
  }
  if (b.sendStatuses !== undefined) w.sendStatuses = String(b.sendStatuses).toLowerCase().replace(/[^a-z,\- ]/g, '').trim() || DEF.sendStatuses;
  if (b.countryCode !== undefined) w.countryCode = String(b.countryCode).replace(/\D/g, '');
  if (b.catalogId !== undefined) w.catalogId = String(b.catalogId).replace(/\D/g, '');
  if (b.idFormat !== undefined) w.idFormat = ['fb', 'sku', 'id'].includes(b.idFormat) ? b.idFormat : 'fb';
  let curChanged = false;
  const cc3 = v => String(v || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (b.baseCurrency !== undefined) { w.baseCurrency = cc3(b.baseCurrency); curChanged = true; }
  if (b.showCurrency !== undefined) { w.showCurrency = cc3(b.showCurrency); curChanged = true; }
  if (b.rateMode !== undefined) { w.rateMode = b.rateMode === 'manual' ? 'manual' : 'auto'; curChanged = true; }
  if (b.manualRate !== undefined) w.manualRate = Math.max(0, +b.manualRate || 0);
  if (b.markup !== undefined) w.markup = Math.min(500, Math.max(-90, +b.markup || 0));
  if (b.roundWhole !== undefined) w.roundWhole = !!b.roundWhole;
  if (curChanged) { lastRateTry = 0; refreshRate(true).catch(() => {}); }
  if (b.msg !== undefined) w.msg = String(b.msg).slice(0, 800) || DEF.msg;
  if (b.brand && typeof b.brand === 'object') for (const k of Object.keys(DEF.brand)) if (b.brand[k] !== undefined) w.brand[k] = String(b.brand[k]).slice(0, 300).trim();
  if (!/^#[0-9a-f]{6}$/i.test(w.brand.color)) w.brand.color = DEF.brand.color;
  store.save(); return publicStatus();
}
function setLogo(dataUrl) {
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '')); if (!m) throw new Error('Please choose a PNG or JPG picture.');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) throw new Error('That picture is too big (3 MB at most).');
  invoice.readImage(buf); // throws if it cannot be used in the PDF
  fs.mkdirSync(path.dirname(LOGO()), { recursive: true }); fs.writeFileSync(LOGO(), buf); return publicStatus();
}
function removeLogo() { try { fs.unlinkSync(LOGO()); } catch {} return publicStatus(); }

// ---------- WooCommerce REST ----------
// One request. auth: 'basic' (Authorization header) | 'query' (?consumer_key=&consumer_secret=); route: 'pretty' (/wp-json/...) | 'rest' (/?rest_route=/..., works when Permalinks are "Plain")
async function wcOnce(w, p, { method, q }, auth, route) {
  let u;
  if (route === 'rest') { u = new URL(w.url + '/'); u.searchParams.set('rest_route', '/wc/v3/' + p); } else u = new URL(`${w.url}/wp-json/wc/v3/${p}`);
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') u.searchParams.set(k, v);
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; WhatsApp-Desk)' };
  if (auth === 'basic' && u.protocol === 'https:') headers.Authorization = 'Basic ' + Buffer.from(`${w.key}:${w.secret}`).toString('base64');
  else { u.searchParams.set('consumer_key', w.key); u.searchParams.set('consumer_secret', w.secret); } // plain http cannot use Basic auth; some hosts strip the Authorization header
  let res;
  try { res = await fetch(u, { method, headers, signal: AbortSignal.timeout(30000) }); }
  catch (e) {
    const c = String(e.cause && (e.cause.code || e.cause.message) || e.name || e.message);
    const why = /ENOTFOUND|EAI_AGAIN/.test(c) ? 'that address does not exist (check the spelling of the shop address)' : /ECONNREFUSED/.test(c) ? 'the server refused the connection' : /CERT|SSL|TLS|self.signed|UNABLE_TO_VERIFY/i.test(c) ? 'the shop’s SSL certificate is invalid or expired (fix the certificate in your hosting panel)' : /Timeout|ETIMEDOUT|ECONNRESET|abort/i.test(c) ? 'the shop took too long to answer (or its firewall blocks this server)' : c;
    const err = new Error(`Could not reach ${w.url}: ${why}.`); err.network = true; throw err;
  }
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { res, text, json, ok: res.ok && json !== null, status: res.status };
}
function wcError(w, a) {
  if (a.res.ok && a.json === null) {
    const login = /wp-login|log in|login/i.test(a.text.slice(0, 4000)), cf = /cloudflare|just a moment|attention required|sucuri|wordfence|mod_security|imunify/i.test(a.text.slice(0, 4000));
    return new Error(cf ? 'The shop’s firewall (Cloudflare / Wordfence / security plugin) blocked this server. Allow this server’s IP address in the firewall, or switch the “Bot fight / Under attack” mode off for /wp-json/.'
      : login ? 'The address returned the WordPress login page, not shop data. Check the shop address and that no maintenance / “members only” plugin is blocking /wp-json/.'
      : 'The address did not answer like a WooCommerce shop (it returned a web page, not data). Check the shop address (the home page address, e.g. https://your-shop.com).');
  }
  const code = a.json && a.json.code ? String(a.json.code) : '', msg = a.json && a.json.message ? String(a.json.message).replace(/<[^>]+>/g, '') : `HTTP ${a.status}`;
  let hint = '';
  if (/consumer_key|consumer_secret|invalid_username|incorrect_password/i.test(code + ' ' + msg) || (a.status === 401 && !/cannot_(list|view)/.test(code))) hint = ' The Consumer key or secret is wrong (copy both again from WooCommerce → Settings → Advanced → REST API; the secret is shown only once).';
  else if (/cannot_(list|view|read)|cannot_.*resource/.test(code) || a.status === 403) hint = ' The key has no permission: create it with a user who is an Administrator / Shop manager and Read access. If it still fails, a security plugin or the host firewall is blocking the request.';
  else if (a.status === 404 || code === 'rest_no_route') hint = ' Is WooCommerce active, and is the address the shop’s home address (not /wp-admin)? Also check that no security plugin has the REST API switched off.';
  else if (a.status === 429 || a.status >= 500) hint = ' The shop’s server is busy or erroring; try again in a minute.';
  return new Error(`WooCommerce: ${msg.replace(/[.\s]+$/, '')}.${hint}`);
}
async function wc(p, { method = 'GET', q = {} } = {}) {
  const w = W(); if (!configured()) throw new Error('Enter the store address, Consumer key and Consumer secret first, then press Save.');
  const combos = [[w.auth, w.route]];
  for (const c of [['basic', 'pretty'], ['query', 'pretty'], ['basic', 'rest'], ['query', 'rest']]) if (!combos.some(x => x[0] === c[0] && x[1] === c[1])) combos.push(c);
  const tried = [];
  for (const [auth, route] of combos) {
    const a = await wcOnce(w, p, { method, q }, auth, route);
    if (a.ok) {
      let ch = false; if (w.auth !== auth) { w.auth = auth; ch = true; } if (w.route !== route) { w.route = route; ch = true; }
      try { const cut = a.res.url && (a.res.url.indexOf('/wp-json/') > 0 ? a.res.url.indexOf('/wp-json/') : a.res.url.indexOf('/?rest_route=')); if (cut > 0 && a.res.url.slice(0, cut) !== w.url && /^https?:\/\//.test(a.res.url)) { w.url = a.res.url.slice(0, cut); ch = true; } } catch {}   // the shop redirects (http → https, www): use the final address
      if (ch) store.save();
      return { json: a.json, pages: +a.res.headers.get('x-wp-totalpages') || 1, total: +a.res.headers.get('x-wp-total') || 0 };
    }
    tried.push(a);
    if (![401, 403, 404].includes(a.status) && a.json !== null) break;   // a real answer (e.g. 500, 429): trying other routes will not help
  }
  throw wcError(w, tried.find(a => a.json && a.json.code && a.json.code !== 'rest_no_route') || tried[0]);   // show the most useful answer (a wrong key beats a missing route)
}
async function all(p, q, maxPages) {
  const out = []; for (let page = 1; page <= maxPages; page++) { const r = await wc(p, { q: { ...q, per_page: 100, page } }); out.push(...r.json); if (page >= r.pages) break; }
  return out;
}
async function test() {
  const w = W(); const r1 = await wc('orders', { q: { per_page: 1 } }), r2 = await wc('products', { q: { per_page: 1 } });
  let name = ''; try { const root = await (await fetch(`${w.url}/wp-json/`, { signal: AbortSignal.timeout(15000) })).json(); name = root.name || ''; } catch {}
  if (name) { w.storeName = name; store.save(); }
  await detectCurrency().catch(() => {});
  return { storeName: name, orders: r1.total, products: r2.total };
}

// ---------- mapping ----------
const decode = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
function normPhone(raw) {
  const cc = W().countryCode; let d = String(raw || '').replace(/\D/g, ''); if (!d) return '';
  if (String(raw).trim().startsWith('+')) return d; if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return cc + d.slice(1); if (cc && d.startsWith(cc) && d.length >= 11) return d; if (cc && d.length <= 10) return cc + d; return d;
}
const addr = a => a ? [a.address_1, a.address_2, a.city, a.state, a.postcode, a.country].filter(Boolean).join(', ') : '';
const personOf = a => a ? [`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.company || ''].filter(Boolean)[0] || '' : '';
const STATUS_LABEL = { pending: 'Pending payment', processing: 'Processing', 'on-hold': 'On hold', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Failed', trash: 'Deleted' };
function tracking(o) { // Advanced Shipment Tracking (and similar) keep the courier + CN in the order's meta data
  const meta = o.meta_data || [], t = meta.find(m => m.key === '_wc_shipment_tracking_items');
  if (t && Array.isArray(t.value) && t.value[0]) { const x = t.value[0]; return { courier: x.tracking_provider || x.custom_tracking_provider || '', cn: String(x.tracking_number || ''), link: x.custom_tracking_link || '' }; }
  const num = meta.find(m => /tracking.?(number|no|id)|^_?cn$|consignment/i.test(m.key) && typeof m.value === 'string' && m.value), prov = meta.find(m => /tracking.?provider|courier|carrier/i.test(m.key) && typeof m.value === 'string' && m.value);
  return { courier: prov ? prov.value : '', cn: num ? String(num.value) : '', link: '' };
}
function detailOf(o) {
  const t = tracking(o), items = (o.line_items || []).map(i => ({ name: decode(i.name), sku: i.sku || '', qty: i.quantity, price: i.quantity ? (+i.subtotal || 0) / i.quantity : +i.price || 0, total: +i.subtotal || 0,
    meta: (i.meta_data || []).filter(m => m.display_key && !String(m.key).startsWith('_') && typeof m.display_value === 'string').map(m => `${decode(m.display_key)}: ${decode(m.display_value)}`).join(', ') }));
  const b = o.billing || {}, s = o.shipping || {};
  return { id: o.id, number: String(o.number || o.id), date: o.date_created, status: o.status, paymentMethod: o.payment_method_title || o.payment_method || '', paid: !!o.date_paid, currency: o.currency, items,
    subtotal: items.reduce((a, i) => a + i.total, 0), shippingTotal: +o.shipping_total || 0, shippingMethod: ((o.shipping_lines || [])[0] || {}).method_title || '', discount: +o.discount_total || 0, tax: +o.total_tax || 0, total: +o.total || 0,
    billing: { name: personOf(b), company: b.company || '', address: addr(b), phone: b.phone || '', email: b.email || '' }, shipping: { name: personOf(s), address: addr(s), phone: s.phone || b.phone || '' },
    note: decode(o.customer_note), courier: t.courier, cn: t.cn, trackLink: t.link, phone: normPhone(b.phone || s.phone), created: o.date_created };
}
function upsert(o) { // one WooCommerce order → the desk's order list (so customers can track it) + the detail kept for the PDF
  const d = detailOf(o), db = store.db, old = orders()[d.number];
  if (old) { d.pdfSentAt = old.pdfSentAt; d.pdfError = old.pdfError; d.seenAt = old.seenAt; d.notified = old.notified || {}; } else { d.seenAt = Date.now(); d.notified = {}; }
  orders()[d.number] = d;
  const ord = { orderId: d.number, customer: d.billing.name, phone: d.phone, organization: d.billing.company, status: STATUS_LABEL[d.status] || d.status, courier: d.courier, cn: d.cn, link: d.trackLink, updated: String(o.date_modified || o.date_created || '').slice(0, 10), notes: d.note,
    src: 'woo', company: W().storeName || 'WooCommerce', woo: true, addedAt: old ? (db.orders.find(x => x.src === 'woo' && x.orderId === d.number) || {}).addedAt || 0 : Date.now() };
  const i = db.orders.findIndex(x => x.src === 'woo' && x.orderId === d.number); if (i >= 0) db.orders[i] = ord; else db.orders.push(ord);
  const keys = Object.keys(orders()); if (keys.length > 800) for (const k of keys.sort((a, b) => orders()[a].id - orders()[b].id).slice(0, keys.length - 800)) delete orders()[k];
  return d;
}

// ---------- PDF ----------
const brandOf = () => { const w = W(), b = w.brand; return { ...b, name: b.name || store.db.settings.businessName || 'Your store', logo: logoBuf() }; };
function pdfFor(d) { return invoice.orderPdf({ ...d, trackUrl: d.trackLink || courier.trackUrl(d) }, brandOf()); }
const fill = (tpl, v) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const captionFor = d => fill(W().msg, { name: (d.billing.name || 'there').split(' ')[0], number: d.number, business: brandOf().name, total: invoice.money(d.total, d.currency) });
async function sendPdf(number, { agent, to } = {}) {
  const d = orders()[String(number)]; if (!d) throw new Error(`Order ${number} is not in the store list. Press “Sync now”.`);
  const phone = (to ? normPhone(to) : d.phone); if (!phone || phone.length < 8) throw new Error('This order has no usable phone number, so there is nobody to send the PDF to.');
  const o = { buf: pdfFor(d), mime: 'application/pdf', filename: `Order-${d.number}.pdf`, caption: captionFor(d) };
  try {
    if (agent && store.db.conversations[phone]) await bot().agentSendMedia(phone, agent, o); else await bot().autoSendMedia(phone, d.billing.name, o);
    d.pdfSentAt = Date.now(); d.pdfError = ''; store.save(); return { phone };
  } catch (e) { d.pdfError = e.message; store.save(); throw e; }
}
const wanted = d => W().sendStatuses.split(/[,\s]+/).filter(Boolean).includes(d.status);

// ---------- messages to customers: every one waits in the outbox until the administrator approves it ----------
// An item: { id, order, event, label, phone, name, text, withPdf, state: pending | sent | rejected | failed, createdAt, decidedAt, by, sentAt, error }
function outbox() { return (store.db.wooOutbox = store.db.wooOutbox || []); }
const trackingText = d => { const l = [], url = d.trackLink || courier.trackUrl(d); if (d.courier) l.push(`Courier: ${d.courier}`); if (d.cn) l.push(`Tracking no: ${d.cn}`); if (url) l.push(`Track: ${url}`); return l.length ? '\n\n' + l.join('\n') : ''; };
const varsOf = d => ({ name: (d.billing.name || 'there').split(' ')[0], number: d.number, business: brandOf().name, total: invoice.money(d.total, d.currency), status: STATUS_LABEL[d.status] || d.status,
  items: (d.items || []).map(i => `• ${i.name} × ${i.qty}`).join('\n'), courier: d.courier || '', cn: d.cn || '', track: d.trackLink || courier.trackUrl(d) || '', tracking: trackingText(d), address: d.shipping.address || d.billing.address || '', payment: d.paymentMethod || '' });
const msgFor = ev => (W().notify.msgs[ev] || MSG_DEF[ev] || '');
function enqueue(d, event, text, withPdf) {
  const w = W(), key = event + ':' + (event === 'tracking' ? d.cn : event === 'new' ? '' : d.status); d.notified = d.notified || {};
  if (d.notified[key]) return null; d.notified[key] = Date.now();
  if (!d.phone || d.phone.length < 8 || !String(text).trim()) return null;      // no usable number: nobody to message
  const list = outbox();
  if (event !== 'new' && event !== 'tracking') for (const x of list) if (x.order === d.number && x.state === 'pending' && x.event !== 'new' && x.event !== 'tracking') { x.state = 'rejected'; x.error = 'Replaced by a newer status'; x.decidedAt = Date.now(); }
  const it = { id: crypto.randomBytes(5).toString('hex'), order: d.number, event, label: EVENTS[event] || event, phone: d.phone, name: d.billing.name || '', text: String(text), withPdf: !!withPdf, state: 'pending', createdAt: Date.now() };
  list.push(it); while (list.length > 500) { const k = list.findIndex(x => x.state !== 'pending'); if (k < 0) break; list.splice(k, 1); }
  store.save();
  if (!w.requireApproval) deliver(it, 'automatic').catch(() => {});
  return it;
}
async function deliver(it, by) {
  const d = orders()[it.order];
  try {
    if (it.withPdf && d) { await bot().autoSendMedia(it.phone, it.name, { buf: pdfFor(d), mime: 'application/pdf', filename: `Order-${d.number}.pdf`, caption: it.text }); d.pdfSentAt = Date.now(); d.pdfError = ''; }
    else await bot().autoSendText(it.phone, it.name, it.text);
    it.state = 'sent'; it.sentAt = Date.now(); it.error = '';
  } catch (e) { it.state = 'failed'; it.error = e.message; if (d && it.withPdf) d.pdfError = e.message; }
  it.by = by || it.by; it.decidedAt = it.decidedAt || Date.now(); store.save(); return it;
}
async function approve(id, { text, withPdf, by } = {}) {
  const it = outbox().find(x => x.id === String(id)); if (!it) throw new Error('That message is no longer in the list.');
  if (it.state !== 'pending' && it.state !== 'failed') throw new Error(it.state === 'sent' ? 'That message was already sent.' : 'That message was rejected.');
  if (text !== undefined) { const t = String(text).trim().slice(0, 1500); if (!t) throw new Error('The message is empty.'); it.text = t; }
  if (withPdf !== undefined) it.withPdf = !!withPdf;
  it.decidedAt = Date.now(); await deliver(it, by);
  if (it.state === 'failed') throw new Error(it.error || 'Could not send.'); return it;
}
function reject(ids, by) { const set = new Set([].concat(ids).map(String)); let n = 0; for (const x of outbox()) if (set.has(x.id) && x.state === 'pending') { x.state = 'rejected'; x.decidedAt = Date.now(); x.by = by; n++; } store.save(); return n; }
const outboxList = () => ({ items: outbox().slice(-200).reverse(), pending: outbox().filter(x => x.state === 'pending').length });
async function autoSend(d, fresh) {
  const w = W(); if (!w.autoPdf || d.pdfSentAt || !wanted(d)) return;
  if (!fresh || Date.now() - new Date(d.created).getTime() > 3 * 86400000) return; // only genuinely new orders, never old ones
  if (w.requireApproval) { enqueue(d, 'new', captionFor(d), true); return; }
  if (d.notified && d.notified['new:']) return;
  try { d.notified = d.notified || {}; d.notified['new:'] = Date.now(); await sendPdf(d.number); console.log(`Order PDF #${d.number} sent to +${d.phone}`); } catch (e) { console.error(`Order PDF #${d.number} not sent:`, e.message); }
}
function statusEvents(prev, d) { // an order that changed: queue the customer message for the new status (and for a tracking number that just appeared)
  const w = W(); if (!w.notify.on || !prev || Date.now() - new Date(d.created).getTime() > 30 * 86400000) return; let did = false;
  if (prev.status !== d.status && w.notify.events[d.status] && msgFor(d.status)) did = !!enqueue(d, d.status, fill(msgFor(d.status), varsOf(d)), false);
  if (d.cn && d.cn !== prev.cn && w.notify.events.tracking && !(did && d.status === 'completed')) enqueue(d, 'tracking', fill(msgFor('tracking'), varsOf(d)), false);
}
const snap = o => { const x = orders()[String(o.number || o.id)]; return x ? { status: x.status, cn: x.cn } : null; };

// ---------- syncing ----------
let running = false;
async function syncOrders() {
  const w = W(), first = !w.lastSync; let list;
  if (first) list = (await wc('orders', { q: { per_page: 100, orderby: 'date', order: 'desc' } })).json;
  else list = await all('orders', { orderby: 'date', order: 'desc', modified_after: new Date(w.lastSync - 26 * 3600000).toISOString().replace(/\.\d+Z$/, '') }, 5);   // a wide window: WordPress reads this time in the shop's own time zone
  for (const o of list) {
    const prev = snap(o), d = upsert(o);
    if (first) { if (!d.pdfSentAt) d.pdfSentAt = -1; continue; } // the very first read is the starting point: old orders never get a PDF or a message
    statusEvents(prev, d); await autoSend(d, true);
  }
  return list.length;
}
const mapVariation = v => ({ id: v.id, sku: v.sku || '', price: v.price || '', regular: v.regular_price || '', sale: v.sale_price || '', onSale: !!v.on_sale, stock: v.stock_status || 'instock', qty: v.stock_quantity,
  image: (v.image || {}).src || '', label: (v.attributes || []).map(a => decode(a.option)).filter(Boolean).join(' / ') || `Option ${v.id}`, attrs: (v.attributes || []).map(a => `${decode(a.name)}: ${decode(a.option) || 'Any'}`).join(', ') });
async function syncProducts() {
  const list = await all('products', { status: 'publish' }, 30);
  const old = new Map((store.db.wooProducts || []).map(p => [p.id, p]));
  const prods = list.map(p => ({ id: p.id, name: decode(p.name), sku: p.sku || '', price: p.price || '', regular: p.regular_price || '', sale: p.sale_price || '', onSale: !!p.on_sale, stock: p.stock_status || 'instock', qty: p.stock_quantity,
    url: p.permalink || '', image: ((p.images || [])[0] || {}).src || '', desc: decode(p.short_description || p.description).slice(0, 300), cats: (p.categories || []).map(c => decode(c.name)), type: p.type, variations: [] }));
  // variable products: read each one's variations (colour, size…) with their own price, stock and picture
  const vars = prods.filter(p => p.type === 'variable'); let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, vars.length) }, async () => {
    while (next < vars.length) {
      const p = vars[next++];
      try { p.variations = (await all(`products/${p.id}/variations`, {}, 5)).filter(v => v.status === 'publish' || !v.status).map(mapVariation); }
      catch { p.variations = (old.get(p.id) || {}).variations || []; } // keep what we had if one product fails
    }
  }));
  store.db.wooProducts = prods;
  await detectCurrency().catch(() => {});
  return prods.length;
}
async function sync({ products = true } = {}) {
  if (running) throw new Error('A sync is already running.'); running = true; const w = W();
  try {
    const n = await syncOrders(); let p = null; if (products) { p = await syncProducts(); w.lastProducts = Date.now(); }
    w.lastSync = Date.now(); w.lastError = ''; store.save(); return { orders: n, products: p };
  } catch (e) { w.lastError = e.message; store.save(); throw e; } finally { running = false; }
}
let ticker = null;
function start() {
  clearInterval(ticker);
  ticker = setInterval(() => { const w = W(); refreshRate().catch(() => []); if (configured() && !w.storeCurrency && Date.now() - lastDetect > 600000) { lastDetect = Date.now(); detectCurrency().catch(() => {}); } if (configured() && !running && Date.now() - (w.lastSync || 0) >= w.minutes * 60000) sync({ products: Date.now() - (w.lastProducts || 0) > 3600000 }).catch(e => console.error('WooCommerce sync failed:', e.message)); }, 30000);
}

// ---------- webhook (WooCommerce → desk, instant) ----------
async function webhook(raw, headers) {
  const w = W(), sig = String(headers['x-wc-webhook-signature'] || '');
  const want = crypto.createHmac('sha256', w.webhookSecret).update(raw).digest('base64');
  if (!sig || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) { const e = new Error('Bad signature'); e.code = 401; throw e; }
  let o; try { o = JSON.parse(raw.toString('utf8')); } catch { return { ok: true, ping: true }; } // WooCommerce's first "ping" is not JSON
  if (!o || !o.line_items || !(o.number || o.id)) return { ok: true, ignored: true };
  const prev = snap(o), d = upsert(o); statusEvents(prev, d); store.save();
  await autoSend(d, true); return { ok: true, order: d.number };
}

// ---------- products on WhatsApp ----------
const retailerId = p => { const f = W().idFormat; return f === 'sku' ? (p.sku || String(p.id)) : f === 'id' ? String(p.id) : (p.sku ? `${p.sku}_${p.id}` : `wc_post_id_${p.id}`); };

// ---------- currency: the shop's own currency → the currency customers should see ----------
const currencyGuess = () => { const d = Object.values(orders())[0]; return d ? d.currency : ''; };
const baseCur = () => String(W().baseCurrency || W().storeCurrency || currencyGuess() || '').toUpperCase();
const showCur = () => String(W().showCurrency || '').toUpperCase();
function rateNow() { // { on, from, to, rate (before mark-up), final (what prices are multiplied by) }
  const w = W(), from = baseCur(), to = showCur();
  if (!from || !to || from === to) return { on: false, from, to: from };
  const r = w.rateMode === 'manual' ? +w.manualRate : (w.rate.pair === from + '>' + to ? +w.rate.value : 0);
  if (!(r > 0)) return { on: false, from, to: from, wanted: to };
  return { on: true, from, to, rate: r, final: r * (1 + (+w.markup || 0) / 100) };
}
function currencyStatus() {
  const w = W(), n = rateNow();
  return { storeCurrency: w.storeCurrency, baseCurrency: w.baseCurrency, base: baseCur(), showCurrency: w.showCurrency, rateMode: w.rateMode, manualRate: w.manualRate, markup: w.markup, roundWhole: w.roundWhole,
    rate: n.on ? { from: n.from, to: n.to, rate: n.rate, final: n.final } : null, rateAt: w.rate.at, rateError: w.rate.error, waiting: !!n.wanted };
}
async function detectCurrency() { // the shop's own currency, straight from WooCommerce → Settings → General
  if (!configured()) return;
  const r = await wc('settings/general/woocommerce_currency'), c = String(r.json && r.json.value || '').toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) { W().storeCurrency = c; store.save(); }
}
async function fetchRate(from, to) { // free public rates, no key needed; the second source is a fallback
  const f = from.toLowerCase(), t = to.toLowerCase();
  try { const j = await (await fetch(`https://open.er-api.com/v6/latest/${from}`, { signal: AbortSignal.timeout(15000) })).json(); const v = +(j && j.rates && j.rates[to]); if (v > 0) return v; } catch {}
  try { const j = await (await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${f}.json`, { signal: AbortSignal.timeout(15000) })).json(); const v = +(j && j[f] && j[f][t]); if (v > 0) return v; } catch {}
  throw new Error(`Could not get the ${from} → ${to} exchange rate right now.`);
}
let lastRateTry = 0, lastDetect = 0, rateBusy = false;
async function refreshRate(force) { // live rate, kept for 6 hours; a failed try waits 10 minutes (the last good rate keeps being used)
  const w = W(), from = baseCur(), to = showCur(); if (!from || !to || from === to || w.rateMode === 'manual' || rateBusy) return;
  const pair = from + '>' + to; if (!force && ((w.rate.pair === pair && Date.now() - w.rate.at < 6 * 3600000) || Date.now() - lastRateTry < 600000)) return;
  rateBusy = true; lastRateTry = Date.now();
  try { w.rate = { value: await fetchRate(from, to), at: Date.now(), pair, error: '' }; } catch (e) { w.rate.error = e.message; } finally { rateBusy = false; store.save(); }
}
const conv = (v, n, whole) => { if (!n.on || v === '' || v == null) return v; const x = +v; if (!isFinite(x)) return v; const y = x * n.final; return String(whole ? Math.round(y) : Math.round(y * 100) / 100); };
function view(p, n) { // a product (and its variations) with prices already in the currency customers see
  if (!n.on) return p; const whole = W().roundWhole, c = o => ({ ...o, price: conv(o.price, n, whole), regular: conv(o.regular, n, whole), sale: conv(o.sale, n, whole) });
  return { ...c(p), variations: (p.variations || []).map(c) };
}
const priceText = (p, cur) => { const m = v => invoice.money(v, cur); return p.onSale && p.sale ? `${m(p.sale)} (was ${m(p.regular)})` : p.price ? m(p.price) : ''; };
function listProducts(q, limit = 60) {
  const k = String(q || '').trim().toLowerCase(), l = store.db.wooProducts || [], n = rateNow(); refreshRate().catch(() => {});
  const hit = k ? l.filter(p => (p.name + ' ' + p.sku + ' ' + p.cats.join(' ') + ' ' + (p.variations || []).map(v => v.label + ' ' + v.sku).join(' ')).toLowerCase().includes(k)) : l;
  return { total: l.length, products: hit.slice(0, limit).map(p => view(p, n)), currency: n.to || baseCur(), rate: n.on ? { from: n.from, to: n.to, rate: n.rate, final: n.final } : null };
}
async function sendProduct(phone, productId, agent, variationId) {
  const p0 = (store.db.wooProducts || []).find(x => x.id === +productId); if (!p0) throw new Error('Product not found. Press “Sync now” on the Store page.');
  await refreshRate().catch(() => {});
  const w = W(), n = rateNow(), cur = n.to || baseCur(), p = view(p0, n), vars = p.variations || [];
  const v = variationId ? vars.find(x => x.id === +variationId) : null; if (variationId && !v) throw new Error('That option is no longer in the shop. Press “Sync now” on the Store page.');
  const it = v ? { ...p, ...v, name: `${p.name} (${v.label})`, id: v.id, sku: v.sku || p.sku, image: v.image || p.image } : p;
  if (wa().mode() === 'cloud' && w.catalogId) { // native product card from your WhatsApp catalog
    try { await bot().agentSendCatalog(phone, agent, { catalogId: w.catalogId, retailerId: retailerId(it), body: `${it.name}${priceText(it, cur) ? ' - ' + priceText(it, cur) : ''}`, label: it.name }); return { as: 'catalog' }; } catch (e) { if (/24 hours/.test(e.message)) throw e; /* not in the catalog (yet): send it as a card instead */ }
  }
  const stockLine = it.stock === 'outofstock' ? '❌ Out of stock' : it.stock === 'onbackorder' ? '⏳ On backorder' : '✅ In stock';
  let priceLine = priceText(it, cur);
  if (!v && vars.length) { const ps = vars.map(x => +x.price).filter(x => x > 0); if (ps.length) { const lo = Math.min(...ps), hi = Math.max(...ps); priceLine = lo === hi ? invoice.money(lo, cur) : `${invoice.money(lo, cur)} - ${invoice.money(hi, cur)}`; } }
  const optLines = !v && vars.length ? ['\n*Options*', ...vars.slice(0, 15).map(x => `• ${x.label}${x.price ? ' - ' + invoice.money(x.onSale && x.sale ? x.sale : x.price, cur) : ''}${x.stock === 'outofstock' ? ' (out of stock)' : ''}`), vars.length > 15 ? `…and ${vars.length - 15} more` : ''] : [];
  const lines = [`*${it.name}*`, priceLine, stockLine, ...optLines, it.desc ? '\n' + it.desc : '', it.url ? `\n🛒 ${it.url}` : ''].filter(Boolean);
  const text = lines.join('\n');
  if (it.image) {
    try {
      const r = await fetch(it.image, { signal: AbortSignal.timeout(20000) }), mime = (r.headers.get('content-type') || '').split(';')[0], buf = Buffer.from(await r.arrayBuffer());
      if (r.ok && /^image\/(jpeg|png)$/.test(mime) && buf.length < 5e6) { await bot().agentSendMedia(phone, agent, { buf, mime, filename: `${it.sku || 'product-' + it.id}.${mime === 'image/png' ? 'png' : 'jpg'}`, caption: text }); return { as: 'card' }; }
    } catch (e) { if (/24 hours|Conversation/.test(e.message)) throw e; }
  }
  await bot().agentSend(phone, agent, text); return { as: 'text' };
}

// a made-up order to preview the PDF design in Settings
const sample = (paid) => ({ number: '1042', date: new Date().toISOString(), status: paid ? 'completed' : 'processing', paymentMethod: paid ? 'Credit / debit card' : 'Cash on delivery', paid: !!paid, currency: currencyGuess() || 'PKR',
  items: [{ name: 'Wireless Headphones Pro', sku: 'WH-PRO', qty: 1, price: 12500, total: 12500 }, { name: 'USB-C Charging Cable 2m', sku: 'CB-2M', qty: 2, price: 850, total: 1700, meta: 'Colour: Black' }, { name: 'Phone Case', qty: 1, price: 1200, total: 1200 }],
  subtotal: 15400, shippingTotal: 250, shippingMethod: 'Standard delivery', discount: 400, tax: 0, total: 15250,
  billing: { name: 'Ayesha Noor', company: '', address: 'House 12, Street 4, DHA Phase 5, Karachi, Sindh', phone: '0300-1234567', email: 'ayesha@example.com' }, shipping: { name: 'Ayesha Noor', address: 'House 12, Street 4, DHA Phase 5, Karachi, Sindh 75500, Pakistan', phone: '0300-1234567' },
  note: 'Please call before delivery.', courier: 'TCS', cn: '7712345678', trackUrl: courier.trackUrl({ courier: 'TCS', cn: '7712345678' }) });

module.exports = { outboxList, approve, reject, refreshRate, logo: logoBuf, publicStatus, setConfig, setLogo, removeLogo, test, sync, start, webhook, sendPdf, pdfFor, orders, sample, brandOf, listProducts, sendProduct, configured, normPhone };
