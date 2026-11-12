// Orders panel used by the Overview AND by Find PO / P.R: filters (member, company, day / week / month / year / from–to) and
// the three groups Dispatched · Self · Pending. One shared filter state, so what you pick on one screen is still there on the other.
const OD = { dp: { open: false, view: '', start: '', end: '', mode: 'day', yr: 0 }, collapsed: (() => { try { return localStorage.getItem('od_collapsed') === '1'; } catch { return false; } })(), agent: '', org: '', q: '', bill: '', backup: false, cls: '', period: 'all', from: '', to: '' };
const OD_CLS = { dispatched: ['Dispatched', 'Sent out: dispatched, shipped, delivered or already has a CN', 'var(--brand)'], self: ['Self', 'Collected by the customer or delivered by your own people', '#2563eb'], pending: ['Pending dispatch', 'Not sent yet: pending, confirmed, processing, packed, on hold', 'var(--amber)'] };
// the four boxes: [filter field, key, label, hint, colour]
const OD_KPI = [['cls', 'pending', 'Pending dispatch', 'Not sent yet: pending, confirmed, processing, packed, on hold', 'var(--amber)'], ['cls', 'dispatched', 'Dispatched', 'Sent out: dispatched, shipped, delivered or already has a CN', 'var(--brand)'], ['cls', 'self', 'Self', 'Collected by the customer or delivered by your own people', '#2563eb'], ['bill', 'billed', 'Billed in ERP', 'Billed / invoiced in the ERP', '#16a34a'], ['bill', 'remaining', 'Non billed', 'Not billed in ERP yet', '#e11d48']];
const OD_PERIODS = [['all', 'All time'], ['day', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];
let odSum = null, odHost = null, odMode = 'overview', odOnChange = null, odSeq = 0;

// the days (YYYY-MM-DD) the chosen period covers: day = today, week = last 7 days, month / year = this calendar month / year up to today
function odRange() {
  const t = ymd(), d = new Date();
  if (OD.period === 'day') return { from: t, to: t };
  if (OD.period === 'week') return { from: ymd(6), to: t };
  if (OD.period === 'month') return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: t };
  if (OD.period === 'year') return { from: `${d.getFullYear()}-01-01`, to: t };
  if (OD.period === 'custom') return { from: OD.from, to: OD.to };
  return { from: '', to: '' };
}
const odActive = () => !!(OD.agent || OD.org || OD.cls || OD.bill || OD.q || OD.period !== 'all');
// the filters as a query string for the server (Find PO list)
function odQuery() {
  const r = odRange(), q = new URLSearchParams();
  if (OD.org) q.set('org', OD.org); if (OD.agent) { q.set('agent', OD.agent); if (OD.backup) q.set('backup', '1'); } if (OD.cls) q.set('cls', OD.cls); if (OD.bill) q.set('bill', OD.bill);
  if (r.from) q.set('from', r.from); if (r.to) q.set('to', r.to);
  return q.toString();
}
function odClear() { Object.assign(OD, { agent: '', org: '', q: '', bill: '', backup: false, cls: '', period: 'all', from: '', to: '' }); }

async function odLoad() {
  const seq = ++odSeq, r = odRange();
  try { const d = await api('/orders/summary' + (r.from || r.to ? `?from=${r.from}&to=${r.to}` : '')); if (seq !== odSeq) return; odSum = d; } catch { odSum = odSum || { groups: [], undated: 0 }; }
  odDraw();
}
function odMount(sel, mode, onChange) { odHost = sel; odMode = mode; odOnChange = onChange || null; odDraw(); odLoad(); }

