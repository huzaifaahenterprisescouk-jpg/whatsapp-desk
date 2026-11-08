const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const cfg = require('./lib/config');
const store = require('./lib/store');
store.load();
const auth0 = require('./lib/auth'); auth0.migrate(); // usernames + hashed passwords (old PINs become the password)
const bot = require('./lib/bot');
const orders = require('./lib/orders');
const sync = require('./lib/sync');
const ms = require('./lib/msgraph');
const retail = require('./lib/retail');
const qbo = require('./lib/qbo');
const woo = require('./lib/woo');
const reports = require('./lib/reports');
const inbox = require('./lib/inbox');
const track = require('./lib/track');
const ai = require('./lib/ai');
const signature = require('./lib/signature');
const wa = require('./lib/whatsapp');
const link = require('./lib/wa-link');
const media = require('./lib/media');
const calls = require('./lib/calls');
const links = require('./lib/links');
const shortlinksBase = o => require('./lib/shortlinks').base(o) || o;   // the address customers will really see
const webcall = require('./lib/webcall');
const { writeRows } = require('./lib/xlsx');

const db = store.db;
if (!db.secret) { db.secret = crypto.randomBytes(24).toString('hex'); store.save(true); }

const PUBLIC = path.join(__dirname, 'public');
// ---------- tiny helpers ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readBody = (req, limit = 12e6) => new Promise((ok, fail) => {
  const chunks = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > limit) { fail(new Error('Upload too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => ok(Buffer.concat(chunks)));
  req.on('error', fail);
});
const readJson = async (req, limit) => { const b = await readBody(req, limit); try { return b.length ? JSON.parse(b) : {}; } catch { throw new Error('Invalid JSON'); } };
const cleanPhone = p => String(p || '').replace(/\D/g, '');

const sign = s => crypto.createHmac('sha256', db.secret).update(s).digest('hex').slice(0, 32);
const makeToken = a => { const body = `${a.id}.${Date.now() + 14 * 86400000}.${auth0.pwTag(a)}`; return `${body}.${sign(body)}`; }; // the tag changes with the password, so a password change ends old sessions
function auth(req, url) {
  const h = req.headers.authorization || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!t) return null; const p = t.split('.'); if (p.length !== 4) return null;
  const body = `${p[0]}.${p[1]}.${p[2]}`;
  if (sign(body) !== p[3] || +p[1] < Date.now()) return null;
  const a = bot.agentById(p[0]); return a && a.pwd && auth0.pwTag(a) === p[2] ? a : null;
}
const pub = a => ({ id: a.id, name: a.name, role: a.role, color: a.color, active: a.active, phone: a.phone || '', title: a.title || '', retailAccess: !retail.scopeOf(a) || retail.scopeOf(a).length > 0, retailRegions: retail.scopeOf(a) || [] });
const publicSettings = () => db.settings;
// Order sheets are private to the team member who looks after that company (Organizations -> main person or backup). Admin sees everything.
function orderGate(u) {
  if (u && u.role === 'admin') return () => true;
  const memo = new Map();
  return o => {
    const k = (o.organization || '') + '|' + (o.company || '');
    if (!memo.has(k)) { const g = track.orgFor(o.organization) || track.orgFor(o.company); memo.set(k, !!(g && u && (g.agentId === u.id || g.backupAgentId === u.id))); }
    return memo.get(k);
  };
}
const srcGate = (u, s) => orderGate(u)({ organization: s.name, company: s.name });

