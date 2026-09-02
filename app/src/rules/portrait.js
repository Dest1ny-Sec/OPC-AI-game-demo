// app/src/rules/portrait.js
// 纯函数：NPC 4 维 portrait 计算 + 静态权重
// 零 import 业务逻辑，零 React 依赖
//
// 拆分自 lib/npcPortrait.js（578 行 → 多文件）：
//   - data/portraits.js (PORTRAIT_FILE_MAP)
//   - data/portraitLabels.js (MOOD_LABEL / MOOD_COLOR)
//   - rules/portrait.js (本文件 — 计算 + 静态数据)
//   - rules/refuse.js (canNpcTalk / recordInteraction / markRefusedToday)

import NPC_AGENTS from '../data/npcAgents.js'
import { MOOD_LIST, PORTRAIT_FILE_MAP } from '../data/portraits.js'

// 初始情绪映射：npcAgents.js 的 emotion_state.current（戒备/热络/高傲等）
//   → portrait.mood（6 选 1：平静/愉悦/愤怒/忧虑/烦躁/悲哀）
const INITIAL_MOOD_MAP = {
  戒备: '忧虑',       // 项松茂：开业前紧张
  观望: '平静',       // 方液仙：观察行情
  打量: '平静',       // 郭乐：评估来人
  平静: '平静',       // 巴金：写作中
  热络: '愉悦',       // 王婆：拉客
  公事公办: '平静',   // 巡捕阿德：例行公事
  高傲: '烦躁',       // 青帮阿坤：摆谱
  客气: '平静',       // 日商买办：商务礼貌
  观察: '平静',       // 联络员：低调观察
}

// NPC 画像维度权重（影响对话生成的倾向）
// v2.1: patience 权重从 0.20 提到 0.50 —— 让玩家骂多次才拒答（演示友好）
export const PORTRAIT_WEIGHTS = {
  xiangsongmao: { trust: 0.30, respect: 0.20, patience: 0.50 },
  fangyexian:   { trust: 0.25, respect: 0.30, patience: 0.45 },
  guole:        { trust: 0.30, respect: 0.25, patience: 0.45 },
  bajin:        { trust: 0.40, respect: 0.15, patience: 0.45 },
  wangpo:       { trust: 0.30, respect: 0.15, patience: 0.55 },
  xunpu:        { trust: 0.15, respect: 0.40, patience: 0.45 },
  qingbang:     { trust: 0.10, respect: 0.40, patience: 0.50 },
  rishang:      { trust: 0.15, respect: 0.35, patience: 0.50 },
  dixia:        { trust: 0.50, respect: 0.10, patience: 0.40 },
}

// 每个 NPC 的默认隐藏意图
export const DEFAULT_AGENDAS = {
  xiangsongmao: '守住五洲大药房，把131牙膏卖遍上海，不让东洋货占了上风',
  fangyexian:   '把三星牙膏做成上海第一牙膏，超越131',
  guole:        '永安百货要做成远东第一百货，只和有实力的商人打交道',
  bajin:        '写一本记录1936年上海人的书，让后人知道这年头普通人怎么活的',
  wangpo:       '在弄堂里做个消息中转站，帮邻里帮自己攒点人情',
  xunpu:        '在法租界混口饭吃，上面有交代就做事，但也不想做得太绝',
  qingbang:     '帮青帮管好这块地盘，收保护费，维持秩序',
  rishang:      '帮伊藤洋行打开中国市场，拿到更多代理权',
  dixia:        '在白色恐怖下秘密联络同志，收集情报，等待时机',
}

// 默认画像
export function createPortrait(npcId) {
  // v2.1: 初始 mood 从 NPC_AGENTS 的 emotion_state.current 同步映射
  //   项松茂→忧虑（戒备）、王婆→愉悦（热络）、阿坤→烦躁（高傲），其他→平静
  const npc = NPC_AGENTS?.[npcId]
  const initMood = INITIAL_MOOD_MAP[npc?.emotion_state?.current] || '平静'
  return {
    trust: 50,
    respect: 50,
    patience: 100,
    tension: 0,
    intimacy: 0,
    energy: 80,             // 每天消耗，恢复
    mood: initMood,
    viewOfPlayer: '',
    triggeredEvents: [],
    hasLeftBefore: false,
    lastVisitDay: 0,
    totalInteractions: 0,
    topicExhausted: {},
    hiddenAgenda: DEFAULT_AGENDAS[npcId] || '',
    secrets: [],
    speechQuirks: [],
    // ===== v2 新增：自适应对话 + 立绘联动 =====
    refusedToday: false,    // 今日是否已经拒绝过玩家
    interactionsToday: 0,    // 今日互动次数（用于自适应拒绝）
    lastInteractionDay: 0,  // 上次互动天
  }
}

