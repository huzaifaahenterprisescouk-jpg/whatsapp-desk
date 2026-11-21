// Order confirmation / invoice as a PDF: A4, company logo, billing + shipping boxes, items table, totals, tracking link, footer.
// No packages: the PDF is written by hand (Helvetica text, PNG / JPEG logo). Letters outside Latin-1 (e.g. Urdu) cannot be drawn in
// the built-in fonts and are shown as "?".
const zlib = require('zlib');

const W = 595.28, H = 841.89, M = 40;

// ---------- text helpers (Helvetica widths per 1000 units, characters 32..126) ----------
const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BW = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const MAP = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*', ' ': ' ', '₨': 'Rs', '×': 'x' };
const clean = s => String(s ?? '').replace(/[–—‘’“”…• ₨×]/g, c => MAP[c]).replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e¡-ÿ]/g, '?');
const esc = s => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const tw = (s, size, bold) => { const t = bold ? BW : HW; let w = 0; for (const ch of clean(s)) { const c = ch.charCodeAt(0); w += (c >= 32 && c <= 126 ? t[c - 32] : 556); } return w * size / 1000; };
function wrap(s, maxW, size, bold) {
  const out = []; let line = '';
  for (let word of clean(s).split(' ')) {
    while (tw(word, size, bold) > maxW) { // a single very long word
      let cut = word.length; while (cut > 1 && tw(word.slice(0, cut), size, bold) > maxW) cut--;
      if (line) { out.push(line); line = ''; } out.push(word.slice(0, cut)); word = word.slice(cut);
    }
    const next = line ? line + ' ' + word : word;
    if (tw(next, size, bold) <= maxW) line = next; else { if (line) out.push(line); line = word; }
  }
  if (line) out.push(line); return out.length ? out : [''];
}
const fit = (s, maxW, size, bold) => { s = clean(s); if (tw(s, size, bold) <= maxW) return s; while (s.length > 1 && tw(s + '...', size, bold) > maxW) s = s.slice(0, -1); return s + '...'; };

