/* Quotations: make a quotation on your own letterhead, preview it as a PDF, and send it by email / WhatsApp.
   Everyone on the team can use it and change the letterhead. The date is filled in automatically. */
ICONS.doc = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>';

const QT_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const qtDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}-${QT_MON[+m[2] - 1]}-${m[1]}` : (iso || ''); };
const qtMoney = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtRound = n => Math.round((Number(n) || 0) * 100) / 100;
function qtTotals(items) {
  let sub = 0, gst = 0;
  const rows = (items || []).map(i => { const base = qtRound((+i.qty || 0) * (+i.price || 0)), tax = qtRound(base * (+i.gst || 0) / 100); sub += base; gst += tax; return qtRound(base + tax); });
  return { rows, sub: qtRound(sub), gst: qtRound(gst), total: qtRound(sub + gst) };
}
const QT_DEF = [['desc', 'Description'], ['qty', 'Qty'], ['unit', 'Unit'], ['price', 'Unit price'], ['gst', 'GST %'], ['total', 'Total'], ['x1', 'Custom 1'], ['x2', 'Custom 2'], ['x3', 'Custom 3'], ['x4', 'Custom 4']], QT_FIXED = ['desc', 'price', 'total'];
const QT_W = { qty: 38, unit: 48, price: 72, gst: 44, total: 78, x1: 74, x2: 74, x3: 74, x4: 74 }; // usual widths on the PDF, in points
// columns = an ordered list { k, on, l, w, a, sz, b } (which column, shown or not, its heading, width in points (0 = automatic), alignment (l / c / r, '' = usual), font size (0 = table size), bold).
// Older saves used plain on/off, so both are read.
const qtSt = e => ({ w: +e.w > 0 ? Math.min(300, Math.round(+e.w)) : 0, a: ['l', 'c', 'r'].includes(e.a) ? e.a : '', sz: +e.sz > 0 ? +e.sz : 0, b: e.b !== false && e.b !== 0 });
const qtLayout = v => { const lab = Object.fromEntries(QT_DEF), old = v && !Array.isArray(v) ? v : null, out = [], seen = {}; (Array.isArray(v) ? v : []).forEach(e => { if (e && lab[e.k] && !seen[e.k]) { seen[e.k] = 1; out.push({ k: e.k, on: QT_FIXED.includes(e.k) || e.on !== false, l: String(e.l || '').trim() || lab[e.k], ...qtSt(e) }); } }); QT_DEF.forEach(([k, l]) => { if (!seen[k]) out.push({ k, l, on: QT_FIXED.includes(k) || (old ? old[k] !== false : !k.startsWith('x')), ...qtSt({}) }); }); return out; };
const qtFlags = v => Object.fromEntries(qtLayout(v).map(e => [e.k, e.on]));
// table style + which blocks of the form are printed (the "Customize layout" settings)
const QT_LY = { headFill: '', headText: '#ffffff', headSize: 8.6, headH: 22, rowFill: '#f2f2f2', rowSize: 8.8, minRow: 20, grid: true, vlines: true, lineColor: '#cccccc', sec: { quoteTo: true, meta: true, breakdown: true, thanks: true, regards: true, signature: true, terms: true } };
const qtLy = v => { v = v && typeof v === 'object' ? v : {}; return { ...QT_LY, ...v, sec: { ...QT_LY.sec, ...(v.sec || {}) } }; };
const QT_SEC = [['quoteTo', '“Quote to” address'], ['meta', 'Quote date, valid for and quotation number'], ['breakdown', 'Subtotal and GST lines above the total'], ['thanks', 'Thank-you line'], ['regards', 'Regards and name'], ['signature', 'Signature line and stamp'], ['terms', 'Terms & Instructions']];

// the column list: tick the columns you need, rename the headings, re-order. With o.detail every column also gets its own width, alignment, text size and bold.
// L is changed in place, so the caller always holds the current list. o: { detail, off() , onChange() }
function qtColList(el, L, o) {
  o = o || {}; const def = Object.fromEntries(QT_DEF), ch = () => o.onChange && o.onChange();
  const draw = () => {
    const off = o.off && o.off();
    el.classList.toggle('qt-dim', !!off);
    el.innerHTML = L.map((e, i) => { const fx = QT_FIXED.includes(e.k), cx = e.k.startsWith('x');
      return `<div class="qt-ce" data-i="${i}"><div class="qt-ce1"><input type="checkbox" data-on ${e.on ? 'checked' : ''} ${fx || off ? 'disabled' : ''} title="${fx ? 'This column always shows' : 'Show this column'}"><input type="text" data-l maxlength="20" value="${esc(e.l)}" placeholder="${esc(def[e.k])}${cx ? ' (free text)' : ''}" ${off ? 'disabled' : ''}><span class="row" style="gap:4px"><button type="button" class="btn sm" data-mv="-1" ${i === 0 || off ? 'disabled' : ''}>↑</button><button type="button" class="btn sm" data-mv="1" ${i === L.length - 1 || off ? 'disabled' : ''}>↓</button></span></div>
      ${o.detail ? `<div class="qt-cd ${e.on ? '' : 'qt-cd-off'}"><label>Width<input type="number" data-w min="0" max="300" placeholder="${e.k === 'desc' ? 'rest' : QT_W[e.k]}" value="${e.w || ''}" ${e.k === 'desc' ? 'disabled' : ''}></label><label>Align<select data-a>${[['', 'Auto'], ['l', 'Left'], ['c', 'Centre'], ['r', 'Right']].map(([v, t]) => `<option value="${v}" ${e.a === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Text size<input type="number" data-sz min="6" max="14" step="0.5" placeholder="table" value="${e.sz || ''}"></label><label class="qchk"><input type="checkbox" data-b ${e.b !== false ? 'checked' : ''}> Bold</label></div>` : ''}</div>`; }).join('');
  };
  el.oninput = el.onchange = e => {
    const r = e.target.closest('.qt-ce'); if (!r || o.off && o.off()) return; const c = L[+r.dataset.i], t = e.target;
    if (t.matches('[data-on]')) { c.on = QT_FIXED.includes(c.k) || t.checked; const d = $('.qt-cd', r); if (d) d.classList.toggle('qt-cd-off', !c.on); }
    else if (t.matches('[data-l]')) c.l = t.value;
    else if (t.matches('[data-w]')) c.w = Math.max(0, Math.min(300, Math.round(+t.value || 0)));
    else if (t.matches('[data-a]')) c.a = t.value;
    else if (t.matches('[data-sz]')) c.sz = Math.max(0, Math.min(14, +t.value || 0));
    else if (t.matches('[data-b]')) c.b = t.checked; else return;
    ch();
  };
  el.onclick = e => { const b = e.target.closest('[data-mv]'); if (!b || b.disabled) return; const i = +b.closest('.qt-ce').dataset.i, j = i + +b.dataset.mv; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; draw(); ch(); };
  draw(); return { draw };
}
// QuickBooks-style "Customize layout" window: Columns (each column's own cell settings), Table style and Sections, with a live PDF preview.
// cur / lay = the current columns and layout; sample() = the form to preview (items, Quote-to ... ). Resolves with { cols, layout } or null.
function qtDesign(cur, lay, title, sample) {
  return new Promise(ok => modal(`<h3>${esc(title || 'Customize layout')}</h3>
    <div class="qd"><div class="qd-side">
      <div class="qd-tabs"><button type="button" class="on" data-t="cols">Columns</button><button type="button" data-t="style">Table style</button><button type="button" data-t="sec">Sections</button></div>
      <div class="qd-pane" data-p="cols"><p class="hint" style="margin:0 0 10px">Tick the columns this quotation needs, rename the headings and drag them into order with the arrows. Under each column you can set its width, alignment, text size and bold. “Custom” columns are free text (for example Brand, Size, Remarks).</p><div id="qd-cl"></div></div>
      <div class="qd-pane" data-p="style" hidden>
        <div class="qd-g"><div class="qd-h">Heading row</div>
          <label class="qchk"><input type="checkbox" id="qd-hfa"> Same colour as the letterhead</label><label>Heading colour<input type="color" id="qd-hf"></label>
          <label>Heading text colour<input type="color" id="qd-ht"></label><label>Heading text size<input type="number" id="qd-hs" min="5.5" max="14" step="0.5"></label><label>Heading height<input type="number" id="qd-hh" min="16" max="44"></label></div>
        <div class="qd-g"><div class="qd-h">Item rows</div>
          <label class="qchk"><input type="checkbox" id="qd-rfa"> Shade the rows</label><label>Row colour<input type="color" id="qd-rf"></label>
          <label>Text size<input type="number" id="qd-rs" min="6" max="14" step="0.5"></label><label>Smallest row height<input type="number" id="qd-rm" min="14" max="80"></label></div>
        <div class="qd-g"><div class="qd-h">Lines</div>
          <label class="qchk"><input type="checkbox" id="qd-gr"> Box around every row</label><label class="qchk"><input type="checkbox" id="qd-vl"> Lines between the columns</label><label>Line colour<input type="color" id="qd-lc"></label></div>
      </div>
      <div class="qd-pane" data-p="sec" hidden><p class="hint" style="margin:0 0 10px">Choose which parts of the quotation form are printed.</p>${QT_SEC.map(([k, l]) => `<label class="qchk qd-sec"><input type="checkbox" data-sec="${k}"> ${l}</label>`).join('')}</div>
    </div>
    <div class="qd-prev"><div class="qd-ph"><b>Live preview</b> <span class="hint" id="qd-st"></span></div><iframe id="qd-if" title="Preview"></iframe></div></div>
    <div class="acts"><button class="btn" id="qd-reset" style="margin-right:auto" title="Back to the standard columns and look">Reset</button><button class="btn" id="cx">Cancel</button><button class="btn primary" id="qd-ok">Done</button></div>`, (bg, close) => {
    const md = $('.modal', bg); md.classList.add('qd-modal'); let L = qtLayout(cur), Y = qtLy(lay), done = false, url = '', tm = 0, seq = 0;
    const fin = v => { if (done) return; done = true; clearTimeout(tm); if (url) URL.revokeObjectURL(url); close(); ok(v); };
    const g = id => $('#' + id, bg);
    // preview
    const preview = async () => {
      const my = ++seq, st = g('qd-st'); st.textContent = 'updating…';
      try {
        const r = await fetch('/api/quotes/preview', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sample(), cols: L, layout: Y }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Could not make the preview'); }
        const b = await r.blob(); if (my !== seq || done) return; const u = URL.createObjectURL(b); g('qd-if').src = u + '#toolbar=0&navpanes=0&view=FitH'; if (url) URL.revokeObjectURL(url); url = u; st.textContent = '';
      } catch (e) { if (my === seq) st.textContent = e.message; }
    };
    const later = () => { clearTimeout(tm); tm = setTimeout(preview, 450); };
    const list = qtColList(g('qd-cl'), L, { detail: true, onChange: later });
    // table style + sections: fields <-> Y
    const paint = () => {
      g('qd-hfa').checked = !Y.headFill; g('qd-hf').value = Y.headFill || (sample().head || S.qt.cfg).color || '#2e75b6'; g('qd-hf').disabled = !Y.headFill; g('qd-ht').value = Y.headText; g('qd-hs').value = Y.headSize; g('qd-hh').value = Y.headH;
      g('qd-rfa').checked = !!Y.rowFill; g('qd-rf').value = Y.rowFill || '#f2f2f2'; g('qd-rf').disabled = !Y.rowFill; g('qd-rs').value = Y.rowSize; g('qd-rm').value = Y.minRow;
      g('qd-gr').checked = Y.grid; g('qd-vl').checked = Y.vlines; g('qd-vl').disabled = !Y.grid; g('qd-lc').value = Y.lineColor;
      $$('[data-sec]', bg).forEach(c => { c.checked = Y.sec[c.dataset.sec] !== false; });
    };
    const read = () => {
      Y.headFill = g('qd-hfa').checked ? '' : g('qd-hf').value; Y.headText = g('qd-ht').value; Y.headSize = +g('qd-hs').value || QT_LY.headSize; Y.headH = +g('qd-hh').value || QT_LY.headH;
      Y.rowFill = g('qd-rfa').checked ? g('qd-rf').value : ''; Y.rowSize = +g('qd-rs').value || QT_LY.rowSize; Y.minRow = +g('qd-rm').value || QT_LY.minRow;
      Y.grid = g('qd-gr').checked; Y.vlines = g('qd-vl').checked; Y.lineColor = g('qd-lc').value; $$('[data-sec]', bg).forEach(c => { Y.sec[c.dataset.sec] = c.checked; });
      g('qd-hf').disabled = !!g('qd-hfa').checked; g('qd-rf').disabled = !g('qd-rfa').checked; g('qd-vl').disabled = !Y.grid;
    };
    $$('.qd-pane[data-p=style] input, .qd-pane[data-p=sec] input', bg).forEach(i => { i.oninput = i.onchange = () => { read(); later(); }; });
    $$('.qd-tabs button', bg).forEach(b => { b.onclick = () => { $$('.qd-tabs button', bg).forEach(x => x.classList.toggle('on', x === b)); $$('.qd-pane', bg).forEach(p => { p.hidden = p.dataset.p !== b.dataset.t; }); }; });
    g('qd-reset').onclick = () => { L.splice(0, L.length, ...qtLayout(null)); Y = qtLy(null); list.draw(); paint(); preview(); };
    g('cx').onclick = () => fin(null); g('qd-ok').onclick = () => fin({ cols: qtLayout(L), layout: qtLy(Y) });
    paint(); preview();
  }));
}
// a made-up quotation used by the live preview of Customize layout (every column filled in)
const qtSample = () => ({ no: 'SAMPLE-0001', date: new Date().toISOString().slice(0, 10), validDays: S.qt.cfg.validDays, thanks: S.qt.cfg.thanks, terms: S.qt.cfg.terms,
  items: [{ desc: 'Sample item with a longer description that wraps onto a second line', qty: 12, unit: 'EACH', price: 1500, gst: qtGst(''), x1: 'Sample 1', x2: 'Sample 2', x3: 'Sample 3', x4: 'Sample 4' }, { desc: 'Second sample item', qty: 100, unit: 'PKT', price: 80.5, gst: qtGst(''), x1: 'Sample 1', x2: 'Sample 2', x3: 'Sample 3', x4: 'Sample 4' }, { desc: 'Third sample item', qty: 5, unit: 'EACH', price: 12000, gst: qtGst(''), x1: 'Sample 1', x2: 'Sample 2', x3: 'Sample 3', x4: 'Sample 4' }] });
