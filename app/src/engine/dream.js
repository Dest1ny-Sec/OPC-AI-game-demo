// app/src/engine/dream.js
// Dream 静默推送 —— NPC 主动找你（不要玩家触发）
// 拆分自 lib/dream.js（262 行 → engine/dream.js）
//
// 关键约束：
//   1. 最多 2 句
//   2. 玩家不回复 → 因子惩罚（trust/respect↓、tension↑）
//   3. 必须推剧情（关联 storylineSeen 或 randomEventsSeen）
//   4. 不要每天都推，最多隔 3 天
//   5. 不能 NPC 自残（player 已经在冷战的 NPC 不推）
//
// 触发逻辑：
//   - day 累计对话次数 ≥ 4 次（说明玩家对这个 NPC 投入）
//   - 该 NPC portrait 在 "可以聊" 区间（patience > 20, tension < 70）
//   - 有未触发的 storylines 关联到该 NPC
//   - 与上次 dream 间隔 ≥ 3 天
//   - 玩家整体 OOC 比例 < 30%（瞎玩时不推）

import { DEFAULT_AGENDAS } from '../rules/portrait.js'

/** 触发 Dream 的条件检查（纯函数） */
export function shouldDream(state, npcId) {
  if (!state || !npcId) return { ok: false, reason: 'invalid' }
  if (state.ended) return { ok: false, reason: 'game_over' }
  if (state.asylumLocked) return { ok: false, reason: 'asylum' }

  const portrait = state.npcPortrait?.[npcId]
  if (!portrait) return { ok: false, reason: 'no_portrait' }
  // NPC 关系太差或太冷，不推（玩家也懒得理）
  if (portrait.patience <= 20) return { ok: false, reason: 'patience_low' }
  if (portrait.tension >= 70) return { ok: false, reason: 'tension_high' }
  if (portrait.refusedToday) return { ok: false, reason: 'refused_today' }

  // 与该 NPC 的累计对话次数
  // v8 修复：阈值从 2 降到 1（首次对话即可触发，让玩家体验更密集的 NPC 互动）
  const memory = state.npcMemory?.[npcId] || []
  const intimacy = portrait.intimacy || 0
  if (memory.length < 1 && intimacy < 1) {
    return { ok: false, reason: 'too_few_interactions' }
  }

  // OOC 太多，瞎玩，不推
  const oocCount = (state.dialogues || []).filter((d) => d.quality === 'ooc' || d.quality === 'rude').length
  const totalCount = (state.dialogues || []).length
  if (totalCount > 0 && oocCount / totalCount > 0.3) return { ok: false, reason: 'too_much_ooc' }

  // 与上次 dream 间隔 ≥ 3 天
  const lastDream = (state.dreamHistory || []).filter((d) => d.npcId === npcId).pop()
  if (lastDream && state.day - lastDream.day < 3) return { ok: false, reason: 'cooldown' }

  return { ok: true }
}

/** 选择今天 dream 谁（按 portrait 评分选最优） */
export function pickDreamNpc(state, npcIds) {
  // 候选：所有 9 NPC
  const candidates = (npcIds || Object.keys(DEFAULT_AGENDAS))
    .map((id) => {
      const portrait = state.npcPortrait?.[id]
      if (!portrait) return null
      const check = shouldDream(state, id)
      if (!check.ok) return null
      // 评分：trust + intimacy*10 - tension + memory_count_bonus
      const memory = state.npcMemory?.[id] || []
      const score = (portrait.trust || 0) + (portrait.intimacy || 0) * 10 - (portrait.tension || 0) + Math.min(10, memory.length)
      return { id, score }
    })
    .filter(Boolean)

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].id
}

/**
 * 主入口：commitEndOfDay 末尾调用
 * 决定：明天是否有 NPC 主动找你？
 * 返回 dream 事件（不修改 state，由调用方写）
 */