// ---------- live events (SSE) ----------
const clients = new Set();
// chats with retail shops are private to their region: administrator, the person handling the chat, and people given that region
// Without the API (linked phone) each team member sees ONLY the chats assigned to them; the administrator sees everything.
// (With the official API the old rule stays: everyone sees the shared inbox, retail chats only for the people given access.)
const ownOnly = () => wa.mode() !== 'cloud' && link.settings().ownOnly !== false;
const canSeeConv = (u, c) => {
  if (!c || !u || u.role === 'admin') return true;
  if (c.isGroup) return c.agentId === u.id;                        // a WhatsApp group: only the team member the administrator assigned it to
  if (!c.createdAt) return true;                                   // not a real chat yet (e.g. starting a new one)
  if (c.agentId === u.id) return true;
  if (c.retailId && retail.canSeeRegion(u, c.retailRegion)) return true;
  return ownOnly() ? false : !c.retailId;
};
bot.bus.on('event', e => { const data = `data: ${JSON.stringify(e)}\n\n`; for (const c of clients) { if (e.type === 'mail' && !(c.me && (c.me.role === 'admin' || c.me.id === e.thread.agentId))) continue; if (e.type === 'webcall' && e.call.agentId && !(c.me && (c.me.role === 'admin' || c.me.id === e.call.agentId))) continue; const cv = e.type === 'conversation' ? e.conversation : e.type === 'message' && e.message ? db.conversations[e.message.phone] : e.type === 'messages-deleted' ? db.conversations[e.phone] : e.type === 'call' || e.type === 'webcall' ? db.conversations[e.call.phone] : null; if (cv && !canSeeConv(c.me, cv)) { if (e.type === 'conversation') c.write(`data: ${JSON.stringify({ type: 'conversation-removed', phone: cv.phone })}\n\n`); continue; } c.write(data); } });
// everything the Settings → WhatsApp card needs: which connection is in use, whether Cloud API keys exist, linked-phone state
const waStatus = () => ({ ...link.status(), mode: wa.mode(), cloud: wa.mode() === 'cloud', live: wa.connected(), apiKeys: wa.hasApiKeys(), apiOn: wa.apiOn(), callsApi: wa.callsOn() });
link.bus.on('status', () => {
  const adm = `data: ${JSON.stringify({ type: 'wa', status: waStatus() })}\n\n`, all = `data: ${JSON.stringify({ type: 'wamode', mode: wa.mode(), live: wa.connected(), callsApi: wa.callsOn() })}\n\n`;
  for (const c of clients) { if (c.me && c.me.role === 'admin') c.write(adm); c.write(all); } // everyone learns which connection is active (Call button changes)
});
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25000);

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  const me = p === '/api/login' || p === '/api/public' ? null : auth(req, url);
  if (!me && p !== '/api/login' && p !== '/api/public') return json(res, 401, { error: 'Please sign in again' });
  const admin = me && me.role === 'admin';
  const need = () => { if (!admin) { json(res, 403, { error: 'Admins only' }); return false; } return true; };

  if (p === '/api/public' && m === 'GET') return json(res, 200, { business: db.settings.businessName, live: wa.connected() }); // no list of people on the sign-in page
  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req), ip = req.socket.remoteAddress || '', un = auth0.normUser(b.username), wait = auth0.locked(ip, un);
    if (wait) return json(res, 429, { error: `Too many wrong attempts. Try again in ${wait} minute${wait > 1 ? 's' : ''}.` });
    const a = auth0.byUsername(un), good = auth0.verify(b.password, a ? a.pwd : 'scrypt$00$00'); // same work whether or not the username exists
    if (!a || !good) { auth0.fail(ip, un); return json(res, 401, { error: 'Wrong username or password' }); }
    auth0.ok(ip, un); return json(res, 200, { token: makeToken(a), me: { ...pub(a), username: a.username } });
  }
  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.me = me; res.write('retry: 3000\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (p === '/api/bootstrap' && m === 'GET') {
    return json(res, 200, {
      me: { ...pub(me), username: me.username }, ownOnly: !admin && ownOnly(), live: wa.connected(), mode: wa.mode(), callsApi: wa.callsOn(), webhookPath: '/webhook', verifyToken: admin ? cfg.verifyToken : undefined,
      agents: db.agents.map(a => ({ ...pub(a), ...(admin ? { username: a.username } : {}), load: Object.values(db.conversations).filter(c => c.agentId === a.id && c.status === 'assigned').length })),
      organizations: db.organizations, settings: publicSettings(),
      conversations: Object.values(db.conversations).filter(c => canSeeConv(me, c)).sort((a, b) => b.updatedAt - a.updatedAt),
      retailRegionList: admin ? retail.R().regions.map(g => ({ code: g.code, name: g.name })) : undefined,
      orderCount: db.orders.length,
    });
  }

  let mt;
  if ((mt = p.match(/^\/api\/conversations\/(\d+)\/(messages|send|send-media|delete-messages|forward|assign|resolve|read|reopen|suggest|ai-draft|ai-ask)$/))) {
    const phone = mt[1], act = mt[2], conv = db.conversations[phone];
    if (!conv || !canSeeConv(me, conv)) return json(res, 404, { error: 'Conversation not found' });
    // WhatsApp groups: the assigned team member may only read, send messages / files / voice notes and start the voice call.
    // Assigning, resolving, deleting, forwarding and the AI helper are for the administrator.
    if (conv.isGroup && !admin && !['messages', 'send', 'send-media', 'read'].includes(act)) return json(res, 403, { error: 'Only an administrator can do this in a WhatsApp group. You can chat and call in it.' });
    if (conv.isGroup && act === 'messages') return json(res, 200, { messages: db.messages.filter(x => x.phone === phone).slice(-300), orders: [], suggestion: null, handler: null });
    if (conv.isGroup && act === 'suggest') return json(res, 200, { suggestion: null });
    if (act === 'messages') return json(res, 200, { messages: db.messages.filter(x => x.phone === phone).slice(-300), orders: orders.findByPhone(phone), suggestion: track.suggestion(conv), handler: conv.orgName ? track.handlerOf(conv.orgName) : null });
    if (act === 'suggest') return json(res, 200, { suggestion: track.suggestion(conv) });
    if (act === 'ai-draft') { try { return json(res, 200, await ai.draftReply(conv)); } catch (e) { return json(res, 502, { error: e.message }); } }
    if (act === 'ai-ask') { const b = await readJson(req); try { return json(res, 200, await ai.ask(conv, b.question)); } catch (e) { return json(res, 502, { error: e.message }); } }
    if (act === 'read') { conv.unread = 0; store.save(); bot.emitConv(conv); return json(res, 200, { ok: true }); }
    if (act === 'send') {
      const b = await readJson(req); if (!String(b.text || '').trim()) return json(res, 400, { error: 'Message is empty' });
      try { await bot.agentSend(phone, me, String(b.text).trim()); return json(res, 200, { ok: true }); }
      catch (e) { return json(res, 502, { error: e.message }); }
    }
    if (act === 'send-media' && m === 'POST') { // raw file in the body: a recorded voice note, a picture, a document ...
      let buf; try { buf = await readBody(req, 24e6); } catch (e) { return json(res, 413, { error: 'That file is too large' }); }
      if (!buf.length) return json(res, 400, { error: 'The file is empty' });
      const q = url.searchParams, mime = String(req.headers['content-type'] || 'application/octet-stream');
      try { await bot.agentSendMedia(phone, me, { buf, mime, filename: String(q.get('name') || '').slice(0, 120), caption: String(q.get('caption') || '').slice(0, 1000), voice: q.get('voice') === '1', secs: +q.get('secs') || 0 }); return json(res, 200, { ok: true }); }
      catch (e) { return json(res, 502, { error: e.message }); }
    }
    if (act === 'delete-messages' && m === 'POST') { // removes messages from the desk only (WhatsApp cannot recall them)
      const b = await readJson(req), ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String));
      const mine = db.messages.filter(x => x.phone === phone && ids.has(x.id));
      if (!mine.length) return json(res, 200, { deleted: 0 });
      if (!admin && mine.some(x => x.dir !== 'out')) return json(res, 403, { error: 'Only an administrator can delete messages received from customers.' });
      return json(res, 200, { deleted: bot.deleteMessages(phone, mine.map(x => x.id)) });
    }
    if (act === 'forward' && m === 'POST') {
      const b = await readJson(req), to = (Array.isArray(b.to) ? b.to : []).map(String).filter(t => t !== phone && db.conversations[t] && canSeeConv(me, db.conversations[t]));
      if (!to.length || !Array.isArray(b.ids) || !b.ids.length) return json(res, 400, { error: 'Choose the messages and at least one chat' });
      return json(res, 200, await bot.forward(phone, b.ids.map(String), to, me));
    }
    if (act === 'assign') { const b = await readJson(req); if (conv.isGroup && b.agentId && !db.agents.some(a => a.id === b.agentId && a.active)) return json(res, 400, { error: 'Choose an active team member' }); try { bot.transfer(phone, b.agentId, me.name); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (act === 'resolve') { await bot.resolve(phone, me.name); return json(res, 200, { ok: true }); }
    if (act === 'reopen' && conv.isGroup) { conv.status = conv.agentId ? 'assigned' : 'waiting'; store.save(); bot.emitConv(conv); return json(res, 200, { ok: true }); }
    if (act === 'reopen') { conv.status = 'assigned'; conv.agentId = conv.agentId || me.id; conv.stage = 'human'; conv.botOpen = false; store.save(); bot.emitConv(conv); return json(res, 200, { ok: true }); }
  }

  // files in chats (voice notes, pictures ...): served only to people who may see that chat; supports Range so audio can be scrubbed
  if ((mt = p.match(/^\/api\/media\/([a-z0-9]+)$/)) && m === 'GET') {
    const meta = media.meta(mt[1]); if (!meta || !fs.existsSync(media.file(meta.id))) return json(res, 404, { error: 'File not found' });
    if (!canSeeConv(me, db.conversations[meta.phone])) return json(res, 404, { error: 'File not found' });
    const inlineOk = /^(audio|video)\//.test(meta.mime) || /^image\/(jpeg|png|gif|webp)$/.test(meta.mime) || meta.mime === 'application/pdf';
    const total = fs.statSync(media.file(meta.id)).size, rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    const h = { 'Content-Type': inlineOk ? meta.mime : 'application/octet-stream', 'Content-Disposition': `${inlineOk && url.searchParams.get('dl') !== '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'bytes', 'Content-Security-Policy': "sandbox; default-src 'none'; media-src 'self'; img-src 'self'" };
    if (rg && total) { let a = rg[1] === '' ? Math.max(0, total - +rg[2]) : +rg[1], b = rg[1] === '' || rg[2] === '' ? total - 1 : Math.min(+rg[2], total - 1); if (a > b || a >= total) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); } res.writeHead(206, { ...h, 'Content-Range': `bytes ${a}-${b}/${total}`, 'Content-Length': b - a + 1 }); return fs.createReadStream(media.file(meta.id), { start: a, end: b }).pipe(res); }
    res.writeHead(200, { ...h, 'Content-Length': total }); return fs.createReadStream(media.file(meta.id)).pipe(res);
  }

  // WhatsApp voice calls (Cloud API Calling; the browser carries the audio)
  if (p === '/api/calls' && m === 'POST') {
    const b = await readJson(req), phone = cleanPhone(b.phone), cv = db.conversations[phone] || { phone };
    if (!canSeeConv(me, db.conversations[phone])) return json(res, 404, { error: 'Chat not found' });
    try { return json(res, 200, await calls.start(phone, String(b.sdp || ''), me)); } catch (e) { return json(res, 400, { error: e.message, code: e.code }); }
  }
  if (p === '/api/calls/permission' && m === 'POST') { try { return json(res, 200, await calls.askPermission(cleanPhone((await readJson(req)).phone))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/calls/enable' && m === 'POST') { if (!need()) return; try { await calls.enable(); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if ((mt = p.match(/^\/api\/calls\/([\w.=-]+)\/(accept|reject|terminate)$/)) && m === 'POST') {
    try { const b = await readJson(req); return json(res, 200, mt[2] === 'accept' ? await calls.accept(mt[1], String(b.sdp || '')) : mt[2] === 'reject' ? await calls.reject(mt[1]) : await calls.terminate(mt[1])); } catch (e) { return json(res, 400, { error: e.message, code: e.code }); }
  }

  // voice calls without the API (browser to browser): invite a customer, answer, hang up
  if (p === '/api/webcall/config' && m === 'GET') return json(res, 200, { ice: webcall.iceServers() });
  if (p === '/api/webcall/invite' && m === 'POST') {
    const b = await readJson(req), phone = cleanPhone(b.phone), conv = db.conversations[phone];
    if (!conv || !canSeeConv(me, conv)) return json(res, 404, { error: 'Chat not found' });
    try { const origin = links.baseUrl(String(b.origin || `http://${req.headers.host}`)); const r = await webcall.invite(conv, me, origin); return json(res, 200, { ...r, local: !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(shortlinksBase(origin)) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/webcall/cancel' && m === 'POST') { const cv = db.conversations[cleanPhone((await readJson(req)).phone)]; if (cv && canSeeConv(me, cv)) webcall.cancel(cv); return json(res, 200, { ok: true }); }
  if ((mt = p.match(/^\/api\/webcall\/([a-f0-9]+)\/(answer|end)$/)) && m === 'POST') {
    const r = webcall.roomOf(mt[1]), cv = r && db.conversations[r.phone]; if (!r || !canSeeConv(me, cv)) return json(res, 404, { error: 'This call has already ended.' });
    try { return json(res, 200, mt[2] === 'answer' ? webcall.answer(mt[1], String((await readJson(req)).sdp || ''), me) : webcall.end(mt[1], 'agent')); } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // WhatsApp groups (administrator): every group the linked number is in, and which team member looks after each
  if (p === '/api/groups' && m === 'GET') {
    if (!need()) return;
    let phoneGroups = []; try { phoneGroups = await link.listGroups(); } catch { /* not connected: show the groups we already know */ }
    return json(res, 200, { connected: link.connected(), linkMode: wa.mode() === 'link', enabled: link.settings().groups !== false, groups: bot.groupList(phoneGroups) });
  }
  if ((mt = p.match(/^\/api\/groups\/(\d+)\/assign$/)) && m === 'POST') {
    if (!need()) return;
    const b = await readJson(req), jid = String(b.jid || '');
    if (b.agentId && !db.agents.some(a => a.id === b.agentId && a.active)) return json(res, 400, { error: 'Choose an active team member' });
    try { bot.ensureGroup(mt[1], jid, String(b.name || '')); bot.transfer(mt[1], b.agentId || '', me.name); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // WhatsApp links (admin): public forms that send customers to WhatsApp and route them to the right person
  if (p === '/api/links' && m === 'GET') { if (!need()) return; return json(res, 200, { links: links.list(), cfg: links.cfgView(), mode: wa.mode(), apiOn: wa.apiOn(), apiKeys: wa.hasApiKeys(), callsApi: wa.callsOn() }); }
  if (p === '/api/links' && m === 'POST') { if (!need()) return; try { return json(res, 200, links.save(null, await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/links/config' && m === 'PUT') { if (!need()) return; return json(res, 200, links.setCfg(await readJson(req))); }
  if ((mt = p.match(/^\/api\/links\/(l_[a-f0-9]+)(\/qr)?$/))) {
    if (!need()) return;
    if (mt[2] && m === 'GET') { try { const L = links.list().find(x => x.id === mt[1]); if (!L) return json(res, 404, { error: 'Link not found' }); return json(res, 200, { qr: await require('qrcode').toDataURL(`${links.baseUrl(url.searchParams.get('origin') || `http://${req.headers.host}`)}/go/${L.slug}`, { margin: 1, width: 320 }) }); } catch (e) { return json(res, 400, { error: 'QR codes need the "qrcode" package (npm install).' }); } }
    if (m === 'PUT') { try { return json(res, 200, links.save(mt[1], await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (m === 'DELETE') { links.remove(mt[1]); return json(res, 200, { ok: true }); }
  }

  // link your phone's WhatsApp number (QR code / pairing code), like WhatsApp Web
  if (p === '/api/wa' && m === 'GET') { if (!need()) return; return json(res, 200, waStatus()); }
  if (p === '/api/wa/link' && m === 'POST') { if (!need()) return; try { const b = await readJson(req); await link.link({ method: b.method === 'code' ? 'code' : 'qr', phone: b.phone }); return json(res, 200, waStatus()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/wa/reconnect' && m === 'POST') { if (!need()) return; try { await link.reconnect(); return json(res, 200, waStatus()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/wa/unlink' && m === 'POST') { if (!need()) return; try { await link.unlink(); return json(res, 200, waStatus()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/wa/settings' && m === 'PUT') { if (!need()) return; link.updateSettings(await readJson(req)); return json(res, 200, waStatus()); }

  // find a PO / P.R / CN number -> order details + who to call
  if (p === '/api/track/search' && m === 'GET') {
    const q = url.searchParams.get('q') || '';
    const results = track.search(q, 30, orderGate(me)).map(r => ({ ...r, chat: db.conversations[r.customerPhone] && canSeeConv(me, db.conversations[r.customerPhone]) ? { phone: r.customerPhone, status: db.conversations[r.customerPhone].status } : null }));
    return json(res, 200, { results });
  }
  // my email signature (every team member edits only their own)
  // my mail look (theme + background picture): every team member has their own, nobody else can see it
  if (p === '/api/me/theme' && m === 'GET') return json(res, 200, { theme: me.theme || {} });
  if (p === '/api/me/theme' && m === 'PUT') {
    const b = await readJson(req, 6e6), t = {};
    if (['auto', 'light', 'dark'].includes(b.mode)) t.mode = b.mode;
    if (/^[a-z]{3,10}$/.test(b.accent || '')) t.accent = b.accent;
    if (/^[a-z]{2,12}$/.test(b.bg || '')) t.bg = b.bg;
    if (['comfortable', 'cozy', 'compact'].includes(b.density)) t.density = b.density;
    t.light = !!b.light;
    if (typeof b.bgImg === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]*$/.test(b.bgImg)) { if (b.bgImg.length > 3.5e6) return json(res, 400, { error: 'That background picture is too large (max about 2.5 MB)' }); t.bgImg = b.bgImg; } else t.bgImg = '';
    me.theme = t; store.save(); return json(res, 200, { ok: true });
  }
  if (p === '/api/me/signature' && m === 'GET') return json(res, 200, signature.view(me));
  if (p === '/api/me/signature' && m === 'PUT') { try { return json(res, 200, signature.set(me, await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/ai/config' && m === 'GET') return json(res, 200, ai.publicConfig());
  if (p === '/api/ai/config' && m === 'PUT') { if (!need()) return; return json(res, 200, ai.setConfig(await readJson(req))); }

  if (p === '/api/simulate' && m === 'POST') {
    const b = await readJson(req); const phone = cleanPhone(b.phone);
    if (phone.length < 7) return json(res, 400, { error: 'Enter a phone number' });
    const L = link.settings(), lm = wa.mode() !== 'cloud'; // the Test Phone behaves like the real linked number
    await bot.onIncoming({ phone, name: b.name || '', text: b.text || '', replyId: b.replyId, ...(lm ? { noBot: !L.autoBot, autoAssign: L.assignNew !== false } : {}) });
    return json(res, 200, { ok: true });
  }

  // organizations
  if (p === '/api/organizations' && m === 'POST') {
    if (!need()) return; const b = await readJson(req);
    if (!String(b.name || '').trim()) return json(res, 400, { error: 'Organization name is required' });
    const o = { id: store.nextId('o'), name: b.name.trim(), aliases: (b.aliases || []).map(s => s.trim()).filter(Boolean), agentId: b.agentId || '', backupAgentId: b.backupAgentId || '', emails: (b.emails || []).map(s => s.trim().toLowerCase()).filter(Boolean) };
    db.organizations.push(o); store.save(); return json(res, 200, o);
  }
  if ((mt = p.match(/^\/api\/organizations\/([\w-]+)$/))) {
    if (!need()) return; const o = db.organizations.find(x => x.id === mt[1]); if (!o) return json(res, 404, { error: 'Not found' });
    if (m === 'DELETE') { db.organizations = db.organizations.filter(x => x !== o); store.save(); return json(res, 200, { ok: true }); }
    if (m === 'PATCH') { const b = await readJson(req); for (const k of ['name', 'agentId', 'backupAgentId']) if (b[k] !== undefined) o[k] = b[k]; if (b.emails) o.emails = b.emails.map(s => s.trim().toLowerCase()).filter(Boolean); if (b.aliases) o.aliases = b.aliases.map(s => s.trim()).filter(Boolean); store.save(); return json(res, 200, o); }
  }

  // team
  if (p === '/api/agents' && m === 'POST') {
    if (!need()) return; const b = await readJson(req);
    const un = auth0.normUser(b.username), pw = auth0.passwordProblem(b.password);
    if (!String(b.name || '').trim()) return json(res, 400, { error: 'Enter the person’s name' });
    if (!auth0.validUser(un)) return json(res, 400, { error: 'Username: 3–32 letters, numbers, dot, dash or underscore (e.g. sara.khan)' });
    if (auth0.byUsername(un)) return json(res, 400, { error: 'That username is already taken' });
    if (pw) return json(res, 400, { error: pw });
    const palette = ['#7c3aed', '#d97706', '#db2777', '#2563eb', '#059669', '#dc2626', '#0891b2'];
    const a = { id: store.nextId('a'), name: b.name.trim(), username: un, pwd: auth0.hash(b.password), role: b.role === 'admin' ? 'admin' : 'agent', color: palette[db.agents.length % palette.length], active: true, phone: cleanPhone(b.phone), title: String(b.title || '').trim().slice(0, 60), retailRegions: retail.cleanCodes(b.retailRegions) };
    db.agents.push(a); store.save(); return json(res, 200, { ...pub(a), username: a.username });
  }
  if ((mt = p.match(/^\/api\/agents\/([\w-]+)$/))) {
    const a = bot.agentById(mt[1]); if (!a) return json(res, 404, { error: 'Not found' });
    if (m === 'PATCH') {
      if (!admin && a.id !== me.id) return json(res, 403, { error: 'Not allowed' });
      const b = await readJson(req);
      if (b.active !== undefined) a.active = !!b.active;
      if (b.phone !== undefined) a.phone = cleanPhone(b.phone);
      if (b.title !== undefined) a.title = String(b.title).trim().slice(0, 60);
      if (admin && b.retailRegions !== undefined) a.retailRegions = retail.cleanCodes(b.retailRegions); // only the administrator decides which retail regions a person sees
      if (admin) { if (b.name) a.name = b.name; if (b.role) a.role = b.role === 'admin' ? 'admin' : 'agent'; }
      if (b.username !== undefined && admin) { const un = auth0.normUser(b.username); if (!auth0.validUser(un)) return json(res, 400, { error: 'Username: 3–32 letters, numbers, dot, dash or underscore' }); const other = auth0.byUsername(un); if (other && other !== a) return json(res, 400, { error: 'That username is already taken' }); a.username = un; }
      let newToken;
      if (b.password) {
        const pw = auth0.passwordProblem(b.password); if (pw) return json(res, 400, { error: pw });
        if (!admin || a.id === me.id) { if (!auth0.verify(b.currentPassword, a.pwd)) return json(res, 400, { error: 'Your current password is not correct' }); } // changing your own password needs the old one
        a.pwd = auth0.hash(b.password); if (a.id === me.id) newToken = makeToken(a); // others are signed out; you stay signed in
      }
      store.save(); return json(res, 200, { ...pub(a), ...(admin || a.id === me.id ? { username: a.username } : {}), token: newToken });
    }
    if (m === 'DELETE') {
      if (!need()) return; if (a.id === me.id) return json(res, 400, { error: "You can't delete yourself" });
      db.agents = db.agents.filter(x => x !== a);
      for (const c of Object.values(db.conversations)) if (c.agentId === a.id) { c.agentId = null; c.status = 'waiting'; }
      for (const o of db.organizations) { if (o.agentId === a.id) o.agentId = ''; if (o.backupAgentId === a.id) o.backupAgentId = ''; }
      store.save(); return json(res, 200, { ok: true });
    }
  }

  // orders / tracking sheets (one sheet per company, e.g. BAFL; customers can search all of them)
  if (p === '/api/orders' && m === 'GET') return json(res, 200, { orders: db.orders.filter(orderGate(me)).map(o => ({ ...o, trackUrl: orders.isUrl(o.link) ? o.link : orders.trackUrl(o) })) });
  if (p === '/api/sources' && m === 'GET') return json(res, 200, { sources: sync.list().filter(s => srcGate(me, s)).map(s => { const v = sync.view(s); return admin ? v : { ...v, url: '', lastError: '' }; }), ms: admin ? ms.publicStatus() : { signedIn: ms.signedIn() } });
  if (p === '/api/sources' && m === 'POST') {
    if (!need()) return;
    try { const s = sync.add(await readJson(req)); if (s.url) await sync.syncNow(s.id).catch(() => {}); return json(res, 200, sync.view(s)); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if ((mt = p.match(/^\/api\/sources\/([\w-]+)(?:\/(sync|upload|config|inspect))?$/))) {
    const s = sync.get(mt[1]); if (!s || !srcGate(me, s)) return json(res, 404, { error: 'That sheet no longer exists' });
    const act = mt[2];
    if (!act && m === 'PUT') { if (!need()) return; try { const b = await readJson(req); const hadUrl = s.url; sync.update(s.id, b); if (s.url && (s.url !== hadUrl || b.syncNow)) await sync.syncNow(s.id).catch(() => {}); return json(res, 200, sync.view(s)); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (!act && m === 'DELETE') { if (!need()) return; sync.remove(s.id); return json(res, 200, { ok: true }); }
    if (act === 'sync' && m === 'POST') { try { const r = await sync.syncNow(s.id); return json(res, 200, { ...r, ...sync.view(s) }); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (act === 'upload' && m === 'POST') {
      if (!need()) return; const buf = await readBody(req);
      if (s.url) return json(res, 400, { error: `"${s.name}" reads its Excel file from a link, so that file is the source. Remove the link first to upload a file by hand.` });
      try { return json(res, 200, orders.importOrders(buf, url.searchParams.get('mode') === 'merge' ? 'merge' : 'replace', s)); }
      catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (act === 'config' && m === 'GET') return json(res, 200, { cfg: orders.getCfg(s), synced: !!s.url, name: s.name });
    if (act === 'config' && m === 'PUT') { if (!need()) return; return json(res, 200, orders.setCfg(s, await readJson(req))); }
    if (act === 'inspect' && m === 'POST') { // read a file's tabs and columns without importing it
      if (!need()) return;
      try {
        let buf = await readBody(req); if (!buf.length) buf = await sync.currentBuffer(s.id);
        let c; try { c = JSON.parse(url.searchParams.get('cfg') || '{}'); } catch { c = {}; }
        return json(res, 200, orders.inspect(buf, { ...orders.getCfg(s), ...c }));
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
  }

  // retail shops (accounts from QuickBooks exports + shops registered in WhatsApp)
  // Retail shops are visible only to the administrator and the people the administrator gave access to (Team page)
  if (p.startsWith('/api/retail') && !(admin || retail.scopeOf(me).length)) return json(res, 403, { error: 'Retail shops are only available to the administrator and the team members they assign.' });
  if (p === '/api/retail' && m === 'GET') return json(res, 200, retail.view(me));
  if (p === '/api/retail/config' && m === 'PUT') { if (!need()) return; try { return json(res, 200, retail.setConfig(await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/retail/export' && m === 'GET') {
    if (!need()) return; const w = ['all', 'approved'].includes(url.searchParams.get('which')) ? url.searchParams.get('which') : 'pending';
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="new-retail-shops-${w}.csv"` }); return res.end('\uFEFF' + retail.exportNew(w));
  }
  if ((mt = p.match(/^\/api\/retail\/files\/(accounts|products|invoices)(?:\/(sync|upload|clear))?$/))) {
    if (!need()) return; const kind = mt[1], act = mt[2];
    try {
      if (!act && m === 'PUT') { const before = retail.R().files[kind].url; const f = retail.setFile(kind, await readJson(req)); if (f.url && f.url !== before) await retail.syncFile(kind).catch(() => {}); return json(res, 200, retail.view().files[kind]); }
      if (act === 'sync' && m === 'POST') { const n = await retail.syncFile(kind); return json(res, 200, { count: n }); }
      if (act === 'upload' && m === 'POST') return json(res, 200, { count: retail.uploadFile(kind, await readBody(req)) });
      if (act === 'clear' && m === 'POST') { retail.clearFile(kind); return json(res, 200, { ok: true }); }
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if ((mt = p.match(/^\/api\/retail\/accounts\/([^/]+)$/))) {
    if (!need()) return; const id = decodeURIComponent(mt[1]);
    try {
      if (m === 'PATCH') return json(res, 200, retail.updateRegistered(id, await readJson(req)));
      if (m === 'DELETE') { retail.removeRegistered(id); return json(res, 200, { ok: true }); }
    } catch (e) { return json(res, 400, { error: e.message }); }
  }

  // QuickBooks Online (live customers, products, invoices; new shops are created in QuickBooks)
  // ---------- WordPress / WooCommerce store ----------
  if (p === '/api/woo' && m === 'GET') { if (!need()) return; return json(res, 200, woo.publicStatus()); }
  if (p === '/api/woo' && m === 'PUT') { if (!need()) return; try { return json(res, 200, woo.setConfig(await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/woo/refresh-rate' && m === 'POST') { if (!need()) return; try { await woo.refreshRate(true); return json(res, 200, woo.publicStatus()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/woo/test' && m === 'POST') { if (!need()) return; try { await readJson(req); return json(res, 200, await woo.test()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/woo/sync' && m === 'POST') { if (!need()) return; try { await readJson(req); return json(res, 200, { ...(await woo.sync()), ...woo.publicStatus() }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/woo/logo' && m === 'POST') { if (!need()) return; try { return json(res, 200, woo.setLogo((await readJson(req, 6e6)).dataUrl)); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/woo/logo' && m === 'DELETE') { if (!need()) return; return json(res, 200, woo.removeLogo()); }
  if (p === '/api/woo/logo.png' && m === 'GET') { if (!need()) return; const b = woo.logo(); if (!b) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': b[0] === 0xff ? 'image/jpeg' : 'image/png', 'Cache-Control': 'no-cache' }); return res.end(b); }
  if (p === '/api/woo/sample.pdf' && m === 'GET') { if (!need()) return; const b = woo.pdfFor(woo.sample(url.searchParams.get('paid') === '1')); res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="sample-order.pdf"' }); return res.end(b); }
  if (p === '/api/woo/products' && m === 'GET') return json(res, 200, woo.listProducts(url.searchParams.get('q'), Math.min(200, +url.searchParams.get('limit') || 60)));
  if (p === '/api/woo/order.pdf' && m === 'GET') {
    const d = woo.orders()[String(url.searchParams.get('id') || '')]; if (!d) return json(res, 404, { error: 'Order not found' });
    if (!admin && !db.orders.filter(orderGate(me)).some(o => o.src === 'woo' && o.orderId === d.number)) return json(res, 403, { error: 'Not allowed' });
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Order-${d.number}.pdf"` }); return res.end(woo.pdfFor(d));
  }
  if (p === '/api/woo/send-pdf' && m === 'POST') {
    const b = await readJson(req), d = woo.orders()[String(b.id || '')];
    if (!d) return json(res, 404, { error: 'Order not found' });
    if (!admin && !db.orders.filter(orderGate(me)).some(o => o.src === 'woo' && o.orderId === d.number)) return json(res, 403, { error: 'Not allowed' });
    try { return json(res, 200, await woo.sendPdf(d.number, { agent: me, to: b.to })); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/woo/send-product' && m === 'POST') {
    const b = await readJson(req), phone = cleanPhone(b.phone), c = db.conversations[phone];
    if (!c || !canSeeConv(me, c)) return json(res, 404, { error: 'Chat not found' });
    try { return json(res, 200, await woo.sendProduct(phone, b.productId, me, b.variationId)); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/qbo' && m === 'GET') { if (!need()) return; return json(res, 200, qbo.publicStatus()); }
  if (p === '/api/qbo' && m === 'PUT') { if (!need()) return; try { return json(res, 200, qbo.setConfig(await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/qbo/connect' && m === 'POST') { if (!need()) return; try { const b = await readJson(req); return json(res, 200, { url: qbo.connectUrl(b.origin || `http://${req.headers.host}`) }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/qbo/sync' && m === 'POST') { if (!need()) return; try { return json(res, 200, { counts: await qbo.sync(), ...qbo.publicStatus() }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/qbo/push' && m === 'POST') { if (!need()) return; try { await qbo.pushPending(); return json(res, 200, qbo.publicStatus()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/qbo/disconnect' && m === 'POST') { if (!need()) return; return json(res, 200, qbo.disconnect()); }

  // Microsoft sign-in (app / client ID) for OneDrive and SharePoint
  if (p === '/api/ms' && m === 'GET') { if (!need()) return; return json(res, 200, ms.publicStatus()); }
  if (p === '/api/ms' && m === 'PUT') { if (!need()) return; try { return json(res, 200, ms.setConfig(await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/ms/login' && m === 'POST') { if (!need()) return; try { return json(res, 200, await ms.startLogin()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/ms/logout' && m === 'POST') { if (!need()) return; return json(res, 200, ms.signOut()); }

  if (p === '/api/orders/template') {
    const file = path.join(PUBLIC, 'order-tracking-template.xlsx');
    if (fs.existsSync(file)) { res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="order-tracking-template.xlsx"' }); return res.end(fs.readFileSync(file)); }
    const rows = [['Order ID', 'Customer Phone', 'Customer Name', 'Organization', 'Status', 'Courier', 'Tracking Link', 'Last Updated', 'Notes'],
      ['ORD-2001', '923001234567', 'Example Customer', 'Hilton Hotels', 'Shipped', 'DHL', 'https://example.com/track/2001', new Date().toISOString().slice(0, 10), 'Arrives Friday']];
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="order-tracking-template.xlsx"' });
    return res.end(writeRows(rows));
  }
  if ((mt = p.match(/^\/api\/orders\/([^/]+)$/)) && m === 'PATCH') {
    const o = db.orders.find(x => orders.normId(x.orderId) === orders.normId(decodeURIComponent(mt[1])) && orderGate(me)(x)); if (!o) return json(res, 404, { error: 'Not found' });
    const os = sync.get(o.src); if (os && os.url) return json(res, 400, { error: `"${os.name}" is read live from its Excel file. Change the status in that sheet.` });
    const b = await readJson(req); for (const k of ['status', 'courier', 'link', 'notes']) if (b[k] !== undefined) o[k] = b[k];
    o.updated = new Date().toISOString().slice(0, 10); store.save(); return json(res, 200, o);
  }

  // shared email inbox (several Gmail mailboxes)
  if (p === '/api/mailbox/accounts' && m === 'GET') { if (!need()) return; return json(res, 200, { accounts: inbox.accounts() }); }
  if (p === '/api/mailbox/accounts' && m === 'POST') { if (!need()) return; try { return json(res, 200, inbox.publicAcc(inbox.saveAccount(null, await readJson(req)))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if ((mt = p.match(/^\/api\/mailbox\/accounts\/(\w+)(?:\/(sync))?$/))) {
    if (!need()) return;
    if (mt[2] && m === 'POST') { try { return json(res, 200, await inbox.sync(mt[1])); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (m === 'PUT') { try { return json(res, 200, inbox.publicAcc(inbox.saveAccount(mt[1], await readJson(req)))); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (m === 'DELETE') { inbox.removeAccount(mt[1]); return json(res, 200, { ok: true }); }
  }
  const lst = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(x => x.trim().toLowerCase()).filter(Boolean);
  if (p === '/api/mailbox/drafts' && m === 'GET') return json(res, 200, { drafts: inbox.drafts(me) });
  if (p === '/api/mailbox/drafts' && m === 'POST') { const b = await readJson(req); return json(res, 200, inbox.saveDraft(me, { ...b, to: lst(b.to), cc: lst(b.cc), bcc: lst(b.bcc) })); }
  if ((mt = p.match(/^\/api\/mailbox\/drafts\/(\w+)$/)) && m === 'DELETE') { inbox.removeDraft(me, mt[1]); return json(res, 200, { ok: true }); }
  if (p === '/api/mailbox/scheduled' && m === 'GET') return json(res, 200, { scheduled: inbox.scheduled(me) });
  if (p === '/api/mailbox/scheduled' && m === 'POST') { const b = await readJson(req, 40e6); try { const r = inbox.schedule(me, { ...b, to: lst(b.to), cc: lst(b.cc), bcc: lst(b.bcc) }); return json(res, 200, { id: r.id }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if ((mt = p.match(/^\/api\/mailbox\/scheduled\/(\w+)$/)) && m === 'DELETE') { inbox.cancelScheduled(me, mt[1]); return json(res, 200, { ok: true }); }
  if (p === '/api/mailbox/internal' && m === 'GET') { if (!need()) return; return json(res, 200, { internal: inbox.internal() }); }
  if (p === '/api/mailbox/internal' && m === 'PUT') { if (!need()) return; const b = await readJson(req); return json(res, 200, { internal: inbox.setInternal(b.internal) }); }
  if (p === '/api/mailbox/rules' && m === 'GET') { if (!need()) return; return json(res, 200, { rules: inbox.rules() }); }
  if (p === '/api/mailbox/rules' && m === 'POST') { if (!need()) return; try { return json(res, 200, inbox.saveRule(null, await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/mailbox/rules/apply' && m === 'POST') { if (!need()) return; return json(res, 200, { moved: inbox.applyRules() }); }
  if ((mt = p.match(/^\/api\/mailbox\/rules\/(\w+)$/))) {
    if (!need()) return;
    if (m === 'PUT') { try { return json(res, 200, inbox.saveRule(mt[1], await readJson(req))); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (m === 'DELETE') { inbox.removeRule(mt[1]); return json(res, 200, { ok: true }); }
  }
  // team filters, label permissions and labels (Gmail-style)
  if (p === '/api/mailbox/perms' && m === 'GET') return json(res, 200, { perms: inbox.perms() });
  if (p === '/api/mailbox/perms' && m === 'PUT') { if (!need()) return; return json(res, 200, { perms: inbox.setPerms(await readJson(req)) }); }
  if (p === '/api/mailbox/filters' && m === 'GET') return json(res, 200, { filters: inbox.listFilters(me), perms: inbox.perms() });
  if (p === '/api/mailbox/filters/preview' && m === 'POST') { try { const b = await readJson(req); return json(res, 200, { count: inbox.countMatches(me, b.criteria, b.accountId) }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/mailbox/filters' && m === 'POST') { try { const b = await readJson(req); const f = inbox.saveFilter(me, null, b); const r = b.applyExisting ? await inbox.applyFilterNow(f) : { n: 0 }; return json(res, 200, { filter: f, applied: r.n, warn: r.warn || '' }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if ((mt = p.match(/^\/api\/mailbox\/filters\/(\w+)$/))) {
    try { if (m === 'PUT') return json(res, 200, { filter: inbox.saveFilter(me, mt[1], await readJson(req)) }); if (m === 'DELETE') { inbox.removeFilter(me, mt[1]); return json(res, 200, { ok: true }); } } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/mailbox/labels' && m === 'POST') { try { const b = await readJson(req); return json(res, 200, await inbox.createLabel(me, b.name, b.accountId)); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/mailbox/labels' && m === 'DELETE') { try { const b = await readJson(req); return json(res, 200, { ok: true, ...(await inbox.deleteLabel(me, b.name)) }); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/mailbox/sync' && m === 'POST') { if (!need()) return; try { return json(res, 200, await inbox.sync()); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (p === '/api/mailbox' && m === 'GET') return json(res, 200, { threads: inbox.list(me), accounts: inbox.accounts().map(a => ({ id: a.id, label: a.label, user: a.user })), labels: [...inbox.labelNames()].sort((x, y) => x.localeCompare(y)), perms: inbox.perms() });
  if (p === '/api/mailbox/new' && m === 'POST') {
    const b = await readJson(req, 40e6); const list = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(x => x.trim().toLowerCase()).filter(Boolean);
    try { return json(res, 200, await inbox.send(null, me, { accountId: b.accountId, to: list(b.to), cc: list(b.cc), bcc: list(b.bcc), subject: String(b.subject || '(no subject)'), text: b.text, html: b.html, attachments: b.attachments })); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if ((mt = p.match(/^\/api\/mailbox\/file\/(\w+)\/(\d+)$/))) {
    const f = inbox.file(mt[1], mt[2], me); if (!f || !fs.existsSync(f.path)) return json(res, 404, { error: 'File not found' });
    const ext = (String(f.name).match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase() || '';
    if (url.searchParams.get('as') === 'table') { // spreadsheet preview
      if (ext !== 'xlsx' && ext !== 'xlsm') return json(res, 400, { error: 'No table preview for this file' });
      try { const buf = fs.readFileSync(f.path), xl = require('./lib/xlsx'); return json(res, 200, { sheets: xl.sheetNames(buf), rows: xl.readRows(buf, url.searchParams.get('sheet') || undefined).slice(0, 500).map(r => r.slice(0, 40)) }); }
      catch (e) { return json(res, 400, { error: 'Could not read this spreadsheet' }); }
    }
    const SAFE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8', csv: 'text/plain; charset=utf-8', json: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' };
    if (url.searchParams.get('inline') === '1' && SAFE[ext]) { // shown in the preview window — never as a page that could run scripts
      res.writeHead(200, { 'Content-Type': SAFE[ext], 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=300', ...(ext === 'pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'self'" }) });
      return fs.createReadStream(f.path).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'X-Content-Type-Options': 'nosniff' }); return fs.createReadStream(f.path).pipe(res);
  }
  if ((mt = p.match(/^\/api\/mailbox\/(\w+)(?:\/(reply|read|unread|star|resolve|reopen|assign|label|important|trash|restore|spam|purge))?$/))) {
    const t = inbox.get(mt[1], me); if (!t) return json(res, 404, { error: 'Email not found (or it belongs to someone else)' });
    if (!mt[2] && m === 'GET') return json(res, 200, { thread: { ...t }, mails: inbox.messages(t) });
    if (m === 'POST') {
      const b = await readJson(req, 40e6);
      try {
        if (mt[2] === 'reply') return json(res, 200, await inbox.send(t, me, { text: b.text, html: b.html, replyAll: !!b.replyAll, forward: !!b.forward, to: b.to ? String(b.to).split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean) : undefined, cc: b.cc ? String(b.cc).split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean) : undefined, bcc: b.bcc ? String(b.bcc).split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean) : undefined, attachments: b.attachments }));
        if (mt[2] === 'assign' && !admin && t.agentId !== me.id) return json(res, 403, { error: 'Only the owner can hand this over' });
        return json(res, 200, { ok: true, ...(await inbox.act(t, me, mt[2], b)) });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
  }

  // email account + scheduled reports (admin)
  if (p === '/api/mail' && m === 'GET') { if (!need()) return; const c = reports.mailCfg(), e = reports.effectiveCfg(); return json(res, 200, { ...c, pass: '', hasPass: !!c.pass, ready: !!e, via: e && e.source === 'mailbox' ? { user: e.from, label: e.label } : null, mailboxes: reports.mailboxes().map(a => ({ id: a.id, user: a.user, label: a.label || a.user })) }); }
  if (p === '/api/mail' && m === 'PUT') {
    if (!need()) return; const b = await readJson(req); const c = reports.mailCfg();
    c.host = String(b.host || '').trim(); c.port = +b.port || 587; c.security = ['ssl', 'starttls', 'none'].includes(b.security) ? b.security : 'starttls';
    c.accountId = String(b.accountId || ''); c.user = String(b.user || '').trim(); if (b.pass) c.pass = String(b.pass); c.from = String(b.from || '').trim(); c.fromName = String(b.fromName || '').trim();
    store.save(); return json(res, 200, { ok: true });
  }
  if (p === '/api/mail/test' && m === 'POST') {
    if (!need()) return; const b = await readJson(req);
    try { await reports.sendMail({ to: [String(b.to || '').trim()], subject: 'Test email from WhatsApp Desk', text: 'Your email settings work. Scheduled reports will be sent from this address.', html: '<p>Your email settings work. Scheduled reports will be sent from this address.</p>' }); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/reports' && m === 'GET') { if (!need()) return; return json(res, 200, { reports: reports.list().map(r => ({ ...r, matching: reports.select(r).length })), columns: reports.COLUMNS, extraColumns: reports.extraColumns(), layout: reports.layout(), defaultColumns: reports.layout().main.filter(c => !c.fallback).map(c => c.key), dateColumns: reports.extraColumns().filter(c => /date/i.test(c.label)), statuses: [...new Set(db.orders.map(o => o.status || 'Pending'))], organizations: [...new Set(db.orders.map(o => o.organization).filter(Boolean))] }); }
  if (p === '/api/reports/assist' && m === 'POST') { if (!need()) return; const b = await readJson(req); try { return json(res, 200, await ai.reportAssist(b.prompt, { today: new Date().toISOString().slice(0, 10), organizations: [...new Set(db.orders.map(o => o.organization).filter(Boolean))], statuses: [...new Set(db.orders.map(o => o.status || 'Pending'))], columns: [...reports.COLUMNS, ...reports.extraColumns()] })); } catch (e) { return json(res, 502, { error: e.message }); } }
  if (p === '/api/reports' && m === 'POST') { if (!need()) return; try { const r = reports.clean(await readJson(req)); reports.list().push(r); store.save(); return json(res, 200, r); } catch (e) { return json(res, 400, { error: e.message }); } }
  if ((mt = p.match(/^\/api\/reports\/([\w-]+)(?:\/(run|download))?$/))) {
    if (!need()) return; const r = reports.list().find(x => x.id === mt[1]); if (!r) return json(res, 404, { error: 'Report not found' });
    if (!mt[2] && m === 'PUT') { try { const n = reports.clean(await readJson(req), r); Object.assign(r, n); store.save(); return json(res, 200, r); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (!mt[2] && m === 'PATCH') { const b = await readJson(req); if (b.enabled !== undefined) r.enabled = !!b.enabled; store.save(); return json(res, 200, r); }
    if (!mt[2] && m === 'DELETE') { db.reports = reports.list().filter(x => x !== r); store.save(); return json(res, 200, { ok: true }); }
    if (mt[2] === 'run' && m === 'POST') { try { return json(res, 200, await reports.run(r, { manual: true })); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (mt[2] === 'download') { const f = reports.build(r).files.find(x => x.filename.endsWith('.' + (url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'))); if (!f) return json(res, 404, { error: 'That format is switched off for this report' }); res.writeHead(200, { 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="${f.filename}"` }); return res.end(f.content); }
  }

  // settings
  if (p === '/api/settings' && m === 'PUT') {
    if (!need()) return; const b = await readJson(req);
    for (const k of Object.keys(store.DEFAULT_SETTINGS)) if (b[k] !== undefined && k !== 'menu') db.settings[k] = String(b[k]);
    if (b.menu) for (const k of Object.keys(db.settings.menu)) if (b.menu[k]) db.settings.menu[k] = String(b.menu[k]).slice(0, 24);
    store.save(); return json(res, 200, db.settings);
  }
  return json(res, 404, { error: 'Not found' });
}

// ---------- WhatsApp webhook ----------
async function webhook(req, res, url) {
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === cfg.verifyToken) { res.writeHead(200); return res.end(url.searchParams.get('hub.challenge')); }
    res.writeHead(403); return res.end('Forbidden');
  }
  const raw = await readBody(req, 5e6);
  if (cfg.appSecret) {
    const sig = (req.headers['x-hub-signature-256'] || '').replace('sha256=', '');
    const exp = crypto.createHmac('sha256', cfg.appSecret).update(raw).digest('hex');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) { res.writeHead(401); return res.end(); }
  }
  res.writeHead(200); res.end('OK'); // acknowledge fast, process after
  const callsOnly = !wa.apiOn(); if (callsOnly && !wa.callsOn()) return;  // API switch off: the linked phone is in use, ignore Meta's messages (unless only calls run on the API)
  let body; try { body = JSON.parse(raw); } catch { return; }
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {}; const names = {};
    if (ch.field === 'calls' || v.calls) { try { calls.onWebhook(v); } catch (e) { console.error('call webhook:', e); } }
    for (const c of v.contacts || []) names[c.wa_id] = (c.profile || {}).name;
    for (const msg of v.messages || []) {
      if (callsOnly && !(msg.type === 'interactive' && msg.interactive && msg.interactive.call_permission_reply)) continue; // chat stays on the linked phone
      let text = '', replyId, file;
      if (msg.type === 'text') text = msg.text.body;
      else if (msg.type === 'interactive' && msg.interactive.call_permission_reply) { const cr = msg.interactive.call_permission_reply; const cv = bot.getConv(msg.from, names[msg.from]); bot.noteSys(cv, cr.response === 'accept' ? '📞 Customer allowed calls — you can call now' : '📞 Customer declined calls', true); continue; }
      else if (msg.type === 'interactive') { const r = msg.interactive.list_reply || msg.interactive.button_reply || {}; text = r.title || ''; replyId = r.id; }
      else if (msg.type === 'button') text = msg.button.text;
      else if (['audio', 'image', 'video', 'document', 'sticker'].includes(msg.type)) {
        const x = msg[msg.type] || {}; text = x.caption || '';
        try { const d = await wa.downloadCloud(x.id); file = { buf: d.buf, mime: x.mime_type || d.mime, name: x.filename, voice: msg.type === 'audio' && !!x.voice }; }
        catch (e) { text = (text ? text + '\n' : '') + `[${msg.type} received but could not be downloaded]`; }
      }
      else text = `[${msg.type} received]`;
      try { await bot.onIncoming({ phone: msg.from, name: names[msg.from], text, replyId, waId: msg.id, media: file }); }
      catch (e) { console.error('Failed to process message:', e); }
    }
  }
}

// ---------- pages customers open without signing in: /go/<link> (details form) and /call/<token> (voice call) ----------
const hits = new Map(); // simple per-address limit so the public forms cannot be flooded
const tooMany = (req, key, max, ms) => { const k = key + (req.socket.remoteAddress || ''), n = Date.now(), a = (hits.get(k) || []).filter(t => n - t < ms); a.push(n); hits.set(k, a); if (hits.size > 5000) hits.clear(); return a.length > max; };
const html = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(body); };
async function publicPages(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean), m = req.method;
  if (parts[0] === 'go' && parts.length === 2) {
    const L = links.bySlug(decodeURIComponent(parts[1]));
    if (m === 'GET') { if (!L || !L.enabled) return html(res, 404, links.notFound()); links.opened(L); return html(res, 200, links.page(links.publicInfo(L))); }
    if (m === 'POST') {
      if (!L) return json(res, 404, { error: 'This link is not available.' });
      if (tooMany(req, 'go', 20, 10 * 60000)) return json(res, 429, { error: 'Too many tries. Please wait a few minutes.' });
      try { return json(res, 200, links.submit(L, await readJson(req, 20e3))); } catch (e) { return json(res, 400, { error: e.message }); }
    }
  }
  if (parts[0] === 'call' && parts[1] && /^[a-f0-9]{24}$/.test(parts[1])) {
    const tok = parts[1], act = parts[2] || '';
    if (!act && m === 'GET') { const info = webcall.guestInfo(tok); return info ? html(res, 200, webcall.page(info)) : html(res, 404, webcall.notFound()); }
    if (act === 'poll' && m === 'GET') return json(res, 200, webcall.poll(tok, url.searchParams.get('room') || ''));
    if (act === 'ring' && m === 'POST') {
      if (tooMany(req, 'ring', 12, 10 * 60000)) return json(res, 429, { error: 'Too many calls. Please wait a few minutes.' });
      try { return json(res, 200, webcall.ring(tok, String((await readJson(req, 120e3)).sdp || ''))); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (act === 'decline' && m === 'POST') { const info = webcall.guestInfo(tok); if (info) webcall.decline(tok); return json(res, 200, { ok: true }); }
    if (act === 'end' && m === 'POST') { const b = await readJson(req, 5e3), r = webcall.roomOf(String(b.room || '')); if (r && webcall.poll(tok, r.id).state !== 'ended') webcall.end(r.id, 'guest'); return json(res, 200, { ok: true }); }
  }
  return html(res, 404, links.notFound());
}

// ---------- server ----------
http.createServer(async (req, res) => {
  try { const h = String(req.headers.host || ''); if (h) require('./lib/shortlinks').seen(`${String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0]}://${h}`); } catch {}
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/webhook') return await webhook(req, res, url);
    if (url.pathname === '/webhooks/woo' && req.method === 'POST') { // WooCommerce → desk: a new / changed order, signed with the webhook secret
      const raw = await readBody(req, 5e6);
      try { return json(res, 200, await woo.webhook(raw, req.headers)); } catch (e) { return json(res, e.code === 401 ? 401 : 400, { error: e.message }); }
    }
    if (url.pathname === '/qbo/callback') { // Intuit sends the browser back here after the admin approves the connection
      let msg = 'QuickBooks connected. Taking you back…', ok = true;
      try { await qbo.handleCallback(url.searchParams); } catch (e) { msg = e.message; ok = false; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta charset=utf-8><title>QuickBooks</title><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>${ok ? '✅' : '⚠️'} ${ok ? 'Connected' : 'Could not connect'}</h2><p>${msg.replace(/[<>&]/g, '')}</p><p><a href="/#retail">Back to WhatsApp Desk</a></p>${ok ? '<script>setTimeout(()=>location.href="/#retail",1200)</script>' : ''}</body>`);
    }
    if (url.pathname.startsWith('/c/')) { // short link: send the visitor on to the long address
      const to = require('./lib/shortlinks').resolve(url.pathname.slice(3).replace(/\/+$/, ''));
      if (!to) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;max-width:520px;margin:auto"><h2>Link not found</h2><p>This link is not valid any more. Please ask us for a new one.</p>'); }
      res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); return res.end();
    }
    if (url.pathname.startsWith('/go/') || url.pathname.startsWith('/call/')) return await publicPages(req, res, url);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let f =path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: e.message }); else res.end(); }
}).listen(cfg.port, () => {
  link.setHandlers({
    onMessage: async x => { try { if (wa.mode() !== 'link') { link.note('IGNORED: the official WhatsApp API switch is ON, so the linked phone is paused. Settings → WhatsApp connection → choose “Without API”.'); return; } /* API switch is on: the linked phone is paused */ if (x.isGroup) bot.onGroupMessage(x); else if (x.fromMe) await bot.onPhoneSent(x); else { const L = link.settings(); await bot.onIncoming({ ...x, noBot: !L.autoBot, autoAssign: L.assignNew !== false }); link.note(`Delivered to the desk: chat +${x.phone}${L.autoBot ? ' (welcome menu sent)' : ' (welcome menu is OFF in settings)'}`); } } catch (e) { console.error('linked phone message failed:', e); link.note('ERROR while handling a message: ' + e.message); } },
    onCall: x => wa.mode() === 'link' ? bot.onCall(x).catch(() => ({})) : ({}),
  });
  link.start();
  sync.start(); retail.start(); qbo.start(); woo.start(); reports.start(); inbox.start();
  console.log(`\n  WhatsApp Desk running at http://localhost:${cfg.port}`);
  console.log(`  Mode: ${{ cloud: 'LIVE (WhatsApp Cloud API connected)', link: 'LINKED PHONE (WhatsApp Web style, see Settings)', demo: 'DEMO (no WhatsApp yet: use Settings → WhatsApp connection, or the Test Phone)' }[wa.mode()]}`);
  console.log(`  Webhook URL path: /webhook   Verify token: ${cfg.verifyToken}\n`);
});
