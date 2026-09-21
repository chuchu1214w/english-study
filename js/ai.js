/* AI 层：浏览器直连 Claude Messages API（API Key 仅存本机） */
const AI = (() => {
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  function ready() { return !!Store.secrets().apiKey; }

  /**
   * 调用 Claude。返回文本；传 schema 时返回解析后的 JSON。
   * effort: low / medium / high；简单任务用 low 省钱省时间
   */
  async function ask(system, user, { schema = null, effort = 'medium', maxTokens = 4096 } = {}) {
    const key = Store.secrets().apiKey;
    if (!key) throw new Error('未设置 Claude API Key，请到“设置”页填写');

    const body = {
      model: Store.data.settings.ai.model || 'claude-opus-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort },
      fallbacks: 'default',
    };
    if (schema) body.output_config.format = { type: 'json_schema', schema };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    let json;
    try { json = await res.json(); } catch (e) { throw new Error(`Claude 返回了非 JSON 响应（HTTP ${res.status}）`); }
    if (!res.ok) {
      const msg = json && json.error && json.error.message ? json.error.message : `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('API Key 无效：' + msg);
      if (res.status === 429) throw new Error('请求过于频繁，请稍后再试：' + msg);
      throw new Error('Claude 请求失败：' + msg);
    }
    if (json.stop_reason === 'refusal') throw new Error('Claude 拒绝了这次请求，请换一种问法');
    const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (json.stop_reason === 'max_tokens') console.warn('AI 输出被截断');
    if (schema) {
      try { return JSON.parse(text); } catch (e) { throw new Error('AI 返回的 JSON 无法解析'); }
    }
    return text;
  }

  /* ---------- 具体功能 ---------- */

  const WORD_SCHEMA = {
    type: 'object',
    properties: {
      phonetic: { type: 'string', description: '美式音标，用 / / 包裹' },
      pos: { type: 'string', description: '词性，如 n. / v. / adj.' },
      meaning: { type: 'string', description: '简明中文释义，多个义项用分号分隔' },
      example_ielts: { type: 'string', description: '一句雅思写作或口语风格的英文例句' },
      example_daily: { type: 'string', description: '一句美国日常生活口语例句' },
      tip: { type: 'string', description: '记忆技巧、搭配或易混淆点，中文，一两句' },
    },
    required: ['phonetic', 'pos', 'meaning', 'example_ielts', 'example_daily', 'tip'],
    additionalProperties: false,
  };

  function enrichWord(word) {
    return ask(
      '你是一位面向中国学习者的英语词汇老师。学习者目标是雅思考试和在美国的日常生活交流。只输出符合 schema 的 JSON。',
      `请为单词或短语 "${word}" 提供信息。`,
      { schema: WORD_SCHEMA, effort: 'low', maxTokens: 1024 }
    );
  }

  function gradeWriting({ task, prompt, essay }) {
    const system = `你是雅思写作考官。用中文给出反馈，结构如下（Markdown）：
## 预估分数
总分及四项（Task Achievement/Response、Coherence and Cohesion、Lexical Resource、Grammatical Range and Accuracy）各自分数，每项一句理由。
## 主要问题
按重要程度列出 3-5 条，每条引用原文片段并给出改写。
## 语法与用词错误
逐条列出：原句 → 修改 → 一句解释。
## 提分建议
下一次写作最该改进的 2-3 件事。
## 参考改写
把其中最弱的一段改写成 7.5 分水平，并简要说明改动。`;
    const user = `写作类型：${task}\n题目：${prompt || '（未提供）'}\n\n学生作文：\n${essay}`;
    return ask(system, user, { effort: 'medium', maxTokens: 6000 });
  }

  function gradeSpeaking({ part, topic, transcript }) {
    const system = `你是雅思口语考官，同时了解美国日常口语习惯。用中文反馈（Markdown）：
## 预估分数
总分及四项（Fluency and Coherence、Lexical Resource、Grammatical Range and Accuracy、Pronunciation 根据文本推断的用词与句式，若无法判断请说明）。
## 表达问题
列出不自然、中式英语或语法错误的句子：原句 → 更地道的说法 → 原因。
## 升级表达
给出 5 个可以替换的高分或更地道的表达，附例句。
## 如果在美国日常对话中
指出哪些说法过于书面，给出美国人真实会说的版本。
## 下次练习建议`;
    const user = `口语部分：${part}\n话题：${topic || '（未提供）'}\n\n学生回答文字稿：\n${transcript}`;
    return ask(system, user, { effort: 'medium', maxTokens: 5000 });
  }

  function explainNote({ type, title, content, example }) {
    const system = type === 'grammar'
      ? '你是英语语法老师。用中文清晰讲解这个语法点：核心规则、常见错误、3 个例句（含雅思风格和美国口语风格各至少 1 个）、一个自测小题及答案。用 Markdown。'
      : '你是英语老师。分析学生的这道错题：错在哪里、正确答案及原因、涉及的知识点、如何避免再错、2 个同类型练习句（含答案）。用中文，Markdown。';
    const user = `标题：${title}\n内容：${content}\n${example ? '相关句子/题目：' + example : ''}`;
    return ask(system, user, { effort: 'low', maxTokens: 3000 });
  }

  function generateTopic({ kind, focus }) {
    const prompts = {
      ielts_part2: `请生成一道雅思口语 Part 2 题卡（英文题目 + 4 个提示要点），然后给出：1) 中文审题思路；2) 一份约 200 词的 7 分参考回答；3) 其中 6 个值得记的表达及中文释义。${focus ? '话题方向：' + focus : ''}`,
      ielts_part3: `请生成 5 道雅思口语 Part 3 追问（英文），围绕一个社会类话题，并为其中 2 道给出 7 分参考回答（英文）与答题框架说明（中文）。${focus ? '话题方向：' + focus : ''}`,
      us_daily: `请写一段发生在美国日常生活中的真实对话（8-12 轮，英文），场景：${focus || '随机选择一个（如看医生、租房、点餐、银行、和同事闲聊、DMV 办事等）'}。对话之后：1) 逐句列出地道表达和中文解释；2) 指出中国学习者在此场景最容易说错或听不懂的 3 个点；3) 给出 3 个可以自己练习的替换情景。`,
      writing_task2: `请生成一道雅思写作 Task 2 题目（英文），然后给出：1) 中文审题与立场建议；2) 四段式提纲；3) 每段 2 个高分句型模板；4) 10 个话题相关词汇搭配及中文释义。${focus ? '话题方向：' + focus : ''}`,
    };
    return ask(
      '你是雅思老师兼美国生活英语教练，面向中国学习者。输出用 Markdown，英文材料保持英文，讲解用中文。',
      prompts[kind] || prompts.us_daily,
      { effort: 'low', maxTokens: 4000 }
    );
  }

  return { ready, ask, enrichWord, gradeWriting, gradeSpeaking, explainNote, generateTopic };
})();
