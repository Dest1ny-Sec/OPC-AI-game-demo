// app/src/engine/processDialogue.js
// 单次对话处理：player input → 拒答判定 / portrait 影响 / 行为语义 / 故事线触发
// 拆分自 lib/gameEngine.js（537 行 → 多文件）

import {
  initNpcPortrait, applyImpact, assessDialogueQuality, qualityToEventKey,
  inferMood, moodToPortraitUrl,
} from '../rules/portrait.js'
import { canNpcTalk, recordInteraction, markRefusedToday } from '../rules/refuse.js'
import { respondToDream } from './dream.js'
import { getAvailableChoices } from '../rules/branching.js'
import { npcRefuseReply } from '../services/dialogueService.js'
import { isAsylumTriggered } from '../rules/asylum.js'
import { getCharacterDepthMemory } from './storylineEngine.js'

/**
 * v9：从玩家输入提取"行为语义"写入 state.behavior
 * 修复：behavior 此前从未被任何代码写入 → fact_count/buy/bargain/cross_npc 类故事线节点永远不可达
 * 规则：对话中提及对应主题即视为一次行为（轻量版买卖系统，不设独立商店）
 */
const BEHAVIOR_KEYWORDS = {
  xiangsongmao: { buy: [/131|牙膏|国货|进货/i], item: '131-牙膏' },
  fangyexian:   { buy: [/三星|牙膏/i], item: '三星牙膏' },
  guole:        { bargain: [/货架|进货|永安|价格|讨价|上架|柜台|供货/i] },
  rishang:      { sell: [/日货|仁丹|万金油|合作|代理|东洋货/i], item: '仁丹' },
  qingbang:     { deal: [/保护费|青帮|交钱|送货|帮会|堂口/i] },
}
function extractBehavior(npcId, input, state) {
  const rules = BEHAVIOR_KEYWORDS[npcId]
  if (!rules) return []
  const behaviors = []
  const rel = state.relations?.[npcId] ?? 50
  if (rules.buy && rules.buy.some((r) => r.test(input))) {
    const already = (state.behavior || []).some((b) => b.action === 'buy' && b.npcId === npcId && b.item === rules.item)
    behaviors.push({ action: 'buy', item: rules.item, flags: already ? ['buy'] : ['first_time', 'buy'] })
  }
  if (rules.bargain && rules.bargain.some((r) => r.test(input))) {
    // 关系好 → bargain_success（fangyexian_node_4 需要 discount>=0.30）；关系差 → bargain_fail（guole_node_4 累计 3 次）
    behaviors.push({ action: rel >= 60 ? 'bargain_success' : 'bargain_fail', discount: rel >= 60 ? 0.35 : 0 })
  }
  if (rules.sell && rules.sell.some((r) => r.test(input))) {
    behaviors.push({ action: 'sell_japanese', item: rules.item, flags: ['sell'] })
  }
  return behaviors
}

/**
 * 玩家跟 NPC 对话后处理所有影响
 * @param {Object} state - 当前 state
 * @param {string} npcId
 * @param {string} input - 玩家输入
 * @param {Object} opts
 * @param {string} opts.sceneName
 * @param {Object} opts.npcReply - LLM 回复 {text, mode, ...}
 * @returns {Object} - {state, newPortrait, mood, storyHints, characterDepth, choices, refused: bool, refusalReason, refusalReply}
 */
