/* Product analytics (admin): how every product performs, in one place.
   Data comes from the TrendSEO Pro plugin on the WordPress shop (2.5.0+): product page views, orders, revenue and conversion,
   Google Search Console impressions / clicks / CTR / position and search phrases, Google / YouTube / marketplace ranks,
   the TrendSEO score, and Facebook / Instagram / YouTube post performance (views, likes, comments, shares, saves, reach).
   Loaded after app.js (viewProdStats is called by renderView). Uses the connection saved in Social posting. */
let PS = null, PSD = 30, PSTab = 'overview', PSQ = '', PSF = '', PSSort = { k: 'revenue', dir: -1 }, PSOpen = new Set(), PSBusy = false, PSErr = '';
const psN = v => v == null ? '—' : Number(v).toLocaleString();
const psM = v => (PS ? PS.currency + ' ' : '') + Math.round(+v || 0).toLocaleString();
const psPct = v => v == null ? '—' : (Math.round(v * 10) / 10) + '%';
const psPos = v => v == null || v <= 0 ? '—' : (Math.round(v * 10) / 10).toString();
const psWhen = t => { if (!t) return 'never'; const d = (Date.now() - t) / 1000; return d < 90 ? 'just now' : d < 5400 ? Math.round(d / 60) + ' min ago' : d < 129600 ? Math.round(d / 3600) + ' h ago' : new Date(t).toLocaleDateString(); };
const PS_PLAT = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' };

// rank chip: positive = position, 0 = checked but not found, null = never checked
function psRank(r, none = 'Not in top 20') {
  if (r == null) return '<span class="pill">—</span>';
  if (r <= 0) return `<span class="pill red">${none}</span>`;
  const c = r <= 3 ? 'green' : r <= 10 ? 'blue' : r <= 20 ? 'amber' : '';
  return `<span class="pill ${c}">#${Math.round(r * 10) / 10}</span>`;
}
function psTrend(now, prev) {
  if (now == null || prev == null || !(now > 0) || !(prev > 0)) return '';
  const d = prev - now; if (Math.abs(d) < 0.4) return '';
  return d > 0 ? ` <b style="color:var(--brand);font-size:11px">▲ ${Math.round(d * 10) / 10}</b>` : ` <b style="color:var(--red);font-size:11px">▼ ${Math.round(-d * 10) / 10}</b>`;
}
function psScore(sc) {
  if (sc == null) return '<span class="pill">—</span>';
  return `<span class="pill ${sc >= 80 ? 'green' : sc >= 50 ? 'amber' : 'red'}">${sc}</span>`;
}

// small inline SVG line/area chart: pts = [[label, value]]
function psChart(pts, color = 'var(--brand)', fmt = psN) {
  if (!pts || !pts.length) return '<div class="hint" style="padding:30px 0;text-align:center">No data in this period yet.</div>';
  const W = 640, H = 170, L = 42, R = 10, T = 12, B = 24, max = Math.max(1, ...pts.map(p => p[1])), n = pts.length;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / max);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${(y(max * f) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--ink-3)">${fmt(Math.round(max * f))}</text>`).join('');
  const lab = i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="10" fill="var(--ink-3)">${esc(String(pts[i][0]).slice(5))}</text>`;
  const dots = n <= 45 ? pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="3" fill="${color}"><title>${esc(p[0])}: ${fmt(p[1])}</title></circle>`).join('') : pts.map((p, i) => `<rect x="${(x(i) - 4).toFixed(1)}" y="${T}" width="8" height="${H - T - B}" fill="transparent"><title>${esc(p[0])}: ${fmt(p[1])}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img">${grid}<path d="${area}" fill="${color}" opacity=".12"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${lab(0)}${n > 2 ? lab(Math.floor((n - 1) / 2)) : ''}${n > 1 ? lab(n - 1) : ''}</svg>`;
}
const psBars = (rows, color) => { // rows = [[label, value, sub]]
  const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.length ? rows.map(r => `<div style="margin:9px 0"><div class="row" style="justify-content:space-between;gap:10px;font-size:13px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">${esc(r[0])}</span><span style="color:var(--ink-2);white-space:nowrap">${esc(r[2])}</span></div><div style="height:7px;background:var(--slate-soft);border-radius:9px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${Math.max(2, 100 * r[1] / max)}%;background:${color};border-radius:9px"></div></div></div>`).join('') : '<div class="hint">Nothing to show yet.</div>';
};
const psKpi = (icn, label, val, sub, c) => `<div class="card kpi" style="--c:${c}"><div class="l">${ic(icn)} ${label}</div><div class="v">${val}</div><div class="s">${sub}</div></div>`;

