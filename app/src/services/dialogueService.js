// app/src/services/dialogueService.js
// 对话服务 —— NPC 主对话 / 拒绝话术 / 情绪因子（核心对外）
// 拆分自 lib/api.js

import { call } from './llmClient.js'
import { localNpc, localRefuseReply } from './localNpc.js'
import { WORLD_RULES_TEMPLATE, LANG_RULE } from '../data/lang.js'

/* ===== 1. NPC Agent 实时对话 ===== */
export function npcAgent({ npc, playerInput, day = 1, portrait, scene }, onDelta) {
  return call('/api/npc/agent', {
    npc: {
      name: npc.name,
      system: buildNpcSystemPrompt(npc, playerInput, day, portrait, scene),
    },
    playerInput, day,
  }, onDelta, () => localNpc(npc, playerInput, portrait))
}

/* ===== 1d. NPC 自适应拒绝 —— 让 NPC 自己生成"婉拒话术" ===== */
export function npcRefuseReply({ npc, playerInput, day = 1, reason, portrait }, onDelta) {
  return call('/api/npc/refuse', {
    npc: {
      name: npc.name,
      system: buildNpcSystemPrompt(npc, playerInput, day, portrait, npc.scene),
    },
    playerInput, day, reason, portrait,
  }, onDelta, () => localRefuseReply(npc.name, reason, portrait))
}

/**
 * 构建完整的 NPC 系统 prompt
 * 核心：将人物侧写（portrait）完整注入，让 AI 根据 NPC 的内心状态来回应
 */
export function buildNpcSystemPrompt(npc, playerInput, day, portrait, scene, todayPlan) {
  const p = portrait || {}
  const mood = p.mood || '平静'
  const view = p.viewOfPlayer || '还在观察这个人'
  const agenda = p.hiddenAgenda || '暂无特别意图'
  const intimacy = p.intimacy || 0

  // 根据亲密等级调整对话深度
  const intimacyNote = intimacy >= 4
    ? '你们已经非常熟悉，可以分享内心深处的秘密和脆弱。'
    : intimacy >= 2
      ? '你们有一定交情，可以聊一些私人话题。'
      : '你们还不太熟，保持礼貌但有所保留。'

  // 根据心绪调整语气
  const moodNote = mood === '愤怒' ? '你非常生气，说话带刺，但尽量控制自己。'
    : mood === '烦躁' ? '你有点不耐烦，回答简短。'
    : mood === '愉悦' ? '你心情不错，说话轻松。'
    : mood === '忧虑' ? '你心事重重，说话犹豫。'
    : '你保持平静。'

  // === v4: 注入叙事节拍上下文（让 NPC 知道今天/明天是什么日子）===
  let rhythmContext = ''
  if (todayPlan) {
    const lines = []
    lines.push(`【叙事节奏 · 第 ${day} 天 / 100 天】`)
    lines.push(`【当前幕：${todayPlan.actTitle || ''}】`)
    lines.push(`【氛围：${todayPlan.visualMood || ''}】`)
    if (todayPlan.activeNpc === npc.id || npc.id === todayPlan.activeNpc) {
      lines.push(`【今天是你主动找玩家的日子——开场可以主动提一件你挂心的事】`)
    }
    if (todayPlan.mandatoryEvent?.npcId === npc.id) {
      lines.push(`【今天你要上门拜访玩家——按事件剧情开场，例如"${todayPlan.mandatoryEvent.title}"】`)
    }
    if (todayPlan.dailyTask) {
      lines.push(`【今日任务：${todayPlan.dailyTask.label}（${todayPlan.dailyTask.action}）】`)
    }
    rhythmContext = '\n' + lines.join('\n') + '\n'
  }

  return `${npc.system_prompt_template || ''}
${rhythmContext}
【你对主角的看法】${view}
【当前场景】${scene || '药房柜台'}
【你当前的心绪】${mood} — ${moodNote}
【你的隐藏意图】${agenda}
【亲密等级】${intimacy}/5 — ${intimacyNote}
【信任度】${p.trust || 50}/100（越高越愿意说真话）
【尊重度】${p.respect || 50}/100（越高越看得起对方）
【耐心值】${p.patience || 100}/100（越低越不想聊）
【紧张度】${p.tension || 0}/100（越高越容易生气）
【已互动次数】${p.totalInteractions || 0}次

{output_lang_rule}
{world_rules}`.replace('{output_lang_rule}', LANG_RULE)
  .replace('{world_rules}', WORLD_RULES_TEMPLATE.replace(/\{NPC_NAME\}/g, npc.name || '1936 年上海人'))
  + '\n（现在是1936年第' + day + '天。）'
}

