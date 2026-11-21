/* DC file & items (Company report -> open a DC): attach the DC file, list the items in it and track each item.
   Also: bulkSplit(), the paste-from-Excel splitter that Quotations -> Bulk add uses too. */

// text copied from Excel / Google Sheets (tabs) or a CSV -> array of rows of cells; handles "quoted, cells" and multi-line cells
function bulkSplit(text) {
  text = String(text || '').replace(/\r\n?/g, '\n'); const tab = text.includes('\t'), sep = tab ? '\t' : ',', rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && !cur) q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur); rows.push(row);
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}

// Runs INSIDE the print window (sent as text): splits the bill / DC into pages itself, so the title, letterhead, numbers, M/S and address, and the column headings
// are on EVERY page, and the totals box + bank details always stay together. It measures the real row heights, so it does not depend on the browser repeating table headings.
function dcPaginate() {
  var tb = document.querySelector('table.it'); if (!tb || !tb.tHead || tb.tHead.rows.length < 2 || !tb.tBodies[0]) return;
  var probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;width:1px;height:277mm'; document.body.appendChild(probe);
  var P = probe.getBoundingClientRect().height; document.body.removeChild(probe);
  var hbH = tb.tHead.rows[0].getBoundingClientRect().height, chH = tb.tHead.rows[1].getBoundingClientRect().height, fH = tb.tFoot ? tb.tFoot.getBoundingClientRect().height : 0;
  var rows = [].slice.call(tb.tBodies[0].rows), tail = rows.pop(), avail = P - hbH - chH - fH - 24; if (!tail || avail < 100) return;
  var tailH = tail.getBoundingClientRect().height + 2, hs = rows.map(function (r) { return r.getBoundingClientRect().height + 1.2; });
  var pages = [[]], y = 0;
  rows.forEach(function (r, i) { if (y + hs[i] > avail && pages[pages.length - 1].length) { pages.push([]); y = 0; } pages[pages.length - 1].push(r); y += hs[i]; });
  if (y + tailH > avail) pages.push([]);                                   // the totals do not fit under the last item: they go, whole, on the next page
  pages[pages.length - 1].push(tail);
  var ft = document.querySelector('.ft'), fb = ft ? getComputedStyle(ft).bottom : '0px', out = document.createElement('div');
  if (ft) ft.style.display = 'none';                                       // the footer is drawn inside every page below (a fixed footer is not repeated reliably)
  pages.forEach(function (pg, i) {
    var t = tb.cloneNode(false), body = document.createElement('tbody'), box = document.createElement('div');
    t.appendChild(tb.querySelector('colgroup').cloneNode(true)); t.appendChild(tb.tHead.cloneNode(true));
    pg.forEach(function (r) { body.appendChild(r); }); t.appendChild(body); if (tb.tFoot) t.appendChild(tb.tFoot.cloneNode(true));
    box.appendChild(t);
    if (ft) { box.style.cssText += ';position:relative;height:' + (P - 3) + 'px;overflow:hidden'; var c = ft.cloneNode(true); c.style.cssText = 'display:block;position:absolute;left:0;right:0;bottom:' + fb; box.appendChild(c); }
    if (i < pages.length - 1) { box.style.breakAfter = 'page'; box.style.pageBreakAfter = 'always'; } out.appendChild(box);
  });
  tb.parentNode.replaceChild(out, tb);
}