export function initNpcPortrait() {
  const p = {}
  for (const id of Object.keys(DEFAULT_AGENDAS)) {
    p[id] = createPortrait(id)
  }
  return p
}

// 事件 → 画像影响映射
export const EVENT_IMPACT = {
  dialogue_deep: {
    trust: +3, respect: +3, patience: +5, tension: 0, intimacy: +1,
  },
  dialogue_warm: {
    trust: +5, respect: +3, patience: +3, tension: 0,
  },
  // 中性闲聊：什么都不变（用户 bug 修复：之前 neutral → dialogue_deep → intimacy+1）
  dialogue_neutral: {
    trust: 0, respect: 0, patience: 0, tension: 0, intimacy: 0,
  },
  dialogue_awkward: {
    trust: -2, respect: -2, patience: -5, tension: +5,
  },
  // v2.1: rude 扣分大幅降低（演示友好，让玩家骂 5-6 次才拒答）
  //   旧：patience -25, tension +35 → 3 句 sb 就拒答
  //   新：patience -6, tension +10 → 8-10 句 sb 才拒答
  dialogue_rude: {
    trust: -3, respect: -2, patience: -6, tension: +10,
  },
  dialogue_ooc: {
    trust: -2, respect: -1, patience: -5, tension: +5,
  },
  dialogue_helpful: {
    trust: +8, respect: +5, patience: +5, tension: 0,
  },
  dialogue_silent: {
    patience: -5, tension: +3,
  },
  buy_goods: {
    trust: +5, respect: +3, patience: 0, tension: 0,
  },
  refuse_trade: {
    trust: -3, respect: -2, patience: -5, tension: +5,
  },
  praise_npc: {
    trust: +5, respect: +5, patience: +3, tension: 0,
  },
  criticize_npc: {
    trust: -5, respect: -3, patience: -10, tension: +8,
  },
  share_story: {
    trust: +8, respect: +5, patience: +5, tension: 0, intimacy: +1,
  },
  ask_about_personal: {
    trust: +3, respect: +2, patience: -3, tension: 0, intimacy: +1,
  },
  ignore_npc: {
    trust: -5, respect: -5, patience: -10, tension: +5,
  },
  help_npc: {
    trust: +10, respect: +8, patience: +5, tension: 0,
  },
  betray_npc: {
    trust: -20, respect: -15, patience: -15, tension: +25,
  },
  // NPC 特定事件
  first_meet: {
    xiangsongmao: { trust: +2, respect: +2, patience: 0, tension: 0 },
    fangyexian:   { trust: +2, respect: +2, patience: 0, tension: 0 },
    guole:        { trust: +1, respect: +3, patience: 0, tension: 0 },
    bajin:        { trust: +3, respect: +1, patience: 0, tension: 0 },
    wangpo:       { trust: +5, respect: +2, patience: 0, tension: 0 },
    xunpu:        { trust: +1, respect: +2, patience: 0, tension: 0 },
    qingbang:     { trust: +1, respect: +1, patience: 0, tension: 0 },
    rishang:      { trust: +2, respect: +2, patience: 0, tension: 0 },
    dixia:        { trust: +2, respect: +1, patience: 0, tension: 0 },
  },
}

// 应用事件影响
export function applyImpact(portrait, eventKey, npcId) {
  const event = EVENT_IMPACT[eventKey]
  if (!event) return portrait

  const p = { ...portrait }
  const deltas = event[npcId] || event

  for (const [key, delta] of Object.entries(deltas)) {
    if (key in p) {
      if (typeof p[key] === 'number') {
        p[key] = Math.max(0, Math.min(100, p[key] + delta))
      } else if (typeof p[key] === 'string' && key === 'mood') {
        // mood 由其他逻辑决定，这里不直接设置
      } else {
        p[key] = delta
      }
    }
  }

  p.totalInteractions = (p.totalInteractions || 0) + 1
  p.triggeredEvents = [...(p.triggeredEvents || []), eventKey]

  return p
}

//  decaying：每次访问后耐心恢复一点
export function decayPortrait(portrait) {
  const p = { ...portrait }
  p.patience = Math.min(100, (p.patience || 50) + 15)
  p.tension = Math.max(0, (p.tension || 0) - 5)
  return p
}

