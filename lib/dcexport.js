// Bulk print of selected DCs: ONE ROW PER ITEM, in the layout of the company's item sheet
//   DENO | NAME OF ITEMS | UNIT | PRICE | AMOUNT EXCL S.TAX | TAX % | TAX VALUE | TOTAL AMOUNT INCLS TAX | DC No# | INVOICE# | Requisition | PONO | Deliver-To | COST CODE | PERSON | CONTACT
// The items come from the same place as "Print bill" / "Print DC": the items sheet (bill tab first, it has the prices), else the DC tab, else the items typed in DC files.
// Output: an .xlsx (grey heading, borders, filter buttons), a PDF (A4 landscape) or plain rows for the browser's Print window.
const itemidx = require('./itemidx');
const dcfiles = require('./dcfiles');
const { writeZip } = require('./xlsx');

const HEAD = ['DENO', 'NAME OF ITEMS', 'UNIT', 'PRICE', 'AMOUNT EXCL S.TAX', 'TAX %', 'TAX VALUE', 'TOTAL AMOUNT INCLS TAX', 'DC No#', 'INVOICE#', 'Requisition', 'PONO', 'Deliver-To', 'COST CODE', 'PERSON', 'CONTACT'];
const NUM = new Set([0, 3, 4, 6, 7]);            // numeric columns (qty, price, amount, tax value, total)
const CENTER = new Set([0, 2, 5, 8, 9, 10, 11, 13]);
const YELLOW = new Set();                         // no highlighted columns
const WEIGHT = [5.4, 21, 5, 6.5, 8, 5, 6.5, 8.5, 6.5, 7.4, 7.8, 6.5, 16, 5.5, 9, 9];

const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = v => { let s = String(v == null ? '' : v).trim(); if (!s) return null; const n = parseFloat(s.replace('%', '')); if (!isFinite(n)) return null; return /^0?\.\d+$/.test(s) ? n * 100 : n; };

// the items + heading details (invoice no, address, person ...) of one DC
async function linesOf(o) {
  let r = { items: [], head: {} };
  try { await itemidx.ensureLookup(o); } catch { /* the sheets are used as they are */ }
  try { r = itemidx.docFor(o, 'bill'); if (!r.items.length) r = itemidx.docFor(o, 'dc'); } catch { r = { items: [], head: {} }; }
  if (!r.items.length) { let items = []; try { items = await dcfiles.itemsForOrderAsync(o); } catch { try { items = dcfiles.itemsForOrder(o); } catch { items = []; } } r = { items, head: {} }; }
  return r;
}

// rows[]: { cells: [17 values], total?: true }   missing[]: DCs that have no items
async function build(orderList) {
  const rows = [], missing = []; const tot = { a: 0, tv: 0, t: 0 };
  for (const o of orderList) {
    const { items, head } = await linesOf(o), h = head || {};
    const ids = [o.dc || '', h.iv || '', h.pr || o.pr || '', h.po || o.po || '', h.ad || o.address || '', h.cc || '', h.ct || '', h.ph || o.phone || ''];
    const tail = [ids[0], ids[1], ids[2], ids[3], ids[4], ids[5], ids[6], ids[7]];
    if (!items.length) { missing.push(o.dc || o.po || o.orderId); rows.push({ cells: ['', '(no items found for this DC)', '', '', '', '', '', '', ...tail] }); continue; }
    for (const it of items) {
      const qty = num(it.qty), price = num(it.price), tp = pct(it.taxp);
      const amt = num(it.amt) || r2(qty * price), tv = num(it.taxv) || (tp != null ? r2(amt * tp / 100) : 0), total = num(it.total) || r2(amt + tv);
      const code = it.code && !/^0+$/.test(it.code) ? String(it.code) : '';
      tot.a += amt; tot.tv += tv; tot.t += total;
      rows.push({ cells: [qty || '', String(it.desc || '') + (code ? '\n' + code : ''), it.unit || '', price || '', amt || '', tp != null ? (Math.round(tp * 100) / 100) + '%' : '', (tp != null || tv) ? tv : '', total || '', ...tail] });
    }
  }
  if (rows.length > 1) rows.push({ total: true, cells: ['', 'TOTAL', '', '', r2(tot.a), '', r2(tot.tv), r2(tot.t), '', '', '', '', '', '', '', ''] });
  return { header: HEAD, rows, missing, dcs: orderList.length };
}

