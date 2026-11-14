/* "Columns" for one company sheet: choose the Excel tab, the header row and which column is P.R no / PO no / CN no (loaded after app.js) */
async function sheetSetup(sid) {
  const { cfg, synced, name } = await api(`/sources/${sid}/config`);
  const st = { file: null, cfg: { sheet: cfg.sheet || '', headerRow: cfg.headerRow || 0, map: { ...cfg.map }, show: [...cfg.show] }, info: null, err: '' };
  const inspect = async () => {
    try { st.info = await api(`/sources/${sid}/inspect?cfg=` + encodeURIComponent(JSON.stringify(st.cfg)), { method: 'POST', raw: st.file || new ArrayBuffer(0) }); st.err = ''; }
    catch (e) { st.info = null; st.err = e.message; }
  };
  if (synced) await inspect();
  modal('<div id="shbody"></div>', (bg, close) => {
    const body = $('#shbody', bg), pick = (key, cur) => `<select data-f="${key}" style="flex:1"><option value="">Automatic</option><option value="-" ${cur === '-' ? 'selected' : ''}>Not in my sheet</option>${st.info.headers.map(h => `<option ${h === cur ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`;
    const draw = () => {
      const i = st.info, src = synced
        ? '<p class="hint">Reading the file from your OneDrive / folder link.</p>'
        : `<div class="field"><label>Your Excel file</label><input type="file" id="shfile" accept=".xlsx,.xlsm"></div>`;
      body.innerHTML = `<h3>Columns — ${esc(name)}</h3><p class="hint" style="margin-bottom:12px">Choose the tab and which column holds each number. Customers can then send a PO, P.R or CN number on WhatsApp and get the details back.</p>${src}
        ${st.err ? `<div class="notice" style="background:var(--red-soft);color:var(--red);margin-bottom:10px">${esc(st.err)}</div>` : ''}
        ${i ? `<div class="grid g2" style="gap:12px"><div class="field"><label>Sheet tab</label><select id="shtab">${i.sheets.map(n => `<option ${n === i.sheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="field"><label>Header row <span class="hint">(found: row ${i.headerRow})</span></label><input type="number" id="shrow" min="0" max="50" value="${st.cfg.headerRow || ''}" placeholder="Automatic"></div></div>
        <div class="field"><label>Which column is which?</label>${i.fields.map(f => `<div class="row" style="gap:8px;margin-bottom:6px"><span style="width:200px;font-size:13px">${esc(f.label)}</span>${pick(f.key, st.cfg.map[f.key] || '')}${!st.cfg.map[f.key] && i.guess[f.key] ? `<span class="hint" style="min-width:90px">→ ${esc(i.guess[f.key])}</span>` : ''}</div>`).join('')}</div>
        <div class="field"><label>Details to show customers <span class="hint">(leave all unticked for the usual ones)</span></label><div class="chips" style="gap:6px 14px">${i.headers.map(h => `<label class="row" style="gap:5px;font-size:13px"><input type="checkbox" data-s="${esc(h)}" ${st.cfg.show.includes(h) ? 'checked' : ''}> ${esc(h)}</label>`).join('')}</div></div>
        <div class="field"><label>Preview — ${i.count} rows found</label><pre style="white-space:pre-wrap;background:var(--bg-soft,#f3f4f6);padding:10px;border-radius:8px;font-size:12.5px;margin:0">${esc(i.preview.join('\n\n') || (i.hasId ? 'No rows.' : 'Pick the PO / P.R / CN column above.'))}</pre></div>` : (synced || st.file ? '' : '<p class="hint">Choose your Excel file to see its tabs and columns.</p>')}
        <div class="acts"><button class="btn" id="shx">Cancel</button><button class="btn primary" id="shsave" ${i ? '' : 'disabled'}>Save${st.file ? ' & import' : ''}</button></div>`;
      $('#shx', body).onclick = close;
      const redo = async () => { await inspect(); draw(); };
      if ($('#shfile', body)) $('#shfile', body).onchange = async e => { st.file = e.target.files[0] ? await e.target.files[0].arrayBuffer() : null; st.cfg.sheet = ''; st.cfg.headerRow = 0; st.cfg.map = {}; st.cfg.show = []; if (st.file) await redo(); else { st.info = null; draw(); } };
      if (!i) return;
      $('#shtab', body).onchange = e => { st.cfg.sheet = e.target.value; st.cfg.headerRow = 0; st.cfg.map = {}; st.cfg.show = []; redo(); };
      $('#shrow', body).onchange = e => { st.cfg.headerRow = +e.target.value || 0; st.cfg.map = {}; redo(); };
      body.querySelectorAll('select[data-f]').forEach(s => s.onchange = () => { if (s.value) st.cfg.map[s.dataset.f] = s.value; else delete st.cfg.map[s.dataset.f]; redo(); });
      body.querySelectorAll('input[data-s]').forEach(c => c.onchange = () => { st.cfg.show = [...body.querySelectorAll('input[data-s]:checked')].map(x => x.dataset.s); redo(); });
      $('#shsave', body).onclick = async e => {
        e.target.disabled = true; st.cfg.sheet = st.cfg.sheet || i.sheet;
        try {
          await api(`/sources/${sid}/config`, { method: 'PUT', body: st.cfg });
          const r = synced ? await api(`/sources/${sid}/sync`, { method: 'POST' }) : st.file ? await api(`/sources/${sid}/upload?mode=replace`, { method: 'POST', raw: st.file }) : { count: 0 };
          close(); toast(synced || st.file ? `Saved — ${r.count} orders read` : 'Saved'); viewOrders();
        } catch (err) { toast(err.message, true); e.target.disabled = false; }
      };
    };
    draw();
  });
}
