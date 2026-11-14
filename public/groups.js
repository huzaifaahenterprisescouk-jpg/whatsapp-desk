/* Administrator page: every WhatsApp group the linked number is in, and which team member looks after each one.
   A team member sees (and can chat / voice-call in) only the groups assigned to them. Loaded after links.js. */
let GR = { groups: [], connected: false, linkMode: true, enabled: true, loading: false, err: '' };

async function groupsRefresh() {
  if (S.view !== 'groups' || !$('#grp')) return;
  try { Object.assign(GR, await api('/groups'), { err: '' }); } catch (e) { GR.err = e.message; }
  drawGroups();
}
function viewGroups() {
  $('#main').innerHTML = `<div class="page">${pageHead('WhatsApp groups', 'Choose which team member looks after each group your number is in. They can chat and voice-call in their groups and nothing else. You, as administrator, can do everything in every group.', `<button class="btn" id="grp-re">${ic('link')} Refresh groups</button>`)}
    <div id="grp"><div class="hint" style="padding:18px 4px">Loading groups…</div></div></div>`;
  $('#grp-re').onclick = async e => { const b = e.currentTarget; b.disabled = true; await groupsRefresh(); b.disabled = false; };
  groupsRefresh();
}
function drawGroups() {
  const el = $('#grp'); if (!el) return;
  if (GR.err) { el.innerHTML = `<div class="card"><b>Could not load groups</b><div class="hint">${esc(GR.err)}</div></div>`; return; }
  const note = !GR.linkMode ? 'Groups work only <b>without the API</b> (your own linked number). Switch in Settings → WhatsApp connection.'
    : !GR.enabled ? 'Groups are switched off. Tick <b>Bring WhatsApp groups into the desk</b> in Settings → WhatsApp connection.'
    : !GR.connected ? 'WhatsApp is not connected right now, so only groups that already wrote here are listed. Reconnect in Settings → WhatsApp connection.' : '';
  const agents = S.agents.filter(a => a.active);
  el.innerHTML = (note ? `<div class="card" style="margin-bottom:12px"><div class="hint">${note}</div></div>` : '') +
    (GR.groups.length ? `<div class="grp-list">${GR.groups.map(g => `<div class="card grp-row" data-p="${esc(g.phone)}" data-j="${esc(g.jid || '')}" data-n="${esc(g.name)}">
      ${groupAvatar('lg')}
      <div class="gb"><b>${esc(g.name)}</b><small>${g.size ? g.size + ' members · ' : ''}${g.preview ? esc(g.preview) : (g.inDesk ? 'No messages yet' : 'No messages in the desk yet')}</small></div>
      ${g.unread ? `<span class="badge">${g.unread}</span>` : ''}
      <label class="hint" style="display:flex;gap:8px;align-items:center">Handled by
        <select class="grp-as"><option value="">Nobody (only the administrator)</option>${agents.map(a => `<option value="${esc(a.id)}" ${a.id === g.agentId ? 'selected' : ''}>${esc(a.name)}${a.role === 'admin' ? ' (admin)' : ''}</option>`).join('')}</select></label>
      ${g.inDesk ? `<button class="btn sm" data-open="1">Open chat</button>` : ''}</div>`).join('')}</div>`
      : `<div class="card empty" style="padding:36px"><div><div class="big">${ic('team')}</div><b style="font-size:16px">No groups yet</b><div class="hint" style="margin-top:4px">Groups your linked number is in will appear here. A group also appears as soon as someone writes in it.</div></div></div>`);
  el.onchange = async e => {
    const sel = e.target.closest('.grp-as'); if (!sel) return; const row = sel.closest('.grp-row');
    try { await api(`/groups/${row.dataset.p}/assign`, { method: 'POST', body: { agentId: sel.value, jid: row.dataset.j, name: row.dataset.n } }); toast(sel.value ? 'Group assigned' : 'Group is no longer assigned'); await groupsRefresh(); }
    catch (err) { toast(err.message, true); groupsRefresh(); }
  };
  el.onclick = e => { const b = e.target.closest('[data-open]'); if (!b) return; const row = b.closest('.grp-row'); S.view = 'inbox'; location.hash = 'inbox'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'inbox')); S.tab = 'groups'; renderView(); openConv(row.dataset.p); };
}
