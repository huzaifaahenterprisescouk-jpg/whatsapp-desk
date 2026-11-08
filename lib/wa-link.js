// "Link a phone" mode: the desk signs in to WhatsApp the way WhatsApp Web does (scan a QR code, or type a pairing code),
// so the SAME number that is on your phone can be used here: no Meta developer account, no access tokens.
// Uses the open-source Baileys library (an optional package: `npm install`; the Docker image installs it for you).
//
// Not possible in this mode: starting or answering WhatsApp calls (the library cannot do voice calls). Incoming calls are
// shown in the chat; to ring a customer use the Call / WhatsApp buttons (they open your phone or WhatsApp Desktop).
const fs = require('fs'), path = require('path'), { EventEmitter } = require('events');
const cfg = require('./config'), store = require('./store'), media = require('./media');

const bus = new EventEmitter();
const AUTH = () => path.join(path.dirname(cfg.dataFile), 'wa-auth');
const DEFAULTS = {
  useApi: true,            // true = official Cloud API (if its keys are in .env), false = this linked phone. Switch in Settings.
  callsApi: false,         // linked-phone mode only: make WhatsApp CALLS through the Cloud API (separate API number) while chat stays on the linked phone
  enabled: true,           // reconnect automatically after a restart
  assignNew: true,        // linked-phone mode: every new chat goes straight to the person handling (their "Mine" list), the welcome menu is still sent
  handlerId: '',           // the person handling new chats ('' = automatic: least busy)
  ownOnly: true,           // linked-phone mode: team members only see the chats assigned to them (the administrator sees all)
  keepOwner: true,         // a returning customer stays with their own person (or their organization's person) instead of the handler
  groups: true,            // linked-phone mode: WhatsApp GROUPS the number is in appear in the desk (the administrator assigns each group to a team member)
  autoBot: true,           // the menu / order-tracking bot answers customers (turn off to use the desk as a plain shared inbox)
  rejectCalls: false,      // decline incoming WhatsApp calls (this also stops them ringing on the phone) and send callReply
  callReply: 'Sorry, we cannot take WhatsApp calls on this number. Please send us a message here (you can also send a voice note) and our team will reply shortly.',
};
const settings = () => { const l = (store.db.link = store.db.link || {}); for (const k of Object.keys(DEFAULTS)) if (l[k] === undefined) l[k] = DEFAULTS[k]; return l; };

let B = null, sock = null, starting = false, retryT = null, pairPhone = '', codeAsked = false, handlers = {};
let st = { state: 'idle', qr: '', code: '', me: '', error: '' };   // idle | starting | qr | code | connecting | connected | loggedout | error
const sent = new Set(), keys = new Map();
// what happened to the latest messages (shown in Settings → WhatsApp connection → Recent activity), to find out why a message did not appear
const evlog = [];
function note(text) { evlog.unshift({ t: Date.now(), text }); if (evlog.length > 25) evlog.pop(); bus.emit('status', status()); }
const remember = (set, v) => { set.add(v); if (set.size > 500) set.delete(set.values().next().value); };

const hasAuth = () => { try { return !!JSON.parse(fs.readFileSync(path.join(AUTH(), 'creds.json'), 'utf8')).me; } catch { return false; } };
const wipeAuth = () => { try { fs.rmSync(AUTH(), { recursive: true, force: true }); } catch {} };
const connected = () => st.state === 'connected';
const configured = () => hasAuth() || !!sock;       // this server has been linked to a phone at some point
function set(p) { st = { ...st, ...p }; bus.emit('status', status()); }
function status() { return { ...st, log: evlog, linked: hasAuth(), settings: settings(), ffmpeg: media.hasFfmpeg() }; }
function setHandlers(h) { handlers = h || {}; }

function mkLogger() {
  try { return require('pino')({ level: 'silent' }); } catch { /* fall through */ }
  const l = { level: 'silent', child: () => l }; for (const k of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) l[k] = () => {}; return l;
}
const logger = mkLogger();

async function lib() {
  if (B) return B;
  let mod; try { mod = await import('@whiskeysockets/baileys'); }
  catch (e) { throw new Error('The WhatsApp link packages are not installed on this server. Run "npm install" in the app folder (the Docker image does it for you), then restart.'); }
  const ns = { ...(mod.default && typeof mod.default === 'object' ? mod.default : {}), ...mod };
  const make = typeof mod.default === 'function' ? mod.default : (ns.makeWASocket || (typeof ns.default === 'function' ? ns.default : null));
  if (!make) throw new Error('Unsupported WhatsApp library version');
  B = { ...ns, make }; return B;
}

