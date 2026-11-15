// Each team member keeps their own email signature (rich text + optional GIF).
// The signature is added automatically when they send, reply, forward or when a scheduled mail goes out.
// A GIF can be uploaded (sent as an inline attachment, so Gmail/Outlook show it) or linked from a web address.
const crypto = require('crypto');
const store = require('./store');

const MAX_GIF = 1.5e6;                      // bytes
const TYPES = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeHtml = h => String(h || '').replace(/<(script|iframe|object|embed|style|link|meta|form)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?(script|iframe|object|embed|style|link|meta|form|base|img)\b[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, 'blocked:').slice(0, 20000);
const toText = h => String(h || '').replace(/<(br|\/p|\/div|\/li|\/h\d)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

const sig = a => (a && a.signature) || null;
function view(a) {
  const s = sig(a) || {};
  return { enabled: !!s.enabled, html: s.html || '', gifUrl: s.gifUrl || '', gifWidth: s.gifWidth || 200, hasGif: !!s.gif, gifName: s.gif ? s.gif.name : '', gifPreview: s.gif ? `data:${s.gif.type};base64,${s.gif.b64}` : '' };
}
function set(a, b) {
  const s = a.signature = a.signature || { enabled: false, html: '', gifUrl: '', gifWidth: 200, gif: null };
  if (b.enabled !== undefined) s.enabled = !!b.enabled;
  if (b.html !== undefined) s.html = safeHtml(b.html);
  if (b.gifWidth !== undefined) s.gifWidth = Math.min(600, Math.max(40, parseInt(b.gifWidth, 10) || 200));
  if (b.gifUrl !== undefined) {
    const u = String(b.gifUrl).trim();
    if (u && !/^https:\/\/[^\s"'<>]+$/i.test(u)) throw new Error('The picture link must start with https:// and point straight to the .gif file');
    s.gifUrl = u;
  }
  if (b.removeGif) s.gif = null;
  if (b.gif && b.gif.b64) {
    const buf = Buffer.from(String(b.gif.b64), 'base64'), type = String(b.gif.type || '').toLowerCase();
    if (!TYPES[type]) throw new Error('Use a GIF, PNG, JPG or WebP picture');
    if (buf.length > MAX_GIF) throw new Error('The picture is too big (limit 1.5 MB). Use a smaller GIF or paste a link instead.');
    if (type === 'image/gif' && buf.slice(0, 4).toString('latin1') !== 'GIF8') throw new Error('That file is not a real GIF');
    s.gif = { name: String(b.gif.filename || 'signature.' + TYPES[type]).replace(/[^\w.\- ]/g, '').slice(0, 60) || 'signature.gif', type, b64: buf.toString('base64') };
    s.gifUrl = ''; // an uploaded picture replaces a linked one
  }
  store.save(); return view(a);
}

// What the mailer needs: html + plain text to append, inline images, and a copy for the "Sent" view in the app.
function block(a) {
  const s = sig(a); if (!s || !s.enabled || !(toText(s.html) || s.gif || s.gifUrl)) return null;
  const w = s.gifWidth || 200; let img = '', inline = [];
  if (s.gif) {
    const cid = `sig-${crypto.randomBytes(6).toString('hex')}@whatsapp-desk`;
    inline.push({ cid, type: s.gif.type, filename: s.gif.name, content: Buffer.from(s.gif.b64, 'base64') });
    img = `<div style="margin-top:8px"><img src="cid:${cid}" width="${w}" alt="" style="max-width:100%;height:auto;border:0"></div>`;
  } else if (s.gifUrl) img = `<div style="margin-top:8px"><img src="${esc(s.gifUrl)}" width="${w}" alt="" style="max-width:100%;height:auto;border:0"></div>`;
  const wrap = i => `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;color:#444">${s.html || ''}${i}</div>`;
  return { html: wrap(img), storedHtml: wrap(s.gifUrl ? img : ''), text: '\n\n-- \n' + toText(s.html), inline };
}

module.exports = { view, set, block };
