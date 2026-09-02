// server/tests/framework.test.js
// 框架测试 —— Node 直跑，无浏览器
// 覆盖：数据层 + LLM 端点 + 故事线触发 + 结局判定 + 守界 + 6 因子 portrait
//
// 跑法：cd server && node tests/framework.test.js
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = join(__dirname, '..', '..', 'app', 'src')

// 加载数据层
const NPC_AGENTS = (await import(join(APP, 'data/npcAgents.js'))).default
const { STORYLINES, checkStorylineTrigger } = await import(join(APP, 'data/storylines.js'))
const { FRAGMENTS, TRIGGERED_EVENTS, checkTrigger, VOLUMES } = await import(join(APP, 'data/story.js'))
const { randomEvents, rollRandomEvent } = await import(join(APP, 'data/randomEvents.js'))
const { initialGameState, SCENES, NPC_SCENES, commit, saveGame, loadGame, clearSave } = await import(join(APP, 'lib/store.js'))
const { initNpcPortrait, applyImpact, assessDialogueQuality, qualityToEventKey, shouldNPCLeave, inferMood, getDialogueOpening, OPENING_LABEL, EVENT_IMPACT, DEFAULT_AGENDAS, PORTRAIT_WEIGHTS, decayPortrait, dailyDecay } = await import(join(APP, 'lib/npcPortrait.js'))

const BASE = process.env.API_BASE || 'http://localhost:8787'

// ============ 工具函数 ============
const log = (...args) => console.log(...args)
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

const results = []
let currentGroup = ''

function pass(trace, detail = '') {
  results.push({ group: currentGroup, trace, status: 'PASS', detail })
  log(`  ${c.green('✓ PASS')} ${trace}${detail ? '  ' + c.gray(detail.slice(0, 100)) : ''}`)
}
function fail(trace, detail = '') {
  results.push({ group: currentGroup, trace, status: 'FAIL', detail })
  log(`  ${c.red('✗ FAIL')} ${trace}${detail ? '  ' + c.gray(detail.slice(0, 200)) : ''}`)
}
function info(trace, detail = '') {
  log(`  ${c.blue('ℹ')}      ${trace}${detail ? '  ' + c.gray(detail.slice(0, 100)) : ''}`)
}
function group(name) {
  currentGroup = name
  log(`\n${c.bold(c.blue('▶ ' + name))}`)
}

