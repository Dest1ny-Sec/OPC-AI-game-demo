// app/src/views/NeighborCard.jsx
// 5 张邻里小卡（按 mockup 齐堂邻里 复刻，更小、无立绘、卡片感更明显）

import { INTIMACY_LABEL, MOOD_DOT_COLOR } from '../data/intimacy.js'

export default function NeighborCard({ npcId, name, role, mood = '平静', intimacy = 0, onClick }) {
  const dotColor = MOOD_DOT_COLOR[mood] || '#7BA0A8'
  const tierLabel = INTIMACY_LABEL[Math.min(5, Math.max(0, intimacy))]
  return (
    <div onClick={onClick} style={{
      position: 'relative',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '8px 6px',
      background: 'linear-gradient(180deg, rgba(245,239,227,0.28) 0%, rgba(245,239,227,0.14) 100%)',
      border: '1.5px solid rgba(201,168,106,0.65)',
      borderRadius: 2,
      height: '100%',
      transition: 'all 0.2s',
      boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(180deg, rgba(245,239,227,0.42) 0%, rgba(245,239,227,0.22) 100%)'}
    onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(180deg, rgba(245,239,227,0.28) 0%, rgba(245,239,227,0.14) 100%)'}
    >
      {/* 名字 */}
      <div style={{ fontSize: 16, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 2, marginBottom: 4, fontFamily: '"Kaiti SC", "楷体", serif', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {name}
      </div>

      {/* 角色 */}
      <div style={{ fontSize: 10, color: '#C9A86A', marginBottom: 10, letterSpacing: 1, textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {role}
      </div>

      {/* 状态：mood 点 + 亲密等级 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          boxShadow: `0 0 5px ${dotColor}`,
        }} />
        <span style={{ fontSize: 10, color: dotColor, letterSpacing: 1, fontWeight: 'bold' }}>
          {mood} · {tierLabel}
        </span>
      </div>
    </div>
  )
}
