// One door to WhatsApp for the rest of the app. Two ways to be connected:
//   cloud : the official WhatsApp Cloud API (token + phone number ID in .env, webhook in Meta)
//   link  : your existing number, linked like WhatsApp Web (QR code / pairing code), see wa-link.js
//   demo  : neither: nothing is sent (use the Test phone)
const cfg = require('./config'), link = require('./wa-link'), media = require('./media'), store = require('./store');

const cloud = () => !!(cfg.token && cfg.phoneNumberId);
// The switch in Settings → WhatsApp connection ("Use the official WhatsApp Cloud API"):
//   ticked (default) : the Cloud API is used whenever its keys are in .env
//   unticked         : the linked phone is used, the API is left alone (no sending, webhook ignored)
const apiOn = () => ((store.db && store.db.link) || {}).useApi !== false;
const mode = () => apiOn() ? (cloud() ? 'cloud' : link.configured() ? 'link' : 'demo') : 'link';
// Calls through the Cloud API: always when the API is on; with the API unticked only if "calls on the API" is ticked (hybrid: chat on the linked phone, calls on the API number)
const callsOn = () => cloud() && (apiOn() || !!((store.db && store.db.link) || {}).callsApi);
const connected = () => { const m = mode(); return m === 'cloud' || (m === 'link' && link.connected()); };

async function call(body) {
  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message) || `WhatsApp API ${res.status}`);
  return json;
}
const wrap = async fn => { try { await fn(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } };

// Send a plain text message. Returns {ok, error}.
async function sendText(to, text) {
  const m = mode(); if (m === 'demo') return { ok: true, demo: true };
  if (m === 'link') return wrap(() => link.sendText(to, text));
  return wrap(() => call({ to, type: 'text', text: { body: text, preview_url: true } }));
}

// Send a tappable menu. Official API: up to 3 options become tap buttons right under the message; 4 to 10 options become
// a list ("Tap to choose" opens it). A linked phone cannot send either, so there the numbered list inside the text is used
// (customers answer "1", "2" ...).
// Linked phone: no real buttons are possible, so the numbered lines become 1️⃣ 2️⃣ … and the customer types the number.
const keycap = i => i < 9 ? `${i + 1}\uFE0F\u20E3` : '🔟';
function numberMenuText(body, options) {
  let out = body, hit = false;
  options.forEach((o, i) => { const line = `${i + 1}. ${o.title}`; if (out.includes(line)) { hit = true; out = out.replace(line, () => `${keycap(i)} *${o.title}*`); } });
  return hit ? out + '\n\n_Reply with the number of your choice, e.g._ *1*' : body;
}
async function sendMenu(to, body, options) {
  const m = mode(); if (m === 'demo') return { ok: true, demo: true };
  if (m === 'link') return wrap(() => link.sendText(to, numberMenuText(body, options)));
  if (options.length <= 3) return wrap(() => call({
    to, type: 'interactive',
    interactive: { type: 'button', body: { text: body.slice(0, 1024) }, action: { buttons: options.map(o => ({ type: 'reply', reply: { id: o.id, title: o.title.slice(0, 20) } })) } },
  }));
  return wrap(() => call({
    to, type: 'interactive',
    interactive: {
      type: 'list', body: { text: body.slice(0, 1024) },
      action: { button: 'Tap to choose', sections: [{ title: 'Menu', rows: options.slice(0, 10).map(o => ({ id: o.id, title: o.title.slice(0, 24) })) }] },
    },
  }));
}

// A message with ONE button that opens a web address (button text max 20 characters). On a linked phone: text with the address.
async function sendLinkButton(to, body, label, url) {
  const m = mode(); if (m === 'demo') return { ok: true, demo: true };
  if (m === 'link') return wrap(() => link.sendText(to, `${body}\n\n${label}: ${url}`));
  return wrap(() => call({ to, type: 'interactive', interactive: { type: 'cta_url', body: { text: body.slice(0, 1024) }, action: { name: 'cta_url', parameters: { display_text: label.slice(0, 20), url } } } }));
}

// Asks the customer (a tap-to-allow message) for permission to call them on WhatsApp. Cloud API only.
async function sendCallPermission(to, text) {
  if (!callsOn()) return { ok: false, error: 'Calls need the WhatsApp Cloud API connection.' };
  return wrap(() => call({ to, type: 'interactive', interactive: { type: 'call_permission_request', body: { text: text.slice(0, 1024) }, action: { name: 'call_permission_request' } } }));
}

async function uploadCloud(buf, mime, filename) {
  const fd = new FormData(); fd.append('messaging_product', 'whatsapp'); fd.append('type', mime); fd.append('file', new Blob([buf], { type: mime }), filename);
  const up = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` }, body: fd });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || !uj.id) throw new Error((uj.error && uj.error.message) || `WhatsApp upload ${up.status}`);
  return uj.id;
}

// A voice note, picture, video or file. opts: { buf, mime, filename, caption, voice }
async function sendMedia(to, o) {
  const m = mode(); if (m === 'demo') return { ok: true, demo: true };
  if (m === 'link') return wrap(() => link.sendMedia(to, o));
  return wrap(async () => {
    const mime = media.baseMime(o.mime), kind = media.kindOf(mime), name = o.filename || `${kind}.${media.extOf(mime)}`;
    const id = await uploadCloud(o.buf, mime, name), cap = (o.caption || '').slice(0, 1000);
    const body = kind === 'audio' ? { type: 'audio', audio: { id } } : kind === 'image' ? { type: 'image', image: { id, ...(cap ? { caption: cap } : {}) } }
      : kind === 'video' ? { type: 'video', video: { id, ...(cap ? { caption: cap } : {}) } } : { type: 'document', document: { id, filename: name, ...(cap ? { caption: cap } : {}) } };
    await call({ to, ...body });
  });
}
// Upload a file and send it as a document: the customer taps it and it is saved to the phone.
const sendFile = (to, buf, mime, filename, caption) => sendMedia(to, { buf, mime, filename, caption });

// Download a file the customer sent (Cloud API only: a linked phone downloads it itself).
// A product from your WhatsApp / Meta catalog as a native product card (Cloud API only; the catalog must be connected to the number).
async function sendCatalogProduct(to, catalogId, retailerId, body) {
  if (mode() !== 'cloud') return { ok: false, error: 'Catalog products need the official WhatsApp Cloud API.' };
  return wrap(() => call({ to, type: 'interactive', interactive: { type: 'product', body: { text: String(body || 'Have a look at this product').slice(0, 1024) }, action: { catalog_id: String(catalogId), product_retailer_id: String(retailerId) } } }));
}
async function downloadCloud(mediaId) {
  const h = { Authorization: `Bearer ${cfg.token}` };
  const info = await (await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${mediaId}`, { headers: h })).json();
  if (!info.url) throw new Error((info.error && info.error.message) || 'media not found');
  const r = await fetch(info.url, { headers: h }); if (!r.ok) throw new Error('download ' + r.status);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: info.mime_type || r.headers.get('content-type') || 'application/octet-stream' };
}

async function markRead(messageId) {
  if (!messageId) return; const m = mode();
  if (m === 'link') return link.markRead(messageId);
  if (m === 'cloud') { try { await call({ status: 'read', message_id: messageId }); } catch (_) {} }
}

module.exports = { sendCatalogProduct, numberMenuText, mode, apiOn, callsOn, hasApiKeys: cloud, connected, sendText, sendMenu, sendFile, sendMedia, sendLinkButton, sendCallPermission, markRead, downloadCloud };
