/* WhatsApp voice calls in the browser (Cloud API Calling + WebRTC). Loaded after media.js.
   The Call button next to a customer starts a call from the business number; customers' calls ring here. */
const Call = { id: '', phone: '', name: '', dir: '', pc: null, stream: null, state: '', t0: 0, tick: null, ring: null, offer: '', muted: false };
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function callPanel(html) { let el = $('#callbox'); if (!el) { el = document.createElement('div'); el.id = 'callbox'; document.body.appendChild(el); } el.innerHTML = html; el.hidden = !html; }
function callDraw() {
  if (!Call.state) return callPanel('');
  const L = { dialing: 'Calling…', ringing: 'Ringing…', incoming: 'Incoming WhatsApp call', connecting: 'Connecting…', live: '<span id="ctime">0:00</span>' }[Call.state] || '';
  callPanel(`<div class="callbar"><div class="avatar lg" style="background:#16a34a">${esc(initials(Call.name || Call.phone))}</div>
    <div class="cbt"><b>${esc(Call.name || '+' + Call.phone)}</b><span>${L}</span></div>
    ${Call.state === 'incoming' ? `<button class="cbb ok" id="cb-ok" title="Answer">${ic('call')}</button><button class="cbb no" id="cb-no" title="Decline">${ic('call')}</button>`
      : `<button class="cbb mute ${Call.muted ? 'on' : ''}" id="cb-mu" title="Mute">${ic('mic')}</button><button class="cbb no" id="cb-no" title="End call">${ic('call')}</button>`}</div><audio id="cb-au" autoplay></audio>`);
  const au = $('#cb-au'); if (au && Call.remote) au.srcObject = Call.remote;
  const no = $('#cb-no'); if (no) no.onclick = () => callEnd(true);
  const ok = $('#cb-ok'); if (ok) ok.onclick = callAnswer;
  const mu = $('#cb-mu'); if (mu) mu.onclick = () => { Call.muted = !Call.muted; if (Call.stream) Call.stream.getAudioTracks().forEach(t => t.enabled = !Call.muted); callDraw(); };
}
function ringStart() { // simple repeating tone for incoming calls
  try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const beep = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 440; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5); }; beep(); Call.ring = { ctx, t: setInterval(beep, 1800) }; } catch {}
}
function ringStop() { if (Call.ring) { clearInterval(Call.ring.t); try { Call.ring.ctx.close(); } catch {} Call.ring = null; } }
function callReset() { ringStop(); clearInterval(Call.tick); if (Call.pc) { try { Call.pc.close(); } catch {} } if (Call.stream) Call.stream.getTracks().forEach(t => t.stop()); Object.assign(Call, { id: '', phone: '', name: '', dir: '', pc: null, stream: null, state: '', remote: null, muted: false, offer: '' }); callDraw(); }
function callLive() { Call.state = 'live'; Call.t0 = Date.now(); ringStop(); callDraw(); clearInterval(Call.tick); Call.tick = setInterval(() => { const t = $('#ctime'); if (t) t.textContent = fmtSecs((Date.now() - Call.t0) / 1000); }, 500); }
async function callMic() {
  if (!navigator.mediaDevices) throw new Error('Calls need a secure (https) address.');
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { throw new Error('Please allow the microphone for this site to make calls.'); }
}
function newPc() {
  const pc = new RTCPeerConnection(ICE); Call.pc = pc; Call.stream.getTracks().forEach(t => pc.addTrack(t, Call.stream));
  pc.ontrack = e => { Call.remote = e.streams[0]; const au = $('#cb-au'); if (au) au.srcObject = Call.remote; };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected' && Call.state !== 'live') callLive(); if (['failed', 'closed'].includes(pc.connectionState) && Call.state) callEnd(false); };
  return pc;
}
const iceDone = pc => new Promise(ok => { if (pc.iceGatheringState === 'complete') return ok(); const f = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', f); ok(); } }; pc.addEventListener('icegatheringstatechange', f); setTimeout(ok, 3000); });

async function waCall(phone, name) {
  if (Call.state) return toast('You are already in a call', true);
  Object.assign(Call, { phone, name: name || '', dir: 'out', state: 'dialing' }); callDraw();
  try {
    Call.stream = await callMic(); const pc = newPc(); await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc);
    const r = await api('/calls', { method: 'POST', body: { phone, sdp: pc.localDescription.sdp } }); Call.id = r.id; Call.state = 'ringing'; callDraw();
  } catch (e) {
    callReset();
    if (/permission|138006|opt/i.test(e.message)) { if (await gconfirm(`${e.message}\n\nSend ${name || 'the customer'} a message asking permission to call them on WhatsApp?`)) { try { await api('/calls/permission', { method: 'POST', body: { phone } }); toast('Permission request sent. Call again once they tap Allow.'); } catch (x) { toast(x.message, true); } } }
    else toast(e.message, true);
  }
}
async function callAnswer() {
  try {
    ringStop(); Call.state = 'connecting'; callDraw(); Call.stream = await callMic(); const pc = newPc();
    await pc.setRemoteDescription({ type: 'offer', sdp: Call.offer }); await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc);
    await api(`/calls/${encodeURIComponent(Call.id)}/accept`, { method: 'POST', body: { sdp: pc.localDescription.sdp } });
  } catch (e) { toast(e.message, true); callEnd(false, true); }
}
async function callEnd(tell, skip) {
  const id = Call.id, inc = Call.state === 'incoming'; callReset();
  if (tell && id) { try { await api(`/calls/${encodeURIComponent(id)}/${inc ? 'reject' : 'terminate'}`, { method: 'POST', body: {} }); } catch {} }
}
// events from the server (webhook from Meta)
async function onCallEvent(c) {
  if (c.event === 'ring') { if (Call.state) return; Object.assign(Call, { id: c.id, phone: c.phone, name: c.name || '', dir: 'in', state: 'incoming', offer: c.sdp }); callDraw(); ringStart(); return; }
  if (c.id !== Call.id && !(c.event === 'answer' && c.phone === Call.phone && Call.dir === 'out' && !Call.id)) return;
  if (c.event === 'answer' && Call.pc) { try { Call.id = Call.id || c.id; await Call.pc.setRemoteDescription({ type: 'answer', sdp: c.sdp }); Call.state = 'connecting'; callDraw(); } catch (e) { toast('Call failed: ' + e.message, true); callEnd(true); } }
  else if (c.event === 'status' && Call.state === 'ringing') { /* RINGING / ACCEPTED */ }
  else if (c.event === 'taken' && Call.state === 'incoming') callReset();
  else if (c.event === 'end') { if (c.reason && Call.state && Call.state !== 'live') toast('Call ended: ' + c.reason); callReset(); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-wacall]'); if (b) { e.preventDefault(); waCall(b.dataset.wacall, b.dataset.name); } });
