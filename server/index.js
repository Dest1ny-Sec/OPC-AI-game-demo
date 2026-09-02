// 「五洲大药房·1936」后端 —— AI 游戏叙事引擎（3 级兜底：StepFun/MiniMax-M3 LLM → Ollama 本地 → 规则兜底）
// 端云协同：端侧持有全部状态与规则引擎（economy.js），云端只收脱敏摘要，回吐叙事文本
import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { callOllama, streamOllama, OLLAMA_AVAILABLE } from './local-llm.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))

const {
  MINIMAX_API_KEY,
  MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic',
  MINIMAX_MODEL = 'MiniMax-M3[1M]',
  PORT = 8787,
  LLM_MODE = 'auto', // 'auto' | 'ollama' | 'local' — 强制走哪一级（auto 默认按三级兜底链）
} = process.env

const BANNED = ['梦想', '远方', '心灵', '岁月', '流年', '星辰', '灵魂', '宿命', '绽放', '慰藉']
const LLM_TIMEOUT = 75000 // M3 思考链上限（服务端强制收流）
// P1-B：小参数模型压榨参数（3b 模型温度折中，num_predict 留够发挥空间）
const LLM_TEMPERATURE = 0.7    // 0.7 = 准确度（0.55）+ 表达力（0.8）的折中
const LLM_NUM_PREDICT = 250    // 250 ≈ 180 汉字，留 50 字 buffer

async function* streamLLMText(system, user, maxTokens = LLM_NUM_PREDICT) {
  const res = await fetch(MINIMAX_BASE_URL + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': MINIMAX_API_KEY, 'Authorization': `Bearer ${MINIMAX_API_KEY}`, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MINIMAX_MODEL, max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}`)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const t0 = Date.now()
  while (true) {
    if (Date.now() - t0 > LLM_TIMEOUT) { reader.cancel().catch(() => {}); return } // 思考链过长：强制收流，返回已生成部分
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try { const t = JSON.parse(data)?.delta?.text; if (t) yield t } catch { /* 心跳 */ }
    }
  }
}

function sseHead(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** 通用 SSE 处理器：3 级兜底
 *  1. StepFun/MiniMax-M3 LLM (主)
 *  2. Ollama 本地 (StepFun 失败时)
 *  3. localNpc() 规则 (终极兜底)
 */
async function sseLLM(res, system, user, { fallback, maxTokens = 4096, tag = 'agent' }) {
  const send = sseHead(res)
  let ok = false

  // 0. 强制模式：只走 local（纯规则，不调任何 LLM）
  if (LLM_MODE === 'local') {
    const text = typeof fallback === 'function' ? fallback() : fallback
    send('delta', { t: text })
    send('done', { mode: 'variant', text })
    res.end()
    return
  }

  // 1. 尝试主 LLM（auto 模式才走）
  if (LLM_MODE === 'auto' && MINIMAX_API_KEY) {
    try {
      let full = ''
      for await (const t of streamLLMText(system, user, maxTokens)) { full += t; send('delta', { t }) }
      if (full.trim()) {
        const bannedHit = BANNED.find(w => full.includes(w))
        if (bannedHit) send('warn', { banned: bannedHit })
        send('done', { mode: 'llm', text: full.trim(), tag })
        ok = true
      }
    } catch (e) {
      send('warn', { primary: String(e).slice(0, 100) })
    }
  }

  // 2. 主 LLM 失败 / LLM_MODE=ollama → Ollama 本地
  if (!ok && (await OLLAMA_AVAILABLE)) {
    try {
      let full = ''
      await streamOllama(system, user, (chunk) => { full += chunk; send('delta', { t: chunk }) }, process.env.OLLAMA_MODEL || 'qwen2.5:14b')
      if (full.trim()) {
        send('done', { mode: 'ollama', text: full.trim(), tag })
        ok = true
      }
    } catch (e) {
      send('warn', { ollama: String(e).slice(0, 100) })
    }
  }

  // 3. 都失败 → 终极兜底（规则）
  if (!ok) {
    const text = typeof fallback === 'function' ? fallback() : fallback
    send('delta', { t: text })
    send('done', { mode: 'variant', text })
  }
  res.end()
}

// ============ 健康检查 ============
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>五洲大药房 · API</title>
<body style="font-family:Songti SC,serif;background:#F5EFE3;color:#1F2A33;display:grid;place-items:center;height:100dvh;margin:0">
<div style="text-align:center"><h1 style="font-family:Kaiti SC,serif;letter-spacing:6px">五洲大药房 · 1936</h1>
<p>AI 叙事引擎模式：<b>${MINIMAX_API_KEY ? 'LLM (MiniMax-M3)' : '本地规则引擎'}</b></p>
<p style="color:#6f6a60">前端地址：<a href="http://localhost:5173"><b>http://localhost:5173</b></a></p></div></body></html>`)
})