const digits = s => String(s || '').split('@')[0].split(':')[0].replace(/\D/g, '');
function phoneOf(key, msg) {
  let jid = key.remoteJid || '';
  if (/@lid$/.test(jid)) { const alt = key.remoteJidAlt || key.senderPn || (msg && msg.senderPn); if (alt) jid = alt; }
  return digits(jid);
}

// ---------- groups ----------
// A group chat is stored like any chat, keyed by the digits of the group id; its WhatsApp address (…@g.us) is kept in conv.jid.
const isGroupJid = jid => /@g\.us$/.test(jid || '');
const groupCache = new Map();      // jid -> { id, subject, size, at }
const SUBJECT_TTL = 10 * 60000;
async function groupSubject(s, jid) {
  const hit = groupCache.get(jid); if (hit && Date.now() - hit.at < SUBJECT_TTL) return hit.subject;
  try { const md = await s.groupMetadata(jid); groupCache.set(jid, { id: jid, subject: md.subject || '', size: (md.participants || []).length, at: Date.now() }); return md.subject || ''; }
  catch { return hit ? hit.subject : ''; }
}
// every group this number is in (for the administrator's Groups page)
async function listGroups() {
  if (sock && connected()) {
    try { const all = await sock.groupFetchAllParticipating(); for (const g of Object.values(all || {})) groupCache.set(g.id, { id: g.id, subject: g.subject || '', size: (g.participants || []).length, at: Date.now() }); } catch (e) { /* use what we know */ }
  }
  return [...groupCache.values()].map(g => ({ jid: g.id, phone: digits(g.id), subject: g.subject, size: g.size }));
}
function senderOf(key, msg) {
  const p = key.participant || msg.participant || '', alt = key.participantPn || key.participantAlt || msg.participantPn || '';
  return { phone: digits(/@lid$/.test(p) ? alt : (p || alt)), name: msg.pushName || '' };
}

// ---------- connect ----------
async function connect() {
  if (starting || sock) return; starting = true; clearTimeout(retryT);
  try {
    const b = await lib();
    const { state, saveCreds } = await b.useMultiFileAuthState(AUTH());
    let version; try { version = (await b.fetchLatestBaileysVersion()).version; } catch { /* use the library's built-in version */ }
    const browser = b.Browsers && b.Browsers.macOS ? b.Browsers.macOS('Chrome') : ['Mac OS', 'Chrome', '10.15.7'];
    const s = b.make({ auth: state, ...(version ? { version } : {}), logger, browser, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false, getMessage: async () => undefined });
    sock = s; codeAsked = false;
    if (st.state !== 'qr' && st.state !== 'code') set({ state: 'starting', error: '' });
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', u => onConn(s, u).catch(e => console.error('[wa-link] connection:', e.message)));
    s.ev.on('messages.upsert', u => onUpsert(s, u).catch(e => console.error('[wa-link] message:', e.message)));
    s.ev.on('call', c => onCalls(s, c).catch(e => console.error('[wa-link] call:', e.message)));
  } catch (e) { sock = null; set({ state: 'error', error: e.message, qr: '', code: '' }); }
  finally { starting = false; }
}

async function onConn(s, u) {
  if (s !== sock) return;
  const { connection, lastDisconnect, qr } = u;
  if (qr) {
    if (s.authState.creds.registered) return;
    if (pairPhone) {
      if (!codeAsked) {
        codeAsked = true;
        try { const raw = await s.requestPairingCode(pairPhone); set({ state: 'code', code: String(raw).replace(/(.{4})(.{4})/, '$1-$2'), qr: '', error: '' }); }
        catch (e) { codeAsked = false; set({ state: 'error', error: 'Could not get a pairing code: ' + e.message }); }
      }
    } else {
      let img = ''; try { img = await require('qrcode').toDataURL(qr, { margin: 1, width: 300 }); } catch { set({ state: 'error', error: 'The "qrcode" package is missing. Run "npm install" and restart.' }); return; }
      set({ state: 'qr', qr: img, code: '', error: '' });
    }
  }
  if (connection === 'connecting' && st.state === 'idle') set({ state: 'starting' });
  if (connection === 'open') {
    const me = digits(s.user && s.user.id); pairPhone = ''; codeAsked = false;
    set({ state: 'connected', me, qr: '', code: '', error: '' }); settings(); store.save();
    if (settings().groups !== false) listGroups().catch(() => {});
  }
  if (connection === 'close') {
    const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
    const DR = (B && B.DisconnectReason) || {}; const registered = s.authState.creds.registered;
    sock = null;
    if (code === (DR.loggedOut || 401)) { wipeAuth(); pairPhone = ''; return set({ state: 'loggedout', me: '', qr: '', code: '', error: 'This device was removed from WhatsApp (Linked devices). Link it again to continue.' }); }
    if (code === (DR.connectionReplaced || 440)) return set({ state: 'error', error: 'This number is now connected somewhere else (another copy of the desk). Close the other one, then press Reconnect.' });
    if (!registered && (code === (DR.timedOut || 408) || st.state === 'qr' || st.state === 'code')) return set({ state: 'idle', qr: '', code: '', error: 'The code expired. Press “Link” to get a new one.' });
    set({ state: 'connecting' });
    retryT = setTimeout(() => { if (settings().enabled !== false) connect(); }, code === (DR.restartRequired || 515) ? 400 : 4000);
  }
}

