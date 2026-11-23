/* Daily report (admin): pick the sections + period, review what the bot / AI / team did, download PDF or Excel,
   e-mail it now, or have it e-mailed automatically at the end of the day. Loaded after app.js (viewDaily is called by renderView). */
let DY = null, DYSel = { period: 'today', date: '', sections: [] }, DYBusy = false;

async function viewDaily() {
  $('#main').innerHTML = `<div class="page">${pageHead('Daily report', 'Review what the bot, the AI and your team did. Tick the sections you want, choose the day, then view, download or e-mail it. It can also be e-mailed to you automatically at the end of every day.')}<div class="card" style="padding:24px">Loading…</div></div>`;
  try { DY = await api('/daily'); } catch (e) { $('#main').innerHTML = `<div class="page"><div class="card" style="padding:24px">${esc(e.message)}</div></div>`; return; }
  DYSel = { period: DY.cfg.period, date: '', sections: [...DY.cfg.sections] };
  dyDraw(); dyRun();
}

function dyDraw() {
  const c = DY.cfg, a = c.auto, tok = encodeURIComponent(S.token);
  $('#main').innerHTML = `<div class="page">${pageHead('Daily report', 'Review what the bot, the AI and your team did. Tick the sections you want, choose the day, then view, download or e-mail it. It can also be e-mailed to you automatically at the end of every day.')}
  <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:0 0 340px;max-width:100%;display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:18px">
        <div class="h3" style="margin-top:0">${ic('chart')} Report settings</div>
        <div class="field"><label>Day</label>
          <select id="dy-p"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="date">Pick a date…</option></select>
          <input type="date" id="dy-d" style="margin-top:8px;display:none" max="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>What do you want in the report?</label>
          ${DY.sections.map(s => `<label class="chk" style="align-items:flex-start;margin:7px 0"><input type="checkbox" class="dy-s" value="${s.key}"><span><b>${esc(s.title)}</b><br><small class="hint">${esc(s.hint)}</small></span></label>`).join('')}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="dy-go">Show report</button>
          <a class="btn" id="dy-pdf" href="#">PDF</a><a class="btn" id="dy-xls" href="#">Excel</a>
        </div>
        <div class="hint" style="margin-top:10px">Your choice is remembered, and the automatic e-mail uses the same sections.</div>
      </div>
      <div class="card" style="padding:18px">
        <div class="h3" style="margin-top:0">${ic('mail')} E-mail the report</div>
        ${DY.mailReady ? '' : '<div class="notice" style="margin:0 0 12px;font-size:13px">E-mail is not set up yet. Open <b>Reports → Email settings</b> (or add a Gmail mailbox under Email) first.</div>'}
        <div class="field"><label>Send to <small class="hint">(one or more addresses)</small></label><input type="text" id="dy-to" value="${esc(a.recipients.join(', '))}" placeholder="you@yourcompany.com"></div>
        <label class="chk" style="margin:6px 0"><input type="checkbox" id="dy-fp" ${a.pdf ? 'checked' : ''}><span>Attach PDF</span></label>
        <label class="chk" style="margin:6px 0"><input type="checkbox" id="dy-fx" ${a.excel ? 'checked' : ''}><span>Attach Excel</span></label>
        <div class="row" style="gap:8px;margin:10px 0 14px"><button class="btn" id="dy-send">Send now</button></div>
        <hr style="border:0;border-top:1px solid var(--line,#e4e9e7);margin:6px 0 14px">
        <label class="chk"><input type="checkbox" id="dy-auto" ${a.enabled ? 'checked' : ''}><span><b>Send automatically every day</b></span></label>
        <div class="field" style="margin-top:10px"><label>Time</label><input type="time" id="dy-t" value="${esc(a.time)}"></div>
        <div class="row" style="gap:8px"><button class="btn primary" id="dy-save">Save e-mail settings</button></div>
        ${a.lastRun ? `<div class="hint" style="margin-top:10px">Last automatic e-mail: ${new Date(a.lastRun.ts).toLocaleString('en-GB')} — ${a.lastRun.ok ? '✓ ' : '⚠ '}${esc(a.lastRun.note)}</div>` : ''}
      </div>
    </div>
    <div style="flex:1 1 520px;min-width:0" id="dy-out"><div class="card" style="padding:24px">Loading report…</div></div>
  </div></div>`;
  $('#dy-p').value = DYSel.period; $('#dy-d').value = DYSel.date; $('#dy-d').style.display = DYSel.period === 'date' ? '' : 'none';
  $$('.dy-s').forEach(x => { x.checked = DYSel.sections.includes(x.value); });
  const read = () => { DYSel.period = $('#dy-p').value; DYSel.date = $('#dy-d').value; DYSel.sections = $$('.dy-s').filter(x => x.checked).map(x => x.value); $('#dy-d').style.display = DYSel.period === 'date' ? '' : 'none'; dyLinks(); };
  $('#dy-p').onchange = () => { read(); if (DYSel.period !== 'date') dyRun(); };
  $('#dy-d').onchange = () => { read(); if (DYSel.date) dyRun(); };
  $$('.dy-s').forEach(x => x.onchange = read);
  $('#dy-go').onclick = () => { read(); dyRun(); };
  $('#dy-send').onclick = async e => {
    read(); const b = e.target; b.disabled = true; b.textContent = 'Sending…';
    try { const r = await api('/daily/send', { method: 'POST', body: { ...dyBody(), to: $('#dy-to').value, pdf: $('#dy-fp').checked, excel: $('#dy-fx').checked } }); toast(`Report sent to ${r.sent} address${r.sent === 1 ? '' : 'es'}`); }
    catch (err) { toast(err.message, true); }
    b.disabled = false; b.textContent = 'Send now';
  };
  $('#dy-save').onclick = async () => {
    read();
    try { DY.cfg = await api('/daily', { method: 'PUT', body: { sections: DYSel.sections, auto: { enabled: $('#dy-auto').checked, time: $('#dy-t').value, recipients: $('#dy-to').value, pdf: $('#dy-fp').checked, excel: $('#dy-fx').checked } } }); toast($('#dy-auto').checked ? 'Saved. The report will be e-mailed every day at ' + DY.cfg.auto.time : 'Saved'); dyDraw(); dyRun(); }
    catch (err) { toast(err.message, true); }
  };
  dyLinks();
}
const dyBody = () => ({ period: DYSel.period === 'date' ? undefined : DYSel.period, date: DYSel.period === 'date' ? DYSel.date : undefined, sections: DYSel.sections });
function dyLinks() {
  const tok = encodeURIComponent(S.token), b = dyBody(), q = f => `/api/daily/download?format=${f}&token=${tok}${b.period ? '&period=' + b.period : ''}${b.date ? '&date=' + b.date : ''}&sections=${(b.sections || []).join(',')}`;
  const p = $('#dy-pdf'), x = $('#dy-xls'); if (p) p.href = q('pdf'); if (x) x.href = q('xlsx');
}

