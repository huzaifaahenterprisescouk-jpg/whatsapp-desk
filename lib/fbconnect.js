// "Continue with Facebook": the person signs in on Facebook's own page and ticks their Page; the desk then hands the Page connection
// to the TrendSEO plugin on the shop (which does the actual posting). Nobody pastes a token. The desk keeps only the Facebook app's
// ID + secret (entered once) and the connected Page's name; the Page token itself is stored by the shop, never kept here.
const crypto = require('crypto');
const store = require('./store');
const social = () => require('./social');
const G = 'https://graph.facebook.com' + (process.env.FB_GRAPH_VERSION ? '/' + process.env.FB_GRAPH_VERSION : ''); // unversioned = Meta's oldest still-supported version, so it does not expire
const SCOPES = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_manage_metadata', 'business_management', 'instagram_basic', 'instagram_content_publish'];
const F = () => { const s = (store.db.social = store.db.social || {}); return (s.fbc = s.fbc || { appId: '', appSecret: '', publicUrl: '', pageId: '', pageName: '', igName: '', user: '', at: 0 }); };
const states = new Map(), pending = new Map(); // state -> { at } ; state -> { pages, user, at }
const sweep = () => { const t = Date.now() - 15 * 60000; for (const m of [states, pending]) for (const [k, v] of m) if (v.at < t) m.delete(k); };
const cleanBase = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/[?#].*$/, '').replace(/\/+$/, ''); };
const redirectUri = () => { const b = F().publicUrl; return b ? b + '/api/social/fb/callback' : ''; };

function status(last) {
  sweep(); const f = F(), pend = last && pending.get(last);
  return { appId: f.appId, hasSecret: !!f.appSecret, publicUrl: f.publicUrl, redirect: redirectUri(), pageId: f.pageId, pageName: f.pageName, igName: f.igName, user: f.user, at: f.at,
    pages: pend ? pend.pages.map(p => ({ id: p.id, name: p.name, ig: p.ig && p.ig.username || '' })) : [], pendingState: pend ? last : '' };
}
function setConfig(b = {}) {
  const f = F();
  if (b.appId !== undefined) f.appId = String(b.appId).replace(/\D/g, '').slice(0, 30);
  if (b.appSecret) f.appSecret = String(b.appSecret).trim().slice(0, 80);
  if (b.publicUrl !== undefined) { const u = cleanBase(b.publicUrl); if (u && !/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) throw new Error('The desk address must start with https:// (Facebook only sends you back to a secure address).'); f.publicUrl = u; }
  store.save(); return status();
}
async function gj(path, params, post) {
  const u = new URL(G + path); let body;
  if (post) body = new URLSearchParams(params); else for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { method: post ? 'POST' : 'GET', body, signal: AbortSignal.timeout(30000) }), j = await r.json().catch(() => ({}));
  if (j.error) throw new Error('Facebook: ' + (j.error.message || 'error') + (j.error.code ? ` (code ${j.error.code})` : ''));
  return j;
}
function loginUrl() {
  const f = F(); if (!f.appId || !f.appSecret) throw new Error('Enter the Facebook App ID and App Secret first.'); if (!redirectUri()) throw new Error('Enter the desk\'s https address first.');
  sweep(); const state = crypto.randomBytes(16).toString('hex'); states.set(state, { at: Date.now() });
  const u = new URL('https://www.facebook.com/dialog/oauth'); u.searchParams.set('client_id', f.appId); u.searchParams.set('redirect_uri', redirectUri()); u.searchParams.set('state', state); u.searchParams.set('scope', SCOPES.join(',')); u.searchParams.set('response_type', 'code');
  return { url: u.toString(), state };
}
// Facebook sends the browser back here with ?code=…&state=… (no desk sign-in header, so the state is what proves it is ours)
async function callback(q) {
  const f = F(), st = states.get(String(q.state || '')); if (!st) throw new Error('This sign-in link expired. Press “Continue with Facebook” again.'); states.delete(q.state);
  if (q.error || !q.code) throw new Error(q.error_description || 'Facebook sign-in was cancelled.');
  const t1 = await gj('/oauth/access_token', { client_id: f.appId, client_secret: f.appSecret, redirect_uri: redirectUri(), code: q.code });
  const t2 = await gj('/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: f.appId, client_secret: f.appSecret, fb_exchange_token: t1.access_token }); // long-lived: Page tokens from it do not expire
  const me = await gj('/me', { fields: 'name', access_token: t2.access_token });
  const acc = await gj('/me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 100, access_token: t2.access_token });
  const pages = (acc.data || []).filter(p => p.access_token).map(p => ({ id: p.id, name: p.name, token: p.access_token, ig: p.instagram_business_account || null }));
  if (!pages.length) throw new Error('No Facebook Pages were shared. Sign in again and tick your Page (and be an admin of it).');
  pending.set(q.state, { pages, user: me.name || '', at: Date.now() });
  if (pages.length === 1) await choose(q.state, pages[0].id);
  return { state: q.state, pages: pages.length };
}
async function choose(state, pageId) {
  const pend = pending.get(String(state || '')); if (!pend) throw new Error('This choice expired. Press “Continue with Facebook” again.');
  const pg = pend.pages.find(p => p.id === String(pageId)); if (!pg) throw new Error('Choose one of the Pages listed.');
  const v = String(social().publicStatus().version || ''); if (v && v.localeCompare('2.4.2', undefined, { numeric: true }) < 0) throw new Error('Update TrendSEO Pro on the shop to 2.4.2 or newer (the zip in this delivery) first.');
  const r = await social().call('facebook', { method: 'POST', body: { page_id: pg.id, token: pg.token, ig_user_id: pg.ig ? pg.ig.id : '' } });
  const f = F(); Object.assign(f, { pageId: pg.id, pageName: pg.name, igName: pg.ig ? pg.ig.username || '' : '', user: pend.user, at: Date.now() }); store.save(); pending.delete(state);
  try { await social().test(); } catch {} // refresh which platforms show as connected
  return { message: r.message || 'Connected', ...status() };
}
async function disconnect() { await social().call('facebook', { method: 'POST', body: { disconnect: true } }); Object.assign(F(), { pageId: '', pageName: '', igName: '', user: '', at: 0 }); store.save(); try { await social().test(); } catch {} return status(); }

module.exports = { status, setConfig, loginUrl, callback, choose, disconnect };