// ---------- incoming ----------
function describe(b, msg) {
  const c = (b.normalizeMessageContent ? b.normalizeMessageContent(msg.message) : msg.message) || {};
  const o = { text: '', replyId: undefined, media: null };
  if (c.conversation) o.text = c.conversation;
  else if (c.extendedTextMessage) o.text = c.extendedTextMessage.text || '';
  else if (c.imageMessage) { o.text = c.imageMessage.caption || ''; o.media = { mime: c.imageMessage.mimetype || 'image/jpeg' }; }
  else if (c.videoMessage) { o.text = c.videoMessage.caption || ''; o.media = { mime: c.videoMessage.mimetype || 'video/mp4' }; }
  else if (c.audioMessage) o.media = { mime: c.audioMessage.mimetype || 'audio/ogg; codecs=opus', voice: !!c.audioMessage.ptt, secs: c.audioMessage.seconds };
  else if (c.documentMessage) { o.text = c.documentMessage.caption || ''; o.media = { mime: c.documentMessage.mimetype || 'application/octet-stream', name: c.documentMessage.fileName }; }
  else if (c.stickerMessage) o.text = '[sticker]';
  else if (c.locationMessage) o.text = `📍 Location: https://maps.google.com/?q=${c.locationMessage.degreesLatitude},${c.locationMessage.degreesLongitude}`;
  else if (c.contactMessage) o.text = `👤 Contact: ${c.contactMessage.displayName || ''}`;
  else if (c.listResponseMessage) { o.text = c.listResponseMessage.title || ''; o.replyId = c.listResponseMessage.singleSelectReply && c.listResponseMessage.singleSelectReply.selectedRowId; }
  else if (c.buttonsResponseMessage) { o.text = c.buttonsResponseMessage.selectedDisplayText || ''; o.replyId = c.buttonsResponseMessage.selectedButtonId; }
  else if (c.reactionMessage || c.protocolMessage || c.senderKeyDistributionMessage || c.pollUpdateMessage) return null;
  else o.text = '[this message type is not supported here — open it on the phone]';
  return o;
}

async function onUpsert(s, { messages, type }) {
  if (s !== sock || !handlers.onMessage) return;
  for (const msg of messages || []) {
    const key = msg.key || {}, jid = key.remoteJid || '';
    if (jid && jid !== 'status@broadcast') note(`Received ${type} from ${jid.replace(/@.*/, '').slice(0, 6)}…@${(jid.split('@')[1] || '?')}${key.fromMe ? ' (sent by this phone)' : ''}`);
    if (!msg.message && jid) note('Skipped: the message had no readable content (it may still be arriving or is encrypted)');
    if (!msg.message || !jid || /(@broadcast|@newsletter)$/.test(jid) || jid === 'status@broadcast') continue;
    const group = isGroupJid(jid); if (group && settings().groups === false) continue;
    if (key.fromMe && (type !== 'notify' || sent.has(key.id))) continue;       // our own sends are recorded when we send them
    if (!key.fromMe && type !== 'notify') { note('Skipped: old message (history sync), not a new one'); continue; }
    const ts = (+msg.messageTimestamp || 0) * 1000; if (ts && Date.now() - ts > 3 * 864e5) { note('Skipped: message is more than 3 days old'); continue; } // ignore very old backlog
    const d = describe(B, msg); if (!d) { note('Skipped: not a chat message (reaction / system)'); continue; }
    const phone = group ? digits(jid) : phoneOf(key, msg); if (phone.length < 6) { note('Skipped: could not read the sender number'); continue; }
    let med = null;
    if (d.media) {
      try {
        const buf = await B.downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: s.updateMediaMessage });
        med = { buf, ...d.media };
      } catch (e) { d.text = (d.text ? d.text + '\n' : '') + '[a file was sent but could not be downloaded]'; }
    }
    if (group) {   // groups are never marked as read automatically (that would show blue ticks to everyone in the group)
      const subject = await groupSubject(s, jid), who = senderOf(key, msg);
      await handlers.onMessage({ phone, jid, isGroup: true, group: subject, name: who.name, senderPhone: who.phone, text: d.text, waId: key.id, media: med, fromMe: !!key.fromMe });
      continue;
    }
    if (!key.fromMe && key.id) { keys.set(key.id, key); if (keys.size > 300) keys.delete(keys.keys().next().value); }
    await handlers.onMessage({ phone, jid, name: msg.pushName || '', text: d.text, replyId: d.replyId, waId: key.id, media: med, fromMe: !!key.fromMe });
  }
}
async function onCalls(s, calls) {
  if (s !== sock || !handlers.onCall) return;
  for (const c of calls || []) {
    if (c.status !== 'offer' || c.isGroup) continue;
    const from = c.callerPn || c.from || '', phone = digits(from);
    const r = await handlers.onCall({ phone, jid: c.from, video: !!c.isVideo, id: c.id });
    if (r && r.reject) { try { await s.rejectCall(c.id, c.from); } catch { /* already ended */ } }
  }
}

