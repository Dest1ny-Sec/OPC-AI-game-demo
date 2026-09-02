// app/src/engine/metaAI.js
// 调度 AI（Meta-AI）—— 全局 NPC 行为调度器
// 职责：
//   1. 每天结束（commitEndOfDay）调一次
//   2. 收集 9 个 NPC 的 portrait 因子 + 今日对话统计
//   3. 判定"用户瞎玩"指标
//   4. 决定是否触发疯人院结局 / 自动故事线推进

/**
 * 瞎玩检测阈值（可调，越严格越容易触发）
 * - OOC_DAILY_THRESHOLD: 单日 OOC 比例 > 50% 算瞎玩
 * - OOC_CONSECUTIVE_DAYS: 连续 N 天 OOC 触发疯人院
 * - ALL_NPC_TRUST_LOW: 所有 NPC trust < 20 触发
 * - NO_STORY_PROGRESS: 连续 N 天 0 story node 触发
 */
export const META_AI_THRESHOLDS = {
  OOC_DAILY_RATIO: 0.8,           // 80%
  OOC_CONSECUTIVE_DAYS: 3,        // 连续 3 天
  ALL_NPC_TRUST_LOW: 20,          // trust < 20
  ALL_NPC_TRUST_LOW_DAYS: 3,
  NO_STORY_PROGRESS_DAYS: 5,      // 5 天没推进故事线
  ALL_NPC_REFUSE_DAYS: 3,         // 3 天所有 NPC 都拒绝过
  TOTAL_OOC_HARD_LIMIT: 30,       // 总 OOC 次数 > 30 直接触发
}

/**
 * 收集当天的对话统计
 * @param {Object} state
 * @returns {Object} - { oocCount, totalCount, oocRatio, dayStoryCount }
 */
export function collectDailyStats(state) {
  const day = state.day
  const dayDialogues = (state.dialogues || []).filter(d => d.day === day)
  const totalCount = dayDialogues.length
  // v9 bug 修复：refused 不算 OOC（NPC 精力不足而拒绝 ≠ 玩家瞎玩）
  //   rude 保留：连续骂街仍应触发疯人院信号
  const oocCount = dayDialogues.filter(d => d.quality === 'ooc' || d.quality === 'rude').length
  const oocRatio = totalCount > 0 ? oocCount / totalCount : 0

  // 故事线节点
  const dayStoryCount = (state.storylineSeen || []).length

  return {
    day,
    totalCount,
    oocCount,
    oocRatio,
    dayStoryCount,
  }
}

/**
 * 检测"用户瞎玩"信号
 * @param {Object} state
 * @returns {Object} - { shouldAsylum: bool, reason: string, signals: [] }
 */
export function detectTrivialPlay(state) {
  const signals = []
  const T = META_AI_THRESHOLDS
  const stats = collectDailyStats(state)

  // 信号 1: 今日 OOC 占比超过阈值
  if (stats.totalCount > 0 && stats.oocRatio > T.OOC_DAILY_RATIO) {
    signals.push({
      type: 'daily_ooc_ratio',
      severity: stats.oocRatio,
      msg: `今日 OOC 占比 ${(stats.oocRatio * 100).toFixed(0)}%（${stats.oocCount}/${stats.totalCount}）`,
    })
  }

  // 信号 2: 总 OOC 次数硬限
  const totalOoc = (state.dialogues || []).filter(d => d.quality === 'ooc').length
  if (totalOoc > T.TOTAL_OOC_HARD_LIMIT) {
    signals.push({
      type: 'total_ooc_exceeded',
      severity: 1,
      msg: `总 OOC 次数 ${totalOoc} 超过硬限 ${T.TOTAL_OOC_HARD_LIMIT}`,
    })
  }

  // 信号 3: 所有 NPC trust < 阈值
  const portraits = state.npcPortrait || {}
  const npcTrusts = Object.values(portraits).map(p => p.trust || 50)
  const allLow = npcTrusts.length > 0 && npcTrusts.every(t => t < T.ALL_NPC_TRUST_LOW)
  if (allLow) {
    signals.push({
      type: 'all_npc_trust_low',
      severity: 0.9,
      msg: `所有 NPC trust < ${T.ALL_NPC_TRUST_LOW}，平均 ${(npcTrusts.reduce((a, b) => a + b, 0) / npcTrusts.length).toFixed(1)}`,
    })
  }

  // 信号 4: 所有 NPC 都拒绝过玩家
  const allRefused = Object.values(portraits).every(p => p.refusedToday)
  if (allRefused) {
    signals.push({
      type: 'all_npc_refused',
      severity: 0.7,
      msg: '所有 NPC 今天都拒绝过玩家',
    })
  }

  // 综合判定：2 个以上高 severity 信号 → 触发疯人院
  //   （v7：去掉单信号 severity>=0.95 直接触发；1 天 1 信号不够疯人院，要 2 天+）
  const shouldAsylum =
    signals.length >= 3 ||
    (signals.length >= 2 && signals.some(s => s.severity >= 0.8))

  let reason = null
  if (shouldAsylum) {
    if (signals.some(s => s.type === 'total_ooc_exceeded')) {
      reason = 'OOC_HARD_LIMIT'
    } else if (signals.length >= 3) {
      reason = 'MULTI_SIGNALS'
    } else {
      reason = 'TRUST_COLLAPSE'
    }
  }

  return {
    shouldAsylum,
    reason,
    signals,
    stats,
  }
}

