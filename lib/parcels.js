// Parcels: one DC can leave in more than one parcel, e.g. the CN cell says  "KI2016227262, 9147017096"  (one LCS parcel and one TCS
// parcel, sometimes on two different dates). This turns that one cell into a list of parcels - each with its own CN, courier,
// dispatch date and tracking address - so the DC stays ONE DC (counts do not change) but every parcel is shown and tracked on its own.
//
// Which courier a CN belongs to is decided in this order:
//   1. the Courier column, when it names as many couriers as there are CNs ("LCS, TCS": first name = first CN, ...)
//   2. the CN number pattern rules (Settings -> "CN number -> courier"; the first line that matches wins)
//   3. a courier named in the Courier column that no CN has taken yet
const courier = require('./courier');
const getStore = () => require('./store');   // loaded lazily: store.js needs this file for its default settings
const orders = () => require('./orders');    // loaded lazily: orders.js needs this file

// courier = regular expression for the CN number (one per line, # = comment)
const DEFAULT_RULES = [
  '# CN number pattern -> courier.  One per line:  courier = pattern  (the first line that matches decides).',
  '# Used when the Courier column does not say which courier each CN belongs to.',
  'leopards = ^[A-Za-z]{2}\\d{8,}$',
  'leopards = ^(20|40)\\d{8}$',
  'tcs = ^9\\d{9,}$',
].join('\n');

const LABEL = { leopards: 'LCS', tcs: 'TCS', 'm&p': 'M&P', postex: 'PostEx', trax: 'Trax', bluex: 'BlueEx', callcourier: 'Call Courier', fedex: 'FedEx', dhl: 'DHL', ups: 'UPS', aramex: 'Aramex', 'pakistan post': 'Pakistan Post' };
const labelOf = key => LABEL[key] || String(key || '').toUpperCase();
// "Leopards", "LCS", "TCS Express" ... -> the courier key used by courier.js, or ''
const keyOfName = name => { const n = String(name || '').trim(); if (!n) return ''; for (const [k, re] of courier.COURIERS) if (re.test(n)) return k; return ''; };

let rTxt = null, rOut = [];
function rules() {
  const st = getStore(), txt = (st.db && st.db.settings && st.db.settings.cnRules) || DEFAULT_RULES;
  if (txt === rTxt) return rOut;
  const out = [];
  for (const line of String(txt).split(/\r?\n/)) {
    const t = line.trim(); if (!t || t[0] === '#') continue;
    const i = t.indexOf('='); if (i < 1) continue;
    const name = t.slice(0, i).trim(), pat = t.slice(i + 1).trim(); if (!name || !pat) continue;
    try { out.push([keyOfName(name) || name.toLowerCase(), new RegExp(pat, 'i')]); } catch { /* a bad pattern is ignored */ }
  }
  rTxt = txt; rOut = out; return out;
}
const ruleKey = cn => { for (const [k, re] of rules()) if (re.test(cn)) return k; return ''; };

// the CN numbers written in a cell: "KI2016227262, 9147017096" / on two lines / "A123456 B654321"
function splitCns(v) {
  const t = String(v == null ? '' : v).trim(); if (!t) return [];
  let parts = t.split(/[\n\r,;|&+/]+|\s+and\s+/i).map(x => x.trim()).filter(Boolean);
  parts = parts.flatMap(p => { const w = p.split(/\s+/); return w.length > 1 && w.every(x => /^[A-Za-z]{0,3}\d{6,}$/.test(x)) ? w : [p]; });
  return parts.filter(p => /\d/.test(p) && !/^(self|cancel)/i.test(p));
}
const splitNames = v => String(v == null ? '' : v).split(/[\n\r,;|/+]+|\s+and\s+|\s+&\s+/i).map(x => x.trim()).filter(Boolean);

// the dispatch date text of an order: the sheet's "Dispatch date" column, else "Last updated"
function dispatchRaw(o) {
  for (const c of [...(o.extra || []), ...(o.mapped || [])]) if (/dispatch/i.test(String(c[0])) && /date|day|dt/i.test(String(c[0])) && String(c[1] || '').trim()) return String(c[1]).trim();
  return orders().isUrl(o.updated) ? '' : String(o.updated || '').trim();
}
// every date written in the cell: "17/11/2026, 18/11/2026" -> two entries [{ raw, day }]
function datesOf(raw) {
  const t = String(raw || '').trim(); if (!t) return [];
  const pd = orders().parseDay, one = x => ({ raw: x, day: pd(x) });
  const tok = t.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-/. ]?[A-Za-z]{3,9}[-/., ]*\d{2,4}/g) || [];
  if (tok.length >= 2) return tok.map(one);
  const byLine = t.split(/[\n\r;|]+/).map(x => x.trim()).filter(Boolean);
  if (byLine.length >= 2) return byLine.map(one);
  return [one(t)];
}
// every dispatch day (YYYY-MM-DD) of the order, one per parcel date
const dispatchDays = o => datesOf(dispatchRaw(o)).map(d => d.day).filter(Boolean);

function parcelsOf(o) {
  const cns = splitCns(o && o.cn); if (!cns.length) return [];
  const names = splitNames(o.courier).map(raw => ({ raw, key: keyOfName(raw) || raw.toLowerCase() }));
  const dates = datesOf(dispatchRaw(o));
  const out = cns.map((cn, i) => ({ cn, c: names.length === cns.length ? names[i] : null }));
  for (const p of out) if (!p.c) { const k = ruleKey(p.cn); if (k) p.c = { raw: labelOf(k), key: k }; }
  const taken = new Set(out.filter(p => p.c).map(p => p.c.key)), rest = names.filter(n => !taken.has(n.key));
  for (const p of out) if (!p.c && rest.length) p.c = rest.shift();
  if (names.length === 1) for (const p of out) if (!p.c) p.c = names[0];
  return out.map((p, i) => {
    const d = dates.length === cns.length ? dates[i] : dates.length === 1 ? dates[0] : null, key = p.c ? p.c.key : '', lab = p.c ? (LABEL[key] || p.c.raw) : '';
    return { n: i + 1, cn: p.cn, key, courier: lab, day: d ? d.day : '', date: d ? d.raw : '', trackUrl: p.c ? courier.trackUrl({ cn: p.cn, courier: (lab + ' ' + key).trim() }) : '' };
  });
}
module.exports = { parcelsOf, splitCns, dispatchDays, dispatchRaw, datesOf, DEFAULT_RULES, labelOf };
