// app/src/engine/storylineEngine.js
// 故事线自动推进引擎 —— 解决"100 天没剧情"问题
// 关键设计：
//  1. 玩家在 day % 5 == 0 时（每 5 天）自动跑"故事线检查"
//  2. 收集玩家最近 5 天的对话关键词
//  3. 自动触发 dialogue_keyword 节点
//  4. 触发后给玩家"提示"（"你听到了 X 的往事"）
//  5. intimacy 4+ 时 NPC 主动讲自己过去

import { STORYLINES, checkStorylineTrigger } from '../data/storylines.js'
import { SCENES, NPC_SCENES } from '../data/scenes.js'

/**
 * 每 5 天检查一次：自动推进故事线
 * @param {Object} state - 当前游戏 state
 * @param {Object} options
 * @param {Array} options.recentDialogues - 玩家最近 5 天的对话记录 [{npcId, text, day}]
 * @returns {Object} - {triggered: [...nodes], nextHint: "..."}
 */
export function processEndOfDayAutoStoryline(state, options = {}) {
  const day = state.day
  const triggered = []

  // 只在 day % 5 == 0 时跑（每 5 天一次）
  // 但 day 1 也跑（开场有 first_time 触发）
  if (day > 1 && day % 5 !== 0) return { triggered: [], nextHint: null, reason: 'not_auto_day' }

  // 收集玩家最近 5 天的对话文本
  // v9 修复：dialogues 记录字段是 {day,npcId,input,output,quality}，没有 text → context 全 undefined
  //   → dialogue_keyword 类节点（5 个）永远不可达。改用 d.input || d.text
  const recentDialogues = options.recentDialogues || state.recentDialogues || []
  const context = recentDialogues
    .filter((d) => d.day >= day - 5 && d.day <= day)
    .map((d) => d.input || d.text || '')
    .join(' ')

  // 对每个核心 NPC 跑 storylines 检查
  const coreNPCs = ['xiangsongmao', 'fangyexian', 'guole', 'bajin']
  for (const npcId of coreNPCs) {
    // 构造 fact 给 checkStorylineTrigger
    const fact = {
      type: 'dialogue_keyword',
      npcId,
      context,
      text: context,
      flags: [],
    }
    const node = checkStorylineTrigger(fact, state)
    if (node) {
      triggered.push({ ...node, triggeredBy: 'auto_every_5_days', npcId })
    }
  }

  // 同时检查 fact_count 节点（如果 state.behavior 有累计）
  for (const [nodeId, node] of Object.entries(STORYLINES)) {
    if (state.storylineSeen?.includes(nodeId)) continue
    if (node.trigger?.type === 'fact_count') {
      // 模拟 fact 触发
      const fact = { type: node.trigger.action === 'buy' ? 'buy' : 'sell', npcId: node.npcId, item: '131-牙膏', flags: [] }
      const m = checkStorylineTrigger(fact, state)
      if (m && m.id === nodeId) triggered.push({ ...m, triggeredBy: 'fact_count' })
    }
  }

  // 同时检查 buy 节点（如果 state.behavior 有 first_time buy）
  for (const [nodeId, node] of Object.entries(STORYLINES)) {
    if (state.storylineSeen?.includes(nodeId)) continue
    if (node.trigger?.type === 'buy' && state.behavior) {
      const buy = state.behavior.find((b) => b.day <= day && b.action === 'buy' && b.npcId === node.npcId)
      if (buy) {
        const fact = { type: 'buy', item: node.trigger.item, npcId: node.npcId, flags: node.trigger.flags || ['first_time', 'buy'] }
        const m = checkStorylineTrigger(fact, state)
        if (m && m.id === nodeId) triggered.push({ ...m, triggeredBy: 'buy_event' })
      }
    }
  }

  // 同时检查 time_at_screen 节点（玩家在某屏停留时间）
  for (const [nodeId, node] of Object.entries(STORYLINES)) {
    if (state.storylineSeen?.includes(nodeId)) continue
    if (node.trigger?.type === 'time_at_screen' && day >= 5) {
      triggered.push({ ...node, triggeredBy: 'time_at_screen' })
    }
  }

  // v9 修复：enter_screen 节点此前从未被检查（bajin_node_1 永远不可达）
  //   开场引导类节点：day 到达 day_lte 且未 seen → 自动触发（挂机保护）
  for (const [nodeId, node] of Object.entries(STORYLINES)) {
    if (state.storylineSeen?.includes(nodeId)) continue
    if (node.trigger?.type === 'enter_screen' && day <= (node.trigger.day_lte ?? 3)) {
      triggered.push({ ...node, triggeredBy: 'enter_screen' })
    }
  }

  // v9 修复：morality_change 节点（bajin_node_4）由 processPlayerChoice 即时触发，
  //   这里兜底检查（老存档/直接改 state 的路径也能触发）
  if (options.moralityDelta) {
    const d = options.moralityDelta
    if (Math.abs(d.conscience || 0) >= 15 || Math.abs(d.survival || 0) >= 15) {
      for (const [nodeId, node] of Object.entries(STORYLINES)) {
        if (state.storylineSeen?.includes(nodeId)) continue
        if (node.trigger?.type === 'morality_change') {
          triggered.push({ ...node, triggeredBy: 'morality_change' })
        }
      }
    }
  }

  // v9：多循环可能触发同一节点 → 按 id 去重（commit 时 applyStorylineUnlock 幂等）
  const unique = [...new Map(triggered.map((t) => [t.id, t])).values()]

  return {
    triggered: unique,
    nextHint: unique.length > 0 ? unique[0].title : null,
    reason: unique.length > 0 ? 'auto_push' : 'no_match',
  }
}

