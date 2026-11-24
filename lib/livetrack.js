// Live tracking: the server opens the courier's own tracking page for the CN (the same address as the "Track order" button),
// reads the shipment details and the tracking history from it, and hands them to the printable receipt.
// It understands pages that show the details as text (Origin / Destination / Shipper / ... and a dated history) and JSON answers.
const dns = require('dns').promises;
const net = require('net');
const courier = require('./courier');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const cache = new Map(); // cn|url -> { at, res }

// never let this feature be used to reach the inside of the network
const privateIp = ip => net.isIPv4(ip) ? /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) : /^(::1|fc|fd|fe80)/i.test(ip);
async function safeUrl(u) {
  let x; try { x = new URL(u); } catch { throw new Error('The courier tracking address is not valid.'); }
  if (!/^https?:$/.test(x.protocol)) throw new Error('The courier tracking address must start with http:// or https://');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(x.hostname)) throw new Error('That address is not allowed.');
  const addrs = net.isIP(x.hostname) ? [{ address: x.hostname }] : await dns.lookup(x.hostname, { all: true }).catch(() => { throw new Error('Could not find the courier website (' + x.hostname + ').'); });
  if (addrs.some(a => privateIp(a.address))) throw new Error('That address is not allowed.');
  return x.toString();
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = s => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n ? String.fromCodePoint(n) : ' '; } return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m; });
// the page as plain lines of text, one per visible element
function toLines(html) {
  const t = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(div|tr|td|th|li|ul|ol|p|h[1-6]|table|section|article|span|label|dt|dd|br|hr|form|button|a|b|strong|small)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return decode(t).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const LABELS = [
  ['origin', /^origin$/i], ['destination', /^destination$/i], ['shipper', /^(shipper|sender)( name)?$/i], ['consignee', /^(consignee|receiver)( name)?$/i],
  ['ref', /^(reference|ref)( no\.?| number)?$/i], ['booking', /^(booking|booked)( date)?$/i], ['pieces', /^(pieces|pcs|no\.? of pieces)$/i],
  ['status', /^current status( ?\/ ?reason)?$/i], ['curWhen', /^dated?$/i], ['receivedBy', /^(received by|receiver name|delivered to|receiving person)$/i],
  ['deliveredOn', /^(delivered (on|at)|delivery date( ?& ?time)?)$/i], ['weight', /^weight$/i],
];
const labelOf = l => { const t = l.replace(/\s*:\s*$/, '').trim(); const h = LABELS.find(([, re]) => re.test(t)); return h ? h[0] : ''; };
const DATE_RE = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})(?:[\s,]+\(?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\)?)?$/i;
const TIME_RE = /^\(?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\)?$/i;
const whenOf = (m, time) => `${+m[1]} ${m[2]} ${m[3]}${(m[4] || time) ? ', ' + (m[4] || time) : ''}`;

function parseText(html) {
  const lines = toLines(html), f = {};
  // details: "Label : value" on one line, or the label on one line and its value on the next
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], c = l.indexOf(':'), inl = c > 0 && labelOf(l.slice(0, c)) ? [labelOf(l.slice(0, c)), l.slice(c + 1).trim()] : null;
    if (inl && inl[1]) { if (!f[inl[0]]) f[inl[0]] = inl[1]; continue; }
    const k = inl ? inl[0] : labelOf(l); if (!k || f[k]) continue;
    let v = ''; for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) { if (labelOf(lines[j])) break; v = lines[j]; break; }
    if (v && v !== ':') f[k] = v.replace(/^:\s*/, '');
  }
  // history: a date line (optionally followed by a time line) and then the text of that step
  const events = []; const start = Math.max(0, lines.findIndex(l => /^shipment information$|^tracking (history|details)$/i.test(l)));
  for (let i = start; i < lines.length; i++) {
    const m = DATE_RE.exec(lines[i]); if (!m) continue;
    let time = '', j = i + 1; if (!m[4] && lines[j] && TIME_RE.test(lines[j])) { time = TIME_RE.exec(lines[j])[1]; j++; }
    const what = []; while (j < lines.length && !DATE_RE.test(lines[j]) && !labelOf(lines[j]) && what.length < 2) { if (!/^(need help|shipment detail|delivery detail)/i.test(lines[j])) what.push(lines[j]); j++; if (what.length) break; }
    if (what.length) events.push({ when: whenOf(m, time), what: what[0] });
    i = Math.max(i, j - 1);
  }
  return { f, events };
}

