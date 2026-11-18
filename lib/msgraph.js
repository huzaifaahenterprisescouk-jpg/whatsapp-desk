// Microsoft sign-in for OneDrive / SharePoint Excel files.
//
// Why: OneDrive refuses to give a file to an anonymous program ("401 unauthenticated") for many share links.
// With a Microsoft app (client) ID the desk signs in ONCE as a real Microsoft user (device-code sign-in, no
// redirect address, no client secret) and then reads the shared file through Microsoft Graph, exactly like
// opening the link in a browser while signed in. Read-only: it can never change your files.
const store = require('./store');
const appCfg = require('./config');

const LOGIN = process.env.MS_LOGIN_HOST || 'https://login.microsoftonline.com';
const GRAPH = process.env.MS_GRAPH_HOST || 'https://graph.microsoft.com';
const SCOPE = 'Files.Read.All offline_access User.Read';
// Editing a sheet from the app (Edit button on a DC) needs this one. Signing in asks for it; reading keeps working with older sign-ins.
const WSCOPE = 'Files.ReadWrite.All offline_access User.Read';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cfg = () => (store.db.ms = store.db.ms || { clientId: '', tenant: '', refresh: '', account: '', signedInAt: 0 });
const clientId = () => cfg().clientId || appCfg.msClientId;
const tenant = () => cfg().tenant || appCfg.msTenant || 'common';
const form = o => new URLSearchParams(o).toString();
const b64u = s => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');

let access = '', accessExp = 0, pending = null, pollTimer = null, lastError = '';

