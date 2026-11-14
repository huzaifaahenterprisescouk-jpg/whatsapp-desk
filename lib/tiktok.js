// TikTok API settings + posting (TikTok "Content Posting API").
// The person signs in on TikTok's own page ("Continue with TikTok"); the desk keeps the app's Client key + secret (entered once) and the
// access / refresh tokens, and posts a product video (or pictures) straight from the desk. Nothing goes through the WordPress shop.
// TikTok rules worth knowing: an app that TikTok has not audited can only post as "Only me" (private); an audited app can post publicly.
// "Pull from URL" needs the shop's address (the domain the video / pictures are on) to be verified in your TikTok app (URL properties).
const crypto = require('crypto');
const store = require('./store');
const social = () => require('./social');
const API = 'https://open.tiktokapis.com';
const SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];
const PRIVACY = { SELF_ONLY: 'Only me (private; required until TikTok approves your app)', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', PUBLIC_TO_EVERYONE: 'Everyone (public)' };
const F = () => {
  const s = (store.db.social = store.db.social || {});
  return (s.ttc = Object.assign({ clientKey: '', clientSecret: '', publicUrl: '', name: '', openId: '', access: '', refresh: '', expires: 0, refreshExpires: 0, privacy: 'SELF_ONLY', draft: false, at: 0 }, s.ttc || {}));
};
const states = new Map();
const cleanBase = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u.replace(/[?#].*$/, '').replace(/\/+$/, ''); };
const base = () => { const s = store.db.social || {}; return F().publicUrl || (s.fbc && s.fbc.publicUrl) || (s.ytc && s.ytc.publicUrl) || ''; };
const redirectUri = () => base() ? base() + '/api/social/tt/callback' : '';
const connected = () => !!F().refresh || !!F().access;

function status() {
  const f = F();
  return { clientKey: f.clientKey, hasSecret: !!f.clientSecret, publicUrl: f.publicUrl || base(), redirect: redirectUri(), name: f.name, connected: connected(), privacy: f.privacy, draft: f.draft, at: f.at, privacyOptions: PRIVACY, scopes: SCOPES };
}
function setConfig(b = {}) {
  const f = F();
  if (b.clientKey !== undefined) f.clientKey = String(b.clientKey).trim().slice(0, 80);
  if (b.clientSecret) f.clientSecret = String(b.clientSecret).trim().slice(0, 120);
  if (b.publicUrl !== undefined) { const u = cleanBase(b.publicUrl); if (u && !/^https:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) throw new Error('The desk address must start with https:// (TikTok only sends you back to a secure address).'); f.publicUrl = u; }
  if (b.privacy !== undefined) f.privacy = PRIVACY[b.privacy] ? b.privacy : 'SELF_ONLY';
  if (b.draft !== undefined) f.draft = !!b.draft;
  store.save(); return status();
}
async function tj(path, { form, json, token } = {}) {
  const headers = { 'Cache-Control': 'no-cache' }; let body;
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form); }
  if (json) { headers['Content-Type'] = 'application/json; charset=UTF-8'; body = JSON.stringify(json); }
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers, body, signal: AbortSignal.timeout(40000) }), j = await r.json().catch(() => ({}));
  const err = j.error && j.error.code && j.error.code !== 'ok' ? j.error : (j.error_description || j.error && typeof j.error === 'string') ? { code: j.error, message: j.error_description } : null;
  if (err) throw new Error('TikTok: ' + (err.message || err.code) + (err.code ? ` (${err.code})` : ''));
  if (!r.ok) throw new Error('TikTok answered HTTP ' + r.status);
  return j;
}
function loginUrl() {
  const f = F(); if (!f.clientKey || !f.clientSecret) throw new Error('Enter the TikTok Client key and Client secret first.'); if (!redirectUri()) throw new Error('Enter the desk\'s https address first.');
  const t = Date.now() - 15 * 60000; for (const [k, v] of states) if (v < t) states.delete(k);
  const state = crypto.randomBytes(16).toString('hex'); states.set(state, Date.now());
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  for (const [k, v] of Object.entries({ client_key: f.clientKey, scope: SCOPES.join(','), response_type: 'code', redirect_uri: redirectUri(), state })) u.searchParams.set(k, v);
  return { url: u.toString() };
}
function keep(f, t) { f.access = t.access_token; f.refresh = t.refresh_token || f.refresh; f.expires = Date.now() + (+t.expires_in || 86400) * 1000 - 60000; f.refreshExpires = t.refresh_expires_in ? Date.now() + +t.refresh_expires_in * 1000 : f.refreshExpires; if (t.open_id) f.openId = t.open_id; }
async function callback(q) {
  const f = F(); if (!states.has(String(q.state || ''))) throw new Error('This sign-in link expired. Press “Continue with TikTok” again.'); states.delete(q.state);
  if (q.error || !q.code) throw new Error(q.error_description || 'TikTok sign-in was cancelled.');
  const t = await tj('/v2/oauth/token/', { form: { client_key: f.clientKey, client_secret: f.clientSecret, code: q.code, grant_type: 'authorization_code', redirect_uri: redirectUri() } });
  if (!t.access_token) throw new Error('TikTok did not return a login. Try again.');
  keep(f, t); f.at = Date.now();
  try { const u = await tj('/v2/user/info/?fields=open_id,display_name', { token: f.access }); f.name = (u.data && u.data.user && u.data.user.display_name) || 'TikTok account'; } catch { f.name = f.name || 'TikTok account'; }
  store.save(); try { social().useApi('tiktok'); } catch {}
  return { name: f.name };
}
async function token() {
  const f = F(); if (!connected()) throw new Error('TikTok is not connected (Social posting → Connection → TikTok).');
  if (f.access && Date.now() < f.expires) return f.access;
  if (!f.refresh) throw new Error('The TikTok login expired. Press “Continue with TikTok” again.');
  const t = await tj('/v2/oauth/token/', { form: { client_key: f.clientKey, client_secret: f.clientSecret, grant_type: 'refresh_token', refresh_token: f.refresh } });
  if (!t.access_token) throw new Error('The TikTok login expired. Press “Continue with TikTok” again.');
  keep(f, t); store.save(); return f.access;
}
async function test() { const u = await tj('/v2/user/info/?fields=open_id,display_name', { token: await token() }); const f = F(); f.name = (u.data && u.data.user && u.data.user.display_name) || f.name; store.save(); return { name: f.name }; }
async function disconnect() {
  const f = F(); try { if (f.access) await tj('/v2/oauth/revoke/', { form: { client_key: f.clientKey, client_secret: f.clientSecret, token: f.access } }); } catch {}
  Object.assign(f, { name: '', openId: '', access: '', refresh: '', expires: 0, refreshExpires: 0, at: 0 }); store.save(); return status();
}
// Post one product. media = { images: [url], video: 'none' | 'auto' | url }. A video is preferred (that is what TikTok is for); otherwise pictures (a photo carousel).
async function post(it, prod, media) {
  const f = F(), tok = await token(), isVideo = media && /^https?:/.test(media.video || ''), imgs = ((media && media.images && media.images.length ? media.images : [prod.image]).filter(u => /^https?:\/\//i.test(u || ''))).slice(0, 35);
  const title = String(it.text || it.title || prod.name).replace(/\s+/g, ' ').trim().slice(0, 2200), draft = !!f.draft;
  let r, kind;
  if (isVideo) {
    kind = 'video';
    r = await tj(draft ? '/v2/post/publish/inbox/video/init/' : '/v2/post/publish/video/init/', { token: tok, json: { ...(draft ? {} : { post_info: { title, privacy_level: f.privacy, disable_duet: false, disable_comment: false, disable_stitch: false } }), source_info: { source: 'PULL_FROM_URL', video_url: media.video } } });
  } else if (imgs.length) {
    kind = 'photo';
    r = await tj('/v2/post/publish/content/init/', { token: tok, json: { post_info: { title: String(it.title || prod.name).slice(0, 90), description: title.slice(0, 4000), privacy_level: f.privacy, disable_comment: false, auto_add_music: true }, source_info: { source: 'PULL_FROM_URL', photo_cover_index: 1, photo_images: imgs }, post_mode: draft ? 'MEDIA_UPLOAD' : 'DIRECT_POST', media_type: 'PHOTO' } });
  } else throw new Error('TikTok needs a video or at least one picture. Choose your video (for example the one made with Flow AI) under “Pictures & video”.');
  const id = r.data && r.data.publish_id; let st = '';
  if (id) { await new Promise(x => setTimeout(x, 2500)); try { const s = await tj('/v2/post/publish/status/fetch/', { token: tok, json: { publish_id: id } }); st = s.data && s.data.status || ''; if (st === 'FAILED') throw new Error('TikTok could not publish it: ' + (s.data.fail_reason || 'unknown reason') + (/url_ownership/i.test(s.data.fail_reason || '') ? ' (verify your shop address under URL properties in your TikTok app)' : '')); } catch (e) { if (/could not publish/.test(e.message)) throw e; } }
  return `TikTok ${kind} ${draft ? 'sent to your TikTok app inbox as a draft (open TikTok → Inbox to finish)' : f.privacy === 'SELF_ONLY' ? 'uploaded as private (“Only me”; TikTok must approve your app before public posts)' : 'published'}${st ? ' (' + st.toLowerCase().replace(/_/g, ' ') + ')' : ''}`;
}
module.exports = { status, setConfig, loginUrl, callback, disconnect, test, post, connected };
