// app/src/views/SettingsModal.jsx
// 设置弹窗（v2：之前 showSettings state 0 个地方渲染）—— 现在有 UI 了
// 显示：音效 / 语言 / 难度 / 体力 / 大洋 / 当前天数 / 重开按钮
// v9：sfx 系统不存在，音频开关改为只读说明

export default function SettingsModal({ G, onClose, onReset }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,10,10,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 500, width: '90%', padding: 32,
          background: '#F5EFE3', border: '2px solid #C9A86A',
          borderRadius: 4, color: '#1F2A33',
        }}>
        <div style={{ fontSize: 22, color: '#B03A2E', marginBottom: 16, textAlign: 'center', letterSpacing: 4, fontWeight: 'bold' }}>
          设定
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 16, lineHeight: 1.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #C9A86A' }}>
            <span>音效</span>
            {/* v9：sfx 系统不存在，音频开关改为只读说明（原开关无任何代码消费） */}
            <span style={{ color: '#6B4E2E' }}>{G.settings?.audio !== false ? '开（开发中）' : '关'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #C9A86A' }}>
            <span>语言</span>
            <span style={{ color: '#6B4E2E' }}>中文</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #C9A86A' }}>
            <span>难度</span>
            <span style={{ color: '#6B4E2E' }}>{G.settings?.difficulty || '普通'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #C9A86A' }}>
            <span>体力 / 大洋</span>
            <span style={{ color: '#6B4E2E' }}>{G.hp ?? 100} / {G.money ?? 50} 元</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #C9A86A' }}>
            <span>第 {G.day} 天</span>
            <span style={{ color: '#6B4E2E' }}>{G.day >= 95 ? '清明已至' : `距清明 ${95 - G.day} 天`}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={onReset}
              style={{ flex: 1, padding: '10px 16px', background: '#B03A2E', color: '#F5EFE3', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>
              重开游戏
            </button>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '10px 16px', background: 'transparent', color: '#1F2A33', border: '1.5px solid #1F2A33', borderRadius: 2, cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
