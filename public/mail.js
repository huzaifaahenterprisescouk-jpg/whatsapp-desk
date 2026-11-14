/* Shared email inbox – Gmail-style screens (loaded after app.js) */
Object.assign(ICONS, {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  mailopen: '<path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10l9 6 9-6"/>',
  label: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-8 8z"/><circle cx="8" cy="8" r="1.2"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>',
  replyall: '<path d="M7 14L2 9l5-5"/><path d="M12 14L7 9l5-5"/><path d="M7 9h8a6 6 0 0 1 6 6v3"/>',
  fwd: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v3"/>',
  clip: '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6L15 6.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
  chevU: '<path d="M6 15l6-6 6 6"/>', chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 18l6-6-6-6"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  min: '<path d="M5 19h14"/>', max: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/>', italic: '<path d="M19 4h-9M14 20H5M15 4L9 20"/>', under: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14"/>', strike: '<path d="M5 12h14M16 6.5A4 4 0 0 0 12 5c-2.5 0-4 1.2-4 3 0 4 8 2.5 8 7 0 1.8-1.6 3-4 3a5 5 0 0 1-4.5-2"/>',
  ul: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', ol: '<path d="M10 6h11M10 12h11M10 18h11M4 4v4M3.5 8h2M3.5 14.5c.5-1 2-1 2 .2S3.5 16 3.5 17.5h2"/>',
  quote: '<path d="M4 17v-5a5 5 0 0 1 5-5M13 17v-5a5 5 0 0 1 5-5"/><path d="M4 17h4v-4M13 17h4v-4"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eraser: '<path d="M20 20H9L4 15a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 20"/><path d="M7 11l6 6"/>',
  alignL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', alignC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', alignR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', sentI: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>', tray: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.5-1.8-.3-1.2.4-2.2 1.6-2.2H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
  bin: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>', spamI: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16.5v.01"/>', imp: '<path d="M4 5h11l5 7-5 7H4z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', draft: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', tag2: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-8 8z"/>',
  kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', all: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/>', filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
});
// ---------- theme & background ----------
const ACCENTS = { teal: ['#0f766e', '#14b8a6'], blue: ['#1a73e8', '#4285f4'], indigo: ['#4f46e5', '#818cf8'], purple: ['#7c3aed', '#a78bfa'], rose: ['#e11d48', '#fb7185'], orange: ['#ea580c', '#fb923c'], green: ['#16803c', '#4ade80'], slate: ['#475569', '#94a3b8'] };
const BGS = { none: ['None', ''], sunrise: ['Sunrise', 'linear-gradient(135deg,#f6d365,#fda085)', 0], ocean: ['Ocean', 'linear-gradient(135deg,#2193b0,#6dd5ed)', 1], forest: ['Forest', 'linear-gradient(135deg,#134e5e,#71b280)', 1], dusk: ['Dusk', 'linear-gradient(135deg,#355c7d,#6c5b7b,#c06c84)', 1], night: ['Night', 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', 1], lavender: ['Lavender', 'linear-gradient(135deg,#e0c3fc,#8ec5fc)', 0], mint: ['Mint', 'linear-gradient(135deg,#d4fc79,#96e6a1)', 0], peach: ['Peach', 'linear-gradient(135deg,#ffecd2,#fcb69f)', 0] };
const THEME_DEF = { mode: 'auto', accent: 'teal', bg: 'none', bgImg: '', light: false, density: 'comfortable' };
const THEME = { ...THEME_DEF };
// every team member has their own look: kept per user in this browser and on the server, never shown to anyone else
const themeKey = () => 'wd_theme_' + (S.me ? S.me.id : 'x');
let themeSync;
const saveTheme = () => {
  try { localStorage.setItem(themeKey(), JSON.stringify(THEME)); } catch { toast('Could not save — the picture may be too large', true); }
  clearTimeout(themeSync); themeSync = setTimeout(() => { const { _uid, ...t } = THEME; api('/me/theme', { method: 'PUT', body: t }).catch(e => /large/i.test(e.message) && toast(e.message, true)); }, 600);
};
async function loadTheme() {
  const uid = S.me && S.me.id; if (!uid || THEME._uid === uid) return;
  Object.assign(THEME, THEME_DEF); THEME._uid = uid;
  try { Object.assign(THEME, JSON.parse(localStorage.getItem(themeKey()) || '{}')); } catch {}
  try { const t = await api('/me/theme'); if (t && t.theme && Object.keys(t.theme).length) { Object.assign(THEME, THEME_DEF, t.theme); try { localStorage.setItem(themeKey(), JSON.stringify(THEME)); } catch {} } } catch {}
}
function applyTheme() {
  const r = document.documentElement, dark = THEME.mode === 'dark' || (THEME.mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  THEME.mode === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', THEME.mode);
  const [a, b] = ACCENTS[THEME.accent] || ACCENTS.teal, br = dark ? `color-mix(in srgb, ${b} 80%, white)` : a;
  r.style.setProperty('--brand', br); r.style.setProperty('--brand-2', b); r.style.setProperty('--brand-soft', `color-mix(in srgb, ${a} ${dark ? 28 : 13}%, var(--surface))`);
  r.style.setProperty('--brand-ink', dark ? '#04110f' : '#fff');
  r.style.setProperty('--side', `color-mix(in srgb, ${a} 26%, #070d0c)`); r.style.setProperty('--side-2', `color-mix(in srgb, ${a} 40%, #070d0c)`);
  r.style.setProperty('--gsel', `color-mix(in srgb, ${a} ${dark ? 38 : 20}%, var(--surface))`);
  const g = $('#gm'); if (g) { g.classList.remove('d-compact', 'd-cozy'); if (THEME.density !== 'comfortable') g.classList.add('d-' + THEME.density); }
  applyBg();
}
// the picture / colour sits behind the WHOLE app (every screen), panels become frosted glass — like Gmail's themes
function applyBg() {
  const r = document.documentElement, b = document.body, p = BGS[THEME.bg], img = THEME.bg === 'custom' && THEME.bgImg, any = !!(img || (p && p[1])), light = !!(img ? THEME.light : p && p[2]);
  const shade = img && THEME.light ? 'linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),' : '';
  b.style.background = img ? `${shade}url(${img}) center/cover fixed` : p && p[1] ? p[1] + ' fixed' : '';
  r.classList.toggle('themed', any && !!S.me); r.classList.toggle('tl', light);
  const g = $('#gm'); if (g) { g.style.background = ''; g.classList.toggle('themed', any); g.classList.toggle('tl', light); }
}
// a different person signing in on this computer must never inherit the previous person's look
function resetTheme() { Object.assign(THEME, THEME_DEF); delete THEME._uid; document.documentElement.removeAttribute('data-theme'); applyTheme(); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
applyTheme();
function openTheme() {
  const draw = bg => {
    bg.querySelector('.modal').innerHTML = `<h3>Appearance</h3>
    <div class="h3" style="font-size:13px">Mode</div><div class="seg" id="tmode">${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-v="${k}" class="${THEME.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="h3" style="font-size:13px;margin-top:16px">Accent colour</div><div class="swatches" id="tacc">${Object.entries(ACCENTS).map(([k, [a, b]]) => `<button data-v="${k}" title="${k}" class="${THEME.accent === k ? 'on' : ''}" style="background:linear-gradient(135deg,${a},${b})">${THEME.accent === k ? ic('check') : ''}</button>`).join('')}</div>
    <div class="h3" style="font-size:13px;margin-top:16px">Background <span class="hint" style="font-weight:500">(whole app — only you see it)</span></div><div class="bgs" id="tbg">${Object.entries(BGS).map(([k, [l, g]]) => `<button data-v="${k}" class="${THEME.bg === k ? 'on' : ''}" style="${g ? `background:${g}` : ''}"><span>${l}</span></button>`).join('')}<button data-v="custom" class="${THEME.bg === 'custom' ? 'on' : ''}" style="${THEME.bgImg ? `background:url(${THEME.bgImg}) center/cover` : ''}"><span>${THEME.bgImg ? 'My picture' : '+ Upload'}</span></button></div><input type="file" id="tfile" accept="image/*" hidden>
    ${THEME.bg === 'custom' ? `<label class="hint" style="display:block;margin-top:8px"><input type="checkbox" id="tlt" ${THEME.light ? 'checked' : ''}> Dark picture — use light text and darken it a little</label>` : ''}
    <div class="h3" style="font-size:13px;margin-top:16px">Density</div><div class="seg" id="tden">${[['comfortable', 'Comfortable'], ['cozy', 'Spacious'], ['compact', 'Compact']].map(([k, l]) => `<button data-v="${k}" class="${THEME.density === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="acts" style="margin-top:20px"><button class="btn" id="treset">Reset</button><button class="btn primary" id="cx">Done</button></div>`;
    const set = (k, v) => { THEME[k] = v; saveTheme(); applyTheme(); draw(bg); };
    $('#cx', bg).onclick = () => bg.remove();
    $('#treset', bg).onclick = () => { Object.assign(THEME, THEME_DEF); saveTheme(); applyTheme(); draw(bg); };
    $('#tmode', bg).onclick = e => { const b = e.target.closest('button'); b && set('mode', b.dataset.v); };
    $('#tacc', bg).onclick = e => { const b = e.target.closest('button'); b && set('accent', b.dataset.v); };
    $('#tden', bg).onclick = e => { const b = e.target.closest('button'); b && set('density', b.dataset.v); };
    $('#tbg', bg).onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.v === 'custom' && !THEME.bgImg) return $('#tfile', bg).click(); set('bg', b.dataset.v); };
    if ($('#tlt', bg)) $('#tlt', bg).onchange = e => set('light', e.target.checked);
    $('#tfile', bg).onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); THEME.bgImg = c.toDataURL('image/jpeg', .8); set('bg', 'custom'); }; im.onerror = () => toast('That file is not a picture', true); im.src = u; };
  };
  modal('', (bg) => draw(bg));
}
S.mail = { threads: [], accounts: [], folder: 'inbox', q: '', acc: '', sel: null, mails: [], img: new Set(), chk: new Set(), page: 0, rail: true, more: false, drafts: [], scheduled: [], drawer: false, filter: '', open: new Set(), reply: null, cw: null, cur: '', mcur: '' };
const PAGE = 50;
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const readFiles = files => Promise.all([...files].map(f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok({ filename: f.name, type: f.type, size: f.size, b64: String(r.result).split(',')[1] }); r.onerror = no; r.readAsDataURL(f); })));
S.mail.arch = { rows: [], loading: false, capped: false, missing: false, days: 365 };
const mthread = id => S.mail.threads.find(t => t.id === id) || S.mail.arch.rows.find(t => t.id === id);
// ---------- Archive: mail older than one year is kept on the NAS; it is searched there and opened read-only ----------
let archT = 0, archSeq = 0;
function archiveLoad(q, now) {
  clearTimeout(archT); const seq = ++archSeq; q = String(q || '').trim(); S.mail.arch.loading = true;
  const show = () => { if (S.view === 'mail' && $('#grail') && !S.mail.sel) gmList(); };
  archT = setTimeout(async () => {
    try { const r = await api('/mailbox/archive?q=' + encodeURIComponent(q)); if (seq !== archSeq) return; Object.assign(S.mail.arch, { rows: r.rows || [], capped: !!r.capped, missing: !!r.missing, days: r.keepDays || 365 }); }
    catch (e) { if (seq === archSeq) toast(e.message, true); }
    if (seq === archSeq) { S.mail.arch.loading = false; show(); }
  }, now ? 0 : 300); show();
}
const mpost = async (id, a, body) => { const r = await api(`/mailbox/${id}/${a}`, { method: 'POST', body }); if (r.warn) toast(r.warn, true); return r; };
const COLORS = ['#d93025', '#1a73e8', '#188038', '#e37400', '#9334e6', '#c5221f', '#0b8043', '#a142f4', '#e8710a', '#12b5cb', '#d01884', '#5f6368'];
const hue = s => COLORS[[...String(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const mav = (name, email, cls = '') => `<span class="mav ${cls}" style="background:${hue(email || name)}">${esc(initials(name || email || '?'))}</span>`;
const addrList = l => (l || []).map(a => esc(a.name ? `${a.name} <${a.email}>` : a.email)).join(', ');
const nameOf = a => (a && (a.name || a.email)) || '';
function mDate(ts, long) {
  const d = new Date(ts), n = new Date(), tm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (long) { const diff = Math.max(0, (n - d) / 6e4), rel = diff < 1 ? 'just now' : diff < 60 ? `${Math.round(diff)} minutes ago` : diff < 1440 ? `${Math.round(diff / 60)} hours ago` : `${Math.round(diff / 1440)} days ago`; return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${tm} (${rel})`; }
  if (d.toDateString() === n.toDateString()) return tm; return d.getFullYear() === n.getFullYear() ? d.toLocaleDateString([], { day: 'numeric', month: 'short' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' });
}

// small popup menu
function gmenu(anchor, items) {
  document.querySelectorAll('.gmenu').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'gmenu';
  m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}" ${it.dis ? 'disabled' : ''}>${it.chk !== undefined ? `<span class="ck">${it.chk ? ic('check') : ''}</span>` : ''}${it.dot ? `<i class="dot" style="background:${it.dot}"></i>` : ''}<span>${esc(it.t)}</span></button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + 'px';
  m.onclick = e => { const b = e.target.closest('button'); if (!b) return; m.remove(); items[+b.dataset.i].f(); };
  setTimeout(() => document.addEventListener('mousedown', function f(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', f); } }), 0);
}

// ---------- folders / search ----------
const allLabels = () => { const s = new Set(S.mail.labels || []); for (const t of S.mail.threads) if (t.labels) for (const l of t.labels) s.add(l); return [...s].sort((a, b) => a.localeCompare(b)); };
const mperm = k => isAdmin() || !!((S.mail.perms || {})[k]);
// admin switch "show the original Gmail labels": when it is off, team members use private labels of their own
const privMode = () => !isAdmin() && (S.mail.perms || {}).showGmailLabels === false;
const canMakeLabel = () => isAdmin() || privMode() || mperm('createLabels');
const keepScroll = fn => { const g = $('#gread'), y = g ? g.scrollTop : 0; fn(); const h = $('#gread'); if (h && y) h.scrollTop = y; };
function inFolder(t, f) {
  const me = S.me.id;
  if (t.archived || f === 'archive') return f === 'archive' && !!t.archived;
  if (f === 'trash') return !!t.trashed;
  if (f === 'spam') return !!t.spam && !t.trashed;
  if (t.trashed || t.spam) return false;
  if (f === 'important') return !!t.important;
  if (f === 'inbox') return t.status === 'open' && (t.agentId === me || (t.sharedWith || []).includes(me));
  if (f === 'unassigned') return t.status === 'open' && !t.agentId;
  if (f === 'star') return t.starred;
  if (f === 'sent') return t.sent;
  if (f === 'done') return t.status === 'resolved';
  if (f === 'all') return true;
  if (f.startsWith('label:')) return (t.labels || []).includes(f.slice(6));
  return true;
}
const qparts = str => { const out = []; String(str || '').replace(/(-?)"([^"]+)"|(\S+)/g, (_, n, q, w) => { out.push(q !== undefined ? { neg: !!n, t: q } : w.length > 1 && w[0] === '-' ? { neg: true, t: w.slice(1) } : { neg: false, t: w }); }); return out; };
const INMAP = { inbox: 'inbox', starred: 'star', star: 'star', sent: 'sent', done: 'done', archive: 'done', trash: 'trash', bin: 'trash', spam: 'spam', important: 'important', all: 'all', anywhere: 'all' };
function matchQuery(t, q) {
  if (!q) return true; let rest = q.toLowerCase();
  const op = (re, fn) => { rest = rest.replace(re, (m, v) => { v = v.replace(/^"|"$/g, ''); ok = ok && fn(v); return ''; }); }; let ok = true;
  const days = d => Date.now() - t.updatedAt <= d * 864e5, bytes = v => { const m = /^(\d+(?:\.\d+)?)([kmg]?)b?$/.exec(v); return m ? +m[1] * ({ '': 1, k: 1024, m: 1048576, g: 1073741824 }[m[2]]) : 0; };
  op(/\bfrom:("[^"]+"|\S+)/g, v => (t.who + ' ' + t.whoEmail).toLowerCase().includes(v));
  op(/\bto:("[^"]+"|\S+)/g, v => (t.whoEmail + ' ' + t.accountLabel).toLowerCase().includes(v));
  op(/\bsubject:("[^"]+"|\S+)/g, v => t.subject.toLowerCase().includes(v));
  op(/\blabel:("[^"]+"|\S+)/g, v => (t.labels || []).some(l => l.toLowerCase() === v));
  op(/\bis:(unread|read|starred|done)\b/g, v => v === 'unread' ? t.unread > 0 : v === 'read' ? !t.unread : v === 'starred' ? t.starred : t.status === 'resolved');
  op(/\bhas:(attachment|file)\b/g, () => !!t.hasFiles);
  op(/\blarger:(\S+)/g, v => (t.size || 0) > bytes(v)); op(/\bsmaller:(\S+)/g, v => (t.size || 0) < bytes(v));
  op(/\bnewer_than:(\d+)d\b/g, v => days(+v)); op(/\bolder_than:(\d+)d\b/g, v => !days(+v));
  op(/\bin:(\S+)/g, v => v === 'anywhere' || v === 'all' ? true : inFolder(t, INMAP[v] || v));
  const hay = [t.subject, t.who, t.whoEmail, t.orgName, t.snippet, (t.labels || []).join(' ')].join(' ').toLowerCase();
  return ok && qparts(rest).every(k => !k.t || hay.includes(k.t) !== k.neg);
}
// Search: first the instant answer from the mail already loaded here (same operators as Gmail), then Gmail itself answers over ALL mail.
// Hits that are not loaded yet are fetched and added automatically, so the list keeps growing until it is complete.
let remoteT = 0, remoteSeq = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function remoteSearch(now) {
  clearTimeout(remoteT); const q = S.mail.q.trim(); S.mail.remote = null; S.mail.searching = false; S.mail.pending = 0; const seq = ++remoteSeq;
  if (!q) return;
  S.mail.searching = true;
  const live = () => seq === remoteSeq && S.mail.q.trim() === q, acc = S.mail.acc ? '&acc=' + encodeURIComponent(S.mail.acc) : '';
  const show = () => { if (S.view === 'mail' && $('#grail') && !S.mail.sel) gmList(); };
  remoteT = setTimeout(async () => {
    try {
      const l = await api('/mailbox/search?mode=local&q=' + encodeURIComponent(q) + acc); if (!live()) return;
      S.mail.remote = { q, ids: new Set(l.ids || []), local: true }; show();
      if (!now) await sleep(250); if (!live()) return;
      for (let n = 0; n < 40; n++) {
        const r = await api('/mailbox/search?q=' + encodeURIComponent(q) + acc); if (!live()) return;
        if (r.local && r.error && !S.mail.gmErr) { S.mail.gmErr = r.error; }
        if (r.ids && r.ids.some(id => !mthread(id))) { const d = await api('/mailbox?all=1'); if (!live()) return; S.mail.threads = d.threads; S.mail.labels = d.labels || S.mail.labels; }
        S.mail.remote = { q, ids: new Set(r.ids || []), local: !!r.local }; S.mail.pending = r.pending || 0; show();
        if (!r.pending || !r.loaded) break;
      }
    } catch { /* the list already shows the instant answer */ }
    if (live()) { S.mail.searching = false; S.mail.pending = 0; show(); }
  }, now ? 0 : 150);
}
const visible = () => S.mail.folder === 'archive' ? S.mail.arch.rows.filter(t => (!S.mail.acc || t.accountId === S.mail.acc)) : S.mail.remote && S.mail.q && S.mail.remote.q === S.mail.q.trim() ? S.mail.threads.filter(t => S.mail.remote.ids.has(t.id) && (!S.mail.acc || t.accountId === S.mail.acc) && (S.mail.filter === 'unread' ? t.unread > 0 : true)).sort((a, b) => b.updatedAt - a.updatedAt) : S.mail.threads.filter(t => (!S.mail.acc || t.accountId === S.mail.acc) && (S.mail.q ? (/\bin:(trash|bin|spam|anywhere)\b/i.test(S.mail.q) || (!t.trashed && !t.spam)) : inFolder(t, S.mail.folder)) && matchQuery(t, S.mail.q) && (S.mail.filter === 'unread' ? t.unread > 0 : true)).sort((a, b) => b.updatedAt - a.updatedAt);
// unread conversations per folder and per label, counted in ONE pass over the mail (like Gmail's sidebar numbers)
function railCounts() {
  const c = { inbox: 0, unassigned: 0, labels: {} }, me = S.me.id;
  for (const t of S.mail.threads) {
    if (!t.unread || t.trashed || t.spam || (S.mail.acc && t.accountId !== S.mail.acc)) continue;
    if (t.status === 'open') { if (t.agentId === me || (t.sharedWith || []).includes(me)) c.inbox++; else if (!t.agentId) c.unassigned++; }
    if (t.labels) for (const l of t.labels) c.labels[l] = (c.labels[l] || 0) + 1;
  }
  return c;
}


// ---------- search box: suggestions + recent searches (like Gmail) ----------
const SUG_OPS = [['from:', 'Sender'], ['to:', 'Recipient'], ['subject:', 'Words in the subject'], ['label:', 'Conversations with a label'], ['has:attachment', 'Has an attachment'], ['filename:', 'Attachment name or type, e.g. pdf'], ['is:unread', 'Unread'], ['is:read', 'Already read'], ['is:starred', 'Starred'], ['is:important', 'Marked important'], ['in:inbox', 'Only the inbox'], ['in:sent', 'Sent mail'], ['in:trash', 'Bin'], ['in:spam', 'Spam'], ['in:anywhere', 'Everywhere, including Bin and Spam'], ['newer_than:', 'e.g. 7d, 2m, 1y'], ['older_than:', 'e.g. 30d, 6m, 1y'], ['after:', 'Date, e.g. 2026/01/31'], ['before:', 'Date, e.g. 2026/12/31'], ['larger:', 'e.g. 5M'], ['smaller:', 'e.g. 500K'], ['cc:', 'Copied to'], ['bcc:', 'Blind-copied to'], ['OR', 'Either word']];
const SUG_VALUES = { in: ['inbox', 'sent', 'starred', 'important', 'done', 'trash', 'spam', 'anywhere'], is: ['unread', 'read', 'starred', 'important', 'done'], has: ['attachment', 'nouserlabels', 'userlabels'] };
const recentKey = () => 'mailRecent:' + (S.me ? S.me.id : '');
const getRecent = () => { try { return JSON.parse(localStorage.getItem(recentKey()) || '[]').slice(0, 10); } catch { return []; } };
function addRecent(q) { q = String(q || '').trim(); if (!q) return; try { localStorage.setItem(recentKey(), JSON.stringify([q, ...getRecent().filter(x => x !== q)].slice(0, 10))); } catch {} }
function delRecent(q) { try { localStorage.setItem(recentKey(), JSON.stringify(getRecent().filter(x => x !== q))); } catch {} }
function contactsFor(frag) { // people from the loaded mail, most frequent first
  const f = frag.toLowerCase(), by = new Map();
  for (const t of S.mail.threads) { const e = (t.whoEmail || '').toLowerCase(); if (!e) continue; const c = by.get(e) || { email: e, name: t.who && t.who.toLowerCase() !== e ? t.who : '', n: 0 }; c.n++; by.set(e, c); }
  return [...by.values()].filter(c => !f || c.email.includes(f) || c.name.toLowerCase().includes(f)).sort((a, b) => b.n - a.n).slice(0, 7);
}
let msugItems = [], msugAt = -1, msugApply = null;
function msugClose() { const b = document.querySelector('.gm-sug'); if (b) b.remove(); msugItems = []; msugAt = -1; }
function msugBuild() {
  const inp = $('#mq'); if (!inp) return []; const v = inp.value, pos = inp.selectionStart ?? v.length, head = v.slice(0, pos), tail = v.slice(pos);
  const m = /(-?)(\S*)$/.exec(head), neg = m[1], tok = m[2], base = head.slice(0, head.length - m[0].length), out = [];
  const put = (label, hint, ins, go, extra = {}) => out.push({ label, hint, value: base + neg + ins + (go ? '' : '') + tail, go, ...extra });
  if (!v.trim()) { for (const r of getRecent()) out.push({ label: r, recent: true, value: r, go: true }); for (const [o, h] of SUG_OPS.slice(0, 5)) out.push({ label: o, hint: h, value: o, go: false }); return out; }
  const kv = /^([a-z_]+):(.*)$/i.exec(tok);
  if (kv) {
    const op = kv[1].toLowerCase(), val = kv[2].replace(/^"/, '').toLowerCase();
    if (['from', 'to', 'cc', 'bcc'].includes(op)) for (const c of contactsFor(val)) put(c.name ? `${c.name}` : c.email, c.name ? c.email : '', `${op}:${c.email}`, true, { person: c.email });
    else if (op === 'label') for (const l of allLabels().filter(l => l.toLowerCase().includes(val)).slice(0, 8)) put(l, '', `label:${/\s/.test(l) ? '"' + l + '"' : l}`, true, { dot: hue(l) });
    else if (SUG_VALUES[op]) for (const x of SUG_VALUES[op].filter(x => x.startsWith(val)).slice(0, 8)) put(`${op}:${x}`, '', `${op}:${x}`, true);
    return out;
  }
  const f = tok.toLowerCase();
  if (f) {
    for (const [o, h] of SUG_OPS) if (o.toLowerCase().startsWith(f) && o.toLowerCase() !== f) put(o, h, o, !o.endsWith(':'));
    for (const c of contactsFor(f).slice(0, 4)) put(c.name || c.email, c.name ? c.email : '', `from:${c.email}`, true, { person: c.email, pre: 'From' });
    for (const r of getRecent().filter(r => r.toLowerCase().startsWith(v.toLowerCase()) && r !== v).slice(0, 3)) out.push({ label: r, recent: true, value: r, go: true });
  }
  return out.slice(0, 10);
}
function msugShow() {
  const inp = $('#mq'); if (!inp || document.activeElement !== inp) return; const box = inp.closest('.gm-search'), old = document.querySelector('.gm-sug'); if (old) old.remove();
  msugItems = msugBuild(); msugAt = -1; if (!msugItems.length) return;
  const el = document.createElement('div'); el.className = 'gm-sug';
  el.innerHTML = msugItems.map((x, i) => `<div class="si" data-i="${i}">${x.recent ? `<span class="sic">${ic('clock')}</span>` : x.dot ? `<span class="sic"><i class="dot" style="background:${x.dot}"></i></span>` : x.person ? mav(x.label, x.person, 'sm') : `<span class="sic">${ic('search')}</span>`}<span class="sl">${x.pre ? `<em>${x.pre}:</em> ` : ''}${esc(x.label)}</span>${x.hint ? `<span class="sh">${esc(x.hint)}</span>` : ''}${x.recent ? `<button class="ib sm sx" data-x="${i}" title="Remove from recent searches">${ic('x')}</button>` : ''}</div>`).join('');
  el.onmousedown = e => e.preventDefault(); // keep the focus in the box
  el.onclick = e => { const x = e.target.closest('[data-x]'); if (x) { delRecent(msugItems[+x.dataset.x].label); msugShow(); return; } const r = e.target.closest('.si'); if (r) msugPick(msugItems[+r.dataset.i]); };
  const r = box.getBoundingClientRect(); // lives on <body>, above every panel, so nothing can cover it
  el.style.cssText = `left:${r.left}px;top:${r.bottom + 4}px;width:${r.width}px`; document.body.appendChild(el);
}
function msugPick(x) {
  const inp = $('#mq'); inp.value = x.value; msugClose();
  if (x.go) { msugApply(x.value, true); addRecent(x.value); inp.blur(); } else { msugApply(x.value); inp.focus(); inp.setSelectionRange(x.value.length, x.value.length); msugShow(); }
}
function searchBoxWire(doSearch) {
  msugApply = doSearch; const inp = $('#mq');
  inp.onfocus = msugShow; inp.onblur = () => setTimeout(msugClose, 120); inp.onclick = msugShow;
  inp.onkeydown = e => {
    const rows = [...document.querySelectorAll('.gm-sug .si')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!rows.length) { msugShow(); return e.preventDefault(); } e.preventDefault(); msugAt = e.key === 'ArrowDown' ? (msugAt + 1 >= rows.length ? -1 : msugAt + 1) : (msugAt - 1 < -1 ? rows.length - 1 : msugAt - 1); rows.forEach((r, i) => r.classList.toggle('on', i === msugAt)); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (msugAt >= 0 && msugItems[msugAt]) return msugPick(msugItems[msugAt]); const v = inp.value.trim(); msugClose(); if (v) { addRecent(v); doSearch(v, true); } return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (rows.length) return msugClose(); if (inp.value) { inp.value = ''; doSearch('', true); } inp.blur(); }
  };
}

// ---------- screen ----------
// The mail page opens at once: the frame is drawn straight away (with the mail already loaded last time, if any) and the
// mailbox, drafts, scheduled list, theme and signature are fetched together in the background, then the list is refreshed.
function viewMail() {
  const first = !S.mail.loaded;
  mailScreen(); if (first) { const m = $('#gmain'); if (m) m.innerHTML = `<div class="empty"><div><div class="big">${ic('mail')}</div><b>Loading your mail…</b></div></div>`; }
  const gotMail = api('/mailbox').then(d => { S.mail.threads = d.threads; S.mail.accounts = d.accounts; S.mail.labels = d.labels || []; S.mail.perms = d.perms || {}; S.mail.loaded = true; }).catch(e => toast(e.message, true));
  loadTheme().then(() => { if (S.view === 'mail' && $('#gm')) { applyTheme(); applyBg(); } }).catch(() => {}); loadSig();
  Promise.all([gotMail, loadExtra()]).then(() => {
    if (S.view !== 'mail' || !$('#gm')) return; // the person already went to another page
    const multi = S.mail.accounts.length > 1;
    if (multi !== !!$('#macc')) mailScreen(); else gmRender();
    backProgress();
  });
}
function mailScreen() {
  const multi = S.mail.accounts.length > 1;
  $('#main').innerHTML = `<div class="gm ${S.mail.rail ? '' : 'railc'} ${S.mail.drawer ? 'drawer' : ''}" id="gm">
    <div class="gm-top"><button class="ib" id="gmmenu" title="Main menu">${ic('menu')}</button>
      <div class="gm-title">${ic('mail')}<span>Mail</span></div>
      <div class="gm-search">${ic('search')}<input type="search" id="mq" placeholder="Search mail  (try from:, subject:, label:, is:unread, has:attachment)" value="${esc(S.mail.q)}" autocomplete="off"><button class="ib sm" id="mclr" title="Clear search" ${S.mail.q ? '' : 'hidden'}>${ic('x')}</button><button class="ib sm" id="mopt" title="Show search options">${ic('sliders')}</button></div>
      ${multi ? `<select id="macc" class="gm-acc" title="Mailbox"><option value="">All mailboxes</option>${S.mail.accounts.map(a => `<option value="${a.id}" ${S.mail.acc === a.id ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select>` : ''}
      <div class="gm-top-r"><button class="ib" id="mpo" title="Find PO / P.R and email it">${ic('box')}</button><button class="ib" id="mkb" title="Keyboard shortcuts (?)">${ic('kbd')}</button><button class="ib" id="mthm" title="Theme & background">${ic('palette')}</button>${isAdmin() ? `<button class="ib" id="mrul" title="Routing rules (domain → person)">${ic('filter')}</button><button class="ib" id="msync" title="Fetch from Gmail now">${ic('refresh')}</button><button class="ib" id="mcfg" title="Mailbox settings">${ic('cog')}</button>` : ''}</div></div>
    <div class="gm-prog" id="gprog" hidden></div>
    <div class="gm-body"><nav class="gm-rail" id="grail"></nav><div class="gm-scrim" id="gscrim"></div><section class="gm-main" id="gmain"></section></div></div>`;
  $('#gmmenu').onclick = () => { if (innerWidth <= 860) S.mail.drawer = !S.mail.drawer; else S.mail.rail = !S.mail.rail; $('#gm').classList.toggle('railc', !S.mail.rail); $('#gm').classList.toggle('drawer', S.mail.drawer); };
  $('#gscrim').onclick = () => { S.mail.drawer = false; $('#gm').classList.remove('drawer'); };
  const doSearch = (v, now) => { S.mail.q = v; S.mail.gmErr = ''; if (S.mail.folder === 'archive') archiveLoad(v, now); else remoteSearch(now); S.mail.page = 0; S.mail.chk.clear(); S.mail.sel = null; $('#mclr').hidden = !v; gmRender(); };
  $('#mq').oninput = e => { doSearch(e.target.value); msugShow(); };
  $('#mclr').onclick = () => { $('#mq').value = ''; doSearch('', true); $('#mq').focus(); msugShow(); };
  searchBoxWire(doSearch);
  if ($('#macc')) $('#macc').onchange = e => { S.mail.acc = e.target.value; S.mail.page = 0; gmRender(); };
  if (isAdmin()) {
    $('#msync').onclick = async e => { const b = e.currentTarget; b.classList.add('spin'); try { const r = await api('/mailbox/sync', { method: 'POST' }); toast(r.error ? r.error : r.added ? `${r.added} new email${r.added > 1 ? 's' : ''}` : 'Up to date', !!r.error); await mreload(); } catch (err) { toast(err.message, true); } b.classList.remove('spin'); };
    $('#mcfg').onclick = mailSettings; $('#mrul').onclick = rulesModal;
  }
  $('#mkb').onclick = kbHelp; $('#mthm').onclick = openTheme; $('#mopt').onclick = () => searchPanel(); $('#mpo').onclick = poWindow;
  gmRender(); backProgress();
}
async function loadExtra() { try { S.mail.drafts = (await api('/mailbox/drafts')).drafts; S.mail.scheduled = (await api('/mailbox/scheduled')).scheduled; } catch {} }
async function mreload() { const d = await api('/mailbox'); S.mail.threads = d.threads; S.mail.accounts = d.accounts; S.mail.labels = d.labels || []; S.mail.perms = d.perms || {}; await loadExtra(); if (S.mail.folder === 'archive') archiveLoad(S.mail.q, true); if (S.mail.sel && !mthread(S.mail.sel)) S.mail.sel = null; gmRender(); }
function gmRender() { if (!$('#grail')) return; applyBg(); gmRail(); S.mail.sel ? gmThread() : ['drafts', 'scheduled'].includes(S.mail.folder) && !S.mail.q ? gmQueue() : gmList(); }

function gmRail() {
  const main = [['inbox', 'tray', 'Inbox'], ['star', 'star', 'Starred'], ['sent', 'sentI', 'Sent'], ['drafts', 'draft', 'Drafts'], ...(isAdmin() ? [['unassigned', 'user', 'Unassigned']] : [])];
  const more = [['important', 'imp', 'Important'], ['scheduled', 'clock', 'Scheduled'], ['done', 'archive', 'Done'], ...(isAdmin() ? [['all', 'all', 'All mail']] : []), ['archive', 'archive', 'Older mail (archive)'], ['spam', 'spamI', 'Spam'], ['trash', 'bin', 'Bin']];
  const lb = allLabels(), rc = railCounts(), cnt = k => k === 'drafts' ? S.mail.drafts.length : k === 'scheduled' ? S.mail.scheduled.length : (rc[k] || 0);
  const row = ([k, i, l]) => { const n = cnt(k); return `<button class="fl ${S.mail.folder === k && !S.mail.q ? 'on' : ''}" data-f="${k}" title="${l}">${ic(i)}<span class="fn">${l}</span>${n ? `<b class="fc">${n}</b>` : ''}</button>`; };
  const moreOn = S.mail.more || more.some(m => m[0] === S.mail.folder);
  $('#grail').innerHTML = `<button class="compose" id="gcomp" title="Compose">${ic('pencil')}<span>Compose</span></button>
    ${main.map(row).join('')}
    <button class="fl" id="gmore" title="${moreOn ? 'Less' : 'More'}">${ic(moreOn ? 'chevU' : 'chevD')}<span class="fn">${moreOn ? 'Less' : 'More'}</span></button>
    ${moreOn ? more.map(row).join('') + `<button class="fl" id="gmanage" title="Manage labels">${ic('cog')}<span class="fn">Manage labels</span></button>${canMakeLabel() ? `<button class="fl" id="gnl2" title="Create new label">${ic('plus')}<span class="fn">Create new label</span></button>` : ''}` : ''}
    <button class="fl" id="gsig" title="My signature">${ic('edit')}<span class="fn">My signature</span></button>
    ${mperm('filters') ? `<button class="fl" id="gflt" title="Filters">${ic('filter')}<span class="fn">Filters</span></button>` : ''}
    <div class="lbh"><span>Labels</span><span><button class="ib sm" id="glm" title="Manage labels">${ic('cog')}</button>${canMakeLabel() ? `<button class="ib sm" id="gnl" title="Create new label">${ic('plus')}</button>` : ''}</span></div>
    ${lb.map(l => { const n = rc.labels[l] || 0; return `<button class="fl ${n ? 'un' : ''} ${S.mail.folder === 'label:' + l && !S.mail.q ? 'on' : ''}" data-f="label:${esc(l)}" title="${esc(l)}${n ? ` — ${n} unread` : ''}"><i class="dot" style="background:${hue(l)}"></i><span class="fn">${esc(l)}</span>${n ? `<b class="fc">${n > 999 ? '999+' : n}</b>` : ''}</button>`; }).join('') || '<div class="hint" style="padding:4px 14px 0">No labels yet</div>'}`;
  $('#gcomp').onclick = () => compose();
  $('#gmore').onclick = () => { S.mail.more = !moreOn; gmRail(); };
  $('#gsig').onclick = sigModal; if ($('#gflt')) $('#gflt').onclick = manageFilters; $('#glm').onclick = manageLabels;
  if ($('#gnl')) $('#gnl').onclick = newLabel; if ($('#gnl2')) { $('#gnl2').onclick = newLabel; $('#gmanage').onclick = manageLabels; }
  $('#grail').onclick = e => { const b = e.target.closest('.fl[data-f]'); if (!b) return; S.mail.folder = b.dataset.f; S.mail.q = ''; $('#mq').value = ''; if (b.dataset.f === 'archive') archiveLoad('', true); $('#mclr').hidden = true; S.mail.sel = null; S.mail.page = 0; S.mail.chk.clear(); S.mail.drawer = false; $('#gm').classList.remove('drawer'); gmRender(); };
}
async function newLabel() {
  const l = (await gprompt('New label name') || '').trim(); if (!l) return;
  try { await api('/mailbox/labels', { method: 'POST', body: { name: l } }); await mreload(); S.mail.folder = 'label:' + l; S.mail.sel = null; S.mail.q = ''; if ($('#mq')) $('#mq').value = ''; toast(privMode() ? 'Label created' : 'Label created in Gmail'); gmRender(); } catch (e) { toast(e.message, true); }
}
function manageLabels() {
  const lb = allLabels(), canDel = mperm('deleteLabels') || privMode();
  modal(`<h3>Labels</h3><p class="hint" style="margin-bottom:10px">${privMode() ? 'These are your own labels — only you can see them. Use them to sort and filter your mail.' : 'These are your Gmail labels — the same ones you see in Gmail.'} ${privMode() ? 'Deleting one only removes it from your conversations.' : canDel ? 'Deleting a label removes it from Gmail too (the emails stay).' : 'Only the admin can delete labels.'}</p>
    ${lb.map(l => { const n = S.mail.threads.filter(t => (t.labels || []).includes(l)).length; return `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><i class="dot" style="background:${hue(l)}"></i><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(l)}</b><span class="hint">${n} conversation${n === 1 ? '' : 's'}</span><button class="btn sm" data-sh="${esc(l)}">Show</button>${canDel ? `<button class="btn sm ghost danger" data-rm="${esc(l)}" title="Delete label">${ic('trash')}</button>` : ''}</div>`; }).join('') || '<div class="hint">No labels in Gmail yet.</div>'}
    <div class="acts">${canMakeLabel() ? `<button class="btn" id="mlnew">${ic('plus')} New label</button>` : ''}<button class="btn primary" id="cx">Close</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; if ($('#mlnew', bg)) $('#mlnew', bg).onclick = () => { close(); newLabel(); };
    bg.onclick = async e => {
      const sh = e.target.closest('[data-sh]'), rm = e.target.closest('[data-rm]');
      if (sh) { close(); S.mail.folder = 'label:' + sh.dataset.sh; S.mail.q = ''; if ($('#mq')) $('#mq').value = ''; S.mail.sel = null; gmRender(); }
      if (rm && await gconfirm(`Delete the label “${rm.dataset.rm}”? It will be removed from Gmail and from every conversation (the emails are not deleted).`)) { try { await api('/mailbox/labels', { method: 'DELETE', body: { name: rm.dataset.rm } }); close(); await mreload(); toast('Label deleted'); } catch (err) { toast(err.message, true); } }
    };
  });
}

const FOLDER_NAME = { archive: 'Archive (older mail)', inbox: 'Inbox', star: 'Starred', sent: 'Sent', unassigned: 'Unassigned', done: 'Done', all: 'All mail', important: 'Important', spam: 'Spam', trash: 'Bin', drafts: 'Drafts', scheduled: 'Scheduled' };
function gmList() {
  const all = visible(), pages = Math.max(1, Math.ceil(all.length / PAGE)); if (S.mail.page >= pages) S.mail.page = pages - 1;
  const list = all.slice(S.mail.page * PAGE, S.mail.page * PAGE + PAGE), sel = S.mail.chk, ids = list.map(t => t.id), nsel = ids.filter(i => sel.has(i)).length;
  const bulk = nsel > 0, fname = (S.mail.q ? 'Search results' : (FOLDER_NAME[S.mail.folder] || S.mail.folder.replace('label:', ''))) + (S.mail.folder === 'archive' && S.mail.arch.capped ? ' — newest 300, type to narrow' : '');
  const unreadTotal = S.mail.threads.filter(t => t.unread > 0 && inFolder(t, S.mail.folder)).length;
  $('#gmain').innerHTML = `<div class="gm-tools">
      <div class="selbox"><label class="cb"><input type="checkbox" id="gall" ${nsel && nsel === ids.length ? 'checked' : ''} ${ids.length ? '' : 'disabled'}><i class="${nsel && nsel < ids.length ? 'part' : ''}"></i></label><button class="ib sm" id="gsm" title="Select">${ic('chevD')}</button></div>
      ${bulk ? (S.mail.folder === 'trash' ? `<button class="ib" data-b="restore" title="Restore to inbox">${ic('restore')}</button><button class="ib" data-b="purge" title="Delete forever">${ic('trash')}</button>` : `<button class="ib" data-b="archive" title="${S.mail.folder === 'done' ? 'Move to inbox' : 'Mark as done (archive)'}">${ic('archive')}</button><button class="ib" data-b="${S.mail.folder === 'spam' ? 'restore' : 'spam'}" title="${S.mail.folder === 'spam' ? 'Not spam' : 'Report spam'}">${ic('spamI')}</button><button class="ib" data-b="trash" title="Delete">${ic('bin')}</button>`) + `<button class="ib" data-b="unread" title="Mark as unread">${ic('mail')}</button><button class="ib" data-b="read" title="Mark as read">${ic('mailopen')}</button><button class="ib" data-b="star" title="Star">${ic('star')}</button><button class="ib" data-b="important" title="Toggle important">${ic('imp')}</button><button class="ib" data-b="label" title="Label as">${ic('label')}</button><span class="hint selc">${nsel} selected</span>`
        : `<button class="ib" id="grf" title="Refresh">${ic('refresh')}</button><span class="gm-fn">${esc(fname)}</span>${S.mail.q && S.mail.searching ? `<span class="hint srch">${ic('refresh')} Searching all mail${S.mail.pending ? ` — loading ${S.mail.pending} more` : ''}…</span>` : ''}${unreadTotal ? `<span class="hint">${unreadTotal} unread</span>` : ''}${S.mail.folder === 'trash' && all.length ? `<button class="btn sm" id="gempty">Empty Bin now</button>` : ''}`}
      <span class="sp"></span><span class="pg">${all.length ? `${S.mail.page * PAGE + 1}–${Math.min(all.length, (S.mail.page + 1) * PAGE)} of ${all.length}` : '0'}</span>
      <button class="ib" id="gpv" title="Newer" ${S.mail.page ? '' : 'disabled'}>${ic('chevL')}</button><button class="ib" id="gnx" title="Older" ${S.mail.page < pages - 1 ? '' : 'disabled'}>${ic('chevR')}</button></div>
    <div class="gm-tabs"><button class="${S.mail.filter === '' ? 'on' : ''}" data-ft="">${ic('tray')} All</button><button class="${S.mail.filter === 'unread' ? 'on' : ''}" data-ft="unread">${ic('mail')} Unread</button></div>
    <div class="gm-rows" id="grows">${list.length ? list.map(rowHtml).join('') : `<div class="empty"><div><div class="big">${ic('mail')}</div><b>${S.mail.q ? 'No messages matched your search.' : S.mail.folder === 'inbox' ? 'Your inbox is empty' : (S.mail.folder === 'archive' ? (S.mail.arch.loading ? 'Searching the archive…' : S.mail.q ? 'No older mail matched' : 'The archive is empty') : 'Nothing in ' + esc(fname))}</b><div class="hint" style="margin-top:4px">${S.mail.folder === 'archive' ? 'Mail older than ' + S.mail.arch.days + ' days is kept on your NAS. Type in the search box to look through it.' : S.mail.accounts.length ? 'New mail appears automatically.' : isAdmin() ? 'Add a Gmail mailbox with the gear button at the top.' : 'Ask your admin to connect the mailbox.'}</div></div></div>`}</div>`;
  const rows = $('#grows');
  rows.onclick = async e => {
    const row = e.target.closest('.gr'); if (!row) return; const id = row.dataset.id, t = mthread(id);
    if (e.target.closest('.cb')) { sel.has(id) ? sel.delete(id) : sel.add(id); return gmList(); }
    if (e.target.closest('.gst')) { await tdo([id], 'star'); return; }
    const a = e.target.closest('[data-ra]'); if (a) { await tdo([id], a.dataset.ra); return; }
    const at = e.target.closest('[data-att]'); if (at) { previewThread(t, +at.dataset.att); return; } // open the PDF / picture without opening the mail
    openMail(id);
  };
  $('#gall').onchange = e => { ids.forEach(i => e.target.checked ? sel.add(i) : sel.delete(i)); gmList(); };
  $('#gsm').onclick = e => gmenu(e.currentTarget, [['All', () => ids.forEach(i => sel.add(i))], ['None', () => sel.clear()], ['Read', () => { sel.clear(); list.filter(t => !t.unread).forEach(t => sel.add(t.id)); }], ['Unread', () => { sel.clear(); list.filter(t => t.unread).forEach(t => sel.add(t.id)); }], ['Starred', () => { sel.clear(); list.filter(t => t.starred).forEach(t => sel.add(t.id)); }]].map(([t, f]) => ({ t, f: () => { f(); gmList(); } })));
  if ($('#grf')) $('#grf').onclick = e => { e.currentTarget.classList.add('spin'); mreload().catch(err => toast(err.message, true)); };
  $$('[data-b]', $('#gmain')).forEach(b => b.onclick = async e => { const k = b.dataset.b, picked = [...sel]; if (k === 'label') return labelMenu(b, picked); if (k === 'purge' && !await gconfirm('Delete forever?')) return; tdo(picked, k === 'archive' && S.mail.folder === 'done' ? 'reopen' : k); });
  if ($('#gempty')) $('#gempty').onclick = async () => { if (await gconfirm('Delete all conversations in the Bin forever? (Gmail also clears its own Bin after 30 days.)')) tdo(all.map(t => t.id), 'purge'); };
  $('#gpv').onclick = () => { S.mail.page--; gmList(); }; $('#gnx').onclick = () => { S.mail.page++; gmList(); };
  $$('[data-ft]', $('#gmain')).forEach(b => b.onclick = () => { S.mail.filter = b.dataset.ft; S.mail.page = 0; gmList(); });
}
function gmQueue() {
  const sch = S.mail.folder === 'scheduled', items = sch ? S.mail.scheduled : S.mail.drafts;
  const to = d => (d.to || []).join(', ') || '(no recipient)';
  $('#gmain').innerHTML = `<div class="gm-tools"><button class="ib" id="grf" title="Refresh">${ic('refresh')}</button><span class="gm-fn">${sch ? 'Scheduled' : 'Drafts'}</span><span class="hint">${items.length} ${sch ? 'waiting to send' : 'saved'}</span></div>
    <div class="gm-rows" id="grows">${items.length ? items.map(d => `<div class="gr q" data-id="${d.id}"><span class="gwho">${sch ? '' : '<b class="draftl">Draft</b> '}${esc(to(d))}</span><span class="gsub"><b>${esc(d.subject || '(no subject)')}</b>${d.error ? `<span class="chip" style="--c:#d93025">Failed: ${esc(d.error)}</span>` : ''}${d.files ? `<span class="gcl">${ic('clip')}</span>` : ''}</span><span class="gdt" style="width:auto;padding-right:8px">${sch ? ic('clock').replace('class="i"', 'class="i" style="width:14px;height:14px;vertical-align:-2px"') + ' ' + new Date(d.sendAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : fmtTime(d.updatedAt)}</span><button class="ib sm" data-del="${d.id}" title="${sch ? 'Cancel sending' : 'Discard draft'}">${ic(sch ? 'x' : 'bin')}</button></div>`).join('') : `<div class="empty"><div><div class="big">${ic(sch ? 'clock' : 'draft')}</div><b>${sch ? 'No scheduled emails' : 'No saved drafts'}</b><div class="hint" style="margin-top:4px">${sch ? 'Use the arrow next to Send in a new message to send later.' : 'Close a message you started and it is saved here.'}</div></div></div>`}</div>`;
  $('#grf').onclick = () => mreload().catch(e => toast(e.message, true));
  $('#grows').onclick = async e => {
    const row = e.target.closest('.gr'); if (!row) return; const id = row.dataset.id;
    if (e.target.closest('[data-del]')) { if (sch && !await gconfirm('Cancel this scheduled email?')) return; await api(`/mailbox/${sch ? 'scheduled' : 'drafts'}/${id}`, { method: 'DELETE' }); await loadExtra(); gmRender(); return; }
    if (!sch) { const d = S.mail.drafts.find(x => x.id === id); if (d) compose({ draft: d }); }
  };
}
function rowHtml(t) {
  const on = S.mail.chk.has(t.id), a = agent(t.agentId), rest = ' – ' + t.snippet;
  const ats = (t.atts || []).slice(0, 3).map((f, n) => `<span class="attc" data-att="${n}" title="${esc(f.name)} — click to open"><i class="attx" style="--c:${KCOL[fileKind(f.name, f.type)] || '#5f6368'}">${esc(mailExtOf(f.name))}</i><span class="attn">${esc(f.name)}</span></span>`).join('') + ((t.attTotal || 0) > 3 ? `<span class="attc attm" data-att="3" title="Show the other attachments">+${t.attTotal - 3}</span>` : '');
  const age = t.newAt ? Date.now() - t.newAt : 1e9, fresh = age < 7000 && t.unread;
  return `<div ${fresh ? `style="animation-delay:-${age}ms"` : ''} class="gr ${fresh ? 'fresh' : ''} ${t.unread ? 'un' : ''} ${on ? 'on' : ''} ${S.mail.cur === t.id ? 'cur' : ''} ${ats ? 'hasatt' : ''}" data-id="${t.id}">
    <span class="cb"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1"><i></i></span>
    <button class="gst ${t.starred ? 'on' : ''}" title="${t.starred ? 'Starred' : 'Not starred'}">${ic('star')}</button>
    ${t.important ? `<span class="imp" title="Important">${ic('imp')}</span>` : ''}<span class="gwho">${esc(t.sent && !t.unread && t.count && S.mail.folder === 'sent' ? 'To: ' + t.who : t.who)}${t.count > 1 ? ` <em>${t.count}</em>` : ''}</span>
    <span class="gsub">${t.orgName ? `<span class="chip org">${esc(t.orgName)}</span>` : ''}${(t.labels || []).slice(0, 3).map(l => `<span class="chip" style="--c:${hue(l)}">${esc(l)}</span>`).join('')}<b>${esc(t.subject || '(no subject)')}</b><span class="sn">${esc(rest)}</span></span>
    ${a && a.id !== S.me.id ? `<span class="who-a" title="Handled by ${esc(a.name)}">${avatar(a, 'sm')}</span>` : ''}${t.hasFiles ? `<span class="gcl">${ic('clip')}</span>` : ''}
    <span class="gdt">${fmtTime(t.updatedAt)}</span>
    ${ats ? `<div class="gatt">${ats}</div>` : ''}
    <span class="gra">${t.trashed || t.spam ? `<button class="ib sm" data-ra="restore" title="${t.spam ? 'Not spam' : 'Restore'}">${ic('restore')}</button>${t.trashed ? `<button class="ib sm" data-ra="purge" title="Delete forever">${ic('trash')}</button>` : ''}` : `<button class="ib sm" data-ra="${t.status === 'resolved' ? 'reopen' : 'resolve'}" title="${t.status === 'resolved' ? 'Move to inbox' : 'Done (archive)'}">${ic('archive')}</button><button class="ib sm" data-ra="trash" title="Delete">${ic('bin')}</button><button class="ib sm" data-ra="${t.unread ? 'read' : 'unread'}" title="${t.unread ? 'Mark as read' : 'Mark as unread'}">${ic(t.unread ? 'mailopen' : 'mail')}</button>`}</span></div>`;
}
// run an action on several threads
const OPT = { read: t => { t.unread = 0; }, unread: t => { t.unread = Math.max(1, t.unread || 0); }, star: t => { t.starred = !t.starred; }, important: t => { t.important = !t.important; }, resolve: t => { t.status = 'resolved'; }, reopen: t => { t.status = 'open'; }, trash: t => { t.trashed = true; }, spam: t => { t.spam = true; t.trashed = false; }, restore: t => { t.trashed = false; t.spam = false; } };
async function tdo(ids, act) {
  if (S.mail.folder === 'archive' && ids.some(i => (mthread(i) || {}).archived)) return toast('Older mail is read-only. Open it and press “Restore” to work on it.', true);
  const map = { archive: 'resolve' }, a = map[act] || act;
  const todo = ids.map(mthread).filter(t => t && !(a === 'purge' && !t.trashed) && !(a === 'read' && !t.unread) && !(a === 'unread' && t.unread));
  if (a === 'purge' && !todo.length) return;
  try {
    // 1) the screen changes immediately  2) the server (and Gmail behind it) is told in parallel  3) no full reload of the mailbox afterwards
    if (a === 'purge') { const gone = new Set(todo.map(t => t.id)); S.mail.threads = S.mail.threads.filter(t => !gone.has(t.id)); } else if (OPT[a]) todo.forEach(OPT[a]);
    S.mail.chk.clear(); if (['resolve', 'reopen', 'trash', 'spam', 'restore', 'purge'].includes(a)) S.mail.sel = null; keepScroll(gmRender);
    const sent = Promise.all(todo.map(t => mpost(t.id, a)));
    if (a === 'trash') toast(ids.length > 1 ? `${ids.length} conversations moved to the Bin` : 'Conversation moved to the Bin');
    if (a === 'spam') toast('Reported as spam'); if (a === 'restore') toast('Restored');
    if (a === 'resolve') toast(ids.length > 1 ? `${ids.length} conversations marked done` : 'Conversation marked done — archived in Gmail');
    if (a === 'reopen') toast('Moved to inbox');
    await sent;
  } catch (e) { toast(e.message, true); mreload().catch(() => {}); }
}
function labelMenu(anchor, ids) {
  const th = ids.map(mthread).filter(Boolean), lb = allLabels();
  const items = lb.map(l => { const has = th.every(t => (t.labels || []).includes(l)); return { t: l, dot: hue(l), chk: has, f: async () => { th.forEach(t => { t.labels = has ? (t.labels || []).filter(x => x !== l) : [...new Set([...(t.labels || []), l])]; }); S.mail.chk.clear(); keepScroll(gmRender); try { await Promise.all(th.map(t => mpost(t.id, 'label', { label: l, add: !has }))); } catch (e) { toast(e.message, true); mreload(); } } }; });
  items.push('-', { t: 'Create new', f: async () => { const l = await gprompt(privMode() ? 'Label name' : 'Label name (created in Gmail if it does not exist yet)'); if (!l || !l.trim()) return; try { for (const t of th) await mpost(t.id, 'label', { label: l.trim(), add: true }); S.mail.chk.clear(); await mreload(); } catch (e) { toast(e.message, true); } } });
  gmenu(anchor, items);
}

// ---------- opening / reading ----------
async function openMail(id) {
  S.mail.sel = id; S.mail.cur = id; S.mail.mcur = ''; S.mail.reply = null; S.mail.mails = []; S.mail.open = new Set();
  const t0 = mthread(id); if (t0 && t0.unread) { t0.unread = 0; mpost(id, 'read').catch(() => {}); } // marked read straight away; Gmail follows in the background
  gmThread();
  try {
    S.mail.mails = (await api('/mailbox/' + id)).mails; const ms = S.mail.mails;
    ms.forEach((m, i) => { if (i === ms.length - 1 || (m.dir === 'in' && !m.seen)) S.mail.open.add(m.id); });
  } catch (e) { toast(e.message, true); }
  gmThread(); gmRail();
}
// HTML emails run inside a sandboxed frame: no access to the app, no network except pictures you allow.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,;:!?)\]}])/gi;
// plain-text mail: make web addresses clickable (like Gmail does)
const linkText = s => esc(s).replace(URL_RE, u => `<a href="${/^www\./i.test(u) ? 'https://' : ''}${u.replace(/&amp;/g, '&')}" target="_blank" rel="noopener noreferrer">${u}</a>`);
// is the app currently drawn on a dark surface? (then a mail made for white paper keeps a white panel, as Gmail's dark mode would otherwise garble its colours)
function darkSurface() { const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;color:var(--surface)'; document.body.appendChild(d); const c = (getComputedStyle(d).color.match(/\d+(\.\d+)?/g) || [255, 255, 255]).map(Number); d.remove(); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 128; }
function mailFrame(m) {
  const n = Math.random().toString(36).slice(2), load = S.mail.img.has(m.id), dark = darkSurface();
  const csp = `default-src 'none'; img-src data: ${load ? 'https: http:' : ''}; style-src 'unsafe-inline'; font-src data:; script-src 'nonce-${n}'`;
  const doc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>html,body{margin:0;background:${dark ? '#fff' : 'transparent'}}body{${dark ? 'padding:12px 14px;' : ''}font:14px/1.5 Arial,sans-serif;color:#222;word-break:break-word;overflow-y:hidden}a{color:#1155cc}img{max-width:100%;height:auto}blockquote{margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex}</style>${m.html}<script nonce="${n}">
const re=${URL_RE.toString()};
try{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),ns=[];let x;while(x=w.nextNode()){if(!x.parentElement.closest('a,style,script,textarea')&&/(https?:[/][/]|www[.])/i.test(x.nodeValue))ns.push(x)}
for(const t of ns){const s=t.nodeValue,f=document.createDocumentFragment();let last=0;for(const mm of s.matchAll(new RegExp(re.source,'gi'))){const u=mm[0];f.append(s.slice(last,mm.index));const a=document.createElement('a');a.href=(/^www[.]/i.test(u)?'https://':'')+u;a.target='_blank';a.rel='noopener noreferrer';a.textContent=u;f.append(a);last=mm.index+u.length}f.append(s.slice(last));t.replaceWith(f)}}catch(e){}
const p=()=>parent.postMessage({mh:'${m.id}',h:document.documentElement.scrollHeight},'*');addEventListener('load',p);new ResizeObserver(p).observe(document.body);p()<\/script>`;
  const remote = !load && /<img[^>]+src\s*=\s*["']?https?:/i.test(m.html);
  return `${remote ? `<div class="gpic">Images in this message are hidden. <a href="#" data-img="${m.id}">Display images below</a></div>` : ''}<iframe class="mframe" data-id="${m.id}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(doc)}" allowtransparency="true" scrolling="no" style="width:100%;border:0;background:transparent;color-scheme:light;height:140px;display:block"></iframe>`;
}
window.addEventListener('message', e => { const d = e.data; if (!d || !d.mh) return; const f = $(`.mframe[data-id="${d.mh}"]`); if (f && e.source === f.contentWindow) f.style.height = Math.min(+d.h + 2, 20000) + 'px'; });

function gmThread() {
  const t = mthread(S.mail.sel); gmThread0(); if (!t || !t.archived || !$('#gmain')) return;
  $$('.gm-tools .ib', $('#gmain')).forEach(b => { if (!['mbk', 'mpr', 'mnw', 'mol'].includes(b.id)) b.remove(); }); if ($('#mst')) $('#mst').remove();
  const rb = $('#rbtns'); if (!rb) return;
  rb.innerHTML = `<button class="rb" id="mrestore">${ic('restore')} Restore to my mailbox (to reply or forward)</button><span class="hint" style="margin-left:10px">From the archive (older than ${S.mail.arch.days} days) — read-only until restored.</span>`;
  $('#mrestore').onclick = async e => { e.currentTarget.disabled = true; try { await api('/mailbox/archive/' + t.id + '/restore', { method: 'POST' }); S.mail.arch.rows = S.mail.arch.rows.filter(x => x.id !== t.id); const d = await api('/mailbox'); S.mail.threads = d.threads; toast('Restored — it stays in your mailbox for 30 days'); openMail(t.id); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; } };
}
function gmThread0() {
  const el = $('#gmain'); if (!el) return; const t = mthread(S.mail.sel);
  if (!t) { S.mail.sel = null; return gmList(); }
  const tok = encodeURIComponent(S.token), vis = visible(), idx = vis.findIndex(x => x.id === t.id), a = agent(t.agentId), ms = S.mail.mails;
  el.innerHTML = `<div class="gm-tools"><button class="ib" id="mbk" title="Back to ${esc(FOLDER_NAME[S.mail.folder] || 'list')}">${ic('back')}</button>
      ${t.trashed || t.spam ? `<button class="ib" id="mrstr" title="${t.spam ? 'Not spam' : 'Restore'}">${ic('restore')}</button>${t.trashed ? `<button class="ib" id="mpg" title="Delete forever">${ic('trash')}</button>` : ''}` : `<button class="ib" id="mrs" title="${t.status === 'resolved' ? 'Move to inbox' : 'Done (archive)'}">${ic('archive')}</button><button class="ib" id="msp" title="Report spam">${ic('spamI')}</button><button class="ib" id="mdl" title="Delete">${ic('bin')}</button>`}<button class="ib" id="mun" title="Mark as unread">${ic('mail')}</button><button class="ib ${t.important ? 'impon' : ''}" id="mim" title="${t.important ? 'Marked important' : 'Mark as important'}">${ic('imp')}</button><button class="ib" id="mal" title="Label as">${ic('label')}</button>
      ${isAdmin() || t.agentId === S.me.id ? `<button class="ib" id="mas" title="Hand over to…">${ic('user')}</button>` : ''}${isAdmin() ? `<button class="ib" id="mfl" title="Always send mail like this to a team member…">${ic('label')}</button>` : ''}${mperm('filters') ? `<button class="ib" id="mff" title="Filter messages like this">${ic('filter')}</button>` : ''}<button class="ib" id="mpr" title="Print">${ic('print')}</button>
      <span class="sp"></span><span class="pg">${idx >= 0 ? `${idx + 1} of ${vis.length}` : ''}</span><button class="ib" id="mnw" title="Newer" ${idx > 0 ? '' : 'disabled'}>${ic('chevL')}</button><button class="ib" id="mol" title="Older" ${idx >= 0 && idx < vis.length - 1 ? '' : 'disabled'}>${ic('chevR')}</button></div>
    <div class="gm-read" id="gread"><div class="rh"><h2>${esc(t.subject || '(no subject)')}</h2>${(t.labels || []).map(l => `<span class="chip" style="--c:${hue(l)}">${esc(l)}<a href="#" data-rl="${esc(l)}" title="Remove label">×</a></span>`).join('')}${t.orgName ? `<span class="chip org">${esc(t.orgName)}</span>` : ''}<span class="rs"><button class="gst ${t.starred ? 'on' : ''}" id="mst" title="Star (syncs to Gmail)">${ic('star')}</button></span></div>
      <div class="hint rmeta">${S.mail.accounts.length > 1 ? esc(t.accountLabel) + ' · ' : ''}Handled by ${a ? esc(a.name) : 'nobody yet'}${t.via ? ' (matched ' + esc(t.via) + ')' : ''} · ${t.count} message${t.count === 1 ? '' : 's'}</div>
      ${ms.length ? ms.map(m => msgHtml(m, tok)).join('') : '<div class="hint" style="padding:24px">Loading…</div>'}
      <div class="rbtns" id="rbtns">${S.mail.reply ? '' : `<button class="rb" data-r="reply">${ic('reply')} Reply</button><button class="rb" data-r="all">${ic('replyall')} Reply all</button><button class="rb" data-r="fwd">${ic('fwd')} Forward</button>`}</div><div id="rbox"></div></div>`;
  if (S.mail.reply) replyBox();
  else if ($('#gread')) mailDropZone($('#gread'), async fl => { S.mail.dropped = await mailTakeFiles(fl); if (!S.mail.dropped.length) return; S.mail.reply = { mode: 'reply', mid: '' }; const y = $('#gread').scrollTop; gmThread(); if ($('#gread')) $('#gread').scrollTop = y; });
  el.onclick = e => {
    const pv = e.target.closest('[data-pv]'); if (pv && !e.target.closest('[data-dl]')) { e.preventDefault(); previewMail(pv.dataset.pv, +pv.dataset.i); return; }
    const im = e.target.closest('[data-img]'); if (im) { e.preventDefault(); S.mail.img.add(im.dataset.img); const y = $('#gread').scrollTop; gmThread(); $('#gread').scrollTop = y; return; }
    const rl = e.target.closest('[data-rl]'); if (rl) { e.preventDefault(); const lab = rl.dataset.rl; t.labels = (t.labels || []).filter(x => x !== lab); rl.closest('.chip').remove(); gmRail(); mpost(t.id, 'label', { label: lab, add: false }).catch(x => { toast(x.message, true); mreload(); }); return; }
    const hd = e.target.closest('[data-tg]'); if (hd && !e.target.closest('a,button,.dt')) { const id = hd.dataset.tg; S.mail.open.has(id) ? S.mail.open.delete(id) : S.mail.open.add(id); const y = $('#gread').scrollTop; gmThread(); $('#gread').scrollTop = y; return; }
    const mm = e.target.closest('[data-mm]'); if (mm) { e.stopPropagation(); msgMenu(mm, t, mm.dataset.mm); return; }
    const dt = e.target.closest('.dtb'); if (dt) { dt.closest('.mh').classList.toggle('det'); return; }
    const rb = e.target.closest('[data-r]'); if (rb) { S.mail.reply = { mode: rb.dataset.r, mid: rb.dataset.m || '' }; gmThread(); return; }
  };
  $('#mbk').onclick = () => { S.mail.sel = null; gmRender(); };
  $('#mst').onclick = () => { OPT.star(t); $('#mst').classList.toggle('on', t.starred); gmRail(); mpost(t.id, 'star').catch(x => { toast(x.message, true); mreload(); }); };
  if ($('#mrs')) { $('#mrs').onclick = () => tdo([t.id], t.status === 'resolved' ? 'reopen' : 'archive'); $('#msp').onclick = () => tdo([t.id], 'spam'); $('#mdl').onclick = () => tdo([t.id], 'trash'); }
  if ($('#mrstr')) $('#mrstr').onclick = () => tdo([t.id], 'restore'); if ($('#mpg')) $('#mpg').onclick = async () => await gconfirm('Delete this conversation forever?') && tdo([t.id], 'purge');
  $('#mim').onclick = () => { OPT.important(t); $('#mim').classList.toggle('impon', !!t.important); gmRail(); mpost(t.id, 'important').catch(x => { toast(x.message, true); mreload(); }); };
  $('#mun').onclick = () => { S.mail.sel = null; tdo([t.id], 'unread'); toast('Marked as unread'); };
  $('#mal').onclick = e => labelMenu(e.currentTarget, [t.id]);
  if ($('#mas')) $('#mas').onclick = e => gmenu(e.currentTarget, S.agents.filter(x => x.active && x.id !== t.agentId).map(x => ({ t: 'Hand over to ' + x.name, dot: x.color, f: async () => { try { await mpost(t.id, 'assign', { agentId: x.id }); toast('Handed over to ' + x.name); S.mail.sel = null; await mreload(); } catch (err) { toast(err.message, true); } } })));
  if ($('#mfl')) $('#mfl').onclick = () => filterModal(t); if ($('#mff')) $('#mff').onclick = () => searchPanel({ from: t.whoEmail || '' }, true);
  $('#mpr').onclick = () => window.print();
  $('#mnw').onclick = () => idx > 0 && openMail(vis[idx - 1].id); $('#mol').onclick = () => idx >= 0 && idx < vis.length - 1 && openMail(vis[idx + 1].id);
}
function msgHtml(m, tok) {
  const open = S.mail.open.has(m.id), who = m.dir === 'out' ? (m.by || 'me') : nameOf(m.from), em = m.from.email;
  const to = m.dir === 'out' && m.to.length ? m.to.map(x => x.name || x.email).join(', ') : 'me';
  return `<div class="mh ${open ? 'open' : ''} ${S.mail.mcur === m.id ? 'mcur' : ''}" data-tg="${m.id}">
    <div class="mt">${mav(who, em)}<div class="mi"><div class="l1"><b>${esc(who)}</b> <span class="em">&lt;${esc(em)}&gt;</span>${m.by ? ` <span class="pill green">sent by ${esc(m.by)}</span>` : ''}</div>
      ${open ? `<div class="l2 dt">to ${esc(to)} <button class="dtb" title="Show details">${ic('chevD')}</button></div>` : `<div class="l2 sn">${esc((m.text || '').replace(/\s+/g, ' ').slice(0, 140))}</div>`}</div>
      <span class="md">${(m.files || []).length ? ic('clip') : ''} ${open ? mDate(m.date, true) : mDate(m.date)}</span>
      ${open ? `<button class="ib sm" data-r="reply" data-m="${m.id}" title="Reply">${ic('reply')}</button><button class="ib sm" data-mm="${m.id}" title="More">${ic('more')}</button>` : ''}</div>
    ${open ? `<div class="mdet"><table><tr><td>from:</td><td>${addrList([m.from])}</td></tr><tr><td>to:</td><td>${addrList(m.to)}</td></tr>${m.cc && m.cc.length ? `<tr><td>cc:</td><td>${addrList(m.cc)}</td></tr>` : ''}${m.bcc && m.bcc.length ? `<tr><td>bcc:</td><td>${addrList(m.bcc)}</td></tr>` : ''}<tr><td>date:</td><td>${new Date(m.date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr><tr><td>subject:</td><td>${esc(m.subject)}</td></tr></table></div>
    <div class="mb">${m.html ? mailFrame(m) : `<div style="white-space:pre-wrap;word-break:break-word">${linkText(m.text)}</div>`}</div>
    ${(m.files || []).length ? `<div class="mfiles">${m.files.map(f => mailFileCard(m, f, tok)).join('')}</div>` : ''}` : ''}</div>`;
}

// the "⋮" menu on every message (like Gmail)
function msgMenu(anchor, t, mid) {
  const trashed = t.trashed || t.spam, go = (mode) => { S.mail.reply = { mode, mid }; gmThread(); };
  gmenu(anchor, [
    { t: 'Reply', f: () => go('reply') }, { t: 'Reply all', f: () => go('all') }, { t: 'Forward', f: () => go('fwd') }, '-',
    { t: 'Mark as unread', f: async () => { try { await mpost(t.id, 'unread'); S.mail.sel = null; await mreload(); toast('Marked as unread'); } catch (e) { toast(e.message, true); } } },
    { t: t.important ? 'Not important' : 'Mark as important', f: () => tdo([t.id], 'important') },
    { t: 'Print', f: () => window.print() }, '-',
    ...(trashed ? [{ t: 'Restore', f: () => tdo([t.id], 'restore') }, ...(t.trashed ? [{ t: 'Delete forever', f: async () => { if (await gconfirm('Delete forever?')) tdo([t.id], 'purge'); } }] : [])]
      : [{ t: 'Move to Done (archive)', f: () => tdo([t.id], t.status === 'resolved' ? 'reopen' : 'archive') }, { t: 'Report spam', f: () => tdo([t.id], 'spam') }, { t: (t.count > 1 ? 'Delete conversation' : 'Delete this message'), f: () => tdo([t.id], 'trash') }]),
  ]);
}

// ---------- rich text editor ----------
const RTE = [['undo', 'undo', 'Undo'], ['redo', 'redo', 'Redo'], '|', ['size'], '|', ['bold', 'bold', 'Bold (Ctrl+B)'], ['italic', 'italic', 'Italic (Ctrl+I)'], ['underline', 'under', 'Underline (Ctrl+U)'], ['color'], '|', ['justifyLeft', 'alignL', 'Align left'], ['justifyCenter', 'alignC', 'Center'], ['justifyRight', 'alignR', 'Align right'], '|', ['insertOrderedList', 'ol', 'Numbered list'], ['insertUnorderedList', 'ul', 'Bulleted list'], ['quote', 'quote', 'Quote'], '|', ['strikeThrough', 'strike', 'Strikethrough'], ['link', 'link', 'Insert link'], ['removeFormat', 'eraser', 'Remove formatting']];
const rteBar = () => `<div class="rte-bar">${RTE.map(x => x === '|' ? '<i class="sep"></i>' : x[0] === 'size' ? `<select data-size title="Font size"><option value="3">Normal</option><option value="1">Small</option><option value="5">Large</option><option value="7">Huge</option></select>` : x[0] === 'color' ? `<label class="rb2" title="Text colour"><b>A</b><input type="color" data-color value="#000000"></label>` : `<button type="button" data-cmd="${x[0]}" title="${x[2]}">${ic(x[1])}</button>`).join('')}</div>`;
function rteWire(root, ed) {
  const keep = e => e.preventDefault();
  $$('[data-cmd]', root).forEach(b => { b.onmousedown = keep; b.onclick = async () => { ed.focus(); const c = b.dataset.cmd; if (c === 'quote') document.execCommand('formatBlock', false, 'blockquote'); else if (c === 'link') { const u = await gprompt('Link URL', 'https://'); if (u && /^(https?:|mailto:)/i.test(u)) document.execCommand('createLink', false, u); } else document.execCommand(c); }; });
  const sz = $('[data-size]', root); if (sz) sz.onchange = () => { ed.focus(); document.execCommand('fontSize', false, sz.value); };
  const co = $('[data-color]', root); if (co) co.oninput = () => { ed.focus(); document.execCommand('foreColor', false, co.value); $('b', co.parentNode).style.color = co.value; };
}
const plain = ed => ed.innerText.replace(/\u00a0/g, ' ').trim();

// recipient chips
const MAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
function chipField(id, list, onChange) {
  const box = document.createElement('div'); box.className = 'chips-in';
  const draw = () => { box.innerHTML = list.map((e, i) => `<span class="rc ${MAIL_RE.test(e) ? '' : 'bad'}">${esc(e)}<button type="button" data-x="${i}">×</button></span>`).join('') + `<input type="text" autocomplete="off" aria-label="${id}">`; wire(); };
  const add = v => { v.split(/[\s,;]+/).map(x => x.replace(/^<|>$/g, '').trim()).filter(Boolean).forEach(x => { if (!list.includes(x)) list.push(x); }); onChange && onChange(); };
  function wire() {
    const inp = $('input', box), commit = () => { const v = inp.value; inp.value = ''; if (v.trim()) { add(v); draw(); return true; } };
    inp.onkeydown = e => { if ([',', ';', 'Enter', ' ', 'Tab'].includes(e.key) && inp.value.trim()) { if (e.key !== 'Tab') e.preventDefault(); if (commit()) $('input', box).focus(); } else if (e.key === 'Backspace' && !inp.value && list.length) { list.pop(); onChange && onChange(); draw(); $('input', box).focus(); } };
    inp.onchange = () => { if (inp.isConnected) commit(); }; inp.onblur = () => { if (inp.isConnected) commit(); };
    box.onclick = e => { const x = e.target.closest('[data-x]'); if (x) { list.splice(+x.dataset.x, 1); onChange && onChange(); draw(); } else inp.focus(); };
  }
  box.flush = () => { const i = $('input', box); if (i && i.value.trim()) { const v = i.value; i.value = ''; add(v); draw(); } }; draw(); return box;
}
const contactList = () => ''; // suggestions now come from the custom box in pick.js (no-reply senders hidden)
const attHtml = files => files.map((f, i) => `<span class="fchip lf" data-lf="${i}" title="Click to preview">${fileKind(f.filename, f.type) === 'image' ? `<img class="fth" src="data:${esc(f.type || 'image/png')};base64,${f.b64}">` : ic('clip')} ${esc(f.filename)} <small>${fmtSize(f.size)}</small><button type="button" data-rm="${i}" title="Remove">×</button></span>`).join('');

// ---------- inline reply / forward ----------
function replyBox() {
  const t = mthread(S.mail.sel), r = S.mail.reply, host = $('#rbox'); if (!host || !t) return;
  const ms = S.mail.mails, ref = (r.mid && ms.find(m => m.id === r.mid)) || [...ms].reverse().find(m => m.dir === 'in') || ms[ms.length - 1];
  const isF = r.mode === 'fwd', to = [], cc = [], bcc = [], files = (S.mail.dropped || []).splice(0);
  if (!isF && ref) to.push(ref.dir === 'in' ? (ref.replyTo || ref.from.email) : (ref.to[0] || {}).email || t.whoEmail);
  if (r.mode === 'all' && ref) { const me = ((S.mail.accounts.find(a => a.id === t.accountId) || {}).user || '').toLowerCase(); [...ref.to, ...ref.cc].map(x => x.email).filter(e => e && e.toLowerCase() !== me && !to.includes(e)).forEach(e => cc.push(e)); }
  const fwdBody = isF && ref ? `<br><br><div class="fwdh">---------- Forwarded message ---------<br>From: ${esc(nameOf(ref.from))} &lt;${esc(ref.from.email)}&gt;<br>Date: ${new Date(ref.date).toLocaleString()}<br>Subject: ${esc(ref.subject)}<br>To: ${addrList(ref.to)}</div><br><blockquote>${esc((ref.text || '').slice(0, 20000)).replace(/\n/g, '<br>')}</blockquote>` : '';
  host.innerHTML = `${contactList()}<div class="rbox"><div class="rtop">${ic(isF ? 'fwd' : r.mode === 'all' ? 'replyall' : 'reply')}<div class="rto"><div id="rtoc"></div><button class="lnk" id="rccb" ${cc.length ? 'hidden' : ''}>Cc</button><button class="lnk" id="rbcb">Bcc</button></div></div>
    <div class="rcc" id="rccw" ${cc.length ? '' : 'hidden'}><span>Cc</span><div id="rccc"></div></div>
    <div class="rcc" id="rbcw" hidden><span>Bcc</span><div id="rbcc"></div></div>
    <div class="rte-ed" id="red" contenteditable="true" role="textbox" aria-multiline="true" data-ph="Write your message…">${fwdBody}</div>${sigPrevHtml()}<div class="fchips" id="rfl"></div>
    ${rteBar()}<div class="rfoot"><button class="btn primary sendb" id="rsend">Send</button><label class="ib" title="Attach files">${ic('clip')}<input type="file" id="rfi" multiple hidden></label>${isF ? `<label class="hint" style="display:flex;align-items:center;gap:6px;margin-left:8px" title="Finds who handles the original sender's organization / domain (routing rules) and emails them a copy"><input type="checkbox" id="rcopy" checked> Send a copy to the person who handles this organization</label>` : ''}<span class="sp"></span><button class="ib" id="rdis" title="Discard draft">${ic('trash')}</button></div></div>`;
  const toBox = chipField('to', to), ccBox = chipField('cc', cc), bcBox = chipField('bcc', bcc); $('#rtoc').appendChild(toBox); $('#rccc').appendChild(ccBox); $('#rbcc').appendChild(bcBox);
  const ed = $('#red'); rteWire(host, ed); if (!isF) ed.focus(); else toBox.querySelector('input').focus();
  $('#rccb').onclick = () => { $('#rccw').hidden = false; $('#rccb').hidden = true; ccBox.querySelector('input').focus(); };
  $('#rbcb').onclick = () => { $('#rbcw').hidden = false; $('#rbcb').hidden = true; bcBox.querySelector('input').focus(); };
  const drawF = () => { $('#rfl').innerHTML = attHtml(files); }; drawF();
  $('#rfl').onclick = e => { const x = e.target.closest('[data-rm]'); if (x) { files.splice(+x.dataset.rm, 1); drawF(); return; } const l = e.target.closest('[data-lf]'); if (l) previewLocal(files, +l.dataset.lf); };
  $('#rfi').onchange = async e => { files.push(...await mailTakeFiles(e.target.files)); e.target.value = ''; drawF(); };
  mailDropZone(host.querySelector('.rbox'), async fl => { files.push(...await mailTakeFiles(fl)); drawF(); });
  $('#rdis').onclick = () => { S.mail.reply = null; gmThread(); };
  const send = async () => {
    toBox.flush(); ccBox.flush(); bcBox.flush(); const b = $('#rsend'); if (!plain(ed) && !isF) return toast('The message is empty', true);
    b.disabled = true;
    try { const sent = await api(`/mailbox/${t.id}/reply`, { method: 'POST', body: { text: plain(ed) || '(forwarded)', html: ed.innerHTML, replyAll: false, forward: isF, copyHandler: isF ? !!($('#rcopy') && $('#rcopy').checked) : undefined, to: to.join(','), cc: cc.join(','), bcc: bcc.join(','), attachments: files } }); S.mail.reply = null; const hc = sent && sent.handlerCopy; toast(isF ? (hc ? (hc.emailed ? `Forwarded — a copy was emailed to ${hc.name}${hc.org ? ' (' + hc.org + ')' : ''}` : `Forwarded — ${hc.name} can now see it in Mail (add their email in Team to also email a copy)`) : 'Message forwarded') : 'Message sent'); await mreload(); openMail(t.id); }
    catch (err) { toast(err.message, true); b.disabled = false; }
  };
  $('#rsend').onclick = send; ed.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send(); };
  setTimeout(() => $('#rbox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
}

// ---------- compose window (floating, bottom-right like Gmail) ----------
function compose(pre = {}) {
  if (!S.mail.accounts.length) return toast('Connect a mailbox first', true);
  if (S.mail.cw) { S.mail.cw.min = false; return cwDraw(); }
  const d = pre.draft; S.mail.cw = { min: false, max: false, draftId: d ? d.id : '', from: (d && d.accountId) || pre.from || S.mail.accounts[0].id, to: d ? [...d.to] : pre.to ? [pre.to] : [], cc: d ? [...d.cc] : [], bcc: d ? [...d.bcc] : [], showCc: !!(d && d.cc.length), showBcc: !!(d && d.bcc.length), subject: d ? d.subject : pre.subject || '', html: d ? d.html : pre.html || '', files: [] };
  cwDraw(true);
}
async function cwClose(force, discard) {
  const c = S.mail.cw; if (!c) return; const ed = $('#cwed'), has = c.to.length || c.subject || (ed && plain(ed)) || c.files.length;
  if (discard && has && !await gconfirm('Discard this draft?')) return;
  if (!force && !discard && has) { // like Gmail: closing keeps a draft
    const body = { id: c.draftId, accountId: c.from, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject, html: ed ? ed.innerHTML : c.html };
    api('/mailbox/drafts', { method: 'POST', body }).then(async () => { toast(c.files.length ? 'Draft saved (attachments are not kept in drafts)' : 'Draft saved'); await loadExtra(); if (S.view === 'mail' && $('#grail')) gmRender(); }).catch(e => toast(e.message, true));
  }
  if ((discard || force) && c.draftId) api('/mailbox/drafts/' + c.draftId, { method: 'DELETE' }).then(async () => { await loadExtra(); if (S.view === 'mail' && $('#grail')) gmRail(); }).catch(() => {});
  S.mail.cw = null; const w = $('#cwin'); w && w.remove();
}
function cwDraw(focus) {
  const c = S.mail.cw; if (!c) return; let w = $('#cwin');
  if (!w) { w = document.createElement('div'); w.id = 'cwin'; document.body.appendChild(w); }
  else { const ed = $('#cwed'); if (ed) c.html = ed.innerHTML; }
  w.className = `cwin ${c.min ? 'min' : ''} ${c.max ? 'max' : ''}`;
  const multi = S.mail.accounts.length > 1;
  w.innerHTML = `${contactList()}<div class="cw-h" id="cwh"><b>${esc(c.subject || 'New Message')}</b><span class="sp"></span><button class="ib sm" id="cwm" title="Minimize">${ic('min')}</button><button class="ib sm" id="cwx" title="${c.max ? 'Exit full screen' : 'Full screen'}">${ic('max')}</button><button class="ib sm" id="cwc" title="Close">${ic('x')}</button></div>
    <div class="cw-b">${multi ? `<div class="cw-r"><span>From</span><select id="cwf">${S.mail.accounts.map(a => `<option value="${a.id}" ${a.id === c.from ? 'selected' : ''}>${esc(a.label)} &lt;${esc(a.user)}&gt;</option>`).join('')}</select></div>` : ''}
      <div class="cw-r"><span>To</span><div class="grow" id="cwto"></div><span class="tg"><button class="lnk" id="cwcc" ${c.showCc ? 'hidden' : ''}>Cc</button><button class="lnk" id="cwbc" ${c.showBcc ? 'hidden' : ''}>Bcc</button></span></div>
      <div class="cw-r" id="cwccr" ${c.showCc ? '' : 'hidden'}><span>Cc</span><div class="grow" id="cwcc2"></div></div><div class="cw-r" id="cwbcr" ${c.showBcc ? '' : 'hidden'}><span>Bcc</span><div class="grow" id="cwbc2"></div></div>
      <div class="cw-r"><input type="text" id="cwsub" placeholder="Subject" value="${esc(c.subject)}" autocomplete="off"></div>
      <div class="rte-ed cw-ed" id="cwed" contenteditable="true" role="textbox" aria-multiline="true">${c.html}</div>${sigPrevHtml()}<div class="fchips" id="cwfl">${attHtml(c.files)}</div>
      <div class="cw-drop" id="cwdrop">Drop files here to attach</div>${rteBar()}
      <div class="rfoot"><div class="split"><button class="btn primary sendb" id="cws">Send</button><button class="btn primary sch" id="cwsch" title="More send options">${ic('chevD')}</button></div><label class="ib" title="Attach files">${ic('clip')}<input type="file" id="cwfi" multiple hidden></label><span class="hint">Ctrl+Enter to send</span><span class="sp"></span><button class="ib" id="cwd" title="Discard draft">${ic('trash')}</button></div></div>`;
  const ed = $('#cwed'); rteWire(w, ed);
  const to = chipField('to', c.to), cc = chipField('cc', c.cc), bc = chipField('bcc', c.bcc); $('#cwto').appendChild(to); $('#cwcc2').appendChild(cc); $('#cwbc2').appendChild(bc);
  $('#cwsub').oninput = e => { c.subject = e.target.value; $('b', $('#cwh')).textContent = c.subject || 'New Message'; };
  if ($('#cwf')) $('#cwf').onchange = e => c.from = e.target.value;
  $('#cwcc').onclick = () => { c.showCc = true; $('#cwccr').hidden = false; $('#cwcc').hidden = true; cc.querySelector('input').focus(); };
  $('#cwbc').onclick = () => { c.showBcc = true; $('#cwbcr').hidden = false; $('#cwbc').hidden = true; bc.querySelector('input').focus(); };
  $('#cwm').onclick = () => { c.html = ed.innerHTML; c.min = !c.min; cwDraw(); }; $('#cwh').onclick = e => { if (c.min && !e.target.closest('button')) { c.min = false; cwDraw(); } };
  $('#cwx').onclick = () => { c.html = ed.innerHTML; c.max = !c.max; cwDraw(); };
  $('#cwc').onclick = () => cwClose();
  $('#cwd').onclick = () => cwClose(false, true);
  const addFiles = async fl => { c.files.push(...await mailTakeFiles(fl)); $('#cwfl').innerHTML = attHtml(c.files); };
  $('#cwfi').onchange = async e => { await addFiles(e.target.files); e.target.value = ''; };
  $('#cwfl').onclick = e => { const x = e.target.closest('[data-rm]'); if (x) { c.files.splice(+x.dataset.rm, 1); $('#cwfl').innerHTML = attHtml(c.files); return; } const l = e.target.closest('[data-lf]'); if (l) previewLocal(c.files, +l.dataset.lf); };
  w.ondragover = e => { e.preventDefault(); w.classList.add('over'); }; w.ondragleave = () => w.classList.remove('over'); w.ondrop = async e => { e.preventDefault(); w.classList.remove('over'); await addFiles(e.dataTransfer.files); };
  const check = () => {
    to.flush(); cc.flush(); bc.flush(); const bad = [...c.to, ...c.cc, ...c.bcc].find(x => !MAIL_RE.test(x));
    if (!c.to.length) return toast('Add at least one recipient', true), false; if (bad) return toast(`"${bad}" is not a valid email address`, true), false;
    if (!plain(ed) && !c.files.length) return toast('The message is empty', true), false; return true;
  };
  const later = async at => {
    if (!check()) return; try { await api('/mailbox/scheduled', { method: 'POST', body: { accountId: c.from, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject || '(no subject)', text: plain(ed) || '(attachment)', html: ed.innerHTML, attachments: c.files, sendAt: at } }); toast('Scheduled for ' + new Date(at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })); cwClose(true); await loadExtra(); if (S.view === 'mail' && $('#grail')) gmRender(); } catch (err) { toast(err.message, true); }
  };
  $('#cwsch').onclick = e => {
    const at = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return +x; }, mon = (() => { const x = new Date(); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); x.setHours(8, 0, 0, 0); return +x; })();
    gmenu(e.currentTarget, [{ t: 'Tomorrow morning — 8:00', f: () => later(at(1, 8)) }, { t: 'Tomorrow afternoon — 1:00 PM', f: () => later(at(1, 13)) }, { t: 'Monday morning — 8:00', f: () => later(mon) }, '-', { t: 'Pick date & time…', f: () => { const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0); const v = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); modal(`<h3>Schedule send</h3><div class="field"><label>Send at</label><input type="datetime-local" id="sat" value="${v}"></div><div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="ok">Schedule</button></div>`, (bg, close) => { $('#cx', bg).onclick = close; $('#ok', bg).onclick = () => { const t = new Date($('#sat', bg).value).getTime(); close(); later(t); }; }); } }]);
  };
  const send = async () => {
    if (!check()) return; const bad = [...c.to, ...c.cc, ...c.bcc].find(x => !MAIL_RE.test(x));
    if (!c.subject.trim() && !await gconfirm('Send this message without a subject?')) return;
    const b = $('#cws'); b.disabled = true; b.textContent = 'Sending…';
    try { await api('/mailbox/new', { method: 'POST', body: { accountId: c.from, to: c.to, cc: c.cc, bcc: c.bcc, subject: c.subject, text: plain(ed) || '(attachment)', html: ed.innerHTML, attachments: c.files } }); cwClose(true); toast('Message sent'); if (S.view === 'mail') mreload(); else loadExtra(); }
    catch (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Send'; }
  };
  $('#cws').onclick = send; ed.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send(); };
  if (focus) to.querySelector('input').focus();
}
// ---------- Gmail keyboard shortcuts (press ? for the full list) ----------
const KB = { g: 0, star: 0 };
const KB_GO = { i: 'inbox', s: 'star', t: 'sent', d: 'drafts', a: 'all', u: 'unassigned', b: 'trash', p: 'spam', m: 'important', c: 'scheduled', e: 'done' };
const KB_HELP = [
  ['While writing (compose window & reply box)', [['Ctrl+Shift+C', 'Add Cc'], ['Ctrl+Shift+B', 'Add Bcc'], ['Ctrl+Shift+F', 'Change the From address'], ['Ctrl+Enter', 'Send'], ['Ctrl+Shift+D', 'Discard draft'], ['Esc', 'Save draft and close (compose window)'], ['Ctrl+K', 'Insert link'], ['Ctrl+B / I / U', 'Bold / italic / underline'], ['Ctrl+Shift+7 / 8', 'Numbered / bulleted list'], ['Ctrl+Shift+9', 'Quote'], ['Ctrl+Shift+L / E / R', 'Align left / centre / right'], ['Ctrl+Shift+5 / 6', 'Smaller / larger text'], ['Ctrl+[ / Ctrl+]', 'Outdent / indent'], ['Ctrl+\\', 'Remove formatting'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo']]],
  ['Jump to (press g, then…)', [['g  i', 'Inbox'], ['g  s', 'Starred'], ['g  t', 'Sent'], ['g  d', 'Drafts'], ['g  c', 'Scheduled'], ['g  e', 'Done'], ['g  m', 'Important'], ['g  p', 'Spam'], ['g  b', 'Bin'], ['g  a', 'All mail (admin)'], ['g  u', 'Unassigned (admin)'], ['g  l', 'A label…']]],
  ['Compose & search', [['c', 'Compose'], ['d', 'Compose, full screen'], ['/', 'Search mail'], ['?', 'This help'], ['Shift+N', 'Refresh mail']]],
  ['In the list', [['j / k', 'Cursor down / up (older / newer)'], ['o  or  Enter', 'Open conversation'], ['x', 'Select / unselect'], ['s', 'Star / unstar'], ['e  or  y', 'Mark done (archive)'], ['#  or  Delete', 'Move to Bin'], ['!', 'Report spam'], ['Shift+I / Shift+U', 'Mark as read / unread'], ['+  or  =', 'Mark important / not important'], ['l', 'Label as…'], ['*  then  a n r u s', 'Select all / none / read / unread / starred'], ['Esc', 'Clear selection']]],
  ['In a conversation', [['j / k', 'Older / newer conversation'], ['u', 'Back to the list'], ['n / p', 'Next / previous message'], ['o  or  Enter', 'Open / close the current message'], [';  /  :', 'Expand / collapse all messages'], ['r', 'Reply'], ['a', 'Reply all'], ['f', 'Forward'], ['e  or  y', 'Mark done (archive)'], ['[  /  ]', 'Archive and go to newer / older'], ['#  or  Delete', 'Move to Bin'], ['!', 'Report spam'], ['s', 'Star'], ['Shift+U', 'Mark as unread'], ['l', 'Label as…'], ['Esc', 'Back to the list']]],
];
function kbHelp() {
  const old = document.querySelector('.kbm'); if (old) return old.remove();
  const sec = ([h, rows]) => `<div class="kbs"><h4>${esc(h)}</h4>${rows.map(([k, d]) => `<div class="r"><span>${esc(d)}</span><span class="ks">${k.split(/\s{2,}/).map(x => /^(then|or|\/)$/i.test(x) ? `<em>${x}</em>` : `<kbd>${esc(x)}</kbd>`).join('')}</span></div>`).join('')}</div>`;
  const bg = modal(`<h3>Keyboard shortcuts</h3><div class="hint" style="margin:-4px 0 12px">On a Mac use ⌘ instead of Ctrl. Single-key shortcuts work when you are not typing in a box.</div><div class="kbh">${KB_HELP.map(sec).join('')}</div><div class="acts"><button class="btn primary" id="kbx">Close</button></div>`, (b, close) => { $('#kbx', b).onclick = close; });
  bg.classList.add('kbm');
}
const KB_LIST = () => visible().slice(S.mail.page * PAGE, S.mail.page * PAGE + PAGE);
const kbTyping = el => !!(el && el.closest && el.closest('input,textarea,select,[contenteditable]'));
const kbBusy = () => !!document.querySelector('.modal-bg,.pv,.gmenu,.sopt,.rsug');
const kbTargets = () => S.mail.sel ? [S.mail.sel] : S.mail.chk.size ? [...S.mail.chk] : (S.mail.cur && mthread(S.mail.cur) ? [S.mail.cur] : []);
function kbCursor(id) {
  S.mail.cur = id || ''; document.querySelectorAll('#gmain .gr').forEach(r => r.classList.toggle('cur', r.dataset.id === S.mail.cur));
  const r = id && document.querySelector(`#gmain .gr[data-id="${id}"]`); if (r) r.scrollIntoView({ block: 'nearest' });
}
function kbMove(d) {
  const ids = KB_LIST().map(t => t.id); if (!ids.length) return;
  let i = ids.indexOf(S.mail.cur); i = i < 0 ? (d > 0 ? 0 : ids.length - 1) : i + d;
  if (i >= ids.length) { if (S.mail.page < Math.ceil(visible().length / PAGE) - 1) { S.mail.page++; S.mail.cur = ''; gmList(); return kbMove(1); } i = ids.length - 1; }
  if (i < 0) { if (S.mail.page > 0) { S.mail.page--; S.mail.cur = ''; gmList(); return kbMove(-1); } i = 0; }
  kbCursor(ids[i]);
}
function kbConv(d) { const vis = visible(), i = vis.findIndex(x => x.id === S.mail.sel), n = vis[i + d]; if (i >= 0 && n) openMail(n.id); }
function kbMsg(d) {
  const ms = S.mail.mails; if (!S.mail.sel || !ms.length) return;
  let i = ms.findIndex(m => m.id === S.mail.mcur); i = i < 0 ? (d > 0 ? 0 : ms.length - 1) : Math.max(0, Math.min(ms.length - 1, i + d));
  const id = S.mail.mcur = ms[i].id;
  document.querySelectorAll('#gread .mh').forEach(x => x.classList.toggle('mcur', x.dataset.tg === id));
  const el = document.querySelector(`#gread .mh[data-tg="${id}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function kbRedrawThread(fn) {
  if (S.mail.reply) return toast('Send or discard your reply first', true);
  const g = $('#gread'), y = g ? g.scrollTop : 0; fn(); gmThread(); if ($('#gread')) $('#gread').scrollTop = y;
}
async function kbReply(mode) {
  const id = S.mail.sel || S.mail.cur; if (!id || !mthread(id)) return;
  if (S.mail.reply && S.mail.sel) { const ed = $('#red'); if (ed) ed.focus(); return; }
  if (!S.mail.sel) await openMail(id);
  if (!S.mail.mails.length) return;
  S.mail.reply = { mode, mid: S.mail.mcur || '' }; gmThread();
}
function kbFolder(f) { S.mail.folder = f; S.mail.q = ''; if ($('#mq')) $('#mq').value = ''; if ($('#mclr')) $('#mclr').hidden = true; S.mail.sel = null; S.mail.page = 0; S.mail.chk.clear(); S.mail.cur = ''; S.mail.drawer = false; gmRender(); }
function kbGo(k) {
  if (k === 'l') { const lb = allLabels(); if (!lb.length) { toast('No labels yet'); return true; } gmenu(document.querySelector('.gm-title') || document.body, lb.map(l => ({ t: l, dot: hue(l), f: () => kbFolder('label:' + l) }))); return true; }
  const f = KB_GO[k]; if (!f) return false;
  if ((f === 'all' || f === 'unassigned') && !isAdmin()) { toast('Only admins can open that folder', true); return true; }
  kbFolder(f); return true;
}
function kbSelect(k) {
  if (S.mail.sel) return false; const list = KB_LIST(), sel = S.mail.chk, pick = fn => { sel.clear(); list.filter(fn).forEach(t => sel.add(t.id)); };
  if (k === 'a') pick(() => true); else if (k === 'n') sel.clear(); else if (k === 'r') pick(t => !t.unread); else if (k === 'u') pick(t => t.unread); else if (k === 's') pick(t => t.starred); else return false;
  gmList(); return true;
}
async function kbAct(act) {
  const ids = kbTargets(); if (!ids.length) return;
  const inThread = !!S.mail.sel;
  if (['archive', 'trash', 'spam'].includes(act) && !inThread && ids.length === 1 && ids[0] === S.mail.cur) { const l = KB_LIST().map(t => t.id), i = l.indexOf(ids[0]); S.mail.cur = l[i + 1] || l[i - 1] || ''; }
  if (act === 'archive') return tdo(ids, S.mail.folder === 'done' ? 'reopen' : 'archive');
  if (act === 'spam') return tdo(ids, S.mail.folder === 'spam' ? 'restore' : 'spam');
  if (act === 'unread') { if (inThread) S.mail.sel = null; await tdo(ids, 'unread'); return toast('Marked as unread'); }
  if (act === 'important') return tdo(ids, 'important');
  if (act === 'label') return labelMenu(document.querySelector('#mal') || document.querySelector('#gmain .gm-tools') || document.body, ids);
  return tdo(ids, act); // trash, star, read
}
function kbCompose(e, root, isCw) {
  const c = e.code, sh = e.shiftKey, ed = root.querySelector('.rte-ed'), q = s => root.querySelector(s);
  const cmd = n => { const b = q(`[data-cmd="${n}"]`); if (b) b.click(); return true; };
  const field = (btn, inp) => { const b = q(btn); if (b && !b.hidden) b.click(); else { const i = q(inp); if (i) i.focus(); } return true; };
  if (sh && c === 'KeyC') return field(isCw ? '#cwcc' : '#rccb', isCw ? '#cwcc2 input' : '#rccc input');
  if (sh && c === 'KeyB') return field(isCw ? '#cwbc' : '#rbcb', isCw ? '#cwbc2 input' : '#rbcc input');
  if (sh && c === 'KeyF') { const f = q('#cwf'); if (f) { f.focus(); return true; } return false; }
  if (sh && c === 'KeyD') { const b = q(isCw ? '#cwd' : '#rdis'); if (b) b.click(); return true; }
  if (!sh && c === 'KeyK') return cmd('link');
  if (!sh && (c === 'Enter' || c === 'NumpadEnter')) { if (e.target.id === 'cwed' || e.target.id === 'red') return false; const b = q(isCw ? '#cws' : '#rsend'); if (b) b.click(); return true; }
  if (sh && c === 'Digit7') return cmd('insertOrderedList'); if (sh && c === 'Digit8') return cmd('insertUnorderedList'); if (sh && c === 'Digit9') return cmd('quote');
  if (sh && c === 'KeyL') return cmd('justifyLeft'); if (sh && c === 'KeyE') return cmd('justifyCenter'); if (sh && c === 'KeyR') return cmd('justifyRight');
  if (sh && (c === 'Digit5' || c === 'Digit6')) { const sz = q('[data-size]'); if (!sz || !ed) return false; const o = ['1', '3', '5', '7'], i = Math.max(0, Math.min(3, o.indexOf(sz.value) + (c === 'Digit6' ? 1 : -1))); sz.value = o[i]; ed.focus(); document.execCommand('fontSize', false, o[i]); return true; }
  if (!sh && c === 'Backslash') return cmd('removeFormat');
  if (!sh && (c === 'BracketRight' || c === 'BracketLeft')) { if (ed) ed.focus(); document.execCommand(c === 'BracketRight' ? 'indent' : 'outdent'); return true; }
  return false;
}
document.addEventListener('keydown', e => {
  if (S.view !== 'mail' || !document.getElementById('gm')) return;
  const T = e.target instanceof Element ? e.target : document.body, k = e.key, mod = e.ctrlKey || e.metaKey;
  const help = document.querySelector('.kbm');
  if (help && (k === 'Escape' || (k === '?' && !kbTyping(T)))) { e.preventDefault(); help.remove(); return; }
  // ---- while writing: compose window / reply box ----
  const cwEl = document.getElementById('cwin'), inCw = !!T.closest('#cwin'), inRb = !!T.closest('#rbox');
  const root = inCw ? cwEl : inRb ? document.getElementById('rbox') : (mod && e.shiftKey && cwEl && ['KeyC', 'KeyB'].includes(e.code) ? cwEl : null);
  if (root && mod && !e.altKey) { if (kbCompose(e, root, root === cwEl)) { e.preventDefault(); e.stopPropagation(); } return; }
  if (inCw && k === 'Escape' && !kbBusy()) { e.preventDefault(); cwClose(); return; }
  // ---- everywhere else: single keys (not while typing) ----
  if (kbTyping(T) || mod || e.altKey || kbBusy()) return;
  const now = Date.now(), inThread = !!S.mail.sel, lk = k.toLowerCase();
  if (KB.g && now - KB.g < 1500) { KB.g = 0; if (kbGo(lk)) e.preventDefault(); return; }
  if (KB.star && now - KB.star < 1500) { KB.star = 0; if (kbSelect(lk)) e.preventDefault(); return; }
  KB.g = KB.star = 0;
  if (k === 'Enter' && T.closest('button,a,summary')) return;
  let hit = true;
  switch (k) {
    case 'c': compose(); break;
    case 'd': compose(); if (S.mail.cw) { S.mail.cw.max = true; cwDraw(true); } break;
    case '/': { const q = $('#mq'); if (q) q.focus(); else hit = false; break; }
    case '?': kbHelp(); break;
    case 'g': KB.g = now; break;
    case '*': KB.star = now; break;
    case 'j': inThread ? kbConv(1) : kbMove(1); break;
    case 'k': inThread ? kbConv(-1) : kbMove(-1); break;
    case 'n': inThread ? kbMsg(1) : hit = false; break;
    case 'p': inThread ? kbMsg(-1) : hit = false; break;
    case 'o': case 'Enter':
      if (inThread) { const id = S.mail.mcur; if (id) kbRedrawThread(() => { S.mail.open.has(id) ? S.mail.open.delete(id) : S.mail.open.add(id); }); else hit = false; }
      else if (S.mail.cur && mthread(S.mail.cur)) openMail(S.mail.cur); else hit = false; break;
    case ';': if (inThread) kbRedrawThread(() => S.mail.mails.forEach(m => S.mail.open.add(m.id))); else hit = false; break;
    case ':': if (inThread) kbRedrawThread(() => S.mail.open.clear()); else hit = false; break;
    case 'u': if (inThread) { S.mail.sel = null; gmRender(); } else mreload().catch(x => toast(x.message, true)); break;
    case 'x': if (!inThread && S.mail.cur && mthread(S.mail.cur)) { const c = S.mail.chk; c.has(S.mail.cur) ? c.delete(S.mail.cur) : c.add(S.mail.cur); gmList(); } else hit = false; break;
    case 's': kbAct('star'); break;
    case 'e': case 'y': kbAct('archive'); break;
    case '#': case 'Delete': kbAct('trash'); break;
    case '!': kbAct('spam'); break;
    case 'I': kbAct('read'); break;
    case 'U': kbAct('unread'); break;
    case '+': case '=': case '-': kbAct('important'); break;
    case 'l': kbAct('label'); break;
    case 'r': kbReply('reply'); break;
    case 'a': kbReply('all'); break;
    case 'f': kbReply('fwd'); break;
    case 'N': mreload().then(() => toast('Mail refreshed')).catch(x => toast(x.message, true)); break;
    case '[': case ']': if (inThread) { const d = k === '[' ? -1 : 1, vis = visible(), i = vis.findIndex(x => x.id === S.mail.sel), nx = vis[i + d]; tdo([S.mail.sel], S.mail.folder === 'done' ? 'reopen' : 'archive').then(() => nx && mthread(nx.id) && openMail(nx.id)); } else hit = false; break;
    case 'Escape': if (inThread) { S.mail.sel = null; gmRender(); } else if (S.mail.chk.size) { S.mail.chk.clear(); gmList(); } else if (S.mail.cur) kbCursor(''); else hit = false; break;
    default: hit = false;
  }
  if (hit) e.preventDefault();
}, true);

// ---------- routing rules (admin) ----------
async function rulesModal() {
  const { rules } = await api('/mailbox/rules'), { internal } = await api('/mailbox/internal'), ag = S.agents.filter(a => a.active), accs = S.mail.accounts;
  const nm = id => (agent(id) || {}).name || '—', an = id => id ? ((accs.find(a => a.id === id) || {}).label || 'Mailbox') : 'All mailboxes';
  modal(`<h3>Routing rules</h3><p class="hint" style="margin-bottom:12px">Mail from a company’s domain (or a single address) — or mail that has them in <b>To / CC</b> or inside a <b>forwarded</b> message — goes <b>only</b> to the person you pick — nobody else sees it. Anything that matches no rule stays with the admin as <i>Unassigned</i>. Use the same person for many domains, or set a rule for just one Gmail.</p>
    ${rules.map(r => `<div class="card pad" style="margin-bottom:8px;padding:10px 14px"><div class="row" style="justify-content:space-between"><div><b>${esc(r.pattern)}</b><div class="hint">${esc(an(r.accountId))} → <b>${esc(nm(r.agentId))}</b></div></div><button class="btn sm ghost danger" data-rm="${r.id}" title="Delete rule">${ic('trash')}</button></div></div>`).join('') || '<div class="hint" style="margin-bottom:10px">No rules yet.</div>'}
    <div class="card pad" style="margin-top:10px;background:var(--surface-2)"><div class="h3" style="font-size:13.5px">Add a rule</div>
      <div class="field"><label>Domain(s) or email(s) <span class="hint">— separate several with commas</span></label><input type="text" id="rp" placeholder="hilton.com, billing@marriott.com"></div>
      <div class="grid g2" style="gap:12px"><div class="field"><label>Send to</label><select id="ra">${ag.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label>In mailbox</label><select id="rm"><option value="">All mailboxes</option>${accs.map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('')}</select></div></div>
      <button class="btn primary" id="radd">${ic('plus')} Add rule</button></div>
    <div class="card pad" style="margin-top:10px"><div class="h3" style="font-size:13.5px">My company’s own addresses</div>
      <div class="hint" style="margin-bottom:6px">Mail from these (colleagues who forward or CC you) is routed by the <b>client</b> in To / CC or the original sender inside the forwarded mail — not by the colleague.</div>
      <div class="row"><input type="text" id="rint" placeholder="mrenterprises.com, boss@gmail.com" value="${esc(internal.join(', '))}" style="flex:1"><button class="btn" id="rints">Save</button></div></div>
    <div class="acts"><button class="btn" id="rap" title="Re-route mail already in the app (skips ones you handed over by hand)">Apply to existing mail</button><button class="btn" id="cx">Close</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = () => { close(); mreload().catch(() => {}); };
    $('#radd', bg).onclick = async e => { e.target.disabled = true; try { await api('/mailbox/rules', { method: 'POST', body: { pattern: $('#rp', bg).value, agentId: $('#ra', bg).value, accountId: $('#rm', bg).value } }); const r = await api('/mailbox/rules/apply', { method: 'POST' }); toast(r.moved ? `Rule saved — ${r.moved} existing conversation${r.moved > 1 ? 's' : ''} moved` : 'Rule saved'); close(); rulesModal(); } catch (err) { toast(err.message, true); e.target.disabled = false; } };
    $('#rints', bg).onclick = async () => { try { await api('/mailbox/internal', { method: 'PUT', body: { internal: $('#rint', bg).value } }); const r = await api('/mailbox/rules/apply', { method: 'POST' }); toast(r.moved ? `Saved — ${r.moved} conversation${r.moved > 1 ? 's' : ''} re-routed` : 'Saved'); } catch (e) { toast(e.message, true); } };
    $('#rap', bg).onclick = async () => { const r = await api('/mailbox/rules/apply', { method: 'POST' }); toast(`${r.moved} conversation${r.moved === 1 ? '' : 's'} re-routed`); };
    bg.onclick = async e => { const d = e.target.closest('[data-rm]'); if (d && await gconfirm('Delete this rule? Existing conversations stay where they are.')) { await api('/mailbox/rules/' + d.dataset.rm, { method: 'DELETE' }); close(); rulesModal(); } };
  });
}

// ---------- mailbox accounts (admin) ----------
async function mailSettings() {
  const { accounts } = await api('/mailbox/accounts'), { perms } = await api('/mailbox/perms');
  modal(`<h3>Gmail mailboxes</h3><p class="hint" style="margin-bottom:12px">Add as many Gmail addresses as you need. Reading, stars, labels and “Done” stay in step with Gmail.</p>
    ${accounts.map(a => `<div class="card pad" style="margin-bottom:8px"><div class="row" style="justify-content:space-between"><div><b>${esc(a.label)}</b><div class="hint">${esc(a.user)} · ${a.total} conversation${a.total === 1 ? '' : 's'} · ${a.enabled ? 'on' : 'paused'}</div>
      <div class="hint">${a.lastSync ? 'Checked ' + new Date(a.lastSync).toLocaleTimeString() + (a.lastError ? ` — <span style="color:#dc2626">${esc(a.lastError)}</span>` : ' — OK') : 'Not checked yet'}</div></div>
      <div class="row"><button class="btn sm" data-sy="${a.id}">Sync</button><button class="btn sm" data-ed="${a.id}">Edit</button><button class="btn sm ghost danger" data-rm="${a.id}">${ic('trash')}</button></div></div></div>`).join('') || '<div class="hint">No mailbox yet.</div>'}
    <h4 style="margin:18px 0 4px;font-size:14px">What team members can do</h4><p class="hint" style="margin-bottom:6px">Like Gmail: each person's filters only touch their own conversations. Your routing rules (funnel button) stay yours.</p>
    ${[['showGmailLabels', 'Show the original Gmail labels in the team section (untick: members only see labels they make themselves, and filter their mail with those)'], ['filters', 'Create their own filters (search options → Create filter)'], ['createLabels', 'Create new labels and use them in filters'], ['deleteLabels', 'Delete labels']].map(([k, l]) => `<label class="fchk"><input type="checkbox" data-pm="${k}" ${perms[k] ? 'checked' : ''}> <span>${l}</span></label>`).join('')}
    <div class="acts"><button class="btn" id="cx">Close</button><button class="btn primary" id="ad">${ic('plus')} Add Gmail address</button></div>`, (bg, close) => {
    bg.onchange = async e => { const c = e.target.closest('[data-pm]'); if (!c) return; try { const r = await api('/mailbox/perms', { method: 'PUT', body: { [c.dataset.pm]: c.checked } }); S.mail.perms = r.perms; toast('Saved'); } catch (err) { toast(err.message, true); c.checked = !c.checked; } };
    $('#cx', bg).onclick = () => { close(); viewMail(); }; $('#ad', bg).onclick = () => { close(); accountForm(null); };
    bg.onclick = async e => {
      const g = k => e.target.closest(`[data-${k}]`);
      if (g('ed')) { close(); accountForm(accounts.find(a => a.id === g('ed').dataset.ed)); }
      if (g('sy')) { const b = g('sy'); b.disabled = true; try { const r = await api(`/mailbox/accounts/${b.dataset.sy}/sync`, { method: 'POST' }); toast(`${r.added} new email${r.added === 1 ? '' : 's'}`); } catch (err) { toast(err.message, true); } close(); mailSettings(); }
      if (g('rm') && await gconfirm('Remove this mailbox and its emails from the app? Nothing is deleted in Gmail.')) { await api('/mailbox/accounts/' + g('rm').dataset.rm, { method: 'DELETE' }); close(); mailSettings(); }
    };
  });
}
function accountForm(a) {
  const c = a || { label: '', user: '', host: 'imap.gmail.com', port: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587, fromName: '', minutes: 2, days: 14, enabled: true, orgId: '' };
  const f = (id, l, v, ph = '', t = 'text') => `<div class="field"><label>${l}</label><input type="${t}" id="${id}" value="${esc(v)}" placeholder="${esc(ph)}"></div>`;
  modal(`<h3>${a ? 'Edit' : 'Add'} Gmail mailbox</h3><p class="hint" style="margin-bottom:12px">Turn on 2-Step Verification for this Google account, then create an <b>App password</b> (Google Account → Security → App passwords). Keep “Show in IMAP” on for All Mail (Gmail → Settings → Labels).</p>
    ${f('mu', 'Gmail address', c.user, 'support@yourcompany.com')}${f('mp', 'App password', '', a && a.hasPass ? 'saved — leave blank to keep' : '16-letter app password', 'password')}${f('ml', 'Name for this mailbox', c.label, 'e.g. Hilton support')}
    <div class="field"><label>Dedicated to a company <span class="hint">(optional — everything arriving here goes to that company’s person)</span></label><select id="mo"><option value="">No — route by sender</option>${S.orgs.map(o => `<option value="${o.id}" ${o.id === c.orgId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
    <div class="grid g2" style="gap:12px">${f('mh', 'IMAP server', c.host)}${f('mhp', 'IMAP port', c.port)}${f('ms', 'SMTP server', c.smtpHost)}${f('msp', 'SMTP port', c.smtpPort)}${f('mm', 'Auto-check (fixed: every 10 seconds)', c.minutes).replace('<input','<input disabled')}${f('md', 'First sync: last N days', c.days)}</div>
    ${f('mf', 'Name shown on replies', c.fromName, 'Your Company Support')}<label class="hint"><input type="checkbox" id="men" ${c.enabled ? 'checked' : ''}> Check for new mail automatically</label>
    <label class="hint" style="display:block;margin-top:6px"><input type="checkbox" id="mla" ${c.loadAll !== false ? 'checked' : ''}> Load ALL old mail of this Gmail too (newest first, in the background)${c.backDone ? ' — done' : c.backLeft ? ` — ${c.backLeft} left` : ''}</label>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save & sync now</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = () => { close(); mailSettings(); };
    $('#sv', bg).onclick = async e => {
      e.target.disabled = true; const v = id => $('#' + id, bg).value;
      try {
        const x = await api(a ? '/mailbox/accounts/' + a.id : '/mailbox/accounts', { method: a ? 'PUT' : 'POST', body: { user: v('mu'), pass: v('mp'), label: v('ml'), orgId: v('mo'), host: v('mh'), port: v('mhp'), smtpHost: v('ms'), smtpPort: v('msp'), minutes: v('mm'), days: v('md'), fromName: v('mf'), enabled: $('#men', bg).checked, loadAll: $('#mla', bg).checked } });
        const r = await api(`/mailbox/accounts/${x.id}/sync`, { method: 'POST' }); close(); toast(`Connected — ${r.added} email${r.added === 1 ? '' : 's'} fetched`); mailSettings();
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    };
  });
}
// "Loading all your Gmail…" bar: the old mail of every mailbox is loaded in the background, newest first
let progHide = 0;
function backProgress(justDone) {
  const el = $('#gprog'); if (!el) return;
  const act = (S.mail.accounts || []).filter(a => a.loadAll !== false && !a.backDone && a.backTotal > 0 && a.backLeft > 0);
  clearTimeout(progHide);
  if (!act.length) { if (justDone) { el.hidden = false; el.innerHTML = `<span>${ic('check')} All your Gmail is loaded</span>`; el.classList.add('ok'); progHide = setTimeout(() => { el.hidden = true; el.classList.remove('ok'); }, 4000); } else el.hidden = true; return; }
  const left = act.reduce((n, a) => n + a.backLeft, 0), total = act.reduce((n, a) => n + a.backTotal, 0), pct = Math.max(1, Math.min(99, Math.round((total - left) / total * 100)));
  el.hidden = false; el.classList.remove('ok'); el.innerHTML = `<span>${ic('refresh')} Loading all your Gmail… <b>${left.toLocaleString()}</b> older emails left</span><i><u style="width:${pct}%"></u></i>`;
}
function mailProgress(e) {
  const a = (S.mail.accounts || []).find(x => x.id === e.accountId); if (!a) return;
  const was = !a.backDone && a.backLeft > 0; a.backLeft = e.left; a.backTotal = e.total || a.backTotal; a.backDone = e.done;
  if (S.view === 'mail') backProgress(e.done && was);
}
function mailEvent(t, quiet) {
  if (t.gone) { S.mail.threads = S.mail.threads.filter(x => x.id !== t.id); if (S.view === 'mail' && $('#grail')) mailRedraw(); return; }
  const i = S.mail.threads.findIndex(x => x.id === t.id); if (i >= 0) S.mail.threads[i] = t; else S.mail.threads.push(t);
  if (!quiet && t.unread && t.agentId === S.me.id && i < 0) toast(`New email from ${t.who}`);
  if (S.view === 'mail' && $('#grail')) mailRedraw();
}
let redrawT = 0; // a sync can bring dozens of events at once; redraw once, not once per mail
function mailRedraw() { if (redrawT) return; redrawT = setTimeout(() => { redrawT = 0; if (S.view === 'mail' && $('#grail')) { gmRail(); if (!S.mail.sel) gmList(); } }, 120); }

// ---------- "always send mail like this to…" (from an open conversation) ----------
async function filterModal(t) {
  let internal = []; try { internal = (await api('/mailbox/internal')).internal; } catch {}
  const own = new Set(S.mail.accounts.map(a => (a.user || '').toLowerCase()));
  const isMine = e => own.has(e) || internal.some(p => p.includes('@') ? e === p : (e.split('@')[1] || '') === p || (e.split('@')[1] || '').endsWith('.' + p));
  const found = new Map(); // address -> where it was seen
  const add = (e, how) => { e = String(e || '').toLowerCase(); if (e && e.includes('@') && !own.has(e) && !found.has(e)) found.set(e, how); };
  for (const m of S.mail.mails) {
    add(m.from.email, 'sender'); (m.to || []).forEach(x => add(x.email, 'To')); (m.cc || []).forEach(x => add(x.email, 'CC'));
    for (const line of String(m.text || '').split('\n').slice(0, 400)) { const g = line.match(/^\W*(?:from|de|von)\s*:\s*(.+)$/i); if (g) (g[1].match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) || []).forEach(x => add(x, 'forwarded from')); }
  }
  const addrs = [...found.keys()], doms = [...new Set(addrs.map(e => e.split('@')[1]))];
  const opts = [...addrs.map(e => `<option value="${esc(e)}">${esc(e)} (${found.get(e)}${isMine(e) ? ', my company' : ''})</option>`), ...doms.map(d => `<option value="@${esc(d)}">Everyone at ${esc(d)}</option>`)].join('');
  const ag = S.agents.filter(a => a.active);
  if (!addrs.length) return toast('No addresses found in this conversation', true);
  modal(`<h3>Always send mail like this to…</h3><p class="hint" style="margin-bottom:12px">Pick the client address (or their whole company) and a team member. From now on, mail from them — or with them in To / CC or inside a forwarded mail — goes only to that person.</p>
    <div class="field"><label>When mail involves</label><select id="fa">${opts}</select></div>
    <div class="field"><label>Send it to</label><select id="fb">${ag.map(a => `<option value="${a.id}" ${a.id === t.agentId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label class="chk"><input type="checkbox" id="fm" checked><span>Also hand this conversation over to them now</span></label></div>
    <div class="field"><label class="chk"><input type="checkbox" id="fo" ${S.mail.accounts.length > 1 ? '' : 'disabled'}><span>Only in this mailbox (${esc(t.accountLabel || '')})</span></label></div>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Create filter</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close;
    $('#sv', bg).onclick = async e => {
      e.target.disabled = true; const who = $('#fb', bg).value;
      try {
        await api('/mailbox/rules', { method: 'POST', body: { pattern: $('#fa', bg).value, agentId: who, accountId: $('#fo', bg).checked ? t.accountId : '' } });
        const r = await api('/mailbox/rules/apply', { method: 'POST' });
        if ($('#fm', bg).checked && who !== t.agentId) await mpost(t.id, 'assign', { agentId: who });
        close(); toast(`Filter saved${r.moved ? ' — ' + r.moved + ' other conversation' + (r.moved > 1 ? 's' : '') + ' moved' : ''}`); S.mail.sel = null; await mreload();
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    };
  });
}


// ---------- attachments: preview cards, mailViewer window, drag & drop ----------
function fileKind(name, type) {
  const e = (String(name).match(/\.([A-Za-z0-9]+)$/) || [])[1]; const x = (e || '').toLowerCase(), t = String(type || '');
  if (/^(png|jpe?g|gif|webp|bmp|svg)$/.test(x) || (!x && t.startsWith('image/'))) return 'image';
  if (x === 'pdf' || t === 'application/pdf') return 'pdf';
  if (/^(xlsx|xlsm)$/.test(x)) return 'sheet';
  if (/^(txt|log|csv|json|md)$/.test(x)) return 'text';
  if (/^(mp4|webm)$/.test(x)) return 'video';
  if (/^(mp3|wav|ogg|m4a)$/.test(x)) return 'audio';
  return 'other';
}
const mailExtOf = n => ((String(n).match(/\.([A-Za-z0-9]+)$/) || [])[1] || 'file').slice(0, 4).toUpperCase();
const KCOL = { pdf: '#d93025', sheet: '#188038', text: '#5f6368', video: '#8430ce', audio: '#8430ce', other: '#5f6368', image: '#1a73e8' };
const mailFileUrl = (m, f, tok, q = '') => `/api/mailbox/file/${m.id || m}/${f.i ?? f}?token=${tok}${q}`;
function mailFileCard(m, f, tok) {
  const k = fileKind(f.name, f.type), th = k === 'image' ? `<img loading="lazy" src="${mailFileUrl(m, f, tok, '&inline=1')}" alt="">` : `<span class="fx" style="--c:${KCOL[k]}">${esc(mailExtOf(f.name))}</span>`;
  return `<div class="fcard" data-pv="${m.id}" data-i="${f.i}" title="Click to open"><div class="fth2">${th}</div><div class="fin"><span class="fn">${esc(f.name)}</span><small>${fmtSize(f.size)}</small></div><a class="fdl ib sm" data-dl href="${mailFileUrl(m, f, tok)}" download title="Download">${ic('down')}</a></div>`;
}
function previewMail(mailId, i) {
  const tok = encodeURIComponent(S.token), items = [];
  for (const m of S.mail.mails) for (const f of m.files || []) items.push({ name: f.name, type: f.type, size: f.size, kind: fileKind(f.name, f.type), url: mailFileUrl(m, f, tok, '&inline=1'), dl: mailFileUrl(m, f, tok), table: mailFileUrl(m, f, '' + tok, '&as=table'), mid: m.id, i: f.i });
  mailViewer(items, Math.max(0, items.findIndex(x => x.mid === mailId && x.i === i)));
}
function previewThread(t, n) { // attachments shown as chips in the list: open them without opening the mail (it stays unread)
  const tok = encodeURIComponent(S.token);
  mailViewer((t.atts || []).map(f => ({ name: f.name, type: f.type, size: f.size, kind: fileKind(f.name, f.type), url: mailFileUrl(f.mid, f, tok, '&inline=1'), dl: mailFileUrl(f.mid, f, tok), table: mailFileUrl(f.mid, f, '' + tok, '&as=table'), mid: f.mid, i: f.i })), n);
}
function previewLocal(files, idx) {
  const items = files.map(f => { const bin = atob(f.b64), u8 = new Uint8Array(bin.length); for (let n = 0; n < bin.length; n++) u8[n] = bin.charCodeAt(n); const k = fileKind(f.filename, f.type), mime = k === 'pdf' ? 'application/pdf' : f.type || 'application/octet-stream'; const url = URL.createObjectURL(new Blob([u8], { type: k === 'text' ? 'text/plain' : mime })); return { name: f.filename, type: f.type, size: f.size, kind: k === 'sheet' ? 'other' : k, url, dl: url, local: true }; });
  mailViewer(items, idx, () => items.forEach(x => URL.revokeObjectURL(x.url)));
}
function mailViewer(items, at, onClose) {
  if (!items.length) return; let i = at, ctl = null; $('.pv')?.remove();
  const el = document.createElement('div'); el.className = 'pv'; document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', key, true); onClose && onClose(); };
  const key = e => { // capture phase: the viewer owns the keyboard while it is open (so Esc doesn't also leave the email)
    if (!['Escape', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.stopImmediatePropagation(); e.preventDefault();
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight' && i < items.length - 1) { i++; draw(); } else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } };
  document.addEventListener('keydown', key, true);
  async function draw() {
    const it = items[i], tok = encodeURIComponent(S.token); ctl && ctl.abort(); ctl = new AbortController();
    el.innerHTML = `<div class="pvh"><button class="ib" id="pvx" title="Close (Esc)">${ic('x')}</button><b class="pvn">${esc(it.name)}</b><small>${fmtSize(it.size)}${items.length > 1 ? ` · ${i + 1} of ${items.length}` : ''}</small><span class="sp"></span>${items.length > 1 ? `<button class="ib" id="pvp" ${i ? '' : 'disabled'} title="Previous">${ic('chevL')}</button><button class="ib" id="pvn" ${i < items.length - 1 ? '' : 'disabled'} title="Next">${ic('chevR')}</button>` : ''}<a class="btn sm" href="${it.dl}" download="${esc(it.name)}">${ic('down')} Download</a></div><div class="pvb" id="pvb"></div>`;
    $('#pvx', el).onclick = close; if ($('#pvp', el)) { $('#pvp', el).onclick = () => { i--; draw(); }; $('#pvn', el).onclick = () => { i++; draw(); }; }
    const b = $('#pvb', el); b.onclick = e => { if (e.target === b) close(); };
    const none = `<div class="pvnone"><div class="fx big" style="--c:${KCOL[it.kind] || '#5f6368'}">${esc(mailExtOf(it.name))}</div><p>${it.local ? 'This file will be previewable once it is sent.' : 'No preview available for this type of file.'}</p><a class="btn primary" href="${it.dl}" download="${esc(it.name)}">${ic('down')} Download</a></div>`;
    if (it.kind === 'image') b.innerHTML = `<img class="pvimg" src="${it.url}" alt="">`;
    else if (it.kind === 'pdf') b.innerHTML = `<iframe class="pvfr" src="${it.url}"></iframe>`;
    else if (it.kind === 'video') b.innerHTML = `<video class="pvmed" src="${it.url}" controls autoplay></video>`;
    else if (it.kind === 'audio') b.innerHTML = `<audio src="${it.url}" controls autoplay></audio>`;
    else if (it.kind === 'text') { b.innerHTML = '<div class="pvtx hint">Loading…</div>'; try { const t = await (await fetch(it.url, { signal: ctl.signal })).text(); if (items[i] === it) b.innerHTML = `<pre class="pvtx">${esc(t.slice(0, 300000))}</pre>`; } catch (e) { if (e.name !== 'AbortError') b.innerHTML = none; } }
    else if (it.kind === 'sheet') {
      b.innerHTML = '<div class="pvtx hint">Loading…</div>';
      const load = async sheet => { try { const r = await api(it.table.replace(/^\/api/, '').replace(/\?token=[^&]*&?/, '?') + (sheet ? '&sheet=' + encodeURIComponent(sheet) : '')); if (items[i] !== it) return;
        b.innerHTML = `${r.sheets.length > 1 ? `<div class="pvtabs">${r.sheets.map(n => `<button class="${n === (sheet || r.sheets[0]) ? 'on' : ''}" data-sh="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}<div class="pvtbl"><table>${r.rows.map((row, n) => `<tr><th>${n + 1}</th>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || '<tr><td>Empty sheet</td></tr>'}</table></div>`;
        b.querySelectorAll('[data-sh]').forEach(x => x.onclick = () => load(x.dataset.sh)); } catch (e) { b.innerHTML = none; } };
      load();
    } else b.innerHTML = none;
  }
  draw();
}
// read dropped / picked files for sending (max 10 files, 15 MB each — the server keeps the same limits)
async function mailTakeFiles(fl) {
  const all = [...fl], ok = all.filter(f => f.size <= 15e6 && f.size > 0);
  if (ok.length < all.length) toast('Files over 15 MB (or empty) were skipped', true);
  return readFiles(ok);
}
// drag & drop files onto an element
function mailDropZone(el, onFiles) {
  if (!el) return; let n = 0; const has = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  el.classList.add('dz');
  el.addEventListener('dragenter', e => { if (!has(e)) return; e.preventDefault(); n++; el.classList.add('over'); });
  el.addEventListener('dragover', e => { if (!has(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; el.classList.add('over'); });
  el.addEventListener('dragleave', e => { if (!has(e)) return; if (--n <= 0) { n = 0; el.classList.remove('over'); } });
  el.addEventListener('drop', e => { if (!has(e)) return; e.preventDefault(); e.stopPropagation(); n = 0; el.classList.remove('over'); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
}


// ---------- Gmail-style search options + "Create filter" (every team member) ----------
ICONS.sliders = '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>';
function applySearch(q) { S.mail.q = q; addRecent(q); remoteSearch(true); S.mail.page = 0; S.mail.chk.clear(); S.mail.sel = null; if ($('#mq')) { $('#mq').value = q; $('#mclr').hidden = !q; } gmRender(); }
const SEARCH_IN = [['anywhere', 'All mail'], ['inbox', 'Inbox'], ['starred', 'Starred'], ['sent', 'Sent'], ['done', 'Done (archived)'], ['trash', 'Bin'], ['spam', 'Spam']];
const WITHIN = [['', 'Any time'], ['1d', '1 day'], ['3d', '3 days'], ['7d', '1 week'], ['14d', '2 weeks'], ['30d', '1 month'], ['60d', '2 months'], ['180d', '6 months'], ['365d', '1 year']];
function searchPanel(pre = {}, startFilter = false) {
  document.querySelector('.sopt')?.remove();
  const bar = $('.gm-search'), r = bar ? bar.getBoundingClientRect() : { left: 80, top: 8, bottom: 56, width: 640 };
  const el = document.createElement('div'); el.className = 'sopt'; el.style.cssText = `left:${r.left}px;top:${r.bottom + 4}px;width:${Math.min(Math.max(r.width, 520), innerWidth - r.left - 12)}px`;
  const f = (id, l, v = '', ph = '') => `<div class="sr"><label for="so_${id}">${l}</label><input id="so_${id}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  el.innerHTML = `${f('from', 'From', pre.from)}${f('to', 'To', pre.to)}${f('subject', 'Subject', pre.subject)}${f('has', 'Has the words', pre.has)}${f('not', "Doesn't have", pre.not)}
    <div class="sr"><label>Size</label><div class="sr3"><select id="so_sop"><option value="gt">greater than</option><option value="lt">less than</option></select><input id="so_size" type="number" min="0" step="any"><select id="so_unit"><option>MB</option><option>KB</option></select></div></div>
    <div class="sr"><label>Date within</label><div class="sr3"><select id="so_within">${WITHIN.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div></div>
    <div class="sr"><label>Search</label><div class="sr3"><select id="so_in">${SEARCH_IN.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}${allLabels().length ? '<optgroup label="Labels">' + allLabels().map(l => `<option value="label:${esc(l)}">${esc(l)}</option>`).join('') + '</optgroup>' : ''}</select></div></div>
    <div class="sr"><label></label><label class="fchk"><input type="checkbox" id="so_att"> <span>Has attachment</span></label></div>
    <div class="sfoot">${mperm('filters') ? '<button class="lnk" id="so_cf">Create filter</button>' : ''}<button class="btn primary" id="so_go">Search</button></div>`;
  document.body.appendChild(el);
  const g = id => $('#so_' + id, el).value.trim(), close = () => { el.remove(); document.removeEventListener('mousedown', out, true); };
  const out = e => { if (!el.contains(e.target) && !e.target.closest('#mopt') && !e.target.closest('.modal-bg')) close(); }; setTimeout(() => document.addEventListener('mousedown', out, true), 0);
  const crit = () => { const c = { from: g('from'), to: g('to'), subject: g('subject'), has: g('has'), not: g('not'), attach: $('#so_att', el).checked }; const n = parseFloat($('#so_size', el).value); if (n > 0) { c.sizeOp = g('sop'); c.sizeBytes = Math.round(n * ($('#so_unit', el).value === 'MB' ? 1048576 : 1024)); } return c; };
  const go = () => {
    const c = crit(), q = [], w = (k, v) => { if (v) q.push(/\s/.test(v) && !/^".*"$/.test(v) ? `${k}:"${v}"` : `${k}:${v}`); };
    w('from', c.from); w('to', c.to); w('subject', c.subject); if (c.has) q.push(c.has); qparts(c.not).forEach(k => q.push('-' + (/\s/.test(k.t) ? `"${k.t}"` : k.t)));
    if (c.sizeBytes) q.push(`${c.sizeOp === 'gt' ? 'larger' : 'smaller'}:${$('#so_unit', el).value === 'MB' ? $('#so_size', el).value + 'M' : $('#so_size', el).value + 'K'}`);
    if (g('within')) q.push('newer_than:' + g('within')); const inn = g('in'); if (inn.startsWith('label:')) w('label', inn.slice(6)); else if (inn !== 'anywhere') q.push('in:' + inn);
    if (c.attach) q.push('has:attachment'); close(); applySearch(q.join(' '));
  };
  $('#so_go', el).onclick = go; el.onkeydown = e => { if (e.key === 'Enter') go(); else if (e.key === 'Escape') close(); };
  if ($('#so_cf', el)) $('#so_cf', el).onclick = () => { let c; try { c = crit(); } catch { return; } if (!c.from && !c.to && !c.subject && !c.has && !c.not && !c.sizeBytes && !c.attach) return toast('Fill in at least one search option first', true); close(); filterDialog(c, () => searchPanel(Object.fromEntries(['from', 'to', 'subject', 'has', 'not'].map(k => [k, c[k]])))); };
  (startFilter ? $('#so_cf', el) : $('#so_from', el))?.focus?.();
}
const critText = c => [c.from && `From: ${c.from}`, c.to && `To: ${c.to}`, c.subject && `Subject: ${c.subject}`, c.has && `Has the words: ${c.has}`, c.not && `Doesn't have: ${c.not}`, c.sizeBytes && `Size ${c.sizeOp === 'gt' ? '>' : '<'} ${fmtSize(c.sizeBytes)}`, c.attach && 'Has attachment'].filter(Boolean).join(' · ');
const actText = a => [a.archive && 'Skip the Inbox (archive)', a.read && 'Mark as read', a.star && 'Star it', a.label && `Apply label “${a.label}”`, a.important && 'Mark as important', a.notImportant && 'Never mark as important', a.trash && 'Delete it'].filter(Boolean).join(' · ');
function filterDialog(c, back) {
  const lbs = allLabels(), canNew = canMakeLabel(), multi = S.mail.accounts.length > 1;
  modal(`<div class="row" style="gap:10px;margin-bottom:12px">${back ? `<button class="ib" id="fdb" title="Back to search options">${ic('back')}</button>` : ''}<h3 style="margin:0">Create filter</h3></div>
    <p class="hint" style="margin-bottom:4px">When a message is an exact match for your search criteria:</p><div class="fcrit">${esc(critText(c))}</div>
    <div class="fopts"><label class="fchk"><input type="checkbox" id="fa_archive"> <span>Skip the Inbox (Archive it)</span></label>
    <label class="fchk"><input type="checkbox" id="fa_read"> <span>Mark as read</span></label>
    <label class="fchk"><input type="checkbox" id="fa_star"> <span>Star it</span></label>
    <div class="fchk-row"><label class="fchk"><input type="checkbox" id="fa_label"> <span>Apply the label:</span></label><select id="fa_lsel"><option value="">Choose label…</option>${lbs.map(l => `<option>${esc(l)}</option>`).join('')}${canNew ? '<option value="__new">New label…</option>' : ''}</select><input id="fa_lnew" placeholder="Label name" hidden></div>
    <label class="fchk"><input type="checkbox" id="fa_trash"> <span>Delete it</span></label>
    <label class="fchk"><input type="checkbox" id="fa_imp"> <span>Always mark it as important</span></label>
    <label class="fchk"><input type="checkbox" id="fa_nimp"> <span>Never mark it as important</span></label>
    ${multi ? `<div class="fchk-row"><span class="hint">Only in</span><select id="fa_acc"><option value="">all mailboxes</option>${S.mail.accounts.map(a => `<option value="${a.id}">${esc(a.label)}</option>`).join('')}</select></div>` : ''}
    <label class="fchk"><input type="checkbox" id="fa_now" checked> <span>Also apply filter to <b id="fa_n">…</b> matching conversations</span></label></div>
    <p class="hint">Only your own conversations are affected. “Archive”, “Delete”, labels, stars and read marks are copied to Gmail.</p>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Create filter</button></div>`, (bg, close) => {
    const $b = id => $('#' + id, bg), acc = () => ($b('fa_acc') ? $b('fa_acc').value : '');
    const count = () => api('/mailbox/filters/preview', { method: 'POST', body: { criteria: c, accountId: acc() } }).then(r => { $b('fa_n').textContent = r.count; }).catch(() => { $b('fa_n').textContent = '0'; }); count(); if ($b('fa_acc')) $b('fa_acc').onchange = count;
    $b('fa_lsel').onchange = e => { $b('fa_lnew').hidden = e.target.value !== '__new'; $b('fa_label').checked = !!e.target.value; if (!$b('fa_lnew').hidden) $b('fa_lnew').focus(); };
    $b('fa_imp').onchange = e => { if (e.target.checked) $b('fa_nimp').checked = false; }; $b('fa_nimp').onchange = e => { if (e.target.checked) $b('fa_imp').checked = false; };
    $b('cx').onclick = close; if ($b('fdb')) $b('fdb').onclick = () => { close(); back(); };
    $b('sv').onclick = async e => {
      const a = { archive: $b('fa_archive').checked, read: $b('fa_read').checked, star: $b('fa_star').checked, trash: $b('fa_trash').checked, important: $b('fa_imp').checked, notImportant: $b('fa_nimp').checked };
      if ($b('fa_label').checked) { const v = $b('fa_lsel').value === '__new' ? $b('fa_lnew').value.trim() : $b('fa_lsel').value; if (!v) return toast('Choose or type a label', true); a.label = v; }
      if (!Object.values(a).some(Boolean)) return toast('Choose at least one action', true);
      if (a.trash && !await gconfirm('This filter will move every matching email to the Bin. Continue?')) return;
      e.target.disabled = true;
      try {
        if (a.label && !allLabels().includes(a.label) && canMakeLabel()) await api('/mailbox/labels', { method: 'POST', body: { name: a.label } });
        const r = await api('/mailbox/filters', { method: 'POST', body: { criteria: c, actions: a, accountId: acc(), applyExisting: $b('fa_now').checked } });
        close(); await mreload(); toast(r.warn || `Filter created${r.applied ? ' — applied to ' + r.applied + ' conversation' + (r.applied === 1 ? '' : 's') : ''}`, !!r.warn);
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    };
  });
}
async function manageFilters() {
  let d; try { d = await api('/mailbox/filters'); } catch (e) { return toast(e.message, true); }
  const rows = d.filters.map(f => `<div class="card pad fli ${f.enabled === false ? 'off' : ''}"><div style="flex:1;min-width:0"><div class="fcrit" style="margin:0 0 4px">${esc(critText(f.criteria))}</div><div class="hint">${esc(actText(f.actions))}${isAdmin() && f.ownerName ? ` · <b>${esc(f.ownerName)}</b>` : ''}</div></div>
    <button class="btn sm" data-tg="${f.id}">${f.enabled === false ? 'Turn on' : 'Turn off'}</button><button class="btn sm ghost danger" data-rm="${f.id}" title="Delete filter">${ic('trash')}</button></div>`).join('');
  modal(`<h3>Filters</h3><p class="hint" style="margin-bottom:10px">Filters run automatically on new mail that comes to you. ${isAdmin() ? 'As admin you see everyone’s filters.' : ''}</p>${rows || '<div class="hint" style="padding:10px 0">No filters yet. Use the search options button (next to the search bar) → <b>Create filter</b>.</div>'}
    <div class="acts"><button class="btn" id="cx">Close</button>${mperm('filters') ? `<button class="btn primary" id="fnew">${ic('plus')} New filter</button>` : ''}</div>`, (bg, close) => {
    $('#cx', bg).onclick = close; if ($('#fnew', bg)) $('#fnew', bg).onclick = () => { close(); searchPanel({}, true); };
    bg.onclick = async e => {
      const tg = e.target.closest('[data-tg]'), rm = e.target.closest('[data-rm]');
      try {
        if (tg) { const f = d.filters.find(x => x.id === tg.dataset.tg); await api('/mailbox/filters/' + f.id, { method: 'PUT', body: { enabled: f.enabled === false } }); close(); manageFilters(); }
        if (rm && await gconfirm('Delete this filter?')) { await api('/mailbox/filters/' + rm.dataset.rm, { method: 'DELETE' }); close(); manageFilters(); }
      } catch (err) { toast(err.message, true); }
    };
  });
}

// ---------- small PO / P.R finder inside Email: search, then put the details in a mail with one button ----------
function poWindow() {
  let w = $('#powin'); if (w) { w.remove(); return; }
  w = document.createElement('div'); w.id = 'powin'; w.className = 'powin';
  w.innerHTML = `<div class="po-h"><b>Find PO / P.R</b><span class="sp"></span><button class="ib sm" id="pox" title="Close">${ic('x')}</button></div>
    <div class="po-b"><div class="search">${ic('search')}<input type="search" id="poq" placeholder="PO, P.R, CN, customer or company" autocomplete="off"></div>
    <input type="email" id="poto" placeholder="Email to (any address) — optional" autocomplete="off" style="margin:8px 0">
    <div id="pores" class="po-res"><div class="hint">Type at least 2 characters.</div></div></div>`;
  document.body.appendChild(w); let rs = [], t;
  $('#pox').onclick = () => w.remove(); $('#poq').focus();
  const run = async () => {
    const q = $('#poq').value.trim(), out = $('#pores');
    if (q.length < 2) { out.innerHTML = '<div class="hint">Type at least 2 characters.</div>'; return; }
    try { rs = (await api('/track/search?q=' + encodeURIComponent(q))).results.slice(0, 12); } catch (e) { out.innerHTML = `<div class="hint">${esc(e.message)}</div>`; return; }
    out.innerHTML = rs.map((r, i) => `<div class="po-r"><div class="po-t"><div><b>PO ${esc(r.po || r.orderId)}</b>${r.pr ? ` <span class="hint">PR ${esc(r.pr)}</span>` : ''}${r.cn ? ` <span class="hint">CN ${esc(r.cn)}</span>` : ''}</div>${orderPill(r.status)}</div>
      <div class="hint">${esc(r.organization || r.company || '')}${r.customer ? ' · ' + esc(r.customer) : ''}${r.courier ? ' · ' + esc(r.courier) : ''}${r.day ? ' · ' + esc(r.day) : ''}</div>
      <details class="po-d"><summary>See the message</summary><pre>${esc(r.text)}</pre></details>
      <div class="po-act"><button class="btn sm" data-copy="${i}" title="Copy the details">${ic('edit')} Copy</button><button class="btn sm wa" data-wa="${i}" title="Send on WhatsApp">${ic('wa')} WhatsApp</button>${S.mail.cw ? `<button class="btn sm" data-add="${i}" title="Insert into the message you are writing">Add to draft</button>` : ''}<button class="btn sm primary" data-send="${i}" title="Open a new mail with this message ready">${ic('mail')} Email</button></div></div>`).join('') || `<div class="hint">No match for “${esc(q)}”.</div>`;
  };
  $('#poq').oninput = () => { clearTimeout(t); t = setTimeout(run, 250); };
  $('#pores').onclick = e => {
    const cp = e.target.closest('[data-copy]'), wa = e.target.closest('[data-wa]');
    if (cp) { navigator.clipboard.writeText(rs[+cp.dataset.copy].text).then(() => toast('Details copied'), () => toast('Could not copy', true)); return; }
    if (wa) { waSendOrder(rs[+wa.dataset.wa]); return; }
    const a = e.target.closest('[data-add]'), s = e.target.closest('[data-send]'); if (!a && !s) return;
    const r = rs[+(a || s).dataset[a ? 'add' : 'send']], to = $('#poto').value.trim(), html = `<div>${textToHtml(r.text)}</div>`;
    if (a && S.mail.cw) { const ed = $('#cwed'); if (ed) S.mail.cw.html = ed.innerHTML; S.mail.cw.html += '<br>' + html; if (to && !S.mail.cw.to.includes(to)) S.mail.cw.to.push(to); cwDraw(); toast('Details added to your message'); return; }
    if (!S.mail.accounts.length) return toast('Connect a mailbox first', true);
    if (S.mail.cw) cwClose(true);
    compose({ to, subject: `PO ${r.po || r.orderId}${r.pr ? ' / PR ' + r.pr : ''} — ${r.status}`, html: `<div>Dear Sir/Madam,</div><br>${html}<br><div>Regards</div>` });
  };
}
