// app/src/views/EndingTorchView.jsx
// 末帧传火者 —— 1:1 还原 mockup-08
// 终局黑底 + 大字 + 民国楷体
// 兼容旧 import：EndingTorchView 现在转调 EndingPage（按 endingId 决定哪个结局）
// v3: 加 onShare / onViewFragments / onRestart 三个 props（GamePlay 调用时传）

import EndingPage from './EndingPage.jsx'

export default function EndingTorchView({ endingId, onReset, onHome, onShare, onViewFragments, onRestart }) {
  return (
    <EndingPage
      endingId={endingId || 'torch'}
      reason="完美通关"
      onReset={onReset}
      onHome={onHome}
      onShare={onShare}
      onViewFragments={onViewFragments}
      onRestart={onRestart}
    />
  )
}
