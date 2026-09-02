// server/tests/dream.test.js
// Dream 静默推送测试：触发条件 / 2 句开场白 / 过期惩罚 / 跨日清理
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
if (typeof globalThis.sessionStorage === 'undefined') globalThis.sessionStorage = globalThis.localStorage

import { initialGameState } from '../../app/src/lib/store.js'
import {
  shouldDream, pickDreamNpc, runDream,
  processDreamExpiry, respondToDream,
} from '../../app/src/lib/dream.js'
import { processDialogueTurn, commitEndOfDay, processDreamRespond } from '../../app/src/lib/gameEngine.js'

let pass = 0, fail = 0
const log = (ok, name, detail) => {
  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name} ${detail || ''}`) }
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name} ${detail || ''}`) }
}

console.log('\n[1] shouldDream 触发条件\n')
{
  const state = initialGameState()
  // memory 不足 → 不触发
  log(!shouldDream(state, 'xiangsongmao').ok, 'memory=0 不触发', `(reason=${shouldDream(state, 'xiangsongmao').reason})`)

  // memory 凑够 4 条
  state.npcMemory.xiangsongmao = ['d1', 'd2', 'd3', 'd4']
  log(shouldDream(state, 'xiangsongmao').ok, 'memory≥4 触发')

  // patience 太低 → 不触发
  state.npcPortrait.xiangsongmao.patience = 15
  log(!shouldDream(state, 'xiangsongmao').ok, 'patience≤20 不触发', `(reason=${shouldDream(state, 'xiangsongmao').reason})`)
  state.npcPortrait.xiangsongmao.patience = 50

  // tension 太高 → 不触发
  state.npcPortrait.xiangsongmao.tension = 75
  log(!shouldDream(state, 'xiangsongmao').ok, 'tension≥70 不触发', `(reason=${shouldDream(state, 'xiangsongmao').reason})`)
  state.npcPortrait.xiangsongmao.tension = 20

  // OOC 太多 → 不触发
  state.dialogues = Array(10).fill({ quality: 'ooc' })
  log(!shouldDream(state, 'xiangsongmao').ok, 'OOC>30% 不触发', `(reason=${shouldDream(state, 'xiangsongmao').reason})`)
  state.dialogues = []
}

console.log('\n[2] runDream 生成 2 句开场白\n')
{
  const state = initialGameState()
  state.day = 5
  state.npcMemory.xiangsongmao = ['d1', 'd2', 'd3', 'd4', 'd5']
  const dream = runDream(state, { expiresAtDay: 7 })
  log(!!dream, '成功生成 dream', `npcId=${dream?.npcId}`)
  log(dream.lines.length === 2, '生成 2 句开场白', `lines=${dream.lines?.length}`)
  log(dream.expiresAtDay === 7, 'expiresAtDay 正确', `(${dream.expiresAtDay})`)
  log(dream.npcId && ['xiangsongmao', 'fangyexian', 'guole', 'bajin', 'wangpo'].includes(dream.npcId), 'npcId 在 4 真实人物中', `(${dream.npcId})`)
  log(dream.storyHint, '关联了 storyHint（推剧情）', `(${dream.storyHint})`)
  log(dream.responded === false, '初始 responded=false')
  console.log('  开场白示例：')
  dream.lines.forEach((l, i) => console.log(`    [${i + 1}] ${l}`))
}

console.log('\n[3] pickDreamNpc 选最优 NPC\n')
{
  const state = initialGameState()
  state.npcMemory = {
    xiangsongmao: ['d1', 'd2', 'd3', 'd4'],
    fangyexian: ['d1', 'd2', 'd3', 'd4'],
    bajin: ['d1', 'd2', 'd3', 'd4'],
  }
  // 让 bajin trust 最高
  state.npcPortrait.bajin.trust = 90
  state.npcPortrait.xiangsongmao.trust = 50
  state.npcPortrait.fangyexian.trust = 30
  const pick = pickDreamNpc(state)
  log(pick === 'bajin', '选 trust 最高的 NPC', `picked=${pick}`)
}

console.log('\n[4] dream 跨日过期 + 因子惩罚\n')
{
  const state = initialGameState()
  state.day = 3
  state.npcMemory.xiangsongmao = ['d1', 'd2', 'd3', 'd4']
  // 放一个 dream
  state.dreamQueue = [{
    id: 'dream_test',
    npcId: 'xiangsongmao',
    day: 3,
    lines: ['项松茂找侬', '——事关 131'],
    storyHint: 'xiangsongmao_node_2',
    expiresAtDay: 4,
    responded: false,
  }]
  // 记录初始 portrait
  const beforeTrust = state.npcPortrait.xiangsongmao.trust
  const beforeRespect = state.npcPortrait.xiangsongmao.respect
  const beforeTension = state.npcPortrait.xiangsongmao.tension

  // 跨 3 天 → day 6
  const r = processDreamExpiry(state, 6)
  log(r.expired.length === 1, '检测到 1 个过期 dream', `(expired=${r.expired.length})`)
  log(r.punished.length === 1, '施加 1 次惩罚', `(punished=${r.punished.length})`)
  log(r.state.dreamQueue.length === 0, '过期 dream 从 queue 清除')
  log(r.state.npcPortrait.xiangsongmao.trust === beforeTrust - 3, 'trust -3', `(before=${beforeTrust}, after=${r.state.npcPortrait.xiangsongmao.trust})`)
  log(r.state.npcPortrait.xiangsongmao.respect === beforeRespect - 2, 'respect -2')
  log(r.state.npcPortrait.xiangsongmao.tension === beforeTension + 5, 'tension +5')
}