// 每天消耗精力
export function dailyDecay(portrait) {
  const p = { ...portrait }
  // 用 ?? 避免 energy=0 时被 || 80 重置
  // v9 bug 修复：energy 只降不升 → 第 8 天全员永久拒绝。衰减放缓为 -1（≈70 天才触底），
  //   配合 recordInteraction 的 +15 恢复，常聊的 NPC 精力永远健康
  p.energy = Math.max(0, (p.energy ?? 80) - 1)
  p.patience = Math.min(100, (p.patience ?? 50) + 10)
  p.tension = Math.max(0, (p.tension ?? 0) - 3)
  // ===== v2: 重置今日对话计数 =====
  p.interactionsToday = 0
  p.refusedToday = false
  return p
}

// NPC 是否应该离开
export function shouldNPCLeave(portrait) {
  return portrait.tension >= 90 || portrait.patience <= 0 || portrait.energy <= 5
}

// NPC 离开理由
export function getLeaveReason(portrait, npc) {
  if (portrait.patience <= 0) {
    return `${npc.name}摆了摆手：「算了，阿拉还有事。改日再说。」`
  }
  if (portrait.energy <= 5) {
    return `${npc.name}揉了揉太阳穴：「今天太累了，侬改天再来吧。」`
  }
  if (portrait.tension >= 90) {
    const reasons = [
      `${npc.name}站了起来，脸色铁青：「侬说的，阿拉记着了。」`,
      `${npc.name}拂袖而去：「这话，侬留着跟别人说吧。」`,
      `${npc.name}深吸一口气：「今天到此为止。侬请便。」`,
    ]
    return reasons[Math.min(Math.floor((portrait.tension - 90) / 10), reasons.length - 1)]
  }
  return `${npc.name}叹了口气：「阿拉先走了。」`
}

// 对话质量评估（轻量级本地评估）
export function assessDialogueQuality(playerInput, npc) {
  const input = (playerInput || '').trim()
  if (!input) return 'silent'

  // 脱离 1936 语境
  const oocPatterns = [/AI|人工智能|游戏|玩家|存档|NPC|npc|代码|程序员|bug|glitch|界面|UI/i]
  if (oocPatterns.some(p => p.test(input))) return 'ooc'

  // 辱骂 / 侮辱 / 咒骂（v2 扩展：覆盖更自然的骂人词）
  // 分多组以免误伤（"老朋友" "老人家" 不能误命中）
  const rudePatterns = [
    // 单字骂
    /滚|呸|呸呸|啐|嚯|嗟/,
    // 经典咒骂
    /他妈的|他妈|去死|该死|混蛋|王八蛋|龟儿子|狗东西|狗娘养|妈的|妈了个巴子|妈个巴子/,
    // 侮辱性称呼
    /傻[比逼叉蛋]|蠢货|蠢[比逼]|笨[比蛋货]|贱[人货]|臭[东西]|臭[比逼]/,
    /老棺材|老不死|老不死的|老东西|老[子哥]|老不尊/,
    /废物|没用|饭桶|蠢才|二货|二百五/,
    /骗子|骗人|放屁|瞎扯|胡扯|胡说/,
    /不要脸|下三滥|下流|无耻|卑鄙|龌龊/,
    /闭嘴|死开|走开|滚开|爬开|滚蛋|滚球|滚粗|滚远/,
    /汉奸|卖国贼|卖国|走狗|间谍|狗腿子|日奸|倭寇|日本狗|东洋狗/,
    /怂货|懦夫|孬种|软蛋|窝囊废|贱骨头/,
    /别[烦理]我|别来烦|少来烦|少管|少装/,
    /有病|神经病|疯子|癫子/,
    /敢不敢|有种|有种你/,
    /你算[什么老]|算老几|算哪根葱|哪来的/,
    /操你|草你|肏你|艹你|fuck|shit|sb|nc|nn|nm|nd|wtf/,
  ]
  if (rudePatterns.some(p => p.test(input))) return 'rude'

  // 冒犯（保留独立分组，未来可分级别）
  const offensivePatterns = [/汉奸|卖国|走狗|间谍|日本爸爸|东洋爹/i]
  if (offensivePatterns.some(p => p.test(input))) return 'rude'

  // 尴尬/离谱话题
  const awkwardPatterns = [/谈恋爱|结婚|女朋友|男朋友|老婆|老公|彩礼|嫁妆|生孩子|你妈|你爸/i]
  if (awkwardPatterns.some(p => p.test(input))) return 'awkward'

  // 深度话题
  const deepPatterns = [/1932|殉难|战死|前线|牺牲|信念|信仰|理想|抱负|年轻|从前|以前|回忆|往事|家人|父亲|母亲|儿子|女儿/i]
  if (deepPatterns.some(p => p.test(input))) return 'deep'

  // 友好信号
  const warmPatterns = [/朋友|信任|合作|帮忙|需要|谢谢|感激|佩服|了不起|英雄|好汉/i]
  if (warmPatterns.some(p => p.test(input))) return 'warm'

  // 帮忙/求助
  const helpPatterns = [/帮|忙|求|借|借点|有没有|能不能|可否|拜托|恳请/i]
  if (helpPatterns.some(p => p.test(input))) return 'helpful'

  return 'neutral'
}

