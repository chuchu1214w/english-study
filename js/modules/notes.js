/* 错题本与语法笔记 */
Views.notes = (() => {
  let type = 'error';
  let q = '', tagFilter = '';
  let expanded = null;

  function render(el) {
    const notes = Store.data.notes.filter((n) => n.type === type);
    const tags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();
    const kw = q.trim().toLowerCase();
    const list = notes
      .filter((n) => (!kw || [n.title, n.content, n.example].join(' ').toLowerCase().includes(kw)) && (!tagFilter || (n.tags || []).includes(tagFilter)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    el.innerHTML = `
      <div class="page-head">
        <div><h1>笔记</h1><div class="sub">错题 ${Store.data.notes.filter((n) => n.type === 'error').length} · 语法 ${Store.data.notes.filter((n) => n.type === 'grammar').length}</div></div>
        <button class="btn primary" id="add">+ 新建${type === 'error' ? '错题' : '语法笔记'}</button>
      </div>
      <div class="tabs">
        <button data-t="error" class="${type === 'error' ? 'active' : ''}">❌ 错题本</button>
        <button data-t="grammar" class="${type === 'grammar' ? 'active' : ''}">📐 语法笔记</button>
      </div>
      <div class="row search">
        <input type="text" id="q" placeholder="搜索标题、内容" value="${UI.esc(q)}">
        <select id="tagFilter"><option value="">全部标签</option>${tags.map((t) => `<option ${t === tagFilter ? 'selected' : ''}>${UI.esc(t)}</option>`).join('')}</select>
      </div>
      <div class="list">${list.length ? list.map(itemHTML).join('') : `<div class="card"><div class="empty"><div class="big">${type === 'error' ? '❌' : '📐'}</div>还没有${type === 'error' ? '错题' : '语法笔记'}</div></div>`}</div>`;

    el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { type = b.dataset.t; tagFilter = ''; render(el); }));
    el.querySelector('#add').addEventListener('click', () => openEditor(null));
    el.querySelector('#q').addEventListener('input', (e) => { q = e.target.value; render(el); const i = el.querySelector('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    el.querySelector('#tagFilter').addEventListener('change', (e) => { tagFilter = e.target.value; render(el); });
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const id = b.closest('.item').dataset.id; expanded = expanded === id ? null : id; render(el); }));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(byId(b.closest('.item').dataset.id))));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('.item').dataset.id;
      if (await UI.confirm('删除这条笔记？')) { Store.data.notes = Store.data.notes.filter((n) => n.id !== id); Store.save(); render(el); }
    }));
    el.querySelectorAll('[data-ai]').forEach((b) => b.addEventListener('click', () => aiExplain(byId(b.closest('.item').dataset.id), b)));
  }

  function byId(id) { return Store.data.notes.find((n) => n.id === id); }

  function itemHTML(n) {
    const open = expanded === n.id;
    return `<div class="item card" data-id="${n.id}" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="body">
          <div class="title">${UI.esc(n.title)}</div>
          <div class="meta">${(n.tags || []).map((t) => `<span class="tag grey">${UI.esc(t)}</span>`).join('')}${UI.dateStr(n.updatedAt || n.createdAt)}${n.ai ? ' <span class="tag green">已 AI 讲解</span>' : ''}</div>
          ${!open ? `<div class="small muted" style="margin-top:4px">${UI.esc((n.content || '').slice(0, 100))}${(n.content || '').length > 100 ? '…' : ''}</div>` : ''}
        </div>
        <div class="actions">
          <button class="btn sm ${n.ai ? '' : 'primary'}" data-ai>${n.ai ? '重新讲解' : '✨ AI 讲解'}</button>
          <button class="btn sm" data-toggle>${open ? '收起' : '详情'}</button>
          <button class="btn sm" data-edit>编辑</button>
          <button class="btn sm danger" data-del>删</button>
        </div>
      </div>
      ${open ? `<hr>
        <div class="small" style="white-space:pre-wrap">${UI.esc(n.content)}</div>
        ${n.example ? `<div class="small mt"><strong>${type === 'error' ? '原题 / 句子：' : '例句：'}</strong><br><span style="white-space:pre-wrap">${UI.esc(n.example)}</span></div>` : ''}
        ${n.ai ? `<div class="ai-box"><div class="ai-label">Claude 讲解 · ${UI.fmtTime(n.aiAt)}</div>${UI.md(n.ai)}</div>` : ''}` : ''}
    </div>`;
  }

  function openEditor(n) {
    const isNew = !n;
    n = n || { type, tags: [] };
    const isErr = n.type === 'error';
    const m = UI.modal(isNew ? (isErr ? '新建错题' : '新建语法笔记') : '编辑笔记', `
      <label class="field"><span>标题</span><input type="text" id="nTitle" value="${UI.esc(n.title || '')}" placeholder="${isErr ? '如：听力 Section 2 地图题方位词' : '如：虚拟语气 if I were'}"></label>
      <label class="field"><span>${isErr ? '错在哪里 / 正确答案 / 原因' : '规则说明'}</span><textarea id="nContent" rows="5">${UI.esc(n.content || '')}</textarea></label>
      <label class="field"><span>${isErr ? '原题或句子（可选）' : '例句（可选）'}</span><textarea id="nExample" rows="3">${UI.esc(n.example || '')}</textarea></label>
      <label class="field"><span>标签（逗号分隔）</span><input type="text" id="nTags" value="${UI.esc((n.tags || []).join(', '))}" placeholder="${isErr ? '听力, 同义替换' : '时态, 从句'}"></label>`,
      { footer: '<button class="btn primary" id="ok">保存</button>' });
    m.el.querySelector('#ok').addEventListener('click', () => {
      const v = (id) => m.el.querySelector(id).value.trim();
      const rec = { title: v('#nTitle'), content: v('#nContent'), example: v('#nExample'), tags: v('#nTags').split(/[,，]/).map((t) => t.trim()).filter(Boolean), updatedAt: Date.now() };
      if (!rec.title) return UI.toast('请填写标题', 'error');
      if (isNew) Store.data.notes.push(Object.assign({ id: Store.uid(), type, createdAt: Date.now() }, rec));
      else Object.assign(n, rec);
      Store.save(); m.close(); App.rerender();
      UI.toast('已保存', 'success');
    });
  }

  async function aiExplain(n, btn) {
    if (!AI.ready()) return UI.toast('请先在设置里填写 Claude API Key', 'error');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 讲解中';
    try {
      n.ai = await AI.explainNote(n); n.aiAt = Date.now();
      Store.save(); expanded = n.id; App.rerender();
    } catch (e) { UI.toast(e.message, 'error'); btn.disabled = false; btn.textContent = '✨ AI 讲解'; }
  }

  return { render };
})();
