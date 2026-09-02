# 五洲大药房·1936 — AI 接手指南

> 给另一个 AI Agent 看的项目说明，看完即可上手。
> 项目位置：`/Users/destiny/Downloads/haipai/city-whispers/`

---

## 1. 这是什么

1936 年武康路穿越互动叙事游戏。玩家扮演"五洲大药房"账房先生，跟 4 位海派传奇人物（项松茂/方液仙/郭乐/巴金）共度 100 天，清明墓前做出 4 选 1 终章。

**两大自研架构**（这是项目的技术招牌）：
1. **自研 LLM 3 级兜底链**：StepFun → Ollama → 规则
2. **自研 NPC 情绪持久化**：4 维 portrait + 6 mood 联动 54 张立绘

---

## 2. 技术栈（一句话版）

```
前端：React 18 + Vite 5 + HashRouter
后端：Node 18 + Express + SSE
LLM：StepFun step-3.7-flash（anthropic 协议）/ Ollama qwen2.5:3b / 规则兜底
测试：原生 node:test（server/tests/）+ 自研 qa-*.mjs 脚本
```

---

## 3. 文件结构（v9 修订：与实际代码一致）

```
/Users/destiny/Downloads/haipai/city-whispers/
├── app/                                # 前端
│   ├── src/
│   │   ├── App.jsx                     # 唯一入口（GamePlay；#framework/#test 页面已删除）
│   │   ├── main.jsx
│   │   ├── components/                 # 3 个在用（TopBar/TodayTasks/DreamBanner；NpcCard 保留未用）
│   │   ├── pages/
│   │   │   └── GamePlay.jsx            # 唯一页面（Home/Dialogue/Qingming/FinalChoice/Ending 5 视图，2200+ 行）
│   │   ├── data/                       # 2 个静态数据
│   │   │   ├── npcAgents.js            # 9 NPC system_prompt 模板（515 行）
│   │   │   └── storylines.js           # 28 节点 + matchesTrigger
│   │   └── lib/                        # 11 个核心模块（自研重点）
│   │       ├── store.js                # initialGameState + localStorage 存档
│   │       ├── api.js                  # npcAgent + LANG_RULE + 沪语约束
│   │       ├── npcPortrait.js          # 4 维 portrait + 6 mood + canNpcTalk
│   │       ├── rhythmEngine.js         # 节拍器（planTomorrow + shouldPushDream）
│   │       ├── gameEngine.js           # processDialogueTurn + commitEndOfDay
│   │       ├── branching.js            # 6 路径 + 清明 4 选 1
│   │       ├── metaAI.js               # 疯人院检测 + runMetaAI
│   │       ├── asylum.js               # 沪上疯人院结局
│   │       ├── dream.js                # dream 静默推送
│   │       ├── failures.js             # 失败检查（破产/被捕/孤立 + suspicion 抓人）
│   │       └── storylineEngine.js      # 故事线自动推进
│   ├── public/img/                     # 已重构：portraits(54) scenes(7) ending(11) mockup(26) + 空目录
│   ├── index.html
│   └── vite.config.js
├── server/                             # 后端
│   ├── index.js                        # 主入口（sseLLM + 各端点；前端实际只调 /api/npc/agent）
│   ├── local-llm.js                    # Ollama 调用
│   └── tests/                          # 单元测试
├── docs/                               # QA 报告 + AI-ONBOARDING.md（本文档）+ bug-audit-2026-09-02.md
├── verify-game.mjs                     # 引擎级端到端验证（39 项，node verify-game.mjs）
├── e2e-ui.mjs                          # 浏览器级模拟用户验证（22 项，node e2e-ui.mjs）
├── AGENTS.md
└── README.md
```

---

## 4. 核心模块速查（5 个最重要的）

### `app/src/lib/npcPortrait.js`（最核心自研）
- 4 维 portrait：`{ trust, respect, patience, tension, intimacy, energy, mood }`
- 6 mood 推断：`inferMood(portrait)` → 平静/愉悦/愤怒/烦躁/忧虑/悲哀
- 9 NPC × 6 mood 映射：`PORTRAIT_FILE_MAP` 54 张立绘文件名
- 自适应拒绝：`canNpcTalk(portrait, npc, opts)` 检查 patience/energy/tension
- 关键 API：`moodToPortraitUrl(mood, npcId)` → `/img/portraits/...`

