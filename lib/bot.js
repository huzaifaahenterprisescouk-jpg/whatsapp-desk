const { EventEmitter } = require('events');
const store = require('./store');
const wa = require('./whatsapp');
const media = require('./media');
const link = require('./wa-link');
const orders = require('./orders');
const retail = require('./retail');
const track = require('./track');
const files = require('./files');
const cfgApp = require('./config');
const links = require('./links');

const bus = new EventEmitter();
const now = () => Date.now();

// ---------- helpers ----------
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the', 'ltd', 'limited', 'plc', 'inc', 'llc', 'co', 'company', 'from', 'i', 'am', 'im', 'we', 'are', 'my', 'of', 'at', 'with', 'a', 'an', 'is', 'and', 'group', 'org', 'organization', 'organisation', 'calling', 'hello', 'hi', 'salam', 'assalam', 'please']);
const sig = s => norm(s).split(' ').filter(t => t && !STOP.has(t));

function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const tokEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1));

// score 0..1 of how well the text names an organization
function orgScore(text, org) {
  const tt = sig(text); if (!tt.length) return 0;
  let best = 0;
  for (const cand of [org.name, ...(org.aliases || [])]) {
    const ct = sig(cand); if (!ct.length) continue;
    const matched = ct.filter(c => tt.some(t => tokEq(t, c))).length;
    const coverage = matched / ct.length;                 // how much of the org name was said
    const precision = matched / tt.length;                // how much of the text is the org name
    let s = coverage === 1 ? 0.85 + 0.15 * precision : coverage * 0.7;
    if (ct.length === 1 && coverage === 1) s = Math.max(s, 0.9);
    best = Math.max(best, s);
  }
  return best;
}
function matchOrg(text, min = 0.7) {
  let best = null, bs = 0;
  for (const o of store.db.organizations) { const s = orgScore(text, o); if (s > bs) { bs = s; best = o; } }
  return bs >= min ? best : null;
}

const agentById = id => store.db.agents.find(a => a.id === id);
function openLoad(agentId) { return Object.values(store.db.conversations).filter(c => c.agentId === agentId && c.status === 'assigned').length; }
function roundRobin() {
  let pool = store.db.agents.filter(a => a.active && a.role === 'agent');
  if (!pool.length) pool = store.db.agents.filter(a => a.active);
  if (!pool.length) return null;
  return pool.map(a => ({ a, n: openLoad(a.id) })).sort((x, y) => x.n - y.n || x.a.name.localeCompare(y.a.name))[0].a;
}
function agentForOrg(org) {
  const a = agentById(org.agentId); if (a && a.active) return a;
  const b = agentById(org.backupAgentId); if (b && b.active) return b;
  return roundRobin();
}

function getConv(phone, name) {
  const db = store.db;
  let c = db.conversations[phone];
  if (!c) {
    c = db.conversations[phone] = { phone, name: name || phone, status: 'bot', stage: 'menu', agentId: null, orgId: null, orgName: '', unread: 0, createdAt: now(), updatedAt: now(), lastCustomerAt: 0, lastPreview: '' };
  } else if (name && (c.name === c.phone || !c.name)) c.name = name;
  return c;
}

const MEDIA_LABEL = x => x.kind === 'audio' ? (x.voice ? '🎤 Voice message' : '🎵 Audio') : x.kind === 'image' ? '📷 Photo' : x.kind === 'video' ? '🎬 Video' : '📎 ' + (x.name || 'File');
function emitConv(c) { bus.emit('event', { type: 'conversation', conversation: c }); }

function record(conv, msg) {
  const m = { id: store.nextId('m'), phone: conv.phone, ts: now(), ...msg };
  store.db.messages.push(m);
  conv.updatedAt = m.ts;
  conv.lastPreview = ((m.text || '').trim() || (m.media ? MEDIA_LABEL(m.media) : '')).replace(/\s+/g, ' ').slice(0, 90);
  store.save();
  bus.emit('event', { type: 'message', message: m });
  emitConv(conv);
  return m;
}

const tpl = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

async function say(conv, text, options) {
  const m = record(conv, { dir: 'out', from: 'bot', text, options });
  const r = options ? await wa.sendMenu(conv.phone, text, options) : await wa.sendText(conv.phone, text);
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); }
  return m;
}

function menuOptions() {
  const m = store.db.settings.menu;
  return [{ id: 'guide', title: m.guide }, { id: 'org', title: m.org }, { id: 'track', title: m.track }, { id: 'human', title: m.human }, { id: 'retail', title: m.retail }];
}
async function showMenu(conv, prefix) {
  conv.stage = 'menu'; conv.status = 'bot';
  const s = store.db.settings;
  const body = (prefix ? prefix + '\n\n' : '') + tpl(s.greeting, { business: s.businessName });
  await say(conv, body + '\n\n' + menuOptions().map((o, i) => `${i + 1}. ${o.title}`).join('\n'), menuOptions());
}

