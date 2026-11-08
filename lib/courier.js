// Courier tracking links: the sheet says which courier carries the parcel and the CN number; this builds the address of that
// courier's own tracking page with the CN filled in, so the "Track order" button opens the parcel directly.
//
// Every courier is a name pattern + an address template ({cn} is replaced by the CN number). The addresses can be changed or
// extended without touching code: Settings -> "Courier tracking links" (one per line:  name = https://…{cn}). Those lines win.
const getStore = () => require('./store'); // loaded lazily: store.js itself needs this file for its default text

const COURIERS = [
  // key (also the word used in Settings), pattern that recognises the name written in the sheet, template
  ['tcs',        /\btcs\b|tcs\s*express/i,                                  'https://www.tcsexpress.com/track/{cn}'],
  ['leopards',   /leopard|\blcs\b/i,                                        'https://www.leopardscourier.com/tracking?cn_number={cn}'],
  ['m&p',        /\bm\s*(&|and|n)\s*p\b|\bmnp\b|muller|phipps|mulphi/i,     'https://www.mulphilog.com/track?cn={cn}'],
  ['postex',     /post\s*-?ex/i,                                            'https://postex.pk/tracking?cn={cn}'],
  ['trax',       /\btrax\b/i,                                               'https://trax.pk/tracking/?tracking_number={cn}'],
  ['bluex',      /blue\s*-?\s*ex/i,                                         'https://www.blue-ex.com/tracking?trackno={cn}'],
  ['callcourier',/call\s*courier/i,                                         'https://callcourier.com.pk/tracking/?tracking_number={cn}'],
  ['fedex',      /fed\s*-?\s*ex/i,                                          'https://www.fedex.com/fedextrack/?trknbr={cn}'],
  ['dhl',        /\bdhl\b/i,                                                'https://www.dhl.com/pk-en/home/tracking/tracking-express.html?submit=1&tracking-id={cn}'],
  ['ups',        /\bups\b|united parcel/i,                                  'https://www.ups.com/track?tracknum={cn}'],
  ['aramex',     /aramex/i,                                                 'https://www.aramex.com/track/results?ShipmentNumber={cn}'],
  ['pakistan post', /pak(istan)?\s*post|\bpost\s*office\b|\bems\b|\bups\s*pk\b/i, 'https://ep.gov.pk/track.asp'],
];

const DEFAULT_TEXT = COURIERS.map(([k, , t]) => `${k} = ${t}`).join('\n');
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// the lines typed in Settings: "name = https://…{cn}"
function overrides() {
  const txt = (getStore().db && getStore().db.settings && getStore().db.settings.courierLinks) || '';
  const out = [];
  for (const line of String(txt).split(/\r?\n/)) {
    const i = line.indexOf('='); if (i < 1) continue;
    const key = norm(line.slice(0, i)), url = line.slice(i + 1).trim();
    if (key && /^https?:\/\//i.test(url)) out.push([key, url]);
  }
  return out;
}
const fill = (tpl, cn) => tpl.includes('{cn}') ? tpl.replace(/\{cn\}/g, encodeURIComponent(cn)) : tpl;
const cleanCn = cn => String(cn || '').trim().replace(/\s+/g, '');

// The tracking address for an order (needs a courier name and a CN number), or '' when the courier is unknown.
function trackUrl(o) {
  const cn = cleanCn(o && o.cn), name = norm(o && o.courier);
  if (!name || !cn || !/\d/.test(cn)) return ''; // "SELF" or an empty CN cannot be tracked
  for (const [key, url] of overrides()) if (name.includes(key)) return fill(url, cn);
  for (const [, re, tpl] of COURIERS) if (re.test(o.courier)) return fill(tpl, cn);
  return '';
}
module.exports = { trackUrl, DEFAULT_TEXT, COURIERS };
