// QuickBooks Online (live): reads customers, products and open invoices, and creates new shops as QuickBooks customers.
//
// Connect once with an Intuit developer app (developer.intuit.com → Create an app → QuickBooks Online and Payments).
// Customers are read-only EXCEPT that shops that register in WhatsApp are created in QuickBooks as new customers
// (DisplayName "Shop name (RT-SD-0004)", Notes "Account No: RT-SD-0004").
// QuickBooks Desktop has no cloud API: use the Excel/CSV upload on the Retail shops page for that.
const crypto = require('crypto');
const store = require('./store');

const AUTH = process.env.QBO_AUTH_HOST || 'https://appcenter.intuit.com';
const TOKEN = process.env.QBO_TOKEN_HOST || 'https://oauth.platform.intuit.com';
const API = env => process.env.QBO_API_HOST || (env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com');
const SCOPE = 'com.intuit.quickbooks.accounting';

const cfg = () => { const c = (store.db.qbo = store.db.qbo || {}); c.clientId = c.clientId || process.env.QBO_CLIENT_ID || ''; c.clientSecret = c.clientSecret || process.env.QBO_CLIENT_SECRET || ''; c.env = c.env || process.env.QBO_ENV || 'sandbox'; c.minutes = c.minutes || 15; if (c.autoPush === undefined) c.autoPush = true; return c; };
const retail = () => require('./retail');
const connected = () => !!(cfg().refresh && cfg().realmId);
let access = '', accessExp = 0, running = false, lastTry = 0;

function publicStatus() {
  const c = cfg();
  return { clientId: c.clientId, hasSecret: !!c.clientSecret, env: c.env, minutes: c.minutes, autoPush: c.autoPush, redirectUri: c.redirectUri || '', connected: connected(), company: c.company || '', realmId: c.realmId || '',
    lastSync: c.lastSync || 0, lastError: c.lastError || '', counts: c.counts || { customers: 0, products: 0, invoices: 0 }, unsent: retail().R().registered.filter(a => !a.qbId).length };
}

function setConfig(b) {
  const c = cfg();
  if (b.clientId !== undefined) c.clientId = String(b.clientId).trim();
  if (b.clientSecret) c.clientSecret = String(b.clientSecret).trim();
  if (b.env !== undefined) c.env = b.env === 'production' ? 'production' : 'sandbox';
  if (b.minutes !== undefined) c.minutes = Math.min(1440, Math.max(5, +b.minutes || 15));
  if (b.autoPush !== undefined) c.autoPush = !!b.autoPush;
  if (b.redirectUri !== undefined) c.redirectUri = String(b.redirectUri).trim();
  store.save(); return publicStatus();
}

// ---------- OAuth ----------
const sign = s => crypto.createHmac('sha256', store.db.secret).update(s).digest('hex').slice(0, 24);
function connectUrl(origin) {
  const c = cfg(); if (!c.clientId || !c.clientSecret) throw new Error('Enter the Client ID and Client secret of your Intuit app first and press Save.');
  c.redirectUri = c.redirectUri || `${String(origin).replace(/\/$/, '')}/qbo/callback`; store.save();
  const nonce = crypto.randomBytes(8).toString('hex') + '.' + Date.now(), state = nonce + '.' + sign(nonce);
  const q = new URLSearchParams({ client_id: c.clientId, scope: SCOPE, redirect_uri: c.redirectUri, response_type: 'code', state });
  return `${AUTH}/connect/oauth2?${q}`;
}
async function tokenCall(body) {
  const c = cfg();
  const r = await fetch(`${TOKEN}/oauth2/v1/tokens/bearer`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(body).toString(), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`QuickBooks sign-in failed: ${j.error_description || j.error || r.status}${j.error === 'invalid_client' ? '. Check the Client ID / secret and that Sandbox/Production matches the keys you copied.' : ''}`);
  return j;
}
async function handleCallback(query) {
  const st = String(query.get('state') || '').split('.'); if (st.length !== 3 || sign(st[0] + '.' + st[1]) !== st[2] || Date.now() - +st[1] > 15 * 60000) throw new Error('This sign-in link expired. Press "Connect QuickBooks" again.');
  if (query.get('error')) throw new Error('QuickBooks said: ' + query.get('error'));
  const c = cfg(), j = await tokenCall({ grant_type: 'authorization_code', code: query.get('code') || '', redirect_uri: c.redirectUri });
  c.refresh = j.refresh_token; c.realmId = query.get('realmId') || c.realmId; access = j.access_token; accessExp = Date.now() + (j.expires_in || 3600) * 1000; c.lastError = '';
  try { const ci = await api(`/companyinfo/${c.realmId}`); c.company = (ci.CompanyInfo || {}).CompanyName || ''; } catch { /* cosmetic */ }
  store.save(); sync().catch(e => console.error('QuickBooks first sync failed:', e.message));
}
async function accessToken() {
  const c = cfg(); if (!c.refresh) throw new Error('QuickBooks is not connected.');
  if (access && Date.now() < accessExp - 60000) return access;
  let j; try { j = await tokenCall({ grant_type: 'refresh_token', refresh_token: c.refresh }); }
  catch (e) { if (/invalid_grant/.test(e.message)) { c.refresh = ''; c.lastError = 'The QuickBooks connection expired. Press "Connect QuickBooks" again.'; store.save(); } throw e; }
  access = j.access_token; accessExp = Date.now() + (j.expires_in || 3600) * 1000;
  if (j.refresh_token && j.refresh_token !== c.refresh) { c.refresh = j.refresh_token; store.save(); } // Intuit rotates the refresh token
  return access;
}
function disconnect() { const c = cfg(); Object.assign(c, { refresh: '', realmId: '', company: '', lastError: '' }); access = ''; store.save(); return publicStatus(); }

// ---------- API ----------
async function api(path, body) {
  const c = cfg(), tok = await accessToken(), sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${API(c.env)}/v3/company/${c.realmId}${path}${sep}minorversion=70`, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = (j.Fault && j.Fault.Error && j.Fault.Error[0]) || {}; const err = new Error(`QuickBooks: ${e.Message || r.statusText || r.status}${e.Detail ? ' – ' + String(e.Detail).slice(0, 140) : ''}`); err.code = e.code; throw err; }
  return j;
}
async function query(entity, where = '') {
  const out = []; for (let start = 1; start < 20000; start += 500) {
    const j = await api('/query?query=' + encodeURIComponent(`select * from ${entity} ${where} startposition ${start} maxresults 500`)), page = (j.QueryResponse || {})[entity] || [];
    out.push(...page); if (page.length < 500) break;
  }
  return out;
}

// ---------- QuickBooks → shops ----------
const first = (...v) => v.find(x => x && String(x).trim()) || '';
function mapCustomer(x) {
  const note = /Account\s*No\.?\s*:\s*([A-Za-z0-9\-_.]+)/i.exec(x.Notes || '');
  const a = x.BillAddr || {}, sh = x.ShipAddr || {};
  return { id: note ? note[1] : `QB-${x.Id}`, qbId: x.Id, name: first(x.CompanyName, x.FullyQualifiedName, x.DisplayName).replace(/\s*\((?:RT|[A-Z]{2,5})-[A-Z0-9]{2,4}-\d{3,}\)\s*$/, ''),
    contact: first(x.FullyQualifiedName !== x.CompanyName && [x.GivenName, x.FamilyName].filter(Boolean).join(' ')), phone: first(x.PrimaryPhone && x.PrimaryPhone.FreeFormNumber, x.Mobile && x.Mobile.FreeFormNumber, x.AlternatePhone && x.AlternatePhone.FreeFormNumber),
    email: first(x.PrimaryEmailAddr && x.PrimaryEmailAddr.Address), address: [a.Line1 || sh.Line1, a.Line2, a.PostalCode].filter(Boolean).join(', '), city: first(a.City, sh.City), region: first(a.CountrySubDivisionCode, sh.CountrySubDivisionCode, a.City),
    balance: +x.Balance || 0 };
}
async function sync() {
  const c = cfg(); if (!connected()) throw new Error('QuickBooks is not connected.'); if (running) throw new Error('A QuickBooks sync is already running.');
  running = true; lastTry = Date.now();
  try {
    const [cust, items, invs] = await Promise.all([query('Customer', "where Active = true"), query('Item', "where Active = true and Type in ('Inventory','NonInventory','Service')"), query('Invoice', "where Balance > '0'")]);
    const R = retail().R(), accounts = cust.map(mapCustomer), byQb = new Map(accounts.map(a => [a.qbId, a]));
    R.qbo = { accounts, products: items.map(i => ({ name: i.Name, sku: i.Sku || '', price: i.UnitPrice === undefined ? null : +i.UnitPrice, category: i.FullyQualifiedName && i.FullyQualifiedName.includes(':') ? i.FullyQualifiedName.split(':')[0] : (i.Type === 'Service' ? 'Services' : ''), unit: '', region: '', account: '' })),
      invoices: invs.map(i => { const a = byQb.get(i.CustomerRef && i.CustomerRef.value); return { account: a ? a.id : (i.CustomerRef && i.CustomerRef.name) || '', no: i.DocNumber || '', date: i.TxnDate || '', due: i.DueDate || '', amount: +i.TotalAmt || 0, open: +i.Balance || 0, status: '' }; }) };
    // shops that registered in WhatsApp and now exist in QuickBooks: remember the link
    for (const a of R.registered) if (!a.qbId) { const hit = accounts.find(x => x.id.toLowerCase() === String(a.id).toLowerCase()); if (hit) a.qbId = hit.qbId; }
    Object.assign(c, { lastSync: Date.now(), lastError: '', counts: { customers: accounts.length, products: R.qbo.products.length, invoices: R.qbo.invoices.length } });
    store.save(); await pushPending().catch(() => {});
    return c.counts;
  } catch (e) { c.lastError = e.message; store.save(); throw e; } finally { running = false; }
}

// ---------- shops → QuickBooks ----------
async function pushShop(a) {
  const c = cfg(); if (!connected() || !c.autoPush || a.qbId) return a;
  const body = (suffix) => ({ DisplayName: `${a.name} (${a.id})${suffix}`.slice(0, 100), CompanyName: String(a.name).slice(0, 50), GivenName: String(a.contact || '').split(' ')[0].slice(0, 25) || undefined, FamilyName: String(a.contact || '').split(' ').slice(1).join(' ').slice(0, 25) || undefined,
    PrimaryPhone: a.phone ? { FreeFormNumber: String(a.phone).slice(0, 21) } : undefined, BillAddr: { Line1: String(a.address || '').slice(0, 500), City: String(a.city || '').slice(0, 255), CountrySubDivisionCode: String(a.region || '').slice(0, 255), Country: 'Pakistan' },
    Notes: `Account No: ${a.id} | Registered via WhatsApp${a.waPhone ? ' (' + a.waPhone + ')' : ''}` });
  try {
    let j; try { j = await api('/customer', body('')); } catch (e) { if (e.code === '6240') j = await api('/customer', body(' #' + Date.now().toString(36))); else throw e; }
    a.qbId = j.Customer.Id; a.qbError = ''; store.save();
  } catch (e) { a.qbError = e.message; store.save(); }
  return a;
}
async function pushPending() { for (const a of retail().R().registered) if (!a.qbId) await pushShop(a); }

let ticker = null;
function start() {
  clearInterval(ticker);
  ticker = setInterval(() => { if (connected() && !running && Date.now() - (lastTry || cfg().lastSync || 0) >= cfg().minutes * 60000) sync().catch(e => console.error('QuickBooks sync failed:', e.message)); }, 30000);
}

module.exports = { publicStatus, setConfig, connectUrl, handleCallback, disconnect, sync, pushShop, pushPending, start, connected };
