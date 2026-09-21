/* 单词模块：复习、词库、添加 */
Views.vocab = (() => {
  let tab = 'review';
  let session = null; // 当前复习会话 { queue, index, flipped, done, again }

  function render(el) {
    const d = Store.data;
    const due = SRS.dueWords(d.words, d.settings);
    el.innerHTML = `
      <div class="page-head">
        <div><h1>单词</h1><div class="sub">待复习 ${due.review.length} · 今日新词 ${due.fresh.length} · 词库 ${d.words.length}</div></div>
      </div>
      <div class="tabs">
        <button data-tab="review" class="${tab === 'review' ? 'active' : ''}">复习 ${due.all.length ? `(${due.all.length})` : ''}</button>
        <button data-tab="list" class="${tab === 'list' ? 'active' : ''}">词库</button>
        <button data-tab="add" class="${tab === 'add' ? 'active' : ''}">添加</button>
      </div>
      <div id="tabBody"></div>`;
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(el); }));
    const body = el.querySelector('#tabBody');
    if (tab === 'review') renderReview(body, due);
    else if (tab === 'list') renderList(body);
    else renderAdd(body);
  }

  /* ---------- 复习 ---------- */
  function renderReview(body, due) {
    if (!session || session.finished) {
      if (!due.all.length) {
        body.innerHTML = `<div class="card"><div class="empty"><div class="big">🎉</div>今天没有待复习的单词了<br><span class="small">词库共 ${Store.data.words.length} 个词，去“添加”页录入更多</span></div></div>`;
        return;
      }
      session = { queue: due.all.slice(), index: 0, flipped: false, reviewed: 0, again: 0, finished: false };
    }
    const s = session;
    if (s.index >= s.queue.length) {
      s.finished = true;
      body.innerHTML = `<div class="card"><div class="empty"><div class="big">✅</div>本轮复习完成：${s.reviewed} 次评分，${s.again} 次“忘了”<br><button class="btn primary mt" id="again">再看看还有没有到期的</button></div></div>`;
      body.querySelector('#again').addEventListener('click', () => { session = null; App.rerender(); });
      return;
    }
    const w = s.queue[s.index];
    const intervals = SRS.previewIntervals(w.srs);
    body.innerHTML = `
      <div class="card">
        <div class="row small muted" style="justify-content:space-between"><span>${s.index + 1} / ${s.queue.length}</span><span>${w.srs && w.srs.state !== 'new' ? '复习' : '新词'} ${(w.tags || []).map((t) => `<span class="tag grey">${UI.esc(t)}</span>`).join('')}</span></div>
        <div class="progress mt"><div style="width:${(s.index / s.queue.length) * 100}%"></div></div>
        <div class="flashcard" id="card">
          <div class="word">${UI.esc(w.word)}</div>
          ${w.phonetic ? `<div class="phonetic">${UI.esc(w.phonetic)}</div>` : ''}
          ${s.flipped ? `
            <div class="meaning">${w.pos ? `<span class="muted">${UI.esc(w.pos)}</span> ` : ''}${UI.esc(w.meaning)}</div>
            ${w.exampleIelts ? `<div class="example">📝 ${UI.esc(w.exampleIelts)}</div>` : ''}
            ${w.exampleDaily ? `<div class="example">🇺🇸 ${UI.esc(w.exampleDaily)}</div>` : ''}
            ${w.tip ? `<div class="example">💡 ${UI.esc(w.tip)}</div>` : ''}
          ` : '<div class="hint">点击卡片或按空格看释义，再选“记得”或“忘了”</div>'}
        </div>
        ${s.flipped ? `
        <div class="grade-row two">
          <button class="btn again" data-grade="0">✗ 忘了<small>${intervals[0]}后再见</small></button>
          <button class="btn good" data-grade="2">✓ 记得<small>${intervals[2]}后复习</small></button>
        </div>
        <div class="help mt right">快捷键：← 或 1 忘了 · → 或 2 记得</div>` : ''}
        <div class="btn-row mt"><button class="btn sm ghost" id="editCur">编辑此词</button><button class="btn sm ghost" id="speak">🔊 朗读</button></div>
      </div>`;

    body.querySelector('#card').addEventListener('click', () => { s.flipped = true; renderReview(body, due); });
    body.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => grade(Number(b.dataset.grade))));
    body.querySelector('#editCur').addEventListener('click', () => openEditor(w));
    body.querySelector('#speak').addEventListener('click', () => speak(w.word));

    document.onkeydown = (e) => {
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === ' ') { e.preventDefault(); if (!s.flipped) { s.flipped = true; renderReview(body, due); } }
      if (s.flipped && (e.key === '1' || e.key === 'ArrowLeft')) grade(0);
      if (s.flipped && (e.key === '2' || e.key === 'ArrowRight')) grade(2);
    };

    function grade(g) {
      const word = Store.data.words.find((x) => x.id === w.id);
      if (!word) return;
      const wasNew = !word.srs || word.srs.state === 'new';
      word.srs = SRS.schedule(word.srs, g);
      if (wasNew) word.learnedOn = UI.today();
      word.history = (word.history || []).concat({ t: Date.now(), g }).slice(-50);
      Store.save();
      s.reviewed += 1;
      if (g === 0) { s.again += 1; s.queue.push(word); }
      s.index += 1; s.flipped = false;
      renderReview(body, due);
    }
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return UI.toast('浏览器不支持朗读');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- 词库 ---------- */
  let q = '', tagFilter = '';
  function renderList(body) {
    const words = Store.data.words;
    const tags = [...new Set(words.flatMap((w) => w.tags || []))].sort();
    const kw = q.trim().toLowerCase();
    const list = words.filter((w) => (!kw || w.word.toLowerCase().includes(kw) || (w.meaning || '').toLowerCase().includes(kw)) && (!tagFilter || (w.tags || []).includes(tagFilter)))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const stateName = { new: '新词', learning: '学习中', review: '复习中', mature: '熟练' };
    const stateCls = { new: 'grey', learning: 'orange', review: '', mature: 'green' };
    body.innerHTML = `
      <div class="row search">
        <input type="text" id="q" placeholder="搜索单词或释义" value="${UI.esc(q)}">
        <select id="tagFilter"><option value="">全部标签</option>${tags.map((t) => `<option ${t === tagFilter ? 'selected' : ''}>${UI.esc(t)}</option>`).join('')}</select>
        <button class="btn" id="exportCsv" style="flex:0">导出 CSV</button>
      </div>
      <div class="list">${list.length ? list.map((w) => {
        const st = w.srs ? w.srs.state : 'new';
        const dueIn = w.srs && st !== 'new' ? Math.ceil((w.srs.due - Date.now()) / 86400000) : null;
        return `<div class="item" data-id="${w.id}">
          <div class="body">
            <div class="title">${UI.esc(w.word)} <span class="muted small">${UI.esc(w.phonetic || '')}</span></div>
            <div class="small">${w.pos ? `<span class="muted">${UI.esc(w.pos)}</span> ` : ''}${UI.esc(w.meaning || '')}</div>
            <div class="meta"><span class="tag ${stateCls[st]}">${stateName[st]}</span>${(w.tags || []).map((t) => `<span class="tag grey">${UI.esc(t)}</span>`).join('')}${dueIn != null ? `<span class="muted">${dueIn <= 0 ? '已到期' : dueIn + ' 天后复习'}</span>` : ''}</div>
          </div>
          <div class="actions"><button class="btn sm" data-edit>编辑</button><button class="btn sm danger" data-del>删除</button></div>
        </div>`;
      }).join('') : '<div class="empty">没有匹配的单词</div>'}</div>`;

    body.querySelector('#q').addEventListener('input', (e) => { q = e.target.value; renderList(body); body.querySelector('#q').focus(); const inp = body.querySelector('#q'); inp.setSelectionRange(inp.value.length, inp.value.length); });
    body.querySelector('#tagFilter').addEventListener('change', (e) => { tagFilter = e.target.value; renderList(body); });
    body.querySelector('#exportCsv').addEventListener('click', () => {
      const rows = [['word', 'phonetic', 'pos', 'meaning', 'example_ielts', 'example_daily', 'tags']].concat(words.map((w) => [w.word, w.phonetic, w.pos, w.meaning, w.exampleIelts, w.exampleDaily, (w.tags || []).join(';')]));
      const csv = rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      UI.download(`words-${UI.today()}.csv`, '﻿' + csv);
    });
    body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(words.find((w) => w.id === b.closest('.item').dataset.id))));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('.item').dataset.id;
      const w = words.find((x) => x.id === id);
      if (await UI.confirm(`删除单词 “${w.word}”？`)) { Store.data.words = words.filter((x) => x.id !== id); Store.save(); renderList(body); }
    }));
  }

  /* ---------- 添加 ---------- */
  function renderAdd(body) {
    body.innerHTML = `
      <div class="grid grid-2 stack">
        <div class="card">
          <h2>单个添加</h2>
          ${formHTML({})}
          <div class="btn-row mt">
            <button class="btn" id="aiFill">✨ AI 补全释义与例句</button>
            <button class="btn primary" id="saveWord">保存</button>
          </div>
        </div>
        <div class="card">
          <h2>批量导入</h2>
          <p class="help">每行一个词，格式：<code>word</code> 或 <code>word | 释义</code> 或 <code>word, 释义</code>。可勾选让 AI 逐个补全（每个词一次请求）。</p>
          <textarea id="bulk" rows="10" placeholder="accommodate | 容纳；适应&#10;deadline&#10;get the hang of it"></textarea>
          <label class="field mt"><span>统一标签（逗号分隔）</span><input type="text" id="bulkTags" placeholder="雅思, 阅读"></label>
          <label class="checkbox"><input type="checkbox" id="bulkAi" ${AI.ready() ? 'checked' : 'disabled'}> 用 AI 补全缺少释义的词</label>
          <div class="btn-row mt"><button class="btn primary" id="bulkImport">导入</button><span id="bulkStatus" class="small muted"></span></div>
        </div>
      </div>`;
    bindForm(body, {});
    body.querySelector('#saveWord').addEventListener('click', () => {
      const w = readForm(body);
      if (!w.word) return UI.toast('请填写单词', 'error');
      if (Store.data.words.some((x) => x.word.toLowerCase() === w.word.toLowerCase())) return UI.toast('词库里已有这个词', 'error');
      Store.data.words.push(Object.assign({ id: Store.uid(), createdAt: Date.now(), srs: SRS.newCard(), history: [] }, w));
      Store.save();
      UI.toast(`已添加 “${w.word}”`, 'success');
      renderAdd(body);
      body.querySelector('#fWord').focus();
    });
    body.querySelector('#aiFill').addEventListener('click', () => aiFill(body));
    body.querySelector('#bulkImport').addEventListener('click', async () => {
      const lines = body.querySelector('#bulk').value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return UI.toast('请先粘贴单词', 'error');
      const tags = body.querySelector('#bulkTags').value.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      const useAi = body.querySelector('#bulkAi').checked;
      const status = body.querySelector('#bulkStatus');
      let added = 0, skipped = 0, failed = 0;
      for (let i = 0; i < lines.length; i++) {
        const [word, meaning = ''] = lines[i].split(/\s*[|,，]\s*/);
        if (!word || Store.data.words.some((x) => x.word.toLowerCase() === word.toLowerCase())) { skipped++; continue; }
        const entry = { id: Store.uid(), word, meaning: meaning.trim(), tags: tags.slice(), createdAt: Date.now() + i, srs: SRS.newCard(), history: [] };
        if (useAi && !entry.meaning) {
          status.innerHTML = `<span class="spinner"></span> AI 补全 ${i + 1}/${lines.length}：${UI.esc(word)}`;
          try {
            const r = await AI.enrichWord(word);
            Object.assign(entry, { phonetic: r.phonetic, pos: r.pos, meaning: r.meaning, exampleIelts: r.example_ielts, exampleDaily: r.example_daily, tip: r.tip });
          } catch (e) { failed++; console.warn(e); }
        }
        Store.data.words.push(entry); added++;
        Store.save();
      }
      status.textContent = `导入完成：新增 ${added}，跳过重复 ${skipped}${failed ? `，AI 失败 ${failed}（已保留词条）` : ''}`;
      UI.toast(`已导入 ${added} 个词`, 'success');
    });
  }

  function formHTML(w) {
    return `
      <div class="row">
        <label class="field"><span>单词 / 短语</span><input type="text" id="fWord" value="${UI.esc(w.word || '')}" placeholder="accommodate"></label>
        <label class="field"><span>音标</span><input type="text" id="fPhonetic" value="${UI.esc(w.phonetic || '')}" placeholder="/əˈkɑːmədeɪt/"></label>
        <label class="field" style="flex:0.5;min-width:90px"><span>词性</span><input type="text" id="fPos" value="${UI.esc(w.pos || '')}" placeholder="v."></label>
      </div>
      <label class="field"><span>释义</span><input type="text" id="fMeaning" value="${UI.esc(w.meaning || '')}" placeholder="容纳；适应；为…提供住宿"></label>
      <label class="field"><span>雅思例句</span><input type="text" id="fIelts" value="${UI.esc(w.exampleIelts || '')}"></label>
      <label class="field"><span>美国日常例句</span><input type="text" id="fDaily" value="${UI.esc(w.exampleDaily || '')}"></label>
      <label class="field"><span>记忆提示 / 搭配</span><input type="text" id="fTip" value="${UI.esc(w.tip || '')}"></label>
      <label class="field"><span>标签（逗号分隔）</span><input type="text" id="fTags" value="${UI.esc((w.tags || []).join(', '))}" placeholder="雅思, 口语, 生活"></label>`;
  }
  function bindForm(root) {
    root.querySelector('#fWord').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = root.querySelector('#aiFill'); if (b) b.click(); } });
  }
  function readForm(root) {
    const v = (id) => root.querySelector(id).value.trim();
    return {
      word: v('#fWord'), phonetic: v('#fPhonetic'), pos: v('#fPos'), meaning: v('#fMeaning'),
      exampleIelts: v('#fIelts'), exampleDaily: v('#fDaily'), tip: v('#fTip'),
      tags: v('#fTags').split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    };
  }
  async function aiFill(root) {
    const word = root.querySelector('#fWord').value.trim();
    if (!word) return UI.toast('先输入单词', 'error');
    const btn = root.querySelector('#aiFill');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 生成中';
    try {
      const r = await AI.enrichWord(word);
      const set = (id, val) => { const i = root.querySelector(id); if (!i.value.trim()) i.value = val || ''; };
      set('#fPhonetic', r.phonetic); set('#fPos', r.pos); set('#fMeaning', r.meaning);
      set('#fIelts', r.example_ielts); set('#fDaily', r.example_daily); set('#fTip', r.tip);
      UI.toast('已补全，可修改后保存', 'success');
    } catch (e) { UI.toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '✨ AI 补全释义与例句'; }
  }

  function openEditor(w) {
    if (!w) return;
    const m = UI.modal(`编辑 “${w.word}”`, formHTML(w) + `<div class="help">复习数据：${w.srs ? `间隔 ${w.srs.interval} 天 · 熟悉度 ${w.srs.ease.toFixed(2)} · 复习 ${w.srs.reps} 次 · 忘记 ${w.srs.lapses} 次` : '尚未复习'}</div>`, {
      footer: '<button class="btn" id="aiFill">✨ AI 补全空缺</button><button class="btn danger" id="resetSrs">重置进度</button><button class="btn primary" id="ok">保存</button>',
    });
    bindForm(m.el);
    m.el.querySelector('#aiFill').addEventListener('click', () => aiFill(m.el));
    m.el.querySelector('#resetSrs').addEventListener('click', async () => {
      if (await UI.confirm('重置这个词的复习进度？')) { w.srs = SRS.newCard(); w.learnedOn = null; Store.save(); m.close(); App.rerender(); }
    });
    m.el.querySelector('#ok').addEventListener('click', () => {
      const v = readForm(m.el);
      if (!v.word) return UI.toast('单词不能为空', 'error');
      Object.assign(w, v);
      Store.save(); m.close(); App.rerender();
      UI.toast('已保存', 'success');
    });
  }

  return { render, reset() { session = null; document.onkeydown = null; } };
})();
