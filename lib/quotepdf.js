// Dependency-free PDF writer for ONE document type: the quotation form (A4 portrait, Helvetica, optional JPEG logo + signature/stamp).
// Layout follows the M.R. Enterprises quotation: title, company block + logo, "QUOTE TO", blue item table, totals,
// thank-you line, regards + signature, "Terms & Instructions". Long item lists continue on extra pages.

// ---- Helvetica character widths (1000 units per em), characters 32..126 ----
const WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const MAP = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*', ' ': ' ', '₨': 'Rs' };
const clean = s => String(s ?? '').replace(/[–—‘’“”…• ₨]/g, c => MAP[c]).replace(/[\r\t]+/g, ' ').replace(/[^\n\x20-\x7e¡-ÿ]/g, '?');
const esc = s => clean(s).replace(/\n/g, ' ').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const cw = (ch, bold) => { const c = ch.charCodeAt(0); return ((bold ? WB : WR)[c - 32] || 556); };
const tw = (s, size, bold) => { let w = 0; for (const ch of clean(s)) w += cw(ch, bold); return w * size / 1000; };
const hex = (h, d = '#2e75b6') => { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : d; return [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' '); };

function wrap(text, size, bold, maxW) {
  const out = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      // a single word wider than the column is cut
      let w = word; while (tw(w, size, bold) > maxW && w.length > 1) { let n = w.length; while (n > 1 && tw(w.slice(0, n), size, bold) > maxW) n--; if (line) { out.push(line); line = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
      const t = line ? line + ' ' + w : w;
      if (tw(t, size, bold) <= maxW) line = t; else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

// ---- JPEG info (the app converts every uploaded logo / signature to JPEG in the browser) ----
function jpegInfo(dataUrl) {
  const m = /^data:image\/jpe?g;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '')); if (!m) return null;
  const buf = Buffer.from(m[1], 'base64'); if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const mk = buf[i + 1];
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
      const h = buf.readUInt16BE(i + 5), w = buf.readUInt16BE(i + 7), comps = buf[i + 9];
      if (!w || !h || (comps !== 1 && comps !== 3)) return null;
      return { buf, w, h, cs: comps === 1 ? '/DeviceGray' : '/DeviceRGB' };
    }
    if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

// ---- table / page layout (the "Customize layout" settings). Missing values fall back to the original look ----
const LAYOUT_DEF = { headFill: '', headText: '#ffffff', headSize: 8.6, headH: 22, rowFill: '#f2f2f2', rowSize: 8.8, minRow: 20, grid: true, vlines: true, lineColor: '#cccccc',
  sec: { quoteTo: true, meta: true, breakdown: true, thanks: true, regards: true, signature: true, terms: true } };
const hex6 = (v, d) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : d;
const rng = (v, d, lo, hi) => { const n = parseFloat(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const yes = (v, d) => v === undefined || v === null ? d : !(v === false || v === 0 || v === '0' || v === 'false');
function layoutOf(v) {
  v = v && typeof v === 'object' ? v : {}; const D = LAYOUT_DEF, s = v.sec && typeof v.sec === 'object' ? v.sec : {}, sec = {};
  for (const k of Object.keys(D.sec)) sec[k] = yes(s[k], true);
  return {
    headFill: v.headFill ? hex6(v.headFill, '') : '', headText: hex6(v.headText, D.headText), headSize: rng(v.headSize, D.headSize, 5.5, 14), headH: rng(v.headH, D.headH, 16, 44),
    rowFill: v.rowFill === undefined || v.rowFill === null ? D.rowFill : (v.rowFill ? hex6(v.rowFill, D.rowFill) : ''), rowSize: rng(v.rowSize, D.rowSize, 6, 14), minRow: rng(v.minRow, D.minRow, 14, 80),
    grid: yes(v.grid, true), vlines: yes(v.vlines, true), lineColor: hex6(v.lineColor, D.lineColor), sec,
  };
}

const fmt = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateText = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}-${MON[+m[2] - 1] || m[2]}-${m[1]}` : String(iso || ''); };
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
function totals(items) {
  let sub = 0, gst = 0;
  const rows = (items || []).map(it => {
    const qty = Number(it.qty) || 0, price = Number(it.price) || 0, rate = Number(it.gst) || 0;
    const base = round2(qty * price), tax = round2(base * rate / 100);
    sub += base; gst += tax; return { ...it, qty, price, rate, base, tax, total: round2(base + tax) };
  });
  return { rows, sub: round2(sub), gst: round2(gst), total: round2(sub + gst) };
}

// ---- the document ----
// q: { no, date, validDays, toLines, items:[{desc,qty,unit,price,gst}], thanks, terms, head:{title,company,address,lines,logo,signature,signer,signerCompany,color,currency} }
function render(q) {
  const W = 595.28, H = 841.89, M = 40, CW_ = W - 2 * M, BOT = H - 46;
  const h = q.head || {}, BLUE = hex(h.color), cur = (h.currency || '').trim();
  const logo = jpegInfo(h.logo), sig = jpegInfo(h.signature);
  const T = totals(q.items);
  let c = '', y = 0;
  const streams = [];
  const begin = () => { c = ''; streams.push(''); y = 0; };
  const flush = () => { streams[streams.length - 1] = c; };
  const Y = v => (H - v).toFixed(2); // top-based y -> PDF y
  const text = (s, x, yy, size, bold, color, align) => {
    const t = clean(s).replace(/\n/g, ' '); const w = tw(t, size, bold);
    const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    c += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${xx.toFixed(2)} ${Y(yy)} Td (${esc(t)}) Tj ET\n`;
  };
  const rect = (x, yy, w, hh, fill) => { c += `${fill} rg ${x.toFixed(2)} ${(H - yy - hh).toFixed(2)} ${w.toFixed(2)} ${hh.toFixed(2)} re f\n`; };
  const line = (x1, y1, x2, y2, stroke, lw) => { c += `${stroke} RG ${lw || 0.6} w ${x1.toFixed(2)} ${Y(y1)} m ${x2.toFixed(2)} ${Y(y2)} l S\n`; };
  const box = (x, yy, w, hh, stroke) => { c += `${stroke} RG 0.6 w ${x.toFixed(2)} ${(H - yy - hh).toFixed(2)} ${w.toFixed(2)} ${hh.toFixed(2)} re S\n`; };
  const image = (name, info, x, yy, maxW, maxH, align) => {
    const s = Math.min(maxW / info.w, maxH / info.h), w = info.w * s, hh = info.h * s, xx = align === 'right' ? x + maxW - w : x;
    c += `q ${w.toFixed(2)} 0 0 ${hh.toFixed(2)} ${xx.toFixed(2)} ${(H - yy - hh).toFixed(2)} cm /${name} Do Q\n`; return { w, h: hh };
  };
  const GREY = '0.29 0.29 0.29', BLACK = '0 0 0', NAVY = '0.27 0.33 0.42', WHITE = '1 1 1', LINE = '0.80 0.80 0.80';

  // columns
  // the columns come from q.cols: an ordered list of { k, on, l } (older quotations may have the plain on/off form)
  const LY = layoutOf(q.layout), SEC = LY.sec;
  const WID = { desc: 0, qty: 38, unit: 48, price: 72, gst: 44, total: 78, x1: 74, x2: 74, x3: 74, x4: 74 }, DEF = [['desc', 'Description'], ['qty', 'Qty'], ['unit', 'Unit'], ['price', 'Unit price'], ['gst', 'GST %'], ['total', 'Total'], ['x1', 'Custom 1'], ['x2', 'Custom 2'], ['x3', 'Custom 3'], ['x4', 'Custom 4']];
  const AL = { desc: 'l', total: 'r' }, TEXTK = ['desc', 'unit', 'x1', 'x2', 'x3', 'x4'];
  const lay = Array.isArray(q.cols) ? q.cols.filter(e => e && WID[e.k] !== undefined) : [];
  DEF.forEach(([k, l]) => { if (!lay.some(e => e.k === k)) lay.push({ k, l, on: q.cols && !Array.isArray(q.cols) ? q.cols[k] !== false : !k.startsWith('x') }); });
  const on = Object.fromEntries(lay.map(e => [e.k, e.on !== false]));
  const cols = lay.filter(e => ['desc', 'price', 'total'].includes(e.k) || e.on !== false).map(e => ({ k: e.k, l: String(e.l || DEF.find(d => d[0] === e.k)[1]).toUpperCase(), w: e.k !== 'desc' && +e.w > 0 ? Math.min(300, +e.w) : WID[e.k],
    ha: ['l', 'c', 'r'].includes(e.a) ? e.a : 'c', al: ['l', 'c', 'r'].includes(e.a) ? e.a : (AL[e.k] || 'c'), bold: e.b !== false && e.b !== 0, sz: +e.sz > 0 ? Math.min(14, Math.max(6, +e.sz)) : LY.rowSize }));
  const di = Math.max(0, cols.findIndex(k => k.k === 'desc')); // the description takes whatever width is left
  { const others = cols.reduce((a, k, i) => i === di ? a : a + k.w, 0), room = CW_ - 90; if (others > room) cols.forEach((k, i) => { if (i !== di) k.w = k.w * room / others; }); cols[di].w = CW_ - cols.reduce((a, k, i) => i === di ? a : a + k.w, 0); }
  const colX = []; { let x = M; for (const k of cols) { colX.push(x); x += k.w; } }
  const LNC = hex(LY.lineColor, '#cccccc'), alignX = (i, al, padL, padR) => al === 'l' ? colX[i] + padL : al === 'r' ? colX[i] + cols[i].w - padR : colX[i] + cols[i].w / 2;
  const tableHead = () => {
    rect(M, y, CW_, LY.headH, LY.headFill ? hex(LY.headFill) : BLUE);
    cols.forEach((k, i) => { let sz = LY.headSize; while (sz > 5.5 && tw(k.l, sz, true) > k.w - 4) sz -= 0.4; text(k.l, alignX(i, k.ha, 6, 6), y + LY.headH / 2 + 3.5, sz, true, hex(LY.headText, '#ffffff'), k.ha === 'l' ? 'left' : k.ha === 'r' ? 'right' : 'center'); });
    y += LY.headH;
  };

  // ---------- page 1: header ----------
  begin();
  text(h.title || 'QUOTATION FORM', W / 2, 36, 10, true, BLUE, 'center');
  const logoBox = logo ? { w: 150, h: 110 } : { w: 0, h: 0 };
  const leftW = CW_ - (logo ? logoBox.w + 14 : 0);
  let ly = 66;
  for (const ln of wrap(h.company || '', 21, true, leftW)) { text(ln, M, ly, 21, true, BLUE); ly += 24; }
  ly += -2;
  const info = [h.address, ...String(h.lines || '').split('\n')].filter(s => s && s.trim());
  for (const t of info) for (const ln of wrap(t, 9.2, true, leftW)) { text(ln, M, ly + 6, 9.2, true, GREY); ly += 16.5; }
  let hy = ly + 6;
  if (logo) { const d = image('Im1', logo, W - M - logoBox.w, 24, logoBox.w, logoBox.h, 'right'); hy = Math.max(hy, 24 + d.h + 8); }

  // ---------- quote to ----------
  y = Math.max(hy, 150) + 4;
  const toLines = SEC.quoteTo ? String(q.toLines || '').split('\n').map(s => s.trim()).filter(Boolean) : [];
  const meta = SEC.meta ? [['Quote Date:', dateText(q.date)], ['Valid For:', q.validDays ? `${q.validDays} days` : ''], ['Quote No:', q.no || '']].filter(m => m[1]) : [];
  if (SEC.quoteTo) { text('QUOTE TO :', M, y + 8, 8.6, true, BLUE); line(M, y + 13, M + CW_ * 0.70, y + 13, LINE, 0.8); }
  let ty = y + 29; const labX = W - M - 92, valX = W - M - 82;
  meta.forEach((m, i) => { text(m[0], labX, y + 23 + i * 16, 8.8, true, BLUE, 'right'); text(m[1], valX, y + 23 + i * 16, 9.2, false, BLACK); });
  for (const t of toLines) for (const ln of wrap(t, 10, false, CW_ * 0.60)) { text(ln, M, ty, 10, false, BLACK); ty += 15; }
  if (SEC.quoteTo || meta.length) y = Math.max(SEC.quoteTo ? ty - 6 : 0, y + 23 + meta.length * 16 - 6) + 6; else y = hy;

  // ---------- item table ----------
  tableHead();
  const cellText = (r, k) => k === 'qty' ? String(r.qty % 1 ? r.qty : Math.round(r.qty)) : k === 'price' ? fmt(r.price) : k === 'gst' ? r.rate + '%' : k === 'total' ? fmt(r.total) : String(r[k] == null ? '' : r[k]);
  for (const r of T.rows) {
    const cells = cols.map(k => TEXTK.includes(k.k) ? wrap(cellText(r, k.k), k.sz, k.bold, k.w - 12) : [cellText(r, k.k)]);
    const lh = i => cols[i].sz * 1.36, rh = Math.max(LY.minRow, Math.max(...cells.map((c, i) => c.length * lh(i))) + 9);
    if (y + rh > BOT - 40) { flush(); begin(); y = 50; tableHead(); }
    if (LY.rowFill) rect(M, y, CW_, rh, hex(LY.rowFill, '#f2f2f2'));
    if (LY.grid) { box(M, y, CW_, rh, LNC); if (LY.vlines) for (let i = 1; i < cols.length; i++) line(colX[i], y, colX[i], y + rh, LNC, 0.5); } else line(M, y + rh, M + CW_, y + rh, LNC, 0.5);
    cols.forEach((k, i) => {
      const ls = cells[i], bh = ls.length * lh(i), x = alignX(i, k.al, 6, 8), al = k.al === 'l' ? 'left' : k.al === 'r' ? 'right' : 'center';
      ls.forEach((t, n) => text(t, x, y + (rh - bh) / 2 + lh(i) / 2 + 0.364 * k.sz + n * lh(i), k.sz, k.bold, BLACK, al));
    });
    y += rh;
  }
  if (!T.rows.length) { box(M, y, CW_, 24, LNC); text('No items yet', M + 8, y + 15, 9, false, GREY); y += 24; }

  // ---------- totals + closing blocks (kept together; moved to a new page when they do not fit) ----------
  const termLines = String(q.terms || '').split('\n').map(s => s.trim()).filter(Boolean).flatMap(t => wrap(t, 8.6, false, CW_));
  const needed = 62 + 34 + 90 + (termLines.length ? 24 + termLines.length * 13 : 0);
  if (y + needed > BOT) { flush(); begin(); y = 50; }
  const tx = W - M - 194, tw_ = W - M - tx;
  y += 8;
  const trow = (l, v, bold, ruled) => {
    if (ruled) line(tx, y - 3, W - M, y - 3, '0.60 0.60 0.60', 0.8);
    text(l, tx + 6, y + 8, bold ? 9.4 : 8.8, bold, bold ? BLACK : GREY); text((cur ? cur + ' ' : '') + fmt(v), W - M - 8, y + 8, bold ? 9.4 : 8.8, bold, BLACK, 'right'); y += 16;
  };
  const thanksY = y + 4;
  if (SEC.breakdown && on.gst && (T.rows.some(r => r.tax) || T.rows.length > 1)) { trow('Subtotal', T.sub); trow('GST', T.gst); }
  trow('Total', T.total, true, true);
  if (q.thanks && SEC.thanks) text(q.thanks, M, thanksY + 8, 8.8, false, '0.15 0.15 0.15');

  y = Math.max(y + 20, thanksY + 34);
  const sy = y;
  if (SEC.regards) {
    text('REGARDS', M, sy + 8, 8.8, true, BLACK);
    if (h.signer) text(h.signer, M, sy + 24, 8.8, true, BLACK);
    if (h.signerCompany || h.company) text(h.signerCompany || h.company, M, sy + 40, 8.8, true, BLACK);
  }
  if (SEC.signature) {
    if (sig) image('Im2', sig, W - M - 170, sy - 4, 170, 66, 'right');
    line(W - M - 160, sy + 66, W - M, sy + 66, BLACK, 0.8);
    text('Signature', W - M - 80, sy + 79, 10, false, BLACK, 'center');
  }
  y = sy + (SEC.regards || SEC.signature ? 94 : 0);
  if (SEC.terms) {
    text('Terms & Instructions', M, y, 8.6, true, BLUE);
    line(M, y + 6, W - M, y + 6, BLACK, 0.8);
    let ky = y + 21;
    for (const l of termLines) { text(l, M, ky, 8.6, false, NAVY); ky += 13; }
  }
  flush();

  // ---------- assemble the PDF ----------
  const total = streams.length;
  streams.forEach((s, i) => { if (total > 1) { c = s; text(`Page ${i + 1} of ${total}`, W - M, H - 24, 7.5, false, '0.5 0.5 0.5', 'right'); streams[i] = c; } });
  const objs = []; // objs[id] = string | Buffer-stream descriptor
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  let next = 5; const xo = [];
  if (logo) { const id = next++; objs[id] = { dict: `/Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace ${logo.cs} /BitsPerComponent 8 /Filter /DCTDecode`, data: logo.buf }; xo.push(`/Im1 ${id} 0 R`); }
  if (sig) { const id = next++; objs[id] = { dict: `/Type /XObject /Subtype /Image /Width ${sig.w} /Height ${sig.h} /ColorSpace ${sig.cs} /BitsPerComponent 8 /Filter /DCTDecode`, data: sig.buf }; xo.push(`/Im2 ${id} 0 R`); }
  const kids = [];
  streams.forEach(s => {
    const pid = next++, cid = next++; kids.push(`${pid} 0 R`);
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo.length ? ` /XObject << ${xo.join(' ')} >>` : ''} >> /Contents ${cid} 0 R >>`;
    objs[cid] = { dict: '', data: Buffer.from(s, 'latin1') };
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offs = []; let pos = parts[0].length;
  for (let i = 1; i < objs.length; i++) {
    offs[i] = pos; const o = objs[i];
    const b = typeof o === 'string' ? Buffer.from(`${i} 0 obj\n${o}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${i} 0 obj\n<< ${o.dict} /Length ${o.data.length} >>\nstream\n`, 'latin1'), o.data, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    parts.push(b); pos += b.length;
  }
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) xref += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  parts.push(Buffer.from(xref + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { render, totals, fmt, dateText, jpegInfo, layoutOf, LAYOUT_DEF };
