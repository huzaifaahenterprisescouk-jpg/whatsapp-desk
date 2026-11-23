/* Chat extras (loaded after media.js):
   1. photos sent together are shown as ONE album bubble ("+3" on the last tile), like WhatsApp
   2. tapping a photo opens a full-screen viewer: left / right arrows (or keys, or swipe) go to the previous / next photo of the chat
   3. select messages (right-click a message, or press and hold on a phone, then choose Select) -> Forward, Copy, Download, Delete */
Object.assign(ICONS, {
  dl: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
});
const GAL = { on: false, sel: new Set(), phone: '' };
const isImg = m => m && m.media && m.media.kind === 'image';
const ALBUM_GAP = 5 * 60 * 1000;

// ---------- picture thumbnails + albums inside a bubble ----------
{
  const _mh = mediaHtml;
  mediaHtml = function (m) {
    const x = m.media;
    if (x && x.kind === 'album') {
      const it = x.items, n = it.length, shown = it.slice(0, 4);
      return `<div class="mm album a${Math.min(n, 4)}">${shown.map((p, i) => `<a data-gal="${p.id}" href="${mUrl(p.media.id)}" target="_blank" rel="noopener"><img loading="lazy" alt="${esc(p.media.name)}" src="${mUrl(p.media.id)}">${i === 3 && n > 4 ? `<span class="more">+${n - 4}</span>` : ''}</a>`).join('')}</div><div class="albc">${ic('file').replace(/<svg[\s\S]*<\/svg>/, '')}${n} photos</div>`;
    }
    if (x && x.kind === 'image') return `<a class="mm img" data-gal="${m.id}" href="${mUrl(x.id)}" target="_blank" rel="noopener"><img loading="lazy" alt="${esc(x.name)}" src="${mUrl(x.id)}"></a>`;
    return _mh(m);
  };
}
function groupMsgs(list) {
  const out = [];
  for (const m of list) {
    const g = out[out.length - 1], p = g && g[g.length - 1];
    if (isImg(m) && !m.error && p && isImg(p) && !p.error && p.dir === m.dir && (p.from || '') === (m.from || '') && (p.agentId || '') === (m.agentId || '') && m.ts - p.ts <= ALBUM_GAP) g.push(m);
    else out.push([m]);
  }
  return out;
}
function groupBubble(g) {
  if (g.length === 1) return bubble(g[0]);
  const f = g[0], l = g[g.length - 1], caps = g.map(x => (x.text || '').trim()).filter(Boolean).join('\n');
  return bubble({ ...f, id: f.id, ts: l.ts, text: caps, media: { kind: 'album', items: g } });
}

// ---------- the message list, with selection ----------
renderMsgs = function () {
  const el = $('#msgs'); if (!el) return;
  if (GAL.phone !== S.sel) { GAL.phone = S.sel; GAL.on = false; GAL.sel.clear(); }
  const alive = new Set(S.msgs.map(m => m.id)); for (const id of [...GAL.sel]) if (!alive.has(id)) GAL.sel.delete(id);
  const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120 || !el.dataset.init, keep = el.scrollTop;
  let last = '', html = '';
  for (const g of groupMsgs(S.msgs)) {
    const m = g[0], d = dayLabel(m.ts); if (d !== last) { html += `<div class="day">${d}</div>`; last = d; }
    if (m.dir === 'sys') { html += bubble(m); continue; }
    const ids = g.map(x => x.id), on = ids.every(i => GAL.sel.has(i));
    html += `<div class="mrow ${m.dir === 'out' ? 'out' : 'in'} ${on ? 'picked' : ''}" data-ids="${ids.join(',')}"><button type="button" class="selc" title="Select" aria-label="Select message">${ic('check')}</button>${groupBubble(g)}</div>`;
  }
  el.classList.toggle('selmode', GAL.on);
  el.innerHTML = html; el.dataset.init = 1; el.scrollTop = stick ? el.scrollHeight : keep;
  if (!el.dataset.gal) { el.dataset.gal = 1; el.addEventListener('click', galClick, true); el.addEventListener('contextmenu', galCtx); el.addEventListener('touchstart', galPress, { passive: true }); el.addEventListener('touchend', galPressEnd); el.addEventListener('touchmove', galPressEnd, { passive: true }); }
  if ($('#th') && $('#th').dataset.sel !== String(GAL.on) + GAL.sel.size) galHead();
};
function galClick(e) {
  const row = e.target.closest('.mrow'); if (!row) return;
  const ids = row.dataset.ids.split(',');
  const toggle = () => { const on = ids.every(i => GAL.sel.has(i)); ids.forEach(i => on ? GAL.sel.delete(i) : GAL.sel.add(i)); if (!GAL.sel.size) GAL.on = false; renderMsgs(); };
  if (e.target.closest('.selc')) { e.preventDefault(); e.stopPropagation(); GAL.on = true; toggle(); return; }
  if (GAL.on) { if (e.target.closest('audio,video')) return; e.preventDefault(); e.stopPropagation(); toggle(); return; }
  const a = e.target.closest('[data-gal]'); if (a) { e.preventDefault(); e.stopPropagation(); lbOpen(a.dataset.gal); }
}

