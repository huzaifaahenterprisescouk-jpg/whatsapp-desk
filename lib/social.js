// Social posting: reads every product's SEO title, description, keywords and hashtags from the TrendSEO Pro plugin installed on the
// WordPress shop (through the plugin's "WhatsApp Desk" REST bridge), shows platform-ready posts for Facebook / Instagram / WhatsApp /
// TikTok / Snapchat / YouTube / Pinterest / any other platform, and posts them: through the plugin (uses the logins saved there),
// through a webhook of your own (Zapier, Make, n8n, Buffer ... anything that accepts JSON), as a WhatsApp message to chosen chats
// and groups, or by hand (copy + open the platform). Posts can be scheduled, and the desk can post a few products every day.
const crypto = require('crypto');
const store = require('./store');
const bot = () => require('./bot'), woo = () => require('./woo');

const PLUGIN_KEYS = ['facebook', 'instagram', 'youtube', 'tiktok', 'snapchat', 'pinterest']; // platforms the plugin can post by itself
const DEF_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', mode: 'plugin', open: 'https://www.facebook.com/' },
  { key: 'instagram', label: 'Instagram', mode: 'plugin', open: 'https://www.instagram.com/' },
  { key: 'whatsapp', label: 'WhatsApp', mode: 'whatsapp', open: '' },
  { key: 'whatsapp_status', label: 'WhatsApp Status', mode: 'manual', open: 'https://web.whatsapp.com/' },
  { key: 'whatsapp_channel', label: 'WhatsApp Channel', mode: 'whatsapp', open: '' },
  { key: 'tiktok', label: 'TikTok', mode: 'plugin', open: 'https://www.tiktok.com/upload' },
  { key: 'snapchat', label: 'Snapchat', mode: 'plugin', open: 'https://my.snapchat.com/' },
  { key: 'youtube', label: 'YouTube', mode: 'plugin', open: 'https://studio.youtube.com/' },
  { key: 'pinterest', label: 'Pinterest', mode: 'plugin', open: 'https://www.pinterest.com/pin-builder/' },
];
const DEF = {
  url: '', key: '', connected: false, site: '', version: '', pluginPlatforms: {}, lastSync: 0, lastError: '', minutes: 30,
  platforms: DEF_PLATFORMS.map(p => ({ ...p, webhook: '', on: true, builtin: true })),
  waTargets: [], waStatusTo: [], waDelay: 6, scope: 'all', waChannels: [],
  auto: { on: false, hour: 10, perDay: 1, platforms: [], lastRun: '' },
  queue: [], history: [], posted: {},
};
const S = () => {
  const s = (store.db.social = store.db.social || {});
  for (const k of Object.keys(DEF)) if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(DEF[k]));
  for (const d of DEF_PLATFORMS) if (!s.platforms.some(p => p.key === d.key)) s.platforms.push({ ...d, webhook: '', on: false, builtin: true }); // platforms added in newer versions
  return s;
};
const products = () => (store.db.socialProducts = store.db.socialProducts || []);
const configured = () => { const s = S(); return !!(s.url && s.key); };
const cleanUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/\/(wp-admin|wp-json|wp-login\.php)(\/.*)?$/i, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); };

