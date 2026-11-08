/* Voice notes, photos and files in chats + "link your WhatsApp number" screen.
   Loaded after app.js. app.js calls composerHtml(), bindComposer(), mediaHtml(), renderWaCard(), onWaEvent(), connHtml(). */
Object.assign(ICONS, {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  clip: '<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.9-8.9a3.3 3.3 0 0 1 4.7 4.7l-8.9 8.9a1.7 1.7 0 0 1-2.4-2.4l8.2-8.2"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
});

const MAX_FILE = 16 * 1024 * 1024;
const mUrl = (id, dl) => `/api/media/${id}?token=${encodeURIComponent(S.token)}${dl ? '&dl=1' : ''}`;
const mediaSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fmtSecs = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- chat bubble content ----------
function mediaHtml(m) {
  const x = m.media; if (!x) return '';
  if (x.kind === 'audio') return `<div class="mm aud">${x.voice ? `<span class="mm-l">${ic('mic')} Voice message${x.secs ? ' · ' + fmtSecs(x.secs) : ''}</span>` : `<span class="mm-l">${ic('mic')} ${esc(x.name)}</span>`}<audio controls preload="metadata" src="${mUrl(x.id)}"></audio></div>`;
  if (x.kind === 'image') return `<a class="mm img" href="${mUrl(x.id)}" target="_blank" rel="noopener"><img loading="lazy" alt="${esc(x.name)}" src="${mUrl(x.id)}"></a>`;
  if (x.kind === 'video') return `<div class="mm vid"><video controls preload="metadata" src="${mUrl(x.id)}"></video></div>`;
  return `<a class="mm doc" href="${mUrl(x.id, 1)}" download>${ic('file')}<span><b>${esc(x.name)}</b><small>${mediaSize(x.size)} · tap to download</small></span></a>`;
}

// ---------- composer ----------
function composerHtml() {
  return `<div class="composer"><div class="qr">${QUICK.map(q => `<button type="button">${esc(q)}</button>`).join('')}</div>
    <form id="cf"><button type="button" class="ib" id="catt" title="Send a photo, video or file">${ic('clip')}</button><input type="file" id="cfile" multiple hidden>
      <textarea id="ctext" rows="1" placeholder="Type a reply…"></textarea>
      <button class="send" id="csend" title="Send" hidden>${ic('send')}</button><button type="button" class="send mic" id="cmic" title="Record a voice message">${ic('mic')}</button></form>
    <div class="rec" id="rec" hidden><button type="button" class="ib" id="rcx" title="Cancel">${ic('trash')}</button><span class="recdot"></span><b id="rct">0:00</b><span class="hint" style="flex:1">Recording… tap send when done</span><button type="button" class="send" id="rcs" title="Send voice message">${ic('send')}</button></div></div>`;
}

const Rec = { mr: null, chunks: [], t0: 0, tick: null, stream: null, drop: false };
function recUi(on) { $('#cf').hidden = on; $('#rec').hidden = !on; }
async function recStart() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice recording needs a modern browser and a secure (https) address.', true);
  if (!S.sel) return;
  try { Rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { return toast('Please allow the microphone for this site (lock icon in the address bar) to record voice messages.', true); }
  const type = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  Rec.chunks = []; Rec.drop = false; Rec.mr = new MediaRecorder(Rec.stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : {});
  Rec.mr.ondataavailable = e => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
  Rec.mr.onstop = async () => {
    Rec.stream.getTracks().forEach(t => t.stop()); clearInterval(Rec.tick); recUi(false);
    const secs = (Date.now() - Rec.t0) / 1000, blob = new Blob(Rec.chunks, { type: Rec.mr.mimeType || type || 'audio/webm' });
    if (Rec.drop || secs < 0.6 || !blob.size) return;
    try { toast('Sending voice message…'); await sendBlob(blob, { name: 'voice.' + (/ogg/.test(blob.type) ? 'ogg' : /mp4/.test(blob.type) ? 'm4a' : 'webm'), voice: true, secs }); toast('Voice message sent'); }
    catch (e) { toast(e.message, true); }
  };
  Rec.t0 = Date.now(); Rec.mr.start(250); recUi(true); $('#rct').textContent = '0:00';
  Rec.tick = setInterval(() => { const t = $('#rct'); if (t) t.textContent = fmtSecs((Date.now() - Rec.t0) / 1000); }, 250);
}
function recStop(drop) { Rec.drop = !!drop; if (Rec.mr && Rec.mr.state !== 'inactive') Rec.mr.stop(); }

