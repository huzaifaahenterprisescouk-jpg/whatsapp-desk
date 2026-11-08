/* Store (WordPress / WooCommerce): products you can send on WhatsApp, the shop connection, and the order PDF design.
   Loaded after app.js (viewStore is called by renderView). */
Object.assign(ICONS, {
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.3"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
});
const WOO = { st: null, tab: 'products', q: '', ready: null, cur: '' };
const tokenQ = () => 'token=' + encodeURIComponent(S.token);
const fmtMoney = (v, cur) => { const n = +v; if (!isFinite(n) || v === '' || v == null) return ''; const sym = { USD: '$', GBP: '£', PKR: 'Rs ', EUR: '€' }[cur]; return (sym !== undefined ? sym : (cur ? cur + ' ' : '')) + n.toLocaleString(undefined, { maximumFractionDigits: 2 }); };
const wooAgo = t => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };

// ---------- links in the Orders table / customer panel ----------
function wooLinks(o) {
  if (!o || !o.woo) return '';
  return `<div class="wooact"><a href="#" data-woopdf="${esc(o.orderId)}" title="Open the PDF">${ic('pdf')} PDF</a><a href="#" data-woosend="${esc(o.orderId)}" title="Send the PDF to the customer on WhatsApp">Send on WhatsApp</a></div>`;
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-woopdf],[data-woosend]'); if (!a) return; e.preventDefault(); e.stopPropagation();
  if (a.dataset.woopdf) return void window.open(`/api/woo/order.pdf?id=${encodeURIComponent(a.dataset.woopdf)}&${tokenQ()}`, '_blank');
  const id = a.dataset.woosend; a.style.opacity = .5;
  try { const r = await api('/woo/send-pdf', { method: 'POST', body: { id } }); toast(`PDF for order ${id} sent to +${r.phone}`); } catch (err) { toast(err.message, true); }
  a.style.opacity = '';
});