// ---------- colours ----------
const hex = h => { h = /^#[0-9a-f]{6}$/i.test(h || '') ? h : '#0f766e'; return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const col = (h, stroke) => hex(h).map(v => v.toFixed(3)).join(' ') + (stroke ? ' RG' : ' rg');
const mix = (h, t, base = [1, 1, 1]) => '#' + hex(h).map((v, i) => Math.round((v * (1 - t) + base[i] * t) * 255).toString(16).padStart(2, '0')).join(''); // t=1 → base colour
const n2 = v => (+v).toFixed(2);

// ---------- images: PNG and JPEG logos ----------
function readPng(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 8, type = 6, inter = 0, plte = null, trns = null; const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); p += 12 + len;
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
  }
  if (!w || !h || w * h > 25e6) throw new Error('PNG too large');
  if (inter) throw new Error('interlaced PNG');
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (!chans) throw new Error('PNG type');
  const bpp = Math.max(1, chans * depth / 8), stride = Math.ceil(w * chans * depth / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat)); const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { // undo the PNG row filters
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - Math.ceil(bpp)] : 0, b = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - Math.ceil(bpp)] : 0; let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3), alpha = Buffer.alloc(w * h, 255); let hasA = false;
  const sample = (y, i) => { // channel i of a pixel row, scaled to 0..255
    if (depth === 8) return px[y * stride + i]; if (depth === 16) return px[y * stride + i * 2];
    const per = 8 / depth, byte = px[y * stride + Math.floor(i / per)], sh = 8 - depth * ((i % per) + 1); return (byte >> sh) & ((1 << depth) - 1);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3; let r, g, b, a = 255;
    if (type === 3) { const idx = sample(y, x); r = plte[idx * 3]; g = plte[idx * 3 + 1]; b = plte[idx * 3 + 2]; if (trns && idx < trns.length) a = trns[idx]; }
    else if (type === 0) { r = g = b = sample(y, x); if (depth < 8) r = g = b = Math.round(r * 255 / ((1 << depth) - 1)); }
    else if (type === 4) { r = g = b = sample(y, x * 2); a = sample(y, x * 2 + 1); }
    else if (type === 2) { r = sample(y, x * 3); g = sample(y, x * 3 + 1); b = sample(y, x * 3 + 2); }
    else { r = sample(y, x * 4); g = sample(y, x * 4 + 1); b = sample(y, x * 4 + 2); a = sample(y, x * 4 + 3); }
    rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b; alpha[y * w + x] = a; if (a !== 255) hasA = true;
  }
  return { w, h, kind: 'flate', cs: '/DeviceRGB', data: zlib.deflateSync(rgb), smask: hasA ? zlib.deflateSync(alpha) : null };
}
function readJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let p = 2;
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const m = buf[p + 1]; if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { p += 2; continue; }
    const len = buf.readUInt16BE(p + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      const n = buf[p + 9]; return { w: buf.readUInt16BE(p + 7), h: buf.readUInt16BE(p + 5), kind: 'dct', cs: n === 1 ? '/DeviceGray' : n === 4 ? '/DeviceCMYK' : '/DeviceRGB', data: buf, cmyk: n === 4 };
    }
    p += 2 + len;
  }
  throw new Error('JPEG size not found');
}
function readImage(buf) {
  if (!buf || !buf.length) throw new Error('empty image');
  if (buf.readUInt32BE(0) === 0x89504e47) return readPng(buf);
  if (buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
  throw new Error('The logo must be a PNG or JPG picture');
}

// ---------- a page ----------
class Page {
  constructor() { this.c = ''; this.links = []; }
  rect(x, y, w, h, fill) { this.c += `${col(fill)} ${n2(x)} ${n2(H - y - h)} ${n2(w)} ${n2(h)} re f\n`; }
  rrect(x, y, w, h, r, fill, stroke) {
    r = Math.min(r, w / 2, h / 2); const X = x, Y = H - y - h, k = r * 0.5523;
    const p = `${n2(X + r)} ${n2(Y)} m ${n2(X + w - r)} ${n2(Y)} l ${n2(X + w - r + k)} ${n2(Y)} ${n2(X + w)} ${n2(Y + r - k)} ${n2(X + w)} ${n2(Y + r)} c ${n2(X + w)} ${n2(Y + h - r)} l ${n2(X + w)} ${n2(Y + h - r + k)} ${n2(X + w - r + k)} ${n2(Y + h)} ${n2(X + w - r)} ${n2(Y + h)} c ${n2(X + r)} ${n2(Y + h)} l ${n2(X + r - k)} ${n2(Y + h)} ${n2(X)} ${n2(Y + h - r + k)} ${n2(X)} ${n2(Y + h - r)} c ${n2(X)} ${n2(Y + r)} l ${n2(X)} ${n2(Y + r - k)} ${n2(X + r - k)} ${n2(Y)} ${n2(X + r)} ${n2(Y)} c h`;
    this.c += `${fill ? col(fill) + '\n' : ''}${stroke ? col(stroke, true) + ' 0.8 w\n' : ''}${p} ${fill && stroke ? 'B' : fill ? 'f' : 'S'}\n`;
  }
  line(x1, y1, x2, y2, color, w = 0.6) { this.c += `${col(color, true)} ${w} w ${n2(x1)} ${n2(H - y1)} m ${n2(x2)} ${n2(H - y2)} l S\n`; }
  // y is the text baseline, measured from the top of the page
  text(s, x, y, { size = 10, bold = false, color = '#1f2937', align = 'left', max } = {}) {
    s = max ? fit(s, max, size, bold) : clean(s); const w = tw(s, size, bold);
    const X = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.c += `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${col(color)} ${n2(X)} ${n2(H - y)} Td (${esc(s)}) Tj ET\n`; return w;
  }
  image(name, x, y, w, h) { this.c += `q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(H - y - h)} cm /${name} Do Q\n`; }
  link(x, y, w, h, url) { this.links.push({ x, y: H - y - h, w, h, url }); }
  stamp(s, cx, cy, deg, color, size) { // text inside a rotated outlined box, e.g. PAID
    const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), w = tw(s, size, true) + 22, h = size + 14;
    this.c += `q ${c.toFixed(4)} ${sn.toFixed(4)} ${(-sn).toFixed(4)} ${c.toFixed(4)} ${n2(cx)} ${n2(H - cy)} cm\n${col(color, true)} 2 w ${n2(-w / 2)} ${n2(-h / 2)} ${n2(w)} ${n2(h)} re S\nBT /F2 ${size} Tf ${col(color)} ${n2(-w / 2 + 11)} ${n2(-size * 0.36)} Td (${esc(s)}) Tj ET\nQ\n`;
  }
}

// ---------- the document ----------
const STATUS = { pending: ['Awaiting payment', '#b45309'], processing: ['Processing', '#1d4ed8'], 'on-hold': ['On hold', '#b45309'], completed: ['Completed', '#15803d'], cancelled: ['Cancelled', '#b91c1c'], refunded: ['Refunded', '#6b7280'], failed: ['Failed', '#b91c1c'] };
const SYM = { USD: '$', GBP: '£', PKR: 'Rs ', EUR: 'EUR ', AED: 'AED ', SAR: 'SAR ' };
const money = (v, cur) => { const n = +v || 0, s = n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); const sym = SYM[cur] !== undefined ? SYM[cur] : (cur ? cur + ' ' : ''); return n < 0 ? '-' + sym + s.replace('-', '') : sym + s; };
const dateStr = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

