// app/src/views/EndingPage.jsx
// 结局页（v2 统一布局：10 结局共用，按民国报纸精神病院告示复刻）
// 1:1 还原 mockup-08

import { ENDING_CATALOG } from '../data/endingCatalog.js'

export default function EndingPage({ endingId, reason, onReset, onHome, onShare, onViewFragments, onRestart }) {
  const data = ENDING_CATALOG[endingId] || ENDING_CATALOG.asylum

  // 印记 SVG（按 seal 类型）
  const Seal = () => {
    if (data.seal === 'STAR') {
      return (
        <svg viewBox="0 0 100 100" width="120" height="120">
          <polygon points="50,5 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38"
            fill="#B03A2E" stroke="#8B2418" strokeWidth="2" />
        </svg>
      )
    }
    if (data.seal === 'LOTUS') {
      return (
        <svg viewBox="0 0 100 100" width="120" height="120">
          <circle cx="50" cy="50" r="30" fill="none" stroke="#B03A2E" strokeWidth="3" />
          <circle cx="50" cy="50" r="12" fill="#B03A2E" />
          <line x1="50" y1="10" x2="50" y2="20" stroke="#B03A2E" strokeWidth="3" />
          <line x1="50" y1="80" x2="50" y2="90" stroke="#B03A2E" strokeWidth="3" />
          <line x1="10" y1="50" x2="20" y2="50" stroke="#B03A2E" strokeWidth="3" />
          <line x1="80" y1="50" x2="90" y2="50" stroke="#B03A2E" strokeWidth="3" />
        </svg>
      )
    }
    if (data.seal === 'FLAME') {
      return (
        <svg viewBox="0 0 100 120" width="110" height="130">
          <path d="M50 10 Q70 35 60 60 Q70 80 50 100 Q30 80 40 60 Q30 35 50 10 Z"
            fill="#B03A2E" stroke="#8B2418" strokeWidth="2" />
          <rect x="44" y="100" width="12" height="14" fill="#1F2A33" />
        </svg>
      )
    }
    // 默认朱砂 X
    return (
      <svg viewBox="0 0 200 200" width="200" height="200">
        <line x1="20" y1="20" x2="180" y2="180" stroke="#B03A2E" strokeWidth="22" strokeLinecap="round" />
        <line x1="180" y1="20" x2="20" y2="180" stroke="#B03A2E" strokeWidth="22" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      padding: '40px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", "SimSun", serif',
      boxSizing: 'border-box',
    }}>
      {/* 顶部：返回主页 */}
      <div style={{ width: '100%', maxWidth: 720, display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        {onHome && (
          <button onClick={onHome} title="返回主页" aria-label="返回主页" style={{
            width: 40, height: 40, padding: 0,
            background: 'transparent', border: '1.5px solid #C9A86A', color: '#C9A86A',
            fontSize: 18, fontWeight: 'bold', cursor: 'pointer', borderRadius: 2,
            fontFamily: '"Kaiti SC", "楷体", serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>返</button>
        )}
        <div style={{ color: '#C9A86A', fontSize: 13, letterSpacing: 4, fontFamily: '"Kaiti SC", "楷体", serif' }}>
          · 弄堂沉浮录 · 1936 · 结局 ·
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* 民国报纸卡片（按用户提供的精神病院图复刻） */}
      <div style={{
        width: '100%', maxWidth: 720,
        background: '#F0E8D3',
        backgroundImage: 'radial-gradient(ellipse at center, #F5EFE3 0%, #E8DDC4 70%, #D8C9A8 100%)',
        padding: '60px 70px 50px',
        position: 'relative',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 0 60px rgba(139,94,60,0.12)',
        color: '#1F2A33',
        // 牛皮纸纹理
        backgroundSize: 'cover',
      }}>
        {/* 顶部小字：年代 */}
        <div style={{
          textAlign: 'center', fontSize: 13, color: '#6B4E2E',
          letterSpacing: 6, paddingBottom: 18, marginBottom: 24,
          borderBottom: '1px solid #B8956A',
          fontFamily: '"Kaiti SC", "楷体", serif',
        }}>
          ⎯⎯ {data.date} · 沪上 ⎯⎯
        </div>

        {/* 标题（大字 + 朱砂印记覆盖） */}
        <div style={{
          position: 'relative', textAlign: 'center', marginBottom: 30, minHeight: 110,
        }}>
          <div style={{
            fontSize: 72, fontWeight: 'bold', color: '#1F2A33',
            letterSpacing: 14,
            fontFamily: '"Heiti SC", "STHeiti", "SimHei", "Microsoft YaHei", sans-serif',
            lineHeight: 1.1,
            textShadow: '2px 2px 0 rgba(0,0,0,0.05)',
            position: 'relative', zIndex: 1,
          }}>
            {data.title}
          </div>
          {/* 朱砂印记覆盖 */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) ' + (data.seal === 'X' ? 'rotate(-12deg)' : 'rotate(-6deg)'),
            opacity: data.seal === 'X' ? 0.82 : 0.68, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Seal />
          </div>
        </div>

        {/* 副标题（一句话定性） */}
        <div style={{
          textAlign: 'center', fontSize: 22, color: '#1F2A33',
          fontWeight: 'bold', letterSpacing: 4, marginBottom: 24,
          fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
        }}>
          ── {data.subtitle} ──
        </div>

        {/* 横向分隔线（点状装饰） */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 24px',
        }}>
          <div style={{ flex: 1, height: 1, background: '#B8956A' }} />
          <div style={{ width: 6, height: 6, background: '#B8956A', transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 1, background: '#B8956A' }} />
        </div>

        {/* 民国公文文体 4 段 */}
        <div style={{ fontSize: 16, lineHeight: 2, color: '#1F2A33', marginBottom: 28,
          fontFamily: '"Kaiti SC", "楷体", "SimSun", serif', textAlign: 'justify' }}>
          {data.paragraphs.map((p, i) => (
            <div key={i} style={{ textIndent: '2em', marginBottom: 4 }}>{p}</div>
          ))}
        </div>

        {/* 中间老照片（按用户图：精神病院建筑立绘） */}
        <div style={{ width: '100%', margin: '0 auto 24px', textAlign: 'center' }}>
          <img src={data.image} alt={data.title}
            style={{
              maxWidth: '100%', maxHeight: 280,
              filter: 'sepia(0.35) contrast(1.05) brightness(0.95)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
              objectFit: 'contain',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        {/* 横向分隔线 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '24px 0 16px',
        }}>
          <div style={{ flex: 1, height: 1, background: '#B8956A' }} />
          <div style={{ width: 6, height: 6, background: '#B8956A', transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 1, background: '#B8956A' }} />
        </div>

        {/* 你的结局标题 */}
        <div style={{
          textAlign: 'center', fontSize: 20, color: '#1F2A33',
          fontWeight: 'bold', letterSpacing: 8, marginBottom: 16,
          fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
        }}>
          ◆ 你 的 结 局 ◆
        </div>

        {/* 3-4 条 bullet */}
        <div style={{ marginBottom: 24, fontSize: 16, lineHeight: 2, color: '#1F2A33',
          fontFamily: '"Kaiti SC", "楷体", serif' }}>
          {data.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: '#B03A2E', fontSize: 18, lineHeight: '2' }}>•</span>
              <span style={{ flex: 1 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* 朱砂强调句 */}
        <div style={{
          textAlign: 'center', fontSize: 24, color: '#B03A2E',
          fontWeight: 'bold', letterSpacing: 4, marginTop: 8, marginBottom: 24,
          fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
        }}>
          {data.emphasis}
        </div>

        {/* 触发原因 */}
        {reason && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#6B4E2E', letterSpacing: 2, marginTop: 12 }}>
            触发原因：{reason}
          </div>
        )}
      </div>

      {/* 4 按钮（v3 新增分享/查看碎片/重开） */}
      <div style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onReset || onRestart} style={{
          padding: '14px 32px',
          background: '#F5EFE3', color: '#1F2A33',
          border: '2px solid #1F2A33', borderRadius: 4, cursor: 'pointer',
          fontSize: 17, fontWeight: 'bold', fontFamily: '"Kaiti SC", "楷体", serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: 4,
        }}>
          重新开始
        </button>
        <button onClick={onHome} style={{
          padding: '14px 32px',
          background: 'transparent', color: '#C9A86A',
          border: '2px solid #C9A86A', borderRadius: 4, cursor: 'pointer',
          fontSize: 17, fontWeight: 'bold', fontFamily: '"Kaiti SC", "楷体", serif',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: 4,
        }}>
          留在这里
        </button>
        {onShare && (
          <button onClick={onShare} style={{
            padding: '14px 32px',
            background: 'transparent', color: '#C9A86A',
            border: '2px solid #C9A86A', borderRadius: 4, cursor: 'pointer',
            fontSize: 17, fontWeight: 'bold', fontFamily: '"Kaiti SC", "楷体", serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: 4,
          }}>
            分享
          </button>
        )}
        {onViewFragments && (
          <button onClick={onViewFragments} style={{
            padding: '14px 32px',
            background: 'transparent', color: '#C9A86A',
            border: '2px solid #C9A86A', borderRadius: 4, cursor: 'pointer',
            fontSize: 17, fontWeight: 'bold', fontFamily: '"Kaiti SC", "楷体", serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', letterSpacing: 4,
          }}>
            查看碎片
          </button>
        )}
      </div>
    </div>
  )
}
