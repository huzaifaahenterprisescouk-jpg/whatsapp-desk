// Printable "tracking receipt": a page that looks like a courier's tracking screen (progress steps, shipment detail,
// shipment information timeline and a Delivered section) for ANY courier, ready to print or save as PDF.
// The data comes from the order (CN, courier, status ...) plus the tracking events the team pasted from the courier's site.
const store = require('./store');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cnKey = cn => String(cn || '').toLowerCase().replace(/\s+/g, '');

// ---- events typed / pasted by the team, kept per CN so they are there next time ----
function getEvents(cn) { const k = cnKey(cn); return k && store.db.trackEvents && store.db.trackEvents[k] ? store.db.trackEvents[k] : { text: '' }; }
function saveEvents(cn, text, by) {
  const k = cnKey(cn); if (!k) return;
  store.db.trackEvents = store.db.trackEvents || {};
  const t = String(text || '').slice(0, 20000);
  if (!t.trim()) delete store.db.trackEvents[k]; else store.db.trackEvents[k] = { text: t, by: by || '', at: Date.now() };
  store.save();
}
// one line = "date time | what happened"  (a tab or " - " also works; a line without a date is kept as text only)
function parseEvents(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    let when = '', what = line;
    const i = line.search(/\s*(\||\t)\s*/);
    if (i > 0) { when = line.slice(0, i).trim(); what = line.slice(line.slice(i).match(/^\s*(\||\t)\s*/)[0].length + i).trim(); }
    else { const m = /^(.{6,28}?\d{1,2}:\d{2}(?:\s*[ap]m)?)\s+[-–—]\s+(.+)$/i.exec(line); if (m) { when = m[1].trim(); what = m[2].trim(); } }
    out.push({ when, what, ts: when ? Date.parse(when.replace(/(\d)(st|nd|rd|th)\b/i, '$1')) : NaN });
  }
  // newest first when every line has a date we understand; otherwise keep the order as typed
  if (out.length > 1 && out.every(e => !isNaN(e.ts))) out.sort((a, b) => b.ts - a.ts);
  return out;
}
// split "18 November 2026, 02:19" into the date and the time
function splitWhen(w) {
  const m = /^(.*?)[,\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)$/i.exec(w || ''); return m ? [m[1].replace(/[,\s]+$/, ''), m[2]] : [w || '', ''];
}

// ---- which step of the journey a piece of text means ----
const STEPS = ['Shipment picked', 'Dispatched', 'Arrived', 'Out for Delivery', 'Delivered'];
function stepOf(t) {
  t = String(t || '').toLowerCase(); if (!t.trim()) return 0;
  if (/undeliver|not deliver|failed|attempt|refus|return|cancel/.test(t)) return /out for deliver/.test(t) ? 4 : 3;
  if (/\bdelivered\b|delivery completed|\bpod\b|received by|handed over to (the )?consignee/.test(t)) return 5;
  if (/out for deliver|\bofd\b|with (the )?(courier|rider|delivery)|delivery (run|boy|rider)/.test(t)) return 4;
  if (/arriv|reached|received at|at (the )?(destination|hub|facility)|in(\s|-)?bound/.test(t)) return 3;
  if (/dispatch|shipped|forwarded|in transit|departed|left (the )?(origin|hub|facility)|booked|handed to courier/.test(t)) return 2;
  return 1;
}

function build(d) {
  d = d || {};
  const events = parseEvents(d.events);
  let step = Math.max(stepOf(d.status), ...events.map(e => stepOf(e.what)), d.deliveredOn || d.receivedBy ? 5 : 0, 1);
  const delivered = step === 5;
  const last = events[0] || null;
  const cur = (d.status || '').trim() || (last && last.what) || 'Booked';
  const [curDate, curTime] = splitWhen(last ? last.when : d.updated || '');
  return { ...d, events, step, delivered, cur, curWhen: [curDate, curTime].filter(Boolean).join(', ') };
}

const CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{font:14px/1.45 Roboto,"Segoe UI",Arial,sans-serif;color:#222;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{height:6px;background:#f5c400}
.bar{display:flex;gap:10px;justify-content:center;padding:14px;background:#fafafa;border-bottom:1px solid #eee}
.bar button{font:600 14px/1 inherit;border:0;background:#f5c400;color:#222;padding:11px 22px;border-radius:6px;cursor:pointer}
.bar button.g{background:#fff;border:1px solid #ccc}
.wrap{max-width:1100px;margin:0 auto;padding:22px 18px 40px}
h1{font-size:18px;font-weight:400;margin:6px 0 10px}
.search{display:flex;max-width:760px;margin-bottom:26px}
.search .in{flex:1;border:1px solid #ddd;border-right:0;padding:16px 20px;color:#444;border-radius:3px 0 0 3px;font-size:15px;letter-spacing:.2px}
.search .go{background:#f5c400;padding:16px 18px;font-size:15px;border-radius:0 3px 3px 0}
.card{border:1px solid #e6e6e6;padding:22px}
.ban{background:linear-gradient(90deg,#585858,#8c7a35 55%,#f5c400);color:#fff;text-align:center;font-weight:700;padding:11px;font-size:15px}
.steps{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:6px 0;padding:16px 4px 20px}
.st{display:flex;align-items:center;gap:7px;font-size:15px}
.st i{width:28px;height:28px;border-radius:50%;background:#f5c400;color:#fff;font:700 13px/28px Arial;text-align:center;font-style:normal}
.st.ok i{background:#2aa876}.st.now{font-weight:700}
.ln{width:40px;height:2px;background:#f5c400;margin:0 18px}.ln.ok{background:#2aa876}
.sec{border:1px solid #e3e3e3;margin-bottom:34px;break-inside:avoid}
.sh{background:#505050;color:#fff;font-weight:700;padding:11px 12px;font-size:15px}
.sh.or{background:linear-gradient(90deg,#f9a11b,#ffcb05)}.sh.gr{background:linear-gradient(90deg,#1e8f66,#37b988)}.sh.mu{background:#8a8a8a}
.sh.c{text-align:center}
.r{display:flex;padding:11px 12px;gap:10px}.r:nth-child(even){background:#f2f2f2}
.r .k{font-weight:700;width:190px;flex:none}.r .v{flex:1;min-width:0;word-break:break-word}
.two{display:grid;grid-template-columns:1fr 1fr}.two .r{background:none!important}.two .rw{display:contents}
.t2{display:grid;grid-template-columns:1fr 1fr}
.t2 .c{display:flex;padding:11px 12px;gap:10px}.t2 .c .k{font-weight:700;width:190px;flex:none}.t2 .c .v{flex:1;word-break:break-word}
.t2 .a{background:#f2f2f2}
.tl{padding:14px 0 6px}
.ev{display:grid;grid-template-columns:32% 56px 1fr;align-items:start;min-height:56px}
.ev .w{text-align:right;padding:8px 6px 0 0;font-weight:700;font-size:13px}.ev .w small{display:block;color:#888;font-weight:700}
.ev .m{position:relative;height:100%;min-height:56px}
.ev .m:before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;background:#f5c400;margin-left:-1px}
.ev .m b{position:absolute;left:50%;top:8px;width:32px;height:32px;margin-left:-16px;border-radius:50%;background:#f5c400}
.ev .m b.d{background:#2aa876}
.ev .x{padding:10px 8px 0 4px;font-size:13px}
.dv{padding:18px 16px;display:flex;gap:16px;align-items:center}
.dv .big{width:54px;height:54px;border-radius:50%;background:#2aa876;color:#fff;font:700 28px/54px Arial;text-align:center;flex:none}
.dv .big.n{background:#bbb}
.dv h3{margin:0 0 2px;font-size:17px}.dv p{margin:0;color:#555}
.ft{margin-top:6px;color:#888;font-size:12px;text-align:right}
@media(max-width:700px){.t2,.two{grid-template-columns:1fr}.ev{grid-template-columns:90px 40px 1fr}.ln{margin:0 6px;width:16px}}
@page{size:A4;margin:10mm}
.note{text-align:center;padding:8px 14px;font-size:13px}.note.ok{background:#e8f6ef;color:#17694a}.note.bad{background:#fdecea;color:#9b2c22}
@media print{.bar,.note{display:none}.wrap{max-width:none;padding:0}.card{border:0;padding:0}}
`;

function render(d0, note) {
  const d = build(d0), v = x => esc(String(x || '').trim() || '-');
  const steps = STEPS.map((n, i) => `<div class="st ${i + 1 <= d.step ? 'ok' : ''} ${i + 1 === d.step ? 'now' : ''}"><i>${i + 1 <= d.step ? '&#10003;' : i + 1}</i>${esc(n)}</div>${i < STEPS.length - 1 ? `<div class="ln ${i + 2 <= d.step ? 'ok' : ''}"></div>` : ''}`).join('');
  const ev = d.events.length ? d.events : [{ when: d.curWhen, what: d.cur }];
  const tl = ev.map((e, i) => { const [dd, tt] = splitWhen(e.when); return `<div class="ev"><div class="w">${esc(dd)}${tt ? `<small>(${esc(tt)})</small>` : ''}</div><div class="m"><b class="${i === 0 && d.delivered ? 'd' : ''}"></b></div><div class="x">${esc(e.what)}</div></div>`; }).join('');
  const pair = (a, b, c, e, alt) => `<div class="c ${alt ? 'a' : ''}"><span class="k">${a}</span><span class="v">${b}</span></div><div class="c ${alt ? 'a' : ''}"><span class="k">${c}</span><span class="v">${e}</span></div>`;
  const rows = [
    ['Origin :', v(d.origin), 'Destination :', v(d.destination)],
    ['Shipper :', v(d.shipper), 'Consignee :', v(d.consignee)],
    ['Reference No. :', v(d.ref), 'Booking Date :', v(d.booking)],
    ['Pieces :', v(d.pieces), 'Courier :', v(d.courier)],
  ].map((r, i) => pair(...r, i % 2 === 1)).join('');
  const delivery = d.delivered
    ? `<div class="sec"><div class="sh gr">Delivery Detail</div><div class="dv"><div class="big">&#10003;</div><div><h3>Shipment Delivered</h3><p>This shipment has been delivered to the consignee.</p></div></div>
       <div class="t2">${pair('Delivered On :', v(d.deliveredOn || d.curWhen), 'Received By :', v(d.receivedBy), false)}${pair('Delivery Status :', 'Delivered', 'Consignee :', v(d.consignee), true)}</div></div>`
    : `<div class="sec"><div class="sh mu">Delivery Detail</div><div class="dv"><div class="big n">&hellip;</div><div><h3>Not delivered yet</h3><p>Current status: ${esc(d.cur)}. The delivery details appear here once the shipment is delivered.</p></div></div></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tracking ${esc(d.cn)}</title><style>${CSS}</style></head><body>
<div class="top"></div><div class="bar"><button onclick="print()">Print / Save as PDF</button><button class="g" onclick="location.reload()">Refresh live tracking</button><button class="g" onclick="close()">Close</button></div>${note ? `<div class="note ${note.ok ? 'ok' : 'bad'}">${esc(note.text)}</div>` : ''}
<div class="wrap"><h1>Track Your Shipment</h1><div class="search"><div class="in">${esc(d.cn)}</div><div class="go">Track Shipment</div></div>
<div class="card"><div class="ban">Consignment No. : ${esc(d.cn)}${d.courier ? ' &nbsp;|&nbsp; ' + esc(d.courier) : ''}</div>
<div class="steps">${steps}</div>
<div class="sec"><div class="sh c">${esc(d.cur)}</div><div class="r"><span class="k">Current Status/Reason :</span><span class="v">${esc(d.cur)}</span><span class="k" style="width:90px">Dated:</span><span class="v" style="flex:none;width:200px">${v(d.curWhen)}</span></div></div>
<div class="sec"><div class="sh or">Shipment Detail</div><div class="t2">${rows}</div></div>
<div class="sec"><div class="sh">Shipment Information</div><div class="tl">${tl}</div></div>
${delivery}
<div class="ft">Printed ${esc(new Date().toLocaleString('en-GB'))}</div></div></div></body></html>`;
}

module.exports = { render, build, getEvents, saveEvents, parseEvents, stepOf, cnKey };
