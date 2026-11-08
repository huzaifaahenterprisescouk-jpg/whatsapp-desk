// Dependency-free IMAP reader (TLS) + MIME parser. Read-only: it never deletes or changes anything in Gmail.
const tls = require('tls');


// ---------- Gmail helpers ----------
const u7d = s => s.replace(/&([^-]*)-/g, (_, b) => b === '' ? '&' : Buffer.from(b.replace(/,/g, '/'), 'base64').swap16().toString('utf16le'));
const u7e = s => s.replace(/&/g, '&-').replace(/[^\x20-\x7e]+/g, m => '&' + Buffer.from(m, 'utf16le').swap16().toString('base64').replace(/=+$/, '').replace(/\//g, ',') + '-');
function labelsOf(line) {
  const i = line.indexOf('X-GM-LABELS ('); if (i < 0) return [];
  let p = i + 13; const out = [];
  while (p < line.length && line[p] !== ')') {
    if (line[p] === ' ') { p++; continue; }
    let t = '';
    if (line[p] === '"') { p++; while (p < line.length && line[p] !== '"') { if (line[p] === '\\') p++; t += line[p++]; } p++; }
    else while (p < line.length && line[p] !== ' ' && line[p] !== ')') t += line[p++];
    out.push(u7d(t));
  }
  return out;
}
const qlabel = l => '"' + u7e(l).replace(/(["\\])/g, '\\$1') + '"';

// ---------- IMAP ----------
function connect({ host, port = 993, user, pass }) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0), n = 0, waiter = null, dead = null;
    const sock = tls.connect({ host, port, servername: host }, () => {});
    const timer = setTimeout(() => fail(new Error('The mail server took too long to answer.')), 60000);
    const fail = e => { dead = dead || e; clearTimeout(timer); try { sock.destroy(); } catch {} if (waiter) waiter(); reject(e); };
    sock.on('data', d => { buf = Buffer.concat([buf, d]); if (waiter) waiter(); });
    sock.on('error', fail); sock.on('close', () => fail(new Error('The mail server closed the connection.')));
    // find end of the tagged reply, skipping over {n} literals
    const scan = tag => {
      let pos = 0;
      while (pos < buf.length) {
        const eol = buf.indexOf('\r\n', pos); if (eol < 0) return -1;
        const line = buf.toString('latin1', pos, eol);
        if (tag === null ? /^\* /.test(line) || /^\+ /.test(line) : line.startsWith(tag + ' ')) return tag === null ? eol + 2 : eol + 2;
        const lit = /\{(\d+)\}$/.exec(line);
        pos = lit ? eol + 2 + +lit[1] : eol + 2;
        if (lit && pos > buf.length) return -1;
      }
      return -1;
    };
    const wait = tag => new Promise((ok, no) => {
      const check = () => {
        if (dead) return no(dead);
        const end = scan(tag); if (end < 0) { waiter = check; return; }
        waiter = null; const out = buf.subarray(0, end); buf = buf.subarray(end); ok(out);
      };
      check();
    });
    const q = s => '"' + String(s).replace(/(["\\])/g, '\\$1') + '"';
    const run = async cmd => {
      const tag = 'A' + (++n); sock.write(`${tag} ${cmd}\r\n`);
      const out = await wait(tag); const k = out.lastIndexOf('\r\n', out.length - 3), last = out.toString('latin1', k < 0 ? 0 : k + 2).trim();
      if (!new RegExp('^' + tag + ' OK', 'i').test(last)) throw new Error('Mail server said: ' + last.replace(/^A\d+ /, ''));
      return out;
    };
    sock.once('secureConnect', async () => {
      try {
        await wait(null); // greeting
        await run(`LOGIN ${q(user)} ${q(pass)}`);
        clearTimeout(timer);
        resolve({
          async list() { const o = (await run('LIST "" "*"')).toString('latin1'); return [...o.matchAll(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"((?:[^"\\]|\\.)*)"|(\S+))/gm)].map(m => ({ flags: m[1], name: m[2] ?? m[3], label: u7d((m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1')) })); },
          create(name) { return run(`CREATE ${qlabel(name)}`); }, // new Gmail label
          remove(name) { return run(`DELETE ${qlabel(name)}`); }, // delete a Gmail label (the mails stay in All Mail)
          async select(name = 'INBOX') { const o = (await run(`SELECT ${q(name)}`)).toString('latin1'); const m = /UIDVALIDITY (\d+)/.exec(o); return { uidv: m ? +m[1] : 0 }; },
          async search(criteria) { const o = (await run('UID SEARCH ' + criteria)).toString('latin1'); const m = /\* SEARCH([^\r\n]*)/.exec(o); return m ? m[1].trim().split(/\s+/).filter(Boolean).map(Number) : []; },
          // flags (+ Gmail labels / thread id) for a UID or range such as "120:*"
          async meta(range, gmail) {
            const o = (await run(`UID FETCH ${range} (FLAGS${gmail ? ' X-GM-LABELS X-GM-THRID' : ''})`)).toString('latin1'), out = [];
            for (const line of o.split('\r\n')) {
              if (!/^\* \d+ FETCH/.test(line)) continue; const uid = /UID (\d+)/.exec(line); if (!uid) continue;
              const fl = /FLAGS \(([^)]*)\)/.exec(line), th = /X-GM-THRID (\d+)/.exec(line);
              out.push({ uid: +uid[1], flags: fl ? fl[1] : '', thrid: th ? th[1] : '', labels: labelsOf(line) });
            }
            return out;
          },
          // change flags/labels on Gmail itself, e.g. store([5,6], '+FLAGS', '\\Seen')
          store(uids, item, vals) { return run(`UID STORE ${uids.join(',')} ${item} (${vals})`); },
          async fetch(uid) {
            const o = await run(`UID FETCH ${uid} (BODY.PEEK[])`);
            const head = o.toString('latin1', 0, 200), m = /\{(\d+)\}\r\n/.exec(head); if (!m) return null;
            const s = m.index + m[0].length; return o.subarray(s, s + +m[1]);
          },
          close() { try { sock.write(`A${++n} LOGOUT\r\n`); sock.end(); } catch {} dead = dead || new Error('closed'); },
        });
      } catch (e) { fail(e.message.startsWith('Mail server') ? new Error(e.message.replace(/\(.*$/, '').trim() + ' — for Gmail use an App password, and make sure IMAP is allowed.') : e); }
    });
  });
}

// ---------- MIME ----------
const dec = (buf, cs) => { try { return new TextDecoder((cs || 'utf-8').toLowerCase().replace(/^"|"$/g, '')).decode(buf); } catch { return buf.toString('utf8'); } };
function qp(s) { return Buffer.from(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'); }
function decodeWords(s) {
  return String(s || '').replace(/(=\?[^?]+\?[bq]\?[^?]*\?=)\s+(?==\?)/gi, '$1').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, cs, e, t) =>
    dec(e.toLowerCase() === 'b' ? Buffer.from(t, 'base64') : qp(t.replace(/_/g, ' ')), cs));
}
function parseHeaders(raw) {
  const h = {}; const lines = raw.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
  for (const l of lines) { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).toLowerCase(); if (!(k in h)) h[k] = l.slice(i + 1).trim(); } }
  return h;
}
const param = (v, name) => { const m = new RegExp(name + '\\*?=\\s*(?:"([^"]*)"|([^;\\s]+))', 'i').exec(v || ''); return m ? (m[1] ?? m[2]) : ''; };
function splitPart(buf) {
  const i = buf.indexOf('\r\n\r\n'), j = buf.indexOf('\n\n'); const k = i >= 0 && (j < 0 || i < j) ? [i, 4] : [j, 2];
  if (k[0] < 0) return [parseHeaders(buf.toString('latin1')), Buffer.alloc(0)];
  return [parseHeaders(buf.toString('latin1', 0, k[0])), buf.subarray(k[0] + k[1])];
}
function walk(buf, out) {
  const [h, body] = splitPart(buf); const ct = (h['content-type'] || 'text/plain').toLowerCase(), type = ct.split(';')[0].trim();
  if (type.startsWith('multipart/')) {
    const b = param(h['content-type'], 'boundary'); if (!b) return;
    const parts = body.toString('latin1').split('--' + b); parts.shift();
    for (const p of parts) { if (p.startsWith('--')) break; walk(Buffer.from(p.replace(/^\r?\n/, ''), 'latin1'), out); }
    return;
  }
  const cte = (h['content-transfer-encoding'] || '').toLowerCase(), txt = body.toString('latin1');
  const data = cte === 'base64' ? Buffer.from(txt.replace(/\s/g, ''), 'base64') : cte === 'quoted-printable' ? qp(txt) : Buffer.from(body);
  const disp = (h['content-disposition'] || '').toLowerCase(), name = decodeWords(param(h['content-disposition'], 'filename') || param(h['content-type'], 'name'));
  if ((type === 'text/plain' || type === 'text/html') && !disp.startsWith('attachment') && !name) out[type === 'text/plain' ? 'text' : 'html'] = (out[type === 'text/plain' ? 'text' : 'html'] || '') + dec(data, param(h['content-type'], 'charset'));
  else if (name || disp.startsWith('attachment') || (type.startsWith('image/') && h['content-id']))
    out.files.push({ name: name || 'inline-image', type, size: data.length, data, cid: (h['content-id'] || '').replace(/^<|>$/g, '') });
}
const htmlToText = h => h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
const addrs = v => [...String(decodeWords(v || '')).matchAll(/(?:"?([^"<>,]*?)"?\s*)<([^<>\s]+@[^<>\s]+)>|([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+\.\w+)/g)].map(m => ({ name: (m[1] || '').trim(), email: (m[2] || m[3]).toLowerCase() }));

function parseMail(raw) {
  const [h] = splitPart(raw), out = { files: [] }; walk(raw, out);
  const from = addrs(h.from)[0] || { name: '', email: '' };
  return {
    messageId: (h['message-id'] || '').trim(), inReplyTo: (h['in-reply-to'] || '').trim(), references: (h.references || '').trim(),
    subject: decodeWords(h.subject || '(no subject)'), from, to: addrs(h.to), cc: addrs(h.cc), replyTo: (addrs(h['reply-to'])[0] || from).email,
    date: Date.parse(h.date) || Date.now(), text: (out.text || (out.html ? htmlToText(out.html) : '')).replace(/\r\n/g, '\n').trim(), html: out.html || '', files: out.files,
  };
}
module.exports = { connect, parseMail, qlabel };
