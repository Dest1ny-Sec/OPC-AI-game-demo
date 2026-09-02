// app/src/engine/rhythmEngine.js
// 叙事节拍器 —— 决定"明天该发生什么"
// 对话引擎响应"玩家说什么"，节拍器决定"今天/明天发生什么"

import NPC_AGENTS from '../data/npcAgents.js'
//
// 用法：
//   import { planTomorrow } from './rhythmEngine.js'
//   const tomorrow = planTomorrow(state)  // state.day + 1 的日程
//
// 详见：docs/narrative-rhythm-table-2026-09-01.md

/**
 * 4 主角循环表（每 7 天 1 个循环）
 * 索引 = (day - 1) % 28 → 主角
 *   0-6: 项/方/郭/巴/邻里/自由/gossip
 *   7-13: 方/郭/巴/项/邻里/自由/gossip
 *   14-20: 郭/巴/项/方/邻里/自由/gossip
 *   21-27: 巴/项/方/郭/邻里/自由/gossip
 */
const HERO_ROTATION = [
  'xiangsongmao', 'fangyexian', 'guole', 'bajin', 'neighbor', 'free', 'gossip',  // week 1 (day 1-7)
  'fangyexian',  'guole',       'bajin', 'xiangsongmao', 'neighbor', 'free', 'gossip',  // week 2
  'guole',       'bajin',       'xiangsongmao', 'fangyexian', 'neighbor', 'free', 'gossip',  // week 3
  'bajin',       'xiangsongmao','fangyexian', 'guole', 'neighbor', 'free', 'gossip',  // week 4
]

/** 5 邻里的轮换（每 7 天 1 个邻里冒出来） */
const NEIGHBOR_ROTATION = [
  'wangpo',      // 周一 gossip（day 5/12/19/26...）
  'xunpu',       // 周二
  'qingbang',    // 周三
  'rishang',     // 周四
  'dixia',       // 周五
]

/** dream 推送规则（按 day 计算）—— 导出给 gameEngine 的 runDream 做 gate（v9，H-3） */
export function shouldPushDream(day) {
  if (day >= 95 && day <= 99) return true  // 5 夜梦回 1937（强制）
  if (day >= 1 && day <= 20) return day % 7 === 0  // 前期：每周 1 次
  if (day >= 21 && day <= 50) return day % 5 === 0  // 中盘：每 5 天
  if (day >= 51 && day <= 94) return day % 3 === 0  // 后期：每 3 天
  return false
}

/** 4 幕视觉基调 */
function getVisualMood(day) {
  if (day <= 25) return 'warm'        // 暖黄
  if (day <= 50) return 'sunset'      // 黄昏橙
  if (day <= 75) return 'dark-red'    // 暗红
  return 'dark-cinnabar'               // 黑灰 + 朱砂
}

/** 幕标题 */
function getActTitle(day) {
  if (day <= 25) return '第一幕 · 开张'
  if (day <= 50) return '第二幕 · 试探'
  if (day <= 75) return '第三幕 · 抉择'
  return '第四幕 · 冲刺'
}

/** 周回顾（day 25/50/75 = 幕尾） */
function isActEnd(day) {
  return day === 25 || day === 50 || day === 75 || day === 100
}

/** 必触发的"挂机保护"事件（不依赖玩家行为） */
function getMandatoryEvent(state, day) {
  // day 5: 王婆上门（gossip 启动）
  if (day === 5) return { type: 'visit', npcId: 'wangpo', title: '王婆上门' }
  // day 15: 巡捕阿德警告
  if (day === 15) return { type: 'visit', npcId: 'xunpu', title: '巡捕阿德警告' }
  // day 30: 青帮保护费
  if (day === 30) return { type: 'visit', npcId: 'qingbang', title: '青帮管事收保护费' }
  // day 35: 日商试探
  if (day === 35) return { type: 'visit', npcId: 'rishang', title: '日商买办试探' }
  // day 45: 青帮再次
  if (day === 45) return { type: 'visit', npcId: 'qingbang', title: '青帮管事再访' }
  // day 50: 地下党接头（day 50+ 才解锁）
  if (day === 50) return { type: 'visit', npcId: 'dixia', title: '地下党接头' }
  return null
}

/**
 * 主入口：plan 明天
 * @param {Object} state - 当前 state（day=N 之后）
 * @returns {Object} - 明天（N+1）的 plan
 */
