// Attachments that arrive WITHOUT a file extension (Oracle Reports / ERP mails send "PO10574" or "900556321" as a plain
// name with a generic type) are real PDFs. Look at the bytes, then give the file its proper name (.pdf) and type
// (application/pdf) so it shows as a PDF chip, previews in the viewer, and downloads / opens as a PDF file.
const fs = require('fs');

const BY_TYPE = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'text/csv': 'csv' };
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', csv: 'text/csv', txt: 'text/plain' };
const GENERIC = /^(application\/(octet-stream|x-download|download|binary|force-download|unknown)|binary\/octet-stream|)$/;

const extOf = n => (String(n || '').match(/\.([A-Za-z][A-Za-z0-9]{0,4})$/) || [])[1] || '';

// what the first bytes really are
function sniff(b) {
  if (!b || b.length < 5) return '';
  const h = b.toString('latin1', 0, Math.min(b.length, 1024));
  if (h.includes('%PDF-')) return 'pdf'; // some PDFs have a few junk bytes before the header
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47) return 'png';
  if (h.startsWith('GIF8')) return 'gif';
  if (h.startsWith('RIFF') && h.slice(8, 12) === 'WEBP') return 'webp';
  return '';
}

// -> { name, type } with the extension and type the bytes call for. Files that already have a sensible name are left alone.
function fix(name, type, buf) {
  if (name === 'inline-image') return { name, type }; // pictures inside the mail body keep their marker name
  name = String(name || '').trim(); type = String(type || '').split(';')[0].trim().toLowerCase();
  let ext = extOf(name).toLowerCase();
  const real = sniff(buf), typeExt = BY_TYPE[type] || '';
  const want = real || (ext ? '' : typeExt); // the bytes win; the declared type is only used when there is no extension at all
  if (want && (!ext || (real && ext !== real && /^(bin|dat|tmp|prn|file|download|octet|stream)$/.test(ext) ))) {
    name = (ext ? name.slice(0, -(ext.length + 1)) : name) || 'document'; name = name.replace(/[.\s]+$/, '') + '.' + want; ext = want;
  } else if (!name) { name = 'file'; if (want) { name += '.' + want; ext = want; } }
  if (real && (GENERIC.test(type) || type === 'text/plain' || type === 'application/pdf' || type.startsWith('image/'))) type = MIME[real];
  else if (!type || GENERIC.test(type)) type = MIME[ext.toLowerCase()] || type || 'application/octet-stream';
  return { name, type };
}

// same, for a file already stored on disk (reads only the first bytes)
function fixFile(name, type, p) {
  if (name === 'inline-image') return { name, type };
  try { const fd = fs.openSync(p, 'r'), b = Buffer.alloc(1024), n = fs.readSync(fd, b, 0, 1024, 0); fs.closeSync(fd); return fix(name, type, b.subarray(0, n)); }
  catch { return { name, type }; }
}
module.exports = { fix, fixFile, sniff, extOf, MIME };
