/* Contact buttons, PO / P.R / CN finder, tracking suggestion and AI assistant.
   Loaded after app.js; app.js calls afterHead(), afterInfo(), renderSugg() and refreshSugg() from the inbox. */
Object.assign(ICONS, {
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  wa: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/><path d="M9.5 9c.3 2 1.8 3.6 4 4.5l1-1.2-1.6-.9-.6.6c-.7-.3-1.4-1-1.7-1.7l.6-.6-.9-1.6z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
});

// number the way phones and WhatsApp want it: country code, digits only (03xx… = Pakistan)
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, ''); if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1);
  return d;
}
function contactBtns(num, who, text, customer) {
  const n = normPhone(num);
  if (!n) return `<span class="hint">No phone number saved${who ? ' for ' + esc(who) : ''}</span>`;
  const q = text ? '?text=' + encodeURIComponent(text) : '';
  return `${S.callsApi || S.mode === 'cloud' ? `<button type="button" class="btn sm call" data-wacall="${n}" data-name="${esc(who || '')}" title="Call +${n} on WhatsApp">${ic('call')} Call</button>` : `<a class="btn sm call" href="tel:+${n}" title="Call +${n}">${ic('call')} Call</a>`}<a class="btn sm wa" href="https://wa.me/${n}${q}" target="_blank" rel="noopener" title="Open WhatsApp chat with +${n}">${ic('wa')} WhatsApp</a>${customer && S.mode !== 'cloud' ? `<button type="button" class="btn sm call" data-webcall="${n}" data-name="${esc(who || '')}" title="Send a voice-call link in WhatsApp and talk here in the desk (no API)">${ic('call')} Voice call</button>` : ''}${S.mode === 'cloud' ? '' : `<a class="btn sm wa" href="https://web.whatsapp.com/send?phone=${n}${text ? '&text=' + encodeURIComponent(text) : ''}" target="waweb" title="Open this chat in WhatsApp Web (same tab each time). Use its voice / video call buttons.">${ic('call')} Web call</a>`}`;
}

// ---------- inbox hooks ----------
// the Call / WhatsApp / Voice call / Web call buttons live in the customer panel on the right only (not repeated in the chat header).
// The arrow at the end of the header closes / opens that panel; the choice is remembered.
const infoHidden = () => { try { return localStorage.getItem('wd_info') === '0'; } catch { return false; } };
function applyInfo() { const ib = $('#ib'); if (ib) ib.classList.toggle('noinfo', infoHidden()); }
function afterHead(c) {
  const th = $('#th'); if (!th) return; applyInfo();
  const hid = infoHidden(), b = document.createElement('button');
  b.type = 'button'; b.className = 'ib infotg'; b.id = 'infotg'; b.title = hid ? 'Show customer panel' : 'Hide customer panel'; b.setAttribute('aria-label', b.title);
  b.innerHTML = ic(hid ? 'chevL' : 'chevR');
  b.onclick = () => { try { localStorage.setItem('wd_info', infoHidden() ? '1' : '0'); } catch {} applyInfo(); renderThreadHead(); };
  th.appendChild(b);
  if (typeof wooHeadBtn === 'function') wooHeadBtn(th, c);
}
function afterInfo(c) {
  const el = $('#info'); if (!el) return;
  const who = $('.who1', el);
  if (c.isGroup) {   // a group has no phone number: the only call is the desk's own voice call (a link is posted in the group)
    if (who && S.mode !== 'cloud') who.insertAdjacentHTML('beforeend', `<div class="cbtns"><button type="button" class="btn sm call" data-webcall="${esc(c.phone)}" data-name="${esc(c.name)}" title="Post a voice-call link in the group; the first member who opens it talks with you here">${ic('call')} Voice call</button></div>`);
    return;
  }
  if (who) who.insertAdjacentHTML('beforeend', `<div class="cbtns">${contactBtns(c.phone, c.name, '', true)}</div>`);
  // person who handles this customer's company: call / message them
  const h = agent(c.agentId);
  const org = S.orgs.find(o => o.id === c.orgId); const backup = org && agent(org.backupAgentId);
  const rowFor = (a, label) => `<div class="hrow"><div><b>${esc(a.name)}</b><small>${label}${a.phone ? ' · +' + esc(normPhone(a.phone)) : ''}</small></div><div class="cbtns">${contactBtns(a.phone, a.name)}</div></div>`;
  let html = '';
  if (h || backup) html += `<h4 style="margin-top:20px">Who to call</h4>${h ? rowFor(h, 'Handling this chat') : ''}${backup && (!h || backup.id !== h.id) ? rowFor(backup, 'Backup') : ''}`;
  html += aiPanelHtml();
  el.insertAdjacentHTML('beforeend', html);
  bindAi(c);
}