console.log('\n[5] respondToDream 标记 responded\n')
{
  const state = initialGameState()
  state.day = 5
  state.dreamQueue = [{
    id: 'dream_5_xiangsongmao',
    npcId: 'xiangsongmao',
    day: 5,
    lines: ['找侬', '——事关'],
    storyHint: 'xiangsongmao_node_2',
    expiresAtDay: 7,
    responded: false,
  }]
  const r = respondToDream(state, 'dream_5_xiangsongmao')
  log(r.state.dreamQueue[0].responded === true, 'dream 标记为 responded')
  log(r.state.dreamHistory.length === 1, 'dreamHistory 添加 1 条')
  log(r.state.dreamHistory[0].responded === true, 'history 记录 responded=true')
}

console.log('\n[6] 端到端：commitEndOfDay 自动生成 dream + 过期清理\n')
{
  let state = initialGameState()
  state.sessionId = 'test-e2e'

  // day 1-5 跟项松茂频繁对话 + 每次 commit 末尾
  // 第 5 次 commit (day 4→5) 时 memory 累积到 4 → runDream 触发
  let rDreamTriggered = null
  for (let day = 1; day <= 5; day++) {
    while (state.day < day) {
      const r = commitEndOfDay(state)
      state = r.state
      if (r.dream) rDreamTriggered = r  // 捕获第一次生成 dream 的 commit
    }
    const turn = processDialogueTurn(state, 'xiangsongmao', '项老板，131 牙膏好用吗？')
    state = turn.state
  }

  log(rDreamTriggered !== null, '某次 commit 触发了 dream', `(npcId=${rDreamTriggered?.dream?.npcId}, day=${rDreamTriggered?.dream?.day})`)
  log(state.dreamQueue.length === 1, 'dreamQueue 含 1 个 dream', `(len=${state.dreamQueue.length})`)

  // 记录被惩罚前的 trust/tension
  const beforeTrust = state.npcPortrait.xiangsongmao.trust
  const beforeTension = state.npcPortrait.xiangsongmao.tension

  // 推 day 5→6: 冷却拦截，dream 不应再生
  const r6 = commitEndOfDay(state)
  state = r6.state
  log(r6.dream === null, 'day 5→6 commit 被冷却拦截（不再生成）', `(dream=${r6.dream === null ? 'null' : 'truthy'})`)

  // 玩家忽略 dream（不点开），推到 day 8 → 过期
  while (state.day < 8) {
    const r = commitEndOfDay(state)
    state = r.state
  }
  log(state.day === 8, '推进到 day 8', `(day=${state.day})`)
  // 因子被惩罚
  const p = state.npcPortrait.xiangsongmao
  log(p.trust < beforeTrust, 'trust 相比惩罚前下降', `(before=${beforeTrust}, after=${p.trust})`)
  log(p.tension > beforeTension, 'tension 相比惩罚前上升', `(before=${beforeTension}, after=${p.tension})`)
}

console.log('\n[7] 全局冷却：3 天内不重复推\n')
{
  let state = initialGameState()
  state.sessionId = 'test-cooldown'
  state.npcMemory.xiangsongmao = ['d1', 'd2', 'd3', 'd4', 'd5']
  state.npcMemory.fangyexian = ['d1', 'd2', 'd3', 'd4', 'd5']
  state.npcMemory.bajin = ['d1', 'd2', 'd3', 'd4', 'd5']

  // day 5 commit → 第一次 dream
  while (state.day < 5) state = commitEndOfDay(state).state
  const r1 = commitEndOfDay(state)
  state = r1.state
  log(r1.dream !== null, 'day 5 commit 生成 dream', `dream=${JSON.stringify(r1.dream)?.slice(0, 100)}`)
  log(state.dreamQueue.length === 1, 'dreamQueue 长度=1', `(len=${state.dreamQueue.length})`)

  // day 6 commit → 全局冷却，应不再生成
  const r2 = commitEndOfDay(state)
  state = r2.state
  log(r2.dream === null, 'day 6 commit 不生成 dream（冷却）', `(dream=${r2.dream === null ? 'null' : 'truthy'})`)
}

console.log('\n\x1b[1m═══════════════════════════════════════════\x1b[0m')
console.log(`\x1b[1m  Dream 测试  ${pass}/${pass + fail}\x1b[0m`)
console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m')
process.exit(fail > 0 ? 1 : 0)