// ---------- assignment ----------
async function assign(conv, agent, org, silent) {
  const s = store.db.settings;
  conv.agentId = agent ? agent.id : null;
  conv.orgId = org ? org.id : conv.orgId;
  if (org) conv.orgName = org.name;
  conv.stage = 'human';
  conv.status = agent ? 'assigned' : 'waiting';
  conv.assignedAt = now();
  emitConv(conv);
  if (silent) return;
  if (agent) await say(conv, tpl(s.handoffMessage, { agent: agent.name, org: org ? ` (${org.name} account)` : '' }) + (agent.phone ? '\n\nWant to speak by phone? Type *call* and we will send you their number.' : ''));
  else await say(conv, s.noAgentMessage);
}

async function routeToOrg(conv, org) { await assign(conv, agentForOrg(org), org); }
async function routeToHuman(conv) {
  const org = conv.orgId ? store.db.organizations.find(o => o.id === conv.orgId) : null;
  await assign(conv, org ? agentForOrg(org) : roundRobin(), org);
}

// ---------- understanding what the customer wants ----------
function parseChoice(text, replyId) {
  if (replyId && ['guide', 'org', 'track', 'human', 'retail'].includes(replyId)) return replyId;
  const t = norm(text);
  const map = { '1': 'guide', '2': 'org', '3': 'track', '4': 'human', '5': 'retail' };
  if (map[t]) return map[t];
  if (/\b(track|tracking|where is my order|order status|my order|parcel|shipment|delivery status)\b/.test(t)) return 'track';
  if (/\b(agent|human|person|representative|talk|speak|support|call me|help me)\b/.test(t)) return 'human';
  if (/\b(guide|information|info|catalog|catalogue|brochure|price list|how to)\b/.test(t)) return 'guide';
  if (/\b(organi[sz]ation|company|business account)\b/.test(t)) return 'org';
  if (/\b(retail|retailer|shop|dealer|store account|account no|account number)\b/.test(t)) return 'retail';
  return null;
}

// names this customer's organization goes by (used to prefer that company's sheet when a PO / PR number is searched)
function orgNamesOf(conv) {
  const o = conv.orgId && store.db.organizations.find(x => x.id === conv.orgId);
  const names = o ? [o.name, ...(o.aliases || [])] : conv.orgName && !conv.retailId ? [conv.orgName] : [];
  if (conv.retailName) names.push(conv.retailName);
  return names;
}


// ---------- tracking: organization first ----------
// Before a customer sends a PO / P.R / CN number we ask which organization they are from, and from then on we search
// ONLY that organization's sheet (its OneDrive file). Nothing from another company can ever be shown.
const sameName = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)))); };
const poolOf = scope => scope ? store.db.orders.filter(o => (scope.srcIds || []).includes(o.src) || (scope.names || []).some(n => sameName(n, o.organization) || sameName(n, o.company))) : null;

