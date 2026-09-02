// app/src/views/DreamModal.jsx
// 梦回 1937 —— 1:1 还原 mockup-06（5 Polaroid 卡片）
// 5 夜梦境：1937.7.7 / 1937.8.13 / 1937.11 / 五洲 / 2026
// 第 95-99 天打烊时弹出，night = day - 95

import { DREAM_SCENES } from '../data/dreamScenes.js'

export default function DreamModal({ night, onWake }) {
  const d = DREAM_SCENES[night] || DREAM_SCENES[0]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
    }}>
      <div style={{
        maxWidth: 520, width: '90%',
        background: '#F5EFE3',
        border: '1px solid #C9A86A',
        padding: 0, position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* 梦境画面（黑沉沉） */}
        <div style={{
          width: '100%', height: 420,
          background: d.color,
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', top: 16, left: 20, fontSize: 22, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 2, fontFamily: 'monospace' }}>{d.date}</div>
          <div style={{ fontSize: 80, color: 'rgba(176,58,46,0.4)', textAlign: 'center', fontWeight: 'bold' }}>{d.label}</div>
        </div>

        {/* 标题（朱砂大字） */}
        <div style={{ textAlign: 'center', fontSize: 36, color: '#B03A2E', fontWeight: 'bold', padding: '20px 0', letterSpacing: 6 }}>
          {d.title}
        </div>

        {/* 梦境台词 */}
        <div style={{ padding: '0 32px 24px', textAlign: 'center', color: '#1F2A33', fontSize: 18, lineHeight: 2, fontFamily: '"Kaiti SC", "楷体", serif' }}>
          {d.line1}<br/>{d.line2}
        </div>

        {/* 醒来按钮 */}
        <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 14, color: '#6B4E2E' }}>醒来后，你会喃喃说梦话（周围 NPC 可能起疑）</div>
          <button onClick={onWake} style={{
            padding: '14px 56px',
            background: '#1F2A33', color: '#F5EFE3',
            border: '2px solid #C9A86A', borderRadius: 4, cursor: 'pointer',
            fontSize: 18, fontWeight: 'bold', letterSpacing: 6,
            fontFamily: '"Kaiti SC", "楷体", serif',
          }}>醒 来</button>
        </div>
      </div>
    </div>
  )
}
