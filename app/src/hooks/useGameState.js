// app/src/hooks/useGameState.js
// 游戏运行时状态 hook —— 封装 GamePlay.jsx 的 5 个 useState + 自动持久化
// 拆分自 pages/GamePlay.jsx
//
// 用法：
//   import { useGameState } from '../hooks/useGameState.js'
//   const { G, setG, view, setView, activeNpc, setActiveNpc, ... } = useGameState()

import { useState, useEffect } from 'react'
import { loadGame, initialGameState, saveGame } from '../state/store.js'

/**
 * 游戏运行时状态 hook
 * - G: 游戏状态（自动从 localStorage 读取，自动持久化）
 * - view: 当前视图 'home' | 'dialogue' | 'asylum' | 'qingming' | 'ending' | 'choice'
 * - activeNpc: 当前对话 NPC id
 * - showSettings: 设置弹窗是否显示
 * - asylumReason: 疯人院结局原因
 */
export function useGameState() {
  const [G, setG] = useState(() => loadGame() || initialGameState())
  const [view, setView] = useState('home') // home | dialogue | asylum | qingming | ending | choice
  const [activeNpc, setActiveNpc] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [asylumReason, setAsylumReason] = useState(null)

  // 自动持久化 G
  useEffect(() => { saveGame(G) }, [G])

  return {
    G, setG,
    view, setView,
    activeNpc, setActiveNpc,
    showSettings, setShowSettings,
    asylumReason, setAsylumReason,
  }
}