// GST % a company's new items start with (its own, else the default)
const qtGst = id => { const c = ((S.qt && S.qt.companies) || []).find(x => x.id === id); return c && c.gst != null ? c.gst : S.qt.cfg.gst; };
const qtClone = o => JSON.parse(JSON.stringify(o));

// ---------- the list ----------
async function viewQuotes() {
  if (!$('#main .page')) $('#main').innerHTML = `<div class="page">${pageHead('Quotations', 'Loading…')}<div class="card pad"><div class="hint">Loading…</div></div></div>`;
  let d; try { d = await api('/quotes'); } catch (e) { if (S.view === 'quotes') $('#main').innerHTML = `<div class="page"><div class="notice">${esc(e.message)}</div></div>`; return; }
  S.qt = d; if (S.view === 'quotes') qtRender();
}
function qtRender() {
  const d = S.qt, q = (S.qtQ || '').toLowerCase(), rows = d.quotes.filter(r => (!S.qtC || r.companyId === S.qtC) && (!q || `${r.no} ${r.to} ${r.by} ${r.company}`.toLowerCase().includes(q)));
  $('#main').innerHTML = `<div class="page">${pageHead('Quotations', 'Make a quotation on your letterhead and send the PDF by email or WhatsApp. The date is added for you.',
    `<button class="btn" id="qt-co">${ic('org')} ${isAdmin() ? 'Companies' : 'My companies'}</button>${isAdmin() ? `<button class="btn" id="qt-head">${ic('cog')} Letterhead</button>` : ''}<button class="btn" id="qt-bulk" title="Paste a list of items from Excel and make the quotation from it">${ic('list') || ''} Bulk add</button><button class="btn primary" id="qt-new">${ic('plus')} New quotation</button>`)}
    <div class="row" style="gap:10px;margin:0 0 14px"><input type="search" id="qt-q" placeholder="Search by number or customer…" value="${esc(S.qtQ || '')}" style="max-width:340px">${(d.companies || []).length ? `<select id="qt-cf" style="max-width:220px"><option value="">All companies</option>${d.companies.map(c => `<option value="${c.id}" ${S.qtC === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}<span class="hint">${d.quotes.length} quotation${d.quotes.length === 1 ? '' : 's'}</span></div>
    <div class="card">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Date</th><th>Company / quotation to</th><th style="text-align:right">Total</th><th>Sent</th><th>By</th><th style="width:1%"></th></tr></thead><tbody id="qt-body">
      ${rows.map(r => `<tr data-id="${r.id}" style="cursor:pointer"><td><b>${esc(r.no)}</b></td><td>${esc(qtDate(r.date))}</td><td>${r.company ? `<b>${esc(r.company)}</b>` : esc(r.to) || '<span class="hint">—</span>'}</td><td style="text-align:right;white-space:nowrap"><b>${esc(r.currency ? r.currency + ' ' : '')}${qtMoney(r.total)}</b></td>
        <td>${r.sentCount ? `<span class="pill green" title="${esc(r.lastSent ? r.lastSent.via + ' → ' + r.lastSent.to : '')}">Sent${r.sentCount > 1 ? ' ×' + r.sentCount : ''}</span>` : '<span class="pill">Draft</span>'}</td><td class="hint">${esc(r.by)}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-a="send">${ic('send')} Send</button> <button class="btn sm" data-a="pdf">${ic('down')} PDF</button> <button class="btn sm" data-a="copy" title="Make a copy with today's date">Copy</button> <button class="btn sm" data-a="del" title="Delete">${ic('trash')}</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty" style="padding:44px 20px;text-align:center"><b style="font-size:15px">${d.quotes.length ? 'No quotation matches your search' : 'No quotations yet'}</b><div class="hint" style="margin:6px 0 16px">${d.quotes.length ? '' : 'Press “New quotation” — your letterhead, today\'s date and your default terms are already filled in.'}</div></div>`}</div></div>`;
  $('#qt-new').onclick = () => { if (isAdmin()) return qtEdit(null); const mine = d.companies || []; if (!mine.length) return toast('No company is assigned to you yet. Ask the administrator.', true); qtEdit(null, (mine.find(c => c.id === S.qtC) || mine[0]).id); };
  $('#qt-bulk').onclick = () => qtBulk(S.qtC);
  if ($('#qt-head')) $('#qt-head').onclick = qtLetterhead; $('#qt-co').onclick = qtCompanies;
  if ($('#qt-cf')) $('#qt-cf').onchange = e => { S.qtC = e.target.value; qtRender(); };
  $('#qt-q').oninput = e => { S.qtQ = e.target.value; const pos = e.target.selectionStart; qtRender(); const el = $('#qt-q'); el.focus(); try { el.setSelectionRange(pos, pos); } catch {} };
  const body = $('#qt-body');
  if (body) body.onclick = async e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return; const id = tr.dataset.id, b = e.target.closest('button[data-a]');
    if (!b) return qtEdit(id);
    try {
      if (b.dataset.a === 'send') return qtSend(await api('/quotes/' + id));
      if (b.dataset.a === 'pdf') return window.open(`/api/quotes/${id}/pdf?token=${encodeURIComponent(S.token)}`, '_blank');
      if (b.dataset.a === 'copy') { await api(`/quotes/${id}/duplicate`, { method: 'POST' }); toast('Copy made, with today\'s date'); return viewQuotes(); }
      if (b.dataset.a === 'del') { if (!await gconfirm('Delete this quotation?')) return; await api('/quotes/' + id, { method: 'DELETE' }); toast('Deleted'); return viewQuotes(); }
    } catch (er) { toast(er.message, true); }
  };
}

// ---------- pictures: any image is turned into a JPEG in the browser (the PDF needs JPEG) ----------
function qtImg(file, max) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onerror = () => no(new Error('Could not read that file'));
    r.onload = () => { const im = new Image(); im.onerror = () => no(new Error('That file is not a picture')); im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.9));
    }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}

