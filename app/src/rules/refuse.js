// app/src/rules/refuse.js
// 纯函数：NPC 自适应对话拒绝判定
// 拆分自 lib/npcPortrait.js：
//   canNpcTalk / recordInteraction / markRefusedToday

import { createPortrait } from './portrait.js'

/**
 * NPC 自适应对话判定
 * 每个 NPC 单独算"今天能不能继续聊"
 * 返回 { canTalk: bool, reason: string, mood: '正常'|'疲惫'|'生气'|'拒绝过' }
 *
 * 拒绝规则（按优先级）：
 * 1. patience <= 0  → 「我累了 / 没耐心了」  (理由: patience_exhausted)
 * 2. energy <= 10   → 「没力气了 / 太累」    (理由: energy_low)
 * 3. interactionsToday >= 5 → 「今天聊够了」  (理由: daily_limit)
 * 4. tension >= 80  → 「我今天心情不好」      (理由: tension_high)
 * 5. refusedToday   → 「明天再聊吧」         (理由: already_refused)
 * 6. intimacy < 0   → 「滚」                 (防御)
 */
export function canNpcTalk(portrait, npc, opts = {}) {
  const p = portrait || createPortrait(npc?.id)
  const name = npc?.name || '对方'
  const isOoc = opts.lastInputOoc

  // 已经拒绝过
  if (p.refusedToday) {
    return {
      canTalk: false,
      reason: 'already_refused',
      reply: `${name}摆了摆手：「昨儿个就同侬讲过了，阿拉今朝确实有事体，覅再来了。」`,
      mood: '拒绝过',
    }
  }

  // 1. patience 耗尽
  if (p.patience <= 0) {
    return {
      canTalk: false,
      reason: 'patience_exhausted',
      reply: `${name}别过脸去，不愿再看你：「侬讲的话阿拉听明白了，但迭个辰光阿拉脑子瓦特哉，侬改日再讲好伐？」`,
      mood: '愤怒',
    }
  }

  // 2. energy 耗尽
  if (p.energy <= 10) {
    return {
      canTalk: false,
      reason: 'energy_low',
      reply: `${name}叹了口气：「阿拉今朝真个没力气了，侬有啥事体明朝再讲好伐？」`,
      mood: '疲惫',
    }
  }

  // 3. 今日互动次数太多
  if ((p.interactionsToday || 0) >= 5) {
    return {
      canTalk: false,
      reason: 'daily_limit',
      reply: `${name}笑了笑：「侬今朝讲了够多哉，阿拉先想歇歇，明朝再叙。」`,
      mood: '正常',
    }
  }

  // 4. 紧张度太高（玩家一直挑衅）
  // v2.1: 门槛 80→95（配合 rude 扣分降低，3-5 句不应直接拒答）
  if (p.tension >= 95 && !isOoc) {
    return {
      canTalk: false,
      reason: 'tension_high',
      reply: `${name}脸色一沉，站起身来：「侬今朝忒多嘴了，阿拉要静静，侬请回。」`,
      mood: '生气',
    }
  }

  // 默认可以聊
  return { canTalk: true, reason: 'ok', reply: null, mood: '正常' }
}

/**
 * 记录一次对话（每次 processDialogueTurn 调用）
 * 累计 interactionsToday；对话让 NPC 恢复精力（v9：修复 energy 只降不升）
 */
export function recordInteraction(portrait, day) {
  const p = { ...portrait }
  p.interactionsToday = (p.interactionsToday || 0) + 1
  p.lastInteractionDay = day
  p.energy = Math.min(100, (p.energy ?? 80) + 15)
  return p
}

/**
 * 标记 NPC 今日已拒绝
 */
export function markRefusedToday(portrait) {
  return { ...portrait, refusedToday: true }
}
