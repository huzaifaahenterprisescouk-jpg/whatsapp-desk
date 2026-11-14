/* Desktop notifications like WhatsApp Web: a pop-up for every new customer message and for incoming voice calls,
   a number in the browser tab title, and a soft sound. Loaded last; hooks into the live events of app.js / call.js / webcall.js.
   Browsers only allow this on https:// addresses (or localhost) and after the person presses "Turn on". */
(function () {
  const can = () => 'Notification' in window;
  const seen = new Set();
  let callNote = null, soundCtx = null;

  function beep() {   // a short double "pling" (not for calls: those use the ringing tone)
    try {
      soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.16].forEach((d, i) => { const o = soundCtx.createOscillator(), g = soundCtx.createGain(); o.type = 'sine'; o.frequency.value = i ? 1046 : 784; o.connect(g); g.connect(soundCtx.destination);
        const t = soundCtx.currentTime + d; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.start(t); o.stop(t + 0.3); });
    } catch {}
  }
  function show(title, body, tag, onclick, sticky) {
    if (!can() || Notification.permission !== 'granted') return null;
    try {
      const n = new Notification(title, { body, tag, renotify: true, requireInteraction: !!sticky, silent: true });
      n.onclick = () => { try { window.focus(); n.close(); } catch {} if (onclick) onclick(); };
      if (!sticky) setTimeout(() => { try { n.close(); } catch {} }, 8000);
      return n;
    } catch { return null; }
  }
  function openChat(phone) {
    try {
      S.view = 'inbox'; location.hash = 'inbox'; document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'inbox'));
      renderView(); if (phone) openConv(phone);
    } catch {}
  }
  const away = phone => document.hidden || !document.hasFocus() || S.view !== 'inbox' || S.sel !== phone;

  // ---- new customer message ----
  window.deskNotifyMessage = function (m) {
    try {
      if (!m || m.dir !== 'in' || seen.has(m.id)) return; seen.add(m.id); if (seen.size > 300) seen.delete(seen.values().next().value);
      if (S.sim && S.sim.phone === m.phone) return;
      const c = S.convs.find(x => x.phone === m.phone);
      if (!c || !(c.agentId === S.me.id || c.status === 'waiting')) return;
      if (!away(m.phone)) return;
      const what = m.text ? m.text : m.media ? '📎 ' + (m.media.voice ? 'Voice message' : m.media.mime && /^image/.test(m.media.mime) ? 'Photo' : 'File') : 'New message';
      const who = (c.name && c.name !== c.phone ? c.name : '+' + c.phone) + (c.agentId === S.me.id ? '' : ' (waiting for an agent)');
      beep(); show(who, String(what).slice(0, 140), 'msg-' + m.phone, () => openChat(m.phone));
    } catch {}
  };

  // ---- incoming voice calls (web link and WhatsApp API calls) ----
  function callPop(c, mine) {
    if (mine) return;
    const who = (c.name && c.name !== c.phone ? c.name : '+' + c.phone);
    if (callNote) { try { callNote.close(); } catch {} }
    callNote = show('📞 Incoming voice call', who + ' is calling. Click to answer.', 'call', () => openChat(c.phone), true);
  }
  const endPop = () => { if (callNote) { try { callNote.close(); } catch {} callNote = null; } };
  const wrapEvt = (name, mineFn) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = function (c) {
      try {
        if (c && c.event === 'ring' && !(typeof Call !== 'undefined' && Call.state)) callPop(c, mineFn(c));
        else if (c && (c.event === 'end' || c.event === 'taken')) endPop();
      } catch {}
      return orig.apply(this, arguments);
    };
  };
  wrapEvt('onWebCallEvent', c => typeof WC !== 'undefined' && WC.state === 'waiting' && WC.phone === c.phone);
  wrapEvt('onCallEvent', () => false);

  // ---- number in the tab title: (3) WhatsApp Desk ----
  const baseTitle = document.title || 'WhatsApp Desk';
  const _ub = window.updateBadges;
  if (typeof _ub === 'function') window.updateBadges = function () {
    const r = _ub.apply(this, arguments);
    try { const n = S.convs.filter(c => c.status === 'waiting' || (c.agentId === S.me.id && c.unread > 0)).length; document.title = (n ? '(' + n + ') ' : '') + baseTitle; } catch {}
    return r;
  };

  // ---- the "Turn on desktop notifications" bar (browsers need a click to allow them) ----
  function bar() {
    if (!can() || Notification.permission !== 'default' || localStorage.getItem('wd_notify_no') || document.getElementById('notifybar')) return;
    const d = document.createElement('div'); d.id = 'notifybar';
    d.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;background:#111b21;color:#fff;border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.3);font:14px system-ui,sans-serif;max-width:min(92vw,420px)';
    d.innerHTML = '<span>🔔 Get a pop-up on your desktop for new messages and calls?</span><button id="nb-on" style="background:#25d366;color:#06281a;border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer">Turn on</button><button id="nb-no" title="Not now" style="background:transparent;color:#9fb0b8;border:0;cursor:pointer;font-size:18px">×</button>';
    document.body.appendChild(d);
    d.querySelector('#nb-on').onclick = async () => { try { await Notification.requestPermission(); } catch {} d.remove(); if (Notification.permission === 'granted') { beep(); show('Notifications are on', 'You will see new messages and calls here.', 'hello'); } };
    d.querySelector('#nb-no').onclick = () => { localStorage.setItem('wd_notify_no', '1'); d.remove(); };
  }
  setInterval(() => { try { if (typeof S !== 'undefined' && S.me) bar(); } catch {} }, 4000);
})();
