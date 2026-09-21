/* 学习计划：每日任务生成、打卡、连续天数 */
const PlanLogic = (() => {
  const FOCUS = {
    listening: { name: '听力', icon: '🎧', desc: '精听一段 3–5 分钟材料：听写、跟读、复述，生词入库' },
    reading: { name: '阅读', icon: '📖', desc: '一篇雅思阅读或英文文章：限时做题，整理生词与错题' },
    writing: { name: '写作', icon: '✍️', desc: 'Task 1 或 Task 2 写一篇，交给 AI 批改并记录' },
    speaking: { name: '口语', icon: '🗣️', desc: 'Part 1/2/3 录音并转文字，让 AI 反馈，记下升级表达' },
  };
  const SECONDARY = { listening: 'reading', reading: 'listening', writing: 'reading', speaking: 'listening' };

  function isWeekend(date) { const d = new Date(date + 'T00:00:00').getDay(); return d === 0 || d === 6; }
  function minutesFor(date) {
    const s = Store.data.settings;
    return Number(isWeekend(date) ? s.weekendMinutes : s.weekdayMinutes) || 60;
  }
  function focusFor(date) {
    const dow = new Date(date + 'T00:00:00').getDay();
    return Store.data.settings.focus[dow] || 'listening';
  }

  function tasksFor(date) {
    const total = minutesFor(date);
    const focus = focusFor(date);
    const tasks = [];
    const vocabMin = Math.max(10, Math.round(total * 0.25));
    const speakMin = focus === 'speaking' ? 0 : Math.max(10, Math.round(total * 0.15));
    let focusMin = total - vocabMin - speakMin;
    let secondary = null, secMin = 0;
    if (total >= 90) {
      secondary = SECONDARY[focus];
      secMin = Math.round(focusMin * 0.35);
      focusMin -= secMin;
    }
    tasks.push({ id: 'vocab', name: '单词复习 + 新词', minutes: vocabMin, desc: `复习到期单词，学习 ${Store.data.settings.dailyNewWords} 个新词` });
    tasks.push({ id: 'focus', name: `${FOCUS[focus].icon} ${FOCUS[focus].name}专项`, minutes: focusMin, desc: FOCUS[focus].desc, skill: focus });
    if (secondary) tasks.push({ id: 'secondary', name: `${FOCUS[secondary].icon} ${FOCUS[secondary].name}加练`, minutes: secMin, desc: FOCUS[secondary].desc, skill: secondary });
    if (speakMin) tasks.push({ id: 'speaking', name: '🇺🇸 美国生活口语', minutes: speakMin, desc: '一段生活场景对话：跟读、角色扮演，或让 AI 生成新场景' });
    return tasks;
  }

  function checkin(date) {
    return Store.data.checkins[date] || { tasks: {}, minutes: 0, note: '' };
  }
  function isDone(date) {
    const c = Store.data.checkins[date];
    if (!c) return false;
    const tasks = tasksFor(date);
    return tasks.length > 0 && tasks.every((t) => c.tasks && c.tasks[t.id]);
  }
  function toggleTask(date, taskId, on) {
    const c = Object.assign({ tasks: {}, minutes: 0, note: '' }, Store.data.checkins[date] || {});
    c.tasks = Object.assign({}, c.tasks, { [taskId]: !!on });
    c.focus = focusFor(date);
    const tasks = tasksFor(date);
    c.done = tasks.every((t) => c.tasks[t.id]);
    if (!c.minutes) c.minutes = tasks.filter((t) => c.tasks[t.id]).reduce((s, t) => s + t.minutes, 0);
    Store.data.checkins[date] = c;
    Store.save();
  }
  function setCheckinMeta(date, patch) {
    const c = Object.assign({ tasks: {}, minutes: 0, note: '' }, Store.data.checkins[date] || {});
    Object.assign(c, patch);
    Store.data.checkins[date] = c;
    Store.save();
  }

  function streak() {
    let n = 0;
    let d = UI.today();
    if (!isDone(d)) d = UI.addDays(d, -1);
    while (isDone(d)) { n += 1; d = UI.addDays(d, -1); }
    return n;
  }
  function lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = UI.addDays(UI.today(), -i);
      const c = Store.data.checkins[date];
      out.push({ date, minutes: c ? Number(c.minutes) || 0 : 0, done: isDone(date) });
    }
    return out;
  }
  function daysToExam() {
    const e = Store.data.settings.examDate;
    return e ? UI.daysBetween(UI.today(), e) : null;
  }
  function totalMinutes() {
    return Object.values(Store.data.checkins).reduce((s, c) => s + (Number(c.minutes) || 0), 0);
  }

  return { FOCUS, tasksFor, minutesFor, focusFor, checkin, isDone, toggleTask, setCheckinMeta, streak, lastNDays, daysToExam, totalMinutes, isWeekend };
})();

/* 渲染今日任务清单（总览页与计划页共用） */
function renderTaskList(container, date) {
  const tasks = PlanLogic.tasksFor(date);
  const c = PlanLogic.checkin(date);
  container.innerHTML = tasks.map((t) => `
    <label class="task ${c.tasks[t.id] ? 'done' : ''}">
      <input type="checkbox" data-task="${t.id}" ${c.tasks[t.id] ? 'checked' : ''}>
      <div class="name"><div>${UI.esc(t.name)}</div><div class="help">${UI.esc(t.desc)}</div></div>
      <div class="mins">${t.minutes} 分钟</div>
    </label>`).join('');
  container.querySelectorAll('input[data-task]').forEach((cb) => {
    cb.addEventListener('change', () => {
      PlanLogic.toggleTask(date, cb.dataset.task, cb.checked);
      if (PlanLogic.isDone(date)) UI.toast('今日任务全部完成，打卡成功 🎉', 'success');
      App.rerender();
    });
  });
}

