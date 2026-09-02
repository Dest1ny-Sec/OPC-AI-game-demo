// app/src/engine/commitDay.js
// 日终处理（commitEndOfDay）+ 100 天模拟 + 玩家选择处理
// 拆分自 lib/gameEngine.js（537 行 → 多文件）

import { initialGameState } from '../state/store.js'
import { dailyDecay } from '../rules/portrait.js'
import { processEndOfDayAutoStoryline } from './storylineEngine.js'
import { applyStorylineUnlock, checkStorylineTrigger } from '../data/storylines.js'
import { checkFailure, applyFailure, getFailureHint } from '../rules/failures.js'
import { runMetaAI } from './metaAI.js'
import { applyAsylum, isAsylumTriggered, ASYLUM_ENDING } from '../rules/asylum.js'
import { runDream, processDreamExpiry } from './dream.js'
import { planTomorrow, shouldPushDream } from './rhythmEngine.js'
import { determineEnding } from '../rules/ending.js'
import { makeChoice, checkActiveBranch } from '../rules/branching.js'
import { BRANCHES } from '../data/branches.js'
import { processDialogueTurn } from './processDialogue.js'

/**
 * 玩家做出 A/B 选择
 * @param {Object} state
 * @param {string} choiceId
 * @param {string} npcId
 * @returns {Object} - {state, branchActivated, hint, storylineTriggered}
 */
export function processPlayerChoice(state, choiceId, npcId) {
  const before = { ...(state.morality || {}) }
  const result = makeChoice(state, choiceId, npcId)
  let newState = result.state
  const activeBranch = checkActiveBranch(newState)
  const branch = activeBranch ? BRANCHES[activeBranch] : null

  // v9：morality 大幅变化 → 立即触发 bajin_node_4（良心账），此前无人调用 checkStorylineTrigger 导致该节点不可达
  const delta = {
    conscience: (newState.morality?.conscience || 50) - (before.conscience || 50),
    survival: (newState.morality?.survival || 50) - (before.survival || 50),
  }
  let storylineTriggered = null
  if (Math.abs(delta.conscience) >= 15 || Math.abs(delta.survival) >= 15) {
    const node = checkStorylineTrigger({ type: 'morality_change', npcId: 'bajin', morality_delta: delta }, newState)
    if (node) {
      newState = applyStorylineUnlock(newState, node)
      storylineTriggered = node
    }
  }

  // v9 修复：c2（拒绝青帮保护费）一次性惩罚 HP -30（此前 checkFailure 每天 -30 → 良心路线必死）
  let choiceWarning = null
  if (choiceId === 'c2' && !newState.qingbangAttackDone) {
    newState = {
      ...newState,
      hp: Math.max(0, (newState.hp ?? 100) - 30),
      qingbangAttackDone: true,
    }
    choiceWarning = { type: 'qingbang_attack', desc: '青帮砸了你的店，HP -30。以后出门小心点。' }
    if (newState.hp <= 0) {
      newState = { ...newState, gameOver: true, ended: { type: 'gameover', reason: 'qingbang_attack' } }
    }
  }

  return {
    state: newState,
    branchActivated: activeBranch,
    branchName: branch?.title,
    branchDesc: branch?.desc,
    effects: branch?.effects,
    hiddenScene: branch?.effects?.hiddenScene,
    storylineTriggered,
    choiceWarning,
  }
}

/**
 * 一天结束（日终处理）
 * - dailyDecay 所有 NPC portrait
 * - 故事线自动推进（每 5 天）
 * - 失败检查
 * - 调度 AI（meta-AI）检测瞎玩 → 疯人院
 * - 推进到下一天
 * @param {Object} state
 * @returns {Object} - {state, storyEvents, failure, ending, asylum, metaDirective}
 */
