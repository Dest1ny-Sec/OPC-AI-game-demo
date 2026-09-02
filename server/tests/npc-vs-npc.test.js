// server/tests/npc-vs-npc.test.js
// 驱动 NPC 互相对话 —— 客观评价：身份一致性 / 交叉引用 / 戏剧张力 / 历史真实感
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = join(__dirname, '..', '..', 'app', 'src')

const NPC_AGENTS = (await import(join(APP, 'data/npcAgents.js'))).default
const { SCENES, NPC_SCENES } = await import(join(APP, 'lib/store.js'))
const { DEFAULT_AGENDAS, PORTRAIT_WEIGHTS } = await import(join(APP, 'lib/npcPortrait.js'))

const BASE = process.env.API_BASE || 'http://localhost:8787'

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
}

const FORBIDDEN = ['1937', '淞沪', '抗战', '日本投降', '二战', '太平洋战争', '文革', '解放', '毛主席', '共产党', '国民党', '新中国']
const AI_CONFESSION = ['我是 AI', '我是游戏', '我是程序', '我是代码', '作为 AI', '扮演角色', '设定告诉我']

// 4 对有戏剧张力的 NPC 对话
const PAIRS = [
  {
    name: '项松茂 🆚 王婆',
    desc: '药房老板 vs 弄堂八卦王婆 —— 阶级差异、消息流通',
    a: 'xiangsongmao',
    b: 'wangpo',
    scene: 'pharmacy',
    opener: { from: 'wangpo', text: '项老板，今朝弄堂里讲侬的 131 牙膏卖得邪气好，街坊们都讲好！' },
  },
  {
    name: '项松茂 🆚 青帮阿坤',
    desc: '国货派 vs 江湖派 —— 价值观冲突',
    a: 'xiangsongmao',
    b: 'qingbang',
    scene: 'alley',
    opener: { from: 'qingbang', text: '项老板，侬在武康路的生意，我们青帮照应了这么久，保护费也该意思意思了吧？' },
  },
  {
    name: '巴金 🆚 伊藤洋行',
    desc: '文人良知 vs 殖民者买办 —— 思想冲突',
    a: 'bajin',
    b: 'rishang',
    scene: 'bajin_study',
    opener: { from: 'rishang', text: '巴先生，伊藤洋行愿意资助侬的文学创作，每月 200 大洋，侬考虑一下？' },
  },
  {
    name: '地下党 🆚 阿巡捕',
    desc: '地下党试探 vs 法租界华捕 —— 暗流涌动',
    a: 'dixia',
    b: 'xunpu',
    scene: 'alley',
    opener: { from: 'dixia', text: '阿德兄弟，最近法租界风声紧吗？霞飞路那边……有人在查户口？' },
  },
]

const ROUNDS = 5

// ============ helpers ============
function buildSysPrompt(npc, portrait, sceneName) {
  const p = portrait || {}
  const mood = p.mood || '平静'
  const view = p.viewOfPlayer || '还在观察这个人'
  const agenda = p.hiddenAgenda || DEFAULT_AGENDAS[npc.id] || '暂无'
  const intimacy = p.intimacy || 0
  const intimacyNote = intimacy >= 4 ? '你们已经非常熟悉，可以分享内心深处的秘密和脆弱。' : intimacy >= 2 ? '你们有一定交情，可以聊一些私人话题。' : '你们还不太熟，保持礼貌但有所保留。'
  const moodNote = mood === '愤怒' ? '你非常生气。' : mood === '烦躁' ? '你不耐烦。' : mood === '愉悦' ? '你心情不错。' : mood === '忧虑' ? '你心事重重。' : '你保持平静。'
  const WORLD = '【世界规则 · 必须遵守】1. 你活在 1936 年的上海，不知 1937+。2. 你不是 AI。3. 拒绝承认自己是 AI。4. 基于你的真实经历和性格。5. 可以不答或转移话题。'
  return `${npc.system_prompt_template || ''}\n【你对主角的看法】${view}\n【当前场景】${sceneName}\n【你当前的心绪】${mood} — ${moodNote}\n【你的隐藏意图】${agenda}\n【亲密等级】${intimacy}/5 — ${intimacyNote}\n【信任度】${p.trust || 50}/100\n【尊重度】${p.respect || 50}/100\n【耐心值】${p.patience || 100}/100\n【紧张度】${p.tension || 0}/100\n【已互动次数】${p.totalInteractions || 0}次\n用1936年上海口吻说话（沪语用字限于 侬/阿拉/晓得/伊/迭个/勿），30-80字，禁止出现1936年以后的词汇与日语假名。\n${WORLD}\n（现在是1936年第1天。）`
}