// Turn Microsoft's error codes into a sentence a normal person can act on.
function explain(j) {
  const d = String((j && (j.error_description || (j.error && j.error.message))) || (j && j.error) || 'Unknown error');
  const code = (/AADSTS(\d+)/.exec(d) || [])[1];
  const hints = {
    700016: 'Microsoft does not know this Client ID. Copy the "Application (client) ID" again from the Azure app page.',
    7000218: 'In Azure open your app → Authentication → "Allow public client flows" and switch it to Yes, then Save.',
    700025: 'In Azure open your app → Authentication → "Allow public client flows" and switch it to Yes, then Save.',
    50059: 'Use the Directory (tenant) ID of your company in the Tenant box, or leave it as "common".',
    50020: 'That account type is not allowed by the app. In Azure → Authentication choose "Accounts in any organizational directory and personal Microsoft accounts".',
    700021: 'In Azure open your app → Authentication → "Allow public client flows" and switch it to Yes, then Save.',
    65001: 'The app has not been given permission. In Azure → API permissions add Microsoft Graph → Delegated → Files.Read.All, then sign in again.',
    90002: 'The Tenant value is not valid. Leave it as "common" or paste your Directory (tenant) ID.',
    900144: 'The Client ID is missing. Paste the Application (client) ID first.',
  };
  return (hints[code] ? hints[code] + ' ' : '') + `(Microsoft says: ${d.split('\r')[0].split('\n')[0].slice(0, 220)})`;
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(body), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

const signedIn = () => !!cfg().refresh;
function publicStatus() {
  const c = cfg();
  return { clientId: clientId(), fromEnv: !c.clientId && !!appCfg.msClientId, tenant: c.tenant || appCfg.msTenant || '', signedIn: signedIn(), account: c.account || '', signedInAt: c.signedInAt || 0,
    error: lastError, pending: pending && pending.expiresAt > Date.now() ? { userCode: pending.userCode, url: pending.url, expiresAt: pending.expiresAt, error: pending.error || '' } : (pending && pending.error ? { error: pending.error } : null) };
}

function setConfig(b) {
  const c = cfg(), id = String(b.clientId || '').trim(), tn = String(b.tenant || '').trim();
  if (id && !GUID.test(id)) throw new Error('A Client ID looks like 8a1b2c3d-1234-5678-9abc-def012345678 (copy "Application (client) ID" from the Azure app page).');
  if (tn && !(GUID.test(tn) || /^[a-z0-9.-]+$/i.test(tn))) throw new Error('The Tenant box must be "common", your Directory (tenant) ID, or your domain name such as yourcompany.onmicrosoft.com.');
  if (id !== (c.clientId || '') || tn !== (c.tenant || '')) signOut();
  c.clientId = id; c.tenant = tn; lastError = ''; store.save();
  return publicStatus();
}

function signOut() {
  const c = cfg(); c.refresh = ''; c.account = ''; c.signedInAt = 0; access = ''; accessExp = 0; pending = null; clearTimeout(pollTimer); lastError = '';
  store.save();
  return publicStatus();
}

// Step 1: ask Microsoft for a short code; the person types it at microsoft.com/devicelogin.
async function startLogin() {
  const id = clientId(); if (!id) throw new Error('Paste your Microsoft app (client) ID first and press Save.');
  clearTimeout(pollTimer); lastError = '';
  const r = await post(`${LOGIN}/${encodeURIComponent(tenant())}/oauth2/v2.0/devicecode`, { client_id: id, scope: WSCOPE });
  if (!r.ok) { lastError = explain(r.j); throw new Error(lastError); }
  const d = r.j;
  pending = { deviceCode: d.device_code, userCode: d.user_code, url: d.verification_uri || 'https://microsoft.com/devicelogin', expiresAt: Date.now() + (d.expires_in || 900) * 1000, interval: Math.max(3, +d.interval || 5) * 1000 };
  pollTimer = setTimeout(poll, pending.interval);
  return publicStatus();
}

// Step 2: wait (in the background) until the person finishes signing in.
async function poll() {
  const p = pending; if (!p) return;
  if (Date.now() > p.expiresAt) { p.error = 'The code expired. Press "Sign in with Microsoft" again.'; return; }
  try {
    const r = await post(`${LOGIN}/${encodeURIComponent(tenant())}/oauth2/v2.0/token`, { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId(), device_code: p.deviceCode });
    if (r.ok) {
      const c = cfg(); c.refresh = r.j.refresh_token; access = r.j.access_token; accessExp = Date.now() + (r.j.expires_in || 3600) * 1000; c.signedInAt = Date.now(); pending = null;
      try { const me = await fetch(`${GRAPH}/v1.0/me`, { headers: { Authorization: 'Bearer ' + access }, signal: AbortSignal.timeout(15000) }).then(x => x.json()); c.account = me.userPrincipalName || me.mail || me.displayName || ''; } catch { /* name is only cosmetic */ }
      store.save(); return;
    }
    const e = r.j.error;
    if (e === 'slow_down') p.interval += 5000;
    else if (e !== 'authorization_pending') { p.error = explain(r.j); return; }
  } catch (e) { /* network hiccup: try again */ }
  pollTimer = setTimeout(poll, p.interval);
}

async function accessToken() {
  if (access && Date.now() < accessExp - 60000) return access;
  const c = cfg(); if (!c.refresh) throw new Error('Not signed in to Microsoft.');
  const r = await post(`${LOGIN}/${encodeURIComponent(tenant())}/oauth2/v2.0/token`, { grant_type: 'refresh_token', client_id: clientId(), refresh_token: c.refresh, scope: SCOPE });
  if (!r.ok) {
    if (r.j.error === 'invalid_grant' || r.j.error === 'interaction_required') { c.refresh = ''; access = ''; lastError = 'Your Microsoft sign-in expired. Press "Sign in with Microsoft" again.'; store.save(); throw new Error(lastError); }
    throw new Error(explain(r.j));
  }
  access = r.j.access_token; accessExp = Date.now() + (r.j.expires_in || 3600) * 1000;
  if (r.j.refresh_token && r.j.refresh_token !== c.refresh) { c.refresh = r.j.refresh_token; store.save(); }
  return access;
}

const isZip = b => b.length > 3 && b.readUInt32LE(0) === 0x04034b50;

// Download the file behind any OneDrive / SharePoint share link, as the signed-in Microsoft user.
async function downloadShare(link, accept = isZip) {
  const tok = await accessToken();
  const url = `${GRAPH}/v1.0/shares/u!${b64u(link)}/driveItem/content`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + tok }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!res.ok) {
    let why = ''; try { const j = await res.json(); why = j.error ? ` ${j.error.code}${j.error.message ? ' – ' + String(j.error.message).slice(0, 110) : ''}` : ''; } catch { /* no body */ }
    throw new Error(`error ${res.status}${why}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!accept(buf)) throw new Error('not an Excel file');
  return buf;
}

// ---------- writing back (Edit button) ----------
let waccess = '', waccessExp = 0; const items = new Map();
const NEED_WRITE = 'Editing needs permission to change your files. In Azure open your app → API permissions → add Microsoft Graph → Delegated → Files.ReadWrite.All, then sign in with Microsoft again (Settings / Order tracking).';
async function writeToken() {
  if (waccess && Date.now() < waccessExp - 60000) return waccess;
  const c = cfg(); if (!c.refresh) throw new Error('Not signed in to Microsoft.');
  const r = await post(`${LOGIN}/${encodeURIComponent(tenant())}/oauth2/v2.0/token`, { grant_type: 'refresh_token', client_id: clientId(), refresh_token: c.refresh, scope: WSCOPE });
  if (!r.ok) {
    if (/AADSTS(65001|70011|invalid_scope)/i.test(JSON.stringify(r.j))) throw new Error(NEED_WRITE);
    if (r.j.error === 'invalid_grant' || r.j.error === 'interaction_required') throw new Error(NEED_WRITE);
    throw new Error(explain(r.j));
  }
  waccess = r.j.access_token; waccessExp = Date.now() + (r.j.expires_in || 3600) * 1000;
  if (r.j.refresh_token && r.j.refresh_token !== c.refresh) { c.refresh = r.j.refresh_token; store.save(); }
  return waccess;
}
async function g(method, path, body, extra = {}) {
  const tok = await writeToken();
  const res = await fetch(GRAPH + '/v1.0' + path, { method, headers: { Authorization: 'Bearer ' + tok, ...(body !== undefined && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...(extra.headers || {}) }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  if (!res.ok) {
    let j = {}; try { j = await res.json(); } catch { /* no body */ }
    const code = j.error && j.error.code, msg = j.error && j.error.message ? String(j.error.message).slice(0, 140) : '';
    const e = new Error(res.status === 403 || res.status === 401 ? `Microsoft would not let this account change the file (${code || res.status}). Ask the owner to give it Edit access, and make sure the app has Files.ReadWrite.All.`
      : res.status === 423 ? 'The Excel file is locked right now (someone is saving it). Try again in a moment.'
      : res.status === 412 ? 'The Excel file changed while saving. Try again.' : `error ${res.status}${code ? ' ' + code : ''}${msg ? ' – ' + msg : ''}`);
    e.status = res.status; e.code = code; throw e;
  }
  return extra.raw ? res : res.status === 204 ? {} : res.json().catch(() => ({}));
}
async function itemOf(link) { // the drive + id behind a share link
  if (items.has(link)) return items.get(link);
  const j = await g('GET', `/shares/u!${b64u(link)}/driveItem?$select=id,eTag,parentReference`);
  const it = { drive: j.parentReference && j.parentReference.driveId, id: j.id }; if (!it.drive || !it.id) throw new Error('Could not find that file in OneDrive.');
  items.set(link, it); return it;
}
const colLetters = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const wsPath = (it, sheet) => `/drives/${encodeURIComponent(it.drive)}/items/${encodeURIComponent(it.id)}/workbook/worksheets('${encodeURIComponent(String(sheet).replace(/'/g, "''"))}')`;
// Change cells of one row of a shared Excel file. `check` = [[col, expectedText]] must still match the sheet before anything is changed.
// First choice: the Excel (workbook) API, which changes only those cells (safe while others have the file open).
// Fallback (e.g. personal OneDrive): download, change the cells, upload with an ETag check.
async function editRow(link, { sheet, row, cells, check, patch }) {
  const it = await itemOf(link), lastCol = Math.max(...cells.map(c => c.col), ...check.map(c => c[0]));
  const verify = vals => { for (const [col, want] of check) { const nz = x => String(x == null ? '' : x).toUpperCase().replace(/[^A-Z0-9]/g, ''), have = nz((vals || [])[col]), w = nz(want); if (w && have !== w) throw new Error('This row of the sheet has changed since it was loaded (someone edited or sorted the Excel file). Press Sync now, then try again.'); } };
  try {
    const rg = await g('GET', `${wsPath(it, sheet)}/range(address='A${row}:${colLetters(lastCol)}${row}')?$select=values,text`);
    verify((rg.text && rg.text[0]) || (rg.values && rg.values[0]));
    for (const c of cells) await g('PATCH', `${wsPath(it, sheet)}/range(address='${colLetters(c.col)}${row}')`, { values: [[c.value]] });
    return { via: 'Excel' };
  } catch (e) {
    if (!(e.status >= 400 && e.status !== 401 && e.status !== 403 && e.status !== 412 && e.status !== 423 && e.status !== 429) || /changed since it was loaded/.test(e.message)) throw e;
    // the Excel API is not available for this file: change the file itself
    const meta = await g('GET', `/drives/${encodeURIComponent(it.drive)}/items/${encodeURIComponent(it.id)}?$select=eTag`);
    const dl = await g('GET', `/drives/${encodeURIComponent(it.drive)}/items/${encodeURIComponent(it.id)}/content`, undefined, { raw: true });
    const buf = Buffer.from(await dl.arrayBuffer()), out = patch(buf);
    await g('PUT', `/drives/${encodeURIComponent(it.drive)}/items/${encodeURIComponent(it.id)}/content`, out, { headers: { 'If-Match': meta.eTag, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    return { via: 'file' };
  }
}

module.exports = { publicStatus, setConfig, signOut, startLogin, signedIn, downloadShare, accessToken, editRow };
