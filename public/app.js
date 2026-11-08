/* WhatsApp Desk – dashboard (vanilla JS, no build step) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M16 10l-2 2 2 2"/>', panelOpen: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M14 10l2 2-2 2"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  inbox: '<path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  org: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 9h5a1 1 0 0 1 1 1v11"/><path d="M8 8h2M8 12h2M8 16h2M17 13h0M17 17h0"/><path d="M3 21h18"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.2 0 4 1.8 4 4"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  up: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  down: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  check: '<path d="M20 6L9 17l-5-5"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  shop: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M10 20v-5h4v5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', play: '<path d="M6 4l14 8-14 8z"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

const S = {
  collapsed: localStorage.getItem('wd_side') === '1', token: localStorage.getItem('wd_token') || '', me: null, agents: [], orgs: [], settings: {}, convs: [], live: false, verifyToken: '', orderCount: 0,
  view: 'overview', tab: 'mine', q: '', sel: null, msgs: [], selOrders: [], orders: [], orderQ: '', orderSrc: '', orderAdd: '', srcs: [], ms: null, es: null,
  sim: { open: false, phone: '923001230000', name: 'Test Customer', msgs: [] },
};

// ---------- utils ----------
async function api(path, { method = 'GET', body, raw } = {}) {
  const r = await fetch('/api' + path, { method, headers: { Authorization: 'Bearer ' + S.token, ...(raw ? {} : { 'Content-Type': 'application/json' }) }, body: raw || (body ? JSON.stringify(body) : undefined) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.me) { logout(); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 3200); }
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const agent = id => S.agents.find(a => a.id === id);
const avatar = (a, cls = '') => `<div class="avatar ${cls}" style="background:${a ? a.color : '#94a3a0'}">${esc(initials(a ? a.name : '?'))}</div>`;
const fmtTime = ts => { const d = new Date(ts), n = new Date(); const same = d.toDateString() === n.toDateString(); return same ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (n - d < 6 * 864e5 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' })); };
const dayLabel = ts => { const d = new Date(ts), n = new Date(); if (d.toDateString() === n.toDateString()) return 'Today'; const y = new Date(n - 864e5); return d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }); };
const STATUS = { bot: ['Bot', ''], waiting: ['Waiting', 'amber'], assigned: ['Assigned', 'green'], resolved: ['Resolved', 'blue'] };
const statusPill = s => { const [l, c] = STATUS[s] || [s, '']; return `<span class="pill ${c}">${l}</span>`; };
const ORDER_COLORS = { dispatched: 'amber', 'pending dispatch': '', 'self collection': 'blue', confirmed: 'blue', processing: 'violet', packed: 'violet', shipped: 'amber', 'out for delivery': 'amber', delivered: 'green', cancelled: 'red', returned: 'red', 'on hold': 'red', pending: '' };
const orderPill = s => `<span class="pill ${ORDER_COLORS[String(s).toLowerCase()] ?? ''}">${esc(s || 'Received')}</span>`;
const ORDER_STATUSES = ['Pending', 'Pending dispatch', 'Dispatched', 'Self collection', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered', 'On hold', 'Cancelled', 'Returned'];
const testPhoneOn = () => (S.settings || {}).showTestPhone !== '0';
const groupAvatar = (cls = '') => `<div class="avatar grp ${cls}">${ic('team')}</div>`;
const isAdmin = () => S.me && S.me.role === 'admin';
const canRetail = () => isAdmin() || !!((S.agents || []).find(x => x.id === (S.me || {}).id) || S.me || {}).retailAccess;
const sortConvs = () => S.convs.sort((a, b) => b.updatedAt - a.updatedAt);

function modal(html, mount) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg); mount && mount(bg, () => bg.remove()); return bg;
}

// ---------- auth ----------
function logout() { localStorage.removeItem('wd_token'); S.token = ''; S.me = null; if (S.es) S.es.close(); resetTheme(); renderLogin(); }

async function renderLogin() {
  const pubData = await fetch('/api/public').then(r => r.json());
  $('#app').innerHTML = `
  <div class="login">
    <div class="login-hero">
      <div class="logo"><div class="logo-mark">${ic('inbox')}</div>WhatsApp Desk</div>
      <div>
        <h1>One WhatsApp number. Every customer with the right person.</h1>
        <p>Customers tell the bot which organization they are from, and the chat goes straight to the team member who looks after that account.</p>
        <div class="login-points">
          <div><span class="dot">${ic('check')}</span>Organization-based routing to your 4–6 team members</div>
          <div><span class="dot">${ic('check')}</span>Order tracking answered automatically from your Excel sheet</div>
          <div><span class="dot">${ic('check')}</span>Shared inbox with live updates and hand-over</div>
        </div>
      </div>
      <div style="opacity:.7;font-size:12.5px">${esc(pubData.business)} · Team workspace</div>
    </div>
    <div class="login-card"><form class="login-box" id="lf">
      <h2>Welcome back</h2><p class="sub">Sign in with your username and password.</p>
      <div class="field"><label>Username</label><input type="text" id="un" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="e.g. sara" autofocus></div>
      <div class="field"><label>Password</label><div class="pwrow"><input type="password" id="pw" autocomplete="current-password" placeholder="Your password"><button type="button" class="pwtg" id="pwtg" title="Show / hide password" aria-label="Show or hide password">${ic('eye')}</button></div></div>
      <button class="btn primary block">Sign in</button><div class="err" id="lerr"></div>
      <p class="hint" style="margin-top:14px">Forgot your username or password? Ask the administrator.</p>
    </form></div>
  </div>`;
  $('#pwtg').onclick = () => { const i = $('#pw'); i.type = i.type === 'password' ? 'text' : 'password'; };
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    try { const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ username: $('#un').value, password: $('#pw').value }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); S.token = j.token; localStorage.setItem('wd_token', j.token); boot(); }
    catch (err) { $('#lerr').textContent = err.message; }
  };
}

async function boot() {
  if (!S.token) return renderLogin();
  try {
    const d = await api('/bootstrap');
    Object.assign(S, { ownOnly: !!d.ownOnly, retailRegionList: d.retailRegionList || [], me: d.me, agents: d.agents, orgs: d.organizations, settings: d.settings, convs: d.conversations, live: d.live, mode: d.mode, callsApi: !!d.callsApi, verifyToken: d.verifyToken, orderCount: d.orderCount });
  } catch { return renderLogin(); }
  S.tab = 'mine'; S.view = location.hash.slice(1) || 'overview';
  // this person's own look (colour, background picture) is applied everywhere right after sign-in
  const lt = loadTheme(); applyTheme(); lt.then(applyTheme);
  renderShell(); connectEvents();
}

// ---------- live events ----------
function connectEvents() {
  if (S.es) S.es.close();
  S.es = new EventSource('/api/events?token=' + encodeURIComponent(S.token));
  S.es.onmessage = ev => {
    const e = JSON.parse(ev.data);
    if (e.type === 'mail') return mailEvent(e.thread);
    if (e.type === 'wa') return onWaEvent(e.status);
    if (e.type === 'wamode') return onWaMode(e);
    if (e.type === 'call') return onCallEvent(e.call);
    if (e.type === 'webcall') return onWebCallEvent(e.call);
    if (e.type === 'conversation') {
      const i = S.convs.findIndex(c => c.phone === e.conversation.phone);
      if (i >= 0) S.convs[i] = e.conversation; else S.convs.push(e.conversation);
      sortConvs(); refreshAgentsLoad(); updateBadges();
      if (S.view === 'inbox') { renderList(); if (S.sel === e.conversation.phone) { renderThreadHead(); renderInfo(); } }
      if (S.view === 'overview') renderView();
      if (S.view === 'groups' && e.conversation.isGroup && typeof groupsRefresh === 'function') groupsRefresh();
    } else if (e.type === 'conversation-removed') {
      S.convs = S.convs.filter(c => c.phone !== e.phone); if (S.sel === e.phone) { S.sel = null; S.msgs = []; }
      if (S.view === 'inbox') renderList(); else if (S.view === 'overview') renderView();
    } else if (e.type === 'messages-deleted') { if (typeof galDeleted === 'function') galDeleted(e);
    } else if (e.type === 'message') {
      const m = e.message;
      if (S.sel === m.phone && S.view === 'inbox') {
        const i = S.msgs.findIndex(x => x.id === m.id); if (i >= 0) S.msgs[i] = m; else S.msgs.push(m);
        renderMsgs(); refreshSugg(); if (m.dir === 'in') api(`/conversations/${m.phone}/read`, { method: 'POST' }).catch(() => {});
      }
      if (m.dir === 'in' && typeof deskNotifyMessage === 'function') deskNotifyMessage(m);
      if (S.sim.phone === m.phone) { const i = S.sim.msgs.findIndex(x => x.id === m.id); if (i >= 0) S.sim.msgs[i] = m; else S.sim.msgs.push(m); renderSim(); }
      if (m.dir === 'in' && S.sel !== m.phone) {
        const c = S.convs.find(c => c.phone === m.phone);
        if (c && (c.agentId === S.me.id || c.status === 'waiting') && m.phone !== S.sim.phone) toast(`New message from ${c.name}`);
      }
    }
  };
}
function refreshAgentsLoad() { for (const a of S.agents) a.load = S.convs.filter(c => c.agentId === a.id && c.status === 'assigned').length; }

// ---------- shell ----------
const NAV = [['overview', 'home', 'Overview'], ['inbox', 'inbox', 'WhatsApp'], ['find', 'search', 'Find PO / P.R'], ['mail', 'mail', 'Email'], ['orgs', 'org', 'Organizations'], ['links', 'link', 'WhatsApp links'], ['groups', 'team', 'Groups'], ['orders', 'box', 'Order tracking'], ['store', 'cart', 'Store'], ['retail', 'shop', 'Retail shops'], ['team', 'team', 'Team'], ['reports', 'mail', 'Reports'], ['settings', 'cog', 'Settings']];
function renderShell() {
  const nav = NAV.filter(n => ((n[0] !== 'settings' && n[0] !== 'reports' && n[0] !== 'orgs' && n[0] !== 'links' && n[0] !== 'groups') || isAdmin()) && (n[0] !== 'retail' || canRetail()));
  $('#app').innerHTML = `
  <div class="shell ${S.collapsed ? 'collapsed' : ''}" id="shell">
    <aside class="side">
      <div class="side-top"><div class="logo"><div class="logo-mark">${ic('inbox')}</div><span class="lt">WhatsApp Desk</span></div><button class="side-toggle" id="sidetg" title="${S.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-label="Toggle sidebar">${ic(S.collapsed ? 'panelOpen' : 'panel')}</button></div>
      <nav class="nav">${nav.map(([k, i, l]) => `<button data-v="${k}" title="${l}" class="${S.view === k ? 'on' : ''}">${ic(i)}<span>${l}</span>${k === 'inbox' ? '<span class="count" id="ibadge" hidden></span>' : ''}</button>`).join('')}</nav>
      <div class="side-foot">
        <div class="conn">${connHtml()}</div>
        <div class="me">${avatar(S.me)}<div>${esc(S.me.name)}<small>${isAdmin() ? 'Administrator' : 'Team member'}</small></div><button title="Theme & background" id="thm">${ic('palette')}</button><button title="Sign out" id="lo">${ic('out')}</button></div>
      </div>
    </aside>
    <main class="main" id="main"></main>
  </div>
  <button class="fab" id="fab" ${testPhoneOn() ? '' : 'hidden style="display:none"'}>${ic('phone')} Test phone</button><div id="simhost"></div>`;
  $('.nav').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.view = b.dataset.v; location.hash = S.view; $$('.nav button').forEach(x => x.classList.toggle('on', x === b)); renderView(); };
  $('#sidetg').onclick = () => { S.collapsed = !S.collapsed; localStorage.setItem('wd_side', S.collapsed ? '1' : '0'); $('#shell').classList.toggle('collapsed', S.collapsed); const b = $('#sidetg'); b.innerHTML = ic(S.collapsed ? 'panelOpen' : 'panel'); b.title = S.collapsed ? 'Expand sidebar' : 'Collapse sidebar'; };
  $('#thm').onclick = () => openTheme(); $('#lo').onclick = logout; $('#fab').onclick = () => { S.sim.open = true; openSim(); };
  updateBadges(); renderView(); if (S.sim.open && testPhoneOn()) openSim();
}
function updateBadges() { const b = $('#ibadge'); if (!b) return; const n = S.convs.filter(c => c.status === 'waiting' || (c.agentId === S.me.id && c.unread > 0)).length; b.hidden = !n; b.textContent = n; }
function renderView() {
  if ((S.view === 'orgs' || S.view === 'links' || S.view === 'groups') && !isAdmin()) { S.view = 'overview'; location.hash = 'overview'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'overview')); }
  if (S.view === 'retail' && !canRetail()) { S.view = 'overview'; location.hash = 'overview'; $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'overview')); }
  const v = { overview: viewOverview, inbox: viewInbox, find: viewFind, mail: viewMail, orgs: viewOrgs, links: viewLinks, groups: typeof viewGroups === 'function' ? viewGroups : viewOverview, orders: viewOrders, store: viewStore, retail: viewRetail, team: viewTeam, reports: viewReports, settings: viewSettings }[S.view] || viewOverview;
  $('#main').innerHTML = ''; v();
}
const pageHead = (t, sub, actions = '') => `<div class="page-h"><div><h1>${t}</h1><p>${sub}</p></div><div class="row">${actions}</div></div>`;

// ---------- overview ----------
function viewOverview() {
  const c = S.convs.filter(x => !x.isGroup), today = new Date().setHours(0, 0, 0, 0);
  const open = c.filter(x => x.status === 'assigned').length, waiting = c.filter(x => x.status === 'waiting').length;
  const resolved = c.filter(x => x.status === 'resolved' && x.resolvedAt >= today).length, bot = c.filter(x => x.status === 'bot').length;
  const max = Math.max(1, ...S.agents.map(a => a.load || 0));
  $('#main').innerHTML = `<div class="page">
    ${pageHead('Overview', `Hello ${esc(S.me.name.split(' ')[0])} — here is what is happening in ${esc(S.settings.businessName)} today.`, `<button class="btn primary" onclick="S.view='inbox';location.hash='inbox';renderShell()">${ic('inbox')} Open inbox</button>`)}
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi"><div class="l">${ic('inbox')} With team</div><div class="v">${open}</div><div class="s">chats assigned to a person</div></div>
      <div class="card kpi"><div class="l">${ic('bolt')} Waiting</div><div class="v" style="color:${waiting ? 'var(--amber)' : 'inherit'}">${waiting}</div><div class="s">need an agent</div></div>
      <div class="card kpi"><div class="l">${ic('check')} Resolved today</div><div class="v">${resolved}</div><div class="s">${bot} chat${bot === 1 ? '' : 's'} with the bot right now</div></div>
      <div class="card kpi"><div class="l">${ic('box')} Orders in sheet</div><div class="v">${S.orderCount}</div><div class="s">answered automatically</div></div>
    </div>
    <div class="grid g2">
      <div class="card pad"><div class="h3">Team workload</div>
        ${S.agents.map(a => `<div class="load-row"><div class="row">${avatar(a, 'sm')}<span style="font-weight:600">${esc(a.name)}</span></div><div class="bar"><i style="width:${(a.load || 0) / max * 100}%;background:${a.color}"></i></div><b>${a.load || 0}</b></div>`).join('')}
        <p class="hint" style="margin-top:8px">Off-duty members are skipped by routing. Organizations fall back to their backup person.</p></div>
      <div class="card pad"><div class="h3">How a chat flows</div><div class="flow">
        <div class="step"><div class="n">1</div><div><b>Customer messages your number</b><div class="hint">The bot greets them with a tap-to-choose menu.</div></div></div>
        <div class="step"><div class="n">2</div><div><b>They say which organization they are from</b><div class="hint">Matched against your ${S.orgs.length} organizations (typos and short names work).</div></div></div>
        <div class="step"><div class="n">3</div><div><b>The chat goes to the person handling it</b><div class="hint">Primary owner first, then backup, then least busy member.</div></div></div>
        <div class="step"><div class="n">4</div><div><b>Order questions answer themselves</b><div class="hint">Looked up from your tracking sheet by Order ID or phone.</div></div></div>
      </div></div>
    </div></div>`;
}

// ---------- inbox ----------
function viewInbox() {
  $('#main').innerHTML = `<div class="inbox ${S.sel ? 'chat-open' : ''}" id="ib">
    <section class="list"><div class="list-h"><h2>Inbox</h2><div class="search">${ic('search')}<input type="search" id="q" placeholder="Search name, phone or organization" value="${esc(S.q)}"></div></div>
      <div class="tabs" id="tabs"></div><div class="convs" id="convs"></div></section>
    <section class="thread" id="thread"></section>
    <aside class="info" id="info"></aside></div>`;
  $('#q').oninput = e => { S.q = e.target.value; renderList(); };
  renderList(); renderThread(); renderInfo();
}
function tabFilter(t) {
  const c = S.convs;
  return t === 'groups' ? c.filter(x => x.isGroup && x.status !== 'resolved') : t === 'mine' ? c.filter(x => x.agentId === S.me.id && x.status === 'assigned') : t === 'waiting' ? c.filter(x => x.status === 'waiting')
    : t === 'resolved' ? c.filter(x => x.status === 'resolved') : c.filter(x => x.status !== 'resolved');
}
function renderList() {
  if (!$('#convs')) return;
  const tabs = S.ownOnly ? [['mine', 'Mine'], ['resolved', 'Resolved']] : [['mine', 'Mine'], ['waiting', 'Unassigned'], ['all', 'All'], ['resolved', 'Resolved']];   // ownOnly: a team member only has their own chats
  if (S.convs.some(x => x.isGroup)) tabs.splice(tabs.length - 1, 0, ['groups', 'Groups']);   // WhatsApp groups (members see only the ones assigned to them)
  if (!tabs.some(t => t[0] === S.tab)) S.tab = 'mine';
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<button data-t="${k}" class="${S.tab === k ? 'on' : ''}">${l}<span class="c">${tabFilter(k).length}</span></button>`).join('');
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { S.tab = b.dataset.t; renderList(); } };
  const q = S.q.toLowerCase();
  const list = tabFilter(S.tab).filter(c => !q || [c.name, c.isGroup ? '' : c.phone, c.orgName].join(' ').toLowerCase().includes(q));
  $('#convs').innerHTML = list.length ? list.map(c => {
    const a = agent(c.agentId);
    return `<button class="conv ${S.sel === c.phone ? 'on' : ''}" data-p="${c.phone}">${c.isGroup ? groupAvatar() : avatar(a || null)}
      <div class="body"><div class="top"><span class="nm">${esc(c.name)}</span><span class="tm">${fmtTime(c.updatedAt)}</span></div>
      <div class="top"><span class="cpv">${esc(c.lastPreview || '—')}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
      <div class="meta">${c.isGroup ? `<span class="pill blue">Group</span>${a ? '' : '<span class="pill amber">Not assigned</span>'}` : statusPill(c.status)}${c.orgName ? `<span class="pill violet">${esc(c.orgName)}</span>` : ''}${a && c.agentId !== S.me.id ? `<span class="hint">${esc(a.name.split(' ')[0])}</span>` : ''}</div></div></button>`;
  }).join('') : `<div class="empty"><div><div class="big">${ic('inbox')}</div><b>Nothing here</b><div class="hint">${S.tab === 'mine' ? 'Chats assigned to you will appear here.' : 'No chats match.'}</div></div></div>`;
  $('#convs').onclick = e => { const b = e.target.closest('.conv'); if (b) openConv(b.dataset.p); };
}
async function openConv(phone) {
  S.sel = phone; $('#ib') && $('#ib').classList.add('chat-open');
  try { const d = await api(`/conversations/${phone}/messages`); S.msgs = d.messages; S.selOrders = d.orders; S.sugg = d.suggestion && d.suggestion.since !== S.suggDismissed ? d.suggestion : null; S.aiOut = null; } catch (e) { toast(e.message, true); }
  const c = S.convs.find(c => c.phone === phone); if (c && c.unread) { c.unread = 0; api(`/conversations/${phone}/read`, { method: 'POST' }).catch(() => {}); updateBadges(); }
  renderList(); renderThread(); renderInfo();
}
const QUICK = ['Thanks for contacting us — one moment please.', 'Could you please share your order ID?', 'Your order is on its way 🚚', 'Is there anything else I can help you with?'];
function renderThread() {
  const el = $('#thread'); if (!el) return;
  const c = S.convs.find(c => c.phone === S.sel);
  const ibx = $('#ib'); if (ibx) ibx.classList.toggle('nochat', !c);
  if (!c) { el.innerHTML = `<div class="empty"><div><div class="big">${ic('inbox')}</div><b style="font-size:18px">WhatsApp Desk</b><div class="hint" style="margin-top:6px">Select a conversation on the left to read and reply,<br>send voice notes, photos and files.</div></div></div>`; return; }
  el.innerHTML = `<div class="thread-h" id="th"></div><div class="msgs" id="msgs"></div><div id="sugg"></div><div id="cmpwrap"></div>`;
  renderThreadHead(); renderMsgs(); renderSugg();
  $('#cmpwrap').innerHTML = composerHtml(); if (c.isGroup) { const q = $('.qr'); if (q) q.remove(); }   // the customer quick replies make no sense in a group
  const ta = $('#ctext');
  $$('.qr button').forEach(b => b.onclick = () => { ta.value = b.textContent; ta.dispatchEvent(new Event('input')); ta.focus(); });
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#cf').requestSubmit(); } };
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
  $('#cf').onsubmit = async e => {
    e.preventDefault(); const text = ta.value.trim(); if (!text) return; ta.value = ''; ta.style.height = 'auto';
    try { await api(`/conversations/${S.sel}/send`, { method: 'POST', body: { text } }); } catch (err) { toast(err.message, true); ta.value = text; }
  };
  bindComposer(ta);
  ta.focus();
}
function renderThreadHead() {
  const c = S.convs.find(c => c.phone === S.sel), el = $('#th'); if (!c || !el) return; const a = agent(c.agentId);
  const lock = c.isGroup && !isAdmin();   // in a group a team member can only chat and call: assigning / resolving is for the administrator
  el.innerHTML = `<button class="btn ghost sm back" id="bk">${ic('back')}</button>${c.isGroup ? groupAvatar('lg') : avatar(a || null, 'lg')}
    <div class="t"><b>${esc(c.name)}</b><span>${c.isGroup ? 'WhatsApp group' + (a ? ' · ' + esc(a.name) : ' · not assigned') : '+' + esc(c.phone) + (c.orgName ? ' · ' + esc(c.orgName) : '')}</span></div>${c.isGroup ? '' : statusPill(c.status)}
    ${lock ? '' : `<select id="tr" style="width:auto;max-width:${c.isGroup ? 150 : 260}px;padding:6px 10px"><option value="">${c.isGroup ? 'Nobody (not assigned)' : 'Assign to…'}</option>${S.agents.filter(x => x.active).map(x => `<option value="${x.id}" ${x.id === c.agentId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    ${c.status === 'resolved' ? `<button class="btn sm" id="ro">Reopen</button>` : `<button class="btn sm primary" id="rs">${ic('check')} Resolve</button>`}`}`;
  $('#bk').onclick = () => { S.sel = null; $('#ib').classList.remove('chat-open'); renderThread(); renderList(); renderInfo(); };
  if ($('#tr')) $('#tr').onchange = async e => { if (!e.target.value && !c.isGroup) return; try { await api(`/conversations/${c.phone}/assign`, { method: 'POST', body: { agentId: e.target.value } }); toast(c.isGroup ? 'Group assignment saved' : 'Chat reassigned'); } catch (err) { toast(err.message, true); } };
  const rs = $('#rs'); if (rs) rs.onclick = async () => { try { await api(`/conversations/${c.phone}/resolve`, { method: 'POST' }); toast('Marked as resolved'); } catch (err) { toast(err.message, true); } };
  const ro = $('#ro'); if (ro) ro.onclick = async () => { try { await api(`/conversations/${c.phone}/reopen`, { method: 'POST' }); } catch (err) { toast(err.message, true); } };
  afterHead(c);
}
// chat text: web addresses become clickable links and *bold* shows bold, like in WhatsApp
const rich = t => esc(t).replace(/(https?:\/\/[^\s<]+?)([.,;:!?)\]]*)(?=\s|$)/g, (_, u, tail) => `<a href="${u}" target="_blank" rel="noopener" style="color:#0a66c2;text-decoration:underline;word-break:break-all">${u}</a>${tail}`).replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:])/g, '$1<b>$2</b>');
function bubble(m, sim) {
  if (m.dir === 'sys') return `<div class="sys">${esc(m.text)}</div>`;
  const out = m.dir === 'out';
  const who = !sim && out ? (m.from === 'bot' ? `<div class="w bot">${ic('bolt')} Auto-reply</div>` : m.from === 'phone' ? `<div class="w ag">${ic('phone')} Sent from the phone</div>` : `<div class="w ag">${esc(m.agentName || 'Team')}</div>`) : '';
  const opts = m.options && !sim ? `<div class="opts">${m.options.map(o => `<span>${esc(o.title)}</span>`).join('')}</div>` : '';
  const sn = !out && m.sender && (m.sender.name || m.sender.phone) ? `<div class="w sn">${esc(m.sender.name || '+' + m.sender.phone)}${m.sender.name && m.sender.phone ? `<small>+${esc(m.sender.phone)}</small>` : ''}</div>` : '';
  return `<div class="m ${out ? 'out' : 'in'} ${m.error ? 'err' : ''}">${who}${sn}${mediaHtml(m)}${m.text ? `<div class="mt">${rich(m.text)}</div>` : ''}${(m.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" style="display:block;margin-top:8px;padding:8px;text-align:center;border-top:1px solid #0001;color:#0a66c2;font-weight:600;text-decoration:none">↗ ${esc(l.text)}</a>`).join('')}${opts}<div class="ts">${fmtTime(m.ts)}${m.error ? ' · not delivered: ' + esc(m.error) : ''}</div></div>`;
}
function renderMsgs() {
  const el = $('#msgs'); if (!el) return; let last = '', html = '';
  const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120 || !el.dataset.init;
  for (const m of S.msgs) { const d = dayLabel(m.ts); if (d !== last) { html += `<div class="day">${d}</div>`; last = d; } html += bubble(m); }
  el.innerHTML = html; el.dataset.init = 1; if (stick) el.scrollTop = el.scrollHeight;
}
function renderInfo() {
  const el = $('#info'); if (!el) return; const c = S.convs.find(c => c.phone === S.sel);
  if (!c) { el.innerHTML = `<div class="empty"><div class="hint">Customer details appear here.</div></div>`; return; }
  const a = agent(c.agentId), org = S.orgs.find(o => o.id === c.orgId);
  if (c.isGroup) {
    el.innerHTML = `<div class="who1">${groupAvatar('lg')}<b style="font-size:16px">${esc(c.name)}</b><div class="hint">WhatsApp group</div></div>
      <h4>Group</h4>
      <div class="kv"><span>Handled by</span><b>${a ? esc(a.name) : 'Not assigned'}</b></div>
      <div class="kv"><span>First seen</span><b>${new Date(c.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</b></div>
      <div class="hint" style="margin-top:12px">${isAdmin() ? 'You can assign this group to a team member from the box at the top of the chat or on the Groups page. They can chat and voice-call in it; you can do everything.' : 'You can chat and start a voice call in this group. Assigning, resolving and deleting are done by the administrator.'}</div>`;
    return afterInfo(c);
  }
  el.innerHTML = `<div class="who1">${avatar(a || null, 'lg')}<b style="font-size:16px">${esc(c.name)}</b><div class="hint">+${esc(c.phone)}</div></div>
    <h4>Chat</h4>
    <div class="kv"><span>Status</span><b>${statusPill(c.status)}</b></div>
    <div class="kv"><span>Organization</span><b>${esc(c.orgName || '—')}</b></div>
    ${c.retailId ? `<div class="kv"><span>Retail shop</span><b>${esc(c.retailName)}</b></div><div class="kv"><span>Account no</span><b>${esc(c.retailId)}</b></div><div class="kv"><span>Region</span><b>${esc(c.retailRegion || '—')}</b></div>` : ''}
    <div class="kv"><span>Handled by</span><b>${a ? esc(a.name) : '—'}</b></div>
    ${org && org.backupAgentId ? `<div class="kv"><span>Backup</span><b>${esc((agent(org.backupAgentId) || {}).name || '—')}</b></div>` : ''}
    <div class="kv"><span>First seen</span><b>${new Date(c.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</b></div>
    <h4 style="margin-top:20px">Orders for this number</h4>
    ${S.selOrders.length ? S.selOrders.map(o => `<div class="ord"><div class="r"><b>${esc(o.orderId)}</b>${orderPill(o.status)}</div><small>${esc([o.courier, o.updated].filter(Boolean).join(' · ') || 'No courier yet')}</small>${o.notes ? `<small>${esc(o.notes)}</small>` : ''}${wooLinks(o)}</div>`).join('') : '<div class="hint">No orders in the tracking sheet match this number.</div>'}`;
  afterInfo(c);
}

// ---------- organizations ----------
function agentOptions(sel, blank = '— None —') { return `<option value="">${blank}</option>` + S.agents.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}${a.active ? '' : ' (off duty)'}</option>`).join(''); }
function viewOrgs() {
  const ad = isAdmin();
  $('#main').innerHTML = `<div class="page">${pageHead('Organizations', 'When a customer names one of these, their chat goes to the person assigned here.', ad ? `<button class="btn primary" id="addo">${ic('plus')} Add organization</button>` : '')}
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Organization</th><th>Also recognised as</th><th>Handled by</th><th>Backup</th><th></th></tr></thead><tbody>
    ${S.orgs.map(o => `<tr data-id="${o.id}"><td><b>${esc(o.name)}</b></td><td><div class="chips">${(o.aliases || []).map(x => `<span class="pill">${esc(x)}</span>`).join('') || '<span class="hint">—</span>'}</div></td>
      <td><select data-k="agentId" ${ad ? '' : 'disabled'}>${agentOptions(o.agentId)}</select></td><td><select data-k="backupAgentId" ${ad ? '' : 'disabled'}>${agentOptions(o.backupAgentId)}</select></td>
      <td style="text-align:right;white-space:nowrap">${ad ? `<button class="btn sm ghost" data-e="1">Edit</button><button class="btn sm ghost danger" data-d="1">${ic('trash')}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty" style="padding:30px">No organizations yet.</div></td></tr>`}
    </tbody></table></div></div>
    <p class="hint" style="margin-top:12px">Customers who name an organization that is not on this list are passed to the least busy team member, and the name they typed is saved on the chat.</p></div>`;
  if (!ad) return;
  const form = o => { o = o || {}; return `<h3>${o.id ? 'Edit' : 'Add'} organization</h3>
    <div class="field"><label>Organization name</label><input type="text" id="on" value="${esc(o.name || '')}" placeholder="e.g. Hilton Hotels"></div>
    <div class="field"><label>Other names people may use (comma separated)</label><input type="text" id="oa" value="${esc((o.aliases || []).join(', '))}" placeholder="hilton, hilton uk"></div>
    <div class="field"><label>Email domains or addresses (mail from these goes to the person below)</label><input type="text" id="oem" value="${esc((o.emails || []).join(', '))}" placeholder="hilton.com, buyer@hilton.com"></div>
    <div class="field"><label>Handled by</label><select id="oag">${agentOptions(o.agentId, 'Choose a person')}</select></div>
    <div class="field"><label>Backup (used when the main person is off duty)</label><select id="obk">${agentOptions(o.backupAgentId)}</select></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`; };
  const edit = o => modal(form(o), (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => {
      const body = { name: $('#on', bg).value, aliases: $('#oa', bg).value.split(','), emails: $('#oem', bg).value.split(','), agentId: $('#oag', bg).value, backupAgentId: $('#obk', bg).value };
      try { if (o) await api('/organizations/' + o.id, { method: 'PATCH', body }); else await api('/organizations', { method: 'POST', body }); close(); await reload(); viewOrgs(); toast('Saved'); } catch (e) { toast(e.message, true); }
    };
  });
  $('#addo').onclick = () => edit(null);
  $('tbody').onchange = async e => { const tr = e.target.closest('tr'); try { await api('/organizations/' + tr.dataset.id, { method: 'PATCH', body: { [e.target.dataset.k]: e.target.value } }); await reload(); toast('Routing updated'); } catch (err) { toast(err.message, true); } };
  $('tbody').onclick = async e => {
    const tr = e.target.closest('tr'); if (!tr) return; const o = S.orgs.find(x => x.id === tr.dataset.id);
    if (e.target.closest('[data-e]')) edit(o);
    if (e.target.closest('[data-d]') && confirm(`Remove ${o.name}?`)) { await api('/organizations/' + o.id, { method: 'DELETE' }); await reload(); viewOrgs(); }
  };
}
async function reload() { const d = await api('/bootstrap'); Object.assign(S, { ownOnly: !!d.ownOnly, retailRegionList: d.retailRegionList || S.retailRegionList || [], agents: d.agents, orgs: d.organizations, settings: d.settings, convs: d.conversations, orderCount: d.orderCount }); }

// ---------- orders ----------
async function viewOrders() {
  const [d, sy] = await Promise.all([api('/orders'), api('/sources')]); S.orders = d.orders; S.orderCount = d.orders.length; S.srcs = sy.sources; S.ms = sy.ms; drawOrders();
}
const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
const needsMs = e => /error 401|unauthenticated|without a Microsoft sign-in/i.test(e || '');

function msStrip() {
  const m = S.ms || {}, ad = isAdmin();
  return `<div class="card pad" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div><div class="h3" style="margin:0">Microsoft sign-in <span class="hint" style="font-weight:500">(only needed for OneDrive / Excel links)</span></div>
    <div class="hint" style="margin-top:4px">${m.signedIn ? `Signed in${m.account ? ' as <b>' + esc(m.account) + '</b>' : ''}. Private OneDrive and SharePoint links can be read.` : m.clientId ? 'App (client) ID saved. Press <b>Set up</b> and sign in once.' : 'Add your Microsoft app (client) ID so OneDrive links connect without the "unauthenticated" error.'}</div></div>
    <div class="row">${m.signedIn ? '<span class="pill green">Connected</span>' : '<span class="pill">Not connected</span>'}${ad ? `<button class="btn ${m.signedIn ? '' : 'primary'}" id="msbtn">${m.signedIn ? 'Manage' : 'Set up'}</button>` : ''}</div></div></div>`;
}

function srcCard(s) {
  const ad = isAdmin(), on = !!s.url;
  const pill = on ? (s.lastError ? '<span class="pill red">Sync problem</span>' : s.lastSync ? `<span class="pill green">Live · synced ${ago(s.lastSync)}</span>` : '<span class="pill amber">Waiting for first sync</span>') : '<span class="pill blue">Uploaded by hand</span>';
  return `<div class="card pad" data-sid="${s.id}" style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div class="row" style="gap:10px"><div class="avatar" style="background:var(--brand)">${esc(initials(s.name))}</div><div><b style="font-size:16px">${esc(s.name)}</b><div class="hint">${s.orders} order${s.orders === 1 ? '' : 's'} in this sheet</div></div></div>${pill}</div>
    ${s.lastError ? `<div class="notice" style="margin:0 0 12px;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(s.lastError)}${needsMs(s.lastError) && ad && !(S.ms && S.ms.signedIn) ? `<div style="margin-top:8px"><button class="btn sm primary" data-ms="1">Fix with Microsoft sign-in</button></div>` : ''}</div>` : ''}
    <div class="row" style="flex-wrap:wrap"><input type="text" data-f="name" style="width:150px" value="${esc(s.name)}" title="Company / sheet name" ${ad ? '' : 'disabled'}>
      <input type="text" data-f="url" style="flex:1;min-width:240px" placeholder="OneDrive / SharePoint share link, or leave empty and upload a file below" value="${esc(s.url)}" ${ad ? '' : 'disabled'}>
      <select data-f="minutes" style="width:auto" ${ad ? '' : 'disabled'}>${[1, 2, 5, 10, 15, 30, 60].map(n => `<option value="${n}" ${n === s.minutes ? 'selected' : ''}>every ${n} min</option>`).join('')}</select>
      ${ad ? `<button class="btn primary" data-a="save">Save</button>${on ? '<button class="btn" data-a="sync">Sync now</button>' : ''}<button class="btn" data-a="cols">${ic('cog')} Columns</button><button class="btn danger" data-a="del" title="Remove this sheet and its orders">${ic('trash')}</button>` : ''}</div>
    ${on || !ad ? '' : `<div style="margin-top:12px"><label class="drop" for="file_${s.id}" data-drop="${s.id}" style="padding:16px">${ic('up')}<b>Drop ${esc(s.name)}'s Excel file here, or click to browse</b><input type="file" id="file_${s.id}" data-file="${s.id}" accept=".xlsx" hidden></label>
      <div class="row" style="margin-top:8px;gap:18px;flex-wrap:wrap"><label class="row" style="gap:6px"><input type="radio" name="mode_${s.id}" value="replace" checked> Replace this company's orders</label><label class="row" style="gap:6px"><input type="radio" name="mode_${s.id}" value="merge"> Merge — update matching IDs, keep the rest</label></div></div>`}
  </div>`;
}

function addSheet() {
  modal(`<h3>Add a company sheet</h3><p class="hint" style="margin:-8px 0 14px">One sheet per company (BAFL, another client…). A customer who sends a PO / P.R / CN number gets the answer from whichever sheet contains it. If the customer already said which organization they are from, that company's sheet is used first.</p>
    <div class="field"><label>Company / sheet name</label><input type="text" id="an" placeholder="e.g. BAFL"></div>
    <div class="field"><label>OneDrive / SharePoint share link <span class="hint">(optional — or upload a file after adding)</span></label><input type="text" id="au" placeholder="https://1drv.ms/x/…"></div>
    <div class="field"><label>Check for changes</label><select id="am">${[1, 2, 5, 10, 15, 30, 60].map(n => `<option value="${n}" ${n === 5 ? 'selected' : ''}>every ${n} min</option>`).join('')}</select></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Add sheet</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; setTimeout(() => $('#an', bg).focus(), 30);
    $('#sv', bg).onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Adding…';
      try { const s = await api('/sources', { method: 'POST', body: { name: $('#an', bg).value, url: $('#au', bg).value, minutes: $('#am', bg).value } }); close(); toast(s.lastError ? 'Sheet added, but it could not be read yet — see the red message' : `${esc(s.name)} added`, !!s.lastError); viewOrders(); }
      catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = 'Add sheet'; }
    };
  });
}

// when an order first appeared (stamped on each sync; the very first read of a sheet is only the starting point)
const dayStart = (back = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - back * 864e5; };
function addedOk(o, mode) {
  if (!mode) return true; const t = o.addedAt || 0; if (!t) return false;
  return mode === 'today' ? t >= dayStart() : mode === 'yday' ? t >= dayStart(1) && t < dayStart() : t >= dayStart(6);
}
function newTodayCard() {
  const today = S.orders.filter(o => addedOk(o, 'today')), by = {};
  today.forEach(o => { const k = o.src || o.company || ''; by[k] = (by[k] || 0) + 1; });
  const name = id => { const s = (S.srcs || []).find(x => x.id === id); return s ? s.name : id || 'Other'; };
  const y = S.orders.filter(o => addedOk(o, 'yday')).length, w = S.orders.filter(o => addedOk(o, '7')).length;
  return `<div class="card pad" style="margin-bottom:16px"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
    <div><div class="h3" style="margin:0">New POs added today</div><div class="hint" style="margin-top:4px">Counted each time a company sheet syncs. Yesterday: <b>${y}</b> · Last 7 days: <b>${w}</b> · Total: <b>${S.orders.length}</b></div></div>
    <div style="font-size:30px;font-weight:800;line-height:1">${today.length}</div></div>
    <div class="chips" style="margin-top:10px">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="pill violet" data-nt="${esc(k)}" style="cursor:pointer;border:0" title="Show only these">${esc(name(k))} · ${n}</button>`).join('') || '<span class="hint">Nothing new today yet. New rows appear here after the next sync.</span>'}</div></div>`;
}

function drawOrders() {
  const counts = {}; S.orders.forEach(o => { const k = o.status || 'Received'; counts[k] = (counts[k] || 0) + 1; });
  const live = id => { const s = (S.srcs || []).find(x => x.id === id); return s && s.url; };
  const ad = isAdmin();
  $('#main').innerHTML = `<div class="page">${pageHead('Order tracking', ad ? 'Customers send a PO, P.R or CN number on WhatsApp and get the status and details from the matching company sheet.' : 'Orders of the companies assigned to you. Search by PO, P.R, CN, address or customer.', `${ad ? `<button class="btn primary" id="adds">${ic('plus')} Add company sheet</button>` : ''}<a class="btn" href="/api/orders/template?token=${encodeURIComponent(S.token)}">${ic('down')} Excel template</a>`)}
    ${ad ? msStrip() : ''}
    ${ad ? newTodayCard() : ''}
    <div id="srcs" ${ad ? '' : 'hidden'}>${(S.srcs || []).map(srcCard).join('') || `<div class="card empty" style="padding:36px;margin-bottom:16px"><div><div class="big">${ic('box')}</div><b style="font-size:16px">No company sheets yet</b><div class="hint" style="margin-top:4px">${ad ? 'Press <b>Add company sheet</b>, name it (e.g. BAFL) and paste its OneDrive link or upload its Excel file.' : 'Ask an administrator to add the order sheets.'}</div></div></div>`}</div>
    ${!ad && !S.orders.length ? `<div class="card empty" style="padding:30px;margin-bottom:16px"><div><div class="big">${ic('box')}</div><b style="font-size:16px">No company assigned to you yet</b><div class="hint" style="margin-top:4px">You see the orders of the companies the administrator assigned to you (Organizations → Handled by / Backup).</div></div></div>` : ''}
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap"><div class="search" style="flex:1;min-width:220px">${ic('search')}<input type="search" id="oq" placeholder="Search PO, P.R, CN, address, customer" value="${esc(S.orderQ)}"></div>
      ${ad ? `<select id="oadd" style="width:auto">${[['', 'Added: any time'], ['today', 'Added today'], ['yday', 'Added yesterday'], ['7', 'Added last 7 days']].map(([v, l]) => `<option value="${v}" ${S.orderAdd === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      ${(S.srcs || []).length > 1 ? `<select id="ocmp" style="width:auto"><option value="">All companies</option>${S.srcs.map(s => `<option value="${s.id}" ${S.orderSrc === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}
      ${Object.entries(counts).map(([k, v]) => `<span>${orderPill(k)} <b>${v}</b></span>`).join('')}<span class="hint" id="ocount"></span></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>PO / P.R no</th><th>Company</th><th>CN no</th><th>Details</th><th>Status</th><th>Courier</th><th>Updated</th></tr></thead><tbody id="obody"></tbody></table></div></div></div>`;
  const rows = () => {
    const q = S.orderQ.toLowerCase(); const l = S.orders.filter(o => (!S.orderSrc || o.src === S.orderSrc) && addedOk(o, S.orderAdd) && (!q || Object.values(o).join(' ').toLowerCase().includes(q))).slice(0, 400);
    const cnt = $('#ocount'); if (cnt) cnt.textContent = `${l.length >= 400 ? '400+' : l.length} shown`;
    $('#obody').innerHTML = l.map(o => `<tr data-id="${esc(o.orderId)}" data-src="${esc(o.src || '')}"><td><b>${esc(o.po || o.orderId)}</b><div class="hint">${o.pr ? 'PR ' + esc(o.pr) : ''}${o.customer ? ' · ' + esc(o.customer) : ''}</div></td><td><span class="pill violet">${esc(o.company || '—')}</span></td><td>${esc(o.cn || '—')}</td>
      <td class="hint" style="max-width:340px">${esc((o.extra || []).filter(x => /address|location|branch/i.test(x[0])).map(x => x[1]).join(' ') || o.notes || '')}${wooLinks(o)}${(o.extra || []).length ? `<div>${esc((o.extra || []).filter(x => !/address|location|branch/i.test(x[0])).slice(0, 4).map(x => x[0] + ': ' + x[1]).join(' · '))}</div>` : ''}</td>
      <td><select class="st" style="width:auto;padding:4px 8px" ${o.woo ? 'disabled title="This order comes from your WooCommerce shop: change its status in WordPress"' : live(o.src) ? 'disabled title="This sheet is read live: change the status in its Excel file"' : ''}>${[...new Set([o.status || 'Pending', ...ORDER_STATUSES])].map(s => `<option ${s === (o.status || 'Pending') ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>${o.receivedBy ? `<div class="hint" title="Received by">✔ ${esc(o.receivedBy)}</div>` : ''}</td>
      <td>${o.trackUrl && /^https?:/.test(o.trackUrl) ? `<a href="${esc(o.trackUrl)}" target="_blank" rel="noopener" title="Track CN ${esc(o.cn || '')} on the courier website" style="color:var(--brand);font-weight:600">${esc(o.courier || 'Track')} ↗</a>` : esc(o.courier || '—')}</td><td>${esc(o.updated || '')}</td></tr>`).join('') || `<tr><td colspan="7"><div class="empty" style="padding:30px">No orders yet. Add a company sheet above.</div></td></tr>`;
  };
  rows();
  if ($('#adds')) $('#adds').onclick = addSheet;
  if ($('#msbtn')) $('#msbtn').onclick = msSetup;
  $('#oq').oninput = e => { S.orderQ = e.target.value; rows(); };
  if ($('#oadd')) $('#oadd').onchange = e => { S.orderAdd = e.target.value; rows(); };
  document.querySelectorAll('[data-nt]').forEach(b => b.onclick = () => { S.orderSrc = b.dataset.nt; S.orderAdd = 'today'; drawOrders(); });
  if ($('#ocmp')) $('#ocmp').onchange = e => { S.orderSrc = e.target.value; rows(); };
  $('#obody').onchange = async e => {
    if (!e.target.classList.contains('st')) return; const tr = e.target.closest('tr'), id = tr.dataset.id;
    try { const o = await api('/orders/' + encodeURIComponent(id), { method: 'PATCH', body: { status: e.target.value } }); Object.assign(S.orders.find(x => x.orderId === id && (x.src || '') === tr.dataset.src), o); toast('Status updated — customers will see it right away'); } catch (err) { toast(err.message, true); }
  };
  const up = async (sid, f) => {
    if (!f) return; const mode = ($(`input[name=mode_${sid}]:checked`) || { value: 'replace' }).value;
    try { const r = await api(`/sources/${sid}/upload?mode=${mode}`, { method: 'POST', raw: await f.arrayBuffer() }); toast(`${r.count} orders imported`); viewOrders(); }
    catch (err) { toast(err.message, true); }
  };
  const box = $('#srcs');
  box.onchange = e => { if (e.target.dataset.file) up(e.target.dataset.file, e.target.files[0]); };
  box.onclick = async e => {
    const card = e.target.closest('[data-sid]'); if (!card) return; const sid = card.dataset.sid, s = S.srcs.find(x => x.id === sid), btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.ms) return msSetup();
    const a = btn.dataset.a, val = f => $(`[data-f=${f}]`, card).value;
    try {
      if (a === 'save') { btn.disabled = true; const r = await api('/sources/' + sid, { method: 'PUT', body: { name: val('name'), url: val('url'), minutes: val('minutes') } }); toast(r.lastError ? 'Saved, but the sheet could not be read — see the red message' : 'Saved', !!r.lastError); viewOrders(); }
      if (a === 'sync') { btn.disabled = true; btn.textContent = 'Syncing…'; try { const r = await api(`/sources/${sid}/sync`, { method: 'POST' }); toast(`Synced ${r.count} orders for ${s.name}`); } catch (err) { toast(err.message, true); } viewOrders(); }
      if (a === 'cols') sheetSetup(sid);
      if (a === 'del' && confirm(`Remove "${s.name}" and its ${s.orders} orders from the app? (Your Excel file is not touched.)`)) { await api('/sources/' + sid, { method: 'DELETE' }); toast('Sheet removed'); viewOrders(); }
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };
  $$('[data-drop]').forEach(dz => { ['dragenter', 'dragover'].forEach(n => dz.addEventListener(n, e => { e.preventDefault(); dz.classList.add('over'); })); ['dragleave', 'drop'].forEach(n => dz.addEventListener(n, e => { e.preventDefault(); dz.classList.remove('over'); })); dz.addEventListener('drop', e => up(dz.dataset.drop, e.dataTransfer.files[0])); });
}

// ---------- Microsoft app (client) ID sign-in ----------
function msSetup() {
  let timer;
  modal(`<div id="msbody"></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '560px';
    const body = $('#msbody', bg); let st = null;
    const stop = () => clearInterval(timer);
    const draw = () => {
      const m = st, wait = m.pending && m.pending.userCode;
      body.innerHTML = `<h3>Microsoft sign-in</h3>
        <p class="hint" style="margin:-8px 0 14px">Only needed for <b>OneDrive / Excel</b> links. Enter your Microsoft app (client) ID once and sign in once; after that the desk can read your Excel files even when OneDrive refuses anonymous downloads. It only ever <b>reads</b> files.</p>
        <div class="field"><label>Microsoft app (client) ID</label><input type="text" id="mcid" value="${esc(m.clientId)}" placeholder="8a1b2c3d-1234-5678-9abc-def012345678" spellcheck="false" ${m.fromEnv ? 'disabled' : ''}>${m.fromEnv ? '<div class="hint">Set by MS_CLIENT_ID in the .env file.</div>' : ''}</div>
        <div class="field"><label>Tenant <span class="hint">(optional — leave empty for "common")</span></label><input type="text" id="mten" value="${esc(m.tenant)}" placeholder="common"></div>
        ${m.error ? `<div class="notice" style="margin:0 0 12px;background:var(--red-soft);color:var(--red);word-break:break-word">${esc(m.error)}</div>` : ''}
        ${m.signedIn ? `<div class="notice" style="margin:0 0 12px;background:var(--brand-soft);color:var(--brand)">Signed in${m.account ? ' as ' + esc(m.account) : ''}. You can press <b>Sync now</b> on any sheet.</div>` : ''}
        ${wait ? `<div class="card pad" style="margin:0 0 12px;text-align:center"><div class="hint">1. Open <a href="${esc(m.pending.url)}" target="_blank" rel="noopener" style="color:var(--brand);font-weight:700">${esc(m.pending.url)}</a><br>2. Type this code and sign in with the Microsoft account that can open your Excel file:</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:.12em;margin:10px 0;user-select:all">${esc(m.pending.userCode)}</div><div class="hint">Waiting for you to finish… this window updates by itself.</div></div>`
          : m.pending && m.pending.error ? `<div class="notice" style="margin:0 0 12px;background:var(--red-soft);color:var(--red)">${esc(m.pending.error)}</div>` : ''}
        <div class="acts" style="justify-content:space-between;flex-wrap:wrap"><div class="row">${m.signedIn ? '<button class="btn danger" id="mso">Sign out</button>' : ''}</div><div class="row"><button class="btn" id="cx">Close</button><button class="btn" id="msv">Save</button><button class="btn primary" id="msl">${m.signedIn ? 'Sign in again' : 'Sign in with Microsoft'}</button></div></div>
        <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700;font-size:13px">How do I get a client ID? (2 minutes, free)</summary>
          <ol class="hint" style="margin:10px 0 0 18px;line-height:1.7">
            <li>Open <b>portal.azure.com</b> and sign in (a free Microsoft account works) → search <b>App registrations</b> → <b>New registration</b>.</li>
            <li>Name: <b>WhatsApp Desk</b>. Supported account types: <b>Accounts in any organizational directory and personal Microsoft accounts</b>. Leave Redirect URI empty → <b>Register</b>.</li>
            <li>Copy the <b>Application (client) ID</b> from the overview page and paste it above.</li>
            <li>Left menu <b>Authentication</b> → <b>Advanced settings</b> → <b>Allow public client flows = Yes</b> → Save.</li>
            <li>Left menu <b>API permissions</b> → Add a permission → Microsoft Graph → <b>Delegated</b> → <b>Files.Read.All</b> → Add. (If your company asks for it, press "Grant admin consent".)</li>
            <li>Back here: <b>Save</b>, then <b>Sign in with Microsoft</b>. Use the account that can open the shared Excel link (for example the BAFL sheet).</li></ol></details>`;
      $('#cx', body).onclick = () => { stop(); close(); viewOrders(); };
      $('#msv', body).onclick = save;
      $('#msl', body).onclick = async () => { try { await save(true); st = await api('/ms/login', { method: 'POST' }); draw(); watch(); } catch (e) { toast(e.message, true); try { st = await api('/ms'); draw(); } catch {} } };
      if ($('#mso', body)) $('#mso', body).onclick = async () => { st = await api('/ms/logout', { method: 'POST' }); draw(); };
    };
    const save = async quiet => { st = await api('/ms', { method: 'PUT', body: { clientId: $('#mcid', body).disabled ? st.clientId : $('#mcid', body).value, tenant: $('#mten', body).value } }); if (!quiet) { draw(); toast('Saved'); } };
    const watch = () => { stop(); timer = setInterval(async () => { if (!document.body.contains(bg)) return stop(); try { const was = st.signedIn; st = await api('/ms'); if (!st.pending || st.signedIn !== was) { draw(); if (st.signedIn && !was) { toast('Signed in to Microsoft'); stop(); } } else if (st.pending && st.pending.error) { draw(); stop(); } } catch { /* keep waiting */ } }, 3000); };
    api('/ms').then(r => { st = r; draw(); if (st.pending && st.pending.userCode) watch(); }).catch(e => { toast(e.message, true); close(); });
  });
}

