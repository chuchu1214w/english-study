/* GitHub 同步：通过 Contents API 把 data.json 读写到私有仓库 */
const Sync = (() => {
  const META_KEY = 'es_sync_meta_v1';
  let timer = null;
  let busy = false;

  function meta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setMeta(patch) {
    localStorage.setItem(META_KEY, JSON.stringify(Object.assign(meta(), patch)));
  }

  function cfg() {
    const g = Store.data.settings.github;
    const token = Store.secrets().ghToken;
    return { ...g, token };
  }
  function ready() {
    const c = cfg();
    return !!(c.token && c.owner && c.repo && c.path);
  }

  function apiUrl(c) {
    return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
  }
  function headers(c) {
    return {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /* UTF-8 安全的 base64 */
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function ghFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 404) return { notFound: true };
    if (!res.ok) {
      let msg = `GitHub ${res.status}`;
      try { const j = await res.json(); if (j.message) msg += `: ${j.message}`; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    return res.json();
  }

  /** 拉取远程文件；文件不存在返回 null */
  async function fetchRemote() {
    const c = cfg();
    const r = await ghFetch(`${apiUrl(c)}?ref=${encodeURIComponent(c.branch || 'main')}`, { headers: headers(c) });
    if (r.notFound) return null;
    let content = null;
    try { content = JSON.parse(b64decode(r.content)); } catch (e) { throw new Error('远程 data.json 不是合法 JSON'); }
    return { sha: r.sha, content };
  }

  async function writeRemote(sha) {
    const c = cfg();
    const body = {
      message: `sync: ${UI.fmtTime(Date.now())}`,
      content: b64encode(Store.exportJSON()),
      branch: c.branch || 'main',
    };
    if (sha) body.sha = sha;
    const r = await ghFetch(apiUrl(c), { method: 'PUT', headers: { ...headers(c), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.content.sha;
  }

  /* ---- 状态指示 ---- */
  function setStatus(state, label) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    el.className = 'sync-indicator ' + state;
    el.querySelector('.label').textContent = label;
  }
  function refreshStatus() {
    if (!ready()) { setStatus('', '本地'); return; }
    const m = meta();
    const dirty = Store.data.updatedAt > (m.syncedAt || 0);
    setStatus(dirty ? 'dirty' : 'ok', dirty ? '待同步' : '已同步');
  }

  /** 推送：本地 -> 远程。若远程被其他设备改动，按时间戳提示 */
  async function push({ silent = false } = {}) {
    if (!ready()) { if (!silent) UI.toast('请先在设置里填写 GitHub Token', 'error'); return false; }
    if (busy) return false;
    busy = true; setStatus('busy', '同步中');
    try {
      const remote = await fetchRemote();
      const m = meta();
      if (remote && remote.sha !== m.sha && remote.content.updatedAt > (m.syncedAt || 0)) {
        // 远程有别处的新改动
        const useRemote = await UI.confirm(
          `远程数据（${UI.fmtTime(remote.content.updatedAt)}）比上次同步新，可能来自其他设备。\n\n点“确定”用远程覆盖本地，点“取消”用本地覆盖远程。`
        );
        if (useRemote) {
          Store.replace(remote.content, false);
          setMeta({ sha: remote.sha, syncedAt: remote.content.updatedAt });
          UI.toast('已用远程数据覆盖本地', 'success');
          App.rerender();
          return true;
        }
      }
      const sha = await writeRemote(remote ? remote.sha : null);
      setMeta({ sha, syncedAt: Store.data.updatedAt });
      if (!silent) UI.toast('已同步到 GitHub', 'success');
      return true;
    } catch (e) {
      setStatus('error', '同步失败');
      if (!silent) UI.toast('同步失败：' + e.message, 'error');
      console.error(e);
      return false;
    } finally {
      busy = false;
      const el = document.getElementById('syncIndicator');
      if (el && !el.classList.contains('error')) refreshStatus();
    }
  }

  /** 拉取：远程 -> 本地 */
  async function pull({ silent = false, force = false } = {}) {
    if (!ready()) { if (!silent) UI.toast('请先在设置里填写 GitHub Token', 'error'); return false; }
    if (busy) return false;
    busy = true; setStatus('busy', '同步中');
    try {
      const remote = await fetchRemote();
      if (!remote) { if (!silent) UI.toast('远程还没有 data.json，先推送一次即可创建', ''); return false; }
      const m = meta();
      const localDirty = Store.data.updatedAt > (m.syncedAt || 0);
      const remoteNewer = remote.content.updatedAt > Store.data.updatedAt;
      if (!force && localDirty && !remoteNewer) { if (!silent) UI.toast('本地更新，无需拉取；如需覆盖请用“推送”', ''); return false; }
      if (!force && localDirty && remoteNewer) {
        const ok = await UI.confirm('本地有未同步的改动，远程也更新了。确定用远程覆盖本地吗？');
        if (!ok) return false;
      }
      Store.replace(remote.content, false);
      setMeta({ sha: remote.sha, syncedAt: remote.content.updatedAt });
      if (!silent) UI.toast('已从 GitHub 拉取最新数据', 'success');
      App.rerender();
      return true;
    } catch (e) {
      setStatus('error', '同步失败');
      if (!silent) UI.toast('拉取失败：' + e.message, 'error');
      return false;
    } finally {
      busy = false;
      const el = document.getElementById('syncIndicator');
      if (el && !el.classList.contains('error')) refreshStatus();
    }
  }

  /** 测试 token 与仓库是否可访问 */
  async function test() {
    const c = cfg();
    const r = await ghFetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, { headers: headers(c) });
    if (r.notFound) throw new Error('仓库不存在或 Token 无权访问');
    return r;
  }

  /** 数据变动后延迟自动推送 */
  function scheduleAuto() {
    refreshStatus();
    if (!ready() || !Store.data.settings.github.autoSync) return;
    clearTimeout(timer);
    timer = setTimeout(() => push({ silent: true }), 4000);
  }

  function init() {
    Store.onChange((_, touched) => { if (touched) scheduleAuto(); else refreshStatus(); });
    document.getElementById('syncIndicator').addEventListener('click', () => push());
    refreshStatus();
    if (ready()) pull({ silent: true });
  }

  return { init, push, pull, test, ready, refreshStatus, meta };
})();