Views.plan = {
  render(el) {
    const s = Store.data.settings;
    const today = UI.today();
    const days = PlanLogic.daysToExam();
    const streak = PlanLogic.streak();
    const week = PlanLogic.lastNDays(7);
    const weekMin = week.reduce((a, d) => a + d.minutes, 0);
    const sinceStart = Math.max(0, UI.daysBetween(s.startDate || today, today)) + 1;
    const doneDays = Object.keys(Store.data.checkins).filter((d) => PlanLogic.isDone(d)).length;

    el.innerHTML = `
      <div class="page-head">
        <div><h1>学习计划</h1><div class="sub">${today} 周${UI.weekday(today)} · ${PlanLogic.isWeekend(today) ? '周末' : '工作日'}计划 ${PlanLogic.minutesFor(today)} 分钟</div></div>
        <a class="btn sm" href="#/settings">调整计划设置</a>
      </div>

      <div class="grid grid-4 mb">
        <div class="card stat"><div class="num">${days == null ? '—' : days}</div><div class="lbl">${days == null ? '未设置考试日期' : days >= 0 ? '距考试天数' : '考试已过'}</div></div>
        <div class="card stat"><div class="num">${s.targetBand || '—'}</div><div class="lbl">目标分数</div></div>
        <div class="card stat success"><div class="num">${streak}</div><div class="lbl">连续打卡天数</div></div>
        <div class="card stat"><div class="num">${doneDays}/${sinceStart}</div><div class="lbl">完成天数 / 开始以来</div></div>
      </div>

      <div class="grid grid-2 stack">
        <div class="card">
          <div class="card-title"><h2>今日任务</h2><span class="tag ${PlanLogic.isDone(today) ? 'green' : 'grey'}">${PlanLogic.isDone(today) ? '已打卡' : '进行中'}</span></div>
          <div class="list" id="taskList"></div>
          <div class="row mt">
            <label class="field" style="margin:0"><span>实际学习分钟</span><input type="number" id="ciMinutes" min="0" value="${PlanLogic.checkin(today).minutes || ''}" placeholder="留空按任务自动计"></label>
            <label class="field" style="margin:0;flex:2"><span>今日小结</span><input type="text" id="ciNote" value="${UI.esc(PlanLogic.checkin(today).note || '')}" placeholder="学了什么、卡在哪"></label>
          </div>
          <div class="btn-row mt"><button class="btn sm" id="saveCi">保存分钟与小结</button></div>
        </div>

        <div class="card">
          <div class="card-title"><h2>本周</h2><span class="muted small">${weekMin} 分钟</span></div>
          <div class="bars">
            ${week.map((d) => {
              const max = Math.max(60, ...week.map((x) => x.minutes));
              const h = Math.round((d.minutes / max) * 90);
              return `<div class="bar ${d.date === today ? 'today' : ''}" title="${d.date} ${d.minutes} 分钟"><div style="height:${h}px"></div><span>${UI.weekday(d.date)}${d.done ? '✓' : ''}</span></div>`;
            }).join('')}
          </div>
          <hr>
          <h3>每周专项轮换</h3>
          <div class="kv">
            ${[1, 2, 3, 4, 5, 6, 0].map((dow) => `<dt>周${UI.weekday(UI.addDays('2026-09-20', dow))}</dt><dd>${PlanLogic.FOCUS[s.focus[dow]].icon} ${PlanLogic.FOCUS[s.focus[dow]].name}${dow === 0 || dow === 6 ? `　<span class="muted">${s.weekendMinutes} 分钟</span>` : `　<span class="muted">${s.weekdayMinutes} 分钟</span>`}</dd>`).join('')}
          </div>
        </div>
      </div>

      <div class="card mt">
        <div class="card-title"><h2>打卡历史</h2><span class="muted small">累计 ${PlanLogic.totalMinutes()} 分钟</span></div>
        <div id="history" class="list"></div>
      </div>`;

    renderTaskList(el.querySelector('#taskList'), today);

    el.querySelector('#saveCi').addEventListener('click', () => {
      PlanLogic.setCheckinMeta(today, {
        minutes: Number(el.querySelector('#ciMinutes').value) || 0,
        note: el.querySelector('#ciNote').value.trim(),
      });
      UI.toast('已保存');
      App.rerender();
    });

    const hist = Object.keys(Store.data.checkins).sort().reverse().slice(0, 30);
    el.querySelector('#history').innerHTML = hist.length ? hist.map((d) => {
      const c = Store.data.checkins[d];
      const done = PlanLogic.isDone(d);
      return `<div class="item ${done ? '' : ''}"><div class="body"><div class="title">${d} 周${UI.weekday(d)} <span class="tag ${done ? 'green' : 'grey'}">${done ? '完成' : '部分'}</span> <span class="tag grey">${c.minutes || 0} 分钟</span></div>${c.note ? `<div class="meta">${UI.esc(c.note)}</div>` : ''}</div></div>`;
    }).join('') : '<div class="empty">还没有打卡记录，从今天开始吧</div>';
  },
};