export function qualityToEventKey(quality) {
  const map = {
    deep: 'dialogue_deep',
    warm: 'dialogue_warm',
    awkward: 'dialogue_awkward',
    rude: 'dialogue_rude',
    ooc: 'dialogue_ooc',
    helpful: 'dialogue_helpful',
    silent: 'dialogue_silent',
    // 用户 bug 修复：neutral 不应被算成 deep（否则 3 句闲聊就 intimacy 3，太容易）
    neutral: 'dialogue_neutral',
  }
  return map[quality] || 'dialogue_neutral'
}

// 根据画像状态推断 NPC 当前心绪
export function inferMood(portrait) {
  if (portrait.tension >= 70) return '愤怒'
  if (portrait.tension >= 40) return '烦躁'
  if (portrait.patience <= 20) return '烦躁'
  // v2 调高门槛：intimacy + trust 双高才到"愉悦"
  // （防止 dialogue_deep 一次 +1 intimacy 就跳"愉悦"）
  if (portrait.intimacy >= 3 && portrait.trust >= 80) return '愉悦'
  if (portrait.trust >= 80 && portrait.respect >= 70) return '愉悦'
  if (portrait.trust >= 60) return '平静'
  if (portrait.tension >= 20) return '忧虑'
  return '平静'
}

// 将完整画像转换为 LLM prompt 注入
export function portraitToPrompt(portrait, npc) {
  const mood = portrait.mood || inferMood(portrait)
  const view = portrait.viewOfPlayer || '还在观察这个年轻人/中年人'
  const agenda = portrait.hiddenAgenda || '暂无特别意图'

  return `【你对主角的看法】${view}
【你当前的心绪】${mood}
【你的隐藏意图】${agenda}
【信任度】${portrait.trust}/100（越高越愿意说真话）
【尊重度】${portrait.respect}/100（越高越看得起你）
【耐心值】${portrait.patience}/100（越低越不想聊）
【紧张度】${portrait.tension}/100（越高越容易生气）
【亲密等级】${portrait.intimacy}/5（越高越能说心里话）
【已互动次数】${portrait.totalInteractions}次`
}

// 对话开场类型（根据画像）
export function getDialogueOpening(portrait, npc) {
  const intimacy = portrait.intimacy || 0
  const trust = portrait.trust || 50
  const tension = portrait.tension || 0

  if (tension >= 60) return 'tense'
  if (intimacy >= 3 && trust >= 60) return 'intimate'
  if (trust >= 65) return 'warm'
  if (tension >= 30) return 'cold'
  return 'neutral'
}

// 对话开场标签映射
export const OPENING_LABEL = {
  neutral: '普通',
  warm: '亲切',
  intimate: '亲密',
  tense: '紧张',
  cold: '冷淡',
}

// 人物侧写对对话成功率的加成（未来可接入 bargain 等系统）
export function portraitBonus(portrait, npcId) {
  const weights = PORTRAIT_WEIGHTS[npcId] || { trust: 0.4, respect: 0.4, patience: 0.2 }
  const trustBonus = (portrait.trust - 50) / 100 * (weights.trust || 0.4)
  const respectBonus = (portrait.respect - 50) / 100 * (weights.respect || 0.4)
  const patienceBonus = (portrait.patience - 50) / 100 * (weights.patience || 0.2)
  return trustBonus + respectBonus + patienceBonus
}

/**
 * mood → 立绘 URL
 * 规则：每个 NPC 6 张立绘（每个 mood 一张）
 * 路径：/img/portraits/{npcId}_{mood}.png
 * fallback: /img/npc/{npcId}.png（旧的立绘）
 */
export function moodToPortraitUrl(mood, npcId) {
  const m = MOOD_LIST.includes(mood) ? mood : '平静'
  // 优先用 PORTRAIT_FILE_MAP 拿真实文件名（避免 onError 走 fallback）
  const file = PORTRAIT_FILE_MAP[`${npcId}-${m}`]
  return file ? `/img/portraits/${file}` : `/img/portraits/${npcId}-${m}.png`
}