app.get('/api/health', async (_req, res) => {
  const ollama = await OLLAMA_AVAILABLE
  res.json({
    ok: true,
    mode: LLM_MODE === 'ollama' ? 'ollama' : LLM_MODE === 'local' ? 'local' : (MINIMAX_API_KEY ? 'llm' : 'variant'),
    llm_mode: LLM_MODE,
    primary: MINIMAX_API_KEY ? 'configured' : 'none',
    ollama: ollama ? 'available' : 'unavailable',
    ollama_model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
    game: '五洲大药房·1936',
  })
})

// ============ 1. NPC Agent 实时对话 ============
app.post('/api/npc/agent', async (req, res) => {
  const { npc, playerInput, day } = req.body || {}
  if (!npc?.system || !npc?.name) return res.status(400).json({ error: '缺少 npc.system / npc.name' })
  await sseLLM(res, npc.system, playerInput || '（客人走进店里，你抬头看了他一眼。）', {
    maxTokens: 4096,
    tag: `npc:${npc.name}`,
    fallback: () => localNpcReply(npc, playerInput, day),
  })
})

// ============ 1d. NPC 自适应拒绝 —— NPC 自己根据心情/亲密生成"婉拒话术" ============
// 前端在 canNpcTalk 返回 canTalk=false 时调用，端点让 NPC 走自己的 system prompt + portrait 生成
app.post('/api/npc/refuse', async (req, res) => {
  const { npc, playerInput, day = 1, reason, portrait = {} } = req.body || {}
  if (!npc?.name) return res.status(400).json({ error: '缺少 npc.name' })
  if (!reason) return res.status(400).json({ error: '缺少 reason' })

  // 5 类拒绝原因 → 中文场景描述
  const reasonMap = {
    patience_exhausted: '你耐心耗尽了，跟这个人聊得太累',
    energy_low:         '你心力很低，今天没力气再聊',
    daily_limit:        '今天跟这个人聊太多了（≥5 次）',
    tension_high:       '你今天心情很差，刚才跟这个人吵过架',
    already_refused:    '你今天已经拒绝过他一次，他又来了',
  }
  const reasonText = reasonMap[reason] || '你不想再聊了'

  // 在 NPC 自己的 system prompt 后面追加"特别指令"
  const refuseSystem = (npc.system || `你是 1936 年上海五洲大药房的 NPC，用沪语（侬/阿拉/晓得/伊/迭个/勿）说话，30-50字，禁止出现 1937 后词汇。`) + `

【特别指令 · 当前状态】
${reasonText}
玩家刚才对你说：「${playerInput || '（无话）'}」

【你现在的心境】mood=${portrait.mood || '平静'}，trust=${portrait.trust ?? 50}/100，patience=${portrait.patience ?? 50}/100
【你跟玩家的亲密度】${portrait.intimacy ?? 0}/5

请输出一句 20-50 字的"婉拒/逐客"话术。要求：
1. 完全符合你的人格和当下心境
2. 用 1936 年沪语（侬/阿拉/晓得/伊/迭个/勿）
3. 不引用任何"AI/玩家/存档"等词
4. 留有余地（不是真的绝交，只是这次不想聊）
5. 只输出一行话术本身，前面不要写"我说："等前缀`

  const localRefuse = () => localRefuseReply(npc.name, reason, portrait)
  await sseLLM(res, refuseSystem, playerInput || '（玩家走过来想说话）', {
    maxTokens: 4096,
    tag: `refuse:${npc.name}`,
    fallback: localRefuse,
  })
})

