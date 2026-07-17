// Cross-device sync for Jot — stores the item list as data/items.json in a
// PRIVATE GitHub repo via the Contents API. Pulls on focus/60s, pushes on
// change (debounced ~1.5s), last-write-wins by timestamp. localStorage stays
// the live cache so the app works instantly and offline. Same pattern as
// Neil AI Hub's js/sync.js, but vanilla JS (no build step, no React) and
// deliberately points at a separate PRIVATE repo — unlike the hub, actual
// data never lands in the (public, Pages-hosted) app repo.
(() => {
  const OWNER = 'zvcodez';
  const REPO = 'jot-data';
  const BRANCH = 'main';
  const PATH = 'data/items.json';

  const TOKEN_KEY = 'jot:sync-token';
  const ENABLED_KEY = 'jot:sync-enabled';
  const META_KEY = 'jot:sync-meta'; // { updatedAt, sha }
  const LAST_KEY = 'jot:sync-last';

  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken = (t) => localStorage.setItem(TOKEN_KEY, t || '');
  const isEnabled = () => localStorage.getItem(ENABLED_KEY) === '1';
  const setEnabled = (v) => localStorage.setItem(ENABLED_KEY, v ? '1' : '0');
  const getMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } };
  const setMeta = (m) => localStorage.setItem(META_KEY, JSON.stringify(m));

  const enc = (str) => btoa(unescape(encodeURIComponent(str)));
  const dec = (b64) => decodeURIComponent(escape(atob((b64 || '').replace(/\s/g, ''))));

  function headers() {
    const token = getToken();
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }
  const url = () => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

  async function getFile() {
    const res = await fetch(`${url()}?ref=${BRANCH}`, { headers: headers() });
    if (res.status === 404) return null;
    if (res.status === 401) throw new Error('Token rejected — check it has Contents read/write access.');
    if (!res.ok) throw new Error(`GitHub read failed (${res.status}).`);
    const json = await res.json();
    let parsed = { updatedAt: '', data: [] };
    try { parsed = JSON.parse(dec(json.content)); } catch {}
    return { sha: json.sha, updatedAt: parsed.updatedAt || '', data: parsed.data || [] };
  }

  async function putFile(value, updatedAt, sha) {
    const body = {
      message: 'sync: update items.json',
      content: enc(JSON.stringify({ updatedAt, data: value }, null, 2)),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    };
    const res = await fetch(url(), {
      method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) {
      const cur = await getFile();
      if (cur && cur.sha !== sha) return putFile(value, updatedAt, cur.sha);
    }
    if (res.status === 401 || res.status === 403) throw new Error('Token lacks write access (needs Contents: read/write).');
    if (!res.ok) throw new Error(`GitHub write failed (${res.status}).`);
    const json = await res.json();
    return json.content && json.content.sha;
  }

  let status = { state: 'off', enabled: isEnabled(), lastSync: localStorage.getItem(LAST_KEY) || '', error: '' };
  let statusCb = () => {};
  function setStatus(patch) { status = { ...status, ...patch }; statusCb(status); }

  let getItems = () => [];
  let setItems = () => {};
  let running = false;
  let dirty = false;
  let timer = null;

  async function pushLocal() {
    const meta = getMeta();
    const updatedAt = meta.updatedAt || new Date().toISOString();
    const value = getItems();
    const newSha = await putFile(value, updatedAt, meta.sha);
    setMeta({ updatedAt, sha: newSha });
  }

  async function reconcile() {
    const remote = await getFile();
    const meta = getMeta();
    const localUpdatedAt = meta.updatedAt || '';

    if (!remote) {
      if (localUpdatedAt) await pushLocal();
      return;
    }
    if (remote.updatedAt > localUpdatedAt) {
      setItems(remote.data);
      setMeta({ updatedAt: remote.updatedAt, sha: remote.sha });
      window.dispatchEvent(new CustomEvent('jot:external-update', { detail: remote.data }));
    } else if (localUpdatedAt && localUpdatedAt > remote.updatedAt) {
      setMeta({ ...meta, sha: remote.sha });
      await pushLocal();
    } else {
      setMeta({ updatedAt: remote.updatedAt, sha: remote.sha });
    }
  }

  async function syncAll() {
    if (!isEnabled() || !getToken() || running) return;
    running = true;
    setStatus({ state: 'syncing', error: '' });
    try {
      await reconcile();
      const now = new Date().toISOString();
      localStorage.setItem(LAST_KEY, now);
      setStatus({ state: 'idle', lastSync: now, error: '' });
    } catch (e) {
      setStatus({ state: 'error', error: e.message || 'Sync failed.' });
    } finally {
      running = false;
    }
  }

  async function flush() {
    if (!isEnabled() || !getToken() || !dirty) return;
    dirty = false;
    setStatus({ state: 'syncing', error: '' });
    try {
      await pushLocal();
      const now = new Date().toISOString();
      localStorage.setItem(LAST_KEY, now);
      setStatus({ state: 'idle', lastSync: now, error: '' });
    } catch (e) {
      dirty = true;
      setStatus({ state: 'error', error: e.message || 'Sync failed.' });
    }
  }

  function markDirty() {
    setMeta({ ...getMeta(), updatedAt: new Date().toISOString() });
    if (!isEnabled() || !getToken()) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }

  async function enable(token) {
    if (token) setToken(token);
    if (!getToken()) throw new Error('A GitHub token is required.');
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, { headers: headers() });
    if (res.status === 401) throw new Error('Token is invalid.');
    if (res.status === 404) throw new Error(`Can't see ${OWNER}/${REPO}. Create that private repo first, and give the token access to it.`);
    if (!res.ok) throw new Error(`GitHub error (${res.status}).`);
    setEnabled(true);
    setStatus({ enabled: true, state: 'idle' });
    const meta = getMeta();
    if (!meta.updatedAt && getItems().length) setMeta({ ...meta, updatedAt: new Date().toISOString() });
    await syncAll();
  }

  function disable() {
    setEnabled(false);
    setStatus({ enabled: false, state: 'off', error: '' });
  }

  function ago(iso) {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`;
    return new Date(iso).toLocaleString();
  }

  function buildPanel() {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    const on = isEnabled();
    bg.innerHTML = `
      <div class="modal">
        <div class="closebar"></div>
        <h3>Cross-device sync</h3>
        <p>Stores your items in the private <strong>${OWNER}/${REPO}</strong> GitHub repo so your phone and Mac share the same list. Data is never stored in this app's own (public) repo.</p>
        <p>Create the repo once (private!), then a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> scoped to just that repo with <strong>Contents: Read and write</strong>, and paste it below.</p>
        <div class="field">
          <label>GitHub token</label>
          <input type="password" id="jotTokenInput" placeholder="github_pat_…" value="${getToken()}">
        </div>
        <div id="jotSyncErr"></div>
        <div class="sync-status">
          <span class="dot ${on ? (status.state === 'error' ? 'err' : 'on') : ''}"></span>
          <span id="jotSyncStatusText">${on ? `Sync is on · last synced ${ago(status.lastSync)}` : 'Sync is off'}</span>
        </div>
        <p style="font-size:11px;opacity:.6;margin:6px 0 0">Build ${window.__BUILD__ || '?'}</p>
        <div id="jotDiag" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10.5px;color:var(--ink-soft);opacity:.7;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line);font-family:monospace"></div>
        <div class="modal-actions">
          ${on
            ? `<button class="btn ghost" id="jotSyncOff">Turn off</button><button class="btn primary" id="jotSyncNow">Sync now</button>`
            : `<button class="btn ghost" id="jotSyncCancel">Cancel</button><button class="btn primary" id="jotSyncOn">Enable sync</button>`}
        </div>
      </div>`;
    document.body.appendChild(bg);

    if (typeof window.__recalcDiag__ === 'function') window.__recalcDiag__();
    setTimeout(() => {
      const d = window.__DIAG__;
      const diagEl = bg.querySelector('#jotDiag');
      if (d && diagEl) {
        diagEl.innerHTML = `
          <span>standalone: ${String(d.standalone)}</span>
          <span>innerHeight: ${d.innerHeight}</span>
          <span>vv height: ${d.vvHeight}</span>
          <span>dpr: ${d.dpr}</span>
          <span>safe-top: ${d.safeTop}</span>
          <span>safe-bottom: ${d.safeBottom}</span>`;
      }
    }, 60);

    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

    const tokenInput = bg.querySelector('#jotTokenInput');
    const errEl = bg.querySelector('#jotSyncErr');
    const showErr = (msg) => { errEl.innerHTML = msg ? `<div class="sync-err">${msg}</div>` : ''; };

    const offBtn = bg.querySelector('#jotSyncOff');
    if (offBtn) offBtn.addEventListener('click', () => { disable(); close(); });

    const nowBtn = bg.querySelector('#jotSyncNow');
    if (nowBtn) nowBtn.addEventListener('click', async () => {
      nowBtn.disabled = true; nowBtn.textContent = 'Syncing…';
      await syncAll();
      close();
    });

    const cancelBtn = bg.querySelector('#jotSyncCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    const onBtn = bg.querySelector('#jotSyncOn');
    if (onBtn) onBtn.addEventListener('click', async () => {
      showErr('');
      onBtn.disabled = true; onBtn.textContent = 'Connecting…';
      try {
        await enable(tokenInput.value.trim());
        close();
      } catch (e) {
        showErr(e.message);
        onBtn.disabled = false; onBtn.textContent = 'Enable sync';
      }
    });
  }

  window.JotSync = {
    init({ getItems: gi, setItems: si, onStatus }) {
      getItems = gi; setItems = si; statusCb = onStatus || (() => {});
      statusCb(status);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncAll();
        else flush();
      });
      window.addEventListener('online', syncAll);
      setInterval(() => { if (document.visibilityState === 'visible') syncAll(); }, 60000);
      if (isEnabled() && getToken()) syncAll();
    },
    markDirty,
    openPanel: buildPanel,
  };
})();
