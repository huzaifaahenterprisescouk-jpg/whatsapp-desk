// "Posting number": a SECOND linked WhatsApp number that is used only to publish WhatsApp Status and Channel posts (Social posting).
// It is linked exactly like the main number (QR code / pairing code) but it is deliberately deaf and mute everywhere else:
//   * it never receives chats: no messages.upsert listener, so nothing reaches the inbox, the welcome menu or the order bot
//   * it never sends chat messages, calls, voice notes or bulk messages: only Status and Channel posts are exposed
//   * every setting (assignment, bot, groups, calls…) stays with the MAIN number in wa-link.js
// If it is linked and connected, Social posting uses it for Status + Channels; otherwise the main number is used as before.
const fs = require('fs'), path = require('path'), { EventEmitter } = require('events');
const cfg = require('./config'), store = require('./store'), main = require('./wa-link');

const bus = new EventEmitter();
const AUTH = () => path.join(path.dirname(cfg.dataFile), 'wa-auth-post');
const DEFAULTS = { enabled: true, useForStatus: true, useForChannels: true };
const settings = () => { const l = (store.db.linkPost = store.db.linkPost || {}); for (const k of Object.keys(DEFAULTS)) if (l[k] === undefined) l[k] = DEFAULTS[k]; return l; };
const contacts = () => (store.db.linkPostContacts = store.db.linkPostContacts || {});   // the posting number's OWN contacts = who sees its Status

let sock = null, starting = false, retryT = null, pairPhone = '', codeAsked = false;
let st = { state: 'idle', qr: '', code: '', me: '', error: '' };   // idle | starting | qr | code | connecting | connected | loggedout | error
const evlog = [];
function note(text) { evlog.unshift({ t: Date.now(), text }); if (evlog.length > 15) evlog.pop(); bus.emit('status', status()); }
const hasAuth = () => { try { return !!JSON.parse(fs.readFileSync(path.join(AUTH(), 'creds.json'), 'utf8')).me; } catch { return false; } };
const wipeAuth = () => { try { fs.rmSync(AUTH(), { recursive: true, force: true }); } catch {} };
const connected = () => st.state === 'connected' && !!sock;
function set(p) { st = { ...st, ...p }; bus.emit('status', status()); }
function status() { return { ...st, log: evlog, linked: hasAuth(), settings: settings(), contacts: Object.keys(contacts()).length }; }
const digits = main.digits;

async function connect() {
  if (starting || sock) return; starting = true; clearTimeout(retryT);
  try {
    const b = await main.lib();
    const { state, saveCreds } = await b.useMultiFileAuthState(AUTH());
    let version; try { version = (await b.fetchLatestBaileysVersion()).version; } catch { /* built-in version */ }
    const browser = b.Browsers && b.Browsers.macOS ? b.Browsers.macOS('Chrome') : ['Mac OS', 'Chrome', '10.15.7'];
    const s = b.make({ auth: state, ...(version ? { version } : {}), logger: main.mkLogger(), browser, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false, getMessage: async () => undefined });
    sock = s; codeAsked = false;
    if (st.state !== 'qr' && st.state !== 'code') set({ state: 'starting', error: '' });
    s.ev.on('creds.update', saveCreds);
    s.ev.on('connection.update', u => onConn(s, u).catch(e => console.error('[wa-post] connection:', e.message)));
    // NO messages.upsert and NO call listener on purpose: this number never feeds the inbox.
    const keep = list => { try { const m = contacts(); let n = 0; for (const c of list || []) { const id = String((c && (c.phoneNumber || c.id)) || ''); if (/@(s\.whatsapp\.net|lid)$/.test(id) && !m[id]) { m[id] = 1; n++; } } if (n) { const k = Object.keys(m); if (k.length > 5000) for (const x of k.slice(0, k.length - 5000)) delete m[x]; store.save(); } } catch {} };
    s.ev.on('contacts.upsert', keep); s.ev.on('contacts.update', keep); s.ev.on('messaging-history.set', h => keep(h && h.contacts));
  } catch (e) { sock = null; set({ state: 'error', error: e.message, qr: '', code: '' }); }
  finally { starting = false; }
}