// JSON answers: look through the object for the same things by name
function parseJson(o) {
  const f = {}, events = [], want = { origin: /^(origin|origin_?city|from)$/i, destination: /^(destination|destination_?city|to)$/i, shipper: /^shipper(_?name)?$/i, consignee: /^consignee(_?name)?$/i, ref: /^(reference|ref)(_?no|_?number)?$/i, booking: /^booking(_?date)?$/i, pieces: /^(pieces|pcs)$/i, status: /^(current_?status|status)$/i, receivedBy: /^(received_?by|receiver)$/i, deliveredOn: /^(delivered_?(on|at)|delivery_?date)$/i };
  const walk = (x, d) => {
    if (!x || d > 6) return;
    if (Array.isArray(x)) { const ev = x.filter(e => e && typeof e === 'object' && Object.keys(e).some(k => /date|time/i.test(k)) && Object.keys(e).some(k => /status|desc|detail|remark|activity|message/i.test(k))); if (ev.length >= 1 && !events.length) for (const e of ev) { const dk = Object.keys(e).find(k => /date|time/i.test(k)), sk = Object.keys(e).find(k => /status|desc|detail|remark|activity|message/i.test(k)); events.push({ when: String(e[dk] || ''), what: String(e[sk] || '') }); } x.forEach(y => walk(y, d + 1)); return; }
    if (typeof x === 'object') for (const [k, v] of Object.entries(x)) { for (const [n, re] of Object.entries(want)) if (!f[n] && re.test(k) && (typeof v === 'string' || typeof v === 'number') && String(v).trim()) f[n] = String(v).trim(); if (v && typeof v === 'object') walk(v, d + 1); }
  };
  walk(o, 0); return { f, events };
}

async function pull(url) {
  const ctl = AbortSignal.timeout(15000);
  let r; try { r = await fetch(await safeUrl(url), { headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: ctl }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'The courier website did not answer within 15 seconds.' : (e.message && !/fetch failed/i.test(e.message) ? e.message : 'Could not reach the courier website' + (e.cause && e.cause.code ? ' (' + e.cause.code + ')' : '') + '.')); }
  if (!r.ok) throw new Error(`The courier website answered with error ${r.status}${r.status === 403 || r.status === 503 ? ' (it may block automatic requests)' : ''}.`);
  const buf = Buffer.from(await r.arrayBuffer()).subarray(0, 3e6), body = buf.toString('utf8'), ct = r.headers.get('content-type') || '';
  return { body, json: /json/i.test(ct) || /^\s*[{[]/.test(body) };
}

// → { ok, url, fields, events:[{when,what}], error }
async function fetchLive({ cn, courier: name, url, fresh } = {}) {
  cn = String(cn || '').trim().replace(/\s+/g, ''); if (!cn) return { ok: false, error: 'Enter the CN / tracking number.' };
  url = String(url || '').trim() || courier.trackUrl({ cn, courier: name }); if (!url) return { ok: false, error: `There is no tracking address for the courier "${name || ''}". Add it in Settings → Courier tracking links, or type the address in the form.` };
  if (/\{cn\}/.test(url)) url = url.replace(/\{cn\}/g, encodeURIComponent(cn));
  const key = cn + '|' + url, hit = cache.get(key); if (!fresh && hit && Date.now() - hit.at < 60000) return hit.res;
  let res;
  try {
    const { body, json } = await pull(url);
    let p; if (json) { try { p = parseJson(JSON.parse(body)); } catch { p = parseText(body); } } else p = parseText(body);
    const n = Object.keys(p.f).length;
    res = n >= 2 || p.events.length ? { ok: true, url, fields: p.f, events: p.events } : { ok: false, url, error: 'The courier page did not contain tracking details for this CN. It may load them with JavaScript, or need a different address (Settings → Courier tracking links).', sample: toLines(body).slice(0, 40) };
  } catch (e) { res = { ok: false, url, error: e.message }; }
  if (res.ok) cache.set(key, { at: Date.now(), res }); if (cache.size > 300) cache.clear();
  return res;
}
// the lines the receipt's history box understands
const eventsText = evs => (evs || []).map(e => (e.when ? e.when + ' | ' : '') + e.what).join('\n');

module.exports = { fetchLive, eventsText, parseText, parseJson, toLines };