async function viewProdStats() {
  $('#main').innerHTML = `<div class="page">${pageHead('Product analytics', 'Track every product in one place: page views, orders and revenue, Google Search Console, Google / YouTube / marketplace rankings, the TrendSEO score and how each social post performed.', `<div class="seg" id="ps-days">${[7, 30, 90].map(d => `<button data-d="${d}" class="${PSD === d ? 'on' : ''}">${d} days</button>`).join('')}</div><button class="btn" id="ps-csv">${ic('down')} Export CSV</button><button class="btn primary" id="ps-ref">${ic('bolt')} Refresh</button>`)}<div id="ps-body"><div class="hint">Loading…</div></div></div>`;
  $('#ps-days').onclick = e => { const b = e.target.closest('button'); if (!b) return; PSD = +b.dataset.d; $$('#ps-days button').forEach(x => x.classList.toggle('on', x === b)); psLoad(false); };
  $('#ps-ref').onclick = psRefresh; $('#ps-csv').onclick = psCsv;
  psLoad(false);
}
async function psLoad(refresh) {
  if (!PS) $('#ps-body').innerHTML = '<div class="hint">Reading the numbers from your shop…</div>';
  try { PS = await api(`/social/analytics?days=${PSD}${refresh ? '&refresh=1' : ''}`); PSErr = PS.error || ''; }
  catch (e) { PSErr = e.message; if (!PS) { $('#ps-body').innerHTML = `<div class="card pad"><div class="h3">Product analytics is not connected yet</div><div class="hint" style="margin:6px 0 12px">${esc(e.message)}</div><button class="btn primary" onclick="S.view='social';location.hash='social';renderShell()">${ic('send')} Open Social posting → Connection</button></div>`; return; } }
  psDraw();
}
async function psRefresh() {
  if (PSBusy) return; PSBusy = true; const b = $('#ps-ref'); b.disabled = true; b.innerHTML = 'Refreshing… (can take a minute)';
  try { PS = await api(`/social/analytics/refresh?days=${PSD}`, { method: 'POST', body: {} }); PSErr = ''; toast(`Fresh numbers read from your shop${PS.updated != null ? ` · ${PS.updated} social post(s) updated` : ''}`); }
  catch (e) { toast(e.message, true); PSErr = e.message; }
  PSBusy = false; if (S.view === 'prodstats') { const r = $('#ps-ref'); if (r) { r.disabled = false; r.innerHTML = `${ic('bolt')} Refresh`; } if (PS) psDraw(); }
}
function psDraw() {
  if (S.view !== 'prodstats' || !PS) return;
  const tabs = [['overview', 'Overview'], ['products', 'Products'], ['search', 'Google Search'], ['social', 'Social posts']];
  let warn = '';
  if (PSErr) warn += `<div class="notice" style="margin:0 0 12px">${esc(PSErr)}${PS.stale ? ' — showing the last saved numbers.' : ''}</div>`;
  if (!PS.orders_ok) warn += '<div class="notice" style="margin:0 0 12px">WooCommerce order analytics tables were not found on the shop, so orders and revenue show 0. Open WooCommerce → Analytics once to build them.</div>';
  if (!PS.gsc_ok) warn += `<div class="notice" style="margin:0 0 12px">Google Search Console is not connected${PS.gsc_error ? ' (' + esc(PS.gsc_error) + ')' : ''}. In WordPress open <b>TrendSEO Pro → Google Connect &amp; Auto-SEO</b> and connect it to see impressions, clicks and search phrases here.</div>`;
  $('#ps-body').innerHTML = `${warn}<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px"><div class="seg" id="ps-tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${PSTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="hint">Last ${PS.days} days · shop data read ${psWhen(PS.cachedAt)}${PS.stale ? ' (saved copy)' : ''}</span></div><div id="ps-pane"></div>`;
  $('#ps-tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; PSTab = b.dataset.t; psDraw(); };
  ({ overview: psOverview, products: psProducts, search: psSearch, social: psSocial }[PSTab])();
}

// ---------- overview ----------
function psOverview() {
  const T = PS.totals, P = PS.products, S_ = PS.search, seo = PS.seo;
  const ctr = T.impr ? Math.round(1000 * T.clicks / T.impr) / 10 : null;
  const top = (k, n = 6, f = x => x) => [...P].sort((a, b) => b[k] - a[k]).filter(p => p[k] > 0).slice(0, n).map(p => [p.name, p[k], f(p[k])]);
  const best = [...P].filter(p => p.gsc && p.gsc.impr > 0).sort((a, b) => b.gsc.clicks - a.gsc.clicks || b.gsc.impr - a.gsc.impr).slice(0, 6).map(p => [p.name, p.gsc.clicks || p.gsc.impr / 1000, `${psN(p.gsc.clicks)} clicks · ${psN(p.gsc.impr)} impr.`]);
  const sp = PS.social.platforms, spk = Object.keys(sp);
  $('#ps-pane').innerHTML = `<div class="grid g4" style="margin-bottom:16px">
    ${psKpi('shop', 'Product views', psN(T.views), `${psN(P.length)} products`, '#0891b2')}
    ${psKpi('box', 'Orders', psN(T.orders), `${psN(T.units)} units sold`, '#7c3aed')}
    ${psKpi('chart', 'Revenue', psM(T.rev), `conversion ${psPct(T.conv)}`, '#188038')}
    ${psKpi('search', 'Google impressions', PS.gsc_ok ? psN(T.impr) : '—', PS.gsc_ok ? `${psN(T.clicks)} clicks · CTR ${psPct(ctr)}` : 'Search Console not connected', '#1d4ed8')}
  </div>
  <div class="grid g2" style="margin-bottom:16px;align-items:start">
    <div class="card pad"><div class="h3">Product page views per day</div>${psChart(PS.daily_views.map(d => [d[0], d[1]]), '#0891b2')}<div class="hint" style="margin-top:6px">Real visitors only (bots and shop staff are ignored). Counted since TrendSEO Pro analytics was activated.</div></div>
    <div class="card pad"><div class="h3">Google clicks per day</div>${S_ ? psChart(S_.daily.map(d => [d[0], d[1]]), '#1d4ed8') : '<div class="hint" style="padding:30px 0;text-align:center">Connect Google Search Console in TrendSEO Pro to see this.</div>'}<div class="hint" style="margin-top:6px">${S_ ? `Average position ${psPos(S_.totals.position)} · CTR ${psPct(S_.totals.ctr)}` : ''}</div></div>
  </div>
  <div class="grid g3" style="margin-bottom:16px;align-items:start">
    <div class="card pad"><div class="h3">Top by revenue</div>${psBars(top('revenue', 6, psM), '#188038')}</div>
    <div class="card pad"><div class="h3">Most viewed</div>${psBars(top('views', 6, v => psN(v) + ' views'), '#0891b2')}</div>
    <div class="card pad"><div class="h3">Best in Google search</div>${PS.gsc_ok ? psBars(best, '#1d4ed8') : '<div class="hint">Search Console not connected.</div>'}</div>
  </div>
  <div class="grid g2" style="align-items:start">
    <div class="card pad"><div class="h3">TrendSEO health</div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><span class="pill green">Good (80+): ${seo.good}</span><span class="pill amber">Needs work: ${seo.work}</span><span class="pill red">Poor (&lt;50): ${seo.poor}</span><span class="pill">Not scored: ${seo.none}</span><span class="pill violet">Optimized by plugin: ${seo.optimized}</span></div>
      <div class="hint" style="margin-top:10px">${P.filter(p => p.kw_pos > 0 && p.kw_pos <= 10).length} products rank on Google page 1 for their main keyword · ${P.filter(p => p.kw_pos === 0).length} are not in the top 20 · ${P.filter(p => p.video).length} have a product video.</div>
      <div style="margin-top:10px"><button class="btn sm" id="ps-low">Show products that need SEO work</button></div></div>
    <div class="card pad"><div class="h3">Social post performance</div>${spk.length ? spk.map(k => { const v = sp[k]; return `<div style="margin:9px 0"><b>${esc(PS_PLAT[k] || k)}</b> <span class="hint">${v.posts} posts</span><div class="hint" style="margin-top:2px">Views ${psN(v.views)} · Likes ${psN(v.likes)} · Comments ${psN(v.comments)} · Shares ${psN(v.shares)} · Saves ${psN(v.saves)} · Reach ${psN(v.reach)}</div></div>`; }).join('') : '<div class="hint">No posts measured yet. Posts made from Social posting appear here after the shop reads their numbers (press Refresh).</div>'}</div>
  </div>`;
  $('#ps-low').onclick = () => { PSTab = 'products'; PSF = 'lowseo'; psDraw(); };
}

// ---------- products ----------
const PS_COLS = [
  ['name', 'Product', p => p.name.toLowerCase()], ['views', 'Views', p => p.views], ['orders', 'Orders', p => p.orders], ['revenue', 'Revenue', p => p.revenue], ['conv', 'Conv.', p => p.conv],
  ['impr', 'G. impr.', p => p.gsc ? p.gsc.impr : -1], ['clicks', 'G. clicks', p => p.gsc ? p.gsc.clicks : -1], ['ctr', 'CTR', p => p.gsc ? p.gsc.ctr : -1], ['pos', 'Avg pos.', p => p.gsc && p.gsc.pos > 0 ? -p.gsc.pos : -999],
  ['kw', 'Main keyword rank', p => p.kw_pos == null ? -999 : p.kw_pos === 0 ? -500 : -p.kw_pos], ['yt', 'YouTube', p => p.youtube == null ? -999 : p.youtube === 0 ? -500 : -p.youtube], ['score', 'SEO', p => p.score == null ? -1 : p.score], ['soc', 'Social views', p => p.social ? p.social.views : -1],
];
const PS_FILT = [['', 'All'], ['selling', 'Selling'], ['nosales', 'Views but no sales'], ['p1', 'Google page 1'], ['norank', 'Not ranking'], ['lowseo', 'Low SEO score'], ['social', 'Has social posts']];
function psRows() {
  const q = PSQ.trim().toLowerCase(), col = PS_COLS.find(c => c[0] === PSSort.k) || PS_COLS[3];
  let r = PS.products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.keyword || '').toLowerCase().includes(q)) && ({
    '': true, selling: p.orders > 0, nosales: p.views > 0 && !p.orders, p1: p.kw_pos > 0 && p.kw_pos <= 10, norank: p.kw_pos === 0 || (p.kw_pos == null && p.google === 0), lowseo: p.score != null && p.score < 50, social: !!p.social,
  }[PSF]));
  return r.sort((a, b) => { const x = col[2](a), y = col[2](b); return (x < y ? -1 : x > y ? 1 : 0) * PSSort.dir; });
}
function psProducts() {
  $('#ps-pane').innerHTML = `<div class="card pad" style="margin-bottom:12px"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><input type="text" id="ps-q" placeholder="Search product or keyword…" value="${esc(PSQ)}" style="min-width:230px;flex:1"><div class="chips">${PS_FILT.map(([k, l]) => `<button class="btn sm ${PSF === k ? 'primary' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div></div>
  <div class="card"><div class="tbl-wrap"><table class="tbl" id="ps-tbl"><thead><tr>${PS_COLS.map(c => `<th data-k="${c[0]}" style="cursor:pointer">${c[1]}${PSSort.k === c[0] ? (PSSort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}</tr></thead><tbody id="ps-tb"></tbody></table></div></div>`;
  $('#ps-q').oninput = e => { PSQ = e.target.value; psTbody(); };
  $('#ps-pane').querySelector('.chips').onclick = e => { const b = e.target.closest('button'); if (!b) return; PSF = b.dataset.f; psProducts(); };
  $('#ps-tbl thead').onclick = e => { const th = e.target.closest('th'); if (!th) return; const k = th.dataset.k; PSSort = { k, dir: PSSort.k === k ? -PSSort.dir : (k === 'name' ? 1 : -1) }; psProducts(); };
  $('#ps-tb').onclick = e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (!tr) return; const id = +tr.dataset.id; PSOpen.has(id) ? PSOpen.delete(id) : PSOpen.add(id); psTbody(); };
  psTbody();
}
function psDetail(p) {
  const mk = Object.values(p.market || {}), s = p.social;
  return `<tr class="ps-det"><td colspan="${PS_COLS.length}" style="background:var(--surface-2)"><div class="grid g3" style="align-items:start">
    <div><div class="h3" style="font-size:13px">Google search phrases</div>${p.phrases && p.phrases.length ? `<table class="tbl" style="font-size:12.5px"><thead><tr><th>Phrase</th><th>Impr.</th><th>Clicks</th><th>Pos.</th></tr></thead><tbody>${p.phrases.map(q => `<tr><td>${esc(q.q)}</td><td>${psN(q.impr)}</td><td>${psN(q.clicks)}</td><td>${psPos(q.pos)}</td></tr>`).join('')}</tbody></table>` : '<div class="hint">No phrases yet (Search Console shows them after Google has displayed this page).</div>'}</div>
    <div><div class="h3" style="font-size:13px">Rankings &amp; SEO</div><div class="hint" style="line-height:1.9">Main keyword: <b>${esc(p.keyword || '—')}</b> ${p.kw_count ? `<span class="hint">(+${p.kw_count - 1} more in its keyword set)</span>` : ''}<br>Google (Search Console / check): ${psRank(p.kw_pos)}${psTrend(p.kw_pos, p.kw_prev)}<br>Google (Rank #1 Booster): ${psRank(p.google)}<br>YouTube: ${psRank(p.youtube, 'Not found')}<br>${mk.length ? mk.map(m => `${esc(m.label)}: ${psRank(m.rank, 'Not found')}`).join('<br>') : 'Marketplaces: not checked yet'}<br>TrendSEO score: ${psScore(p.score)} ${p.optimized ? '<span class="pill violet">Optimized by plugin</span>' : ''} ${p.video ? '<span class="pill green">Has video</span>' : '<span class="pill">No video</span>'}</div></div>
    <div><div class="h3" style="font-size:13px">Social posts</div>${s ? `<div class="hint" style="line-height:1.9">${s.posts} post(s) · Views ${psN(s.views)} · Likes ${psN(s.likes)}<br>Comments ${psN(s.comments)} · Shares ${psN(s.shares)} · Saves ${psN(s.saves)} · Reach ${psN(s.reach)}</div>` : '<div class="hint">Not posted to Facebook / Instagram / YouTube in the last 90 days.</div>'}
      <div style="margin-top:8px"><a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">Open product page</a></div></div>
  </div></td></tr>`;
}
function psTbody() {
  const rows = psRows(); $('#ps-tb').innerHTML = rows.map(p => `<tr data-id="${p.id}" style="cursor:pointer">
    <td style="min-width:240px"><div class="row" style="gap:10px;align-items:center">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex:none">` : '<div style="width:38px;height:38px;border-radius:8px;background:var(--slate-soft);flex:none"></div>'}<div><b style="font-weight:700">${esc(p.name)}</b><br><small class="hint">${esc(p.price)}${p.stock && p.stock !== 'instock' ? ` · <span style="color:var(--red)">${esc(p.stock)}</span>` : ''}</small></div></div></td>
    <td>${psN(p.views)}</td><td>${psN(p.orders)}</td><td>${p.revenue ? psM(p.revenue) : '—'}</td><td>${p.views ? psPct(p.conv) : '—'}</td>
    <td>${p.gsc ? psN(p.gsc.impr) : '—'}</td><td>${p.gsc ? psN(p.gsc.clicks) : '—'}</td><td>${p.gsc && p.gsc.impr ? psPct(p.gsc.ctr) : '—'}</td><td>${p.gsc && p.gsc.pos > 0 ? psPos(p.gsc.pos) : '—'}</td>
    <td>${psRank(p.kw_pos)}${psTrend(p.kw_pos, p.kw_prev)}<br><small class="hint">${esc(p.keyword || '')}</small></td><td>${psRank(p.youtube, 'Not found')}</td><td>${psScore(p.score)}</td><td>${p.social ? psN(p.social.views) + `<br><small class="hint">${p.social.posts} post${p.social.posts === 1 ? '' : 's'}</small>` : '—'}</td></tr>${PSOpen.has(p.id) ? psDetail(p) : ''}`).join('') || `<tr><td colspan="${PS_COLS.length}" class="hint" style="padding:26px;text-align:center">No products match.</td></tr>`;
}

// ---------- Google search ----------
function psSearch() {
  const S_ = PS.search;
  if (!S_) { $('#ps-pane').innerHTML = `<div class="card pad"><div class="h3">Google Search Console</div><div class="hint" style="margin-top:6px">Not connected. In WordPress open <b>TrendSEO Pro → Google Connect &amp; Auto-SEO</b> and sign in with Google. After that this tab shows your impressions, clicks, CTR, average position, the phrases people search and how each product page performs.</div></div>`; return; }
  const T = S_.totals, pages = [...PS.products].filter(p => p.gsc && p.gsc.impr > 0).sort((a, b) => b.gsc.impr - a.gsc.impr).slice(0, 25);
  $('#ps-pane').innerHTML = `<div class="grid g4" style="margin-bottom:16px">${psKpi('search', 'Impressions', psN(T.impressions), 'times your shop appeared in Google', '#1d4ed8')}${psKpi('check', 'Clicks', psN(T.clicks), 'visits from Google', '#188038')}${psKpi('chart', 'CTR', psPct(T.ctr), 'clicks ÷ impressions', '#7c3aed')}${psKpi('up', 'Average position', psPos(T.position), 'lower is better', '#b45309')}</div>
  <div class="grid g2" style="margin-bottom:16px;align-items:start"><div class="card pad"><div class="h3">Impressions per day</div>${psChart(S_.daily.map(d => [d[0], d[2]]), '#1d4ed8')}</div><div class="card pad"><div class="h3">Clicks per day</div>${psChart(S_.daily.map(d => [d[0], d[1]]), '#188038')}</div></div>
  <div class="grid g2" style="align-items:start">
    <div class="card"><div class="h3" style="padding:16px 18px 0">Top search phrases</div><div class="tbl-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th>Phrase</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th></tr></thead><tbody>${S_.queries.map(q => `<tr><td>${esc(q[0])}</td><td>${psN(q[1])}</td><td>${psN(q[2])}</td><td>${psPct(q[3])}</td><td>${psPos(q[4])}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">No data.</td></tr>'}</tbody></table></div></div>
    <div class="card"><div class="h3" style="padding:16px 18px 0">Product pages in Google</div><div class="tbl-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th>Product</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Pos.</th></tr></thead><tbody>${pages.map(p => `<tr><td>${esc(p.name)}</td><td>${psN(p.gsc.impr)}</td><td>${psN(p.gsc.clicks)}</td><td>${psPct(p.gsc.ctr)}</td><td>${psPos(p.gsc.pos)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">No product pages shown yet.</td></tr>'}</tbody></table></div></div>
  </div><div class="hint" style="margin-top:10px">Search Console data is about 2 days behind and is re-read every few hours.</div>`;
}

// ---------- social ----------
function psSocial() {
  const sp = PS.social.platforms, posts = PS.social.posts, ks = Object.keys(sp);
  $('#ps-pane').innerHTML = `${ks.length ? `<div class="grid g3" style="margin-bottom:16px">${ks.map(k => { const v = sp[k]; return `<div class="card pad"><div class="h3">${esc(PS_PLAT[k] || k)}</div><div class="hint" style="margin-bottom:6px">${v.posts} post${v.posts === 1 ? '' : 's'} in the last 90 days</div><div style="font-size:26px;font-weight:800;letter-spacing:-.03em">${psN(v.views)} <small class="hint" style="font-size:12px;font-weight:600">views</small></div><div class="hint" style="margin-top:4px">Likes ${psN(v.likes)} · Comments ${psN(v.comments)} · Shares ${psN(v.shares)}<br>Saves ${psN(v.saves)} · Reach ${psN(v.reach)}</div></div>`; }).join('')}</div>` : ''}
  <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Platform</th><th>Posted</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th><th>Reach</th><th>Updated</th></tr></thead><tbody>${posts.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(PS_PLAT[p.platform] || p.platform)}</td><td>${esc(String(p.posted).slice(0, 10))}</td><td>${psN(p.views)}</td><td>${psN(p.likes)}</td><td>${psN(p.comments)}</td><td>${psN(p.shares)}</td><td>${psN(p.saves)}</td><td>${psN(p.reach)}</td><td class="hint">${p.updated ? psWhen(p.updated * 1000) : 'not yet'}</td></tr>`).join('') || '<tr><td colspan="10" class="hint" style="padding:26px;text-align:center">No Facebook / Instagram / YouTube posts yet. Post from <b>Social posting</b>, then press <b>Refresh</b> here.</td></tr>'}</tbody></table></div></div>
  <div class="hint" style="margin-top:10px">TikTok, Snapchat, Pinterest and webhook posts cannot be measured from here, and WhatsApp messages are not counted.</div>`;
}

// ---------- CSV ----------
function psCsv() {
  if (!PS) return toast('Nothing to export yet', true);
  const head = ['Product', 'URL', 'Views', 'Orders', 'Units', `Revenue (${PS.currency})`, 'Conversion %', 'Google impressions', 'Google clicks', 'CTR %', 'Avg position', 'Main keyword', 'Keyword position', 'Google rank (booster)', 'YouTube rank', 'SEO score', 'Optimized', 'Has video', 'Social posts', 'Social views', 'Social likes', 'Social comments', 'Social shares', 'Social saves', 'Social reach'];
  const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = psRows().map(p => [p.name, p.url, p.views, p.orders, p.units, p.revenue, p.conv, p.gsc && p.gsc.impr, p.gsc && p.gsc.clicks, p.gsc && p.gsc.ctr, p.gsc && p.gsc.pos, p.keyword, p.kw_pos, p.google, p.youtube, p.score, p.optimized ? 'yes' : 'no', p.video ? 'yes' : 'no', p.social && p.social.posts, p.social && p.social.views, p.social && p.social.likes, p.social && p.social.comments, p.social && p.social.shares, p.social && p.social.saves, p.social && p.social.reach]);
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\n'), a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `product-analytics-${PS.days}d-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
