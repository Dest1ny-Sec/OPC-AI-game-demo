// app/src/views/QingmingTombView.jsx
// 清明墓园页 —— 1:1 还原 mockup-07 + scenes/07-qingming-tomb
// 第 100 天：玩家 + 巴金在曾祖墓前
// 4 NPC 各留 1 件信物（怀表/配方本/手杖/钢笔）

import { FINAL_LETTERS } from '../data/finalLetters.js'

export default function QingmingTombView({ G, onClose, onReadLetter, onContinue }) {
  const sceneBg = '/img/scenes/07-qingming-tomb-清明碑院-石碑4信物春雨.png'
  return (
    <div style={{
      minHeight: '100vh', position: 'relative',
      background: '#1A1410', fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      color: '#F5EFE3',
    }}>
      {/* v2: 左上角"返"字返回主页 */}
      <button onClick={onClose} title="返回主页" aria-label="返回主页" style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        width: 40, height: 40, padding: 0,
        background: 'transparent', border: '1.5px solid #C9A86A', color: '#C9A86A',
        fontSize: 18, fontWeight: 'bold', cursor: 'pointer', borderRadius: 2,
        fontFamily: '"Kaiti SC", "楷体", serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>返</button>
      {/* 清明墓园场景（按 mockup-07 还原） */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${sceneBg})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.5,
      }} />
      {/* 顶部黑底遮罩 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240, background: 'linear-gradient(180deg, #1A1410 0%, transparent 100%)', zIndex: 1 }} />
      {/* 底部黑底遮罩 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 360, background: 'linear-gradient(0deg, #1A1410 0%, transparent 100%)', zIndex: 1 }} />

      {/* 标题 */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '40px 32px 20px' }}>
        <div style={{ fontSize: 14, letterSpacing: 6, color: '#C9A86A', marginBottom: 8 }}>清明 · 1936 春 · {G.day >= 95 ? '清明后数日' : '清明前夕'}</div>
        <div style={{ fontSize: 36, fontWeight: 'bold', color: '#F5EFE3', letterSpacing: 6 }}>曾 祖 墓 前</div>
        <div style={{ fontSize: 16, color: '#C9A86A', marginTop: 8, letterSpacing: 2 }}>玩家 + 巴金 · 春雨绵绵</div>
      </div>

      {/* 墓前 4 件信物（手写描述） */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 32px', marginTop: 60 }}>
        <div style={{ fontSize: 14, color: '#C9A86A', marginBottom: 16, letterSpacing: 4, textAlign: 'center' }}>墓前 4 件信物</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {FINAL_LETTERS.map((l, i) => (
            <div key={i} onClick={() => onReadLetter(i)} style={{
              background: 'rgba(245, 239, 227, 0.95)',
              border: '2px solid #B03A2E',
              padding: 16, cursor: 'pointer',
              textAlign: 'center', fontFamily: '"Kaiti SC", "楷体", serif',
            }}>
              <div style={{ fontSize: 18, color: '#B03A2E', fontWeight: 'bold', marginBottom: 4 }}>{l.from}</div>
              <div style={{ fontSize: 12, color: '#6B4E2E' }}>{l.value}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#1F2A33', borderTop: '1px solid #C9A86A', paddingTop: 6 }}>
                {['金怀表', '德文配方本', '手杖', '派克钢笔'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 巴金台词（手写） */}
      <div style={{
        position: 'relative', zIndex: 2,
        margin: '40px 32px 0',
        background: 'rgba(245, 239, 227, 0.95)',
        border: '1px solid #C9A86A',
        padding: 24,
        fontFamily: '"Kaiti SC", "楷体", serif',
      }}>
        <div style={{ fontSize: 14, color: '#B03A2E', fontWeight: 'bold', marginBottom: 10, letterSpacing: 4 }}>巴 金 念 出</div>
        <div style={{ fontSize: 17, color: '#1F2A33', lineHeight: 2, textIndent: '2em' }}>
          「侬翻开账本最后一页，曾祖父的名字是侬的名字。侬没有穿越，侬回来了。<br/>
          1936 年是阿拉写《家》的年代，1937 年是日本人的年代。侬回 2026 年，<br/>
          记得阿拉，记得武康路，记得这本账，就够。」
        </div>
      </div>

      {/* 底部按钮 */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '32px 32px' }}>
        <button onClick={onContinue} style={{
          padding: '14px 40px',
          background: 'linear-gradient(135deg, #B03A2E 0%, #8B2A1E 100%)',
          color: '#F5EFE3',
          border: '2px solid #C9A86A', borderRadius: 4, cursor: 'pointer',
          fontSize: 18, fontWeight: 'bold', letterSpacing: 6,
          fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
          boxShadow: '0 4px 16px rgba(176,58,46,0.5)',
        }}>做 出 你 的 选 择</button>
      </div>

      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(31,42,51,0.85)', border: 'none',
          color: '#F5EFE3', fontSize: 18, cursor: 'pointer', lineHeight: '36px',
        }}>×</button>
      </div>
    </div>
  )
}
