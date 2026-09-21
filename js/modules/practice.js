/* 练习记录：听力 / 阅读 / 写作 / 口语 */
Views.practice = (() => {
  const TYPES = { listening: '🎧 听力', reading: '📖 阅读', writing: '✍️ 写作', speaking: '🗣️ 口语' };
  let filter = 'all';
  let expanded = null;

  function render(el) {
    const all = Store.data.practices.slice().sort((a, b) => (b.date + (b.createdAt || 0)).localeCompare(a.date + (a.createdAt || 0)));
    const list = filter === 'all' ? all : all.filter((p) => p.type === filter);
    const totalMin = all.reduce((s, p) => s + (Number(p.minutes) || 0), 0);
    const counts = Object.keys(TYPES).map((t) => `${TYPES[t].slice(3)} ${all.filter((p) => p.type === t).length}`).join(' · ');

    el.innerHTML = `
      <div class="page-head">
        <div><h1>练习记录</h1><div class="sub">${all.length} 次 · ${totalMin} 分钟 · ${counts}</div></div>
        <div class="btn-row">
          <button class="btn" id="genMaterial">✨ AI 生成练习材料</button>
          <button class="btn primary" id="addRec">+ 记一次练习</button>
        </div>
      </div>
      <div class="tabs">
        <button data-f="all" class="${filter === 'all' ? 'active' : ''}">全部</button>
        ${Object.keys(TYPES).map((t) => `<button data-f="${t}" class="${filter === t ? 'active' : ''}">${TYPES[t]}</button>`).join('')}
      </div>
      <div class="list" id="recList">${list.length ? list.map(itemHTML).join('') : '<div class="card"><div class="empty"><div class="big">📚</div>还没有记录。每次练习完花一分钟记下材料、时长和错误，进步会更清楚。</div></div>'}</div>`;

    el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(el); }));
    el.querySelector('#addRec').addEventListener('click', () => openEditor(null));
    el.querySelector('#genMaterial').addEventListener('click', openGenerator);
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const id = b.closest('.item').dataset.id; expanded = expanded === id ? null : id; render(el); }));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(byId(b.closest('.item').dataset.id))));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('.item').dataset.id;
      if (await UI.confirm('删除这条练习记录？')) { Store.data.practices = Store.data.practices.filter((p) => p.id !== id); Store.save(); render(el); }
    }));
    el.querySelectorAll('[data-ai]').forEach((b) => b.addEventListener('click', () => aiFeedback(byId(b.closest('.item').dataset.id), b)));
  }

  function byId(id) { return Store.data.practices.find((p) => p.id === id); }

  function itemHTML(p) {
    const open = expanded === p.id;
    const canAi = (p.type === 'writing' || p.type === 'speaking') && p.content;
    return `<div class="item card" data-id="${p.id}" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="body">
          <div class="title">${TYPES[p.type] || p.type} · ${UI.esc(p.material || '未命名')}</div>
          <div class="meta">${p.date} 周${UI.weekday(p.date)} · ${p.minutes || 0} 分钟${p.score ? ` · <span class="tag">${UI.esc(p.score)}</span>` : ''}${p.ai ? '<span class="tag green">已 AI 反馈</span>' : ''}</div>
          ${p.reflection && !open ? `<div class="small muted mt" style="margin-top:4px">${UI.esc(p.reflection.slice(0, 80))}${p.reflection.length > 80 ? '…' : ''}</div>` : ''}
        </div>
        <div class="actions">
          ${canAi ? `<button class="btn sm ${p.ai ? '' : 'primary'}" data-ai>${p.ai ? '重新反馈' : '✨ AI 反馈'}</button>` : ''}
          <button class="btn sm" data-toggle>${open ? '收起' : '详情'}</button>
          <button class="btn sm" data-edit>编辑</button>
          <button class="btn sm danger" data-del>删</button>
        </div>
      </div>
      ${open ? `<hr>
        ${p.prompt ? `<div class="small"><strong>题目：</strong>${UI.esc(p.prompt)}</div>` : ''}
        ${p.mistakes ? `<div class="small mt"><strong>错误 / 难点：</strong><br>${UI.esc(p.mistakes).replace(/\n/g, '<br>')}</div>` : ''}
        ${p.reflection ? `<div class="small mt"><strong>心得：</strong><br>${UI.esc(p.reflection).replace(/\n/g, '<br>')}</div>` : ''}
        ${p.content ? `<details class="mt"><summary class="small muted">${p.type === 'writing' ? '作文原文' : p.type === 'speaking' ? '口语文字稿' : '内容'}</summary><pre class="code" style="white-space:pre-wrap">${UI.esc(p.content)}</pre></details>` : ''}
        ${p.ai ? `<div class="ai-box"><div class="ai-label">Claude 反馈 · ${UI.fmtTime(p.aiAt)}</div>${UI.md(p.ai)}</div>` : ''}` : ''}
    </div>`;
  }

  function openEditor(p) {
    const isNew = !p;
    p = p || { type: filter === 'all' ? 'listening' : filter, date: UI.today(), minutes: 30 };
    const m = UI.modal(isNew ? '记一次练习' : '编辑练习记录', `
      <div class="row">
        <label class="field"><span>类型</span><select id="pType">${Object.keys(TYPES).map((t) => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${TYPES[t]}</option>`).join('')}</select></label>
        <label class="field"><span>日期</span><input type="date" id="pDate" value="${p.date}"></label>
        <label class="field"><span>时长（分钟）</span><input type="number" id="pMin" min="0" value="${p.minutes || ''}"></label>
      </div>
      <label class="field"><span>材料 / 名称</span><input type="text" id="pMaterial" value="${UI.esc(p.material || '')}" placeholder="剑桥 18 Test 2 Section 3 / TED: ... / Task 2 议论文"></label>
      <label class="field"><span>得分 / 正确率</span><input type="text" id="pScore" value="${UI.esc(p.score || '')}" placeholder="32/40 · 6.5 · 估 7.0"></label>
      <label class="field" id="promptField"><span>题目（写作 / 口语）</span><input type="text" id="pPrompt" value="${UI.esc(p.prompt || '')}"></label>
      <label class="field" id="contentField"><span id="contentLabel">作文原文 / 口语文字稿（AI 批改需要）</span><textarea id="pContent" rows="7">${UI.esc(p.content || '')}</textarea></label>
      <label class="field"><span>错误 / 难点</span><textarea id="pMistakes" rows="3" placeholder="听不出连读 / 同义替换没认出 / 时态错误…">${UI.esc(p.mistakes || '')}</textarea></label>
      <label class="field"><span>心得</span><textarea id="pReflection" rows="2">${UI.esc(p.reflection || '')}</textarea></label>`,
      { wide: true, footer: '<button class="btn primary" id="ok">保存</button>' });

    const sync = () => {
      const t = m.el.querySelector('#pType').value;
      const show = t === 'writing' || t === 'speaking';
      m.el.querySelector('#promptField').style.display = show ? '' : 'none';
      m.el.querySelector('#contentField').style.display = show ? '' : 'none';
      m.el.querySelector('#contentLabel').textContent = t === 'writing' ? '作文原文（AI 批改需要）' : '口语文字稿（可用手机语音转文字，AI 反馈需要）';
    };
    m.el.querySelector('#pType').addEventListener('change', sync); sync();
    m.el.querySelector('#ok').addEventListener('click', () => {
      const v = (id) => m.el.querySelector(id).value.trim();
      const rec = {
        type: v('#pType'), date: v('#pDate') || UI.today(), minutes: Number(v('#pMin')) || 0, material: v('#pMaterial'),
        score: v('#pScore'), prompt: v('#pPrompt'), content: v('#pContent'), mistakes: v('#pMistakes'), reflection: v('#pReflection'),
      };
      if (isNew) Store.data.practices.push(Object.assign({ id: Store.uid(), createdAt: Date.now() }, rec));
      else Object.assign(p, rec);
      Store.save(); m.close(); App.rerender();
      UI.toast('已保存', 'success');
    });
  }

  async function aiFeedback(p, btn) {
    if (!AI.ready()) return UI.toast('请先在设置里填写 Claude API Key', 'error');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 批改中';
    try {
      const text = p.type === 'writing'
        ? await AI.gradeWriting({ task: p.material || 'Task 2', prompt: p.prompt, essay: p.content })
        : await AI.gradeSpeaking({ part: p.material || 'Part 2', topic: p.prompt, transcript: p.content });
      p.ai = text; p.aiAt = Date.now();
      Store.save();
      expanded = p.id;
      App.rerender();
      UI.toast('反馈已生成', 'success');
    } catch (e) {
      UI.toast(e.message, 'error');
      btn.disabled = false; btn.textContent = '✨ AI 反馈';
    }
  }

  function openGenerator() {
    if (!AI.ready()) return UI.toast('请先在设置里填写 Claude API Key', 'error');
    const m = UI.modal('AI 生成练习材料', `
      <div class="row">
        <label class="field"><span>类型</span><select id="gKind">
          <option value="us_daily">🇺🇸 美国生活情景对话</option>
          <option value="ielts_part2">🗣️ 雅思口语 Part 2 题卡 + 范例</option>
          <option value="ielts_part3">🗣️ 雅思口语 Part 3 追问</option>
          <option value="writing_task2">✍️ 雅思写作 Task 2 题目 + 提纲</option>
        </select></label>
        <label class="field" style="flex:2"><span>场景 / 话题方向（可留空随机）</span><input type="text" id="gFocus" placeholder="看医生 / 租房 / education / environment"></label>
      </div>
      <div id="gOut"></div>`,
      { wide: true, footer: '<button class="btn primary" id="gen">生成</button><button class="btn" id="saveAsRec" style="display:none">存为练习记录</button>' });
    let result = '';
    m.el.querySelector('#gen').addEventListener('click', async () => {
      const btn = m.el.querySelector('#gen');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 生成中';
      try {
        result = await AI.generateTopic({ kind: m.el.querySelector('#gKind').value, focus: m.el.querySelector('#gFocus').value.trim() });
        m.el.querySelector('#gOut').innerHTML = `<div class="ai-box">${UI.md(result)}</div>`;
        m.el.querySelector('#saveAsRec').style.display = '';
      } catch (e) { UI.toast(e.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = '再生成一份'; }
    });
    m.el.querySelector('#saveAsRec').addEventListener('click', () => {
      const kind = m.el.querySelector('#gKind').value;
      Store.data.practices.push({
        id: Store.uid(), createdAt: Date.now(), date: UI.today(), minutes: 0,
        type: kind === 'writing_task2' ? 'writing' : 'speaking',
        material: { us_daily: '美国生活对话', ielts_part2: '口语 Part 2', ielts_part3: '口语 Part 3', writing_task2: '写作 Task 2' }[kind] + (m.el.querySelector('#gFocus').value.trim() ? '：' + m.el.querySelector('#gFocus').value.trim() : ''),
        prompt: '', content: '', mistakes: '', reflection: '', ai: result, aiAt: Date.now(),
      });
      Store.save(); m.close(); App.rerender();
      UI.toast('已保存为练习记录，练完记得补上时长和心得', 'success');
    });
  }

  return { render };
})();