// ---------- the Store page ----------
async function viewStore() {
  $('#main').innerHTML = `<div class="page">${pageHead('Store', 'Your WooCommerce shop: send products on WhatsApp, and the PDF every new order gets.', '')}<div id="st-body"><div class="empty">Loading…</div></div></div>`;
  try { WOO.st = isAdmin() ? await api('/woo') : null; } catch (e) { $('#st-body').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  stDraw();
}
function stDraw() {
  const admin = isAdmin(), st = WOO.st, tabs = [['products', 'Products'], ...(admin ? [['conn', 'Connection & PDF']] : [])];
  if (!admin) WOO.tab = 'products';
  $('#st-body').innerHTML = `<div class="tabs" style="margin-bottom:14px">${tabs.map(([k, l]) => `<button class="tab ${WOO.tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div id="st-tab"></div>`;
  $$('#st-body .tab').forEach(b => b.onclick = () => { WOO.tab = b.dataset.t; stDraw(); });
  WOO.tab === 'conn' ? stConn() : stProducts();
}

// ----- products -----
async function stProducts() {
  const el = $('#st-tab'); el.innerHTML = `<div class="row" style="margin-bottom:12px;gap:10px;flex-wrap:wrap"><div class="search" style="flex:1;min-width:220px">${ic('search')}<input type="search" id="pq" placeholder="Search products" value="${esc(WOO.q)}" autocomplete="off"></div><button class="btn sm" id="psync" ${isAdmin() ? '' : 'hidden'}>Sync now</button><span class="hint" id="pinfo"></span></div><div class="pgrid" id="pgrid"></div>`;
  const draw = async () => {
    let r; try { r = await api('/woo/products?q=' + encodeURIComponent(WOO.q)); } catch (e) { $('#pgrid').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
    WOO.cur = r.currency; WOO.ready = r.total > 0;
    $('#pinfo').textContent = r.total ? `${r.products.length < r.total ? r.products.length + ' of ' : ''}${r.total} products${WOO.st ? ' · synced ' + wooAgo(WOO.st.lastProducts) : ''}` : '';
    $('#pgrid').innerHTML = r.products.map(p => `<div class="pcard"><div class="pimg">${p.image ? `<img loading="lazy" src="${esc(p.image)}" alt="">` : ic('cart')}${p.onSale ? '<span class="pill amber sale">Sale</span>' : ''}</div>
      <div class="pb"><b title="${esc(p.name)}">${esc(p.name)}</b><div class="pp">${p.onSale && p.sale ? `<span>${esc(fmtMoney(p.sale, r.currency))}</span> <s>${esc(fmtMoney(p.regular, r.currency))}</s>` : `<span>${esc(fmtMoney(p.price, r.currency))}</span>`}</div>
      <div class="hint">${p.stock === 'outofstock' ? '<span style="color:#d93025">Out of stock</span>' : p.stock === 'onbackorder' ? 'On backorder' : 'In stock'}${p.sku ? ' · ' + esc(p.sku) : ''}</div>
      <button class="btn sm primary" data-send="${p.id}">${ic('fwd')} Send to a chat</button></div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${r.total ? 'No product matches your search.' : (isAdmin() ? 'No products yet. Open “Connection & PDF”, connect your shop and press Sync now.' : 'No products yet. Ask an administrator to connect the shop.')}</div>`;
    $$('#pgrid [data-send]').forEach(b => b.onclick = () => stPickChat(+b.dataset.send, r.products.find(x => x.id === +b.dataset.send)));
  };
  $('#pq').oninput = e => { WOO.q = e.target.value; clearTimeout(WOO.t); WOO.t = setTimeout(draw, 200); };
  if ($('#psync')) $('#psync').onclick = async e => { e.target.disabled = true; try { await api('/woo/sync', { method: 'POST', body: {} }); WOO.st = await api('/woo'); toast('Shop synced'); } catch (err) { toast(err.message, true); } e.target.disabled = false; draw(); };
  draw();
}
function stPickChat(pid, p) { // choose which customer chat receives this product
  const chats = S.convs.slice(0, 400);
  modal(`<h3>${ic('fwd')} Send “${esc(p ? p.name : 'product')}” to…</h3><div class="search wide" style="margin-bottom:8px">${ic('search')}<input type="search" id="cq" placeholder="Search a chat" autocomplete="off"></div><div class="pk-list" id="cl"></div><div class="acts"><button class="btn" id="cx">Cancel</button></div>`, (bg, close) => {
    const draw = () => { const k = $('#cq', bg).value.trim().toLowerCase(); $('#cl', bg).innerHTML = chats.filter(c => !k || (c.name + ' ' + c.phone).toLowerCase().includes(k)).slice(0, 60).map(c => `<button type="button" class="pk-row" data-p="${c.phone}"><span class="pk-av" style="background:${hue(c.phone)}">${esc(initials(c.name || c.phone))}</span><span class="pk-b"><b>${esc(c.name)}</b><small>+${esc(c.phone)}</small></span></button>`).join('') || '<div class="hint" style="padding:14px 4px">No chats found.</div>'; };
    $('#cq', bg).oninput = draw; draw(); $('#cq', bg).focus(); $('#cx', bg).onclick = close;
    $('#cl', bg).onclick = async e => { const b = e.target.closest('.pk-row'); if (!b) return; b.style.opacity = .5; try { const r = await api('/woo/send-product', { method: 'POST', body: { phone: b.dataset.p, productId: pid } }); close(); toast(r.as === 'catalog' ? 'Sent as a catalog card' : r.as === 'card' ? 'Product sent (picture, price and link)' : 'Product sent'); } catch (err) { toast(err.message, true); b.style.opacity = ''; } };
  });
}

// ----- products from inside a chat: a button in the chat header -----
function wooHeadBtn(th, c) {
  if (WOO.ready === null) { WOO.ready = false; api('/woo/products?q=zzzzzzzz').then(r => { WOO.ready = r.total > 0; if (WOO.ready && S.sel) renderThreadHead(); }).catch(() => {}); }
  if (!WOO.ready) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ib'; b.title = 'Send a product from the shop'; b.innerHTML = ic('cart'); b.onclick = () => stChatProducts(c.phone);
  const t = $('#infotg', th); t ? t.before(b) : th.appendChild(b); b.style.marginLeft = 'auto'; if (t) t.style.marginLeft = '0';
}
function stChatProducts(phone) {
  modal(`<h3>${ic('cart')} Send a product</h3><div class="search wide" style="margin-bottom:8px">${ic('search')}<input type="search" id="xq" placeholder="Search products" autocomplete="off"></div><div class="pk-list" id="xl"></div><div class="acts"><button class="btn" id="xc">Close</button></div>`, (bg, close) => {
    let t; const draw = async () => { let r; try { r = await api('/woo/products?q=' + encodeURIComponent($('#xq', bg).value) + '&limit=40'); } catch { return; }
      $('#xl', bg).innerHTML = r.products.map(p => `<button type="button" class="pk-row" data-id="${p.id}"><span class="pk-av prod">${p.image ? `<img src="${esc(p.image)}" alt="">` : ic('cart')}</span><span class="pk-b"><b>${esc(p.name)}</b><small>${esc(fmtMoney(p.onSale && p.sale ? p.sale : p.price, r.currency))}${p.stock === 'outofstock' ? ' · out of stock' : ''}</small></span><span class="btn sm primary">Send</span></button>`).join('') || '<div class="hint" style="padding:14px 4px">No products found.</div>'; };
    $('#xq', bg).oninput = () => { clearTimeout(t); t = setTimeout(draw, 200); }; draw(); $('#xq', bg).focus(); $('#xc', bg).onclick = close;
    $('#xl', bg).onclick = async e => { const b = e.target.closest('.pk-row'); if (!b) return; b.style.opacity = .5; try { const r = await api('/woo/send-product', { method: 'POST', body: { phone, productId: +b.dataset.id } }); toast(r.as === 'catalog' ? 'Sent as a catalog card' : 'Product sent'); close(); } catch (err) { toast(err.message, true); b.style.opacity = ''; } };
  });
}

// ----- connection, catalog and the PDF design (admin) -----
function stConn() {
  const w = WOO.st, b = w.brand, hook = location.origin + '/webhooks/woo', tok = tokenQ();
  const f = (id, label, val, ph = '', type = 'text', hint = '') => `<div class="field"><label for="${id}">${label}</label><input type="${type}" id="${id}" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off">${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  $('#st-tab').innerHTML = `
  <div class="grid g2" style="align-items:start">
   <div>
    <div class="card pad"><div class="h3">1 · Connect your WooCommerce shop</div>
      <div class="row" style="margin-bottom:8px"><span class="pulse ${w.connected && !w.lastError ? '' : 'demo'}"></span><b>${w.connected ? (w.lastError ? 'Connected, last sync failed' : 'Connected' + (w.storeName ? ' to ' + esc(w.storeName) : '')) : 'Not connected yet'}</b><span class="hint">${w.connected ? `· ${w.counts.orders} orders · ${w.counts.products} products · synced ${wooAgo(w.lastSync)}` : ''}</span></div>
      ${w.lastError ? `<div class="notice" style="margin-bottom:8px">${esc(w.lastError)}</div>` : ''}
      ${f('wu', 'Shop address', w.url, 'https://your-shop.com', 'text', 'The address of your WordPress site (the home page).')}
      ${f('wk', 'Consumer key', w.key, 'ck_…')}
      ${f('ws', 'Consumer secret', '', w.hasSecret ? '•••••••• (saved, type to replace)' : 'cs_…', 'password')}
      ${f('wm', 'Check for new orders every (minutes)', w.minutes, '5', 'number')}
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary sm" id="wsave">Save</button><button class="btn sm" id="wtest">Test connection</button><button class="btn sm" id="wsync">Sync now</button></div>
      <details style="margin-top:12px"><summary class="hint" style="cursor:pointer"><b>How do I get the key and secret?</b></summary><ol class="hint" style="margin:8px 0 0 18px;line-height:1.6"><li>In WordPress open <b>WooCommerce → Settings → Advanced → REST API</b> and press <b>Add key</b>.</li><li>Description “WhatsApp Desk”, user = an administrator, permissions <b>Read</b> (Read/Write only if you later want the desk to change orders).</li><li>Press <b>Generate API key</b> and copy the <b>Consumer key</b> and <b>Consumer secret</b> here.</li></ol></details>
    </div>
    <div class="card pad" style="margin-top:16px"><div class="h3">2 · Instant new orders (optional)</div>
      <div class="hint" style="margin-bottom:8px">Without this, new orders arrive within a few minutes. To get them at once: <b>WooCommerce → Settings → Advanced → Webhooks → Add webhook</b>, Status <b>Active</b>, Topic <b>Order created</b>, and fill in:</div>
      <div class="field"><label>Delivery URL</label><div class="row"><input type="text" id="whu" readonly value="${esc(hook)}"><button class="btn sm" data-copy="whu">Copy</button></div>${location.protocol !== 'https:' ? '<div class="hint">Use your public https address here (not localhost), WooCommerce cannot reach a private address.</div>' : ''}</div>
      <div class="field"><label>Secret</label><div class="row"><input type="text" id="whs" readonly value="${esc(w.webhookSecret)}"><button class="btn sm" data-copy="whs">Copy</button></div></div>
    </div>
    <div class="card pad" style="margin-top:16px"><div class="h3">3 · WhatsApp catalog</div>
      <div class="hint" style="margin-bottom:8px">Products from this shop are listed on the <b>Products</b> tab and can be sent to any chat (picture, price, link). With the <b>official WhatsApp API</b> and a catalog connected to your number, they go as native catalog cards. To get your shop’s products into the Meta catalog, install the free <b>Facebook for WooCommerce</b> plugin and connect your catalog there.${w.apiMode !== 'cloud' ? ' <b>Now the desk uses the linked phone, so products are sent as picture + price + link.</b>' : ''}</div>
      ${f('wcat', 'Catalog ID (optional)', w.catalogId, 'e.g. 1234567890123456', 'text', 'Meta Commerce Manager → Catalog → Settings.')}
      <div class="field"><label>Product ID format in the catalog</label><select id="wfmt"><option value="fb" ${w.idFormat === 'fb' ? 'selected' : ''}>Facebook for WooCommerce (SKU_id, or wc_post_id_id)</option><option value="sku" ${w.idFormat === 'sku' ? 'selected' : ''}>SKU only</option><option value="id" ${w.idFormat === 'id' ? 'selected' : ''}>WooCommerce product number</option></select></div>
      <button class="btn primary sm" id="wsave3">Save</button>
    </div>
   </div>
   <div>
    <div class="card pad"><div class="h3">Order PDF</div>
      <label class="chk"><input type="checkbox" id="wauto" ${w.autoPdf ? 'checked' : ''}><span><b>Send the PDF on WhatsApp when a new order arrives</b></span></label>
      <div class="hint" style="margin:4px 0 10px">Only genuinely new orders are sent (orders already in your shop today are never sent), and each order once. The team can also send or open the PDF of any order from <b>Order tracking</b> or the customer panel.</div>
      <div class="grid g2" style="gap:0 12px">${f('wst', 'Send when the order status is', w.sendStatuses, 'processing,on-hold,completed', 'text', 'WooCommerce status names, separated by commas.')}${f('wcc', 'Country code for numbers starting with 0', w.countryCode, '92', 'text', '92 = Pakistan')}</div>
      <div class="field"><label>WhatsApp message with the PDF</label><textarea id="wmsg" rows="4">${esc(w.msg)}</textarea><div class="hint">You can use {name} {number} {business} {total}.</div></div>
      <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
      <div class="field"><label>Logo</label><div class="row" style="gap:12px;flex-wrap:wrap"><div class="logobox" id="lgbox">${w.hasLogo ? `<img src="/api/woo/logo.png?${tok}&t=${Date.now()}" alt="logo" onerror="this.replaceWith(document.createTextNode('Logo saved'))">` : '<span class="hint">No logo yet</span>'}</div><div><input type="file" id="lgf" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden><button class="btn sm" id="lgb">${w.hasLogo ? 'Change logo' : 'Upload logo'}</button> ${w.hasLogo ? '<button class="btn sm" id="lgx">Remove</button>' : ''}<div class="hint" style="margin-top:4px">PNG, JPG, WebP or SVG. A wide logo with a transparent background looks best.</div></div></div></div>
      <div class="grid g2" style="gap:0 12px">${f('bn', 'Business name', b.name, w.businessName)}${f('bt', 'Document title', b.title, 'Order confirmation', 'text', 'e.g. Order confirmation, Invoice')}</div>
      ${f('ba', 'Address', b.address, 'Shop 5, Main Boulevard, Lahore')}
      <div class="grid g2" style="gap:0 12px">${f('bp', 'Phone', b.phone, '+92 300 1234567')}${f('be', 'Email', b.email, 'sales@yourshop.com')}${f('bw', 'Website', b.website, 'www.yourshop.com')}${f('bx', 'Tax / NTN number', b.taxId, '')}</div>
      <div class="grid g2" style="gap:0 12px"><div class="field"><label for="bc">Brand colour</label><input type="color" id="bc" value="${esc(b.color)}" style="height:38px;padding:2px;width:100%"></div>${f('bf', 'Footer line', b.footer, 'Thank you for shopping with us!')}</div>
      <div class="field"><label>Extra note at the bottom (optional)</label><textarea id="bth" rows="2" placeholder="e.g. Returns are accepted within 7 days.">${esc(b.thanks)}</textarea></div>
      <div class="row" style="gap:8px"><button class="btn primary sm" id="wsave2">Save</button><button class="btn sm" id="wprev">${ic('pdf')} Preview: cash on delivery</button><button class="btn sm" id="wprevp">${ic('pdf')} Preview: paid order</button></div>
      <div class="hint" style="margin-top:8px">Each preview is a sample order with the settings above (save first). Paid orders get a green PAID stamp; cash-on-delivery orders show the amount to keep ready.</div>
    </div>
   </div>
  </div>`;
  const val = id => $('#' + id).value, bodyShop = () => ({ url: val('wu'), key: val('wk'), secret: val('ws'), minutes: val('wm') });
  const bodyPdf = () => ({ autoPdf: $('#wauto').checked, sendStatuses: val('wst'), countryCode: val('wcc'), msg: val('wmsg'), brand: { name: val('bn'), title: val('bt'), address: val('ba'), phone: val('bp'), email: val('be'), website: val('bw'), taxId: val('bx'), color: val('bc'), footer: val('bf'), thanks: val('bth') } });
  const save = async body => { WOO.st = await api('/woo', { method: 'PUT', body }); };
  const run = (id, fn, ok) => { const el = $('#' + id); if (el) el.onclick = async () => { el.disabled = true; try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); } catch (e) { toast(e.message, true); } el.disabled = false; }; };
  run('wsave', async () => { await save(bodyShop()); stConn(); }, 'Saved');
  run('wtest', async () => { await save(bodyShop()); const r = await api('/woo/test', { method: 'POST', body: {} }); WOO.st = await api('/woo'); stConn(); return r; }, r => `Connected${r.storeName ? ' to ' + r.storeName : ''}: ${r.orders} orders, ${r.products} products`);
  run('wsync', async () => { await save(bodyShop()); const r = await api('/woo/sync', { method: 'POST', body: {} }); WOO.st = await api('/woo'); if (S.view === 'store') stConn(); return r; }, r => `Synced: ${r.orders} orders, ${r.products} products`);
  run('wsave2', async () => { await save(bodyPdf()); stConn(); }, 'PDF settings saved');
  run('wsave3', async () => { await save({ catalogId: val('wcat'), idFormat: val('wfmt') }); }, 'Saved');
  run('wprev', async () => { await save(bodyPdf()); window.open(`/api/woo/sample.pdf?${tok}`, '_blank'); });
  run('wprevp', async () => { await save(bodyPdf()); window.open(`/api/woo/sample.pdf?paid=1&${tok}`, '_blank'); });
  $$('[data-copy]').forEach(bt => bt.onclick = async () => { try { await navigator.clipboard.writeText($('#' + bt.dataset.copy).value); toast('Copied'); } catch { $('#' + bt.dataset.copy).select(); } });
  $('#lgb').onclick = () => $('#lgf').click();
  $('#lgf').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { const dataUrl = await logoToPng(file); WOO.st = await api('/woo/logo', { method: 'POST', body: { dataUrl } }); toast('Logo saved'); stConn(); } catch (err) { toast(err.message, true); } };
  if ($('#lgx')) $('#lgx').onclick = async () => { WOO.st = await api('/woo/logo', { method: 'DELETE' }); stConn(); };
}
// any picture (PNG, JPG, WebP, SVG) → a PNG of reasonable size, which is what the PDF writer needs
function logoToPng(file) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const max = 900, s = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max)), w = Math.round((img.naturalWidth || 300) * s) || 300, h = Math.round((img.naturalHeight || 100) * s) || 100, c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); ok(c.toDataURL('image/png')); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('That file could not be read as a picture.')); }; img.src = url;
  });
}
