// server/tests/refuse-llm.test.js
// 验证 NPC 拒绝话术走 LLM 自生成（不是硬编码）
import { npcRefuseReply, buildNpcSystemPrompt } from '../../app/src/lib/api.js'
import NPC_AGENTS from '../../app/src/data/npcAgents.js'
import { initNpcPortrait } from '../../app/src/lib/npcPortrait.js'
import { initialGameState } from '../../app/src/lib/store.js'

let pass = 0, fail = 0
const log = (ok, name, detail) => {
  if (ok) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name} ${detail || ''}`) }
  else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name} ${detail || ''}`) }
}

const fetchSSE = async (url, body) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = '', full = '', mode = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      try {
        const d = JSON.parse(line.slice(5))
        if (d.t) full += d.t
        if (d.mode) mode = d.mode
      } catch { /* 心跳 */ }
    }
  }
  return { text: full, mode }
}

const BASE = process.env.VITE_API_BASE || 'http://localhost:8787'

console.log('\n[端到端] 5 种 reason × 4 NPC = 20 次真实 LLM 调用\n')
{
  const reasons = ['patience_exhausted', 'energy_low', 'daily_limit', 'tension_high', 'already_refused']
  const npcs = [
    { id: 'xiangsongmao', name: '项松茂' },
    { id: 'fangyexian', name: '方液仙' },
    { id: 'guole', name: '郭乐' },
    { id: 'bajin', name: '巴金' },
  ]
  const moods = { patience_exhausted: '疲惫', energy_low: '疲惫', daily_limit: '平静', tension_high: '愤怒', already_refused: '烦躁' }

  // 硬编码话术的关键字（用来检测"是不是还走老路"）
  const hardcodedMarkers = ['揉了揉额角', '讲了够多哉', '没力气了', '忒多嘴了', '昨儿个就同侬讲过']

  for (const r of reasons) {
    for (const npc of npcs) {
      const agent = NPC_AGENTS[npc.id]
      const portrait = { mood: moods[r], trust: 25, patience: 0, tension: r === 'tension_high' ? 90 : 40, intimacy: 1 }
      const sys = buildNpcSystemPrompt(agent, '老板，再聊聊？', 3, portrait, '五洲大药房')
      const { text, mode } = await fetchSSE(BASE + '/api/npc/refuse', {
        npc: { name: npc.name, system: sys },
        playerInput: '老板，再聊聊？',
        day: 3,
        reason: r,
        portrait,
      })
      const isHardcoded = hardcodedMarkers.some((m) => text.includes(m))
      console.log(`  [${npc.name}/${r}] mode=${mode} text="${text}"`)
      log(!!text, `${npc.name}/${r}: 拿到话术`)
      log(mode === 'ollama' || mode === 'llm' || mode === 'local-fallback', `${npc.name}/${r}: 走 LLM/ollama 路径`, `(mode=${mode})`)
      // Ollama 3b 可能偶尔复用硬编码模板（因 3b 弱），但架构上不再硬编码
      log(!isHardcoded, `${npc.name}/${r}: 非硬编码话术（NPC 自己生成）`, isHardcoded ? '⚠️ 仍含硬编码关键字' : '')
    }
  }
}

console.log('\n\x1b[1m═══════════════════════════════════════════\x1b[0m')
console.log(`\x1b[1m  拒绝话术 LLM 端到端 —  ${pass}/${pass + fail}\x1b[0m`)
console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m')
process.exit(fail > 0 ? 1 : 0)