// ---------------- Excel ----------------
const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xe = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// styles: 0 plain | 1 heading | 2 text | 3 centred | 4 money | 5 yellow bold centred | 6 total text | 7 total money
const STYLES = X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>'
  + '<fonts count="3"><font><sz val="10"/><name val="Calibri"/></font><font><b/><i/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts>'
  + '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'
  + '<xf numFmtId="164" fontId="2" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

const lines = (s, w) => { let n = 0; for (const p of String(s || '').split('\n')) n += Math.max(1, Math.ceil(p.length / Math.max(1, w))); return n; };

function toXlsx(b) {
  const widths = WEIGHT.map(w => Math.max(7, Math.round(w * 1.15 + 3)));
  const sheetRows = [`<row r="1" ht="32" customHeight="1">${HEAD.map((h, i) => `<c r="${colName(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xe(h)}</t></is></c>`).join('')}</row>`];
  b.rows.forEach((row, ri) => {
    const r = ri + 2, mx = Math.max(...row.cells.map((v, i) => (typeof v === 'number' ? 1 : lines(v, widths[i] - 1))));
    sheetRows.push(`<row r="${r}"${mx > 1 ? ` ht="${Math.min(160, 14 * mx + 3)}" customHeight="1"` : ' ht="19" customHeight="1"'}>` + row.cells.map((v, i) => {
      const ref = `${colName(i)}${r}`, isNum = NUM.has(i) && v !== '' && typeof v === 'number';
      if (row.total) return isNum ? `<c r="${ref}" s="7"><v>${v}</v></c>` : `<c r="${ref}" s="6" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      if (isNum) return i === 0 ? `<c r="${ref}" s="3"><v>${v}</v></c>` : `<c r="${ref}" s="4"><v>${v}</v></c>`;
      const st = YELLOW.has(i) ? 5 : CENTER.has(i) ? 3 : 2;
      return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('') + '</row>');
  });
  const last = `${colName(HEAD.length - 1)}${b.rows.length + 1}`;
  return writeZip([
    ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DC items" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'DC items\'!$A$1:$' + colName(HEAD.length - 1) + '$' + (b.rows.length + 1) + '</definedName></definedNames></workbook>'],
    ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', STYLES],
    ['xl/worksheets/sheet1.xml', X + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A1:${last}"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>`],
  ]);
}

// ---------------- PDF (A4 landscape, wrapped cells, borders, grey heading, no highlighted columns) ----------------
const MAP = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*', ' ': ' ' };
const clean = s => String(s == null ? '' : s).replace(/[–—‘’“”…• ]/g, c => MAP[c]).replace(/[\r\t]+/g, ' ').replace(/[^\n\x20-\x7e¡-ÿ]/g, '?');
const pe = s => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const money = n => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(n == null ? '' : n));

function wrap(text, maxChars) {
  const out = [];
  for (const para of clean(text).split('\n')) {
    let cur = '';
    for (let w of para.split(/\s+/).filter(Boolean)) {
      while (w.length > maxChars) { if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, maxChars)); w = w.slice(maxChars); }
      if (!cur) cur = w; else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w; else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out.length ? out : [''];
}

function toPdf(b, { title, subtitle, footer }) {
  const W = 842, H = 595, M = 20, FS = 6.6, LH = FS + 1.9, usable = W - 2 * M, CWf = FS * 0.52;
  const tw = WEIGHT.reduce((a, c) => a + c, 0), cw = WEIGHT.map(w => (w / tw) * usable), cx = []; cw.reduce((x, w, i) => (cx[i] = x, x + w), M);
  const shown = (v, i) => NUM.has(i) && typeof v === 'number' ? (i === 0 ? String(v) : money(v)) : (v == null ? '' : String(v));
  const headLines = HEAD.map((h, i) => wrap(h, Math.max(3, Math.floor((cw[i] - 5) / (FS * 0.6)))));
  const headH = Math.max(...headLines.map(l => l.length)) * LH + 7;
  const pages = []; let cur = null, y = 0;
  const startPage = () => { cur = { rows: [] }; pages.push(cur); y = H - M - 34 - headH; };
  startPage();
  for (const row of b.rows) {
    const ls = row.cells.map((v, i) => wrap(shown(v, i), Math.max(2, Math.floor((cw[i] - 5) / CWf)))), rh = Math.max(...ls.map(l => l.length)) * LH + 5;
    if (y - rh < M + 16) startPage();
    cur.rows.push({ row, ls, y, rh }); y -= rh;
  }
  const rgb = (r, g, b2) => `${r} ${g} ${b2}`;
  const content = pages.map((pg, pi) => {
    let c = `BT /F2 11 Tf 0.06 0.12 0.11 rg ${M} ${H - M - 8} Td (${pe(title)}) Tj ET\n`;
    c += `BT /F1 7.5 Tf 0.36 0.42 0.4 rg ${M} ${H - M - 20} Td (${pe(subtitle)}) Tj ET\n`;
    const hy = H - M - 34;       // top of the heading
    c += `0.851 0.851 0.851 rg ${M} ${hy - headH} ${usable} ${headH} re f\n`;
    HEAD.forEach((h, i) => { const ls = headLines[i]; ls.forEach((ln, k) => { const x = cx[i] + Math.max(2, (cw[i] - ln.length * FS * 0.58) / 2), ty = hy - 3 - FS - k * LH - (headH - 7 - ls.length * LH) / 2; c += `BT /F2 ${FS} Tf 0 g ${x.toFixed(1)} ${ty.toFixed(1)} Td (${pe(ln)}) Tj ET\n`; }); });
    c += `0.55 G 0.4 w ${M} ${hy - headH} ${usable} ${headH} re S\n`; cx.forEach((x, i) => { if (i) c += `${x.toFixed(1)} ${hy - headH} m ${x.toFixed(1)} ${hy} l S\n`; });
    for (const { row, ls, y: ry, rh } of pg.rows) {
      const top = ry + 0, bottom = ry - rh;      // ry is the top edge of the row
      const fillRow = row.total ? '0.851 0.851 0.851' : '';
      if (fillRow) c += `${fillRow} rg ${M} ${bottom} ${usable} ${rh} re f\n`;
      for (const i of YELLOW) if (!row.total) c += `1 1 0 rg ${cx[i].toFixed(1)} ${bottom} ${cw[i].toFixed(1)} ${rh} re f\n`;
      ls.forEach((l, i) => l.forEach((ln, k) => {
        if (!ln) return; const center = CENTER.has(i), right = NUM.has(i) && i !== 0, tx = center || i === 0 ? cx[i] + Math.max(2, (cw[i] - ln.length * CWf) / 2) : right ? cx[i] + cw[i] - 3 - ln.length * CWf : cx[i] + 3;
        const bold = row.total || YELLOW.has(i); c += `BT /${bold ? 'F2' : 'F1'} ${FS} Tf 0 g ${tx.toFixed(1)} ${(top - 1.5 - FS - k * LH).toFixed(1)} Td (${pe(ln)}) Tj ET\n`;
      }));
      c += `0.7 G 0.3 w ${M} ${bottom} ${usable} ${rh} re S\n`; cx.forEach((x, i) => { if (i) c += `${x.toFixed(1)} ${bottom} m ${x.toFixed(1)} ${top} l S\n`; });
    }
    c += `BT /F1 7 Tf 0.45 0.5 0.49 rg ${M} ${M - 6} Td (${pe(footer)}) Tj ET\n`;
    const label = `Page ${pi + 1} of ${pages.length}`; c += `BT /F1 7 Tf 0.45 0.5 0.49 rg ${W - M - label.length * 3.7} ${M - 6} Td (${label}) Tj ET\n`;
    return c;
  });
  const objs = []; objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${content.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${content.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  content.forEach((c, i) => { objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`; objs[6 + i * 2] = { stream: c, len: Buffer.byteLength(c, 'latin1') }; });
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offs = []; let pos = parts[0].length;
  for (let i = 1; i < objs.length; i++) {
    offs[i] = pos; const o = objs[i];
    const buf = typeof o === 'string' ? Buffer.from(`${i} 0 obj\n${o}\nendobj\n`, 'latin1') : Buffer.concat([Buffer.from(`${i} 0 obj\n<< /Length ${o.len} >>\nstream\n`, 'latin1'), Buffer.from(o.stream, 'latin1'), Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    parts.push(buf); pos += buf.length;
  }
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`; for (let i = 1; i < objs.length; i++) xref += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  parts.push(Buffer.from(xref + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { build, toXlsx, toPdf, HEAD, NUM, CENTER, YELLOW };
