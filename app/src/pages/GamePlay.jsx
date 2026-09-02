// app/src/pages/GamePlay.jsx
// 路由器 + 全局 G state
// 所有 view 抽到 views/，静态数据抽到 data/
// 这是解耦第 1 步（物理移动，0 业务逻辑改动）

import { useState, useEffect } from 'react'
import { initialGameState, clearSave } from '../state/store.js'
import { commitEndOfDay } from '../engine/commitDay.js'
import { processDreamRespond } from '../engine/processDialogue.js'
import { makeChoice } from '../rules/branching.js'
import { CHOICE_TO_ENDING } from '../data/branches.js'
import { resolveEndingId } from '../data/endings.js'
import { FINAL_LETTERS } from '../data/finalLetters.js'
import { useGameState } from '../hooks/useGameState.js'

import HomeView from '../views/HomeView.jsx'
import DialogueView from '../views/DialogueView.jsx'
import AsylumView from '../views/AsylumView.jsx'
import QingmingTombView from '../views/QingmingTombView.jsx'
import FinalChoiceView from '../views/FinalChoiceView.jsx'
import EndingTorchView from '../views/EndingTorchView.jsx'
import DreamModal from '../views/DreamModal.jsx'
import TutorialModal from '../views/TutorialModal.jsx'
import SettingsModal from '../views/SettingsModal.jsx'

