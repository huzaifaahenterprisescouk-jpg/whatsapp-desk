/* DC alerts: DCs that are still "Pending dispatch" after N days.
   Administrator: Settings -> "DC pending alerts": choose a person, the companies and the number of days.
   That person: sees an alert card, a number on "Company report" and (if allowed) a desktop pop-up. Clicking it opens Company report
   already filtered on those DCs (company + Pending dispatch + DC date up to the day limit). */
(function () {
  const DCA = { data: { items: [], total: 0 }, timer: 0, ok: false };
  const SEP = '\u001f';   // the server accepts several company keys in one filter, separated by this character
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const sigOf = d => todayKey() + '|' + (d.items || []).map(i => i.key + ':' + i.count).join(',');
  const fmtDay = v => { try { return typeof odD === 'function' ? odD(v) : v; } catch { return v; } };
  const store = { get: k => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }, lget: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, lset: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  // ---------- the person's side: poll, badge, card, pop-up ----------
  // Each person decides how they are told (saved on the server, so it follows them to every device):
  //   always = the card shows whenever DCs are overdue (and again when the numbers change) | every = again every N minutes | times = only at chosen times of day
  //   Mute = no card and no pop-up for a while / until turned on again (the number on "Company report" stays so nothing is hidden)
  const PREF0 = { mode: 'always', every: 60, times: ['09:00', '14:00'], muteUntil: 0, off: false };
  const prefs = () => ({ ...PREF0, ...(DCA.data.prefs || {}) });
  const muted = () => { const p = prefs(); return p.off || (p.muteUntil && p.muteUntil > Date.now()); };
  const uid = () => (typeof S !== 'undefined' && S.me ? S.me.id : '');
  const pad2 = n => String(n).padStart(2, '0');
  const dayStr = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

  async function poll() {
    if (typeof S === 'undefined' || !S.me || !S.token) return;
    try { DCA.data = await api('/dcalerts'); DCA.ok = true; } catch { return; }
    evaluate(); paint();
  }
  // decides whether the card (and the pop-up) shows right now; called after every poll and every 20 seconds
  function evaluate() {
    const d = DCA.data, p = prefs(), now = Date.now(), k = n => 'dca_' + n + '_' + uid(), sig = sigOf(d);
    if (!d.total || muted()) { DCA.visible = false; return; }
    let pop = false;
    if (p.mode === 'always') {
      DCA.visible = store.get('dca_x') !== sig;
      if (DCA.visible && store.lget(k('pop')) !== sig) { store.lset(k('pop'), sig); pop = true; }
    } else if (p.mode === 'every') {
      const last = +store.lget(k('last')) || 0;
      if (!DCA.visible && now - last >= p.every * 60000) { DCA.visible = true; store.lset(k('last'), String(now)); pop = true; }
    } else { // times: the newest chosen time that has already passed today shows the alert once
      const t = new Date(), cur = pad2(t.getHours()) + ':' + pad2(t.getMinutes()), past = p.times.filter(x => x <= cur).pop();
      if (past) { const slot = dayStr(t) + ' ' + past; if (store.lget(k('slot')) !== slot) { store.lset(k('slot'), slot); DCA.visible = true; pop = true; } }
    }
    if (pop && typeof window.deskNotifyDca === 'function') window.deskNotifyDca(d);
  }
  function badge() {
    const b = document.getElementById('dcabadge'); if (!b) return;
    const n = DCA.data.total || 0; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; b.classList.toggle('muted', !!muted());
    b.title = n ? n + ' pending DC' + (n === 1 ? '' : 's') + ' older than the alert limit' + (muted() ? ' (alert muted)' : '') : '';
  }
  const untilTxt = ms => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const stateTxt = () => { const p = prefs(); return p.off ? 'Muted until you turn it on' : muted() ? 'Muted until ' + untilTxt(p.muteUntil) : p.mode === 'times' ? 'Shows at ' + p.times.join(', ') : p.mode === 'every' ? 'Shows every ' + (p.every >= 60 && p.every % 60 === 0 ? p.every / 60 + ' h' : p.every + ' min') : 'Shows whenever DCs are overdue'; };
  async function savePrefs(patch) {
    try { const r = await api('/dcalerts/prefs', { method: 'PUT', body: patch }); DCA.data.prefs = r.prefs; if (patch.muteUntil || patch.off) DCA.visible = false; evaluate(); paint(); strip(); return true; }
    catch (e) { toast(e.message, true); return false; }
  }
  const tomorrow8 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.getTime(); };
  const MUTES = [['1 hour', () => Date.now() + 36e5], ['4 hours', () => Date.now() + 144e5], ['Until tomorrow 8:00', tomorrow8]];

  function card() {
    const d = DCA.data, old = document.getElementById('dcacard');
    if (!d.total || !DCA.visible || muted()) { old && old.remove(); return; }
    const days = Math.max(1, ...((d.items || []).map(i => i.days || 1)));
    const el = old || document.createElement('div'); el.id = 'dcacard'; el.setAttribute('role', 'alert');
    el.innerHTML = `<div class="dca-h"><span class="dca-i">⚠</span><b>${d.total} DC${d.total === 1 ? '' : 's'} still pending dispatch</b><button class="dca-x" title="Close" aria-label="Close">×</button></div>
      <div class="dca-s">Older than ${days} day${days === 1 ? '' : 's'} · click a company to see them</div>
      <div class="dca-l">${(d.items || []).slice(0, 8).map(i => `<button class="dca-r" data-k="${esc(i.key)}"><span class="dca-n">${esc(i.name)}</span><span class="dca-c">${i.count}</span><small>oldest ${esc(fmtDay(i.oldest))}</small></button>`).join('')}${(d.items || []).length > 8 ? `<div class="dca-m">+ ${d.items.length - 8} more companies</div>` : ''}</div>
      ${(d.items || []).length > 1 ? '<button class="btn sm primary dca-all">Show all in Company report</button>' : ''}
      <div class="dca-f"><button class="dca-lk" data-mute="1" title="Stop the pop-ups for a while">🔕 Mute ▾</button><button class="dca-lk" data-set="1" title="Choose when this alert shows">⏰ Alert time</button></div>`;
    if (!old) document.body.appendChild(el);
    el.onclick = e => {
      if (e.target.closest('.dca-x')) { store.set('dca_x', sigOf(DCA.data)); DCA.visible = false; el.remove(); return; }
      const r = e.target.closest('.dca-r'); if (r) return open(r.dataset.k);
      if (e.target.closest('.dca-all')) return open('');
      const mu = e.target.closest('[data-mute]'); if (mu) return muteMenu(mu);
      if (e.target.closest('[data-set]')) return settings();
    };
  }
  // a small menu under / above a button: 1 hour, 4 hours, until tomorrow, until I turn it on
  function muteMenu(anchor) {
    document.querySelectorAll('.dca-menu').forEach(x => x.remove());
    const m = document.createElement('div'); m.className = 'dca-menu';
    m.innerHTML = (muted() ? '<button data-u="1">🔔 Turn the alert back on</button>' : MUTES.map((x, i) => `<button data-m="${i}">Mute for ${x[0]}</button>`).join('') + '<button data-m="off">Mute until I turn it on</button>');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left)) + 'px'; m.style.top = (r.top - m.offsetHeight - 6 > 8 ? r.top - m.offsetHeight - 6 : r.bottom + 6) + 'px';
    const off = () => { m.remove(); document.removeEventListener('mousedown', out, true); };
    const out = e => { if (!m.contains(e.target)) off(); };
    setTimeout(() => document.addEventListener('mousedown', out, true), 0);
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; off();
      if (b.dataset.u) { if (await savePrefs({ off: false, muteUntil: 0 })) toast('DC alert is on again'); return; }
      const ok = b.dataset.m === 'off' ? await savePrefs({ off: true }) : await savePrefs({ off: false, muteUntil: MUTES[+b.dataset.m][1]() });
      if (ok) toast('DC alert muted — ' + stateTxt().toLowerCase());
    };
  }
  // the person's own settings: when the alert shows + mute
  function settings() {
    let p = prefs(), times = [...p.times];
    const hrs = [15, 30, 60, 120, 240, 480, 720, 1440];
    const bg = modal(`<div class="dce-h"><div class="dce-ic">⏰</div><div style="min-width:0"><h3>DC alert time</h3><div class="dce-sub"><span class="dce-chip" id="dcs-state"></span></div></div></div>
      <div class="dce-body">
        <div><div class="dce-sec">When should the alert show?</div>
          <label class="dcs-o"><input type="radio" name="dcs-m" value="always"><span><b>Whenever DCs are overdue</b><small>Shows when you open the app and again when the numbers change.</small></span></label>
          <label class="dcs-o"><input type="radio" name="dcs-m" value="every"><span><b>Again every</b> <select id="dcs-ev">${hrs.map(m => `<option value="${m}">${m >= 60 ? m / 60 + ' hour' + (m > 60 ? 's' : '') : m + ' minutes'}</option>`).join('')}</select><small>After you close it, it comes back after this time.</small></span></label>
          <label class="dcs-o"><input type="radio" name="dcs-m" value="times"><span><b>Only at these times each day</b><small>The alert opens once at each time (the number on Company report is always visible).</small><span id="dcs-times" class="dcs-times"></span></span></label></div>
        <div><div class="dce-sec">Mute</div><div class="dcs-mutes" id="dcs-mutes"></div><div class="hint" id="dcs-mh" style="margin-top:6px"></div></div>
      </div>
      <div class="dce-ft"><span class="grow"></span><button class="btn" id="dcs-x">Close</button><button class="btn primary" id="dcs-s">Save</button></div>`, (bg, close) => {
      const q = s => bg.querySelector(s);
      const drawTimes = () => { q('#dcs-times').innerHTML = times.map((t, i) => `<span class="dcs-t"><input type="time" value="${t}" data-i="${i}"><button type="button" data-d="${i}" title="Remove">×</button></span>`).join('') + (times.length < 8 ? '<button type="button" class="btn sm" data-add="1">+ Add a time</button>' : ''); };
      const drawMute = () => { q('#dcs-state').textContent = stateTxt(); q('#dcs-mutes').innerHTML = muted() ? '<button class="btn sm primary" data-u="1">🔔 Turn the alert back on</button>' : MUTES.map((x, i) => `<button class="btn sm" data-m="${i}">${x[0]}</button>`).join('') + '<button class="btn sm" data-m="off">Until I turn it on</button>'; q('#dcs-mh').textContent = muted() ? 'No pop-ups while muted. The number on Company report stays so you can still check.' : 'Muting stops the pop-up card and the desktop notification for that time.'; };
      bg.querySelectorAll('[name="dcs-m"]').forEach(r => r.checked = r.value === p.mode); q('#dcs-ev').value = String(p.every); drawTimes(); drawMute();
      bg.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.add) { times.push('12:00'); drawTimes(); bg.querySelector('[name="dcs-m"][value="times"]').checked = true; return; }
        if (b.dataset.d !== undefined) { times.splice(+b.dataset.d, 1); drawTimes(); return; }
        if (b.dataset.u) { if (await savePrefs({ off: false, muteUntil: 0 })) { p = prefs(); drawMute(); } return; }
        if (b.dataset.m !== undefined) { const ok = b.dataset.m === 'off' ? await savePrefs({ off: true }) : await savePrefs({ off: false, muteUntil: MUTES[+b.dataset.m][1]() }); if (ok) { p = prefs(); drawMute(); } }
      });
      bg.addEventListener('input', e => { const t = e.target; if (t.type === 'time' && t.dataset.i !== undefined) times[+t.dataset.i] = t.value; });
      q('#dcs-x').onclick = close;
      q('#dcs-s').onclick = async () => {
        const mode = (bg.querySelector('[name="dcs-m"]:checked') || {}).value || 'always', tl = [...new Set(times.filter(x => /^\d{2}:\d{2}$/.test(x)))].sort();
        if (mode === 'times' && !tl.length) return toast('Add at least one time', true);
        const body = { mode, every: +q('#dcs-ev').value, times: tl }; DCA.visible = false;
        try { store.lset('dca_slot_' + uid(), ''); store.lset('dca_last_' + uid(), '0'); } catch {}
        if (await savePrefs(body)) { toast('Saved — ' + stateTxt().toLowerCase()); close(); }
      };
    });
    bg.querySelector('.modal').classList.add('dce');
  }
  window.dcaSettings = settings;
  // a thin bar on top of "Company report" (only for people who have an alert): what is overdue, how it shows, and the way back to unmute
  function strip() {
    document.getElementById('dcastrip') && document.getElementById('dcastrip').remove();
    if (typeof S === 'undefined' || S.view !== 'find' || !DCA.data.rules) return;
    const pg = document.querySelector('#main .page'); if (!pg) return;
    const el = document.createElement('div'); el.id = 'dcastrip';
    el.innerHTML = `<span class="dca-i">⚠</span><span class="dcs-tx"><b>${DCA.data.total ? DCA.data.total + ' DC' + (DCA.data.total === 1 ? '' : 's') + ' pending dispatch past the alert limit' : 'No DC is overdue'}</b> · ${esc(stateTxt())}</span>${DCA.data.total ? '<button class="btn sm" data-o="1">Show them</button>' : ''}<button class="btn sm" data-set="1">⏰ Alert time / mute</button>`;
    pg.insertBefore(el, pg.firstChild);
    el.onclick = e => { if (e.target.closest('[data-o]')) open(''); else if (e.target.closest('[data-set]')) settings(); };
  }
  function paint() { badge(); card(); }

  // open Company report with the DCs of the alert already filtered: Pending dispatch + DC date up to the limit (+ the company)
  function open(key) {
    const d = DCA.data, items = d.items || [], one = key && items.find(i => i.key === key);
    go(one ? one.key : items.map(i => i.key).join(SEP), one ? one.to : items.reduce((m, i) => i.to > m ? i.to : m, ''));
  }
  // company key(s) (joined by the unit separator) + the last DC date -> Company report with exactly those pending DCs
  function go(org, to) {
    Object.assign(OD, { agent: '', org, q: '', item: '', bill: '', backup: false, cls: 'pending', period: 'custom', from: '', to, dperiod: 'all', dfrom: '', dto: '' });
    S.findPendingSet = 1; S.dcaFrom = { key: org, to };
    DCA.visible = false; const card = document.getElementById('dcacard'); if (card) card.remove();
    if (S.view === 'find') { try { viewFind(); } catch {} } else { S.view = 'find'; location.hash = 'find'; renderShell(); }
  }
  window.dcaOpen = open; window.dcaGo = go;

  // ---------- administrator: Settings -> DC pending alerts ----------
  window.dcaSettingsCard = async function (host) {
    if (!host) return;
    let cfg; try { cfg = await api('/dcalerts/config'); } catch (e) { host.innerHTML = `<div class="hint">${esc(e.message)}</div>`; return; }
    let rules = (cfg.rules || []).map(r => ({ ...r })), qs = {};
    const agents = cfg.agents || [], cos = cfg.companies || [];
    const draw = () => {
      host.innerHTML = `<p class="hint" style="margin-bottom:12px">Choose who is warned when a DC is <b>still pending dispatch</b> after the number of days you set (counted from the DC date / order date). The person gets an alert card, a number on <b>Company report</b> and a desktop pop-up. Clicking it opens Company report already filtered on those DCs, so they can check them. The person can open the companies you give here even if another person looks after them.</p>
        <div id="dca-rules">${rules.length ? rules.map((r, i) => ruleHtml(r, i)).join('') : '<div class="hint" style="margin-bottom:10px">No alert yet. Press “Add a person”.</div>'}</div>
        <div class="row" style="gap:8px;margin-top:6px"><button class="btn" id="dca-add">+ Add a person</button><button class="btn primary" id="dca-save">Save alerts</button></div>`;
    };
    const ruleHtml = (r, i) => {
      const all = r.orgs[0] === '*', q = (qs[i] || '').toLowerCase(), set = new Set(r.orgs);
      const list = cos.filter(c => !q || c.name.toLowerCase().includes(q));
      return `<div class="dca-rule card pad" data-i="${i}" style="margin-bottom:10px;${r.on === false ? 'opacity:.6' : ''}">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="margin:0;min-width:180px;flex:1"><label>Who gets the alert</label><select data-f="agent"><option value="">Choose a person…</option>${agents.map(a => `<option value="${esc(a.id)}" ${a.id === r.agentId ? 'selected' : ''}>${esc(a.name)}${a.role === 'admin' ? ' (admin)' : ''}</option>`).join('')}</select></div>
          <div class="field" style="margin:0;width:150px"><label>Pending for more than</label><div class="row" style="gap:6px;align-items:center"><input type="number" min="1" max="60" data-f="days" value="${r.days || 1}" style="width:70px"> <span class="hint">day(s)</span></div></div>
          <label class="chk" title="Pause this alert without deleting it"><input type="checkbox" data-f="on" ${r.on !== false ? 'checked' : ''}><span>On</span></label>
          <button class="btn sm danger" data-f="del" title="Remove this alert">Remove</button>
        </div>
        <div class="field" style="margin:12px 0 0"><label>Companies <small class="hint">(${all ? 'all' : set.size + ' chosen'})</small></label>
          <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label class="chk"><input type="checkbox" data-f="all" ${all ? 'checked' : ''}><span>All companies</span></label>${all ? '' : `<input type="search" data-f="q" placeholder="Find a company…" value="${esc(qs[i] || '')}" style="min-width:170px;flex:1;max-width:260px">`}</div>
          ${all ? '' : `<div class="row" style="gap:6px;flex-wrap:wrap;max-height:170px;overflow:auto;margin-top:6px">${list.length ? list.map(c => `<label class="chk"><input type="checkbox" data-co="${esc(c.key)}" ${set.has(c.key) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('') : '<span class="hint">No company found.</span>'}</div>`}
        </div></div>`;
    };
    host.onchange = e => {
      const t = e.target, box = t.closest('.dca-rule'); if (!box) return; const r = rules[+box.dataset.i], f = t.dataset.f;
      if (f === 'agent') r.agentId = t.value; else if (f === 'days') r.days = Math.min(60, Math.max(1, +t.value || 1)); else if (f === 'on') { r.on = t.checked; box.style.opacity = t.checked ? '' : '.6'; }
      else if (f === 'all') { r.orgs = t.checked ? ['*'] : []; draw(); }
      else if (t.dataset.co) { const s = new Set(r.orgs); t.checked ? s.add(t.dataset.co) : s.delete(t.dataset.co); r.orgs = [...s]; const lab = box.querySelector('.field label small'); if (lab) lab.textContent = `(${s.size} chosen)`; }
    };
    host.oninput = e => { const t = e.target; if (t.dataset.f !== 'q') return; const i = +t.closest('.dca-rule').dataset.i; qs[i] = t.value; const pos = t.selectionStart; draw(); const n = host.querySelector(`.dca-rule[data-i="${i}"] [data-f="q"]`); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    host.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'dca-add') { rules.push({ id: '', agentId: '', orgs: [], days: 1, on: true }); draw(); return; }
      if (b.dataset.f === 'del') { rules.splice(+b.closest('.dca-rule').dataset.i, 1); draw(); return; }
      if (b.id === 'dca-save') {
        const bad = rules.findIndex(r => !r.agentId || !r.orgs.length); if (bad >= 0) return toast(!rules[bad].agentId ? 'Choose a person for every alert' : 'Choose at least one company for every alert', true);
        try { const r = await api('/dcalerts/config', { method: 'PUT', body: { rules } }); rules = r.rules.map(x => ({ ...x })); draw(); toast('DC alerts saved'); poll(); } catch (err) { toast(err.message, true); }
      }
    };
    draw();
  };

  // ---------- start ----------
  const up = () => { try { badge(); } catch {} };
  const _rs = window.renderShell; if (typeof _rs === 'function') window.renderShell = function () { const r = _rs.apply(this, arguments); up(); return r; };
  const _vf = window.viewFind; if (typeof _vf === 'function') window.viewFind = function () { const r = _vf.apply(this, arguments); setTimeout(strip, 0); return r; };
  const boot = () => { if (typeof S !== 'undefined' && S.me) { if (!DCA.timer) { poll(); DCA.timer = setInterval(poll, 5 * 60 * 1000); DCA.tick = setInterval(() => { if (DCA.ok) { evaluate(); paint(); } }, 20000); } } else if (DCA.timer) { clearInterval(DCA.timer); clearInterval(DCA.tick); DCA.timer = DCA.tick = 0; DCA.ok = false; DCA.data = { items: [], total: 0 }; DCA.visible = false; paint(); } };
  setInterval(boot, 3000); setTimeout(boot, 1200);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && DCA.timer) poll(); });
  window.dcaPoll = poll;
})();
