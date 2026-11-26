/* WhatsApp Desk – "Save as" for every download.
   Catches every download in the app (links with a download attribute, /download links, scripted blob downloads)
   and, instead of dropping the file silently into the browser's Downloads folder, either
     • "ask"  – opens the browser's own Save-as window (like Chrome), or
     • "auto" – saves straight into a folder you picked once (change it any time).
   Uses the File System Access API (Chrome / Edge, on https or localhost). Where it is missing the normal
   browser download is left alone. Choice + folder are remembered per browser (localStorage + IndexedDB). */
(() => {
  const SECURE = window.isSecureContext;
  const CAN_SAVE = SECURE && typeof window.showSaveFilePicker === 'function';
  const CAN_DIR = SECURE && typeof window.showDirectoryPicker === 'function';
  const MODE_KEY = 'wd_dl_mode'; // 'ask' (default) | 'auto' | 'off'
  const CANCEL = { cancelled: true };

  const getMode = () => { try { const m = localStorage.getItem(MODE_KEY); return m === 'auto' || m === 'off' ? m : 'ask'; } catch { return 'ask'; } };
  const setMode = m => { try { localStorage.setItem(MODE_KEY, m); } catch {} };
  const say = (msg, bad) => { try { if (typeof toast === 'function') return toast(msg, bad); } catch {} };

  // ---------- remember the chosen folder (a handle can only live in IndexedDB) ----------
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('wd_dl', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const kv = async (op, key, val) => { const db = await idb(); return new Promise((res, rej) => { const st = db.transaction('kv', op === 'get' ? 'readonly' : 'readwrite').objectStore('kv'); const q = op === 'get' ? st.get(key) : op === 'set' ? st.put(val, key) : st.delete(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  const getDir = async () => { try { return (await kv('get', 'dir')) || null; } catch { return null; } };
  const setDir = h => kv('set', 'dir', h);
  const clearDir = () => kv('del', 'dir').catch(() => {});

  // ---------- helpers ----------
  const safeName = n => String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 180) || 'download';
  const MIMES = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', csv: 'text/csv', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', txt: 'text/plain', zip: 'application/zip' };
  const extOf = n => { const m = /\.([A-Za-z0-9]{1,8})$/.exec(n); return m ? m[1].toLowerCase() : ''; };
  const nameFromCD = cd => {
    if (!cd) return '';
    let m = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cd); if (m) { try { return decodeURIComponent(m[1].trim()); } catch {} }
    m = /filename\s*=\s*"([^"]+)"/.exec(cd) || /filename\s*=\s*([^;]+)/.exec(cd); return m ? m[1].trim() : '';
  };
  const nameFromUrl = u => { try { const p = new URL(u, location.href).pathname.split('/').filter(Boolean).pop() || ''; return decodeURIComponent(p); } catch { return ''; } };
  const pickTypes = (name, ct) => {
    const e = extOf(name); if (!e) return undefined;
    const mime = (ct || '').split(';')[0].trim() || MIMES[e] || 'application/octet-stream';
    return [{ description: e.toUpperCase() + ' file', accept: { [/^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : 'application/octet-stream']: ['.' + e] } }];
  };

  // ---------- folder permission ----------
  async function dirReady(dir) { // true when we may write into it (asks once if the browser needs a click to allow)
    try {
      if ((await dir.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
      return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
    } catch { return false; }
  }
  async function uniqueName(dir, name) { // "file.pdf" -> "file (1).pdf" like Chrome does
    const dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 0; i < 500; i++) {
      const cand = i ? `${base} (${i})${ext}` : name;
      try { await dir.getFileHandle(cand); } catch (e) { if (e.name === 'NotFoundError') return cand; if (e.name !== 'TypeMismatchError') throw e; }
    }
    return `${base} (${Date.now()})${ext}`;
  }
  async function writeTo(fh, resp) {
    const w = await fh.createWritable();
    try { if (resp.body && resp.body.pipeTo) await resp.body.pipeTo(w); else { await w.write(await resp.blob()); await w.close(); } }
    catch (e) { try { await w.abort(); } catch {} throw e; }
  }

  // ---------- the Chrome-style "Save as" window ----------
  async function askWhere(name, ct, dir) {
    const opts = { suggestedName: name, types: pickTypes(name, ct) };
    if (dir) opts.startIn = dir; else { opts.id = 'wd-save'; opts.startIn = 'downloads'; }
    try { return await window.showSaveFilePicker(opts); }
    catch (e) { if (e && e.name === 'AbortError') throw CANCEL; throw e; }
  }

  // the browser's own download – used when this feature is off / unsupported / could not run
  function nativeDownload(url, name) {
    const a = document.createElement('a'); a.href = url; a.download = name || ''; a.__sdNative = true; a.style.display = 'none';
    document.body.appendChild(a); origClick.call(a); a.remove();
  }

  async function saveOne(url, nameHint, preDir) {
    let dir = preDir || null, ready = !!preDir; // ready = we may write straight into dir, no window
    if (!dir) {
      dir = await getDir();
      if (getMode() === 'auto') {
        if (!dir) say('No download folder chosen yet — pick where to save this file (set one under Downloads settings).');
        else if (!(ready = await dirReady(dir))) say('Allow access to your download folder to save there automatically. Choose a place for this file now.', true);
      }
    }
    const ac = new AbortController();
    const respP = fetch(url, { credentials: 'same-origin', signal: ac.signal }); respP.catch(() => {}); // starts now, so a blob: link is read before the page revokes it
    let name = nameHint ? safeName(nameHint) : '', fh = null, where = '';
    if (!ready && name) { try { fh = await askWhere(name, '', dir); } catch (e) { ac.abort(); throw e; } } // window opens at once (the click is still fresh)
    const resp = await respP;
    if (!resp.ok) throw new Error('Could not download this file (error ' + resp.status + ')');
    if (!name) name = safeName(nameFromCD(resp.headers.get('Content-Disposition')) || nameFromUrl(resp.url || url) || 'download');
    if (!extOf(name)) { const ct = (resp.headers.get('Content-Type') || '').split(';')[0].trim(), e = Object.keys(MIMES).find(k => MIMES[k] === ct); if (e) name += '.' + e; }
    if (ready) { fh = await dir.getFileHandle(await uniqueName(dir, name), { create: true }); where = dir.name; }
    else if (!fh) fh = await askWhere(name, resp.headers.get('Content-Type'), dir);
    await writeTo(fh, resp);
    return { name: fh.name, where };
  }

  // one download, with all the fall-backs
  async function run(url, nameHint) {
    try {
      const r = await saveOne(url, nameHint);
      say(r.where ? `Saved “${r.name}” to ${r.where}` : `Saved “${r.name}”`);
    } catch (e) {
      if (e === CANCEL) return;
      if (e && (e.name === 'SecurityError' || e.name === 'NotAllowedError' || e.name === 'NotFoundError' || e.name === 'TypeError')) { // no click to open the window / folder gone / cross-site file → ordinary download
        if (e.name === 'NotFoundError') say('Your download folder could not be found — choose it again in Downloads settings.', true);
        return nativeDownload(url, nameHint);
      }
      say((e && e.message) || 'Could not save the file', true);
    }
  }

  // several files at once (Gallery "Download"): one folder for all, asked once
  async function saveMany(items) {
    items = (items || []).filter(x => x && x.url); if (!items.length) return;
    if (items.length === 1) return run(items[0].url, items[0].name);
    try {
      const mode = getMode(); let dir = null;
      if (mode === 'auto') { dir = await getDir(); if (dir && !(await dirReady(dir))) dir = null; }
      if (!dir) { // ask for a folder once
        const start = await getDir();
        dir = await window.showDirectoryPicker({ id: 'wd-save-many', mode: 'readwrite', startIn: start || 'downloads' }).catch(e => { if (e && e.name === 'AbortError') throw CANCEL; throw e; });
      }
      let ok = 0, bad = 0;
      for (const it of items) { try { await saveOne(it.url, it.name, dir); ok++; } catch (e) { if (e === CANCEL) throw e; bad++; } }
      say(`Saved ${ok} file${ok === 1 ? '' : 's'} to ${dir.name}${bad ? ` — ${bad} could not be saved` : ''}`, !!bad && !ok);
    } catch (e) {
      if (e === CANCEL) return;
      items.forEach((it, i) => setTimeout(() => nativeDownload(it.url, it.name), i * 350)); // browser's own downloads
    }
  }

  const active = () => (CAN_SAVE) && getMode() !== 'off';

  // ---------- catch every download ----------
  const origClick = HTMLAnchorElement.prototype.click;
  const DL_HREF = /\/download(\?|$)|[?&](download|dl)=1(&|$)/;
  const isDl = a => {
    if (!a || a.tagName !== 'A' || a.__sdNative) return false;
    const h = a.getAttribute('href'); if (!h || /^(javascript|mailto|tel):/i.test(h)) return false;
    return a.hasAttribute('download') || DL_HREF.test(h);
  };
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !active()) return;
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!isDl(a)) return;
    e.preventDefault(); run(a.href, a.getAttribute('download') || '');
  }, true);
  HTMLAnchorElement.prototype.click = function () { // downloads started by script: a.click()
    if (active() && isDl(this)) return void run(this.href, this.getAttribute('download') || '');
    return origClick.apply(this, arguments);
  };

  // ---------- settings window (reachable by everyone from the sidebar, and from Settings) ----------
  async function settingsHtml() {
    const m = getMode(), dir = await getDir();
    const opt = (v, t, d) => `<label class="dl-opt"><input type="radio" name="dlmode" value="${v}" ${m === v ? 'checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`;
    if (!CAN_SAVE) return `<div class="hint" style="font-size:13px;line-height:1.5">This browser cannot ask for a save location here. Use <b>Chrome</b> or <b>Edge</b> and open the desk over <b>https</b> (or on this computer as <b>localhost</b>). Until then, files go to the browser's normal Downloads folder${SECURE ? '' : ' — this page is not on a secure (https) address'}.</div>`;
    return `<div class="dl-opts">
      ${opt('ask', 'Ask me where to save each file', 'Shows the “Save as” window, just like Chrome.')}
      ${opt('auto', 'Save automatically to my folder', 'No window — files go straight into the folder below.')}
      ${opt('off', 'Use the browser’s normal downloads', 'Turns this off.')}
    </div>
    <div class="dl-folder"><div><div class="lbl" style="font-size:12px;color:var(--ink-3);font-weight:600">Download folder</div><div id="dl-fn" style="font-weight:700">${dir ? esc(dir.name) : '<span class="hint" style="font-size:13px">Not chosen yet</span>'}</div></div>
      <div class="row" style="gap:8px"><button class="btn sm" id="dl-pick">${dir ? 'Change folder' : 'Choose folder'}</button>${dir ? '<button class="btn sm" id="dl-clr">Remove</button>' : ''}</div></div>
    <div class="hint" style="margin-top:10px;line-height:1.5">Chrome does not allow picking <b>Downloads</b>, <b>Documents</b> or <b>Desktop</b> themselves — pick a folder inside one (use <b>New folder</b> in the window, e.g. Downloads → <b>WhatsApp Desk</b>). You can change it whenever you like. In “Ask” mode the Save-as window also opens in this folder.</div>`;
  }
  async function openSettings() {
    const html = await settingsHtml();
    modal(`<h3>Downloads</h3><div id="dl-body">${html}</div><div class="acts"><button class="btn primary" id="dl-done">Done</button></div>`, async (bg, close) => {
      const body = $('#dl-body', bg); $('#dl-done', bg).onclick = close;
      const redraw = async () => { body.innerHTML = await settingsHtml(); wire(); };
      async function choose() {
        try {
          const start = await getDir();
          const h = await window.showDirectoryPicker({ id: 'wd-dl-folder', mode: 'readwrite', startIn: start || 'downloads' });
          await setDir(h); return true;
        } catch (e) {
          if (e && e.name === 'AbortError') return false;
          say(e && e.name === 'SecurityError' ? 'Chrome blocks that folder. Pick or create a folder inside Downloads / Documents instead (for example “WhatsApp Desk”).' : ((e && e.message) || 'Could not use that folder'), true); return false;
        }
      }
      function wire() {
        $$('input[name=dlmode]', body).forEach(r => r.onchange = async () => {
          if (r.value === 'auto' && !(await getDir())) { if (!(await choose())) { setMode(getMode()); return redraw(); } }
          setMode(r.value); say(r.value === 'auto' ? 'Files will be saved automatically to your folder' : r.value === 'ask' ? 'You will be asked where to save each file' : 'Normal browser downloads'); redraw();
        });
        const p = $('#dl-pick', body); if (p) p.onclick = async () => { if (await choose()) { say('Download folder saved'); redraw(); } };
        const c = $('#dl-clr', body); if (c) c.onclick = async () => { await clearDir(); if (getMode() === 'auto') setMode('ask'); say('Folder removed'); redraw(); };
      }
      wire();
    });
  }

  window.DL = { run, saveMany, active, openSettings, settingsHtml, mode: getMode, supported: CAN_SAVE };

  // small styles for the settings window
  const st = document.createElement('style');
  st.textContent = `.dl-opts{display:grid;gap:8px;margin-bottom:14px}.dl-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1.5px solid var(--line-2);border-radius:12px;cursor:pointer;background:var(--surface)}
.dl-opt:has(input:checked){border-color:var(--brand);background:var(--brand-soft)}.dl-opt input{margin-top:3px;accent-color:var(--brand)}.dl-opt span{display:grid;gap:2px}.dl-opt b{font-size:13.5px}.dl-opt small{color:var(--ink-3);font-size:12px}
.dl-folder{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:1.5px dashed var(--line-2);border-radius:12px;flex-wrap:wrap}`;
  document.head.appendChild(st);
})();
