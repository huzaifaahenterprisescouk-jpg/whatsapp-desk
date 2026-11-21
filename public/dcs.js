/* DC files (left menu): every DC with its company, any number of links and sheets, and its items tracked one by one. */
const DCS_ST = DCF_ST;   // Pending / Delivered / Short / Returned (from dcfile.js)
async function viewDcs() {
  $('#main').innerHTML = `<div class="page">${pageHead('DC files', 'Attach a sheet (or link) with your DCs and items. Each item is matched by its DC number and shown in Company report when you open that DC.', `<button class="btn primary" id="dcs-new">${ic('plus')} Add DC</button>`)}<div class="card pad"><div class="hint">Loading…</div></div></div>`;
  let d; try { d = await api('/dcfiles'); } catch (e) { $('#main').innerHTML = `<div class="page"><div class="notice">${esc(e.message)}</div></div>`; return; }
  S.dcs = d; dcsRender();
}
function dcsRender() {
  const d = S.dcs, q = (S.dcsQ || '').toLowerCase(), rows = d.dcs.filter(r => (!S.dcsC || r.company === S.dcsC) && (!q || `${r.company} ${r.dc} ${r.po} ${r.note}`.toLowerCase().includes(q)));
  const cos = [...new Set(d.dcs.map(r => r.company))].sort(), pill = (t, c) => `<span class="pill" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c};white-space:nowrap">${t}</span>`;
  $('#main').innerHTML = `<div class="page">${pageHead('DC files', 'Attach a sheet (or link) with your DCs and items. Each item is matched by its DC number and shown in Company report when you open that DC.', `<button class="btn primary" id="dcs-new">${ic('plus')} Add DC</button>`)}
    <div class="row" style="gap:10px;margin:0 0 14px;flex-wrap:wrap"><input type="search" id="dcs-q" placeholder="Search company, DC no, PO…" value="${esc(S.dcsQ || '')}" style="max-width:320px"><select id="dcs-c" style="max-width:240px"><option value="">All companies</option>${cos.map(c => `<option ${S.dcsC === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="hint">${rows.length} DC${rows.length === 1 ? '' : 's'}</span></div>
    <div class="card">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>DC no</th><th>PO</th><th>Company</th><th>Items</th><th>Links</th><th>Files</th><th>Updated</th><th>By</th></tr></thead><tbody id="dcs-b">
      ${rows.map(r => { const m = r.summary; return `<tr data-id="${r.id}" style="cursor:pointer"><td><b>${esc(r.dc || '—')}</b></td><td>${esc(r.po || '—')}</td><td>${esc(r.company)}</td>
        <td>${m.count ? `<b>${m.count}</b> ${m.delivered === m.count ? pill('all delivered', '#16a34a') : [m.delivered ? pill(m.delivered + ' delivered', '#16a34a') : '', m.short ? pill(m.short + ' short', '#2563eb') : '', m.returned ? pill(m.returned + ' returned', 'var(--red)') : '', m.pending ? pill(m.pending + ' pending', 'var(--amber)') : ''].join(' ')}` : '<span class="hint">—</span>'}</td>
        <td>${r.linkCount || '—'}</td><td>${r.fileCount || '—'}</td><td class="hint">${new Date(r.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td><td class="hint">${esc(r.by)}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty" style="padding:44px 20px;text-align:center"><b style="font-size:15px">${d.dcs.length ? 'No DC matches your search' : 'No DC added yet'}</b><div class="hint" style="margin:6px 0 16px">${d.dcs.length ? '' : 'Press “Add DC”: pick the company, paste one or more links, add sheets and the items are tracked here.'}</div></div>`}</div></div>`;
  $('#dcs-new').onclick = () => dcsAdd();
  $('#dcs-q').oninput = e => { S.dcsQ = e.target.value; const p = e.target.selectionStart; dcsRender(); const el = $('#dcs-q'); el.focus(); try { el.setSelectionRange(p, p); } catch {} };
  $('#dcs-c').onchange = e => { S.dcsC = e.target.value; dcsRender(); };
  const b = $('#dcs-b'); if (b) b.onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) dcsOpen(tr.dataset.id); };
}

// ---- Add DC: company, DC no, PO, many links (one per line), many sheets / files, items pasted from Excel ----
function dcsAdd() {
  const cos = (S.dcs && S.dcs.companies) || [], files = []; let items = [];
  modal(`<h3>Add DC</h3>
    <div class="grid g2" style="gap:0 14px"><div class="field" style="grid-column:1/-1"><label>Company</label><input id="da-co" list="da-cl" value="${esc(S.dcsC || '')}" placeholder="Choose or type the company" autocomplete="off"><datalist id="da-cl">${cos.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field"><label>DC no</label><input id="da-dc" autocomplete="off"></div><div class="field"><label>PO no <span class="hint">(optional)</span></label><input id="da-po" autocomplete="off"></div></div>
    <div class="field"><label>Links <span class="hint">(OneDrive / SharePoint / web: one per line, as many as you need)</span></label><textarea id="da-ln" rows="3" placeholder="https://1drv.ms/…&#10;https://…sharepoint.com/…" style="width:100%"></textarea></div>
    <div class="field"><label>Sheets / files <span class="hint">(PDF, picture, Word, Excel, CSV: you can pick several)</span></label><input type="file" id="da-f" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.docx,.doc,.csv"><div class="hint" id="da-fl"></div></div>
    <div class="row" style="gap:8px;align-items:center"><button class="btn sm" id="da-p">Paste items from Excel</button><span class="hint" id="da-n"></span></div>
    <div class="field" style="margin-top:10px"><label>Note <span class="hint">(optional)</span></label><input id="da-nt" autocomplete="off"></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="da-ok">Add DC</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; $('#da-co', bg).focus();
    $('#da-f', bg).onchange = e => { files.push(...e.target.files); e.target.value = ''; $('#da-fl', bg).textContent = files.map(f => f.name).join(', '); };
    $('#da-p', bg).onclick = () => dcfPaste(list => { items = list.map(i => ({ ...i, status: 'pending' })); $('#da-n', bg).textContent = `${items.length} item${items.length === 1 ? '' : 's'} ready`; });
    $('#da-ok', bg).onclick = async () => {
      const b = $('#da-ok', bg); b.disabled = true; b.textContent = 'Saving…';
      try {
        const links = $('#da-ln', bg).value.split(/\s+/).filter(Boolean);
        const r = await api('/dcfiles', { method: 'POST', body: { company: $('#da-co', bg).value, dc: $('#da-dc', bg).value, po: $('#da-po', bg).value, note: $('#da-nt', bg).value, items, links } });
        let found = r.items || [], last = r;
        for (const f of files) { try { const x = await api(`/dcfiles/${r.id}/files?name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: f }); last = x.dc; if (!found.length && x.items.length) found = x.items; } catch (er) { toast(`${f.name}: ${er.message}`, true); } }
        if (!last.items.length && found.length) await api('/dcfiles/' + r.id, { method: 'PUT', body: { items: found } });
        close(); toast('DC added'); await viewDcs(); dcsOpen(r.id);
      } catch (er) { toast(er.message, true); b.disabled = false; b.textContent = 'Add DC'; }
    };
  });
}

// ---- one DC: details, links, files, items with tracking ----
async function dcsOpen(id) {
  let r; try { r = await api('/dcfiles/' + id); } catch (e) { return toast(e.message, true); }
  const cos = (S.dcs && S.dcs.companies) || [], tok = encodeURIComponent(S.token); let dirty = false;
  modal(`<div id="dd"></div>`, (bg, close) => {
    const root = $('#dd', bg); $('.modal', bg).style.maxWidth = '980px';
    const pill = (t, c) => `<span class="pill" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c}">${t}</span>`;
    const draw = () => {
      const m = dcfSum(r.items);
      root.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><h3 style="margin:0">DC ${esc(r.dc || '')} <span class="hint" style="font-weight:500">· ${esc(r.company)}</span></h3><button class="btn sm" id="dd-del" title="Delete this DC">${ic('trash')} Delete</button></div>
        <div class="grid g2" style="gap:0 14px;margin-top:10px"><div class="field" style="grid-column:1/-1"><label>Company</label><input id="dd-co" list="dd-cl" value="${esc(r.company)}" autocomplete="off"><datalist id="dd-cl">${cos.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label>DC no</label><input id="dd-dc" value="${esc(r.dc)}"></div><div class="field"><label>PO no</label><input id="dd-po" value="${esc(r.po)}"></div><div class="field" style="grid-column:1/-1"><label>Note</label><input id="dd-nt" value="${esc(r.note)}"></div></div>
        <div class="fr-d" style="margin-top:0"><div class="fr-dh">Links · ${r.links.length}</div>
          ${r.links.map(l => { const f = r.files.find(x => x.id === l.fileId); return `<div class="row" style="gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><a href="${esc(l.url)}" target="_blank" rel="noopener" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--brand);font-weight:600">${esc(l.url)}</a>${f ? '<span class="pill green">copy saved</span>' : '<span class="pill">link only</span>'}<button class="btn sm" data-a="rmlink" data-id="${l.id}">${ic('trash')}</button></div>`; }).join('') || '<div class="hint">No link yet.</div>'}
          <div class="row" style="gap:8px;margin-top:8px"><textarea id="dd-ln" rows="1" placeholder="Paste one or more links (one per line)" style="flex:1"></textarea><button class="btn sm primary" data-a="addlinks">${ic('link') || ''} Add links</button></div></div>
        <div class="fr-d"><div class="fr-dh">Sheets &amp; files · ${r.files.length}</div>
          ${r.files.map(f => `<div class="row" style="gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><a href="/api/dcfiles/file/${f.id}?token=${tok}" target="_blank" rel="noopener" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--brand);font-weight:600">${esc(f.name)}</a><span class="hint">${dcfSize(f.size)}${f.via === 'link' ? ' · from link' : ''}</span><button class="btn sm" data-a="rmfile" data-id="${f.id}">${ic('trash')}</button></div>`).join('') || '<div class="hint">No file yet.</div>'}
          <div style="margin-top:8px"><label class="btn sm" style="cursor:pointer">${ic('up')} Upload sheets / files<input type="file" data-a="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.docx,.doc,.csv" hidden></label></div></div>
        <div class="fr-d"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="fr-dh" style="margin:0">Items · ${m.n} · ${new Set(r.items.map(i => i.dc || r.dc).filter(Boolean)).size} DC no${new Set(r.items.map(i => i.dc || r.dc).filter(Boolean)).size === 1 ? '' : 's'}</div><div class="row" style="gap:6px;flex-wrap:wrap">${m.d ? pill(m.d + ' delivered', '#16a34a') : ''}${m.s ? pill(m.s + ' short', '#2563eb') : ''}${m.r ? pill(m.r + ' returned', 'var(--red)') : ''}${m.p ? pill(m.p + ' pending', 'var(--amber)') : ''}</div></div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin:8px 0"><button class="btn sm" data-a="paste">Paste items from Excel</button>${r.files.some(f => ['xlsx', 'csv'].includes(f.ext)) ? '<button class="btn sm" data-a="reread" title="Read the sheet again: each item gets the DC number written in the sheet">Re-read sheet</button>' : ''}<button class="btn sm" data-a="add">${ic('plus')} Add item</button>${m.n ? '<button class="btn sm" data-a="alldone">Mark all delivered</button>' : ''}</div>
          ${r.items.length && !r.dc && r.items.some(i => !i.dc) ? '<div class="hint" style="color:var(--amber);margin-bottom:6px">Some items have no DC no. They show in the Company report only when they have the DC number: type it in the DC no column, or use a sheet with a DC no column.</div>' : ''}${r.items.length ? `<div class="tbl-wrap" style="border:1px solid var(--line);max-height:36vh;overflow:auto"><table class="tbl dcf-t"><thead><tr><th style="width:30px">#</th><th style="width:90px">DC no</th><th>Item</th><th style="width:70px">Qty</th><th style="width:80px">Unit</th><th style="width:140px">Status</th><th style="width:80px">Received</th><th style="width:170px">Note</th><th style="width:34px"></th></tr></thead><tbody>
          ${r.items.map((it, n) => `<tr data-n="${n}"><td class="hint">${n + 1}</td><td><input data-f="dc" value="${esc(it.dc || '')}" placeholder="${esc(r.dc || 'DC')}"></td><td><textarea data-f="desc" rows="1" style="min-height:32px;resize:vertical">${esc(it.desc)}</textarea></td><td><input type="number" data-f="qty" min="0" step="any" value="${esc(it.qty)}"></td><td><input data-f="unit" value="${esc(it.unit)}"></td>
            <td><select data-f="status" style="color:${(DCS_ST.find(x => x[0] === it.status) || DCS_ST[0])[2]};font-weight:700">${DCS_ST.map(([k, l]) => `<option value="${k}" ${k === it.status ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
            <td><input type="number" data-f="got" min="0" step="any" value="${it.status === 'pending' ? '' : esc(it.got)}" ${it.status === 'pending' ? 'disabled' : ''}></td><td><input data-f="note" value="${esc(it.note)}"></td><td><button class="btn sm" data-a="del">${ic('trash')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="hint">No items yet. Upload an Excel / CSV sheet, add a link to one, paste the items, or add them by hand.</div>'}</div>
        <div class="acts"><button class="btn" id="dd-x">Close</button><button class="btn primary" id="dd-save">Save</button></div>`;
      $$('textarea[data-f=desc]', root).forEach(t => { t.style.height = 'auto'; t.style.height = Math.max(32, t.scrollHeight) + 'px'; });
      $('#dd-x', root).onclick = close; $('#dd-save', root).onclick = save; $('#dd-del', root).onclick = del;
    };
    const head = () => ({ company: $('#dd-co', root).value, dc: $('#dd-dc', root).value, po: $('#dd-po', root).value, note: $('#dd-nt', root).value });
    const keepHead = () => { const h = head(); Object.assign(r, h); };
    const save = async () => { try { keepHead(); r = await api('/dcfiles/' + id, { method: 'PUT', body: { ...head(), items: r.items } }); toast('Saved'); dirty = false; close(); viewDcs(); } catch (e) { toast(e.message, true); } };
    const del = async () => { if (!await gconfirm('Delete this DC with its files and items?')) return; try { await api('/dcfiles/' + id, { method: 'DELETE' }); close(); toast('Deleted'); viewDcs(); } catch (e) { toast(e.message, true); } };
    const addItems = list => { if (!list.length) return toast('No items found there', true); keepHead(); r.items.push(...list.map(i => ({ id: '', desc: i.desc, qty: i.qty, unit: i.unit || '', got: 0, status: 'pending', note: '' }))); draw(); toast(`${list.length} item${list.length === 1 ? '' : 's'} added — press Save`); };
    const askItems = async list => { if (list.length && (!r.items.length || await gconfirm(`The sheet has ${list.length} items. Add them to the item list?`))) addItems(list); };
    root.oninput = root.onchange = e => {
      const t = e.target, tr = t.closest('tr[data-n]'); if (!tr || !t.dataset.f) return; const it = r.items[+tr.dataset.n], f = t.dataset.f;
      if (f === 'qty' || f === 'got') it[f] = Math.max(0, parseFloat(t.value) || 0); else it[f] = t.value;
      if (t.tagName === 'TEXTAREA') { t.style.height = 'auto'; t.style.height = Math.max(32, t.scrollHeight) + 'px'; }
      if (f === 'status' && e.type === 'change') { if (it.status === 'delivered') it.got = it.qty; else if (it.status === 'pending') it.got = 0; keepHead(); draw(); }
    };
    root.onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT') return; const a = b.dataset.a;
      try {
        if (a === 'add') { keepHead(); r.items.push({ id: '', desc: '', qty: 1, unit: '', got: 0, status: 'pending', note: '' }); draw(); const t = $$('textarea[data-f=desc]', root).pop(); if (t) t.focus(); }
        else if (a === 'del') { keepHead(); r.items.splice(+b.closest('tr').dataset.n, 1); draw(); }
        else if (a === 'alldone') { keepHead(); r.items.forEach(i => { i.status = 'delivered'; i.got = i.qty; }); draw(); }
        else if (a === 'paste') dcfPaste(addItems);
        else if (a === 'reread') { keepHead(); const hd = head(); const x = await api('/dcfiles/' + id, { method: 'POST' }); r = x; Object.assign(r, hd); draw(); toast('Sheet read again'); }
        else if (a === 'addlinks') {
          const urls = $('#dd-ln', root).value.split(/\s+/).filter(Boolean); if (!urls.length) return; b.disabled = true; b.textContent = 'Adding…'; keepHead();
          const x = await api(`/dcfiles/${id}/links`, { method: 'POST', body: { urls } }); const items = r.items, hd = head(); r = x.dc; r.items = items; Object.assign(r, hd); draw();
          const bad = x.results.filter(z => !z.ok); toast(bad.length ? `${bad.length} not a web address` : x.results.some(z => !z.copy) ? 'Links added (some saved as link only)' : 'Links added and copies saved', !!bad.length); await askItems(x.items);
        }
        else if (a === 'rmlink') { keepHead(); const items = r.items, hd = head(); r = await api(`/dcfiles/${id}/links/${b.dataset.id}`, { method: 'DELETE' }); r.items = items; Object.assign(r, hd); draw(); }
        else if (a === 'rmfile') { if (!await gconfirm('Remove this file?')) return; await api('/dcfiles/file/' + b.dataset.id, { method: 'DELETE' }); keepHead(); r.files = r.files.filter(f => f.id !== b.dataset.id); r.links.forEach(l => { if (l.fileId === b.dataset.id) delete l.fileId; }); draw(); }
      } catch (er) { toast(er.message, true); draw(); }
    };
    root.addEventListener('change', async e => {
      const i = e.target; if (!i.matches || !i.matches('[data-a=file]')) return; const fl = [...i.files]; i.value = ''; let found = []; keepHead(); const items = r.items, hd = head();
      for (const f of fl) { try { const x = await api(`/dcfiles/${id}/files?name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: f }); r = x.dc; if (!found.length) found = x.items; } catch (er) { toast(`${f.name}: ${er.message}`, true); } }
      r.items = items; Object.assign(r, hd); draw(); await askItems(found);
    });
    draw();
  });
}