function localRefuseReply(name, reason, portrait) {
  const m = portrait?.mood || '平静'
  const baseMap = {
    patience_exhausted: `${name}揉了揉额角：「侬讲的话阿拉听明白了，脑子瓦特哉，侬改日再讲好伐？」`,
    energy_low:         `${name}叹了口气：「阿拉今朝真个没力气了，侬有啥事体明朝再讲好伐？」`,
    daily_limit:        `${name}笑了笑：「侬今朝讲了够多哉，阿拉先想歇歇，明朝再叙。」`,
    tension_high:       `${name}脸色一沉：「侬今朝忒多嘴了，阿拉要静静，侬请回。」`,
    already_refused:    `${name}摆了摆手：「昨儿个就同侬讲过了，阿拉今朝确实有事体。」`,
  }
  // mood 微调
  const moodPrefix = m === '愤怒' ? '（冷笑）' : m === '愉悦' ? '（笑了笑）' : m === '烦躁' ? '（有些不耐烦）' : ''
  return (moodPrefix ? moodPrefix + ' ' : '') + (baseMap[reason] || `${name}想了想：「阿拉先走了。」`)
}

// ============ 1b. NPC 情绪影响：玩家一句话 → LLM 实时算情绪变化 ============
app.post('/api/npc/affect', async (req, res) => {
  const { npcName, playerInput, currentEmotion = '平静', currentAffinity = 50 } = req.body || {}
  if (!npcName || !playerInput) return res.status(400).json({ error: '缺少 npcName / playerInput' })
  // LLM 实时算：emotion_delta / affinity_delta / memory_to_add
  const system = `你是 1936 年上海的 NPC 心理分析器。分析玩家这句话对 NPC 情绪/关系的影响。
输出 JSON 格式（不要其他任何字）：
{"emotion":"新情绪（平静/戒备/认可/失望/焦虑/愤怒/温暖/敬佩）","affinity_delta":-15~+15 整数,"memory":"一句 15 字内的记忆摘要，可空"}`
  const user = `NPC: ${npcName}（当前情绪：${currentEmotion}，当前好感：${currentAffinity}）
玩家说：${playerInput}`
  const local = (input) => {
    // 关键词规则兜底
    let delta = 0, emo = currentEmotion, mem = ''
    if (/日本|东洋|卖国|汉奸/.test(input)) { delta = -8; emo = '愤怒'; mem = '玩家提到东洋货' }
    else if (/便宜|让价|求|可怜/.test(input)) { delta = +2; emo = '戒备'; mem = '玩家求情' }
    else if (/谢谢|感激|恩人|好人/.test(input)) { delta = +6; emo = '温暖'; mem = '玩家表达感谢' }
    else if (/讨厌|滚|蠢|笨/.test(input)) { delta = -10; emo = '愤怒'; mem = '玩家辱骂' }
    else if (/合作|一起|朋友|信任/.test(input)) { delta = +5; emo = '认可'; mem = '玩家表达合作' }
    return { emotion: emo, affinity_delta: delta, memory: mem }
  }
  // 这个端点用 JSON 不用 SSE（前端一次性拿结果）
  // 3 级兜底：auto 走主 LLM → Ollama → local；ollama 模式跳过主 LLM；local 模式直接规则
  let full = ''
  let mode = 'local'
  if (LLM_MODE === 'local') {
    return res.json({ mode: 'local', ...local(playerInput) })
  }
  if (LLM_MODE === 'auto' && MINIMAX_API_KEY) {
    try {
      for await (const t of streamLLMText(system, user, 256)) full += t
      const m = full.match(/\{[\s\S]*\}/)
      if (m) {
        mode = 'llm'
        return res.json({ mode, ...JSON.parse(m[0]) })
      }
    } catch { /* 降级到 ollama */ }
  }
  // Ollama 兜底
  if (await OLLAMA_AVAILABLE) {
    try {
      const text = await callOllama(system, user, process.env.OLLAMA_MODEL || 'qwen2.5:14b')
      if (text) {
        const m = text.match(/\{[\s\S]*\}/)
        if (m) {
          return res.json({ mode: 'ollama', ...JSON.parse(m[0]) })
        }
      }
    } catch { /* 降级到 local */ }
  }
  // 终极规则兜底
  res.json({ mode: 'local', ...local(playerInput) })
})