// ---------- tracking suggestion ("customer asked for tracking → one tap to send") ----------
async function refreshSugg() {
  if (!S.sel) return; const phone = S.sel;
  try { const d = await api(`/conversations/${phone}/suggest`); if (S.sel !== phone) return; S.sugg = d.suggestion && d.suggestion.since !== S.suggDismissed ? d.suggestion : null; } catch { S.sugg = null; }
  renderSugg();
}
function renderSugg() {
  const el = $('#sugg'); if (!el) return; const g = S.sugg;
  if (!g) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="sugg"><div class="sh">${ic('bolt')}<b>Customer is asking for tracking</b><span>${esc(g.reason)}</span></div>
    <pre>${esc(g.text)}</pre>
    <div class="row"><button class="btn sm primary" id="sg-send">${ic('send')} ${g.orders.length ? 'Send tracking details' : 'Ask for PO / CN number'}</button><button class="btn sm" id="sg-edit">Edit first</button><button class="btn sm ghost" id="sg-x">Dismiss</button></div></div>`;
  $('#sg-send').onclick = async e => { e.target.closest('button').disabled = true; try { await api(`/conversations/${S.sel}/send`, { method: 'POST', body: { text: g.text } }); toast('Details sent'); S.sugg = null; renderSugg(); } catch (err) { toast(err.message, true); e.target.closest('button').disabled = false; } };
  $('#sg-edit').onclick = () => { const ta = $('#ctext'); if (ta) { ta.value = g.text; ta.dispatchEvent(new Event('input')); ta.focus(); } };
  $('#sg-x').onclick = () => { S.suggDismissed = g.since; S.sugg = null; renderSugg(); };
}

// ---------- AI assistant ----------
function aiPanelHtml() {
  return `<h4 style="margin-top:20px">${ic('spark')} AI assistant</h4><div class="aip">
    <button class="btn sm primary" id="ai-draft">${ic('spark')} Suggest a reply</button>
    <textarea id="ai-q" rows="2" placeholder="Ask AI: how should I handle this customer?"></textarea>
    <div class="row"><button class="btn sm" id="ai-ask">Ask</button>${isAdmin() ? `<button class="btn sm ghost" id="ai-cfg">AI settings</button>` : ''}</div>
    <div id="ai-out">${S.aiOut ? aiOutHtml(S.aiOut) : ''}</div></div>`;
}
function aiOutHtml(o) {
  const m = o.text.match(/suggested reply:\s*([\s\S]*)$/i);
  return `<div class="aiout"><pre>${esc(o.text)}</pre>${m ? `<button class="btn sm" id="ai-use" data-t="${esc(m[1].trim())}">Use suggested reply</button>` : ''}${o.note ? `<small class="hint">${esc(o.note)}</small>` : ''}</div>`;
}
function setAiOut(o) { S.aiOut = o; const el = $('#ai-out'); if (el) { el.innerHTML = o ? aiOutHtml(o) : ''; bindUse(); } }
function bindUse() { const u = $('#ai-use'); if (u) u.onclick = () => insertDraft(u.dataset.t); }
function insertDraft(t) { const ta = $('#ctext'); if (!ta) return; ta.value = t; ta.dispatchEvent(new Event('input')); ta.focus(); }
function bindAi(c) {
  const d = $('#ai-draft'); if (!d) return;
  d.onclick = async () => {
    d.disabled = true; const old = d.innerHTML; d.textContent = 'Thinking…';
    try {
      const r = await api(`/conversations/${c.phone}/ai-draft`, { method: 'POST' });
      insertDraft(r.draft);
      toast(r.source === 'ai' ? 'AI draft added to the message box — review and send' : (r.warning ? 'AI unavailable (' + r.warning + ') — basic draft added' : 'Basic draft added (connect AI in settings for smarter replies)'), r.warning);
    } catch (e) { toast(e.message, true); }
    d.disabled = false; d.innerHTML = old;
  };
  $('#ai-ask').onclick = async () => {
    const q = $('#ai-q').value.trim(); if (!q) return toast('Type a question first', true);
    const b = $('#ai-ask'); b.disabled = true; b.textContent = '…';
    try { const r = await api(`/conversations/${c.phone}/ai-ask`, { method: 'POST', body: { question: q } }); setAiOut({ text: r.answer, note: r.source === 'basic' ? '' : '' }); }
    catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = 'Ask';
  };
  const cfg = $('#ai-cfg'); if (cfg) cfg.onclick = aiSettings;
  bindUse();
}
async function aiSettings() {
  let c; try { c = await api('/ai/config'); } catch (e) { return toast(e.message, true); }
  modal(`<h3>${ic('spark')} AI assistant</h3>
    <div class="field"><label class="chk"><input type="checkbox" id="ai-on" ${c.enabled ? 'checked' : ''}><span>Enable AI suggestions</span></label></div>
    <div class="field"><label>Provider</label><select id="ai-pv"><option value="gemini" ${c.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option><option value="anthropic" ${c.provider === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option></select></div>
    <div class="field"><label>API key ${c.hasKey ? `<small class="hint">(saved ${esc(c.keyHint)} — leave empty to keep)</small>` : ''}</label><input type="password" id="ai-key" autocomplete="off" placeholder="${c.hasKey ? '••••••••' : 'Paste your API key'}"></div>
    <div class="field"><label>Model <small class="hint">(optional, e.g. ${c.provider === 'anthropic' ? 'claude-sonnet-5-5' : 'gemini-2.5-flash'})</small></label><input type="text" id="ai-md" value="${esc(c.model)}"></div>
    <div class="field"><label>Instructions for the AI</label><textarea id="ai-in" rows="4">${esc(c.instructions)}</textarea><div class="hint">The AI only drafts. A team member always presses Send.</div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button>${c.hasKey ? '<button class="btn danger" id="ck">Remove key</button>' : ''}<button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    const save = async extra => { try { await api('/ai/config', { method: 'PUT', body: { enabled: $('#ai-on', bg).checked, provider: $('#ai-pv', bg).value, apiKey: $('#ai-key', bg).value, model: $('#ai-md', bg).value, instructions: $('#ai-in', bg).value, ...extra } }); close(); toast('AI settings saved'); } catch (e) { toast(e.message, true); } };
    $('#sv', bg).onclick = () => save(); const ck = $('#ck', bg); if (ck) ck.onclick = () => save({ clearKey: true });
    $('#ai-pv', bg).onchange = e => { $('#ai-md', bg).value = ''; };
  });
}