/**
 * 调度 AI 主入口（每天结束调用）
 * 返回：
 *   - metaDirective: 调度指令
 *   - shouldAsylum: bool
 *   - asylumReason: string
 *   - storyHints: 自动推进提示
 */
export function runMetaAI(state) {
  const trivial = detectTrivialPlay(state)

  // 更新 asylumData
  const newAsylumData = { ...(state.asylumData || {}) }
  if (trivial.signals.some(s => s.type === 'daily_ooc_ratio')) {
    if (newAsylumData.lastDayHadOoc) {
      newAsylumData.consecutiveOocDays = (newAsylumData.consecutiveOocDays || 0) + 1
    } else {
      newAsylumData.consecutiveOocDays = 1
    }
    newAsylumData.lastDayHadOoc = true
  } else {
    newAsylumData.consecutiveOocDays = 0
    newAsylumData.lastDayHadOoc = false
  }

  if (trivial.signals.some(s => s.type === 'all_npc_trust_low')) {
    newAsylumData.allNpcTrustLowDays = (newAsylumData.allNpcTrustLowDays || 0) + 1
  } else {
    newAsylumData.allNpcTrustLowDays = 0
  }

  // 连续 OOC 触发疯人院
  if (newAsylumData.consecutiveOocDays >= META_AI_THRESHOLDS.OOC_CONSECUTIVE_DAYS) {
    return {
      metaDirective: '强制终止：连续 OOC 超过阈值',
      shouldAsylum: true,
      asylumReason: 'OOC_CONSECUTIVE',
      asylumData: newAsylumData,
      signals: trivial.signals,
    }
  }

  // 综合信号触发疯人院
  if (trivial.shouldAsylum) {
    return {
      metaDirective: '强制终止：综合信号触发',
      shouldAsylum: true,
      asylumReason: trivial.reason,
      asylumData: newAsylumData,
      signals: trivial.signals,
    }
  }

  return {
    metaDirective: '正常推进',
    shouldAsylum: false,
    asylumReason: null,
    asylumData: newAsylumData,
    signals: trivial.signals,
  }
}

/**
 * 自动故事线推进提示（meta-AI 主动给玩家推任务）
 * 当玩家 3 天没触发 story node 时，主动给提示
 */
export function getMetaAIDirective(state) {
  const storyCount = (state.storylineSeen || []).length
  const day = state.day
  const lastStorylineEvent = state.lastStorylineEvent
  const lastStorylineDay = lastStorylineEvent?.day || 0

  // 5 天没推进故事线
  if (day - lastStorylineDay > META_AI_THRESHOLDS.NO_STORY_PROGRESS_DAYS) {
    return {
      type: 'nudge',
      message: `已经 ${day - lastStorylineDay} 天没有推进任何故事线了，试试去跟其他 NPC 聊聊？`,
      severity: 'medium',
    }
  }

  // 30 天还没看任何故事
  if (day >= 30 && storyCount === 0) {
    return {
      type: 'nudge',
      message: `30 天过去了还没遇到任何故事节点，沪上风云变幻，试试去问 4 位真实人物吧。`,
      severity: 'high',
    }
  }

  return null
}
