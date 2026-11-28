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

const ACCENT = { summary: '#0f766e', questions: '#2563eb', tracking: '#7c3aed', followup: '#d97706', handoffs: '#dc2626', team: '#16a34a', orgs: '#4f46e5', topics: '#c026d3' };
const tw = (s, fs, bold) => clean(s).length * cw(fs, bold);
// colour of a status cell (text colour only), by column
function tone(col, v) {
  v = String(v ?? '');
  if (col === 'Answered by') return v === 'AI' ? '#6d28d9' : v === 'Menu bot' ? '#0f766e' : v === 'No reply yet' ? '#b45309' : '#1d4ed8';
  if (col === 'Result') return /^Found/.test(v) ? '#15803d' : '#dc2626';
  if (col === 'Status now') return v === 'Resolved' ? '#15803d' : v === 'Waiting' ? '#b45309' : /^With/.test(v) ? '#1d4ed8' : '#6d28d9';
  if (col === 'Assigned to') return /^Nobody|^\(not/.test(v) ? '#dc2626' : null;
  if (col === 'Waiting') return '#b45309';
  return null;
}

function build(r) {
  const pages = []; let c = '', y = 0;
  const T = (s, x, yy, fs, bold, col) => { c += `BT /${bold ? 'F2' : 'F1'} ${fs} Tf ${rgb(col || '#10201d')} rg ${x.toFixed(1)} ${yy.toFixed(1)} Td (${esc(s)}) Tj ET\n`; };
  const TC = (s, x, w, yy, fs, bold, col) => T(s, x + Math.max(0, (w - tw(s, fs, bold)) / 2), yy, fs, bold, col);   // centred in a column
  const R = (x, yy, w, h, col) => { c += `${rgb(col)} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f\n`; };
  const B = (x, yy, w, h, col) => { c += `${rgb(col).replace(/ /g, ' ')} RG 0.6 w ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S\n`; };
  const newPage = () => { if (c) pages.push(c); c = ''; y = H - M; };
  const ensure = h => { if (y - h < M + 24) newPage(); };

  newPage();
  // title band
  R(0, H - 96, W, 96, '#0b5d56'); R(0, H - 100, W, 4, '#14b8a6');
  T(String(r.business || '').toUpperCase(), M, H - 30, 8.5, true, '#a7e3dc');
  T(r.title, M, H - 54, 24, true, '#ffffff');
  T(r.label, M, H - 71, 10.5, true, '#d9f2ef');
  T('Generated ' + new Date(r.generatedAt).toLocaleString('en-GB'), M, H - 85, 8, false, '#a7e3dc');
  y = H - 118;
  // contents
  if (r.sections.length > 1) {
    T('CONTENTS', M, y, 7.5, true, '#8a9893'); y -= 13; let x = M;
    r.sections.forEach((s, i) => {
      const lab = `${i + 1}  ${s.title}`, w = tw(lab, 8, true) + 16;
      if (x + w > W - M) { x = M; y -= 20; }
      R(x, y - 5, w, 16, '#eef6f5'); R(x, y - 5, 3, 16, ACCENT[s.key] || '#0f766e'); T(lab, x + 9, y, 8, true, '#10201d'); x += w + 6;
    });
    y -= 26;
  }

  r.sections.forEach((s, si) => {
    const ac = ACCENT[s.key] || '#0f766e';
    ensure(90); y -= 4;
    // section header: accent bar, number badge, title, count
    R(M, y - 24, U, 28, '#f1f6f5'); R(M, y - 24, U, 2, ac); R(M, y - 24, 4, 28, ac);
    R(M + 12, y - 19, 18, 18, ac); TC(String(si + 1), M + 12, 18, y - 13, 10, true, '#ffffff');
    T(s.title, M + 38, y - 13, 12, true, '#10201d');
    const rows = (s.tables || []).reduce((a, t) => a + t.rows.length, 0), tag = rows ? `${rows} row${rows === 1 ? '' : 's'}` : (s.cards || []).length ? `${s.cards.length} figures` : '';
    if (tag) T(tag, W - M - 8 - tw(tag, 8, true), y - 12, 8, true, ac);
    y -= 38;
    if (s.note) { const ls = wrap(s.note, U - 16, 8.5, false); ensure(ls.length * 11 + 8); R(M, y - ls.length * 11 + 4, 2.5, ls.length * 11 + 2, ac); ls.forEach(l => { T(l, M + 9, y, 8.5, false, '#4c5f5a'); y -= 11; }); y -= 8; }
    if (s.cards && s.cards.length) {
      const per = 4, g = 8, w = (U - g * (per - 1)) / per, h = 50;
      for (let i = 0; i < s.cards.length; i += per) {
        ensure(h + 8);
        s.cards.slice(i, i + per).forEach((cd, k) => {
          const x = M + k * (w + g); R(x, y - h, w, h, '#ffffff'); B(x, y - h, w, h, '#d5dcd9'); R(x, y - h, 3.5, h, ac);
          wrap(String(cd.label).toUpperCase(), w - 16, 6.5, true, 2).forEach((l, li) => T(l, x + 10, y - 11 - li * 8, 6.5, true, '#5b6b67'));
          T(cd.value, x + 10, y - 37, 16, true);
          if (cd.sub) T(wrap(cd.sub, w - 16, 6.5, false, 1)[0], x + 10, y - 46, 6.5, false, '#8a9893');
        });
        y -= h + g;
      }
      y -= 4;
    }
    for (const t of s.tables || []) {
      if (!t.rows.length) continue;
      if (t.title) { ensure(30); T(String(t.title).toUpperCase(), M, y - 6, 7.5, true, ac); y -= 14; }
      const wts = t.columns.map(cn => cn[1] || 10), tot = wts.reduce((a, b) => a + b, 0), ws = wts.map(x => x / tot * U), FS = 7.5, LH = 9.5;
      const num = t.columns.map((cn, i) => cn[0] !== 'Time' && t.rows.every(rw => /^(\d+(\.\d+)?|-|—)$/.test(String(rw[i] ?? '').trim())) || cn[0] === 'Waiting');
      const header = () => { ensure(26); R(M, y - 15, U, 19, '#eaf3f1'); R(M, y - 15, U, 1.6, ac); let x = M; t.columns.forEach((cn, i) => { const lab = wrap(String(cn[0]).toUpperCase(), ws[i] - 8, 6.8, true, 1)[0]; if (num[i]) TC(lab, x, ws[i], y - 9, 6.8, true, '#3a4b47'); else T(lab, x + 5, y - 9, 6.8, true, '#3a4b47'); x += ws[i]; }); y -= 20; };
      header();
      t.rows.forEach((row, ri) => {
        const cells = row.map((v, i) => wrap(String(v ?? ''), ws[i] - 10, FS, false, 5)), lines = Math.max(1, ...cells.map(x => x.length)), rh = lines * LH + 6;
        if (y - rh < M + 24) { newPage(); header(); }
        if (ri % 2 === 1) R(M, y - rh + 3, U, rh, '#f4f7f6');
        R(M, y - rh + 3, U, 0.4, '#e4e9e7');
        let x = M; cells.forEach((ls, i) => { const col = tone(t.columns[i][0], row[i]), bold = !!col || t.columns[i][0] === 'Time'; ls.forEach((l, li) => { if (num[i]) TC(l, x, ws[i], y - 6 - li * LH, FS, true, col || '#10201d'); else T(l, x + 5, y - 6 - li * LH, FS, bold, col || (t.columns[i][0] === 'Time' ? '#4c5f5a' : '#10201d')); }); x += ws[i]; });
        y -= rh;
      });
      y -= 10;
    }
    for (const l of s.lists || []) {
      ensure(30); T(l.title.toUpperCase(), M, y, 7.5, true, ac); y -= 12;
      for (const it of l.items) { const ls = wrap(it, U - 16, 8.5, false); ls.forEach((x, i) => { ensure(12); if (!i) R(M + 3, y + 1.5, 4, 4, ac); T(x, M + 14, y, 8.5, false); y -= 11.5; }); }
      y -= 6;
    }
    if (!(s.cards || []).length && !rows && !(s.lists || []).length && !s.note) { ensure(16); T('Nothing to show for this section in this period.', M + 4, y, 8.5, false, '#8a9893'); y -= 14; }
    y -= 12;
  });
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
