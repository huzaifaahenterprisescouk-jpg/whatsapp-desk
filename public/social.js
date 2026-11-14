/* Social posting (admin): products + SEO title / description / keywords / hashtags come from the TrendSEO Pro plugin on the WordPress shop.
   Write or tweak a post per platform, then post now, schedule it, or let the desk post a few products every day.
   Loaded after app.js (viewSocial is called by renderView). */
let SO = null, SOT = 'compose', SOQ = '', SOF = '', SOList = { products: [], total: 0, all: 0 }, SOCur = null, SOPack = null, SOEdit = {}, SOSel = new Set(), SORes = null, SOBusy = false;
const SO_MODE = { plugin: 'Posted by your shop (TrendSEO)', webhook: 'Sent to your webhook (Zapier / Make / n8n…)', whatsapp: 'Sent as a WhatsApp message', manual: 'By hand (copy + open)' };
const soAgo = t => { if (!t) return 'never'; const d = (Date.now() - t) / 1000; return d < 90 ? 'just now' : d < 5400 ? Math.round(d / 60) + ' min ago' : d < 129600 ? Math.round(d / 3600) + ' h ago' : new Date(t).toLocaleDateString(); };
const soPill = st => `<span class="pill ${st === 'posted' || st === 'done' ? 'green' : ''}" style="${st === 'failed' ? 'background:var(--red-soft);color:var(--red)' : st === 'queued' || st === 'manual' || st === 'pending' || st === 'running' ? 'background:var(--amber-soft);color:var(--amber)' : ''}">${esc(st)}</span>`;
const soCopy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { await gprompt('Copy this', t); } };

async function viewSocial() {
  $('#main').innerHTML = `<div class="page">${pageHead('Social posting', 'Post every product to Facebook, Instagram, WhatsApp, TikTok, Snapchat, YouTube, Pinterest or any platform, using the SEO title, description, keywords and hashtags from TrendSEO Pro on your WordPress shop.', `<button class="btn" id="so-sync">${ic('down')} Sync products</button>`)}<div id="so-body"><div class="hint">Loading…</div></div></div>`;
  $('#so-sync').onclick = soSync;
  try { SO = await api('/social'); } catch (e) { $('#so-body').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  if (!SO.connected) SOT = 'connect';
  soDraw();
}
async function soSync() {
  const b = $('#so-sync'); b.disabled = true; try { const r = await api('/social/sync', { method: 'POST', body: {} }); SO = r; toast(`${r.products} products read from your shop`); await soLoadList(); soDraw(); } catch (e) { toast(e.message, true); } b.disabled = false;
}
async function soLoadList() { try { SOList = await api(`/social/products?q=${encodeURIComponent(SOQ)}&filter=${SOF}&limit=80`); } catch { } }
function soDraw() {
  const tabs = [['compose', 'Write & post'], ['queue', 'Scheduled & history'], ['platforms', 'Platforms & automation'], ['connect', 'Connection']];
  $('#so-body').innerHTML = `<div class="seg" style="margin-bottom:14px">${tabs.map(([k, l]) => `<button data-t="${k}" class="${SOT === k ? 'on' : ''}" ${k !== 'connect' && !SO.connected ? 'disabled' : ''}>${l}</button>`).join('')}</div><div id="so-pane"></div>`;
  $('#so-body .seg').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; SOT = b.dataset.t; soDraw(); };
  if (SOT === 'platforms') SOCfg = null; ({ compose: soCompose, queue: soQueue, platforms: () => soPlatforms(), connect: soConnect }[SOT])();
}