// ---------- Find PO / P.R / CN ----------
let findT;
function viewFind() {
  $('#main').innerHTML = `<div class="page">${pageHead('Company report', 'Search a company, PO, P.R, CN or order number (part of a number works too), or use the filters to list the DCs of a company: pending dispatch, dispatched, self, billed in ERP or remaining. Use Print to save the list as a PDF.')}
    <div class="card pad" id="odpanel" style="margin-bottom:16px"><div class="hint">Loading orders…</div></div>
    <div id="fres" class="fres"></div></div>`;
  let seq = 0;
  const run = async () => {
    const q = OD.q.trim(), my = ++seq; S.findQ = q; const out = $('#fres'); if (!out) return;
    try { const r = await api('/track/search?q=' + encodeURIComponent(q.length >= 2 ? q : '') + '&' + odQuery()); if (my !== seq) return; S.findRes = r.results; S.findCols = r.sheetCols || []; S.findTotal = r.total || r.results.length; drawFind(); } catch (e) { out.innerHTML = `<div class="hint">${esc(e.message)}</div>`; }
  };
  const runSoon = () => { clearTimeout(findT); findT = setTimeout(run, 250); };
  $('#fres').onclick = findClick;
  $('#fres').oninput = e => { if (e.target.id !== 'dc-colq') return; S.dcColQ = e.target.value.trim(); $$('.dc-cl').forEach(l => l.style.display = !S.dcColQ || l.dataset.n.includes(S.dcColQ.toLowerCase()) ? 'flex' : 'none'); }; odMount('#odpanel', 'find', runSoon); run();
}
// every column from the sheet (address, branch, DC no ...) so nothing is hidden, plus links
function detailsHtml(r) {
  const d = r.details || [], l = r.links || []; if (!d.length && !l.length) return '';
  return `<div class="fr-d"><div class="fr-dh">Details</div><div class="fr-dg">${d.map(([k, v]) => `<div><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join('')}${l.map(([k, u]) => `<div><small>${esc(k)}</small><a href="${esc(u)}" target="_blank" rel="noopener" style="color:var(--brand);font-weight:600">Open link</a></div>`).join('')}</div></div>`;
}
// text with *bold* markers -> simple HTML for an email body
const textToHtml = t => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
function mailOrder(r, to) {
  S.view = 'mail'; location.hash = 'mail'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'mail'));
  const run = () => compose({ to: to || '', subject: `PO ${r.po || r.orderId}${r.pr ? ' / PR ' + r.pr : ''} — ${r.status}`, html: `<div>Dear Sir/Madam,</div><br><div>${textToHtml(r.text)}</div><br><div>Regards</div>` });
  renderView(); setTimeout(run, 600);
}
// ---- choose which columns the DC table shows (saved in this browser) ----
const DC_BASE = [['dcno', 'DC'], ['po', 'PO'], ['pr', 'P.R'], ['cn', 'CN'], ['company', 'Company'], ['customer', 'Customer'], ['courier', 'Courier'], ['date', 'Date'], ['billing', 'ERP billing'], ['status', 'Status']];
const DC_NO_RE = /^(d\.?\s?c\.?|delivery challan|challan)\s*(no\.?|number|#)?$/i, dcNoOf = r => { const d = (r.sheet || r.details || []).find(x => DC_NO_RE.test(String(x[0]).trim())); return d ? d[1] : ''; };
const dcSaved = () => { try { let v = JSON.parse(localStorage.getItem('dc_cols') || 'null'); if (Array.isArray(v) && v.includes('ids')) v = v.flatMap(k => k === 'ids' ? ['dcno', 'po', 'pr', 'cn'] : [k]); return Array.isArray(v) ? v : null; } catch { return null; } };
const dcSave = a => { try { localStorage.setItem('dc_cols', JSON.stringify(a)); } catch {} };
// the order of the columns and their widths (px) are remembered in this browser too
const dcOrdSaved = () => { try { const v = JSON.parse(localStorage.getItem('dc_order') || 'null'); return Array.isArray(v) ? v : null; } catch { return null; } };
const dcOrdSave = a => { try { localStorage.setItem('dc_order', JSON.stringify(a)); } catch {} };
const dcWSaved = () => { try { const v = JSON.parse(localStorage.getItem('dc_widths') || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const dcWSave = m => { try { localStorage.setItem('dc_widths', JSON.stringify(m)); } catch {} };
function dcColumns(rs) {
  const sheet = [], seen = new Set();
  for (const k of S.findCols || []) if (k && !seen.has(k) && !DC_NO_RE.test(k.trim())) { seen.add(k); sheet.push(['d:' + k, k]); } // every column of the sheet, in sheet order
  for (const r of rs) for (const [k] of (r.sheet || r.details || [])) if (k && !seen.has(k) && !DC_NO_RE.test(k.trim())) { seen.add(k); sheet.push(['d:' + k, k]); }
  const base = [...DC_BASE, ...sheet], saved = dcSaved(), on = new Set(saved || DC_BASE.map(c => c[0])), ord = dcOrdSaved() || [], byK = new Map(base.map(c => [c[0], c]));
  const all = [...ord.filter(k => byK.has(k)).map(k => byK.get(k)), ...base.filter(c => !ord.includes(c[0]))]; // your order first, new sheet columns after
  return { all, on, shown: all.filter(c => on.has(c[0])), widths: dcWSaved() };
}
// What the PDF / Excel / Print of the Company report must show: the columns ticked in the Columns menu, in that order, with their widths.
// null = never customised (the standard layout is used).
function dcExportCols() {
  if (!dcSaved() && !dcOrdSaved() && !Object.keys(dcWSaved()).length) return null;
  const CC = dcColumns(S.findRes || []), keys = CC.shown.map(c => c[0]);
  for (const k of CC.on) if (!keys.includes(k)) keys.push(k);
  return keys.map(k => [k, CC.widths[k] || 0]);
}
const dcColName = k => (DC_BASE.find(c => c[0] === k) || [0, String(k).replace(/^d:/, '')])[1];
const DC_DL = { pending: 'Pending dispatch', dispatched: 'Dispatched', self: 'Self', other: 'Cancelled / returned' };
function dcCellVal(r, k) {
  switch (k) {
    case 'dcno': return dcNoOf(r); case 'po': return r.po || ''; case 'pr': return r.pr || ''; case 'cn': return r.cn || '';
    case 'company': return r.organization || r.company || ''; case 'customer': return r.customer || ''; case 'courier': return r.courier || '';
    case 'date': return r.day || r.updated || ''; case 'billing': return r.billed ? 'Billed in ERP' : 'Non billed'; case 'status': return r.status || ''; case 'dispatch': return DC_DL[r.cls] || '';
    default: { const e = (r.sheet || r.details || []).find(x => 'd:' + x[0] === k); return e ? String(e[1]) : ''; }
  }
}
// move a column: `key` takes the place of `toKey`
function dcMove(key, toKey) {
  const o = dcColumns(S.findRes || []).all.map(c => c[0]), i = o.indexOf(key), j = o.indexOf(toKey); if (i < 0 || j < 0 || i === j) return;
  o.splice(i, 1); o.splice(j, 0, key); dcOrdSave(o); dcRedraw();
}
function dcStep(key, dir) { const sh = dcColumns(S.findRes || []).shown.map(c => c[0]), i = sh.indexOf(key); if (i < 0) return; const t = dir === 'first' ? sh[0] : sh[i + dir]; if (t !== undefined && t !== key) dcMove(key, t); }
function dcSetW(key, w) { const m = { ...dcWSaved() }; w = Math.round(+w); if (w >= 40) m[key] = Math.min(800, w); else delete m[key]; dcWSave(m); dcRedraw(); }
function dcRedraw() { const p = $('#dc-colp'), st = p ? p.scrollTop : 0; drawFind(); const q = $('#dc-colp'); if (q) q.scrollTop = st; } // keep the menu scrolled where it was
let dcDrag = null;
document.addEventListener('dragstart', e => { const t = e.target.closest && e.target.closest('[data-dcm],[data-dch]'); if (!t) return; dcDrag = t.dataset.dcm || t.dataset.dch; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dcDrag); } catch {} });
document.addEventListener('dragover', e => { if (!dcDrag) return; const t = e.target.closest && e.target.closest('[data-dcr],[data-dch]'); if (!t) return; e.preventDefault(); $$('.dc-over').forEach(x => x.classList.remove('dc-over')); t.classList.add('dc-over'); });
document.addEventListener('drop', e => { if (!dcDrag) return; const t = e.target.closest && e.target.closest('[data-dcr],[data-dch]'); if (!t) return; e.preventDefault(); const to = t.dataset.dcr || t.dataset.dch, k = dcDrag; dcDrag = null; dcMove(k, to); });
document.addEventListener('dragend', () => { dcDrag = null; $$('.dc-over').forEach(x => x.classList.remove('dc-over')); });
document.addEventListener('change', e => { const w = e.target.closest && e.target.closest('[data-dcw]'); if (w) dcSetW(w.dataset.dcw, w.value); });
// drag the right edge of a column heading to change its width; double-click the edge = automatic width again
document.addEventListener('mousedown', e => {
  const h = e.target.closest && e.target.closest('.dc-rs'); if (!h) return; e.preventDefault(); e.stopPropagation();
  const key = h.dataset.rs;
  if (!Object.keys(dcWSaved()).length) { const m = {}; $$('#fres th[data-dch]').forEach(th => { m[th.dataset.dch] = Math.max(60, th.offsetWidth); }); dcWSave(m); drawFind(); } // first time: every column keeps the width it has now
  const ths = [...$$('#fres th[data-dch]')], th = ths.find(x => x.dataset.dch === key), col = th && $$('#fres colgroup col')[ths.indexOf(th) + 2], tbl = $('#fres table'); if (!th || !col) return;
  const x0 = e.clientX, w0 = th.offsetWidth, t0 = parseFloat(tbl.style.width) || tbl.offsetWidth; let nw = 0;
  const mv = ev => { nw = Math.max(40, Math.min(800, w0 + ev.clientX - x0)); col.style.width = nw + 'px'; tbl.style.width = (t0 - w0 + nw) + 'px'; };
  const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (nw) dcWSave({ ...dcWSaved(), [key]: Math.round(nw) }); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
});
document.addEventListener('dblclick', e => { const h = e.target.closest && e.target.closest('.dc-rs'); if (h) dcSetW(h.dataset.rs, 0); });
document.addEventListener('click', e => { if (S.dcColsOpen && e.target.isConnected && !e.target.closest('#dc-colp,#dc-cols')) { S.dcColsOpen = false; if (typeof drawFind === 'function' && $('#fres')) drawFind(); } });
function drawFind() {
  const out = $('#fres'); if (!out) return; const rs = S.findRes || [];
  if (!rs.length) { out.innerHTML = `<div class="card"><b>No match</b><div class="hint">${odActive() ? 'No DC matches these filters' + (S.findQ ? ` and “${esc(S.findQ)}”` : '') + '. Press “Clear filters” to see everything.' : `Nothing in the tracking sheets matches “${esc(S.findQ)}”. Check the number, or sync the sheet under Order tracking.`}</div></div>`; return; }
  const tot = S.findTotal || rs.length, more = tot > rs.length ? ` · showing the first ${rs.length}. Use the filters or search to narrow it down` : '';
  const pill = (t, c) => `<span class="pill" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c};white-space:nowrap">${t}</span>`;
  const CC = dcColumns(rs), fixedW = CC.shown.some(c => CC.widths[c[0]]), tw = 34 + 28 + 100 + CC.shown.reduce((a, c) => a + (CC.widths[c[0]] || 150), 0);
  const rows = rs.map((r, i) => {
    const ids = [['PO', r.po], ['P.R', r.pr], ['CN', r.cn], ['Order', r.orderId !== r.po && r.orderId !== r.pr && r.orderId !== r.cn ? r.orderId : '']].filter(x => x[1]);
    const h = r.handler, b = r.backup, cl = r.cls && OD_CLS[r.cls];
    const clsPill = cl ? pill(cl[0], cl[2]) : '', billPill = r.billed ? pill('Billed in ERP', '#16a34a') : pill('Non billed', '#e11d48');
    const one = v => `<td style="white-space:nowrap">${v ? `<b>${esc(v)}</b>` : '—'}</td>`;
    const cell = k => k === 'dcno' ? one(dcNoOf(r)) : k === 'po' ? one(r.po) : k === 'pr' ? one(r.pr) : k === 'cn' ? one(r.cn)
      : k === 'company' ? `<td>${esc(r.organization || r.company || '—')}</td>` : k === 'customer' ? `<td>${esc(r.customer || '—')}</td>` : k === 'courier' ? `<td>${esc(r.courier || '—')}</td>`
      : k === 'date' ? `<td style="white-space:nowrap">${esc(r.day || r.updated || '—')}</td>` : k === 'dispatch' ? `<td>${clsPill}</td>` : k === 'billing' ? `<td>${billPill}</td>` : k === 'status' ? `<td>${cl ? pill(esc(r.status || cl[0]), cl[2]) : orderPill(r.status)}</td>`
      : (() => { const v = ((r.sheet || r.details || []).find(d => 'd:' + d[0] === k) || [])[1] || ''; return /^https?:\/\/\S+$/i.test(v) ? `<td><a href="${esc(v)}" target="_blank" rel="noopener" style="color:var(--brand);font-weight:600">Open link</a></td>` : `<td>${esc(v || '—')}</td>`; })();
    const cap0 = r.edit && r.edit.can;
    return `<tr class="dc-row ${S.dcSel.has(dcKey(r)) ? 'picked' : ''}" data-r="${i}" style="cursor:pointer" title="Click to see the full details">
      <td style="width:34px;padding-right:0"><input type="checkbox" class="dc-sel" data-sel="${i}" ${S.dcSel.has(dcKey(r)) ? 'checked' : ''} ${cap0 ? '' : 'disabled'} title="${cap0 ? 'Select to edit several DCs at once' : esc((r.edit && r.edit.reason) || 'Cannot be edited')}"></td>
      <td style="width:28px;color:var(--ink-3)"><span class="dc-ar" style="display:inline-block;transition:transform .2s">▸</span></td>
      ${CC.shown.map(c => cell(c[0])).join('')}
      <td style="text-align:right;white-space:nowrap"><button class="btn sm ${r.cls === 'pending' ? 'primary' : ''}" data-edit="${i}" title="${r.cls === 'pending' ? 'Update this pending DC: it is saved in the Excel sheet too' : 'Edit this DC: it is saved in the Excel sheet too'}">${ic('edit')} Edit</button></td></tr>
    <tr class="dc-det" data-d="${i}" hidden><td></td><td></td><td colspan="${Math.max(1, CC.shown.length) + 1}" style="padding:6px 14px 16px">
      ${detailsHtml(r)}
      ${r.notes ? `<div class="hint" style="margin:6px 0 0">Note: ${esc(r.notes)}</div>` : ''}
      <div class="fr-c"><div class="hrow"><div><b>Customer${r.customerPhone ? ' · +' + esc(r.customerPhone) : ''}</b><small>${esc(r.customer || 'Number on the order')}</small></div><div class="cbtns">${contactBtns(r.customerPhone, r.customer, r.text)}</div></div>
        ${h ? `<div class="hrow"><div><b>${esc(h.name)}${h.phone ? ' · +' + esc(h.phone) : ''}</b><small>Handles ${esc(r.organization)}${h.active ? '' : ' (off duty)'}</small></div><div class="cbtns">${contactBtns(h.phone, h.name)}</div></div>` : `<div class="hint">No team member is set for this company yet (Organizations → Edit).</div>`}
        ${b && b.id !== (h && h.id) ? `<div class="hrow"><div><b>${esc(b.name)}${b.phone ? ' · +' + esc(b.phone) : ''}</b><small>Backup</small></div><div class="cbtns">${contactBtns(b.phone, b.name)}</div></div>` : ''}</div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm primary" data-edit="${i}">${ic('edit')} Edit / update</button><button class="btn sm" data-copy="${i}">${ic('edit')} Copy details</button><button class="btn sm wa" data-share="${i}">${ic('wa')} Send on WhatsApp</button><button class="btn sm" data-mail="${i}">${ic('mail')} Send by email</button>${r.chat ? `<button class="btn sm" data-chat="${r.chat.phone}">Open chat</button><button class="btn sm primary" data-send="${i}">${ic('send')} Send tracking in chat</button>` : ''}</div></td></tr>`;
  });
  // Total PO card = DCs grouped under their PO number; Total DC card = plain list of every DC
  let rowsHtml = rows.join('');
  if (S.dcGroup === 'po') {
    const groups = new Map(); rs.forEach((r, i) => { const k = r.po || '—'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
    const span = Math.max(1, CC.shown.length) + 3;
    rowsHtml = [...groups].map(([po, ix]) => { const c = k => ix.filter(i => rs[i].cls === k).length;
      return `<tr class="dc-grp"><td colspan="${span}" style="background:color-mix(in srgb,#7c3aed 9%,transparent);padding:8px 14px;border-top:2px solid color-mix(in srgb,#7c3aed 30%,transparent)"><input type="checkbox" class="dc-sel" data-selpo="${ix.join(',')}" title="Select every DC of this PO" style="margin-right:10px"><b style="color:#7c3aed">PO ${esc(po)}</b> <span class="hint" style="margin-left:8px">${ix.length} DC${ix.length === 1 ? '' : 's'} · <b style="color:var(--amber)">${c('pending')}</b> pending · <b style="color:var(--brand)">${c('dispatched')}</b> dispatched · <b style="color:#2563eb">${c('self')}</b> self${[...new Set(ix.map(i => rs[i].organization || rs[i].company).filter(Boolean))].length === 1 ? ' · ' + esc(rs[ix[0]].organization || rs[ix[0]].company) : ''}</span></td></tr>` + ix.map(i => rows[i]).join(''); }).join('');
  }
  out.innerHTML = `<div class="card pad"><div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="h3" style="margin:0">DCs <span class="hint" style="font-weight:500">· ${tot.toLocaleString()} found${more}</span></div>
      <div style="position:relative"><button class="btn sm" id="dc-cols" title="Choose the columns to show">${ic('list') || ''} Columns · ${CC.shown.length}</button>
        ${S.dcColsOpen ? `<div id="dc-colp" style="position:absolute;right:0;top:calc(100% + 6px);z-index:30;width:372px;max-height:460px;overflow:auto;background:var(--surface,#fff);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.25);padding:10px 12px">
          <div style="font-size:11px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Show these columns <span style="font-weight:600;text-transform:none;letter-spacing:0">· ${CC.all.length - DC_BASE.length} from your sheet</span></div>
          <input type="search" id="dc-colq" placeholder="Search columns…" value="${esc(S.dcColQ || '')}" autocomplete="off" style="width:100%;margin-bottom:8px;padding:7px 10px;border:1.5px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink);outline:none">
          ${(() => {
            const vis = n => !S.dcColQ || n.toLowerCase().includes(S.dcColQ.toLowerCase()) ? 'flex' : 'none', head = (t, first) => `<div style="font-size:11px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;margin:${first ? '2px' : '12px'} 0 4px;${first ? '' : 'padding-top:8px;border-top:1px solid var(--line)'}">${t}</div>`;
            const row = (k, n, on) => `<div class="dc-cl" data-dcr="${esc(k)}" data-n="${esc(n.toLowerCase())}" style="display:${vis(n)};gap:6px;align-items:center;padding:3px 0">${on ? `<span class="dc-grip" draggable="true" data-dcm="${esc(k)}" title="Drag up or down to move this column">⠿</span>` : ''}<label style="display:flex;gap:8px;align-items:center;flex:1;min-width:0;cursor:pointer"><input type="checkbox" data-dcc="${esc(k)}" ${on ? 'checked' : ''}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span></label>${on ? `<button class="dc-mv" data-dcfirst="${esc(k)}" title="Make this the first column">⤒</button><button class="dc-mv" data-dcup="${esc(k)}" title="Move left">↑</button><button class="dc-mv" data-dcdn="${esc(k)}" title="Move right">↓</button><input type="number" class="dc-w" min="40" max="800" step="10" data-dcw="${esc(k)}" value="${CC.widths[k] || ''}" placeholder="auto" title="Width in pixels (empty = automatic)">` : ''}</div>`;
            return head('In the table · first to last · width (px)', true) + (CC.shown.map(([k, n]) => row(k, n, true)).join('') || '<div class="hint">No column is ticked.</div>') + head('Not shown') + CC.all.filter(c => !CC.on.has(c[0])).map(([k, n]) => row(k, n, false)).join('');
          })()}
          <div style="display:flex;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--line)"><button class="btn sm" id="dc-all">All</button><button class="btn sm" id="dc-reset">Reset</button></div></div>` : ''}</div></div>
    <div class="tbl-wrap" style="border:1px solid var(--line);max-height:none"><table ${fixedW ? `class="tbl dc-fx" style="table-layout:fixed;width:${tw}px;min-width:100%"` : 'class="tbl"'}>${fixedW ? `<colgroup><col style="width:34px"><col style="width:28px">${CC.shown.map(c => `<col style="width:${CC.widths[c[0]] || 150}px">`).join('')}<col style="width:100px"></colgroup>` : ''}<thead><tr><th style="width:34px;padding-right:0"><input type="checkbox" class="dc-sel" id="dc-selall" title="Select all DCs in this list"></th><th></th>${CC.shown.map(c => `<th data-dch="${esc(c[0])}" draggable="true" style="position:relative;cursor:grab" title="Drag the heading to move the column">${esc(c[1])}<span class="dc-rs" data-rs="${esc(c[0])}" title="Drag to change the width. Double-click = automatic."></span></th>`).join('')}<th></th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div class="dc-bar" id="dc-bar"></div></div>`;
  dcSelUpdate();
}
// the Total PO / Total DC cards: group the list by PO number, or list every DC
function dcGroupBy(kind) { S.dcGroup = kind === 'po' && S.dcGroup !== 'po' ? 'po' : ''; if (typeof odDraw === 'function') odDraw(); drawFind(); }
async function findClick(e) {
  const rs = S.findRes || [];
  if (e.target.closest('#dc-cols')) { S.dcColsOpen = !S.dcColsOpen; S.dcColQ = ''; drawFind(); const q = $('#dc-colq'); if (q) q.focus(); return; }
  const mv = e.target.closest('[data-dcfirst],[data-dcup],[data-dcdn]'); if (mv) { e.stopPropagation(); const d = mv.dataset; return d.dcfirst !== undefined ? dcStep(d.dcfirst, 'first') : d.dcup !== undefined ? dcStep(d.dcup, -1) : dcStep(d.dcdn, 1); }
  if (e.target.closest('[data-dcw],.dc-grip')) return;
  const cc = e.target.closest('[data-dcc]');
  if (cc) { const cur = dcColumns(rs).on; cc.checked ? cur.add(cc.dataset.dcc) : cur.delete(cc.dataset.dcc); if (!cur.size) { cur.add('po'); toast('At least one column stays on'); } dcSave([...cur]); return dcRedraw(); }
  if (e.target.closest('#dc-all')) { dcSave(dcColumns(rs).all.map(c => c[0])); return dcRedraw(); }
  if (e.target.closest('#dc-reset')) { try { ['dc_cols', 'dc_order', 'dc_widths'].forEach(k => localStorage.removeItem(k)); } catch {} return dcRedraw(); }
  if (e.target.closest('#dc-colp')) return;
  const sa = e.target.closest('#dc-selall'); if (sa) { rs.forEach(r => { if (r.edit && r.edit.can) sa.checked ? S.dcSel.add(dcKey(r)) : S.dcSel.delete(dcKey(r)); }); return dcSelUpdate(); }
  const sp = e.target.closest('[data-selpo]'); if (sp) { sp.dataset.selpo.split(',').map(Number).forEach(i => { const r = rs[i]; if (r && r.edit && r.edit.can) sp.checked ? S.dcSel.add(dcKey(r)) : S.dcSel.delete(dcKey(r)); }); return dcSelUpdate(); }
  const sc = e.target.closest('[data-sel]'); if (sc) { const r = rs[+sc.dataset.sel]; if (r) sc.checked ? S.dcSel.add(dcKey(r)) : S.dcSel.delete(dcKey(r)); return dcSelUpdate(); }
  if (e.target.closest('#dc-bulk')) { const sel = rs.filter(r => S.dcSel.has(dcKey(r)) && r.edit && r.edit.can); return sel.length ? dcEditModal(sel) : undefined; }
  if (e.target.closest('#dc-clr')) { S.dcSel.clear(); return dcSelUpdate(); }
  const edb = e.target.closest('[data-edit]'); if (edb) { dcEdit(+edb.dataset.edit); return; }
  const rowEl = e.target.closest('.dc-row'); if (rowEl && !e.target.closest('a,button,input')) { const d = $(`.dc-det[data-d="${rowEl.dataset.r}"]`); if (d) { d.hidden = !d.hidden; const ar = $('.dc-ar', rowEl); if (ar) ar.style.transform = d.hidden ? '' : 'rotate(90deg)'; } return; }
  const shw = e.target.closest('[data-share]'); if (shw) { waSendOrder(rs[+shw.dataset.share]); return; }
  const ml = e.target.closest('[data-mail]'); if (ml) { const r = rs[+ml.dataset.mail]; await ensureMailLoaded(); mailSendOrder(r); return; }
  const cp = e.target.closest('[data-copy]'); if (cp) { try { await navigator.clipboard.writeText(rs[+cp.dataset.copy].text); toast('Details copied'); } catch { toast('Could not copy', true); } return; }
  const ch = e.target.closest('[data-chat]'); if (ch) { S.view = 'inbox'; location.hash = 'inbox'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'inbox')); renderView(); openConv(ch.dataset.chat); return; }
  const sd = e.target.closest('[data-send]'); if (sd) {
    const r = rs[+sd.dataset.send]; if (!await gconfirm(`Send these details to +${r.chat.phone}?`)) return;
    try { await api(`/conversations/${r.chat.phone}/send`, { method: 'POST', body: { text: r.text } }); toast('Sent to the customer'); } catch (err) { toast(err.message, true); }
  }
}

