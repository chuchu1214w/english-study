# 英语自学 · 雅思与美国生活口语

一个只为我自己定制的英语学习网页：纯静态、零依赖、手机电脑都能用。围绕**雅思备考**和**在美生活日常交流**两个目标，把单词、计划、练习、笔记四件事放在一个页面里，并用 Claude 做补词、批改和讲解。

## 功能

| 模块 | 说明 |
|---|---|
| 总览 | 距考试天数、连续打卡、待复习词数、本周学习时长、今日任务、最近练习 |
| 单词 | 间隔重复复习（SM-2 变体，忘了/困难/记得/简单四档，快捷键 1–4，空格翻卡）、词库搜索与标签、批量导入、CSV 导出、AI 一键补全音标/释义/雅思例句/美国日常例句/记忆提示、浏览器朗读 |
| 计划 | 目标分与考试日期可设置；工作日和周末分别设定时长；按星期轮换听/读/写/说专项，自动拆分每日任务；打卡、连续天数、周柱状图、历史记录 |
| 练习 | 记录听力/阅读/写作/口语每次练习的材料、时长、得分、错误、心得；写作与口语可让 AI 按雅思四项标准打分反馈；AI 生成美国生活情景对话、口语 Part 2/3 题卡、写作 Task 2 题目与提纲 |
| 笔记 | 错题本与语法笔记，标签与关键词检索，AI 讲解错因或语法点并附练习 |
| 设置 | 计划参数、GitHub 同步、Claude API Key、JSON 导出/导入 |

## 数据与隐私

- 学习数据主存在浏览器 `localStorage`，并可同步到**私有仓库** `english-study-data` 的 `data.json`（通过 GitHub Contents API）
- Claude API Key 与 GitHub Token 只存在本机浏览器，**不会**写入 `data.json`，也不会提交到任何仓库
- 本仓库（代码）是公开的，不包含任何学习数据

## 使用方法

### 1. 打开网页

- 本地：直接双击 `index.html`，或在目录里运行任意静态服务器：

```bash
python3 -m http.server 8765
```

- 在线：仓库已开启 GitHub Pages，地址见仓库首页 About。

### 2. 配置 GitHub 同步（可选，但强烈建议）

1. 确认私有仓库 `english-study-data` 存在（已随本项目一起创建）
2. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access：Only select repositories → 只选 `english-study-data`
   - Permissions → Repository permissions → **Contents: Read and write**
3. 网页 → 设置 → GitHub 数据同步：粘贴 Token，保存，点“测试连接”，再点“推送到 GitHub”
4. 之后每次数据变动会在几秒后自动推送；换设备时先“拉取”

### 3. 配置 Claude（可选）

在 [console.anthropic.com](https://console.anthropic.com) 创建 API Key，网页 → 设置 → Claude AI 粘贴保存，点“测试调用”。

默认模型 Claude Opus 5；日常补词、讲解用的是低 effort 档，成本很低。批改作文会用中等 effort。

## 技术说明

- 纯 HTML / CSS / 原生 JavaScript，无构建步骤，无第三方依赖
- 目录结构：

```
index.html
css/style.css
js/ui.js        通用 UI 工具（弹窗、提示、日期、极简 Markdown）
js/store.js     数据层（localStorage、导入导出、密钥分离保存）
js/srs.js       间隔重复算法
js/sync.js      GitHub Contents API 同步（冲突时按时间戳提示）
js/ai.js        Claude Messages API 直连与各 AI 功能的提示词
js/app.js       hash 路由
js/modules/     各页面：dashboard / vocab / plan / practice / notes / settings
docs/需求文档.md
DEVLOG.md       开发日志
```

- 数据格式见 `js/store.js` 的 `defaults()`，带 `version` 字段便于以后迁移

## 开发日志

见 [DEVLOG.md](DEVLOG.md)。
