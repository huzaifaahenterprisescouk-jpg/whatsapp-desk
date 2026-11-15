// "WhatsApp links": the admin makes a link (and QR code) such as https://your-desk/go/sales. A customer opens it, fills in
// a few details (name, organization, order number ...) and is sent straight to WhatsApp with those details already typed
// in. When the message arrives, the desk puts the chat with the right team member (the one the admin chose for that link,
// otherwise the person who handles the organization the customer named). Works with the linked phone (no API) and with
// the official Cloud API: the link only needs a WhatsApp number to send people to.
const crypto = require('crypto');
const store = require('./store'), link = require('./wa-link');

const FIELD_KEYS = ['name', 'phone', 'org', 'order', 'note'];
const FIELD_LABEL = { name: 'Your name', phone: 'Your phone number', org: 'Organization / company', order: 'PO / P.R / order number', note: 'How can we help?' };
const WEEK = 7 * 864e5;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const box = () => { const d = store.db; d.links = d.links || []; d.intakes = d.intakes || []; d.linkCfg = d.linkCfg || { deskNumber: '', baseUrl: '' }; return d; };
const digits = s => String(s || '').replace(/\D/g, '');
// "0300 1234567" -> 923001234567; a wa.me / api.whatsapp.com address -> its number
function number(s) {
  s = String(s || '').trim(); const m = /wa\.me\/(\d+)|[?&]phone=(\d+)/i.exec(s); if (m) return m[1] || m[2];
  let d = digits(s); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1); return d;
}
const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const code = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');

// ---------- the number the desk answers on ----------
function deskNumber() { const st = link.status(); return (st.me && digits(st.me)) || number(box().linkCfg.deskNumber); }
const cfgView = () => ({ deskNumber: box().linkCfg.deskNumber || '', deskAuto: (link.status().me || ''), baseUrl: box().linkCfg.baseUrl || '' });
function setCfg(b = {}) {
  const c = box().linkCfg;
  if (b.deskNumber !== undefined) c.deskNumber = number(b.deskNumber);
  if (b.baseUrl !== undefined) c.baseUrl = String(b.baseUrl || '').trim().replace(/\/+$/, '').slice(0, 200);
  store.save(); return cfgView();
}
const baseUrl = origin => box().linkCfg.baseUrl || String(origin || '').replace(/\/+$/, '');

// ---------- links (admin) ----------
function clean(x, old = {}) {
  const L = { ...old };
  if (x.name !== undefined) L.name = String(x.name).trim().slice(0, 60);
  if (!L.name) throw new Error('Give the link a name (for example "Sales enquiries")');
  if (x.slug !== undefined || !L.slug) {
    const s = slugify(x.slug || L.name); if (!s) throw new Error('The address can only use letters and numbers');
    if (box().links.some(o => o.slug === s && o.id !== L.id)) throw new Error('Another link already uses that address');
    L.slug = s;
  }
  for (const k of ['agentId', 'orgId']) if (x[k] !== undefined) L[k] = String(x[k] || '');
  if (x.target !== undefined) L.target = ['desk', 'person', 'custom'].includes(x.target) ? x.target : 'desk';
  L.target = L.target || 'desk';
  if (x.customNumber !== undefined) L.customNumber = number(x.customNumber);
  if (L.target === 'custom' && !number(L.customNumber)) throw new Error('Type the WhatsApp number or wa.me link people should be sent to');
  for (const k of ['title', 'intro', 'first', 'thanks']) if (x[k] !== undefined) L[k] = String(x[k]).slice(0, 300);
  if (x.fields) { L.fields = {}; for (const k of FIELD_KEYS) { const v = x.fields[k]; L.fields[k] = ['off', 'ask', 'required'].includes(v) ? v : 'off'; } }
  L.fields = L.fields || { name: 'required', org: 'ask', note: 'ask', phone: 'off', order: 'off' };
  if (x.enabled !== undefined) L.enabled = !!x.enabled;
  return L;
}
function save(id, x) {
  const d = box(); let L = id && d.links.find(l => l.id === id); if (id && !L) throw new Error('Link not found');
  const nl = clean(x, L || { id: 'l_' + crypto.randomBytes(4).toString('hex'), created: Date.now(), hits: 0, started: 0, enabled: true });
  if (L) Object.assign(L, nl); else d.links.push(nl);
  store.save(); return L || nl;
}
function remove(id) { const d = box(); d.links = d.links.filter(l => l.id !== id); store.save(); }
const bySlug = slug => box().links.find(l => l.slug === String(slug || '').toLowerCase());
const list = () => box().links.map(l => ({ ...l, started: box().intakes.filter(i => i.linkId === l.id).length }));

