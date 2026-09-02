// app/src/rules/failures.js
// 玩家失败路径 —— 解决"玩家不会死"问题
// 关键设计：
//  1. 加 hp 字段（默认 100）
//  2. 加 money 字段（默认 50 大洋）
//  3. 4 种失败路径：
//     a. 青帮打（拒绝交保护费）→ HP -30
//     b. 破产（连续 5 天没钱进货）→ game over
//     c. 巡捕抓（被发现在为地下党做事）→ HP -50 + 终章
//     d. 良心破产（conscience<10 时 NPC 全离开）→ 终章
//  4. 失败不是直接结束，而是给玩家"警示"，让玩家感受到风险

import NPC_AGENTS from '../data/npcAgents.js'
import { BRANCHES } from '../data/branches.js'

/**
 * 检查玩家失败状态
 * @param {Object} state
 * @returns {Object} - {failed: bool, reason: string, damage: number, gameOver: bool}
 */
export function checkFailure(state) {
  const failures = []

  // a. 青帮打（拒绝交保护费）—— v9 已改为一次性惩罚（processPlayerChoice 选 c2 时 HP -30），
  //    这里不再产生每日伤害/提示（此前良心路线选 c2 后 4 天必死）
  // b. 破产（money < 5）
  if ((state.money ?? 50) < 5) {
    failures.push({ type: 'bankruptcy', damage: 0, desc: '你破产了，被房东赶出药房' })
  }

  // c. 巡捕抓（地下党路线 + 阿巡捕关系差 / suspicion 硬限）
  //    v9 修复：不再每天 -50（地下党路线 2 天必死）；"被抓"直接是结局（gameOver → xunpu 结局页）
  const dxRel = state.relations?.dixia || 0
  const xpRel = state.relations?.xunpu || 0
  if (dxRel >= 50 && xpRel < 20) {
    failures.push({ type: 'arrested', damage: 0, desc: '你被法租界巡捕抓了' })
  }

  // e. 巡捕抓（suspicion 硬限：xunpu ≥ 71 直接抓，v9 实装此前只写不读的 suspicion）
  if ((state.suspicion?.xunpu || 0) >= 71) {
    failures.push({ type: 'arrested', damage: 0, desc: '巡捕房盯上你了，直接拿人' })
  }

  // d. 良心破产（conscience<10）
  if ((state.morality?.conscience || 50) < 10) {
    failures.push({ type: 'conscience_collapse', damage: 0, desc: '你失去了所有朋友的信任' })
  }

  // 计算总伤害
  const totalDamage = failures.reduce((s, f) => s + f.damage, 0)
  const newHp = Math.max(0, (state.hp || 100) - totalDamage)
  const gameOver = newHp <= 0 || failures.some((f) => ['bankruptcy', 'arrested', 'conscience_collapse'].includes(f.type))

  return {
    failed: failures.length > 0,
    failures,
    totalDamage,
    hp: newHp,
    gameOver,
    reason: failures[0]?.desc || null,
  }
}

/**
 * 应用失败状态
 * @param {Object} state
 * @returns {Object} - 更新后的 state
 */
export function applyFailure(state) {
  const result = checkFailure(state)
  return {
    ...state,
    hp: result.hp,
    failed: result.failed,
    failureReason: result.reason,
    gameOver: result.gameOver,
    lastDamage: result.totalDamage,
  }
}

/**
 * 失败后给玩家提示
 * @param {Object} state
 * @param {string} language 'zh' | 'en'
 * @returns {string} - 提示文本
 */
export function getFailureHint(state, language = 'zh') {
  const result = checkFailure(state)
  if (!result.failed) return null

  const hints = {
    zh: {
      qingbang_attack: '【警告】青帮来砸你的店了！HP -30。考虑交保护费或者去法租界避一避。',
      bankruptcy: '【破产】你没钱进货了。去找王婆借点，或者卖掉一些库存。',
      arrested: '【被捕】法租界巡捕在盯着你了。如果继续跟地下党来往，可能会被关进巡捕房。',
      conscience_collapse: '【孤立】项松茂、方液仙、巴金都不愿意再跟你来往了。',
    },
    en: {
      qingbang_attack: '[Warning] Qingbang smashed your shop! HP -30',
      bankruptcy: '[Bankrupt] You have no money to stock. Borrow from Wang Po.',
      arrested: '[Arrested] French Concession police are watching you.',
      conscience_collapse: '[Isolated] No one wants to talk to you anymore.',
    },
  }

  return hints[language]?.[result.failures[0]?.type] || hints.zh.qingbang_attack
}

/**
 * HP 状态文字
 */
export function getHpStatus(hp) {
  if (hp >= 80) return { color: 'green', label: '健康' }
  if (hp >= 50) return { color: 'yellow', label: '受伤' }
  if (hp >= 20) return { color: 'orange', label: '危险' }
  if (hp > 0) return { color: 'red', label: '垂危' }
  return { color: 'gray', label: '死亡' }
}

/**
 * 完整失败模拟：100 天里各种失败路径的概率
 */
export function simulateFailures(state, dayByDayActions) {
  const log = []
  let curState = { ...state, hp: 100, money: 50 }
  for (const action of dayByDayActions) {
    curState = { ...curState, day: action.day }
    // 模拟玩家行为对 state 的影响
    if (action.moneyDelta) curState.money = Math.max(0, (curState.money || 50) + action.moneyDelta)
    if (action.conscienceDelta) curState.morality = { ...curState.morality, conscience: Math.max(0, Math.min(100, (curState.morality?.conscience || 50) + action.conscienceDelta)) }
    if (action.relations) {
      curState.relations = { ...(curState.relations || {}) }
      for (const [k, v] of Object.entries(action.relations)) {
        curState.relations[k] = Math.max(0, Math.min(100, (curState.relations[k] || 50) + v))
      }
    }
    if (action.choice) {
      // 模拟 makeChoice
      const choiceBranch = Object.entries(BRANCHES).find(([_, b]) => b.trigger.choices?.some((c) => c.id === action.choice))?.[0]
      if (choiceBranch) {
        curState.branchChoices = [...(curState.branchChoices || []), { choiceId: action.choice, branch: choiceBranch, day: action.day }]
      }
    }

    const result = checkFailure(curState)
    if (result.failed) {
      log.push({ day: action.day, type: result.failures[0].type, desc: result.failures[0].desc, hp: result.hp, gameOver: result.gameOver })
      if (result.gameOver) break
    }
  }
  return log
}
