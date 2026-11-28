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
  <div class="dr-layout">
    <div class="dr-side">
      <div class="card dr-panel">
        <div class="dr-ph"><i>${ic('chart')}</i>Report settings</div>
        <div class="field"><label>Day</label>
          <select id="dy-p"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="date">Pick a date…</option></select>
          <input type="date" id="dy-d" style="margin-top:8px;display:none" max="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>What do you want in the report?</label><div class="dr-picks">
          ${DY.sections.map(s => { const st = DY_STYLE[s.key] || ['#0f766e', 'chart']; return `<label class="dr-pick" style="--ac:${st[0]}"><input type="checkbox" class="dy-s" value="${s.key}"><span class="ic">${ic(st[1])}</span><span class="tx"><b>${esc(s.title)}</b><small>${esc(s.hint)}</small></span><span class="tick">${ic('check')}</span></label>`; }).join('')}</div></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="dy-go">Show report</button>
          <a class="btn" id="dy-pdf" href="#">PDF</a><a class="btn" id="dy-xls" href="#">Excel</a>
        </div>
        <div class="hint" style="margin-top:10px">Your choice is remembered, and the automatic e-mail uses the same sections.</div>
      </div>
      <div class="card dr-panel">
        <div class="dr-ph"><i>${ic('mail')}</i>E-mail the report</div>
        ${DY.mailReady ? '' : '<div class="notice" style="margin:0 0 12px;font-size:13px">E-mail is not set up yet. Open <b>Reports → Email settings</b> (or add a Gmail mailbox under Email) first.</div>'}
        <div class="field"><label>Send to <small class="hint">(one or more addresses)</small></label><input type="text" id="dy-to" value="${esc(a.recipients.join(', '))}" placeholder="you@yourcompany.com"></div>
        <label class="chk" style="margin:6px 0"><input type="checkbox" id="dy-fp" ${a.pdf ? 'checked' : ''}><span>Attach PDF</span></label>
        <label class="chk" style="margin:6px 0"><input type="checkbox" id="dy-fx" ${a.excel ? 'checked' : ''}><span>Attach Excel</span></label>
        <div class="row" style="gap:8px;margin:10px 0 14px"><button class="btn" id="dy-send">Send now</button></div>
        <hr class="dr-hr">
        <label class="chk"><input type="checkbox" id="dy-auto" ${a.enabled ? 'checked' : ''}><span><b>Send automatically every day</b></span></label>
        <div class="field" style="margin-top:10px"><label>Time</label><input type="time" id="dy-t" value="${esc(a.time)}"></div>
        <div class="row" style="gap:8px"><button class="btn primary" id="dy-save">Save e-mail settings</button></div>
        ${a.lastRun ? `<div class="hint" style="margin-top:10px">Last automatic e-mail: ${new Date(a.lastRun.ts).toLocaleString('en-GB')} — ${a.lastRun.ok ? '✓ ' : '⚠ '}${esc(a.lastRun.note)}</div>` : ''}
      </div>
    </div>
    <div class="dr-main" id="dy-out"><div class="card" style="padding:24px">Loading report…</div></div>
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
  if (DYSel.period === 'date' && !DYSel.date) { out.innerHTML = '<div class="card empty dr-blank"><div>Pick a date, then press <b>Show report</b>.</div></div>'; return; }
  if (!DYSel.sections.length) { out.innerHTML = '<div class="card empty dr-blank"><div>Tick at least one section on the left.</div></div>'; return; }
  if (DYBusy) return; DYBusy = true; out.innerHTML = '<div class="card" style="padding:24px">Building the report…</div>';
  try {
    api('/daily', { method: 'PUT', body: { sections: DYSel.sections, ...(DYSel.period !== 'date' ? { period: DYSel.period } : {}) } }).then(c => { if (DY) DY.cfg = { ...DY.cfg, ...c }; }).catch(() => {});
    const r = await api('/daily/report', { method: 'POST', body: dyBody() });
    out.innerHTML = dyRender(r); dyLinks();
  } catch (e) { out.innerHTML = `<div class="card" style="padding:24px">${esc(e.message)}</div>`; }
  DYBusy = false;
}

