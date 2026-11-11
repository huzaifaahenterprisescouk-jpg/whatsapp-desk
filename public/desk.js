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
  $('#main').innerHTML = `<div class="page">${pageHead('Find PO / P.R / CN', 'Type a PO, P.R, CN or order number (part of a number works too) to see its status and who to call.')}
    <div class="card findbox"><div class="search wide">${ic('search')}<input type="search" id="fq" placeholder="e.g. 366809" value="${esc(S.findQ || '')}" autofocus></div></div>
    <div id="fres" class="fres"></div></div>`;
  const run = async () => {
    const q = $('#fq').value.trim(); S.findQ = q; const out = $('#fres');
    if (q.length < 2) { out.innerHTML = `<div class="hint" style="padding:18px 4px">Start typing a number to search every company sheet.</div>`; return; }
    try { const r = await api('/track/search?q=' + encodeURIComponent(q)); if ($('#fq').value.trim() !== q) return; S.findRes = r.results; drawFind(); } catch (e) { out.innerHTML = `<div class="hint">${esc(e.message)}</div>`; }
  };
  $('#fq').oninput = () => { clearTimeout(findT); findT = setTimeout(run, 250); };
  $('#fres').onclick = findClick; run(); $('#fq').focus();
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
function drawFind() {
  const out = $('#fres'); if (!out) return; const rs = S.findRes || [];
  if (!rs.length) { out.innerHTML = `<div class="card"><b>No match</b><div class="hint">Nothing in the tracking sheets matches “${esc(S.findQ)}”. Check the number, or sync the sheet under Order tracking.</div></div>`; return; }
  out.innerHTML = rs.map((r, i) => {
    const ids = [['PO', r.po], ['P.R', r.pr], ['CN', r.cn], ['Order', r.orderId !== r.po && r.orderId !== r.pr && r.orderId !== r.cn ? r.orderId : '']].filter(x => x[1]);
    const h = r.handler, b = r.backup;
    return `<div class="card fr" data-i="${i}">
      <div class="fr-h"><div class="ids">${ids.map(([l, v]) => `<span class="pill violet">${l} ${esc(v)}</span>`).join('')}</div>${orderPill(r.status)}</div>
      <div class="fr-b"><div><small>Company</small><b>${esc(r.organization || r.company || '—')}</b></div><div><small>Customer</small><b>${esc(r.customer || '—')}</b></div><div><small>Courier</small><b>${esc(r.courier || '—')}</b></div><div><small>Updated</small><b>${esc(r.updated || '—')}</b></div></div>
      ${detailsHtml(r)}
      ${r.notes ? `<div class="hint" style="margin:6px 0 0">Note: ${esc(r.notes)}</div>` : ''}
      <div class="fr-c"><div class="hrow"><div><b>Customer${r.customerPhone ? ' · +' + esc(r.customerPhone) : ''}</b><small>${esc(r.customer || 'Number on the order')}</small></div><div class="cbtns">${contactBtns(r.customerPhone, r.customer, r.text)}</div></div>
        ${h ? `<div class="hrow"><div><b>${esc(h.name)}${h.phone ? ' · +' + esc(h.phone) : ''}</b><small>Handles ${esc(r.organization)}${h.active ? '' : ' (off duty)'}</small></div><div class="cbtns">${contactBtns(h.phone, h.name)}</div></div>` : `<div class="hint">No team member is set for this company yet (Organizations → Edit).</div>`}
        ${b && b.id !== (h && h.id) ? `<div class="hrow"><div><b>${esc(b.name)}${b.phone ? ' · +' + esc(b.phone) : ''}</b><small>Backup</small></div><div class="cbtns">${contactBtns(b.phone, b.name)}</div></div>` : ''}</div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-copy="${i}">${ic('edit')} Copy details</button><button class="btn sm wa" data-share="${i}">${ic('wa')} Send on WhatsApp</button><button class="btn sm" data-mail="${i}">${ic('mail')} Send by email</button>${r.chat ? `<button class="btn sm" data-chat="${r.chat.phone}">Open chat</button><button class="btn sm primary" data-send="${i}">${ic('send')} Send tracking in chat</button>` : ''}</div></div>`;
  }).join('');
}
async function findClick(e) {
  const rs = S.findRes || [];
  const shw = e.target.closest('[data-share]'); if (shw) { waSendOrder(rs[+shw.dataset.share]); return; }
  const ml = e.target.closest('[data-mail]'); if (ml) { const r = rs[+ml.dataset.mail]; await ensureMailLoaded(); mailSendOrder(r); return; }
  const cp = e.target.closest('[data-copy]'); if (cp) { try { await navigator.clipboard.writeText(rs[+cp.dataset.copy].text); toast('Details copied'); } catch { toast('Could not copy', true); } return; }
  const ch = e.target.closest('[data-chat]'); if (ch) { S.view = 'inbox'; location.hash = 'inbox'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'inbox')); renderView(); openConv(ch.dataset.chat); return; }
  const sd = e.target.closest('[data-send]'); if (sd) {
    const r = rs[+sd.dataset.send]; if (!await gconfirm(`Send these details to +${r.chat.phone}?`)) return;
    try { await api(`/conversations/${r.chat.phone}/send`, { method: 'POST', body: { text: r.text } }); toast('Sent to the customer'); } catch (err) { toast(err.message, true); }
  }
}

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