async function dyRun() {
  const out = $('#dy-out'); if (!out) return;
  if (DYSel.period === 'date' && !DYSel.date) { out.innerHTML = '<div class="card empty" style="padding:40px"><div>Pick a date, then press <b>Show report</b>.</div></div>'; return; }
  if (!DYSel.sections.length) { out.innerHTML = '<div class="card empty" style="padding:40px"><div>Tick at least one section on the left.</div></div>'; return; }
  if (DYBusy) return; DYBusy = true; out.innerHTML = '<div class="card" style="padding:24px">Building the report…</div>';
  try {
    api('/daily', { method: 'PUT', body: { sections: DYSel.sections, ...(DYSel.period !== 'date' ? { period: DYSel.period } : {}) } }).then(c => { if (DY) DY.cfg = { ...DY.cfg, ...c }; }).catch(() => {});
    const r = await api('/daily/report', { method: 'POST', body: dyBody() });
    out.innerHTML = dyRender(r); dyLinks();
  } catch (e) { out.innerHTML = `<div class="card" style="padding:24px">${esc(e.message)}</div>`; }
  DYBusy = false;
}

const dyBy = v => { const col = v === 'AI' ? '#7c3aed' : v === 'Menu bot' ? '#0f766e' : v === 'No reply yet' ? '#c2410c' : '#1d4ed8'; return `<span style="font-weight:700;color:${col}">${esc(v)}</span>`; };
function dyRender(r) {
  return `<div class="card" style="padding:16px 20px;margin-bottom:14px"><div style="font-size:18px;font-weight:800">${esc(r.title)}</div><div class="hint">${esc(r.label)} · generated ${new Date(r.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div></div>` +
    r.sections.map(s => `<div class="card" style="padding:18px 20px;margin-bottom:14px"><div class="h3" style="margin-top:0">${esc(s.title)}</div>
      ${s.note ? `<div class="hint" style="margin-bottom:10px">${esc(s.note)}</div>` : ''}
      ${s.cards.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-bottom:12px">${s.cards.map(c => `<div class="card kpi" style="padding:14px 16px"><div class="l">${esc(c.label)}</div><div class="v" style="font-size:26px">${esc(c.value)}</div>${c.sub ? `<div class="s">${esc(c.sub)}</div>` : ''}</div>`).join('')}</div>` : ''}
      ${s.tables.filter(t => t.rows.length).map(t => `<div class="tbl-wrap" style="margin-bottom:10px"><table class="tbl"><thead><tr>${t.columns.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${t.rows.map(row => `<tr>${row.map((v, i) => `<td style="${/^(Question|Answer|Customer's last message|Example)$/.test(t.columns[i][0]) ? 'max-width:340px;white-space:normal;' : ''}">${t.columns[i][0] === 'Answered by' ? dyBy(String(v)) : esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}
      ${s.lists.map(l => `<div style="margin:8px 0"><b>${esc(l.title)}</b><ul style="margin:6px 0 0 18px;padding:0">${l.items.map(i => `<li style="margin:3px 0">${esc(i)}</li>`).join('')}</ul></div>`).join('')}
    </div>`).join('');
}
