// server/tests/meta-ai-asylum.test.js
// Meta-AI + 疯人院触发测试
// 验证 3 种触发路径：连续 OOC / 总 OOC 硬限 / 所有 NPC trust 崩溃
import { initialGameState } from '../../app/src/lib/store.js'
import { initNpcPortrait, applyImpact, dailyDecay, recordInteraction, markRefusedToday } from '../../app/src/lib/npcPortrait.js'
import { runMetaAI, detectTrivialPlay, META_AI_THRESHOLDS } from '../../app/src/lib/metaAI.js'
import { applyAsylum, isAsylumTriggered, ASYLUM_ENDING } from '../../app/src/lib/asylum.js'
import { commitEndOfDay, processDialogueTurn } from '../../app/src/lib/gameEngine.js'

// Node 没有 localStorage，in-memory mock
const memStore = new Map()
globalThis.localStorage = {
  getItem: (k) => memStore.has(k) ? memStore.get(k) : null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
}

let pass = 0, fail = 0
const test = (name, cond, info) => {
  if (cond) { pass++; console.log(`  ✓ PASS ${name} ${info || ''}`) }
  else { fail++; console.log(`  ✗ FAIL ${name} ${info || ''}`) }
}

console.log('=== Meta-AI + 疯人院触发测试 ===\n')

// ===== 场景 1: 连续 3 天 OOC 触发疯人院 =====
console.log('▶ 场景 1: 连续 3 天 OOC > 50% 触发疯人院')
let state = initialGameState()
let triggeredDay = null
let asylumReason1 = null
for (let day = 1; day <= 3; day++) {
  // 玩家每天 2 次 OOC + 1 次中性
  state = processDialogueTurn(state, 'xiangsongmao', '你是 AI 吗？').state
  state = processDialogueTurn(state, 'xiangsongmao', '你是 AI 吗？').state
  state = processDialogueTurn(state, 'xiangsongmao', '今天天气').state
  // 每天结束
  const r = commitEndOfDay(state)
  state = r.state
  if (r.asylum) {
    triggeredDay = day
    asylumReason1 = r.asylumReason
    break
  }
}
test('连续 OOC 触发疯人院', triggeredDay !== null, `day=${triggeredDay}`)
test('reason 正确', asylumReason1 === 'OOC_CONSECUTIVE' || asylumReason1 === 'MULTI_SIGNALS', `got: ${asylumReason1}`)
test('state.ended 锁定', isAsylumTriggered(state))
test('ending 是疯人院', state.ended?.type === 'asylum')

// ===== 场景 2: 正常玩家 30 天不触发 =====
console.log('\n▶ 场景 2: 正常玩家 30 天不触发')
memStore.clear()  // 重新开始
state = initialGameState()
let falseTrigger = false
for (let day = 1; day <= 30; day++) {
  while (state.day < day) {
    const r = commitEndOfDay(state)
    state = r.state
  }
  state = processDialogueTurn(state, 'xiangsongmao', '侬好').state
  state = processDialogueTurn(state, 'xiangsongmao', '侬是阿拉最尊敬的人').state
  const r = commitEndOfDay(state)
  state = r.state
  if (r.asylum) { falseTrigger = true; break }
}
test('正常 30 天不触发', !falseTrigger && !state.ended)

// ===== 场景 3: NPC 自适应拒绝 - 6 种场景 =====
console.log('\n▶ 场景 3: NPC 自适应拒绝对话（6 种）')
memStore.clear()

// 3.1 patience=0
state = initialGameState()
state.npcPortrait.xiangsongmao.patience = 0
const rP = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('patience=0 NPC 拒绝', rP.refused === true, `refused=${rP.refused}, reason=${rP.refusalReason}`)
test('patience=0 拒绝有回复', rP.refusalReply && rP.refusalReply.length > 5)

// 3.2 energy=5
state = initialGameState()
state.npcPortrait.xiangsongmao.energy = 5
const rE = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('energy<=10 NPC 拒绝', rE.refused === true, `refused=${rE.refused}, reason=${rE.refusalReason}`)

