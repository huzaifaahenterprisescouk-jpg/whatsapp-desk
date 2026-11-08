/* Voice calls in the desk WITHOUT the WhatsApp API (browser to browser). Loaded after call.js and uses its helpers.
   "Voice call" next to a customer sends them a link in WhatsApp; when they tap it the call rings here (answered by itself if you were waiting).
   The same link, opened later by the customer, rings the person handling the chat. */
const WC = { room: '', phone: '', name: '', state: '', pc: null, stream: null, t0: 0, tick: null, offer: '', muted: false, remote: null, expect: '', timer: null };

function wcDraw() {
  if (!WC.state) return callPanel('');
  const L = { waiting: 'Calling… waiting for them to pick up', incoming: 'Incoming voice call', connecting: 'Connecting…', live: '<span id="wctime">0:00</span>' }[WC.state] || '';
  callPanel(`<div class="callbar"><div class="avatar lg" style="background:#16a34a">${esc(initials(WC.name || WC.phone))}</div>
    <div class="cbt"><b>${esc(WC.name || '+' + WC.phone)}</b><span>${L}</span></div>
    ${WC.state === 'incoming' ? `<button class="cbb ok" id="wc-ok" title="Answer">${ic('call')}</button><button class="cbb no" id="wc-no" title="Decline">${ic('call')}</button>`
      : `${WC.state === 'live' ? `<button class="cbb mute ${WC.muted ? 'on' : ''}" id="wc-mu" title="Mute">${ic('mic')}</button>` : ''}<button class="cbb no" id="wc-no" title="End call">${ic('call')}</button>`}</div><audio id="wc-au" autoplay></audio>`);
  const au = $('#wc-au'); if (au && WC.remote) au.srcObject = WC.remote;
  const no = $('#wc-no'); if (no) no.onclick = () => wcEnd(true);
  const ok = $('#wc-ok'); if (ok) ok.onclick = wcAnswer;
  const mu = $('#wc-mu'); if (mu) mu.onclick = () => { WC.muted = !WC.muted; if (WC.stream) WC.stream.getAudioTracks().forEach(t => t.enabled = !WC.muted); wcDraw(); };
}
function wcReset() {
  ringStop(); clearInterval(WC.tick); clearTimeout(WC.timer); if (WC.pc) { try { WC.pc.close(); } catch {} } if (WC.stream) WC.stream.getTracks().forEach(t => t.stop());
  Object.assign(WC, { room: '', phone: '', name: '', state: '', pc: null, stream: null, offer: '', muted: false, remote: null, expect: '' }); wcDraw();
}
function wcLive() { WC.state = 'live'; WC.t0 = Date.now(); ringStop(); wcDraw(); clearInterval(WC.tick); WC.tick = setInterval(() => { const t = $('#wctime'); if (t) t.textContent = fmtSecs((Date.now() - WC.t0) / 1000); }, 500); }

// the team member presses "Voice call" next to a customer
async function webCall(phone, name) {
  if (WC.state || Call.state) return toast('You are already in a call', true);
  try {
    const r = await api('/webcall/invite', { method: 'POST', body: { phone, origin: location.origin } });
    Object.assign(WC, { phone, name: name || '', state: 'waiting', expect: phone }); wcDraw();
    toast(r.local ? 'Call sent, but it points to a local address customers cannot open. Set the public address in WhatsApp links.' : 'Calling… the customer got a “Click to pick up call” message in WhatsApp.', !!r.local);
    clearTimeout(WC.timer); WC.timer = setTimeout(() => { if (WC.state === 'waiting') { toast('They have not opened the link yet. You can call again any time.'); wcReset(); } }, 10 * 60000);
  } catch (e) { toast(e.message, true); }
}
async function wcAnswer() {
  try {
    ringStop(); WC.state = 'connecting'; wcDraw(); WC.stream = await callMic();
    const ice = await api('/webcall/config'), pc = new RTCPeerConnection({ iceServers: ice.ice }); WC.pc = pc; WC.stream.getTracks().forEach(t => pc.addTrack(t, WC.stream));
    pc.ontrack = e => { WC.remote = e.streams[0]; const au = $('#wc-au'); if (au) au.srcObject = WC.remote; };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected' && WC.state !== 'live') wcLive(); if (['failed', 'closed'].includes(pc.connectionState) && WC.state) wcEnd(true); };
    await pc.setRemoteDescription({ type: 'offer', sdp: WC.offer }); await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc);
    await api(`/webcall/${WC.room}/answer`, { method: 'POST', body: { sdp: pc.localDescription.sdp } });
  } catch (e) { toast(e.message, true); wcEnd(true); }
}
async function wcEnd(tell) { const id = WC.room, waiting = WC.state === 'waiting', ph = WC.phone; wcReset(); if (waiting && ph) { try { await api('/webcall/cancel', { method: 'POST', body: { phone: ph } }); } catch {} return; } if (tell && id) { try { await api(`/webcall/${id}/end`, { method: 'POST', body: {} }); } catch {} } }

// events from the server
function onWebCallEvent(c) {
  if (c.event === 'ring') {
    if (Call.state || (WC.state && WC.state !== 'waiting')) return;
    const mine = WC.state === 'waiting' && WC.phone === c.phone;
    Object.assign(WC, { room: c.room, phone: c.phone, name: c.name || WC.name || '', offer: c.sdp, state: 'incoming' });
    if (mine) { wcAnswer(); return; }            // you were waiting for this customer: connect straight away
    wcDraw(); ringStart(); return;
  }
  if (c.room !== WC.room) return;
  if (c.event === 'taken' && WC.state === 'incoming') wcReset();       // someone else picked up
  else if (c.event === 'end') { if (c.reason && WC.state && WC.state !== 'live') toast('Call ended: ' + c.reason); wcReset(); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-webcall]'); if (b) { e.preventDefault(); webCall(b.dataset.webcall, b.dataset.name); } });