// ---------- the letterhead fields (used in the editor and in the Letterhead window) ----------
const QH_TEXT = [['title', 'Form title', 'QUOTATION FORM'], ['company', 'Company name', 'Your company'], ['address', 'Address', 'Street, area, city'], ['signer', 'Name under “Regards”', 'Your name'], ['signerCompany', 'Company under “Regards”', 'Your company'], ['currency', 'Currency shown with the totals (optional)', 'PKR']];
function qhFields(h, p) {
  return `<div class="grid g2" style="gap:0 14px">${QH_TEXT.slice(0, 3).map(([k, l, ph]) => `<div class="field" ${k === 'address' ? 'style="grid-column:1/-1"' : ''}><label>${l}</label><input type="text" id="${p}-${k}" value="${esc(h[k])}" placeholder="${esc(ph)}" autocomplete="off"></div>`).join('')}
    <div class="field" style="grid-column:1/-1"><label>More lines under the address <span class="hint">(one per line, e.g. phone, UAN, NTN, email, website)</span></label><textarea id="${p}-lines" rows="3" style="min-height:70px">${esc(h.lines)}</textarea></div>
    ${QH_TEXT.slice(3).map(([k, l, ph]) => `<div class="field"><label>${l}</label><input type="text" id="${p}-${k}" value="${esc(h[k])}" placeholder="${esc(ph)}" autocomplete="off"></div>`).join('')}
    <div class="field"><label>Colour</label><input type="color" id="${p}-color" value="${esc(h.color || '#2e75b6')}" style="height:40px;padding:3px 6px;width:90px"></div></div>
    <div class="grid g2" style="gap:14px">${[['logo', 'Logo', 'Shown at the top right'], ['signature', 'Signature / stamp', 'Shown above the “Signature” line']].map(([k, l, s]) => `<div class="qt-img"><div class="qt-thumb" id="${p}-${k}-t">${h[k] ? `<img src="${h[k]}" alt="">` : '<span class="hint">None</span>'}</div><div><b style="font-size:13px">${l}</b><div class="hint" style="margin-bottom:8px">${s}</div>
      <label class="btn sm" style="cursor:pointer">${ic('up')} Choose picture<input type="file" accept="image/*" id="${p}-${k}-f" hidden></label> <button type="button" class="btn sm" id="${p}-${k}-x" ${h[k] ? '' : 'hidden'}>Remove</button></div></div>`).join('')}</div>`;
}
function qhBind(bg, p, H) { // H: the object holding logo / signature while the window is open
  for (const [k, max] of [['logo', 700], ['signature', 600]]) {
    const t = $(`#${p}-${k}-t`, bg), x = $(`#${p}-${k}-x`, bg), paint = () => { t.innerHTML = H[k] ? `<img src="${H[k]}" alt="">` : '<span class="hint">None</span>'; x.hidden = !H[k]; };
    $(`#${p}-${k}-f`, bg).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { H[k] = await qtImg(f, max); paint(); } catch (er) { toast(er.message, true); } };
    x.onclick = () => { H[k] = ''; paint(); };
  }
}
function qhSet(bg, p, H, h) { // put another letterhead into the fields (when a different company is picked)
  H.logo = h.logo || ''; H.signature = h.signature || '';
  for (const [k] of QH_TEXT) $(`#${p}-${k}`, bg).value = h[k] || ''; $(`#${p}-lines`, bg).value = h.lines || ''; $(`#${p}-color`, bg).value = h.color || '#2e75b6';
  for (const k of ['logo', 'signature']) { $(`#${p}-${k}-t`, bg).innerHTML = H[k] ? `<img src="${H[k]}" alt="">` : '<span class="hint">None</span>'; $(`#${p}-${k}-x`, bg).hidden = !H[k]; }
}
function qhRead(bg, p, H) {
  const o = { logo: H.logo || '', signature: H.signature || '', lines: $(`#${p}-lines`, bg).value, color: $(`#${p}-color`, bg).value };
  for (const [k] of QH_TEXT) o[k] = $(`#${p}-${k}`, bg).value; return o;
}

