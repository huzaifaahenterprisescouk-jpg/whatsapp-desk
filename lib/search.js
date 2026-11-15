// Gmail-style search over the mails stored here (used instantly, for non-Gmail mailboxes, and for Bin / Spam).
// Understands what Gmail understands: words, "exact phrases", -exclude, OR / |, { a b } (any of), ( grouping ),
// from: to: cc: bcc: subject: label: in: is: has: filename: larger: smaller: size: after: before: older: newer: older_than: newer_than: deliveredto: rfc822msgid:
const norm = s => String(s || '').toLowerCase();

// ---------- parser ----------
function parse(q) {
  const s = String(q || ''); let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const isOr = () => (s.startsWith('OR', i) && (i + 2 >= s.length || /[\s(){}"]/.test(s[i + 2]))) || (s[i] === '|' );
  const skipOr = () => { i += s[i] === '|' ? 1 : 2; };
  const word = () => { let w = ''; while (i < s.length && !/[\s(){}"]/.test(s[i])) w += s[i++]; return w; };
  const quoted = () => { i++; let w = ''; while (i < s.length && s[i] !== '"') w += s[i++]; i++; return w; };
  function parseOr(close) {
    const alts = [parseAnd(close)];
    for (;;) { ws(); if (i < s.length && isOr()) { skipOr(); alts.push(parseAnd(close)); } else break; }
    return alts.length === 1 ? alts[0] : { k: 'or', a: alts };
  }
  function parseAnd(close) {
    const items = [];
    for (;;) {
      ws(); if (i >= s.length || isOr()) break;
      if (s[i] === ')' || s[i] === '}') { if (s[i] === close) break; i++; continue; }
      const u = parseUnary(); if (u) items.push(u);
    }
    return items.length === 1 ? items[0] : { k: 'and', a: items };
  }
  function parseUnary() {
    let neg = false; if (s[i] === '-' && i + 1 < s.length && !/\s/.test(s[i + 1])) { neg = true; i++; }
    const n = parseAtom(); return n && neg ? { k: 'not', a: n } : n;
  }
  function group(open, close) { // ( ... ) or { ... }
    i++;
    if (open === '{') { const alts = []; for (;;) { ws(); if (i >= s.length || s[i] === '}') break; if (s[i] === ')') { i++; continue; } const u = parseUnary(); if (u) alts.push(u); } i++; return alts.length === 1 ? alts[0] : { k: 'or', a: alts }; }
    const n = parseOr(close); if (s[i] === close) i++; return n;
  }
  const tag = (n, op) => { if (!n) return n; if (n.k === 't') return n.op ? n : { ...n, op }; return { ...n, a: n.a.map(x => tag(x, op)) }; };
  function parseAtom() {
    if (s[i] === '(') return group('(', ')');
    if (s[i] === '{') return group('{', '}');
    if (s[i] === '"') { const v = quoted(); return v ? { k: 't', op: '', v, phrase: true } : null; }
    const m = /^([a-z_]+):/i.exec(s.slice(i, i + 24));
    if (m) {
      const op = m[1].toLowerCase(); i += m[0].length;
      if (s[i] === '(' || s[i] === '{') return tag(group(s[i], s[i] === '(' ? ')' : '}'), op);
      if (s[i] === '"') { const v = quoted(); return v ? { k: 't', op, v, phrase: true } : null; }
      const v = word(); return v ? { k: 't', op, v } : null;
    }
    const w = word(); if (!w) { i++; return null; } return { k: 't', op: '', v: w };
  }
  return parseOr();
}

// does the query mention the Bin / Spam / everything? (then those conversations are searched too)
function scope(node) {
  const r = { trash: false, spam: false };
  (function walk(n, neg) {
    if (!n) return;
    if (n.k === 'not') return walk(n.a, !neg);
    if (n.k === 't') { if (!neg && n.op === 'in') { const v = norm(n.v); if (v === 'trash' || v === 'bin') r.trash = true; if (v === 'spam' || v === 'junk') r.spam = true; if (v === 'anywhere' || v === 'all') r.trash = r.spam = true; } return; }
    (n.a || []).forEach(x => walk(x, neg));
  })(node, false);
  return r;
}

// ---------- evaluation ----------
const bytes = v => { const m = /^(\d+(?:\.\d+)?)\s*([kmg]?)b?$/i.exec(String(v).trim()); return m ? +m[1] * ({ '': 1, k: 1024, m: 1048576, g: 1073741824 }[m[2].toLowerCase()]) : NaN; };
function dayStart(v) { // 2026/11/12, 2026-11-12, 11/12/2026 or epoch seconds -> ms (start of that day)
  v = String(v).trim(); if (/^\d{9,11}$/.test(v)) return +v * 1000;
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(v); if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v); if (m) return new Date(+m[3], +m[1] - 1, +m[2]).getTime();
  return NaN;
}
const rel = v => { const m = /^(\d+)([dmy]?)$/i.exec(String(v).trim()); return m ? +m[1] * ({ '': 864e5, d: 864e5, m: 30 * 864e5, y: 365 * 864e5 }[m[2].toLowerCase()]) : NaN; };
const people = l => (l || []).map(x => `${x.name || ''} ${x.email || ''}`).join(' ').toLowerCase();
const key = m => m.idate || m.date || 0;
const labelKey = l => norm(l).replace(/\s+/g, '-');

// ctx: { me: 'my@address' (mailbox of the message), labelsOf(t) -> labels the viewer sees, orgName(t) }
function evalLeaf(n, m, t, ctx) {
  const v = norm(n.v), has = hay => hay.includes(v);
  const self = x => v === 'me' ? norm(ctx.userOf ? ctx.userOf(m) : '') : v;
  switch (n.op) {
    case '': return has([m.subject, m.text, people([m.from]), people(m.to), people(m.cc), (m.files || []).map(f => f.name).join(' ')].join(' ').toLowerCase());
    case 'from': case 'sender': return people([m.from]).includes(self());
    case 'to': return (people(m.to) + ' ' + people(m.cc) + ' ' + people(m.bcc)).includes(self());
    case 'cc': return people(m.cc).includes(self());
    case 'bcc': return people(m.bcc).includes(self());
    case 'deliveredto': return (people(m.to) + ' ' + people(m.cc)).includes(self());
    case 'subject': return norm(m.subject).includes(v);
    case 'label': { const k = labelKey(n.v); return (ctx.labelsOf ? ctx.labelsOf(t) : t.labels || []).some(l => { const x = labelKey(l); return x === k || x.startsWith(k + '/'); }); }
    case 'in': switch (v) {
      case 'inbox': return t.status === 'open' && !t.trashed && !t.spam;
      case 'anywhere': case 'all': return true;
      case 'trash': case 'bin': return !!t.trashed;
      case 'spam': case 'junk': return !!t.spam && !t.trashed;
      case 'starred': case 'star': return !!m.flagged;
      case 'sent': return m.dir === 'out';
      case 'important': return !!t.important;
      case 'done': case 'archive': case 'archived': return t.status === 'resolved';
      case 'unread': return !m.seen;
      case 'drafts': case 'draft': case 'chats': case 'snoozed': case 'scheduled': return false;
      default: return (ctx.labelsOf ? ctx.labelsOf(t) : t.labels || []).some(l => labelKey(l) === labelKey(n.v));
    }
    case 'is': switch (v) {
      case 'unread': return !m.seen; case 'read': return !!m.seen;
      case 'starred': case 'star': return !!m.flagged; case 'important': return !!t.important;
      case 'done': case 'archived': return t.status === 'resolved';
      case 'sent': return m.dir === 'out'; case 'inbox': return t.status === 'open';
      case 'snoozed': case 'muted': case 'chat': return false;
      default: return true;
    }
    case 'has': switch (v) {
      case 'attachment': case 'attachments': case 'file': case 'files': return (m.files || []).length > 0;
      case 'userlabels': return (ctx.labelsOf ? ctx.labelsOf(t) : t.labels || []).length > 0;
      case 'nouserlabels': return !(ctx.labelsOf ? ctx.labelsOf(t) : t.labels || []).length;
      case 'drive': case 'document': case 'spreadsheet': case 'presentation': case 'youtube': case 'yellow-star': return false;
      default: return true;
    }
    case 'filename': return (m.files || []).some(f => { const nm = norm(f.name); return nm.includes(v) || (/^\.?[a-z0-9]{1,5}$/.test(v) && nm.endsWith('.' + v.replace(/^\./, ''))); });
    case 'larger': { const b = bytes(n.v); return !isNaN(b) && ((m.size || (m.text || '').length) + (m.files || []).reduce((a, f) => a + (f.size || 0), 0)) > b; }
    case 'smaller': { const b = bytes(n.v); return !isNaN(b) && ((m.size || (m.text || '').length) + (m.files || []).reduce((a, f) => a + (f.size || 0), 0)) < b; }
    case 'size': { const b = bytes(n.v); return !isNaN(b) && ((m.size || (m.text || '').length) + (m.files || []).reduce((a, f) => a + (f.size || 0), 0)) >= b; }
    case 'after': case 'newer': { const d = dayStart(n.v); if (!isNaN(d)) return key(m) >= d; const r = rel(n.v); return !isNaN(r) && Date.now() - key(m) <= r; }
    case 'before': case 'older': { const d = dayStart(n.v); if (!isNaN(d)) return key(m) < d; const r = rel(n.v); return !isNaN(r) && Date.now() - key(m) > r; }
    case 'newer_than': { const r = rel(n.v); return !isNaN(r) && Date.now() - key(m) <= r; }
    case 'older_than': { const r = rel(n.v); return !isNaN(r) && Date.now() - key(m) > r; }
    case 'rfc822msgid': return norm(m.messageId).includes(v.replace(/^<|>$/g, ''));
    case 'org': return norm(ctx.orgName ? ctx.orgName(t) : '').includes(v);
    case 'category': case 'list': case 'lang': case 'delivered': return true; // not available here: ignored (Gmail itself answers these)
    default: return norm([m.subject, m.text, people([m.from])].join(' ')).includes(norm(n.op + ':' + n.v)); // unknown operator: search the words
  }
}
function ev(n, m, t, ctx) {
  if (!n) return true;
  switch (n.k) {
    case 'and': return n.a.every(x => ev(x, m, t, ctx));
    case 'or': return n.a.some(x => ev(x, m, t, ctx));
    case 'not': return !ev(n.a, m, t, ctx);
    default: return evalLeaf(n, m, t, ctx);
  }
}

// threads: [{ t, ms }]; returns the matching conversations (any mail of the conversation matching is enough, like Gmail)
function run(q, threads, ctx = {}) {
  const ast = parse(q), sc = scope(ast), out = [];
  for (const { t, ms } of threads) {
    if (t.trashed && !sc.trash) continue; if (t.spam && !t.trashed && !sc.spam) continue;
    if (ms.some(m => ev(ast, m, t, { ...ctx, userOf: ctx.userOf }))) out.push(t);
  }
  return out;
}
module.exports = { parse, run, scope };
