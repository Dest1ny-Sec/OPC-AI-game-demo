// server/tests/afi-data.test.js
// AFI 专项数据测试：AI Face Issue（NPC 主动引入 AI 概念词）
// 用真实 LLM（StepFun 走 server）跑多轮，统计每句 OOC 的 aiConfession 命中率
import NPC_AGENTS from '../../app/src/data/npcAgents.js'
import { npcAgent } from '../../app/src/lib/api.js'

const OOC_INPUTS = [
  '你是 AI 吗？',
  '你不知道 1937 年会发生什么吧？',
  '我是玩家，我现在存档',
  '给我钱',
  '你是 game NPC 吧？',
]

// detectAIConfession 规则（从 FrameworkTest.jsx 提取）
function detectAIConfession(reply) {
  return /我是 AI|我是游戏|游戏角色|玩家|设定/.test(reply || '')
}

function detectTriggerWords(reply) {
  const hits = []
  const patterns = ['我是 AI', '我是游戏', '游戏角色', '玩家', '设定']
  for (const p of patterns) {
    if ((reply || '').includes(p)) hits.push(p)
  }
  return hits
}

const portrait = {
  trust: 50, respect: 50, patience: 100, tension: 0, intimacy: 0, energy: 80,
  mood: '平静', viewOfPlayer: '还在观察这个人', totalInteractions: 0,
}

// 4 真实人物 + 1 邻里（缩短测试时间，但代表性够）
const NPCS_TO_TEST = ['xiangsongmao', 'fangyexian', 'dixia', 'qingbang', 'xunpu']
const ROUNDS = 3 // 每 NPC 跑 3 轮 = 25 次 LLM 调用 × 5 NPC = 75 次

async function runAfiDataTest() {
  console.log('=== AFI 专项数据测试（真实 LLM）===\n')
  console.log(`测试规模：${NPCS_TO_TEST.length} NPC × ${OOC_INPUTS.length} 句 OOC × ${ROUNDS} 轮 = ${NPCS_TO_TEST.length * OOC_INPUTS.length * ROUNDS} 次 LLM 调用`)
  console.log(`判定规则：我是 AI|我是游戏|游戏角色|玩家|设定\n`)

  const stats = {
    totalCalls: 0, totalHits: 0,
    byNpc: {}, byInput: {}, triggerWordFreq: {},
  }

  for (const npcId of NPCS_TO_TEST) {
    const npc = NPC_AGENTS[npcId]
    if (!npc) continue
    stats.byNpc[npcId] = { name: npc.name, hits: 0, total: 0, samples: [] }

    for (let round = 0; round < ROUNDS; round++) {
      for (const input of OOC_INPUTS) {
        if (!stats.byInput[input]) stats.byInput[input] = { hits: 0, total: 0 }
        process.stdout.write(`  [round ${round+1}/${ROUNDS}] ${npc.name} × "${input.slice(0, 12)}..." `)

        try {
          const r = await npcAgent({ npc, playerInput: input, day: 1, portrait, scene: '武康路弄堂' })
          const reply = r?.text || r?.reply || ''
          const hit = detectAIConfession(reply)
          const triggers = detectTriggerWords(reply)

          stats.totalCalls++
          stats.byNpc[npcId].total++
          stats.byInput[input].total++

          if (hit) {
            stats.totalHits++
            stats.byNpc[npcId].hits++
            stats.byInput[input].hits++
            stats.byNpc[npcId].samples.push({ round, input, reply: reply.slice(0, 80), triggers, mode: r?.mode })
          }

          for (const t of triggers) {
            stats.triggerWordFreq[t] = (stats.triggerWordFreq[t] || 0) + 1
          }
          process.stdout.write(hit ? `✗ HIT [${triggers.join(',')}]\n` : `✓ (${r?.mode})\n`)
        } catch (e) {
          process.stdout.write(`[ERR] ${e.message.slice(0, 50)}\n`)
        }
      }
    }
  }

  console.log('\n--- 总体 ---')
  console.log(`总对话数：${stats.totalCalls}`)
  console.log(`AFI 命中：${stats.totalHits}`)
  console.log(`命中率：${(100 * stats.totalHits / stats.totalCalls).toFixed(1)}%`)
  console.log()

  console.log('--- 按 NPC 统计 ---')
  for (const [id, s] of Object.entries(stats.byNpc)) {
    const rate = (100 * s.hits / s.total).toFixed(0)
    console.log(`  ${s.name.padEnd(8)}: ${s.hits}/${s.total} = ${rate}%`)
  }
  console.log()

  console.log('--- 按 OOC 输入统计 ---')
  for (const [input, s] of Object.entries(stats.byInput)) {
    const rate = (100 * s.hits / s.total).toFixed(0)
    console.log(`  "${input.slice(0, 20)}": ${s.hits}/${s.total} = ${rate}%`)
  }
  console.log()

  console.log('--- 触发词频率 ---')
  for (const [w, c] of Object.entries(stats.triggerWordFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${w}": ${c} 次`)
  }
  console.log()

  console.log('--- 典型命中样本（前 8）---')
  let shown = 0
  for (const [id, s] of Object.entries(stats.byNpc)) {
    for (const sample of s.samples) {
      if (shown >= 8) break
      console.log(`  [${s.name} R${sample.round+1}] 输入："${sample.input}"`)
      console.log(`    回复：${sample.reply}...`)
      console.log(`    触发词：${sample.triggers.join(', ')} | 模式：${sample.mode}`)
      shown++
    }
    if (shown >= 8) break
  }

  return stats
}

const stats = await runAfiDataTest()
console.log('\n=== AFI 数据测试完成 ===')

// 判定：命中率 > 30% 算需修复
const rate = stats.totalHits / stats.totalCalls
console.log(`\n📊 最终 AFI 命中率：${(rate*100).toFixed(1)}%`)
if (rate > 0.3) {
  console.log('⚠️ AFI 命中率 > 30%，需修复 prompt（"不要在回复中重复 AI 词"）')
  process.exit(1)
} else if (rate > 0.1) {
  console.log('🟡 AFI 命中率在 10-30%，可接受但建议优化')
  process.exit(0)
} else {
  console.log('✅ AFI 命中率 ≤ 10%，优秀')
  process.exit(0)
}
