// WhatsApp voice calls through the official Cloud API "Calling" feature (WebRTC: the browser carries the audio).
//   business -> customer : POST /calls action=connect (browser's SDP offer); Meta answers in a webhook ("calls" field)
//   customer -> business : webhook "calls" event=connect with an SDP offer; the browser answers, we pre_accept + accept
const cfg = require('./config'), store = require('./store'), bot = require('./bot'), wa = require('./whatsapp');

const active = new Map(); // callId -> { id, phone, dir, ts, answeredAt }
const base = () => `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}`;
const ready = () => wa.callsOn();

async function graph(path, body) {
  if (!ready()) throw new Error('Calls from the desk need the WhatsApp Cloud API connection (token + phone number ID in .env).');
  const res = await fetch(base() + path, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', ...body }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const er = j.error || {}; const e = new Error([er.message, er.error_data && er.error_data.details].filter(Boolean).join(' — ') || `WhatsApp API ${res.status}`); e.code = er.code; throw e; }
  return j;
}
function sys(phone, text, name) { const c = bot.getConv(phone, name || ''); bot.noteSys(c, text); return c; }
const emit = call => bot.bus.emit('event', { type: 'call', call });

async function start(phone, sdp, agent) {
  const j = await graph('/calls', { to: phone, action: 'connect', session: { sdp_type: 'offer', sdp } });
  const id = j.calls && j.calls[0] && j.calls[0].id; if (!id) throw new Error('WhatsApp did not start the call');
  active.set(id, { id, phone, dir: 'out', ts: Date.now(), by: agent.name });
  sys(phone, `📞 ${agent.name} is calling on WhatsApp…`); return { id };
}
async function accept(id, sdp) {
  const c = active.get(id); if (!c) throw new Error('This call has already ended');
  try { await graph('/calls', { call_id: id, action: 'pre_accept', session: { sdp_type: 'answer', sdp } }); } catch (e) { /* some accounts accept directly */ }
  await graph('/calls', { call_id: id, action: 'accept', session: { sdp_type: 'answer', sdp } });
  c.answeredAt = Date.now(); emit({ id, phone: c.phone, event: 'taken' }); return { ok: true };
}
async function reject(id) { const c = active.get(id); await graph('/calls', { call_id: id, action: 'reject' }); if (c) { active.delete(id); sys(c.phone, '📞 Call declined'); emit({ id, phone: c.phone, event: 'end' }); } return { ok: true }; }
async function terminate(id) { try { await graph('/calls', { call_id: id, action: 'terminate' }); } catch (e) { /* already over */ } const c = active.get(id); if (c) emit({ id, phone: c.phone, event: 'end' }); return { ok: true }; }
async function askPermission(phone) { const r = await wa.sendCallPermission(phone, 'We would like to call you on WhatsApp about your order. Do you allow us to call you?'); if (!r.ok) throw new Error(r.error); sys(phone, '📞 Asked the customer for permission to call'); return { ok: true }; }
async function enable() { return graph('/settings', { calling: { status: 'ENABLED', call_icon_visibility: 'DEFAULT', callback_permission_status: 'ENABLED' } }); }

// webhook "calls" field
function onWebhook(v) {
  const names = {}; for (const c of v.contacts || []) names[c.wa_id] = (c.profile || {}).name;
  for (const c of v.calls || []) {
    const id = c.id, incoming = c.direction === 'USER_INITIATED', phone = String((incoming ? c.from : c.to) || '').replace(/\D/g, ''); if (!id || !phone) continue;
    if (c.event === 'connect') {
      const sdp = c.session && c.session.sdp;
      if (incoming) {
        active.set(id, { id, phone, dir: 'in', ts: Date.now() });
        const conv = bot.getConv(phone, names[phone]); bot.noteSys(conv, '📞 Incoming WhatsApp call', true);
        emit({ id, phone, name: conv.name, dir: 'in', event: 'ring', sdp });
      } else emit({ id, phone, dir: 'out', event: 'answer', sdp });
    } else if (c.event === 'terminate') {
      const a = active.get(id) || { phone, dir: incoming ? 'in' : 'out' }; active.delete(id);
      const secs = +c.duration || 0, ok = (c.status || '').toUpperCase() === 'COMPLETED' || secs > 0;
      const t = ok ? `📞 Call ended · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : (a.dir === 'in' ? '📞 Missed WhatsApp call' : '📞 Call not answered');
      bot.noteSys(bot.getConv(phone, names[phone]), t, !ok && a.dir === 'in');
      emit({ id, phone, event: 'end', reason: ok ? '' : (c.status || 'not answered') });
    }
  }
  for (const s of v.statuses || []) if (s.type === 'call' || s.recipient_id && (s.status === 'RINGING' || s.status === 'ACCEPTED' || s.status === 'REJECTED')) emit({ id: s.id, phone: String(s.recipient_id || '').replace(/\D/g, ''), event: 'status', status: s.status });
}
module.exports = { start, accept, reject, terminate, askPermission, enable, onWebhook, ready };