// ============ 1c. 故事线判定：fact → 下一步派哪个 NPC + 触发什么事件 ============
app.post('/api/story/judge', async (req, res) => {
  const { fact, state, factHistory = [] } = req.body || {}
  if (!fact) return res.status(400).json({ error: '缺少 fact' })
  // 1. 端侧规则：检查 storylines.js
  const localJudge = requireLocalJudge(fact, state)
  if (localJudge) {
    res.json({ mode: 'local', ...localJudge })
    return
  }
  // 2. 云端 LLM 判定（auto 才走；ollama/local 模式跳过）
  if (LLM_MODE === 'local') {
    return res.json({ mode: 'local-fallback', nextNpc: fact.npcId || null, eventType: 'dialogue', reason: 'local 模式' })
  }
  let full = ''
  if (LLM_MODE === 'auto' && MINIMAX_API_KEY) {
    try {
      const system = `你是 1936 年上海五洲大药房的"叙事裁判"。基于玩家的 fact 和 state，判断下一步应该发生什么。
【边界控制】
1. 只能基于 1936 年的事实，不能引入 1937 后任何事
2. 4 真实历史人物（项松茂、方液仙、郭乐、巴金）的核心性格不可改
3. 不要创造新的历史人物
4. 派 NPC 时优先派 fact 涉及的 NPC
5. 如果 fact 触发了故事线节点，直接返回 nodeId

【输出格式 · 严格 JSON】
{ "nextNpc": "xiangsongmao"|"fangyexian"|"guole"|"bajin"|"wangpo"|"xunpu"|"qingbang"|"rishang"|"dixia"|null, "eventType": "story_node"|"moral_choice"|"random_event"|"dialogue"|null, "nodeId": "xiangsongmao_node_1"|null, "payload": {...}, "reason": "20字内解释" }`
      const user = `【当前 fact】\n${JSON.stringify(fact, null, 2)}\n\n【state 摘要】\n第 ${state?.day || 1} 天, 资金 ${state?.money?.toFixed(2) || 0}, 良心 ${state?.morality?.conscience || 50}/100, 生存 ${state?.morality?.survival || 50}/100`
      for await (const t of streamLLMText(system, user, 512)) full += t
      const m = full.match(/\{[\s\S]*\}/)
      if (m) {
        res.json({ mode: 'llm', ...JSON.parse(m[0]) })
        return
      }
    } catch { /* 降级到 ollama */ }
  }
  // Ollama 兜底
  if (await OLLAMA_AVAILABLE) {
    try {
      const system = `你是 1936 年上海五洲大药房的"叙事裁判"。基于玩家的 fact 和 state，判断下一步应该发生什么。
【边界控制】
1. 只能基于 1936 年的事实
2. 4 真实历史人物性格不可改
3. 不要创造新历史人物
4. 派 NPC 时优先 fact 涉及的 NPC
5. 触发了故事线节点就直接返回 nodeId

【输出格式 · 严格 JSON】
{ "nextNpc": "xiangsongmao"|"fangyexian"|"guole"|"bajin"|"wangpo"|"xunpu"|"qingbang"|"rishang"|"dixia"|null, "eventType": "story_node"|"moral_choice"|"random_event"|"dialogue"|null, "nodeId": "xiangsongmao_node_1"|null, "payload": {}, "reason": "20字内解释" }`
      const user = `fact: ${JSON.stringify(fact)}\nstate: day=${state?.day||1}, money=${state?.money||0}, conscience=${state?.morality?.conscience||50}, survival=${state?.morality?.survival||50}`
      const text = await callOllama(system, user, process.env.OLLAMA_MODEL || 'qwen2.5:14b')
      if (text) {
        const m = text.match(/\{[\s\S]*\}/)
        if (m) {
          res.json({ mode: 'ollama', ...JSON.parse(m[0]) })
          return
        }
      }
    } catch { /* 降级 */ }
  }
  // 终极兜底
  res.json({ mode: 'local-fallback', nextNpc: fact.npcId || null, eventType: 'dialogue', reason: 'LLM 全部失败，规则兜底' })
})