export function runDream(state, opts = {}) {
  const today = state.day
  const npcIds = opts.npcIds || Object.keys(DEFAULT_AGENDAS)

  // 1. 检查全局抑制条件
  if (state.ended || state.asylumLocked) return null

  // 2. 全局冷却：每 3 天最多 1 次 dream（看最后一次**生成** dream 的 day，不是响应）
  const lastAnyDream = (state.dreamHistory || []).filter((d) => d.generated).slice(-1)[0]
  if (lastAnyDream && today - lastAnyDream.day < 2) return null

  // 3. 选 NPC
  const npcId = pickDreamNpc(state, npcIds)
  if (!npcId) return null

  const portrait = state.npcPortrait[npcId]
  const memory = state.npcMemory?.[npcId] || []

  // 4. 生成 2 句推剧情的话（不调 LLM，用模板；让玩家点进 NPC 视图才触发 LLM）
  //    模板根据 relationship + storylineSeen 选不同的话
  const templates = generateDreamLines(npcId, portrait, state)
  if (!templates || templates.length === 0) return null

  // 5. 关联 storyline（推剧情）
  const storyHint = pickStoryHint(npcId, state)

  return {
    id: `dream_${today}_${npcId}`,
    npcId,
    day: today,
    triggeredAt: Date.now(),
    lines: templates,            // 2 句开场白（玩家点进来会看到）
    storyHint,                   // 关联的 storyline（推剧情用）
    expiresAtDay: opts.expiresAtDay ?? today + 2,  // 默认玩家有 2 天缓冲
    responded: false,            // 玩家是否回复
    portraitSnapshot: { trust: portrait.trust, respect: portrait.respect, tension: portrait.tension },
  }
}

/** 生成 2 句开场白（模板驱动，不用 LLM） */
function generateDreamLines(npcId, portrait, state) {
  const memory = state.npcMemory?.[npcId] || []
  const recentTopic = memory[memory.length - 1] || ''
  const intimacy = portrait.intimacy || 0
  const trust = portrait.trust || 0
  const tension = portrait.tension || 0

  // 按 NPC + 关系 选模板
  const lines = {
    xiangsongmao: {
      high_trust:  ['老朋友，明朝阿拉寻你有事体商量。', '——事关 131 牙膏的销路，侬务必来。'],
      high_intimacy:['昨夜阿拉想了半天，有桩事想跟侬透个底。', '——阿拉信得过侬，才寻侬。'],
      default:     ['项松茂捋了捋胡子：「明朝到店里来一趟。」', '——看着像是有什么正经事体。'],
    },
    fangyexian: {
      high_trust:  ['老兄，明朝有空伐？阿拉想跟侬聊个事。', '——是关于中化社的下一步棋。'],
      high_intimacy:['方液仙扶了扶眼镜：「明朝到阿拉这边来喝杯茶。」', '——阿拉心里有桩事只跟侬说。'],
      default:     ['方液仙托人带了句话：「明朝有辰光伐？」', '——看着像是有事要谈。'],
    },
    guole: {
      high_trust:  ['郭老板托伙计送了封信：「明日请到永安来一趟。」', '——是桩正经生意。'],
      high_intimacy:['郭乐难得主动：「老友，明朝阿拉有事想请教。」', '——信任侬才开口。'],
      default:     ['永安百货的伙计送来一张名帖。', '——郭老板请侬明日得空去一趟。'],
    },
    bajin: {
      high_trust:  ['巴金把稿纸推到一边：「明日能不能来一趟？」', '——有些事想记进阿拉的稿子里。'],
      high_intimacy:['巴金在灯下写了张便条：「明朝，侬来一趟。」', '——阿拉相信侬能懂。'],
      default:     ['弄堂口有人送了张字条：「先生，明日请来。」', '——字迹像是巴金先生的。'],
    },
    wangpo: {
      high_trust:  ['王婆在弄堂口招手：「小囡，明朝到阿拉屋里来！」', '——阿拉有事体要告诉侬。'],
      high_intimacy:['王婆压低声音：「明朝侬务必来一趟。」', '——事关紧要。'],
      default:     ['王婆托街坊送了句话。', '——好像有什么弄堂里的事要告诉侬。'],
    },
    xunpu: {
      default:     ['阿巡捕换了便装在弄堂口晃悠。', '——侬要是方便，明日阿拉想跟侬单独谈谈。'],
    },
    qingbang: {
      default:     ['阿坤丢了根烟过来：「侬，明日个。」', '——侬懂的。'],
    },
    rishang: {
      default:     ['伊藤买办留了张名片在柜台上。', '——说是想约侬明日见面。'],
    },
    dixia: {
      default:     ['弄堂后门有人敲了三下。', '——同志，侬要是方便，明日个八点，老地方。'],
    },
  }

  const npcLines = lines[npcId] || lines.wangpo
  if (intimacy >= 3 && npcLines.high_intimacy) return npcLines.high_intimacy
  if (trust >= 65 && npcLines.high_trust) return npcLines.high_trust
  return npcLines.default
}