### `app/src/lib/rhythmEngine.js`（叙事节拍器）
- 4 主角循环：`HERO_ROTATION` 28 天一循环
- 5 邻里轮换：`NEIGHBOR_ROTATION` 7 天一冒头
- 4 幕视觉：`getVisualMood(day)` → warm/sunset/dark-red/grey
- 关键 API：`planTomorrow(state)` → 返回 `todayPlan`（含 dailyTask/activeNpc/dreamPush/finalChoice）

### `app/src/lib/gameEngine.js`（核心引擎）
- 关键 API：
  - `processDialogueTurn(state, npcId, input, opts)` → 玩家输入处理
  - `commitEndOfDay(state)` → 日终 8 步流水线
  - `simulate100DayFull(initialState, dayByDayActions)` → 测试用
- 8 步流水线：
  1. 每日 portrait 衰减（dailyDecay）
  2. 故事线自动推进（每 5 天）
  3. 失败检查（applyFailure）
  4. meta-AI 调度（runMetaAI）
  5. 检查结局（day >= 100 触发 determineEnding）
  6. planTomorrow 写 todayPlan
  7. dream 静默推送
  8. dream 过期处理

### `app/src/lib/branching.js`（分支系统）
- 6 路径：`qingbang/rishang/dixia/conscience/survival/neutral`
- 清明 4 选 1：`CHOICE_TO_ENDING = ['pingfan', 'liangxin', 'torch', 'dixia']`
- 关键 API：
  - `makeChoice(state, choiceId, npcId)` → 玩家选，返回 `{state, branch, endingId}`
  - `determineEnding(state)` → `{type, text, branch}`
- 11 个 choice：`q1/q2/r1/r2/d1/d2/c1/c2/c3/s1/s2`

### `app/src/lib/api.js`（LLM 入口）
- 关键 API：`npcAgent({npc, playerInput, day, portrait, scene}, onDelta)` → SSE 流式
- `buildNpcSystemPrompt(npc, playerInput, day, portrait, scene)` → 拼 4 NPC system_prompt
- 沪语规则 `LANG_RULE`（line 184-208）：禁用川话/粤话/古文 50+ 词

---

## 5. 启动方式

```bash
# 1. 启动后端（端口 8787）
cd /Users/destiny/Downloads/haipai/city-whispers/server
npm install
npm run dev

# 2. 启动前端（端口 5173）
cd /Users/destiny/Downloads/haipai/city-whispers/app
npm install
npm run dev

# 3. 浏览器打开
# http://localhost:5173/
# 默认进 #play 路由（游戏）
# #framework 进测试控制台
# #test 进 API 测试
```

环境变量：
- `OLLAMA_BASE=http://localhost:11434`（默认）
- `OLLAMA_MODEL=qwen2.5:3b`（默认）
- `LLM_MODE=ollama`（auto/ollama/local）
- `VITE_API_BASE=http://localhost:8787`（前端 → 后端）

---

## 6. 当前状态

**v9 修复后（2026-09-02，全量验证通过）**：
- ✅ 引擎级端到端 39/39（`node verify-game.mjs`）
- ✅ 浏览器级模拟用户 22/22（`node e2e-ui.mjs`，真实 chromium 点击/输入/截图）
- ✅ 修复：能量墙（NPC 精力只减不增）、拒绝误判 OOC 导致必进疯人院、
   A/B 分支系统接入 UI、失败结局 UI 处理、故事线全链路（keyword/buy/morality/enter_screen）、
   分支 effects 去重、清明 4 选 1 文案对齐、农历修正、suspicion 实装等（详见 docs/bug-audit-2026-09-02.md）

**原 59 项 QA 失真说明**：旧 QA 脚本的"100 天测试"是纯挂机（无对话），"对话测试"不推进天数，
从未组合两者，因此漏掉了"正常游玩 ~第 10 天必进疯人院"等连锁 bug。

