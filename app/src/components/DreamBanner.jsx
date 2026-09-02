// app/src/components/DreamBanner.jsx
// Dream 主动推送横幅 —— 1:1 还原 mockup-20-dreambanner
// 朱砂红横幅 + 金色边框 + 白字 + 右侧金色箭头

import NPC_AGENTS from '../data/npcAgents.js'

export default function DreamBanner({ dream, onAccept }) {
  if (!dream) return null
  const npc = NPC_AGENTS[dream.npcId]
  const npcName = npc?.name || dream.npcId
  const firstLine = dream.lines?.[0] || ''
  const daysLeft = Math.max(0, (dream.expiresAtDay || 0) - (dream.day || 0) + 1)

  return (
    <div
      onClick={onAccept}
      style={{
        width: '100%',
        background: 'linear-gradient(90deg, #B03A2E 0%, #8B2818 100%)',
        border: '3px solid #C9A86A',
        borderRadius: 6,
        padding: '18px 32px',
        color: '#F5EFE3',
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        position: 'relative',
      }}
    >
      {/* 「寻」字标识（替代 emoji） */}
      <span style={{
        display: 'inline-block', width: 36, height: 36, lineHeight: '36px',
        textAlign: 'center', fontSize: 22, fontWeight: 'bold',
        border: '2px solid #C9A86A', color: '#C9A86A',
        borderRadius: 2, fontFamily: '"Kaiti SC", "楷体", serif',
        flexShrink: 0,
      }}>寻</span>
      {/* NPC 名字 */}
      <span style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 1, color: '#C9A86A' }}>
        {npcName}
      </span>
      {/* 第一句开场白 */}
      <span style={{ fontSize: 20, color: '#F5EFE3', flex: 1 }}>
        {firstLine}
      </span>
      {/* 过期天数 */}
      <span style={{ fontSize: 18, color: '#E8DDC4' }}>
        [还剩 {daysLeft} 天]
      </span>
      {/* 右侧箭头 */}
      <span style={{ fontSize: 32, color: '#C9A86A', fontWeight: 'bold' }}>›</span>
    </div>
  )
}
