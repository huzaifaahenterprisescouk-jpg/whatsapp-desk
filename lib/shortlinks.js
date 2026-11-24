// Short links: https://your-desk/c/Ab3dE opens the long address (call page, tracking page, picture...).
// Used on a linked phone (no API), where the address has to be printed in the message: a short one looks tidy.
const crypto = require('crypto');
const store = require('./store');
const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const box = () => { const d = store.db; if (!d) return { codes: {}, urls: {}, origin: '' }; d.shorts = d.shorts || { codes: {}, urls: {}, origin: '' }; return d.shorts; };
const isLocal = o => /^https?:\/\/(localhost|127\.|192\.168\.|10\.|0\.0\.0\.0)/i.test(o || '');
// remember the public address the desk is opened on (used when no "public address" is set in WhatsApp links)
function seen(origin) { origin = String(origin || '').replace(/\/+$/, ''); const b = box(); if (origin && !isLocal(origin) && b.origin !== origin) { b.origin = origin; store.save(); } }
function base(origin) {
  let cfgBase = ''; try { cfgBase = (store.db.linkCfg || {}).baseUrl || ''; } catch {}
  const o = String(origin || cfgBase || box().origin || '').replace(/\/+$/, '');
  return o && !isLocal(o) ? o : '';
}
// the short address for a long one; the long address itself when there is no public address or it would not get shorter
function shorten(url, origin) {
  try {
    url = String(url || '').trim(); const b = box(), o = base(origin);
    if (!o || !/^https?:\/\//i.test(url) || url.startsWith(o + '/c/') || /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(url)) return url;
    let code = b.urls[url];
    if (!code) {
      do { code = Array.from(crypto.randomBytes(5), x => CHARS[x % CHARS.length]).join(''); } while (b.codes[code]);
      b.codes[code] = url; b.urls[url] = code;
      const keys = Object.keys(b.codes); if (keys.length > 5000) for (const k of keys.slice(0, keys.length - 5000)) { delete b.urls[b.codes[k]]; delete b.codes[k]; }   // keep the newest 5000
      store.save();
    }
    const s = `${o}/c/${code}`; return s.length < url.length ? s : url;
  } catch { return url; }
}
const resolve = code => box().codes[String(code || '')] || '';
module.exports = { shorten, resolve, seen, base };