const OD_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const odD = v => { const [y, m, d] = String(v).split('-').map(Number); return `${String(d).padStart(2, '0')} ${OD_MON[m - 1].slice(0, 3)} ${y}`; };
const odIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const OD_PRE = [['all', 'All time'], ['day', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This year']];
function odPreset(k) {
  OD.from = OD.to = '';
  if (k === 'yesterday') Object.assign(OD, { period: 'custom', from: ymd(1), to: ymd(1) });
  else if (k === 'lastmonth') { const n = new Date(); Object.assign(OD, { period: 'custom', from: odIso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: odIso(new Date(n.getFullYear(), n.getMonth(), 0)) }); }
  else OD.period = k;
}
// the calendar part of the picker: days (default) · click the month name for a list of months · click the year for a list of years · From / To boxes
function odCal(y, m, cells, note, t, r) {
  const ty = +t.slice(0, 4), tm = +t.slice(5, 7), mode = OD.dp.mode || 'day', nav = (d, tt) => `<button type="button" class="ib sm" data-${d[0]}="${d[1]}" title="${tt}" ${d[2] ? 'disabled' : ''}>${d[1] < 0 ? '‹' : '›'}</button>`;
  if (mode === 'year') {
    const base = OD.dp.yr || Math.floor(y / 12) * 12;
    return `<div class="od-ch">${nav(['yp', -12, false], 'Earlier years')}<b>${base} – ${base + 11}</b>${nav(['yp', 12, base + 12 > ty], 'Later years')}</div>
      <div class="od-mg">${Array.from({ length: 12 }, (_, i) => base + i).map(v => `<button type="button" class="${v === y ? 'on' : ''} ${v === ty ? 'now' : ''}" data-yr="${v}" ${v > ty ? 'disabled' : ''}>${v}</button>`).join('')}</div>`;
  }
  if (mode === 'month') {
    return `<div class="od-ch">${nav(['yv', -1, false], 'Previous year')}<button type="button" class="od-hb" data-hy="1" title="Pick a year">${y}</button>${nav(['yv', 1, y + 1 > ty], 'Next year')}</div>
      <div class="od-mg">${OD_MON.map((n, i) => `<button type="button" class="${i + 1 === m ? 'on' : ''} ${y === ty && i + 1 === tm ? 'now' : ''}" data-mo="${i + 1}" ${y > ty || (y === ty && i + 1 > tm) ? 'disabled' : ''}>${n.slice(0, 3)}</button>`).join('')}</div>`;
  }
  return `<div class="od-ch"><button type="button" class="ib sm" data-mv="-1" title="Previous month">‹</button><span><button type="button" class="od-hb" data-hm="1" title="Pick a month">${OD_MON[m - 1]}</button> <button type="button" class="od-hb" data-hy="1" title="Pick a year">${y}</button></span><button type="button" class="ib sm" data-mv="1" title="Next month">›</button></div>
    <div class="od-cg">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(x => `<small>${x}</small>`).join('')}${cells}</div>
    <div class="od-ft"><label>From<input type="date" id="od_df" max="${t}" value="${esc(r.from || '')}"></label><label>To<input type="date" id="od_dt" max="${t}" value="${esc(r.to || '')}"></label></div>
    <div class="od-cn">${note}</div>`;
}
// a date-range button with a list of ready-made ranges and a calendar (replaces the browser's dd-mm-yyyy boxes)
function odPicker(label) {
  const r = odRange(), cur = OD.period === 'custom' ? ((OD.from === OD.to && OD.from === ymd(1)) ? 'yesterday' : 'custom') : OD.period;
  const btn = `<button class="btn sm od-dpb ${OD.period !== 'all' ? 'on' : ''}" id="od_dp" aria-expanded="${OD.dp.open}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>${esc(label)}</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
  if (!OD.dp.open) return `<div class="od-dp">${btn}</div>`;
  const [y, m] = (OD.dp.view || ymd().slice(0, 7)).split('-').map(Number), first = new Date(y, m - 1, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m, 0).getDate(), t = ymd(), st = OD.dp.start, en = OD.dp.end;
  const lo = st && en ? (st < en ? st : en) : st, hi = st && en ? (st < en ? en : st) : st;
  let cells = ''; for (let i = 0; i < lead; i++) cells += '<i></i>';
  for (let d = 1; d <= days; d++) { const v = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, inR = lo && v >= lo && v <= hi, edge = v === lo || v === hi, inCur = !st && r.from && v >= r.from && v <= (r.to || t); cells += `<button type="button" class="od-day ${inR || inCur ? 'in' : ''} ${edge ? 'edge' : ''} ${v === t ? 'today' : ''}" data-day="${v}" ${v > t ? 'disabled' : ''}>${d}</button>`; }
  const note = st && !en ? `From <b>${odD(st)}</b> — now pick the last day` : r.from || r.to ? `<b>${r.from ? odD(r.from) : '…'}</b> → <b>${r.to ? odD(r.to) : '…'}</b>` : 'Pick the first day, then the last day';
  return `<div class="od-dp">${btn}<div class="od-pop"><div class="od-pre">${OD_PRE.map(([k, l]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-pre="${k}">${l}</button>`).join('')}</div>
    <div class="od-cal">${odCal(y, m, cells, note, t, r)}</div></div></div>`;
}
if (!window.__odDoc) { window.__odDoc = 1; document.addEventListener('click', e => { if (OD.dp.open && !e.target.closest('.od-dp')) { OD.dp.open = false; odDraw(); } }); }

function odDraw() {
  const el = odHost && $(odHost); if (!el) return;
  const ad = isAdmin(), G = (odSum && odSum.groups) || [], ranged = odSum && odSum.ranged;
  const qn = OD.q.trim().toLowerCase(), qHit = qn && G.some(g => g.name.toLowerCase().includes(qn));   // a number typed in the search (PO / CN) is not a company: then every company stays listed
  const sel = G.filter(g => (!qHit || g.name.toLowerCase().includes(qn)) && (!OD.org || g.key === OD.org) && (!OD.agent || g.agentId === OD.agent || (OD.backup && g.backupAgentId === OD.agent)));
  const sum = gs => gs.reduce((a, g) => ({ total: a.total + g.total, dispatched: a.dispatched + g.c.dispatched, pending: a.pending + g.c.pending, self: a.self + g.c.self, billed: a.billed + (g.c.billed || 0), remaining: a.remaining + (g.c.remaining || 0), other: a.other + g.c.other }), { total: 0, dispatched: 0, pending: 0, self: 0, billed: 0, remaining: 0, other: 0 });
  const T = sum(sel), noDate = G.filter(g => g.noDate && (!OD.org || g.key === OD.org)).map(g => g.name), r = odRange();
  const pct = n => T.total ? Math.round(Math.max(0, n / T.total * 100)) : 0;
  const periodLabel = OD.period === 'all' ? 'All time' : OD.period === 'custom' ? `${OD.from || '…'} → ${OD.to || '…'}` : (OD_PERIODS.find(p => p[0] === OD.period) || [])[1] + (r.from === r.to ? ` (${r.from})` : ` (${r.from} → ${r.to})`);
  // PO = distinct PO numbers, DC = every DC (order row). Both follow the company / member / period / dispatch / billing filters.
  const xk = `${OD.cls}|${OD.bill}`, xs = (kind, k) => sel.reduce((a, g) => a + ((g.x && g.x[kind] && g.x[kind][k]) || 0), 0), PO = xs('po', xk), DC = xs('dc', xk);
  const DCs = { pending: xs('dc', 'pending|' + OD.bill), dispatched: xs('dc', 'dispatched|' + OD.bill), self: xs('dc', 'self|' + OD.bill) };
  const fl = [OD.cls ? (OD_CLS[OD.cls] || [OD.cls])[0] : '', OD.bill === 'billed' ? 'billed in ERP' : OD.bill === 'remaining' ? 'not billed' : ''].filter(Boolean).join(' · ');
  const pdTitle = odMode === 'find' ? 'Total PO: group the DCs under each PO number. Total DC: list every DC.' : 'Tap to open the list of these DCs in Find PO / P.R';
  const pdCards = `<button class="card kpi od-c ${odMode === 'find' && S.dcGroup === 'po' ? 'on' : ''}" data-pd="po" title="${esc(pdTitle)}" style="--c:#7c3aed;text-align:left;cursor:pointer"><div class="l">${ic('org')} Total PO</div><div class="v">${PO.toLocaleString()}</div><div class="s">${PO === 1 ? 'purchase order' : 'purchase orders'} · ${DC.toLocaleString()} DC${DC === 1 ? '' : 's'}${fl ? ' · ' + esc(fl) : ''}</div></button>
    <button class="card kpi od-c ${odMode === 'find' && S.dcGroup !== 'po' ? 'on' : ''}" data-pd="dc" title="${esc(pdTitle)}" style="--c:#0891b2;text-align:left;cursor:pointer"><div class="l">${ic('box')} Total DC</div><div class="v">${DC.toLocaleString()}</div><div class="s"><b style="color:var(--amber)">${DCs.pending.toLocaleString()}</b> pending · <b style="color:var(--brand)">${DCs.dispatched.toLocaleString()}</b> dispatched · <b style="color:#2563eb">${DCs.self.toLocaleString()}</b> self</div></button>`;
  const topX = document.getElementById('od_top_x'); if (topX) { topX.innerHTML = odSum ? pdCards : ''; topX.onclick = e => { const b = e.target.closest('[data-pd]'); if (b) { if (odMode === 'find') return dcGroupBy(b.dataset.pd); odGoFind(); } }; }
  const find = odMode === 'find', team = odMode === 'team', col = OD.collapsed;
  const card = ([f, k, l, hint, c]) => { const n = T[k], on = OD[f] === k; return `<button class="card kpi od-c ${on ? 'on' : ''}" data-kf="${f}" data-kv="${k}" title="${esc(hint)}" style="--c:${c};text-align:left;cursor:pointer"><div class="l"><i class="od-dot"></i>${l}</div><div class="v">${n.toLocaleString()}</div><div class="s">${T.total ? pct(n) + '% of ' + T.total.toLocaleString() + ' orders' : 'no orders'}${find ? (on ? ' · showing these' : ' · tap to list') : ' · tap to filter'}</div></button>`; };
  const num = (n, c) => `<td style="text-align:right;${n ? 'font-weight:700;' : 'color:var(--ink-3);'}${n && c ? 'color:' + c : ''}">${n.toLocaleString()}</td>`;
  const chips = gs => gs.length ? gs.map(g => `<button class="pill violet" data-og="${esc(g.key)}" style="cursor:pointer;border:0;margin:2px 4px 2px 0" title="Open ${esc(g.name)} in Company report">${esc(g.name)} · ${g.total}</button>`).join('') : '<span class="hint">no company assigned</span>';
  const keep = c => (!OD.cls || (c[OD.cls] || 0) > 0) && (!OD.bill || (c[OD.bill] || 0) > 0);
  const gx = (gs, kind) => gs.reduce((a, g) => a + ((g.x && g.x[kind] && g.x[kind][xk]) || 0), 0);
  const cs = gs => { const t = sum(gs); return { po: gx(gs, 'po'), dc: gx(gs, 'dc'), pending: t.pending, dispatched: t.dispatched, self: t.self, billed: t.billed, remaining: t.remaining }; };
  const trow = (left, gs) => { const c = cs(gs); return `<tr><td style="white-space:nowrap">${left}</td><td>${chips(gs)}</td>${num(c.po, '#7c3aed')}${num(c.dc, '#0891b2')}${num(c.pending, 'var(--amber)')}${num(c.dispatched, 'var(--brand)')}${num(c.self, '#2563eb')}${num(c.billed, '#16a34a')}${num(c.remaining, '#e11d48')}</tr>`; };
  const mrows = team ? (S.agents || []).map(a => ({ a, gs: sel.filter(g => g.agentId === a.id) })).filter(x => (x.gs.length || (!OD.org && !qHit)) && keep(cs(x.gs))) : [];
  const loose = team ? sel.filter(g => !g.agentId || !(S.agents || []).some(x => x.id === g.agentId)) : [];
  const teamTable = team ? `<div class="tbl-wrap" style="margin-top:14px;max-height:420px;border:1px solid var(--line)"><table class="tbl"><thead><tr><th>Member</th><th>Assigned companies</th><th style="text-align:right">PO</th><th style="text-align:right">DC</th><th style="text-align:right">Pending dispatch</th><th style="text-align:right">Dispatched</th><th style="text-align:right">Self</th><th style="text-align:right">Billed in ERP</th><th style="text-align:right">Non billed</th></tr></thead><tbody>
      ${mrows.map(x => trow(`<div class="row">${avatar(x.a, 'sm')}<b>${esc(x.a.name)}</b></div>`, x.gs)).join('')}${loose.length && keep(cs(loose)) ? trow('<span class="hint"><b>Not assigned</b></span>', loose) : ''}
      ${!mrows.length && !loose.length ? `<tr><td colspan="9"><div class="empty" style="padding:22px">No orders for these filters.</div></td></tr>` : ''}</tbody></table></div>` : '';
  const byCompany = [...sel].filter(g => g.total || !ranged).filter(g => find || ((!OD.cls || (g.c[OD.cls] || 0) > 0) && (!OD.bill || (g.c[OD.bill] || 0) > 0))).sort((a, b) => b.total - a.total);
  const chev = `<button class="ib od-tg" id="od_tg" title="${col ? 'Expand' : 'Minimize'}" aria-expanded="${!col}" style="transition:transform .2s;${col ? '' : 'transform:rotate(180deg)'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
  const mine = !ad ? `<div class="hint" style="margin-top:4px"><b>${T.total.toLocaleString()}</b> order${T.total === 1 ? '' : 's'} in <b>${sel.length}</b> compan${sel.length === 1 ? 'y' : 'ies'} you look after</div>` : '';
  const summ = col ? `<div class="hint" style="margin-top:2px">${OD_KPI.map(k => `${k[2]} <b>${T[k[1]].toLocaleString()}</b>`).join(' · ')}</div>` : `<div class="hint" style="margin-top:2px">Counted from the sheets and ERP connections of each company. The days are the <b>DC date / order date</b> written in each order.</div>
      ${noDate.length && ad ? `<div class="hint" style="margin-top:4px;color:var(--amber)">No DC date / order date column found in: ${noDate.map(esc).join(', ')} — these orders are left out when you pick a period. Open the company sheet → “Sheet &amp; columns” and pick it.</div>` : ''}
      ${odSum && odSum.undated && ranged && !noDate.length ? `<div class="hint" style="margin-top:4px">${odSum.undated.toLocaleString()} order${odSum.undated === 1 ? ' has' : 's have'} no date and ${odSum.undated === 1 ? 'is' : 'are'} not counted in this period.</div>` : ''}`;
  const tok = encodeURIComponent(S.token || ''), eq = [odQuery(), OD.q.trim().length >= 2 ? 'q=' + encodeURIComponent(OD.q.trim()) : ''].filter(Boolean).join('&');
  const exp = `<a class="btn sm" href="/api/orders/export?format=pdf&token=${tok}&${eq}" title="Download the DC list of these filters as a PDF">${ic('print')} PDF</a><a class="btn sm" href="/api/orders/export?format=xlsx&token=${tok}&${eq}" title="Download the DC list of these filters as an Excel file">${ic('box')} Excel</a><button class="btn sm primary" id="od_pr" title="Print the DC list of these filters, or save it as a PDF">${ic('print')} Print</button>`;
  const head = `<div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:${col ? 0 : 14}px"><div><div class="h3" style="margin:0">${team ? 'Team orders' : ad ? 'Orders' : 'My orders'} <span class="hint" style="font-weight:500">· ${esc(periodLabel)}</span></div>${mine}${summ}</div><div class="row" style="gap:8px;flex:none">${exp}${chev}</div></div>`;
  const body = col ? '' : `<div class="od-f">
      <label class="search od-q" style="min-width:230px;flex:1 1 230px;max-width:340px">${ic('search')}<input type="search" id="od_q" placeholder="${find ? 'Search company, PO, P.R, CN…' : 'Search company…'}" value="${esc(OD.q)}" autocomplete="off"></label>
      <select id="od_o" title="Company"><option value="">All companies</option>${[...G].sort((x, y) => x.name.localeCompare(y.name)).map(g => `<option value="${esc(g.key)}" ${OD.org === g.key ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <span class="od-sep"></span>
      ${odPicker(periodLabel)}
      <span class="od-sep"></span>
      <button class="btn sm" id="od_x" ${odActive() ? '' : 'disabled'} title="Show everything again">${ic('x')} Clear filters</button></div>
    ${find ? `<div class="od-f od-fs" style="margin-top:-4px"><span class="hint"><b>Filter</b></span>
      <div class="od-per" role="group" aria-label="Dispatch">${[['', 'All'], ['pending', 'Pending dispatch'], ['dispatched', 'Dispatched'], ['self', 'Self']].map(([k, l]) => `<button class="btn sm ${OD.cls === k ? 'primary' : ''}" data-fcls="${k}">${l}</button>`).join('')}</div>
      <span class="od-sep"></span>
      <div class="od-per" role="group" aria-label="ERP billing">${[['', 'Any billing'], ['billed', 'Billed in ERP'], ['remaining', 'Non billed']].map(([k, l]) => `<button class="btn sm ${OD.bill === k ? 'primary' : ''}" data-fbill="${k}">${l}</button>`).join('')}</div></div>` : ''}
    <div class="grid od-k" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${topX ? '' : (odSum ? pdCards : '')}${OD_KPI.map(card).join('')}</div>
    ${find ? '' : team ? teamTable : `<div class="tbl-wrap" style="margin-top:14px;max-height:340px;border:1px solid var(--line)"><table class="tbl"><thead><tr><th>Company</th>${ad ? '' : '<th style="text-align:right">Orders</th>'}<th style="text-align:right" title="Different PO numbers">PO</th><th style="text-align:right" title="Delivery challans">DC</th><th style="text-align:right">Pending dispatch</th><th style="text-align:right">Dispatched</th><th style="text-align:right">Self</th><th style="text-align:right">Billed in ERP</th><th style="text-align:right">Non billed</th></tr></thead><tbody>
      ${byCompany.map(g => `<tr class="od-row" data-og="${esc(g.key)}" style="cursor:pointer" title="Show ${esc(g.name)} in Company report"><td><a href="#find" class="od-co" data-pend="${esc(g.key)}" style="color:var(--brand);text-decoration:none" title="Open the pending DCs of ${esc(g.name)}"><b>${esc(g.name)}</b></a></td>${ad ? '' : num(g.total)}${num((g.x && g.x.po[xk]) || 0, '#7c3aed')}${num((g.x && g.x.dc[xk]) || 0, '#0891b2')}${num(g.c.pending, 'var(--amber)')}${num(g.c.dispatched, 'var(--brand)')}${num(g.c.self, '#2563eb')}${num(g.c.billed || 0, '#16a34a')}${num(g.c.remaining || 0, '#e11d48')}</tr>`).join('') || `<tr><td colspan="9"><div class="empty" style="padding:22px">No orders for these filters.</div></td></tr>`}
    </tbody></table></div>`}`;
  el.innerHTML = head + body;
  const changed = reload => { odDraw(); if (reload) odLoad(); if (odOnChange) odOnChange(); };
  const on = (id, fn) => { const e = $(id, el); if (e) e.onchange = fn; };
  const qi = $('#od_q', el); if (qi) qi.oninput = e => { OD.q = e.target.value; const pos = e.target.selectionStart; odDraw(); const n = $('#od_q', el); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } if (odOnChange) odOnChange(); };
  on('#od_o', e => { OD.org = e.target.value; changed(); });
  // typed / picked From and To dates
  const df = $('#od_df', el), dt = $('#od_dt', el);
  if (df && dt) { const apply = () => { let a = df.value, b = dt.value; if (!a && !b) return; if (a && b && b < a) [a, b] = [b, a]; Object.assign(OD, { period: 'custom', from: a, to: b }); OD.dp.open = false; changed(true); }; df.onchange = apply; dt.onchange = apply; }
  el.onclick = e => {
    { const b = e.target.closest('[data-pd]'); if (b) { if (odMode === 'find') return dcGroupBy(b.dataset.pd); return odGoFind(); } }
    if (e.target.closest('#od_pr')) return odPrint(periodLabel);
    if (e.target.closest('#od_tg')) { OD.collapsed = !OD.collapsed; try { localStorage.setItem('od_collapsed', OD.collapsed ? '1' : '0'); } catch {} return odDraw(); }
    const dpt = e.target.closest('#od_dp'); if (dpt) { OD.dp.open = !OD.dp.open; if (OD.dp.open) { OD.dp.mode = 'day'; OD.dp.start = OD.dp.end = ''; OD.dp.view = (OD.from || ymd()).slice(0, 7); } return odDraw(); }
    const pr = e.target.closest('[data-pre]'); if (pr) { odPreset(pr.dataset.pre); OD.dp.open = false; return changed(true); }
    const hm = e.target.closest('[data-hm]'); if (hm) { OD.dp.mode = 'month'; return odDraw(); }
    const hy = e.target.closest('[data-hy]'); if (hy) { OD.dp.mode = 'year'; OD.dp.yr = Math.floor(+OD.dp.view.slice(0, 4) / 12) * 12; return odDraw(); }
    const yp = e.target.closest('[data-yp]'); if (yp) { OD.dp.yr = (OD.dp.yr || Math.floor(+OD.dp.view.slice(0, 4) / 12) * 12) + +yp.dataset.yp; return odDraw(); }
    const yv = e.target.closest('[data-yv]'); if (yv) { OD.dp.view = `${+OD.dp.view.slice(0, 4) + +yv.dataset.yv}-${OD.dp.view.slice(5, 7)}`; return odDraw(); }
    const yr = e.target.closest('[data-yr]'); if (yr) { OD.dp.view = `${yr.dataset.yr}-${OD.dp.view.slice(5, 7)}`; OD.dp.mode = 'month'; return odDraw(); }
    const mo = e.target.closest('[data-mo]'); if (mo) { OD.dp.view = `${OD.dp.view.slice(0, 4)}-${String(mo.dataset.mo).padStart(2, '0')}`; OD.dp.mode = 'day'; return odDraw(); }
    const nv = e.target.closest('[data-mv]'); if (nv) { const [y, m] = OD.dp.view.split('-').map(Number), d = new Date(y, m - 1 + +nv.dataset.mv, 1); OD.dp.view = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return odDraw(); }
    const dy = e.target.closest('[data-day]'); if (dy) { const v = dy.dataset.day; if (!OD.dp.start || OD.dp.end) { OD.dp.start = v; OD.dp.end = ''; return odDraw(); } let a = OD.dp.start, b = v; if (b < a) [a, b] = [b, a]; Object.assign(OD, { period: 'custom', from: a, to: b }); OD.dp.open = false; return changed(true); }
    if (e.target.closest('.od-pop')) return;
    if (e.target.closest('#od_x')) { odClear(); return changed(true); }
    const pe = e.target.closest('[data-pend]'); if (pe) { e.preventDefault(); OD.org = pe.dataset.pend; OD.cls = 'pending'; OD.bill = ''; if (odMode === 'find') return changed(); return odGoFind(); }
    const fc = e.target.closest('[data-fcls]'); if (fc) { OD.cls = fc.dataset.fcls; return changed(); }
    const fb = e.target.closest('[data-fbill]'); if (fb) { OD.bill = fb.dataset.fbill; return changed(); }
    const k = e.target.closest('[data-kf]'); if (k) { const f = k.dataset.kf, v = k.dataset.kv; OD[f] = OD[f] === v ? '' : v; return changed(); }
    const og = e.target.closest('[data-og]'); if (og) { OD.org = og.dataset.og; if (odMode === 'find') return changed(); return odGoFind(); }
  };
}
// a clean report of the DCs matching the filters, opened in a new window with the print dialog (choose "Save as PDF" there)
async function odPrint(periodLabel) {
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups for this site to print', true);
  w.document.write('<p style="font:14px sans-serif;padding:24px">Preparing the report…</p>');
  try {
    const q = OD.q.trim(), r = await api('/track/search?q=' + encodeURIComponent(q.length >= 2 ? q : '') + '&' + odQuery() + '&all=1'), rs = r.results || [];
    const G = (odSum && odSum.groups) || [], co = OD.org ? (G.find(g => g.key === OD.org) || {}).name : '';
    const DL = { pending: 'Pending dispatch', dispatched: 'Dispatched', self: 'Self', other: 'Cancelled / returned' }, h = x => esc(x == null ? '' : x);
    const cnt = k => rs.filter(x => x.cls === k).length, billed = rs.filter(x => x.billed).length, poN = new Set(rs.map(x => String(x.po || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)).size;
    const bits = [['Company', co || 'All companies'], ['Period', periodLabel], ['Dispatch', DL[OD.cls] || 'All'], ['ERP billing', OD.bill === 'billed' ? 'Billed in ERP' : OD.bill === 'remaining' ? 'Non billed' : 'Any'], ...(q.length >= 2 ? [['Search', q]] : [])];
    const biz = (S.settings && S.settings.businessName) || 'Company report', now = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Company report - ${h(co || 'All companies')}</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px/1.4 "Segoe UI",Arial,sans-serif;color:#10201d;margin:0;padding:18px}
      .bar{background:#fff7d6;border:1px solid #e8d48a;padding:8px 12px;border-radius:8px;margin-bottom:14px;display:flex;gap:12px;align-items:center}.bar button{padding:6px 14px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;cursor:pointer}
      h1{font-size:22px;margin:0}.sub{color:#5b6b67;margin:2px 0 12px}.f{display:flex;flex-wrap:wrap;gap:6px 22px;margin-bottom:12px}.f span{color:#5b6b67}.f b{color:#10201d}
      .k{display:flex;gap:10px;margin-bottom:14px}.k div{flex:1;border:1px solid #d6dedb;border-radius:8px;padding:8px 12px}.k small{display:block;color:#5b6b67}.k b{font-size:18px}
      table{width:100%;border-collapse:collapse}th{background:#0f766e;color:#fff;text-align:left;padding:7px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}td{padding:6px 8px;border-bottom:1px solid #e3e9e7;vertical-align:top}
      tr{page-break-inside:avoid}thead{display:table-header-group}tbody tr:nth-child(even) td{background:#f6f9f8}.p{color:#b45309;font-weight:700}.s{color:#2563eb;font-weight:700}.d{color:#0f766e;font-weight:700}.b{color:#15803d;font-weight:700}.r{color:#be123c;font-weight:700}
      .ft{margin-top:12px;color:#5b6b67;font-size:11px}@media print{.bar{display:none}body{padding:0}}</style></head><body>
      <div class="bar"><span>Choose <b>Save as PDF</b> as the printer to get a PDF file.</span><button onclick="window.print()">Print / Save as PDF</button></div>
      <h1>Company report</h1><div class="sub">${h(biz)} · ${h(now)} · ${rs.length.toLocaleString()} DC${rs.length === 1 ? '' : 's'}</div>
      <div class="f">${bits.map(([k, v]) => `<div><span>${h(k)}:</span> <b>${h(v)}</b></div>`).join('')}</div>
      <div class="k"><div><small>Total PO</small><b>${poN}</b></div><div><small>Total DC</small><b>${rs.length}</b></div><div><small>Pending dispatch</small><b class="p">${cnt('pending')}</b></div><div><small>Dispatched</small><b class="d">${cnt('dispatched')}</b></div><div><small>Self</small><b class="s">${cnt('self')}</b></div><div><small>Billed in ERP</small><b class="b">${billed}</b></div><div><small>Non billed</small><b class="r">${rs.length - billed}</b></div></div>
      <table><thead><tr><th>#</th><th>PO no</th><th>P.R no</th><th>CN no</th><th>Company</th><th>Customer</th><th>Courier</th><th>Date</th><th>Dispatch</th><th>ERP billing</th><th>Status</th></tr></thead><tbody>
      ${rs.map((x, i) => `<tr><td>${i + 1}</td><td>${h(x.po || x.orderId)}</td><td>${h(x.pr)}</td><td>${h(x.cn)}</td><td>${h(x.organization || x.company)}</td><td>${h(x.customer)}</td><td>${h(x.courier)}</td><td>${h(x.day || x.updated)}</td><td class="${x.cls === 'pending' ? 'p' : x.cls === 'self' ? 's' : 'd'}">${h(DL[x.cls] || '')}</td><td class="${x.billed ? 'b' : 'r'}">${x.billed ? 'Billed in ERP' : 'Non billed'}</td><td>${h(x.status)}</td></tr>`).join('') || '<tr><td colspan="11" style="padding:20px;text-align:center;color:#5b6b67">No DCs match these filters.</td></tr>'}
      </tbody></table><div class="ft">Generated from WhatsApp Desk</div></body></html>`); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
  } catch (e) { try { w.close(); } catch {} toast(e.message, true); }
}
function odGoFind() { if (!isAdmin()) return odDraw();   // team members have no Company report: the choice just filters their own table
  S.view = 'find'; location.hash = 'find'; renderShell(); }
