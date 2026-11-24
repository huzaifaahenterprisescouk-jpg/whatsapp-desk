/* DC files (left menu).
   Administrator: assign a company to a team member together with the company's sheet (OneDrive / SharePoint / Google Sheets link) or ERP export link.
   Everyone: how many DCs each company has and the DC list, laid out exactly like Company report (same filters, columns and Edit button).
   Edit saves in the app AND writes the change into that company's sheet (see lib/writeback.js). A team member only sees the companies assigned to them. */

const dcsAgo = t => { if (!t) return 'not read yet'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'read just now' : m < 60 ? `read ${m} min ago` : m < 1440 ? `read ${Math.round(m / 60)} h ago` : `read ${Math.round(m / 1440)} d ago`; };
// the company (organization) a sheet name belongs to, the same way the server matches it: by name or alias
const dcsOrg = name => { const n = String(name || '').trim().toLowerCase(); return (S.orgs || []).find(o => o.name.toLowerCase() === n || (o.aliases || []).some(a => a.toLowerCase() === n)) || null; };
const dcsKey = name => { const o = dcsOrg(name); return o ? o.id : 'x:' + String(name || '').trim().toLowerCase(); };

const dcsCollapsed = () => { try { return localStorage.getItem('dcs_col') === '1'; } catch { return !!S.dcsColMem; } };
function viewDcs() {
  const ad = isAdmin();
  odClear(); S.dcsF = S.dcsF || { q: '', f: '' }; S.dcSel.clear(); S.dcPaged = 1;
  $('#main').innerHTML = `<div class="page">${pageHead('DC files', ad ? 'Assign each company to the team member who looks after it. The company sheets themselves are set up in Order tracking / DC items sync. The team member then sees that company\'s DCs here and can edit them: the change is saved in the sheet too.' : 'The DCs of the companies assigned to you, read live from each company\'s sheet. Press Edit on a DC to change it: the change is saved in the sheet too.', ad ? `<button class="btn primary" id="dcs-new">${ic('plus')} Assign company</button>` : '')}
    <div class="card pad" id="dcs-co" style="margin-bottom:16px"><div class="hint">Loading companies…</div></div>
    <div id="dcs-f" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center"></div>
    <div id="fres" class="fres"></div></div>`;
  const nb = $('#dcs-new'); if (nb) nb.onclick = () => dcsAssign();
  $('#fres').onclick = findClick;
  $('#fres').oninput = e => { if (e.target.id !== 'dc-colq') return; S.dcColQ = e.target.value.trim(); $$('.dc-cl').forEach(l => l.style.display = !S.dcColQ || l.dataset.n.includes(S.dcColQ.toLowerCase()) ? 'flex' : 'none'); };
  odHost = null; odOnChange = () => dcsRun(true);   // after an Edit the list is read again from the server
  dcsCompanies(); dcsRun();
}
// The DCs come from the server one page (100) at a time, already filtered by the field + text typed above the list, so every DC can be found and the screen stays fast
let dcsSeq = 0;
const dcsQuery = () => odQuery() + '&q=' + encodeURIComponent(S.dcsF.q.trim()) + '&field=' + encodeURIComponent(S.dcsF.f);
async function dcsRun(keep) {   // keep = after an Edit: read the same number of rows again
  const my = ++dcsSeq, n = keep ? Math.max(100, (S.findRes || []).length) : 100;
  try {
    const r = await api('/dcs/page?' + dcsQuery() + '&offset=0&limit=' + Math.min(500, n)); if (my !== dcsSeq || !$('#fres')) return;
    S.findRes = r.results; S.findCols = r.sheetCols || []; S.findTotal = r.total; S.dcsPool = r.pool; S.findQ = S.dcsF.q; S.dcsCols = dcColumns(S.findRes).all.map(c => [c[0], c[1]]);
    dcsFilterBar(); drawFind(); dcsEmpty();
  } catch (e) { const o = $('#fres'); if (o) o.innerHTML = `<div class="hint">${esc(e.message)}</div>`; }
}
async function dcsMore(btn) {
  const my = dcsSeq; btn.disabled = true; btn.textContent = 'Loading…';
  try {
    const r = await api('/dcs/page?' + dcsQuery() + '&limit=100&offset=' + S.findRes.length); if (my !== dcsSeq) return;
    S.findRes = S.findRes.concat(r.results); S.findTotal = r.total; drawFind();
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}
const dcsNorm = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, '');
function dcsEmpty() { const F = S.dcsF, o = $('#fres'); if (o && !S.findRes.length && S.dcsPool) o.innerHTML = `<div class="card"><b>No match</b><div class="hint">No DC matches “${esc(F.q)}” in ${F.f ? esc(dcColName(F.f)) : 'any field'}.</div></div>`; }
// the filter above the list: which field + what to look for
function dcsFilterBar() {
  const n = S.dcsPool || 0;
  const bar = $('#dcs-f'); if (!bar) return; const F = S.dcsF, focus = document.activeElement && document.activeElement.id === 'dcs-q';
  if (!bar.dataset.ready) {
    bar.dataset.ready = 1;
    bar.innerHTML = `<label class="search" style="width:auto;min-width:260px;flex:1 1 260px;max-width:420px">${ic('search')}<input type="search" id="dcs-q" autocomplete="off"></label>
      <select id="dcs-ff" title="Which field to search" style="width:auto;min-width:170px;flex:none"></select><button class="btn sm" id="dcs-x">${ic('x')} Clear</button><span class="hint" id="dcs-n"></span>`;
    let tm; $('#dcs-q').oninput = e => { F.q = e.target.value; clearTimeout(tm); tm = setTimeout(dcsRun, 250); };
    $('#dcs-ff').onchange = e => { F.f = e.target.value; dcsRun(); };
    $('#dcs-x').onclick = () => { F.q = ''; F.f = ''; $('#dcs-q').value = ''; dcsRun(); };
  }
  const opts = [['', 'All fields'], ...(S.dcsCols || [])], sel = $('#dcs-ff');
  const sig = opts.map(o => o[0]).join('|'); if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = opts.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join(''); }
  sel.value = F.f; const qi = $('#dcs-q'); if (document.activeElement !== qi) qi.value = F.q; qi.placeholder = F.f ? `Search ${dcColName(F.f)}…` : 'Search DC, PO, P.R, BR no, CN, company…';
  $('#dcs-x').disabled = !F.q && !F.f; $('#dcs-n').textContent = F.q || F.f ? `${(S.findTotal || 0).toLocaleString()} of ${n.toLocaleString()} DCs` : `${n.toLocaleString()} DC${n === 1 ? '' : 's'}`;
  if (focus) qi.focus();
}

