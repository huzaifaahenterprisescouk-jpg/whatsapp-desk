// Sign-in with username + password. Passwords are stored as salted scrypt hashes (never in plain text).
// Existing installs: the old PIN becomes the password and the username is the person's first name,
// so nobody is locked out (e.g. "sara" + her old PIN). The administrator can change both on the Team page.
const crypto = require('crypto');
const store = require('./store');

const MIN_PASSWORD = 6;
const normUser = u => String(u || '').trim().toLowerCase();
const validUser = u => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(u);

function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 32).toString('hex')}`;
}
function verify(password, stored) {
  const [alg, salt, h] = String(stored || '').split('$'); if (alg !== 'scrypt' || !salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(password), salt, 32).toString('hex')), b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const passwordProblem = p => String(p || '').length < MIN_PASSWORD ? `Password must be at least ${MIN_PASSWORD} characters` : String(p).length > 100 ? 'Password is too long' : '';

const byUsername = u => store.db.agents.find(a => a.username === normUser(u));
function uniqueUsername(base, except) {
  let u = normUser(base).replace(/[^a-z0-9._-]/g, '') || 'user'; if (u.length < 3) u += 'user';
  u = u.slice(0, 28); let n = 1, cand = u;
  while (store.db.agents.some(a => a !== except && a.username === cand)) cand = u + (++n);
  return cand;
}
// give old accounts a username and turn their PIN into a hashed password
function migrate() {
  let changed = false;
  for (const a of store.db.agents) {
    if (!a.username) { a.username = a.role === 'admin' && !store.db.agents.some(x => x.username === 'admin') ? 'admin' : uniqueUsername(String(a.name).split(/\s+/)[0], a); changed = true; }
    if (!a.pwd && a.pin !== undefined) { a.pwd = hash(a.pin); changed = true; }
    if (a.pin !== undefined) { delete a.pin; changed = true; }
  }
  if (changed) store.save();
}
// part of the session token: changing a password signs that person out everywhere else
const pwTag = a => crypto.createHash('sha256').update(String(a.pwd || '')).digest('hex').slice(0, 8);

// slow down password guessing: 6 wrong tries per username+address per 10 minutes
const fails = new Map();
const key = (ip, u) => `${ip}|${normUser(u)}`;
function locked(ip, u) { const f = fails.get(key(ip, u)); if (!f) return 0; if (Date.now() - f.t > 600000) { fails.delete(key(ip, u)); return 0; } return f.n >= 6 ? Math.ceil((600000 - (Date.now() - f.t)) / 60000) : 0; }
function fail(ip, u) { const k = key(ip, u), f = fails.get(k) && Date.now() - fails.get(k).t <= 600000 ? fails.get(k) : { n: 0, t: Date.now() }; f.n++; fails.set(k, f); }
const ok = (ip, u) => fails.delete(key(ip, u));

module.exports = { normUser, validUser, hash, verify, passwordProblem, byUsername, uniqueUsername, migrate, pwTag, locked, fail, ok, MIN_PASSWORD };
