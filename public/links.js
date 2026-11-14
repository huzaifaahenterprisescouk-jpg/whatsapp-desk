/* WhatsApp links (admin): public forms that send a customer to WhatsApp with their details and put the chat with the right person.
   Also holds the big "Use the official API" switch. Loaded after app.js (viewLinks is called by renderView). */
let LK = { links: [], cfg: {}, mode: 'demo', apiOn: true, apiKeys: false };
const FIELD_NAMES = [['name', 'Name'], ['phone', 'Phone number'], ['org', 'Organization'], ['order', 'PO / order number'], ['note', 'Message']];
const lkUrl = L => `${(LK.cfg.baseUrl || location.origin).replace(/\/+$/, '')}/go/${L.slug}`;

async function viewLinks() {
  $('#main').innerHTML = `<div class="page">${pageHead('WhatsApp links', 'Make a link or QR code for customers. They fill in a few details, WhatsApp opens with the message ready, and the chat lands with the right person.', `<button class="btn primary" id="lk-add">${ic('plus')} Add link</button>`)}<div id="lk-body"><div class="hint">Loading…</div></div></div>`;
  $('#lk-add').onclick = () => lkEdit(null);
  try { LK = await api('/links'); } catch (e) { $('#lk-body').innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
  lkDraw();
}
function lkDraw() {
  const viaApi = LK.mode === 'cloud', c = LK.cfg;
  const needNum = !c.deskAuto && !c.deskNumber;
  $('#lk-body').innerHTML = `
  <div class="grid g2" style="align-items:start;margin-bottom:16px">
    <div class="card pad"><div class="h3">How WhatsApp is connected</div>
      <label class="chk"><input type="checkbox" id="lk-api" ${LK.apiOn && LK.apiKeys ? 'checked' : ''} ${LK.apiKeys ? '' : 'disabled'}><span><b>Use the official WhatsApp API</b></span></label>
      <div class="hint" style="margin:6px 0 10px">${LK.apiKeys
        ? '<b>Ticked:</b> everything runs on the official API (messages, tappable menus, calls from the desk). <b>Unticked:</b> everything runs on your own WhatsApp number linked to the desk (like WhatsApp Web) plus the free browser voice calls below. Only one is active at a time.'
        : 'The API keys are not in the .env file, so the desk runs on your linked WhatsApp number (no API). To get the tick box, add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to .env and restart.'}</div>
      ${LK.apiKeys && !LK.apiOn ? `<label class="chk" style="margin-bottom:6px"><input type="checkbox" id="lk-calls" ${LK.callsApi ? 'checked' : ''}><span><b>Make only the calls go through the API</b></span></label><div class="hint" style="margin-bottom:10px"><b>Calls on the API only:</b> chat, links, bot and voice messages stay on your linked number (no API), and only <b>WhatsApp calls</b> go through the official API. Meta needs a <b>separate number</b> on the Cloud API for this (not the one linked here), so customers will see calls come from that number. Meta also limits calls (the customer must allow calls; 1 permission request a day, 100 calls a day per customer; not available for business-initiated calls in the US, Canada, Egypt, Vietnam, Nigeria; the API number needs a 2,000-contact daily messaging limit).</div>` : ''}
      <div class="row"><span class="pulse ${viaApi || (LK.mode === 'link' && c.deskAuto) ? '' : 'demo'}"></span><b>Now: ${viaApi ? 'official API' : LK.mode === 'link' ? 'linked phone' + (c.deskAuto ? ' (+' + esc(c.deskAuto) + ')' : ' (not linked yet: Settings → WhatsApp connection)') : 'demo (nothing connected yet)'}</b></div></div>
    <div class="card pad"><div class="h3">Desk number &amp; public address</div>
      <div class="field"><label>WhatsApp number customers are sent to ${c.deskAuto ? '(taken from the linked phone)' : ''}</label><input type="text" id="lk-num" value="${esc(c.deskAuto || c.deskNumber)}" placeholder="923001234567" ${c.deskAuto ? 'disabled' : ''}>
        <div class="hint">${needNum ? '<b>Needed:</b> type the business WhatsApp number (with country code).' : 'Links of type “the desk” send people to this number; the desk then puts the chat with the right person.'}</div></div>
      <div class="field"><label>Public address of this desk</label><input type="text" id="lk-base" value="${esc(c.baseUrl)}" placeholder="${esc(location.origin)}"><div class="hint">The address customers can open from their phone (https). Used in the links and in the voice-call links. ${/localhost|127\.0\.0\.1|192\.168\./.test(location.origin) && !c.baseUrl ? '<b>You are on a local address: customers cannot open it. Type your public https address here.</b>' : ''}</div></div>
      <button class="btn sm primary" id="lk-cfg">Save</button></div>
  </div>
  <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Link</th><th>Sends people to</th><th>Handled by</th><th>Opened / started</th><th></th></tr></thead><tbody>
  ${LK.links.map(L => { const a = agent(L.agentId), o = S.orgs.find(x => x.id === L.orgId); return `<tr data-id="${L.id}"><td><b>${esc(L.name)}</b>${L.enabled ? '' : ' <span class="pill">Off</span>'}<div class="hint" style="word-break:break-all">${esc(lkUrl(L))}</div></td>
    <td>${L.target === 'person' ? 'The handler’s own WhatsApp' : L.target === 'custom' ? '+' + esc(L.customNumber) : 'The desk number'}</td>
    <td>${a ? esc(a.name) : o ? esc(o.name) + ' team' : '<span class="hint">By the organization they type, else least busy</span>'}</td>
    <td>${L.hits || 0} / ${L.started || 0}</td>
    <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-copy="1">Copy</button><button class="btn sm ghost" data-qr="1">QR</button><button class="btn sm ghost" data-open="1">Open</button><button class="btn sm ghost" data-e="1">Edit</button><button class="btn sm ghost danger" data-d="1">${ic('trash')}</button></td></tr>`; }).join('') || `<tr><td colspan="5"><div class="empty" style="padding:30px">No links yet. Press <b>Add link</b>.</div></td></tr>`}
  </tbody></table></div></div>
  <div class="card pad" style="margin-top:16px"><div class="h3">Calls &amp; voice chat inside the desk (no API)</div>
    <p class="hint">Chat, voice messages, photos and files work in the inbox on your linked number. WhatsApp itself does not allow its own calls to be made from a linked desk, so the desk has its own free voice call: press <b>Voice call</b> in a chat, the customer gets a link in WhatsApp, taps the green button and you talk in the browser. When the customer opens the same link later, it rings the person handling the chat. For calls on the customer’s own WhatsApp tick the API box above.</p></div>`;
  $('#lk-api').onchange = async e => { try { await api('/wa/settings', { method: 'PUT', body: { useApi: e.target.checked } }); toast(e.target.checked ? 'Everything now runs on the official API' : 'Now running on your linked number (no API)'); viewLinks(); } catch (err) { e.target.checked = !e.target.checked; toast(err.message, true); } };
  const lc = $('#lk-calls'); if (lc) lc.onchange = async e => { try { await api('/wa/settings', { method: 'PUT', body: { callsApi: e.target.checked } }); toast(e.target.checked ? 'Calls now go through the API; everything else stays on your linked number' : 'Calls no longer use the API'); viewLinks(); } catch (err) { e.target.checked = !e.target.checked; toast(err.message, true); } };
  $('#lk-cfg').onclick = async () => { try { const b = { baseUrl: $('#lk-base').value }; if (!c.deskAuto) b.deskNumber = $('#lk-num').value; LK.cfg = await api('/links/config', { method: 'PUT', body: b }); toast('Saved'); lkDraw(); } catch (e) { toast(e.message, true); } };
  const tb = $('#lk-body tbody');
  tb.onclick = async e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return; const L = LK.links.find(x => x.id === tr.dataset.id);
    if (e.target.closest('[data-copy]')) { try { await navigator.clipboard.writeText(lkUrl(L)); toast('Link copied'); } catch { await gprompt('Copy this link', lkUrl(L)); } }
    else if (e.target.closest('[data-open]')) window.open(lkUrl(L), '_blank');
    else if (e.target.closest('[data-e]')) lkEdit(L);
    else if (e.target.closest('[data-qr]')) { try { const r = await api(`/links/${L.id}/qr?origin=${encodeURIComponent(location.origin)}`); modal(`<h3>${esc(L.name)}</h3><div style="text-align:center"><img src="${r.qr}" width="260" height="260" alt="QR code"><div class="hint" style="word-break:break-all;margin-top:6px">${esc(lkUrl(L))}</div></div><div class="acts"><a class="btn" href="${r.qr}" download="whatsapp-link-${esc(L.slug)}.png">Download</a><button class="btn primary" onclick="this.closest('.modal-bg').remove()">Close</button></div>`); } catch (err) { toast(err.message, true); } }
    else if (e.target.closest('[data-d]') && await gconfirm(`Delete the link “${L.name}”? People who already have it will see “not available”.`)) { await api('/links/' + L.id, { method: 'DELETE' }); viewLinks(); }
  };
}
function lkEdit(L) {
  const n = !L; L = L || { enabled: true, target: 'desk', fields: { name: 'required', org: 'ask', note: 'ask', phone: 'off', order: 'off' } };
  const fo = (k, v) => `<select data-f="${k}">${[['off', 'Don’t ask'], ['ask', 'Ask'], ['required', 'Must fill in']].map(([x, l]) => `<option value="${x}" ${v === x ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  modal(`<h3>${n ? 'Add' : 'Edit'} WhatsApp link</h3>
    <div class="field"><label>Name (only you see it)</label><input type="text" id="lk-n" value="${esc(L.name || '')}" placeholder="e.g. Sales enquiries"></div>
    <div class="field"><label>Web address ending</label><input type="text" id="lk-s" value="${esc(L.slug || '')}" placeholder="sales"><div class="hint">The link will be …/go/<b id="lk-sp">${esc(L.slug || 'sales')}</b></div></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Handled by</label><select id="lk-a"><option value="">Decide by the organization they type</option>${S.agents.filter(a => a.active).map(a => `<option value="${a.id}" ${L.agentId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Default organization</label><select id="lk-o"><option value="">None</option>${S.orgs.map(o => `<option value="${o.id}" ${L.orgId === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Send people to</label><select id="lk-t"><option value="desk" ${L.target === 'desk' ? 'selected' : ''}>The desk number (chat appears in the inbox, assigned to the person)</option><option value="person" ${L.target === 'person' ? 'selected' : ''}>The handler’s own WhatsApp number (Team → Phone)</option><option value="custom" ${L.target === 'custom' ? 'selected' : ''}>Another WhatsApp number or wa.me link</option></select></div>
    <div class="field" id="lk-cw" ${L.target === 'custom' ? '' : 'hidden'}><label>WhatsApp number or wa.me link</label><input type="text" id="lk-c" value="${esc(L.customNumber || '')}" placeholder="923001234567"></div>
    <div class="h3" style="margin-top:4px">What to ask the customer</div>
    <div class="grid g2" style="gap:10px">${FIELD_NAMES.map(([k, l]) => `<div class="field"><label>${l}</label>${fo(k, (L.fields || {})[k] || 'off')}</div>`).join('')}</div>
    <div class="field"><label>Page title</label><input type="text" id="lk-ti" value="${esc(L.title || '')}" placeholder="Talk to our team"></div>
    <div class="field"><label>Short text under the title</label><input type="text" id="lk-i" value="${esc(L.intro || '')}"></div>
    <div class="field"><label>First line of the WhatsApp message</label><input type="text" id="lk-fi" value="${esc(L.first || '')}" placeholder="Hello! I need help."></div>
    <label class="chk" style="margin-bottom:12px"><input type="checkbox" id="lk-en" ${L.enabled ? 'checked' : ''}><span>Link is switched on</span></label>
    <div class="acts"><button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button></div>`, (bg, close) => {
    $('#cx', bg).onclick = close; $('#lk-s', bg).oninput = e => { $('#lk-sp', bg).textContent = e.target.value || 'sales'; };
    $('#lk-t', bg).onchange = e => { $('#lk-cw', bg).hidden = e.target.value !== 'custom'; };
    $('#sv', bg).onclick = async () => {
      const fields = {}; $$('[data-f]', bg).forEach(s => fields[s.dataset.f] = s.value);
      const body = { name: $('#lk-n', bg).value, slug: $('#lk-s', bg).value, agentId: $('#lk-a', bg).value, orgId: $('#lk-o', bg).value, target: $('#lk-t', bg).value, customNumber: $('#lk-c', bg).value, fields, title: $('#lk-ti', bg).value, intro: $('#lk-i', bg).value, first: $('#lk-fi', bg).value, enabled: $('#lk-en', bg).checked };
      try { await api(n ? '/links' : '/links/' + L.id, { method: n ? 'POST' : 'PUT', body }); close(); toast('Saved'); viewLinks(); } catch (e) { toast(e.message, true); }
    };
  });
}
