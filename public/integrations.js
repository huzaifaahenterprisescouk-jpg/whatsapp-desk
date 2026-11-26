// Integrations: connect any ERP (admin only).  PULL from its address, let it PUSH orders with an API key, and send it WEBHOOKS on status changes.
let ERPS = null;
const when = t => t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';
const copyText = async (t, msg) => { try { await navigator.clipboard.writeText(t); toast(msg || 'Copied'); } catch { toast('Could not copy — select the text and copy it', true); } };

async function viewIntegrations() {
  $('#main').innerHTML = `<div class="page">${pageHead('Integrations', 'Connect your ERP (or any system that has orders). Its orders appear in Overview, Company report and Order tracking, and customers get their status on WhatsApp.', `<button class="btn primary" id="erp-add">${ic('plus')} Connect an ERP</button>`)}<div id="erp-body"><div class="hint">Loading…</div></div></div>`;
  $('#erp-add').onclick = () => erpEdit(null);
  await erpLoad();
}
async function erpLoad() {
  try { ERPS = await api('/integrations/erp'); } catch (e) { const b = $('#erp-body'); if (b) b.innerHTML = `<div class="card pad">${esc(e.message)}</div>`; return; }
  erpDraw();
}
function erpDraw() {
  const b = $('#erp-body'); if (!b || !ERPS) return; const E = ERPS, P = E.push;
  const state = c => c.lastError ? `<span class="pill" style="background:var(--red-soft);color:var(--red)">Problem</span>` : !c.enabled ? '<span class="pill">Paused</span>' : c.lastSync ? '<span class="pill green">Connected</span>' : '<span class="pill">Not synced yet</span>';
  b.innerHTML = `
  <div class="card pad" style="margin-bottom:16px"><div class="h3">1 · Read orders from your ERP <span class="hint" style="font-weight:500">(pull)</span></div>
    <div class="hint" style="margin-bottom:10px">The desk asks your ERP for its orders every few minutes. Works with any system that has a web address (REST / JSON / OData) or a CSV export link — ERPNext, Odoo, SAP, Dynamics, Zoho, your own software …</div>
    ${E.connections.length ? E.connections.map(c => `<div class="card pad erp-c" data-id="${c.id}" style="margin-bottom:10px;background:var(--surface-2)">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div><b style="font-size:15px">${esc(c.name)}</b> ${state(c)}<div class="hint" style="margin-top:2px;word-break:break-all">${esc(c.url.replace(/\?.*$/, '')) || '—'} · every ${c.minutes} min · ${c.orders.toLocaleString()} orders · last sync ${when(c.lastSync)}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-a="sync">${ic('play')} Sync now</button><button class="btn sm" data-a="edit">${ic('edit')} Edit</button><button class="btn sm" data-a="pause">${c.enabled ? 'Pause' : 'Resume'}</button><button class="btn sm danger" data-a="del">${ic('trash')}</button></div></div>
      ${c.lastError ? `<div class="notice" style="margin:8px 0 0;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(c.lastError)}</div>` : ''}</div>`).join('')
      : `<div class="empty" style="padding:22px"><div><div class="big">${ic('bolt')}</div><b>No ERP connected yet</b><div class="hint" style="margin-top:4px">Press <b>Connect an ERP</b>, choose your system and paste its address.</div></div></div>`}</div>

  <div class="card pad" style="margin-bottom:16px"><div class="h3">2 · Let your ERP send orders <span class="hint" style="font-weight:500">(Push API)</span></div>
    <div class="hint" style="margin-bottom:10px">Give the address and key below to whoever looks after your ERP. Each time an order is created or changes, the ERP sends it here and it shows up within a second. The same key lets the ERP read the orders back.</div>
    <div class="field"><label>Address (POST)</label><div class="row" style="gap:6px"><input type="text" readonly value="${esc(E.pushUrl)}" id="erp-pu" style="flex:1"><button class="btn sm" data-copy="erp-pu">Copy</button></div></div>
    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <span>${P.hasKey ? (P.enabled ? '<span class="pill green">On</span>' : '<span class="pill">Off</span>') : '<span class="pill">No key yet</span>'}</span>
      ${P.hasKey ? `<span class="hint">Key <code>${esc(P.hint)}</code> · last received ${when(P.last)} · ${P.total.toLocaleString()} orders from the ERP</span>` : ''}
      <button class="btn sm primary" id="erp-key">${ic('plus')} ${P.hasKey ? 'Make a new key' : 'Create API key'}</button>
      ${P.hasKey ? `<button class="btn sm" id="erp-pon">${P.enabled ? 'Turn off' : 'Turn on'}</button><button class="btn sm danger" id="erp-pdel">Delete key</button>` : ''}</div>
    ${P.lastError ? `<div class="notice" style="margin:0 0 10px;background:var(--red-soft);color:var(--red)">Last request failed: ${esc(P.lastError)}</div>` : ''}
    <details><summary class="hint" style="cursor:pointer">What the ERP sends (example)</summary>
      <pre class="erp-code" id="erp-ex">curl -X POST "${esc(E.pushUrl)}" \\
  -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"company":"BAFL","orders":[
        {"po":"366809","pr":"4500123","cn":"7788991","status":"Dispatched","courier":"TCS",
         "customer":"Head Office","order_date":"2026-11-12"}]}'</pre>
      <div class="hint">Field names are recognised automatically (po, po_no, "PO Number", cn, tracking, status, customer, order_date …). Orders are matched by PO / P.R / CN, so sending the same order again updates it. Add <code>"mode":"replace"</code> to make the list exactly what you send. To read orders back: <code>GET ${esc(E.pushUrl.replace('/push', '/orders'))}</code> with the same key (<code>?since=</code> and <code>?status=</code> filters).</div>
      <button class="btn sm" data-copy="erp-ex" style="margin-top:6px">Copy example</button></details></div>

  <div class="card pad"><div class="h3">3 · Tell your ERP when a status changes <span class="hint" style="font-weight:500">(webhooks)</span></div>
    <div class="hint" style="margin-bottom:10px">When someone here changes an order's status, the desk sends it to your ERP — JSON by default, or your own request body. Signed with <code>X-Desk-Signature</code> (HMAC-SHA256) if you set a secret.</div>
    ${E.hooks.map(h => `<div class="card pad erp-h" data-id="${h.id}" style="margin-bottom:10px;background:var(--surface-2)"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div><b>${esc(h.name)}</b> ${h.enabled ? '' : '<span class="pill">Paused</span>'}<div class="hint" style="word-break:break-all">${h.method} ${esc(h.url)} · last ${h.lastAt ? when(h.lastAt) + (h.lastStatus ? ' → ' + h.lastStatus : ' → failed') : 'never'}</div></div>
      <div class="row" style="gap:6px"><button class="btn sm" data-a="test">Send test</button><button class="btn sm" data-a="edit">${ic('edit')} Edit</button><button class="btn sm danger" data-a="del">${ic('trash')}</button></div></div>${h.lastError ? `<div class="notice" style="margin:8px 0 0;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(h.lastError)}</div>` : ''}</div>`).join('')}
    <button class="btn sm" id="erp-hadd">${ic('plus')} Add a webhook</button></div>`;

  b.onclick = async e => {
    const cp = e.target.closest('[data-copy]'); if (cp) { const el = $('#' + cp.dataset.copy); return copyText(el.value || el.textContent); }
    const row = e.target.closest('.erp-c'), hrow = e.target.closest('.erp-h'), btn = e.target.closest('button[data-a]');
    try {
      if (row && btn) {
        const id = row.dataset.id, c = E.connections.find(x => x.id === id), a = btn.dataset.a;
        if (a === 'edit') return erpEdit(c);
        if (a === 'pause') { await api('/integrations/erp/' + id, { method: 'PUT', body: { enabled: !c.enabled } }); return erpLoad(); }
        if (a === 'del') { if (await gconfirm(`Remove "${c.name}" and its ${c.orders.toLocaleString()} orders from the desk? (Your ERP is not touched.)`)) { await api('/integrations/erp/' + id, { method: 'DELETE' }); toast('Connection removed'); erpLoad(); } return; }
        if (a === 'sync') { btn.disabled = true; btn.textContent = 'Syncing…'; try { const r = await api(`/integrations/erp/${id}/sync`, { method: 'POST', body: {} }); toast(`${r.count.toLocaleString()} orders read from ${c.name}`); } catch (err) { toast(err.message, true); } return erpLoad(); }
      }
      if (hrow && btn) {
        const id = hrow.dataset.id, h = E.hooks.find(x => x.id === id), a = btn.dataset.a;
        if (a === 'edit') return erpHook(h);
        if (a === 'del') { if (await gconfirm(`Remove the webhook "${h.name}"?`)) { await api('/integrations/hooks/' + id, { method: 'DELETE' }); erpLoad(); } return; }
        if (a === 'test') { btn.disabled = true; const r = await api(`/integrations/hooks/${id}/test`, { method: 'POST', body: {} }); toast(r.ok ? 'Your ERP answered OK' : 'Your ERP did not accept it — see the red message', !r.ok); return erpLoad(); }
      }
    } catch (err) { toast(err.message, true); }
  };
  $('#erp-hadd', b).onclick = () => erpHook(null);
  $('#erp-key', b).onclick = async () => {
    if (P.hasKey && !await gconfirm('Make a new key? The old key stops working at once — update your ERP with the new one.')) return;
    try {
      const r = await api('/integrations/push/key', { method: 'POST', body: {} });
      modal(`<h3>${ic('bolt')} Your API key</h3><p class="hint" style="margin:-8px 0 12px">Copy it now and give it to your ERP. For safety it is <b>shown only once</b>.</p><input type="text" readonly id="kk" value="${esc(r.key)}" style="font-family:monospace;width:100%"><div class="acts"><button class="btn" id="kc">Copy key</button><button class="btn primary" id="kd">Done</button></div>`, (bg, close) => { $('#kk', bg).select(); $('#kc', bg).onclick = () => copyText(r.key, 'Key copied'); $('#kd', bg).onclick = () => { close(); erpLoad(); }; });
    } catch (e) { toast(e.message, true); }
  };
  const pon = $('#erp-pon', b); if (pon) pon.onclick = async () => { try { await api('/integrations/push', { method: 'PUT', body: { enabled: !P.enabled } }); erpLoad(); } catch (e) { toast(e.message, true); } };
  const pdel = $('#erp-pdel', b); if (pdel) pdel.onclick = async () => { if (await gconfirm('Delete the key? Your ERP can no longer send orders until you create a new one.')) { try { await api('/integrations/push', { method: 'PUT', body: { removeKey: true } }); erpLoad(); } catch (e) { toast(e.message, true); } } };
}

