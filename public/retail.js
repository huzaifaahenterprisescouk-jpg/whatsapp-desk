/* Retail shops page: accounts (from QuickBooks exports or created in WhatsApp), data files, regions (loaded after app.js) */
const RFILES = {
  accounts: ['Customer list', 'QuickBooks → Reports → Customer Contact List → Export. Needs an <b>Account No</b> column (the number a shop types in WhatsApp) and <b>Customer</b>. Optional: Phone, Bill to, City, State/Region, Open Balance.'],
  products: ['Products / price list', 'QuickBooks → Products and Services → Export. Needs <b>Product</b>; optional Price, Category, SKU, <b>Region</b> (Sindh, Punjab… or All) or an Account No for shop-specific prices.'],
  invoices: ['Open invoices', 'QuickBooks → Reports → Open Invoices → Export. Needs <b>Customer</b> (or Account No); optional Date, Num, Due Date, Open Balance, Amount.'],
};
const rmoney = n => n === null || n === undefined ? '—' : `${S.retail.config.currency ? S.retail.config.currency + ' ' : ''}${(+n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

async function viewRetail() {
  S.retail = await api('/retail'); S.rq = S.rq || ''; S.rreg = S.rreg || ''; S.rsrc = S.rsrc || '';
  const R = S.retail, ad = isAdmin(), t = encodeURIComponent(S.token), regions = R.config.regions;
  $('#main').innerHTML = `<div class="page">${pageHead('Retail shops', R.scoped ? `You see only your own region${regions.length === 1 ? '' : 's'}: ${regions.map(g => g.name).join(', ') || 'none yet'}. Other regions’ shops, balances and invoices are hidden from you.` : 'Each shop gets an account number. It sends it in WhatsApp and sees its details, price list, balance and orders. New shops can register themselves.',
      `${ad ? `<button class="btn" id="rcfg">${ic('cog')} Regions & settings</button><a class="btn" href="/api/retail/export?which=pending&token=${t}">${ic('down')} New shops (QuickBooks CSV)</a>` : ''}`)}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="l">${ic('org')} Shops from QuickBooks</div><div class="v">${R.counts.file}</div><div class="s">in the customer list</div></div>
      <div class="card kpi"><div class="l">${ic('plus')} Registered in WhatsApp</div><div class="v">${R.counts.chat}</div><div class="s">new shops</div></div>
      <div class="card kpi"><div class="l">${ic('bolt')} Waiting for approval</div><div class="v" style="color:${R.counts.pending ? 'var(--amber)' : 'inherit'}">${R.counts.pending}</div><div class="s">new accounts to review</div></div>
      <div class="card kpi"><div class="l">${ic('box')} Regions</div><div class="v">${regions.length}</div><div class="s">${esc(regions.map(g => g.name).join(', '))}</div></div>
    </div>
    ${ad ? qboCard(R.qbo) : ''}
    ${ad ? `<div class="h3" style="margin:6px 0 10px">Data from QuickBooks <span class="hint" style="font-weight:500">(export to Excel or CSV, then upload or link it)</span></div><div class="grid g3" id="rfiles" style="margin-bottom:18px">${Object.keys(RFILES).map(k => fileCard(k, R.files[k])).join('')}</div>` : ''}
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap"><div class="search" style="flex:1;min-width:220px">${ic('search')}<input type="search" id="rqs" placeholder="Search account no, shop, phone, address" value="${esc(S.rq)}"></div>
      <select id="rrg" style="width:auto"><option value="">All regions</option>${regions.map(g => `<option ${S.rreg === g.name ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <select id="rsr" style="width:auto">${[['', 'All shops'], ['qbo', 'From QuickBooks Online'], ['file', 'From QuickBooks file'], ['chat', 'Registered in WhatsApp'], ['pending', 'Waiting for approval']].map(([v, l]) => `<option value="${v}" ${S.rsrc === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Account no</th><th>Shop</th><th>Region</th><th>Phone</th><th>Address</th><th>Balance</th><th>Source</th><th></th></tr></thead><tbody id="rbody"></tbody></table></div></div></div>`;
  const rows = () => {
    const q = S.rq.toLowerCase(), l = R.accounts.filter(a => (!S.rreg || a.region === S.rreg) && (!S.rsrc || (S.rsrc === 'pending' ? a.status === 'pending' : a.source === S.rsrc)) && (!q || [a.id, a.name, a.contact, a.phone, a.address, a.city].join(' ').toLowerCase().includes(q))).slice(0, 400);
    $('#rbody').innerHTML = l.map(a => `<tr data-id="${esc(a.id)}"><td><b>${esc(a.id)}</b></td><td><b>${esc(a.name)}</b>${a.contact ? `<div class="hint">${esc(a.contact)}</div>` : ''}</td><td>${a.region ? `<span class="pill violet">${esc(a.region)}</span>` : '—'}</td><td>${esc(a.phone || '—')}</td>
      <td class="hint" style="max-width:260px">${esc([a.address, a.city].filter(Boolean).join(', '))}</td><td>${rmoney(a.balance)}</td>
      <td>${a.source === 'qbo' ? '<span class="pill green">QuickBooks Online</span>' : a.source === 'file' ? '<span class="pill blue">QuickBooks file</span>' : a.status === 'pending' ? '<span class="pill amber">New · pending</span>' : '<span class="pill green">New · approved</span>'}${a.source === 'chat' ? (a.qb ? '<div class="hint">✓ in QuickBooks</div>' : a.qbError ? `<div class="hint" style="color:var(--red)" title="${esc(a.qbError)}">QuickBooks error</div>` : '') : ''}</td>
      <td style="text-align:right;white-space:nowrap">${ad && a.source === 'chat' ? `${a.status === 'pending' ? '<button class="btn sm primary" data-ap="1">Approve</button>' : ''}<button class="btn sm ghost" data-ed="1">Edit</button><button class="btn sm ghost danger" data-rm="1">${ic('trash')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty" style="padding:30px">No shops yet. ${ad ? 'Upload your QuickBooks customer list above.' : ''}</div></td></tr>`;
  };
  rows();
  $('#rqs').oninput = e => { S.rq = e.target.value; rows(); }; $('#rrg').onchange = e => { S.rreg = e.target.value; rows(); }; $('#rsr').onchange = e => { S.rsrc = e.target.value; rows(); };
  if (!ad) return;
  $('#rcfg').onclick = retailSettings; if ($('#qbbtn')) $('#qbbtn').onclick = qboSetup;
  $('#rbody').onclick = async e => {
    const tr = e.target.closest('tr'); if (!tr) return; const a = R.accounts.find(x => x.id === tr.dataset.id); if (!a) return;
    try {
      if (e.target.closest('[data-ap]')) { await api('/retail/accounts/' + encodeURIComponent(a.id), { method: 'PATCH', body: { status: 'approved' } }); toast(`${a.name} approved`); viewRetail(); }
      if (e.target.closest('[data-ed]')) editShop(a);
      if (e.target.closest('[data-rm]') && confirm(`Delete ${a.name} (${a.id})? Its account number stops working.`)) { await api('/retail/accounts/' + encodeURIComponent(a.id), { method: 'DELETE' }); viewRetail(); }
    } catch (err) { toast(err.message, true); }
  };
  const box = $('#rfiles');
  box.onchange = async e => { const k = e.target.dataset.rfile; if (!k || !e.target.files[0]) return; try { const r = await api(`/retail/files/${k}/upload`, { method: 'POST', raw: await e.target.files[0].arrayBuffer() }); toast(`${r.count} rows loaded`); viewRetail(); } catch (err) { toast(err.message, true); } };
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const card = b.closest('[data-k]'), k = card.dataset.k, a = b.dataset.a;
    try {
      if (a === 'save') { b.disabled = true; const f = await api('/retail/files/' + k, { method: 'PUT', body: { url: $('[data-f=url]', card).value, minutes: $('[data-f=minutes]', card).value } }); toast(f.lastError ? 'Saved, but the file could not be read — see the red message' : 'Saved', !!f.lastError); viewRetail(); }
      if (a === 'sync') { b.disabled = true; b.textContent = 'Syncing…'; try { const r = await api(`/retail/files/${k}/sync`, { method: 'POST' }); toast(`${r.count} rows loaded`); } catch (err) { toast(err.message, true); } viewRetail(); }
      if (a === 'clear' && confirm('Remove the loaded ' + RFILES[k][0].toLowerCase() + '?')) { await api(`/retail/files/${k}/clear`, { method: 'POST' }); viewRetail(); }
    } catch (err) { toast(err.message, true); b.disabled = false; }
  };
}

function fileCard(k, f) {
  const on = !!f.url, pill = f.lastError ? '<span class="pill red">Problem</span>' : f.loaded ? `<span class="pill green">${f.loaded} rows${on ? ' · live ' + ago(f.lastSync) : ''}</span>` : '<span class="pill">Not loaded</span>';
  return `<div class="card pad" data-k="${k}"><div class="row" style="justify-content:space-between;margin-bottom:6px"><b>${RFILES[k][0]}</b>${pill}</div>
    <div class="hint" style="margin-bottom:10px;min-height:54px">${RFILES[k][1]}</div>
    ${f.lastError ? `<div class="notice" style="margin:0 0 10px;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(f.lastError)}</div>` : ''}
    ${on ? '' : `<label class="drop" for="rf_${k}" style="padding:12px">${ic('up')}<b>Upload .xlsx or .csv</b><input type="file" id="rf_${k}" data-rfile="${k}" accept=".xlsx,.csv" hidden></label><div class="hint" style="text-align:center;margin:8px 0">or link a file:</div>`}
    <div class="row" style="flex-wrap:wrap;gap:8px"><input type="text" data-f="url" style="flex:1;min-width:140px" placeholder="OneDrive link or /sheets/file.xlsx" value="${esc(f.url)}"><select data-f="minutes" style="width:auto">${[5, 15, 30, 60, 240].map(n => `<option value="${n}" ${n === f.minutes ? 'selected' : ''}>${n < 60 ? n + ' min' : n / 60 + ' h'}</option>`).join('')}</select></div>
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn sm primary" data-a="save">Save link</button>${on ? '<button class="btn sm" data-a="sync">Sync now</button>' : ''}${f.loaded || on ? '<button class="btn sm danger" data-a="clear">Remove</button>' : ''}</div></div>`;
}

function editShop(a) {
  modal(`<h3>Edit ${esc(a.id)}</h3>${[['name', 'Shop name'], ['contact', 'Contact person'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City']].map(([k, l]) => `<div class="field"><label>${l}</label><input type="text" data-k="${k}" value="${esc(a[k] || '')}"></div>`).join('')}
    <div class="field"><label>Region</label><select data-k="region">${S.retail.config.regions.map(g => `<option ${g.name === a.region ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
    <p class="hint">Changing the region does not change the account number.</p><div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => { const body = {}; $$('[data-k]', bg).forEach(i => body[i.dataset.k] = i.value); try { await api('/retail/accounts/' + encodeURIComponent(a.id), { method: 'PATCH', body }); close(); toast('Saved'); viewRetail(); } catch (e) { toast(e.message, true); } };
  });
}

function retailSettings() {
  const c = S.retail.config; let regions = c.regions.map(g => ({ ...g, aliases: (g.aliases || []).join(', ') }));
  modal(`<div id="rsbody"></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '640px';
    const body = $('#rsbody', bg);
    const draw = () => {
      body.innerHTML = `<h3>Regions & settings</h3>
        <p class="hint" style="margin:-8px 0 12px">New shops get an account number like <b>${esc($('#rpre', body) ? $('#rpre', body).value : c.prefix)}-${esc((regions[0] || {}).code || 'SD')}-0001</b>. The region decides the price list a shop sees and who answers its chat.</p>
        <div class="grid g2" style="gap:12px"><div class="field"><label>Account number prefix</label><input type="text" id="rpre" maxlength="5" value="${esc($('#rpre', body) ? $('#rpre', body).value : c.prefix)}"></div>
          <div class="field"><label>Currency shown</label><input type="text" id="rcur" maxlength="6" value="${esc($('#rcur', body) ? $('#rcur', body).value : c.currency)}"></div></div>
        <div class="field"><label>Regions <span class="hint">(name · code in the account number · other names, comma separated · handled by)</span></label>
          ${regions.map((g, i) => `<div class="row" style="gap:6px;margin-bottom:6px" data-i="${i}"><input type="text" data-r="name" value="${esc(g.name)}" style="flex:1.2" placeholder="Sindh"><input type="text" data-r="code" value="${esc(g.code)}" style="width:62px" maxlength="4" placeholder="SD"><input type="text" data-r="aliases" value="${esc(g.aliases)}" style="flex:1.3" placeholder="karachi, hyderabad">
            <select data-r="agentId" style="flex:1">${agentOptions(g.agentId, '— Anyone —')}</select><button class="btn sm ghost danger" data-rm="${i}" title="Remove">${ic('trash')}</button></div>`).join('')}
          ${regions.length < 10 ? `<button class="btn sm" id="radd">${ic('plus')} Add region</button>` : ''}</div>
        <label class="row" style="gap:8px;margin-bottom:6px"><input type="checkbox" id="rauto" ${(($('#rauto', body) || {}).checked ?? c.autoApprove) ? 'checked' : ''}> Approve new shops automatically <span class="hint">(otherwise they wait in the list until you press Approve; they can use their account number straight away either way)</span></label>
        <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`;
      $('#cx', body).onclick = close;
      $('#radd', body) && ($('#radd', body).onclick = () => { grab(); regions.push({ name: '', code: '', aliases: '', agentId: '' }); draw(); });
      $$('[data-rm]', body).forEach(b => b.onclick = () => { grab(); regions.splice(+b.dataset.rm, 1); draw(); });
      $('#sv', body).onclick = async () => { grab(); try { S.retail.config = await api('/retail/config', { method: 'PUT', body: { regions, prefix: $('#rpre', body).value, currency: $('#rcur', body).value, autoApprove: $('#rauto', body).checked } }); close(); toast('Saved'); viewRetail(); } catch (e) { toast(e.message, true); } };
    };
    const grab = () => { $$('[data-i]', body).forEach(r => { const g = regions[+r.dataset.i]; $$('[data-r]', r).forEach(i => g[i.dataset.r] = i.value); }); };
    draw();
  });
}


// ---------- QuickBooks Online (live) ----------
function qboCard(q) {
  q = q || {};
  return `<div class="card pad" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div><div class="h3" style="margin:0">QuickBooks Online <span class="hint" style="font-weight:500">(live — customers, products, invoices; new shops are created in QuickBooks)</span></div>
    <div class="hint" style="margin-top:4px">${q.connected ? `Connected${q.company ? ' to <b>' + esc(q.company) + '</b>' : ''} · last sync ${ago(q.lastSync)} · ${q.counts.customers} customers, ${q.counts.products} products, ${q.counts.invoices} open invoices${q.unsent ? ` · <b>${q.unsent}</b> new shop${q.unsent === 1 ? '' : 's'} not in QuickBooks yet` : ''}` : 'Using QuickBooks Desktop or Excel? Upload the exports below. Using QuickBooks Online? Connect it here so everything stays in step.'}</div>
    ${q.lastError ? `<div class="notice" style="margin:8px 0 0;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(q.lastError)}</div>` : ''}</div>
    <div class="row">${q.connected ? '<span class="pill green">Connected</span>' : '<span class="pill">Not connected</span>'}<button class="btn ${q.connected ? '' : 'primary'}" id="qbbtn">${q.connected ? 'Manage' : 'Connect'}</button></div></div></div>`;
}

function qboSetup() {
  modal(`<div id="qbbody"></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '600px';
    const body = $('#qbbody', bg); let q = null;
    const draw = () => {
      const redirect = q.redirectUri || location.origin + '/qbo/callback';
      body.innerHTML = `<h3>QuickBooks Online</h3>
        <p class="hint" style="margin:-8px 0 14px">Reads your customers, products and open invoices, and creates every shop that registers in WhatsApp as a new QuickBooks customer (name, phone, address, region and its account number in the Notes). It never deletes or edits your existing customers.</p>
        <div class="grid g2" style="gap:12px"><div class="field"><label>Client ID</label><input type="text" id="qci" value="${esc(q.clientId)}" spellcheck="false"></div>
          <div class="field"><label>Client secret</label><input type="password" id="qcs" placeholder="${q.hasSecret ? '•••••••• (leave blank to keep)' : ''}" autocomplete="new-password"></div>
          <div class="field"><label>Keys are for</label><select id="qen"><option value="sandbox" ${q.env === 'sandbox' ? 'selected' : ''}>Sandbox (test company)</option><option value="production" ${q.env === 'production' ? 'selected' : ''}>Production (your real books)</option></select></div>
          <div class="field"><label>Refresh every</label><select id="qmin">${[5, 15, 30, 60, 240].map(n => `<option value="${n}" ${n === q.minutes ? 'selected' : ''}>${n < 60 ? n + ' min' : n / 60 + ' h'}</option>`).join('')}</select></div></div>
        <div class="field"><label>Redirect URI <span class="hint">(add this exact address in your Intuit app → Keys &amp; credentials → Redirect URIs)</span></label><input type="text" id="qru" value="${esc(redirect)}" onclick="this.select()"></div>
        <label class="row" style="gap:8px;margin-bottom:8px"><input type="checkbox" id="qap" ${q.autoPush ? 'checked' : ''}> Create new WhatsApp shops in QuickBooks automatically</label>
        ${q.lastError ? `<div class="notice" style="margin:0 0 12px;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(q.lastError)}</div>` : ''}
        <div class="acts" style="justify-content:space-between;flex-wrap:wrap"><div class="row">${q.connected ? '<button class="btn danger" id="qdis">Disconnect</button>' : ''}</div>
          <div class="row"><button class="btn" id="cx">Close</button><button class="btn" id="qsv">Save</button>${q.connected ? `<button class="btn" id="qsy">Sync now</button>${q.unsent ? '<button class="btn" id="qpu">Send waiting shops</button>' : ''}` : ''}<button class="btn primary" id="qcn">${q.connected ? 'Reconnect' : 'Connect QuickBooks'}</button></div></div>
        <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700;font-size:13px">How do I get the Client ID and secret? (5 minutes, free)</summary>
          <ol class="hint" style="margin:10px 0 0 18px;line-height:1.7">
            <li>Sign in at <b>developer.intuit.com</b> with the Intuit account that owns your QuickBooks → <b>Dashboard → Create an app</b> → <b>QuickBooks Online and Payments</b> → scope <b>Accounting</b>.</li>
            <li>Open the app → <b>Keys &amp; credentials</b>. Copy the <b>Client ID</b> and <b>Client secret</b> (the Development tab = Sandbox, the Production tab = your real books).</li>
            <li>Under <b>Redirect URIs</b> add the address shown above and Save. Intuit only accepts <b>https</b> addresses for Production (or http://localhost for testing), so use your public https address.</li>
            <li>Paste the keys here, pick Sandbox or Production, press <b>Save</b>, then <b>Connect QuickBooks</b> and approve with the QuickBooks company you want.</li>
            <li><b>Account numbers:</b> shops created in QuickBooks get <b>QB-&lt;id&gt;</b> automatically. To use your own numbers, write <b>Account No: YOURNO</b> in the customer's Notes field in QuickBooks.</li>
            <li><b>Region:</b> taken from the customer's billing State/Province, or City (Karachi → Sindh, Lahore → Punjab…, see Regions &amp; settings).</li>
            <li><b>QuickBooks Desktop?</b> It has no cloud connection. Export the customer list, price list and open invoices to Excel/CSV and upload them below; "New shops (QuickBooks CSV)" gives you a file to import back.</li></ol></details>`;
      $('#cx', body).onclick = () => { close(); viewRetail(); };
      const save = async () => { q = await api('/qbo', { method: 'PUT', body: { clientId: $('#qci', body).value, clientSecret: $('#qcs', body).value, env: $('#qen', body).value, minutes: $('#qmin', body).value, autoPush: $('#qap', body).checked, redirectUri: $('#qru', body).value } }); };
      $('#qsv', body).onclick = async () => { try { await save(); draw(); toast('Saved'); } catch (e) { toast(e.message, true); } };
      $('#qcn', body).onclick = async () => { try { await save(); const r = await api('/qbo/connect', { method: 'POST', body: { origin: location.origin } }); location.href = r.url; } catch (e) { toast(e.message, true); } };
      const act = (id, path, msg) => { const b = $(id, body); if (b) b.onclick = async () => { b.disabled = true; try { await api(path, { method: 'POST' }); toast(msg); } catch (e) { toast(e.message, true); } q = await api('/qbo'); draw(); }; };
      act('#qsy', '/qbo/sync', 'QuickBooks data refreshed'); act('#qpu', '/qbo/push', 'Waiting shops sent to QuickBooks');
      if ($('#qdis', body)) $('#qdis', body).onclick = async () => { if (confirm('Disconnect QuickBooks? Shops already loaded stay until the next refresh.')) { q = await api('/qbo/disconnect', { method: 'POST' }); draw(); } };
    };
    api('/qbo').then(r => { q = r; draw(); }).catch(e => { toast(e.message, true); close(); });
  });
}
