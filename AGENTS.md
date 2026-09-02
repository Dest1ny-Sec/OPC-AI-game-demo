# city-whispers 项目规则（给 AI agent 看）

## 硬规则：UI 设计流程（绝不违反）

**绝对不允许 agent 自己设计/实现 UI。** UI 只能从"用户审核过的 gpt-image-2 图"1:1 还原。

完整流程：
1. 用户提供 `gpt-image-2` API（**API key 写在 `.secrets/grsai.json`，不进 git**，
   端点 `https://grsaiapi.com/v1/api/generate` 或 `https://grsai.dakka.com.cn/v1/api/generate`）
2. **先跑图**（中文 prompt，9 色调色板 + 5 类字体 + 8 装饰元素，详见 `docs/ui-design-2026-v2.md`）
3. **交给用户审核** —— 不允许跳过这一步
4. 用户说 OK 后，**1:1 还原**到 React 组件（layout/字号/颜色/位置都按图来）

**禁止行为**：
- 禁止自己拍脑袋画 UI（即使"参考"已有设计）
- 禁止用占位图 + 自己设计的 layout
- 禁止跳过审核步骤
- 禁止在没看到跑出来的图之前就写组件

**允许的例外**：
- 后端逻辑（lib/、server/）可以自由设计
- 测试脚本（tests/）可以自由写
- 文档（docs/）可以自由写
- 玩法逻辑（meta-AI、疯人院、存档隔离）可以自由设计

## LLM 模式选择（用户当前偏好）

**本地优先**。server 默认走 `LLM_MODE=ollama`，跳过云端：
```
cd server && LLM_MODE=ollama OLLAMA_MODEL=qwen2.5:3b PORT=8787 node index.js
```

三级兜底链：
1. `LLM_MODE=auto` + 云端 key（默认，主用 MiniMax-M3[1M]）
2. `LLM_MODE=ollama` 或云端失败 → Ollama 本地（qwen2.5:14b）
3. 终极兜底 → `localNpc()` 规则（`app/src/services/localNpc.js`）

5 个测试端点全部走 3 级兜底：`/api/npc/agent`、`/api/npc/affect`、
`/api/story/judge`、`/api/scene/atmosphere`、`/api/health`。

## API key 管理（绝不进 git）

- MiniMax-M3 key → `server/.env`（`.env` 在 `.gitignore`）
- grsai / gpt-image-2 key → `.secrets/grsai.json`（`.secrets/` 在 `.gitignore`）
- 模板：`server/.env.example` 写 `sk-你的key` 占位符
- 演示前在 `server/.env` 配真实 key（不进 git）

## 关键文件位置（v3 6 层架构）

- 状态：`app/src/state/store.js`（含 sessionId 隔离 + asylumData）
- 立绘 + 拒绝：`app/src/rules/portrait.js` + `app/src/rules/refuse.js`（6 因子 + 6 mood + canNpcTalk）
- 调度 AI：`app/src/engine/metaAI.js`（3 信号触发疯人院）
- 疯人院结局：`app/src/rules/asylum.js`
- 游戏引擎：`app/src/engine/processDialogue.js` + `app/src/engine/commitDay.js`
- LLM 适配：`app/src/services/llmClient.js` + `app/src/services/dialogueService.js`
- 6 层架构：`state/ → hooks/ → rules/ → engine/ → data/ → services/ → views/components/pages`
- UI 设计规范：`docs/ui-design-2026-v2.md`（25KB，含 10 张 prompt）
- 立绘 prompt：`docs/portrait-prompts.md`
- 54 张立绘：`app/public/img/portraits/{npcId}-{mood}.png`（6 mood × 9 NPC）

## 测试清单（验收）—— 已并入 6 层架构的单元测试

| 测试 | 路径 | 预期 |
|---|---|---|
| 端到端 LLM | `node /tmp/qa-final.mjs` | 4/4（LLM/9 NPC/health/路由）|
| Build 验证 | `cd app && npm run build` | 269 KB，无警告 |
| 路由 | 23 种 view 路由 | 全 200 |
| LLM 链路 | 9 NPC 全部可调 | 0.5-3s 响应 |
| 拒答文案 | bundle 含"别过脸去" | ✓ |
| 重开链路 | bundle 含 K / SESSION_K / removeItem | ✓ |
