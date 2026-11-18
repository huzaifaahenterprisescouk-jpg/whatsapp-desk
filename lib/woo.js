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
};
const W = () => {
  const w = (store.db.woo = store.db.woo || {});
  for (const k of Object.keys(DEF)) if (w[k] === undefined) w[k] = JSON.parse(JSON.stringify(DEF[k]));
  w.brand = { ...DEF.brand, ...w.brand };
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
    lastError: w.lastError, currency: currencyStatus(), counts: { products: (store.db.wooProducts || []).length, orders: Object.keys(orders()).length }, apiMode: wa().mode(), businessName: store.db.settings.businessName };
}
const cleanUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/\/(wp-admin|wp-json|wp-login\.php)(\/.*)?$/i, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); };
function setConfig(b) {
  const w = W();
  if (b.url !== undefined) w.url = cleanUrl(b.url);
  if (b.key !== undefined) w.key = String(b.key).trim();
  if (b.secret) w.secret = String(b.secret).trim();
  if (b.minutes !== undefined) w.minutes = Math.min(1440, Math.max(1, +b.minutes || 5));
  if (b.autoPdf !== undefined) w.autoPdf = !!b.autoPdf;
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
async function wc(p, { method = 'GET', q = {} } = {}) {
  const w = W(); if (!configured()) throw new Error('Enter the store address, Consumer key and Consumer secret first, then press Save.');
  const u = new URL(`${w.url}/wp-json/wc/v3/${p}`); for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') u.searchParams.set(k, v);
  const headers = { Accept: 'application/json', 'User-Agent': 'WhatsApp-Desk' };
  if (u.protocol === 'https:') headers.Authorization = 'Basic ' + Buffer.from(`${w.key}:${w.secret}`).toString('base64');
  else { u.searchParams.set('consumer_key', w.key); u.searchParams.set('consumer_secret', w.secret); } // plain http (test sites) cannot use Basic auth
  let res; try { res = await fetch(u, { method, headers, signal: AbortSignal.timeout(30000) }); } catch (e) { throw new Error(`Could not reach ${w.url} (${e.cause && e.cause.code || e.message}). Check the address.`); }
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = json && json.message ? String(json.message).replace(/<[^>]+>/g, '') : `HTTP ${res.status}`;
    const hint = res.status === 401 || res.status === 403 ? ' Check the Consumer key and secret (the key needs at least Read access).' : res.status === 404 ? ' Is WooCommerce active, and is the address the shop’s home address? (Settings → Permalinks must not be “Plain”.)' : '';
    throw new Error(`WooCommerce: ${msg}.${hint}`);
  }
  if (json === null) throw new Error('The address did not answer like a WooCommerce shop (it returned a web page, not data). Check the store address.');
  return { json, pages: +res.headers.get('x-wp-totalpages') || 1, total: +res.headers.get('x-wp-total') || 0 };
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
  if (old) { d.pdfSentAt = old.pdfSentAt; d.pdfError = old.pdfError; d.seenAt = old.seenAt; } else d.seenAt = Date.now();
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
async function autoSend(d, fresh) {
  const w = W(); if (!w.autoPdf || d.pdfSentAt || !wanted(d)) return;
  if (!fresh || Date.now() - new Date(d.created).getTime() > 3 * 86400000) return; // only genuinely new orders, never old ones
  try { await sendPdf(d.number); console.log(`Order PDF #${d.number} sent to +${d.phone}`); } catch (e) { console.error(`Order PDF #${d.number} not sent:`, e.message); }
}

// ---------- syncing ----------
let running = false;
async function syncOrders() {
  const w = W(), first = !w.lastSync; let list;
  if (first) list = (await wc('orders', { q: { per_page: 100, orderby: 'date', order: 'desc' } })).json;
  else list = await all('orders', { orderby: 'date', order: 'desc', modified_after: new Date(w.lastSync - 5 * 60000).toISOString().replace(/\.\d+Z$/, '') }, 5);
  for (const o of list) {
    const known = !!orders()[String(o.number || o.id)], d = upsert(o);
    if (first) { if (!d.pdfSentAt) d.pdfSentAt = -1; continue; } // the very first read is the starting point: old orders never get a PDF
    await autoSend(d, !known);
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
  const known = !!orders()[String(o.number || o.id)], d = upsert(o); store.save();
  await autoSend(d, !known); return { ok: true, order: d.number };
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

module.exports = { refreshRate, logo: logoBuf, publicStatus, setConfig, setLogo, removeLogo, test, sync, start, webhook, sendPdf, pdfFor, orders, sample, brandOf, listProducts, sendProduct, configured, normPhone };