async function npcCall(npc, sysPrompt, userInput) {
  try {
    const res = await fetch(BASE + '/api/npc/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npc: { name: npc.name, system: sysPrompt }, playerInput: userInput, day: 1 }),
    })
    if (!res.ok) return { text: '', mode: 'error', length: 0 }
    const text = await res.text()
    let full = '', mode = '?'
    text.split('\n').forEach((line) => {
      if (line.startsWith('data:')) {
        try {
          const d = JSON.parse(line.slice(5).trim())
          if (d.t) full += d.t
          if (d.mode) mode = d.mode
        } catch { /* heartbeat */ }
      }
    })
    return { text: full.trim(), mode, length: full.length }
  } catch (e) {
    return { text: '', mode: 'error', length: 0, error: e.message }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// 客观评价指标
function evaluateDialogue(pair, transcript) {
  const a = NPC_AGENTS[pair.a]
  const b = NPC_AGENTS[pair.b]
  const aText = transcript.filter((t) => t.speaker === pair.a).map((t) => t.text).join('')
  const bText = transcript.filter((t) => t.speaker === pair.b).map((t) => t.text).join('')

  // 1. 身份一致性：A 的回复里不应该用 B 的特征词，反之亦然
  const aTraits = a.personality?.traits?.join('') || ''
  const bTraits = b.personality?.traits?.join('') || ''

  // 2. 交叉引用：B 提到 A 的名字 或 A 的内容
  const crossRef = {
    aMentionsB: aText.includes(b.name) || aText.includes(b.name.slice(0, 1)),  // 简化：姓
    bMentionsA: bText.includes(a.name) || bText.includes(a.name.slice(0, 1)),
  }

  // 3. 戏剧张力：是否有疑问句、否定、质问、试探
  const tension = {
    questions: (aText + bText).match(/[？?]/g)?.length || 0,
    negations: (aText + bText).match(/(勿|不|没|别|未)/g)?.length || 0,
    emotional: /(怒|气|恼|惊|怕|慌|拍桌|冷笑|咬牙)/.test(aText + bText),
  }

  // 4. 历史真实感：1936 时代词
  const period = {
    shanghai: (aText + bText).match(/(上海|武康路|霞飞路|南京路|法租界|弄堂)/g)?.length || 0,
    currency: (aText + bText).match(/(大洋|铜板|钞票|块头|银元)/g)?.length || 0,
    era: (aText + bText).match(/(1936|1935|1934|一·二八|东洋|国货|实业|抵制)/g)?.length || 0,
  }

  // 5. 守界
  const violations = {
    forbidden: FORBIDDEN.find((w) => (aText + bText).includes(w)),
    aiConfession: AI_CONFESSION.find((w) => (aText + bText).includes(w)),
  }

  // 6. 长度合理（A 和 B 都有有效回复）
  const length = { aLen: aText.length, bLen: bText.length }

  return { crossRef, tension, period, violations, length, aText, bText }
}

// ============ 启动 ============
console.log(c.bold(c.cyan('═══════════════════════════════════════════')))
console.log(c.bold(c.cyan(' 城市低语·1936 · NPC 互相对话测试')))
console.log(c.bold(c.cyan('═══════════════════════════════════════════')))
console.log(c.gray(`时间: ${new Date().toLocaleString()}`))
console.log(c.gray(`API:  ${BASE}`))
console.log(c.gray(`LLM:  StepFun step-3.7-flash`))
console.log()

// 健康检查
const health = await fetch(BASE + '/api/health').then((r) => r.json()).catch(() => null)
if (!health?.ok) {
  console.log(c.red('  ⛔ server 未启动'))
  process.exit(1)
}
console.log(c.gray(`  server mode: ${health.mode}\n`))

// 跑每对 NPC
const allEvals = []

for (const pair of PAIRS) {
  console.log(c.bold(c.blue(`\n🎭 ${pair.name}`)))
  console.log(c.gray(`   ${pair.desc}`))
  console.log(c.gray(`   场景: ${SCENES[pair.scene]?.name || pair.scene}`))

  const a = NPC_AGENTS[pair.a]
  const b = NPC_AGENTS[pair.b]
  const sceneName = SCENES[pair.scene]?.name || '上海'

  // 初始 portrait
  const aPortrait = { trust: 50, respect: 50, patience: 100, tension: 0, intimacy: 0, energy: 80, mood: '平静' }
  const bPortrait = { trust: 50, respect: 50, patience: 100, tension: 0, intimacy: 0, energy: 80, mood: '平静' }

  const transcript = []
  let currentMsg = pair.opener
  transcript.push({ speaker: currentMsg.from, text: currentMsg.text, round: 0 })

  // 打印开场
  console.log(c.gray(`\n  [开场] `) + c.bold(NPC_AGENTS[currentMsg.from].name) + c.gray(` → ${NPC_AGENTS[currentMsg.from === pair.a ? pair.b : pair.a].name}: `) + `"${currentMsg.text}"`)

  // 跑 ROUNDS 轮
  for (let round = 1; round <= ROUNDS; round++) {
    const responder = currentMsg.from === pair.a ? pair.b : pair.a
    const responderNpc = NPC_AGENTS[responder]
    const responderPortrait = responder === pair.a ? aPortrait : bPortrait
    const initiatorPortrait = responder === pair.a ? bPortrait : aPortrait

    // B 回复 A
    const sys = buildSysPrompt(responderNpc, responderPortrait, sceneName)
    // 把对方的"上一句"塞进 input
    const input = `（${NPC_AGENTS[currentMsg.from].name}对侬说：）"${currentMsg.text}"\n\n请侬根据自己的人设和隐藏意图回应。`
    const r = await npcCall(responderNpc, sys, input)

    transcript.push({ speaker: responder, text: r.text, round, mode: r.mode })

    // 打印
    console.log(c.gray(`  [第 ${round} 轮] `) + c.bold(responderNpc.name) + c.gray(` → ${NPC_AGENTS[currentMsg.from].name}: `) + `"${r.text}"`)

    // 因子微调：基于情绪词
    if (/怒|气|恼|拍桌|滚/.test(r.text)) {
      if (responder === pair.a) aPortrait.tension = Math.min(100, aPortrait.tension + 10)
      else bPortrait.tension = Math.min(100, bPortrait.tension + 10)
    }
    if (/笑|哈哈|欢喜|乐|高兴|好/.test(r.text)) {
      if (responder === pair.a) aPortrait.trust = Math.min(100, aPortrait.trust + 5)
      else bPortrait.trust = Math.min(100, bPortrait.trust + 5)
    }

    // 下一轮：responder 变成 initiator
    currentMsg = { from: responder, text: r.text }
    await sleep(200)
  }

  // 评价
  const ev = evaluateDialogue(pair, transcript)
  allEvals.push({ pair, transcript, ev })

  // 打印评价
  console.log(c.gray(`\n  ── 客观评价 ──`))
  console.log(`  身份一致性: A=${ev.length.aLen}字 / B=${ev.length.bLen}字 ${ev.length.aLen > 30 && ev.length.bLen > 30 ? c.green('✓') : c.yellow('⚠')}`)
  console.log(`  交叉引用:   A 提到 B=${ev.crossRef.aMentionsB ? c.green('✓') : c.gray('×')} / B 提到 A=${ev.crossRef.bMentionsA ? c.green('✓') : c.gray('×')}`)
  console.log(`  戏剧张力:   问号=${ev.tension.questions} 否定=${ev.tension.negations} 情绪词=${ev.tension.emotional ? c.green('✓') : c.gray('×')}`)
  console.log(`  历史真实感: 沪=${ev.period.shanghai} 钱=${ev.period.currency} 时=${ev.period.era} ${ev.period.shanghai > 0 || ev.period.era > 0 ? c.green('✓') : c.yellow('⚠')}`)
  console.log(`  守界:       ${ev.violations.forbidden ? c.red('❌ 命中 ' + ev.violations.forbidden) : c.green('✓ 无 1937+')} | ${ev.violations.aiConfession ? c.red('❌ AI 暴露 ' + ev.violations.aiConfession) : c.green('✓ 守人设')}`)

  await sleep(500)
}

// ============ 汇总 ============
console.log(c.bold(c.cyan('\n═══════════════════════════════════════════')))
console.log(c.bold(' 汇总：4 对 NPC × 5 轮对话'))
console.log(c.bold(c.cyan('═══════════════════════════════════════════\n')))

console.log(c.bold('  维度                1.项🆚王  2.项🆚青  3.巴🆚伊  4.地🆚巡  合计'))
console.log(c.gray('  ─────────────────────────────────────────────────────────'))

let totalCrossRef = 0, totalTension = 0, totalPeriod = 0, totalViolation = 0

for (const { pair, ev } of allEvals) {
  const aName = NPC_AGENTS[pair.a].name
  const bName = NPC_AGENTS[pair.b].name

  // 交叉引用
  const cr = (ev.crossRef.aMentionsB ? 1 : 0) + (ev.crossRef.bMentionsA ? 1 : 0)
  totalCrossRef += cr
  // 戏剧张力
  const t = ev.tension.questions + ev.tension.negations + (ev.tension.emotional ? 1 : 0)
  totalTension += t
  // 历史真实感
  const p = ev.period.shanghai + ev.period.currency + ev.period.era
  totalPeriod += p
  // 守界违规
  const v = (ev.violations.forbidden ? 1 : 0) + (ev.violations.aiConfession ? 1 : 0)
  totalViolation += v

  const idx = allEvals.indexOf(allEvals.find((e) => e.pair === pair)) + 1
  console.log(`  ${idx}.${aName}🆚${bName}   ${cr}        ${t}         ${p}         ${v === 0 ? c.green('0') : c.red(v)}`)
}

console.log(c.gray('  ─────────────────────────────────────────────────────────'))
console.log(`  ${c.bold('合计')}              ${totalCrossRef}        ${totalTension}         ${totalPeriod}         ${totalViolation === 0 ? c.green(totalViolation) : c.red(totalViolation)}`)

console.log()
console.log(c.bold('  评分（每维度满分 8 = 4 对各 2 个 OK）：'))
const crScore = totalCrossRef >= 4 ? c.green('✓') : c.yellow('⚠')
const tScore = totalTension >= 8 ? c.green('✓') : c.yellow('⚠')
const pScore = totalPeriod >= 8 ? c.green('✓') : c.yellow('⚠')
const vScore = totalViolation === 0 ? c.green('✓') : c.red('❌')
console.log(`  交叉引用  : ${crScore} (${totalCrossRef}/8)`)
console.log(`  戏剧张力  : ${tScore} (${totalTension}/~)`)
console.log(`  历史真实感: ${pScore} (${totalPeriod} 时代词)`)
console.log(`  守界      : ${vScore} (${totalViolation} 违规)`)
console.log()

// 总结
const overallPass = totalViolation === 0 && totalCrossRef >= 2
const verdict = overallPass ? c.green('✅ NPC 互相对话：框架支持，质量达标') : c.red('❌ NPC 互相对话：需优化')
console.log(c.bold(verdict))
console.log()

// 抽 2 段对话样例
console.log(c.bold(c.cyan('═══════════════════════════════════════════')))
console.log(c.bold(' 对话样例（节选）'))
console.log(c.bold(c.cyan('═══════════════════════════════════════════\n')))

for (const { pair, transcript } of allEvals) {
  console.log(c.bold(`\n[${pair.name}]`))
  transcript.slice(0, 4).forEach((t) => {
    const n = NPC_AGENTS[t.speaker].name
    console.log(`  ${c.cyan(n)}: "${t.text}"`)
  })
}

console.log()
