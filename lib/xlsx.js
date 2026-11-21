// Minimal, dependency-free .xlsx reader/writer (first sheet only).
const zlib = require('zlib');

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(lho + 26), lelen = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnlen + lelen;
    const data = buf.subarray(start, start + csize);
    files[name] = () => (method === 0 ? data : zlib.inflateRawSync(data));
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref); let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function excelDate(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return d.toISOString().slice(0, 10);
}

// Worksheets of a workbook in tab order: [{ name, path, hidden }].
function listSheets(z) {
  const out = [];
  if (z['xl/workbook.xml'] && z['xl/_rels/workbook.xml.rels']) {
    const wb = z['xl/workbook.xml']().toString('utf8'), rels = z['xl/_rels/workbook.xml.rels']().toString('utf8'), target = {};
    for (const r of rels.match(/<Relationship\b[^>]*>/g) || []) {
      const id = (/\bId="([^"]+)"/.exec(r) || [])[1], t = (/Target="([^"]+)"/.exec(r) || [])[1];
      if (id && t) target[id] = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    }
    for (const sh of wb.match(/<sheet\b[^>]*>/g) || []) {
      const rid = (/r:id="([^"]+)"/.exec(sh) || [])[1], name = unesc((/\bname="([^"]*)"/.exec(sh) || [])[1] || '');
      if (target[rid] && z[target[rid]]) out.push({ name, path: target[rid], hidden: /state="(hidden|veryHidden)"/.test(sh) });
    }
  }
  if (!out.length) Object.keys(z).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort().forEach((path, i) => out.push({ name: 'Sheet' + (i + 1), path, hidden: false }));
  return out;
}
const sheetNames = buf => listSheets(readZip(buf)).filter(x => !x.hidden).map(x => x.name);

