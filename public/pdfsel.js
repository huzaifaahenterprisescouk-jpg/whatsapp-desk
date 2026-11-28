// Text selection for the PDF preview (pdf.js text layer).
//
// Why this exists: the browser's own drag-selection decides where the selection ends by hit-testing the point under the mouse. A PDF page is
// mostly blank space between small absolutely-positioned words, so as soon as the mouse crossed a blank gap the browser jumped to the start or
// the end of the whole page text and highlighted everything above / below. Here the mouse is followed by geometry instead: the point under the
// mouse is mapped to the nearest word / letter of the page, and only the text between where you pressed and where you are is selected.
//
//   pdfSelectable(box)  - call once with the scrolling box that holds the pages (.pvpdf); pages are .pvpage > .textLayer > span
//   click + drag = letters | double-click (+ drag) = words | triple-click = the whole line | Ctrl+A = the whole file | click on empty = clear
(function () {
  const SEL = () => window.getSelection();
  const WORD = /\S+/g;

  // ---- geometry of one text layer (measured once, in layer coordinates so scrolling does not matter) ----
  function measure(tl) {
    if (tl._m) return tl._m;
    const keep = tl.dataset.done === '1'; // only remember the measurements once the page text is completely drawn
    const lr = tl.getBoundingClientRect(), out = [];
    for (const el of tl.querySelectorAll('span')) {
      const t = el.firstChild;
      if (!t || t.nodeType !== 3 || !t.nodeValue || !t.nodeValue.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) continue;
      out.push({ el, t, x: r.left - lr.left, y: r.top - lr.top, w: r.width, h: r.height });
    }
    if (keep) tl._m = out;
    return out;
  }

  // the text layer that is under (or closest to) a screen point, among the pages of this box
  function layerAt(box, cy) {
    let best = null, bd = Infinity;
    for (const tl of box.querySelectorAll('.pvpage .textLayer')) {
      const r = tl.getBoundingClientRect(), d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
      if (d < bd) { bd = d; best = tl; if (!d) break; }
    }
    return best;
  }

  // character offset inside one span for a screen x (the nearest gap between two letters)
  function offsetIn(m, cx) {
    const t = m.t, n = t.nodeValue.length, rg = document.createRange();
    let lo = 0, hi = n;
    const mid = i => { rg.setStart(t, i); rg.setEnd(t, i + 1); const r = rg.getBoundingClientRect(); return r.left + r.width / 2; };
    while (lo < hi) { const k = (lo + hi) >> 1; if (mid(k) < cx) lo = k + 1; else hi = k; }
    return lo;
  }

  // screen point -> { node, off, m } : the letter gap closest to the pointer, or null when nothing is near enough
  function hit(box, cx, cy, strict) {
    const tl = layerAt(box, cy); if (!tl) return null;
    const ms = measure(tl); if (!ms.length) return null;
    const lr = tl.getBoundingClientRect(), x = cx - lr.left, y = cy - lr.top;
    let best = null, bd = Infinity;
    for (const m of ms) {
      const dx = x < m.x ? m.x - x : x > m.x + m.w ? x - (m.x + m.w) : 0;
      const dy = y < m.y ? m.y - y : y > m.y + m.h ? y - (m.y + m.h) : 0;
      // a word on the same text line is always a better guess than a word on a line above / below, however far to the side it is
      const d = dy === 0 ? dx * 0.001 + (dx ? 0 : -1) : 1e4 + Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = { m, dx, dy }; }
    }
    if (!best) return null;
    if (strict === 'in' && (best.dx || best.dy)) return null;                                  // must be right on a word
    if (strict === 'near' && Math.max(best.dx, best.dy) > 14) return null;                      // a press far from any text starts nothing
    const m = best.m, off = cx <= lr.left + m.x ? 0 : cx >= lr.left + m.x + m.w ? m.t.nodeValue.length : offsetIn(m, cx);
    return { node: m.t, off, m };
  }

  const cmp = (a, b) => a.node === b.node ? a.off - b.off : (a.node.compareDocumentPosition(b.node) & 4 ? -1 : 1);

  // widen a position to the word / line around it
  function grow(p, mode) {
    const s = p.node.nodeValue;
    if (mode === 'line') return [{ node: p.node, off: 0 }, { node: p.node, off: s.length }];
    let a = p.off, b = p.off, w; WORD.lastIndex = 0;
    while ((w = WORD.exec(s))) { if (p.off >= w.index && p.off <= w.index + w[0].length) { a = w.index; b = w.index + w[0].length; break; } if (w.index > p.off) { a = b = p.off; break; } }
    if (a === b) { WORD.lastIndex = 0; a = 0; b = s.length; }
    return [{ node: p.node, off: a }, { node: p.node, off: b }];
  }

  function paint(a, b) {
    const s = SEL(); if (!s) return;
    try { s.setBaseAndExtent(a.node, a.off, b.node, b.off); } catch { /* the page was redrawn while dragging */ }
  }

  function pdfSelectable(box) {
    if (box._pdfSel) return; box._pdfSel = 1;
    let drag = null, raf = 0, last = null;

    const update = () => {
      if (!drag || !last) return;
      if (!drag.a0) { // pressed on blank paper: the selection starts where the mouse first touches a word
        const q = hit(box, last.x, last.y, 'in'); if (!q) return;
        drag.a0 = q; if (drag.mode !== 'char') drag.w = grow(q, drag.mode);
      }
      const p = hit(box, last.x, last.y, false); if (!p) return;
      let a = drag.a0, f = p;
      if (drag.mode !== 'char') {
        const [s0, e0] = drag.w, [s1, e1] = grow(p, drag.mode);
        const back = cmp(p, drag.a0) < 0;               // dragging backwards: keep the whole starting word, extend to the front of the new one
        a = back ? e0 : s0; f = back ? s1 : e1;
      }
      paint(a, f);
    };

    // while the button is held near the top / bottom edge of the box, keep scrolling like a normal selection does
    const tick = () => {
      raf = 0; if (!drag || !last) return;
      const r = box.getBoundingClientRect(), top = r.top + 80, bot = r.bottom - 36; let dy = 0;
      if (last.y < top) dy = -Math.min(40, (top - last.y) / 3 + 4); else if (last.y > bot) dy = Math.min(40, (last.y - bot) / 3 + 4);
      if (dy) { box.scrollTop += dy; update(); raf = requestAnimationFrame(tick); }
    };

    box.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target === box || !ev.target.closest || !ev.target.closest('.pvpage')) return; // scrollbar / dark margin: leave to the browser
      ev.preventDefault();                                   // stop the browser's own (jumpy) selection from starting
      box.focus({ preventScroll: true });
      const p = hit(box, ev.clientX, ev.clientY, 'near');
      const n = Math.min(3, ev.detail || 1), mode = n === 1 ? 'char' : n === 2 ? 'word' : 'line';
      drag = { a0: p, mode, w: p && mode !== 'char' ? grow(p, mode) : null };
      last = { x: ev.clientX, y: ev.clientY };
      if (SEL()) SEL().removeAllRanges();
      if (p && mode !== 'char') paint(drag.w[0], drag.w[1]);
      const mv = e => { last = { x: e.clientX, y: e.clientY }; if (e.buttons === 0) return up(); update(); if (!raf) raf = requestAnimationFrame(tick); };
      const up = () => { drag = null; last = null; window.removeEventListener('mousemove', mv, true); window.removeEventListener('mouseup', up, true); };
      window.addEventListener('mousemove', mv, true); window.addEventListener('mouseup', up, true);
    });

    // Ctrl+A = all the text of this file (not the whole app window)
    box.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || (e.key || '').toLowerCase() !== 'a') return;
      const all = []; for (const tl of box.querySelectorAll('.pvpage .textLayer')) for (const m of measure(tl)) all.push(m);
      if (!all.length) return; e.preventDefault(); e.stopPropagation();
      paint({ node: all[0].t, off: 0 }, { node: all[all.length - 1].t, off: all[all.length - 1].t.nodeValue.length });
    });
  }

  window.pdfSelectable = pdfSelectable;
  window.pdfSelMeasure = measure; // exported for tests
})();
