/* Company report / DC files, three additions (loaded after desk.js and dcs.js):
   1. an Excel-style filter + sort button on every column heading
   2. "Edit columns" for the selected DCs: pick any sheet column (blank ones too), type a value once and it goes into every selected DC; every DC can also be typed one by one
   3. "Print / PDF / Excel" for the selected DCs: one row per item, laid out like the company's item sheet */

// ---------- 1. column filter + sort (heading button) ----------
let dcfOff = null;
function dcFilterClose() { const p = $('#dc-fpop'); if (p) p.remove(); if (dcfOff) { dcfOff(); dcfOff = null; } }
function dcFilterPop(key, anchor) {
  const same = $('#dc-fpop') && $('#dc-fpop').dataset.k === key; dcFilterClose(); if (same) return;
  const all = S.findRes || [], F = S.dcColF = S.dcColF || {}, others = Object.keys(F).filter(k => k !== key);
  const base = all.filter(r => others.every(k => F[k].includes(dcCellStr(r, k))));   // like Excel: the values left by the OTHER column filters
  const cnt = new Map(); for (const r of base) { const v = dcCellStr(r, key); cnt.set(v, (cnt.get(v) || 0) + 1); }
  const vals = [...cnt.keys()].sort((a, b) => !a ? 1 : !b ? -1 : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const on = new Set(F[key] ? F[key].filter(v => cnt.has(v)) : vals); let q = '';
  const p = document.createElement('div'); p.id = 'dc-fpop'; p.className = 'dc-fpop'; p.dataset.k = key;
  const partial = S.findTotal > all.length ? `<div class="hint">Values of the ${all.length.toLocaleString()} DCs loaded (of ${S.findTotal.toLocaleString()}). Search above, or press “Show more”, to bring the rest in.</div>` : '';
  p.innerHTML = `<div class="dcf-h">${esc(dcColName(key))}</div>
    <div class="dcf-s"><button type="button" data-s="1" class="${S.dcSort && S.dcSort.key === key && S.dcSort.dir > 0 ? 'on' : ''}">▲ Sort A → Z</button><button type="button" data-s="-1" class="${S.dcSort && S.dcSort.key === key && S.dcSort.dir < 0 ? 'on' : ''}">▼ Sort Z → A</button></div>
    <input type="search" class="dcf-q" placeholder="Search…" autocomplete="off">
    <label class="dcf-r dcf-all"><input type="checkbox" id="dcf-all"><span>(Select all)</span></label>
    <div class="dcf-list"></div>${partial}
    <div class="dcf-f"><button type="button" class="btn sm ghost" data-x="clear">Clear filter</button><span style="flex:1"></span><button type="button" class="btn sm" data-x="cancel">Cancel</button><button type="button" class="btn sm primary" data-x="ok">OK</button></div>`;
  document.body.appendChild(p);
  const list = $('.dcf-list', p), allc = $('#dcf-all', p), ok = $('[data-x="ok"]', p); let sv = [];
  const state = () => { allc.checked = !!sv.length && sv.every(v => on.has(v)); allc.indeterminate = !allc.checked && sv.some(v => on.has(v)); ok.disabled = !on.size; };
  const draw = () => {
    sv = vals.filter(v => !q || (v || '(blanks)').toLowerCase().includes(q));
    list.innerHTML = sv.map((v, i) => `<label class="dcf-r"><input type="checkbox" data-i="${i}" ${on.has(v) ? 'checked' : ''}><span title="${esc(v)}">${v ? esc(v) : '<i>(Blanks)</i>'}</span><small>${cnt.get(v)}</small></label>`).join('') || '<div class="hint" style="padding:8px 4px">No value found</div>';
    state();
  };
  list.onchange = e => { const i = e.target.dataset.i; if (i === undefined) return; const v = sv[+i]; e.target.checked ? on.add(v) : on.delete(v); state(); };
  allc.onchange = () => { sv.forEach(v => allc.checked ? on.add(v) : on.delete(v)); draw(); };
  $('.dcf-q', p).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  const apply = () => { if (vals.every(v => on.has(v))) delete F[key]; else F[key] = [...on]; dcFilterClose(); drawFind(); };
  p.onclick = e => {
    const s = e.target.closest('[data-s]'); if (s) { S.dcSort = { key, dir: +s.dataset.s }; dcFilterClose(); return drawFind(); }
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'ok') return apply();
    if (x.dataset.x === 'cancel') return dcFilterClose();
    delete F[key]; if (S.dcSort && S.dcSort.key === key) S.dcSort = null; dcFilterClose(); drawFind();
  };
  p.onkeydown = e => { if (e.key === 'Enter' && !ok.disabled) { e.preventDefault(); apply(); } };
  draw();
  const rc = anchor.getBoundingClientRect(), w = 264;
  p.style.left = Math.max(8, Math.min(rc.left - 12, innerWidth - w - 8)) + 'px';
  p.style.top = Math.max(8, Math.min(rc.bottom + 4, innerHeight - p.offsetHeight - 8)) + 'px';
  const out = e => { if (!p.contains(e.target) && !(e.target.closest && e.target.closest('[data-cfk]'))) dcFilterClose(); }, esc1 = e => { if (e.key === 'Escape') dcFilterClose(); };
  document.addEventListener('mousedown', out, true); document.addEventListener('keydown', esc1, true); window.addEventListener('resize', dcFilterClose);
  dcfOff = () => { document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', esc1, true); window.removeEventListener('resize', dcFilterClose); };
  setTimeout(() => { const i = $('.dcf-q', p); if (i) i.focus(); }, 0);
}

// ---------- 2. Edit columns (selected DCs) ----------
const DCG_STD = [['courier', 'Courier'], ['cn', 'CN no'], ['date', 'Dispatch date'], ['receivedBy', 'Received by'], ['parcelCount', 'Parcels dispatched'], ['notes', 'Notes']];
const dcgIsoDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
function dcgCur(r, k) {
  if (k === 'courier') return r.courier || ''; if (k === 'cn') return r.cn || ''; if (k === 'receivedBy') return r.receivedBy || ''; if (k === 'parcelCount') return r.parcelCount || ''; if (k === 'notes') return r.notes || '';
  if (k === 'date') return dcgIsoDay(r.updated) ? r.updated : '';
  const e = (r.sheet || r.details || []).find(x => 'd:' + x[0] === k); return e ? String(e[1]) : '';
}
function dcEditColsModal(rows) {
  if (!rows.length) return;
  const n = rows.length, sheetCols = []; { const seen = new Set(); for (const h of S.findCols || []) if (h && !seen.has(h) && !DC_NO_RE.test(h.trim())) { seen.add(h); sheetCols.push(['d:' + h, h]); }
    for (const r of rows) for (const [h] of (r.sheet || r.details || [])) if (h && !seen.has(h) && !DC_NO_RE.test(h.trim())) { seen.add(h); sheetCols.push(['d:' + h, h]); } }
  const every = [...DCG_STD, ...sheetCols], nameOf = k => (every.find(c => c[0] === k) || [0, k])[1];
  const blank = k => rows.every(r => !String(dcgCur(r, k)).trim());
  const cols = [], val = rows.map(() => ({}));
  const get = (i, k) => val[i][k] !== undefined ? val[i][k] : dcgCur(rows[i], k);
  const dirty = (i, k) => val[i][k] !== undefined && String(val[i][k]).trim() !== String(dcgCur(rows[i], k)).trim();
  const local = rows.every(r => r.edit && r.edit.local), opt = ([k, l]) => `<option value="${esc(k)}">${esc(l)}${blank(k) ? '  · blank' : ''}</option>`;
  const orgs = [...new Set(rows.map(r => r.organization || r.company).filter(Boolean))].slice(0, 3);
  const bg = modal(`<div class="dce-h"><div class="dce-ic">${ic('edit')}</div><div style="min-width:0"><h3>Edit columns</h3><div class="dce-sub"><span class="dce-chip"><b>${n}</b> DC${n === 1 ? '' : 's'} selected</span>${orgs.map(c => `<span class="dce-chip">${esc(c)}</span>`).join('')}</div></div></div>
    <div class="dce-body">
      <div class="dcg-top"><div class="dce-sec">Add one value to all ${n} DC${n === 1 ? '' : 's'}</div>
        <div class="dcg-fill"><select id="dg-col"><option value="">Choose a column…</option><optgroup label="Dispatch fields">${DCG_STD.map(opt).join('')}</optgroup>${sheetCols.length ? `<optgroup label="Columns of the sheet (blank ones too)">${sheetCols.map(opt).join('')}</optgroup>` : ''}</select>
          <input id="dg-val" placeholder="Type what to add…" autocomplete="off"><button class="btn primary" id="dg-add">Add to all ${n}</button></div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="dg-blank"><span>Only where the cell is blank</span></label>
        <div class="hint" style="margin-top:6px">Choose a column, type a value and press <b>Add</b>: it is put into every selected DC. The column appears in the table below, where you can also type or change the cell of each DC by hand (paste a column from Excel into the first cell and it fills downwards).</div></div>
      <div class="dcg-wrap" id="dg-wrap"></div>
      <div class="dce-note"><span class="dce-dot ${local ? 'off' : ''}"></span><div>${local ? 'These sheets were uploaded by hand, so only the app is updated.' : `Saving writes the changed cells into the company's Excel sheet${n === 1 ? '' : 's'} too.`}</div></div>
      <div class="dce-res" id="dg-res" hidden></div>
    </div>
    <div class="dce-ft"><span class="grow" id="dg-cnt"></span><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save changes</button></div>`, (bg, close) => {
    bg.firstChild.classList.add('dce', 'dcg');
    const wrap = $('#dg-wrap', bg), cnt = () => { let c = 0; rows.forEach((_, i) => cols.forEach(k => { if (dirty(i, k)) c++; })); $('#dg-cnt', bg).textContent = c ? `${c} cell${c === 1 ? '' : 's'} to change` : 'No changes yet'; };
    const draw = () => {
      if (!cols.length) { wrap.innerHTML = '<div class="hint" style="padding:16px">No column chosen yet. Pick one above.</div>'; return cnt(); }
      wrap.innerHTML = `<table class="dcg-t"><thead><tr><th class="dcg-id">DC</th>${cols.map(k => `<th>${esc(nameOf(k))}<button type="button" class="dcg-x" data-rm="${esc(k)}" title="Remove this column from the table">×</button></th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => { const d = dcNoOf(r) || r.po || r.orderId; return `<tr><td class="dcg-id" title="${esc(r.organization || r.company || '')}"><b>${esc(d)}</b>${r.po && d !== r.po ? `<small>PO ${esc(r.po)}</small>` : ''}</td>${cols.map(k => `<td><input data-r="${i}" data-k="${esc(k)}" type="${k === 'date' ? 'date' : 'text'}" value="${esc(get(i, k))}" class="${dirty(i, k) ? 'dirty' : ''}" autocomplete="off"></td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
      cnt();
    };
    const addCol = k => { if (k && !cols.includes(k)) { cols.push(k); draw(); } };
    const sel = $('#dg-col', bg), vin = $('#dg-val', bg);
    sel.onchange = () => { vin.type = sel.value === 'date' ? 'date' : 'text'; vin.value = ''; addCol(sel.value); };
    const fill = () => {
      const k = sel.value, v = vin.value.trim(); if (!k) return toast('Choose a column first', true); if (!v) return toast('Type the value to add', true);
      addCol(k); const onlyBlank = $('#dg-blank', bg).checked; let c = 0;
      rows.forEach((r, i) => { if (onlyBlank && String(get(i, k)).trim()) return; val[i][k] = v; c++; }); draw();
      toast(c ? `Added to ${c} DC${c === 1 ? '' : 's'} — press Save changes to keep it` : 'Every cell already has a value');
    };
    $('#dg-add', bg).onclick = fill; vin.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fill(); } };
    wrap.oninput = e => { const t = e.target; if (!t.dataset || t.dataset.r === undefined) return; val[+t.dataset.r][t.dataset.k] = t.value; t.classList.toggle('dirty', dirty(+t.dataset.r, t.dataset.k)); cnt(); };
    wrap.onclick = e => { const x = e.target.closest('[data-rm]'); if (!x) return; const k = x.dataset.rm; cols.splice(cols.indexOf(k), 1); val.forEach(v => delete v[k]); draw(); };
    wrap.onkeydown = e => { // Enter = the same column, next DC
      if (e.key !== 'Enter' || !e.target.dataset || e.target.dataset.r === undefined) return; e.preventDefault();
      const nx = $(`input[data-r="${+e.target.dataset.r + 1}"][data-k="${CSS.escape(e.target.dataset.k)}"]`, wrap); if (nx) { nx.focus(); nx.select(); }
    };
    wrap.onpaste = e => { // several lines (a column copied from Excel) fill the DCs below, starting at this one
      const t = e.target; if (!t.dataset || t.dataset.r === undefined) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text'), ls = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n'); if (ls.length < 2) return;
      e.preventDefault(); const k = t.dataset.k; ls.forEach((l, j) => { const i = +t.dataset.r + j; if (i < rows.length) val[i][k] = l.split('\t')[0].trim(); }); draw(); toast(`Pasted ${Math.min(ls.length, rows.length - +t.dataset.r)} cells`);
    };
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const items = []; rows.forEach((r, i) => { const cells = {}; for (const k of cols) if (dirty(i, k)) cells[k] = String(val[i][k]).trim(); if (Object.keys(cells).length) items.push({ src: r.src, row: r.row, orderId: r.orderId, cells }); });
      if (!items.length) return toast('Nothing changed');
      const b = $('#sv', bg), txt = b.textContent; b.disabled = true; b.textContent = 'Saving…';
      try {
        const res = await api('/dc/cells', { method: 'POST', body: { items } }), all = S.findRes || [];
        for (const x of res.results) if (x.row) {
          const idx = all.findIndex(y => y.src === x.row.src && String(y.row) === String(x.row.row) && y.orderId === x.row.orderId); if (idx >= 0) all[idx] = { ...x.row, chat: all[idx].chat };
          if (x.ok) { const ri = rows.findIndex(y => dcKey(y) === x.key); if (ri >= 0) { rows[ri] = all[idx] || { ...x.row }; val[ri] = {}; } }
        }
        const bad = res.results.filter(x => !x.ok); drawFind(); loadOrdersQuiet();
        if (!bad.length) { close(); toast(`${res.done} DC${res.done === 1 ? '' : 's'} updated${local ? '' : ' — and saved in the Excel sheet'}`); return; }
        draw(); const rb = $('#dg-res', bg); rb.hidden = false; rb.innerHTML = `<b style="font-size:12.5px">${res.done} updated, ${bad.length} not updated:</b>` + bad.map(x => `<div>${esc(x.label)} — ${esc(x.error)}</div>`).join('');
        b.disabled = false; b.textContent = txt;
      } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = txt; }
    };
    draw();
  });
  return bg;
}

// ---------- 3. Print / PDF / Excel of the selected DCs (one row per item) ----------
// The Print / PDF / Excel buttons at the top of the Orders box use this when DCs are ticked in the table.
const dcpNum = (v, i) => typeof v === 'number' ? (i === 0 ? String(v) : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : (v == null ? '' : String(v));
function dcpHtml(d) {
  const CEN = new Set([0, 2, 5, 8, 9, 10, 11, 13]), RT = new Set([3, 4, 6, 7]);
  const head = d.header.map(h => `<th>${esc(h)}</th>`).join('');
  const body = d.rows.map(r => `<tr class="${r.total ? 'tot' : ''}">${r.cells.map((v, i) => `<td class="${CEN.has(i) ? 'c' : RT.has(i) ? 'r' : ''}">${esc(dcpNum(v, i)).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>DC items</title><style>
    :root{color-scheme:light}@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}html,body{background:#fff!important;color:#111!important}body{font:9px Arial,sans-serif;margin:0;padding:12px}
    h1{font-size:14px;margin:0 0 2px}.sub{color:#555;margin-bottom:8px}.note{color:#b45309;margin-bottom:8px}
    table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #999;padding:3px 4px;vertical-align:middle;word-wrap:break-word}
    th{background:#d9d9d9;font-style:italic;font-size:8.5px;text-align:center}td.c{text-align:center}td.r{text-align:right}tr.tot td{background:#d9d9d9;font-weight:700}
    thead{display:table-header-group}tr{page-break-inside:avoid}.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:8px 10px;background:#eef6f4;border-radius:8px}.bar button{padding:6px 14px;font-weight:700;cursor:pointer}
    @media print{.bar{display:none}body{padding:0}}</style></head><body>
    <div class="bar"><span>Choose <b>Save as PDF</b> as the printer to get a PDF file.</span><button onclick="window.print()">Print / Save as PDF</button></div>
    <h1>DC items${d.business ? ' · ' + esc(d.business) : ''}</h1><div class="sub">${new Date().toISOString().slice(0, 10)} · ${d.dcs} DC${d.dcs === 1 ? '' : 's'}${d.item ? ` · only items matching <b>${esc(d.item)}</b>` : ''}</div>
    ${d.missing.length ? `<div class="note">No items found for: ${esc(d.missing.slice(0, 20).join(', '))}${d.missing.length > 20 ? ' …' : ''}</div>` : ''}
    <table><colgroup>${[5.4, 21, 5, 6.5, 8, 5, 6.5, 8.5, 6.5, 7.4, 7.8, 6.5, 16, 5.5, 9, 9].map(w => `<col style="width:${w}%">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>addEventListener('keydown',function(e){if(e.key==='Escape')window.close()});addEventListener('afterprint',function(){setTimeout(function(){window.close()},150)})</script></body></html>`;
}
// the DCs ticked in the table (same rows the bulk bar works on)
function dcSelectedRows() { try { return typeof dcVis === 'function' && S.dcSel && S.dcSel.size ? dcVis().filter(r => S.dcSel.has(dcKey(r))) : []; } catch { return []; } }
// f = 'print' | 'pdf' | 'xlsx': one row per item of the given DCs
async function dcItemsRun(rows, f) {
  if (!rows.length) return;
  const iq = typeof odItemQ === 'function' ? odItemQ() : '';   // "Search by item" is active: only that item is printed / exported
  let w = null;
  if (f === 'print') { w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups for this site to print', true); w.document.write('<p style="font:14px Arial;padding:24px">Preparing the items…</p>'); }
  toast('Preparing ' + rows.length + ' DC' + (rows.length === 1 ? '' : 's') + '…');
  try {
    const r = await fetch('/api/dc/items-export', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ format: f === 'print' ? 'json' : f, item: iq, items: rows.map(x => ({ src: x.src, row: x.row, orderId: x.orderId })) }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Could not prepare the items'); }
    let miss = [];
    if (f === 'print') { const d = await r.json(); miss = d.missing || []; if (!d.rows.length) throw new Error(iq ? `No DC has an item matching "${iq}".` : 'No items found.'); w.document.open(); w.document.write(dcpHtml(d)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 500); }
    else {
      const blob = await r.blob(), a = document.createElement('a'), cd = r.headers.get('Content-Disposition') || '', nm = (/filename="([^"]+)"/.exec(cd) || [])[1] || `dc-items.${f}`;
      miss = decodeURIComponent(r.headers.get('X-DC-Missing-List') || '').split(', ').filter(Boolean); if (+r.headers.get('X-DC-Missing') > miss.length) miss.push('…');
      a.href = URL.createObjectURL(blob); a.download = nm; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    if (miss.length) toast(`No items were found for: ${miss.slice(0, 8).join(', ')}. They are listed without items.`, true);
    else toast(f === 'print' ? 'Opened for printing' : 'File downloaded');
  } catch (err) { if (w) { try { w.close(); } catch {} } toast(err.message, true); }
}