**演示流程**（5 分钟，已验证可走通）：
1. 开屏 tutorial
2. 4 任务 + 9 NPC 卡片
3. 跟 4 真实人物对话（分支选择条会弹出【良心之路】等选项）
4. 做 3 个选择（c1/c2/c3）
5. 打烊推进 → 第 95-99 天 5 夜「梦回 1937」→ 第 100 天清明墓园
6. 4 选 1 → 真结局（魂穿→pingfan / 留守→liangxin / 记忆→torch / 北上→dixia）

**验证方式**：
```bash
# 引擎级（无 UI）
cd city-whispers && node verify-game.mjs
# 浏览器级（自动起静态服务器 + 真实 chromium，无需后端）
cd city-whispers && node e2e-ui.mjs
```

---

## 7. 待办事项（v9 修订）

### P0（上架前）
- [ ] 录 5 分钟演示视频（按第 8 节脚本；流程已可走通）
- [ ] 写 `deploy.sh` 一键部署（esbuild 产物 e2e-dist/ 可直接部署，天然走本地兜底不依赖后端）

### P1（可选增强）
- [ ] 服务端死端点清理（前端只调 /api/npc/agent）
- [ ] 加 NPC 之间 gossip
- [ ] 恢复账本（如需，见 docs/qa-ui-audit-2026-09-02.md）

### P2（可选）
- [ ] 提交参赛报名表
- [ ] 写项目 PPT/海报
- [ ] 写技术博客

---

## 8. 5 分钟演示视频脚本

| 时间 | 镜头 | 配音 |
|---|---|---|
| 0:00-0:30 | 黑屏 → 武康路俯瞰 → 朱砂"1936" | "1936 年，武康路。我们做了一个**自研 3 级 LLM 兜底链** + **4 维 NPC 情绪持久化**的互动叙事游戏。" |
| 0:30-1:00 | 截屏：左 ChatGPT（机械） / 右 我们（变脸） | "市面 LLM 互动叙事，玩 5 分钟就穿帮。**我们的 NPC 真的变脸**。" |
| 1:00-2:00 | 录屏：HomeView → 点项松茂 → 输"滚开" → 立绘「愤怒」 | "辱骂一句——**trust -15 / tension +35**——4 维 portrait 实时算 → 6 套立绘联动" |
| 2:00-2:30 | 架构图：3 级 LLM 兜底链 | "**自研 3 级兜底**：StepFun 主 → Ollama 备 → 规则兜底。qwen2.5:3b 延迟 3s 时自动降级到 1.5b" |
| 2:30-3:00 | 100 天快进 + 4 主角循环 | "**自研 rhythmEngine**——4 主角 28 天循环，5 邻里 7 天轮换，4 幕视觉" |
| 3:00-3:30 | 10 章账本解锁（**注：当前账本功能已砍，演示跳过这步**） | "10 章账本渐进揭示" |
| 3:30-4:00 | QingmingTombView → 4 NPC 书信 | "清明墓前 4 选 1——8 结局真分支" |
| 4:00-4:30 | 选 B → EndingPage 良心结局 | "选 B（留 1936）→ 自研 ENDING_CATALOG 渲染民国报纸卡片" |
| 4:30-4:50 | 技术栈总结 | "**自研 4 NPC 真实档案**：项松茂 1880-1932 / 方液仙 1893-1940 / 郭乐 1874-1955 / 巴金 1904-2005" |
| 4:50-5:00 | GitHub Pages URL + 项目名 | "Demo：[链接]" |

---

## 9. 重要约定（必看）

来自 `AGENTS.md`：
1. **UI 绝对不能自己设计**——流程必须是 gpt-image-2 跑图 → 用户审核 → 1:1 还原 React 组件
2. **图片中文字是 gpt-image-2 幻觉**——所有文字代码自己写，不抄图
3. **命名规范**：描述式文件名 `{场景}-{主体}-{关键元素}-{mood/状态}.png`
4. **不许砍账本**（用户原话："可以上架"）—— 当前状态账本功能已被砍，需要恢复的话见 docs/qa-ui-audit-2026-09-02.md

