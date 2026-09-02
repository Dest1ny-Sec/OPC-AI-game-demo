// app/src/components/TopBar.jsx
// 顶栏 —— 1:1 还原 mockup-10-topbar-3字段
// 3 字段：1936.x.x / 第 X 天 / 距清明 X 天
// 暖纸米色底 + 黑色细横线 + 朱砂灯笼
//
// 设计哲学：3 字段 = 极简（去掉"今日对话"，NPC 主导的隐喻）
// "NPC 找侬 0" / 4 字段已删（用户最新要求）
// v2: 加 onHome 返回主页链接 + onSettings 齿轮

import { getInGameDate, getDaysToQingming } from '../state/store.js'

export default function TopBar({ day, variant = 'light', onHome, onSettings }) {
  const isLight = variant === 'light'
  const dateStr = getInGameDate(day)
  const daysToQingming = getDaysToQingming(day)

  return (
    <div style={{
      width: '100%',
      padding: '12px 32px 14px',
      background: isLight ? '#F5EFE3' : '#1F2A33',
      backgroundImage: isLight
        ? 'linear-gradient(180deg, #F5EFE3 0%, #E8DDC4 100%)'
        : 'linear-gradient(180deg, #1F2A33 0%, #14202A 100%)',
      borderBottom: isLight ? '2px solid #1F2A33' : '2px solid #B03A2E',
      borderTop: isLight ? '2px solid #1F2A33' : '2px solid #B03A2E',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      boxSizing: 'border-box',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
    }}>
      {/* ① 1936 日期 */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-start', gap: 16 }}>
        <span style={{
          fontSize: 28, fontWeight: 'bold',
          color: isLight ? '#1F2A33' : '#F5EFE3',
          letterSpacing: 1,
        }}>{dateStr}</span>
        {/* 返回主页（v2 新增） */}
        {onHome && (
          <button
            onClick={onHome}
            title="返回主页"
            aria-label="返回主页"
            style={{
              width: 32, height: 32, padding: 0,
              background: 'transparent',
              border: '1.5px solid ' + (isLight ? '#1F2A33' : '#F5EFE3'),
              color: isLight ? '#1F2A33' : '#F5EFE3',
              fontSize: 18, fontWeight: 'bold', cursor: 'pointer',
              fontFamily: '"Kaiti SC", "楷体", serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 2, lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#1F2A33' : '#F5EFE3'; e.currentTarget.style.color = isLight ? '#F5EFE3' : '#1F2A33' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isLight ? '#1F2A33' : '#F5EFE3' }}
          >返</button>
        )}
        {onSettings && (
          <button
            onClick={onSettings}
            title="设置 / 提示"
            aria-label="设置 / 提示"
            style={{
              width: 32, height: 32, padding: 0,
              background: 'transparent',
              border: '1.5px solid ' + (isLight ? '#1F2A33' : '#F5EFE3'),
              color: isLight ? '#1F2A33' : '#F5EFE3',
              fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
              fontFamily: '"Kaiti SC", "楷体", serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 2, lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#1F2A33' : '#F5EFE3'; e.currentTarget.style.color = isLight ? '#F5EFE3' : '#1F2A33' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isLight ? '#1F2A33' : '#F5EFE3' }}
          >设</button>
        )}
      </div>

      {/* 分隔竖线 */}
      <div style={{
        width: 1, height: 32,
        background: isLight ? '#C9A86A' : 'rgba(245,239,227,0.3)',
      }} />

      {/* ② 第 X 天 / 100 */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <span style={{
          fontSize: 28, fontWeight: 'bold',
          color: isLight ? '#1F2A33' : '#F5EFE3',
          letterSpacing: 1,
        }}>第 {day} 天 / 100</span>
      </div>

      <div style={{
        width: 1, height: 32,
        background: isLight ? '#C9A86A' : 'rgba(245,239,227,0.3)',
      }} />

      {/* ③ 距清明 X 天 */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <span style={{
          fontSize: 28, fontWeight: 'bold',
          color: isLight ? '#1F2A33' : '#F5EFE3',
          letterSpacing: 1,
        }}>距清明 {daysToQingming} 天</span>
      </div>

      {/* 朱砂灯笼（用 SVG 风格红色圆点替代 emoji） */}
      <div style={{
        width: 26, height: 32, position: 'relative',
        marginLeft: 8,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 18, height: 18, borderRadius: '50% 50% 45% 45%',
          background: 'radial-gradient(circle at 30% 30%, #E04A3E 0%, #B03A2E 70%)',
          boxShadow: '0 0 12px rgba(176,58,46,0.6)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 2, height: 12, background: '#C9A86A',
        }} />
      </div>
    </div>
  )
}
