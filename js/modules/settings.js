/* 设置：学习目标、GitHub 同步、Claude AI、数据管理 */
Views.settings = {
  render(el) {
    const s = Store.data.settings;
    const sec = Store.secrets();
    const meta = Sync.meta();
    const FOCUS = PlanLogic.FOCUS;
    const focusSelect = (dow) => `<select data-focus="${dow}">${Object.keys(FOCUS).map((k) => `<option value="${k}" ${s.focus[dow] === k ? 'selected' : ''}>${FOCUS[k].icon} ${FOCUS[k].name}</option>`).join('')}</select>`;

    el.innerHTML = `
      <div class="page-head"><h1>设置</h1></div>

      <div class="card">
        <h2>学习目标与计划</h2>
        <div class="row">
          <label class="field"><span>雅思目标分</span><input type="number" id="targetBand" step="0.5" min="4" max="9" value="${s.targetBand}"></label>
          <label class="field"><span>考试日期（可留空）</span><input type="date" id="examDate" value="${s.examDate || ''}"></label>
          <label class="field"><span>计划开始日期</span><input type="date" id="startDate" value="${s.startDate || ''}"></label>
        </div>
        <div class="row">
          <label class="field"><span>工作日每天（分钟）</span><input type="number" id="weekdayMinutes" min="10" value="${s.weekdayMinutes}"></label>
          <label class="field"><span>周末每天（分钟）</span><input type="number" id="weekendMinutes" min="10" value="${s.weekendMinutes}"></label>
          <label class="field"><span>每日新词数量</span><input type="number" id="dailyNewWords" min="0" value="${s.dailyNewWords}"></label>
        </div>
        <h3 class="mt">每周专项轮换</h3>
        <p class="help">每天一个主攻方向；时长 ≥ 90 分钟时会自动加一项副项；非口语日每天固定留一小段美国生活口语。</p>
        <div class="grid grid-4">
          ${[1, 2, 3, 4, 5, 6, 0].map((dow) => `<label class="field"><span>周${UI.weekday(UI.addDays('2026-09-20', dow))}</span>${focusSelect(dow)}</label>`).join('')}
        </div>
        <div class="btn-row"><button class="btn primary" id="savePlan">保存计划设置</button></div>
      </div>

      <div class="card">
        <div class="card-title"><h2>GitHub 数据同步</h2><span class="small muted">上次同步：${UI.fmtTime(meta.syncedAt)}</span></div>
        <p class="help">学习数据以 <code>data.json</code> 保存在你的私有仓库。需要一个只授权该仓库 <strong>Contents 读写</strong> 权限的 Fine-grained Token；Token 只存在本机浏览器，不会写进数据文件。</p>
        <div class="row">
          <label class="field"><span>仓库所有者</span><input type="text" id="ghOwner" value="${UI.esc(s.github.owner)}"></label>
          <label class="field"><span>仓库名</span><input type="text" id="ghRepo" value="${UI.esc(s.github.repo)}"></label>
          <label class="field"><span>分支</span><input type="text" id="ghBranch" value="${UI.esc(s.github.branch || 'main')}"></label>
          <label class="field"><span>文件路径</span><input type="text" id="ghPath" value="${UI.esc(s.github.path)}"></label>
        </div>
        <label class="field"><span>GitHub Token</span><input type="password" id="ghToken" value="${UI.esc(sec.ghToken || '')}" placeholder="github_pat_…" autocomplete="off"></label>
        <label class="checkbox"><input type="checkbox" id="autoSync" ${s.github.autoSync ? 'checked' : ''}> 数据变动后自动推送（延迟几秒合并）</label>
        <div class="btn-row mt">
          <button class="btn primary" id="saveGh">保存</button>
          <button class="btn" id="testGh">测试连接</button>
          <button class="btn" id="pushGh">⬆ 推送到 GitHub</button>
          <button class="btn" id="pullGh">⬇ 从 GitHub 拉取</button>
          <span class="small muted" id="ghStatus"></span>
        </div>
        <details class="mt"><summary class="small muted">怎么创建 Token？</summary>
          <ol class="small">
            <li>打开 GitHub → Settings → Developer settings → Personal access tokens → <strong>Fine-grained tokens</strong> → Generate new token</li>
            <li>Repository access 选 <strong>Only select repositories</strong>，只勾选 <code>${UI.esc(s.github.repo)}</code></li>
            <li>Permissions → Repository permissions → <strong>Contents: Read and write</strong></li>
            <li>生成后复制到上方，保存并点“测试连接”</li>
          </ol>
        </details>
      </div>

      <div class="card">
        <h2>Claude AI</h2>
        <p class="help">浏览器直接调用 Anthropic API，不经过任何中转服务器。Key 只保存在本机浏览器。</p>
        <div class="row">
          <label class="field" style="flex:2"><span>API Key</span><input type="password" id="apiKey" value="${UI.esc(sec.apiKey || '')}" placeholder="sk-ant-…" autocomplete="off"></label>
          <label class="field"><span>模型</span><select id="aiModel">
            <option value="claude-opus-5" ${s.ai.model === 'claude-opus-5' ? 'selected' : ''}>Claude Opus 5（推荐）</option>
            <option value="claude-sonnet-5" ${s.ai.model === 'claude-sonnet-5' ? 'selected' : ''}>Claude Sonnet 5（更快更省）</option>
            <option value="claude-haiku-4-5" ${s.ai.model === 'claude-haiku-4-5' ? 'selected' : ''}>Claude Haiku 4.5（最省）</option>
          </select></label>
        </div>
        <div class="btn-row"><button class="btn primary" id="saveAi">保存</button><button class="btn" id="testAi">测试调用</button><span class="small muted" id="aiStatus"></span></div>
      </div>

      <div class="card">
        <h2>数据管理</h2>
        <p class="help">本机数据：${Store.data.words.length} 词 · ${Object.keys(Store.data.checkins).length} 天打卡 · ${Store.data.practices.length} 条练习 · ${Store.data.notes.length} 条笔记 · 最后修改 ${UI.fmtTime(Store.data.updatedAt)}</p>
        <div class="btn-row">
          <button class="btn" id="exportJson">导出 JSON 备份</button>
          <button class="btn" id="importJson">导入 JSON</button>
          <input type="file" id="importFile" accept="application/json" hidden>
          <button class="btn danger" id="clearAll">清空本机数据</button>
        </div>
      </div>`;

    /* 计划 */
    el.querySelector('#savePlan').addEventListener('click', () => {
      const v = (id) => el.querySelector(id).value;
      Object.assign(s, {
        targetBand: Number(v('#targetBand')) || 7, examDate: v('#examDate'), startDate: v('#startDate') || UI.today(),
        weekdayMinutes: Number(v('#weekdayMinutes')) || 60, weekendMinutes: Number(v('#weekendMinutes')) || 120,
        dailyNewWords: Number(v('#dailyNewWords')) || 0,
      });
      el.querySelectorAll('[data-focus]').forEach((sel) => { s.focus[sel.dataset.focus] = sel.value; });
      Store.save(); UI.toast('计划设置已保存', 'success');
    });

    /* GitHub */
    const saveGh = () => {
      Object.assign(s.github, {
        owner: el.querySelector('#ghOwner').value.trim(), repo: el.querySelector('#ghRepo').value.trim(),
        branch: el.querySelector('#ghBranch').value.trim() || 'main', path: el.querySelector('#ghPath').value.trim() || 'data.json',
        autoSync: el.querySelector('#autoSync').checked,
      });
      Store.setSecrets({ ghToken: el.querySelector('#ghToken').value.trim() });
      Store.save(); Sync.refreshStatus();
    };
    el.querySelector('#saveGh').addEventListener('click', () => { saveGh(); UI.toast('已保存', 'success'); });
    el.querySelector('#testGh').addEventListener('click', async () => {
      saveGh();
      const st = el.querySelector('#ghStatus'); st.innerHTML = '<span class="spinner"></span>';
      try { const r = await Sync.test(); st.textContent = `✅ 可访问 ${r.full_name}（${r.private ? '私有' : '公开'}）`; }
      catch (e) { st.textContent = '❌ ' + e.message; }
    });
    el.querySelector('#pushGh').addEventListener('click', () => { saveGh(); Sync.push(); });
    el.querySelector('#pullGh').addEventListener('click', () => { saveGh(); Sync.pull({ force: false }); });

    /* AI */
    const saveAi = () => { s.ai.model = el.querySelector('#aiModel').value; Store.setSecrets({ apiKey: el.querySelector('#apiKey').value.trim() }); Store.save(); };
    el.querySelector('#saveAi').addEventListener('click', () => { saveAi(); UI.toast('已保存', 'success'); });
    el.querySelector('#testAi').addEventListener('click', async () => {
      saveAi();
      const st = el.querySelector('#aiStatus'); st.innerHTML = '<span class="spinner"></span>';
      try { const t = await AI.ask('用一句英文鼓励一位正在备考雅思的学习者，不超过 15 个词。', 'Go', { effort: 'low', maxTokens: 100 }); st.textContent = '✅ ' + t.trim(); }
      catch (e) { st.textContent = '❌ ' + e.message; }
    });

    /* 数据 */
    el.querySelector('#exportJson').addEventListener('click', () => UI.download(`english-study-${UI.today()}.json`, Store.exportJSON()));
    el.querySelector('#importJson').addEventListener('click', () => el.querySelector('#importFile').click());
    el.querySelector('#importFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!(await UI.confirm('导入会覆盖本机当前数据，继续？'))) return;
      try { Store.importJSON(await f.text()); UI.toast('导入成功', 'success'); App.rerender(); }
      catch (err) { UI.toast('导入失败：' + err.message, 'error'); }
    });
    el.querySelector('#clearAll').addEventListener('click', async () => {
      if (!(await UI.confirm('清空本机全部学习数据（不影响 GitHub 上的副本，不清除 Token/Key）？'))) return;
      Store.replace(Store.defaults(), true); UI.toast('已清空'); App.rerender();
    });
  },
};
