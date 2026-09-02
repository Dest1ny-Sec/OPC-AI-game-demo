// app/src/views/DialogueBottomNav.jsx
// DialogueView 底部导航 —— 单 tab "回堂" 回到 home
// v8: 删「人物」「回堂」重复 tab，保留 1 个

export default function DialogueBottomNav({ onSwitchView }) {
  const tabs = [
    { key: 'home', label: '回堂', hint: '回到主页' },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5,
      height: 64, padding: '0 8px',
      background: 'rgba(31, 42, 51, 0.95)',
      borderTop: '1.5px solid rgba(201, 168, 106, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'grid', gridTemplateColumns: '1fr', alignItems: 'stretch',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
    }}>
      {tabs.map((t, i) => (
        <button
          key={i}
          onClick={() => onSwitchView(t.key)}
          title={t.hint}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            color: '#C9A86A', fontSize: 16, fontWeight: 'bold', letterSpacing: 4,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#F5EFE3'}
          onMouseLeave={e => e.currentTarget.style.color = '#C9A86A'}
        >
          <span style={{ fontSize: 20, lineHeight: 1, fontFamily: '"Kaiti SC", "楷体", serif' }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
