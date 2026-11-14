// "Continue with Google" for YouTube: the person signs in with Google and allows uploads; the desk gets a refresh token and hands the
// connection to the TrendSEO plugin on the shop, which uploads the videos. The desk keeps only the OAuth client ID + secret and the channel name.
const crypto = require('crypto');
const store = require('./store');
const social = () => require('./social');
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
const F = () => { const s = (store.db.social = store.db.social || {}); return (s.ytc = s.ytc || { clientId: '', clientSecret: '', publicUrl: '', channel: '', at: 0 }); };
const states = new Map();
const base = () => { const u = String((store.db.social || {}).fbc && store.db.social.fbc.publicUrl || '') || F().publicUrl; return F().publicUrl || u; };
const redirectUri = () => base() ? base() + '/api/social/yt/callback' : '';
const status = () => { const f = F(); return { clientId: f.clientId, hasSecret: !!f.clientSecret, publicUrl: f.publicUrl || base(), redirect: redirectUri(), channel: f.channel, at: f.at }; };
function setConfig(b = {}) {
  const f = F();
  if (b.clientId !== undefined) f.clientId = String(b.clientId).trim().slice(0, 200);
  if (b.clientSecret) f.clientSecret = String(b.clientSecret).trim().slice(0, 100);
  if (b.publicUrl !== undefined) { let u = String(b.publicUrl || '').trim(); if (u) { if (!/^https?:\/\//i.test(u)) u = 'https://' + u; u = u.replace(/[?#].*$/, '').replace(/\/+$/, ''); if (!/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) throw new Error('The desk address must start with https://'); } f.publicUrl = u; }
  store.save(); return status();
}
function loginUrl() {
  const f = F(); if (!f.clientId || !f.clientSecret) throw new Error('Enter the Google Client ID and Client Secret first.'); if (!redirectUri()) throw new Error('Enter the desk\'s https address first.');
  const t = Date.now() - 15 * 60000; for (const [k, v] of states) if (v < t) states.delete(k);
  const state = crypto.randomBytes(16).toString('hex'); states.set(state, Date.now());
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth'); const q = { client_id: f.clientId, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); return { url: u.toString() };
}
async function callback(q) {
  const f = F(); if (!states.has(String(q.state || ''))) throw new Error('This sign-in link expired. Press “Continue with Google” again.'); states.delete(q.state);
  if (q.error || !q.code) throw new Error(q.error_description || 'Google sign-in was cancelled.');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ code: q.code, client_id: f.clientId, client_secret: f.clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code' }), signal: AbortSignal.timeout(30000) }), j = await r.json().catch(() => ({}));
  if (!j.refresh_token) throw new Error(j.error_description || 'Google did not return a long-lived login. Remove the app under myaccount.google.com/permissions and sign in again.');
  const v = String(social().publicStatus().version || ''); if (v && v.localeCompare('2.4.3', undefined, { numeric: true }) < 0) throw new Error('Update TrendSEO Pro on the shop to 2.4.3 or newer first.');
  const out = await social().call('youtube', { method: 'POST', body: { client_id: f.clientId, client_secret: f.clientSecret, refresh_token: j.refresh_token } });
  f.channel = String(out.message || '').replace(/^Connected to YouTube channel:\s*/, '') || 'YouTube channel'; f.at = Date.now(); store.save();
  try { await social().test(); } catch {}
  return { channel: f.channel };
}
async function disconnect() { await social().call('youtube', { method: 'POST', body: { disconnect: true } }); Object.assign(F(), { channel: '', at: 0 }); store.save(); try { await social().test(); } catch {} return status(); }
module.exports = { status, setConfig, loginUrl, callback, disconnect };
