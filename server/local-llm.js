// server/local-llm.js
// 本地 LLM 兜底（Ollama）
// 用法：const text = await callOllama('system', 'user', 'qwen2.5:3b')
//
// 兜底链：StepFun → MiniMax-M3 → Ollama → localNpc()
// P1-B：小参数模型压榨（温度折中 + num_predict 留够发挥空间）
const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b'
const OLLAMA_TEMPERATURE = 0.7    // 0.7 = 准确度（0.55）+ 表达力（0.8）的折中
const OLLAMA_NUM_PREDICT = 250    // 250 ≈ 180 汉字

export const OLLAMA_AVAILABLE = (async () => {
  try {
    const res = await fetch(OLLAMA_BASE + '/api/tags', { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return false
    const data = await res.json()
    return data.models?.length > 0
  } catch {
    return false
  }
})()

/**
 * 调 Ollama 生成
 * @param {string} system - system prompt
 * @param {string} user - user prompt
 * @param {string} model - 模型名（默认 qwen2.5:3b）
 * @returns {Promise<string|null>} - 生成的文本，失败返回 null
 */
export async function callOllama(system, user, model = OLLAMA_MODEL) {
  try {
    const res = await fetch(OLLAMA_BASE + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system,
        prompt: user,
        stream: false,
        options: { temperature: OLLAMA_TEMPERATURE, num_predict: OLLAMA_NUM_PREDICT },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.response || '').trim() || null
  } catch {
    return null
  }
}

/**
 * 流式调 Ollama（按 \n 分块）
 * @param {function} onDelta - 流式回调 (chunk) => void
 * @returns {Promise<string|null>}
 */
export async function streamOllama(system, user, onDelta, model = OLLAMA_MODEL) {
  try {
    const res = await fetch(OLLAMA_BASE + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system,
        prompt: user,
        stream: true,
        options: { temperature: OLLAMA_TEMPERATURE, num_predict: OLLAMA_NUM_PREDICT },
      }),
    })
    if (!res.ok) return null
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          const d = JSON.parse(line)
          if (d.response) {
            full += d.response
            onDelta?.(d.response)
          }
        } catch { /* skip */ }
      }
    }
    return full.trim() || null
  } catch {
    return null
  }
}

// 启动时打印状态
;(async () => {
  const ok = await OLLAMA_AVAILABLE
  if (ok) {
    console.log(`[本地 LLM] Ollama 已就绪: ${OLLAMA_BASE} · model=${OLLAMA_MODEL}`)
  } else {
    console.log(`[本地 LLM] Ollama 未启动: ${OLLAMA_BASE}`)
  }
})()