// Which organization (sheet) did the customer name? Sheet names, organization values inside the sheets and the registered organizations (with their other names) are all understood.
function resolveScope(text) {
  const t = String(text || '').trim(); if (!t) return null;
  const srcs = store.db.sources || []; let best = null, bs = 0, known = null, ks = 0;
  const take = (sc, scope) => { if (sc > bs && poolOf(scope).length) { bs = sc; best = scope; } };
  for (const sr of srcs) take(orgScore(t, { name: sr.name, aliases: [] }), { label: sr.name, srcIds: [sr.id], names: [sr.name] });
  const seen = new Set();
  for (const o of store.db.orders) { const n = o.organization; if (!n || seen.has(norm(n))) continue; seen.add(norm(n)); take(orgScore(t, { name: n, aliases: [] }), { label: n, srcIds: [], names: [n] }); }
  for (const g of store.db.organizations) {
    const sc = orgScore(t, g); if (sc < 0.6) continue;
    const names = [g.name, ...(g.aliases || [])], scope = { label: g.name, srcIds: srcs.filter(sr => names.some(n => sameName(n, sr.name))).map(sr => sr.id), names };
    if (poolOf(scope).length) take(sc, scope); else if (sc > ks) { ks = sc; known = scope; }
  }
  if (best && bs >= 0.6) return best;
  return known; // a registered organization that has no order sheet yet: searches simply find nothing
}
// orders we may show in a chat a person already handles: only when we know the organization
function knownPool(conv) {
  if (conv.trackScope) return poolOf(conv.trackScope);
  if (conv.retailId) return null;
  const names = orgNamesOf(conv); if (!names.length) return null;
  return store.db.orders.filter(o => names.some(n => sameName(n, o.organization) || sameName(n, o.company)));
}
async function askTrackOrg(conv, pending, change) {
  conv.stage = 'track_org'; conv.pendingQuery = pending || ''; conv.trackTries = 0; if (change) delete conv.trackScope;
  await say(conv, store.db.settings.trackOrgPrompt);
}
async function sendFiles(conv, list) {
  if (!cfgApp.live) return; // demo mode: the link in the text is enough
  const done = new Set(); let n = 0;
  for (const o of list) for (const f of orders.fileLinks(o)) {
    if (n >= 4 || done.has(f.url)) continue; done.add(f.url);
    const file = await files.fetchFile(f.url); if (!file) continue; n++;
    const id = o.po || o.pr || o.cn || o.orderId, name = `${String(f.label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'file'}-${String(id).replace(/[^A-Za-z0-9]+/g, '')}.${file.ext}`;
    const m = record(conv, { dir: 'out', from: 'bot', text: `📎 ${f.label}: ${name}` });
    const r = await wa.sendFile(conv.phone, file.buf, file.mime, name, `${f.label} · ${id}`);
    if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); }
  }
}
// the order details, then the pictures / documents of those orders as downloadable attachments
async function replyOrders(conv, hits, tail) {
  const shown = hits.slice(0, 5);
  await say(conv, shown.map(orders.formatOrder).join('\n\n') + (hits.length > 5 ? `\n\n…and ${hits.length - 5} more. Send a specific PO / CN number to see it.` : '') + (tail || ''));
  // links are never printed: each one is a tappable button with a short label ("Show image", "Track order")
  let n = 0;
  for (const o of shown) for (const b of orders.linkButtons(o)) {
    if (n++ >= 6) return;
    const id = o.po || o.pr || o.cn || o.orderId, body = `${b.text === 'Show image' ? '📷 Image' : b.text === 'Track order' ? '🔗 Tracking' : '🔗 Link'} for PO ${id}`;
    const m = record(conv, { dir: 'out', from: 'bot', text: body, links: [{ text: b.text, url: b.url }] });
    const r = await wa.sendLinkButton(conv.phone, body, b.text, b.url);
    if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); }
  }
}
async function runTrack(conv, text) {
  const s = store.db.settings, pool = poolOf(conv.trackScope), label = conv.trackScope.label;
  const hits = orders.lookup(text, [], pool);
  if (!hits.length) return say(conv, tpl(s.notFoundOrder, { q: text.slice(0, 40) }) + `\n\n_(Searched in *${label}* records. Type *change* to choose another organization.)_`);
  conv.stage = 'menu';
  return replyOrders(conv, hits, '\n\nType *menu* to go back, or *4* to talk to our team.');
}
async function handleTrackOrg(conv, text, replyId) {
  const s = store.db.settings;
  if (parseChoice(text, replyId) === 'human') return routeToHuman(conv);
  const number = orders.looksLikeNumber(text), scope = number ? null : resolveScope(text);
  if (!scope) {
    conv.trackTries = (conv.trackTries || 0) + 1;
    if (conv.trackTries >= 3) { conv.orgName = text.slice(0, 80); await say(conv, s.notFoundOrg); return assign(conv, roundRobin(), null, true).then(() => emitConv(conv)); }
    return say(conv, number ? s.trackOrgFirst : tpl(s.trackOrgNotFound, { q: text.slice(0, 40) }));
  }
  conv.trackScope = scope; conv.trackTries = 0; conv.orgName = scope.label;
  const pending = conv.pendingQuery; conv.pendingQuery = ''; conv.stage = 'await_order';
  await say(conv, `Thank you! 🙌 I will check the *${scope.label}* records.`);
  if (pending) return runTrack(conv, pending);
  const mine = orders.findByPhone(conv.phone, poolOf(scope));
  if (mine.length) return replyOrders(conv, mine, `\n\n${mine.length} order${mine.length > 1 ? 's are' : ' is'} linked to this number. Send another PO / P.R / CN number to check a different order, or type *menu*.`);
  return say(conv, s.trackPrompt);
}