async function sendBlob(blob, { name, voice, secs, caption }) {
  if (blob.size > MAX_FILE) throw new Error('That file is too big (WhatsApp allows up to 16 MB).');
  const q = new URLSearchParams({ name: name || '', voice: voice ? '1' : '0', secs: Math.round(secs || 0), caption: caption || '' });
  const r = await fetch(`/api/conversations/${S.sel}/send-media?${q}`, { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { logout(); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(j.error || 'Could not send the file');
}
async function sendFiles(files, caption) {
  for (const f of files) {
    try { toast(`Sending ${f.name}…`); await sendBlob(f, { name: f.name, caption }); caption = ''; toast('Sent'); } catch (e) { toast(e.message, true); }
  }
}
function bindComposer(ta) {
  const sync = () => { const has = !!ta.value.trim(); $('#csend').hidden = !has; $('#cmic').hidden = has; };
  ta.addEventListener('input', sync); sync();
  $('#cf').addEventListener('submit', () => setTimeout(sync, 0));
  $('#cmic').onclick = recStart; $('#rcx').onclick = () => recStop(true); $('#rcs').onclick = () => recStop(false);
  $('#catt').onclick = () => $('#cfile').click();
  $('#cfile').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return; const cap = ta.value.trim(); if (cap) { ta.value = ''; sync(); } sendFiles(fs, cap); };
  ta.addEventListener('paste', e => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); sendFiles(fs); } });
  const th = $('#thread');
  th.ondragover = e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); th.classList.add('drag'); } };
  th.ondragleave = e => { if (e.target === th) th.classList.remove('drag'); };
  th.ondrop = e => { th.classList.remove('drag'); const fs = [...(e.dataTransfer.files || [])]; if (fs.length) { e.preventDefault(); sendFiles(fs); } };
}

// ---------- connection status (sidebar) ----------
function connHtml() {
  if (S.live) return `<span class="pulse"></span><div><b>WhatsApp connected</b>${S.waMe ? '+' + esc(S.waMe) : 'Live on your business number'}</div>`;
  return `<span class="pulse demo"></span><div><b>${S.mode === 'link' ? 'WhatsApp disconnected' : 'Not linked yet'}</b>${isAdmin() ? 'Settings → WhatsApp connection' : 'Ask the administrator'}</div>`;
}
function updateConn() { const c = $('.conn'); if (c) c.innerHTML = connHtml(); }
function onWaEvent(st) {
  S.wa = st; S.callsApi = !!st.callsApi; S.waMe = st.cloud ? '' : (st.me || ''); S.live = !!st.live; S.mode = st.mode || S.mode;
  updateConn(); if ($('#wacard')) renderWaCard(true);
}
function onWaMode(e) { S.mode = e.mode; S.callsApi = !!e.callsApi; S.live = !!e.live; if (e.mode === 'cloud') S.waMe = ''; updateConn(); }

