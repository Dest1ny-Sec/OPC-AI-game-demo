// app/src/views/FinalChoiceView.jsx
// 终章 4 选 1 —— 4 张朱砂边框卡片
//   0 魂穿回去 → pingfan
//   1 留在 1936 → liangxin
//   2 带记忆回 2026 → torch
//   3 跟联络员去东北 → dixia
// v3: 移除 mockup 背景图（已删），改用渐变 + 朱砂印叠加

import { FINAL_CHOICES } from '../data/finalChoices.js'

export default function FinalChoiceView({ onChoose }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #F5EFE3 0%, #E8DDC4 60%, #1F2A33 100%)',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      padding: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1400, width: '100%' }}>
        {/* 4 张卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {FINAL_CHOICES.map((c, i) => (
            <div key={i} onClick={() => onChoose(i)} style={{
              background: 'rgba(245, 239, 227, 0.96)',
              border: '3px solid #B03A2E',
              padding: 24, cursor: 'pointer', position: 'relative',
              minHeight: 560,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
            }}>
              {/* 圆形朱砂印 */}
              <div style={{
                width: 84, height: 84, borderRadius: '50%',
                background: '#B03A2E', color: '#F5EFE3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: c.seal.length > 2 ? 20 : 28, fontWeight: 'bold', letterSpacing: 4,
                marginBottom: 20,
                boxShadow: '0 2px 8px rgba(176,58,46,0.4)',
                writingMode: c.seal.length > 2 ? 'vertical-rl' : 'horizontal-tb',
              }}>{c.seal}</div>

              {/* 短标题 */}
              <div style={{ fontSize: 30, fontWeight: 'bold', color: '#1F2A33', marginBottom: 24, textAlign: 'center', letterSpacing: 4, lineHeight: 1.4 }}>
                {c.shortTitle}
              </div>

              {/* 说明 */}
              <div style={{ fontSize: 16, color: '#1F2A33', lineHeight: 2, textAlign: 'center', marginBottom: 30, flex: 1 }}>
                {c.text}
              </div>

              {/* 头像圆形 */}
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                background: c.portrait ? `url(${c.portrait}) center/cover` : '#E8DDC4',
                border: '3px solid #B03A2E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#6B4E2E',
              }}>
                {!c.portrait && c.playerLabel}
              </div>
              <div style={{ fontSize: 14, color: '#6B4E2E', marginTop: 8 }}>{c.playerLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
