// Voice calls that need NO WhatsApp API: the audio runs browser-to-browser (WebRTC) and this file only passes the
// connection details between the two browsers.
//   team member -> customer : the desk sends the customer a link in WhatsApp ("tap to talk"); when they open it and press the
//                             green button, the call rings in the desk (answered automatically if you were waiting).
//   customer -> team member : the same link works any time; pressing the button rings the person who handles that chat.
// Every chat has its own private link (a random token), so it cannot be guessed.
const crypto = require('crypto');
const store = require('./store'), bot = require('./bot');

const rooms = new Map();            // room id -> { id, phone, name, agentId, state, offer, answer, expected, created, answeredAt }
const RING_MS = 60000;

function iceServers() { // optional TURN server (needed on some mobile networks): TURN_URL, TURN_USER, TURN_PASS in .env
  const s = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URL) s.push({ urls: process.env.TURN_URL.split(/[\s,]+/).filter(Boolean), username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
  return s;
}
function tokenFor(conv) { if (!conv.callToken) { conv.callToken = crypto.randomBytes(12).toString('hex'); store.save(); } return conv.callToken; }
const convByToken = t => Object.values(store.db.conversations).find(c => c.callToken && c.callToken === t) || null;
const emit = (ev, r, extra) => bot.bus.emit('event', { type: 'webcall', call: { event: ev, room: r.id, phone: r.phone, name: r.name, agentId: r.agentId, ...extra } });
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// the team member wants to call: send the customer the link and wait
async function invite(conv, agent, origin) {
  const url = `${origin}/call/${tokenFor(conv)}`;
  conv.callWait = { agentId: agent.id, until: Date.now() + 10 * 60000 }; store.save();
  // in the desk this shows as a "Tap to pick up call" button; on a linked phone WhatsApp can only show the address as a tappable link
  await bot.agentSendLink(conv.phone, agent, conv.isGroup ? `📞 ${agent.name} is starting a voice call for this group. Tap the link to talk.` : `📞 ${agent.name} is calling you on a voice call.`, 'Click to pick up call', url);
  return { url };
}
function cancel(conv) { delete conv.callWait; store.save(); return { ok: true }; }
function decline(token) {
  const c = convByToken(token); if (!c) return { ok: true };
  const w = c.callWait; delete c.callWait; store.save();
  bot.noteSys(c, c.isGroup ? '📞 A group member declined the voice call' : '📞 The customer declined the voice call', true);
  emit('end', { id: '', phone: c.phone, name: c.name, agentId: w ? w.agentId : c.agentId }, { reason: 'Declined' });
  return { ok: true };
}

// ---- the customer's side (public, identified by the token in the link) ----
function guestInfo(token) {
  const c = convByToken(token); if (!c) return null;
  const a = bot.agentById(c.agentId);
  const w = c.callWait, wa0 = w && w.until > Date.now() && bot.agentById(w.agentId);
  return { invited: !!wa0, name: wa0 ? wa0.name : a ? a.name : (store.db.settings.businessName || 'our team'), business: store.db.settings.businessName, customer: c.name && c.name !== c.phone ? c.name : '', ice: iceServers() };
}
function ring(token, sdp) {
  const c = convByToken(token); if (!c) throw new Error('This call link is not valid any more.');
  if (!sdp || sdp.length > 60000) throw new Error('Bad call request');
  for (const r of rooms.values()) if (r.phone === c.phone && ['ringing', 'live'].includes(r.state)) end(r.id, 'guest');   // one call per customer
  const w = c.callWait, expected = !!(w && w.until > Date.now());
  const agentId = expected ? w.agentId : (c.agentId || '');
  const r = { id: crypto.randomBytes(8).toString('hex'), phone: c.phone, name: c.name, agentId, state: 'ringing', offer: sdp, answer: '', expected, created: Date.now() };
  rooms.set(r.id, r);
  if (!expected) bot.noteSys(c, '📞 Incoming voice call (web link)', false);
  emit('ring', r, { sdp, expected });
  setTimeout(() => { if (r.state === 'ringing') { r.state = 'missed'; bot.noteSys(c, '📞 Missed voice call (web link)', true); emit('end', r, { reason: 'No answer' }); } }, RING_MS);
  return { room: r.id };
}
function poll(token, id) {
  const c = convByToken(token), r = rooms.get(id); if (!c || !r || r.phone !== c.phone) return { state: 'ended' };
  return { state: r.state, answer: r.state === 'live' ? r.answer : '' };
}
// ---- the team member's side ----
function answer(id, sdp, agent) {
  const r = rooms.get(id); if (!r || r.state !== 'ringing') throw new Error('This call has already ended.');
  if (!sdp || sdp.length > 60000) throw new Error('Bad answer');
  r.answer = sdp; r.state = 'live'; r.answeredAt = Date.now(); r.agentId = agent.id;
  const c = store.db.conversations[r.phone]; if (c) { delete c.callWait; store.save(); }
  emit('taken', r, { by: agent.id, agentId: '' }); return { ok: true };   // agentId '' = tell everyone who saw it ring to stop ringing
}
function end(id, who) {
  const r = rooms.get(id); if (!r || r.state === 'ended') return { ok: true };
  const was = r.state; r.state = 'ended';
  const c = store.db.conversations[r.phone];
  if (c) {
    if (was === 'live') bot.noteSys(c, `📞 Voice call ended · ${clock(Math.round((Date.now() - r.answeredAt) / 1000))}`);
    else if (was === 'ringing') bot.noteSys(c, who === 'guest' ? (c.isGroup ? '📞 Voice call cancelled by the group member' : '📞 Voice call cancelled by the customer') : '📞 Voice call declined', who === 'guest');
  }
  emit('end', r, { reason: '' });
  setTimeout(() => rooms.delete(id), 60000);
  return { ok: true };
}
const roomOf = id => rooms.get(id) || null;

module.exports = { iceServers, tokenFor, invite, cancel, decline, guestInfo, ring, poll, answer, end, roomOf };

// ---------- the customer's call screen (looks like a phone call: Accept / Decline, then End) ----------
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PH = '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
module.exports.page = info => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${E(info.invited ? info.name + ' is calling' : 'Call ' + info.name)}</title>
<style>*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html,body{height:100%}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:linear-gradient(180deg,#0b2a22,#07140f);color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;padding:max(48px,env(safe-area-inset-top)) 16px max(40px,env(safe-area-inset-bottom))}
.top{opacity:.7;font-size:13px;letter-spacing:.4px;display:flex;gap:6px;align-items:center;justify-content:center}.mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.av{width:128px;height:128px;border-radius:50%;background:#16a34a;display:grid;place-items:center;font-size:48px;font-weight:700;margin-bottom:18px;position:relative}
.av.ring::before,.av.ring::after{content:"";position:absolute;inset:-8px;border-radius:50%;border:2px solid #25d36688;animation:p 1.8s infinite}.av.ring::after{animation-delay:.9s}@keyframes p{from{transform:scale(1);opacity:1}to{transform:scale(1.35);opacity:0}}
h1{font-size:28px;margin:0;font-weight:600}#s{color:#a7c4bb;font-size:17px;min-height:24px}
.bar{display:flex;gap:44px;justify-content:center;align-items:flex-start;min-height:104px}.w{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;color:#cfe3dc}
button{border:0;border-radius:50%;width:70px;height:70px;display:grid;place-items:center;cursor:pointer;transition:transform .1s}button:active{transform:scale(.93)}
#acc{background:#25d366}#dec,#end{background:#ef4444}#dec svg,#end svg{transform:rotate(135deg)}#mu{background:#334155}#mu.on{background:#fff}#mu.on svg{stroke:#0b2a22}[hidden]{display:none!important}</style></head><body>
<div class="top">🔒 Voice call · ${E(info.business)}</div>
<div class="mid"><div class="av ${info.invited ? 'ring' : ''}" id="av">${E((info.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div><h1>${E(info.name)}</h1><div id="s"></div><audio id="au" autoplay></audio></div>
<div class="bar"><div class="w" id="wm" hidden><button id="mu" title="Mute">${MIC}</button>Mute</div><div class="w" id="wd" hidden><button id="dec" title="Decline">${PH}</button>Decline</div><div class="w" id="wa"><button id="acc" title="Accept">${PH}</button><span id="al">Accept</span></div><div class="w" id="we" hidden><button id="end" title="End call">${PH}</button>End</div></div>
<script>
const T=location.pathname.split('/')[2],$=i=>document.getElementById(i),ICE=${JSON.stringify(info.ice)},INV=${info.invited ? 'true' : 'false'};
let pc,stream,room,timer,t0,muted=false,over=false,iv;
const st=t=>$('s').textContent=t,post=(p,b)=>fetch('/call/'+T+'/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Error');return j});
function ui(s){$('wa').hidden=!['incoming','outgoing','ended'].includes(s);$('wd').hidden=s!=='incoming';$('we').hidden=!['ringing','connecting','live'].includes(s);$('wm').hidden=s!=='live';$('av').classList.toggle('ring',s==='incoming'||s==='ringing');$('al').textContent=s==='incoming'?'Accept':s==='ended'?'Call again':'Call'}
function done(msg){over=true;clearInterval(timer);clearInterval(iv);if(pc)try{pc.close()}catch{}if(stream)stream.getTracks().forEach(t=>t.stop());st(msg);ui('ended')}
ui(INV?'incoming':'outgoing');st(INV?'Voice call… tap to answer':'Tap the green button to call');
$('mu').onclick=()=>{muted=!muted;stream.getAudioTracks().forEach(t=>t.enabled=!muted);$('mu').classList.toggle('on',muted)};
$('end').onclick=async()=>{try{await post('end',{room})}catch{}done('Call ended')};
$('dec').onclick=async()=>{try{await post('decline')}catch{}done('Call declined')};
$('acc').onclick=async()=>{
  if(!navigator.mediaDevices){return st('Calls need a secure (https) address. Ask the team for a new link.')}
  over=false;ui('connecting');st('Connecting…');
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}catch{ui(INV?'incoming':'outgoing');return st('Please allow the microphone to talk.')}
  pc=new RTCPeerConnection({iceServers:ICE});stream.getTracks().forEach(t=>pc.addTrack(t,stream));pc.ontrack=e=>{$('au').srcObject=e.streams[0]};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected'){ui('live');st('0:00');t0=Date.now();clearInterval(timer);timer=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);st(Math.floor(s/60)+':'+String(s%60).padStart(2,'0'))},500)}
    if(['failed','closed'].includes(pc.connectionState)&&!over)done('The call was cut off')}
  try{await pc.setLocalDescription(await pc.createOffer());await new Promise(ok=>{if(pc.iceGatheringState==='complete')return ok();pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')ok()};setTimeout(ok,4000)});
    room=(await post('ring',{sdp:pc.localDescription.sdp})).room;ui('ringing');st('Calling…');
    iv=setInterval(async()=>{if(over)return clearInterval(iv);try{const r=await (await fetch('/call/'+T+'/poll?room='+room)).json();
      if(r.state==='live'&&r.answer&&!pc.remoteDescription){await pc.setRemoteDescription({type:'answer',sdp:r.answer});st('Connecting…')}
      else if(r.state==='ended'){done('Call ended')}else if(r.state==='missed'){done('No answer. Please try again later.')}}catch{}},1000)
  }catch(e){done(e.message||'Could not start the call')}};
</script></body></html>`;
module.exports.notFound = () => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:40px;text-align:center"><h2>This call link is not valid</h2><p>Please ask the team to send you a new one.</p></body>`;