// ---------- outgoing ----------
const jidFor = phone => { const c = store.db.conversations[phone]; return (c && c.jid) || phone + '@s.whatsapp.net'; };
function need() { if (!sock || !connected()) throw new Error('WhatsApp is not connected. Open Settings → WhatsApp connection and press Reconnect.'); return sock; }
async function sendText(to, text) { const r = await need().sendMessage(jidFor(to), { text }); if (r && r.key) remember(sent, r.key.id); return r; }
async function sendMedia(to, { buf, mime, filename, caption, voice }) {
  const kind = media.kindOf(mime); let content;
  if (voice) content = { audio: buf, mimetype: mime, ptt: true };
  else if (kind === 'audio') content = { audio: buf, mimetype: media.baseMime(mime) };
  else if (kind === 'image') content = { image: buf, mimetype: media.baseMime(mime), ...(caption ? { caption } : {}) };
  else if (kind === 'video') content = { video: buf, mimetype: media.baseMime(mime), ...(caption ? { caption } : {}) };
  else content = { document: buf, mimetype: media.baseMime(mime), fileName: filename || 'file', ...(caption ? { caption } : {}) };
  const r = await need().sendMessage(jidFor(to), content); if (r && r.key) remember(sent, r.key.id); return r;
}
async function markRead(id) { const k = keys.get(id); if (k && sock && connected()) { try { await sock.readMessages([k]); } catch {} } }

// ---------- control (used by the Settings screen) ----------
// method 'qr': show a QR code to scan (WhatsApp → Linked devices → Link a device).  method 'code': 8-letter code typed on the phone.
async function link({ method = 'qr', phone } = {}) {
  if (connected()) throw new Error('Already linked. Unlink first to link a different number.');
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }
  clearTimeout(retryT);
  wipeAuth(); pairPhone = '';
  if (method === 'code') { pairPhone = digits(phone); if (pairPhone.length < 8) throw new Error('Type the phone number with country code, e.g. 923001234567'); }
  settings().enabled = true; store.save();
  set({ state: 'starting', qr: '', code: '', error: '', me: '' });
  await connect(); return status();
}
async function reconnect() { if (sock) { try { sock.end(undefined); } catch {} sock = null; } settings().enabled = true; store.save(); set({ state: 'starting', error: '' }); await connect(); return status(); }
async function unlink() {
  settings().enabled = false; store.save(); clearTimeout(retryT);
  const s = sock; sock = null; if (s) { try { await s.logout(); } catch { try { s.end(undefined); } catch {} } }
  wipeAuth(); pairPhone = ''; set({ state: 'idle', me: '', qr: '', code: '', error: '' }); return status();
}
function updateSettings(b) {
  const l = settings();
  if (b.useApi !== undefined) l.useApi = !!b.useApi;
  if (b.callsApi !== undefined) l.callsApi = !!b.callsApi;
  if (b.groups !== undefined) l.groups = !!b.groups;
  if (b.autoBot !== undefined) l.autoBot = !!b.autoBot;
  if (b.assignNew !== undefined) l.assignNew = !!b.assignNew;
  if (b.keepOwner !== undefined) l.keepOwner = !!b.keepOwner;
  if (b.ownOnly !== undefined) l.ownOnly = !!b.ownOnly;
  if (b.handlerId !== undefined) l.handlerId = (store.db.agents || []).some(a => a.id === b.handlerId) ? b.handlerId : '';
  if (b.rejectCalls !== undefined) l.rejectCalls = !!b.rejectCalls;
  if (b.callReply !== undefined) l.callReply = String(b.callReply).slice(0, 500);
  store.save(); bus.emit('status', status()); return l;
}
function start() { if (hasAuth() && settings().enabled !== false) connect(); }

module.exports = { note, listGroups, isGroupJid, bus, status, setHandlers, start, link, reconnect, unlink, updateSettings, settings, connected, configured, sendText, sendMedia, markRead, digits };