export function processDialogueTurn(state, npcId, input, opts = {}) {
  // 0. 疯人院结局已触发 → 完全锁死
  if (isAsylumTriggered(state)) {
    return {
      state,
      refused: true,
      refusalReason: 'asylum_locked',
      refusalReply: '你已被送入虹口疯人院，1936 的故事不再继续。',
      mood: null,
    }
  }

  // 0.5 NPC 自适应拒绝检查（v2 新增）
  const npcPortrait = state.npcPortrait?.[npcId] || initNpcPortrait()[npcId]
  const npc = { id: npcId, name: opts.npcName || npcId }
  const talkCheck = canNpcTalk(npcPortrait, npc, { lastInputOoc: opts.lastInputOoc })

  if (!talkCheck.canTalk) {
    // NPC 拒绝：标记 refusedToday + 仍记录一次对话（但不调 LLM）
    // v2.1: refusalReply 立即给 canNpcTalk 里写好的中文模板（避免 LLM 异步卡死）
    //   - 玩家骂 sb 后立刻看到「别过脸去不愿与你说话」，不依赖 LLM 流式
    //   - npcRefuseReply 仍可作为"丰富版"追加调用，但基础文案已足够
    const refusedPortrait = markRefusedToday(recordInteraction(npcPortrait, state.day))
    // 拒答时如果 portrait 还没到愤怒，强制一下（视觉一致）
    if (talkCheck.mood === '愤怒' && refusedPortrait.mood !== '愤怒') {
      refusedPortrait.mood = '愤怒'
    }
    const newState = {
      ...state,
      npcPortrait: { ...(state.npcPortrait || {}), [npcId]: refusedPortrait },
      dialogues: [
        ...(state.dialogues || []),
        { day: state.day, npcId, input, text: input, output: '', quality: 'refused' },
      ],
    }
    return {
      state: newState,
      refused: true,
      refusalReason: talkCheck.reason,
      refusalReply: talkCheck.reply,   // ← 立即可用（不调 LLM）
      refusalMood: talkCheck.mood,     // ← 立绘立刻切
      mood: talkCheck.mood,
    }
  }

  // 1. 评估对话质量 → 更新 portrait
  const quality = assessDialogueQuality(input, null)
  const eventKey = qualityToEventKey(quality)
  let newPortrait = applyImpact(npcPortrait, eventKey, npcId)
  // v2: rude/awkward 命中时直接强制 mood（绕过 inferMood 阈值，让用户立刻"看到变脸"）
  if (quality === 'rude') {
    newPortrait.mood = '愤怒'
  } else if (quality === 'awkward') {
    newPortrait.mood = '烦躁'
  } else {
    newPortrait.mood = inferMood(newPortrait)
  }
  // v2: 记录今日互动 + 累加 totalInteractions
  newPortrait = recordInteraction(newPortrait, state.day)
  newPortrait.lastVisitDay = state.day

  // 2. 累积到 npcMemory
  const newMemory = [...(state.npcMemory?.[npcId] || []), `[day ${state.day}] 玩家: ${input.slice(0, 30)}`]
  if (newMemory.length > 20) newMemory.shift()

  // 3. 检查 character depth（intimacy 4+）
  const characterDepth = getCharacterDepthMemory(npcId, newPortrait)

  // 4. 检查 A/B 分支可选项
  const choices = getAvailableChoices(npcId, input, state)

  // 5. 更新 state
  const isOoc = quality === 'ooc'
  // P0-2 修复：suspicion 之前是 0 个文件更新它
  //   rude 命中：所有 NPC 怀疑度 +5（OOC 大家都会警觉）
  //   ooc 命中：当前 NPC 怀疑度 +3，其他 +1
  //   warm/deep/helpful：当前 NPC 怀疑度 -2
  //   neutral/awkward：不变
  const suspicionDelta = {}
  if (quality === 'rude') {
    for (const id of Object.keys(state.suspicion || {})) suspicionDelta[id] = 5
  } else if (quality === 'ooc') {
    for (const id of Object.keys(state.suspicion || {})) {
      suspicionDelta[id] = (id === npcId) ? 3 : 1
    }
  } else if (['warm', 'deep', 'helpful'].includes(quality)) {
    suspicionDelta[npcId] = -2
  }
  const newSuspicion = { ...(state.suspicion || {}) }
  for (const [id, delta] of Object.entries(suspicionDelta)) {
    newSuspicion[id] = Math.max(0, Math.min(100, (newSuspicion[id] || 0) + delta))
  }

  // P0-5 修复（B-5）：dialogue 同步 relations —— 30 次对话后 relations 仍 50
  //   warm/deep/helpful 时 +5，rude/ooc 时 -3，中性时 +1
  const relationsUpdate = { ...(state.relations || {}) }
  const relCur = relationsUpdate[npcId] ?? 50
  const relDelta = quality === 'rude' || quality === 'ooc' ? -3
                : (quality === 'warm' || quality === 'deep' || quality === 'helpful') ? 5
                : 1
  relationsUpdate[npcId] = Math.max(0, Math.min(100, relCur + relDelta))

  // v9：行为语义写入 state.behavior（故事线触发器依赖）+ 通用 dialogue 记录（bajin_node_2 / cross_npc）
  const newBehavior = [...(state.behavior || [])]
  const extracted = extractBehavior(npcId, input, state)
  for (const b of extracted) {
    newBehavior.push({ day: state.day, npcId, ...b })
  }
  newBehavior.push({ day: state.day, npcId, action: 'dialogue' })
  if (newBehavior.length > 400) newBehavior.splice(0, newBehavior.length - 400)

  const newState = {
    ...state,
    npcPortrait: { ...(state.npcPortrait || {}), [npcId]: newPortrait },
    npcMemory: { ...(state.npcMemory || {}), [npcId]: newMemory },
    suspicion: newSuspicion,
    relations: relationsUpdate,
    behavior: newBehavior,
    dialoguesToday: (state.dialoguesToday || 0) + 1,
    oocToday: (state.oocToday || 0) + (isOoc ? 1 : 0),
    dialogues: [
      ...(state.dialogues || []),
      { day: state.day, npcId, input, text: input, output: opts.npcReply?.text || '', quality },
    ],
  }

  return {
    state: newState,
    newPortrait,
    mood: newPortrait.mood,
    portraitUrl: moodToPortraitUrl(newPortrait.mood, npcId),
    quality,
    storyHints: null,
    characterDepth,
    choices,
    refused: false,
  }
}

// isAsylumTriggered 在 lib/asylum.js 里（已在顶部 import）

/**
 * NPC 自适应拒绝 —— 异步生成 NPC 自己的"婉拒话术"
 * 调用时机：processDialogueTurn 返回 refused=true 后
 * @param {Object} state - 当前 state（拿 npcPortrait）
 * @param {string} npcId
 * @param {string} reason - refusalReason
 * @param {string} playerInput - 玩家刚才的输入
 * @param {Object} opts - { npcName, day, onDelta, system }
 * @returns {Promise<{text: string, mode: string}>}
 */
export async function processRefusalReply(state, npcId, reason, playerInput, opts = {}) {
  const portrait = state.npcPortrait?.[npcId] || initNpcPortrait()[npcId]
  const npc = {
    id: npcId,
    name: opts.npcName || npcId,
    system: opts.system, // ← 必须传 NPC 自己的完整 system prompt（buildNpcSystemPrompt 的输出）
    system_prompt_template: opts.system,
  }
  return npcRefuseReply({
    npc,
    playerInput,
    day: opts.day || state.day || 1,
    reason,
    portrait,
  }, opts.onDelta)
}

/**
 * Dream 玩家响应：标记 dream 为已回复，并把 NPC 推入对话流
 * @param {Object} state
 * @param {string} dreamId
 * @returns {Object} - {state, dream, npcId}
 */
export function processDreamRespond(state, dreamId) {
  const dream = (state.dreamQueue || []).find((d) => d.id === dreamId)
  if (!dream) return { state, dream: null, npcId: null }
  const next = respondToDream(state, dreamId)
  return { state: next.state, dream, npcId: dream.npcId }
}
