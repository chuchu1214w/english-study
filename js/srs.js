/* 间隔重复算法：SM-2 变体，四档评分 0=忘了 1=困难 2=记得 3=简单 */
const SRS = (() => {
  const DAY = 86400000;

  function newCard() {
    return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), state: 'new', lastReview: 0 };
  }

  /** 返回新的 srs 对象（不修改入参） */
  function schedule(card, grade) {
    const c = Object.assign(newCard(), card || {});
    const now = Date.now();
    let { ease, interval, reps, lapses } = c;

    if (grade === 0) {
      lapses += 1;
      reps = 0;
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
      return Object.assign(c, { ease, interval, reps, lapses, due: now + 10 * 60 * 1000, state: 'learning', lastReview: now });
    }

    if (reps === 0) interval = grade === 1 ? 1 : grade === 2 ? 2 : 4;
    else if (reps === 1) interval = grade === 1 ? 3 : grade === 2 ? 6 : 10;
    else {
      const factor = grade === 1 ? 1.2 : grade === 2 ? ease : ease * 1.3;
      interval = Math.max(interval + 1, Math.round(interval * factor));
    }
    if (grade === 1) ease = Math.max(1.3, ease - 0.15);
    if (grade === 3) ease = Math.min(3.0, ease + 0.15);
    reps += 1;

    return Object.assign(c, {
      ease, interval, reps, lapses,
      due: now + interval * DAY,
      state: interval >= 21 ? 'mature' : 'review',
      lastReview: now,
    });
  }

  /** 预览各档评分后的下次间隔文本 */
  function previewIntervals(card) {
    return [0, 1, 2, 3].map((g) => {
      const next = schedule(card, g);
      const ms = next.due - Date.now();
      if (ms < DAY) return `${Math.max(1, Math.round(ms / 60000))}分钟`;
      const days = Math.round(ms / DAY);
      return days >= 30 ? `${(days / 30).toFixed(1)}月` : `${days}天`;
    });
  }

  /** 今日待复习（含到期新词） */
  function dueWords(words, settings) {
    const now = Date.now();
    const todayStr = UI.today();
    const learnedToday = words.filter((w) => w.srs && w.srs.state !== 'new' && w.learnedOn === todayStr).length;
    const newQuota = Math.max(0, (settings.dailyNewWords || 15) - learnedToday);

    const review = words.filter((w) => w.srs && w.srs.state !== 'new' && w.srs.due <= now);
    const fresh = words.filter((w) => !w.srs || w.srs.state === 'new')
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .slice(0, newQuota);
    review.sort((a, b) => a.srs.due - b.srs.due);
    return { review, fresh, all: review.concat(fresh), newQuota };
  }

  function stats(words) {
    const s = { total: words.length, new: 0, learning: 0, review: 0, mature: 0 };
    for (const w of words) {
      const st = w.srs ? w.srs.state : 'new';
      s[st] = (s[st] || 0) + 1;
    }
    return s;
  }

  return { newCard, schedule, previewIntervals, dueWords, stats };
})();
