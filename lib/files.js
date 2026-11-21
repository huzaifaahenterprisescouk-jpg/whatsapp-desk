// Downloads the file behind a link column (a delivery picture, a PDF ...) so it can be sent to the customer
// as a real WhatsApp attachment that saves to the phone. Uses the Microsoft sign-in when there is one (private
// OneDrive / SharePoint links), otherwise the plain link. Never throws: returns null when the file cannot be had.
const ms = require('./msgraph');

const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: '*/*' };
const MAX = 15 * 1024 * 1024;

// what the bytes really are (a sign-in page is HTML and must never be sent as a "picture")
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.readUInt32BE(0) === 0x89504e47) return { mime: 'image/png', ext: 'png' };
  if (b.toString('latin1', 0, 4) === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (b.toString('latin1', 0, 4) === '%PDF') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
const withDl = u => { try { const d = new URL(u); d.searchParams.set('download', '1'); return d.toString(); } catch { return u; } };

async function fetchFile(link) {
  const tries = [];
  if (ms.signedIn()) tries.push(async () => ms.downloadShare(link, b => b.length > 0));
  tries.push(async () => { const r = await fetch(withDl(link), { headers: H, redirect: 'follow', signal: AbortSignal.timeout(25000) }); if (!r.ok) throw new Error('error ' + r.status); return Buffer.from(await r.arrayBuffer()); });
  if (!/download=1/.test(link)) tries.push(async () => { const r = await fetch(link, { headers: H, redirect: 'follow', signal: AbortSignal.timeout(25000) }); if (!r.ok) throw new Error('error ' + r.status); return Buffer.from(await r.arrayBuffer()); });
  for (const t of tries) {
    try { const buf = await t(); const kind = buf.length <= MAX && sniff(buf); if (kind) return { buf, ...kind }; } catch { /* try the next way */ }
  }
  return null;
}
module.exports = { fetchFile, sniff };