// ---------- settings ----------
function publicStatus() {
  const s = S(), wooUrl = (() => { try { return woo().publicStatus().url; } catch { return ''; } })();
  return { url: s.url, hasKey: !!s.key, suggestUrl: wooUrl, connected: s.connected, site: s.site, version: s.version, pluginPlatforms: s.pluginPlatforms, lastSync: s.lastSync, lastError: s.lastError, minutes: s.minutes,
    platforms: s.platforms, waChannels: s.waChannels, waTargets: s.waTargets, waStatusTo: s.waStatusTo || [], waDelay: s.waDelay, auto: s.auto, queue: s.queue.slice(-60).reverse(), history: s.history.slice(0, 80), count: products().length,
    pluginKeys: PLUGIN_KEYS, tiktok: { connected: require('./tiktok').connected(), name: (require('./tiktok').status()).name }, snapchat: { connected: require('./snapconnect').connected(), name: (require('./snapconnect').status()).name } };
}
// switch a platform to the desk's own API connection (used right after TikTok sign-in)
function useApi(key) { const s = S(), p = s.platforms.find(x => x.key === key); if (p && p.mode !== 'api') { p.mode = 'api'; p.on = true; store.save(); } }
function setConfig(b = {}) {
  const s = S();
  if (b.url !== undefined) { const u = cleanUrl(b.url); if (u !== s.url) s.connected = false; s.url = u; }
  if (b.key) { s.key = String(b.key).trim(); s.connected = false; }
  if (b.minutes !== undefined) s.minutes = Math.min(1440, Math.max(5, +b.minutes || 30));
  if (Array.isArray(b.platforms)) {
    const seen = new Set(), out = [];
    for (const p of b.platforms) {
      const key = String(p.key || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); if (!key || seen.has(key)) continue; seen.add(key);
      const old = s.platforms.find(x => x.key === key), builtin = !!(old && old.builtin);
      let mode = ['plugin', 'webhook', 'whatsapp', 'manual', 'api'].includes(p.mode) ? p.mode : 'manual';
      if (mode === 'api' && key !== 'tiktok') mode = 'webhook'; // only TikTok has a direct API mode in the desk
      if (mode === 'plugin' && !PLUGIN_KEYS.includes(key)) mode = 'webhook';
      if (mode === 'whatsapp' && !key.startsWith('whatsapp')) mode = 'manual';
      const hook = String(p.webhook || '').trim(); if (hook && !/^https?:\/\//i.test(hook)) throw new Error(`The webhook address for ${p.label || key} must start with https://`);
      out.push({ key, label: String(p.label || (old && old.label) || key).slice(0, 30), mode, webhook: hook, on: p.on !== false, open: String(p.open || (old && old.open) || '').slice(0, 200), builtin });
    }
    for (const d of s.platforms) if (d.builtin && !seen.has(d.key)) out.push(d); // built-in platforms cannot be removed
    const rank = k => { const i = s.platforms.findIndex(x => x.key === k); return i < 0 ? 999 : i; };
    s.platforms = out.sort((a, b) => rank(a.key) - rank(b.key));
  }
  if (Array.isArray(b.waTargets)) s.waTargets = [...new Set(b.waTargets.map(x => String(x)).filter(Boolean))].slice(0, 25);
  if (Array.isArray(b.waStatusTo)) s.waStatusTo = [...new Set(b.waStatusTo.map(x => String(x).replace(/\D/g, '')).filter(x => x.length >= 8 && x.length <= 16))].slice(0, 1000);
  if (b.waDelay !== undefined) s.waDelay = Math.min(60, Math.max(2, +b.waDelay || 6));
  if (b.auto) {
    const a = s.auto; if (b.auto.on !== undefined) a.on = !!b.auto.on; if (b.auto.hour !== undefined) a.hour = Math.min(23, Math.max(0, +b.auto.hour || 0));
    if (b.auto.perDay !== undefined) a.perDay = Math.min(5, Math.max(1, +b.auto.perDay || 1)); if (Array.isArray(b.auto.platforms)) a.platforms = b.auto.platforms.map(String);
  }
  store.save(); return publicStatus();
}

// ---------- talking to the plugin ----------
async function call(p, { method = 'GET', q = {}, body, form, timeout = 40000 } = {}) {
  const s = S(); if (!configured()) throw new Error('Enter the site address and the Desk key first (TrendSEO Pro → WhatsApp Desk in WordPress shows both).');
  const qs = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') qs.set(k, v);
  const headers = { Accept: 'application/json', 'User-Agent': 'WhatsApp-Desk', 'X-TSP-Key': s.key, ...(body ? { 'Content-Type': 'application/json' } : {}) }; // a multipart form sets its own Content-Type
  const tryUrls = [`${s.url}/wp-json/trendseo-desk/v1/${p}${qs.toString() ? '?' + qs : ''}`, `${s.url}/?rest_route=/trendseo-desk/v1/${p}${qs.toString() ? '&' + qs : ''}`]; // second one works when permalinks are "Plain"
  let res, text, json = null;
  for (let i = 0; i < tryUrls.length; i++) {
    try { res = await fetch(tryUrls[i], { method, headers, body: form || (body ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(timeout) }); } catch (e) { if (i === tryUrls.length - 1) throw new Error(`Could not reach ${s.url} (${e.cause && e.cause.code || e.message}). Check the site address.`); continue; }
    text = await res.text(); json = null; try { json = JSON.parse(text); } catch {}
    if (json !== null || i === tryUrls.length - 1) break;
  }
  if (json === null) throw new Error('The address did not answer like the TrendSEO plugin (it returned a web page). Check the site address, and that TrendSEO Pro 2.4.0 or newer is active.');
  if (!res.ok) {
    const code = json && json.code, msg = json && json.message ? String(json.message).replace(/<[^>]+>/g, '') : `HTTP ${res.status}`;
    if (code === 'rest_no_route') throw new Error('The site has no TrendSEO desk bridge. Install the new TrendSEO Pro (2.4.0 or newer) and make sure it is active.');
    if (code === 'tsp_badkey' || code === 'tsp_nokey') throw new Error('The Desk key is wrong. Copy it again from WordPress → TrendSEO Pro → WhatsApp Desk.');
    throw new Error(msg);
  }
  return json;
}
async function test() {
  const s = S(); try { const r = await call('status'); s.connected = true; s.site = r.site || ''; s.version = r.version || ''; s.pluginPlatforms = r.platforms || {}; s.lastError = ''; store.save(); return { site: s.site, version: s.version, products: r.products, woo: r.woo }; }
  catch (e) { s.connected = false; s.lastError = e.message; store.save(); throw e; }
}

// ---------- products ----------
let syncing = false;
async function sync() {
  if (syncing) throw new Error('A sync is already running.'); syncing = true; const s = S();
  try {
    const out = []; let pages = 1;
    for (let page = 1; page <= pages && page <= 30; page++) { const r = await call('products', { q: { per_page: 100, page } }); pages = r.pages || 1; out.push(...r.products); }
    store.db.socialProducts = out.map(p => ({ id: p.id, name: p.name, sku: p.sku, url: p.url, image: p.image, price: p.price, priceText: p.price_html, stock: p.stock, cats: p.cats, seo: p.seo, lastPosted: p.last_posted * 1000, modified: p.modified * 1000 }));
    const st = await call('status').catch(() => null); if (st) { s.site = st.site || s.site; s.version = st.version || s.version; s.pluginPlatforms = st.platforms || {}; }
    s.connected = true; s.lastSync = Date.now(); s.lastError = ''; store.save(); return { products: out.length };
  } catch (e) { s.lastError = e.message; store.save(); throw e; } finally { syncing = false; }
}
function list({ q = '', limit = 60, offset = 0, filter = '' } = {}) {
  const k = String(q || '').trim().toLowerCase(), posted = S().posted; filter = filter || '';
  let l = products(); if (k) l = l.filter(p => (p.name + ' ' + p.sku + ' ' + (p.cats || []).join(' ') + ' ' + ((p.seo || {}).keyword || '')).toLowerCase().includes(k));
  if (filter === 'unposted') l = l.filter(p => !posted[p.id] && !p.lastPosted); else if (filter === 'poor') l = l.filter(p => p.seo && p.seo.score != null && p.seo.score < 60); else if (filter === 'optimized') l = l.filter(p => p.seo && p.seo.optimized);
  return { total: l.length, all: products().length, products: l.slice(offset, offset + limit).map(p => ({ ...p, deskPosted: posted[p.id] || 0 })) };
}

// ---------- the post for every platform ----------
const cap = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const withUtm = (url, src) => { try { const u = new URL(url); u.searchParams.set('utm_source', src); u.searchParams.set('utm_medium', 'social'); return u.toString(); } catch { return url; } };
const hashOf = (arr, n) => (arr || []).filter(Boolean).map(t => String(t).startsWith('#') ? t : '#' + String(t).replace(/[^\p{L}\p{N}]+/gu, '')).filter(t => t.length > 3).slice(0, n);
function extra(key, label, pk, base, prod) { // WhatsApp and any custom platform: built from the SEO data + the plugin's generic copy
  const f = (base.features || []).slice(0, 4), tags = [...new Set([...(prod.seo.hashtags || []), ...(pk.hashtags || [])])];
  const link = withUtm(prod.url, key);
  if (key.startsWith('whatsapp')) {
    const text = [`*${prod.seo.title || prod.name}*`, prod.priceText ? `💰 ${prod.priceText}` : '', '', cap(prod.seo.desc, 220), f.length ? '' : null, ...f.map(x => '• ' + x), '', `🛒 ${link}`].filter(x => x !== null && x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
    return { title: prod.seo.title || prod.name, text, hashtags: [], keywords: prod.seo.keywords || [], link };
  }
  const h = hashOf(tags, 10), text = [`${prod.seo.title || prod.name}`, '', cap(prod.seo.desc, 240), ...f.map(x => '• ' + x), '', `${link}`, '', h.join(' ')].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: cap(prod.seo.title || prod.name, 100), text, hashtags: h, keywords: [...new Set([...(prod.seo.keywords || []), ...(pk.keywords || [])])].slice(0, 20), link };
}
async function packFor(pid) {
  const s = S(), prod = products().find(p => p.id === +pid); if (!prod) throw new Error('Product not found. Press “Sync now”.');
  const r = await call(`product/${+pid}/pack`, { q: { platforms: [...PLUGIN_KEYS, 'other'].join(',') } });
  const fresh = r.product ? { ...prod, name: r.product.name, url: r.product.url, image: r.product.image || prod.image, price: r.product.price, priceText: r.product.price_html, seo: r.product.seo } : prod;
  const out = {};
  for (const pl of s.platforms) {
    const c = r.platforms[pl.key] || (pl.key.startsWith('whatsapp') || !PLUGIN_KEYS.includes(pl.key) ? null : r.platforms.other);
    out[pl.key] = c && PLUGIN_KEYS.includes(pl.key) ? { title: c.title, text: c.text, hashtags: c.hashtags, keywords: c.keywords, link: c.link, suggested: c.suggested_hashtags || c.hashtags || [] } : extra(pl.key, pl.label, r.platforms.other || {}, r, fresh);
  }
  return { product: { id: fresh.id, name: fresh.name, url: fresh.url, image: fresh.image, priceText: fresh.priceText, seo: fresh.seo }, images: r.images || [], keyword: r.keyword, features: r.features || [], platforms: out };
}

// ---------- pictures + video you add yourself ----------
// The file goes into the shop's Media Library (through the TrendSEO bridge) so Facebook / Instagram can fetch it from a public address.
const MEDIA_OK = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm))$/;
async function uploadMedia(buf, mime, name) {
  mime = String(mime || '').split(';')[0].toLowerCase(); if (!MEDIA_OK.test(mime)) throw new Error('Only JPG, PNG, GIF, WebP pictures and MP4, MOV, WebM videos can be added.');
  if (!S().version || S().version.split('.').slice(0, 3).join('.').localeCompare('2.4.1', undefined, { numeric: true }) < 0) throw new Error('Update TrendSEO Pro on the shop to 2.4.1 or newer (the zip in this delivery) to add your own pictures and video.');
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: mime }), String(name || 'upload').replace(/[^\w.\- ]+/g, '_').slice(0, 100));
  return call('media', { method: 'POST', form: fd, timeout: 300000 });
}
const cleanMedia = m => { // { images: [url], video: 'auto' | 'none' | url }
  if (!m || typeof m !== 'object') return null;
  const ok = u => /^https?:\/\//i.test(String(u || '')), images = [...new Set((Array.isArray(m.images) ? m.images : []).map(String).filter(ok))].slice(0, 10);
  const v = String(m.video || 'none'), fm = {};
  for (const k of ['facebook', 'instagram']) { const a = (m.formats && Array.isArray(m.formats[k]) ? m.formats[k] : []).filter(x => ['post', 'reel', 'story'].includes(x)); if (a.length) fm[k] = [...new Set(a)]; }
  return { images, video: v === 'auto' || v === 'none' ? v : ok(v) ? v : 'none', formats: fm, comment: String(m.comment || '').slice(0, 2000) };
};