async function dcsCompanies() {
  const box = $('#dcs-co'); if (!box) return; const ad = isAdmin();
  let d, src = [];
  try { d = await api('/sheet-links'); if (ad) src = (await api('/sources')).sources; } catch (e) { box.innerHTML = `<div class="hint">${esc(e.message)}</div>`; return; }
  const by = new Map(src.map(s => [s.id, s]));
  const list = d.sheets.map(s => ({ ...s, ...(by.get(s.id) || {}), orders: s.orders })).sort((a, b) => a.name.localeCompare(b.name));
  S.dcsList = list;
  const total = list.reduce((a, s) => a + s.orders, 0), col = dcsCollapsed();
  const rows = col ? '' : list.map(s => {
    const org = dcsOrg(s.name), who = org && org.agentId ? (S.agents || []).find(a => a.id === org.agentId) : null, on = OD.org === dcsKey(s.name);
    return `<div class="row" data-sid="${esc(s.id)}" style="gap:12px;padding:10px 0;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:200px"><b>${esc(s.name)}</b>
        <div class="hint">${ad ? (who ? 'Assigned to <b>' + esc(who.name) + '</b>' : '<span style="color:var(--amber)">Not assigned to a team member yet</span>') + ' · ' : ''}${esc(dcsAgo(s.lastSync))}${s.lastError ? ` · <span style="color:var(--red)">${esc(s.lastError)}</span>` : ''}</div></div>
      <div style="min-width:90px;text-align:right"><b style="font-size:20px">${s.orders.toLocaleString()}</b><div class="hint">DC${s.orders === 1 ? '' : 's'}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn sm ${on ? 'primary' : ''}" data-a="show" title="Show only the DCs of ${esc(s.name)} in the list below">${on ? 'Showing' : 'Show DCs'}</button>
        ${s.itemLink ? `<a class="btn sm" href="${esc(sheetOpenUrl(s.itemLink))}" target="_blank" rel="noopener noreferrer" title="The sheet attached in DC items sync${s.itemName ? ': ' + esc(s.itemName) : ''}">${ic('link')} Open sheet</a>` : (ad ? `<button class="btn sm" data-a="isy" title="No sheet is attached to this company in DC items sync yet">${ic('bolt')} Attach sheet</button>` : '')}
        ${ad ? `<button class="btn sm ${who ? '' : 'primary'}" data-a="edit">${ic('team')} ${who ? 'Change person' : 'Assign'}</button>` : ''}
      </div></div>`;
  }).join('');
  box.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center;gap:10px"><div><h3 style="margin:0">${ad ? 'Companies' : 'My companies'} <span class="hint" style="font-weight:500">· ${list.length} · ${total.toLocaleString()} DC${total === 1 ? '' : 's'}</span></h3></div><div class="row" style="gap:8px">${OD.org ? `<button class="btn sm" data-a="all">${ic('x')} Show all companies</button>` : ''}<button class="ib" data-a="toggle" title="${col ? 'Show the companies' : 'Minimize the companies'}" aria-expanded="${!col}" style="transition:transform .2s;${col ? '' : 'transform:rotate(180deg)'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button></div></div>
    ${col ? '' : rows || `<div class="hint" style="padding:10px 0">${ad ? 'No company sheet yet. Add the company\'s sheet in Order tracking, then assign it here.' : 'No company is assigned to you yet. Ask the administrator.'}</div>`}`;
  box.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, row = b.closest('[data-sid]'), s = row && list.find(x => x.id === row.dataset.sid);
    if (a === 'toggle') { try { localStorage.setItem('dcs_col', dcsCollapsed() ? '0' : '1'); } catch { S.dcsColMem = !dcsCollapsed(); } return dcsCompanies(); }
    if (a === 'all') { OD.org = ''; dcsRun(); return dcsCompanies(); }
    if (!s) return;
    if (a === 'show') { OD.org = OD.org === dcsKey(s.name) ? '' : dcsKey(s.name); dcsRun(); dcsCompanies(); const f = $('#dcs-f'); if (f && OD.org) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (a === 'isy') return goItemSync();
    if (a === 'edit') return dcsAssign(s);
  };
}
// reload the company box, the counts and the DC list
async function dcsRefresh() { try { await reload(); } catch {} dcsRun(true); dcsCompanies(); }

// Assign a company to the team member who looks after it (the sheets are managed in Order tracking / DC items sync)
function dcsAssign(s) {
  const list = S.dcsList || [], org = s && dcsOrg(s.name);
  const cur = s ? s.id : '';
  modal(`<h3>Assign company</h3>
    <div class="field"><label>Company</label><select id="dsa-c" ${s ? 'disabled' : ''}>${s ? '' : '<option value="">— choose a company —</option>'}${list.map(x => { const o = dcsOrg(x.name), w = o && o.agentId ? (S.agents || []).find(a => a.id === o.agentId) : null; return `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}${w ? ' — ' + esc(w.name) : ' — not assigned'}</option>`; }).join('')}</select>
      ${list.length ? '' : '<div class="hint">No company sheet yet. Add the company\'s sheet in Order tracking first.</div>'}</div>
    <div class="field"><label>Team member who looks after this company</label><select id="dsa-a"><option value="">— not assigned —</option>${(S.agents || []).map(a => `<option value="${esc(a.id)}" ${org && org.agentId === a.id ? 'selected' : ''}>${esc(a.name)}${a.role === 'admin' ? ' (administrator)' : ''}</option>`).join('')}</select>
      <div class="hint">Only this person (and the administrator) sees this company's DCs here and can edit them.</div></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Assign</button></div>`, (bg, close) => {
    const pick = () => { const x = list.find(y => y.id === $('#dsa-c', bg).value), o = x && dcsOrg(x.name); $('#dsa-a', bg).value = o && o.agentId || ''; };
    $('#dsa-c', bg).onchange = pick;
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const x = list.find(y => y.id === $('#dsa-c', bg).value), agentId = $('#dsa-a', bg).value;
      if (!x) return toast('Choose a company', true);
      const btn = $('#sv', bg); btn.disabled = true;
      try {
        const o = dcsOrg(x.name);   // the company (organization) decides who sees it
        if (o) { if ((o.agentId || '') !== agentId) await api('/organizations/' + o.id, { method: 'PATCH', body: { agentId } }); }
        else await api('/organizations', { method: 'POST', body: { name: x.name, agentId } });
        close(); toast(agentId ? 'Company assigned' : 'Company unassigned'); dcsRefresh();
      } catch (er) { toast(er.message, true); btn.disabled = false; }
    };
  });
}
