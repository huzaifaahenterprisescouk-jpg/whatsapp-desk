/* Recipient pickers (Send on WhatsApp / Send by email), contact suggestions in the mail "To" box,
   and Gmail-style drag & drop of mail onto folders and labels. Loaded after mail.js. */

// ---------- shared helpers ----------
const AUTO_RE = /(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon|postmaster|notification|notice|alerts?@|newsletter|newarrival|bounce|marketing|noreply)/i;
function goView(v) {
  S.view = v; location.hash = v;
  $$('.nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  renderView();
}
// people you can email: organizations, team members (if they have an email) and real people who wrote to you (automatic senders hidden)
function mailContacts() {
  const out = new Map(), put = (email, name, tag, w) => {
    email = String(email || '').trim().toLowerCase(); if (!MAIL_RE.test(email)) return;
    const o = out.get(email); if (o) { o.w += w; if (!o.name && name) o.name = name; return; }
    out.set(email, { email, name: name || '', tag, w });
  };
  (S.agents || []).forEach(a => a.email && put(a.email, a.name, 'Team', 1000));
  (S.orgs || []).forEach(o => (o.emails || []).forEach(e => put(e, o.name, 'Organization', 500)));
  ((S.mail && S.mail.threads) || []).forEach(t => { if (t.whoEmail && !AUTO_RE.test(t.whoEmail)) put(t.whoEmail, t.who, 'Recent', 1 + (t.count || 1)); });
  return [...out.values()].sort((a, b) => b.w - a.w);
}
function waContacts(r) {
  const out = new Map(), put = (phone, name, tag, w) => {
    const n = normPhone(phone); if (!n) return; const o = out.get(n);
    if (o) { o.w += w; return; } out.set(n, { phone: n, name: name || '+' + n, tag, w, chat: (S.convs || []).some(c => normPhone(c.phone) === n) });
  };
  if (r) { put(r.customerPhone, r.customer || 'Customer', 'Customer on this order', 2000); if (r.handler) put(r.handler.phone, r.handler.name, 'Handles ' + (r.organization || 'this company'), 1500); if (r.backup) put(r.backup.phone, r.backup.name, 'Backup', 1400); }
  (S.agents || []).forEach(a => put(a.phone, a.name, 'Team', 800));
  (S.convs || []).forEach(c => put(c.phone, c.name, c.orgName || 'Chat', 100 + (c.updatedAt || 0) / 1e12));
  return [...out.values()].sort((a, b) => b.w - a.w);
}

// ---------- the "who do you want to send this to?" window ----------
function pickPerson({ title, hint, icon, people, typed, onPick }) {
  modal(`<h3>${ic(icon)} ${esc(title)}</h3><div class="hint" style="margin-bottom:8px">${esc(hint)}</div>
    <div class="search wide" style="margin-bottom:8px">${ic('search')}<input type="search" id="pk-q" placeholder="Search name or type a ${icon === 'wa' ? 'number' : 'email address'}" autocomplete="off" autofocus></div>
    <div class="pk-list" id="pk-l"></div><div class="acts"><button class="btn" id="cx">Cancel</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; const q = $('#pk-q', bg), l = $('#pk-l', bg); let shown = [];
    const draw = () => {
      const k = q.value.trim().toLowerCase(), t = typed(q.value.trim());
      shown = people.filter(p => !k || (p.name + ' ' + (p.email || '') + ' ' + (p.phone ? '+' + p.phone : '') + ' ' + p.tag).toLowerCase().includes(k)).slice(0, 40);
      l.innerHTML = (t ? `<button class="pk-row" data-t="1"><span class="pk-av">${ic(icon)}</span><span class="pk-b"><b>${esc(t.label)}</b><small>Use this ${icon === 'wa' ? 'number' : 'address'}</small></span></button>` : '')
        + shown.map((p, i) => `<button class="pk-row" data-i="${i}"><span class="pk-av" style="background:${hue(p.email || p.phone)}">${esc(initials(p.name || p.email || '?'))}</span><span class="pk-b"><b>${esc(p.name || p.email)}</b><small>${esc(p.email || '+' + p.phone)} · ${esc(p.tag)}${p.chat ? ' · has a chat' : ''}</small></span></button>`).join('')
        || (t ? '' : '<div class="hint" style="padding:14px 4px">No one found. Type a full ' + (icon === 'wa' ? 'number with country code' : 'email address') + ' above.</div>');
    };
    q.oninput = draw; draw();
    q.onkeydown = e => { if (e.key === 'Enter') { const f = $('.pk-row', l); f && f.click(); } };
    l.onclick = e => { const b = e.target.closest('.pk-row'); if (!b) return; const t = typed(q.value.trim()); close(); onPick(b.dataset.t ? t.value : shown[+b.dataset.i]); };
  });
}

// ---------- Send on WhatsApp: pick a person, open the WhatsApp section on that chat with the message ready ----------
function waSendOrder(r) {
  pickPerson({
    title: 'Send on WhatsApp to…', hint: 'Choose who gets these details. It opens their chat in the WhatsApp section with the message ready — you press Send.', icon: 'wa',
    people: waContacts(r), typed: s => { const n = normPhone(s); return n.length >= 10 ? { label: '+' + n, value: { phone: n, name: '+' + n } } : null; },
    onPick: async p => {
      const n = normPhone(p.phone), conv = (S.convs || []).find(c => normPhone(c.phone) === n);
      if (!conv) { window.open(`https://wa.me/${n}?text=${encodeURIComponent(r.text)}`, '_blank', 'noopener'); toast('No chat with this person yet — opened WhatsApp instead'); return; }
      goView('inbox'); await openConv(conv.phone);
      const ta = $('#ctext'); if (ta) { ta.value = r.text; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; ta.focus(); }
      toast('Message ready — press Send');
    }
  });
}
// ---------- Send by email: pick a person, open the Mail section with a new message addressed to them ----------
function mailSendOrder(r) {
  const go = to => mailOrder(r, to);
  pickPerson({
    title: 'Send by email to…', hint: 'Choose who gets these details. It opens a new message in the Mail section addressed to them.', icon: 'mail',
    people: mailContacts(), typed: s => MAIL_RE.test(s) ? { label: s, value: { email: s.toLowerCase() } } : null,
    onPick: p => go(p.email)
  });
}
// the mail section may not be loaded yet when the picker opens, so load the contacts first
async function ensureMailLoaded() { if (S.mail.threads.length) return; try { const d = await api('/mailbox'); S.mail.threads = d.threads; S.mail.accounts = d.accounts; S.mail.labels = d.labels || []; S.mail.perms = d.perms || {}; } catch {} }