// ---------- posting ----------
const adminAgent = id => { const b = bot(); return (id && b.agentById(id)) || (store.db.agents || []).find(a => a.role === 'admin' && a.active !== false) || (store.db.agents || [])[0]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchImage(url) {
  if (!url) return null;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(25000) }), mime = (r.headers.get('content-type') || '').split(';')[0], buf = Buffer.from(await r.arrayBuffer()); if (r.ok && /^image\/(jpeg|png)$/.test(mime) && buf.length < 5e6) return { buf, mime }; } catch {}
  return null;
}
async function fetchFile(url, video) { // a picture (JPG/PNG, 5 MB) or a video (MP4/MOV, 60 MB)
  if (!url) return null;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }), mime = (r.headers.get('content-type') || '').split(';')[0], buf = Buffer.from(await r.arrayBuffer());
    if (r.ok && (/^image\/(jpeg|png)$/.test(mime) && buf.length < 5e6 || video && /^video\/(mp4|quicktime)$/.test(mime) && buf.length < 60e6)) return { buf, mime }; } catch {}
  return null;
}
// what to send as Status / to a Channel: your video if you chose one, plus the ticked pictures (at most `n`)
async function waItems(prod, media, n) {
  const out = [], v = media && /^https?:/.test(media.video || '') ? media.video : '';
  if (v) { const f = await fetchFile(v, true); if (f) out.push(f); }
  for (const u of ((media && media.images.length ? media.images : [prod.image]).filter(Boolean)).slice(0, n)) { if (out.length >= n) break; const f = await fetchFile(u); if (f) out.push(f); }
  return out;
}
async function viaStatus(it, prod, media) {
  const w = require('./wa-link'); if (!w.connected()) throw new Error('WhatsApp Status needs the linked-phone connection (Settings → WhatsApp connection).');
  const jids = Object.values(store.db.conversations || {}).filter(c => c && c.phone && !c.isGroup && !/@(g\.us|newsletter|broadcast)$/.test(c.jid || '')).map(c => c.jid || c.phone + '@s.whatsapp.net').slice(0, 1000);
  const items = await waItems(prod, media, 5), cap = String(it.text || '').slice(0, 700); let n = 0;
  let seen = 0, acked = 0;
  if (!items.length) { const r = await w.postStatus({ caption: cap }, jids); return `Handed to WhatsApp as a text status for ${r.viewers} contacts, but WhatsApp has NOT confirmed it${r.acked ? ' was shown' : ''}. Check Updates → Status on your phone; if it is missing, switch WhatsApp Status to Manual.`; }
  for (let i = 0; i < items.length; i++) { const r = await w.postStatus({ ...items[i], caption: i === 0 ? cap : '' }, jids); seen = r.viewers; if (r.acked) acked++; n++; await sleep(1500); }
  return `Handed ${n} status update${n > 1 ? 's' : ''} to WhatsApp for ${seen} contacts (${acked}/${n} confirmed by WhatsApp). Delivery of Status is not guaranteed on this connection: check Updates → Status on your phone, and if it is missing switch WhatsApp Status to Manual.`;
}
async function viaChannel(it, prod, media) {
  const w = require('./wa-link'), ch = S().waChannels; if (!w.connected()) throw new Error('WhatsApp Channels need the linked-phone connection (Settings → WhatsApp connection).');
  if (!ch.length) throw new Error('Add your channel first (Platforms & automation → WhatsApp Channel & Status).');
  const items = await waItems(prod, media, 4), errs = []; let ok = 0;
  for (const c of ch) { try { if (!items.length) await w.sendChannel(c.jid, { caption: it.text }); else for (let i = 0; i < items.length; i++) { await w.sendChannel(c.jid, { ...items[i], caption: i === 0 ? it.text : '' }); await sleep(1200); } ok++; } catch (e) { errs.push(`${c.name}: ${e.message}`); } }
  if (!ok) throw new Error(errs[0] || 'Nothing was sent');
  return `Posted to ${ok} channel${ok > 1 ? 's' : ''}${errs.length ? `; failed: ${errs.join('; ')}` : ''}`;
}
async function addChannel(link) { const c = await require('./wa-link').channelResolve(link), s = S(); if (!s.waChannels.some(x => x.jid === c.jid)) s.waChannels.push(c); store.save(); return c; }
function removeChannel(jid) { const s = S(); s.waChannels = s.waChannels.filter(c => c.jid !== jid); store.save(); }
async function viaWebhook(pl, it, prod, images, video) {
  const body = { platform: pl.key, source: 'WhatsApp Desk', product_id: prod.id, title: it.title, description: it.text, hashtags: it.hashtags || [], keywords: it.keywords || [], link: it.link || prod.url, price: prod.priceText || '', image_url: (images && images[0]) || prod.image || '', images: images || (prod.image ? [prod.image] : []), video_url: /^https?:/.test(video || '') ? video : '', site: S().site };
  const r = await fetch(pl.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'WhatsApp-Desk' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${pl.label} webhook answered HTTP ${r.status}`);
}
async function viaWhatsApp(it, prod, agentId, media) {
  const s = S(), b = bot(), targets = s.waTargets; if (!targets.length) throw new Error('Choose the chats / groups to post to (Social posting → Platforms → WhatsApp).');
  const img = await fetchImage((media && media.images[0]) || prod.image), agent = adminAgent(agentId), errs = []; let ok = 0;
  for (let i = 0; i < targets.length; i++) {
    const phone = targets[i], conv = store.db.conversations[phone];
    try {
      if (img) { const o = { buf: img.buf, mime: img.mime, filename: `product-${prod.id}.${img.mime === 'image/png' ? 'png' : 'jpg'}`, caption: it.text }; if (conv) await b.agentSendMedia(phone, agent, o); else await b.autoSendMedia(phone, '', o); }
      else if (conv) await b.agentSend(phone, agent, it.text); else throw new Error('Not an existing chat (open the chat once first)');
      ok++;
    } catch (e) { errs.push(`${(conv && conv.name) || phone}: ${e.message}`); }
    if (i < targets.length - 1) await sleep(s.waDelay * 1000);
  }
  if (!ok) throw new Error(errs[0] || 'Nothing was sent');
  return `Sent to ${ok} chat${ok > 1 ? 's' : ''}${errs.length ? `; failed: ${errs.join('; ')}` : ''}`;
}
// items: [{ platform, title, text, hashtags, keywords, link }]. Returns one result per platform.
async function post(pid, items, { agentId, source = 'manual', media } = {}) {
  media = cleanMedia(media);
  const s = S(), prod = products().find(p => p.id === +pid); if (!prod) throw new Error('Product not found. Press “Sync now”.');
  const results = [], push = (pl, status, message) => results.push({ platform: pl.key, label: pl.label, status, message, at: Date.now() });
  const byKey = new Map(s.platforms.map(p => [p.key, p])), todo = items.map(i => ({ it: i, pl: byKey.get(i.platform) })).filter(x => x.pl);
  const viaPlugin = todo.filter(x => x.pl.mode === 'plugin');
  if (viaPlugin.length) {
    try {
      const r = await call('post', { method: 'POST', body: { product_id: +pid, platforms: viaPlugin.map(x => x.pl.key), copy: Object.fromEntries(viaPlugin.filter(x => x.it.text).map(x => [x.pl.key, { title: x.it.title || '', text: x.it.text }])), ...(media ? { images: media.images, video: media.video, formats: media.formats, comment: media.comment } : {}) }, timeout: 600000 });
      for (const x of viaPlugin) {
        const row = (r.rows || []).find(w => w.platform === x.pl.key);
        if (!row) push(x.pl, 'failed', 'The site did not report back for this platform.');
        else push(x.pl, row.status === 'posted' ? 'posted' : row.status === 'queued' ? 'queued' : row.status === 'manual' ? 'manual' : row.status === 'skipped' ? 'skipped' : 'failed', row.message || row.status);
      }
    } catch (e) { for (const x of viaPlugin) push(x.pl, 'failed', e.message); }
  }
  for (const x of todo.filter(x => x.pl.mode !== 'plugin')) {
    try {
      if (x.pl.mode === 'api') { push(x.pl, 'posted', await require('./tiktok').post(x.it, prod, media)); }
      else if (x.pl.mode === 'webhook') { if (!x.pl.webhook) throw new Error('No webhook address yet (Social posting → Platforms).'); await viaWebhook(x.pl, x.it, prod, media && media.images.length ? media.images : x.it.images, media && media.video); push(x.pl, 'posted', 'Sent to your webhook'); }
      else if (x.pl.mode === 'whatsapp') push(x.pl, 'posted', x.pl.key === 'whatsapp_status' ? await viaStatus(x.it, prod, media) : x.pl.key === 'whatsapp_channel' ? await viaChannel(x.it, prod, media) : await viaWhatsApp(x.it, prod, agentId, media));
      else push(x.pl, 'manual', 'Marked as posted by hand');
    } catch (e) { push(x.pl, 'failed', e.message); }
  }
  if (results.some(r => ['posted', 'queued', 'manual'].includes(r.status))) s.posted[prod.id] = Date.now();
  s.history.unshift({ id: 'h_' + crypto.randomBytes(4).toString('hex'), at: Date.now(), productId: prod.id, name: prod.name, source, results }); s.history = s.history.slice(0, 200); store.save();
  return results;
}

// ---------- schedule + daily auto ----------
function schedule(pid, items, runAt, agentId, media) {
  const s = S(), prod = products().find(p => p.id === +pid); if (!prod) throw new Error('Product not found.');
  if (!(runAt > Date.now() - 60000)) throw new Error('Choose a time in the future.'); if (!items.length) throw new Error('Choose at least one platform.');
  const q = { id: 'q_' + crypto.randomBytes(4).toString('hex'), productId: prod.id, name: prod.name, items, platforms: items.map(i => i.platform), runAt, status: 'pending', agentId: agentId || '', media: cleanMedia(media), created: Date.now() };
  s.queue.push(q); s.queue = s.queue.slice(-200); store.save(); return q;
}
function unschedule(id) { const s = S(), q = s.queue.find(x => x.id === id && x.status === 'pending'); if (!q) throw new Error('That post already ran or does not exist.'); s.queue = s.queue.filter(x => x !== q); store.save(); }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let busy = false;
async function tick() {
  if (busy || !configured()) return; const s = S(); busy = true;
  try {
    for (const q of s.queue.filter(x => x.status === 'pending' && x.runAt <= Date.now())) {
      q.status = 'running'; store.save();
      try { q.results = await post(q.productId, q.items, { agentId: q.agentId, source: 'scheduled', media: q.media }); q.status = q.results.every(r => r.status === 'failed') ? 'failed' : 'done'; } catch (e) { q.status = 'failed'; q.results = [{ platform: '-', label: '-', status: 'failed', message: e.message }]; }
      q.doneAt = Date.now(); store.save();
    }
    const a = s.auto;
    if (a.on && a.platforms.length && a.lastRun !== today() && new Date().getHours() >= a.hour) {
      a.lastRun = today(); store.save();
      const cands = products().filter(p => p.stock !== 'outofstock' && p.image).sort((x, y) => Math.max(s.posted[x.id] || 0, x.lastPosted || 0) - Math.max(s.posted[y.id] || 0, y.lastPosted || 0)).slice(0, a.perDay);
      for (const p of cands) {
        try { const pk = await packFor(p.id); await post(p.id, a.platforms.filter(k => pk.platforms[k]).map(k => ({ platform: k, ...pk.platforms[k], images: pk.images })), { source: 'daily auto' }); } catch (e) { s.history.unshift({ id: 'h_' + crypto.randomBytes(4).toString('hex'), at: Date.now(), productId: p.id, name: p.name, source: 'daily auto', results: [{ platform: '-', label: '-', status: 'failed', message: e.message }] }); store.save(); }
      }
    }
  } finally { busy = false; }
}
let timer = null;
function start() {
  clearInterval(timer);
  timer = setInterval(() => { const s = S(); if (configured() && s.connected && !syncing && Date.now() - (s.lastSync || 0) >= s.minutes * 60000) sync().catch(e => console.error('Social sync failed:', e.message)); tick().catch(e => console.error('Social tick failed:', e.message)); }, 30000);
}
const pluginLog = async (pid) => (await call('log', { q: { product_id: pid || '', limit: 80 } })).rows || [];
// chats and groups the admin can post to on WhatsApp
function chats(q) {
  const k = String(q || '').trim().toLowerCase();
  return Object.values(store.db.conversations || {}).filter(c => c && c.phone && (!k || (String(c.name || '') + ' ' + c.phone).toLowerCase().includes(k))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 80).map(c => ({ phone: c.phone, name: c.name || c.phone, isGroup: !!c.isGroup }));
}

// ---------- product analytics (TrendSEO Pro 2.5.0+ /analytics: views, orders, revenue, Search Console, ranks, SEO score, social performance) ----------
const AN_TTL = 10 * 60 * 1000; // a fresh copy is read from the shop at most every 10 minutes, unless "Refresh" is pressed
const anCache = () => (store.db.socialAnalytics = store.db.socialAnalytics || {});
const anOld = e => /no TrendSEO desk bridge/.test(e.message) ? new Error('Your shop has TrendSEO Pro ' + (S().version || '2.4.x') + '. Install TrendSEO Pro 2.5.0 or newer (it adds the analytics feed), then press Refresh.') : e;
async function analytics(days, { refresh = false } = {}) {
  days = [7, 30, 90].includes(+days) ? +days : 30; const c = anCache(), hit = c[days];
  if (!refresh && hit && Date.now() - hit.t < AN_TTL) return { ...hit.data, cachedAt: hit.t, stale: false };
  try {
    const data = await call('analytics', { q: { days }, timeout: 90000 }); c[days] = { t: Date.now(), data }; store.save();
    return { ...data, cachedAt: c[days].t, stale: false };
  } catch (e) {
    if (hit) return { ...hit.data, cachedAt: hit.t, stale: true, error: anOld(e).message };
    throw anOld(e);
  }
}
async function analyticsRefresh() { // ask the shop to pull fresh Facebook / Instagram / YouTube numbers and Search Console data, then read everything again
  let r; try { r = await call('analytics/refresh', { method: 'POST', body: {}, timeout: 180000 }); } catch (e) { throw anOld(e); }
  store.db.socialAnalytics = {}; store.save(); return r;
}

// ---------- Flow AI video prompts, built from each product's own data ----------
async function flowFor(pid, style) {
  const prod = products().find(p => p.id === +pid); if (!prod) throw new Error('Product not found. Press “Sync now”.');
  let features = []; try { features = (await call(`product/${+pid}/pack`, { q: { platforms: 'other' } })).features || []; } catch {} // nicer feature list when the shop answers; the synced data is enough otherwise
  return require('./flowprompt').build(prod, { style, features });
}
function flowAll(style) { const fp = require('./flowprompt'); return products().map(p => ({ p, r: fp.build(p, { style }) })); }

module.exports = { flowFor, flowAll, useApi, analytics, analyticsRefresh, addChannel, removeChannel, call, publicStatus, setConfig, test, sync, list, packFor, uploadMedia, post, schedule, unschedule, start, pluginLog, chats, configured };
