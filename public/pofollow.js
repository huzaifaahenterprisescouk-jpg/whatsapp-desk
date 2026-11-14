// PO follow-up (admin): dispatched DCs that still have no PO, add a received PO, and the reminder mails (PDF + Excel).
const REPEATS = [[0, "Don't repeat (once a day)"], [1, 'Every hour'], [2, 'Every 2 hours'], [3, 'Every 3 hours'], [4, 'Every 4 hours'], [6, 'Every 6 hours'], [12, 'Every 12 hours']];
const MODES = { list: ['One mail with the list', 'One mail with the whole list (PDF / Excel)'], each: ['One mail per DC + its DC & quotation', 'One mail for each DC, with its DC copy and quotation attached'], both: ['List + one mail per DC', 'The list mail first, then one mail for each DC'] };
const repText = r => r.repeatHours > 0 ? `then every ${r.repeatHours} hour${r.repeatHours === 1 ? '' : 's'} until ${r.untilTime}` : 'once a day';

async function viewPoFollow() {
  if (!$('#main .page')) $('#main').innerHTML = `<div class="page">${pageHead('PO follow-up', 'Loading the DCs that are waiting for a PO…')}<div class="card pad"><div class="hint">Loading…</div></div></div>`;
  let d; try { d = await api('/pofollow'); } catch (e) { if (S.view === 'pofollow') $('#main').innerHTML = `<div class="page"><div class="notice">${esc(e.message)}</div></div>`; return; }
  S.po = d; if (S.view === 'pofollow') poRender(d); // (the person may have gone to another page while it loaded)
}
// the page, for the company picked at the top (cards, table, list of added POs and the Excel / PDF all follow it)
function poRender(d) {
  const tok = encodeURIComponent(S.token), cos = [...new Set([...d.pending.map(p => p.company), ...d.received.map(r => r.company), ...(d.dcSheets || [])].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (S.poCo && !cos.includes(S.poCo)) S.poCo = '';
  const co = S.poCo || '', P = d.pending.filter(p => !co || p.company === co), R = d.received.filter(r => !co || r.company === co);
  const oldest = Math.max(0, ...P.map(p => p.days)), todayN = R.filter(r => new Date(r.at).toDateString() === new Date().toDateString()).length, cq = co ? '&company=' + encodeURIComponent(co) : '';
  $('#main').innerHTML = `<div class="page">${pageHead('PO follow-up', 'DCs that were dispatched but still have no PO. Add the PO when it arrives, or let the app email the PO maker again and again until it does.',
    `<a class="btn" href="/api/pofollow/download?format=xlsx&token=${tok}${cq}">${ic('down')} Excel</a><a class="btn" href="/api/pofollow/download?format=pdf&token=${tok}${cq}">${ic('down')} PDF</a><button class="btn" id="pbulk">${ic('plus')} Add many POs</button><button class="btn primary" id="pnew">${ic('mail')} New reminder</button>`)}
    ${d.mailReady ? '' : `<div class="notice" style="margin:0 0 16px;font-size:13.5px">Reminder mails need an email account. Open <b>Reports → Email settings</b> (or add a Gmail mailbox under Email) once, then they send by themselves.</div>`}
    ${d.dcSheets.length ? '' : `<div class="hint" style="margin:0 0 14px">Tip: a company sheet is treated as a DC register when it has <b>DC no</b>, <b>Cost code / Branch code</b> and <b>Description / Address</b> columns. Only rows with all three filled in count as DCs.</div>`}
    <div class="row" style="gap:10px;flex-wrap:wrap;margin:0 0 14px"><span class="hint" style="font-weight:700">Show</span><select id="pco" style="width:auto;min-width:200px"><option value="">All banks / companies</option>${cos.map(c => `<option ${c === co ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>${co ? `<button class="btn sm ghost" id="pco-x">${ic('x')} Clear filter</button>` : ''}</div>
    <div class="grid g3" style="margin-bottom:18px"><div class="card kpi"><div class="l">${ic('box')} Dispatched, no PO</div><div class="v">${P.length}</div><div class="s">DCs waiting for a PO${co ? " · " + esc(co) : ""}</div></div>
      <div class="card kpi"><div class="l">${ic('mail')} Longest wait</div><div class="v">${oldest}<span style="font-size:15px;font-weight:600"> day${oldest === 1 ? '' : 's'}</span></div><div class="s">since dispatch</div></div>
      <div class="card kpi"><div class="l">${ic('check')} POs added today</div><div class="v">${todayN}</div><div class="s">${R.length} added in total</div></div></div>
    <div class="h3">Reminder mails</div>
    ${docsCard(d)}
    <div class="team" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr));margin-bottom:22px">${d.rules.map(ruleCard).join('') || `<div class="card empty" style="padding:34px;grid-column:1/-1"><div><b style="font-size:15px">No reminder yet</b><div class="hint" style="margin-top:4px">Press <b>New reminder</b>: pick the time and the email of the person who makes the PO. The mail carries the list as PDF + Excel and repeats until every DC has a PO.</div></div></div>`}</div>
    <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px"><div class="h3" style="margin:0">Waiting for a PO</div><input type="text" id="pq" style="margin-left:auto" placeholder="Search DC, branch, address…" style="width:240px"></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>DC no</th><th>Company</th><th>Branch</th><th>Address</th><th>Req / P.R</th><th>Dispatched</th><th>Waiting</th><th>Mails</th><th>DC / Quotation</th><th style="min-width:230px">Add the PO</th></tr></thead><tbody id="pbody"></tbody></table></div></div>
    <div class="h3" style="margin:24px 0 10px">POs you added</div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>DC no</th><th>PO no</th><th>Company</th><th>Branch</th><th>Added</th><th>Saved in</th><th></th></tr></thead><tbody>${R.map(r => `<tr><td><b>${esc(r.dc)}</b></td><td>${esc(r.po)}</td><td>${esc(r.company)}</td><td>${esc(r.branch)}</td><td class="hint">${new Date(r.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${r.by ? ' · ' + esc(r.by) : ''}</td><td>${r.where && r.where !== 'app' ? '<span class="pill green">Excel sheet</span>' : '<span class="pill">App only</span>'}</td><td><button class="btn sm ghost danger" data-undo="${esc(r.id)}" title="Remove this PO (the DC goes back to the waiting list)">${ic('trash')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="hint" style="padding:18px">Nothing yet. POs you add above appear here.</td></tr>'}</tbody></table></div></div></div>`;
  let shown = 80, rowsNow = [];
  const docCell = p => { const c = p.docs || { dc: 0, quote: 0 }; return `<button class="btn sm ghost" data-docs="1" title="Upload / see the DC and quotation of this DC">${ic('up')} <span class="pill ${c.dc ? 'green' : ''}">DC ${c.dc || '–'}</span> <span class="pill ${c.quote ? 'green' : ''}">Q ${c.quote || '–'}</span></button>`; };
  const draw = () => {
    const q = $('#pq').value.toLowerCase().trim(); rowsNow = P.filter(p => !q || [p.dc, p.branch, p.address, p.req, p.company].join(' ').toLowerCase().includes(q));
    const part = rowsNow.slice(0, shown);
    $('#pbody').innerHTML = part.map(p => `<tr data-k="${esc(p.key)}"><td><b>${esc(p.dc)}</b></td><td>${esc(p.company)}</td><td>${esc(p.branch)}</td><td style="max-width:260px">${esc(p.address)}</td><td>${esc(p.req) || '<span class="hint">—</span>'}</td><td>${esc(fmtDay(p.dispatchDay))}</td><td><span class="pill ${p.days >= 7 ? 'red' : p.days >= 3 ? 'amber' : ''}">${p.days}d</span></td><td>${p.reminders ? `<span class="pill violet">${p.reminders}</span>` : '<span class="hint">0</span>'}</td>
      <td style="white-space:nowrap">${docCell(p)} <button class="btn sm ghost" data-mail="1" title="Email this DC now, with its DC and quotation attached">${ic('send')}</button></td>
      <td><div class="row" style="gap:6px"><input type="text" class="poin" placeholder="PO no" style="width:130px"><button class="btn sm primary" data-save="1">Save</button></div></td></tr>`).join('') || `<tr><td colspan="10" class="hint" style="padding:22px;text-align:center">${P.length ? 'No DC matches your search.' : '🎉 Every dispatched DC has a PO.'}</td></tr>`
      + (rowsNow.length > shown ? `<tr><td colspan="10" style="text-align:center;padding:12px"><button class="btn sm" id="pmore">Show ${Math.min(80, rowsNow.length - shown)} more (${rowsNow.length - shown} left)</button></td></tr>` : '');
  };
  const fmtDay = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  draw(); $('#pco').onchange = e => { S.poCo = e.target.value; poRender(d); }; const cx = $('#pco-x'); if (cx) cx.onclick = () => { S.poCo = ''; poRender(d); }; let qt; $('#pq').oninput = () => { clearTimeout(qt); shown = 80; qt = setTimeout(draw, 120); };
  const save = async tr => {
    const p = P.find(x => x.key === tr.dataset.k), inp = $('.poin', tr), po = inp.value.trim(); if (!p) return; if (!po) { inp.focus(); return toast('Type the PO number first', true); }
    const b = $('[data-save]', tr); b.disabled = true;
    try { const r = await api('/pofollow/po', { method: 'POST', body: { src: p.src, dc: p.dc, po } }); toast(r.why ? `PO saved in the app. ${r.why}` : 'PO saved' + (r.rec.where !== 'app' ? ' and written to the Excel sheet' : ''), false); if (r.duplicate) setTimeout(() => toast(r.duplicate, true), 1800); d.pending = d.pending.filter(x => x.key !== p.key); d.received.unshift(r.rec); poRender(d); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  };
  $('#pbody').onclick = e => {
    if (e.target.closest('#pmore')) { shown += 80; return draw(); }
    const tr = e.target.closest('tr[data-k]'); if (!tr) return; const p = P.find(x => x.key === tr.dataset.k);
    if (e.target.closest('[data-save]')) return save(tr);
    if (e.target.closest('[data-docs]')) return docsModal(d, p);
    if (e.target.closest('[data-mail]')) return mailDcModal(d, p);
  };
  bindDocsCard(d, P);
  $('#pbody').onkeydown = e => { if (e.key === 'Enter' && e.target.classList.contains('poin')) save(e.target.closest('tr')); };
  $('.team').onclick = async e => {
    const card = e.target.closest('[data-prid]'); if (!card) return; const r = d.rules.find(x => x.id === card.dataset.prid);
    if (e.target.closest('[data-edit]')) editPoRule(r);
    if (e.target.closest('[data-del]') && await gconfirm(`Delete "${r.name}"?`)) { await api('/pofollow/rules/' + r.id, { method: 'DELETE' }); viewPoFollow(); }
    if (e.target.closest('[data-run]')) { const b = e.target.closest('[data-run]'); b.disabled = true; b.textContent = 'Sending…'; try { const x = await api(`/pofollow/rules/${r.id}/run`, { method: 'POST' }); toast(x.count ? 'Mail sent now' : x.note); } catch (err) { toast(err.message, true); } viewPoFollow(); }
  };
  $('.team').onchange = async e => { if (!e.target.closest('.switch')) return; const id = e.target.closest('[data-prid]').dataset.prid; await api('/pofollow/rules/' + id, { method: 'PATCH', body: { enabled: e.target.checked } }); toast(e.target.checked ? 'Reminder switched on' : 'Reminder paused'); };
  $('#pnew').onclick = () => editPoRule(null); $('#pbulk').onclick = () => bulkPo(d);
  $$('[data-undo]').forEach(b => b.onclick = async () => { if (!await gconfirm('Remove this PO? The DC goes back to the waiting list. (If it was also written into your Excel sheet, clear it there too.)')) return; try { await api('/pofollow/po/' + b.dataset.undo, { method: 'DELETE' }); viewPoFollow(); } catch (e) { toast(e.message, true); } });
}

function ruleCard(r) {
  const lr = r.lastRun;
  return `<div class="card person" data-prid="${r.id}"><div class="hd"><div class="avatar lg" style="background:var(--brand)">${ic('mail')}</div><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><span class="hint">${daysText(r.days)} at ${esc(r.time)}, ${esc(repText(r))}</span></div><label class="switch" title="On / paused"><input type="checkbox" ${r.enabled ? 'checked' : ''}><i></i></label></div>
    <div><div class="hint" style="font-weight:700;margin-bottom:6px">Mails ${r.pending} DC${r.pending === 1 ? '' : 's'} right now · ${MODES[r.mode || 'list'][0]}${r.mode !== 'each' ? ' · ' + [r.excel && 'Excel', r.pdf && 'PDF'].filter(Boolean).join(' + ') : ''}</div><div class="chips"><span class="pill violet">${esc(r.companies.length ? r.companies.join(', ') : 'All companies')}</span>${r.minDays ? `<span class="pill">waiting ${r.minDays}+ days</span>` : ''}</div></div>
    <div><div class="hint" style="font-weight:700;margin-bottom:6px">Sent to (the PO maker)</div><div class="chips">${r.recipients.map(x => `<span class="pill">${esc(x)}</span>`).join('')}${(r.cc || []).map(x => `<span class="pill violet">CC ${esc(x)}</span>`).join('')}</div></div>
    <div class="hint">${lr ? (lr.ok ? `<span class="pill green">Last: ${new Date(lr.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> ${esc(lr.note)}` : `<span class="pill red">Failed</span> ${esc(lr.note)}`) : 'Not sent yet'}</div>
    <div class="row" style="flex-wrap:wrap"><button class="btn sm primary" data-run="1">${ic('send')} Send now</button><button class="btn sm ghost" data-edit="1" style="margin-left:auto">${ic('edit')} Edit</button><button class="btn sm ghost danger" data-del="1">${ic('trash')}</button></div></div>`;
}

function editPoRule(r) {
  const d = S.po, x = r || { name: '', companies: [], recipients: [], cc: [], subject: '', message: '', time: '10:00', untilTime: '17:00', repeatHours: 3, days: [1, 2, 3, 4, 5, 6], pdf: true, excel: true, minDays: 0, mode: 'each', skipNoDocs: false };
  const cos = [...new Set([...d.companies, ...x.companies])];
  modal(`<h3>${r ? 'Edit' : 'New'} PO reminder</h3>
    <div class="field"><label>Name</label><input type="text" id="pn" value="${esc(x.name)}" placeholder="e.g. PO reminder to Purchase department"></div>
    <div class="field"><label>Which DCs? <span class="hint">(none ticked = every company)</span></label><div class="chips" id="pc">${cos.map(c => chk('c', c, c, x.companies.includes(c))).join('') || '<span class="hint">Companies appear once a sheet is loaded.</span>'}</div></div>
    <div class="field"><label>Only DCs waiting at least <span class="hint">(days since dispatch, 0 = all)</span></label><input type="number" id="pm" min="0" value="${esc(x.minDays)}" style="width:100px"></div>
    <div class="field"><label>Email of the person who makes the PO <span class="hint">(commas or new lines)</span></label><textarea id="pr" style="min-height:48px" placeholder="purchase@company.com">${esc(x.recipients.join(', '))}</textarea></div>
    <div class="field"><label>CC <span class="hint">(optional)</span></label><input type="text" id="pcc" value="${esc((x.cc || []).join(', '))}" placeholder="manager@company.com"></div>
    <div class="field"><label>Subject <span class="hint">({count}, {n} = reminder number, {date})</span></label><input type="text" id="ps" value="${esc(x.subject)}" placeholder="Kindly make the purchase order - {count} DC(s) dispatched without PO"></div>
    <div class="field"><label>Message <span class="hint">(empty = a polite default asking to make the purchase order)</span></label><textarea id="pmsg" style="min-height:64px">${esc(x.message)}</textarea></div>
    <div class="h3" style="margin-top:6px">When?</div>
    <div class="row" style="flex-wrap:wrap;gap:10px;margin-bottom:8px"><div><div class="hint">First mail at</div><input type="time" id="pt" value="${esc(x.time)}" style="width:auto"></div><div><div class="hint">Remind</div><select id="prh" style="width:auto">${REPEATS.map(([v, l]) => `<option value="${v}" ${+x.repeatHours === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div><div class="hint">Keep reminding until</div><input type="time" id="pu" value="${esc(x.untilTime)}" style="width:auto"></div></div>
    <div class="chips" id="pdy" style="margin-bottom:10px">${DAYS.map((n, i) => chk('d', i, n, x.days.includes(i))).join('')}</div>
    <div class="hint" style="margin-bottom:10px">The mail repeats on those days until the PO is added here (or typed in your Excel sheet). When no DC is left waiting, nothing is sent.</div>
    <div class="field"><label>What to send</label><select id="pmode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${(x.mode || 'list') === k ? 'selected' : ''}>${v[1]}</option>`).join('')}</select>
      <div class="hint" style="margin-top:6px">Per-DC mails carry that DC's copy and quotation (uploaded here, or taken from your sheet link columns / ERP address). At most 60 DC mails per run.</div>
      <label class="row" style="gap:8px;margin-top:8px;font-weight:500"><input type="checkbox" id="pskip" ${x.skipNoDocs ? 'checked' : ''} style="width:auto"> Skip DCs that have no DC / quotation file yet</label></div>
    <div class="field"><label>Attach to the list mail</label><div class="chips">${chk('f', 'excel', 'Excel (.xlsx)', x.excel).replace('name="f"', 'id="px"')}${chk('f', 'pdf', 'PDF', x.pdf).replace('name="f"', 'id="pp"')}</div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${r ? 'Save' : 'Create reminder'}</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '600px'; $('#cx', bg).onclick = close;
    const vals = (sel, n) => $$(`${sel} input[name=${n}]:checked`, bg).map(i => i.value);
    $('#sv', bg).onclick = async () => {
      const body = { name: $('#pn', bg).value, companies: vals('#pc', 'c'), minDays: $('#pm', bg).value, recipients: $('#pr', bg).value, cc: $('#pcc', bg).value, subject: $('#ps', bg).value, message: $('#pmsg', bg).value, time: $('#pt', bg).value, untilTime: $('#pu', bg).value, repeatHours: $('#prh', bg).value, days: vals('#pdy', 'd'), excel: $('#px', bg).checked, pdf: $('#pp', bg).checked, mode: $('#pmode', bg).value, skipNoDocs: $('#pskip', bg).checked };
      try { await api(r ? '/pofollow/rules/' + r.id : '/pofollow/rules', { method: r ? 'PUT' : 'POST', body }); close(); toast('Reminder saved'); viewPoFollow(); } catch (e) { toast(e.message, true); }
    };
  });
}

// Many POs at once: one line per DC, "DC no  PO no"
function bulkPo(d) {
  modal(`<h3>Add many POs</h3><p class="hint" style="margin:-8px 0 12px">One DC per line: the DC number, then the PO number (space, comma or tab between). Example:<br><code>44124 JS-71349</code></p>
    <div class="field"><label>Company <span class="hint">(needed only when two companies use the same DC numbers)</span></label><select id="bc"><option value="">Find the DC in any company</option>${[...new Set(d.pending.map(p => p.company))].map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="field"><textarea id="bt" style="min-height:160px;font-family:ui-monospace,monospace" placeholder="44124 JS-71349&#10;44125 JS-71340"></textarea></div><div id="br" class="hint"></div>
    <div class="acts"><button class="btn" id="cx">Close</button><button class="btn primary" id="sv">Save all</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = () => { close(); viewPoFollow(); };
    $('#sv', bg).onclick = async () => {
      const co = $('#bc', bg).value, items = []; const miss = [];
      for (const line of $('#bt', bg).value.split(/\n/)) {
        const m = /^\s*([^\s,;\t]+)[\s,;\t]+(\S.*?)\s*$/.exec(line); if (!m) continue;
        const hits = d.pending.filter(p => String(p.dc).toLowerCase() === m[1].toLowerCase() && (!co || p.company === co));
        if (hits.length === 1) items.push({ src: hits[0].src, dc: hits[0].dc, po: m[2] }); else miss.push(`${m[1]} (${hits.length ? 'in several companies: pick the company' : 'not waiting for a PO'})`);
      }
      if (!items.length) return toast(miss.length ? 'No matching DC. ' + miss.join('; ') : 'Type at least one line: DC no, then PO no', true);
      const b = $('#sv', bg); b.disabled = true;
      try { const r = await api('/pofollow/po/bulk', { method: 'POST', body: { items } }); $('#br', bg).innerHTML = `<b>${r.done}</b> saved${r.failed ? `, <span style="color:var(--red)">${r.failed} failed</span>: ${r.results.filter(x => !x.ok).map(x => esc(x.dc + ' – ' + x.error)).join('; ')}` : ''}${miss.length ? `<br>Skipped: ${esc(miss.join('; '))}` : ''}`; $('#cx', bg).textContent = 'Done'; if (!r.failed && !miss.length) { toast(`${r.done} POs saved`); close(); viewPoFollow(); } }
      catch (e) { toast(e.message, true); } b.disabled = false;
    };
  });
}

// ---------- DC & quotation documents ----------
const poFmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const QRE = /quot|qtn|estimate/i;
function docsCard(d) {
  const n = d.pending.length, withDc = d.pending.filter(p => p.docs && p.docs.dc).length, withQ = d.pending.filter(p => p.docs && p.docs.quote).length, e = d.erpDocs || {};
  return `<div class="card" id="dcard" style="padding:16px 18px;margin-bottom:16px">
    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-start"><div style="flex:1;min-width:240px"><b style="font-size:15px">${ic('up')} DC &amp; quotation files</b>
      <div class="hint" style="margin-top:3px">Each DC mail carries its DC copy and quotation. Upload them here, or let the app fetch them from your ERP / sheet links.</div></div>
      <button class="btn sm" id="dfetch" title="Fetch the missing DC / quotation files from the sheet link columns and the ERP address">${ic('down')} Get missing from ERP</button><button class="btn sm ghost" id="derp">${ic('edit')} ERP link${e.dcUrl || e.quoteUrl ? ' <span class="pill green">on</span>' : ''}</button></div>
    <label class="drop" id="ddrop" style="display:block;margin-top:12px;padding:16px"><input type="file" id="dfiles" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv" style="display:none"><b style="margin:0">Drop many files here, or click to choose</b>
      <span class="hint">The DC number in the file name picks the DC (e.g. <code>DC-44124.pdf</code>, <code>Quotation 44124.pdf</code>). A name with “quotation / qtn” is filed as the quotation.</span></label>
    <div id="dres" class="hint" style="margin-top:8px"></div>
    <div class="chips" style="margin-top:8px"><span class="pill ${withDc === n && n ? 'green' : ''}">DC file: ${withDc} of ${n}</span><span class="pill ${withQ === n && n ? 'green' : ''}">Quotation: ${withQ} of ${n}</span></div></div>`;
}
function bindDocsCard(d, P) {
  const drop = $('#ddrop'), inp = $('#dfiles'); if (!drop) return;
  const res = h => { const r = $('#dres'); if (r) r.innerHTML = h; };
  const go = async fl => {
    fl = [...fl]; if (!fl.length) return;
    const byDc = new Map(); for (const p of d.pending) { const k = String(p.dc).toLowerCase(); byDc.set(k, (byDc.get(k) || []).concat(p)); }
    const dcs = [...byDc.keys()].sort((a, b) => b.length - a.length), jobs = [], skip = [];
    for (const f of fl) {
      const base = f.name.replace(/\.[^.]+$/, '').toLowerCase(), hit = dcs.find(k => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(base));
      if (!hit) { skip.push(`${f.name} (no DC number in the name)`); continue; }
      const c = byDc.get(hit), p = c.length === 1 ? c[0] : (S.poCo && c.find(x => x.company === S.poCo)); if (!p) { skip.push(`${f.name} (DC ${hit} is in several companies: open the DC row instead)`); continue; }
      jobs.push({ f, p, kind: QRE.test(f.name) ? 'quote' : 'dc' });
    }
    let ok = 0, bad = []; res(`Uploading ${jobs.length} file${jobs.length === 1 ? '' : 's'}…`);
    const q = jobs.slice(); await Promise.all(Array.from({ length: Math.min(3, q.length) }, async () => { for (let j; (j = q.shift());) {
      try { await api(`/pofollow/docs?key=${encodeURIComponent(j.p.key)}&kind=${j.kind}&name=${encodeURIComponent(j.f.name)}`, { method: 'POST', raw: j.f }); j.p.docs = j.p.docs || { dc: 0, quote: 0 }; j.p.docs[j.kind]++; ok++; }
      catch (e) { bad.push(`${j.f.name}: ${e.message}`); } } }));
    poRender(d); res(`<b>${ok}</b> file${ok === 1 ? '' : 's'} saved${bad.length ? `<br><span style="color:var(--red)">Failed: ${esc(bad.join('; '))}</span>` : ''}${skip.length ? `<br>Not matched: ${esc(skip.join('; '))}` : ''}`);
  };
  inp.onchange = () => { go(inp.files); inp.value = ''; };
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => go(e.dataTransfer.files));
  $('#dfetch').onclick = async e => {
    const keys = P.filter(p => !p.docs || !p.docs.dc || !p.docs.quote).map(p => p.key); if (!keys.length) return toast('Every DC already has a DC and quotation file');
    const b = e.currentTarget; b.disabled = true; res(`Asking the ERP / sheet links for ${keys.length} DC${keys.length === 1 ? '' : 's'}…`);
    try { const r = await api('/pofollow/docs/fetch', { method: 'POST', body: { keys } }); toast(`${r.dc} DC + ${r.quote} quotation files fetched`); await viewPoFollow(); res(`Fetched <b>${r.dc}</b> DC and <b>${r.quote}</b> quotation file${r.quote === 1 ? '' : 's'}.${r.none ? ` ${r.none} DC${r.none === 1 ? '' : 's'} had nothing to fetch (set the ERP link, or upload by hand).` : ''}`); }
    catch (err) { toast(err.message, true); res(esc(err.message)); } b.disabled = false;
  };
  $('#derp').onclick = () => erpDocsModal(d);
}
function erpDocsModal(d) {
  const e = d.erpDocs || {};
  modal(`<h3>Get DC &amp; quotation from the ERP</h3><p class="hint" style="margin:-8px 0 12px">Type the address where your ERP serves the PDF. Use <code>{dc}</code>, <code>{branch}</code>, <code>{po}</code>, <code>{pr}</code>, <code>{company}</code> for the values of each DC. Columns of your Excel sheet whose title has “DC / challan / delivery” or “quotation” and holds a link are used automatically, too.</p>
    <div class="field"><label>DC copy address</label><input type="text" id="eu1" value="${esc(e.dcUrl || '')}" placeholder="https://erp.yourcompany.com/api/dc/{dc}/pdf"></div>
    <div class="field"><label>Quotation address</label><input type="text" id="eu2" value="${esc(e.quoteUrl || '')}" placeholder="https://erp.yourcompany.com/api/quotation/{dc}/pdf"></div>
    <div class="field"><label>Sign-in header <span class="hint">(optional, e.g. <code>Authorization: Bearer YOUR_KEY</code>)</span></label><input type="text" id="eh" value="${esc(e.header || '')}" autocomplete="off"></div>
    <label class="row" style="gap:8px;font-weight:500"><input type="checkbox" id="ea" ${e.auto !== false ? 'checked' : ''} style="width:auto"> Fetch automatically when a DC mail is sent and no file was uploaded</label>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => { try { d.erpDocs = await api('/pofollow/docs/settings', { method: 'PUT', body: { dcUrl: $('#eu1', bg).value, quoteUrl: $('#eu2', bg).value, header: $('#eh', bg).value, auto: $('#ea', bg).checked } }); close(); toast('ERP link saved'); poRender(d); } catch (err) { toast(err.message, true); } };
  });
}

// the DC and quotation of ONE DC: upload, see, remove, fetch from ERP, mail it
function docsModal(d, p) {
  const tok = encodeURIComponent(S.token); let docs = [];
  modal(`<h3>DC ${esc(p.dc)} · documents</h3><p class="hint" style="margin:-8px 0 10px">${esc(p.company)} · branch ${esc(p.branch)}</p>
    <div id="dm"></div><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm" id="dfe">${ic('down')} Get from ERP / sheet</button><button class="btn sm primary" id="dml" style="margin-left:auto">${ic('send')} Email this DC</button><button class="btn sm" id="cx">Close</button></div>`, (bg, close) => {
    const draw = () => {
      $('#dm', bg).innerHTML = ['dc', 'quote'].map(k => { const L = docs.filter(x => x.kind === k), name = k === 'dc' ? 'DC copy' : 'Quotation'; return `<div class="field"><label>${name}</label>
        ${L.map(x => `<div class="row" style="gap:8px;padding:5px 0;border-bottom:1px solid var(--line)"><a href="/api/pofollow/docs/${x.id}?token=${tok}" target="_blank" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name)}</a><span class="hint">${poFmtSize(x.size)}${x.via === 'erp' ? ' · from ERP' : ''}</span><button class="btn sm ghost danger" data-rm="${x.id}">${ic('trash')}</button></div>`).join('') || '<div class="hint">Nothing uploaded yet.</div>'}
        <label class="btn sm" style="margin-top:6px;display:inline-flex">${ic('up')} Upload ${name.toLowerCase()}<input type="file" data-up="${k}" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv" style="display:none"></label></div>`; }).join('');
    };
    const sync = () => { p.docs = { dc: docs.filter(x => x.kind === 'dc').length, quote: docs.filter(x => x.kind === 'quote').length }; };
    api('/pofollow/docs?key=' + encodeURIComponent(p.key)).then(r => { docs = r.docs; draw(); });
    const body = $('#dm', bg);
    body.onchange = async e => { const i = e.target.closest('[data-up]'); if (!i) return; const kind = i.dataset.up; for (const f of [...i.files]) { try { const r = await api(`/pofollow/docs?key=${encodeURIComponent(p.key)}&kind=${kind}&name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: f }); docs = r.docs; draw(); } catch (err) { toast(`${f.name}: ${err.message}`, true); } } sync(); };
    body.onclick = async e => { const b = e.target.closest('[data-rm]'); if (!b) return; try { await api('/pofollow/docs/' + b.dataset.rm, { method: 'DELETE' }); docs = docs.filter(x => x.id !== b.dataset.rm); sync(); draw(); } catch (err) { toast(err.message, true); } };
    $('#dfe', bg).onclick = async e => { const b = e.currentTarget; b.disabled = true; try { const r = await api('/pofollow/docs/fetch', { method: 'POST', body: { key: p.key } }); docs = r.docs || docs; sync(); draw(); toast(r.dc + r.quote ? `Fetched ${r.dc} DC + ${r.quote} quotation` : 'Nothing found. Set the ERP link, or upload by hand.', !(r.dc + r.quote)); } catch (err) { toast(err.message, true); } b.disabled = false; };
    $('#cx', bg).onclick = () => { close(); poRender(d); };
    $('#dml', bg).onclick = () => { close(); poRender(d); mailDcModal(d, p); };
  });
}
function mailDcModal(d, p) {
  const rule = d.rules.find(r => r.enabled && (!r.companies.length || r.companies.includes(p.company))), c = p.docs || { dc: 0, quote: 0 };
  modal(`<h3>Email DC ${esc(p.dc)}</h3><p class="hint" style="margin:-8px 0 12px">Branch ${esc(p.branch)} · ${esc(p.company)} · attached: <b>${c.dc} DC</b> and <b>${c.quote} quotation</b> file${c.quote === 1 ? '' : 's'}${c.dc || c.quote ? '' : ' (the app will try the ERP / sheet link first)'}.</p>
    <div class="field"><label>To <span class="hint">(the person who makes the PO)</span></label><input type="text" id="mt" value="${esc(rule ? rule.recipients.join(', ') : '')}" placeholder="purchase@company.com"></div>
    <div class="field"><label>CC <span class="hint">(optional)</span></label><input type="text" id="mc" value="${esc(rule ? (rule.cc || []).join(', ') : '')}"></div>
    <div class="field"><label>Message <span class="hint">(empty = polite default)</span></label><textarea id="mm" style="min-height:60px"></textarea></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${ic('send')} Send mail</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async e => { const b = e.currentTarget; b.disabled = true; b.textContent = 'Sending…';
      try { const r = await api('/pofollow/send-dc', { method: 'POST', body: { key: p.key, to: $('#mt', bg).value, cc: $('#mc', bg).value, note: $('#mm', bg).value } }); p.reminders = (p.reminders || 0) + 1; close(); toast(`Mail sent with ${r.docs} file${r.docs === 1 ? '' : 's'}`); poRender(d); }
      catch (err) { toast(err.message, true); b.disabled = false; b.innerHTML = `${ic('send')} Send mail`; } };
  });
}