// ---------- retail shops: account number, details, products, balance, new-shop registration ----------
const RETAIL_MENU = [{ id: 'r_details', title: 'Account details' }, { id: 'r_products', title: 'Products & prices' }, { id: 'r_balance', title: 'Balance & invoices' }, { id: 'r_orders', title: 'My orders' }, { id: 'human', title: 'Talk to our team' }, { id: 'menu', title: 'Main menu' }];
async function retailMenu(conv, prefix) {
  conv.stage = 'retail_menu';
  await say(conv, (prefix ? prefix + '\n\n' : '') + 'What would you like to see?\n\n' + RETAIL_MENU.map((o, i) => `${i + 1}. ${o.title}`).join('\n'), RETAIL_MENU);
}
async function retailAskAccount(conv) { conv.stage = 'retail_start'; conv.retailTries = 0; await say(conv, store.db.settings.retailPrompt); }
// the shop is confirmed: remember it on the chat (the team sees it) and show the details
async function retailEnter(conv, acc) {
  conv.retailId = acc.id; conv.retailName = acc.name; conv.retailRegion = retail.regionName(acc); conv.retailTries = 0; delete conv.retailPending;
  await say(conv, retail.detailsText(acc));
  return retailMenu(conv);
}
async function retailOpen(conv, acc) {
  if (conv.retailId === acc.id || retail.phoneMatches(acc, conv.phone)) return retailEnter(conv, acc);
  conv.stage = 'retail_verify'; conv.retailPending = acc.id;
  return say(conv, `Thank you. To protect your account, please send the *last 4 digits of the phone number registered* on account ${acc.id}.`);
}
function retailChoice(text, replyId) {
  if (replyId && RETAIL_MENU.some(o => o.id === replyId)) return replyId;
  const t = norm(text), n = { '1': 'r_details', '2': 'r_products', '3': 'r_balance', '4': 'r_orders', '5': 'human', '6': 'menu' }[t]; if (n) return n;
  if (/^products?\b|\b(price|prices|price list|catalog|catalogue|items)\b/.test(t)) return 'r_products';
  if (/\b(balance|invoice|invoices|outstanding|due|payment|ledger)\b/.test(t)) return 'r_balance';
  if (/\b(order|orders|track|tracking|delivery|dispatch)\b/.test(t)) return 'r_orders';
  if (/\b(details|account|address|profile|info)\b/.test(t)) return 'r_details';
  if (/\b(agent|human|person|team|talk|support|help)\b/.test(t)) return 'human';
  return null;
}
async function routeRetailHuman(conv) {
  const rg = retail.regionOf(conv.retailRegion), reg = rg && agentById(rg.agentId);
  conv.orgName = `Retail · ${conv.retailRegion || 'shop'}`;
  await assign(conv, reg && reg.active ? reg : roundRobin(), null);
}
const REG_STEPS = {
  reg_name: ['Let us set up your shop. 🏪\nWhat is the *name of your shop*?', 'name'],
  reg_contact: ['Who is the *contact person / owner*?', 'contact'],
  reg_phone: ['What is the shop\'s *phone number*? (Type *same* to use this WhatsApp number)', 'phone'],
  reg_address: ['What is the shop\'s *full address*?', 'address'],
  reg_city: ['Which *city / town* is it in?', 'city'],
};
async function regAsk(conv, stage) { conv.stage = stage; await say(conv, REG_STEPS[stage][0]); }
async function regAskRegion(conv) {
  conv.stage = 'reg_region'; const opts = retail.regionList().map((g, i) => ({ id: 'rg' + i, title: g.name }));
  await say(conv, 'Which *region* is your shop in?\n\n' + opts.map((o, i) => `${i + 1}. ${o.title}`).join('\n'), opts);
}
async function retailRegister(conv) {
  const have = retail.byPhone(conv.phone);
  if (have) { await say(conv, `This WhatsApp number already has an account: *${have.id}* (${have.name}).`); return retailEnter(conv, have); }
  conv.reg = {}; return regAsk(conv, 'reg_name');
}
async function handleRetailStage(conv, text, replyId) {
  const st = conv.stage;
  if (st === 'retail_start') {
    if (/^(new|register|new shop|sign ?up|create)\b/i.test(text)) return retailRegister(conv);
    const acc = retail.findInText(text);
    if (acc) return retailOpen(conv, acc);
    conv.retailTries = (conv.retailTries || 0) + 1;
    if (conv.retailTries >= 4) { conv.orgName = 'Retail · account help'; await say(conv, 'We could not find that account. Let us connect you with our team.'); return assign(conv, roundRobin(), null).then(() => emitConv(conv)); }
    return say(conv, "We couldn't find that account number. Please check it and send it again, type *NEW* to register a new shop, or *menu* to go back.");
  }
  if (st === 'retail_verify') {
    const acc = retail.byId(conv.retailPending); if (!acc) return retailAskAccount(conv);
    if (retail.last4Matches(acc, text)) return retailEnter(conv, acc);
    conv.retailTries = (conv.retailTries || 0) + 1;
    if (conv.retailTries >= 3) { conv.retailPending = null; conv.orgName = 'Retail · verify account'; await say(conv, 'Those digits do not match our records, so we cannot show this account here. Our team will help you.'); return assign(conv, roundRobin(), null).then(() => emitConv(conv)); }
    return say(conv, 'Those digits do not match. Please try again with the last 4 digits of the phone number registered on the account, or type *menu*.');
  }
  if (st === 'retail_menu') {
    const acc = retail.byId(conv.retailId); if (!acc) return retailAskAccount(conv);
    const c = retailChoice(text, replyId);
    if (c === 'menu') return showMenu(conv);
    if (c === 'human') return routeRetailHuman(conv);
    if (c === 'r_details') await say(conv, retail.detailsText(acc));
    else if (c === 'r_products') await say(conv, retail.productsText(acc, ((/^(?:show\s+)?(?:me\s+)?(?:the\s+)?(?:products?|price list|prices?|items)\b(.*)$/i.exec(text.trim()) || [])[1] || '').trim()));
    else if (c === 'r_balance') await say(conv, retail.balanceText(acc));
    else if (c === 'r_orders') await say(conv, retail.ordersText(acc, conv.phone));
    else { const hit = orders.looksLikeId(text) ? orders.lookup(text, orgNamesOf(conv)) : []; if (hit.length) await say(conv, hit.slice(0, 5).map(o => orders.formatOrder(o, { links: true })).join('\n\n')); else return retailMenu(conv, "Sorry, I didn't understand that."); }
    return retailMenu(conv);
  }
  // registration
  if (REG_STEPS[st]) {
    const key = REG_STEPS[st][1], v = text.trim();
    if (key === 'name' && v.length < 2) return say(conv, 'Please send the shop name.');
    if (key === 'address' && v.length < 6) return say(conv, 'Please send the full address (street, area).');
    if (key === 'phone') { if (/^same$/i.test(v)) conv.reg.phone = conv.phone; else if (orders.digits(v).length < 7) return say(conv, 'Please send a valid phone number, or type *same*.'); else conv.reg.phone = v; }
    else conv.reg[key] = v.slice(0, 160);
    const order = ['reg_name', 'reg_contact', 'reg_phone', 'reg_address', 'reg_city'], next = order[order.indexOf(st) + 1];
    return next ? regAsk(conv, next) : regAskRegion(conv);
  }
  if (st === 'reg_region') {
    const list = retail.regionList(), t = norm(text), byNum = list[(parseInt(t, 10) || 0) - 1], byId = replyId && /^rg\d+$/.test(replyId) ? list[+replyId.slice(2)] : null;
    const g = byId || byNum || retail.regionOf(text); if (!g) return regAskRegion(conv);
    conv.reg.region = g.name;
    const acc = retail.register(conv.reg, conv.phone); conv.reg = null;
    conv.retailId = acc.id; conv.retailName = acc.name; conv.retailRegion = acc.region;
    await say(conv, `✅ Your shop is registered!\n\nYour account number is *${acc.id}*\nPlease save it. Next time choose *${store.db.settings.menu.retail}* and send this number to see your details, products and balance.`);
    await say(conv, retail.detailsText(acc));
    record(conv, { dir: 'sys', from: 'system', text: `New retail shop registered: ${acc.name} (${acc.id}, ${acc.region})` });
    return retailMenu(conv);
  }
}