/** 选关联的 storyline（推剧情） */
function pickStoryHint(npcId, state) {
  const seen = state.storylineSeen || []
  // 简单策略：找没触发的、与该 NPC 相关的 storyline
  // 这里只返回 hint，具体 storyline 推进留给 processDialogueTurn
  const hintMap = {
    xiangsongmao: 'xiangsongmao_node_2',
    fangyexian:   'fangyexian_node_2',
    guole:        'guole_node_2',
    bajin:        'bajin_node_2',
    wangpo:       'wangpo_node_2',
  }
  const hint = hintMap[npcId]
  if (!hint) return null
  if (seen.includes(hint)) return null
  return hint
}

/**
 * 玩家进入 dream 视图后调这个：把 dream 标记为已读、推到对话
 * @returns {Object} - { state, dream }
 */
export function acceptDream(state, dreamId) {
  const dream = (state.dreamQueue || []).find((d) => d.id === dreamId)
  if (!dream) return { state, dream: null }
  return {
    state: {
      ...state,
      dreamQueue: state.dreamQueue.map((d) => d.id === dreamId ? { ...d, accepted: true } : d),
    },
    dream,
  }
}

/**
 * 玩家在 dream 视图中跟 NPC 说了话：标记 responded=true
 * 因子正常累加（走 processDialogueTurn 即可）
 */
export function respondToDream(state, dreamId) {
  return {
    state: {
      ...state,
      // v8: responded 后从队列移除（避免第二天再弹）
      dreamQueue: (state.dreamQueue || []).filter((d) => d.id !== dreamId),
      dreamHistory: [
        ...(state.dreamHistory || []),
        { npcId: (state.dreamQueue || []).find((d) => d.id === dreamId)?.npcId, day: state.day, responded: true },
      ],
    },
  }
}

/**
 * 跨日（commitEndOfDay 推进 day）时清理过期 dream，并对未回复的 dream 施加因子惩罚
 * @returns {Object} - { state, expiredDreams, punishedNpcs }
 */
export function processDreamExpiry(state, newDay) {
  const queue = state.dreamQueue || []
  const expired = queue.filter((d) => !d.responded && d.expiresAtDay < newDay)
  const stillValid = queue.filter((d) => d.expiresAtDay >= newDay)

  if (expired.length === 0) {
    return { state: { ...state, dreamQueue: stillValid }, expired: [], punished: [] }
  }

  // 对未回复的 dream 施加因子惩罚
  const newNpcPortrait = { ...state.npcPortrait }
  const punished = []
  for (const d of expired) {
    const p = newNpcPortrait[d.npcId]
    if (!p) continue
    // 玩家忽略 NPC 主动 → 信任-3 尊重-2 紧张+5（NPC 觉得被冷落）
    newNpcPortrait[d.npcId] = {
      ...p,
      trust: Math.max(0, (p.trust || 50) - 3),
      respect: Math.max(0, (p.respect || 50) - 2),
      tension: Math.min(100, (p.tension || 0) + 5),
    }
    punished.push({ npcId: d.npcId, reason: 'dream_ignored' })
  }

  return {
    state: {
      ...state,
      npcPortrait: newNpcPortrait,
      dreamQueue: stillValid,
    },
    expired,
    punished,
  }
}