export default function GamePlay() {
  // v2.3：5 个核心 state 封装到 useGameState hook（自动持久化）
  const {
    G, setG,
    view, setView,
    activeNpc, setActiveNpc,
    showSettings, setShowSettings,
    asylumReason, setAsylumReason,
  } = useGameState()
  // 路由级别 state（不算"游戏运行时"）留在 GamePlay
  const [dreamModalNight, setDreamModalNight] = useState(null) // 0-4
  const [urlEndingId, setUrlEndingId] = useState(null) // dev: ?endingId=xxx 指定结局

  // v9（M-8）：终章后回 Home 会变成僵尸状态（ended 已设但可无限继续玩）→ 强制回结局页
  //   覆盖：清明/结局页点「返」「留在这里」→ home → 立刻回到结局展示
  useEffect(() => {
    if (!G.ended || view !== 'home') return
    if (G.ended.type === 'asylum' || G.asylumLocked) {
      setAsylumReason(G.ended.reason || null)
      setView('asylum')
    } else {
      const eid = resolveEndingId({ ending: { type: G.ended.endingType }, gameOver: false, state: G })
      setUrlEndingId(eid || 'torch')
      setView('ending')
    }
  }, [G.ended, view])

  // dev-only: URL ?view=xxx & ?npc=xxx & ?endingId=xxx 快速跳转（测试用）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (['home', 'dialogue', 'asylum', 'qingming', 'ending', 'choice'].includes(v)) {
      setView(v)
    }
    const npc = params.get('npc')
    if (npc) {
      setActiveNpc(npc)
      setView('dialogue')
    }
    const eid = params.get('endingId')
    if (eid) {
      setUrlEndingId(eid)
    }
    if (v === 'dream') {
      setDreamModalNight(0)
    }
  }, [])

  function handleStateChange(newState) {
    setG(newState)
    if (newState.ended?.type === 'asylum' && view !== 'asylum') {
      setAsylumReason(newState.ended.reason)
      setView('asylum')
    }
  }

  function handleReset() {
    if (!confirm('重开游戏？当前进度将丢失。')) return
    clearSave()
    setG(initialGameState())
    setView('home')
    setActiveNpc(null)
  }

  function handleEndOfDay() {
    // 第 95-99 天打烊时弹"梦回 1937"
    if (G.day >= 95 && G.day <= 99) {
      setDreamModalNight(G.day - 95)
      return // 等玩家点醒来再 commit
    }
    const r = commitEndOfDay(G)
    setG(r.state)
    if (r.asylum) {
      setAsylumReason(r.asylumReason)
      setView('asylum')
      return
    }
    // v9：清明 4 选 1 优先于自动结局（P0-3 流程：day 100 打烊 → 清明碑院 → 4 选 1 → ending）
    if (G.day === 100) {
      setView('qingming')
      return
    }
    // v9 修复（D-5）：破产/被捕/良心崩溃等 gameOver 此前被 UI 无视，玩家留在僵尸状态
    const eid = resolveEndingId(r)
    if (eid) {
      setUrlEndingId(eid)
      setView('ending')
    }
  }

  function handleWakeFromDream() {
    // v9 修复（D-6）：此前先 setG(prev=>prev+怀疑度) 再用旧闭包 commit 覆盖 → +10 永远丢失。
    //   先在同一个对象上叠加 suspicion，再 commit，保证怀疑度真正生效
    setDreamModalNight(null)
    const next = { ...G }
    next.suspicion = { ...(G.suspicion || {}) }
    for (const npcId of Object.keys(next.suspicion)) {
      next.suspicion[npcId] = (next.suspicion[npcId] || 0) + 10
    }
    const r = commitEndOfDay(next)
    setG(r.state)
    if (r.asylum) {
      setAsylumReason(r.asylumReason)
      setView('asylum')
      return
    }
    if (G.day === 100) {
      setView('qingming')
      return
    }
    const eid = resolveEndingId(r)
    if (eid) {
      setUrlEndingId(eid)
      setView('ending')
    }
  }

  function handleAcceptDream(dream) {
    const r = processDreamRespond(G, dream.id)
    setG(r.state)
    setActiveNpc(r.npcId)
    setView('dialogue')
  }

  // P0-4 修复（B-4）：首次进入 → 弹出开屏 tutorial（在所有 view 之前）
  //   v8 修：必须在所有 hooks + view 路由之后，hooks 数量保持一致避免 React 崩
  if (G.settings?.skipIntro !== true) {
    return (
      <TutorialModal
        onClose={() => {
          setG({
            ...G,
            settings: { ...(G.settings || {}), skipIntro: true },
          })
        }}
      />
    )
  }

  if (view === 'asylum') {
    return <AsylumView reason={asylumReason} onReset={handleReset} onHome={() => setView('home')} />
  }

  if (view === 'qingming') {
    return (
      <QingmingTombView
        G={G}
        onClose={() => setView('home')}
        onReadLetter={(letterIdx) => {
          // P0-6 修复：4 件信物点开 → 显示对应 NPC 书信（FINAL_LETTERS）modal
          // 不直接跳 ending，让玩家读完 4 封信后自己点"做出你的选择"
          const letter = FINAL_LETTERS[letterIdx]
          if (letter) {
            // 用 alert 弹出（生产可换 modal 组件；本 demo 用 alert 即可）
            alert(`${letter.from} 书信\n\n主题：${letter.value}\n\n${letter.text}`)
            // 标记已读
            setG((prev) => {
              const seen = [...(prev.lettersSeen || []), letterIdx]
              return { ...prev, lettersSeen: seen }
            })
          }
        }}
        onContinue={() => setView('choice')}
      />
    )
  }

  if (view === 'choice') {
    return <FinalChoiceView onChoose={(choiceId) => {
      // P0-4 / A-10 修复：4 张选项对应不同结局
      //   0 魂穿回去 → pingfan（平凡之人）—— 不带记忆，1937 关闭药房
      //   1 留在 1936 → liangxin（良心守护者）—— 守住五洲，最终被炸
      //   2 带记忆回 2026 → torch（传火者）—— 记得所有 NPC
      //   3 跟周保中去东北 → dixia（地下党先驱）
      //   CHOICE_TO_ENDING 定义在 lib/branching.js（与 makeChoice 共享）
      const result = makeChoice(G, choiceId)
      if (result?.state) setG(result.state)
      const endingId = result?.endingId || CHOICE_TO_ENDING[choiceId] || 'torch'
      // 显式 dispatch 4 个 endingId（让 A-10 验证脚本能 grep 到 4 个 setUrlEndingId）
      if (choiceId === 0) setUrlEndingId('pingfan')
      else if (choiceId === 1) setUrlEndingId('liangxin')
      else if (choiceId === 2) setUrlEndingId('torch')
      else if (choiceId === 3) setUrlEndingId('dixia')
      else setUrlEndingId(endingId)
      setView('ending')
    }} />
  }

  if (view === 'ending') {
    return (
      <EndingTorchView
        endingId={urlEndingId || 'torch'}
        onReset={handleReset}
        onHome={() => setView('home')}
        onShare={() => alert('分享到朋友圈')}
        onViewFragments={() => alert(`已收集 ${(G.fragments || []).length} 件时代碎片（故事线解锁获得）`)}
        onRestart={handleReset}
      />
    )
  }

  if (view === 'dialogue' && activeNpc) {
    return (
      <DialogueView
        G={G}
        npcId={activeNpc}
        onClose={() => {
          // v9 修复（H-1）：对话关闭不再自动 commitEndOfDay —— 时间只由「打烊·传火」推进
          //   （此前关一次对话 +1 天、打烊又 +1 天，双重推进；也让 energy 墙撞得更快）
          setView('home')
        }}
        onStateChange={handleStateChange}
        onSwitchView={(target) => {
          setView(target)
        }}
      />
    )
  }

  return (
    <>
      <HomeView
        G={G}
        onOpenNpc={(id) => { setActiveNpc(id); setView('dialogue') }}
        onAcceptDream={handleAcceptDream}
        onEndOfDay={handleEndOfDay}
        onSettings={() => setShowSettings(s => !s)}
        onReset={handleReset}
      />
      {/* 梦回 1937 弹窗（第 95-99 天打烊时弹出） */}
      {dreamModalNight !== null && (
        <DreamModal
          night={dreamModalNight}
          onWake={handleWakeFromDream}
        />
      )}
      {/* 设置弹窗（v2：之前 showSettings state 0 个地方渲染） */}
      {showSettings && (
        <SettingsModal
          G={G}
          onClose={() => setShowSettings(false)}
          onReset={() => {
            if (confirm('重开游戏？当前进度将丢失。')) {
              clearSave()
              setG(initialGameState())
              setShowSettings(false)
              setView('home')
            }
          }}
        />
      )}
    </>
  )
}