// 端侧规则判定（不依赖 LLM）
function requireLocalJudge(fact, state) {
  // fact 涉及 first_time 买某商品 → 触发对应 NPC 故事线节点 1
  if (fact.flags?.includes('first_time') || (fact.type === 'buy' && fact.flags?.includes('buy'))) {
    const itemToNode = {
      '131-牙膏': 'xiangsongmao_node_1',
      '三星牙膏': 'fangyexian_node_1',
      '怀表': 'guole_node_1',
      '丝绸': 'guole_node_1',
    }
    const nodeId = itemToNode[fact.item]
    if (nodeId && !state.storylineSeen?.includes(nodeId)) {
      return {
        nextNpc: fact.npcId,
        eventType: 'story_node',
        nodeId,
        reason: '首次购买触发起源节点',
      }
    }
  }
  // 卖日货 3 次以上 → 项松茂翻脸
  if (fact.flags?.includes('sell_japanese')) {
    const japaneseSells = state.behavior?.filter(b => b.action === 'sell' && (b.item === '仁丹' || b.item === '万金油')).length || 0
    if (japaneseSells >= 3 && !state.storylineSeen?.includes('xiangsongmao_node_5')) {
      return {
        nextNpc: 'xiangsongmao',
        eventType: 'story_node',
        nodeId: 'xiangsongmao_node_5',
        reason: '卖日货 3 次触发翻脸',
      }
    }
  }
  // 道德大幅变化 → 巴金来记
  if (fact.morality_delta && (Math.abs(fact.morality_delta.conscience || 0) >= 15 || Math.abs(fact.morality_delta.survival || 0) >= 15)) {
    if (!state.storylineSeen?.includes('bajin_node_4')) {
      return {
        nextNpc: 'bajin',
        eventType: 'story_node',
        nodeId: 'bajin_node_4',
        reason: '道德变化触发巴金记账',
      }
    }
  }
  return null
}

function localNpcReply(npc, playerInput, day) {
  const u = playerInput || ''
  const name = npc.name
  // 按 NPC 性格标签（traits）选不同兜底风格
  const traits = (npc.personality?.traits || []).join('')
  if (/便宜|让|价|贵/.test(u)) {
    if (traits.includes('硬气')) return `${name}把算盘往桌上一拍：「价是阿拉定的，侬爱要不要！」`
    if (traits.includes('圆滑')) return `${name}眯起眼笑了笑：「侬也是老江湖了，知道什么叫行情。」`
    if (traits.includes('精明')) return `${name}慢条斯理抿了口茶：「侬这个价，唔该再去掂量掂量。」`
    if (traits.includes('温和')) return `${name}把笔搁下：「钱的事小，先坐下来喝杯茶。」`
    return `${name}把算盘一拨：「价是行情定的，侬要还，拿诚意来还。」`
  }
  if (/日本|东洋|仁丹/.test(u)) {
    if (traits.includes('硬气')) return `${name}拍了桌子：「东洋货？五洲的门槛不卖给侬这种人！滚出去！」`
    if (traits.includes('温和')) return `${name}沉默了一会儿：「有些事，是要付出代价的。」`
    return `${name}把脸沉下来：「东洋货，概不与谈。」`
  }
  if (/新闻|局势|战事/.test(u)) {
    if (traits.includes('文人')) return `${name}抬头看了看窗外：「风声紧的时候，最容易看见谁是真的朋友。」`
    return `${name}压低了声音：「外头的风声，一天比一天紧。你自己掂量。」`
  }
  if (/你好|见面|嗨/.test(u)) {
    if (traits.includes('温和')) return `${name}放下笔微微一笑：「这天儿还出门，坐吧。」`
    return `${name}抬了抬眼：「这天儿，做生意的不多。坐。」`
  }
  if (traits.includes('文人')) return `${name}合上账本：「${(u || '嗯').slice(0, 8)}——阿拉记下了。」`
  return `「${(u || '嗯').slice(0, 10)}」——${name}想了想：「话是这么讲，账是那么算。侬再想想。」`
}