export function commitEndOfDay(state) {
  // 0. 疯人院已触发 → 不再推进
  if (isAsylumTriggered(state)) {
    return {
      state,
      storyEvents: [],
      nextHint: null,
      failure: { failed: false },
      ending: ASYLUM_ENDING,
      asylum: true,
      metaDirective: '已疯人院，锁死',
    }
  }

  // 1. 每日 portrait 衰减
  const newNpcPortrait = { ...state.npcPortrait }
  for (const npcId of Object.keys(newNpcPortrait)) {
    newNpcPortrait[npcId] = dailyDecay(newNpcPortrait[npcId])
  }

  // 1b. Dream 过期处理（先于 day 推进）
  //     d.expiresAtDay < newState.day 的 dream = 过期 → 因子惩罚
  const willBeNewDay = state.day + 1
  const dreamExpired = processDreamExpiry({ ...state, npcPortrait: newNpcPortrait }, willBeNewDay)
  const mergedPortrait = { ...newNpcPortrait, ...dreamExpired.state.npcPortrait }

  let newState = {
    ...state,
    npcPortrait: mergedPortrait,
    day: willBeNewDay,
    dialoguesToday: 0,
    oocToday: 0,
    dreamQueue: dreamExpired.state.dreamQueue,
  }

  // 2. 故事线自动推进（每 5 天）
  const storyResult = processEndOfDayAutoStoryline(newState, { recentDialogues: newState.dialogues || [] })
  if (storyResult.triggered.length > 0) {
    // v9 修复：触发后必须应用 applyStorylineUnlock（relationBonus / fragment / storylineSeen）
    //   此前只 push storylineSeen，unlocks 全部丢失
    for (const t of storyResult.triggered) {
      newState = applyStorylineUnlock(newState, t)
    }
    newState = { ...newState, lastStorylineEvent: { ...storyResult.triggered[0], day: newState.day - 1 } }
  }

  // 3. 失败检查
  newState = applyFailure(newState)
  const failureInfo = checkFailure(newState)
  const failureHint = failureInfo.failed ? getFailureHint(newState) : null

  // P0-7 修复：money/hp 字段在 initialGameState 已加默认值（100/50），
  //   applyFailure 也会更新 hp，但需要确保 commit 之前 hp/money 存在
  if (typeof newState.hp !== 'number') newState.hp = 100
  if (typeof newState.money !== 'number') newState.money = 50

  // 4. meta-AI 调度（v2 新增）—— 检测瞎玩，触发疯人院
  // 关键：用 commit 之前的 day（即 state.day），而不是已 +1 的 newState.day
  const metaResult = runMetaAI({ ...newState, day: state.day })
  newState = { ...newState, asylumData: metaResult.asylumData }

  // P0-7: hp<=0 直接 gameOver
  if (newState.hp <= 0) {
    newState = { ...newState, gameOver: true, ended: { type: 'gameover', reason: 'hp_zero' } }
  }
  // v9 修复：bankruptcy / arrested / conscience_collapse 触发 gameOver 但 ended 未设
  //   → UI 层永远收不到结束信号（D-5）
  //   reason 必须存 failure **type**（'arrested' 等），存中文 desc 会导致 UI 结局映射失败
  if (newState.gameOver && !newState.ended) {
    newState = { ...newState, ended: { type: 'gameover', reason: failureInfo.failures?.[0]?.type || failureInfo.reason || 'game_over', day: newState.day } }
  }

  if (metaResult.shouldAsylum) {
    const asylumResult = applyAsylum(newState, metaResult.asylumReason)
    return {
      state: asylumResult.state,
      storyEvents: storyResult.triggered,
      nextHint: storyResult.nextHint,
      failure: failureInfo,
      failureHint,
      ending: asylumResult.ending,
      asylum: true,
      asylumReason: metaResult.asylumReason,
      metaDirective: metaResult.metaDirective,
      signals: metaResult.signals,
    }
  }

  // 5. 检查结局（如果到 day 100 或 game over）
  let ending = null
  if (newState.gameOver || newState.day > 100) {
    ending = determineEnding(newState)
  }

  // P0-B7 修复：100 天挂机 ended=null
  //   玩家在 day 100 commit 之前还可选 4 选 1；超过 day 100 强制进结局
  //   v8: 玩家有 branchChoices → 走 determineEnding 拿真正结局；没做选择才 torch 兜底
  if (newState.day > 100 && !newState.ended) {
    if ((newState.branchChoices || []).length > 0) {
      const e = determineEnding(newState)
      newState = { ...newState, ended: { choiceId: 'auto', endingType: e?.type || 'pingfan', letter: e?.text || null } }
    } else {
      newState = { ...newState, ended: { choiceId: 'forced', endingType: 'pingfan', letter: null } }
    }
  }

  // 6. Dream 静默推送 —— 在 commit 末尾生成"明天 NPC 主动找你"事件
  //    expiresAtDay = newState.day + 1（玩家有明天 1 天缓冲）
  //    v9 修复：gate 到 shouldPushDream（节拍器计划），此前 runDream 有自己的节奏、
  //    todayPlan.dreamPush 只是装饰 → 计划与队列经常不一致（H-3）
  const newDream = shouldPushDream(newState.day) ? runDream(newState, { expiresAtDay: newState.day + 1 }) : null
  if (newDream) {
    newState = {
      ...newState,
      dreamQueue: [...(newState.dreamQueue || []), newDream],
      // 写 dreamHistory：让全局冷却（nextDay - lastAnyDream.day < 2）生效
      dreamHistory: [
        ...(newState.dreamHistory || []),
        { npcId: newDream.npcId, day: newState.day, generated: true, responded: false },
      ],
    }
  }

  // 7. 叙事节拍器（v4）—— plan 明天
  //    在 commit 末尾调用，决定明天该发生什么
  //    这是"100 天挂机有故事弧"的关键
  const tomorrowPlan = planTomorrow(newState)
  newState = { ...newState, todayPlan: tomorrowPlan }

  return {
    state: newState,
    storyEvents: storyResult.triggered,
    nextHint: storyResult.nextHint,
    failure: failureInfo,
    failureHint,
    ending,
    asylum: false,
    metaDirective: metaResult.metaDirective,
    metaSignals: metaResult.signals,
    gameOver: newState.gameOver,
    dream: newDream,
    dreamExpired: dreamExpired.expired,
    dreamPunished: dreamExpired.punished,
  }
}