export function planTomorrow(state) {
  // v2 修：commit 把 day 推到 N+1，state.day 已经是"新一天"
  // plan 算的是"新一天（state.day）的剧情"，玩家看到的就是"今天还有这些事"
  const day = state.day

  // 4 主角循环
  const dayOfWeek = ((day - 1) % 7)
  const slot = HERO_ROTATION[(day - 1) % 28]
  const activeNpc = (slot === 'gossip' || slot === 'neighbor' || slot === 'free') ? null : slot

  // 邻里轮换（周一 gossip 用）
  const neighborId = NEIGHBOR_ROTATION[Math.floor((day - 1) / 7) % 5]

  // npcHint：任务栏建议（默认 activeNpc；如果是 gossip 日就推 4 主角里 intimacy 最低的）
  let npcHint = activeNpc
  if (slot === 'gossip' || slot === 'neighbor') {
    // 找 intimacy 最低的 4 主角
    const portraits = state.npcPortrait || {}
    const heroes = ['xiangsongmao', 'fangyexian', 'guole', 'bajin']
    npcHint = heroes
      .map((id) => ({ id, intimacy: portraits[id]?.intimacy || 0 }))
      .sort((a, b) => a.intimacy - b.intimacy)[0]?.id || 'xiangsongmao'
  }
  if (slot === 'free') {
    // 自由日：不推荐
    npcHint = null
  }

  // dream 推送
  const dreamPush = shouldPushDream(day)

  // 必触发事件（挂机保护）
  const mandatoryEvent = getMandatoryEvent(state, day)

  // 幕回顾
  const isActEndDay = isActEnd(day)
  const actReview = isActEndDay ? { act: getActTitle(day), review: true } : null

  // 视觉基调
  const visualMood = getVisualMood(day)
  const actTitle = getActTitle(day)

  // 4 选 1（day 100 触发）
  const finalChoice = day === 100

  return {
    day,
    activeNpc,             // 谁会主动找你
    neighborId,            // 5 邻里里谁今天冒出来
    npcHint,               // 任务栏建议
    dreamPush,             // 是否有 dream 推送
    mandatoryEvent,        // 必触发事件
    actReview,             // 幕回顾
    visualMood,            // 视觉基调
    actTitle,              // 幕标题
    finalChoice,           // 是否触发 4 选 1
    // 玩家今日任务（按 day 阶段）
    dailyTask: buildDailyTask(state, day, slot, activeNpc),
  }
}

/** 每日任务（按 day 阶段 + slot 拼） */
function buildDailyTask(state, day, slot, activeNpc) {
  // 周回顾日
  if (day === 25 || day === 50 || day === 75) {
    return { type: 'review', label: `第 ${day} 天 / 100`, action: '本周回顾' }
  }
  if (day === 100) {
    return { type: 'final', label: '清明墓前', action: '4 选 1' }
  }
  // 邻里日
  if (slot === 'gossip' || slot === 'neighbor') {
    return { type: 'gossip', label: '邻里日', action: '听邻里说说' }
  }
  // 自由日
  if (slot === 'free') {
    return { type: 'free', label: '自由日', action: '想做啥做啥' }
  }
  // NPC 主动日
  //   v8 修：用 NPC_AGENTS[id].name（中文名字）而不是 portrait?.name（无 name 字段）
  if (activeNpc) {
    return { type: 'npc', label: `${NPC_AGENTS[activeNpc]?.name || activeNpc} 主动找你`, action: '进对话' }
  }
  return { type: 'open', label: '自由探索', action: '找谁聊都行' }
}

/**
 * 给 NPC 的对话上下文（注入 system prompt）
 * 玩家跟 NPC 聊时，NPC 知道"今天是什么日子"
 */
export function getDialogueContext(state, npcId) {
  const plan = state.todayPlan
  if (!plan) return ''

  const lines = []
  // 1. 今天是第几天
  lines.push(`【第 ${state.day} 天 / 100 天】`)
  // 2. 视觉基调
  lines.push(`【当前氛围：${plan.visualMood}】`)
  // 3. 这个 NPC 今天是否被指定为主动
  if (plan.activeNpc === npcId) {
    lines.push(`【今天是你主动找玩家的日子——开场可以主动说一件事】`)
  }
  // 4. 邻里事件
  if (plan.mandatoryEvent?.npcId === npcId) {
    lines.push(`【今天你要上门拜访玩家——按事件剧情开场】`)
  }
  // 5. 幕
  lines.push(`【${plan.actTitle}】`)

  return lines.join('\n')
}
