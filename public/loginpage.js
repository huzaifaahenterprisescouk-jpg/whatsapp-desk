/* Login page: the markup shown at sign-in (also used for the live preview) and the editor in Settings → Login page.
   Loaded after app.js. app.js calls loginHTML() from renderLogin() and lpEditor() from viewSettings(). */
Object.assign(ICONS, {
  chev: '<path d="M6 9l6 6 6-6"/>',
  eye: ICONS.eye || '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-6.7L3 9"/>',
  arrUp: '<path d="M12 19V5M6 11l6-6 6 6"/>', arrDn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
});

const lpLum = h => { const n = parseInt(String(h).slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const lpBr = s => esc(s).replace(/\n/g, '<br>');

// preview: no ids and no autofocus, so it never clashes with the real form; pv = drawn at 1440×900 and scaled down
function loginHTML(c, business, { preview = false, pv = false } = {}) {
  const hero = c.showHero;
  const cols = !hero ? '1fr' : c.layout === 'right' ? `${100 - c.split}fr ${c.split}fr` : `${c.split}fr ${100 - c.split}fr`;
  const root = [`--lg-cols:${cols}`, `--lg-from:${c.heroFrom}`, `--lg-to:${c.heroTo}`, `--lg-glow:${c.heroGlow}`, `--lg-ink:${c.heroText}`, `--lg-angle:${c.heroAngle}deg`, `--lg-h1:${c.headlineSize}px`, `--lg-w:${c.formWidth}px`];
  if (c.accent) root.push(`--brand:${c.accent}`, `--brand-2:${c.accent}`, `--brand-ink:${lpLum(c.accent) > .6 ? '#10201d' : '#ffffff'}`);
  // own panel colour: the form borrows matching light / dark colours so inputs stay readable
  const card = [`place-items:${{ top: 'start', center: 'center', bottom: 'end' }[c.formAlignV]} ${{ left: 'start', center: 'center', right: 'end' }[c.formAlignH]}`];
  if (c.panelBg) {
    const dark = lpLum(c.panelBg) < .5;
    card.push(`background:${c.panelBg}`, dark ? '--surface:rgba(255,255,255,.07);--surface-2:rgba(255,255,255,.1);--line:rgba(255,255,255,.18);--line-2:rgba(255,255,255,.28);--ink:#f1f5f4;--ink-2:#b9c9c5;--ink-3:#8fa39e' : '--surface:#ffffff;--surface-2:#f4f7f6;--line:#dfe6e3;--line-2:#cdd6d3;--ink:#10201d;--ink-2:#4c5f5a;--ink-3:#8a9893');
  }
  if (c.panelText) card.push(`--ink:${c.panelText}`, `--ink-2:color-mix(in srgb,${c.panelText} 75%,transparent)`, `--ink-3:color-mix(in srgb,${c.panelText} 55%,transparent)`, `color:${c.panelText}`);
  let heroBg = '';
  if (c.heroImage) { const d = c.heroImageDim / 100; heroBg = `background:linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),url("${c.heroImage}") center/cover no-repeat;`; }
  const logo = c.showLogo && (c.brandName || c.brandImage) ? `<div class="logo"><div class="logo-mark ${c.brandImage ? 'pic' : ''}">${c.brandImage ? `<img src="${esc(c.brandImage)}" alt="">` : ic('inbox')}</div>${esc(c.brandName)}</div>` : '';
  const pts = c.showPoints && c.points.length ? `<div class="login-points">${c.points.map(p => `<div><span class="dot">${ic('check')}</span>${esc(p)}</div>`).join('')}</div>` : '';
  const foot = c.footer ? `<div class="login-foot">${esc(c.footer.replace(/\{business\}/gi, business || ''))}</div>` : '';
  const id = n => preview ? '' : `id="${n}"`;
  return `<div class="login ${pv ? 'lgpv' : ''} ${c.layout === 'right' ? 'rev' : ''}" style="${esc(root.join(';'))}">
    ${hero ? `<div class="login-hero ha-${c.heroAlign} ${c.showRing ? '' : 'noring'}" style="${esc(heroBg)}">
      ${logo}
      <div class="lh-main">${c.headline ? `<h1>${esc(c.headline)}</h1>` : ''}${c.text ? `<p>${lpBr(c.text)}</p>` : ''}${pts}</div>
      ${foot}
    </div>` : ''}
    <div class="login-card" style="${esc(card.join(';'))}"><form class="login-box" ${id('lf')} ${preview ? 'onsubmit="return false"' : ''}>
      ${!hero && logo ? logo.replace('class="logo"', 'class="logo lb-logo"') : ''}
      <h2>${esc(c.formTitle)}</h2>${c.formSub ? `<p class="sub">${esc(c.formSub)}</p>` : ''}
      <div class="field"><label>${esc(c.userLabel)}</label><input type="text" ${id('un')} ${preview ? 'tabindex="-1"' : 'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus'} placeholder="${esc(c.userPlaceholder)}"></div>
      <div class="field"><label>${esc(c.passLabel)}</label><div class="pwrow"><input type="password" ${id('pw')} ${preview ? 'tabindex="-1"' : 'autocomplete="current-password"'} placeholder="${esc(c.passPlaceholder)}"><button type="button" class="pwtg" ${id('pwtg')} ${preview ? 'tabindex="-1"' : ''} title="Show / hide password" aria-label="Show or hide password">${ic('eye')}</button></div></div>
      <button class="btn primary block" ${preview ? 'type="button" tabindex="-1"' : ''}>${esc(c.buttonText)}</button><div class="err" ${id('lerr')}></div>
      ${c.showHint && c.hint ? `<p class="hint" style="margin-top:14px">${esc(c.hint)}</p>` : ''}
    </form></div>
  </div>`;
}

// shrink a picked picture so it stays small enough to save in the settings
function lpImage(file, maxW, mime) {
  return new Promise((ok, fail) => {
    if (!file || !/^image\//.test(file.type)) return fail(new Error('Please choose a picture file'));
    const fr = new FileReader();
    fr.onerror = () => fail(new Error('Could not read that file'));
    fr.onload = () => {
      if (file.type === 'image/svg+xml') return fr.result.length > 400 * 1024 ? fail(new Error('That SVG is too large (400 KB max)')) : ok(fr.result);
      const im = new Image();
      im.onerror = () => fail(new Error('Could not open that picture'));
      im.onload = () => {
        let w = Math.min(maxW, im.width), q = .85;
        for (let i = 0; i < 6; i++) {
          const h = Math.round(im.height * w / im.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          const out = cv.toDataURL(mime, q);
          if (out.length < 650 * 1024) return ok(out);
          w = Math.round(w * .8); q = Math.max(.5, q - .1);
        }
        fail(new Error('That picture is too large — try a smaller one'));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// ---------- editor (Settings → Login page) ----------
async function lpEditor(host) {
  let pub;
  try { pub = await fetch('/api/public').then(r => r.json()); } catch { host.innerHTML = '<div class="hint">Could not load the login page settings.</div>'; return; }
  const DEF = pub.defaults, C = pub.login; S.lpDraft = C;
  const FALL = { panelBg: '#10201d', panelText: '#ffffff', accent: '#0f766e' };
  const biz = () => S.settings.businessName;

  const t = (k, l, o = {}) => `<div class="field"><label>${l}</label>${o.area ? `<textarea data-lp="${k}" rows="${o.rows || 3}">${esc(C[k])}</textarea>` : `<input type="text" data-lp="${k}" value="${esc(C[k])}">`}${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
  const sw = (k, l) => `<label class="chk lp-sw"><input type="checkbox" data-lp="${k}" ${C[k] ? 'checked' : ''}><span>${l}</span></label>`;
  const seg = (k, l, opts) => `<div class="field"><label>${l}</label><div class="seg" data-seg="${k}">${opts.map(([v, x]) => `<button type="button" data-v="${v}" class="${C[k] === v ? 'on' : ''}">${x}</button>`).join('')}</div></div>`;
  const rng = (k, l, min, max, u) => `<div class="field"><label>${l} <b class="rv" data-rv="${k}" data-u="${u}">${C[k]}${u}</b></label><input type="range" data-lp="${k}" min="${min}" max="${max}" value="${C[k]}"></div>`;
  const col = (k, l, opt) => `<div class="lp-col"><label>${l}</label><div class="lp-cin"><input type="color" data-lp="${k}" value="${C[k] || FALL[k] || '#000000'}"><code data-cv="${k}">${C[k] || 'Auto'}</code>${opt ? `<button type="button" class="btn sm ghost" data-auto="${k}" title="Follow the app theme">Auto</button>` : ''}</div></div>`;
  const img = (k, l) => `<div class="field"><label>${l}</label><div class="lp-img"><div class="th" data-th="${k}" style="${C[k] ? `background-image:url('${esc(C[k])}')` : ''}"></div><label class="btn sm">${ic('img')} Choose picture<input type="file" accept="image/*" data-img="${k}" hidden></label><button type="button" class="btn sm ghost" data-noimg="${k}" ${C[k] ? '' : 'hidden'}>Remove</button></div></div>`;
  const sec = (k, title, body, open = true) => secHTML(k, title, body, { sub: true, def: open });

  const ptsHTML = () => C.points.map((p, i) => `<div class="lp-pt"><input type="text" data-pt="${i}" value="${esc(p)}" maxlength="140"><button type="button" class="btn sm ghost" data-up="${i}" title="Move up" ${i ? '' : 'disabled'}>${ic('arrUp')}</button><button type="button" class="btn sm ghost" data-dn="${i}" title="Move down" ${i < C.points.length - 1 ? '' : 'disabled'}>${ic('arrDn')}</button><button type="button" class="btn sm ghost" data-rm="${i}" title="Remove">${ic('x')}</button></div>`).join('') + (C.points.length < 8 ? `<button type="button" class="btn sm" id="lp-addpt">${ic('plus')} Add a line</button>` : '');

  function build() {
    host.innerHTML = `<div class="lp-wrap">
      <div class="lp-ctl">
        ${sec('lp-layout', 'Layout', `
          ${sw('showHero', 'Show the coloured panel')}
          ${seg('layout', 'Panel position', [['left', 'Panel on the left'], ['right', 'Panel on the right']])}
          ${rng('split', 'Panel width', 30, 70, '%')}
          ${seg('heroAlign', 'Headline position in the panel', [['top', 'Top'], ['center', 'Middle'], ['bottom', 'Bottom']])}
          ${seg('formAlignV', 'Sign-in form: vertical', [['top', 'Top'], ['center', 'Middle'], ['bottom', 'Bottom']])}
          ${seg('formAlignH', 'Sign-in form: horizontal', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])}
          ${rng('formWidth', 'Sign-in form width', 300, 560, 'px')}`)}
        ${sec('lp-brand', 'Logo & name', `
          ${sw('showLogo', 'Show the logo')}
          ${t('brandName', 'Name next to the logo')}
          ${img('brandImage', 'Logo picture (replaces the chat icon)')}`)}
        ${sec('lp-text', 'Headline & text', `
          ${t('headline', 'Headline', { area: true, rows: 2 })}
          ${rng('headlineSize', 'Headline size', 24, 72, 'px')}
          ${t('text', 'Paragraph under the headline', { area: true, rows: 3 })}
          ${sw('showPoints', 'Show the tick list')}
          <div class="field"><label>Tick list</label><div id="lp-pts" class="lp-pts">${ptsHTML()}</div></div>
          ${t('footer', 'Small line at the bottom', { hint: 'Use {business} for your business name (Settings → Bot messages).' })}`)}
        ${sec('lp-color', 'Colours & background', `
          <div class="lp-grid2">${col('heroFrom', 'Panel colour: dark end')}${col('heroTo', 'Panel colour: light end')}${col('heroGlow', 'Glow')}${col('heroText', 'Panel text')}</div>
          ${rng('heroAngle', 'Gradient direction', 0, 360, '°')}
          ${sw('showRing', 'Show the big faint circle')}
          ${img('heroImage', 'Background picture (covers the gradient)')}
          ${rng('heroImageDim', 'Darken the picture', 0, 85, '%')}`)}
        ${sec('lp-form', 'Sign-in form', `
          ${t('formTitle', 'Title')}${t('formSub', 'Text under the title')}
          <div class="lp-grid2">${t('userLabel', 'Username label')}${t('userPlaceholder', 'Username hint')}${t('passLabel', 'Password label')}${t('passPlaceholder', 'Password hint')}</div>
          ${t('buttonText', 'Button text')}
          ${sw('showHint', 'Show the help line under the button')}${t('hint', 'Help line')}
          <div class="lp-grid2" style="margin-top:4px">${col('panelBg', 'Form side background', true)}${col('panelText', 'Form side text', true)}${col('accent', 'Button & focus colour', true)}</div>`)}
      </div>
      <div class="lp-side">
        <div class="lp-pv" id="lp-pv"><div class="lp-pv-in" id="lp-pv-in" inert></div></div>
        <div class="row lp-acts"><button class="btn" id="lp-full">${ic('full')} Full-screen preview</button><button class="btn" id="lp-reset">${ic('undo')} Reset to default</button><button class="btn primary" id="lp-save" style="margin-left:auto">Save login page</button></div>
        <div class="hint">The preview updates as you type. Nothing changes for your team until you press <b>Save login page</b> (or <b>Save changes</b> at the top).</div>
      </div></div>`;
    wireSections(host); draw(); fit();
  }

  let raf = 0;
  const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const el = $('#lp-pv-in', host); if (el) el.innerHTML = loginHTML(C, biz(), { preview: true, pv: true }); }); };
  const fit = () => { const box = $('#lp-pv', host), inn = $('#lp-pv-in', host); if (!box) return; const go = () => { inn.style.transform = `scale(${box.clientWidth / 1440})`; }; go(); if (window.ResizeObserver) new ResizeObserver(go).observe(box); };
  const setTh = k => { const th = $(`[data-th="${k}"]`, host), rm = $(`[data-noimg="${k}"]`, host); if (th) th.style.backgroundImage = C[k] ? `url('${C[k]}')` : ''; if (rm) rm.hidden = !C[k]; };

  host.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.pt !== undefined) { C.points[+el.dataset.pt] = el.value; return draw(); }
    const k = el.dataset.lp; if (!k) return;
    if (el.type === 'checkbox') C[k] = el.checked;
    else if (el.type === 'range') { C[k] = +el.value; const rv = $(`[data-rv="${k}"]`, host); if (rv) rv.textContent = el.value + rv.dataset.u; }
    else if (el.type === 'color') { C[k] = el.value; const cv = $(`[data-cv="${k}"]`, host); if (cv) cv.textContent = el.value; }
    else C[k] = el.value;
    draw();
  });
  host.addEventListener('change', async e => {
    const el = e.target, k = el.dataset.img; if (!k) return;
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    try { C[k] = await lpImage(f, k === 'brandImage' ? 256 : 1600, k === 'brandImage' ? 'image/png' : 'image/jpeg'); setTh(k); draw(); }
    catch (err) { toast(err.message, true); }
  });
  host.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || !host.contains(b)) return;
    const d = b.dataset;
    if (b.closest('.seg') && d.v) { const k = b.closest('.seg').dataset.seg; C[k] = d.v; $$('button', b.closest('.seg')).forEach(x => x.classList.toggle('on', x === b)); return draw(); }
    if (d.auto) { C[d.auto] = ''; $(`[data-cv="${d.auto}"]`, host).textContent = 'Auto'; $(`[data-lp="${d.auto}"]`, host).value = FALL[d.auto]; return draw(); }
    if (d.noimg) { C[d.noimg] = ''; setTh(d.noimg); return draw(); }
    const pts = () => { $('#lp-pts', host).innerHTML = ptsHTML(); draw(); };
    if (b.id === 'lp-addpt') { C.points.push(''); pts(); const ins = $$('[data-pt]', host); ins[ins.length - 1].focus(); return; }
    if (d.rm !== undefined) { C.points.splice(+d.rm, 1); return pts(); }
    if (d.up !== undefined) { const i = +d.up; [C.points[i - 1], C.points[i]] = [C.points[i], C.points[i - 1]]; return pts(); }
    if (d.dn !== undefined) { const i = +d.dn; [C.points[i + 1], C.points[i]] = [C.points[i], C.points[i + 1]]; return pts(); }
    if (b.id === 'lp-full') return lpFull(C, biz());
    if (b.id === 'lp-reset') { if (!await gconfirm('Discard your changes and go back to the original login page layout? (Press Save to keep it.)', { ok: 'Reset', title: 'Reset login page' })) return; Object.keys(C).forEach(x => delete C[x]); Object.assign(C, JSON.parse(JSON.stringify(DEF))); return build(); }
    if (b.id === 'lp-save') { try { S.settings = await api('/settings', { method: 'PUT', body: { loginPage: JSON.stringify(C) } }); if (typeof applyBrand === 'function') applyBrand(); toast('Login page saved'); } catch (err) { toast(err.message, true); } }
  });
  build();
}

function lpFull(c, business) {
  const bg = document.createElement('div'); bg.className = 'lp-full';
  bg.innerHTML = loginHTML(c, business, { preview: true }) + `<button class="lp-x" type="button">${ic('x')} Close preview</button>`;
  const done = () => { document.removeEventListener('keydown', key, true); bg.remove(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(); } };
  bg.querySelector('.lp-x').onclick = done; document.addEventListener('keydown', key, true); document.body.appendChild(bg);
}
