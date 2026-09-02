// app/src/rules/branching.js
// 纯函数业务规则：玩家选择 → 分支激活 + 进度跟踪
// 拆分自 lib/branching.js（320 行 → 多文件）
//
// 关键设计：
//  1. NPC 关键对话时给玩家 A/B 选择
//  2. 玩家选了 A/B 后，剧情真的朝不同方向发展
//  3. choice 存到 state.lastChoice，影响后续 NPC 行为 + 结局判定
//  4. 不要"看 relations >= 80" 死板判定，要看"玩家做了哪些选择"

import { BRANCHES, CHOICE_TO_ENDING } from '../data/branches.js'

/**
 * 玩家做出选择
 * @param {Object} state
 * @param {string} choiceId
 * @param {string} npcId
 * @returns {Object} - {state, branch, endingId?}
 *   branch: string | {id, endingId}
 *   endingId: 仅终章 4 选 1 场景设置
 */
export function makeChoice(state, choiceId, npcId) {
  // P0-A10 修复：终章 4 选 1 → 直接锁结局
  if (typeof choiceId === 'number' && CHOICE_TO_ENDING[choiceId] !== undefined) {
    const endingId = CHOICE_TO_ENDING[choiceId]
    const newState = {
      ...state,
      lastChoice: { choiceId, npcId: npcId || null, branch: null, day: state.day, endingId },
      ended: {
        choiceId: String(choiceId),
        endingType: endingId,
        letter: null,
        day: state.day,
        timestamp: Date.now(),
      },
    }
    return { state: newState, branch: { id: 'final', endingId }, endingId }
  }

  // 找到这个 choice 属于哪个分支
  let activatedBranch = null
  for (const [branchId, branch] of Object.entries(BRANCHES)) {
    if (branch.trigger.choices?.some((c) => c.id === choiceId)) {
      activatedBranch = branchId
      break
    }
  }

  if (!activatedBranch) {
    return { state: { ...state, lastChoice: { choiceId, npcId, branch: null, day: state.day } }, branch: null }
  }

  // 累积选择
  const choices = [...(state.branchChoices || []), { choiceId, npcId, branch: activatedBranch, day: state.day }]

  // 计算每个分支的进度
  const branchProgress = {}
  for (const [branchId, branch] of Object.entries(BRANCHES)) {
    const made = choices.filter((c) => c.branch === branchId).length
    branchProgress[branchId] = {
      made,
      required: branch.trigger.minChoices || 1,
      activated: made >= (branch.trigger.minChoices || 1),
    }
  }

  // 应用 branch 的 effects —— v9 修复：仅该分支**首次**被选择时全量应用一次
  //   （此前每次选择都叠加，q1+q2 会把 conscience -60，数值失控 H-12）
  const branch = BRANCHES[activatedBranch]
  const firstForBranch = !(state.branchChoices || []).some((c) => c.branch === activatedBranch)
  let newState = { ...state, branchChoices: choices, branchProgress }

  if (firstForBranch && branch.effects.morality) {
    newState.morality = {
      conscience: Math.max(0, Math.min(100, (newState.morality?.conscience || 50) + branch.effects.morality.conscience)),
      survival: Math.max(0, Math.min(100, (newState.morality?.survival || 50) + branch.effects.morality.survival)),
    }
  }
  if (firstForBranch && branch.effects.relations) {
    newState.relations = { ...(newState.relations || {}) }
    for (const [npcId, delta] of Object.entries(branch.effects.relations)) {
      newState.relations[npcId] = Math.max(0, Math.min(100, (newState.relations[npcId] || 50) + delta))
    }
  }
  if (firstForBranch && typeof branch.effects.money === 'number') {
    newState.money = Math.max(0, (newState.money ?? 50) + branch.effects.money)
  }

  // v9：选择也写入 behavior（c1 卖国货 → buy 131；r2/s2 卖日货 → sell_japanese），
  //   让选择驱动的故事线节点（xiang_node_1/2、xiang_node_5 翻脸）可触发
  const choiceBehaviors = [{ action: 'dialogue', npcId }]
  if (choiceId === 'c1') choiceBehaviors.push({ action: 'buy', item: '131-牙膏', flags: ['buy'] })
  if (choiceId === 'r2' || choiceId === 's2') choiceBehaviors.push({ action: 'sell_japanese', item: '仁丹', flags: ['sell'] })
  const newBehavior = [...(newState.behavior || [])]
  for (const b of choiceBehaviors) newBehavior.push({ day: state.day, npcId, ...b })
  if (newBehavior.length > 400) newBehavior.splice(0, newBehavior.length - 400)
  newState = { ...newState, behavior: newBehavior }

  newState.lastChoice = { choiceId, npcId, branch: activatedBranch, day: state.day }

  return { state: newState, branch: activatedBranch }
}

/**
 * 检查当前激活的分支
 * @param {Object} state
 * @returns {string|null} - 分支 id
 */
export function checkActiveBranch(state) {
  if (!state.branchProgress) return null
  for (const [branchId, progress] of Object.entries(state.branchProgress)) {
    if (progress.activated) {
      // 检查 exclusion
      const branch = BRANCHES[branchId]
      if (branch.trigger.excludeBranches) {
        const excluded = branch.trigger.excludeBranches.some((exId) => state.branchProgress[exId]?.activated)
        if (excluded) continue
      }
      return branchId
    }
  }
  return null
}

/**
 * 触发 NPC A/B 选择
 * 当玩家在特定剧情节点时，NPC 会给出选择
 * @param {string} npcId
 * @param {string} context - 剧情上下文
 * @param {Object} state
 * @returns {Array} - [{choiceId, text, desc}]
 */
export function getAvailableChoices(npcId, context, state) {
  const choices = []
  for (const branch of Object.values(BRANCHES)) {
    for (const choice of branch.trigger.choices || []) {
      if (choice.npcId === npcId) {
        // 不重复给已经做过的选择
        const already = (state.branchChoices || []).some((c) => c.choiceId === choice.id)
        if (!already) {
          choices.push({
            choiceId: choice.id,
            branch: branch.id,
            text: choice.text,
            desc: choice.context,
            branchTitle: branch.title,
          })
        }
      }
    }
  }
  return choices
}