// ============ 2. 每日新闻 + 物价情绪 ============
app.post('/api/price/sentiment', async (req, res) => {
  const { day = 1, volume = 1, recentEvents = [] } = req.body || {}
  const system = `你是1936年上海《申报》的新闻编辑。根据当天日期与近期市况，写一则 40-60 字的上海市场短新闻（市况/物价/局势），只输出新闻正文，古风白话，不要标题与日期。`
  const user = `第 ${day} 天（第 ${volume} 卷）。近期发生：${recentEvents.join('；') || '市面平静'}。`
  const localNews = [
    '米价微涨，法租界米号门口排起长队，巡捕房加派了人手。',
    '布匹到货稀少，绸缎庄纷纷关账盘货，行情看紧。',
    '海上风闻：航运未通，煤油存货见底，几家洋行惜售观望。',
    '牙皂生意清淡，唯有药房柜台前排着买阿司匹林的队伍。',
    '此间传言纷纭，市民囤货者众，大小店铺人心惶惶。',
  ]
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'sentiment', fallback: localNews[day % localNews.length] })
})

// ============ 3. 时代碎片背景故事 ============
app.post('/api/fragment/generate', async (req, res) => {
  const { fragment, playerContext = '' } = req.body || {}
  if (!fragment?.name) return res.status(400).json({ error: '缺少 fragment' })
  const system = `你是1936年上海的说书人。围绕一件旧物，讲一段 60-90 字的往事，收尾一句要落到"物是人非"。只输出正文。`
  const user = `旧物：${fragment.name}（${fragment.era || '年代不详'}）。已知：${fragment.desc || ''}。玩家近况：${playerContext}。`
  const local = `说起这${fragment.name}，老上海没人不认得。${fragment.desc || ''}经手它的人都散了，物件还在柜台上，替他们记着年份。`
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'fragment', fallback: local })
})

// ============ 4. 三方请柬渲染 ============
app.post('/api/agent/invite', async (req, res) => {
  const { invite, day = 31 } = req.body || {}
  if (!invite?.name) return res.status(400).json({ error: '缺少 invite' })
  const system = `你是1936年上海的局势观察者。用 50-70 字渲染一份请柬背后的凶险与诱惑。语气克制、信息量大，结尾一句提醒"去了，就回不了头"。只输出正文。`
  const user = `请柬：${invite.name}。邀约原文：${invite.desc}。今天是第 ${day} 天。`
  const local = `${invite.desc}——这一晚过后，武康路上的同行都会重新掂量你。去，还是不去？`
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'invite', fallback: local })
})

// ============ 5. 章末"明日预告" ============
app.post('/api/preview/tomorrow', async (req, res) => {
  const { day = 1, volume = 1, summary = [], morality } = req.body || {}
  const system = `你是1936年上海的说书人，每次收摊前讲一句"明日预告"（30-50字），留一个钩子。语气：且听下回分解。只输出预告正文。`
  const user = `第 ${day} 天收摊。今天发生：${summary.join('；') || '平平一日'}。良心${morality?.conscience ?? 50}/生存${morality?.survival ?? 50}。`
  const local = `第 ${day + 1} 天，米行要涨价，房租也要到期了。这位老板，且听下回分解。`
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'preview', fallback: local })
})