// ---------- who handles it ----------
function resolveHandler(L, answers) {
  const bot = require('./bot'); // loaded late: bot.js needs this file too
  const orgs = store.db.organizations;
  let org = (answers.org && bot.matchOrg(answers.org, 0.6)) || (L.orgId && orgs.find(o => o.id === L.orgId)) || null;
  let a = L.agentId ? bot.agentById(L.agentId) : null; if (a && !a.active) a = null;
  if (!a && org) a = bot.agentForOrg(org);
  if (!a) a = bot.roundRobin();
  return { agent: a, org };
}
// where "Open WhatsApp" goes
function destination(L, agent) {
  if (L.target === 'custom') return number(L.customNumber);
  if (L.target === 'person' && agent && number(agent.phone)) return number(agent.phone);
  return deskNumber();
}

// ---------- a customer fills in the form ----------
function publicInfo(L) { // what the public page may know
  const s = store.db.settings;
  return { slug: L.slug, title: L.title || L.name, intro: L.intro || '', business: s.businessName, fields: FIELD_KEYS.filter(k => L.fields[k] !== 'off').map(k => ({ key: k, label: FIELD_LABEL[k], required: L.fields[k] === 'required' })), ready: !!L.enabled };
}
function submit(L, a = {}) {
  if (!L.enabled) throw new Error('This link is switched off.');
  const ans = {}; for (const k of FIELD_KEYS) { const v = String(a[k] || '').replace(/\s+/g, ' ').trim().slice(0, k === 'note' ? 400 : 100); if (L.fields[k] !== 'off') ans[k] = v; if (L.fields[k] === 'required' && !v) throw new Error(`Please fill in: ${FIELD_LABEL[k]}`); }
  if (ans.phone && number(ans.phone).length < 8) throw new Error('Please type your phone number with the country code, e.g. 923001234567');
  const { agent, org } = resolveHandler(L, ans);
  const num = destination(L, agent); if (!num) throw new Error('This link is not ready yet: the business WhatsApp number has not been set up. Please contact us another way.');
  const ref = code();
  const lines = [L.first || 'Hello! I need help.'];
  if (ans.name) lines.push(`Name: ${ans.name}`);
  if (ans.org) lines.push(`Organization: ${ans.org}`);
  if (ans.order) lines.push(`Order / PO: ${ans.order}`);
  if (ans.phone) lines.push(`Phone: ${ans.phone}`);
  if (ans.note) lines.push(ans.note);
  const toDesk = L.target === 'desk' || (L.target === 'person' && num === deskNumber());
  if (toDesk) lines.push(`(Ref: ${ref})`);
  const d = box(); const now = Date.now();
  d.intakes = d.intakes.filter(i => now - i.createdAt < WEEK).slice(-3000);
  d.intakes.push({ ref, linkId: L.id, linkName: L.name, agentId: agent ? agent.id : '', orgId: org ? org.id : '', ...ans, phone: number(ans.phone), createdAt: now, used: false });
  L.hits = (L.hits || 0) + 1; store.save();
  return { url: `https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`, agent: agent ? agent.name : '', thanks: L.thanks || '' };
}
function opened(L) { L.hits = (L.hits || 0) + 1; store.save(); }

