// Dependency-free PDF writer for the daily report: A4 portrait, flowing sections (stat cards, tables with wrapped text, bullet lists).
const MAP = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '*', '·': '-', ' ': ' ' };
const clean = s => String(s ?? '').replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F\u200D]/gu, '').replace(/[–—‘’“”…•· ]/g, c => MAP[c]).replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e¡-ÿ]/g, '?');
const esc = s => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');

const W = 595, H = 842, M = 36, U = W - 2 * M, BRAND = '#0f766e';
const cw = (fs, bold) => fs * (bold ? 0.55 : 0.5);            // average Helvetica character width
function wrap(text, width, fs, bold, maxLines) {
  const per = Math.max(1, Math.floor(width / cw(fs, bold))), words = clean(text).split(' '), lines = []; let cur = '';
  for (let w of words) {
    while (w.length > per) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, per)); w = w.slice(per); }
    if (!cur) cur = w; else if ((cur + ' ' + w).length <= per) cur += ' ' + w; else { lines.push(cur); cur = w; }
  }
  if (cur || !lines.length) lines.push(cur);
  if (maxLines && lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].slice(0, Math.max(1, per - 2)) + '..'; return k; }
  return lines;
}

function build(r) {
  const pages = []; let c = '', y = 0;
  const T = (s, x, yy, fs, bold, col) => { c += `BT /${bold ? 'F2' : 'F1'} ${fs} Tf ${rgb(col || '#10201d')} rg ${x.toFixed(1)} ${yy.toFixed(1)} Td (${esc(s)}) Tj ET\n`; };
  const R = (x, yy, w, h, col) => { c += `${rgb(col)} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f\n`; };
  const newPage = () => { if (c) pages.push(c); c = ''; y = H - M; };
  const ensure = h => { if (y - h < M + 24) newPage(); };

  newPage();
  T(r.title, M, y - 14, 20, true); T(`${r.business}  -  ${r.label}`, M, y - 32, 10, false, '#5b6b67');
  T('Generated ' + new Date(r.generatedAt).toLocaleString('en-GB'), M, y - 45, 8, false, '#8a9893'); y -= 66;

  for (const s of r.sections) {
    ensure(70); y -= 6;
    R(M, y - 18, U, 22, BRAND); T(s.title, M + 8, y - 11, 11, true, '#ffffff'); y -= 32;
    if (s.note) { for (const l of wrap(s.note, U, 8.5, false)) { ensure(12); T(l, M, y, 8.5, false, '#5b6b67'); y -= 11; } y -= 4; }
    if (s.cards && s.cards.length) {
      const per = 4, g = 8, w = (U - g * (per - 1)) / per, h = 46;
      for (let i = 0; i < s.cards.length; i += per) {
        ensure(h + 8);
        s.cards.slice(i, i + per).forEach((cd, k) => {
          const x = M + k * (w + g); R(x, y - h, w, h, '#f1f6f5');
          wrap(cd.label, w - 12, 7.5, false, 2).forEach((l, li) => T(l, x + 6, y - 11 - li * 9, 7.5, false, '#5b6b67'));
          T(cd.value, x + 6, y - 35, 15, true);
          if (cd.sub) T(wrap(cd.sub, w - 12, 6.5, false, 1)[0], x + 6, y - 43, 6.5, false, '#8a9893');
        });
        y -= h + g;
      }
      y -= 4;
    }
    for (const t of s.tables || []) {
      if (!t.rows.length) continue;
      const wts = t.columns.map(cn => cn[1] || 10), tot = wts.reduce((a, b) => a + b, 0), ws = wts.map(x => x / tot * U), FS = 7.5, LH = 9.5;
      const header = () => { ensure(24); R(M, y - 14, U, 17, BRAND); let x = M; t.columns.forEach((cn, i) => { T(wrap(cn[0], ws[i] - 8, FS, true, 1)[0], x + 4, y - 9, FS, true, '#ffffff'); x += ws[i]; }); y -= 19; };
      header();
      t.rows.forEach((row, ri) => {
        const cells = row.map((v, i) => wrap(String(v ?? ''), ws[i] - 8, FS, false, 5)), lines = Math.max(1, ...cells.map(x => x.length)), rh = lines * LH + 5;
        if (y - rh < M + 24) { newPage(); header(); }
        if (ri % 2 === 1) R(M, y - rh + 3, U, rh, '#f4f7f6');
        let x = M; cells.forEach((ls, i) => { ls.forEach((l, li) => T(l, x + 4, y - 6 - li * LH, FS, false)); x += ws[i]; });
        y -= rh;
      });
      y -= 8;
    }
    for (const l of s.lists || []) {
      ensure(30); T(l.title, M, y, 9.5, true); y -= 13;
      for (const it of l.items) { const ls = wrap(it, U - 14, 8.5, false); ls.forEach((x, i) => { ensure(12); if (!i) T('-', M + 3, y, 8.5, true, BRAND); T(x, M + 14, y, 8.5, false); y -= 11.5; }); }
      y -= 6;
    }
    y -= 8;
  }
  pages.push(c);

  const out = pages.map((pc, i) => pc + `0.85 0.88 0.87 RG 0.5 w ${M} ${M + 8} m ${W - M} ${M + 8} l S\n` + `BT /F1 8 Tf 0.45 0.5 0.49 rg ${M} ${M - 4} Td (${esc(r.business + ' - ' + r.title)}) Tj ET\n` + `BT /F1 8 Tf 0.45 0.5 0.49 rg ${W - M - `Page ${i + 1} of ${pages.length}`.length * 4.2} ${M - 4} Td (Page ${i + 1} of ${pages.length}) Tj ET\n`);
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${out.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${out.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  out.forEach((pc, i) => {
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = { stream: pc, len: Buffer.byteLength(pc, 'latin1') };
  });
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offs = []; let pos = parts[0].length;
  for (let i = 1; i < objs.length; i++) {
    offs[i] = pos; const o = objs[i];
    const b = typeof o === 'string' ? Buffer.from(`${i} 0 obj\n${o}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${i} 0 obj\n<< /Length ${o.len} >>\nstream\n`, 'latin1'), Buffer.from(o.stream, 'latin1'), Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    parts.push(b); pos += b.length;
  }
  let xref = `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) xref += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  parts.push(Buffer.from(xref + `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}
module.exports = { build };