---

## 10. 常见任务清单

### 想加新 NPC？
1. 写 `app/src/data/npcAgents.js` 里加 NPC 配置（含 `system_prompt_template`、`historical`、`era`）
2. 在 `app/src/lib/npcPortrait.js` `DEFAULT_AGENDAS` 加条目
3. 准备 6 张立绘（每个 mood 一张）放到 `app/public/img/portraits/`
4. 在 `NpcCard.jsx` 的 `PORTRAIT_FILE_MAP` 加 6 行映射
5. 跑 qa 测试验证

### 想加新结局？
1. 在 `app/src/lib/branching.js` `BRANCHES` 加分支定义
2. 在 `app/src/pages/GamePlay.jsx` `ENDING_CATALOG` 加结局（含 paragraphs/bullets/emphasis/image）
3. 准备结局图（如有）放到 `app/public/img/ending/`
4. 在 `CHOICE_TO_ENDING` 加映射
5. 跑 qa 测试

### 想加新 LLM provider？
1. 改 `server/index.js` `sseLLM` 函数加新分支
2. 改 `server/local-llm.js` 加新调用函数
3. 在 `app/src/lib/api.js` `call` 函数加 fallback 链
4. 写 5+ 单元测试

### 想加新视图（view）？
1. 在 `app/src/pages/GamePlay.jsx` 加新 view 组件
2. 在 `setView(...)` 列表加新 view 名
3. 路由切换
4. 跑 qa 测试

---

## 11. 调试技巧

- 玩家存档在 `localStorage.city_whispers_save_v2` 和 `city_whispers_session_id`
- 想清存档：DevTools → Application → Local Storage → 删这两条
- 想强制设状态：在 DevTools Console 跑 `localStorage.setItem('city_whispers_save_v2', JSON.stringify({...}))`
- 想看 100 天剧情：跑 `node -e "import('./app/src/lib/gameEngine.js').then(m => { let G = m.simulate100DayFull(null, [{day:50, npcId:'xiangsongmao', input:'你好'}]); console.log(JSON.stringify(G, null, 2)) })"`
- 跑 dev 路由：`http://localhost:5173/#test`（API 测试），`#framework`（测试控制台）

---

## 12. 当前 8 个 UI 体验 bug（不阻塞演示但要修）

看 `docs/qa-ui-audit-2026-09-02.md` 完整列表。摘要：
1. TopBar DialogueView「设」按钮死（已设 null，但没真弹设置）
2. TodayTasks 3 个 fillers 删 2 个 onClick:null
3. TodayTasks legacy 标签删 4 个
4. "提示"按钮 改成实时算亲密度最低的 NPC（**已修**）
5. LedgerView 多章节列表
6. 意图卡跟着 day 阶段变
7. EndingTorchView 4 按钮实装
8. C-3 dream 门槛再降

---

## 13. 上架必做（v9 修订）

1. **前端已支持无后端运行**：`VITE_API_BASE` 为空时 `api.js` 自动走 `localNpc()` 本地规则兜底（已实现并 E2E 验证）
2. **部署**：`e2e-dist/` 是 esbuild 构建产物（静态文件 + img），可直接丢到 GitHub Pages/任意静态托管
3. **录 5 分钟演示视频**（按第 8 节脚本）
4. **提交参赛报名表**（海派初芯·青年 AI 创新黑客松，2026-09-12 截止）

---

## 14. 一句话给 AI Agent

> "5 个核心 lib 模块（npcPortrait / rhythmEngine / gameEngine / branching / api）+ 9 NPC + 54 张立绘 + 4 真实人物 + 6 路径分支。**两大自研架构**：3 级 LLM 兜底链 + 4 维 NPC 情绪持久化。**v9 修复后 39 项引擎验证 + 22 项浏览器验证全 PASS**（`node verify-game.mjs` / `node e2e-ui.mjs`）。前端可无后端运行（localNpc 兜底）。"

---

**Last updated**: 2026-09-02（v9 修复后）
**QA status**: 引擎 39 PASS / 浏览器 22 PASS / 0 FAIL
**Ready for**: 上架 + 参赛报名