// ---------- a message arrives: was it sent through one of the links? ----------
function match(text, phone) {
  const now = Date.now(), m = /\bRef:\s*([A-Z0-9]{6})\b/i.exec(String(text || ''));
  const fresh = i => !i.used && now - i.createdAt < WEEK;
  if (m) { const i = box().intakes.find(x => x.ref === m[1].toUpperCase() && fresh(x)); if (i) return i; }
  return null;
}
const summary = i => [i.name && `Name: ${i.name}`, i.org && `Organization: ${i.org}`, i.order && `Order: ${i.order}`, i.phone && `Phone: +${i.phone}`, i.note && `Note: ${i.note}`].filter(Boolean).join(' · ');

// ---------- the public page ----------
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(info) {
  const f = info.fields.map(x => x.key === 'note'
    ? `<label>${E(x.label)}${x.required ? ' *' : ''}<textarea name="note" rows="3" ${x.required ? 'required' : ''}></textarea></label>`
    : `<label>${E(x.label)}${x.required ? ' *' : ''}<input name="${x.key}" ${x.key === 'phone' ? 'type="tel" inputmode="tel" placeholder="923001234567"' : 'type="text"'} autocomplete="${x.key === 'name' ? 'name' : x.key === 'org' ? 'organization' : 'off'}" ${x.required ? 'required' : ''}></label>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(info.title)} · ${E(info.business)}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#effaf6;color:#0f1f1b;display:grid;place-items:center;min-height:100vh;padding:16px}
.c{background:#fff;border-radius:18px;box-shadow:0 10px 40px #0f766e22;max-width:440px;width:100%;padding:26px}.b{color:#0f766e;font-weight:700;font-size:13px;letter-spacing:.3px;text-transform:uppercase}
h1{font-size:22px;margin:6px 0 6px}p{color:#4b5d58;margin:0 0 16px;line-height:1.45}label{display:block;font-size:13px;font-weight:600;margin-bottom:12px;color:#33463f}
input,textarea{width:100%;margin-top:5px;padding:11px 12px;font:inherit;border:1.5px solid #cfe0da;border-radius:10px;background:#fff}input:focus,textarea:focus{outline:0;border-color:#0f766e}
button{width:100%;padding:13px;border:0;border-radius:12px;background:#25d366;color:#053b1d;font:inherit;font-weight:700;font-size:16px;cursor:pointer}button:disabled{opacity:.6}
.e{background:#fee2e2;color:#991b1b;padding:10px 12px;border-radius:10px;margin-bottom:12px;font-size:14px}.s{text-align:center}.s a{color:#0f766e;font-weight:700}</style></head><body><div class="c">
<div class="b">${E(info.business)}</div><h1>${E(info.title)}</h1>${info.intro ? `<p>${E(info.intro)}</p>` : '<p>Tell us a little about you and we will connect you on WhatsApp with the right person.</p>'}
<form id="f">${f}<div id="e" class="e" hidden></div><button id="g">Continue on WhatsApp</button></form>
<div id="d" class="s" hidden><p id="dm"></p><p><a id="dl" href="#">Open WhatsApp</a></p></div></div>
<script>
const f=document.getElementById('f');f.onsubmit=async ev=>{ev.preventDefault();const e=document.getElementById('e'),g=document.getElementById('g');e.hidden=true;g.disabled=true;
try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});const j=await r.json();if(!r.ok)throw new Error(j.error||'Something went wrong');
f.hidden=true;document.getElementById('d').hidden=false;document.getElementById('dm').textContent=j.thanks||(j.agent?'Connecting you with '+j.agent+' on WhatsApp…':'Opening WhatsApp…');document.getElementById('dl').href=j.url;setTimeout(()=>location.href=j.url,600)}
catch(x){e.textContent=x.message;e.hidden=false;g.disabled=false}};
</script></body></html>`;
}
const notFound = () => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;text-align:center"><h2>This link is not available</h2><p>It may have been switched off. Please contact us another way.</p></body>`;

module.exports = { FIELD_KEYS, FIELD_LABEL, number, deskNumber, cfgView, setCfg, baseUrl, save, remove, bySlug, list, publicInfo, submit, opened, match, summary, page, notFound };