// Returns array of rows (arrays of strings) from a worksheet (the one called `sheet`, else the first visible tab).
const prepCache = new WeakMap(); // shared strings + date styles are read once per file, however many tabs are read from it
function prep(buf) {
  let c = prepCache.get(buf); if (c) return c;
  const z = readZip(buf), shared = [];
  if (z['xl/sharedStrings.xml']) {
    const xml = z['xl/sharedStrings.xml']().toString('utf8');
    for (const si of xml.match(/<si[\s>][\s\S]*?<\/si>|<si\/>/g) || []) {
      shared.push(unesc((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
    }
  }
  // date-formatted styles
  const dateXf = new Set();
  if (z['xl/styles.xml']) {
    const st = z['xl/styles.xml']().toString('utf8');
    const custom = {};
    for (const m of st.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) custom[m[1]] = m[2];
    const xfs = (st.match(/<cellXfs[\s\S]*?<\/cellXfs>/) || [''])[0].match(/<xf\b[^>]*>/g) || [];
    xfs.forEach((xf, i) => {
      const id = (/numFmtId="(\d+)"/.exec(xf) || [])[1];
      if (!id) return;
      const n = +id;
      if ((n >= 14 && n <= 22) || (n >= 45 && n <= 47) || (custom[id] && /[dmyhs]/i.test(custom[id].replace(/\[[^\]]*\]|"[^"]*"/g, '')))) dateXf.add(i);
    });
  }
  c = { z, shared, dateXf, tabs: listSheets(z) }; prepCache.set(buf, c); return c;
}

// Every visible tab of a workbook: [{ name, rows }]. Used by the DC-items auto tracker (the items are often not on the first tab).
function readAll(buf) {
  const { tabs } = prep(buf), out = [];
  for (const t of tabs) { if (t.hidden) continue; try { out.push({ name: t.name, rows: readRows(buf, t.name) }); } catch { /* unreadable tab: skip */ } }
  return out;
}

function readRows(buf, sheet) {
  const { z, shared, dateXf, tabs } = prep(buf);
  const pick = tabs.find(x => x.name === sheet) || tabs.find(x => !x.hidden) || tabs[0], sheetName = pick && pick.path;
  if (!sheetName || !z[sheetName]) throw new Error('No worksheet found');
  const xml = z[sheetName]().toString('utf8');
  // Real hyperlinks (a cell that shows words but opens a web address) live in the sheet's relationships file.
  const relsPath = sheetName.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels'), relTarget = {}, cellLink = {};
  if (z[relsPath]) for (const r of z[relsPath]().toString('utf8').match(/<Relationship\b[^>]*>/g) || []) { const id = (/\bId="([^"]+)"/.exec(r) || [])[1], t = (/Target="([^"]+)"/.exec(r) || [])[1]; if (id && t) relTarget[id] = unesc(t); }
  for (const h of xml.match(/<hyperlink\b[^>]*>/g) || []) {
    const ref = (/\bref="([A-Z]+\d+)(?::([A-Z]+\d+))?"/.exec(h) || []), rid = (/r:id="([^"]+)"/.exec(h) || [])[1], u = relTarget[rid];
    if (!ref[1] || !/^https?:\/\//i.test(u || '')) continue;
    if (!ref[2]) { cellLink[ref[1]] = u; continue; }
    const c1 = colIndex(ref[1]), c2 = colIndex(ref[2]), r1 = +ref[1].replace(/\D/g, ''), r2 = +ref[2].replace(/\D/g, '');
    for (let r = r1; r <= Math.min(r2, r1 + 5000); r++) for (let c = c1; c <= Math.min(c2, c1 + 50); c++) cellLink[colName(c) + r] = u;
  }
  const isErr = v => /^#(N\/A|REF!|VALUE!|NAME\?|DIV\/0!|NULL!|NUM!|SPILL!|CALC!)/i.test(v);
  const rows = [], cellVal = {}, pend = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = [], rn = +((/\br="(\d+)"/.exec(rm[1]) || [])[1] || 0);
    while (rn > 0 && rows.length < rn - 1) rows.push([]); // rows left out of the file are empty rows: keep every row at its real Excel row number
    for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] || '';
      const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1];
      const t = (/t="([^"]+)"/.exec(attrs) || [])[1];
      const s = (/s="(\d+)"/.exec(attrs) || [])[1];
      let val = '';
      const v = (/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
      if (t === 's') val = shared[+v] ?? '';
      else if (t === 'inlineStr') val = unesc((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(''));
      else if (t === 'str' || t === 'e') val = unesc(v || '');
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) val = (s !== undefined && dateXf.has(+s) && isFinite(v)) ? excelDate(+v) : String(+v === Math.trunc(+v) ? Math.trunc(+v) : +v);
      val = String(val).trim();
      if (t === 'e' || isErr(val)) val = ''; // #N/A and other formula errors are empty cells, not data
      if (!/^https?:\/\//i.test(val)) { // a cell that shows words but opens a link, or =HYPERLINK("https://...", "words")
        const f = (/<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner) || [])[1], lit = f && /HYPERLINK\(\s*(?:"|&quot;)(https?:\/\/(?:(?!&quot;)[^"])*)(?:"|&quot;)\s*[,)]/i.exec(f);
        const u = (ref && cellLink[ref]) || (lit && unesc(lit[1]));
        if (u && (val || ref && cellLink[ref] || lit)) val = u;
      }
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push('');
      row[idx] = val;
      if (ref) cellVal[ref] = val;
      // =HYPERLINK("https://site/file?id="&B2, "image"): the address is built from another cell of the same sheet; rebuild it once every cell is read
      const fm = !/^https?:\/\//i.test(val) && /HYPERLINK\(\s*(?:"|&quot;)(https?:\/\/[^"&]*?)(?:"|&quot;)\s*(?:&amp;|&)\s*\$?([A-Z]+)\$?(\d+)\s*[,)]/i.exec((/<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner) || [])[1] || '');
      if (fm) pend.push([row, idx, unesc(fm[1]), fm[2] + fm[3]]);
    }
    rows.push(row);
  }
  for (const [row, idx, prefix, ref] of pend) { const v = String(cellVal[ref] || '').trim(); if (v && !isErr(v)) row[idx] = prefix + (/^https?:/i.test(v) ? '' : encodeURIComponent(v).replace(/%2F/gi, '/')); }
  return rows;
}