// ============ 5b. 场景氛围：进入新场景时 LLM 写一段 60-90 字的场景描写 ============
app.post('/api/scene/atmosphere', async (req, res) => {
  const { scene = 'pharmacy', day = 1, volume = 1, mood = '平静' } = req.body || {}
  const sceneNames = {
    pharmacy: '五洲大药房', alley: '武康路弄堂', teahouse: '茶馆',
    french_concession: '法租界', yongan_dept: '永安百货', bajin_study: '巴金书房',
    '16pu_dock': '十六铺码头',
  }
  const sceneName = sceneNames[scene] || '上海弄堂'
  const system = `你是1936年上海的说书人，为玩家进入一个场景写一段 60-90 字的氛围描写。
要求：
- 视觉（光线、颜色、物件）、听觉（音乐、环境声）、嗅觉（气味）三维描写
- 收尾一句要暗示这个场景里今天会"有事发生"
- 语气克制、年代感强，不出现 1937 年后的词汇
- 只输出正文。`
  const user = `场景：${sceneName}。第 ${day} 天（第 ${volume} 卷）。当前气氛：${mood}。`
  const local = (() => {
    const descs = {
      pharmacy: '五洲大药房的铜铃叮当作响，药香混着桐油味，柜台后的铜药碾沉默着。今天的报纸压在柜台上，字里行间似乎藏着一笔旧账。',
      alley: '弄堂里飘着各家晚饭的香气，晾衣绳上的被单在风里晃，远处传来叮叮咚咚的自行车铃声。',
      teahouse: '茶博士的铜壶在水吊里转了三圈，茶客们压低声音说着外头的局势。',
      french_concession: '梧桐叶在秋风中打着旋儿，咖啡馆的留声机放着爵士乐，巡捕房的警笛远远传来。',
      yongan_dept: '永安百货的琉璃灯照亮了大理石地面，香水味和丝绸光泽，这里是另一个世界。',
      bajin_study: '煤油灯的光晕里，稿纸堆积如山，窗外的雨声和笔尖的沙沙声混在一起。',
    }
    return descs[scene] || '上海的弄堂里，又是一个平常的傍晚。'
  })()
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'scene', fallback: local })
})

// ============ 6. 终章长叙事 ============
app.post('/api/finale/letter', async (req, res) => {
  const { choiceId = 'A', choiceName = '', state = {} } = req.body || {}
  const endLine = choiceId === 'B' ? '你把自己埋进了历史' : choiceId === 'C' ? '你成了传火的人' : '2026 年，他们还在'
  const system = `你是1936年上海的说书人，为一位药房老板写 300 字以上的终章。他的选择：${choiceName}。要求：第二人称"你"；嵌入他 100 天的关键经历（资金/人心/良心挣扎）；结尾落在"${endLine}"；分 3-4 段，每段空一行。`
  const user = `他的 100 天：第 ${state.day} 天结束时，身边有 ${state.money} 块大洋；良心 ${state.morality?.conscience}/100，生存 ${state.morality?.survival}/100；收集时代碎片 ${state.fragments} 件；关键往事：${(state.volumeSummary || []).join('；') || '经营、周旋、抉择'}。`
  const local = `第 100 天，你关上五洲大药房的门板，把算盘推到一边。\n\n这 100 天，你从 12 块大洋起家，在这条街上学会了看行情、看人脸、看自己的良心。良心 ${state.morality?.conscience}，生存 ${state.morality?.survival}——两个数字，就是你这 100 天的全部账目。\n\n${choiceName}。你做了选择，历史没有如果。\n\n1936 年，你死了。但 2026 年，他们还在。`
  await sseLLM(res, system, user, { maxTokens: 4096, tag: 'finale', fallback: local })
})

app.listen(PORT, () => {
  const mode = LLM_MODE === 'ollama' ? 'ollama' : LLM_MODE === 'local' ? 'local' : (MINIMAX_API_KEY ? 'llm+ollama+local' : 'ollama+local')
  console.log(`[五洲大药房·1936] server on :${PORT} · LLM_MODE=${LLM_MODE} (${mode})`)
})
