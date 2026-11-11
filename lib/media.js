// Voice notes, pictures, videos and files in chats: stored on disk (data/media), converted when needed.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const cfg = require('./config');

const DIR = () => path.join(path.dirname(cfg.dataFile), 'media');
const EXT = { 'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/amr': 'amr', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/webm': 'webm', 'application/pdf': 'pdf' };
const baseMime = m => String(m || '').split(';')[0].trim().toLowerCase();
const extOf = (mime, name) => (String(name || '').match(/\.([A-Za-z0-9]{1,6})$/) || [])[1] || EXT[baseMime(mime)] || 'bin';
function kindOf(mime) {
  const m = baseMime(mime);
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/') && m !== 'image/svg+xml') return 'image';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

let ff;
function hasFfmpeg() { if (ff === undefined) { try { ff = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0; } catch { ff = false; } } return ff; }

// Save a file; returns the small record that is stored on the chat message.
function save(buf, { mime, name, voice, secs, phone } = {}) {
  fs.mkdirSync(DIR(), { recursive: true });
  const id = Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
  const m = baseMime(mime) || 'application/octet-stream';
  const rec = { id, mime: m, kind: kindOf(m), name: String(name || `${kindOf(m)}.${extOf(m)}`).slice(0, 120), size: buf.length, voice: !!voice, secs: secs ? Math.round(+secs) : 0, phone: phone || '' };
  fs.writeFileSync(path.join(DIR(), id), buf);
  fs.writeFileSync(path.join(DIR(), id + '.json'), JSON.stringify(rec));
  return rec;
}
function meta(id) { if (!/^[a-z0-9]{8,40}$/.test(id || '')) return null; try { return JSON.parse(fs.readFileSync(path.join(DIR(), id + '.json'), 'utf8')); } catch { return null; } }
const file = id => path.join(DIR(), id);
const read = id => fs.readFileSync(file(id));

// any recording (browser: webm/opus, mp4/aac, ogg/opus) -> ogg/opus mono, the format WhatsApp shows as a voice message
function toOggOpus(buf) {
  return new Promise((ok, fail) => {
    const tmp = path.join(os.tmpdir(), 'wd-' + crypto.randomBytes(6).toString('hex')), inp = tmp + '.in', out = tmp + '.ogg';
    fs.writeFileSync(inp, buf);
    const p = spawn('ffmpeg', ['-y', '-v', 'error', '-i', inp, '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-application', 'voip', '-f', 'ogg', out]);
    let err = ''; p.stderr.on('data', d => err += d);
    const done = () => { try { fs.unlinkSync(inp); } catch {} try { fs.unlinkSync(out); } catch {} };
    p.on('error', e => { done(); fail(e); });
    p.on('close', code => { if (code !== 0 || !fs.existsSync(out)) { done(); return fail(new Error('Could not convert the recording: ' + err.slice(0, 160))); } const r = fs.readFileSync(out); done(); ok(r); });
  });
}
// Make a recording sendable as a WhatsApp voice note. Returns { buf, mime, voice } (voice=false if it can only go as an audio file).
async function prepareVoice(buf, mime) {
  const m = baseMime(mime), isOpus = m === 'audio/ogg' && /opus/i.test(String(mime)) || m === 'audio/opus';
  if (isOpus) return { buf, mime: 'audio/ogg; codecs=opus', voice: true };
  if (hasFfmpeg()) return { buf: await toOggOpus(buf), mime: 'audio/ogg; codecs=opus', voice: true };
  if (['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/amr'].includes(m)) return { buf, mime: m, voice: false };
  throw new Error('This server cannot convert voice recordings (ffmpeg is missing). Install ffmpeg, or use the Docker image that comes with it.');
}

module.exports = { save, meta, file, read, kindOf, extOf, baseMime, hasFfmpeg, prepareVoice, DIR };
