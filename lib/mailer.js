// Dependency-free SMTP client (implicit TLS, STARTTLS or plain) with attachments.
const net = require('net'), tls = require('tls'), crypto = require('crypto');

const b64 = (buf, wrap = true) => { const s = Buffer.from(buf).toString('base64'); return wrap ? s.replace(/(.{76})/g, '$1\r\n') : s; };
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s, false)}?=`;
const crlf = s => String(s).replace(/\r?\n/g, '\r\n');

function buildMessage({ from, fromName, messageId, to, cc = [], headers = {}, subject, text, html, attachments = [], inline = [] }) {
  const id = crypto.randomBytes(8).toString('hex'), dom = (from.split('@')[1] || 'localhost');
  const mixed = `=_m_${id}`, alt = `=_a_${id}`;
  let m = `From: ${fromName ? encWord(fromName) + ' ' : ''}<${from}>\r\nTo: ${to.join(', ')}\r\n${cc.length ? `Cc: ${cc.join(', ')}\r\n` : ''}${Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('')}Subject: ${encWord(subject)}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: ${messageId || `<${id}@${dom}>`}\r\nMIME-Version: 1.0\r\n`;
  m += `Content-Type: multipart/mixed; boundary="${mixed}"\r\n\r\n--${mixed}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n`;
  m += `--${alt}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(text || '')}\r\n`;
  if (inline.length) { // html + inline pictures (e.g. a GIF in the signature) travel together as multipart/related
    const rel = `=_r_${id}`;
    m += `--${alt}\r\nContent-Type: multipart/related; boundary="${rel}"\r\n\r\n--${rel}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html || text || '')}\r\n`;
    for (const x of inline) m += `--${rel}\r\nContent-Type: ${x.type}; name="${x.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${x.cid}>\r\nContent-Disposition: inline; filename="${x.filename}"\r\n\r\n${b64(x.content)}\r\n`;
    m += `--${rel}--\r\n--${alt}--\r\n`;
  } else m += `--${alt}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html || text || '')}\r\n--${alt}--\r\n`;
  for (const a of attachments)
    m += `--${mixed}\r\nContent-Type: ${a.type}; name="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.filename}"\r\n\r\n${b64(a.content)}\r\n`;
  return m + `--${mixed}--\r\n`;
}

function send(cfg, msg) {
  return new Promise((resolve, reject) => {
    const mode = cfg.security || (+cfg.port === 465 ? 'ssl' : +cfg.port === 25 ? 'none' : 'starttls');
    let sock, buf = '', waiter = null, done = false;
    const fail = e => { if (done) return; done = true; clearTimeout(timer); try { sock && sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('The mail server took too long to answer.')), 45000);
    const feed = () => { if (!waiter) return; const m = buf.match(/^(?:\d{3}-[^\n]*\n)*\d{3}[ ][^\n]*\n/); if (!m) return; buf = buf.slice(m[0].length); const w = waiter; waiter = null; w(m[0].replace(/\r/g, '')); };
    const attach = s => { sock = s; s.on('data', d => { buf += d.toString('utf8'); feed(); }); s.on('error', fail); s.on('close', () => { if (!done) fail(new Error('The mail server closed the connection.')); }); };
    const read = () => new Promise(r => { waiter = r; feed(); });
    const cmd = async (line, ok) => {
      if (line !== null) sock.write(line + '\r\n');
      const r = await read(); const code = +r.slice(0, 3);
      if (!ok.includes(code)) throw new Error(`Mail server said: ${r.trim().split('\n').pop().slice(4) || r.trim()} (${code})`);
      return r;
    };
    (async () => {
      const opts = { host: cfg.host, port: +cfg.port };
      if (mode === 'ssl') attach(await new Promise((ok, no) => { const s = tls.connect({ ...opts, servername: cfg.host }, () => ok(s)); s.once('error', no); }));
      else attach(await new Promise((ok, no) => { const s = net.connect(opts, () => ok(s)); s.once('error', no); }));
      await cmd(null, [220]);
      const me = 'whatsapp-desk.local';
      let ehlo = await cmd(`EHLO ${me}`, [250]);
      if (mode === 'starttls') {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners('data'); sock.removeAllListeners('close'); sock.removeAllListeners('error'); buf = '';
        const raw = sock; attach(await new Promise((ok, no) => { const s = tls.connect({ socket: raw, servername: cfg.host }, () => ok(s)); s.once('error', no); }));
        ehlo = await cmd(`EHLO ${me}`, [250]);
      }
      if (cfg.user) {
        if (/AUTH[^\n]*PLAIN/i.test(ehlo)) await cmd('AUTH PLAIN ' + b64(`\0${cfg.user}\0${cfg.pass}`, false), [235]);
        else { await cmd('AUTH LOGIN', [334]); await cmd(b64(cfg.user, false), [334]); await cmd(b64(cfg.pass, false), [235]); }
      }
      await cmd(`MAIL FROM:<${cfg.from || cfg.user}>`, [250]);
      for (const r of [...msg.to, ...(msg.cc || []), ...(msg.bcc || [])]) await cmd(`RCPT TO:<${r}>`, [250, 251]);
      await cmd('DATA', [354]);
      const body = crlf(buildMessage({ ...msg, from: cfg.from || cfg.user, fromName: cfg.fromName })).replace(/^\./gm, '..');
      sock.write(body + '\r\n.\r\n');
      await cmd(null, [250]);
      sock.write('QUIT\r\n'); done = true; clearTimeout(timer); sock.end(); resolve();
    })().catch(fail);
  });
}
module.exports = { send, buildMessage };