// ---- selecting DCs for bulk edit ----
const dcKey = r => `${r.src}|${r.row}|${r.orderId}`;
S.dcSel = S.dcSel || new Set();
function dcSelUpdate() {
  const rs = S.findRes || [], ok = rs.filter(r => r.edit && r.edit.can), sel = rs.filter(r => S.dcSel.has(dcKey(r)) && r.edit && r.edit.can);
  $$('.dc-row').forEach(tr => { const r = rs[+tr.dataset.r]; if (!r) return; const on = S.dcSel.has(dcKey(r)); tr.classList.toggle('picked', on); const cb = $('.dc-sel', tr); if (cb) cb.checked = on; });
  const all = $('#dc-selall'); if (all) { all.checked = !!ok.length && sel.length === ok.length; all.indeterminate = sel.length > 0 && sel.length < ok.length; }
  $$('[data-selpo]').forEach(cb => { const ix = cb.dataset.selpo.split(',').map(Number).filter(i => rs[i] && rs[i].edit && rs[i].edit.can), n = ix.filter(i => S.dcSel.has(dcKey(rs[i]))).length; cb.checked = !!ix.length && n === ix.length; cb.indeterminate = n > 0 && n < ix.length; });
  const bar = $('#dc-bar'); if (!bar) return;
  const c = k => sel.filter(r => r.cls === k).length;
  bar.innerHTML = sel.length ? `<div><b>${sel.length}</b><span>selected${c('pending') ? ` · ${c('pending')} pending` : ''}</span><button class="btn sm primary" id="dc-bulk">${ic('edit')} Bulk edit</button><button class="btn sm ghost" id="dc-clr">Clear</button></div>` : '';
}

