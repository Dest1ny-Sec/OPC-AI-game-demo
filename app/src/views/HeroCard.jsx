// app/src/views/HeroCard.jsx
// 4 张主角圆形卡（按 mockup 齐聚盟的传奇人物 复刻）

import { moodToPortraitUrl } from '../rules/portrait.js'
import { INTIMACY_LABEL, MOOD_DOT_COLOR } from '../data/intimacy.js'

export default function HeroCard({ npcId, name, era, role, location, mood = '平静', intimacy = 0, onClick }) {
  const url = moodToPortraitUrl(mood, npcId)
  const dotColor = MOOD_DOT_COLOR[mood] || '#7BA0A8'
  const tierLabel = INTIMACY_LABEL[Math.min(5, Math.max(0, intimacy))]
  return (
    <div onClick={onClick} style={{
      position: 'relative', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '10px 8px',
      background: 'linear-gradient(180deg, rgba(245,239,227,0.32) 0%, rgba(245,239,227,0.16) 100%)',
      border: '1.5px solid rgba(201,168,106,0.7)',
      borderRadius: 2,
      height: '100%',
      transition: 'all 0.2s',
      boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(180deg, rgba(245,239,227,0.48) 0%, rgba(245,239,227,0.24) 100%)'}
    onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(180deg, rgba(245,239,227,0.32) 0%, rgba(245,239,227,0.16) 100%)'}
    >
      {/* 右上朱砂印章 */}
      <div style={{
        position: 'absolute', top: 6, right: 6,
        width: 26, height: 26, borderRadius: '50%',
        background: '#B03A2E', color: '#C9A86A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 'bold', letterSpacing: 1, lineHeight: 1.05,
        border: '1.5px solid #C9A86A',
        fontFamily: '"Kaiti SC", "楷体", serif',
        boxShadow: '0 0 0 2px rgba(176,58,46,0.2)',
      }}>五<br/>洲</div>

      {/* 圆形立绘 */}
      <div style={{
        width: 78, height: 78, borderRadius: '50%',
        overflow: 'hidden', marginBottom: 10,
        background: '#E8DDC4',
        border: '2px solid #C9A86A',
        boxShadow: '0 0 0 2px rgba(31,42,51,0.6), 0 4px 12px rgba(0,0,0,0.4)',
      }}>
        <img
          src={url}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.src = '/img/portraits/01-xiangsongmao-平静-圆脸方框眼镜礼帽长衫马褂-五洲药房背景.png' }}
        />
      </div>

      {/* 名字 */}
      <div style={{ fontSize: 19, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 3, marginBottom: 2, fontFamily: '"Kaiti SC", "楷体", serif', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        {name}
      </div>

      {/* 生卒年 */}
      <div style={{ fontSize: 11, color: '#C9A86A', letterSpacing: 1, marginBottom: 4, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {era}
      </div>

      {/* 廊中 · 角色 */}
      <div style={{ fontSize: 12, color: 'rgba(245,239,227,0.85)', marginBottom: 8, letterSpacing: 1, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {role}
      </div>

      {/* 状态行：朱砂/淡金点 + 亲密等级 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          boxShadow: `0 0 6px ${dotColor}`,
        }} />
        <span style={{ fontSize: 11, color: dotColor, letterSpacing: 2, fontWeight: 'bold', textShadow: `0 0 4px ${dotColor}66` }}>
          {mood} · {tierLabel}
        </span>
      </div>
    </div>
  )
}