// Minimal writer (stored, no compression) used for the downloadable template.
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function writeZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8'), nb = Buffer.from(name), crc = crc32(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(nb.length, 26);
    locals.push(l, nb, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(offset, 42);
    centrals.push(c, nb);
    offset += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, e]);
}

function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

// What a web address looks like in a report: a short, clickable label (the address itself can be very long).
const linkLabel = h => /image|photo|picture|pod|proof/i.test(String(h || '')) ? 'View image' : 'Open link';

function writeRows(rows, sheetName = 'Orders', center = [], setWidths = []) {
  // web addresses become clickable links (blue, underlined)
  const link = v => /^https?:\/\/\S+$/i.test(String(v)) && String(v).length <= 2000;
  const hl = []; // [cell, address]
  const sheet = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
    if (ri > 0 && link(v)) { hl.push([`${colName(ci)}${ri + 1}`, String(v).trim()]); return `<c r="${colName(ci)}${ri + 1}" t="inlineStr" s="2"><is><t>${esc(linkLabel(rows[0][ci]))}</t></is></c>`; }
    return `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? (center.includes(ci) ? ' s="4"' : ' s="1"') : center.includes(ci) ? ' s="3"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('') + '</row>').join('');
  const widths = rows[0].map((_, i) => {
    const mx = rows.slice(0, 500).reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 0);
    const allLinks = rows.length > 1 && rows.slice(1, 500).every(r => !r[i] || link(r[i]));
    return `<col min="${i + 1}" max="${i + 1}" width="${setWidths[i] > 0 ? setWidths[i] : allLinks && mx > 40 ? 14 : Math.min(50, Math.max(11, mx + 3))}" customWidth="1"/>`;
  }).join('');
  const last = `${colName(rows[0].length - 1)}${rows.length}`;
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const hyper = hl.length ? `<hyperlinks>${hl.map(([ref], i) => `<hyperlink ref="${ref}" r:id="rId${i + 1}"/>`).join('')}</hyperlinks>` : '';
  const sheetRels = hl.length ? [['xl/worksheets/_rels/sheet1.xml.rels', X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hl.map(([, u], i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(u)}" TargetMode="External"/>`).join('')}</Relationships>`]] : [];
  return writeZip([
    ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', X + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(String(sheetName).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', X + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths}</cols><sheetData>${sheet}</sheetData><autoFilter ref="A1:${last}"/>${hyper}</worksheet>`],
    ...sheetRels,
  ]);
}