// ---------- team ----------
function viewTeam() {
  const ad = isAdmin();
  $('#main').innerHTML = `<div class="page">${pageHead('Team', 'Everyone who can answer customers. Switch someone off duty and routing skips them.', ad ? `<button class="btn primary" id="addm">${ic('plus')} Add team member</button>` : '')}
    <div class="team">${S.agents.map(a => {
      const orgs = S.orgs.filter(o => o.agentId === a.id); const can = ad || a.id === S.me.id;
      const open = S.teamOpen && S.teamOpen.has(a.id), self = a.id === S.me.id;
      const regionsHtml = a.role === 'admin' ? '<div class="hint">All regions</div>' : `<div class="chips">${(S.retailRegionList || []).map(g => `<label class="chk rc"><input type="checkbox" data-rr="${esc(g.code)}" ${(a.retailRegions || []).includes(g.code) ? 'checked' : ''}><span>${esc(g.name)}</span></label>`).join('') || '<span class="hint">No regions yet</span>'}</div>`;
      return `<div class="card person ${open ? 'open' : ''}" data-id="${a.id}">
        <div class="hd">${avatar(a, 'lg')}<div class="who-t"><b>${esc(a.name)}</b><span class="hint">${a.role === 'admin' ? 'Administrator' : 'Team member'}${a.username ? ' · @' + esc(a.username) : ''}</span><span class="hint">${a.load || 0} open chat${a.load === 1 ? '' : 's'}</span></div>
          <label class="switch" title="On duty"><input type="checkbox" ${a.active ? 'checked' : ''} ${can ? '' : 'disabled'}><i></i></label></div>
        ${a.phone ? `<div class="ph-line"><span>+${esc(normPhone(a.phone))}</span><div class="cbtns">${contactBtns(a.phone, a.name)}</div></div>` : ''}
        <div class="la"><div class="lbl">Looks after</div><div class="chips">${orgs.map(o => `<span class="pill violet">${esc(o.name)}</span>`).join('') || '<span class="hint">No organizations assigned</span>'}</div></div>
        ${ad ? (() => { const gs = S.convs.filter(x => x.isGroup && x.agentId === a.id); return gs.length ? `<div class="la"><div class="lbl">WhatsApp groups</div><div class="chips">${gs.map(g => `<span class="pill blue">${esc(g.name)}</span>`).join('')}</div></div>` : ''; })() : ''}
        ${!ad && (a.retailRegions || []).length && a.role !== 'admin' ? `<div class="chips">${(a.retailRegions || []).map(c => `<span class="pill violet">Retail · ${esc(((S.retailRegionList || []).find(g => g.code === c) || {}).name || c)}</span>`).join('')}</div>` : ''}
        ${can ? `<button class="btn sm setbtn" data-set="1" aria-expanded="${open ? 'true' : 'false'}">${ic('cog')} Settings<span class="car"></span></button>
        <div class="setpanel">
          <div class="srow"><div class="lbl">Phone / WhatsApp</div><div class="sval"><span>${a.phone ? '+' + esc(normPhone(a.phone)) : 'Not saved'}</span><button class="btn sm" data-ph="1">${a.phone ? 'Change' : 'Add'}</button></div></div>
          <div class="srow"><div class="lbl">Sign-in</div><div class="sval"><span>${a.username ? '@' + esc(a.username) : '—'}</span><button class="btn sm" data-pin="1">${ad && !self ? 'Username & password' : 'Change password'}</button></div></div>
          ${ad ? `<div class="srow"><div class="lbl" title="This person sees Retail shops, invoices and chats only for the regions you tick">Retail regions (sees only these)</div>${regionsHtml}</div>` : ''}
          ${ad && !self ? `<div class="srow end"><button class="btn sm danger" data-del="1">Remove from team</button></div>` : ''}
        </div>` : ''}</div>`;
    }).join('')}</div></div>`;
  $('.team').onchange = async e => { const id = e.target.closest('.person').dataset.id;
    if (e.target.dataset.rr !== undefined) { const codes = [...e.target.closest('.person').querySelectorAll('[data-rr]:checked')].map(x => x.dataset.rr); try { await api('/agents/' + id, { method: 'PATCH', body: { retailRegions: codes } }); await reload(); viewTeam(); toast(codes.length ? 'Retail regions saved' : 'Retail shops hidden for this person'); } catch (err) { toast(err.message, true); e.target.checked = !e.target.checked; } return; }
    try { await api('/agents/' + id, { method: 'PATCH', body: { active: e.target.checked } }); await reload(); viewTeam(); toast(e.target.checked ? 'On duty' : 'Off duty — chats will route to others'); } catch (err) { toast(err.message, true); } };
  $('.team').onclick = async e => {
    const id = e.target.closest('.person') && e.target.closest('.person').dataset.id, a = agent(id);
    const tg = e.target.closest('[data-set]'); if (tg) { const card = tg.closest('.person'), on = card.classList.toggle('open'); tg.setAttribute('aria-expanded', on); S.teamOpen = S.teamOpen || new Set(); on ? S.teamOpen.add(id) : S.teamOpen.delete(id); return; }
    if (e.target.closest('[data-ph]')) return modal(`<h3>Phone for ${esc(a.name)}</h3><div class="field"><label>Phone / WhatsApp number with country code</label><input type="tel" id="ph" value="${esc(a.phone || '')}" placeholder="923001234567"><div class="hint">Customers and teammates use this to call or message ${esc(a.name.split(' ')[0])}.</div></div><div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => { $('#cx', bg).onclick = close; $('#sv', bg).onclick = async () => { try { await api('/agents/' + id, { method: 'PATCH', body: { phone: $('#ph', bg).value } }); close(); await reload(); viewTeam(); toast('Phone saved'); } catch (err) { toast(err.message, true); } }; });
    if (e.target.closest('[data-pin]')) { const self = a.id === S.me.id; return modal(`<h3>${self ? 'Change my password' : 'Sign-in for ' + esc(a.name)}</h3>
      ${ad ? `<div class="field"><label>Username</label><input type="text" id="nu" value="${esc(a.username || '')}" autocomplete="off" autocapitalize="none" spellcheck="false"><div class="hint">3–32 letters, numbers, dot, dash or underscore.</div></div>` : ''}
      ${self ? `<div class="field"><label>Current password</label><input type="password" id="cp" autocomplete="current-password"></div>` : ''}
      <div class="field"><label>${ad && !self ? 'New password' : 'New password'} ${ad && !self ? '<span class="hint">(leave empty to keep the current one)</span>' : ''}</label><input type="password" id="np" autocomplete="new-password"><div class="hint">At least 6 characters. ${self ? 'Other devices will be signed out.' : 'They will be signed out and must use the new one.'}</div></div>
      <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => { $('#cx', bg).onclick = close; $('#sv', bg).onclick = async () => {
        const body = {}; if (ad && $('#nu', bg).value.trim() !== (a.username || '')) body.username = $('#nu', bg).value;
        if ($('#np', bg).value) { body.password = $('#np', bg).value; if (self) body.currentPassword = $('#cp', bg).value; }
        if (!Object.keys(body).length) return close();
        try { const r = await api('/agents/' + id, { method: 'PATCH', body }); if (r.token) { S.token = r.token; localStorage.setItem('wd_token', r.token); } close(); await reload(); viewTeam(); toast(body.password ? 'Password changed' : 'Username saved'); } catch (err) { toast(err.message, true); } }; }); }
    if (e.target.closest('[data-del]') && confirm(`Remove ${a.name}? Their chats become unassigned.`)) { await api('/agents/' + id, { method: 'DELETE' }); await reload(); viewTeam(); }
  };
  if (ad) $('#addm').onclick = () => modal(`<h3>Add team member</h3><div class="field"><label>Name</label><input type="text" id="an"></div><div class="field"><label>Username</label><input type="text" id="au" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. sara.khan"></div><div class="field"><label>Password <span class="hint">(at least 6 characters)</span></label><input type="password" id="ap" autocomplete="new-password"></div><div class="field"><label>Phone / WhatsApp (with country code)</label><input type="tel" id="aph" placeholder="923001234567"></div><div class="field"><label>Role</label><select id="ar"><option value="agent">Team member</option><option value="admin">Administrator</option></select></div><div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Add</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async () => { try { await api('/agents', { method: 'POST', body: { name: $('#an', bg).value, username: $('#au', bg).value, password: $('#ap', bg).value, role: $('#ar', bg).value, phone: $('#aph', bg).value } }); close(); await reload(); viewTeam(); toast('Team member added'); } catch (err) { toast(err.message, true); } };
  });
}

// ---------- settings ----------
function applyTestPhone() {
  const f = $('#fab'); if (!f) return;
  if (testPhoneOn()) { if (!S.sim.open) { f.hidden = false; f.style.display = ''; } }
  else { f.hidden = true; f.style.display = 'none'; S.sim.open = false; const h = $('#simhost'); if (h) h.innerHTML = ''; }
}
function viewSettings() {
  const s = S.settings, hook = location.origin + '/webhook';
  const ta = (k, l, h = '') => `<div class="field"><label>${l}</label><textarea data-k="${k}">${esc(s[k])}</textarea>${h ? `<div class="hint">${h}</div>` : ''}</div>`;
  $('#main').innerHTML = `<div class="page">${pageHead('Settings', 'Everything the bot says, and how it connects to WhatsApp.', `<button class="btn primary" id="save">Save changes</button>`)}
    <div class="grid g2" style="align-items:start">
      <div class="card pad"><div class="h3">Bot messages</div>
        <div class="field"><label>Business name</label><input type="text" data-k="businessName" value="${esc(s.businessName)}"></div>
        ${ta('greeting', 'Greeting', 'Use {business} for your business name.')}
        <div class="h3" style="margin-top:6px">Menu buttons <span class="hint" style="font-weight:500">(max 24 characters)</span></div>
        <div class="grid g2" style="gap:10px">${[['guide', 'Option 1'], ['org', 'Option 2'], ['track', 'Option 3'], ['human', 'Option 4'], ['retail', 'Option 5']].map(([k, l]) => `<div class="field"><label>${l}</label><input type="text" maxlength="24" data-m="${k}" value="${esc(s.menu[k])}"></div>`).join('')}</div>
        ${ta('courierLinks', 'Courier tracking links', 'The “Track order” button opens the courier’s own website for the CN number in the sheet. One courier per line: <b>name = address</b>, with <b>{cn}</b> where the CN number goes. Add any courier you use; lines here replace the built-in ones.')}${ta('guideText', 'Guide & information reply')}${ta('orgPrompt', 'Ask for organization')}${ta('trackOrgPrompt', 'Track: ask for organization first')}${ta('trackOrgFirst', 'Track: number sent before organization')}${ta('trackOrgNotFound', 'Track: organization not found', 'Use {q} for what the customer typed.')}${ta('trackPrompt', 'Ask for PO / P.R / CN number')}${ta('retailPrompt', 'Ask for retail account number')}
        ${ta('handoffMessage', 'When connected to a person', 'Use {agent} and {org}.')}${ta('noAgentMessage', 'When nobody is on duty')}${ta('notFoundOrg', 'Organization not recognised')}${ta('notFoundOrder', 'Order not found', 'Use {q} for what the customer typed.')}${ta('closedMessage', 'Chat resolved')}</div>
      <div class="card pad"><div class="h3">Test phone</div>
        <div class="field"><label class="chk"><input type="checkbox" id="tp-on" ${testPhoneOn() ? 'checked' : ''}><span>Show the “Test phone” button</span></label>
          <div class="hint">The round button at the bottom right that lets you chat as a pretend customer. Untick to hide it for everyone; tick it again whenever you need it.</div></div></div>
      <div class="card pad" id="wacard"><div class="h3">WhatsApp connection</div><div class="hint">Loading…</div></div>
      <div class="card pad"><div class="h3">Microsoft app (client) ID</div><p class="hint" style="margin-bottom:12px">Only needed for OneDrive / Excel order sheets. Lets the desk sign in to Microsoft once so private OneDrive and SharePoint links connect without the "unauthenticated" error.</p><button class="btn primary" id="msopen">Set up Microsoft sign-in</button></div>
    </div></div>`;
  $('#msopen').onclick = msSetup; renderWaCard();
  $('#tp-on').onchange = async e => {
    try { S.settings = await api('/settings', { method: 'PUT', body: { showTestPhone: e.target.checked ? '1' : '0' } }); applyTestPhone(); toast(e.target.checked ? 'Test phone shown' : 'Test phone hidden'); }
    catch (err) { toast(err.message, true); e.target.checked = !e.target.checked; }
  };
  $('#save').onclick = async () => {
    const body = { menu: {} };
    $$('[data-k]').forEach(el => body[el.dataset.k] = el.value); $$('[data-m]').forEach(el => body.menu[el.dataset.m] = el.value);
    try { S.settings = await api('/settings', { method: 'PUT', body }); toast('Settings saved'); } catch (e) { toast(e.message, true); }
  };
}

// ---------- test phone ----------
async function openSim() {
  $('#fab').style.display = 'none';
  const p = S.sim.phone;
  try { S.sim.msgs = (await api(`/conversations/${p}/messages`)).messages; } catch { S.sim.msgs = []; }
  $('#simhost').innerHTML = `<div class="sim"><div class="sim-in">
    <div class="sim-h"><div class="avatar" style="background:#fff;color:#0f766e">${ic('inbox')}</div><div><b>${esc(S.settings.businessName)}</b><small>business account · test</small></div><button class="x" id="sx">${ic('x')}</button></div>
    <div class="sim-set"><input type="text" id="sp" value="${esc(S.sim.phone)}" title="Customer phone number" style="flex:1.3"><input type="text" id="sn" value="${esc(S.sim.name)}" title="Customer name" style="flex:1"><button class="sim-reset" id="snew">New</button></div>
    <div class="sim-msgs" id="smsgs"></div><div class="sim-opts" id="sopts"></div>
    <form class="sim-f" id="sf"><input type="text" id="st" placeholder="Type a message" autocomplete="off"><button>${ic('send')}</button></form></div></div>`;
  $('#sx').onclick = () => { S.sim.open = false; $('#simhost').innerHTML = ''; $('#fab').style.display = ''; };
  $('#snew').onclick = () => { S.sim.phone = '9230' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); S.sim.name = 'Test Customer'; openSim(); };
  $('#sp').onchange = e => { S.sim.phone = e.target.value.replace(/\D/g, ''); openSim(); };
  $('#sn').onchange = e => S.sim.name = e.target.value;
  $('#sf').onsubmit = e => { e.preventDefault(); const t = $('#st').value.trim(); if (t) { $('#st').value = ''; simSend({ text: t }); } };
  renderSim(); $('#st').focus();
}
async function simSend(b) { try { await api('/simulate', { method: 'POST', body: { phone: S.sim.phone, name: S.sim.name, ...b } }); } catch (e) { toast(e.message, true); } }
function renderSim() {
  const box = $('#smsgs'); if (!box) return;
  box.innerHTML = S.sim.msgs.filter(m => m.dir !== 'sys' && m.from !== 'agent' || m.from === 'agent').map(m => bubble(m, true)).join('') || `<div class="sys" style="display:block;align-self:center;text-align:center">Say "hi", or "I'm from Hilton" — just like a real customer.</div>`;
  box.scrollTop = box.scrollHeight;
  const last = S.sim.msgs[S.sim.msgs.length - 1], o = $('#sopts');
  o.innerHTML = last && last.dir === 'out' && last.options ? last.options.map(x => `<button data-id="${x.id}" data-t="${esc(x.title)}">${esc(x.title)}</button>`).join('') : '';
  o.onclick = e => { const b = e.target.closest('button'); if (b) simSend({ text: b.dataset.t, replyId: b.dataset.id }); };
}

window.addEventListener('hashchange', () => { const v = location.hash.slice(1) || 'overview'; if (S.me && v !== S.view) { S.view = v; renderShell(); } });
boot();

// ---------- scheduled reports ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysText = d => d.length === 7 ? 'Every day' : d.length === 5 && !d.includes(0) && !d.includes(6) ? 'Mon–Fri' : d.map(x => DAYS[x]).join(', ');
const chk = (name, val, label, on) => `<label class="chk"><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''}><span>${esc(label)}</span></label>`;

async function viewReports() {
  const [d, mail] = await Promise.all([api('/reports'), api('/mail')]); S.rep = d; S.mailCfg = mail;
  const ready = mail.ready || (mail.host && mail.from);
  $('#main').innerHTML = `<div class="page">${pageHead('Reports', 'Pick the orders you want, and the app emails them as PDF and Excel on a schedule.', `<button class="btn" id="aiset">${ic('spark')} Gemini</button><button class="btn" id="mset">${ic('cog')} Email settings</button><button class="btn primary" id="newr">${ic('plus')} New report</button>`)}
    ${mail.via ? `<div class="hint" style="margin:0 0 14px">Reports are sent from your Gmail mailbox <b>${esc(mail.via.user)}</b>. Use <b>Email settings</b> only if you want a different sender.</div>` : ''}
    ${ready ? '' : `<div class="notice" style="margin:0 0 16px;font-size:13.5px">Set up the email account first — press <b>Email settings</b> and enter the account the reports will be sent from.</div>`}
    <div class="team" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">${d.reports.map(reportCard).join('') || `<div class="card empty" style="padding:50px;grid-column:1/-1"><div><div class="big">${ic('mail')}</div><b style="font-size:16px">No reports yet</b><div class="hint" style="margin-top:4px">Create one, for example "Shipped orders" to the warehouse, or one report per organization to its account manager.</div></div></div>`}</div></div>`;
  $('#newr').onclick = () => editReport(null); $('#mset').onclick = mailSettings; $('#aiset').onclick = aiSettings;
  $('.team').onclick = async e => {
    const card = e.target.closest('[data-rid]'); if (!card) return; const r = d.reports.find(x => x.id === card.dataset.rid);
    if (e.target.closest('[data-edit]')) editReport(r);
    if (e.target.closest('[data-del]') && confirm(`Delete "${r.name}"?`)) { await api('/reports/' + r.id, { method: 'DELETE' }); viewReports(); }
    if (e.target.closest('[data-run]')) { const b = e.target.closest('[data-run]'); b.disabled = true; b.textContent = 'Sending…'; try { await api(`/reports/${r.id}/run`, { method: 'POST' }); toast('Report sent now'); } catch (err) { toast(err.message, true); } viewReports(); }
  };
  $('.team').onchange = async e => { if (!e.target.closest('.switch')) return; const id = e.target.closest('[data-rid]').dataset.rid; await api('/reports/' + id, { method: 'PATCH', body: { enabled: e.target.checked } }); toast(e.target.checked ? 'Report switched on' : 'Report paused'); };
}
function reportCard(r) {
  const f = r.filter, bits = [];
  if (f.organizations.length) bits.push(f.organizations.join(', ')); if (f.statuses.length) bits.push(f.statuses.join(', '));
  const dm = f.dateMode || (f.updatedWithinDays !== '' && f.updatedWithinDays != null ? 'last' : 'any'), dd = f.dateDays ?? f.updatedWithinDays;
  if (dm === 'on') bits.push(dd == 0 ? 'updated today' : dd == 1 ? 'updated yesterday' : `updated ${dd} days ago`); if (dm === 'date') bits.push(`updated on ${f.dateFrom}`); if (dm === 'range') bits.push(`updated ${f.dateFrom} to ${f.dateTo}`); if (dm === 'last') bits.push(`updated in last ${dd} day${dd == 1 ? '' : 's'}`); if (f.search) bits.push(`"${f.search}"`);
  const lr = r.lastRun, tok = encodeURIComponent(S.token);
  return `<div class="card person" data-rid="${r.id}">
    <div class="hd"><div class="avatar lg" style="background:var(--brand)">${ic('mail')}</div><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><span class="hint">${daysText(r.days)} at ${esc(r.time)} · ${[r.excel && 'Excel', r.pdf && 'PDF'].filter(Boolean).join(' + ')}</span></div>
      <label class="switch" title="On / paused"><input type="checkbox" ${r.enabled ? 'checked' : ''}><i></i></label></div>
    <div><div class="hint" style="font-weight:700;margin-bottom:6px">Data · ${r.matching} order${r.matching === 1 ? '' : 's'} right now</div><div class="chips"><span class="pill violet">${esc(bits.join(' · ') || 'All orders')}</span></div></div>
    <div><div class="hint" style="font-weight:700;margin-bottom:6px">Sent to</div><div class="chips">${r.recipients.map(x => `<span class="pill">${esc(x)}</span>`).join('')}${(r.cc || []).map(x => `<span class="pill violet">CC ${esc(x)}</span>`).join('')}${(r.bcc || []).map(x => `<span class="pill">BCC ${esc(x)}</span>`).join('')}</div></div>
    <div class="hint">${lr ? (lr.ok ? `<span class="pill green">Last: ${new Date(lr.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> ${esc(lr.note)}` : `<span class="pill red">Failed</span> ${esc(lr.note)}`) : 'Not sent yet'}</div>
    <div class="row" style="flex-wrap:wrap"><button class="btn sm primary" data-run="1">${ic('send')} Send now</button>
      ${r.pdf ? `<a class="btn sm" href="/api/reports/${r.id}/download?format=pdf&token=${tok}">PDF</a>` : ''}${r.excel ? `<a class="btn sm" href="/api/reports/${r.id}/download?format=xlsx&token=${tok}">Excel</a>` : ''}
      <button class="btn sm ghost" data-edit="1" style="margin-left:auto">${ic('edit')} Edit</button><button class="btn sm ghost danger" data-del="1">${ic('trash')}</button></div></div>`;
}
function editReport(r) {
  const x = r || { name: '', filter: { organizations: [], statuses: [], dateMode: 'any', dateDays: 0, search: '' }, columns: S.rep.defaultColumns || ['po', 'pr', 'cn', 'customer', 'organization', 'status', 'courier', 'link', 'updated', 'notes'], pdf: true, excel: true, recipients: [], cc: [], bcc: [], subject: '', message: '', time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], skipIfEmpty: false };
  const orgs = [...new Set([...S.orgs.map(o => o.name), ...S.rep.organizations, ...x.filter.organizations])];
  const sts = [...new Set([...ORDER_STATUSES, ...S.rep.statuses, ...x.filter.statuses])];
  const f0 = x.filter, dmode0 = f0.dateMode || (f0.updatedWithinDays !== '' && f0.updatedWithinDays != null ? 'last' : 'any'), ddays0 = f0.dateDays ?? f0.updatedWithinDays ?? 0;
  const dsel = ['date', 'range'].includes(dmode0) ? dmode0 : dmode0 === 'on' ? (+ddays0 === 0 ? 'today' : +ddays0 === 1 ? 'yesterday' : 'ago') : dmode0;
  const oldCols = x.columns.includes('orderId') && !x.columns.some(k => ['po', 'pr', 'cn'].includes(k)) ? ['po', 'pr', 'cn'] : [];
  const onCol = k => x.columns.includes(k) || oldCols.includes(k);
  const known = new Set([...S.rep.columns, ...(S.rep.extraColumns || [])].map(c => c.key)), lostX = x.columns.filter(k => k.startsWith('x:') && !known.has(k)).map(k => ({ key: k, label: k.slice(2) }));
  const m = modal(`<h3>${r ? 'Edit' : 'New'} report</h3>
    <div class="field"><label>Report name</label><input type="text" id="rn" value="${esc(x.name)}" placeholder="e.g. Daily shipped orders"></div>
    <div class="field" style="background:var(--bg-soft,rgba(127,127,127,.08));padding:10px;border-radius:10px"><label>${ic('spark')} Ask Gemini to fill this in</label><div class="row" style="gap:8px"><input type="text" id="rai" placeholder="e.g. Bank Al Falah dispatched orders of yesterday with DC no, PO, branch code, CN no, courier"><button type="button" class="btn sm primary" id="raib">Fill</button></div></div>
    <div class="h3" style="margin-top:4px">1 · Which orders?</div>
    <div class="field"><label>Organizations <span class="hint">(none ticked = all)</span></label><div class="chips" id="rorg">${orgs.map(o => chk('o', o, o, x.filter.organizations.includes(o))).join('') || '<span class="hint">Organizations appear once your sheet is loaded.</span>'}</div></div>
    <div class="field"><label>Status <span class="hint">(none ticked = all)</span></label><div class="chips" id="rst">${sts.map(o => chk('s', o, o, x.filter.statuses.includes(o))).join('')}</div></div>
    <div class="grid g2" style="gap:12px"><div class="field"><label>Orders updated</label><div class="row" style="gap:8px"><select id="rdm"><option value="any" ${dsel === 'any' ? 'selected' : ''}>Any time</option><option value="today" ${dsel === 'today' ? 'selected' : ''}>Today</option><option value="yesterday" ${dsel === 'yesterday' ? 'selected' : ''}>Yesterday (one day before today)</option><option value="ago" ${dsel === 'ago' ? 'selected' : ''}>On a day … days ago</option><option value="last" ${dsel === 'last' ? 'selected' : ''}>In the last … days</option><option value="date" ${dsel === 'date' ? 'selected' : ''}>On a specific date</option><option value="range" ${dsel === 'range' ? 'selected' : ''}>Between two dates</option></select><input type="number" id="rdays" min="0" style="width:80px;${dsel === 'ago' || dsel === 'last' ? '' : 'display:none'}" value="${esc(ddays0)}"></div></div><div class="field" id="rdrow" style="grid-column:1/-1;${dsel === 'date' || dsel === 'range' ? '' : 'display:none'}"><div class="row" style="gap:8px;flex-wrap:wrap"><input type="date" id="rdf" value="${esc(f0.dateFrom || '')}" style="width:auto"><span id="rdto" style="${dsel === 'range' ? '' : 'display:none'}">to <input type="date" id="rdt" value="${esc(f0.dateTo || '')}" style="width:auto"></span></div></div>
      <div class="field" style="grid-column:1/-1"><label>Date taken from <span class="hint">(which date the Today / Yesterday / date choices above look at)</span></label><select id="rdc"><option value="">Last updated / dispatch date</option>${(S.rep.dateColumns || []).map(c => `<option value="${esc(c.label)}" ${f0.dateField === c.label ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
      <div class="field"><label>Contains text</label><input type="text" id="rq" value="${esc(x.filter.search)}" placeholder="optional"></div></div>
    <div class="field"><label>Columns to include <span class="hint">(every column you tick is included, even if it is empty for now)</span></label>
      <div class="hint" style="font-weight:700;margin:2px 0 6px">Main columns <span style="font-weight:500">— always in this order: DC no, PO no, P.R no, Branch code, Branch address, Person name, Contact no, Dispatch date, CN no, Courier, Parcels, Image link</span></div>
      <div class="chips" id="rcol">${S.rep.layout.main.map(c => chk('c', c.key, c.label, onCol(c.key))).join('')}</div>
      ${S.rep.layout.rest.length || lostX.length ? `<div class="row" style="margin:10px 0 6px;gap:10px"><div class="hint" style="font-weight:700">Other columns</div><button type="button" class="btn sm ghost" id="xall" style="margin-left:auto">Select all</button><button type="button" class="btn sm ghost" id="xnone">Clear</button></div><div class="chips" id="rcolx">${[...S.rep.layout.rest, ...lostX].map(c => chk('c', c.key, c.label, onCol(c.key) || x.columns.includes(c.key))).join('')}</div>` : ''}
      <div class="row" style="margin:12px 0 6px;gap:10px"><div class="hint" style="font-weight:700">Your column order &amp; names</div><label class="row" style="gap:6px;margin-left:auto"><input type="checkbox" id="rco" ${x.customOrder ? 'checked' : ''}> Use my own order</label></div><div id="rord" class="hint"></div>
      <div class="hint" style="margin-top:6px">Web addresses (tracking links, image links) appear as a clickable “Open link” / “View image” in both Excel and PDF.</div></div>
    <div class="field"><label>Files to attach</label><div class="chips">${chk('f', 'excel', 'Excel (.xlsx)', x.excel).replace('name="f"', 'id="rx"')}${chk('f', 'pdf', 'PDF', x.pdf).replace('name="f"', 'id="rp"')}</div></div>
    <div class="h3" style="margin-top:8px">2 · Who gets it?</div>
    <div class="field"><label>Email addresses <span class="hint">(separate with commas or new lines)</span></label><textarea id="rr" placeholder="boss@company.com, accounts@company.com">${esc(x.recipients.join(', '))}</textarea></div>
    <div class="grid g2" style="gap:12px"><div class="field"><label>CC <span class="hint">(optional, everyone sees these)</span></label><textarea id="rcc" style="min-height:48px" placeholder="manager@company.com">${esc((x.cc || []).join(', '))}</textarea></div><div class="field"><label>BCC <span class="hint">(optional, hidden from others)</span></label><textarea id="rbcc" style="min-height:48px" placeholder="archive@company.com">${esc((x.bcc || []).join(', '))}</textarea></div></div>
    <div class="field"><label>Subject <span class="hint">({date} and {count} work here)</span></label><input type="text" id="rs" value="${esc(x.subject)}" placeholder="Daily shipped orders — {date}"></div>
    <div class="field"><label>Message</label><textarea id="rm" style="min-height:60px" placeholder="Good morning, please find today's report attached.">${esc(x.message)}</textarea></div>
    <div class="h3" style="margin-top:8px">3 · When?</div>
    <div class="row" style="flex-wrap:wrap;margin-bottom:10px"><input type="time" id="rt" value="${esc(x.time)}" style="width:auto"><div class="chips" id="rdy">${DAYS.map((d, i) => chk('d', i, d, x.days.includes(i))).join('')}</div></div>
    <label class="row" style="gap:8px;margin-bottom:6px"><input type="checkbox" id="rsk" ${x.skipIfEmpty ? 'checked' : ''}> Don't send when no orders match</label>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${r ? 'Save' : 'Create report'}</button></div>`, (bg, close) => {
    $('.modal', bg).style.maxWidth = '640px';
    const vals = (sel, n) => $$(`${sel} input[name=${n}]:checked`, bg).map(i => i.value);
    $('#cx', bg).onclick = close;
    if ($('#xall', bg)) { $('#xall', bg).onclick = () => $$('#rcolx input', bg).forEach(i => { i.checked = true; }); $('#xnone', bg).onclick = () => $$('#rcolx input', bg).forEach(i => { i.checked = false; }); }
    const labels = { ...(x.labels || {}) }; let ord = [...x.columns];
    const lab = k => labels[k] || ([...S.rep.columns, ...(S.rep.extraColumns || [])].find(c => c.key === k) || { label: k.replace(/^x:/, '') }).label;
    const ticked = () => [...vals('#rcol', 'c'), ...vals('#rcolx', 'c')];
    const drawOrd = () => {
      const t = ticked(); ord = [...ord.filter(k => t.includes(k)), ...t.filter(k => !ord.includes(k))];
      const own = $('#rco', bg).checked, list = own ? ord : S.rep.layout.order.filter(k => t.includes(k)).concat(t.filter(k => !S.rep.layout.order.includes(k)));
      $('#rord', bg).innerHTML = list.map((k, i) => `<div class="row" style="gap:6px;margin:3px 0"><span style="width:22px;color:var(--ink-3)">${i + 1}</span><input type="text" data-lb="${esc(k)}" value="${esc(labels[k] || '')}" placeholder="${esc(lab(k))}" style="flex:1">${own ? `<button type="button" class="btn sm ghost" data-up="${esc(k)}">↑</button><button type="button" class="btn sm ghost" data-dn="${esc(k)}">↓</button>` : ''}</div>`).join('') || 'Tick the columns you want above.';
    };
    $('#rord', bg).onclick = e => { const u = e.target.closest('[data-up]'), d = e.target.closest('[data-dn]'); if (!u && !d) return; const k = (u || d).dataset[u ? 'up' : 'dn'], i = ord.indexOf(k), j = u ? i - 1 : i + 1; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; drawOrd(); };
    $('#rord', bg).oninput = e => { const k = e.target.dataset.lb; if (k) { if (e.target.value.trim()) labels[k] = e.target.value; else delete labels[k]; } };
    $('#rco', bg).onchange = drawOrd; bg.addEventListener('change', e => { if (e.target.closest('#rcol,#rcolx')) drawOrd(); }); drawOrd();
    $('#rdm', bg).onchange = e => { const v = e.target.value; $('#rdays', bg).style.display = ['ago', 'last'].includes(v) ? '' : 'none'; $('#rdrow', bg).style.display = ['date', 'range'].includes(v) ? '' : 'none'; $('#rdto', bg).style.display = v === 'range' ? '' : 'none'; };
    $('#raib', bg).onclick = async () => {
      const b = $('#raib', bg), q = $('#rai', bg).value.trim(); if (!q) return; b.disabled = true; b.textContent = 'Thinking…';
      try {
        const a = await api('/reports/assist', { method: 'POST', body: { prompt: q } });
        if (a.name && !$('#rn', bg).value) $('#rn', bg).value = a.name;
        const tick = (sel, n, list) => { if (Array.isArray(list)) $$(`${sel} input[name=${n}]`, bg).forEach(i => { i.checked = list.map(v => String(v).toLowerCase()).includes(i.value.toLowerCase()); }); };
        tick('#rorg', 'o', a.organizations); tick('#rst', 's', a.statuses);
        if (Array.isArray(a.columns) && a.columns.length) { $$('#rcol input, #rcolx input', bg).forEach(i => { i.checked = a.columns.includes(i.value); }); ord = a.columns.filter(k => ticked().includes(k)); $('#rco', bg).checked = true; }
        const dm = { any: 'any', today: 'today', yesterday: 'yesterday', last: 'last', date: 'date', range: 'range' }[a.dateMode]; if (dm) { $('#rdm', bg).value = dm; $('#rdm', bg).onchange({ target: $('#rdm', bg) }); if (a.dateDays != null) $('#rdays', bg).value = a.dateDays; if (a.dateFrom) $('#rdf', bg).value = a.dateFrom; if (a.dateTo) $('#rdt', bg).value = a.dateTo; }
        if (a.search != null) $('#rq', bg).value = a.search; drawOrd(); toast('Filled in. Please check it, then save.');
      } catch (e) { toast(e.message, true); } b.disabled = false; b.textContent = 'Fill';
    };
    $('#sv', bg).onclick = async () => {
      const dm = $('#rdm', bg).value, dateMode = ['any', 'last', 'date', 'range'].includes(dm) ? dm : 'on', dateDays = dm === 'today' ? 0 : dm === 'yesterday' ? 1 : (+$('#rdays', bg).value || 0);
      const body = { name: $('#rn', bg).value, filter: { organizations: vals('#rorg', 'o'), statuses: vals('#rst', 's'), dateMode, dateDays, dateFrom: $('#rdf', bg).value, dateTo: $('#rdt', bg).value, dateField: $('#rdc', bg).value, search: $('#rq', bg).value }, columns: $('#rco', bg).checked ? ord : [...vals('#rcol', 'c'), ...vals('#rcolx', 'c')], customOrder: $('#rco', bg).checked, labels: Object.fromEntries(Object.entries(labels).filter(([k]) => ticked().includes(k))), excel: $('#rx', bg).checked, pdf: $('#rp', bg).checked, recipients: $('#rr', bg).value, cc: $('#rcc', bg).value, bcc: $('#rbcc', bg).value, subject: $('#rs', bg).value, message: $('#rm', bg).value, time: $('#rt', bg).value, days: vals('#rdy', 'd'), skipIfEmpty: $('#rsk', bg).checked };
      try { await api(r ? '/reports/' + r.id : '/reports', { method: r ? 'PUT' : 'POST', body }); close(); toast('Report saved'); viewReports(); } catch (e) { toast(e.message, true); }
    };
  });
}
function mailSettings() {
  const c = S.mailCfg, boxes = c.mailboxes || [];
  modal(`<h3>Email settings</h3><p class="hint" style="margin:-8px 0 14px">The account reports are sent from. For Gmail use <b>smtp.gmail.com</b>, port 587, STARTTLS and an <b>App password</b>. For Microsoft 365 use <b>smtp.office365.com</b>, port 587, STARTTLS (your admin must allow SMTP sign-in for this mailbox).</p>
    ${boxes.length ? `<div class="field"><label>Send reports from</label><select id="mbx"><option value="">The account typed below${c.host && c.from ? '' : ' (not filled in)'} / first mailbox automatically</option>${boxes.map(a => `<option value="${esc(a.id)}" ${c.accountId === a.id ? 'selected' : ''}>Gmail mailbox · ${esc(a.user)}${a.label && a.label !== a.user ? ' (' + esc(a.label) + ')' : ''}</option>`).join('')}</select><div class="hint" style="margin-top:4px">Pick a mailbox you already added under Email and there is nothing else to fill in.</div></div>` : ''}
    <div class="grid g2" style="gap:12px"><div class="field" style="grid-column:1/-1"><label>Mail server</label><input type="text" id="mh" value="${esc(c.host)}" placeholder="smtp.office365.com"></div>
    <div class="field"><label>Port</label><input type="number" id="mp" value="${esc(c.port || 587)}"></div>
    <div class="field"><label>Security</label><select id="ms"><option value="starttls" ${c.security === 'starttls' ? 'selected' : ''}>STARTTLS (587)</option><option value="ssl" ${c.security === 'ssl' ? 'selected' : ''}>SSL/TLS (465)</option><option value="none" ${c.security === 'none' ? 'selected' : ''}>None (25)</option></select></div>
    <div class="field"><label>Username</label><input type="text" id="mu" value="${esc(c.user)}" placeholder="reports@yourcompany.com"></div>
    <div class="field"><label>Password</label><input type="password" id="mw" placeholder="${c.hasPass ? '•••••••• (leave blank to keep)' : ''}" autocomplete="new-password"></div>
    <div class="field"><label>Send from (email)</label><input type="text" id="mf" value="${esc(c.from)}" placeholder="reports@yourcompany.com"></div>
    <div class="field"><label>Sender name</label><input type="text" id="mn" value="${esc(c.fromName)}" placeholder="${esc(S.settings.businessName)} Reports"></div></div>
    <div class="field"><label>Send a test email to</label><input type="text" id="mt" value="${esc(S.me.name ? '' : '')}" placeholder="you@yourcompany.com"></div>
    <div class="acts"><button class="btn" id="cx">Close</button><button class="btn" id="tst">Save &amp; send test</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    const save = async () => { const port = +$('#mp', bg).value; await api('/mail', { method: 'PUT', body: { accountId: $('#mbx', bg) ? $('#mbx', bg).value : '', host: $('#mh', bg).value, port, security: $('#ms', bg).value, user: $('#mu', bg).value, pass: $('#mw', bg).value, from: $('#mf', bg).value, fromName: $('#mn', bg).value } }); S.mailCfg = await api('/mail'); };
    $('#ms', bg).onchange = e => { $('#mp', bg).value = { starttls: 587, ssl: 465, none: 25 }[e.target.value]; };
    $('#cx', bg).onclick = () => { close(); viewReports(); };
    $('#sv', bg).onclick = async () => { try { await save(); close(); toast('Email settings saved'); viewReports(); } catch (e) { toast(e.message, true); } };
    $('#tst', bg).onclick = async () => { const b = $('#tst', bg); b.disabled = true; b.textContent = 'Sending…'; try { await save(); await api('/mail/test', { method: 'POST', body: { to: $('#mt', bg).value } }); toast('Test email sent — check the inbox'); } catch (e) { toast(e.message, true); } b.disabled = false; b.textContent = 'Save & send test'; };
  });
}