// ---------- customers who arrive through a WhatsApp link ----------
async function applyIntake(conv, ik, silent) {
  let a = agentById(ik.agentId); if (!a || !a.active) a = roundRobin();
  const org = ik.orgId ? store.db.organizations.find(o => o.id === ik.orgId) : null;
  if (ik.name && (!conv.name || conv.name === conv.phone)) conv.name = ik.name;
  if (!org && ik.org) conv.orgName = ik.org.slice(0, 80);
  ik.used = true; ik.phone = ik.phone || conv.phone; conv.viaLink = ik.linkName;
  record(conv, { dir: 'sys', from: 'system', text: `🔗 Came from the link “${ik.linkName}”${links.summary(ik) ? ' — ' + links.summary(ik) : ''}` });
  await assign(conv, a, org, silent);
}

// ---------- main entry for every customer message ----------
async function onIncoming({ phone, name, text, replyId, waId, media: file, jid, noBot }) {
  const s = store.db.settings;
  const conv = getConv(phone, name);
  if (jid && conv.jid !== jid) conv.jid = jid; // linked phones answer to this exact WhatsApp address
  text = String(text || '').trim();
  if (conv.status === 'resolved') { conv.status = 'bot'; conv.stage = 'menu'; conv.agentId = conv.agentId; delete conv.trackScope; delete conv.pendingQuery; }
  conv.lastCustomerAt = now();
  let att; if (file && file.buf) { try { att = media.save(file.buf, { mime: file.mime, name: file.name, voice: file.voice, secs: file.secs, phone }); } catch (e) { console.error('could not save media:', e.message); } }
  record(conv, { dir: 'in', from: 'customer', text, ...(att ? { media: att } : {}) });
  conv.unread = (conv.unread || 0) + 1;
  if (waId) wa.markRead(waId);

  // the customer came through one of the admin's WhatsApp links (the message carries "Ref: XXXXXX"): connect them to the chosen person
  const ik = links.match(text, phone);
  if (ik) return applyIntake(conv, ik, !!noBot);

  // plain shared inbox (bot switched off for a linked phone): nobody answers automatically
  if (noBot) { if (conv.status === 'bot' || conv.status === 'resolved') { conv.status = 'waiting'; conv.stage = 'human'; } return emitConv(conv); }
  // a voice note / picture / file cannot be understood by the bot: hand it to the person who looks after this customer
  if (att && !text && conv.status === 'bot') return routeToHuman(conv);

  // "call" / "contact": give the number of the person who looks after their company
  if (/^(call|call me|call karo|phone|contact|contact number|number|your number)$/i.test(text)) {
    const ct = track.callText(conv); if (ct) return say(conv, ct);
  }

  // Customer can always escape back to the menu
  if (/^(menu|0|start|restart)$/i.test(text) && conv.status !== 'assigned') return showMenu(conv);
  if (/^(menu|0)$/i.test(text) && conv.status === 'assigned') { /* human is handling; menu keyword reopens the bot */ conv.status = 'bot'; conv.agentId = conv.agentId; return showMenu(conv); }

  // "change organization": pick a different organization for tracking
  if (conv.status !== 'assigned' && conv.status !== 'waiting' && /^(change|change org(anization)?|other org(anization)?|switch org(anization)?)$/i.test(text)) return askTrackOrg(conv, '', true);

  // A person is already looking after this chat: stay quiet
  if (conv.status === 'assigned' || conv.status === 'waiting') {
    // ...except when the customer just sends a bare PO / P.R / CN number: answer from their company's sheet right away
    // (only when we know their organization: the search is limited to that organization's sheet)
    if (text.length <= 40 && text.split(/[\s,;:]+/).filter(Boolean).length <= 2) {
      if (conv.retailId) { if (orders.looksLikeId(text)) { const hits = orders.lookup(text, orgNamesOf(conv)); if (hits.length) await say(conv, hits.slice(0, 5).map(o => orders.formatOrder(o, { links: true })).join('\n\n')); } }
      else { const pool = knownPool(conv); if (pool && orders.looksLikeId(text, pool)) { const hits = orders.lookup(text, [], pool); if (hits.length) await replyOrders(conv, hits); } }
    }
    if (conv.status === 'waiting') { const a = conv.orgId ? agentForOrg(store.db.organizations.find(o => o.id === conv.orgId) || { }) : roundRobin(); if (a) await assign(conv, a, null, true); }
    return emitConv(conv);
  }

  switch (conv.stage) {
    case 'await_org': {
      const org = matchOrg(text, 0.6);
      if (org) return routeToOrg(conv, org);
      conv.orgName = text.slice(0, 80);
      await say(conv, s.notFoundOrg);
      return assign(conv, roundRobin(), null, true).then(() => emitConv(conv));
    }
    case 'track_org': return handleTrackOrg(conv, text, replyId);
    case 'await_order': {
      if (parseChoice(text, replyId) === 'human') return routeToHuman(conv);
      if (/^(change|change org(anization)?|org(anization)?|other org(anization)?|switch)$/i.test(text)) return askTrackOrg(conv, '', true);
      if (!conv.trackScope) return askTrackOrg(conv, text);
      return runTrack(conv, text);
    }
    default: if (/^(retail_|reg_)/.test(conv.stage)) return handleRetailStage(conv, text, replyId); break;
  }

  // menu stage
  const choice = parseChoice(text, replyId);
  if (choice === 'guide') { await say(conv, s.guideText + '\n\nType *menu* to go back.'); return; }
  if (choice === 'org') { conv.stage = 'await_org'; return say(conv, s.orgPrompt); }
  if (choice === 'human') return routeToHuman(conv);
  if (choice === 'retail') return retailAskAccount(conv);
  if (choice === 'track') {
    if (!conv.trackScope) return askTrackOrg(conv); // organization first
    const mine = orders.findByPhone(phone, poolOf(conv.trackScope));
    conv.stage = 'await_order';
    if (mine.length) return replyOrders(conv, mine, '\n\nSend another PO / P.R / CN number to check a different order, or type *menu*.');
    return say(conv, `Tracking in *${conv.trackScope.label}* records. ` + s.trackPrompt + '\n(Type *change* to choose another organization.)');
  }
  // free text: did they just tell us their organization? ("Hi, I'm from Hilton")
  const org = matchOrg(text, 0.85);
  if (org) return routeToOrg(conv, org);
  // a shop typed its account number straight away
  const racc = retail.findInText(text); if (racc && !orders.looksLikeId(text)) return retailOpen(conv, racc);
  // order id typed straight away
  if (conv.retailId) { const direct = (/\b[A-Za-z]{2,5}-?\d{3,}\b/.test(text) || orders.looksLikeId(text)) ? orders.lookup(text, orgNamesOf(conv)) : []; if (direct.length) return say(conv, direct.slice(0, 5).map(o => orders.formatOrder(o, { links: true })).join('\n\n')); return showMenu(conv); }
  if (text.length <= 40 && /\d{4,}/.test(text) && (orders.looksLikeNumber(text) || /\b[A-Za-z]{2,5}-?\d{3,}\b/.test(text))) {
    if (!conv.trackScope) return askTrackOrg(conv, text); // a number, but whose? ask the organization first
    return runTrack(conv, text);
  }
  return showMenu(conv);
}