/**
 * 完整 100 天模拟
 * @param {Object} initialState - 初始 state（可选，默认 initialGameState）
 * @param {Array} dayByDayActions - [{day, npcId, input, choiceId?}]
 * @returns {Object} - {finalState, log}
 */
export function simulate100DayFull(initialState, dayByDayActions = []) {
  let state = initialState || initialGameState()
  const log = []

  for (const action of dayByDayActions) {
    if (action.day > 100) break

    // 跳到那一天（处理中间天数）—— commit 是把 day N 推 day N+1
    // v9 off-by-one 修复：此前 `state.day < action.day - 1`，对话实际发生在 action.day-1 天
    while (state.day < action.day) {
      const result = commitEndOfDay(state)
      state = result.state
      if (result.storyEvents.length > 0) {
        log.push({ day: state.day - 1, type: 'story', events: result.storyEvents.map((e) => e.id) })
      }
      if (result.failure.failed) {
        log.push({ day: state.day - 1, type: 'failure', desc: result.failure.reason, hp: result.failure.hp })
      }
      if (result.ending || result.gameOver) {
        log.push({ day: state.day, type: result.ending ? 'ending' : 'gameover', ending: result.ending, reason: result.failure?.reason })
        return { finalState: state, log }
      }
    }

    // 玩家跟 NPC 对话（day = action.day）
    if (action.npcId && action.input) {
      const turn = processDialogueTurn(state, action.npcId, action.input)
      state = turn.state
    }

    // 玩家做出选择
    if (action.choiceId) {
      const choice = processPlayerChoice(state, action.choiceId, action.npcId)
      state = choice.state
      if (choice.branchActivated) {
        log.push({ day: state.day, type: 'branch', branch: choice.branchName, desc: choice.branchDesc })
      }
    }

    // day 末尾 commit（推 day N → N+1）
    const result = commitEndOfDay(state)
    state = result.state
    if (result.storyEvents.length > 0) {
      log.push({ day: state.day - 1, type: 'story', events: result.storyEvents.map((e) => e.id) })
    }
    if (result.failure.failed) {
      log.push({ day: state.day - 1, type: 'failure', desc: result.failure.reason, hp: result.failure.hp })
    }
    if (result.ending) {
      log.push({ day: state.day, type: 'ending', ending: result.ending })
      return { finalState: state, log }
    }
    if (result.gameOver) {
      log.push({ day: state.day, type: 'gameover', reason: result.failure.reason })
      return { finalState: state, log }
    }
  }

  // 跑完剩余天数
  while (state.day <= 100) {
    const result = commitEndOfDay(state)
    state = result.state
    if (result.storyEvents.length > 0) {
      log.push({ day: state.day - 1, type: 'story', events: result.storyEvents.map((e) => e.id) })
    }
    if (result.failure.failed) {
      log.push({ day: state.day - 1, type: 'failure', desc: result.failure.reason, hp: result.failure.hp })
    }
    if (result.ending) {
      log.push({ day: state.day, type: 'ending', ending: result.ending })
      break
    }
    if (result.gameOver) {
      log.push({ day: state.day, type: 'gameover', reason: result.failure.reason })
      break
    }
  }

  return { finalState: state, log }
}
