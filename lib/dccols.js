// The columns the admin picked in the DC table (Columns menu: which ones, their order, their widths) for PDF / Excel exports.
// The browser sends them as  cols=[["dcno",0],["po",120],["d:Branch",90],...]  (key, width in px, 0 = automatic).
const DCL = { dcno: 'DC', po: 'PO', pr: 'P.R', cn: 'CN', company: 'Company', customer: 'Customer', courier: 'Courier', date: 'Date', billing: 'ERP billing', status: 'Status', dispatch: 'Dispatch' };
const DL = { pending: 'Pending dispatch', dispatched: 'Dispatched', self: 'Self', other: 'Cancelled / returned' };
const DC_NO_RE = /^(d\.?\s?c\.?|delivery challan|challan)\s*(no\.?|number|#)?$/i;

function parse(raw) {
  let a; try { a = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(a)) return null;
  const out = [], seen = new Set();
  for (const it of a.slice(0, 100)) {
    const k = String(Array.isArray(it) ? it[0] : it || ''), w = Math.max(0, Math.min(800, Math.round(+(Array.isArray(it) ? it[1] : 0)) || 0));
    if (seen.has(k) || !(DCL[k] || /^d:.+/.test(k))) continue; seen.add(k);
    out.push({ key: k, label: DCL[k] || k.slice(2), width: w ? Math.max(4, Math.round(w / 7)) : 0 }); // px -> about this many characters
  }
  return out.length ? out : null;
}
function value(r, k) {
  switch (k) {
    case 'dcno': { const d = (r.sheet || r.details || []).find(x => DC_NO_RE.test(String(x[0]).trim())); return d ? d[1] : ''; }
    case 'po': return r.po || ''; case 'pr': return r.pr || ''; case 'cn': return r.cn || '';
    case 'company': return r.organization || r.company || ''; case 'customer': return r.customer || ''; case 'courier': return r.courier || '';
    case 'date': return r.day || r.updated || ''; case 'billing': return r.billed ? 'Billed in ERP' : 'Non billed';
    case 'status': return r.status || ''; case 'dispatch': return DL[r.cls] || '';
    default: { const e = (r.sheet || r.details || []).find(x => 'd:' + x[0] === k); return e ? String(e[1]) : ''; }
  }
}
module.exports = { parse, value };
