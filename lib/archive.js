// Mail older than one year is moved out of the app's database (db.json) into an archive folder, which is
// normally a folder on your Synology NAS. The app stays small and fast; old mail can still be searched, opened
// (with its attachments) and, if needed, restored into the mailbox to reply to it.
//
//   <archive>/threads/<xx>/<thread id>.json   one file per conversation (conversation + all its mails)
//   <archive>/files/<mail id>/...             attachments and the HTML body of each mail
//   <archive>/index-<year>.jsonl              one short line per conversation, used by the search
const fs = require('fs'), path = require('path');
const cfg = require('./config');

const dir = () => process.env.MAIL_ARCHIVE_DIR || path.join(path.dirname(cfg.dataFile), 'mail-archive');
const keepDays = () => Math.max(30, +process.env.MAIL_KEEP_DAYS || 365);
const cutoff = () => Date.now() - keepDays() * 864e5;
const tdir = id => path.join(dir(), 'threads', String(id).slice(-2));
const safe = id => /^\w+$/.test(String(id || ''));

function put(t, ms, srcRoot, row) {
  fs.mkdirSync(tdir(t.id), { recursive: true });
  for (const m of ms) { // attachments + html body first, the conversation file last
    const s = path.join(srcRoot, m.id); if (!fs.existsSync(s)) continue;
    const d = path.join(dir(), 'files', m.id); fs.mkdirSync(d, { recursive: true }); fs.cpSync(s, d, { recursive: true }); fs.writeFileSync(path.join(d, '.t'), t.id);
  }
  fs.writeFileSync(path.join(tdir(t.id), t.id + '.json'), JSON.stringify({ thread: t, mails: ms }));
  fs.appendFileSync(path.join(dir(), 'index-' + new Date(t.updatedAt).getFullYear() + '.jsonl'), JSON.stringify(row) + '\n');
}
function get(id) { if (!safe(id)) return null; try { return JSON.parse(fs.readFileSync(path.join(tdir(id), id + '.json'), 'utf8')); } catch { return null; } }
const filesDir = mailId => safe(mailId) ? path.join(dir(), 'files', mailId) : null;
function threadOfMail(mailId) { const d = filesDir(mailId); try { return d && fs.readFileSync(path.join(d, '.t'), 'utf8').trim(); } catch { return null; } }
function bodyHtml(mailId) { const d = filesDir(mailId); try { return d && fs.readFileSync(path.join(d, 'body.html'), 'utf8'); } catch { return null; } }

// ---------- search (the same kind of words as the mail search: from: subject: label: org: "phrases" -excluded) ----------
function parseQ(q) {
  const out = []; String(q || '').replace(/(-?)(?:(from|to|subject|label|org):)?(?:"([^"]+)"|(\S+))/gi, (_, neg, op, qt, w) => {
    const v = String(qt !== undefined ? qt : w || '').toLowerCase(); if (!v) return '';
    if (!op && /^[a-z_]+:/i.test(v) && qt === undefined) return ''; // operators this search does not know (is:, in:, ...) are ignored
    out.push({ neg: !!neg, op: op ? op.toLowerCase() : '', v }); return '';
  });
  return out;
}
const matches = (r, toks) => toks.every(k => {
  const who = ((r.who || '') + ' ' + (r.whoEmail || '')).toLowerCase(), subj = String(r.subject || '').toLowerCase();
  const hay = k.op === 'from' || k.op === 'to' ? who : k.op === 'subject' ? subj : k.op === 'label' ? (r.labels || []).join(' ').toLowerCase() : k.op === 'org' ? String(r.orgName || '').toLowerCase()
    : [subj, who, r.orgName, r.snippet, (r.labels || []).join(' '), r.x].join(' ').toLowerCase();
  return hay.includes(k.v) !== k.neg;
});
const CAP = 300;
function search(q, allow) { // newest first; at most CAP conversations (narrow the search to see more)
  const toks = parseQ(q); let files = []; try { files = fs.readdirSync(dir()).filter(f => /^index-\d{4}\.jsonl$/.test(f)).sort().reverse(); } catch { return { rows: [], capped: false, missing: !fs.existsSync(dir()) }; }
  const seen = new Map();
  for (const f of files) {
    let text = ''; try { text = fs.readFileSync(path.join(dir(), f), 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) { if (!line) continue; let r; try { r = JSON.parse(line); } catch { continue; } if (allow(r) && matches(r, toks)) seen.set(r.id, r); }
    if (seen.size >= CAP * 2) break;
  }
  const all = [...seen.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return { rows: all.slice(0, CAP).map(({ x, ...r }) => ({ ...r, archived: true })), capped: all.length > CAP };
}
module.exports = { dir, keepDays, cutoff, put, get, filesDir, threadOfMail, bodyHtml, search };