// ---------- team actions ----------
async function agentSend(convPhone, agent, text) {
  const conv = store.db.conversations[convPhone];
  if (!conv) throw new Error('Conversation not found');
  if (wa.mode() === 'cloud' && conv.lastCustomerAt && now() - conv.lastCustomerAt > 24 * 3600 * 1000)
    throw new Error('WhatsApp only allows free-form replies within 24 hours of the customer\'s last message.');
  if (conv.status === 'bot' || conv.status === 'waiting' || !conv.agentId) { conv.agentId = agent.id; conv.status = 'assigned'; conv.stage = 'human'; }
  const m = record(conv, { dir: 'out', from: 'agent', agentId: agent.id, agentName: agent.name, text });
  if (!conv.firstResponseAt) conv.firstResponseAt = now();
  conv.unread = 0;
  const r = await wa.sendText(conv.phone, text);
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); throw new Error(r.error); }
  return m;
}

// A voice note, picture, video or file from a team member. opts: { buf, mime, filename, caption, voice, secs }
async function agentSendMedia(convPhone, agent, o) {
  const conv = store.db.conversations[convPhone];
  if (!conv) throw new Error('Conversation not found');
  if (wa.mode() === 'cloud' && conv.lastCustomerAt && now() - conv.lastCustomerAt > 24 * 3600 * 1000)
    throw new Error('WhatsApp only allows free-form replies within 24 hours of the customer\'s last message.');
  let { buf, mime } = o, voice = !!o.voice;
  if (voice) { const v = await media.prepareVoice(buf, mime); buf = v.buf; mime = v.mime; voice = v.voice; }
  if (buf.length > 16 * 1024 * 1024) throw new Error('That file is too big (WhatsApp allows up to 16 MB).');
  if (conv.status === 'bot' || conv.status === 'waiting' || !conv.agentId) { conv.agentId = agent.id; conv.status = 'assigned'; conv.stage = 'human'; }
  const att = media.save(buf, { mime, name: o.filename, voice, secs: o.secs, phone: convPhone });
  const m = record(conv, { dir: 'out', from: 'agent', agentId: agent.id, agentName: agent.name, text: o.caption || '', media: att });
  if (!conv.firstResponseAt) conv.firstResponseAt = now();
  conv.unread = 0;
  const r = await wa.sendMedia(conv.phone, { buf, mime, filename: att.name, caption: o.caption, voice });
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); throw new Error(r.error); }
  return m;
}