// ---------- contact suggestions under the To / Cc / Bcc box (only while typing, only previous contacts) ----------
document.addEventListener('input', e => { if (e.target.matches('.chips-in input')) sugShow(e.target); });
document.addEventListener('mousedown', e => { if (!e.target.closest('.rsug') && !e.target.matches('.chips-in input')) sugHide(); });
document.addEventListener('keydown', e => {
  const m = $('.rsug'); if (!m) return;
  if (e.key === 'Escape') return sugHide();
  const its = [...m.querySelectorAll('button')]; if (!its.length) return; let i = its.findIndex(b => b.classList.contains('hot'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[i] && its[i].classList.remove('hot'); i = e.key === 'ArrowDown' ? (i + 1) % its.length : (i - 1 + its.length) % its.length; its[i].classList.add('hot'); its[i].scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); e.stopPropagation(); its[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
}, true);
function sugHide() { document.querySelectorAll('.rsug').forEach(x => x.remove()); }
function sugShow(inp) {
  sugHide(); const k = inp.value.trim().toLowerCase();
  if (!k) return; // only suggest while typing — clicking To / Cc / Bcc shows nothing
  const have = new Set([...inp.closest('.chips-in').querySelectorAll('.rc')].map(x => x.firstChild.textContent.toLowerCase()));
  const list = mailContacts().filter(c => !have.has(c.email) && (c.name + ' ' + c.email).toLowerCase().includes(k)).slice(0, 8);
  if (!list.length) return;
  const m = document.createElement('div'); m.className = 'rsug';
  m.innerHTML = list.map((c, i) => `<button type="button" class="${i === 0 && k ? 'hot' : ''}" data-e="${esc(c.email)}"><span class="pk-av sm" style="background:${hue(c.email)}">${esc(initials(c.name || c.email))}</span><span class="pk-b"><b>${esc(c.name || c.email)}</b><small>${esc(c.email)}</small></span><em>${esc(c.tag)}</em></button>`).join('');
  document.body.appendChild(m);
  const r = inp.getBoundingClientRect(), w = Math.max(320, Math.min(420, innerWidth - 16));
  m.style.width = w + 'px'; m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  const below = innerHeight - r.bottom, h = Math.min(m.offsetHeight, 330);
  m.style.top = (below > h + 12 ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + 'px';
  m.onmousedown = e => { e.preventDefault(); const b = e.target.closest('button[data-e]'); if (!b) return; inp.value = b.dataset.e; sugHide(); inp.dispatchEvent(new Event('change')); setTimeout(() => { const n = inp.isConnected ? inp : document.querySelector('.cwin .chips-in input'); n && n.focus(); }, 0); };
}

// ---------- drag a mail onto a folder or label, like Gmail ----------
const DROP_NOPE = { sent: 'Sent', all: 'All mail', drafts: 'Drafts', scheduled: 'Scheduled', unassigned: 'Unassigned' };
function wireDrag() {
  $$('#grows .gr[data-id]').forEach(row => {
    row.draggable = true;
    row.ondragstart = e => {
      const id = row.dataset.id, ids = S.mail.chk.has(id) ? [...S.mail.chk] : [id];
      e.dataTransfer.setData('text/plain', 'mail:' + ids.join(',')); e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging');
      const g = document.createElement('div'); g.className = 'dragghost'; const t = mthread(id);
      g.textContent = ids.length > 1 ? `${ids.length} conversations` : (t ? (t.who + ' — ' + (t.subject || '(no subject)')).slice(0, 60) : 'Conversation');
      document.body.appendChild(g); e.dataTransfer.setDragImage(g, 12, 12); setTimeout(() => g.remove(), 0);
      S.mail.dragIds = ids; document.body.classList.add('maildrag');
    };
    row.ondragend = () => { row.classList.remove('dragging'); document.body.classList.remove('maildrag'); $$('.fl.dropok').forEach(x => x.classList.remove('dropok')); };
  });
}
function wireDrop() {
  const rail = $('#grail'); if (!rail) return;
  const tgt = e => e.target.closest('.fl[data-f]');
  rail.ondragover = e => { const b = tgt(e); if (!b || !(S.mail.dragIds || []).length) return; e.preventDefault(); e.dataTransfer.dropEffect = DROP_NOPE[b.dataset.f.replace(/^label:.*/, '')] ? 'none' : 'move'; $$('.fl.dropok', rail).forEach(x => x !== b && x.classList.remove('dropok')); b.classList.add('dropok'); };
  rail.ondragleave = e => { const b = tgt(e); if (b && !b.contains(e.relatedTarget)) b.classList.remove('dropok'); };
  rail.ondrop = async e => {
    const b = tgt(e); if (!b) return; e.preventDefault(); b.classList.remove('dropok'); document.body.classList.remove('maildrag');
    const ids = S.mail.dragIds || []; S.mail.dragIds = []; if (ids.length) await dropMail(b.dataset.f, ids);
  };
}
async function dropMail(folder, ids) {
  const th = ids.map(mthread).filter(Boolean); if (!th.length) return;
  if (DROP_NOPE[folder]) return toast(`Mail can’t be moved into ${DROP_NOPE[folder]}`, true);
  const pick = f => th.filter(f).map(t => t.id), n = th.length;
  try {
    if (folder.startsWith('label:')) {
      const l = folder.slice(6), todo = th.filter(t => !(t.labels || []).includes(l)); if (!todo.length) return toast('Already in ' + l);
      for (const t of todo) await mpost(t.id, 'label', { label: l, add: true });
      S.mail.chk.clear(); await mreload(); return toast(`${n > 1 ? n + ' conversations' : 'Conversation'} labelled “${l}”`);
    }
    if (folder === 'inbox') { const r = pick(t => t.trashed || t.spam), o = pick(t => !t.trashed && !t.spam && t.status === 'resolved'); if (r.length) await tdo(r, 'restore'); if (o.length) await tdo(o, 'reopen'); if (!r.length && !o.length) toast('Already in the Inbox'); return; }
    if (folder === 'star') { const s = pick(t => !t.starred); if (!s.length) return toast('Already starred'); await tdo(s, 'star'); return toast('Starred'); }
    if (folder === 'important') { const s = pick(t => !t.important); if (!s.length) return toast('Already marked important'); for (const id of s) await mpost(id, 'important'); S.mail.chk.clear(); await mreload(); return toast('Marked important'); }
    if (folder === 'done') { const s = pick(t => !t.trashed && !t.spam && t.status !== 'resolved'); if (!s.length) return toast('Already done'); return tdo(s, 'resolve'); }
    if (folder === 'trash') { const s = pick(t => !t.trashed); if (!s.length) return toast('Already in the Bin'); return tdo(s, 'trash'); }
    if (folder === 'spam') { const s = pick(t => !t.spam); if (!s.length) return toast('Already in Spam'); return tdo(s, 'spam'); }
  } catch (e) { toast(e.message, true); }
}
{ const _gl = gmList, _gr = gmRail;
  gmList = function () { _gl.apply(this, arguments); wireDrag(); };
  gmRail = function () { _gr.apply(this, arguments); wireDrop(); }; }