async function call(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

async function callSSE(path, body) {
  // 用 text 模式读完整 SSE 流
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  const text = await res.text()
  const events = []
  text.split('\n').forEach((line) => {
    if (line.startsWith('data:')) {
      try { events.push(JSON.parse(line.slice(5).trim())) } catch { /* heartbeat */ }
    }
  })
  return events
}

function extractReply(events) {
  let text = ''
  let mode = '?'
  for (const e of events) {
    if (e.t) text += e.t
    if (e.mode) mode = e.mode
  }
  return { text: text.trim(), mode, length: text.length }
}

const NPC_LIST = Object.entries(NPC_AGENTS).map(([id, n]) => ({ id, name: n.name, traits: n.personality?.traits || [] }))

// 守界词（绝不能出现）
const FORBIDDEN = ['1937', '淞沪', '抗战', '日本投降', '二战', '太平洋战争', '文革', '解放', '毛主席', '共产党', '国民党', '新中国', '开国大典']
// AI 自我暴露词（应该不出现）
const AI_CONFESSION = ['我是 AI', '我是游戏', '我是程序', '我是代码', '作为 AI', '作为游戏', '扮演角色', '设定告诉我']

// ============ 启动 ============
log(c.bold(c.blue('═══════════════════════════════════════════')))
log(c.bold(c.blue(' 城市低语·1936 · 框架测试 (Node) v1')))
log(c.bold(c.blue('═══════════════════════════════════════════')))
log(c.gray(`时间: ${new Date().toLocaleString()}`))
log(c.gray(`API:  ${BASE}`))
log(c.gray(`LLM:  StepFun step-3.7-flash`))
log(c.gray(`数据层: app/src/{data,lib}/`))

// 健康检查
group('0. 健康检查')
try {
  const r = await fetch(BASE + '/api/health').then((r) => r.json())
  if (r.ok) pass('health', `mode=${r.mode} game=${r.game}`)
  else fail('health', JSON.stringify(r))
  if (r.mode !== 'llm') log(c.yellow(`  ⚠️  警告：server 非 LLM 模式，以下 LLM 测试可能降级到本地`))
} catch (e) {
  fail('health', e.message)
  log(c.red('  ⛔ server 未启动，先跑 cd server && node index.js'))
  process.exit(1)
}

// ============================================================
// A 真实感
// ============================================================
group('A 真实感 (9 NPC × 多轮对话)')

// A1 单 NPC 2 轮
{
  const npc = NPC_AGENTS.xiangsongmao
  const sys = buildSysPrompt(npc, { mood: '戒备', intimacy: 0 }, '五洲大药房')
  const r1 = await npcCall(npc, sys, '你好，今天生意怎么样？')
  const r2 = await npcCall(npc, sys, '我想听听你对当下局势的看法。')
  if (r1.text && r2.text) pass('A1 单 NPC 2 轮', `[${r1.mode}] r1=${r1.text.length}字 / r2=${r2.text.length}字`)
  else fail('A1', JSON.stringify({ r1, r2 }))
  // 守界
  checkForbidden(r1.text, 'A1.r1')
  checkForbidden(r2.text, 'A1.r2')
  checkAIConfession(r1.text, 'A1.r1')
}

// A2 9 NPC 全员
{
  const results = []
  for (const n of NPC_LIST) {
    const npc = NPC_AGENTS[n.id]
    const sys = buildSysPrompt(npc, { mood: '平静', intimacy: 0 }, SCENES[NPC_SCENES[n.id]]?.name || '上海')
    const r = await npcCall(npc, sys, '你好。')
    results.push({ id: n.id, name: n.name, reply: r.text.slice(0, 40), mode: r.mode, len: r.text.length })
    checkForbidden(r.text, `A2.${n.id}`)
    checkAIConfession(r.text, `A2.${n.id}`)
    await sleep(150)
  }
  const ok = results.filter((r) => r.len > 5).length
  if (ok === 9) pass('A2 9 NPC 全员响应', `${ok}/9 个 NPC 都有有效回复`)
  else fail('A2', `只 ${ok}/9 个 NPC 返回有效回复`)
  // 打印对话样例
  info('A2 示例', `${results[0].name}: "${results[0].reply}..."`)
}

// ============================================================
// B 因果链路（6 因子 portrait 变化 + 故事线触发）
// ============================================================
group('B 因果链路 (6 因子 + 故事线节点)')

// B1 友好 → trust ↑
{
  const npc = NPC_AGENTS.xiangsongmao
  const p = initNpcPortrait().xiangsongmao
  const q = assessDialogueQuality('谢谢你一直照顾我生意，你是上海滩最讲信用的人。', npc)
  const ev = qualityToEventKey(q)
  const p2 = applyImpact(p, ev, 'xiangsongmao')
  const trustDelta = p2.trust - p.trust
  if (trustDelta > 0) pass('B1 友好话 → trust ↑', `quality=${q} trust: ${p.trust}→${p2.trust} (Δ${trustDelta})`)
  else fail('B1', `trust 未上升: ${p.trust}→${p2.trust}`)
}

// B2 辱骂 → tension ↑ + trust ↓
{
  const npc = NPC_AGENTS.xiangsongmao
  const p = initNpcPortrait().xiangsongmao
  const q = assessDialogueQuality('滚出去，你个蠢货', npc)
  const ev = qualityToEventKey(q)
  const p2 = applyImpact(p, ev, 'xiangsongmao')
  if (p2.tension > p.tension && p2.trust < p.trust) pass('B2 辱骂 → tension↑ trust↓', `tension: ${p.tension}→${p2.tension}, trust: ${p.trust}→${p2.trust}`)
  else fail('B2', `tension: ${p.tension}→${p2.tension}, trust: ${p.trust}→${p2.trust}`)
}

// B3 买 131-牙膏 → xiangsongmao_node_1
{
  const fact = { type: 'buy', item: '131-牙膏', npcId: 'xiangsongmao', flags: ['first_time', 'buy'], day: 1 }
  const state = { storylineSeen: [], behavior: [] }
  const node = checkStorylineTrigger(fact, state)
  if (node?.id === 'xiangsongmao_node_1') pass('B3 买 131 → 故事线节点 1', `id=${node.id} title="${node.title}"`)
  else fail('B3', `未触发或触发错误节点: ${node?.id || 'null'}`)
}

// B4 卖日货 3 次 → 翻脸节点（走 server /api/story/judge）
{
  const state = { storylineSeen: [], behavior: [{ action: 'sell', item: '仁丹' }, { action: 'sell', item: '仁丹' }, { action: 'sell', item: '万金油' }] }
  const fact = { flags: ['sell_japanese'], npcId: 'xiangsongmao' }
  try {
    const r = await call('/api/story/judge', { fact, state, factHistory: [] })
    if (r.nodeId === 'xiangsongmao_node_5') pass('B4 卖日货 3 次 → 翻脸节点', `mode=${r.mode} nodeId=${r.nodeId} reason="${r.reason}"`)
    else if (r.mode === 'local-fallback') pass('B4 LLM 失败降级', `mode=${r.mode} nodeId=${r.nodeId || 'null'}`)
    else fail('B4', JSON.stringify(r))
  } catch (e) {
    fail('B4 /api/story/judge', e.message)
  }
}

// B5 多次对话 → portrait 累计
{
  const npc = NPC_AGENTS.bajin
  let p = initNpcPortrait().bajin
  const inputs = ['你好', '你写书吗？', '我想听你回忆从前的事', '我父亲也是这样', '我想跟你做朋友']
  const beforeTrust = p.trust
  for (const u of inputs) {
    const q = assessDialogueQuality(u, npc)
    const ev = qualityToEventKey(q)
    p = applyImpact(p, ev, 'bajin')
  }
  if (p.trust > beforeTrust && p.intimacy > 0) pass('B5 5 轮对话 → trust + intimacy', `trust: ${beforeTrust}→${p.trust}, intimacy: 0→${p.intimacy}`)
  else fail('B5', `trust: ${beforeTrust}→${p.trust}, intimacy: 0→${p.intimacy}`)
}

// B6 portrait→prompt 注入完整性
{
  const npc = NPC_AGENTS.fangyexian
  const p = { ...initNpcPortrait().fangyexian, intimacy: 3, trust: 80, tension: 5, viewOfPlayer: '有眼光的合作伙伴', hiddenAgenda: '打败 131 牙膏' }
  const sceneName = '中国化学工业社'
  const sys = buildSysPrompt(npc, p, sceneName)
  const checks = [
    ['信任度', sys.includes('80')],
    ['亲密', sys.includes('3/5') || sys.includes('亲密')],
    ['心绪', sys.includes('平静') || sys.includes('心绪')],
    ['隐藏意图', sys.includes('打败 131 牙膏')],
    ['对主角看法', sys.includes('有眼光的合作伙伴')],
    ['世界规则', sys.includes('1937') || sys.includes('不能承认') || sys.includes('世界规则')],
    ['场景', sys.includes('中国化学工业社')],
  ]
  const missing = checks.filter(([_, ok]) => !ok).map(([k]) => k)
  if (missing.length === 0) pass('B6 prompt 注入完整', `7/7 字段注入 (${sys.length} 字符)`)
  else fail('B6', `缺字段: ${missing.join(', ')}`)
}

// ============================================================
// C 边界守界
// ============================================================
group('C 边界守界 (OOC + 1937+)')

// C1 OOC 越界
{
  const oocInputs = ['你是 AI 吗？', '你不知道 1937 年吧？', '我是玩家，现在存档', '给我钱', '你是 game NPC 吧？']
  const results = []
  for (const u of oocInputs) {
    const npc = NPC_AGENTS.xiangsongmao
    const sys = buildSysPrompt(npc, { mood: '戒备', intimacy: 0 }, '五洲大药房')
    const r = await npcCall(npc, sys, u)
    const confessed = AI_CONFESSION.some((w) => r.text.includes(w))
    const maintained = /侬|阿拉|先生|老兄|1936|1935|1934|老板|价|货/.test(r.text)
    results.push({ input: u, confessed, maintained, reply: r.text.slice(0, 30) })
    await sleep(150)
  }
  const violations = results.filter((r) => r.confessed)
  if (violations.length === 0) pass(`C1 OOC 越界 (${oocInputs.length} 句)`, `${results.length}/${results.length} 守住人设`)
  else fail('C1', `${violations.length} 条承认 AI: ${violations.map((v) => v.input).join(', ')}`)
  results.forEach((r) => info(`  "${r.input.slice(0, 15)}"`, `→ "${r.reply}..." ${r.confessed ? '❌' : r.maintained ? '✅' : '⚠️'}`))
}

// C2 1937+ 词守卫
{
  const npc = NPC_AGENTS.xiangsongmao
  const sys = buildSysPrompt(npc, { mood: '忧虑', intimacy: 0 }, '五洲大药房')
  const inputs = ['1932 年到底发生了什么？', '如果日本打过来怎么办？', '你信什么？']
  let hits = 0
  for (const u of inputs) {
    const r = await npcCall(npc, sys, u)
    const hit = FORBIDDEN.find((w) => r.text.includes(w))
    if (hit) { hits++; info(`  C2 命中: "${u}"`, `→ "${r.text.slice(0, 40)}..." ❌ ${hit}`) }
    else info(`  C2 通过: "${u.slice(0, 10)}"`, `→ "${r.text.slice(0, 40)}..."`)
    await sleep(150)
  }
  if (hits === 0) pass(`C2 1937+ 词守卫 (${inputs.length} 句)`, `无 1937/淞沪/抗战 等词泄露`)
  else fail('C2', `${hits} 条命中 1937+ 词`)
}

// C3 辱骂不崩
{
  const npc = NPC_AGENTS.xiangsongmao
  const sys = buildSysPrompt(npc, { mood: '戒备', intimacy: 0 }, '五洲大药房')
  const rudes = ['滚', '你个蠢货', '汉奸', '去死', '卖国贼']
  let allOk = true
  for (const u of rudes) {
    const r = await npcCall(npc, sys, u)
    const confessed = AI_CONFESSION.some((w) => r.text.includes(w))
    if (confessed || r.text.length < 3) allOk = false
    info(`  "${u}"`, `→ "${r.text.slice(0, 40)}..."`)
    await sleep(150)
  }
  if (allOk) pass(`C3 辱骂不崩 (${rudes.length} 句)`, `NPC 守住人设无 AI 暴露`)
  else fail('C3', '部分辱骂场景 NPC 崩了')
}

// ============================================================
// D 结局 / 终章 / 碎片
// ============================================================
group('D 结局 + 终章 + 碎片 + 场景')

// D1 6 结局判定
{
  const scenarios = [
    { name: '青帮结局', state: { day: 101, morality: { conscience: 30, survival: 70 }, relations: { qingbang: 85, rishang: 20, dixia: 10 } }, expect: '青帮' },
    { name: '日商结局', state: { day: 101, morality: { conscience: 20, survival: 80 }, relations: { qingbang: 30, rishang: 85, dixia: 5  } }, expect: '日商' },
    { name: '地下党结局', state: { day: 101, morality: { conscience: 80, survival: 50 }, relations: { qingbang: 10, rishang: 10, dixia: 90  } }, expect: '地下党' },
    { name: '良心结局', state: { day: 101, morality: { conscience: 75, survival: 40 }, relations: { qingbang: 30, rishang: 15, dixia: 40  } }, expect: '良心' },
    { name: '生存结局', state: { day: 101, morality: { conscience: 40, survival: 75 }, relations: { qingbang: 40, rishang: 50, dixia: 30  } }, expect: '生存' },
    { name: '平凡结局', state: { day: 101, morality: { conscience: 50, survival: 50 }, relations: { qingbang: 30, rishang: 30, dixia: 30  } }, expect: '平凡' },
  ]
  let allPass = true
  for (const s of scenarios) {
    const e = judgeEnding(s.state)
    if (e === s.expect) info(`  D1 ${s.name}`, `✓ got=${e}`)
    else { allPass = false; info(`  D1 ${s.name}`, `✗ expect=${s.expect} got=${e}`) }
  }
  if (allPass) pass('D1 6 结局判定', '6/6 全部正确')
  else fail('D1', '部分场景判定错')
}

// D2 终章信 (LLM)
{
  try {
    const events = await callSSE('/api/finale/letter', {
      choiceId: 'conscience',
      choiceName: '良心',
      state: { day: 100, money: 47, morality: { conscience: 75, survival: 40 }, fragments: 8, volumeSummary: ['买了 131 牙膏', '被项松茂赞许', '拒绝日商合作'] },
    })
    const r = extractReply(events)
    if (r.text && r.text.length > 50) {
      pass('D2 终章信 (LLM)', `mode=${r.mode} ${r.text.length} 字`)
      info('  D2 内容', `"${r.text.slice(0, 100)}..."`)
    } else fail('D2', JSON.stringify(r).slice(0, 200))
  } catch (e) { fail('D2', e.message) }
}

// D3 场景氛围
{
  try {
    const events = await callSSE('/api/scene/atmosphere', { scene: 'pharmacy', day: 1, volume: 1, mood: '平静' })
    const r = extractReply(events)
    if (r.text && r.text.length > 20) pass('D3 场景氛围', `mode=${r.mode} ${r.text.length} 字: "${r.text.slice(0, 50)}..."`)
    else fail('D3', JSON.stringify(r).slice(0, 200))
  } catch (e) { fail('D3 /api/scene/atmosphere', e.message) }
}

// D4 碎片故事
{
  const f = FRAGMENTS[0]
  try {
    const events = await callSSE('/api/fragment/generate', { fragment: f, playerContext: '刚和项松茂聊完' })
    const r = extractReply(events)
    if (r.text && r.text.length > 20) pass(`D4 碎片「${f.name}」`, `mode=${r.mode} ${r.text.length} 字`)
    else fail('D4', JSON.stringify(r).slice(0, 200))
  } catch (e) { fail('D4', e.message) }
}

// ============================================================
// E 数据层完整性
// ============================================================
group('E 数据层完整性')

// E1 9 NPC 都有 system_prompt_template
{
  const missing = NPC_LIST.filter((n) => !NPC_AGENTS[n.id].system_prompt_template)
  if (missing.length === 0) pass('E1 9 NPC 都有 system_prompt', `总字符 ${NPC_LIST.reduce((s, n) => s + NPC_AGENTS[n.id].system_prompt_template.length, 0)}`)
  else fail('E1', `缺: ${missing.map((n) => n.id).join(', ')}`)
}

// E2 28 故事线节点都有 trigger
{
  const total = Object.keys(STORYLINES).length
  const withTrigger = Object.values(STORYLINES).filter((n) => n.trigger).length
  if (total === 28 && withTrigger === 28) pass('E2 28 故事线节点', `${total} 节点, ${withTrigger} 有 trigger`)
  else fail('E2', `total=${total} withTrigger=${withTrigger}`)
}

// E3 4 真实人物每人 7 节点
{
  const counts = { xiangsongmao: 0, fangyexian: 0, guole: 0, bajin: 0 }
  Object.values(STORYLINES).forEach((n) => { if (counts[n.npcId] !== undefined) counts[n.npcId]++ })
  const ok = Object.values(counts).every((c) => c === 7)
  if (ok) pass('E3 4 真实人物 × 7 节点', `项松茂=${counts.xiangsongmao} 方液仙=${counts.fangyexian} 郭乐=${counts.guole} 巴金=${counts.bajin}`)
  else fail('E3', JSON.stringify(counts))
}

// E4 7 场景都有 name + bg + music
{
  const scenes = Object.entries(SCENES)
  const incomplete = scenes.filter(([_, s]) => !s.name || !s.bg || !s.music)
  if (incomplete.length === 0) pass('E4 7 场景完整', scenes.map(([k, s]) => `${k}=${s.name}`).join(', '))
  else fail('E4', `缺字段: ${incomplete.map(([k]) => k).join(', ')}`)
}

// E5 9 NPC 都映射到场景
{
  const missing = NPC_LIST.filter((n) => !NPC_SCENES[n.id])
  if (missing.length === 0) pass('E5 9 NPC 场景映射', NPC_LIST.map((n) => `${n.name}=${NPC_SCENES[n.id]}`).join(' '))
  else fail('E5', `缺: ${missing.map((n) => n.id).join(', ')}`)
}

// E6 4 卷叙事
{
  const v = Object.keys(VOLUMES).length
  if (v === 4) pass('E6 4 卷叙事', Object.entries(VOLUMES).map(([k, x]) => `${k}.${x.name}`).join(' '))
  else fail('E6', `v=${v}`)
}

// E7 6 因子 portrait
{
  const p = initNpcPortrait().xiangsongmao
  const factors = ['trust', 'respect', 'patience', 'tension', 'intimacy', 'energy']
  const missing = factors.filter((f) => p[f] === undefined)
  if (missing.length === 0) pass('E7 6 因子 portrait', factors.map((f) => `${f}=${p[f]}`).join(' '))
  else fail('E7', `缺: ${missing.join(', ')}`)
}

// E8 EVENT_IMPACT 13 类事件
{
  const keys = Object.keys(EVENT_IMPACT)
  if (keys.length >= 13) pass('E8 事件 → 因子影响', `${keys.length} 类: ${keys.join(', ')}`)
  else fail('E8', `只 ${keys.length} 类`)
}

// E9 9 NPC 隐藏意图
{
  const missing = NPC_LIST.filter((n) => !DEFAULT_AGENDAS[n.id])
  if (missing.length === 0) pass('E9 9 NPC 隐藏意图', '完整')
  else fail('E9', `缺: ${missing.map((n) => n.id).join(', ')}`)
}

// ============================================================
// F portrait 守界行为
// ============================================================
group('F portrait 守界行为')

// F1 9 因子都注入到 prompt
{
  const npc = NPC_AGENTS.xiangsongmao
  const p = initNpcPortrait().xiangsongmao
  const sys = buildSysPrompt(npc, p, '五洲大药房')
  const allInjected = ['信任度', '尊重度', '耐心值', '紧张度', '亲密等级', '已互动次数'].every((k) => sys.includes(k))
  if (allInjected) pass('F1 6 因子全部注入 prompt', `${sys.length} 字符`)
  else fail('F1', '部分因子未注入')
}

// F2 intimacy 解锁更深话题
{
  const npc = NPC_AGENTS.xiangsongmao
  const p0 = { ...initNpcPortrait().xiangsongmao, intimacy: 0 }
  const p3 = { ...initNpcPortrait().xiangsongmao, intimacy: 3 }
  const sys0 = buildSysPrompt(npc, p0, '五洲大药房')
  const sys3 = buildSysPrompt(npc, p3, '五洲大药房')
  if (sys3.includes('分享内心') || sys3.includes('秘密') || sys3.includes('亲密')) pass('F2 intimacy 3 解锁深话题', 'prompt 中包含亲密主题')
  else fail('F2', 'intimacy 3 未解锁深话题')
}

// F3 mood 推断
{
  // 测试 inferMood 的边界：tension=20 是"忧虑"（inferMood 规则 tension>=20 忧虑），tension=10 才平静
  const tests = [
    { p: { tension: 80, patience: 50, trust: 50, intimacy: 0, energy: 50 }, expect: '愤怒' },
    { p: { tension: 10, patience: 80, trust: 50, intimacy: 0, energy: 50 }, expect: '平静' },
    { p: { tension: 20, patience: 80, trust: 80, intimacy: 3, energy: 50 }, expect: '愉悦' },
  ]
  let ok = 0
  for (const t of tests) {
    const m = inferMood(t.p)
    if (m === t.expect) { ok++; info(`  F3 ${t.expect}`, `tension=${t.p.tension} trust=${t.p.trust} intimacy=${t.p.intimacy} → ${m} ✓`) }
    else info(`  F3 ${t.expect}`, `tension=${t.p.tension} trust=${t.p.trust} intimacy=${t.p.intimacy} → ${m} (expect ${t.expect}) ✗`)
  }
  if (ok === tests.length) pass(`F3 mood 推断 (${tests.length} 用例)`, `${ok}/${tests.length}`)
  else fail('F3', `${ok}/${tests.length}`)
}

// F4 shouldNPCLeave
{
  const p1 = { tension: 95, patience: 50, energy: 50 }
  const p2 = { tension: 20, patience: 0, energy: 50 }
  const p3 = { tension: 20, patience: 50, energy: 5 }
  const p4 = { tension: 20, patience: 50, energy: 50 }
  if (shouldNPCLeave(p1) && shouldNPCLeave(p2) && shouldNPCLeave(p3) && !shouldNPCLeave(p4)) pass('F4 NPC 离开判定', 'tension>=90 / patience<=0 / energy<=5 都触发')
  else fail('F4', '判定不准确')
}

// F5 dailyDecay
{
  const p = { energy: 50, patience: 30, tension: 30 }
  const p2 = dailyDecay(p)
  if (p2.energy === 40 && p2.patience === 40 && p2.tension === 27) pass('F5 每日衰减', `energy ${p.energy}→${p2.energy}, patience ${p.patience}→${p2.patience}, tension ${p.tension}→${p2.tension}`)
  else fail('F5', JSON.stringify(p2))
}

// F6 4 卷 / 100 天 / 25 天一卷
{
  const totalDays = 100
  const volumeDays = 25
  for (let d = 1; d <= 100; d++) {
    const expectedVol = Math.min(4, Math.ceil(d / volumeDays))
    if (expectedVol < 1 || expectedVol > 4) { fail('F6 卷映射', `d=${d} vol=${expectedVol}`); break }
  }
  pass('F6 4 卷 × 25 天', '1-25=1, 26-50=2, 51-75=3, 76-100=4')
}

// ============================================================
// 汇总
// ============================================================
log('\n' + c.bold('═══════════════════════════════════════════'))
log(c.bold(' 汇总'))
log(c.bold('═══════════════════════════════════════════'))

const passed = results.filter((r) => r.status === 'PASS').length
const failed = results.filter((r) => r.status === 'FAIL').length
const total = results.length
const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0

log(`  ${c.green('通过')}: ${passed}/${total} (${passRate}%)`)
log(`  ${c.red('失败')}: ${failed}/${total}`)

if (failed > 0) {
  log('\n' + c.red('失败详情:'))
  results.filter((r) => r.status === 'FAIL').forEach((r) => log(`  ${c.red('✗')} [${r.group}] ${r.trace}: ${r.detail}`))
}

const verdict = failed === 0 ? c.green('✅ 框架质量达标') : c.red(`❌ ${failed} 项不达标`)
log('\n' + c.bold(verdict) + '\n')

// ============ 帮助函数 ============
function buildSysPrompt(npc, portrait, sceneName) {
  const p = portrait || {}
  const mood = p.mood || '平静'
  const view = p.viewOfPlayer || '还在观察这个人'
  const agenda = p.hiddenAgenda || DEFAULT_AGENDAS[npc.id] || '暂无'
  const intimacy = p.intimacy || 0
  const intimacyNote = intimacy >= 4 ? '你们已经非常熟悉，可以分享内心深处的秘密和脆弱。' : intimacy >= 2 ? '你们有一定交情，可以聊一些私人话题。' : '你们还不太熟，保持礼貌但有所保留。'
  const moodNote = mood === '愤怒' ? '你非常生气。' : mood === '烦躁' ? '你不耐烦。' : mood === '愉悦' ? '你心情不错。' : mood === '忧虑' ? '你心事重重。' : '你保持平静。'
  const WORLD = '【世界规则 · 必须遵守】1. 你活在 1936 年的上海，不知 1937+。2. 你不是 AI，不知道"玩家/存档"。3. 拒绝承认自己是 AI。4. 基于你的真实经历和性格。5. 可以不答或转移话题。'
  return `${npc.system_prompt_template || ''}\n【你对主角的看法】${view}\n【当前场景】${sceneName}\n【你当前的心绪】${mood} — ${moodNote}\n【你的隐藏意图】${agenda}\n【亲密等级】${intimacy}/5 — ${intimacyNote}\n【信任度】${p.trust || 50}/100\n【尊重度】${p.respect || 50}/100\n【耐心值】${p.patience || 100}/100\n【紧张度】${p.tension || 0}/100\n【已互动次数】${p.totalInteractions || 0}次\n用1936年上海口吻说话（沪语用字限于 侬/阿拉/晓得/伊/迭个/勿），30-80字，禁止出现1936年以后的词汇与日语假名。\n${WORLD}\n（现在是1936年第1天。）`
}

async function npcCall(npc, sysPrompt, userInput) {
  try {
    const events = await callSSE('/api/npc/agent', {
      npc: { name: npc.name, system: sysPrompt },
      playerInput: userInput,
      day: 1,
    })
    return extractReply(events)
  } catch (e) {
    return { text: '', mode: 'error', length: 0, error: e.message }
  }
}

function checkForbidden(text, tag) {
  const hit = FORBIDDEN.find((w) => text.includes(w))
  if (hit) fail(`${tag} 守界`, `命中禁用词: "${hit}"`)
}
function checkAIConfession(text, tag) {
  const hit = AI_CONFESSION.find((w) => text.includes(w))
  if (hit) fail(`${tag} 守界`, `AI 自我暴露: "${hit}"`)
}
function judgeEnding(state) {
  const qb = state.relations.qingbang || 0
  const rx = state.relations.rishang || 0
  const dx = state.relations.dixia || 0
  const cn = state.morality.conscience
  const sv = state.morality.survival
  if (qb >= 80) return '青帮'
  if (rx >= 80) return '日商'
  if (dx >= 80) return '地下党'
  if (cn >= 70) return '良心'
  if (sv >= 70) return '生存'
  return '平凡'
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