// ---------- Letterhead window: the shared details every new quotation starts from ----------
function qtLetterhead() {
  let lhCols = qtLayout(S.qt.cfg.cols), lhLay = qtLy(S.qt.cfg.layout);
  const c = qtClone(S.qt.cfg), H = { logo: c.logo, signature: c.signature };
  modal(`<h3>Letterhead &amp; defaults</h3><p class="hint" style="margin:-8px 0 14px">Everyone on the team can change this. New quotations start from these details; quotations you already made keep their own copy.</p>
    ${qhFields(c, 'lh')}
    <div class="h3" style="margin:18px 0 8px;font-size:14px">Defaults for new quotations</div>
    <div class="grid g2" style="gap:0 14px"><div class="field"><label>Valid for (days)</label><input type="number" id="lh-valid" min="0" value="${esc(c.validDays)}"></div><div class="field"><label>GST % on new items</label><input type="number" id="lh-gst" min="0" step="any" value="${esc(c.gst)}"></div>
    <div class="field"><label>Unit on new items</label><input type="text" id="lh-unit" value="${esc(c.unit)}" placeholder="EACH"></div><div class="field"><label>Quotation number starts with</label><input type="text" id="lh-prefix" value="${esc(c.prefix)}" placeholder="QT-"></div>
    <div class="field"><label>Next number</label><input type="number" id="lh-next" min="1" value="${esc(c.next)}"></div></div>
    <div class="qt-ticks"><button type="button" class="btn sm" id="lh-colbtn">${ic('cog')} Columns &amp; layout…</button><span class="hint">Default columns and look for new quotations: show, hide, rename, re-order, size each column, change colours, or add your own text columns.</span></div>
    <div class="field" style="margin-top:10px"><label>Thank-you line</label><input type="text" id="lh-thanks" value="${esc(c.thanks)}"></div>
    <div class="field"><label>Terms &amp; Instructions <span class="hint">(one per line)</span></label><textarea id="lh-terms" rows="4">${esc(c.terms)}</textarea></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="lh-save">Save letterhead</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '720px'; $('#cx', bg).onclick = close; qhBind(bg, 'lh', H);
    $('#lh-colbtn', bg).onclick = async () => { const r = await qtDesign(lhCols, lhLay, 'Default columns & layout', () => ({ ...qtSample(), toLines: 'PROCUREMENT MANAGER\nSAMPLE COMPANY\nKarachi' })); if (r) { lhCols = r.cols; lhLay = r.layout; } };
    $('#lh-save', bg).onclick = async () => {
      const b = { ...qhRead(bg, 'lh', H), validDays: $('#lh-valid', bg).value, gst: $('#lh-gst', bg).value, unit: $('#lh-unit', bg).value, prefix: $('#lh-prefix', bg).value, next: $('#lh-next', bg).value, cols: lhCols, layout: lhLay, thanks: $('#lh-thanks', bg).value, terms: $('#lh-terms', bg).value };
      try { S.qt.cfg = await api('/quotes/cfg', { method: 'PUT', body: b }); toast('Letterhead saved'); close(); viewQuotes(); } catch (e) { toast(e.message, true); }
    };
  });
}

// ---------- the quotation editor ----------
async function qtEdit(id, companyId, pre) {
  let q; try { if (id) { q = await api('/quotes/' + id); if (!S.qt) S.qt = await api('/quotes'); } else { S.qt = await api('/quotes?company=' + encodeURIComponent(companyId || '')); q = qtClone(S.qt.blank); if (pre && pre.length) q.items = pre; } } catch (e) { return toast(e.message, true); } // a new one gets a fresh number, today's date and the current letterhead
  const H = { logo: q.head.logo, signature: q.head.signature }, items = q.items.length ? q.items : [{ desc: '', qty: 1, unit: S.qt.cfg.unit || 'EACH', price: 0, gst: qtFlags(q.cols).gst ? qtGst(q.companyId) : 0, x1: '', x2: '', x3: '', x4: '' }];
  const row = (it, i) => `<div class="qt-row" data-i="${i}"><textarea data-f="desc" data-c="desc" rows="1" placeholder="Description of the item">${esc(it.desc)}</textarea><input type="number" data-f="qty" data-c="qty" placeholder="Qty" title="Quantity" min="0" step="any" value="${esc(it.qty)}"><input type="text" data-f="unit" data-c="unit" placeholder="Unit" title="Unit" value="${esc(it.unit)}"><input type="number" data-f="price" data-c="price" placeholder="Unit price" title="Unit price" min="0" step="any" value="${esc(it.price)}"><input type="number" data-f="gst" data-c="gst" placeholder="GST %" title="GST %" min="0" max="100" step="any" value="${esc(it.gst)}"><input type="text" data-f="x1" data-c="x1" maxlength="80" value="${esc(it.x1 || '')}"><input type="text" data-f="x2" data-c="x2" maxlength="80" value="${esc(it.x2 || '')}"><input type="text" data-f="x3" data-c="x3" maxlength="80" value="${esc(it.x3 || '')}"><input type="text" data-f="x4" data-c="x4" maxlength="80" value="${esc(it.x4 || '')}"><div class="qt-tot" data-c="total" data-t></div><button type="button" class="btn sm" data-del title="Remove this item">${ic('x')}</button></div>`;
  modal(`<h3>${id ? 'Edit quotation' : 'New quotation'}</h3>
    <details class="qt-det" ${isAdmin() ? '' : 'hidden'}><summary>${ic('cog')} Letterhead — company name, address, logo, signature <span class="hint" id="qe-who">${esc(q.head.company)}</span></summary><div style="padding:14px 2px 2px">${qhFields(q.head, 'qh')}
      <div class="acts" style="justify-content:flex-start"><button type="button" class="btn sm" id="qe-deflh">Use this letterhead for all new quotations</button></div></div></details>
    <div class="field" style="margin-top:16px"><label>Company <span class="hint">${isAdmin() ? '(pick a saved company: its details and its own quotation number are filled in)' : '(only the companies assigned to you; its details and its own quotation number are filled in)'}</span></label><div class="row" style="gap:8px"><select id="qe-co" style="flex:1">${isAdmin() ? '<option value="">— One-off / not saved —</option>' : ''}${(S.qt.companies || []).map(c => `<option value="${c.id}" ${q.companyId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button type="button" class="btn sm" id="qe-cosave" ${isAdmin() ? '' : 'hidden'} title="Keep the Quote-to details below for next time">${ic('plus')} <span id="qe-cosave-t">Save as company</span></button></div></div>
    <div class="grid g2" style="gap:0 16px;margin-top:12px"><div class="field" style="grid-row:span 2"><label>Quote to <span class="hint">(one line each: name, company, address)</span></label><textarea id="qe-to" rows="5" placeholder="Procurement Manager&#10;Company name&#10;Address">${esc(q.toLines)}</textarea></div>
      <div class="grid g2" style="gap:0 12px"><div class="field"><label>Quote date</label><input type="date" class="qt-date" id="qe-date" value="${esc(q.date)}"></div><div class="field"><label>Valid for (days)</label><input type="number" id="qe-valid" min="0" value="${esc(q.validDays)}"></div>
      <div class="field" style="grid-column:1/-1"><label>Quotation number</label><input type="text" id="qe-no" value="${esc(q.no)}"></div></div></div>
    <div class="qt-ticks"><button type="button" class="btn sm" id="qe-colbtn">${ic('cog')} Columns &amp; layout…</button><span class="hint">Show, hide, rename, re-order and style the columns of this quotation.</span></div>
    <div class="qt-row qt-hd"><span data-c="desc" id="qh-desc">Description</span><span data-c="qty" id="qh-qty">Qty</span><span data-c="unit" id="qh-unit">Unit</span><span data-c="price" id="qh-price">Unit price</span><span data-c="gst" id="qh-gst">GST %</span><span data-c="x1" id="qh-x1">Custom 1</span><span data-c="x2" id="qh-x2">Custom 2</span><span data-c="x3" id="qh-x3">Custom 3</span><span data-c="x4" id="qh-x4">Custom 4</span><span data-c="total" id="qh-total" style="text-align:right">Total</span><span></span></div>
    <div id="qe-items">${items.map(row).join('')}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-start;margin:4px 0 16px;gap:14px;flex-wrap:wrap"><button type="button" class="btn sm" id="qe-add">${ic('plus')} Add item</button>
      <div class="qt-sum" id="qe-sum"></div></div>
    <div class="field"><label>Thank-you line</label><input type="text" id="qe-thanks" value="${esc(q.thanks)}"></div>
    <div class="field"><label>Terms &amp; Instructions <span class="hint">(one per line)</span></label><textarea id="qe-terms" rows="3">${esc(q.terms)}</textarea></div>
    <div class="acts" style="flex-wrap:wrap"><button class="btn" id="cx">Cancel</button><button class="btn" id="qe-prev">${ic('search')} Preview PDF</button><button class="btn" id="qe-save">Save</button><button class="btn primary" id="qe-send">${ic('send')} Save &amp; send</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '960px'; $('#cx', bg).onclick = close; qhBind(bg, 'qh', H);
    const list = $('#qe-items', bg), cur = () => ($('#qh-currency', bg).value || '').trim();
    const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(38, t.scrollHeight) + 'px'; };
    const read = () => $$('.qt-row[data-i]', list).map(r => { const o = {}; $$('[data-f]', r).forEach(el => o[el.dataset.f] = el.value); return o; });
    const recalc = () => {
      const it = read(), t = qtTotals(it); $$('.qt-row[data-i]', list).forEach((r, i) => { $('[data-t]', r).textContent = qtMoney(t.rows[i]); });
      $('#qe-sum', bg).innerHTML = `<div><span>Subtotal</span><b>${qtMoney(t.sub)}</b></div><div><span>GST</span><b>${qtMoney(t.gst)}</b></div><div class="big"><span>Total${cur() ? ' (' + esc(cur()) + ')' : ''}</span><b>${qtMoney(t.total)}</b></div>`;
    };
    $$('textarea[data-f]', list).forEach(grow); recalc();
    list.oninput = e => { if (e.target.tagName === 'TEXTAREA') grow(e.target); recalc(); };
    list.onclick = e => { const b = e.target.closest('[data-del]'); if (!b) return; const r = b.closest('.qt-row'); if ($$('.qt-row[data-i]', list).length === 1) { $$('[data-f]', r).forEach(el => { el.value = el.dataset.f === 'qty' ? 1 : el.dataset.f === 'desc' ? '' : el.dataset.f === 'price' ? 0 : el.value; }); grow($('textarea', r)); } else r.remove(); $$('.qt-row[data-i]', list).forEach((x, i) => x.dataset.i = i); recalc(); };
    $('#qe-add', bg).onclick = () => { const cfg = S.qt.cfg, d = document.createElement('div'); d.innerHTML = row({ desc: '', qty: 1, unit: cfg.unit || 'EACH', price: 0, gst: qtFlags(lay).gst ? qtGst(coSel.value) : 0, x1: '', x2: '', x3: '', x4: '' }, 0); const r = d.firstChild; r.dataset.i = $$('.qt-row[data-i]', list).length; list.appendChild(r); $('textarea', r).focus(); recalc(); };
    $('#qh-currency', bg).oninput = recalc; $('#qh-company', bg).oninput = e => { $('#qe-who', bg).textContent = e.target.value; };
    let lay = qtLayout(q.cols), layout = qtLy(q.layout); const md = $('.modal', bg);
    const applyCols = fix => { // show / hide / order / rename the columns; a switched-off Qty counts as 1 and GST as 0
      const f = qtFlags(lay), vis = lay.filter(e => e.on); QT_DEF.forEach(([k]) => md.classList.toggle('qt-off-' + k, !f[k]));
      lay.forEach((e, i) => { md.style.setProperty('--o-' + e.k, i); const h = $('#qh-' + e.k, bg); if (h) h.textContent = e.l; $$(`[data-f=${e.k}]`, list).forEach(x => { if (x.tagName === 'INPUT') x.placeholder = e.l; }); });
      const W = { desc: 'minmax(0,1fr)', qty: '64px', unit: '78px', price: '104px', gst: '64px', total: '108px', x1: '110px', x2: '110px', x3: '110px', x4: '110px' };
      md.style.setProperty('--qc', vis.map(e => W[e.k]).concat('34px').join(' '));
      if (fix) $$('.qt-row[data-i]', list).forEach(r => { if (!f.qty) $('[data-f=qty]', r).value = 1; if (!f.gst) $('[data-f=gst]', r).value = 0; else if (!+$('[data-f=gst]', r).value) $('[data-f=gst]', r).value = qtGst(coSel.value); });
      recalc();
    };
    $('#qe-colbtn', bg).onclick = async () => { const r = await qtDesign(lay, layout, 'Columns & layout of this quotation', () => collect()); if (r) { lay = r.cols; layout = r.layout; applyCols(true); } };
    applyCols(false);
    const coSel = $('#qe-co', bg), coBtn = $('#qe-cosave-t', bg), coName = () => ((S.qt.companies || []).find(c => c.id === coSel.value) || {}).name;
    const coSync = () => { coBtn.textContent = coSel.value ? 'Update ' + coName() : 'Save as company'; }; coSync();
    const was = id ? ((S.qt.quotes.find(r => r.id === id) || {}).companyId || '') : '';
    coSel.onchange = async () => { // take that company's saved details and its own next number; the items you typed stay
      coSync(); if (!coSel.value) return;
      let b; try { b = await api('/quotes/blank?company=' + encodeURIComponent(coSel.value)); } catch (e) { return toast(e.message, true); }
      $('#qe-to', bg).value = b.toLines; $('#qe-valid', bg).value = b.validDays; qhSet(bg, 'qh', H, b.head); $('#qe-who', bg).textContent = b.head.company; if (qtFlags(lay).gst) $$('.qt-row[data-i] [data-f=gst]', list).forEach(i => { i.value = qtGst(coSel.value); }); recalc(); lay = qtLayout(b.cols); layout = qtLy(b.layout); applyCols(true); $('#qe-thanks', bg).value = b.thanks; $('#qe-terms', bg).value = b.terms;
      if (coSel.value !== was) $('#qe-no', bg).value = b.no; else toast('Same company: the quotation number was kept');
    };
    $('#qe-cosave', bg).onclick = async () => {
      try {
        const lines = $('#qe-to', bg).value; if (!lines.trim()) return toast('Type the Quote-to details first', true);
        if (coSel.value) { const c = S.qt.companies.find(x => x.id === coSel.value); await api('/quotes/companies/' + c.id, { method: 'PUT', body: { toLines: lines } }); c.toLines = lines; return toast(c.name + ' updated: next time these details are filled in'); }
        const ls = lines.split('\n').map(x => x.trim()).filter(Boolean), nm = await qtAsk('Save as company', 'Company name', ls[1] || ls[0] || ''); if (!nm) return;
        const c = await api('/quotes/companies', { method: 'POST', body: { name: nm, toLines: lines } }); S.qt.companies.push(c); S.qt.companies.sort((a, b) => a.name.localeCompare(b.name));
        coSel.innerHTML = '<option value="">— One-off / not saved —</option>' + S.qt.companies.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(''); coSel.value = c.id; coSync(); toast(c.name + ' saved: pick it next time');
      } catch (e) { toast(e.message, true); }
    };
    const collect = () => ({ cols: lay, layout, companyId: $('#qe-co', bg).value, no: $('#qe-no', bg).value, date: $('#qe-date', bg).value, validDays: $('#qe-valid', bg).value, toLines: $('#qe-to', bg).value, items: read(), thanks: $('#qe-thanks', bg).value, terms: $('#qe-terms', bg).value, head: qhRead(bg, 'qh', H) });
    $('#qe-deflh', bg).onclick = async () => { const h = qhRead(bg, 'qh', H); try { S.qt.cfg = await api('/quotes/cfg', { method: 'PUT', body: h }); toast('New quotations will start with this letterhead'); } catch (e) { toast(e.message, true); } };
    $('#qe-prev', bg).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { await qtPreview(collect()); } catch (er) { toast(er.message, true); } finally { b.disabled = false; } };
    const save = async btn => { btn.disabled = true; try { const body = collect(); const r = await api(id ? '/quotes/' + id : '/quotes', { method: id ? 'PUT' : 'POST', body }); return r; } catch (e) { toast(e.message, true); return null; } finally { btn.disabled = false; } };
    $('#qe-save', bg).onclick = async e => { const r = await save(e.currentTarget); if (r) { toast('Saved'); close(); viewQuotes(); } };
    $('#qe-send', bg).onclick = async e => { const r = await save(e.currentTarget); if (r) { close(); viewQuotes(); qtSend(r); } };
  });
}

// the PDF as drawn from the form right now
async function qtPreview(body) {
  const r = await fetch('/api/quotes/preview', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'Could not make the preview'); }
  const url = URL.createObjectURL(await r.blob());
  modal(`<div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Preview</h3><div class="row" style="gap:8px"><a class="btn sm" href="${url}" target="_blank" rel="noopener">Open in a new tab</a><button class="btn sm" id="cx">Close</button></div></div><iframe src="${url}" style="width:100%;height:76vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>`,
    (bg, close) => { $('.modal', bg).style.maxWidth = '860px'; $('#cx', bg).onclick = () => { close(); setTimeout(() => URL.revokeObjectURL(url), 500); }; });
}

// ---------- send: email, WhatsApp, or download / share ----------
function qtSend(q) {
  const t = qtTotals(q.items), cur = q.head.currency ? q.head.currency + ' ' : '', co = q.head.company || 'us', d = S.qt || {};
  const co2 = (d.companies || []).find(c => c.id === q.companyId) || { email: '', phone: '' };
  const sign = [q.head.signer, q.head.signerCompany || q.head.company].filter(Boolean).join('\n');
  const msg = `Dear Sir/Madam,\n\nPlease find attached our quotation ${q.no} dated ${qtDate(q.date)}${q.validDays ? `, valid for ${q.validDays} days` : ''}.\n\nTotal: ${cur}${qtMoney(t.total)}\n\nPlease let us know if you need anything else.\n\nRegards,\n${sign}`;
  const cap = `Quotation ${q.no} from ${co}\nTotal: ${cur}${qtMoney(t.total)}${q.validDays ? `\nValid for ${q.validDays} days` : ''}`;
  const pdfUrl = `/api/quotes/${q.id}/pdf?token=${encodeURIComponent(S.token)}`, canShare = !!(navigator.canShare && window.File);
  modal(`<h3>Send quotation ${esc(q.no)}</h3><p class="hint" style="margin:-8px 0 14px">${esc(cur)}${qtMoney(t.total)} · ${esc(qtDate(q.date))}${q.toLines ? ' · ' + esc(q.toLines.split('\n').filter(Boolean).slice(0, 2).join(', ')) : ''}</p>
    <div class="qt-card"><div class="qt-ch">${ic('mail')} Email <span class="hint">the PDF is attached${d.mailReady === false ? '' : ' · your email signature is added'}</span></div>
      ${d.mailReady === false ? `<div class="notice" style="margin:0 0 10px;font-size:13px">Email is not set up yet. Open <b>Reports → Email settings</b> (or add a Gmail mailbox under Email) once, then you can send from here.</div>` : ''}
      <div class="grid g2" style="gap:0 12px"><div class="field"><label>To</label><input type="text" id="sd-to" placeholder="name@company.com" value="${esc(co2.email)}" autocomplete="off"></div><div class="field"><label>Cc <span class="hint">(optional)</span></label><input type="text" id="sd-cc" autocomplete="off"></div></div>
      <div class="field"><label>Subject</label><input type="text" id="sd-sub" value="${esc(`Quotation ${q.no} from ${co}`)}"></div>
      <div class="field"><label>Message</label><textarea id="sd-msg" rows="7">${esc(msg)}</textarea></div>
      <div class="acts"><button class="btn primary" id="sd-mail" ${d.mailReady === false ? 'disabled' : ''}>${ic('send')} Send email</button></div></div>
    <div class="qt-card"><div class="qt-ch">${ic('inbox')} WhatsApp <span class="hint">sends the PDF as a file${d.waMode === 'demo' ? '' : ' · it also appears in your WhatsApp inbox'}</span></div>
      ${d.waMode === 'demo' ? `<div class="notice" style="margin:0 0 10px;font-size:13px">WhatsApp is not connected. Open <b>Settings → WhatsApp connection</b> and link your number, or use <b>Share</b> / <b>Download</b> below.</div>` : ''}
      <div class="field"><label>WhatsApp number <span class="hint">(with country code, e.g. 923001234567 — or 0300 1234567)</span></label><input type="text" id="sd-ph" placeholder="923001234567" value="${esc(co2.phone)}" autocomplete="off" inputmode="tel"></div>
      <div class="field"><label>Message with the file</label><textarea id="sd-cap" rows="3">${esc(cap)}</textarea></div>
      <div class="acts"><button class="btn primary" id="sd-wa" ${d.waMode === 'demo' ? 'disabled' : ''}>${ic('send')} Send on WhatsApp</button></div></div>
    <div class="qt-card"><div class="qt-ch">${ic('down')} Any other way <span class="hint">download the PDF and send it yourself</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn" href="${pdfUrl}&download=1">${ic('down')} Download PDF</a><a class="btn" href="${pdfUrl}" target="_blank" rel="noopener">Open PDF</a>${canShare ? `<button class="btn" id="sd-share">${ic('send')} Share… <span class="hint">(WhatsApp, Gmail, … on this device)</span></button>` : ''}</div></div>
    ${(q.sent || []).length ? `<div class="hint" style="margin-top:12px"><b>Already sent:</b> ${(q.sent || []).slice(-4).reverse().map(s => `${esc(s.via)} → ${esc(s.to)} (${esc(new Date(s.at).toLocaleString('en-GB'))})`).join(' · ')}</div>` : ''}
    <div class="acts"><button class="btn" id="cx">Close</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '640px'; $('#cx', bg).onclick = close;
    const act = async (btn, label, fn) => { const o = btn.innerHTML; btn.disabled = true; btn.textContent = 'Sending…'; try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.innerHTML = o; } };
    $('#sd-mail', bg).onclick = e => act(e.currentTarget, 'email', async () => { await api(`/quotes/${q.id}/email`, { method: 'POST', body: { to: $('#sd-to', bg).value, cc: $('#sd-cc', bg).value, subject: $('#sd-sub', bg).value, message: $('#sd-msg', bg).value } }); toast('Email sent with the PDF'); close(); viewQuotes(); });
    $('#sd-wa', bg).onclick = e => act(e.currentTarget, 'WhatsApp', async () => { const r = await api(`/quotes/${q.id}/whatsapp`, { method: 'POST', body: { phone: $('#sd-ph', bg).value, caption: $('#sd-cap', bg).value } }); toast('Sent on WhatsApp to +' + r.phone); close(); viewQuotes(); });
    const sh = $('#sd-share', bg);
    if (sh) sh.onclick = async () => {
      try {
        const r = await fetch(pdfUrl), blob = await r.blob(), f = new File([blob], `Quotation-${q.no}.pdf`, { type: 'application/pdf' });
        if (!navigator.canShare({ files: [f] })) return toast('This device cannot share files from the browser. Use Download PDF.', true);
        await navigator.share({ files: [f], title: `Quotation ${q.no}`, text: cap });
      } catch (e) { if (e && e.name !== 'AbortError') toast(e.message || 'Could not share', true); }
    };
  });
}


// ---------- small question window (the desk has no built-in text prompt) ----------
function qtAsk(title, label, value) {
  return new Promise(ok => modal(`<h3>${esc(title)}</h3><div class="field"><label>${esc(label)}</label><input type="text" id="qa-v" value="${esc(value || '')}" autocomplete="off"></div><div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="qa-ok">Save</button></div>`, (bg, close) => {
    let done = false; const fin = v => { if (done) return; done = true; close(); ok(v); }; $('.modal', bg).style.maxWidth = '420px'; const i = $('#qa-v', bg); i.focus(); i.select();
    $('#cx', bg).onclick = () => fin(''); $('#qa-ok', bg).onclick = () => fin(i.value.trim()); i.onkeydown = e => { if (e.key === 'Enter') fin(i.value.trim()); };
  }));
}

// ---------- Companies: save the customer's "Quote to" details once, reuse them, and give each company its own quotation numbers ----------
async function qtCompanies() {
  let list; try { list = await api('/quotes/companies'); } catch (e) { return toast(e.message, true); }
  modal(`<div class="row" style="justify-content:space-between;margin-bottom:6px"><h3 style="margin:0">${isAdmin() ? 'Companies' : 'My companies'}</h3>${isAdmin() ? `<button class="btn primary sm" id="co-add">${ic('plus')} Add company</button>` : ''}</div>
    <p class="hint" style="margin:0 0 14px">${isAdmin() ? '' : 'These are the companies the administrator assigned to you: you can make and send quotations for them. '}Save a customer's details once. When you make a quotation, pick the company: the details and the next number of <b>that</b> company are filled in, and you only add the items. You can still change anything on the quotation itself.</p>
    <div id="co-list">${list.length ? list.map(c => `<div class="qt-card" data-id="${c.id}" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>${esc(c.name)}</b> <span class="hint">next: ${esc(c.prefix)}${new Date().getFullYear()}-${String(c.next).padStart(4, '0')} · ${c.quotes} quotation${c.quotes === 1 ? '' : 's'}</span><div class="hint" style="margin-top:2px">Letterhead: <b>${esc(c.head ? c.head.company : S.qt.cfg.company) || '—'}</b>${c.head ? '' : ' (default)'}</div><div class="hint" style="white-space:pre-line;margin-top:2px">${esc(c.toLines.split('\n').filter(Boolean).slice(0, 3).join('\n')) || '—'}</div></div>
      <div class="row" style="gap:6px"><button class="btn sm primary" data-a="new">New quotation</button>${isAdmin() ? `<button class="btn sm" data-a="edit">Edit</button><button class="btn sm" data-a="del" title="Delete">${ic('trash')}</button>` : ''}</div>${isAdmin() ? `<div class="hint" style="flex-basis:100%">Assigned to: ${esc((c.assigned || []).map(id => (agent(id) || {}).name).filter(Boolean).join(', ')) || 'nobody yet (only administrators can quote it)'}</div>` : ''}</div>`).join('') : `<div class="hint" style="padding:18px 0;text-align:center">${isAdmin() ? 'No companies yet. Press “Add company”, or save one from inside a quotation.' : 'No company is assigned to you yet. Ask the administrator.'}</div>`}</div>
    <div class="acts"><button class="btn" id="cx">Close</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '680px'; $('#cx', bg).onclick = close;
    if ($('#co-add', bg)) $('#co-add', bg).onclick = () => { close(); qtCompanyEdit(null); };
    $('#co-list', bg).onclick = async e => {
      const b = e.target.closest('button[data-a]'), card = e.target.closest('[data-id]'); if (!b || !card) return; const c = list.find(x => x.id === card.dataset.id);
      if (b.dataset.a === 'new') { close(); return qtEdit(null, c.id); }
      if (b.dataset.a === 'edit') { close(); return qtCompanyEdit(c); }
      if (b.dataset.a === 'del') { if (!await gconfirm(`Delete ${c.name}? Quotations already made keep their own details.`)) return; try { await api('/quotes/companies/' + c.id, { method: 'DELETE' }); toast('Deleted'); close(); viewQuotes().then(qtCompanies); } catch (er) { toast(er.message, true); } }
    };
  });
}
function qtCompanyEdit(c) {
  const v = c || { name: '', prefix: '', toLines: '', email: '', phone: '', next: 1, validDays: '', thanks: '', terms: '' };
  modal(`<h3>${c ? 'Edit company' : 'Add company'}</h3>
    <div class="grid g2" style="gap:0 14px"><div class="field"><label>Company name</label><input type="text" id="ce-name" value="${esc(v.name)}" autocomplete="off"></div>
      <div class="field"><label>Email <span class="hint">(filled in when you send)</span></label><input type="text" id="ce-email" value="${esc(v.email)}" autocomplete="off"></div>
      <div class="field" style="grid-column:1/-1"><label>Quote to <span class="hint">(one line each: name, company, address)</span></label><textarea id="ce-to" rows="4" placeholder="Procurement Manager&#10;Company name&#10;Address">${esc(v.toLines)}</textarea></div>
      <div class="field"><label>WhatsApp number <span class="hint">(optional)</span></label><input type="text" id="ce-ph" value="${esc(v.phone)}" autocomplete="off" inputmode="tel"></div>
      <div class="field"><label>Number starts with <span class="hint">(blank = from the name)</span></label><input type="text" id="ce-prefix" value="${esc(v.prefix)}" placeholder="HBL-"></div>
      <div class="field"><label>Next number for this company</label><input type="number" id="ce-next" min="1" value="${esc(v.next)}"></div>
      <div class="field"><label>Valid for (days) <span class="hint">(blank = default)</span></label><input type="number" id="ce-valid" min="0" value="${esc(v.validDays == null ? '' : v.validDays)}"></div></div>
    <div class="field" style="margin-top:8px"><label>Team members who can quote this company <span class="hint">(they can only make and send quotations for the companies assigned to them; only you can change company details)</span></label><div class="qt-ticks" id="ce-ass" style="margin:6px 0 0">${(S.agents || []).filter(a => a.role !== 'admin' && a.active !== false).map(a => `<label><input type="checkbox" data-ag="${a.id}" ${(v.assigned || []).includes(a.id) ? 'checked' : ''}> ${esc(a.name)}</label>`).join('') || '<span class="hint">No team members yet</span>'}</div></div>
    <div class="field" style="margin-top:14px"><label>Letterhead, NTN &amp; GST of this company <span class="hint">(your own company that issues these quotations: its name, address, NTN / STRN lines, logo and stamp are printed on every quotation made for it)</span></label>
      <div class="qt-ticks" style="margin:6px 0 8px"><label><input type="checkbox" id="ce-defh" ${v.head ? '' : 'checked'}> Use the default letterhead</label><span class="hint" id="ce-hn"></span></div>
      <div id="ce-head" class="qt-cl" style="max-height:none" ${v.head ? '' : 'hidden'}>${qhFields(v.head || S.qt.cfg, 'ch')}
        <div class="grid g2" style="gap:0 14px;margin-top:12px"><div class="field"><label>GST % on new items <span class="hint">(blank = default ${esc(S.qt.cfg.gst)}%)</span></label><input type="number" id="ce-gst" min="0" max="100" step="any" value="${esc(v.gst == null ? '' : v.gst)}"></div></div></div></div>
    <div class="field" style="margin-top:14px"><label>Columns of this company's quotations <span class="hint">(some companies need Qty, Unit, GST or their own columns, others do not)</span></label>
      <div class="qt-ticks" id="ce-cols" style="margin:6px 0 8px"><label><input type="checkbox" id="ce-defc" ${v.cols || v.layout ? '' : 'checked'}> Use the default columns &amp; layout</label><button type="button" class="btn sm" id="ce-lay" ${v.cols || v.layout ? '' : 'hidden'}>${ic('cog')} Customize layout…</button><button type="button" class="btn sm" id="ce-rst" ${v.cols || v.layout ? '' : 'hidden'} title="Copy the default columns and layout">Copy defaults</button></div>
      <div id="ce-cl" class="qt-cl"></div></div>
    <div class="field" style="margin-top:10px"><label>Thank-you line <span class="hint">(blank = default)</span></label><input type="text" id="ce-thanks" value="${esc(v.thanks)}"></div>
    <div class="field"><label>Terms &amp; Instructions for this company <span class="hint">(one per line; blank = default terms)</span></label><textarea id="ce-terms" rows="3">${esc(v.terms)}</textarea></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="ce-save">Save company</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '780px'; $('#cx', bg).onclick = () => { close(); qtCompanies(); }; $('#ce-name', bg).focus();
    // while "use the default" is ticked the list shows the default columns (greyed out); un-ticking starts this company from them
    const CH = { logo: (v.head || S.qt.cfg).logo || '', signature: (v.head || S.qt.cfg).signature || '' }; qhBind(bg, 'ch', CH);
    const dh = $('#ce-defh', bg), hn = () => { $('#ce-hn', bg).textContent = dh.checked ? 'Using: ' + (S.qt.cfg.company || '—') : ''; };
    dh.onchange = () => { $('#ce-head', bg).hidden = dh.checked; hn(); }; hn();
    const defC = () => qtLayout(S.qt.cfg.cols), defL = () => qtLy(S.qt.cfg.layout), own = !!(v.cols || v.layout);
    let ceCols = own ? qtLayout(v.cols || S.qt.cfg.cols) : defC(), ceLay = own ? qtLy(v.layout || S.qt.cfg.layout) : defL();
    const dc = $('#ce-defc', bg), cl = qtColList($('#ce-cl', bg), ceCols, { off: () => dc.checked });
    const show = () => { $('#ce-lay', bg).hidden = $('#ce-rst', bg).hidden = dc.checked; cl.draw(); };
    dc.onchange = () => { if (dc.checked) { ceCols.splice(0, ceCols.length, ...defC()); ceLay = defL(); } show(); };
    $('#ce-rst', bg).onclick = () => { ceCols.splice(0, ceCols.length, ...defC()); ceLay = defL(); cl.draw(); toast('Default columns and layout copied'); };
    $('#ce-lay', bg).onclick = async () => {
      const r = await qtDesign(ceCols, ceLay, 'Layout for ' + ($('#ce-name', bg).value.trim() || 'this company'), () => ({ ...qtSample(), companyId: c ? c.id : '', head: dh.checked ? undefined : qhRead(bg, 'ch', CH), toLines: $('#ce-to', bg).value || 'PROCUREMENT MANAGER\nSAMPLE COMPANY\nKarachi', thanks: $('#ce-thanks', bg).value || S.qt.cfg.thanks, terms: $('#ce-terms', bg).value || S.qt.cfg.terms }));
      if (r) { ceCols.splice(0, ceCols.length, ...r.cols); ceLay = r.layout; cl.draw(); }
    };
    $('#ce-save', bg).onclick = async () => {
      const g = k => $('#ce-' + k, bg).value, body = { name: g('name'), email: g('email'), toLines: g('to'), phone: g('ph'), prefix: g('prefix'), next: g('next'), validDays: g('valid'), assigned: $$('[data-ag]:checked', $('#ce-ass', bg)).map(i => i.dataset.ag), head: dh.checked ? null : qhRead(bg, 'ch', CH), gst: dh.checked ? '' : $('#ce-gst', bg).value, cols: dc.checked ? null : qtLayout(ceCols), layout: dc.checked ? null : ceLay, thanks: g('thanks'), terms: g('terms') };
      try { await api(c ? '/quotes/companies/' + c.id : '/quotes/companies', { method: c ? 'PUT' : 'POST', body }); toast('Company saved'); close(); await viewQuotes(); qtCompanies(); } catch (e) { toast(e.message, true); }
    };
  });
}

// ---------- Email: attach a quotation to the mail you are writing (compose window or reply box) ----------
async function qtMailPick(onPick) {
  let d; try { d = await api('/quotes'); } catch (e) { return toast(e.message, true); }
  if (!d.quotes.length) return toast('No quotations yet. Make one in Quotations first.', true);
  let cq = '';
  modal(`<h3>Attach a quotation</h3><div class="row" style="gap:8px;margin-bottom:10px"><input type="search" id="qp-q" placeholder="Search by number or company…" style="flex:1" autocomplete="off">${(d.companies || []).length ? `<select id="qp-c" style="max-width:200px"><option value="">All companies</option>${d.companies.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>` : ''}</div>
    <div id="qp-l" style="max-height:52vh;overflow:auto"></div><div class="acts"><button class="btn" id="cx">Cancel</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '620px'; $('#cx', bg).onclick = close; const L = $('#qp-l', bg), qi = $('#qp-q', bg); qi.focus();
    const draw = () => { const t = qi.value.toLowerCase(), cs = $('#qp-c', bg) ? $('#qp-c', bg).value : '', rows = d.quotes.filter(r => (!cs || r.companyId === cs) && (!t || `${r.no} ${r.company} ${r.to}`.toLowerCase().includes(t)));
      L.innerHTML = rows.length ? rows.map(r => `<div class="qt-card" data-id="${r.id}" style="cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px"><div><b>${esc(r.no)}</b> <span class="hint">${esc(qtDate(r.date))}</span><div class="hint">${esc(r.company || r.to || '—')}</div></div><div style="text-align:right;white-space:nowrap"><b>${esc(r.currency ? r.currency + ' ' : '')}${qtMoney(r.total)}</b><div>${r.sentCount ? '<span class="pill green">Sent</span>' : '<span class="pill">Draft</span>'}</div></div></div>`).join('') : '<div class="hint" style="padding:16px;text-align:center">No quotation matches</div>'; };
    draw(); qi.oninput = draw; if ($('#qp-c', bg)) $('#qp-c', bg).onchange = draw;
    L.onclick = async e => {
      const el = e.target.closest('[data-id]'); if (!el) return; const r = d.quotes.find(x => x.id === el.dataset.id); el.style.opacity = '.5';
      try {
        const [q, resp] = await Promise.all([api('/quotes/' + r.id), fetch(`/api/quotes/${r.id}/pdf?token=${encodeURIComponent(S.token)}`)]); if (!resp.ok) throw new Error('Could not make the PDF');
        const blob = await resp.blob(), name = `Quotation-${String(q.no).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}${q.head.company ? '-' + q.head.company.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : ''}.pdf`;
        const [file] = await readFiles([new File([blob], name, { type: 'application/pdf' })]), t = qtTotals(q.items), cur = q.head.currency ? q.head.currency + ' ' : '', co = q.head.company || 'us';
        const text = `Dear Sir/Madam,\n\nPlease find attached our quotation ${q.no} dated ${qtDate(q.date)}${q.validDays ? `, valid for ${q.validDays} days` : ''}.\n\nTotal: ${cur}${qtMoney(t.total)}\n\nPlease let us know if you need anything else.\n\nRegards,\n${[q.head.signer, q.head.signerCompany || q.head.company].filter(Boolean).join('\n')}`;
        close(); onPick({ file, id: q.id, no: q.no, email: r.email || '', subject: `Quotation ${q.no} from ${co}`, text });
      } catch (er) { el.style.opacity = ''; toast(er.message, true); }
    };
  });
}
// puts the picked quotation into the mail being written: the PDF as an attachment, the company's email in To, a subject and a short message if those are still empty
function qtMailApply(p, o) { // o: { files, qts, to(), addTo(email), subject(), setSubject(s), ed, redraw() }
  if (!o.files.some(f => f.filename === p.file.filename)) o.files.push(p.file); (o.qts = o.qts || []).includes(p.id) || o.qts.push(p.id);
  if (p.email && !o.to().length) o.addTo(p.email);
  if (o.setSubject && !String(o.subject() || '').trim()) o.setSubject(p.subject);
  const empty = !(o.ed.textContent || '').trim(); if (empty) o.ed.innerHTML = p.text.split('\n').map(x => esc(x)).join('<br>');
  o.redraw(); toast(`Quotation ${p.no} attached`);
}