// ---------- connection ----------
function soConnect() {
  const pp = SO.pluginPlatforms || {};
  $('#so-pane').innerHTML = `<div class="grid g2" style="align-items:start"><div class="card pad"><div class="h3">Connect your WordPress shop</div>
    <div class="field"><label>Site address</label><input type="text" id="so-url" value="${esc(SO.url || SO.suggestUrl)}" placeholder="https://your-shop.com"></div>
    <div class="field"><label>Desk key</label><input type="password" id="so-key" placeholder="${SO.hasKey ? '•••••••• (saved, leave blank to keep)' : 'Paste the key from WordPress'}" autocomplete="off"></div>
    <div class="row" style="gap:8px"><button class="btn primary" id="so-save">Save &amp; test</button>${SO.connected ? '<button class="btn" id="so-pull">Read all products now</button>' : ''}</div>
    <div class="hint" style="margin-top:10px">${SO.connected ? `<span class="pulse"></span> Connected to <b>${esc(SO.site)}</b> (TrendSEO Pro ${esc(SO.version)}). ${SO.count} products read, last ${soAgo(SO.lastSync)}. New SEO data is read again every ${SO.minutes} minutes.` : (SO.lastError ? `<b style="color:var(--red)">${esc(SO.lastError)}</b>` : 'Not connected yet.')}</div></div>
    <div class="card pad"><div class="h3">How to connect</div><ol class="hint" style="padding-left:18px;line-height:1.8"><li>In WordPress install the updated <b>TrendSEO Pro 2.4.0</b> (Plugins → Add New → Upload).</li><li>Open <b>TrendSEO Pro → WhatsApp Desk</b>. It shows your <b>site address</b> and a <b>Desk key</b>.</li><li>Paste both here and press <b>Save &amp; test</b>.</li><li>From then on the desk reads each product’s SEO title, description, keywords and hashtags (the ones TrendSEO made) and writes a post for every platform.</li></ol>
      ${SO.connected ? `<div class="h3" style="margin-top:12px">Logins saved in the plugin</div><div class="hint">Posting through your shop uses the logins on <b>TrendSEO Pro → Auto Video &amp; Social</b>:</div><div class="chips" style="margin-top:6px">${Object.entries(pp).map(([k, v]) => `<span class="pill ${v.connected ? 'green' : ''}">${esc(v.label)}: ${v.connected ? 'connected' : 'not connected'}</span>`).join('')}</div>` : ''}</div></div>`;
  $('#so-save').onclick = async () => {
    const b = { url: $('#so-url').value }; if ($('#so-key').value) b.key = $('#so-key').value;
    try { await api('/social', { method: 'PUT', body: b }); const r = await api('/social/test', { method: 'POST', body: {} }); SO = r; toast(`Connected to ${r.site}`); const s = await api('/social/sync', { method: 'POST', body: {} }); SO = s; await soLoadList(); SOT = 'compose'; soDraw(); } catch (e) { try { SO = await api('/social'); } catch { } toast(e.message, true); soConnect(); }
  };
  const pl = $('#so-pull'); if (pl) pl.onclick = soSync;
}

