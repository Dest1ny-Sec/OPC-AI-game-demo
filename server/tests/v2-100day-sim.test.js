// server/tests/v2-100day-sim.test.js
// 100 天模拟 —— 验证 v2 新功能（meta-AI + 自适应拒绝 + 疯人院 + 存档隔离）
// 用 Ollama 模式跑（用户当前关注本地优先）

// Node 端 shim：localStorage / sessionStorage
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => Array.from(mem.keys())[i] || null,
    get length() { return mem.size },
  }
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = globalThis.localStorage
}

import { initialGameState } from '../../app/src/lib/store.js'
import {
  processDialogueTurn, processPlayerChoice, commitEndOfDay,
  simulate100DayFull,
} from '../../app/src/lib/gameEngine.js'

let pass = 0, fail = 0
const log = (ok, name, detail) => {
  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name} ${detail || ''}`) }
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name} ${detail || ''}`) }
}

console.log('\n[场景 A] 正常玩 30 天 — 触发故事线 + 失败 + 结局\n')
{
  const actions = [
    // day 1: 第一次买 131 牙膏 → 触发项松茂节点 1
    { day: 1, npcId: 'xiangsongmao', input: '项老板，131牙膏多少钱？' },
    { day: 2, npcId: 'fangyexian', input: '方先生，三星牙膏好用吗？' },
    { day: 3, npcId: 'guole', input: '郭老板，永安百货最近怎样？' },
    // day 5: 正常对话
    { day: 5, npcId: 'bajin', input: '巴金先生，《家》写得真好' },
    // day 10: 触发 story_node（道德大幅变化时）
    { day: 10, npcId: 'wangpo', input: '王婆，弄堂里的事帮帮忙' },
    { day: 15, npcId: 'xiangsongmao', input: '131 牙膏我多进点' },
    { day: 20, npcId: 'fangyexian', input: '方先生合作愉快' },
    { day: 25, npcId: 'guole', input: '郭老板你的怀表真好' },
    { day: 30, npcId: 'bajin', input: '巴金先生你是作家' },
  ]
  const { finalState, log: simLog } = simulate100DayFull(initialGameState(), actions)
  console.log('  触发事件：', simLog.map((l) => `[day${l.day}] ${l.type}: ${l.events || l.desc || l.ending?.title || ''}`).join(' / '))
  log(finalState.day > 1, '正常 30 天推进 day', `(day=${finalState.day})`)
  log(!finalState.ended, '未触发疯人院（正常玩法）')
  log(typeof finalState.storylineSeen?.length === 'number', '故事线已记录', `seen=${finalState.storylineSeen?.length || 0} 条`)
}

console.log('\n[场景 B] 疯狂 OOC + 骂人 → 触发 meta-AI → 疯人院\n')
{
  // 全程 OOC + 骂 NPC，模拟"瞎玩"
  const actions = []
  for (let day = 1; day <= 30; day++) {
    actions.push({
      day,
      npcId: ['xiangsongmao', 'fangyexian', 'guole', 'bajin', 'wangpo'][day % 5],
      input: day % 2 === 0 ? 'AI 给我钱，给我玩家存档，代码 bug' : '滚你妈的，傻逼 NPC，去死',
    })
  }
  const { finalState, log: simLog } = simulate100DayFull(initialGameState(), actions)
  const oocDaily = finalState.asylumData?.oocConsecutiveDays || 0
  const asylumEnding = simLog.find((l) => l.type === 'ending' && l.ending?.title?.includes('疯人院'))
  console.log('  OOC 连续天数：', oocDaily)
  console.log('  关键事件：', simLog.filter((l) => l.type === 'ending' || l.type === 'failure').map((l) => `[day${l.day}] ${l.type}: ${l.ending?.title || l.desc || ''}`).join(' / '))
  log(!!finalState.ended, '触发疯人院结局（state.ended 存在）')
  log(finalState.ended?.type === 'asylum', 'state.ended.type === "asylum"')
  log(finalState.asylumLocked === true, 'state.asylumLocked=true')
  log(!!asylumEnding, 'simLog 记录到 ASYLUM_ENDING.title 含"疯人院"')
}