/* ---- report rendering: one consistent layout for every section ---- */
const DY_STYLE = {
  summary: ['#0f766e', 'chart'], dcalerts: ['#d97706', 'bolt'], questions: ['#2563eb', 'inbox'], tracking: ['#7c3aed', 'search'], followup: ['#d97706', 'mail'],
  handoffs: ['#dc2626', 'send'], team: ['#16a34a', 'team'], orgs: ['#4f46e5', 'org'], topics: ['#c026d3', 'bolt'],
};
const dyPill = (t, c) => `<span class="dr-pill ${c}">${esc(t)}</span>`;
function dyCell(col, v, i) {
  v = String(v ?? '');
  if (col === 'Answered by') return dyPill(v, v === 'AI' ? 'violet' : v === 'Menu bot' ? 'teal' : v === 'No reply yet' ? 'amber' : 'blue');
  if (col === 'Result') return dyPill(v, /^Found/.test(v) ? 'green' : 'red');
  if (col === 'Status now') return dyPill(v, v === 'Resolved' ? 'green' : v === 'Waiting' ? 'amber' : /^With/.test(v) ? 'blue' : 'violet');
  if (col === 'Assigned to') return /^Nobody/.test(v) || v === '(not assigned)' ? dyPill(v, 'red') : v ? esc(v) : '<span class="mute">—</span>';
  if (col === 'Waiting') return dyPill(v, 'amber');
  if (col === 'Customer') { const k = v.lastIndexOf(' · '); return k > 0 ? `<span class="nm">${esc(v.slice(0, k))}<span class="ph">${esc(v.slice(k + 3))}</span></span>` : `<span class="nm">${esc(v)}</span>`; }
  if (col === 'Time') return `<span class="tm">${esc(v)}</span>`;
  if (!v) return '<span class="mute">—</span>';
  return esc(v);
}
function dyTable(t) {
  const names = t.columns.map(c => c[0]);
  const isNum = names.map((n, i) => n !== 'Time' && t.rows.length && t.rows.every(r => /^(\d+(\.\d+)?|—)$/.test(String(r[i]).trim())));
  const wide = /^(Question|Answer|Customer's last message|Example|Reason)$/;
  return `${t.title ? `<div class="hint" style="margin:10px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:11px">${esc(t.title)}</div>` : ''}<div class="dr-tw"><table><thead><tr>${names.map((n, i) => `<th class="${isNum[i] || n === 'Waiting' ? 'c' : ''}">${esc(n)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((row, ri) => `<tr>${row.map((v, i) => {
    const n = names[i], cls = isNum[i] ? 'c num' : n === 'Waiting' || n === 'Result' || n === 'Answered by' || n === 'Status now' ? 'nw' : wide.test(n) ? 'wrap' : n === 'Time' ? 'nw' : '';
    const lk = t.links && t.links.col === i && t.links.rows[ri];
    return `<td class="${cls}">${lk ? `<button class="dr-lk" data-dclink='${esc(JSON.stringify(lk))}' title="Open these DCs in Company report">${esc(v)}</button>` : dyCell(n, v, i)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function dyRender(r) {
  const secs = r.sections;
  const hero = `<div class="dr-hero"><div class="biz">${esc(r.business || '')}</div><h2>${esc(r.title)}</h2><div class="when">${esc(r.label)}</div>
    <div class="gen">Generated ${new Date(r.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${secs.length} section${secs.length === 1 ? '' : 's'}</div>
    <div class="dr-toc">${secs.map((s, i) => `<a href="#dr-${esc(s.key)}" onclick="event.preventDefault();document.getElementById('dr-${esc(s.key)}').scrollIntoView({behavior:'smooth',block:'start'})"><b>${i + 1}</b>${esc(s.title)}</a>`).join('')}</div></div>`;
  return hero + secs.map((s, i) => {
    const [ac, icon] = DY_STYLE[s.key] || ['#0f766e', 'chart'];
    const tables = s.tables.filter(t => t.rows.length), rows = tables.reduce((a, t) => a + t.rows.length, 0);
    const has = s.cards.length || tables.length || s.lists.length;
    const badge = tables.length ? `<span class="dr-count">${rows} row${rows === 1 ? '' : 's'}</span>` : s.cards.length ? `<span class="dr-count">${s.cards.length} figures</span>` : '';
    const def = (DY && DY.sections.find(x => x.key === s.key)) || {};
    return `<section class="card dr-sec" id="dr-${esc(s.key)}" style="--ac:${ac}">
      <div class="dr-head"><div class="dr-num">${i + 1}</div><div class="t"><b>${ic(icon)} ${esc(s.title)}</b>${def.hint ? `<small>${esc(def.hint)}</small>` : ''}</div>${badge}</div>
      <div class="dr-body">
        ${s.note ? `<div class="dr-note">${esc(s.note)}</div>` : ''}
        ${s.cards.length ? `<div class="dr-kpis">${s.cards.map(c => `<div class="dr-kpi${c.link ? ' lk' : ''}"${c.link ? ` data-dclink='${esc(JSON.stringify(c.link))}' role="button" tabindex="0" title="Open these DCs in Company report"` : ''}><div class="l">${esc(c.label)}</div><div class="v">${esc(c.value)}</div>${c.sub ? `<div class="s">${esc(c.sub)}</div>` : ''}</div>`).join('')}</div>` : ''}
        ${tables.map(dyTable).join('')}
        ${s.lists.length ? `<div class="dr-lists">${s.lists.map(l => `<div class="dr-list"><b>${esc(l.title)}</b><ul>${l.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
        ${has ? '' : `<div class="dr-empty">${ic('check')}Nothing to show for this section in this period.</div>`}
      </div></section>`;
  }).join('');
}

// numbers marked with data-dclink open Company report already filtered (company + Pending dispatch + DC date up to the alert limit)
document.addEventListener('click', e => { const b = e.target.closest('[data-dclink]'); if (!b) return; try { const l = JSON.parse(b.dataset.dclink); window.dcaGo && l && window.dcaGo(l.org, l.to); } catch {} });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-dclink]')) { e.preventDefault(); e.target.click(); } });
