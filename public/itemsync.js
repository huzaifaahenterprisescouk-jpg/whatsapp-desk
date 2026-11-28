/* DC items sync (administrator): tell the desk where the items of ALL your DCs live (an Excel / CSV / Google sheet, an uploaded file, or your ERP).
   The desk reads it on a schedule and every DC in Company report shows its items by itself. No item is typed or pasted by hand. */
let ISY = null, isyPoll = 0;
const isyWhen = t => t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';
const isyKind = { sheet: 'Sheet link', upload: 'Uploaded file', erp: 'ERP list', lookup: 'ERP lookup (per DC)' };
const goItemSync = () => { S.view = 'itemsync'; location.hash = 'itemsync'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'itemsync')); renderView(); };

async function viewItemSync() {
  clearTimeout(isyPoll);
  $('#main').innerHTML = `<div class="page">${pageHead('DC items sync', 'Tell the desk where the items of your DCs are (a sheet, an uploaded file or your ERP). It reads them by itself and every DC in Company report shows its items. Nothing to add by hand.',
    `<button class="btn" id="isy-all">${ic('play')} Read all now</button><button class="btn primary" id="isy-add">${ic('plus')} Add source</button>`)}<div id="isy-body"><div class="hint">Loading…</div></div></div>`;
  $('#isy-add').onclick = () => isyEdit(null);
  $('#isy-all').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; let n = 0, bad = 0;
    for (const s of (ISY && ISY.sources || []).filter(x => x.enabled && x.kind !== 'lookup' && (x.kind === 'upload' ? x.hasFile : x.url))) { try { await api(`/itemsync/sources/${s.id}/sync`, { method: 'POST', body: {} }); n++; } catch (er) { bad++; toast(`${s.name}: ${er.message}`, true); } }
    b.disabled = false; if (n || !bad) toast(n ? `${n} source${n === 1 ? '' : 's'} read` : 'Add a source first'); isyLoad();
  };
  await isyLoad();
}
async function isyLoad() {
  try { ISY = await api('/itemsync'); } catch (e) { const b = $('#isy-body'); if (b) b.innerHTML = `<div class="card pad">${esc(e.message)}</div>`; return; }
  isyDraw(); clearTimeout(isyPoll);
  if (ISY.job && ISY.job.running && S.view === 'itemsync') isyPoll = setTimeout(isyLoad, 2500);
}
function isyDraw() {
  const b = $('#isy-body'); if (!b || !ISY) return; const E = ISY, C = E.coverage, st = E.settings, pc = C.total ? Math.round(C.matched * 100 / C.total) : 0;
  const stat = (n, l, c) => `<div class="card pad" style="text-align:left"><div style="font-size:26px;font-weight:800;color:${c || 'var(--ink)'}">${n}</div><div class="hint">${l}</div></div>`;
  const state = s => s.lastError ? `<span class="pill red">Problem</span>` : !s.enabled ? '<span class="pill">Paused</span>' : s.lastSync ? '<span class="pill green">Reading</span>' : '<span class="pill">Not read yet</span>';
  const j = E.job;
  b.innerHTML = `
  <div class="grid g4" style="gap:12px;margin-bottom:16px">${stat(C.total.toLocaleString(), 'DCs in the desk')}${stat(C.matched.toLocaleString(), `DCs with items · ${pc}%`, 'var(--brand)')}${stat((C.total - C.matched).toLocaleString(), 'DCs without items', C.total - C.matched ? 'var(--amber)' : '')}${stat(E.items.toLocaleString(), 'Item rows read')}</div>
  ${C.total ? `<div class="card pad" style="margin-bottom:16px"><div style="height:10px;border-radius:99px;background:var(--line);overflow:hidden"><div style="height:100%;width:${pc}%;background:var(--brand)"></div></div>
    <div class="hint" style="margin-top:8px">Found by: <b>DC no</b> ${C.via.dc.toLocaleString()} · <b>PO no</b> ${C.via.po.toLocaleString()} · <b>P.R no</b> ${C.via.pr.toLocaleString()}${C.via.erp ? ` · <b>ERP</b> ${C.via.erp.toLocaleString()}` : ''}.
    The numbers in your sheet match this many of your DCs: by DC no <b>${C.avail.dc.toLocaleString()}</b>, by PO no <b>${C.avail.po.toLocaleString()}</b>, by P.R no <b>${C.avail.pr.toLocaleString()}</b>. If one of them is much higher than the others, that is the column to trust.</div></div>` : ''}

  <div class="card pad" style="margin-bottom:16px"><div class="h3">1 · Where are the items? <span class="hint" style="font-weight:500">(sources)</span></div>
    <div class="hint" style="margin-bottom:10px">Every tab of an Excel file is read. A row is recognised by its heading (<i>Item / Description / Name of items</i>, <i>Qty</i>, <i>Unit</i>, <i>Price</i>) and tied to its DC by the <i>DC no</i>, <i>PO no</i> or <i>P.R / Req no</i> written on the row, or in the <i>DC # / PO # / REQ #</i> lines above an invoice-style table. The sheet is read again every few minutes, so new DCs fill in by themselves.</div>
    ${!E.msSignedIn && E.sources.some(s => s.kind === 'sheet') ? `<div class="notice" style="margin:0 0 10px">OneDrive / SharePoint links usually need a Microsoft sign-in (Order tracking page → Microsoft sign-in). Or use <b>Upload a file</b> below: it works without any sign-in.</div>` : ''}
    ${E.sources.length ? E.sources.map(s => `<div class="card pad isy-s" data-id="${s.id}" style="margin-bottom:10px;background:var(--surface-2)">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="min-width:0"><b style="font-size:15px">${esc(s.name)}</b> ${state(s)} <span class="pill">${isyKind[s.kind]}</span> ${s.doc === 'dc' ? '<span class="pill">DC sheet</span>' : s.doc === 'bill' ? '<span class="pill">Bill sheet</span>' : ''}
        <div class="hint" style="margin-top:2px;word-break:break-all">${s.kind === 'upload' ? esc(s.uploadedName || 'no file yet') : esc((s.url || '—').replace(/\?.*$/, ''))}${s.kind === 'lookup' ? '' : ` · every ${s.minutes} min`} · ${s.kind === 'lookup' ? `${s.items.toLocaleString()} DCs fetched` : `${s.items.toLocaleString()} item rows${s.dcs ? ` · ${s.dcs.toLocaleString()} DC nos` : ''}`} · last read ${isyWhen(s.lastSync)}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-a="sync" ${s.kind !== 'lookup' && (s.kind === 'upload' ? !s.hasFile : !s.url) ? 'disabled' : ''}>${ic('play')} ${s.kind === 'lookup' ? 'Fetch for all DCs' : 'Read now'}</button>${s.kind === 'upload' ? `<label class="btn sm" style="cursor:pointer">${ic('up')} ${s.hasFile ? 'Replace file' : 'Upload file'}<input type="file" data-a="file" accept=".xlsx,.xlsm,.csv,.txt" hidden></label>` : ''}<button class="btn sm" data-a="edit">${ic('edit')} Edit</button><button class="btn sm" data-a="pause">${s.enabled ? 'Pause' : 'Resume'}</button><button class="btn sm danger" data-a="del">${ic('trash')}</button></div></div>
      ${s.lastError ? `<div class="notice" style="margin:8px 0 0;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(s.lastError)}</div>` : ''}
      ${s.tabsInfo && s.tabsInfo.length ? `<details style="margin-top:8px"><summary class="hint" style="cursor:pointer">What was found in each tab (${s.tabsInfo.length})</summary><div class="tbl-wrap" style="margin-top:6px"><table class="tbl"><thead><tr><th>Tab</th><th>Used for</th><th>Rows</th><th>Items</th><th>Columns the desk used</th></tr></thead><tbody>${s.tabsInfo.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${t.doc === 'dc' ? 'Print DC' : t.doc === 'bill' ? 'Print bill' : t.items ? 'both' : ''}</td><td>${(t.rows || 0).toLocaleString()}</td><td>${t.items ? `<b>${t.items.toLocaleString()}</b>` : '—'}</td><td class="hint" style="white-space:normal">${esc(t.cols || '')}${t.note ? `<div style="color:var(--amber)">${esc(t.note)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
      ${s.kind === 'lookup' && j.total ? `<div class="hint" style="margin-top:8px">${j.running ? `Fetching… ${j.done.toLocaleString()} of ${j.total.toLocaleString()} DCs · ${j.found.toLocaleString()} with items${j.errors ? ` · ${j.errors} failed` : ''} <button class="btn sm" data-a="stop">Stop</button>` : `Last run: ${j.done.toLocaleString()} DCs asked, ${j.found.toLocaleString()} with items${j.errors ? `, ${j.errors} failed` : ''}.`}</div>` : ''}</div>`).join('')
      : `<div class="empty" style="padding:22px"><div><div class="big">${ic('box')}</div><b>No source yet</b><div class="hint" style="margin-top:4px">Press <b>Add source</b> and give the link of your items sheet (or upload it). Your DCs get their items within a minute.</div></div></div>`}</div>

  <div class="card pad" style="margin-bottom:16px"><div class="h3">2 · How a DC is matched to its items</div>
    <div class="hint" style="margin-bottom:10px">The desk tries these in order and uses the first one that finds items for that DC.</div>
    <div class="row" style="gap:18px;flex-wrap:wrap"><label class="row" style="gap:6px"><input type="checkbox" data-m="dc" ${st.match.dc ? 'checked' : ''}> DC no</label><label class="row" style="gap:6px"><input type="checkbox" data-m="po" ${st.match.po ? 'checked' : ''}> PO no</label><label class="row" style="gap:6px"><input type="checkbox" data-m="pr" ${st.match.pr ? 'checked' : ''}> P.R / Req no</label></div>
    <div class="row" style="gap:18px;flex-wrap:wrap;margin-top:10px"><label class="row" style="gap:6px"><input type="checkbox" data-s="checkCompany" ${st.checkCompany ? 'checked' : ''}> Company must agree <span class="hint">(a number that belongs to another company is ignored)</span></label>
      <label class="row" style="gap:6px"><input type="checkbox" data-s="fillDown" ${st.fillDown ? 'checked' : ''}> A DC no written once above its items applies to the rows below it</label></div></div>

  <div class="card pad" style="margin-bottom:16px"><div class="h3">3 · Check one DC</div>
    <div class="hint" style="margin-bottom:8px">Type a DC, PO or P.R number to see what the desk found for it, and why it has no items.</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" id="isy-q" placeholder="e.g. 63423" style="max-width:260px"><button class="btn" id="isy-go">${ic('search')} Check</button></div><div id="isy-r" style="margin-top:10px"></div>
    ${C.missing.length ? `<details style="margin-top:12px"><summary class="hint" style="cursor:pointer">DCs without items (${(C.total - C.matched).toLocaleString()}) · first ${C.missing.length}</summary><div class="tbl-wrap" style="margin-top:6px"><table class="tbl"><thead><tr><th>DC no</th><th>PO</th><th>P.R</th><th>Company</th></tr></thead><tbody>${C.missing.map(m => `<tr data-q="${esc(m.dc)}" style="cursor:pointer"><td><b>${esc(m.dc)}</b></td><td>${esc(m.po)}</td><td>${esc(m.pr)}</td><td>${esc(m.company)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</div>`;

  b.insertAdjacentHTML('beforeend', `<div class="card pad" id="lh-card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div><div class="h3" style="margin:0">4 · Letterheads <span class="hint" style="font-weight:500">(Print bill / Print DC)</span></div><div class="hint">Each company can print on its own letterhead: name, address, NTN, GST, phone, logo, stamp, bank details and notes. A company with no letterhead of its own uses the Default.</div></div><button class="btn primary" id="lh-add">${ic('plus')} Add letterhead</button></div><div id="lh-list" style="margin-top:10px"><div class="hint">Loading…</div></div></div>`);
  lhLoad(); $('#lh-add').onclick = () => lhEdit(null);
  b.onchange = async e => {
    const t = e.target; if (!t.matches || !t.matches('[data-m],[data-s]')) return;
    const body = t.dataset.m ? { match: { [t.dataset.m]: t.checked } } : { [t.dataset.s]: t.checked };
    try { ISY = await api('/itemsync/settings', { method: 'PUT', body }); toast('Saved'); isyDraw(); } catch (er) { toast(er.message, true); }
  };
  const check = async q => {
    const out = $('#isy-r'); if (!q.trim()) return; out.innerHTML = '<div class="hint">Checking…</div>';
    try {
      const r = await api('/itemsync/check', { method: 'POST', body: { q } }), kn = { dc: 'DC no', po: 'PO no', pr: 'P.R no' };
      const hits = ['dc', 'po', 'pr'].map(k => r.hits[k].length ? `<div class="hint"><b>${kn[k]} ${esc(r.key)}</b> is written in: ${r.hits[k].map(h => `${esc(h.src)} → tab “${esc(h.tab)}” (${h.n} item${h.n === 1 ? '' : 's'}${h.company ? ', ' + esc(h.company) : ''})`).join('; ')}</div>` : '').join('');
      out.innerHTML = (r.orders.length ? r.orders.map(o => `<div class="card pad" style="margin-bottom:6px;background:var(--surface-2)"><b>DC ${esc(o.dc || '—')}</b> · PO ${esc(o.po || '—')} · P.R ${esc(o.pr || '—')} · ${esc(o.company)}${o.branch ? ' · branch ' + esc(o.branch) : ''}<div style="margin-top:2px">${o.found ? `<span class="pill green">${o.found} items</span> found by ${esc(o.viaLabel)}` : '<span class="pill amber">No items</span>'}</div></div>`).join('') : '<div class="hint">No DC in the desk has this number.</div>')
        + (hits || '<div class="hint">This number is not written in any source.</div>') + (!r.orders.some(o => o.found) && hits ? '<div class="hint" style="color:var(--amber);margin-top:4px">The number is in a source but the DC still shows nothing: the company or branch code on that row differs from the DC, or that way of matching is switched off above.</div>' : '');
    } catch (er) { out.innerHTML = `<div class="notice" style="margin:0;background:var(--red-soft);color:var(--red)">${esc(er.message)}</div>`; }
  };
  $('#isy-go').onclick = () => check($('#isy-q').value); $('#isy-q').onkeydown = e => { if (e.key === 'Enter') check(e.target.value); };
  b.onclick = async e => {
    const tr = e.target.closest('tr[data-q]'); if (tr) { $('#isy-q').value = tr.dataset.q; return check(tr.dataset.q); }
    const row = e.target.closest('.isy-s'), btn = e.target.closest('button[data-a]'); if (!row || !btn) return;
    const id = row.dataset.id, s = E.sources.find(x => x.id === id), a = btn.dataset.a;
    try {
      if (a === 'edit') return isyEdit(s);
      if (a === 'pause') { await api('/itemsync/sources/' + id, { method: 'PUT', body: { enabled: !s.enabled } }); return isyLoad(); }
      if (a === 'stop') { await api('/itemsync/lookup-stop', { method: 'POST', body: {} }); return isyLoad(); }
      if (a === 'del') { if (await gconfirm(`Remove "${s.name}"? Its items disappear from the Company report (your sheet / ERP is not touched).`)) { await api('/itemsync/sources/' + id, { method: 'DELETE' }); toast('Source removed'); isyLoad(); } return; }
      if (a === 'sync') {
        btn.disabled = true; btn.textContent = 'Reading…';
        try { const r = await api(`/itemsync/sources/${id}/${'sync'}`, { method: 'POST', body: {} }); toast(r.started ? `Fetching ${r.total.toLocaleString()} DCs…` : r.unchanged ? 'Nothing changed' : `${r.items.toLocaleString()} item rows read for ${r.dcs.toLocaleString()} DCs`); } catch (er) { toast(er.message, true); }
        return isyLoad();
      }
    } catch (er) { toast(er.message, true); }
  };
  b.addEventListener('change', async e => {
    const i = e.target; if (!i.matches || !i.matches('input[data-a=file]')) return; const f = i.files[0]; i.value = ''; if (!f) return;
    const row = i.closest('.isy-s'); try { toast('Reading ' + f.name + '…'); const r = await api(`/itemsync/sources/${row.dataset.id}/upload?name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: f }); toast(`${r.items.toLocaleString()} item rows read for ${r.dcs.toLocaleString()} DCs`); } catch (er) { toast(er.message, true); } isyLoad();
  });
}

// ---- add / edit one source ----
function isyEdit(src) {
  const st = src || { doc: 'both', name: '', kind: 'sheet', url: '', minutes: 15, company: '', tabs: '', cols: {}, format: 'json', method: 'GET', body: '', listPath: '', itemsPath: '', next: '', auth: 'none', user: '', authName: '', has: {} };
  const isNew = !src; let file = null;
  modal(`<h3>${ic('box')} ${isNew ? 'Add a source of DC items' : 'Edit “' + esc(st.name) + '”'}</h3><div id="ise"></div>`, (bg, close) => {
    const root = $('#ise', bg); $('.modal', bg).style.maxWidth = '720px';
    const read = () => { const g = id => { const el = $('#' + id, root); return el ? el.value : undefined; };
      Object.assign(st, { doc: g('ie-doc') ?? st.doc, name: g('ie-n') ?? st.name, kind: g('ie-k') ?? st.kind, url: g('ie-u') ?? st.url, minutes: g('ie-m') ?? st.minutes, company: g('ie-co') ?? st.company, tabs: g('ie-t') ?? st.tabs, format: g('ie-f') ?? st.format, method: g('ie-me') ?? st.method, body: g('ie-b') ?? st.body,
        listPath: g('ie-lp') ?? st.listPath, itemsPath: g('ie-ip') ?? st.itemsPath, next: g('ie-nx') ?? st.next, auth: g('ie-a') ?? st.auth, user: g('ie-us') ?? st.user, authName: g('ie-an') ?? st.authName });
      st.cols = Object.fromEntries(['dc', 'po', 'pr', 'desc', 'qty', 'unit', 'price'].map(k => [k, ($('#ie-c-' + k, root) || {}).value ?? (st.cols || {})[k] ?? '']).filter(x => x[1])); };
    const draw = () => {
      const k = st.kind, web = k === 'erp' || k === 'lookup', F = (id, label, val, ph = '', hint = '') => `<div class="field"><label>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</label><input type="text" id="${id}" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
      root.innerHTML = `<div class="grid g2" style="gap:0 14px"><div class="field"><label>Name</label><input type="text" id="ie-n" value="${esc(st.name)}" placeholder="e.g. Bills sheet"></div>
        <div class="field"><label>Type</label><select id="ie-k" ${isNew ? '' : 'disabled'}>${Object.entries(isyKind).map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div class="field"><label>What does this sheet hold? <span class="hint">(decides what Print DC / Print bill use it for)</span></label><select id="ie-doc"><option value="both" ${st.doc !== 'dc' && st.doc !== 'bill' ? 'selected' : ''}>Both: DC and bill / invoice</option><option value="dc" ${st.doc === 'dc' ? 'selected' : ''}>DC sheet: delivery challans (no prices)</option><option value="bill" ${st.doc === 'bill' ? 'selected' : ''}>Invoice / bill sheet: with prices and tax</option></select></div>
        <div class="hint" style="margin:-4px 0 12px">${{ sheet: 'An Excel / CSV file or Google Sheet that holds the items of your DCs: paste its share link (OneDrive, SharePoint, Google Sheets) or a file path. Every tab is read.', upload: 'Upload the Excel / CSV file once (works without any sign-in). Upload a new copy whenever you like; item status is kept.', erp: 'An address of your ERP that returns the item lines of all DCs as JSON or CSV. The desk reads it every few minutes.', lookup: 'An ERP address with {dc} (or {po}, {pr}) in it. The desk calls it for a DC when that DC is opened, or for all DCs with “Fetch for all DCs”.' }[k]}</div>
        ${k === 'sheet' ? `<div class="field"><label>Link or file path</label><textarea id="ie-u" rows="2" placeholder="https://1drv.ms/x/…  or  https://docs.google.com/spreadsheets/d/…">${esc(st.url)}</textarea></div>` : ''}
        ${k === 'upload' ? `<div class="field"><label>File</label><input type="file" id="ie-file" accept=".xlsx,.xlsm,.csv,.txt"><div class="hint">${src && src.hasFile ? 'Current file: ' + esc(src.uploadedName) + '. Choose another to replace it.' : ''}</div></div>` : ''}
        ${web ? `<div class="field"><label>Address ${k === 'lookup' ? '<span class="hint">(must contain {dc}, {po} or {pr})</span>' : ''}</label><input type="text" id="ie-u" value="${esc(st.url)}" placeholder="${k === 'lookup' ? 'https://erp.example.com/api/dc/{dc}/items' : 'https://erp.example.com/api/dc-items'}"></div>
          <div class="grid g2" style="gap:0 14px"><div class="field"><label>Answer is</label><select id="ie-f"><option value="json" ${st.format !== 'csv' ? 'selected' : ''}>JSON</option><option value="csv" ${st.format === 'csv' ? 'selected' : ''}>CSV file</option></select></div>
            <div class="field"><label>Method</label><select id="ie-me"><option ${st.method === 'GET' ? 'selected' : ''}>GET</option><option ${st.method === 'POST' ? 'selected' : ''}>POST</option></select></div>
            ${F('ie-lp', 'List is at', st.listPath, 'data  /  value  /  result.items', '(JSON; empty = automatic)')}${F('ie-ip', 'Item lines are inside each record at', st.itemsPath, 'order_line  /  items', '(only if the lines are nested)')}</div>
          ${st.method === 'POST' ? `<div class="field"><label>Request body <span class="hint">({dc} {po} {pr} work here too)</span></label><textarea id="ie-b" rows="2" style="font-family:monospace">${esc(st.body)}</textarea></div>` : ''}
          <div class="grid g2" style="gap:0 14px"><div class="field"><label>Sign-in</label><select id="ie-a">${[['none', 'None'], ['bearer', 'Bearer token / API key'], ['basic', 'User + password'], ['header', 'Your own header']].map(([v, l]) => `<option value="${v}" ${st.auth === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            ${st.auth === 'bearer' ? `<div class="field"><label>Token ${st.has.token ? '<span class="hint">(saved — leave empty to keep)</span>' : ''}</label><input type="password" id="ie-tk" autocomplete="off"></div>` : ''}
            ${st.auth === 'basic' ? `${F('ie-us', 'User', st.user)}<div class="field"><label>Password ${st.has.pass ? '<span class="hint">(saved)</span>' : ''}</label><input type="password" id="ie-pw" autocomplete="off"></div>` : ''}
            ${st.auth === 'header' ? `${F('ie-an', 'Header name', st.authName, 'Authorization')}<div class="field"><label>Header value ${st.has.authValue ? '<span class="hint">(saved)</span>' : ''}</label><input type="password" id="ie-av" autocomplete="off"></div>` : ''}</div>` : ''}
        ${k !== 'lookup' && k !== 'upload' ? `<div class="field" style="max-width:200px"><label>Read again every (minutes)</label><input type="number" id="ie-m" min="1" max="1440" value="${esc(st.minutes)}"></div>` : ''}
        <details ${st.company || st.tabs || Object.keys(st.cols || {}).length ? 'open' : ''} style="margin:4px 0 10px"><summary class="hint" style="cursor:pointer">Advanced: company, tabs, column names <span class="hint">(usually not needed — columns are recognised by their heading)</span></summary><div style="margin-top:10px">
          <div class="grid g2" style="gap:0 14px">${F('ie-co', 'Company of this sheet', st.company, 'only if the sheet has no company column', '(optional)')}${k === 'sheet' || k === 'upload' ? F('ie-t', 'Only read these tabs', st.tabs, 'BILLS, FROM DC', '(empty = all tabs)') : ''}</div>
          <div class="hint" style="margin-bottom:6px">If a heading is not recognised, type the exact heading text from your sheet:</div>
          <div class="grid g3" style="gap:0 12px">${[['dc', 'DC no heading'], ['po', 'PO no heading'], ['pr', 'P.R / Req heading'], ['desc', 'Item heading'], ['qty', 'Qty heading'], ['unit', 'Unit heading'], ['price', 'Price heading']].map(([c, l]) => F('ie-c-' + c, l, (st.cols || {})[c] || '')).join('')}</div></div></details>
        <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="ie-sv">${isNew ? 'Save & read now' : 'Save'}</button></div>`;
      $('#cx', root).onclick = close;
      const kk = $('#ie-k', root); if (kk) kk.onchange = () => { read(); draw(); };
      const au = $('#ie-a', root); if (au) au.onchange = () => { read(); draw(); }; const me = $('#ie-me', root); if (me) me.onchange = () => { read(); draw(); };
      const fi = $('#ie-file', root); if (fi) fi.onchange = () => { file = fi.files[0] || null; };
      $('#ie-sv', root).onclick = async () => {
        read(); const b = $('#ie-sv', root); b.disabled = true;
        const body = { doc: st.doc || 'both', name: st.name, kind: st.kind, url: st.url, minutes: st.minutes, company: st.company, tabs: st.tabs, cols: st.cols, format: st.format, method: st.method, body: st.body, listPath: st.listPath, itemsPath: st.itemsPath, next: st.next, auth: st.auth, user: st.user, authName: st.authName };
        for (const [id, f] of [['ie-tk', 'token'], ['ie-pw', 'pass'], ['ie-av', 'authValue']]) { const el = $('#' + id, root); if (el && el.value) body[f] = el.value; }
        try {
          const r = await api(isNew ? '/itemsync/sources' : '/itemsync/sources/' + src.id, { method: isNew ? 'POST' : 'PUT', body }), id = isNew ? r.id : src.id;
          if (st.kind === 'upload' && file) { try { const x = await api(`/itemsync/sources/${id}/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', raw: file }); toast(`${x.items.toLocaleString()} item rows read for ${x.dcs.toLocaleString()} DCs`); } catch (er) { toast('Saved, but reading failed: ' + er.message, true); } }
          else if (isNew && st.kind !== 'lookup' && st.kind !== 'upload') { try { const x = await api(`/itemsync/sources/${id}/sync`, { method: 'POST', body: {} }); toast(`Saved — ${x.items.toLocaleString()} item rows read for ${x.dcs.toLocaleString()} DCs`); } catch (er) { toast('Saved, but the first read failed: ' + er.message, true); } }
          else toast('Saved');
          close(); isyLoad();
        } catch (er) { toast(er.message, true); b.disabled = false; }
      };
    };
    draw();
  });
}


// ---- Letterheads (one per company, used by Print bill / Print DC in Company report) ----
let LH = [];
async function lhLoad() {
  const box = $('#lh-list'); if (!box) return;
  try { LH = (await api('/letterheads')).items || []; } catch (e) { box.innerHTML = `<div class="hint">${esc(e.message)}</div>`; return; }
  box.innerHTML = LH.map(p => `<div class="card pad" data-lh="${esc(p.id)}" style="margin-bottom:8px;background:var(--surface-2)"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div style="min-width:0"><b>${esc(p.label)}</b> ${p.isDefault ? '<span class="pill green">Default</span>' : ''}${p.blankHeader ? ' <span class="pill">Pre-printed paper</span>' : ''}
      <div class="hint">${esc(p.name)}${p.ntn ? ' · NTN ' + esc(p.ntn) : ''}${p.gst ? ' · GST ' + esc(p.gst) : ''}${p.isDefault ? '' : ' · used for: ' + esc(p.match || '— (add the company names)')}${p.logo ? ' · logo' : ''}${p.stamp ? ' · stamp' : ''}</div></div>
      <div class="row" style="gap:6px"><button class="btn sm" data-lha="edit">${ic('edit')} Edit</button>${p.isDefault ? '' : `<button class="btn sm ghost danger" data-lha="del">${ic('trash')}</button>`}</div></div></div>`).join('');
  box.onclick = async e => {
    const b = e.target.closest('button[data-lha]'), row = e.target.closest('[data-lh]'); if (!b || !row) return; const p = LH.find(x => x.id === row.dataset.lh); if (!p) return;
    if (b.dataset.lha === 'edit') return lhEdit(p);
    if (await gconfirm(`Delete the letterhead “${p.label}”? Its companies will print on the Default letterhead.`)) { try { await api('/letterheads/' + p.id, { method: 'DELETE' }); lhLoad(); } catch (er) { toast(er.message, true); } }
  };
}
// a picture chosen from the computer -> a small data URL (kept as PNG so a stamp stays transparent)
function lhImage(file, maxW) {
  return new Promise((ok, no) => { const fr = new FileReader(); fr.onerror = () => no(new Error('Could not read the picture.'));
    fr.onload = () => { const im = new Image(); im.onerror = () => no(new Error('This is not a picture.'));
      im.onload = () => { const k = Math.min(1, maxW / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/png')); };
      im.src = fr.result; }; fr.readAsDataURL(file); });
}
function lhEdit(p) {
  const isNew = !p, st = { ...(p || { label: '', match: '', name: '', address: '', ntn: '', gst: '', phone: '', mobile: '', extra: '', bank: '', billNote: '', dcNote: '', sig: 'Collect by, Check by, Pack by', logo: '', headerImage: '', stamp: '', blankHeader: false, topMm: 0, bottomMm: 0 }), layout: JSON.parse(JSON.stringify((p && p.layout) || {})) };
  modal(`<h3>${ic('edit')} ${isNew ? 'Add a letterhead' : 'Edit “' + esc(st.label) + '”'}</h3><div id="lhe"></div>`, (bg, close) => {
    const root = $('#lhe', bg); $('.modal', bg).style.maxWidth = '760px';
    const g = id => { const el = $('#' + id, root); return el ? el.value : ''; };
    const read = () => { Object.assign(st, { label: g('lh-label'), match: p && p.isDefault ? '' : g('lh-match'), name: g('lh-name'), address: g('lh-address'), ntn: g('lh-ntn'), gst: g('lh-gst'), phone: g('lh-phone'), mobile: g('lh-mobile'), extra: g('lh-extra'), bank: g('lh-bank'), billNote: g('lh-billnote'), dcNote: g('lh-dcnote'), sig: g('lh-sig'), blankHeader: !!($('#lh-blank', root) || {}).checked, topMm: g('lh-top'), bottomMm: g('lh-bottom') }); };
    const F = (id, label, val, ph = '', hint = '') => `<div class="field"><label>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</label><input type="text" id="${id}" value="${esc(val)}" placeholder="${esc(ph)}"></div>`;
    const T = (id, label, val, ph = '', hint = '') => `<div class="field"><label>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</label><textarea id="${id}" rows="3" placeholder="${esc(ph)}">${esc(val)}</textarea></div>`;
    const P = (k, label, hint) => `<div class="field"><label>${label} <span class="hint">${hint}</span></label>${st[k] ? `<div style="margin:4px 0"><img src="${st[k]}" style="max-height:70px;max-width:100%;border:1px solid var(--line);border-radius:6px;background:#fff"></div>` : ''}<div class="row" style="gap:6px"><input type="file" accept="image/*" data-lhp="${k}">${st[k] ? `<button class="btn sm" data-lhx="${k}">Remove</button>` : ''}</div></div>`;
    const draw = () => {
      root.innerHTML = `<div class="grid g2" style="gap:0 14px">${F('lh-label', 'Letterhead name', st.label, 'e.g. Bank Al Falah letterhead')}${p && p.isDefault ? '<div class="hint" style="align-self:end;margin-bottom:12px">This is the Default: it is used for every company that has no letterhead of its own.</div>' : F('lh-match', 'Used for these companies', st.match, 'Bank Al Falah, Meezan Bank', '(names, separated by commas)')}
        ${F('lh-name', 'Company name on the paper', st.name, 'M.R. ENTERPRISES')}${F('lh-address', 'Address line', st.address)}
        ${F('lh-ntn', 'N.T.N #', st.ntn)}${F('lh-gst', 'G.S.T #', st.gst)}${F('lh-phone', 'Phone', st.phone)}${F('lh-mobile', 'Mobile', st.mobile)}</div>
      ${T('lh-extra', 'Other lines under the header', st.extra, 'STRN, website, e-mail…', '(optional, one per line)')}
      <div class="grid g2" style="gap:0 14px">${P('logo', 'Logo', '(top right of the page)')}${P('stamp', 'Stamp / signature', '(printed at the bottom)')}</div>
      ${P('headerImage', 'Full header picture', '(optional: replaces the typed header, e.g. a scanned letterhead top)')}
      <div class="grid g2" style="gap:0 14px">${T('lh-bank', 'Bank details', st.bank, 'BANK : …\nACC # : …', '(Bill only, one per line)')}${T('lh-billnote', 'Note at the end of the Bill', st.billNote, 'Terms, payment note…')}
        ${T('lh-dcnote', 'Note at the end of the DC', st.dcNote)}${F('lh-sig', 'Signature lines on the DC', st.sig, 'Collect by, Check by, Pack by', '(commas)')}</div>
      <div class="field" style="margin-top:4px"><label class="row" style="gap:8px"><input type="checkbox" id="lh-blank" ${st.blankHeader ? 'checked' : ''}> This company uses <b>pre-printed letterhead paper</b> <span class="hint">(do not print the header, only leave the space below)</span></label></div>
      <div class="grid g2" style="gap:0 14px">${F('lh-top', 'Space at the top (mm)', st.topMm, '0', '(for the printed header)')}${F('lh-bottom', 'Space at the bottom (mm)', st.bottomMm, '0', '(for a printed footer)')}</div>
      <div class="field" style="margin-top:6px;padding:12px;border:1px dashed var(--line);border-radius:10px"><div class="row" style="gap:10px;flex-wrap:wrap;justify-content:space-between"><div><b>Layout</b> <span class="hint">move the logo, title, numbers, address, bank details, totals, stamp and signatures to where you want them, on the Bill and on the DC separately</span><div class="hint" id="lh-laysum">${lhLaySummary(st.layout)}</div></div><button class="btn" id="lh-map" type="button">${ic('edit')} Map layout…</button></div></div>
      <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="lh-sv">Save</button></div>`;
      $('#cx', root).onclick = close;
      $('#lh-map', root).onclick = () => { read(); lhLayout(st, () => draw()); };
      $$('input[data-lhp]', root).forEach(i => { i.onchange = async () => { const f = i.files[0]; if (!f) return; read(); try { st[i.dataset.lhp] = await lhImage(f, i.dataset.lhp === 'headerImage' ? 1400 : 700); draw(); } catch (er) { toast(er.message, true); } }; });
      $$('button[data-lhx]', root).forEach(x => { x.onclick = () => { read(); st[x.dataset.lhx] = ''; draw(); }; });
      $('#lh-sv', root).onclick = async () => { read(); const b = $('#lh-sv', root); b.disabled = true;
        try { await api(isNew ? '/letterheads' : '/letterheads/' + p.id, { method: isNew ? 'POST' : 'PUT', body: st }); toast('Saved'); close(); lhLoad(); } catch (er) { toast(er.message, true); b.disabled = false; } };
    };
    draw();
  });
}


// ---- Map layout: drag the parts of the Bill / DC paper where you want them (like the QuickBooks form designer) ----
const LH_PARTS = { title: 'Title (Sales tax invoice / Delivery challan)', name: 'Company name', addr: 'Address line', logo: 'Logo', hdrimg: 'Header picture', tax: 'N.T.N / G.S.T lines', contact: 'Phone / mobile', date: 'Date', ids: 'Invoice / DC / PO / REQ / Branch numbers', ms: 'M/S customer name', ad: 'Customer address', ph: 'Customer phone (DC)', ct: 'Contact person (DC)', bank: 'Bank details', totals: 'Totals box', stamp: 'Stamp / signature', sig: 'Signature lines (DC)', note: 'Note at the end (DC)' };
function lhLaySummary(l) { const n = ['bill', 'dc'].map(k => Object.keys((l || {})[k] || {}).length); return n[0] + n[1] ? `Changed: ${n[0]} part(s) on the Bill, ${n[1]} on the DC` : 'Standard layout'; }
function lhLayout(st, done) {
  const lay = JSON.parse(JSON.stringify(st.layout || {})); lay.bill = lay.bill || {}; lay.dc = lay.dc || {};
  let kind = 'bill', sel = '', els = [], fitK = 1;
  const rowsS = [[10, 'A4 PAPER 80GSM', 'Ream', 1250], [4, 'STAPLER MACHINE 24/6', 'Each', 850], [25, 'BALL POINT PEN BLUE', 'Each', 40]].map(([q, d, u, p], i) => { const amt = q * p, tv = Math.round(amt * .18); return { qty: q, desc: d, code: '1000' + (4001 + i), exp: '1000' + (4001 + i), unit: u, price: p, amt, tp: '18', tv, total: amt + tv }; });
  const tot = rowsS.reduce((a, r) => ({ qty: a.qty + r.qty, amt: a.amt + r.amt, tv: a.tv + r.tv, total: a.total + r.total }), { qty: 0, amt: 0, tv: 0, total: 0 });
  const hS = { dc: '12345', date: '21-Nov-26', inv: '1001', po: '409092', pr: '339683', cc: '0998', company: 'Sample Company Ltd', addr: 'Manager Operation, Sample Branch, Main Road, City', phone: '0300 1234567', contact: 'Contact Person' };
  modal(`<h3>${ic('edit')} Map the layout</h3>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin:-6px 0 10px"><button class="btn sm" data-ly="bill">Bill</button><button class="btn sm" data-ly="dc">Delivery challan (DC)</button><span class="hint" style="flex:1;min-width:220px">Drag any part of the paper to move it. Click a part, then use the arrow keys (Shift = 5 mm). Use the list on the right for exact positions, size, or to hide a part. The paper prints exactly like this.</span></div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start"><div id="lyw" style="background:#cfd2d6;border-radius:10px;padding:10px;overflow:hidden"><div id="lys"><div id="lyb" style="transform-origin:0 0;width:794px"><iframe id="lyf" style="width:794px;height:1123px;border:0;background:#fff;display:block"></iframe></div></div></div><div id="lyr" style="max-height:74vh;overflow:auto"></div></div>
    <div class="acts"><button class="btn" id="lyreset">Reset this paper</button><span style="flex:1"></span><button class="btn" id="lycx">Cancel</button><button class="btn primary" id="lydone">Use this layout</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '1240px'; $('.modal', bg).style.width = '96vw';
    const f = $('#lyf', bg), rowsEl = $('#lyr', bg);
    const fit = () => { const w = $('#lyw', bg).clientWidth - 20; fitK = Math.max(.3, Math.min(1, w / 794)); $('#lyb', bg).style.transform = `scale(${fitK})`; $('#lys', bg).style.height = Math.round(1123 * fitK) + 'px'; };
    const load = () => { fit(); sel = ''; f.srcdoc = dcDocHtml(kind, { ...st, layout: { [kind]: lay[kind] } }, hS, rowsS, tot, true); $$('button[data-ly]', bg).forEach(b => b.classList.toggle('primary', b.dataset.ly === kind)); };
    const cur = k => lay[kind][k] || (lay[kind][k] = {});
    const drawRows = () => { rowsEl.innerHTML = els.map(k => { const v = lay[kind][k] || {}, num = (fld, val, w) => `<input type="number" step="${fld === 's' ? 5 : .5}" data-f="${fld}" value="${val}" style="width:${w}px;padding:4px 6px">`;
      return `<div data-k="${k}" style="padding:8px 10px;margin-bottom:6px;border:1px solid ${sel === k ? '#2a7de1' : 'var(--line)'};border-radius:10px;background:${sel === k ? 'color-mix(in srgb,#2a7de1 8%,transparent)' : 'transparent'};cursor:pointer"><label class="row" style="gap:6px"><input type="checkbox" data-f="show" ${v.hide ? '' : 'checked'}> <b style="font-size:13px">${esc(LH_PARTS[k] || k)}</b></label><div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><span class="hint">Right</span>${num('dx', v.dx || 0, 62)}<span class="hint">Down</span>${num('dy', v.dy || 0, 62)}<span class="hint">Size %</span>${num('s', v.s || 100, 62)}</div></div>`; }).join('') || '<div class="hint">Loading…</div>'; };
    const push = k => f.contentWindow && f.contentWindow.postMessage({ dcEdit: 1, t: 'set', el: k, v: { dx: (lay[kind][k] || {}).dx || 0, dy: (lay[kind][k] || {}).dy || 0, s: (lay[kind][k] || {}).s || 100, hide: !!(lay[kind][k] || {}).hide } }, '*');
    const onMsg = ev => { const m = ev.data || {}; if (!m.dcEdit || ev.source !== f.contentWindow) return;
      if (m.t === 'ready') { els = Object.keys(LH_PARTS).filter(k => m.els.includes(k)); drawRows(); }
      else if (m.t === 'sel') { sel = m.el; drawRows(); const r = $(`[data-k="${m.el}"]`, rowsEl); if (r) r.scrollIntoView({ block: 'nearest' }); }
      else if (m.t === 'move') { lay[kind][m.el] = { ...(lay[kind][m.el] || {}), dx: m.v.dx || 0, dy: m.v.dy || 0 }; const r = $(`[data-k="${m.el}"]`, rowsEl); if (r) { $('[data-f=dx]', r).value = m.v.dx || 0; $('[data-f=dy]', r).value = m.v.dy || 0; } } };
    window.addEventListener('message', onMsg); const gone = () => { window.removeEventListener('message', onMsg); window.removeEventListener('resize', fit); }, off = close;
    const shut = () => { gone(); off(); };
    window.addEventListener('resize', fit);
    $$('button[data-ly]', bg).forEach(b => { b.onclick = () => { kind = b.dataset.ly; load(); }; });
    rowsEl.onchange = rowsEl.oninput = ev => { const i = ev.target.closest('input[data-f]'), r = ev.target.closest('[data-k]'); if (!i || !r) return; const k = r.dataset.k, v = cur(k);
      if (i.dataset.f === 'show') v.hide = !i.checked; else v[i.dataset.f] = parseFloat(i.value) || (i.dataset.f === 's' ? 100 : 0); push(k); };
    rowsEl.onclick = ev => { const r = ev.target.closest('[data-k]'); if (!r || ev.target.closest('input')) return; sel = r.dataset.k; f.contentWindow && f.contentWindow.postMessage({ dcEdit: 1, t: 'sel', el: sel }, '*'); drawRows(); };
    $('#lyreset', bg).onclick = () => { lay[kind] = {}; load(); };
    $('#lycx', bg).onclick = shut;
    $('#lydone', bg).onclick = () => { for (const k of ['bill', 'dc']) for (const [e, v] of Object.entries(lay[k])) { if (!(+v.dx || +v.dy || v.hide || (+v.s && +v.s !== 100))) delete lay[k][e]; } st.layout = lay; shut(); done && done(); };
    load();
  });
}