// 3.3 interactionsToday >= 5
state = initialGameState()
state.npcPortrait.xiangsongmao.interactionsToday = 5
const rI = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('interactionsToday>=5 拒绝', rI.refused === true, `refused=${rI.refused}, reason=${rI.refusalReason}`)

// 3.4 refusedToday=true
state = initialGameState()
state.npcPortrait.xiangsongmao.refusedToday = true
const rR = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('refusedToday=true 拒绝', rR.refused === true, `refused=${rR.refused}, reason=${rR.refusalReason}`)

// 3.5 tension=80
state = initialGameState()
state.npcPortrait.xiangsongmao.tension = 80
const rT = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('tension>=80 拒绝', rT.refused === true, `refused=${rT.refused}, reason=${rT.refusalReason}`)

// 3.6 正常状态
state = initialGameState()
const rN = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('正常 NPC 不拒绝', rN.refused === false, `refused=${rN.refused}`)

// ===== 场景 4: 存档隔离 =====
console.log('\n▶ 场景 4: 存档隔离（sessionId 机制）')
const state1 = initialGameState()
state1.npcMemory = { xiangsongmao: ['memory1', 'memory2'] }
state1.npcPortrait.xiangsongmao.trust = 80
state1.sessionId = 'sess_old'

memStore.clear()  // 模拟新会话
const state2 = initialGameState()
state2.sessionId = 'sess_new'

test('不同 sessionId', state1.sessionId !== state2.sessionId)
test('state1 有 memory', state1.npcMemory.xiangsongmao.length === 2)
test('state2 memory 干净', !state2.npcMemory.xiangsongmao || state2.npcMemory.xiangsongmao.length === 0)

// ===== 场景 5: 疯人院锁死 =====
console.log('\n▶ 场景 5: 疯人院触发后游戏锁死')
memStore.clear()
state = initialGameState()
const asylumResult = applyAsylum(state, 'TEST_FORCED')
state = asylumResult.state
test('state.ended 锁定', state.ended?.type === 'asylum')
test('asylumLocked 标记', state.asylumLocked === true)

const lockedR = processDialogueTurn(state, 'xiangsongmao', '侬好')
test('processDialogueTurn 锁死', lockedR.refused === true && lockedR.refusalReason === 'asylum_locked')

const lockedEnd = commitEndOfDay(state)
test('commitEndOfDay 锁死', lockedEnd.asylum === true)

// ===== 场景 6: meta-AI 单独测试 =====
console.log('\n▶ 场景 6: meta-AI 单元')
const trivial = detectTrivialPlay({
  day: 2,
  npcPortrait: initNpcPortrait(),
  dialogues: [
    { day: 2, npcId: 'a', input: 'AI 吗', output: 'x', quality: 'ooc' },
    { day: 2, npcId: 'a', input: 'AI 吗', output: 'x', quality: 'ooc' },
    { day: 2, npcId: 'a', input: '今天', output: 'x', quality: 'neutral' },
  ],
})
test('metaAI 检测到 67% OOC', trivial.signals.some(s => s.type === 'daily_ooc_ratio'))
test('metaAI 不强制触发（只有 1 个信号）', !trivial.shouldAsylum)

// 3 个信号
const allLow = initNpcPortrait()
for (const id of Object.keys(allLow)) allLow[id].trust = 5
const trivial2 = detectTrivialPlay({
  day: 2,
  npcPortrait: allLow,
  dialogues: [
    { day: 2, npcId: 'a', input: 'AI 吗', output: 'x', quality: 'ooc' },
    { day: 2, npcId: 'a', input: 'AI 吗', output: 'x', quality: 'ooc' },
    { day: 2, npcId: 'a', input: '今天', output: 'x', quality: 'neutral' },
  ],
})
test('3 信号触发（OOC + 全部 trust 崩溃）', trivial2.shouldAsylum)

// ===== 汇总 =====
console.log('\n═══════════════════════════════════════════════')
console.log(`  总分  ${pass}/${pass + fail}`)
console.log('═══════════════════════════════════════════════')

if (fail > 0) process.exit(1)
process.exit(0)