const DCF_ST = [['pending', 'Pending', 'var(--amber)'], ['delivered', 'Delivered', '#16a34a'], ['short', 'Short / partly', '#2563eb'], ['returned', 'Returned', 'var(--red)']];
const dcfSum = items => { const c = s => items.filter(i => i.status === s).length; return { n: items.length, d: c('delivered'), s: c('short'), r: c('returned'), p: c('pending') }; };
const dcfSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// Company report -> open a DC: the items of this DC, filled in automatically from the sheets attached in "DC files".
async function dcFileLoad(el) {
  if (!el || el.dataset.loaded) return;
  const key = el.dataset.dcf; if (!key) { el.dataset.loaded = '1'; return; }
  el.innerHTML = `<div class="hint">Loading the items…</div>`;
  let d; try { d = await api('/pofollow/items?key=' + encodeURIComponent(key)); } catch (e) { el.innerHTML = `<div class="hint">${esc(e.message)}</div>`; return; }
  el.dataset.loaded = '1';
  const items = d.items || [];
  if (!items.length) { el.innerHTML = `<div class="hint">No items found for this DC yet. They are read automatically from your items sheet / ERP${typeof isAdmin === 'function' && isAdmin() ? ` — set it up under <a href="#itemsync" data-goisy style="color:var(--brand);font-weight:700">DC items sync</a>` : ' (ask the administrator to connect it)'}. This DC has no row there yet, or its numbers differ.</div>`; const g = $('[data-goisy]', el); if (g) g.onclick = ev => { ev.preventDefault(); if (typeof goItemSync === 'function') goItemSync(); }; return; }
  const f2 = v => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const row = it => { // the figures of the bill; a missing one is worked out from the others
    const qty = Number(it.qty) || 0, price = Number(it.price) || 0;
    const amt = Number(it.amt) || (price && qty ? price * qty : 0), total = Number(it.total) || 0;
    let tv = Number(it.taxv) || 0; if (!tv && total && amt && total > amt) tv = total - amt;
    const tp = it.taxp ? String(it.taxp).replace(/%/g, '').trim() : (amt && tv ? String(Math.round(tv / amt * 100)) : '');
    return { price, amt, tp, tv, total: total || (amt && tv ? amt + tv : 0) };
  };
  const pct = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[%\s]/g, '')); if (!isFinite(x) || x <= 0) return ''; return String(Math.round((x < 1 ? x * 100 : x) * 100) / 100); }; // Excel keeps 18% as 0.18
  const rows = () => items.map(it => { const r = row(it); return { ...it, ...r, tp: pct(r.tp) }; });
  const sums = rs => rs.reduce((a, r) => ({ qty: a.qty + (Number(r.qty) || 0), amt: a.amt + r.amt, tv: a.tv + r.tv, total: a.total + r.total }), { qty: 0, amt: 0, tv: 0, total: 0 });
  const dcInfo = () => { // the DC header (number, PO, req, cost code, company, address, date) from the DC row
    const r = (typeof S !== 'undefined' && S.findRes && S.findRes[+el.dataset.dcfi]) || {}, det = re => { const x = (r.sheet || r.details || []).find(([k]) => re.test(String(k).trim())); return x ? String(x[1] || '') : ''; };
    return { dc: (typeof dcNoOf === 'function' && dcNoOf(r)) || det(/^dc/i) || '', po: r.po || '', pr: r.pr || '', cc: det(/br\.?\s*no|cost\s*code|branch.*code/i), company: r.organization || r.company || '', addr: det(/address|location/i), date: det(/dc\s*date|order\s*date|^date$/i) || r.day || '', invoice: det(/invoice/i) };
  };
  const draw = () => {
    const n = v => v ? f2(v) : '', rs = rows(), t = sums(rs);
    el.innerHTML = `<div class="row" style="gap:8px;margin:0 0 8px;flex-wrap:wrap"><button class="btn sm primary" data-print="bill">${ic('print')} Print bill</button><button class="btn sm" data-print="dc">${ic('print')} Print DC</button></div>
    <div class="tbl-wrap" style="border:1px solid var(--line);max-height:420px;overflow:auto"><table class="tbl dcf-t"><thead><tr><th style="width:60px;text-align:center">DENO</th><th>NAME OF ITEMS</th><th style="width:70px">UNIT</th><th style="width:90px;text-align:right">PRICE</th><th style="width:120px;text-align:right">AMOUNT EXCL S.TAX</th><th style="width:70px;text-align:right">TAX %</th><th style="width:100px;text-align:right">TAX VALUE</th><th style="width:130px;text-align:right">TOTAL AMOUNT INCLS TAX</th></tr></thead><tbody>
      ${rs.map(r => `<tr><td style="text-align:center;font-weight:700">${esc(r.qty)}</td><td style="white-space:normal">${esc(r.desc)}${r.code ? `<div class="hint">${esc(r.code)}</div>` : ''}</td><td>${esc(r.unit || '')}</td><td style="text-align:right">${n(r.price)}</td><td style="text-align:right">${n(r.amt)}</td><td style="text-align:right">${r.tp ? esc(r.tp) + '%' : ''}</td><td style="text-align:right">${n(r.tv)}</td><td style="text-align:right;font-weight:700">${n(r.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr style="font-weight:800;background:color-mix(in srgb,var(--brand) 8%,transparent)"><td style="text-align:center">${esc(t.qty)}</td><td colspan="3" style="text-align:right">TOTAL</td><td style="text-align:right">${n(t.amt)}</td><td></td><td style="text-align:right">${n(t.tv)}</td><td style="text-align:right">${n(t.total)}</td></tr></tfoot></table></div>`;
  };
  // printable bill (sales tax invoice, with the rates) or DC (delivery challan, no rates), laid out like the paper ones.
  // The bill is read from the invoice / bill sheet and the DC from the DC sheet (DC items sync), and the page title = "DC <number>" so a saved PDF carries the DC name.
  const fmtDate = v => { v = String(v || '').trim(); const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); if (!m) return v; return `${m[3]}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]}-${m[1].slice(2)}`; };
  const printDoc = async kind => {
    const w = window.open('', '_blank'); if (!w) { if (typeof toast === 'function') toast('Allow pop-ups to print', true); return; } // opened first so the browser does not block it
    const bill = kind === 'bill', h0 = dcInfo(); let L = {}, D = null;
    try { [L, D] = await Promise.all([api('/letterheads/for?company=' + encodeURIComponent(h0.company)).catch(() => ({})), api('/pofollow/doc?key=' + encodeURIComponent(key) + '&doc=' + kind).catch(() => null)]); } catch { /* the items on screen are used */ }
    if (D && D.fallback && typeof toast === 'function') toast(`DC ${h0.dc || ''} was not found in the ${bill ? 'bill' : 'DC'} sheet, so the items of the attached file are printed (no EXP codes from the sheet). Type the DC number in the Check box of DC items sync to see why.`, true);
    const hd = (D && D.head) || {}, src = D && D.items && D.items.length ? D.items : items;
    const rs = src.map(it => { const r = row(it); return { ...it, ...r, tp: pct(r.tp) }; }), t = sums(rs);
    const h = { ...h0, date: fmtDate(hd.dt || h0.date), inv: hd.iv || h0.invoice || '', po: D && D.found ? hd.po || '' : hd.po || h0.po || '', pr: D && D.found ? hd.pr || '' : hd.pr || h0.pr || '', cc: hd.cc || h0.cc || '', addr: hd.ad || h0.addr || '', contact: hd.ct || '', phone: hd.ph || '' };
    const html = dcDocHtml(kind, L, h, rs, t, false), title = `DC ${h.dc || ''}${bill ? ' - Bill' : ' - Delivery Challan'}`.replace(/\s+/g, ' ').trim();
    w.document.open(); w.document.write(html); w.document.close();
  };
  el.onclick = ev => { const b = ev.target.closest && ev.target.closest('[data-print]'); if (b) { ev.stopPropagation(); printDoc(b.dataset.print); } };
  draw();
}

// the paste window for items: copy the item rows from Excel, paste, check, add
function dcfPaste(done) {
  modal(`<h3>Paste items from Excel</h3><p class="hint" style="margin:-6px 0 10px">Copy the item rows in Excel (with or without the heading row) and paste them here. Columns: <b>Item, Qty, Unit</b>. A heading row such as “Description / Quantity” is recognised.</p>
    <textarea id="dp-t" rows="9" placeholder="Paste here (Ctrl+V)…" style="width:100%;font-family:inherit"></textarea><div class="hint" id="dp-n" style="margin-top:6px"></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="dp-ok" disabled>Add items</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; let found = [], tm = 0;
    const read = async () => { try { const r = await api('/pofollow/items/parse', { method: 'POST', body: { text: $('#dp-t', bg).value } }); found = r.items; } catch { found = []; } $('#dp-n', bg).textContent = found.length ? `${found.length} item${found.length === 1 ? '' : 's'} found.` : ($('#dp-t', bg).value.trim() ? 'No items found yet.' : ''); $('#dp-ok', bg).disabled = !found.length; };
    $('#dp-t', bg).oninput = () => { clearTimeout(tm); tm = setTimeout(read, 250); }; $('#dp-t', bg).focus();
    $('#dp-ok', bg).onclick = () => { close(); done(found); };
  });
}