// ---- change single cells of an existing .xlsx and keep everything else (styles, formulas, other tabs) as it was ----
function deflateZip(entries) { // entries: [[name, Buffer]]; compressed
  const out = [], cen = []; let off = 0;
  for (const [name, data] of entries) {
    const nb = Buffer.from(name), crc = crc32(data), comp = zlib.deflateRawSync(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(8, 8); l.writeUInt32LE(crc, 14); l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(nb.length, 26);
    out.push(l, nb, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    cen.push(c, nb); off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...out, cd, e]);
}
const refOf = (col, row) => colName(col) + row;
// cells: [{ col: 0-based column, value }] all in the same Excel row `row` (1-based) of the tab `sheet`
function patchCells(buf, sheet, row, cells) {
  const z = readZip(buf), tabs = listSheets(z), tab = tabs.find(x => x.name === sheet) || tabs.find(x => !x.hidden);
  if (!tab) throw new Error('The Excel tab was not found.');
  let xml = z[tab.path]().toString('utf8');
  const rowRe = new RegExp(`<row\\b([^>]*?\\br="${row}"[^>]*?)(\\/>|>([\\s\\S]*?)<\\/row>)`);
  const rm = rowRe.exec(xml); if (!rm) throw new Error(`Row ${row} is not in the Excel file any more. Press Sync now and try again.`);
  const attrs = rm[1].replace(/\/$/, ''); let inner = rm[3] || '';
  const cellRe = r => new RegExp(`<c\\b[^>]*?\\br="${r}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  for (const { col, value } of cells) {
    const ref = refOf(col, row), v = value == null ? '' : String(value), hit = cellRe(ref).exec(inner);
    const style = hit ? (/\bs="(\d+)"/.exec(hit[0].slice(0, hit[0].indexOf('>') + 1)) || [])[1] : undefined;
    const open = `<c r="${ref}"${style !== undefined ? ` s="${style}"` : ''}`;
    const nc = v === '' ? `${open}/>` : `${open} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    if (hit) inner = inner.replace(hit[0], () => nc);
    else { // put the new cell at its place in the row (cells are kept in column order)
      let at = inner.length;
      for (const m of inner.matchAll(/<c\b[^>]*?\br="([A-Z]+)\d+"/g)) if (colIndex(m[1]) > col) { at = m.index; break; }
      inner = inner.slice(0, at) + nc + inner.slice(at);
    }
  }
  xml = xml.replace(rm[0], () => `<row ${attrs.trim()}>${inner}</row>`);
  const entries = Object.keys(z).map(n => [n, n === tab.path ? Buffer.from(xml, 'utf8') : z[n]()]);
  return deflateZip(entries);
}
// the text of some cells of one row (used to check we are about to change the right row)
function rowValues(buf, sheet, row) { const rows = readRows(buf, sheet); return rows[row - 1] || []; }

// ---- Excel-like look for the preview: fills, fonts, borders, alignment, column widths, row heights, merged cells ----
const IDX = '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333'.split(' ');
const DEF_THEME = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'];
function tintHex(hex, tint) {
  if (!tint) return '#' + hex;
  let r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, sat = 0, l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  let R, G, B;
  if (!sat) R = G = B = l; else { const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q; R = f(pp, q, h + 1 / 3); G = f(pp, q, h); B = f(pp, q, h - 1 / 3); }
  return '#' + [R, G, B].map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
}
function readGrid(buf, sheet) {
  const z = readZip(buf), tabs = listSheets(z), pick = tabs.find(x => x.name === sheet) || tabs.find(x => !x.hidden) || tabs[0];
  if (!pick || !z[pick.path]) throw new Error('No worksheet found');
  const xml = z[pick.path]().toString('utf8'), st = z['xl/styles.xml'] ? z['xl/styles.xml']().toString('utf8') : '';
  // theme colours
  const theme = DEF_THEME.slice();
  if (z['xl/theme/theme1.xml']) {
    const th = z['xl/theme/theme1.xml']().toString('utf8'), cs = (/<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(th) || [''])[0], order = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
    order.forEach((n, i) => { const m = new RegExp('<a:' + n + '>([\\s\\S]*?)</a:' + n + '>').exec(cs); if (m) { const c = /(?:srgbClr val|lastClr)="([0-9A-Fa-f]{6})"/.exec(m[1]); if (c) { const ix = i === 0 ? 1 : i === 1 ? 0 : i; theme[ix] = c[1]; } } });
  }
  const colorOf = tag => {
    if (!tag) return null; const g = n => (new RegExp('\\b' + n + '="([^"]*)"').exec(tag) || [])[1];
    if (g('rgb')) return '#' + g('rgb').slice(-6); if (g('theme') !== undefined) return tintHex(theme[+g('theme')] || '000000', +(g('tint') || 0));
    if (g('indexed') !== undefined) { const n = +g('indexed'); return '#' + (n === 64 ? '000000' : n === 65 ? 'FFFFFF' : IDX[n] || '000000'); } return null;
  };
  const blocks = (tagName, item) => { const m = new RegExp('<' + tagName + '\\b[^>]*>([\\s\\S]*?)</' + tagName + '>').exec(st); return m ? m[1].match(new RegExp('<' + item + '\\b[^>]*?(?:/>|>[\\s\\S]*?</' + item + '>)', 'g')) || [] : []; };
  const colTag = (blk, name) => (new RegExp('<' + name + '\\b[^>]*/?>').exec(blk) || [])[0];
  const fonts = blocks('fonts', 'font').map(f => ({ b: /<b\b(?![^>]*val="(0|false)")/.test(f), i: /<i\b(?![^>]*val="(0|false)")/.test(f), u: /<u\b/.test(f), s: /<strike\b/.test(f), sz: +((/<sz val="([\d.]+)"/.exec(f) || [])[1] || 11), name: (/<name val="([^"]+)"/.exec(f) || [])[1] || '', color: colorOf(colTag(f, 'color')) }));
  const fills = blocks('fills', 'fill').map(f => { const pt = (/patternType="(\w+)"/.exec(f) || [])[1]; return !pt || pt === 'none' || pt === 'gray125' ? null : colorOf(colTag(f, 'fgColor')) || (pt === 'solid' ? null : '#c0c0c0'); });
  const BW = { thin: '1px solid', hair: '1px solid', medium: '2px solid', thick: '3px solid', dashed: '1px dashed', mediumDashed: '2px dashed', dotted: '1px dotted', double: '3px double', dashDot: '1px dashed', slantDashDot: '1px dashed', dashDotDot: '1px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed' };
  const borders = blocks('borders', 'border').map(b => ['top', 'right', 'bottom', 'left'].map(side => { const m = new RegExp('<' + side + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + side + '>)').exec(b); if (!m) return null; const sty = (/style="(\w+)"/.exec(m[1]) || [])[1]; if (!sty || !BW[sty]) return null; return BW[sty] + ' ' + (colorOf(colTag(m[2] || '', 'color')) || '#000'); }));
  const xfs = ((/<cellXfs[\s\S]*?<\/cellXfs>/.exec(st) || [''])[0].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)) || [];
  // one css record per distinct look: { c: inline css, b: [top,right,bottom,left] }
  const css = [], cssKey = new Map(), styOf = i => {
    if (i === undefined || !xfs[i]) return 0; const xf = xfs[i], num = n => +((new RegExp(n + '="(\\d+)"').exec(xf) || [])[1] || 0);
    const f = fonts[num('fontId')] || fonts[0] || {}, d = fonts[0] || {}, fill = fills[num('fillId')], bd = borders[num('borderId')] || [null, null, null, null];
    const al = (/<alignment\b([^>]*)/.exec(xf) || [])[1] || '', ag = n => (new RegExp(n + '="([^"]*)"').exec(al) || [])[1];
    let c = '';
    if (fill) c += 'background:' + fill + ';'; if (f.color) c += 'color:' + f.color + ';'; if (f.b) c += 'font-weight:700;'; if (f.i) c += 'font-style:italic;';
    if (f.u || f.s) c += 'text-decoration:' + [f.u ? 'underline' : '', f.s ? 'line-through' : ''].filter(Boolean).join(' ') + ';';
    if (f.sz && f.sz !== d.sz) c += 'font-size:' + Math.round(f.sz * 4 / 3 * 10) / 10 + 'px;'; if (f.name && f.name !== d.name) c += 'font-family:"' + f.name.replace(/"/g, '') + '",Calibri,Arial,sans-serif;';
    const h = ag('horizontal'); if (h === 'center' || h === 'centerContinuous') c += 'text-align:center;'; else if (h === 'right') c += 'text-align:right;'; else if (h === 'left') c += 'text-align:left;';
    const v = ag('vertical'); c += 'vertical-align:' + (v === 'top' ? 'top' : v === 'center' ? 'middle' : 'bottom') + ';';
    if (ag('wrapText') === '1' || ag('wrapText') === 'true') c += 'white-space:pre-wrap;word-break:break-word;'; if (ag('indent')) c += 'padding-left:' + (3 + 9 * +ag('indent')) + 'px;';
    const rec = JSON.stringify([c, bd]); if (!cssKey.has(rec)) { cssKey.set(rec, css.length); css.push({ c, b: bd }); } return cssKey.get(rec);
  };
  css.push({ c: 'vertical-align:bottom;', b: [null, null, null, null] }); cssKey.set(JSON.stringify(['vertical-align:bottom;', [null, null, null, null]]), 0);
  // sheet: widths, heights, merges, per-cell style
  const defW = +((/<sheetFormatPr[^>]*defaultColWidth="([\d.]+)"/.exec(xml) || [])[1] || 8.43), defH = +((/<sheetFormatPr[^>]*defaultRowHeight="([\d.]+)"/.exec(xml) || [])[1] || 15);
  const px = w => Math.max(0, Math.round(w * 7 + 5)), cw = [], colSty = [];
  for (const c of xml.match(/<col\b[^>]*>/g) || []) { const g = n => (new RegExp('\\b' + n + '="([^"]*)"').exec(c) || [])[1], a = +g('min'), z2 = Math.min(+g('max'), 60); for (let i = a; i <= z2; i++) { cw[i - 1] = /hidden="(1|true)"/.test(c) ? 0 : px(+(g('width') || defW)); if (g('style')) colSty[i - 1] = styOf(+g('style')); } }
  const rh = [], sty = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rn = +((/\br="(\d+)"/.exec(rm[1]) || [])[1] || 0); if (!rn || rn > 500) continue;
    const ht = (/\bht="([\d.]+)"/.exec(rm[1]) || [])[1]; rh[rn - 1] = /hidden="(1|true)"/.test(rm[1]) ? 0 : Math.round((ht ? +ht : defH) * 4 / 3);
    const rowS = /customFormat="(1|true)"/.test(rm[1]) && /\bs="(\d+)"/.test(rm[1]) ? styOf(+/\bs="(\d+)"/.exec(rm[1])[1]) : undefined, row = sty[rn - 1] = [];
    if (rowS !== undefined) for (let i = 0; i < 40; i++) row[i] = rowS;
    for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>)/g)) { const ref = (/r="([A-Z]+)\d+"/.exec(cm[1]) || [])[1]; if (!ref) continue; const ci = colIndex(ref); if (ci < 40) row[ci] = styOf((/\bs="(\d+)"/.exec(cm[1]) || [])[1] !== undefined ? +/\bs="(\d+)"/.exec(cm[1])[1] : undefined); }
  }
  for (let r = 0; r < sty.length; r++) if (sty[r]) for (let c = 0; c < 40; c++) if (sty[r][c] === undefined && colSty[c] !== undefined) sty[r][c] = colSty[c];
  const merges = (xml.match(/<mergeCell\b[^>]*>/g) || []).map(m => { const mm = /ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/.exec(m); return mm ? [+mm[2] - 1, colIndex(mm[1]), +mm[4] - 1, colIndex(mm[3])] : null; }).filter(Boolean);
  return { css, cw: Array.from({ length: 40 }, (_, i) => cw[i] === undefined ? px(defW) : cw[i]), rh: Array.from({ length: 500 }, (_, i) => rh[i] === undefined ? Math.round(defH * 4 / 3) : rh[i]), sty: Array.from({ length: 500 }, (_, i) => sty[i] ? Array.from({ length: 40 }, (_, j) => sty[i][j] || 0) : null), merges, grid: !/showGridLines="(0|false)"/.test(xml), fz: Math.round(((fonts[0] || {}).sz || 11) * 4 / 3 * 10) / 10 };
}

module.exports = { readAll, readGrid, readRows, writeRows, sheetNames, linkLabel, patchCells, rowValues, colName };