/**
 * intimacy 4+ 时 NPC 主动讲自己过去
 * @param {string} npcId
 * @param {Object} portrait
 * @returns {Object|null} - {title, content, prompt}
 */
export function getCharacterDepthMemory(npcId, portrait) {
  const intimacy = portrait.intimacy || 0
  if (intimacy < 4) return null

  const depths = {
    xiangsongmao: {
      title: '1932 年 1 月 28 日',
      content: '我亲自带药品到前线劳军，被日军逮捕，坚贞不屈。2 月 25 日殉难。\n\n我现在是"重生"——借这个身份继续守五洲。每一天都在为那一天赎罪。',
      prompt: '项松茂回忆 1932 年殉难的经历，含痛但坚定。要求 50-80 字，符合 56 岁硬气商人的语气。',
    },
    fangyexian: {
      title: '中国化学工业社的诞生',
      content: '1912 年，我跟项松茂一样，看不惯东洋货垄断中国。我做三星牙膏，就是要让中国人口里用中国货。\n\n三星牙膏在 1936 年已经能跟 131 牙膏抗衡了。我们两个国货派，互相尊重。',
      prompt: '方液仙讲述中化社创办故事，要求 50-80 字，符合 43 岁圆滑商人的语气。',
    },
    guole: {
      title: '永安百货的金字招牌',
      content: '1918 年我开永安百货时，南京路还是洋货的天下。\n\n我坚持"中国人自己的百货公司"，跟洋商斗了十几年。1936 年的永安，是远东第一百货。',
      prompt: '郭乐讲述永安百货创办过程，要求 50-80 字，符合 62 岁老派商人语气。',
    },
    bajin: {
      title: '1931 年写《家》',
      content: '我在武康路的书房里写《家》，写到高家三兄弟的挣扎。\n\n我自己也是从旧家庭里走出来的。1936 年我还在写《春》《秋》，但我天天在武康路弄堂里走，记下每一个普通人的故事。',
      prompt: '巴金讲述 1931 年写《家》的经历，要求 50-80 字，符合 32 岁温和文人语气。',
    },
  }

  return depths[npcId] || null
}

/**
 * 完整 5 天叙事节奏（每天会发生什么）
 * @param {number} day
 * @param {Object} state
 * @returns {Object} - {events: [...], hint: "..."}
 */
export function get5DayRhythm(day, state) {
  const events = []
  const dayInCycle = ((day - 1) % 5) + 1

  // Day 1-2：日常对话
  if (dayInCycle <= 2) {
    events.push({ type: 'daily', desc: '日常对话，与 NPC 闲聊' })
  }
  // Day 3：随机事件可能触发
  if (dayInCycle === 3) {
    events.push({ type: 'random_event_chance', desc: '随机事件可能触发' })
  }
  // Day 4：故事线检查（提前 1 天）
  if (dayInCycle === 4) {
    events.push({ type: 'storyline_check', desc: '检查故事线节点' })
  }
  // Day 5：剧情推进 + 玩家提示
  if (dayInCycle === 0 || dayInCycle === 5) {
    events.push({ type: 'storyline_push', desc: '推进故事线节点' })
    events.push({ type: 'next_hint', desc: '给出下一步提示' })
  }

  return { day, dayInCycle, events }
}

/**
 * 100 天完整模拟：每 5 天一次推进
 * @param {Object} state
 * @param {Array} dialogues 100 天的对话
 * @returns {Array} - 推进日志
 */
export function simulate100DayStoryline(state, dialogues = []) {
  const log = []
  for (let day = 1; day <= 100; day++) {
    const dayDialogues = dialogues.filter((d) => d.day === day)
    const stateAtDay = { ...state, day, recentDialogues: dialogues.filter((d) => d.day <= day) }
    const result = processEndOfDayAutoStoryline(stateAtDay, { recentDialogues: dayDialogues })
    if (result.triggered.length > 0) {
      log.push({ day, triggered: result.triggered.map((n) => n.id) })
    }
  }
  return log
}