/* order: { number, date, status, paymentMethod, paid, currency, items:[{name, sku, qty, price, total}], subtotal, shippingTotal, shippingMethod,
            discount, tax, total, billing:{name, company, address, phone, email}, shipping:{name, address, phone}, note, courier, cn, trackUrl }
   brand: { name, address, phone, email, website, taxId, color, footer, title, thanks, logo: Buffer } */
function orderPdf(order, brand = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(brand.color || '') ? brand.color : '#0f766e', soft = mix(color, 0.92), mid = mix(color, 0.8), cur = order.currency;
  let logo = null; if (brand.logo) { try { logo = readImage(brand.logo); } catch { logo = null; } }
  const pages = [new Page()]; let pg = pages[0]; let y = 0;
  const title = (brand.title || 'Order confirmation').toUpperCase();

  const header = p => {
    p.rect(0, 0, W, 9, color);
    const info = [brand.address, [brand.phone, brand.email].filter(Boolean).join('   |   '), brand.website, brand.taxId ? 'Tax / NTN: ' + brand.taxId : ''].filter(Boolean);
    if (logo) { // the logo usually carries the name already: logo on top, contact lines under it
      const bw = 200, bh = 54, s = Math.min(bw / logo.w, bh / logo.h), lw = logo.w * s, lh = logo.h * s; p.image('Im1', M, 24 + (bh - lh) / 2, lw, lh);
      let iy = 92; for (const l of info.slice(0, 3)) for (const w of wrap(l, 300, 8.5)) { p.text(w, M, iy, { size: 8.5, color: '#6b7280' }); iy += 11; }
    } else {
      p.rrect(M, 30, 52, 52, 12, color); p.text((brand.name || 'S').trim().charAt(0).toUpperCase() || 'S', M + 26, 66, { size: 26, bold: true, color: '#ffffff', align: 'center' });
      p.text(brand.name || 'Your store', M + 66, 46, { size: 15, bold: true, color: '#111827', max: 230 });
      let iy = 60; for (const l of info.slice(0, 4)) for (const w of wrap(l, 230, 8.5)) { p.text(w, M + 66, iy, { size: 8.5, color: '#6b7280' }); iy += 11; }
    }
    p.text(title, W - M, 52, { size: 19, bold: true, color, align: 'right' });
    p.text('Order #' + order.number, W - M, 72, { size: 12, bold: true, color: '#111827', align: 'right' });
    if (order.date) p.text(dateStr(order.date), W - M, 88, { size: 9, color: '#6b7280', align: 'right' });
    p.line(M, 124, W - M, 124, '#e5e7eb', 0.8);
  };
  const footer = (p, i, n) => {
    p.line(M, 782, W - M, 782, '#e5e7eb', 0.8);
    p.text(brand.footer || `Thank you for shopping with ${brand.name || 'us'}!`, M, 799, { size: 9.5, bold: true, color, max: W - 2 * M - 80 });
    const c = [brand.phone, brand.email, brand.website].filter(Boolean).join('   |   ');
    if (c) p.text(c, M, 812, { size: 8, color: '#6b7280', max: W - 2 * M - 80 });
    p.text(`Page ${i + 1} of ${n}`, W - M, 799, { size: 8, color: '#6b7280', align: 'right' });
    p.text('Computer-generated document. No signature required.', W - M, 812, { size: 7, color: '#9ca3af', align: 'right' });
    p.rect(0, H - 6, W, 6, color);
  };
  header(pg);

  // --- three boxes: billed to / ship to / order info
  y = 140;
  const bw = (W - 2 * M - 20) / 3, bh = 104, b = order.billing || {}, s = order.shipping && (order.shipping.address || order.shipping.name) ? order.shipping : b;
  const box = (i, label, lines) => {
    const x = M + i * (bw + 10); pg.rrect(x, y, bw, bh, 8, soft); pg.rect(x, y + 12, 3, 14, color); pg.text(label, x + 12, y + 22, { size: 7.5, bold: true, color });
    let ty = y + 40; for (const l of lines.filter(Boolean)) for (const w of wrap(l.t || l, bw - 22, l.b ? 10 : 9, !!l.b)) { if (ty < y + bh - 6) pg.text(w, x + 12, ty, { size: l.b ? 10 : 9, bold: !!l.b, color: l.b ? '#111827' : '#4b5563' }); ty += 12; }
  };
  box(0, 'BILLED TO', [{ t: b.name, b: 1 }, b.company, b.address, b.phone, b.email]);
  box(1, 'SHIP TO', [{ t: s.name, b: 1 }, s.address, s.phone]);
  {
    const x = M + 2 * (bw + 10); pg.rrect(x, y, bw, bh, 8, soft); pg.rect(x, y + 12, 3, 14, color); pg.text('ORDER DETAILS', x + 12, y + 22, { size: 7.5, bold: true, color });
    const row = (k, v, ry) => { pg.text(k, x + 12, ry, { size: 8.5, color: '#6b7280' }); pg.text(v, x + bw - 12, ry, { size: 9, bold: true, color: '#111827', align: 'right', max: bw - 70 }); };
    row('Order no.', '#' + order.number, y + 40); row('Date', dateStr(order.date), y + 55); row('Payment', order.paymentMethod || '-', y + 70);
    const st = STATUS[order.status] || [String(order.status || '').replace(/-/g, ' ') || 'Received', color], sw = tw(st[0], 8.5, true) + 18;
    pg.text('Status', x + 12, y + 90, { size: 8.5, color: '#6b7280' }); pg.rrect(x + bw - 12 - sw, y + 79, sw, 16, 8, mix(st[1], 0.86)); pg.text(st[0], x + bw - 12 - sw / 2, y + 90.5, { size: 8.5, bold: true, color: st[1], align: 'center' });
  }
  y += bh + 22;

  // --- items table
  const cQty = W - M - 190, cPrice = W - M - 112, cTot = W - M - 10, nameW = cQty - M - 42;
  const thead = p => { p.rrect(M, y, W - 2 * M, 24, 6, color); p.text('#', M + 10, y + 16, { size: 8.5, bold: true, color: '#ffffff' }); p.text('ITEM', M + 32, y + 16, { size: 8.5, bold: true, color: '#ffffff' }); p.text('QTY', cQty, y + 16, { size: 8.5, bold: true, color: '#ffffff', align: 'center' }); p.text('PRICE', cPrice, y + 16, { size: 8.5, bold: true, color: '#ffffff', align: 'right' }); p.text('TOTAL', cTot, y + 16, { size: 8.5, bold: true, color: '#ffffff', align: 'right' }); y += 30; };
  const newPage = () => { pg = new Page(); pages.push(pg); header(pg); y = 144; };
  thead(pg);
  (order.items || []).forEach((it, i) => {
    const nl = wrap(it.name || 'Item', nameW, 9.5, true).slice(0, 3), rh = 12 + nl.length * 12 + (it.sku ? 11 : 0) + (it.meta ? 11 : 0);
    if (y + rh > 700) { newPage(); thead(pg); }
    if (i % 2 === 0) pg.rect(M, y - 6, W - 2 * M, rh, '#f9fafb');
    pg.text(String(i + 1), M + 10, y + 8, { size: 9, color: '#6b7280' });
    let ty = y + 8; for (const l of nl) { pg.text(l, M + 32, ty, { size: 9.5, bold: true, color: '#111827' }); ty += 12; }
    if (it.sku) { pg.text('SKU: ' + it.sku, M + 32, ty - 1, { size: 7.5, color: '#9ca3af' }); ty += 11; }
    if (it.meta) pg.text(it.meta, M + 32, ty - 1, { size: 7.5, color: '#6b7280', max: nameW });
    pg.text(String(it.qty), cQty, y + 8, { size: 9.5, align: 'center' }); pg.text(money(it.price, cur), cPrice, y + 8, { size: 9.5, align: 'right' }); pg.text(money(it.total, cur), cTot, y + 8, { size: 9.5, bold: true, align: 'right' });
    y += rh; pg.line(M, y - 6, W - M, y - 6, '#eef0f3', 0.6);
  });
  y += 8;

  // --- totals (right) and notes / tracking (left)
  const rows = [['Subtotal', money(order.subtotal, cur)]];
  if (+order.shippingTotal || order.shippingMethod) rows.push([order.shippingMethod ? 'Shipping (' + fit(order.shippingMethod, 90, 9) + ')' : 'Shipping', +order.shippingTotal ? money(order.shippingTotal, cur) : 'Free']);
  if (+order.discount) rows.push(['Discount', '-' + money(order.discount, cur)]);
  if (+order.tax) rows.push(['Tax', money(order.tax, cur)]);
  const need = rows.length * 18 + 80; if (y + need > 770) newPage();
  const tx = W - M - 230, ty0 = y;
  for (const [k, v] of rows) { pg.text(k, tx + 12, y + 10, { size: 9.5, color: '#4b5563' }); pg.text(v, W - M - 12, y + 10, { size: 9.5, bold: true, align: 'right' }); y += 18; }
  y += 4; pg.rrect(tx, y, 230, 34, 8, color); pg.text('TOTAL', tx + 14, y + 21, { size: 10, bold: true, color: '#ffffff' }); pg.text(money(order.total, cur), W - M - 14, y + 22, { size: 14, bold: true, color: '#ffffff', align: 'right' });
  const endTotals = y + 34;

  let ly = ty0; const lw = tx - M - 20;
  if (order.paid) { pg.stamp('PAID', M + 52, ly + 22, 8, '#15803d', 17); ly += 56; }
  else if (/cash on delivery|cod/i.test(order.paymentMethod || '')) { pg.rrect(M, ly, lw, 40, 8, '#fffbeb', '#fcd34d'); pg.text('Cash on delivery', M + 12, ly + 16, { size: 9.5, bold: true, color: '#92400e' }); pg.text('Please keep ' + money(order.total, cur) + ' ready for the delivery person.', M + 12, ly + 30, { size: 8.5, color: '#92400e', max: lw - 24 }); ly += 52; }
  if (order.courier || order.cn) {
    pg.rrect(M, ly, lw, order.trackUrl ? 52 : 40, 8, soft); pg.text('SHIPMENT', M + 12, ly + 15, { size: 7.5, bold: true, color });
    pg.text([order.courier, order.cn ? 'CN ' + order.cn : ''].filter(Boolean).join('  -  '), M + 12, ly + 30, { size: 10, bold: true, color: '#111827', max: lw - 24 });
    if (order.trackUrl) { pg.text('Track your parcel online >', M + 12, ly + 45, { size: 9, bold: true, color }); pg.link(M + 12, ly + 35, 140, 14, order.trackUrl); }
    ly += order.trackUrl ? 64 : 52;
  }
  if (order.note) { pg.text('CUSTOMER NOTE', M, ly + 10, { size: 7.5, bold: true, color }); ly += 14; for (const l of wrap(order.note, lw, 9).slice(0, 4)) { pg.text(l, M, ly + 8, { size: 9, color: '#4b5563' }); ly += 11; } }
  y = Math.max(endTotals, ly) + 18;
  if (brand.thanks && y < 750) { for (const l of wrap(brand.thanks, W - 2 * M, 9.5).slice(0, 3)) { pg.text(l, M, y, { size: 9.5, color: '#4b5563' }); y += 12; } }

  pages.forEach((p, i) => footer(p, i, pages.length));
  return build(pages, logo);
}