// A file the desk sends by itself (e.g. the order PDF). Creates the chat if this customer never wrote before.
async function autoSendMedia(phone, name, o) {
  const conv = getConv(phone, name);
  if (wa.mode() === 'cloud' && !(conv.lastCustomerAt && now() - conv.lastCustomerAt < 24 * 3600 * 1000))
    throw new Error('The official WhatsApp API only lets you message a customer first with an approved message template (this customer wrote more than 24 hours ago). Use the linked-phone connection, or ask the customer to message you.');
  if (o.buf.length > 16 * 1024 * 1024) throw new Error('That file is too big (WhatsApp allows up to 16 MB).');
  const att = media.save(o.buf, { mime: o.mime, name: o.filename, phone });
  const m = record(conv, { dir: 'out', from: 'bot', text: o.caption || '', media: att });
  const r = await wa.sendMedia(conv.phone, { buf: o.buf, mime: o.mime, filename: att.name, caption: o.caption });
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); throw new Error(r.error); }
  return m;
}
// A product from the WhatsApp catalog, sent by a team member as a native product card (Cloud API).
async function agentSendCatalog(convPhone, agent, o) {
  const conv = store.db.conversations[convPhone]; if (!conv) throw new Error('Conversation not found');
  if (wa.mode() !== 'cloud') throw new Error('Catalog products need the official WhatsApp Cloud API.');
  if (conv.lastCustomerAt && now() - conv.lastCustomerAt > 24 * 3600 * 1000) throw new Error("WhatsApp only allows free-form replies within 24 hours of the customer's last message.");
  if (conv.status === 'bot' || conv.status === 'waiting' || !conv.agentId) { conv.agentId = agent.id; conv.status = 'assigned'; conv.stage = 'human'; }
  const m = record(conv, { dir: 'out', from: 'agent', agentId: agent.id, agentName: agent.name, text: '🛍 ' + (o.label || 'Product') });
  const r = await wa.sendCatalogProduct(conv.phone, o.catalogId, o.retailerId, o.body);
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); throw new Error(r.error); }
  return m;
}