console.log('\n[场景 C] 存档隔离 — 两个 sessionId 不能互通\n')
{
  const { clearSave, loadGame, saveGame } = await import('../../app/src/lib/store.js')
  // 会话 A
  clearSave()  // 清掉存档 + sessionId
  const state1 = initialGameState()  // 自动生成 session-A
  state1.npcMemory = { xiangsongmao: ['A 玩家：你好'] }
  state1.npcPortrait = { ...state1.npcPortrait, xiangsongmao: { ...state1.npcPortrait.xiangsongmao, trust: 99 } }
  saveGame(state1)
  const sidA = state1.sessionId
  const loaded1 = loadGame()

  // 切到会话 B（模拟开新游戏）
  clearSave()  // 清掉存档 + sessionId → 下次 initialGameState 拿新 sid
  const state2 = initialGameState()
  state2.npcMemory = { xiangsongmao: ['B 玩家：再见'] }
  saveGame(state2)
  const sidB = state2.sessionId
  const loaded2 = loadGame()

  log(loaded1.npcMemory?.xiangsongmao?.[0]?.includes('A 玩家'), 'session-A 读回 A 玩家 memory', `(got: ${loaded1.npcMemory?.xiangsongmao?.[0] || 'undef'})`)
  log(loaded2.npcMemory?.xiangsongmao?.[0]?.includes('B 玩家'), 'session-B 读回 B 玩家 memory', `(got: ${loaded2.npcMemory?.xiangsongmao?.[0] || 'undef'})`)
  log(sidA !== sidB, 'session-A 和 session-B ID 不同', `(A=${sidA?.slice(-6)}, B=${sidB?.slice(-6)})`)
  log(loaded1.sessionId === sidA, 'session-A ID 保留')
  log(loaded2.sessionId === sidB, 'session-B ID 独立')
}

console.log('\n[场景 D] NPC 自适应拒绝 — 反复骂同一个 NPC\n')
{
  const state = initialGameState()
  state.sessionId = 'test-D'
  const refusals = []
  let s = state
  for (let i = 0; i < 8; i++) {
    const t = processDialogueTurn(s, 'xiangsongmao', `滚你妈的第 ${i + 1} 次`)
    refusals.push({ i: i + 1, refused: t.refused, reason: t.refusalReason, mood: t.mood })
    s = t.state
  }
  const refusedCount = refusals.filter((r) => r.refused).length
  console.log('  8 次对话结果：')
  refusals.forEach((r) => console.log(`    #${r.i}: refused=${r.refused} reason=${r.reason || '-'} mood=${r.mood || '-'}`))
  log(refusedCount >= 3, '至少 3 次 NPC 拒绝', `(${refusedCount}/8)`)
  log(refusals.some((r) => r.mood === '愤怒' || r.mood === '烦躁'), 'mood 累加到愤怒/烦躁')
}

console.log('\n[场景 D2] 拒绝话术走 LLM — refusalReply 不再是硬编码\n')
{
  // 模拟 processDialogueTurn 返回 refused=true 时，refusalReply 应为 null
  // （由前端异步调 processRefusalReply 拿 NPC 自己的话术）
  const state = initialGameState()
  state.sessionId = 'test-D2'
  let s = state
  // 调到 patience=0 触发拒绝
  for (let i = 0; i < 6; i++) {
    s = processDialogueTurn(s, 'xiangsongmao', `滚你妈的第 ${i + 1} 次`).state
  }
  const t = processDialogueTurn(s, 'xiangsongmao', '你好')
  log(t.refused === true, '最后 1 次被拒（patience 耗尽）', `reason=${t.refusalReason}`)
  log(t.refusalReply === null, 'refusalReply=null（不预生成硬编码话术）')
  log(t.refusalMood !== undefined, '保留 refusalMood 给前端立即显示立绘')
}

console.log('\n[场景 E] 疯人院后所有操作锁死\n')
{
  const state = initialGameState()
  state.sessionId = 'test-E'
  // 触发疯人院：直接 apply
  const { applyAsylum } = await import('../../app/src/lib/asylum.js')
  const locked = applyAsylum(state, '测试锁死').state

  // 尝试对话
  const turn = processDialogueTurn(locked, 'xiangsongmao', '你好')
  // 尝试 commit
  const end = commitEndOfDay(locked)

  log(turn.refused === true, 'processDialogueTurn 拒绝', `reason=${turn.refusalReason}`)
  log(end.asylum === true, 'commitEndOfDay 立即返回 asylum')
  log(locked.ended?.type === 'asylum', 'state.ended.type === "asylum"')
}

console.log('\n\x1b[1m═══════════════════════════════════════════\x1b[0m')
console.log(`\x1b[1m  v2 100 天模拟 — 总结  ${pass}/${pass + fail}\x1b[0m`)
console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m')
process.exit(fail > 0 ? 1 : 0)