function build(pages, logo) {
  const objs = []; // 1-based
  const add = o => objs.push(o) && objs.length;
  const catalog = add(null), pagesId = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  let imId = 0;
  if (logo) {
    let sm = 0;
    if (logo.smask) sm = add({ dict: `/Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, data: logo.smask });
    imId = add({ dict: `/Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace ${logo.cs} /BitsPerComponent 8 /Filter ${logo.kind === 'dct' ? '/DCTDecode' : '/FlateDecode'}${logo.cmyk ? ' /Decode [1 0 1 0 1 0 1 0]' : ''}${sm ? ` /SMask ${sm} 0 R` : ''}`, data: logo.data });
  }
  const kids = [];
  for (const p of pages) {
    const cid = add({ dict: '/Filter /FlateDecode', data: zlib.deflateSync(Buffer.from(p.c, 'latin1')) });
    const annots = p.links.map(l => add(`<< /Type /Annot /Subtype /Link /Rect [${n2(l.x)} ${n2(l.y)} ${n2(l.x + l.w)} ${n2(l.y + l.h)}] /Border [0 0 0] /A << /S /URI /URI (${String(l.url).replace(/[^\x21-\x7e]/g, c => encodeURIComponent(c)).replace(/[()\\]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}) >> >>`));
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${imId ? ` /XObject << /Im1 ${imId} 0 R >>` : ''} >> /Contents ${cid} 0 R${annots.length ? ` /Annots [${annots.map(a => a + ' 0 R').join(' ')}]` : ''} >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offs = []; let pos = parts[0].length;
  objs.forEach((o, i) => {
    offs[i + 1] = pos;
    const b = typeof o === 'string' ? Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< ${o.dict} /Length ${o.data.length} >>\nstream\n`, 'latin1'), o.data, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    parts.push(b); pos += b.length;
  });
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= objs.length; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  parts.push(Buffer.from(x + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { orderPdf, readImage, money, clean };
