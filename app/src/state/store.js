// app/src/state/store.js
// 游戏状态层 —— 持久化 + 日期工具 + 初始状态
// 拆分自 lib/store.js（217 行 → state/store.js）
//
// 外部 import 路径不变（仍 from '../lib/store.js'），这里只 re-export
// 内部代码现在直接 import from '../state/store.js'

import { initNpcPortrait } from '../rules/portrait.js'
import { planTomorrow } from '../engine/rhythmEngine.js'
import { INIT_RELATIONS } from '../data/scenes.js'

// v2 存档隔离：单存档 key + 会话 ID 隔离
export const K = 'city_whispers_save_v2'
export const SESSION_K = 'city_whispers_session_id'
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v))

/**
 * 1936 年日期换算（day → 1936.x.x）
 * 游戏第 1 天 = 1936.1.1
 * 100 天 = 1936.4.9（清明节后 3 天）
 */
const START_DATE = new Date(1936, 0, 1) // 1936-01-01
export function getInGameDate(day) {
  const d = new Date(START_DATE)
  d.setDate(d.getDate() + (day - 1))
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** 清明节（1936.4.4）距游戏第 1 天 = day 95 */
export const QINGMING_DAY = 95

/** 计算距清明 X 天 */
export function getDaysToQingming(day) {
  return Math.max(0, QINGMING_DAY - day)
}

/**
 * 叙事引擎状态结构
 * - day: 当前天数（1-100）
 * - volume: 当前卷（1-4）
 * - morality: 良心/生存 双轴
 * - relations: NPC 好感度
 * - npcMemory: 玩家与各NPC的对话记忆
 * - npcPortrait: NPC 人物侧写（含 mood→立绘、refusedToday、interactionsToday）
 * - fragments: 已收集的时代碎片
 * - storylineSeen: 已触发的故事线节点
 * - randomEventsSeen: 已触发的随机事件
 * - scene: 当前场景
 * - dialoguesToday: 今日对话总次数
 * - oocToday: 今日 OOC 次数
 * - sessions: 会话计数（每次 newGame +1）
 * - asylumData: 疯人院检测（连续 OOC 计数 / 所有 NPC trust 统计）
 * - endingsUnlocked: 已解锁的结局
 * - ended: 游戏结束状态（含 asylum 疯人院）
 */
export const initialGameState = () => {
  const base = {
  day: 1,
  volume: 1,
  morality: { conscience: 55, survival: 45 },
  relations: { ...INIT_RELATIONS },
  npcMemory: {},            // { npcId: [memoryString, ...] }  ← 重开游戏必清空
  npcPortrait: initNpcPortrait(),  // ← 重开游戏必清空
  fragments: [],            // [fragmentId]
  storylineSeen: [],        // [storyNodeId]
  randomEventsSeen: [],     // [eventId]
  behavior: [],             // [行为记录 {day, npcId, action, item?, flags?}] —— 故事线 fact_count/buy/bargain 触发器依赖（v9：此前无任何写入，节点全死）
  scene: 'pharmacy',
  dialoguesToday: 0,        // 今日对话总次数（仅用于统计）
  oocToday: 0,              // 今日 OOC 触发次数
  // 删 maxDialoguesPerDay：每个 NPC 单独算（patience/energy/interactionsToday）
  // 不再用全局 4 次上限
  // ===== v2.2: 资源系统（HP/Money） =====
  hp: 100,                  // 玩家生命值；≤0 → game over（破产/被打死/被抓）
  money: 50,                // 玩家持有大洋（进货/送礼/贿赂都要钱）
  inventory: {},            // {itemId: count} 玩家持有的物品
  asylumData: {
    consecutiveOocDays: 0,  // 连续 OOC 超过 50% 的天数
    lastDayHadOoc: false,   // 昨天是否 OOC > 50%
    allNpcTrustLowDays: 0,  // 所有 NPC trust < 20 的连续天数
  },
  // ===== v2.1: Dream 静默推送 =====
  dreamQueue: [],           // 待处理的 dream 事件（明天进入游戏时显示）
  dreamHistory: [],         // 历史 dream 记录（含 responded / ignored）
  // ===== v4: 叙事节拍器（rhythmEngine 写入）=====
  todayPlan: null,          // 明天日程：{ day, activeNpc, npcHint, dreamPush, mandatoryEvent, actReview, visualMood, actTitle, finalChoice, dailyTask }
  // ===== v3: 怀疑度系统（双轨关系）=====
  suspicion: {
    xiangsongmao: 0,        // 项松茂怀疑度（增长慢，-10 礼物）
    fangyexian: 0,          // 方液仙
    guole: 0,               // 郭乐
    bajin: 0,               // 巴金（最慢 +3，降低最快 -15）
    wangpo: 0,              // 王婆（嘴碎 +12，但 -15）
    xunpu: 0,               // 巡捕阿德（最危险 +20，≥71 直接抓）
    qingbang: 0,            // 青帮
    rishang: 0,             // 日商
    dixia: 0,               // 地下党（最慢 +2，最快 -20）
  },
  endingsUnlocked: [],
  ended: null,              // { choiceId | 'asylum', endingType, letter }
  startedAt: Date.now(),
  sessionId: getSessionId(),
  settings: {
    lang: 'zh',
    difficulty: 'normal',
    audio: true,
    skipIntro: false,
  },
  }
  // v4: 立即给 day 1 生成 todayPlan（这样首屏就能显示"今天可做 (n)"）
  const todayPlan = planTomorrow(base)
  return { ...base, todayPlan }
}

/** 每次新游戏（新会话）都换 sessionId，让 NPC 上下文不串 */
function getSessionId() {
  let sid = localStorage.getItem(SESSION_K)
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem(SESSION_K, sid)
  }
  return sid
}

