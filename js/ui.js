/* 各页面视图注册表（各模块往里挂 render 函数） */
window.Views = {};

/* 通用 UI 工具：转义、提示、弹窗、日期、简易 Markdown */
const UI = (() => {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, type === 'error' ? 5000 : 2500);
  }

  /** 打开弹窗。返回 { el, body, close } */
  function modal(title, bodyHTML, opts = {}) {
    const root = document.getElementById('modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${opts.wide ? 'wide' : ''}" role="dialog">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="btn sm ghost" data-close>关闭</button></div>
        <div class="modal-body">${bodyHTML}</div>
        ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
      </div>`;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.hasAttribute('data-close')) close();
    });
    document.addEventListener('keydown', onKey);
    root.appendChild(wrap);
    const api = { el: wrap, body: wrap.querySelector('.modal-body'), foot: wrap.querySelector('.modal-foot'), close };
    if (opts.onOpen) opts.onOpen(api);
    return api;
  }

  function confirm(msg) { return Promise.resolve(window.confirm(msg)); }

  /** 本地日期 YYYY-MM-DD */
  function dateStr(d = new Date()) {
    const dt = d instanceof Date ? d : new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${m}-${day}`;
  }
  function today() { return dateStr(new Date()); }
  function addDays(dateString, n) {
    const d = new Date(dateString + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }
  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }
  function fmtTime(ts) {
    if (!ts) return '从未';
    const d = new Date(ts);
    return `${dateStr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function weekday(dateString) { return WEEK[new Date(dateString + 'T00:00:00').getDay()]; }

  /** 极简 Markdown 渲染（标题、粗体、列表、引用、代码、段落） */
  function md(text) {
    const lines = String(text || '').split('\n');
    let html = '', inList = null;
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$)/g, '$1<em>$2</em>');
    const closeList = () => { if (inList) { html += `</${inList}>`; inList = null; } };
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      let m;
      if ((m = line.match(/^(#{1,3})\s+(.*)/))) { closeList(); html += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; }
      else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^>\s?(.*)/))) { closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
      else if (line.trim() === '') { closeList(); }
      else { closeList(); html += `<p>${inline(line)}</p>`; }
    }
    closeList();
    return `<div class="md">${html}</div>`;
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { esc, toast, modal, confirm, dateStr, today, addDays, daysBetween, fmtTime, weekday, md, download };
})();
