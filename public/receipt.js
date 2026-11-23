/* Tracking receipt: pick / type any courier shipment and open a printable courier-style tracking page (with a Delivered section). */
const RC_FIELDS = [['url', 'Courier tracking address (filled in automatically)'], ['cn', 'CN / tracking number', 1], ['courier', 'Courier'], ['status', 'Current status'], ['curWhen', 'Status date & time'], ['origin', 'Origin'], ['destination', 'Destination'], ['shipper', 'Shipper'], ['consignee', 'Consignee'], ['ref', 'Reference No.'], ['booking', 'Booking date'], ['pieces', 'Pieces'], ['deliveredOn', 'Delivered on'], ['receivedBy', 'Received by']];
function rcFrom(r) {
  r = r || {}; const det = l => { const x = (r.details || []).find(([k]) => l.test(k)); return x ? x[1] : ''; };
  const delivered = /deliver/i.test(r.status || '') && !/undeliver|not deliver/i.test(r.status || '');
  return {
    cn: r.cn || '', courier: r.courier || '', status: r.status || '', curWhen: r.updated || '', url: r.trackUrl && /^https?:/.test(r.trackUrl) ? r.trackUrl : '', origin: '', destination: det(/destination|city|branch|address/i), shipper: r.organization || r.company || '', consignee: r.customer || '',
    ref: [r.po && 'PO ' + r.po, r.pr && 'P.R ' + r.pr].filter(Boolean).join(' / ') || r.orderId || '', booking: r.day || '', pieces: det(/piece|qty|quantity/i), deliveredOn: delivered ? (r.updated || '') : '', receivedBy: r.receivedBy || '',
  };
}
function openReceipt(r) {
  const v = rcFrom(r);
  modal(`<h3>Tracking receipt</h3><p class="hint" style="margin-bottom:6px">The page reads the courier's live tracking for the CN. If the courier site cannot be read, fill the details and paste the history by hand.</p><div id="rc-live" class="hint" style="margin-bottom:10px;font-weight:700"></div>
    <div class="grid g2" style="gap:10px">${RC_FIELDS.map(([k, l, req]) => `<div class="field" ${k === 'cn' || k === 'url' ? 'style="grid-column:1/-1"' : ''}><label>${l}${req ? ' *' : ''}</label><input id="rc-${k}" value="${esc(v[k])}" autocomplete="off"></div>`).join('')}</div>
    <div class="field" style="margin-top:10px"><label>Tracking history <span class="hint">(one line each:  18 November 2026, 02:19 | Shipment dispatched from KARACHI to ISLAMABAD)</span></label><textarea id="rc-events" rows="6" style="font-family:monospace;font-size:12.5px" placeholder="18 November 2026, 02:19 | Shipment dispatched from KARACHI to ISLAMABAD"></textarea></div>
    <div class="acts">${r && r.trackUrl && /^https?:/.test(r.trackUrl) ? `<a class="btn" href="${esc(r.trackUrl)}" target="_blank" rel="noopener">${ic('link')} Courier website</a>` : ''}<button class="btn" id="rc-fetch">${ic('refresh')} Fetch live now</button><button class="btn" id="cx">Cancel</button><button class="btn primary" id="rc-go">${ic('print')} Open printable page</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    const cnEl = $('#rc-cn', bg), evEl = $('#rc-events', bg); let lastCn = '';
    const loadEv = async () => { const cn = cnEl.value.trim(); if (!cn || cn === lastCn) return; lastCn = cn; try { const e = await api('/track/events?cn=' + encodeURIComponent(cn)); if (e.text && !evEl.value.trim()) evEl.value = e.text; } catch {} };
    const live = $('#rc-live', bg), setL = (t, bad) => { live.textContent = t; live.style.color = bad ? '#c5221f' : '#17694a'; };
    const fetchLive = async () => {
      const cn = cnEl.value.trim(), co = $('#rc-courier', bg).value.trim(); if (!cn) return setL('Enter the CN first.', true);
      setL('Reading live tracking from the courier…'); $('#rc-fetch', bg).disabled = true;
      try {
        const L = await api('/track/live?fresh=1&cn=' + encodeURIComponent(cn) + '&courier=' + encodeURIComponent(co) + '&url=' + encodeURIComponent($('#rc-url', bg).value.trim()));
        if (L.url && !$('#rc-url', bg).value.trim()) $('#rc-url', bg).value = L.url;
        if (!L.ok) return setL(L.error + (L.sample && L.sample.length ? '  (page text: ' + L.sample.slice(0, 6).join(' / ').slice(0, 160) + ')' : ''), true);
        for (const [k, val] of Object.entries(L.fields || {})) { const el = $('#rc-' + k, bg); if (el && val && !/^[-–—]+$/.test(val)) el.value = val; }
        if (L.eventsText) evEl.value = L.eventsText;
        setL('Live from the courier — ' + new Date().toLocaleTimeString() + ' · ' + (L.events || []).length + ' history line(s)');
      } catch (e) { setL(e.message, true); } finally { $('#rc-fetch', bg).disabled = false; }
    };
    $('#rc-fetch', bg).onclick = fetchLive;
    cnEl.onchange = () => { loadEv(); };
    loadEv(); if (cnEl.value.trim() && $('#rc-courier', bg).value.trim()) fetchLive();
    $('#rc-go', bg).onclick = async () => {
      const d = {}; for (const [k] of RC_FIELDS) d[k] = $('#rc-' + k, bg).value.trim(); d.events = evEl.value;
      if (!d.cn) { toast('Enter the CN / tracking number', true); return cnEl.focus(); }
      const w = window.open('', '_blank'); // opened first so the browser does not block it
      try { await api('/track/events', { method: 'PUT', body: { cn: d.cn, text: d.events } }); } catch {}
      const u = '/api/track/receipt?token=' + encodeURIComponent(S.token) + '&d=' + encodeURIComponent(JSON.stringify(d));
      if (w) w.location.href = u; else window.location.href = u;
      close();
    };
  });
}
