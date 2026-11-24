/* Sign-in page layout: builds the sign-in page (used by the real page and by the live preview in Settings) and the layout editor card. */
const LL_DEF = { layout: 'split-left', heroWidth: 55, align: 'left', vpos: 'between', order: ['headline', 'text', 'points'], show: { logo: 1, headline: 1, text: 1, points: 1, footer: 1, help: 1 }, headlineSize: 40, font: 'jakarta', formBg: '', btnColor: '', radius: 10, heroImage: '', overlay: 40 };
const LL_NAMES = { headline: 'Big headline', text: 'Text under the headline', points: 'Tick-list points' };
function loginLayout(raw) {
  let o = {}; try { o = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}); } catch {}
  const L = { ...LL_DEF, ...o, show: { ...LL_DEF.show, ...(o.show || {}) } };
  const ord = Array.isArray(o.order) ? o.order.filter(k => LL_NAMES[k]) : []; for (const k of LL_DEF.order) if (!ord.includes(k)) ord.push(k); L.order = ord;
  L.heroWidth = Math.min(75, Math.max(30, +L.heroWidth || 55)); L.headlineSize = Math.min(72, Math.max(22, +L.headlineSize || 40)); L.radius = Math.min(28, Math.max(0, +L.radius || 0)); L.overlay = Math.min(90, Math.max(0, +L.overlay || 0));
  if (!['split-left', 'split-right', 'center', 'form'].includes(L.layout)) L.layout = 'split-left';
  return L;
}
function loginPageHtml(B, L, biz, pv) {
  const E = x => esc(x), col = c => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '', pts = String(B.loginPoints || '').split('\n').map(x => x.trim()).filter(Boolean);
  const grad = `radial-gradient(1200px 600px at 20% 10%,${col(B.loginColor3) || '#14b8a6'} 0,transparent 55%),linear-gradient(160deg,${col(B.loginColor1) || '#0b2623'},${col(B.loginColor2) || '#0f766e'} 130%)`;
  const heroBg = /^data:image\//.test(L.heroImage || '') ? `linear-gradient(rgba(0,0,0,${L.overlay / 100}),rgba(0,0,0,${L.overlay / 100})),url(${L.heroImage}) center/cover` : grad;
  const fonts = { system: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', serif: 'Georgia,"Times New Roman",serif' }, ff = fonts[L.font] ? `font-family:${fonts[L.font]};` : '';
  const mark = `<div class="logo-mark"${B.loginLogo ? ' style="background:#fff;padding:0;overflow:hidden"' : ''}>${B.loginLogo ? `<img src="${E(B.loginLogo)}" alt="" style="width:100%;height:100%;object-fit:contain">` : ic('inbox')}</div>`;
  const logo = L.show.logo ? `<div class="logo">${mark}${E(B.appName)}</div>` : '<div></div>';
  const ctr = L.align === 'center' || L.layout === 'center';
  const blocks = { headline: `<h1 style="font-size:${L.headlineSize}px">${E(B.loginHeadline)}</h1>`, text: B.loginText ? `<p>${E(B.loginText)}</p>` : '', points: pts.length ? `<div class="login-points">${pts.map(x => `<div style="${ctr ? 'justify-content:center' : ''}"><span class="dot">${ic('check')}</span>${E(x)}</div>`).join('')}</div>` : '' };
  const body = L.order.filter(k => L.show[k]).map(k => blocks[k]).join('');
  const foot = L.show.footer ? `<div style="opacity:.75;font-size:12.5px">${E(String(B.loginFooter || '').replace(/\{business\}/g, biz || ''))}</div>` : '<div></div>';
  const just = { between: 'space-between', top: 'flex-start', center: 'center', bottom: 'flex-end' }[L.vpos] || 'space-between', gap = L.vpos === 'between' ? '' : 'gap:36px;';
  const hl = L.layout === 'center';
  const heroStyle = `${ff}${hl ? 'background:none;padding:0;overflow:visible;min-height:0;gap:22px;' : `background:${heroBg};justify-content:${just};${gap}`}align-items:${ctr ? 'center' : 'stretch'};text-align:${ctr ? 'center' : 'left'};${L.layout === 'split-right' ? 'order:2;' : ''}`;
  const hero = L.layout === 'form' ? '' : `<div class="login-hero${hl ? ' ll-plain' : ''}" style="${heroStyle}">${logo}<div style="display:flex;flex-direction:column;align-items:${ctr ? 'center' : 'flex-start'}">${body}</div>${foot}</div>`;
  const w = L.heroWidth, cols = L.layout === 'split-left' ? `${w}% ${100 - w}%` : L.layout === 'split-right' ? `${100 - w}% ${w}%` : '1fr';
  const root = `${ff}min-height:${pv ? '720px;height:720px' : '100vh'};` + (hl ? `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:40px;background:${heroBg};` : `grid-template-columns:${cols};`);
  const cardStyle = (hl ? 'background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(0,0,0,.28);padding:36px 32px;width:min(460px,100%);' : col(L.formBg) ? `background:${col(L.formBg)};` : '') + (hl ? '' : '');
  const btn = col(L.btnColor), r = L.radius;
  const css = `.ll-scope .field input,.ll-scope .btn{border-radius:${r}px}` + (btn ? `.ll-scope .btn.primary{background:${btn};border-color:${btn};color:#fff}` : '');
  const formLogo = L.layout === 'form' && L.show.logo ? `<div class="logo" style="margin-bottom:26px;color:inherit">${mark}${E(B.appName)}</div>` : '';
  return `<style>${css}</style><div class="login ll-scope ll-${L.layout}" style="${root}">${hero}
    <div class="login-card" style="${cardStyle}"><form class="login-box" id="lf">${formLogo}
      <h2>${E(B.loginWelcome)}</h2><p class="sub">${E(B.loginSub)}</p>
      <div class="field"><label>Username</label><input type="text" id="un" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="e.g. sara"${pv ? '' : ' autofocus'}></div>
      <div class="field"><label>Password</label><div class="pwrow"><input type="password" id="pw" autocomplete="current-password" placeholder="Your password"><button type="button" class="pwtg" id="pwtg" title="Show / hide password" aria-label="Show or hide password">${ic('eye')}</button></div></div>
      <button class="btn primary block">Sign in</button><div class="err" id="lerr"></div>
      ${L.show.help && B.loginHelp ? `<p class="hint" style="margin-top:14px">${E(B.loginHelp)}</p>` : ''}
    </form></div></div>`;
}

// ---------- the editor card in Settings ----------
function llCard(s) {
  const L = loginLayout(s.loginLayout);
  const chip = (id, v, t, cur) => `<label class="chk"><input type="radio" name="${id}" value="${v}" ${cur === v ? 'checked' : ''}><span>${t}</span></label>`;
  const rng = (id, l, min, max, v, u = '') => `<div class="field"><label>${l} <b id="${id}-v">${v}${u}</b></label><input type="range" id="${id}" min="${min}" max="${max}" value="${v}" style="width:100%"></div>`;
  return `<div class="card pad" id="llcard"><div class="h3">Sign-in page layout &amp; mapping</div>
    <div class="hint" style="margin-bottom:10px">Choose where things go and how they look. The preview updates as you change things. Press <b>Save changes</b> when you like it.</div>
    <div id="ll-prev" style="width:100%;border:1px solid var(--line);border-radius:12px;overflow:hidden;position:relative;margin-bottom:14px;background:#fff"><div id="ll-inner" style="width:1280px;height:720px;transform-origin:0 0;pointer-events:none"></div></div>
    <input type="hidden" data-k="loginLayout" id="ll-val" value="${esc(s.loginLayout || '')}">
    <div class="field"><label>Layout</label><div class="row" style="gap:8px;flex-wrap:wrap">${chip('ll-layout', 'split-left', '◧ Panel left', L.layout)}${chip('ll-layout', 'split-right', '◨ Panel right', L.layout)}${chip('ll-layout', 'center', '▣ Centered card', L.layout)}${chip('ll-layout', 'form', '▭ Form only', L.layout)}</div></div>
    <div id="ll-w">${rng('ll-hw', 'Panel width', 30, 75, L.heroWidth, '%')}</div>
    <div class="field"><label>Panel text</label><div class="row" style="gap:8px;flex-wrap:wrap">${chip('ll-align', 'left', 'Align left', L.align)}${chip('ll-align', 'center', 'Centered', L.align)}</div></div>
    <div class="field"><label>Panel content position</label><div class="row" style="gap:8px;flex-wrap:wrap">${chip('ll-vpos', 'between', 'Spread out', L.vpos)}${chip('ll-vpos', 'top', 'Top', L.vpos)}${chip('ll-vpos', 'center', 'Middle', L.vpos)}${chip('ll-vpos', 'bottom', 'Bottom', L.vpos)}</div></div>
    <div class="field"><label>Order of the panel blocks <span class="hint" style="font-weight:500">(arrows move, tick to show)</span></label><div id="ll-order"></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><label class="chk"><input type="checkbox" id="ll-s-logo" ${L.show.logo ? 'checked' : ''}><span>Logo &amp; name</span></label><label class="chk"><input type="checkbox" id="ll-s-footer" ${L.show.footer ? 'checked' : ''}><span>Bottom line</span></label><label class="chk"><input type="checkbox" id="ll-s-help" ${L.show.help ? 'checked' : ''}><span>Help line</span></label></div></div>
    ${rng('ll-hs', 'Headline size', 22, 72, L.headlineSize, ' px')}
    <div class="field"><label>Font</label><div class="row" style="gap:8px;flex-wrap:wrap">${chip('ll-font', 'jakarta', 'Modern (default)', L.font)}${chip('ll-font', 'system', 'Plain', L.font)}${chip('ll-font', 'serif', 'Classic serif', L.font)}</div></div>
    ${rng('ll-rad', 'Corner roundness of boxes &amp; button', 0, 28, L.radius, ' px')}
    <div class="field"><label>Form side colours</label><div class="row" style="gap:14px;align-items:center;flex-wrap:wrap">
      <label class="chk" style="gap:6px"><input type="color" id="ll-fbg" value="${esc(L.formBg || '#f6f7f6')}" style="width:38px;height:30px;padding:0;border:0;background:none"><span>Background</span></label><button class="btn sm" type="button" id="ll-fbg-x">Default</button>
      <label class="chk" style="gap:6px"><input type="color" id="ll-btn" value="${esc(L.btnColor || '#0f766e')}" style="width:38px;height:30px;padding:0;border:0;background:none"><span>Button</span></label><button class="btn sm" type="button" id="ll-btn-x">Default</button></div></div>
    <div class="field"><label>Panel background picture <span class="hint" style="font-weight:500">(optional · up to 500 KB)</span></label><div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><input type="file" id="ll-img" accept="image/png,image/jpeg,image/webp" style="max-width:230px"><button class="btn sm" type="button" id="ll-img-x">Remove</button></div></div>
    ${rng('ll-ov', 'Darken the picture', 0, 90, L.overlay, '%')}
    <button class="btn sm" type="button" id="ll-reset">Reset layout to default</button>
  </div>`;
}
function llBind() {
  const card = document.getElementById('llcard'); if (!card) return;
  let L = loginLayout(document.getElementById('ll-val').value); const $i = id => document.getElementById(id);
  const brandNow = () => { const B = { ...BR_DEF }; for (const k of Object.keys(BR_DEF)) { const el = document.querySelector(`[data-k="${k}"]`); if (el) B[k] = el.value; } return B; };
  const fit = () => { const p = $i('ll-prev'), inn = $i('ll-inner'); if (!p || !inn) return; const sc = p.clientWidth / 1280; inn.style.transform = `scale(${sc})`; p.style.height = Math.round(720 * sc) + 'px'; };
  const orderUi = () => { $i('ll-order').innerHTML = L.order.map((k, i) => `<div class="row" style="gap:8px;align-items:center;padding:4px 0"><label class="chk"><input type="checkbox" data-ls="${k}" ${L.show[k] ? 'checked' : ''}><span>${LL_NAMES[k]}</span></label><span style="margin-left:auto"></span><button class="btn sm" type="button" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm" type="button" data-dn="${i}" ${i === L.order.length - 1 ? 'disabled' : ''}>↓</button></div>`).join(''); };
  const draw = () => { const B = brandNow(); const biz = (document.querySelector('[data-k="businessName"]') || {}).value || ''; $i('ll-inner').innerHTML = loginPageHtml(B, L, biz, true); $i('ll-w').style.display = L.layout === 'split-left' || L.layout === 'split-right' ? '' : 'none'; fit(); };
  const commit = () => { $i('ll-val').value = JSON.stringify(L); draw(); };
  const val = n => (card.querySelector(`input[name="${n}"]:checked`) || {}).value;
  const read = () => { L.layout = val('ll-layout') || L.layout; L.align = val('ll-align') || L.align; L.vpos = val('ll-vpos') || L.vpos; L.font = val('ll-font') || L.font; L.heroWidth = +$i('ll-hw').value; L.headlineSize = +$i('ll-hs').value; L.radius = +$i('ll-rad').value; L.overlay = +$i('ll-ov').value; L.show.logo = $i('ll-s-logo').checked ? 1 : 0; L.show.footer = $i('ll-s-footer').checked ? 1 : 0; L.show.help = $i('ll-s-help').checked ? 1 : 0; for (const k of ['headline', 'text', 'points']) { const el = card.querySelector(`[data-ls="${k}"]`); if (el) L.show[k] = el.checked ? 1 : 0; } if ($i('ll-fbg').dataset.set) L.formBg = $i('ll-fbg').value; if ($i('ll-btn').dataset.set) L.btnColor = $i('ll-btn').value; $i('ll-hw-v').textContent = L.heroWidth + '%'; $i('ll-hs-v').textContent = L.headlineSize + ' px'; $i('ll-rad-v').textContent = L.radius + ' px'; $i('ll-ov-v').textContent = L.overlay + '%'; };
  card.addEventListener('input', e => { if (e.target.id === 'll-fbg' || e.target.id === 'll-btn') e.target.dataset.set = '1'; if (e.target.id === 'll-img') return; read(); commit(); });
  card.addEventListener('change', e => { if (e.target.id === 'll-img') return; read(); commit(); });
  card.addEventListener('click', e => { const b = e.target.closest('button[data-up],button[data-dn]'); if (!b) return; const i = +(b.dataset.up || b.dataset.dn), j = b.dataset.up !== undefined ? i - 1 : i + 1; if (j < 0 || j >= L.order.length) return; [L.order[i], L.order[j]] = [L.order[j], L.order[i]]; orderUi(); commit(); });
  $i('ll-fbg-x').onclick = () => { L.formBg = ''; delete $i('ll-fbg').dataset.set; commit(); };
  $i('ll-btn-x').onclick = () => { L.btnColor = ''; delete $i('ll-btn').dataset.set; commit(); };
  $i('ll-img').onchange = e => { const f = e.target.files[0]; if (!f) return; if (f.size > 500 * 1024) { e.target.value = ''; return toast('That picture is over 500 KB. Use a smaller one.', true); } const r = new FileReader(); r.onload = () => { L.heroImage = r.result; commit(); }; r.readAsDataURL(f); };
  $i('ll-img-x').onclick = () => { L.heroImage = ''; $i('ll-img').value = ''; commit(); };
  $i('ll-reset').onclick = () => { L = loginLayout('{}'); $i('ll-val').value = ''; card.querySelectorAll('input[type=radio]').forEach(r => { const d = { 'll-layout': L.layout, 'll-align': L.align, 'll-vpos': L.vpos, 'll-font': L.font }[r.name]; r.checked = r.value === d; }); $i('ll-hw').value = L.heroWidth; $i('ll-hs').value = L.headlineSize; $i('ll-rad').value = L.radius; $i('ll-ov').value = L.overlay; ['logo', 'footer', 'help'].forEach(k => $i('ll-s-' + k).checked = true); delete $i('ll-fbg').dataset.set; delete $i('ll-btn').dataset.set; read(); orderUi(); draw(); toast('Layout reset. Press Save changes to keep it.'); };
  // the other fields of the sign-in page (texts, colours, logo) also show in the preview while typing
  document.getElementById('setgrid').addEventListener('input', e => { if (!card.contains(e.target)) draw(); });
  window.addEventListener('resize', fit);
  if (L.formBg) $i('ll-fbg').dataset.set = '1'; if (L.btnColor) $i('ll-btn').dataset.set = '1';
  orderUi(); draw(); setTimeout(fit, 60);
}
