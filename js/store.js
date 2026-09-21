/* 数据层：localStorage 主存，学习数据与密钥分开保存 */
const Store = (() => {
  const DATA_KEY = 'es_data_v1';
  const SECRET_KEY = 'es_secrets_v1';

  function defaultSettings() {
    return {
      targetBand: 7.0,
      examDate: '',
      startDate: UI.today(),
      weekdayMinutes: 60,
      weekendMinutes: 120,
      dailyNewWords: 15,
      // 每周专项轮换：0=周日 … 6=周六
      focus: { 1: 'listening', 2: 'reading', 3: 'writing', 4: 'speaking', 5: 'listening', 6: 'writing', 0: 'reading' },
      github: { owner: 'chuchu1214w', repo: 'english-study-data', path: 'data.json', branch: 'main', autoSync: true },
      ai: { model: 'claude-opus-5' },
    };
  }

  function defaults() {
    return {
      version: 1,
      updatedAt: 0,
      settings: defaultSettings(),
      words: [],       // 单词
      checkins: {},    // 日期 -> 打卡
      practices: [],   // 练习记录
      notes: [],       // 错题 / 语法笔记
    };
  }

  function normalize(raw) {
    const d = Object.assign(defaults(), raw || {});
    d.settings = Object.assign(defaultSettings(), raw && raw.settings ? raw.settings : {});
    d.settings.github = Object.assign(defaultSettings().github, d.settings.github || {});
    d.settings.ai = Object.assign(defaultSettings().ai, d.settings.ai || {});
    d.settings.focus = Object.assign(defaultSettings().focus, d.settings.focus || {});
    d.words = Array.isArray(d.words) ? d.words : [];
    d.practices = Array.isArray(d.practices) ? d.practices : [];
    d.notes = Array.isArray(d.notes) ? d.notes : [];
    d.checkins = d.checkins && typeof d.checkins === 'object' ? d.checkins : {};
    return d;
  }

  let data = load();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { console.warn('读取本地数据失败', e); }
    return defaults();
  }

  function persist() {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  /** 修改数据后调用；touch=false 时不更新时间戳（用于同步写入） */
  function save(touch = true) {
    if (touch) data.updatedAt = Date.now();
    persist();
    listeners.forEach((fn) => { try { fn(data, touch); } catch (e) { console.error(e); } });
  }

  function replace(newData, touch = false) {
    data = normalize(newData);
    save(touch);
  }

  function onChange(fn) { listeners.push(fn); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function exportJSON() { return JSON.stringify(data, null, 2); }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !('words' in parsed)) throw new Error('文件格式不正确');
    replace(parsed, true);
  }

  /* ---- 密钥（仅本机） ---- */
  function secrets() {
    try { return JSON.parse(localStorage.getItem(SECRET_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setSecrets(patch) {
    const s = Object.assign(secrets(), patch);
    localStorage.setItem(SECRET_KEY, JSON.stringify(s));
  }

  return {
    get data() { return data; },
    save, replace, onChange, uid, exportJSON, importJSON, secrets, setSecrets, defaults,
  };
})();
