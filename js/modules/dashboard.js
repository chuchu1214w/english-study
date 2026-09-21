/* 总览页 */
Views.dashboard = {
  render(el) {
    const d = Store.data;
    const today = UI.today();
    const due = SRS.dueWords(d.words, d.settings);
    const days = PlanLogic.daysToExam();
    const week = PlanLogic.lastNDays(7);
    const weekMin = week.reduce((a, x) => a + x.minutes, 0);
    const recent = d.practices.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 4);
    const setupHints = [];
    if (!Sync.ready()) setupHints.push('还没有配置 GitHub 同步，数据目前只在本机浏览器。');
    if (!AI.ready()) setupHints.push('还没有填写 Claude API Key，AI 补词、批改功能不可用。');

    el.innerHTML = `
      <div class="page-head">
        <div><h1>${greeting()}，momo</h1><div class="sub">${today} 周${UI.weekday(today)} · 今天是${PlanLogic.FOCUS[PlanLogic.focusFor(today)].name}专项日</div></div>
        <a class="btn primary" href="#/vocab">开始复习 ${due.all.length ? `(${due.all.length})` : ''}</a>
      </div>

      ${setupHints.length ? `<div class="card mb" style="border-color:var(--warn)"><strong>提示</strong><ul style="margin:6px 0 0 18px;padding:0">${setupHints.map((h) => `<li>${h}</li>`).join('')}</ul><a class="btn sm mt" href="#/settings">去设置</a></div>` : ''}

      <div class="grid grid-4 mb">
        <div class="card stat ${days != null && days <= 30 ? 'warn' : ''}"><div class="num">${days == null ? '—' : days}</div><div class="lbl">${days == null ? '距考试（未设置）' : '距考试天数'}</div></div>
        <div class="card stat success"><div class="num">${PlanLogic.streak()}</div><div class="lbl">连续打卡</div></div>
        <div class="card stat"><div class="num">${due.review.length}<span class="muted" style="font-size:14px">+${due.fresh.length}</span></div><div class="lbl">待复习 + 新词</div></div>
        <div class="card stat"><div class="num">${weekMin}</div><div class="lbl">本周分钟</div></div>
      </div>

      <div class="grid grid-2 stack">
        <div class="card">
          <div class="card-title"><h2>今日任务</h2><a class="small" href="#/plan">计划详情</a></div>
          <div class="list" id="taskList"></div>
        </div>
        <div>
          <div class="card">
            <div class="card-title"><h2>词库概况</h2><a class="small" href="#/vocab">管理</a></div>
            ${wordStats(d.words)}
          </div>
          <div class="card">
            <div class="card-title"><h2>最近练习</h2><a class="small" href="#/practice">全部</a></div>
            ${recent.length ? `<div class="list">${recent.map((p) => `<div class="item"><div class="body"><div class="title">${typeName(p.type)} · ${UI.esc(p.material || '未命名')}</div><div class="meta">${p.date} · ${p.minutes || 0} 分钟${p.score ? ' · ' + UI.esc(p.score) : ''}</div></div></div>`).join('')}</div>` : '<div class="empty">还没有练习记录</div>'}
          </div>
        </div>
      </div>`;

    renderTaskList(el.querySelector('#taskList'), today);

    function greeting() {
      const h = new Date().getHours();
      return h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    }
    function typeName(t) { return { listening: '听力', reading: '阅读', writing: '写作', speaking: '口语' }[t] || t; }
    function wordStats(words) {
      const s = SRS.stats(words);
      if (!s.total) return '<div class="empty">词库为空，去“单词”页添加</div>';
      const seg = (n, cls) => `<div style="width:${(n / s.total) * 100}%;background:var(--${cls})"></div>`;
      return `
        <div class="progress" style="display:flex;height:10px">${seg(s.mature, 'success')}${seg(s.review, 'primary')}${seg(s.learning, 'warn')}${seg(s.new, 'border')}</div>
        <div class="row mt small muted" style="gap:14px">
          <span>总计 ${s.total}</span><span>熟练 ${s.mature}</span><span>复习中 ${s.review}</span><span>学习中 ${s.learning}</span><span>新词 ${s.new}</span>
        </div>`;
    }
  },
};