// ---------- Settings → WhatsApp connection ----------
let waPoll = null;
async function renderWaCard(fromEvent) {
  const el = $('#wacard'); if (!el) { clearInterval(waPoll); return; }
  if (!fromEvent || !S.wa) { try { S.wa = await api('/wa'); S.waMe = S.wa.me || ''; } catch (e) { el.innerHTML = `<div class="h3">WhatsApp connection</div><div class="hint">${esc(e.message)}</div>`; return; } }
  const w = S.wa, L = w.settings || {}, busy = ['starting', 'qr', 'code', 'connecting'].includes(w.state);
  clearInterval(waPoll); if (busy) waPoll = setInterval(() => renderWaCard(), 2500);
  S.live = !!w.live; S.mode = w.mode; S.callsApi = !!w.callsApi; if (w.cloud) S.waMe = ''; updateConn();
  const useApi = L.useApi !== false, keys = !!w.apiKeys;
  const viaApi = useApi && keys;
  const sw = `<div class="field" style="margin-bottom:14px"><label>How should WhatsApp be connected?</label>
    <div class="wamodes">
      <label class="wamode ${viaApi ? '' : 'on'}"><input type="radio" name="wa-conn" value="link" ${viaApi ? '' : 'checked'}>
        <span><b>Without API</b><small>Your own number, linked like WhatsApp Web. Free: no message limits, no templates, no 24-hour rule. The welcome menu is sent as a numbered list (customer replies 1, 2 …).</small></span></label>
      <label class="wamode ${viaApi ? 'on' : ''} ${keys ? '' : 'off'}"><input type="radio" name="wa-conn" value="api" ${viaApi ? 'checked' : ''} ${keys ? '' : 'disabled'}>
        <span><b>With API</b><small>${keys ? 'Official Meta WhatsApp Cloud API: tappable buttons and calling from the desk. Meta’s message limits, the 24-hour rule and template fees apply.' : 'Not available yet. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to the .env file and restart to switch this on.'}</small></span></label>
    </div>
    <div class="hint" style="margin-top:6px">Only one is active at a time. WhatsApp links and the team inbox work in both.</div></div>`;
  const callsBox = keys && !useApi ? `<div class="field" style="margin-bottom:14px"><label class="chk"><input type="checkbox" id="wa-calls" ${L.callsApi ? 'checked' : ''}><span><b>Make only the calls go through the API</b></span></label><div class="hint"><b>Calls on the API only:</b> chat, links, bot and voice messages stay on your linked number (no API), and only <b>WhatsApp calls</b> go through the official API. Meta needs a <b>separate number</b> on the Cloud API for this (not the one linked here), so customers will see calls come from that number. Meta also limits calls (the customer must allow calls; 1 permission request a day, 100 calls a day per customer; not available for business-initiated calls in the US, Canada, Egypt, Vietnam, Nigeria; the API number needs a 2,000-contact daily messaging limit).</div></div>` : '';
  const agentsOn = (S.agents || []).filter(a => a.active), asg = L.assignNew !== false;
  const newBox = w.cloud ? '' : `<div class="wanew"><div class="h3" style="font-size:14px;margin:0 0 4px">Who gets new chats (without API)</div>
    <div class="hint" style="margin-bottom:10px">Changes save as soon as you tick or choose them.</div>
    <div class="field"><label class="chk"><input type="checkbox" id="wa-asg" ${asg ? 'checked' : ''}><span>Assign every new chat automatically</span></label>
      <div class="hint">The chat goes to the person who handles the customer’s <b>organization</b> (found from their phone number in your order sheets). If the number is not known, the customer gets your welcome menu and is asked for their organization when they tap <b>Track my order</b>, <b>Talk to our team</b> or type <b>call</b>; then the chat goes to that organization’s person. It appears in that person’s <b>Mine</b> list from the first message. That person replies, sends voice notes, files and calls from the desk.</div></div>
    <div id="wa-asg-more" ${asg ? '' : 'hidden'}>
      <div class="field"><label>If the customer’s organization is not known, send the chat to</label><select id="wa-hd"><option value="">Nobody yet: ask the customer for their organization (recommended)</option>${agentsOn.map(a => `<option value="${esc(a.id)}" ${a.id === L.handlerId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="chk"><input type="checkbox" id="wa-keep" ${L.keepOwner !== false ? 'checked' : ''}><span>Returning customers stay with their usual person</span></label>
        <div class="hint">A customer who was handled before goes back to the same person. Untick to decide again every time from the customer’s organization.</div></div>
    </div>
    <div class="field"><label class="chk"><input type="checkbox" id="wa-own" ${L.ownOnly !== false ? 'checked' : ''}><span>Team members see only their own chats</span></label>
      <div class="hint">Each person sees just the chats assigned to them. The administrator always sees all chats and can move a chat to someone else.</div></div>
    <div class="field"><label class="chk"><input type="checkbox" id="wa-grp" ${L.groups !== false ? 'checked' : ''}><span>Bring WhatsApp groups into the desk</span></label>
      <div class="hint">Groups your number is in appear in the administrator's <b>Groups</b> page. The administrator assigns each group to a team member, who can then chat and voice-call in it (and nothing else). The welcome bot never answers in a group.</div></div>
    <div class="field"><label class="chk"><input type="checkbox" id="wa-bot" ${L.autoBot ? 'checked' : ''}><span>Send the welcome menu automatically</span></label>
      <div class="hint">The customer gets your greeting and menu straight away (free, no API) and the bot can answer order tracking. It stops by itself as soon as a team member replies. Untick for a plain shared inbox where nobody gets an automatic answer.</div></div></div>`;
  const hook = location.origin + '/webhook';
  let body = '';
  if (w.cloud) {
    body = `<div class="row" style="margin-bottom:10px"><span class="pulse"></span><b>Connected through the official WhatsApp Cloud API</b></div>
      <p class="hint">Your linked phone is paused while <b>With API</b> is selected. Choose <b>Without API</b> above to use your own number (free, no message limits).</p>`;
  } else if (w.state === 'connected') {
    body = `<div class="row" style="margin-bottom:6px"><span class="pulse"></span><b>Connected: +${esc(w.me)}</b></div>
      <p class="hint" style="margin-bottom:12px">This is the number that is on your phone. Everything customers send to it shows up in the inbox, and your team can reply with text, voice notes, photos and files.</p>
      <div class="field"><label class="chk"><input type="checkbox" id="wa-rej" ${L.rejectCalls ? 'checked' : ''}><span>Decline WhatsApp calls with a message</span></label><div class="hint">Off = calls keep ringing on your phone. Either way, a missed or incoming call is written in the chat.</div></div>
      <div class="field" id="wa-cr" ${L.rejectCalls ? '' : 'hidden'}><label>Message sent to a caller</label><textarea id="wa-cm" rows="3">${esc(L.callReply || '')}</textarea></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary sm" id="wa-save">Save</button><button class="btn sm" id="wa-re">Reconnect</button><button class="btn danger sm" id="wa-un">Unlink this number</button></div>`;
  } else {
    const tab = S.waTab || 'qr';
    body = `<div class="row" style="margin-bottom:8px"><span class="pulse demo"></span><b>${w.state === 'connecting' ? 'Reconnecting…' : 'Not linked yet'}</b></div>
      <p class="hint" style="margin-bottom:10px">Use the number that is already on your phone — the same way WhatsApp Web works. No Meta account or access token needed.</p>
      ${w.error ? `<div class="notice" style="margin:0 0 10px">${esc(w.error)}</div>` : ''}
      <div class="tabs" style="padding:0 0 10px;border:0"><button data-wt="qr" class="${tab === 'qr' ? 'on' : ''}">Scan QR code</button><button data-wt="code" class="${tab === 'code' ? 'on' : ''}">Use a code instead</button></div>
      ${w.state === 'qr' && w.qr ? `<div class="waqr"><img src="${w.qr}" alt="QR code" width="260" height="260"></div>
        <ol class="walist"><li>Open <b>WhatsApp</b> on your phone</li><li>Android: ⋮ menu → <b>Linked devices</b> · iPhone: Settings → <b>Linked devices</b></li><li>Tap <b>Link a device</b> and scan this code</li></ol><p class="hint">The code refreshes by itself. If it expires, press Link again.</p>`
      : w.state === 'code' && w.code ? `<div class="wacode">${esc(w.code)}</div>
        <ol class="walist"><li>Open <b>WhatsApp</b> on your phone → <b>Linked devices</b> → <b>Link a device</b></li><li>Tap <b>Link with phone number instead</b></li><li>Type the code above</li></ol>`
      : tab === 'code' ? `<div class="field"><label>Your WhatsApp number (with country code)</label><input type="text" id="wa-ph" placeholder="923001234567" inputmode="numeric"></div>`
      : '<div class="hint" style="margin-bottom:10px">Press the button, then scan the QR code with your phone.</div>'}
      ${w.state === 'starting' || w.state === 'connecting' ? '<div class="hint">Please wait…</div>' : ''}
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="wa-go" ${busy && w.state !== 'qr' && w.state !== 'code' ? 'disabled' : ''}>${ic('link')} ${w.state === 'qr' || w.state === 'code' ? 'Get a new code' : tab === 'code' ? 'Get pairing code' : 'Show QR code'}</button>${w.linked && w.state !== 'qr' && w.state !== 'code' ? '<button class="btn" id="wa-re">Reconnect</button>' : ''}</div>`;
  }
  el.innerHTML = `<div class="h3">WhatsApp connection</div>${sw}${callsBox}${body}${newBox}
    <div class="wanote"><b>Calls:</b> ${w.cloud || w.callsApi ? 'Press <b>Call</b> next to a customer to ring them on WhatsApp from your business number, and incoming WhatsApp calls ring here. Needs Calling switched on for the number, the <b>calls</b> webhook field subscribed in Meta, and the customer\'s permission (the desk can ask them).<div style="margin-top:8px"><button class="btn sm" id="wa-callon">Switch on calling for this number</button></div>' : 'WhatsApp does not let a linked number start or answer its own calls from a computer, so use the desk\'s <b>Voice call</b> button: the customer gets a link in WhatsApp and you talk in the browser (no API). You can also use the <b>Call</b> button (opens your phone / dialer) or <b>WhatsApp</b> button (opens the chat in WhatsApp) next to a customer. Incoming calls are noted in the chat.'}
      ${w.state === 'connected' && !w.ffmpeg ? '<br><b>Voice notes:</b> this server has no ffmpeg, so voice recordings can only be sent in browsers that record MP4/Ogg. The Docker image includes ffmpeg.' : ''}</div>
    <details class="wadet"><summary>Advanced: official Meta WhatsApp Cloud API (optional)</summary>
      <p class="hint" style="margin:8px 0">Needs a Meta developer app. Put WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in the .env file, restart, and add this webhook in Meta (subscribe to <b>messages</b>).</p>
      <div class="field"><label>Callback URL (public https address)</label><input type="text" readonly value="${esc(hook)}" onclick="this.select()"></div>
      <div class="field"><label>Verify token</label><input type="text" readonly value="${esc(S.verifyToken || '')}" onclick="this.select()"></div></details>`;
  const go = async (path, body) => { try { S.wa = await api(path, { method: 'POST', body: body || {} }); S.waMe = S.wa.me || ''; renderWaCard(true); } catch (e) { toast(e.message, true); } };
  $$('[data-wt]', el).forEach(b => b.onclick = () => { S.waTab = b.dataset.wt; if (S.wa && ['qr', 'code'].includes(S.wa.state)) S.wa.state = 'idle'; renderWaCard(true); });
  const g = $('#wa-go', el); if (g) g.onclick = () => { const tab = S.waTab || 'qr'; go('/wa/link', tab === 'code' ? { method: 'code', phone: ($('#wa-ph', el) || {}).value } : { method: 'qr' }); };
  $$('input[name=wa-conn]', el).forEach(r => r.onchange = async () => { try { S.wa = await api('/wa/settings', { method: 'PUT', body: { useApi: r.value === 'api' } }); toast(r.value === 'api' ? 'Now using the official WhatsApp API' : 'Now running without API on your linked number'); renderWaCard(true); } catch (e) { toast(e.message, true); renderWaCard(true); } });
  const ca = $('#wa-calls', el); if (ca) ca.onchange = async () => { try { S.wa = await api('/wa/settings', { method: 'PUT', body: { callsApi: ca.checked } }); toast(ca.checked ? 'Calls now go through the API; chat stays on your linked number' : 'Calls no longer use the API'); renderWaCard(true); } catch (e) { ca.checked = !ca.checked; toast(e.message, true); } };
  const co = $('#wa-callon', el); if (co) co.onclick = async () => { try { await api('/calls/enable', { method: 'POST', body: {} }); toast('Calling switched on'); } catch (e) { toast(e.message, true); } };
  const re = $('#wa-re', el); if (re) re.onclick = () => go('/wa/reconnect');
  const un = $('#wa-un', el); if (un) un.onclick = () => { if (confirm('Unlink this number from the desk? Chats stay in the inbox, but nothing is sent or received until you link a number again.')) go('/wa/unlink'); };
  const rj = $('#wa-rej', el); if (rj) rj.onchange = () => { $('#wa-cr', el).hidden = !rj.checked; };
  const saveNew = async () => { try { S.wa = await api('/wa/settings', { method: 'PUT', body: { assignNew: $('#wa-asg', el).checked, handlerId: $('#wa-hd', el).value, keepOwner: $('#wa-keep', el).checked, ownOnly: $('#wa-own', el).checked, groups: $('#wa-grp', el).checked, autoBot: $('#wa-bot', el).checked } }); toast('Saved'); renderWaCard(true); } catch (e) { toast(e.message, true); renderWaCard(true); } };
  const ag = $('#wa-asg', el); if (ag) { ag.onchange = () => { $('#wa-asg-more', el).hidden = !ag.checked; saveNew(); }; for (const id of ['#wa-hd', '#wa-keep', '#wa-own', '#wa-bot', '#wa-grp']) { const x = $(id, el); if (x) x.onchange = saveNew; } }
  const sv = $('#wa-save', el); if (sv) sv.onclick = async () => { try { S.wa = await api('/wa/settings', { method: 'PUT', body: { rejectCalls: $('#wa-rej', el).checked, callReply: $('#wa-cm', el).value } }); toast('Saved'); renderWaCard(true); } catch (e) { toast(e.message, true); } };
}
