// Snapchat API settings: "Continue with Snapchat" (Snap Kit / Snapchat OAuth). The desk keeps the Snap app's Client ID + secret
// (entered once) and the access / refresh tokens, and can test the login. Snapchat has NO open "post a video to my Spotlight" endpoint
// for ordinary accounts (it is only for Snap-approved partners using the Public Profile API), so product posts to Snapchat still go
// through a webhook (Zapier / Make / n8n) or by hand until Snap gives your app that access; the token saved here is ready for it.
const crypto = require('crypto');
const store = require('./store');
const AUTH = 'https://accounts.snapchat.com/login/oauth2';
const SCOPE = { marketing: 'snapchat-marketing-api', profile: 'snapchat-profile-api', both: 'snapchat-marketing-api snapchat-profile-api' };
const F = () => {
  const s = (store.db.social = store.db.social || {});
  return (s.scc = Object.assign({ clientId: '', clientSecret: '', publicUrl: '', scope: 'marketing', profileId: '', name: '', access: '', refresh: '', expires: 0, at: 0 }, s.scc || {}));
};
const states = new Map();
const cleanBase = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/[?#].*$/, '').replace(/\/+$/, ''); };
const base = () => { const s = store.db.social || {}; return F().publicUrl || (s.fbc && s.fbc.publicUrl) || (s.ytc && s.ytc.publicUrl) || (s.ttc && s.ttc.publicUrl) || ''; };
const redirectUri = () => base() ? base() + '/api/social/sc/callback' : '';
const connected = () => !!F().refresh || !!F().access;
function status() { const f = F(); return { clientId: f.clientId, hasSecret: !!f.clientSecret, publicUrl: f.publicUrl || base(), redirect: redirectUri(), scope: f.scope, profileId: f.profileId, name: f.name, connected: connected(), at: f.at }; }
function setConfig(b = {}) {
  const f = F();
  if (b.clientId !== undefined) f.clientId = String(b.clientId).trim().slice(0, 100);
  if (b.clientSecret) f.clientSecret = String(b.clientSecret).trim().slice(0, 160);
  if (b.scope !== undefined) f.scope = SCOPE[b.scope] ? b.scope : 'marketing';
  if (b.profileId !== undefined) f.profileId = String(b.profileId).trim().slice(0, 80);
  if (b.publicUrl !== undefined) { const u = cleanBase(b.publicUrl); if (u && !/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) throw new Error('The desk address must start with https:// (Snapchat only sends you back to a secure address).'); f.publicUrl = u; }
  store.save(); return status();
}
async function tok(form) {
  const f = F(), r = await fetch(AUTH + '/access_token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(f.clientId + ':' + f.clientSecret).toString('base64') }, body: new URLSearchParams({ client_id: f.clientId, client_secret: f.clientSecret, ...form }), signal: AbortSignal.timeout(30000) }), j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Snapchat: ' + (j.error_description || j.error || 'HTTP ' + r.status));
  f.access = j.access_token; f.refresh = j.refresh_token || f.refresh; f.expires = Date.now() + (+j.expires_in || 1800) * 1000 - 60000; store.save(); return j;
}
function loginUrl() {
  const f = F(); if (!f.clientId || !f.clientSecret) throw new Error('Enter the Snapchat Client ID and Client secret first.'); if (!redirectUri()) throw new Error('Enter the desk\'s https address first.');
  const t = Date.now() - 15 * 60000; for (const [k, v] of states) if (v < t) states.delete(k);
  const state = crypto.randomBytes(16).toString('hex'); states.set(state, Date.now());
  const u = new URL(AUTH + '/authorize');
  for (const [k, v] of Object.entries({ client_id: f.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPE[f.scope] || SCOPE.marketing, state })) u.searchParams.set(k, v);
  return { url: u.toString() };
}
async function callback(q) {
  const f = F(); if (!states.has(String(q.state || ''))) throw new Error('This sign-in link expired. Press “Continue with Snapchat” again.'); states.delete(q.state);
  if (q.error || !q.code) throw new Error(q.error_description || 'Snapchat sign-in was cancelled.');
  await tok({ grant_type: 'authorization_code', code: q.code, redirect_uri: redirectUri() }); f.at = Date.now();
  try { await test(); } catch { f.name = f.name || 'Snapchat account'; }
  store.save(); return { name: f.name };
}
async function token() {
  const f = F(); if (!connected()) throw new Error('Snapchat is not connected (Social posting → Connection → Snapchat).');
  if (f.access && Date.now() < f.expires) return f.access;
  if (!f.refresh) throw new Error('The Snapchat login expired. Press “Continue with Snapchat” again.');
  await tok({ grant_type: 'refresh_token', refresh_token: f.refresh }); return f.access;
}
async function test() {
  const f = F(), t = await token(), r = await fetch('https://adsapi.snapchat.com/v1/me', { headers: { Authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(30000) }), j = await r.json().catch(() => ({}));
  if (!r.ok) { if (f.scope === 'profile') { f.name = f.name || 'Snapchat account'; store.save(); return { name: f.name, note: 'Login is valid (profile scope cannot be read back).' }; } throw new Error('Snapchat: ' + ((j.request_status && j.request_status) || (j.error_description) || 'HTTP ' + r.status)); }
  const me = (j.me || {}); f.name = me.display_name || me.email || f.name || 'Snapchat account'; store.save(); return { name: f.name };
}
function disconnect() { Object.assign(F(), { name: '', access: '', refresh: '', expires: 0, at: 0 }); store.save(); return status(); }
module.exports = { status, setConfig, loginUrl, callback, disconnect, test, token, connected };