export const saveGame = (state) => set(K, state)
export const loadGame = () => {
  const saved = get(K, null)
  if (!saved) return initialGameState()
  const defaults = initialGameState()
  // 关键修复：如果存档 sessionId 不等于当前 sessionId，说明跨会话 → 重置
  const currentSid = getSessionId()
  if (saved.sessionId && saved.sessionId !== currentSid) {
    // 跨会话：清掉 NPC 上下文（npcMemory + npcPortrait），**保留 day 进度**
    // （P0-9 修复：之前 Math.min(saved.day || 1, defaults.day + 0) = Math.min(any, 1) = 1，跨 session 永远 day 1）
    // v9：若旧会话已结束（ended）或 day 已超出 100 → 全新开始（M-6）
    const day = (!saved.ended && saved.day && saved.day >= 1 && saved.day <= 100) ? saved.day : 1
    const reset = {
      ...defaults,
      day,
      fragments: [],           // 重置收集
      storylineSeen: [],       // 重置故事线
      sessionId: currentSid,
      asylumData: { consecutiveOocDays: 0, lastDayHadOoc: false, allNpcTrustLowDays: 0 },
    }
    // 重新 plan 当前 day
    return { ...reset, todayPlan: planTomorrow(reset) }
  }
  const merged = {
    ...defaults,
    ...saved,
    npcPortrait: { ...defaults.npcPortrait, ...(saved.npcPortrait || {}) },
    asylumData: { ...defaults.asylumData, ...(saved.asylumData || {}) },
    suspicion: { ...defaults.suspicion, ...(saved.suspicion || {}) },
  }
  // v4: 若存档没 todayPlan，生成一个（兼容老存档）
  if (!merged.todayPlan) {
    merged.todayPlan = planTomorrow(merged)
  }
  return merged
}
export const hasSave = () => localStorage.getItem(K) !== null

/**
 * 清存档：清掉所有数据 + 重置 sessionId
 * 下次 newGame 会得到完全空白的 NPC 上下文
 */
export const clearSave = () => {
  localStorage.removeItem(K)
  localStorage.removeItem(SESSION_K)  // 关键：让 NPC 上下文彻底不串
}

/** 事务式更新：commit(fn) 深合并 */
export function commit(state, fn) {
  let next
  try { next = fn(structuredClone(state)) }
  catch { next = fn(JSON.parse(JSON.stringify(state))) }
  saveGame(next)
  return next
}