// ---------- compose ----------
async function soCompose() {
  $('#so-pane').innerHTML = `<div class="grid" style="grid-template-columns:minmax(260px,340px) 1fr;gap:14px;align-items:start"><div class="card pad" style="padding:12px"><div class="row" style="gap:6px"><input type="search" id="so-q" style="flex:1;min-width:0" placeholder="Search products…" value="${esc(SOQ)}"><select id="so-f"><option value="">All</option><option value="unposted" ${SOF === 'unposted' ? 'selected' : ''}>Never posted</option><option value="poor" ${SOF === 'poor' ? 'selected' : ''}>SEO needs work</option><option value="optimized" ${SOF === 'optimized' ? 'selected' : ''}>Optimized</option></select></div><div class="hint" id="so-cnt" style="margin:6px 2px"></div><div id="so-list" style="max-height:68vh;overflow:auto"></div></div><div id="so-det"><div class="card pad"><div class="empty" style="padding:40px">Choose a product on the left.</div></div></div></div>`;
  let t; $('#so-q').oninput = e => { SOQ = e.target.value; clearTimeout(t); t = setTimeout(async () => { await soLoadList(); soDrawList(); }, 250); };
  $('#so-f').onchange = async e => { SOF = e.target.value; await soLoadList(); soDrawList(); };
  if (!SOList.all) await soLoadList(); soDrawList(); if (SOCur) soDrawDet();
}
function soDrawList() {
  $('#so-cnt').textContent = `${SOList.total} of ${SOList.all} products`;
  $('#so-list').innerHTML = SOList.products.map(p => { const sc = p.seo && p.seo.score; return `<div class="pk-row ${SOCur && SOCur.id === p.id ? 'on' : ''}" data-id="${p.id}" style="cursor:pointer;display:flex;gap:10px;align-items:center;padding:8px;border-radius:10px">
    ${p.image ? `<img src="${esc(p.image)}" width="42" height="42" style="object-fit:cover;border-radius:8px;flex:none" loading="lazy">` : '<div style="width:42px;height:42px;border-radius:8px;background:var(--slate-soft);flex:none"></div>'}
    <div style="min-width:0;flex:1"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="hint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((p.seo && p.seo.keyword) || 'no keyword yet')}${p.deskPosted || p.lastPosted ? ' · posted ' + soAgo(Math.max(p.deskPosted, p.lastPosted)) : ''}</div></div>
    ${sc != null ? `<span class="pill ${sc >= 80 ? 'green' : ''}" title="TrendSEO score">${sc}</span>` : ''}</div>`; }).join('') || '<div class="empty" style="padding:24px">No products. Press <b>Sync products</b>.</div>';
  $('#so-list').onclick = e => { const r = e.target.closest('[data-id]'); if (r) soPick(+r.dataset.id); };
}
async function soPick(id) {
  SOCur = SOList.products.find(p => p.id === id); SOPack = null; SORes = null; SOEdit = {}; soDrawList();
  $('#so-det').innerHTML = `<div class="card pad"><div class="hint">Writing posts for “${esc(SOCur.name)}”… (reads today’s trending tags, about 10 seconds the first time)</div></div>`;
  try {
    SOPack = await api('/social/pack/' + id);
    SOSel = new Set(SO.platforms.filter(p => p.on).map(p => p.key));
    for (const [k, v] of Object.entries(SOPack.platforms)) SOEdit[k] = { title: v.title, text: v.text, hashtags: v.hashtags, keywords: v.keywords, link: v.link, images: SOPack.images };
    soDrawDet();
  } catch (e) { $('#so-det').innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
}
function soDrawDet() {
  if (!SOPack) return; const P = SOPack.product, seo = P.seo || {};
  $('#so-det').innerHTML = `<div class="card pad"><div class="row" style="gap:14px;align-items:flex-start">${P.image ? `<img src="${esc(P.image)}" width="86" height="86" style="object-fit:cover;border-radius:12px;flex:none">` : ''}
    <div style="min-width:0;flex:1"><div class="h3" style="margin:0">${esc(P.name)}</div><div class="hint">${esc(P.priceText || '')} · <a href="${esc(P.url)}" target="_blank" rel="noopener">open on shop</a></div>
    <div style="margin-top:6px"><b>SEO title:</b> ${esc(seo.title)} ${seo.has_title ? '' : '<span class="pill">not set by TrendSEO yet</span>'}</div>
    <div><b>SEO description:</b> ${esc(seo.desc)} ${seo.has_desc ? '' : '<span class="pill">not set yet</span>'}</div>
    <div><b>Keywords:</b> ${esc((seo.keywords || []).join(', ') || SOPack.keyword || '—')}</div>
    <div><b>Hashtags:</b> ${esc((seo.hashtags || []).join(' ') || '—')}</div></div></div>
    ${seo.has_title && seo.has_desc ? '' : '<div class="hint" style="margin-top:8px">Tip: in WordPress run TrendSEO Pro → Product Audit → Optimize on this product for a stronger title, description and hashtags, then press Sync products.</div>'}</div>
  <div class="card pad" style="margin-top:12px"><div class="h3">Post to</div><div class="chips">${SO.platforms.map(p => `<label class="chk" style="margin:0 12px 6px 0"><input type="checkbox" data-pl="${p.key}" ${SOSel.has(p.key) ? 'checked' : ''}><span>${esc(p.label)}</span></label>`).join('')}</div></div>
  <div id="so-blocks"></div>
  <div class="card pad" style="margin-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="so-post" ${SOBusy ? 'disabled' : ''}>${ic('send')} Post now</button>
    <span class="hint">or</span><input type="datetime-local" id="so-when" value="${new Date(Date.now() + 3600e3 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"><button class="btn" id="so-sched">Schedule</button></div>
    <div id="so-res" style="margin-top:10px"></div></div>`;
  $$('#so-det [data-pl]').forEach(c => c.onchange = () => { c.checked ? SOSel.add(c.dataset.pl) : SOSel.delete(c.dataset.pl); soBlocks(); });
  $('#so-post').onclick = () => soGo(false); $('#so-sched').onclick = () => soGo(true); soBlocks(); soRes();
}
function soBlocks() {
  $('#so-blocks').innerHTML = SO.platforms.filter(p => SOSel.has(p.key) && SOEdit[p.key]).map(p => { const e = SOEdit[p.key];
    return `<div class="card pad" style="margin-top:12px" data-b="${p.key}"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="h3" style="margin:0">${esc(p.label)}</div><span class="hint">${esc(SO_MODE[p.mode])}</span></div>
      ${p.mode === 'plugin' ? '<div class="hint" style="margin:4px 0 8px">Your shop writes and posts its own version (with a video when it can). The text below is for copy / paste or to see what will go out; edits here are not sent.</div>' : ''}
      ${p.mode === 'webhook' && !p.webhook ? '<div class="notice" style="margin:6px 0">No webhook address yet. Add it under Platforms &amp; automation.</div>' : ''}
      <div class="field"><label>Title <span class="hint" data-n="t">${e.title.length}</span></label><input type="text" data-f="title" value="${esc(e.title)}"></div>
      <div class="field"><label>Description / caption <span class="hint" data-n="x">${e.text.length}</span></label><textarea data-f="text" rows="${Math.min(12, Math.max(4, e.text.split('\n').length + 1))}" style="width:100%">${esc(e.text)}</textarea></div>
      <div class="hint"><b>Hashtags:</b> ${esc((e.hashtags || []).join(' ') || '—')}</div><div class="hint"><b>Keywords / tags:</b> ${esc((e.keywords || []).join(', ') || '—')}</div>
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-c="post">Copy post</button><button class="btn sm ghost" data-c="title">Copy title</button><button class="btn sm ghost" data-c="tags">Copy hashtags</button><button class="btn sm ghost" data-c="kw">Copy keywords</button>${p.open ? `<a class="btn sm ghost" href="${esc(p.open)}" target="_blank" rel="noopener">Open ${esc(p.label)}</a>` : ''}</div></div>`; }).join('');
  $$('#so-blocks [data-b]').forEach(b => {
    const k = b.dataset.b; b.oninput = ev => { const f = ev.target.dataset.f; if (!f) return; SOEdit[k][f] = ev.target.value; b.querySelector(`[data-n="${f === 'title' ? 't' : 'x'}"]`).textContent = ev.target.value.length; };
    b.onclick = ev => { const c = ev.target.closest('[data-c]'); if (!c) return; const e = SOEdit[k]; soCopy({ post: e.text, title: e.title, tags: (e.hashtags || []).join(' '), kw: (e.keywords || []).join(', ') }[c.dataset.c]); };
  });
}
function soRes() {
  const r = SORes; $('#so-res').innerHTML = r ? r.map(x => `<div class="row" style="gap:8px;margin-top:4px">${soPill(x.status)} <b>${esc(x.label)}</b> <span class="hint">${esc(x.message || '')}</span></div>`).join('') : '';
}
async function soGo(later) {
  const items = SO.platforms.filter(p => SOSel.has(p.key) && SOEdit[p.key]).map(p => ({ platform: p.key, ...SOEdit[p.key] }));
  if (!items.length) return toast('Tick at least one platform', true);
  try {
    if (later) { const t = new Date($('#so-when').value).getTime(); await api('/social/schedule', { method: 'POST', body: { productId: SOCur.id, items, runAt: t } }); toast('Scheduled'); SO = await api('/social'); return; }
    if (!await gconfirm(`Post “${SOCur.name}” to ${items.map(i => SO.platforms.find(p => p.key === i.platform).label).join(', ')} now?`)) return;
    SOBusy = true; $('#so-post').disabled = true; $('#so-res').innerHTML = '<div class="hint">Posting… this can take a few minutes when a video is rendered.</div>';
    const r = await api('/social/post', { method: 'POST', body: { productId: SOCur.id, items } }); SORes = r.results; SO = await api('/social'); toast('Done');
  } catch (e) { toast(e.message, true); }
  SOBusy = false; if ($('#so-post')) { $('#so-post').disabled = false; soRes(); }
}

// ---------- queue + history ----------
function soQueue() {
  const q = SO.queue || [], h = SO.history || [];
  $('#so-pane').innerHTML = `<div class="card pad"><div class="h3">Scheduled</div>${q.length ? `<table class="tbl"><thead><tr><th>When</th><th>Product</th><th>Platforms</th><th>Status</th><th></th></tr></thead><tbody>${q.map(x => `<tr><td>${new Date(x.runAt).toLocaleString()}</td><td>${esc(x.name)}</td><td>${esc((x.platforms || []).join(', '))}</td><td>${soPill(x.status)}${(x.results || []).filter(r => r.status === 'failed').map(r => `<div class="hint">${esc(r.label)}: ${esc(r.message)}</div>`).join('')}</td><td>${x.status === 'pending' ? `<button class="btn sm ghost danger" data-x="${x.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="hint">Nothing scheduled.</div>'}</div>
  <div class="card pad" style="margin-top:12px"><div class="row" style="justify-content:space-between"><div class="h3" style="margin:0">History</div><button class="btn sm" id="so-plog">Show shop log</button></div>
  ${h.length ? h.map(x => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div><b>${esc(x.name)}</b> <span class="hint">${new Date(x.at).toLocaleString()} · ${esc(x.source)}</span></div>${x.results.map(r => `<div class="row" style="gap:8px;margin-top:3px">${soPill(r.status)} ${esc(r.label)} <span class="hint">${esc(r.message || '')}</span></div>`).join('')}</div>`).join('') : '<div class="hint" style="margin-top:8px">No posts yet.</div>'}<div id="so-plogout"></div></div>`;
  $('#so-pane').onclick = async e => { const c = e.target.closest('[data-x]'); if (c) { try { await api('/social/queue/' + c.dataset.x, { method: 'DELETE' }); SO = await api('/social'); soQueue(); } catch (er) { toast(er.message, true); } } };
  $('#so-plog').onclick = async () => { try { const r = await api('/social/log'); $('#so-plogout').innerHTML = `<div class="h3" style="margin-top:14px">Shop log (TrendSEO Pro)</div>` + (r.rows.map(x => `<div style="padding:6px 0;border-top:1px solid var(--line)">${soPill(x.status)} <b>${esc(x.platform)}</b> product #${esc(x.product_id)} <span class="hint">${esc(x.created)} · ${esc(x.message || '')}</span></div>`).join('') || '<div class="hint">Empty.</div>'); } catch (er) { toast(er.message, true); } };
}

// ---------- platforms + automation ----------
let SOCfg = null, SOChats = [];
async function soPlatforms(reuse) {
  if (!reuse || !SOCfg) SOCfg = JSON.parse(JSON.stringify({ platforms: SO.platforms, waTargets: SO.waTargets, waDelay: SO.waDelay, auto: SO.auto }));
  if (!reuse || !SOChats.length) { try { SOChats = (await api('/social/chats')).chats; } catch { SOChats = []; } }
  const A = SOCfg.auto;
  $('#so-pane').innerHTML = `<div class="card pad"><div class="h3">Platforms</div><div class="hint" style="margin-bottom:8px">Choose how each platform is posted. <b>Posted by your shop</b> uses the logins saved in TrendSEO Pro (Facebook Page, Instagram, YouTube, and webhooks for TikTok / Snapchat / Pinterest). <b>Webhook</b> sends exactly the text you see here to any service that accepts JSON (Zapier, Make, n8n, Buffer…), which can then post to TikTok, Snapchat, X, LinkedIn, Telegram or anything else. <b>By hand</b> gives copy buttons and opens the platform.</div>
    <div id="so-plrows">${SOCfg.platforms.map((p, i) => `<div class="grid" style="grid-template-columns:auto 1.1fr 1.3fr 2fr auto;gap:8px;align-items:center;margin-bottom:8px" data-i="${i}"><input type="checkbox" data-k="on" ${p.on ? 'checked' : ''} title="Ticked by default when writing a post"><input type="text" data-k="label" value="${esc(p.label)}" ${p.builtin ? 'disabled' : ''}>
      <select data-k="mode">${Object.entries(SO_MODE).filter(([m]) => (m !== 'plugin' || SO.pluginKeys.includes(p.key)) && (m !== 'whatsapp' || p.key === 'whatsapp')).map(([m, l]) => `<option value="${m}" ${p.mode === m ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input type="text" data-k="webhook" value="${esc(p.webhook)}" placeholder="${p.mode === 'webhook' ? 'https://hooks.zapier.com/…' : p.mode === 'plugin' ? 'set the webhook in TrendSEO for TikTok / Snapchat' : ''}" ${p.mode === 'webhook' ? '' : 'disabled'}>${p.builtin ? '<span></span>' : '<button class="btn sm ghost danger" data-del="1">' + ic('trash') + '</button>'}</div>`).join('')}</div>
    <button class="btn sm" id="so-addpl">${ic('plus')} Add another platform</button></div>
  <div class="card pad" style="margin-top:12px"><div class="h3">WhatsApp: where to send posts</div><div class="hint">Product posts are sent as a picture + caption from your linked number to the chats and groups you tick. Messages are sent one by one with a pause, so WhatsApp does not mistake it for spam. Only send to people who expect your messages.</div>
    <input type="search" id="so-cq" style="width:100%" placeholder="Search chats and groups…" style="margin:8px 0"><div id="so-chats" style="max-height:220px;overflow:auto"></div>
    <div class="field" style="max-width:260px;margin-top:8px"><label>Pause between messages (seconds)</label><input type="number" id="so-delay" min="2" max="60" value="${SOCfg.waDelay}"></div></div>
  <div class="card pad" style="margin-top:12px"><div class="h3">Daily auto-posting</div><label class="chk"><input type="checkbox" id="so-aon" ${A.on ? 'checked' : ''}><span><b>Post products automatically every day</b></span></label>
    <div class="hint" style="margin:4px 0 8px">Each day the desk picks the products that were posted longest ago (in stock, with a picture), writes fresh posts from their SEO data and posts them to the platforms ticked below.</div>
    <div class="row" style="gap:12px;flex-wrap:wrap"><div class="field"><label>Around (hour, 0-23)</label><input type="number" id="so-ah" min="0" max="23" value="${A.hour}" style="width:90px"></div><div class="field"><label>Products per day</label><input type="number" id="so-an" min="1" max="5" value="${A.perDay}" style="width:90px"></div></div>
    <div class="chips" id="so-ap">${SOCfg.platforms.map(p => `<label class="chk" style="margin:0 12px 6px 0"><input type="checkbox" data-ap="${p.key}" ${A.platforms.includes(p.key) ? 'checked' : ''}><span>${esc(p.label)}</span></label>`).join('')}</div></div>
  <div style="margin-top:12px"><button class="btn primary" id="so-pls">Save</button></div>`;
  soChatList('');
  $('#so-cq').oninput = e => soChatList(e.target.value);
  $('#so-plrows').onchange = e => { const r = e.target.closest('[data-i]'); if (!r) return; const p = SOCfg.platforms[+r.dataset.i], k = e.target.dataset.k; if (!k) return; p[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'mode') { soReadRows(); soPlatforms(true); } };
  $('#so-plrows').onclick = e => { const d = e.target.closest('[data-del]'); if (d) { soReadRows(); SOCfg.platforms.splice(+d.closest('[data-i]').dataset.i, 1); soPlatforms(true); } };
  $('#so-addpl').onclick = async () => { soReadRows(); const n = String(await gprompt('Name of the platform (for example X, LinkedIn, Telegram)', '') || '').trim(); if (!n) return; SOCfg.platforms.push({ key: n.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'other' + SOCfg.platforms.length, label: n, mode: 'webhook', webhook: '', on: true, open: '', builtin: false }); soPlatforms(true); };
  $('#so-pls').onclick = async () => {
    soReadRows();
    try { SO = await api('/social', { method: 'PUT', body: SOCfg }); toast('Saved'); SOCfg = null; soPlatforms(); } catch (e) { toast(e.message, true); }
  };
}
function soReadRows() { $$('#so-plrows [data-i]').forEach(r => { const p = SOCfg.platforms[+r.dataset.i]; $$('[data-k]', r).forEach(i => { p[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; }); }); const g = id => $(id); if (g('#so-delay')) { SOCfg.waDelay = +g('#so-delay').value; Object.assign(SOCfg.auto, { on: g('#so-aon').checked, hour: +g('#so-ah').value, perDay: +g('#so-an').value }); } SOCfg.auto.platforms = $$('[data-ap]').filter(c => c.checked).map(c => c.dataset.ap); }
function soChatList(q) {
  const k = q.trim().toLowerCase(), set = new Set(SOCfg.waTargets), all = [...SOChats, ...SOCfg.waTargets.filter(t => !SOChats.some(c => c.phone === t)).map(t => ({ phone: t, name: t, isGroup: false }))];
  $('#so-chats').innerHTML = all.filter(c => !k || (c.name + c.phone).toLowerCase().includes(k)).map(c => `<label class="chk" style="margin:2px 0"><input type="checkbox" data-ph="${esc(c.phone)}" ${set.has(c.phone) ? 'checked' : ''}><span>${c.isGroup ? '👥 ' : ''}${esc(c.name)} <span class="hint">${c.isGroup ? 'group' : '+' + esc(c.phone)}</span></span></label>`).join('') || '<div class="hint">No chats yet. Chats and groups appear here after they have written to the desk.</div>';
  $('#so-chats').onchange = e => { const ph = e.target.dataset.ph; if (!ph) return; const s = new Set(SOCfg.waTargets); e.target.checked ? s.add(ph) : s.delete(ph); SOCfg.waTargets = [...s]; };
}