// ---------- Bulk add: a sheet to paste the items into (from Excel / Google Sheets); it makes the quotation from them ----------
const QB_COLS = [['desc', 'Description', /^(item|items|item\s*(name|description|details?)|description|product|particulars?|details?|material|article|name)$/i], ['qty', 'Qty', /^(qty|quantity|qnty|pcs|pieces|nos)$/i], ['unit', 'Unit', /^(unit|uom)$/i], ['price', 'Unit price', /^(unit\s*price|price|rate|unit\s*rate|amount)$/i], ['gst', 'GST %', /^(gst|gst\s*%|tax|tax\s*%|sales\s*tax)$/i]];
function qtBulk(companyId) {
  const d = S.qt, cos = d.companies || [];
  if (!isAdmin() && !cos.length) return toast('No company is assigned to you yet. Ask the administrator.', true);
  const start = companyId && cos.some(c => c.id === companyId) ? companyId : (isAdmin() ? '' : cos[0].id);
  const rows = Array.from({ length: 12 }, () => ['', '', '', '', '']);
  modal(`<h3>Bulk add items</h3>
    <p class="hint" style="margin:-6px 0 10px">Copy your items in Excel and paste them into the first cell of the sheet (Ctrl+V). A heading row such as <i>Description, Qty, Unit, Price, GST</i> is recognised; without one the columns are taken in the order shown. You can still edit any cell.</p>
    <div class="field"><label>Company</label><select id="qb-co">${isAdmin() ? '<option value="">— One-off / not in my list —</option>' : ''}${cos.map(c => `<option value="${c.id}" ${c.id === start ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="tbl-wrap" style="border:1px solid var(--line);max-height:46vh;overflow:auto"><table class="tbl qb-t"><thead><tr><th style="width:34px">#</th>${QB_COLS.map(([k, l]) => `<th data-k="${k}">${l}</th>`).join('')}<th style="width:34px"></th></tr></thead><tbody id="qb-b"></tbody></table></div>
    <div class="row" style="justify-content:space-between;margin:8px 0 0;flex-wrap:wrap;gap:8px"><div class="row" style="gap:8px"><button class="btn sm" id="qb-add">${ic('plus')} Add rows</button><button class="btn sm" id="qb-clr">Clear sheet</button></div><div class="hint" id="qb-sum"></div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="qb-ok">Make quotation</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '860px'; $('#cx', bg).onclick = close;
    const body = $('#qb-b', bg), co = () => $('#qb-co', bg).value, defGst = () => qtGst(co());
    const draw = () => { body.innerHTML = rows.map((r, i) => `<tr data-i="${i}"><td class="hint">${i + 1}</td>${QB_COLS.map(([k], j) => `<td><input data-j="${j}" value="${esc(r[j])}" ${j === 0 ? '' : 'style="text-align:right"'} autocomplete="off"></td>`).join('')}<td><button class="btn sm" data-del title="Remove row">${ic('trash')}</button></td></tr>`).join(''); sum(); };
    const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
    const items = () => rows.filter(r => String(r[0]).trim()).map(r => ({ desc: String(r[0]).trim(), qty: String(r[1]).trim() === '' ? 1 : num(r[1]), unit: String(r[2]).trim() || (d.cfg.unit || 'EACH'), price: num(r[3]), gst: String(r[4]).trim() === '' ? defGst() : num(r[4]), x1: '', x2: '', x3: '', x4: '' }));
    const sum = () => { const it = items(), t = qtTotals(it); $('#qb-sum', bg).innerHTML = it.length ? `<b>${it.length}</b> item${it.length === 1 ? '' : 's'} · total <b>${qtMoney(t.total)}</b>` : ''; };
    // a pasted block goes in from the cell it was pasted into; a heading row in the block decides which column each piece goes to
    body.addEventListener('paste', e => {
      const inp = e.target.closest('input[data-j]'); if (!inp) return; const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt.trim())) return; e.preventDefault();
      let g = bulkSplit(txt); if (!g.length) return; const r0 = +inp.closest('tr').dataset.i, c0 = +inp.dataset.j;
      const map = {}; g[0].forEach((c, x) => { QB_COLS.forEach(([k, , re], j) => { if (map[x] === undefined && re.test(c.trim()) && !Object.values(map).includes(j)) map[x] = j; }); });
      const header = Object.values(map).includes(0) && Object.keys(map).length >= 2; if (header) g = g.slice(1);
      else if (g.length && c0 === 0 && g.every(r => /^\d{1,4}\.?$/.test(r[0] || '')) && g[0].length > 2) g = g.map(r => r.slice(1)); // a leading S.No column
      g.forEach((cells, k) => { const ri = r0 + k; while (rows.length <= ri) rows.push(['', '', '', '', '']); cells.forEach((v, x) => { const j = header ? map[x] : c0 + x; if (j !== undefined && j < 5) rows[ri][j] = v; }); });
      draw(); toast(`${g.length} row${g.length === 1 ? '' : 's'} pasted`);
    });
    body.addEventListener('input', e => { const i = e.target.closest('input[data-j]'); if (!i) return; rows[+i.closest('tr').dataset.i][+i.dataset.j] = i.value; sum(); });
    body.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.matches('input[data-j]')) return; e.preventDefault(); const tr = e.target.closest('tr'), nx = tr.nextElementSibling; if (!nx) { rows.push(['', '', '', '', '']); draw(); } const t = $(`tr[data-i="${+tr.dataset.i + 1}"] input[data-j="${e.target.dataset.j}"]`, body); if (t) t.focus(); });
    body.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.closest('tr').dataset.i, 1); if (!rows.length) rows.push(['', '', '', '', '']); draw(); });
    $('#qb-add', bg).onclick = () => { for (let k = 0; k < 10; k++) rows.push(['', '', '', '', '']); draw(); };
    $('#qb-clr', bg).onclick = () => { rows.splice(0, rows.length, ...Array.from({ length: 12 }, () => ['', '', '', '', ''])); draw(); };
    $('#qb-co', bg).onchange = sum;
    $('#qb-ok', bg).onclick = () => { const it = items(); if (!it.length) return toast('Paste or type at least one item first', true); close(); qtEdit(null, co(), it); };
    draw(); const f = $('input', body); if (f) f.focus();
  });
}