// ---- Edit one DC, or several at once (bulk): saved here and written into the company's Excel sheet ----
const DC_STATUSES = [['Pending dispatch', 'var(--amber)'], ['Dispatched', 'var(--brand)'], ['Self collection', '#2563eb'], ['Delivered', '#16a34a'], ['On hold', '#8a9893'], ['Cancelled', 'var(--red)'], ['Returned', 'var(--red)']];
const dcStColor = st => (DC_STATUSES.find(x => x[0].toLowerCase() === String(st).toLowerCase()) || [0, /pending/i.test(st) ? 'var(--amber)' : /self|collect/i.test(st) ? '#2563eb' : /cancel|return/i.test(st) ? 'var(--red)' : 'var(--brand)'])[1];
function dcEdit(i) { const r = (S.findRes || [])[i]; if (!r) return; if (!(r.edit && r.edit.can)) return toast((r.edit && r.edit.reason) || 'This DC cannot be edited.', true); dcEditModal([r]); }
function dcEditModal(rows) {
  const bulk = rows.length > 1, r0 = rows[0], today = new Date().toISOString().slice(0, 10), rs = S.findRes || [];
  const fields = bulk ? [...new Set(rows.flatMap(r => r.edit.fields))] : r0.edit.fields;
  const has = k => fields.includes(k);
  const couriers = [...new Set(rs.map(x => x.courier).filter(Boolean))].slice(0, 40);
  const cur = bulk ? { status: '', courier: '', cn: '', date: '', receivedBy: '', notes: '' }
    : { status: r0.status || 'Pending dispatch', courier: r0.courier || '', cn: r0.cn || '', date: /^\d{4}-\d{2}-\d{2}$/.test(r0.updated || '') ? r0.updated : '', receivedBy: r0.receivedBy || '', notes: r0.notes || '' };
  const local = rows.every(r => r.edit.local), signin = rows.some(r => r.edit.signin);
  const sts = bulk ? DC_STATUSES.map(x => x[0]) : [...new Set([cur.status, ...DC_STATUSES.map(x => x[0])])];
  const idChips = r => [['DC', (typeof dcNoOf === 'function' && dcNoOf(r)) || ''], ['PO', r.po], ['P.R', r.pr], ['CN', r.cn]].filter(x => x[1]).map(([l, v]) => `<span class="dce-chip">${l} <b>${esc(v)}</b></span>`).join('') || `<span class="dce-chip"><b>${esc(r.orderId)}</b></span>`;
  const fld = (k, label, input, extra = '') => `<div class="dce-f ${k === 'notes' ? 'full' : ''}" data-fk="${k}"><label>${label}${has(k) ? extra : '<small>no column in sheet</small>'}</label>${input}</div>`;
  const dis = k => has(k) ? '' : ' disabled';
  const sub = bulk ? `<span class="dce-chip"><b>${rows.length}</b> DCs selected</span>${[...new Set(rows.map(r => r.organization || r.company).filter(Boolean))].slice(0, 3).map(c => `<span class="dce-chip">${esc(c)}</span>`).join('')}`
    : `${idChips(r0)}<span class="dce-chip">${esc(r0.organization || r0.company || '')}</span>`;
  const bg = modal(`<div class="dce-h"><div class="dce-ic">${ic('edit')}</div><div style="min-width:0"><h3>${bulk ? 'Bulk edit DCs' : 'Edit DC'}</h3><div class="dce-sub">${sub}</div></div></div>
    <div class="dce-body">
      ${bulk ? `<div class="dce-note"><span class="dce-dot" style="background:var(--brand)"></span><div><b>Only the fields you fill in are changed</b> on all ${rows.length} DCs. Fields you leave empty keep each DC's own value.</div></div>
        <div><div class="dce-sec">Selected DCs</div><div class="dce-list">${rows.map(r => { const d = (typeof dcNoOf === 'function' && dcNoOf(r)) || ''; return `<span class="dce-chip" title="${esc(r.organization || r.company || '')}">${esc(d || r.po || r.orderId)}${d && r.po ? ` · PO <b>${esc(r.po)}</b>` : ''}</span>`; }).join('')}</div></div>` : ''}
      ${signin ? `<div class="dce-note warn"><div>${esc(r0.edit.reason)}</div></div>` : ''}
      <div><div class="dce-sec">Status${bulk ? ' <span style="text-transform:none;letter-spacing:0;font-weight:600">· optional</span>' : ''}</div>
        <div class="dce-st" id="de-sts">${sts.map(x => `<button type="button" data-st="${esc(x)}" class="${x === cur.status ? 'on' : ''}" style="--c:${dcStColor(x)}"${dis('status')}><i></i>${esc(x)}</button>`).join('')}</div></div>
      <div><div class="dce-sec">Dispatch details</div><div class="dce-g">
        ${fld('courier', 'Courier', `<input id="de-co" list="de-cl" value="${esc(cur.courier)}" placeholder="e.g. TCS, Leopards, Self" autocomplete="off"${dis('courier')}><datalist id="de-cl">${couriers.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
        ${fld('cn', bulk ? 'CN no <small>same for all selected</small>' : 'CN no <small>tracking / consignment</small>', `<input id="de-cn" value="${esc(cur.cn)}" placeholder="Type the CN number" autocomplete="off"${dis('cn')}>`)}
        ${fld('date', 'Dispatch date', `<input type="date" id="de-dt" value="${esc(cur.date)}"${dis('date')}>`, '<button type="button" class="lnk2" id="de-today">Today</button>')}
        ${fld('receivedBy', 'Received by', `<input id="de-rb" value="${esc(cur.receivedBy)}" placeholder="Name of the person who took delivery" autocomplete="off"${dis('receivedBy')}>`)}
        ${fld('notes', 'Notes', `<textarea id="de-nt" placeholder="${bulk ? 'Replaces the note of every selected DC' : 'Add a note…'}"${dis('notes')}>${esc(cur.notes)}</textarea>`)}
      </div></div>
      <div class="dce-note"><span class="dce-dot ${local ? 'off' : ''}"></span><div>${local ? 'This sheet was uploaded by hand, so only the app is updated.' : bulk ? `Saving also updates these ${rows.length} rows in the Excel sheet.` : 'Saving also updates this row in the Excel sheet.'}</div></div>
      <div class="dce-res" id="de-res" hidden></div>
    </div>
    <div class="dce-ft"><span class="grow" id="de-cnt"></span><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${bulk ? `Update ${rows.length} DCs` : 'Save changes'}</button></div>`, (bg, close) => {
    const m = bg.firstChild; m.classList.add('dce');
    let st = cur.status; const v = id => { const el = $(id, bg); return el ? el.value.trim() : ''; };
    const now = () => ({ status: st, courier: v('#de-co'), cn: v('#de-cn'), date: v('#de-dt'), receivedBy: v('#de-rb'), notes: v('#de-nt') });
    const dirty = () => { const n = now(), d = {}; for (const k of fields) if ((n[k] || '') !== (cur[k] || '')) d[k] = n[k]; return d; };
    const refresh = () => { const d = dirty(); $$('.dce-f', bg).forEach(f => f.classList.toggle('dirty', f.dataset.fk in d)); const n = Object.keys(d).length + (0); $('#de-cnt', bg).textContent = n ? `${n} field${n === 1 ? '' : 's'} to change` : bulk ? 'Fill in what you want to change' : 'No changes yet'; };
    $('#de-sts', bg).onclick = e => { const b = e.target.closest('[data-st]'); if (!b || b.disabled) return; st = bulk && st === b.dataset.st ? '' : b.dataset.st; $$('#de-sts button', bg).forEach(x => x.classList.toggle('on', x.dataset.st === st));
      const dt = $('#de-dt', bg); if (has('date') && dt && !dt.value && /dispatch|ship|deliver|self|collect/i.test(st) && !/pending/i.test(st)) dt.value = today; refresh(); };
    const td = $('#de-today', bg); if (td) td.onclick = () => { $('#de-dt', bg).value = today; refresh(); };
    bg.addEventListener('input', refresh); refresh();
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const changes = dirty(); if (!Object.keys(changes).length) return toast('Nothing changed');
      const b = $('#sv', bg), txt = b.textContent; b.disabled = true; b.textContent = 'Saving…';
      try {
        if (!bulk) {
          const res = await api('/dc/edit', { method: 'POST', body: { src: r0.src, row: r0.row, orderId: r0.orderId, changes } });
          const idx = rs.findIndex(x => dcKey(x) === dcKey(r0)); if (idx >= 0) rs[idx] = { ...res.row, chat: r0.chat };
          close(); drawFind(); loadOrdersQuiet(); toast(res.where === 'app' ? 'Saved' : 'Saved — and updated in the Excel sheet'); return;
        }
        const res = await api('/dc/bulk', { method: 'POST', body: { items: rows.map(r => ({ src: r.src, row: r.row, orderId: r.orderId })), changes } });
        for (const x of res.results) if (x.row) { const idx = rs.findIndex(y => y.src === x.row.src && String(y.row) === String(x.row.row) && y.orderId === x.row.orderId); if (idx >= 0) rs[idx] = { ...x.row, chat: rs[idx].chat }; }
        const bad = res.results.filter(x => !x.ok);
        res.results.filter(x => x.ok).forEach(x => S.dcSel.delete(x.key));
        drawFind(); loadOrdersQuiet();
        if (!bad.length) { close(); toast(`${res.done} DC${res.done === 1 ? '' : 's'} updated${local ? '' : ' — and saved in the Excel sheet'}`); return; }
        const rb = $('#de-res', bg); rb.hidden = false; rb.innerHTML = `<b style="font-size:12.5px">${res.done} updated, ${bad.length} not updated:</b>` + bad.map(x => `<div>${esc(x.label)} — ${esc(x.error)}</div>`).join('');
        b.disabled = false; b.textContent = txt; b.hidden = true; $('#cx', bg).textContent = 'Close';
      } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = txt; }
    };
  });
}
// after an edit: refresh the counts, and the list itself (a pending DC that is now dispatched leaves the "Pending dispatch" filter)
async function loadOrdersQuiet() { try { odLoad(); if (typeof odOnChange === 'function' && odOnChange) setTimeout(odOnChange, 900); } catch {} }

// ---------- my email signature (text + optional GIF) ----------
async function loadSig() { try { S.sig = await api('/me/signature'); } catch { S.sig = S.sig || null; } $$('.sigprev').forEach(el => el.outerHTML = sigPrevHtml()); }
function sigImgHtml(s, w) {
  const src = s.gifPreview || s.gifUrl; return src ? `<div style="margin-top:8px"><img src="${esc(src)}" width="${w || s.gifWidth || 200}" alt="" style="max-width:100%;height:auto"></div>` : '';
}
// shown under the message you are writing, so you see what will be added
function sigPrevHtml() {
  const s = S.sig;
  if (!s) return '<div class="sigprev" hidden></div>';
  if (!s.enabled || !(s.html.replace(/<[^>]*>/g, '').trim() || s.hasGif || s.gifUrl))
    return `<div class="sigprev off" data-sig="1" title="Set up your signature">${ic('edit')} Add your signature (text and a GIF) to every email</div>`;
  return `<div class="sigprev" data-sig="1" title="Click to edit your signature"><div class="sigl">${ic('edit')} Your signature will be added</div><div class="sigb">${s.html}${sigImgHtml(s)}</div></div>`;
}
document.addEventListener('click', e => { if (e.target.closest('.sigprev[data-sig]')) sigModal(); });

async function sigModal() {
  let s; try { s = await api('/me/signature'); } catch (e) { return toast(e.message, true); }
  const me = S.me || {}, mine = (S.agents || []).find(a => a.id === me.id) || me;
  const starter = `<b>${esc(me.name || '')}</b><br>${mine.title ? esc(mine.title) + '<br>' : ''}${esc(S.settings.businessName || '')}${mine.phone ? '<br>📞 +' + esc(normPhone(mine.phone)) : ''}`;
  let newGif = null, removeGif = false, curPrev = s.gifPreview;
  modal(`<h3>${ic('edit')} My email signature</h3>
    <div class="field"><label class="chk"><input type="checkbox" id="sg-on" ${s.enabled || !s.html ? 'checked' : ''}><span>Add this signature to my emails (new, replies, forwards, scheduled)</span></label></div>
    <div class="field"><label>Signature text <button type="button" class="lnk" id="sg-fill">Fill with my name &amp; phone</button></label>
      ${rteBar()}<div class="rte-ed sig-ed" id="sg-ed" contenteditable="true" data-ph="Name, job title, company, phone…">${s.html}</div></div>
    <div class="field"><label>GIF or picture</label>
      <div class="gifrow"><label class="btn sm">Upload GIF<input type="file" id="sg-file" accept="image/gif,image/png,image/jpeg,image/webp" hidden></label>
        <button type="button" class="btn sm danger" id="sg-rm" hidden>Remove</button><small class="hint" id="sg-fn"></small></div>
      <input type="url" id="sg-url" placeholder="…or paste a direct link ending in .gif (https://…)" value="${esc(s.gifUrl)}" style="margin-top:8px">
      <div class="hint">Upload up to 1.5 MB (it is attached inside the email so it shows in Gmail and Outlook). A Giphy/Tenor <b>page</b> address will not work — use the direct <b>.gif</b> link.</div>
      <div class="gifrow" style="margin-top:8px"><span class="hint">Width</span><select id="sg-w" style="width:auto">${[80, 120, 160, 200, 300, 400].map(w => `<option value="${w}" ${(+s.gifWidth || 200) === w ? 'selected' : ''}>${w}px</option>`).join('')}</select></div></div>
    <div class="field"><label>Preview</label><div class="sigprev static" id="sg-pv"></div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save signature</button></div>`, (bg, close) => {
    const ed = $('#sg-ed', bg); rteWire(bg, ed);
    const cur = () => ({ gifPreview: removeGif ? '' : newGif ? `data:${newGif.type};base64,${newGif.b64}` : curPrev, gifUrl: $('#sg-url', bg).value.trim(), gifWidth: $('#sg-w', bg).value });
    const draw = () => {
      const c = cur(), hasFile = !!c.gifPreview;
      $('#sg-pv', bg).innerHTML = `<div class="sigb">${ed.innerHTML || '<span class="hint">Your text appears here</span>'}${sigImgHtml({ gifPreview: hasFile ? c.gifPreview : '', gifUrl: hasFile ? '' : c.gifUrl, gifWidth: c.gifWidth })}</div>`;
      $('#sg-rm', bg).hidden = !hasFile; $('#sg-fn', bg).textContent = newGif ? newGif.filename : (hasFile && s.gifName ? s.gifName : '');
    };
    ed.oninput = draw; $('#sg-url', bg).oninput = draw; $('#sg-w', bg).onchange = draw;
    $('#sg-fill', bg).onclick = () => { ed.innerHTML = starter; draw(); };
    $('#sg-file', bg).onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      if (f.size > 1.5e6) return toast('That picture is over 1.5 MB. Pick a smaller GIF or paste a link.', true);
      const [r] = await readFiles([f]); newGif = r; removeGif = false; $('#sg-url', bg).value = ''; draw();
    };
    $('#sg-rm', bg).onclick = () => { newGif = null; removeGif = true; curPrev = ''; draw(); };
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const b = $('#sv', bg); b.disabled = true;
      try {
        S.sig = await api('/me/signature', { method: 'PUT', body: { enabled: $('#sg-on', bg).checked, html: ed.innerHTML, gifUrl: $('#sg-url', bg).value.trim(), gifWidth: $('#sg-w', bg).value, gif: newGif || undefined, removeGif: removeGif && !newGif } });
        $$('.sigprev:not(.static)').forEach(el => el.outerHTML = sigPrevHtml()); close(); toast('Signature saved');
      } catch (err) { toast(err.message, true); b.disabled = false; }
    };
    draw();
  });
}