async function onConn(s, u) {
  if (s !== sock) return;
  const { connection, lastDisconnect, qr } = u;
  if (connection) note(`Posting number connection: ${connection}${connection === 'close' ? ' (code ' + (((lastDisconnect || {}).error || {}).output || {}).statusCode + ')' : ''}`);
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
    if (me && me === digits(main.status().me)) {   // the same number as the main one would make both fight over one login
      sock = null; try { await s.logout(); } catch { try { s.end(undefined); } catch {} } wipeAuth();
      return set({ state: 'error', me: '', qr: '', code: '', error: 'This is the same number as your main WhatsApp. Link a DIFFERENT number here.' });
    }
    set({ state: 'connected', me, qr: '', code: '', error: '' }); settings(); store.save();
  }
  if (connection === 'close') {
    const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
    const DR = {}; try { Object.assign(DR, (await main.lib()).DisconnectReason || {}); } catch {}
    const registered = s.authState.creds.registered;
    sock = null;
    if (code === (DR.loggedOut || 401)) { wipeAuth(); pairPhone = ''; return set({ state: 'loggedout', me: '', qr: '', code: '', error: 'This device was removed from WhatsApp (Linked devices). Link it again to continue.' }); }
    if (code === (DR.connectionReplaced || 440)) return set({ state: 'error', error: 'This number is now connected somewhere else. Close the other one, then press Reconnect.' });
    if (!registered && (code === (DR.timedOut || 408) || st.state === 'qr' || st.state === 'code')) return set({ state: 'idle', qr: '', code: '', error: 'The code expired. Press “Link” to get a new one.' });
    set({ state: 'connecting' });
    retryT = setTimeout(() => { if (settings().enabled !== false) connect(); }, code === (DR.restartRequired || 515) ? 400 : 4000);
  }
}

// ---------- control (Settings screen) ----------
async function link({ method = 'qr', phone } = {}) {
  if (connected()) throw new Error('Already linked. Unlink first to link a different number.');
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }
  clearTimeout(retryT); wipeAuth(); pairPhone = '';
  if (method === 'code') { pairPhone = digits(phone); if (pairPhone.length < 8) throw new Error('Type the phone number with country code, e.g. 923001234567'); }
  settings().enabled = true; store.save();
  set({ state: 'starting', qr: '', code: '', error: '', me: '' });
  await connect(); return status();
}
async function reconnect() { if (sock) { try { sock.end(undefined); } catch {} sock = null; } settings().enabled = true; store.save(); set({ state: 'starting', error: '' }); await connect(); return status(); }
async function unlink() {
  settings().enabled = false; store.save(); clearTimeout(retryT);
  const s = sock; sock = null; if (s) { try { await s.logout(); } catch { try { s.end(undefined); } catch {} } }
  wipeAuth(); pairPhone = ''; store.db.linkPostContacts = {}; store.save(); set({ state: 'idle', me: '', qr: '', code: '', error: '' }); return status();
}
function updateSettings(b) {
  const l = settings();
  if (b.useForStatus !== undefined) l.useForStatus = !!b.useForStatus;
  if (b.useForChannels !== undefined) l.useForChannels = !!b.useForChannels;
  store.save(); bus.emit('status', status()); return l;
}
function start() { if (hasAuth() && settings().enabled !== false) connect(); }

// ---------- what this number is allowed to do ----------
const needSock = () => { if (!connected()) throw new Error('The posting number is not connected. Open Settings → WhatsApp connection → Posting number and press Reconnect.'); return sock; };
const usableFor = what => connected() && (what === 'status' ? settings().useForStatus : settings().useForChannels) !== false;
const postStatus = async (o, jids) => main.postStatusOn(needSock(), o, jids, contacts());
const channelResolve = async l => main.channelResolveOn(needSock(), l);
const sendChannel = async (jid, o) => main.sendChannelOn(needSock(), jid, o);

module.exports = { bus, status, settings, start, link, reconnect, unlink, updateSettings, connected, usableFor, postStatus, channelResolve, sendChannel };