// The paper itself (Print bill / Print DC and the layout editor): kind 'bill' | 'dc', letterhead L (with its layout), header facts h, item rows rs, totals t.
// edit = true builds the layout-editor preview (parts can be dragged, nothing prints).
function dcDocHtml(kind, L, h, rs, t, edit) {
  const bill = kind === 'bill', f2 = v => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const title = `DC ${h.dc || ''}${bill ? ' - Bill' : ' - Delivery Challan'}`.replace(/\s+/g, ' ').trim();
    const e = v => esc(v == null ? '' : v), lines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);
    const top = (parseFloat(L.topMm) || 0) + 'mm', bot = (parseFloat(L.bottomMm) || 0) + 'mm', sigLab = String(L.sig || 'Collect by, Check by, Pack by').split(',').map(x => x.trim()).filter(Boolean);
    const id = (l, v, always) => v || always ? `<tr><td class="k">${l}</td><td class="v">${e(v)}${v ? '' : '&nbsp;'}</td></tr>` : '';
    const header = L.blankHeader ? '' : L.headerImage ? `<img data-el="hdrimg" src="${L.headerImage}" style="width:100%;max-height:45mm;object-fit:contain">`
      : `<div class="hd"><div class="hl"><h1 data-el="name">${e(L.name || 'M.R. ENTERPRISES')}</h1><div class="adr" data-el="addr">${e(L.address || '')}</div></div>${L.logo ? `<img class="logo" data-el="logo" src="${L.logo}">` : ''}</div><div class="rule${bill ? ' dbl' : ''}"></div>
         <div class="meta"><div data-el="tax">${L.ntn ? `<div>N.T.N # ${e(L.ntn)}</div>` : ''}${L.gst ? `<div>G.S.T # ${e(L.gst)}</div>` : ''}${lines(L.extra).map(x => `<div>${e(x)}</div>`).join('')}</div><div class="mr" data-el="contact">${L.phone ? `<div>PH: ${e(L.phone)}</div>` : ''}${L.mobile ? `<div>MOB : ${e(L.mobile)}</div>` : ''}</div></div>`;
    const cols = bill ? [7, 36, 7, 9, 12, 7, 10, 12] : [8, 8, 70, 14];
    const cg = `<colgroup>${cols.map(c => `<col style="width:${c}%">`).join('')}</colgroup>`;
    const th = (bill ? ['DENO', 'NAME OF ITEMS', 'UNIT', 'PRICE', 'AMOUNT EXCL<br>S.Tax', 'TAX %', 'TAX VALUE', 'TOTAL AMOUNT<br>INCLS TAX'] : ['DENO', 'UNIT', 'NAME OF ITEMS', 'EXP CODE']).map(x => `<th>${x}</th>`).join('');
    const body = rs.map(r => bill
      ? `<tr class="ir"><td class="c b">${e(r.qty)}</td><td class="nm">${e(r.desc)}${r.code ? `<br>${e(r.code)}` : ''}</td><td class="c">${e(r.unit)}</td><td class="c">${r.price ? f2(r.price) : ''}</td><td class="c">${r.amt ? f2(r.amt) : ''}</td><td class="c">${r.tp ? e(r.tp) + '%' : ''}</td><td class="c">${r.tv ? f2(r.tv) : ''}</td><td class="c">${r.total ? f2(r.total) : ''}</td></tr>`
      : `<tr class="ir"><td class="c b">${e(r.qty)}</td><td class="c b">${e(r.unit)}</td><td class="b">${e(r.desc)}</td><td class="c b">${e(r.exp != null ? r.exp : r.code)}</td></tr>`).join('');
    const foot = bill ? bot : `calc(${bot} + ${20 + (L.stamp ? 24 : 0) + (String(L.dcNote || '').length > 100 ? 5 : 0)}mm)`; // the DC's fixed footer (Collect by / Check by / Pack by + note) sits at the bottom of every page: keep that space free so the items never run under it
    const stamp = L.stamp ? `<img class="stamp" data-el="stamp" src="${L.stamp}">` : '';
    const bank = lines(L.bank), note = lines(L.billNote);
    const tail = bill
      ? `<div class="tail"><table class="sm">${cg}<tr><td colspan="4"></td><td class="c">${f2(t.amt)}</td><td></td><td class="c">${f2(t.tv)}</td><td class="c">${f2(t.total)}</td></tr></table>
         <div class="fin"><div class="bk" data-el="bank">${bank.length ? '<div class="bh">BANK ACCOUNT DETAIL</div>' : ''}${bank.map(x => `<div>${e(x)}</div>`).join('')}${note.map(x => `<div style="margin-top:6px">${e(x)}</div>`).join('')}</div>
         <div class="box" data-el="totals">${stamp}<table><tr><td>SUB TOTAL (TAX ITEMS )</td><td class="r">${f2(t.amt)}</td></tr><tr><td>SUB TOTAL (NON TAX ITEMS )</td><td class="r">-</td></tr><tr><td>TOTAL VALUE (EXCLUDING TAX)</td><td class="r">${f2(t.amt)}</td></tr><tr><td>ADD: ( TOTAL TAX AMOUNT )</td><td class="r">${f2(t.tv)}</td></tr><tr class="net"><td>NET AMOUNT (TOTAL INCL. TAX)</td><td class="r"><span>${f2(t.total)}</span></td></tr></table></div></div></div>`
      : `<div class="ft">${stamp ? `<div class="sw">${stamp}</div>` : ''}<div class="sig" data-el="sig">${sigLab.map(x => `<span>${e(x)}</span>`).join('')}</div>${L.dcNote ? `<div class="fn" data-el="note">${e(L.dcNote)}</div>` : ''}</div>`;
    const ids = bill ? id('INVOICE #', h.inv) + id('DC #', h.dc) + id('PO #', h.po, 1) + id('REQ #', h.pr, 1) + id('BRANCH/COST CODE', h.cc) : id('DC #', h.dc) + id('PO NO', h.po, 1) + id('REQ NO', h.pr, 1) + id('BRANCH/COST CODE', h.cc);
    const LY = (L.layout && L.layout[kind]) || {}, ORI = { title: '50% 0', ms: '50% 0', ad: '50% 0', ph: '50% 0', ct: '50% 0', sig: '50% 0', contact: '100% 0', ids: '100% 0', totals: '100% 0' };
    const layCss = Object.entries(LY).filter(([k]) => /^[a-z]+$/.test(k)).map(([k, v]) => { const dx = +v.dx || 0, dy = +v.dy || 0, sc = +v.s || 100; let c = '';
      if (dx || dy) c += `translate:${dx}mm ${dy}mm;`; if (sc !== 100) c += `scale:${sc / 100};transform-origin:${ORI[k] || '0 0'};`; if (v.hide) c += edit ? 'opacity:.2;' : 'display:none!important;'; return c ? `[data-el="${k}"]{${c}}` : ''; }).join('');
    const editCss = edit ? `html{padding:0!important;background:#fff!important}body{margin:0!important;box-shadow:none!important;user-select:none;-webkit-user-select:none}.ft{pointer-events:none}.ft [data-el]{pointer-events:auto}[data-el]{cursor:move}[data-el]:hover{outline:1px dashed #2a7de1;outline-offset:1px}[data-el].sel{outline:2px solid #2a7de1;outline-offset:1px}` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e(title)}</title><style>
      @page{size:A4;margin:10mm 12mm}*{box-sizing:border-box}html,body{margin:0}body{font-family:Calibri,Carlito,Arial,sans-serif;color:#000;font-size:12px;padding:0;width:186mm;margin:0 auto}
      .top{text-align:center;font:${bill ? 'bold' : 'italic'} 12px ${bill ? 'Georgia,serif' : 'Calibri,Carlito,Arial,sans-serif'};margin-bottom:6px}
      .hd{display:flex;justify-content:space-between;align-items:flex-end;min-height:22mm}.hl h1{margin:0;font-size:34px;font-weight:800;letter-spacing:.3px}.adr{font:bold 10px Georgia,serif;margin:8px 0 6px}.logo{max-height:26mm;max-width:42mm;margin-top:-8px}
      .rule{border-bottom:1.5px solid #000}.rule.dbl{border-bottom:4px double #000}.meta{display:flex;justify-content:space-between;margin-top:8px;font:bold 11px Georgia,serif;line-height:1.9}.mr{text-align:right;font:bold 10px Arial,sans-serif}
      .dt{font:bold italic 13px Calibri,Carlito,Arial,sans-serif;text-decoration:underline;margin-top:10px}.dtr{text-align:right;font:bold 13px Calibri,Carlito,Arial,sans-serif;margin-top:16px}
      .r2{display:flex;justify-content:space-between;align-items:flex-start}.ids{border-collapse:collapse;margin-left:auto;margin-top:6px}.ids .k{text-align:right;font-weight:bold;text-decoration:underline;padding:3px 8px;white-space:nowrap;font-size:12.5px}.ids .v{text-align:center;font-weight:bold;border-bottom:1px solid #000;padding:3px 6px;min-width:46mm;font-size:13px}
      .ms{text-align:center;margin:${bill ? '6px' : '26px'} 0 6px;font:bold italic 17px Calibri,Carlito,Arial,sans-serif;text-decoration:underline}.ad{text-align:center;font:bold ${bill ? 'italic ' : ''}14px Calibri,Carlito,Arial,sans-serif;text-decoration:underline;margin:${bill ? '14px' : '16px'} 0 12px}
      .ph{text-align:center;font:bold 13px Calibri,Carlito,Arial,sans-serif;text-decoration:underline;margin:22px 0 8px}.ct{text-align:center;font:bold 14px Calibri,Carlito,Arial,sans-serif;color:#444;text-decoration:underline;margin-bottom:6px}
      table.it,table.sm{width:100%;border-collapse:collapse;table-layout:fixed}.it{border:0;margin-top:0}.it th{background:#d9d9d9;border:1px solid #000;padding:7px 4px;font:bold italic 12px Calibri,Carlito,Arial,sans-serif}.ir>td{border:1px solid #000;padding:${bill ? '5px 4px' : '4px 5px'};font-size:12px}.it td.nb{border:0;padding:0;font-size:12px}.it>thead>tr>td.nb{vertical-align:top}
      .tail{break-inside:avoid;page-break-inside:avoid}.it tr{break-inside:avoid;page-break-inside:avoid}.c{text-align:center}.b{font-weight:bold}.nm{text-align:left;line-height:1.15}.r{text-align:right}.sm td{padding:14px 4px 0;font-size:12px}
      .fin{display:flex;justify-content:space-between;align-items:flex-start;margin-top:26px}.bk{font:bold 11px Arial,sans-serif;line-height:1.9;padding-top:14px;min-width:60mm}.bh{margin-bottom:12px}
      .box{position:relative;width:52%;border:2px solid #000;padding:2px 0 14px}.box table{width:100%;border-collapse:collapse}.box td{padding:2px 6px;font:bold 11px Arial,sans-serif}.box tr.net td{padding-top:18px}.box tr.net span{border-bottom:3px double #000;padding-bottom:1px}.stamp{position:absolute;left:34%;top:50%;transform:translate(-50%,-50%);max-height:34mm;max-width:52mm;mix-blend-mode:multiply;opacity:.9}
      .ft{position:fixed;left:0;right:0;bottom:${bot}}.sw{text-align:center;margin-bottom:-26px;padding-left:20%}.sw .stamp{position:static;transform:none;max-height:30mm}.sig{display:flex;justify-content:space-around;gap:10mm}.sig span{flex:1;text-align:center;border-top:1px solid #000;padding-top:3px;font-size:14px}.fn{margin-top:8px;font-size:11.5px}
      @media screen{html{background:#cfd2d6;padding:56px 0 24px}body{width:210mm;min-height:297mm;padding:10mm 12mm;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.35);position:relative}.ft{position:absolute;left:12mm;right:12mm;bottom:${bot}}.bar{position:fixed;top:0;left:0;right:0;height:44px;background:#2b2f36;color:#fff;display:flex;align-items:center;gap:10px;padding:0 16px;z-index:9;font:600 14px Arial,sans-serif}.bar button{font:600 13px Arial,sans-serif;padding:7px 16px;border:0;border-radius:6px;cursor:pointer;background:#fff;color:#111}.bar button.p{background:#25a55f;color:#fff}.bar span{flex:1}}
      @media print{.bar{display:none}}
      ${layCss}${editCss}</style></head><body>
      ${edit ? '' : `<div class="bar"><span>${e(title)}</span><button class="p" onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div>`}
      <table class="it">${cg}<thead><tr><td class="nb" colspan="${cols.length}"><div style="height:${top}"></div>
      <div class="top" data-el="title">${bill ? 'SALES TAX INVOICE' : 'DELIVERY CHALLAN'}</div>${header}
      ${bill ? `<div class="dtr" data-el="date">${e(h.date)}</div><table class="ids" data-el="ids">${ids}</table>` : `<div class="r2"><div class="dt" data-el="date">${e(h.date)}</div><table class="ids" data-el="ids" style="margin-top:2px">${ids}</table></div>`}
      <div class="ms" data-el="ms">M/S ${e((h.company || '').toUpperCase())}</div>${h.addr ? `<div class="ad" data-el="ad">${e(h.addr)}</div>` : ''}${!bill && h.phone ? `<div class="ph" data-el="ph">${e(h.phone)}</div>` : ''}${!bill && h.contact ? `<div class="ct" data-el="ct">${e(h.contact)}</div>` : ''}
      <div style="height:${bill ? '10px' : '4px'}"></div></td></tr><tr>${th}</tr></thead>
      <tbody>${body}<tr><td class="nb" colspan="${cols.length}">${tail}</td></tr></tbody>
      <tfoot><tr><td class="nb" colspan="${cols.length}"><div style="height:${foot}"></div></td></tr></tfoot></table>${edit ? '<script>' + dcEditScript(LY) + '</scr' + 'ipt>' : '<script>' + dcPaginate.toString() + ';window.onload=function(){try{dcPaginate()}catch(x){}setTimeout(function(){window.print()},400)}</scr' + 'ipt>'}</body></html>`;
    return html;
}

// Runs INSIDE the layout-editor preview: drag a part (mouse / finger) or nudge it with the arrow keys; every change is sent to the editor window.
function dcEditRuntime(LAY) {
  var MM = 25.4 / 96, cur = null, d = null, ORI = { title: '50% 0', ms: '50% 0', ad: '50% 0', ph: '50% 0', ct: '50% 0', sig: '50% 0', contact: '100% 0', ids: '100% 0', totals: '100% 0' };
  function paint(k) { var v = LAY[k] || {}; [].forEach.call(document.querySelectorAll('[data-el="' + k + '"]'), function (el) { el.style.translate = (v.dx || 0) + 'mm ' + (v.dy || 0) + 'mm'; el.style.scale = (v.s || 100) / 100; el.style.transformOrigin = ORI[k] || '0 0'; el.style.opacity = v.hide ? '.2' : ''; }); }
  function put(k, v) { LAY[k] = Object.assign(LAY[k] || {}, v); paint(k); }
  function pick(k) { cur = k; [].forEach.call(document.querySelectorAll('[data-el]'), function (el) { el.classList.toggle('sel', el.dataset.el === k); }); parent.postMessage({ dcEdit: 1, t: 'sel', el: k }, '*'); }
  function send(k) { parent.postMessage({ dcEdit: 1, t: 'move', el: k, v: LAY[k] }, '*'); }
  document.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-el]'); if (!el) return; ev.preventDefault(); var k = el.dataset.el; pick(k);
    var v = LAY[k] || {}; d = { k: k, x: ev.clientX, y: ev.clientY, dx: v.dx || 0, dy: v.dy || 0 };
  });
  document.addEventListener('pointermove', function (ev) { if (!d) return; put(d.k, { dx: Math.round((d.dx + (ev.clientX - d.x) * MM) * 2) / 2, dy: Math.round((d.dy + (ev.clientY - d.y) * MM) * 2) / 2 }); send(d.k); });
  document.addEventListener('pointerup', function () { d = null; });
  document.addEventListener('keydown', function (ev) {
    if (!cur || ev.key.indexOf('Arrow') !== 0) return; ev.preventDefault(); var v = LAY[cur] || {}, st = ev.shiftKey ? 5 : .5, dx = v.dx || 0, dy = v.dy || 0;
    if (ev.key === 'ArrowLeft') dx -= st; if (ev.key === 'ArrowRight') dx += st; if (ev.key === 'ArrowUp') dy -= st; if (ev.key === 'ArrowDown') dy += st; put(cur, { dx: dx, dy: dy }); send(cur);
  });
  window.addEventListener('message', function (ev) { var m = ev.data || {}; if (!m.dcEdit) return; if (m.t === 'set') put(m.el, m.v); if (m.t === 'sel') { cur = m.el; [].forEach.call(document.querySelectorAll('[data-el]'), function (el) { el.classList.toggle('sel', el.dataset.el === m.el); }); } });
  var els = []; [].forEach.call(document.querySelectorAll('[data-el]'), function (el) { if (els.indexOf(el.dataset.el) < 0) els.push(el.dataset.el); });
  Object.keys(LAY).forEach(paint); parent.postMessage({ dcEdit: 1, t: 'ready', els: els }, '*');
}
const dcEditScript = LY => '(' + dcEditRuntime.toString() + ')(' + JSON.stringify(LY || {}).replace(/</g, '\\u003c') + ')';