// Desk-only delete: the messages (and their saved pictures / files) are removed here; the customer's WhatsApp is not touched.
function deleteMessages(phone, ids) {
  const gone = new Set(ids), db = store.db, hit = db.messages.filter(m => m.phone === phone && gone.has(m.id));
  db.messages = db.messages.filter(m => !(m.phone === phone && gone.has(m.id)));
  for (const m of hit) if (m.media && m.media.id) {
    const used = db.messages.some(x => x.media && x.media.id === m.media.id);
    if (!used) for (const f of [media.file(m.media.id), media.file(m.media.id) + '.json']) { try { require('fs').unlinkSync(f); } catch {} }
  }
  const conv = db.conversations[phone];
  if (conv) { const l = [...db.messages].reverse().find(m => m.phone === phone && m.dir !== 'sys'); conv.lastPreview = l ? ((l.text || '').trim() || (l.media ? MEDIA_LABEL(l.media) : '')).replace(/\s+/g, ' ').slice(0, 90) : ''; }
  store.save(); bus.emit('event', { type: 'messages-deleted', phone, ids: hit.map(m => m.id) }); if (conv) emitConv(conv);
  return hit.length;
}
// Forward messages (text, pictures, voice notes, files) from one chat to other chats, as the team member.
async function forward(fromPhone, ids, toPhones, agent) {
  const set = new Set(ids), msgs = store.db.messages.filter(m => m.phone === fromPhone && set.has(m.id) && m.dir !== 'sys').sort((a, b) => a.ts - b.ts);
  let sent = 0, failed = 0, error = '';
  for (const to of toPhones) for (const m of msgs) {
    try {
      const meta = m.media && m.media.id ? media.meta(m.media.id) : null;
      if (meta) await agentSendMedia(to, agent, { buf: media.read(m.media.id), mime: meta.mime, filename: meta.name, caption: m.text || '', voice: !!meta.voice, secs: meta.secs });
      else if ((m.text || '').trim()) await agentSend(to, agent, m.text.trim());
      else continue;
      sent++;
    } catch (e) { failed++; error = e.message; }
  }
  return { sent, failed, error };
}

// a message with ONE tappable button (desk: a button; linked phone: the address in the text; Cloud API: a real button)
async function agentSendLink(convPhone, agent, body, label, url) {
  const conv = store.db.conversations[convPhone]; if (!conv) throw new Error('Conversation not found');
  if (conv.status === 'bot' || conv.status === 'waiting' || !conv.agentId) { conv.agentId = agent.id; conv.status = 'assigned'; conv.stage = 'human'; }
  const m = record(conv, { dir: 'out', from: 'agent', agentId: agent.id, agentName: agent.name, text: body, links: [{ text: label, url }] });
  if (!conv.firstResponseAt) conv.firstResponseAt = now();
  const r = await wa.sendLinkButton(conv.phone, body, label, url);
  if (!r.ok) { m.error = r.error; bus.emit('event', { type: 'message', message: m }); throw new Error(r.error); }
  return m;
}
// a line in the chat ("📞 Missed call"); unread=true also counts it as unread
function noteSys(conv, text, unread) { record(conv, { dir: 'sys', from: 'system', text }); if (unread) conv.unread = (conv.unread || 0) + 1; emitConv(conv); }

// ---------- things that happen on a linked phone ----------
// a message you typed on the phone itself (shown in the desk so the team sees the whole conversation)
async function onPhoneSent({ phone, jid, text, media: file, waId }) {
  const conv = store.db.conversations[phone]; if (!conv) return; // only chats that already exist here
  if (jid && conv.jid !== jid) conv.jid = jid;
  let att; if (file && file.buf) { try { att = media.save(file.buf, { mime: file.mime, name: file.name, voice: file.voice, secs: file.secs, phone }); } catch {} }
  record(conv, { dir: 'out', from: 'phone', text: String(text || '').trim(), ...(att ? { media: att } : {}) });
  conv.unread = 0; emitConv(conv);
}
// someone rang this number on WhatsApp: note it in the chat (and optionally decline with a message)
async function onCall({ phone, jid, video }) {
  if (!phone) return {};
  const conv = getConv(phone, ''); if (jid && !conv.jid) conv.jid = jid;
  record(conv, { dir: 'sys', from: 'system', text: `📞 Incoming WhatsApp ${video ? 'video' : 'voice'} call` });
  conv.unread = (conv.unread || 0) + 1; emitConv(conv);
  const L = link.settings();
  if (L.rejectCalls) { if (L.callReply) await say(conv, L.callReply); return { reject: true }; }
  return {};
}

function transfer(convPhone, agentId, by) {
  const conv = store.db.conversations[convPhone]; const a = agentById(agentId);
  if (!conv || !a) throw new Error('Not found');
  conv.agentId = a.id; conv.status = 'assigned'; conv.stage = 'human';
  record(conv, { dir: 'sys', from: 'system', text: `${by} assigned this chat to ${a.name}` });
  return conv;
}
async function resolve(convPhone, by) {
  const conv = store.db.conversations[convPhone]; if (!conv) throw new Error('Not found');
  conv.status = 'resolved'; conv.stage = 'menu'; conv.unread = 0; conv.resolvedAt = now();
  record(conv, { dir: 'sys', from: 'system', text: `${by} marked this chat as resolved` });
  await say(conv, store.db.settings.closedMessage);
  return conv;
}

module.exports = { autoSendMedia, agentSendCatalog, deleteMessages, forward, bus, noteSys, onIncoming, agentSend, agentSendLink, agentSendMedia, onPhoneSent, onCall, transfer, resolve, matchOrg, roundRobin, agentForOrg, getConv, emitConv, agentById };
