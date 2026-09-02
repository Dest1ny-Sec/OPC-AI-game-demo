// app/src/views/TutorialModal.jsx
// 开屏 tutorial —— 首次进入时弹出 4 条要点
// v9: B-4 修复

export default function TutorialModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
    }}>
      <div style={{
        background: '#F5EFE3',
        border: '3px solid #B03A2E',
        padding: 40,
        maxWidth: 480, width: '90%',
        boxShadow: '0 0 0 1px #C9A86A, 0 12px 40px rgba(0,0,0,0.6)',
        color: '#1F2A33',
      }}>
        <h2 style={{
          margin: '0 0 8px 0', fontSize: 28, fontWeight: 'bold',
          color: '#B03A2E', letterSpacing: 4, textAlign: 'center',
          fontFamily: '"Kaiti SC", "楷体", serif',
        }}>
          弄堂沉浮录·1936
        </h2>
        <div style={{
          textAlign: 'center', fontSize: 12, color: '#6B4E2E',
          letterSpacing: 3, marginBottom: 24,
        }}>
          守仁 · 松茂 · 五洲
        </div>
        <ol style={{
          paddingLeft: 22, margin: '0 0 28px 0', lineHeight: 1.9,
          fontSize: 15, color: '#1F2A33', letterSpacing: 1,
        }}>
          <li>你是 1936 年的账房先生，要在 100 天内结交 4 位传奇人物</li>
          <li>每日「打烊·传火」推进时间；清明前到达则进入 4 选 1</li>
          <li>沪语 30-60 字回复，慎言（OOC 会被认作神经病）</li>
          <li>关系值（亲密/怀疑/信任）决定结局走向</li>
        </ol>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 48px', fontSize: 16, fontWeight: 'bold',
              color: '#F5EFE3', background: '#B03A2E',
              border: '2px solid #C9A86A', borderRadius: 2,
              letterSpacing: 8, cursor: 'pointer',
              fontFamily: '"Kaiti SC", "楷体", serif',
              boxShadow: '0 2px 8px rgba(176,58,46,0.4)',
            }}
          >
            开 始
          </button>
        </div>
      </div>
    </div>
  )
}