// ---------- right-click (or long-press on a phone) a message: WhatsApp-style menu ----------
function galMenuClose() { document.querySelectorAll('.cmenu').forEach(x => x.remove()); }
function galCtx(e) {
  const row = e.target.closest('.mrow'); if (!row) return; e.preventDefault();
  const ids = row.dataset.ids.split(','), inSel = GAL.on && ids.every(i => GAL.sel.has(i));
  const picked = () => S.msgs.filter(m => (inSel ? GAL.sel.has(m.id) : ids.includes(m.id)));
  const pk = picked(), canText = pk.some(m => (m.text || '').trim()), canDl = pk.some(m => m.media), imgs = pk.filter(m => isImg(m) && !m.error);
  const items = [
    ...(imgs.length ? [['Open photo', 'chevR', () => lbOpen(imgs[0].id)]] : []),
    [GAL.on && inSel ? 'Unselect' : 'Select', 'check', () => { GAL.on = true; ids.forEach(i => inSel ? GAL.sel.delete(i) : GAL.sel.add(i)); if (!GAL.sel.size) GAL.on = false; renderMsgs(); renderThreadHead(); }],
    ['Forward', 'fwd', () => galForward(picked())],
    ...(canText ? [['Copy', 'copy', () => galCopy(picked())]] : []),
    ...(canDl ? [['Download', 'dl', () => galDownload(picked())]] : []),
    ['Delete', 'trash', () => galDelete(picked()), true],
  ];
  galMenuClose();
  const m = document.createElement('div'); m.className = 'cmenu';
  m.innerHTML = items.map(([t, ico, , danger], i) => `<button type="button" data-i="${i}" class="${danger ? 'danger' : ''}">${ic(ico)}<span>${t}</span></button>`).join('');
  document.body.appendChild(m);
  const x = e.clientX ?? 20, y = e.clientY ?? 20, w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + 'px'; m.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + 'px';
  m.onclick = ev => { const b = ev.target.closest('button[data-i]'); if (!b) return; galMenuClose(); items[+b.dataset.i][2](); };
  m.oncontextmenu = ev => ev.preventDefault();
}
let galTimer = 0;
function galPress(e) { const t = e.touches[0]; galEnd(); galTimer = setTimeout(() => { galTimer = 0; const row = e.target.closest('.mrow'); if (row && !GAL.on) galCtx({ target: e.target, clientX: t.clientX, clientY: t.clientY, preventDefault() {} }); }, 520); }
function galPressEnd() { galEnd(); }
function galEnd() { if (galTimer) { clearTimeout(galTimer); galTimer = 0; } }
document.addEventListener('mousedown', e => { if (!e.target.closest('.cmenu')) galMenuClose(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') galMenuClose(); }, true);
addEventListener('blur', galMenuClose); addEventListener('resize', galMenuClose);
document.addEventListener('wheel', galMenuClose, { capture: true, passive: true });

// ---------- chat header: "Select" button, or the toolbar while messages are selected ----------
{
  const _h = renderThreadHead;
  renderThreadHead = function () { _h.apply(this, arguments); galHead(); };
}
function galHead() {
  const el = $('#th'); if (!el) return; el.dataset.sel = String(GAL.on) + GAL.sel.size;
  if (!GAL.on) return;
  const picked = S.msgs.filter(m => GAL.sel.has(m.id)), hasMedia = picked.some(m => m.media), hasText = picked.some(m => (m.text || '').trim());
  el.innerHTML = `<button class="btn ghost sm" id="gx" title="Cancel">${ic('x')}</button><div class="t"><b>${picked.length ? picked.length + ' selected' : 'Select messages'}</b><span>${picked.length ? '' : 'Click messages to select them'}</span></div>
    <button class="btn sm" id="gfw" ${picked.length ? '' : 'disabled'}>${ic('fwd')} Forward</button>
    <button class="btn sm" id="gcp" title="Copy text" ${hasText ? '' : 'disabled'}>${ic('copy')}</button>
    <button class="btn sm" id="gdl" title="Download photos / files" ${hasMedia ? '' : 'disabled'}>${ic('dl')}</button>
    <button class="btn sm danger" id="gdel" ${picked.length ? '' : 'disabled'}>${ic('trash')} Delete</button>`;
  $('#gx').onclick = () => { GAL.on = false; GAL.sel.clear(); renderMsgs(); renderThreadHead(); };
  $('#gfw').onclick = () => galForward(picked);
  $('#gcp').onclick = () => galCopy(picked);
  $('#gdl').onclick = () => galDownload(picked);
  $('#gdel').onclick = () => galDelete(picked);
}
async function galCopy(picked) { const t = picked.map(m => (m.text || '').trim()).filter(Boolean).join('\n'); try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast('Could not copy — your browser blocked it', true); } }
function galDownload(picked) { picked.filter(m => m.media).forEach((m, i) => setTimeout(() => { const a = document.createElement('a'); a.href = mUrl(m.media.id, 1); a.download = m.media.name || ''; document.body.appendChild(a); a.click(); a.remove(); }, i * 350)); }
async function galDelete(picked) {
  const mine = picked.length, others = picked.some(m => m.dir !== 'out');
  if (others && !isAdmin()) return toast('Only an administrator can delete messages received from customers. You can delete the ones you sent.', true);
  if (!await gconfirm(`Delete ${mine} message${mine > 1 ? 's' : ''} from the desk?\n\nThey are removed from this desk only. WhatsApp cannot take back what was already sent or received, so the customer still has them.`)) return;
  try { await api(`/conversations/${S.sel}/delete-messages`, { method: 'POST', body: { ids: picked.map(m => m.id) } }); galDeleted({ phone: S.sel, ids: picked.map(m => m.id) }); toast(`${mine} message${mine > 1 ? 's' : ''} deleted`); }
  catch (e) { toast(e.message, true); }
}
function galDeleted(e) {
  if (S.sel !== e.phone) return; const gone = new Set(e.ids);
  S.msgs = S.msgs.filter(m => !gone.has(m.id)); ids_clear(gone);
  GAL.on = GAL.on && GAL.sel.size > 0; renderMsgs(); renderThreadHead();
}
const ids_clear = gone => gone.forEach(i => GAL.sel.delete(i));
function galForward(picked) {
  const chats = S.convs.filter(c => c.phone !== S.sel), pick = new Set();
  modal(`<h3>${ic('fwd')} Forward ${picked.length} message${picked.length > 1 ? 's' : ''} to…</h3>
    <div class="search wide" style="margin-bottom:8px">${ic('search')}<input type="search" id="fq" placeholder="Search a chat" autocomplete="off"></div>
    <div class="pk-list" id="fl"></div><div class="acts"><button class="btn" id="fx">Cancel</button><button class="btn primary" id="fgo" disabled>Forward</button></div>`, (bg, close) => {
    const l = $('#fl', bg), q = $('#fq', bg), go = $('#fgo', bg);
    const draw = () => { const k = q.value.trim().toLowerCase(); l.innerHTML = chats.filter(c => !k || (c.name + ' ' + c.phone + ' ' + (c.orgName || '')).toLowerCase().includes(k)).slice(0, 80).map(c => `<button type="button" class="pk-row ${pick.has(c.phone) ? 'on' : ''}" data-p="${c.phone}"><span class="pk-av" style="background:${hue(c.phone)}">${esc(initials(c.name || c.phone))}</span><span class="pk-b"><b>${esc(c.name)}</b><small>+${esc(c.phone)}${c.orgName ? ' · ' + esc(c.orgName) : ''}</small></span><span class="fck">${pick.has(c.phone) ? ic('check') : ''}</span></button>`).join('') || '<div class="hint" style="padding:14px 4px">No chats found.</div>'; go.disabled = !pick.size; go.textContent = pick.size ? `Forward to ${pick.size}` : 'Forward'; };
    q.oninput = draw; draw(); q.focus();
    l.onclick = e => { const b = e.target.closest('.pk-row'); if (!b) return; const p = b.dataset.p; pick.has(p) ? pick.delete(p) : pick.add(p); draw(); };
    $('#fx', bg).onclick = close;
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Sending…';
      try { const r = await api(`/conversations/${S.sel}/forward`, { method: 'POST', body: { ids: picked.map(m => m.id), to: [...pick] } }); close(); GAL.on = false; GAL.sel.clear(); renderMsgs(); renderThreadHead(); toast(r.failed ? `Forwarded ${r.sent}, ${r.failed} failed: ${r.error || ''}` : `Forwarded (${r.sent} message${r.sent === 1 ? '' : 's'})`, !!r.failed); }
      catch (e) { toast(e.message, true); go.disabled = false; go.textContent = 'Forward'; }
    };
  });
}

// ---------- full-screen photo viewer ----------
const LB = { list: [], i: 0, el: null, x0: 0 };
function lbOpen(msgId) {
  LB.list = S.msgs.filter(m => isImg(m) && !m.error); LB.i = Math.max(0, LB.list.findIndex(m => m.id === msgId));
  if (!LB.list.length) return; lbClose();
  const el = LB.el = document.createElement('div'); el.className = 'lb';
  el.innerHTML = `<div class="lb-top"><span class="lb-cnt"></span><span class="lb-nm"></span><a class="lb-b" id="lb-dl" title="Download">${ic('dl')}</a><button class="lb-b" id="lb-x" title="Close (Esc)">${ic('x')}</button></div>
    <button class="lb-nav l" id="lb-p" title="Previous (←)">${ic('chevL')}</button><div class="lb-stage"><img class="lb-img" alt=""></div><button class="lb-nav r" id="lb-n" title="Next (→)">${ic('chevR')}</button><div class="lb-cap"></div>`;
  document.body.appendChild(el); document.addEventListener('keydown', lbKey, true);
  $('#lb-x', el).onclick = lbClose; $('#lb-p', el).onclick = () => lbGo(-1); $('#lb-n', el).onclick = () => lbGo(1);
  el.addEventListener('mousedown', e => { if (e.target === el || e.target.classList.contains('lb-stage')) lbClose(); });
  el.addEventListener('touchstart', e => { LB.x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - LB.x0; if (Math.abs(d) > 50) lbGo(d < 0 ? 1 : -1); }, { passive: true });
  lbShow();
}
function lbShow() {
  const el = LB.el; if (!el) return; const m = LB.list[LB.i], n = LB.list.length;
  $('.lb-img', el).src = mUrl(m.media.id); $('.lb-cnt', el).textContent = `${LB.i + 1} / ${n}`;
  $('.lb-nm', el).textContent = `${m.dir === 'out' ? (m.agentName || 'You') : 'Customer'} · ${dayLabel(m.ts)} ${fmtTime(m.ts)}`;
  $('.lb-cap', el).textContent = m.text || ''; const dl = $('#lb-dl', el); dl.href = mUrl(m.media.id, 1); dl.setAttribute('download', m.media.name || '');
  $('#lb-p', el).hidden = LB.i === 0; $('#lb-n', el).hidden = LB.i === n - 1;
  [LB.i - 1, LB.i + 1].forEach(j => { if (LB.list[j]) new Image().src = mUrl(LB.list[j].media.id); }); // load the neighbours so the next one is instant
}
function lbGo(d) { const j = LB.i + d; if (j < 0 || j >= LB.list.length) return; LB.i = j; lbShow(); }
function lbKey(e) { if (!LB.el) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); lbClose(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); lbGo(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); lbGo(1); } }
function lbClose() { if (LB.el) { LB.el.remove(); LB.el = null; } document.removeEventListener('keydown', lbKey, true); }
