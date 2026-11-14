/* Social posting (admin): products + SEO title / description / keywords / hashtags come from the TrendSEO Pro plugin on the WordPress shop.
   Write or tweak a post per platform, then post now, schedule it, or let the desk post a few products every day.
   Loaded after app.js (viewSocial is called by renderView). */
let SO = null, SOT = 'compose', SOQ = '', SOF = '', SOList = { products: [], total: 0, all: 0 }, SOCur = null, SOPack = null, SOEdit = {}, SOSel = new Set(), SORes = null, SOBusy = false, SOMedia = { images: [], video: 'none', videoUrl: '', videoName: '' }, SOUp = '';
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
  $('#so-pane').insertAdjacentHTML('beforeend', '<div class="card pad" id="so-fb" style="margin-top:14px"></div>'); soFb(); $('#so-pane').insertAdjacentHTML('beforeend', '<div class="card pad" id="so-yt" style="margin-top:14px"></div>'); soYt();
}

// ---------- Continue with Facebook ----------
// Sign in on Facebook, tick the Page: the desk hands the connection to your shop, which posts. No token pasting.
let SOFb = null, SOFbState = '';
async function soFb() {
  const host = $('#so-fb'); if (!host) return;
  try { SOFb = await api('/social/fb' + (SOFbState ? '?state=' + SOFbState : '')); } catch (e) { host.innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  const F = SOFb, red = F.redirect || (location.origin + '/api/social/fb/callback'), shop = SO.connected;
  let h = '<div class="h3">Facebook Page: sign in</div>';
  if (F.pages && F.pages.length) {
    h += `<div class="hint" style="margin-bottom:8px">Signed in. Which Page should the desk post to?</div>` + F.pages.map(p => `<label class="chk" style="margin:4px 0"><input type="radio" name="so-fbp" value="${esc(p.id)}"><span><b>${esc(p.name)}</b>${p.ig ? ` <span class="hint">with Instagram @${esc(p.ig)}</span>` : ''}</span></label>`).join('') + '<div style="margin-top:8px"><button class="btn primary" id="so-fbsel">Use this Page</button></div>';
  } else if (F.pageId) {
    h += `<div class="hint"><span class="pulse"></span> Connected to <b>${esc(F.pageName)}</b>${F.igName ? ` and Instagram <b>@${esc(F.igName)}</b>` : ''}${F.user ? ` (signed in as ${esc(F.user)})` : ''}. Posts to Facebook use this Page.</div>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn" id="so-fbgo">Sign in again / change Page</button><button class="btn ghost danger" id="so-fbx">Disconnect</button></div>`;
  } else {
    h += `<div class="hint" style="margin-bottom:8px">Click <b>Continue with Facebook</b>, sign in on Facebook, tick your Page. The desk connects it to your shop; nothing to copy or paste.</div>
      <div class="row" style="gap:8px"><button class="btn primary" id="so-fbgo" ${F.appId && F.hasSecret && F.redirect && shop ? '' : 'disabled'}>Continue with Facebook</button>${shop ? '' : '<span class="hint">Connect your shop above first.</span>'}</div>`;
  }
  h += `<details style="margin-top:12px" ${F.appId && F.hasSecret ? '' : 'open'}><summary style="cursor:pointer"><b>One-time Facebook app setup</b> <span class="hint">(5 minutes, free, no review for your own Page)</span></summary>
    <ol class="hint" style="padding-left:18px;line-height:1.8"><li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → <b>Create app</b> → use case <b>Other</b> → type <b>Business</b>.</li>
    <li>In the app add the product <b>Facebook Login for Business</b> (or <b>Facebook Login</b>) → Settings → <b>Valid OAuth Redirect URIs</b>: paste <code>${esc(red)}</code></li>
    <li>App settings → Basic: copy the <b>App ID</b> and <b>App Secret</b> into the boxes below. Keep the app in <b>Development</b> mode; you (the app admin) can post to Pages you manage.</li></ol>
    <div class="grid g2" style="gap:8px"><div class="field"><label>App ID</label><input type="text" id="so-fbid" value="${esc(F.appId)}"></div><div class="field"><label>App Secret</label><input type="password" id="so-fbsec" placeholder="${F.hasSecret ? '•••••••• (saved, leave blank to keep)' : ''}" autocomplete="off"></div></div>
    <div class="field"><label>This desk's secure address (https)</label><input type="text" id="so-fbpub" value="${esc(F.publicUrl || (location.protocol === 'https:' ? location.origin : ''))}" placeholder="https://desk.your-company.com"></div>
    <button class="btn" id="so-fbsave">Save app details</button></details>`;
  host.innerHTML = h;
  const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
  on('#so-fbsave', async () => { try { SOFb = await api('/social/fb', { method: 'PUT', body: { appId: $('#so-fbid').value, appSecret: $('#so-fbsec').value, publicUrl: $('#so-fbpub').value } }); toast('Saved'); soFb(); } catch (e) { toast(e.message, true); } });
  on('#so-fbgo', async () => {
    try { const r = await api('/social/fb/login', { method: 'POST', body: {} }); const w = window.open(r.url, 'fblogin', 'width=620,height=720'); if (!w) location.href = r.url; } catch (e) { toast(e.message, true); }
  });
  on('#so-fbsel', async () => { const v = ($('input[name=so-fbp]:checked') || {}).value; if (!v) return toast('Choose a Page', true); try { await api('/social/fb/select', { method: 'POST', body: { state: F.pendingState, pageId: v } }); SOFbState = ''; toast('Facebook Page connected'); SO = await api('/social'); soConnect(); } catch (e) { toast(e.message, true); } });
  on('#so-fbx', async () => { if (!await gconfirm('Disconnect the Facebook Page? Posts to Facebook stop until you connect again.')) return; try { await api('/social/fb/disconnect', { method: 'POST', body: {} }); SOFbState = ''; SO = await api('/social'); soConnect(); } catch (e) { toast(e.message, true); } });
}
window.addEventListener('message', async e => { if (e.origin !== location.origin || !e.data || e.data.fb === undefined) return; if (!e.data.fb) { toast('Facebook sign-in did not finish', true); return; } SOFbState = e.data.state || ''; try { SO = await api('/social'); } catch { } if ($('#so-fb')) { if (SOFbState && !SO.pluginPlatforms) { } soConnect(); } });

// ---------- compose ----------
async function soCompose() {
  $('#so-pane').innerHTML = `<div class="grid" style="grid-template-columns:minmax(260px,340px) 1fr;gap:14px;align-items:start"><div class="card pad" style="padding:12px"><div class="row" style="gap:6px"><input type="text" id="so-q" style="flex:1;min-width:0" placeholder="Search products…" value="${esc(SOQ)}"><select id="so-f"><option value="">All</option><option value="unposted" ${SOF === 'unposted' ? 'selected' : ''}>Never posted</option><option value="poor" ${SOF === 'poor' ? 'selected' : ''}>SEO needs work</option><option value="optimized" ${SOF === 'optimized' ? 'selected' : ''}>Optimized</option></select></div><div class="hint" id="so-cnt" style="margin:6px 2px"></div><div id="so-list" style="max-height:68vh;overflow:auto"></div></div><div id="so-det"><div class="card pad"><div class="empty" style="padding:40px">Choose a product on the left.</div></div></div></div>`;
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
  SOCur = SOList.products.find(p => p.id === id); SOPack = null; SORes = null; SOEdit = {}; SOOpen = new Set(); soDrawList();
  $('#so-det').innerHTML = `<div class="card pad"><div class="hint">Writing posts for “${esc(SOCur.name)}”… (reads today’s trending tags, about 10 seconds the first time)</div></div>`;
  try {
    SOPack = await api('/social/pack/' + id);
    SOSel = new Set(SO.platforms.filter(p => p.on).map(p => p.key));
    for (const [k, v] of Object.entries(SOPack.platforms)) SOEdit[k] = { title: v.title, text: v.text, hashtags: v.hashtags, keywords: v.keywords, link: v.link, suggested: v.suggested || v.hashtags || [], images: SOPack.images };
    const pics = [...new Set([SOCur.image, ...(SOPack.images || [])].filter(Boolean))].slice(0, 10);
    SOMedia = { images: pics.map((u, i) => ({ url: u, on: i === 0, own: false })), video: 'none', videoUrl: '', videoName: '' }; SOUp = '';
    soDrawDet();
  } catch (e) { $('#so-det').innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
}
function soDrawDet() {
  if (!SOPack) return; const P = SOPack.product, seo = P.seo || {};
  $('#so-det').innerHTML = `<div class="card pad"><div class="row" style="gap:14px;align-items:flex-start">${(P.image || (SOPack.images || [])[0]) ? `<img src="${esc(P.image || SOPack.images[0])}" width="86" height="86" style="object-fit:cover;border-radius:12px;flex:none" alt="">` : '<div class="hint" style="width:86px;height:86px;flex:none;display:grid;place-items:center;text-align:center;border:1px dashed var(--line-2);border-radius:12px">No picture</div>'}
    <div style="min-width:0;flex:1"><div class="h3" style="margin:0">${esc(P.name)}</div><div class="hint">${esc(P.priceText || '')} · <a href="${esc(P.url)}" target="_blank" rel="noopener">open on shop</a></div>
    <div style="margin-top:6px"><b>SEO title:</b> ${esc(seo.title)} ${seo.has_title ? '' : '<span class="pill">not set by TrendSEO yet</span>'}</div>
    <div><b>SEO description:</b> ${esc(seo.desc)} ${seo.has_desc ? '' : '<span class="pill">not set yet</span>'}</div>
    <div><b>Keywords:</b> ${esc((seo.keywords || []).join(', ') || SOPack.keyword || '—')}</div>
    <div><b>Hashtags:</b> ${esc((seo.hashtags || []).join(' ') || '—')}</div></div></div>
    ${seo.has_title && seo.has_desc ? '' : '<div class="hint" style="margin-top:8px">Tip: in WordPress run TrendSEO Pro → Product Audit → Optimize on this product for a stronger title, description and hashtags, then press Sync products.</div>'}</div>
  <div class="card pad" style="margin-top:12px"><div class="h3">Post to</div><div class="chips">${SO.platforms.map(p => `<label class="chk" style="margin:0 12px 6px 0"><input type="checkbox" data-pl="${p.key}" ${SOSel.has(p.key) ? 'checked' : ''}><span>${esc(p.label)}</span></label>`).join('')}</div></div>
  <div id="so-media"></div>
  <div id="so-blocks"></div>
  <div class="card pad" style="margin-top:12px"><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="so-post" ${SOBusy ? 'disabled' : ''}>${ic('send')} Post now</button>
    <span class="hint">or</span><input type="datetime-local" id="so-when" value="${new Date(Date.now() + 3600e3 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"><button class="btn" id="so-sched">Schedule</button></div>
    <div id="so-res" style="margin-top:10px"></div></div>`;
  $$('#so-det [data-pl]').forEach(c => c.onchange = () => { c.checked ? SOSel.add(c.dataset.pl) : SOSel.delete(c.dataset.pl); soMedia(); soBlocks(); });
  $('#so-post').onclick = () => soGo(false); $('#so-sched').onclick = () => soGo(true); soMedia(); soBlocks(); soRes();
}
let SOOpen = new Set();
// ---------- pictures + video for the post ----------
// Pictures start as the product's own pictures from WordPress (the main one ticked); tick more, or add your own. Video: none, the shop's automatic slideshow, or your own file.
const soPicked = () => SOMedia.images.filter(i => i.on).map(i => i.url);
const soVideoValue = () => SOMedia.video === 'mine' ? SOMedia.videoUrl : SOMedia.video;
function soMedia() {
  const M = SOMedia, host = $('#so-media'); if (!host) return; const sel = SOSel, labels = SO.platforms.filter(p => sel.has(p.key)).map(p => p.key);
  const nPics = soPicked().length, hasVid = soVideoValue() && soVideoValue() !== 'none';
  const notes = [];
  if (sel.has('facebook') && nPics && hasVid) notes.push('Facebook cannot put pictures and a video in one post, so your Page gets <b>two posts</b>: the pictures (as one multi-picture post) and the video, both with the same text.');
  if (sel.has('facebook') && nPics > 1 && !hasVid) notes.push(`Facebook will publish <b>one post with ${nPics} pictures</b>.`);
  if (sel.has('instagram') && nPics > 1) notes.push('Instagram posts the first ticked picture (or the video as a Reel).');
  if ((sel.has('youtube') || sel.has('tiktok')) && !hasVid) notes.push('YouTube and TikTok need a video: choose a video below, or they are skipped.');
  host.innerHTML = `<div class="card pad" style="margin-top:12px"><div class="h3">Pictures &amp; video</div>
    <div class="hint" style="margin-bottom:8px">These are the product’s own pictures from your shop. Tick the ones to post, and add your own if you like.</div>
    <div class="row" style="gap:8px;flex-wrap:wrap">${M.images.map((im, i) => `<label style="position:relative;cursor:pointer;display:block;width:88px;height:88px;border-radius:10px;overflow:hidden;outline:${im.on ? '3px solid var(--green,#16a34a)' : '1px solid var(--line-2)'};outline-offset:-1px"><img src="${esc(im.url)}" style="width:100%;height:100%;object-fit:cover;opacity:${im.on ? 1 : .45}" alt=""><input type="checkbox" data-pi="${i}" ${im.on ? 'checked' : ''} style="position:absolute;top:5px;left:5px">${im.own ? '<span class="pill" style="position:absolute;bottom:4px;right:4px;font-size:10px">yours</span>' : ''}</label>`).join('')}
      <label class="btn sm" style="align-self:center;cursor:pointer">${ic('plus')} Add pictures<input type="file" id="so-addpic" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden></label></div>
    <div class="h3" style="margin-top:14px">Video</div>
    <div style="display:grid;gap:4px"><label class="chk"><input type="radio" name="so-vid" value="none" ${M.video === 'none' ? 'checked' : ''}><span>No video</span></label>
      <label class="chk"><input type="radio" name="so-vid" value="auto" ${M.video === 'auto' ? 'checked' : ''}><span>Make a slideshow video from the product pictures <span class="hint">(your shop renders it with FFmpeg; can take a minute)</span></span></label>
      <label class="chk"><input type="radio" name="so-vid" value="mine" ${M.video === 'mine' ? 'checked' : ''}><span>Use my own video ${M.videoUrl ? `<span class="pill green">${esc(M.videoName || 'uploaded')}</span>` : ''}</span></label></div>
    <div style="margin:6px 0 0 24px;display:${M.video === 'mine' ? 'block' : 'none'}"><label class="btn sm" style="cursor:pointer">${M.videoUrl ? 'Replace video' : 'Choose video'}<input type="file" id="so-addvid" accept="video/mp4,video/quicktime,video/webm" hidden></label> <span class="hint">MP4 or MOV, up to 150 MB</span></div>
    ${SOUp ? `<div class="hint" style="margin-top:8px"><span class="pulse"></span> ${esc(SOUp)}</div>` : ''}
    ${notes.map(n => `<div class="hint" style="margin-top:8px">ℹ️ ${n}</div>`).join('')}</div>`;
  host.onchange = e => {
    const t = e.target;
    if (t.dataset.pi !== undefined) { SOMedia.images[+t.dataset.pi].on = t.checked; soMedia(); }
    else if (t.name === 'so-vid') { SOMedia.video = t.value; soMedia(); }
    else if (t.id === 'so-addpic') soUpload([...t.files], 'image');
    else if (t.id === 'so-addvid') soUpload([...t.files].slice(0, 1), 'video');
  };
}
async function soUpload(files, kind) {
  for (const f of files) {
    SOUp = `Uploading ${f.name} to your shop… ${kind === 'video' ? '(videos can take a while)' : ''}`; soMedia();
    try {
      const r = await fetch('/api/social/upload?name=' + encodeURIComponent(f.name), { method: 'POST', headers: { Authorization: 'Bearer ' + S.token, 'Content-Type': f.type || 'application/octet-stream' }, body: f });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Upload failed');
      if (j.type === 'video') { SOMedia.video = 'mine'; SOMedia.videoUrl = j.url; SOMedia.videoName = f.name; }
      else SOMedia.images.push({ url: j.url, on: true, own: true });
    } catch (e) { toast(e.message, true); }
  }
  SOUp = ''; soMedia();
}
function soBlocks() {
  const img = soPicked()[0] || (SOPack && SOPack.images && SOPack.images[0]) || (SOPack && SOPack.product.image) || '';
  $('#so-blocks').innerHTML = `<div class="card pad" style="margin-top:12px;padding:6px 14px"><div class="hint" style="margin:8px 0 4px">Tap a platform to see / edit its post, copy it, or check how it is sent.</div>` + SO.platforms.filter(p => SOSel.has(p.key) && SOEdit[p.key]).map(p => { const e = SOEdit[p.key], open = SOOpen.has(p.key);
    return `<div data-b="${p.key}" style="border-top:1px solid var(--line)"><button type="button" data-tg="1" style="all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 2px"><span style="width:14px;display:inline-block;transition:.15s;transform:rotate(${open ? 90 : 0}deg)">▸</span><b style="flex:1">${esc(p.label)}</b><span class="hint">${esc(SO_MODE[p.mode])}</span></button>
      <div style="display:${open ? 'block' : 'none'};padding:0 2px 14px">
      ${p.mode === 'plugin' ? '<div class="hint" style="margin:0 0 8px">Your shop posts this text with the pictures and video chosen above, using its own login.</div>' : ''}
      ${p.mode === 'webhook' && !p.webhook ? '<div class="notice" style="margin:0 0 8px">No webhook address yet. Add it under Platforms &amp; automation.</div>' : ''}
      <div class="row" style="gap:12px;align-items:flex-start">${img ? `<img src="${esc(img)}" width="96" height="96" style="object-fit:cover;border-radius:10px;flex:none" alt="">` : '<div class="hint" style="width:96px;flex:none;text-align:center;padding:8px;border:1px dashed var(--line-2);border-radius:10px">No picture found</div>'}
      <div style="flex:1;min-width:0"><div class="field"><label>Title <span class="hint" data-n="t">${e.title.length}</span></label><input type="text" data-f="title" value="${esc(e.title)}"></div>
      <div class="field"><label>Description / caption <span class="hint" data-n="x">${e.text.length}</span></label><textarea data-f="text" rows="${Math.min(10, Math.max(4, e.text.split('\n').length + 1))}" style="width:100%">${esc(e.text)}</textarea></div></div></div>
      ${(e.suggested || []).length ? `<div style="margin:6px 0"><div class="hint"><b>Trending hashtags</b> for ${esc(p.label)} (from TrendSEO: Google Trends, YouTube, TikTok, search suggestions). Tap to add or remove:</div><div class="chips" data-tags="1" style="margin-top:4px">${e.suggested.map(t => `<button type="button" class="pill ${(e.text || '').includes(t) ? 'green' : ''}" data-ht="${esc(t)}" style="cursor:pointer;border:0">${esc(t)}</button>`).join('')}</div></div>` : `<div class="hint"><b>Hashtags:</b> ${esc((e.hashtags || []).join(' ') || '—')}</div>`}<div class="hint"><b>Keywords / tags:</b> ${esc((e.keywords || []).join(', ') || '—')}</div>
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-c="post">Copy post</button><button class="btn sm ghost" data-c="title">Copy title</button><button class="btn sm ghost" data-c="tags">Copy hashtags</button><button class="btn sm ghost" data-c="kw">Copy keywords</button>${p.open ? `<a class="btn sm ghost" href="${esc(p.open)}" target="_blank" rel="noopener">Open ${esc(p.label)}</a>` : ''}</div></div></div>`; }).join('') + '</div>';
  $$('#so-blocks [data-b]').forEach(b => {
    const k = b.dataset.b; b.oninput = ev => { const f = ev.target.dataset.f; if (!f) return; SOEdit[k][f] = ev.target.value; b.querySelector(`[data-n="${f === 'title' ? 't' : 'x'}"]`).textContent = ev.target.value.length; };
    b.onclick = ev => {
      if (ev.target.closest('[data-tg]')) { SOOpen.has(k) ? SOOpen.delete(k) : SOOpen.add(k); const body = b.lastElementChild, o = SOOpen.has(k); body.style.display = o ? 'block' : 'none'; b.querySelector('[data-tg] span').style.transform = `rotate(${o ? 90 : 0}deg)`; return; }
      const h = ev.target.closest('[data-ht]');
      if (h) { const e = SOEdit[k], t = h.dataset.ht, re = new RegExp('(^|\\s)' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'g'); e.text = re.test(e.text) ? e.text.replace(re, ' ').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim() : e.text.replace(/\s+$/, '') + (/#\S+\s*$/.test(e.text) ? ' ' : '\n\n') + t; const ta = b.querySelector('[data-f="text"]'); ta.value = e.text; b.querySelector('[data-n="x"]').textContent = e.text.length; h.classList.toggle('green'); return; }
      const c = ev.target.closest('[data-c]'); if (!c) return; const e = SOEdit[k]; soCopy({ post: e.text, title: e.title, tags: (e.hashtags || []).join(' '), kw: (e.keywords || []).join(', ') }[c.dataset.c]);
    };
  });
}
function soRes() {
  const r = SORes; $('#so-res').innerHTML = r ? r.map(x => `<div class="row" style="gap:8px;margin-top:4px">${soPill(x.status)} <b>${esc(x.label)}</b> <span class="hint">${esc(x.message || '')}</span></div>`).join('') : '';
}
async function soGo(later) {
  const items = SO.platforms.filter(p => SOSel.has(p.key) && SOEdit[p.key]).map(p => ({ platform: p.key, ...SOEdit[p.key] }));
  if (!items.length) return toast('Tick at least one platform', true);
  const media = { images: soPicked(), video: soVideoValue() || 'none' };
  if (SOMedia.video === 'mine' && !SOMedia.videoUrl) return toast('Choose your video first, or pick another video option', true);
  if (!media.images.length && media.video === 'none') return toast('Tick at least one picture or choose a video', true);
  try {
    if (later) { const t = new Date($('#so-when').value).getTime(); await api('/social/schedule', { method: 'POST', body: { productId: SOCur.id, items, runAt: t, media } }); toast('Scheduled'); SO = await api('/social'); return; }
    if (!await gconfirm(`Post “${SOCur.name}” to ${items.map(i => SO.platforms.find(p => p.key === i.platform).label).join(', ')} now?`)) return;
    SOBusy = true; $('#so-post').disabled = true; $('#so-res').innerHTML = '<div class="hint">Posting… this can take a few minutes when a video is rendered.</div>';
    const r = await api('/social/post', { method: 'POST', body: { productId: SOCur.id, items, media } }); SORes = r.results; SO = await api('/social'); toast('Done');
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
    <input type="text" id="so-cq" style="width:100%" placeholder="Search chats and groups…" style="margin:8px 0"><div id="so-chats" style="max-height:220px;overflow:auto"></div>
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

// ---------- Continue with Google (YouTube) ----------
async function soYt() {
  const host = $('#so-yt'); if (!host) return; let Y; try { Y = await api('/social/yt'); } catch (e) { host.innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  const red = Y.redirect || (location.origin + '/api/social/yt/callback'), ready = Y.clientId && Y.hasSecret && Y.redirect && SO.connected;
  host.innerHTML = `<div class="h3">YouTube: sign in with Google</div>` + (Y.channel ? `<div class="hint"><span class="pulse"></span> Connected to <b>${esc(Y.channel)}</b>. Videos you post (your own or the shop's slideshow) are uploaded there.</div><div class="row" style="gap:8px;margin-top:8px"><button class="btn" id="so-ytgo">Sign in again</button><button class="btn ghost danger" id="so-ytx">Disconnect</button></div>`
    : `<div class="hint" style="margin-bottom:8px">Click <b>Continue with Google</b>, choose your channel's account and allow uploads. YouTube needs a video, so choose one in <i>Pictures &amp; video</i> when posting.</div><button class="btn primary" id="so-ytgo" ${ready ? '' : 'disabled'}>Continue with Google</button>${SO.connected ? '' : ' <span class="hint">Connect your shop above first.</span>'}`)
    + `<details style="margin-top:12px" ${Y.clientId && Y.hasSecret ? '' : 'open'}><summary style="cursor:pointer"><b>One-time Google setup</b> <span class="hint">(free)</span></summary><ol class="hint" style="padding-left:18px;line-height:1.8"><li>Open <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a>, create a project and <b>Enable</b> “YouTube Data API v3”.</li><li>APIs &amp; Services → <b>OAuth consent screen</b>: type External, add yourself under <b>Test users</b>. (Testing mode is fine; Google asks you to sign in again every 7 days unless you press <b>Publish app</b>.)</li><li><b>Credentials → Create credentials → OAuth client ID</b> → Web application → Authorized redirect URI: <code>${esc(red)}</code></li><li>Paste the Client ID and secret below.</li></ol>
    <div class="grid g2" style="gap:8px"><div class="field"><label>Client ID</label><input type="text" id="so-ytid" value="${esc(Y.clientId)}"></div><div class="field"><label>Client secret</label><input type="password" id="so-ytsec" placeholder="${Y.hasSecret ? '•••••••• (saved)' : ''}" autocomplete="off"></div></div>
    <div class="field"><label>This desk's secure address (https)</label><input type="text" id="so-ytpub" value="${esc(Y.publicUrl || (location.protocol === 'https:' ? location.origin : ''))}"></div><button class="btn" id="so-ytsave">Save</button></details>`;
  const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
  on('#so-ytsave', async () => { try { await api('/social/yt', { method: 'PUT', body: { clientId: $('#so-ytid').value, clientSecret: $('#so-ytsec').value, publicUrl: $('#so-ytpub').value } }); toast('Saved'); soYt(); } catch (e) { toast(e.message, true); } });
  on('#so-ytgo', async () => { try { const r = await api('/social/yt/login', { method: 'POST', body: {} }); const w = window.open(r.url, 'ytlogin', 'width=620,height=720'); if (!w) location.href = r.url; } catch (e) { toast(e.message, true); } });
  on('#so-ytx', async () => { if (!await gconfirm('Disconnect YouTube?')) return; try { await api('/social/yt/disconnect', { method: 'POST', body: {} }); SO = await api('/social'); soConnect(); } catch (e) { toast(e.message, true); } });
}
window.addEventListener('message', async e => { if (e.origin !== location.origin || !e.data || e.data.yt === undefined) return; if (!e.data.yt) { toast('Google sign-in did not finish', true); return; } try { SO = await api('/social'); } catch { } if ($('#so-yt')) soConnect(); });
