// app/src/services/llmClient.js
// LLM HTTP 客户端：SSE 流式消费 + 本地兜底调度
// 拆分自 lib/api.js

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || (typeof process !== 'undefined' && process.env.VITE_API_BASE) || ''
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** SSE 消费（80s 静默看门狗；server 侧 LLM_TIMEOUT 75s，30s 会先断流拿到空气泡） */
async function consumeSSE(res, onDelta) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = '', text = '', mode = 'llm'
  let watchdog = setTimeout(() => reader.cancel().catch(() => {}), 80000)
  const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => reader.cancel().catch(() => {}), 80000) }
  try {
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
          if (d.t) { arm(); text += d.t; onDelta?.(d.t) }
          if (d.mode) mode = d.mode
        } catch { /* 心跳 */ }
      }
    }
  } catch { /* 看门狗/断流：返回已收部分 */ }
  clearTimeout(watchdog)
  return { mode, text }
}

/**
 * 统一 LLM 调用入口
 * - 没配 BASE → 走 localText 本地兜底
 * - 配了但请求失败 → 也走 localText
 * - LLM 流式被截断 → text 为空时再走 localText
 */
export async function call(path, body, onDelta, localText) {
  if (!BASE) {
    await sleep(600)
    const text = typeof localText === 'function' ? localText() : localText
    for (const ch of text) { onDelta?.(ch); await sleep(30) }
    return { mode: 'variant', text }
  }
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = typeof localText === 'function' ? localText() : localText
    for (const ch of text) { onDelta?.(ch); await sleep(30) }
    return { mode: 'local-fallback', text }
  }
  const result = await consumeSSE(res, onDelta)
  // v9：LLM 流式被看门狗/断流截断后 text 可能为空 → 用本地兜底文案（M-4）
  if (!result.text?.trim() && typeof localText === 'function') {
    const text = localText()
    for (const ch of text) { onDelta?.(ch); await sleep(30) }
    return { mode: 'local-fallback', text }
  }
  return result
}