/* ===== 1b. NPC 情绪/因子影响 ===== */
export async function npcAffect({ npcName, playerInput, portrait, npc }) {
  // 直接用 fetch（不走 call，因为这是非流式 JSON）
  const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || (typeof process !== 'undefined' && process.env.VITE_API_BASE) || ''

  if (BASE) {
    try {
      const res = await fetch(BASE + '/api/npc/affect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcName,
          playerInput,
          currentEmotion: portrait?.mood || '平静',
          currentAffinity: portrait?.trust || 50,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.emotion || data?.affinity_delta !== undefined) {
          // 把 server 的 affinity_delta 映射回我们的因子 deltas
          const quality = data.emotion === '愤怒' ? 'rude' : data.emotion === '戒备' ? 'awkward' : data.emotion === '温暖' || data.emotion === '敬佩' ? 'warm' : data.emotion === '认可' ? 'helpful' : 'neutral'
          return {
            mode: data.mode || 'llm',
            portrait_deltas: computePortraitDeltas(quality, portrait, npc),
            emotion: mapServerEmotion(data.emotion),
            memory: data.memory || '',
            quality,
          }
        }
      }
    } catch { /* 降级到本地 */ }
  }
  // 本地兜底
  const quality = assessLocalQuality(playerInput)
  const deltas = computePortraitDeltas(quality, portrait, npc)
  const newMood = inferNewMood(portrait, deltas)
  const memory = generateMemory(quality, playerInput, npcName)
  return { mode: 'local', portrait_deltas: deltas, emotion: newMood, memory, quality }
}

// 把 server 端 8 类情绪映射到本地 5 类
function mapServerEmotion(s) {
  const m = { '愤怒': '愤怒', '戒备': '烦躁', '认可': '愉悦', '失望': '忧虑', '焦虑': '忧虑', '温暖': '愉悦', '敬佩': '愉悦' }
  return m[s] || '平静'
}

// 本地对话质量评估（v2 扩展：覆盖更自然的骂人词）
function assessLocalQuality(input) {
  const s = (input || '').trim()
  if (!s) return 'silent'

  if (/AI|人工智能|游戏|玩家|存档|代码|程序员|bug|glitch|界面|UI/i.test(s)) return 'ooc'
  if (
    /滚|呸|他妈的|去死|混蛋|王八蛋|老棺材|老不死|废物|没用|骗子|不要脸|闭嘴|死开|滚开|汉奸|卖国|走狗|间谍|怂货|别烦我|别理我|有病|fuck|shit|sb/i.test(s)
  ) return 'rude'
  if (/谈恋爱|结婚|女朋友|男朋友|老婆|老公|彩礼|嫁妆|生孩子|你妈|你爸/i.test(s)) return 'awkward'
  if (/1932|殉难|战死|前线|牺牲|信念|信仰|理想|抱负|年轻|从前|回忆|往事|家人|父亲|母亲|儿子|女儿/i.test(s)) return 'deep'
  if (/朋友|信任|合作|帮忙|谢谢|感激|佩服|了不起|英雄|好汉/i.test(s)) return 'warm'
  if (/帮|忙|求|借|有没有|能不能|拜托|恳请/i.test(s)) return 'helpful'
  return 'neutral'
}

// 根据对话质量 + 当前画像状态计算因子变化
function computePortraitDeltas(quality, portrait, npc) {
  const t = portrait.trust || 50
  const r = portrait.respect || 50
  const p = portrait.patience || 100
  const tension = portrait.tension || 0

  const base = {
    dialogue_deep:      { trust: 3, respect: 3, patience: 5, tension: 0 },
    dialogue_warm:      { trust: 5, respect: 3, patience: 3, tension: 0 },
    dialogue_helpful:   { trust: 8, respect: 5, patience: 5, tension: 0 },
    dialogue_awkward:   { trust: -2, respect: -2, patience: -15, tension: 10 },
    dialogue_rude:      { trust: -15, respect: -10, patience: -25, tension: 20 },
    dialogue_ooc:       { trust: -5, respect: -3, patience: -20, tension: 15 },
    dialogue_silent:    { trust: 0, respect: 0, patience: -5, tension: 3 },
    dialogue_neutral:   { trust: 1, respect: 1, patience: -2, tension: 0 },
  }

  const delta = { ...(base[quality] || base.dialogue_neutral) }

  // NPC 性格影响因子敏感度
  if (npc) {
    const traits = (npc.personality?.traits || []).join('')
    if (traits.includes('敏感') || traits.includes('文人')) {
      delta.tension = Math.round(delta.tension * 1.5)
      delta.patience = Math.round(delta.patience * 0.8)
    }
    if (traits.includes('江湖') || traits.includes('粗暴')) {
      delta.trust = Math.round(delta.trust * 1.3)
      delta.tension = Math.round(delta.tension * 1.2)
    }
    if (traits.includes('贪财') || traits.includes('精明')) {
      delta.respect = Math.round(delta.respect * 1.3)
    }
  }

  return delta
}

// 推断新心绪
function inferNewMood(portrait, deltas) {
  const newTension = (portrait.tension || 0) + (deltas.tension || 0)
  const newPatience = (portrait.patience || 100) + (deltas.patience || 0)
  const newTrust = (portrait.trust || 50) + (deltas.trust || 0)

  if (newTension >= 60) return '愤怒'
  if (newTension >= 30 || newPatience <= 30) return '烦躁'
  if (newTrust >= 70) return '愉悦'
  if (newTrust <= 25) return '忧虑'
  return '平静'
}

// 生成对话记忆
function generateMemory(quality, input, npcName) {
  const snippet = (input || '').slice(0, 20)
  const notes = {
    deep: `聊到了内心深处的话题：「${snippet}」`,
    warm: `表达了善意：「${snippet}」`,
    helpful: `向我求助：「${snippet}」`,
    awkward: `说了些让人尴尬的话：「${snippet}」`,
    rude: `说话带刺：「${snippet}」`,
    ooc: `说了一些奇怪的话：「${snippet}」`,
    neutral: `闲聊：「${snippet}」`,
    silent: `沉默不语`,
  }
  return notes[quality] || notes.neutral
}