// ---------- add / edit a connection ----------
function erpEdit(c) {
  const E = ERPS, isNew = !c, st = c ? { ...c, headersText: Object.entries(c.headers || {}).map(([k, v]) => k + ': ' + v).join('\n'), pg: c.next ? 'next' : c.pageParam ? 'page' : 'none' } : { name: '', kind: 'rest', url: '', method: 'GET', body: '', listPath: '', next: '', auth: 'bearer', map: {}, minutes: 15, company: '', headersText: '', pg: 'none', has: {}, pageParam: '', sizeParam: '', pageSize: '' };
  let found = null;
  const FIELDS = E.fields.filter(f => ['orderId', 'po', 'pr', 'cn', 'status', 'customer', 'phone', 'organization', 'courier', 'orderDate', 'notes'].includes(f.key));
  modal(`<h3>${ic('bolt')} ${isNew ? 'Connect an ERP' : 'Edit ' + esc(c.name)}</h3><div id="ee" class="erp-form"></div>`, (bg, close) => {
    bg.querySelector('.modal').style.maxWidth = '720px';
    const draw = () => {
      const a = st.auth, mapOpts = key => `<option value="">Auto-detect</option><option value="-" ${st.map[key] === '-' ? 'selected' : ''}>— not in my ERP —</option>${[...new Set([...(found ? found.fields : []), ...(st.map[key] && st.map[key] !== '-' ? [st.map[key]] : [])])].map(f => `<option ${st.map[key] === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}`;
      $('#ee', bg).innerHTML = `
      ${isNew ? `<div class="field"><label>Which system?</label><select id="e-pre">${E.presets.filter(p => p.kind !== 'none').map(p => `<option value="${p.id}" ${st.preset === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select><div class="hint" id="e-ph">${esc((E.presets.find(p => p.id === st.preset) || {}).hint || 'Pick your system to pre-fill the settings, or choose “Any REST / JSON API”.')}</div></div>` : ''}
      <div class="grid g2" style="gap:10px"><div class="field"><label>Name</label><input type="text" id="e-name" value="${esc(st.name)}" placeholder="e.g. ERPNext"></div>
        <div class="field"><label>Company name for these orders <span class="hint">(if the ERP has no company field)</span></label><input type="text" id="e-co" value="${esc(st.company)}" placeholder="e.g. BAFL"></div></div>
      <div class="field"><label>${st.kind === 'csv' ? 'Address of the CSV file' : 'Address that returns the orders'}</label><div class="row" style="gap:6px">${st.kind === 'csv' ? '' : `<select id="e-m" style="width:auto"><option ${st.method === 'GET' ? 'selected' : ''}>GET</option><option ${st.method === 'POST' ? 'selected' : ''}>POST</option></select>`}<input type="text" id="e-url" value="${esc(st.url)}" placeholder="https://your-erp.example.com/api/orders" style="flex:1"></div></div>
      ${st.method === 'POST' && st.kind !== 'csv' ? `<div class="field"><label>Request body (JSON)</label><textarea id="e-body" rows="3" style="font-family:monospace">${esc(st.body)}</textarea></div>` : ''}
      <div class="grid g2" style="gap:10px"><div class="field"><label>How does it sign in?</label><select id="e-auth">${[['none', 'No sign-in'], ['bearer', 'Bearer token / API key'], ['basic', 'Username + password'], ['header', 'Custom header'], ['query', 'Key in the address']].map(([k, l]) => `<option value="${k}" ${a === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div>${a === 'bearer' ? `<div class="field"><label>Token ${st.has.token ? '<span class="hint">(saved — leave empty to keep)</span>' : ''}</label><input type="password" id="e-tok" autocomplete="off" placeholder="${st.has.token ? '••••••••' : 'Paste the token'}"></div>` : ''}
          ${a === 'basic' ? `<div class="grid g2" style="gap:8px"><div class="field"><label>Username</label><input type="text" id="e-usr" value="${esc(st.user || '')}"></div><div class="field"><label>Password ${st.has.pass ? '<span class="hint">(saved)</span>' : ''}</label><input type="password" id="e-pw" autocomplete="off" placeholder="${st.has.pass ? '••••••••' : ''}"></div></div>` : ''}
          ${a === 'header' || a === 'query' ? `<div class="grid g2" style="gap:8px"><div class="field"><label>${a === 'header' ? 'Header name' : 'Parameter name'}</label><input type="text" id="e-an" value="${esc(st.authName || '')}" placeholder="${a === 'header' ? 'Authorization' : 'api_key'}"></div><div class="field"><label>Value ${st.has.authValue ? '<span class="hint">(saved)</span>' : ''}</label><input type="password" id="e-av" autocomplete="off" placeholder="${st.has.authValue ? '••••••••' : ''}"></div></div>` : ''}</div></div>
      <details ${st.listPath || st.pg !== 'none' || st.headersText ? 'open' : ''}><summary class="hint" style="cursor:pointer;margin-bottom:8px">More settings (where the list is, several pages, extra headers, how often)</summary>
        ${st.kind === 'csv' ? '' : `<div class="field"><label>The list of orders is at <span class="hint">(leave empty if the answer itself is the list; e.g. data, value, d.results)</span></label><input type="text" id="e-lp" value="${esc(st.listPath)}"></div>
        <div class="grid g2" style="gap:10px"><div class="field"><label>More than one page?</label><select id="e-pg"><option value="none" ${st.pg === 'none' ? 'selected' : ''}>No, one answer has everything</option><option value="page" ${st.pg === 'page' ? 'selected' : ''}>Page number in the address</option><option value="next" ${st.pg === 'next' ? 'selected' : ''}>The answer gives the next address</option></select></div>
          <div>${st.pg === 'page' ? `<div class="grid g2" style="gap:8px"><div class="field"><label>Page parameter</label><input type="text" id="e-pp" value="${esc(st.pageParam || 'page')}"></div><div class="field"><label>Page size</label><input type="number" id="e-ps" value="${esc(st.pageSize || 100)}"></div></div>` : ''}${st.pg === 'next' ? `<div class="field"><label>Next address is at</label><input type="text" id="e-nx" value="${esc(st.next || '@odata.nextLink')}"></div>` : ''}</div></div>
        <div class="field"><label>Extra headers <span class="hint">(one per line: Name: value)</span></label><textarea id="e-hd" rows="2" style="font-family:monospace">${esc(st.headersText)}</textarea></div>`}
        <div class="field"><label>Read it again every</label><select id="e-min">${[5, 10, 15, 30, 60, 240, 1440].map(m => `<option value="${m}" ${+st.minutes === m ? 'selected' : ''}>${m < 60 ? m + ' minutes' : m === 60 ? 'hour' : m < 1440 ? m / 60 + ' hours' : 'day'}</option>`).join('')}</select></div></details>
      <div class="row" style="gap:8px;margin:6px 0 12px"><button class="btn" id="e-test">${ic('play')} Test connection</button><span class="hint" id="e-tr">Reads the first page only — nothing is saved.</span></div>
      <div id="e-found">${found ? foundHtml() : ''}</div>
      <div class="acts"><button class="btn" id="e-cx">Cancel</button><button class="btn primary" id="e-sv">${isNew ? 'Save &amp; read orders' : 'Save'}</button></div>`;
      wire();
    };
    const foundHtml = () => `<div class="card pad" style="background:var(--surface-2);margin-bottom:12px"><b>${found.count.toLocaleString()} record${found.count === 1 ? '' : 's'} found</b> <span class="hint">in the first page</span>
      <div class="hint" style="margin:8px 0 6px">Match your ERP's fields to the desk. “Auto-detect” works when the names are common (po, status, customer …).</div>
      <div class="grid g2" style="gap:8px">${FIELDS.map(f => `<div class="field" style="margin:0"><label>${esc(f.label.replace(/ \(.*\)/, ''))}</label><select data-map="${f.key}">${(key => `<option value="">Auto-detect</option><option value="-" ${st.map[key] === '-' ? 'selected' : ''}>— not in my ERP —</option>${[...new Set([...found.fields, ...(st.map[key] && st.map[key] !== '-' ? [st.map[key]] : [])])].map(x => `<option ${st.map[key] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}`)(f.key)}</select></div>`).join('')}</div>
      <div class="hint" style="margin:10px 0 4px">What the desk will make of the first records:</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Company</th><th>Customer</th><th>Status</th><th>Group</th><th>Date</th></tr></thead><tbody>${found.preview.map(o => `<tr><td><b>${esc(o.po || o.orderId)}</b></td><td>${esc(o.company)}</td><td>${esc(o.customer || '—')}</td><td>${esc(o.status)}</td><td>${esc(o.class)}</td><td>${esc(o.day || '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">No usable record — choose the PO / Order ID field above.</td></tr>'}</tbody></table></div></div>`;
    const read = () => { // form -> st
      const g = id => { const e = $(id, bg); return e ? e.value : undefined; };
      if (g('#e-name') !== undefined) st.name = g('#e-name'); if (g('#e-co') !== undefined) st.company = g('#e-co'); if (g('#e-url') !== undefined) st.url = g('#e-url').trim();
      if (g('#e-m') !== undefined) st.method = g('#e-m'); if (g('#e-body') !== undefined) st.body = g('#e-body'); if (g('#e-auth') !== undefined) st.auth = g('#e-auth');
      for (const [id, k] of [['#e-tok', 'token'], ['#e-pw', 'pass'], ['#e-av', 'authValue']]) if (g(id)) st['new_' + k] = g(id); // only when something is typed (a re-drawn empty field must not erase it)
      if (g('#e-usr') !== undefined) st.user = g('#e-usr'); if (g('#e-an') !== undefined) st.authName = g('#e-an');
      if (g('#e-lp') !== undefined) st.listPath = g('#e-lp').trim(); if (g('#e-pg') !== undefined) st.pg = g('#e-pg'); if (g('#e-pp') !== undefined) st.pageParam = g('#e-pp'); if (g('#e-ps') !== undefined) st.pageSize = g('#e-ps'); if (g('#e-nx') !== undefined) st.next = g('#e-nx');
      if (g('#e-hd') !== undefined) st.headersText = g('#e-hd'); if (g('#e-min') !== undefined) st.minutes = +g('#e-min');
      bg.querySelectorAll('[data-map]').forEach(s => { if (s.value) st.map[s.dataset.map] = s.value; else delete st.map[s.dataset.map]; });
    };
    const body = () => {
      const headers = {}; for (const l of (st.headersText || '').split('\n')) { const m = /^\s*([\w-]+)\s*:\s*(.+)$/.exec(l); if (m) headers[m[1]] = m[2].trim(); }
      const b = { name: st.name, company: st.company, kind: st.kind, preset: st.preset || '', url: st.url, method: st.method, body: st.body, auth: st.auth, user: st.user, authName: st.authName, listPath: st.listPath, map: st.map, headers, minutes: st.minutes,
        next: st.pg === 'next' ? st.next : '', pageParam: st.pg === 'page' ? st.pageParam || 'page' : '', pageSize: st.pg === 'page' ? st.pageSize : '', sizeParam: '' };
      for (const k of ['token', 'pass', 'authValue']) if (st['new_' + k]) b[k] = st['new_' + k];
      return b;
    };
    const wire = () => {
      const pre = $('#e-pre', bg);
      if (pre) { pre.onchange = () => { const p = E.presets.find(x => x.id === pre.value); Object.assign(st, { preset: p.id, kind: p.kind || 'rest', url: p.url || '', method: p.method || 'GET', body: p.body || '', listPath: p.listPath || '', next: p.next || '', auth: p.auth || 'none', authName: p.authName || '', map: { ...(p.map || {}) }, pg: p.next ? 'next' : 'none' }); if (!st.name || E.presets.some(x => x.label === st.name || x.label.startsWith(st.name))) st.name = p.label.split(' (')[0].split(' / ')[0]; found = null; draw(); }; }
      for (const id of ['#e-auth', '#e-pg', '#e-m']) { const e = $(id, bg); if (e) e.onchange = () => { read(); draw(); }; }
      $('#e-cx', bg).onclick = close;
      $('#e-test', bg).onclick = async () => {
        read(); const b = $('#e-test', bg), out = $('#e-tr', bg); b.disabled = true; out.textContent = 'Connecting…';
        try { found = await api(`/integrations/erp/${isNew ? 'new' : st.id}/test`, { method: 'POST', body: body() }); draw(); $('#e-tr', bg).textContent = 'Connected.'; }
        catch (e) { b.disabled = false; out.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
      };
      $('#e-sv', bg).onclick = async () => {
        read(); const b = $('#e-sv', bg); b.disabled = true;
        try {
          const saved = await api(isNew ? '/integrations/erp' : '/integrations/erp/' + st.id, { method: isNew ? 'POST' : 'PUT', body: body() });
          if (isNew || st.url !== c.url) { try { const r = await api(`/integrations/erp/${saved.id}/sync`, { method: 'POST', body: {} }); toast(`Saved — ${r.count.toLocaleString()} orders read`); } catch (e) { toast('Saved, but the first read failed: ' + e.message, true); } } else toast('Saved');
          close(); erpLoad();
        } catch (e) { toast(e.message, true); b.disabled = false; }
      };
    };
    if (isNew) { const p = E.presets[0]; st.preset = p.id; }
    draw();
  });
}

// ---------- webhook ----------
function erpHook(h) {
  const st = h || { name: '', url: '', method: 'POST', body: '', authName: '', hasAuth: false, hasSecret: false, enabled: true };
  modal(`<h3>${ic('send')} ${h ? 'Edit webhook' : 'Add a webhook'}</h3>
    <p class="hint" style="margin:-8px 0 12px">Sent when someone changes an order's <b>status</b> here.</p>
    <div class="field"><label>Name</label><input type="text" id="h-n" value="${esc(st.name)}" placeholder="e.g. Update ERP"></div>
    <div class="field"><label>Address</label><div class="row" style="gap:6px"><select id="h-m" style="width:auto">${['POST', 'PUT', 'PATCH'].map(m => `<option ${st.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select><input type="text" id="h-u" value="${esc(st.url)}" placeholder="https://your-erp.example.com/hooks/order-status" style="flex:1"></div></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Header name <span class="hint">(optional)</span></label><input type="text" id="h-an" value="${esc(st.authName)}" placeholder="Authorization"></div><div class="field"><label>Header value ${st.hasAuth ? '<span class="hint">(saved)</span>' : ''}</label><input type="password" id="h-av" autocomplete="off" placeholder="${st.hasAuth ? '••••••••' : 'Bearer …'}"></div></div>
    <div class="field"><label>Signing secret ${st.hasSecret ? '<span class="hint">(saved — leave empty to keep)</span>' : '<span class="hint">(optional)</span>'}</label><input type="password" id="h-s" autocomplete="off"></div>
    <div class="field"><label>Your own request body <span class="hint">(optional — leave empty to send the standard JSON)</span></label><textarea id="h-b" rows="3" style="font-family:monospace" placeholder='{"so":"{{orderId}}","state":"{{status}}"}'>${esc(st.body)}</textarea><div class="hint">You can use {{orderId}} {{po}} {{pr}} {{cn}} {{status}} {{class}} {{courier}} {{customer}} {{company}} {{by}}</div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const b = { name: $('#h-n', bg).value, url: $('#h-u', bg).value, method: $('#h-m', bg).value, authName: $('#h-an', bg).value, authValue: $('#h-av', bg).value, secret: $('#h-s', bg).value, body: $('#h-b', bg).value };
      try { await api(h ? '/integrations/hooks/' + h.id : '/integrations/hooks', { method: h ? 'PUT' : 'POST', body: b }); close(); toast('Webhook saved'); erpLoad(); } catch (e) { toast(e.message, true); }
    };
  });
}
