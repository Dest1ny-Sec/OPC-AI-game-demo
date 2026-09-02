import { useEffect, useState } from 'react'

/** 打字机：AI 文案逐字上屏 */
export function useTypewriter(text, cps = 26) {
  const [out, setOut] = useState('')
  useEffect(() => {
    setOut('')
    if (!text) return
    let i = 0
    const t = setInterval(() => {
      i++
      setOut(text.slice(0, i))
      if (i >= text.length) clearInterval(t)
    }, 1000 / cps)
    return () => clearInterval(t)
  }, [text, cps])
  return { out, done: out.length >= text.length }
}
