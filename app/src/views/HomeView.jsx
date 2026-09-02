// app/src/views/HomeView.jsx
// 主页面（武康路俯瞰 + 4 主角 + 5 邻里 + 今天可做 + 打烊·传火）
// 1:1 还原 mockup-01/02/03/04 + 30 张 mockup 总和

import NPC_AGENTS from '../data/npcAgents.js'
import { HERO_FOUR_EXT, NEIGHBORS } from '../data/heroFour.js'
import { getLunarDate } from '../data/lunar.js'
import TodayTasks from '../components/TodayTasks.jsx'
import DreamBanner from '../components/DreamBanner.jsx'
import HeroCard from './HeroCard.jsx'
import NeighborCard from './NeighborCard.jsx'
import { clearSave } from '../state/store.js'

export default function HomeView({ G, onOpenNpc, onSettings, onReset, onAcceptDream, onEndOfDay }) {
  const pendingDream = (G.dreamQueue || []).filter((d) => !d.responded && d.expiresAtDay >= G.day).sort((a, b) => b.day - a.day)[0]
  const lunarDate = getLunarDate(G.day)

  return (
    <div style={{
      position: 'relative',
      height: '100vh', overflow: 'hidden',
      background: '#0A0A0A', color: '#F5EFE3',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 背景图：武康路俯瞰街景（全屏，半透明叠加） */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
      }}>
        <img
          src="/img/scenes/01-wukangroad-俯瞰全景-五洲立面-1936街景.png"
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%',
            opacity: 0.62, position: 'absolute', top: 0, left: 0,
          }}
        />
        {/* 顶部 + 底部渐变（暗色场景仍要保文字可读） */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, background: 'linear-gradient(180deg, rgba(15,18,22,0.88) 0%, rgba(15,18,22,0.45) 60%, transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140, background: 'linear-gradient(0deg, rgba(15,18,22,0.94) 0%, rgba(15,18,22,0.55) 60%, transparent 100%)' }} />
      </div>

      {/* 顶栏（按新 mockup 顶栏，3 字段 + 顶部副标题）—— 紧凑 56px 高 */}
      <div style={{ position: 'relative', zIndex: 3, flexShrink: 0, height: 56 }}>
        <div style={{
          height: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 28px',
          background: 'linear-gradient(180deg, rgba(15,18,22,0.92) 0%, rgba(15,18,22,0.55) 80%, transparent 100%)',
        }}>
          {/* 左：1936 日期 + 农历副标题 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 'bold', color: '#F5EFE3', letterSpacing: 1 }}>
                {(() => {
                  const d = new Date(new Date(1936, 0, 1).getTime() + (G.day - 1) * 86400000)
                  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                })()}
              </span>
              <span style={{
                display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                background: 'radial-gradient(circle, #E04A3E 0%, #B03A2E 70%)',
                boxShadow: '0 0 6px rgba(224,74,62,0.6)',
              }} />
            </div>
            <span style={{ fontSize: 10, color: '#C9A86A', letterSpacing: 3, paddingLeft: 2 }}>
              {lunarDate}
            </span>
          </div>

          {/* 中：第 X 天 / 100 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#C9A86A' }}>◆</span>
            <span style={{ fontSize: 20, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 2 }}>
              第 {G.day} 天 / 100
            </span>
            <span style={{ fontSize: 10, color: '#C9A86A' }}>◆</span>
          </div>

          {/* 右：距清明 + 设置/提示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 2 }}>
                {G.day >= 95 ? '清明已至' : `距清明 ${95 - G.day} 天`}
              </span>
              <span style={{
                display: 'inline-block', width: 14, height: 18, borderRadius: '50% 50% 45% 45%',
                background: 'radial-gradient(circle at 30% 30%, #E04A3E 0%, #B03A2E 70%)',
                boxShadow: '0 0 10px rgba(176,58,46,0.5)',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onSettings} title="设置（音效/语言/重置存档）" style={{
                padding: '4px 12px', background: 'rgba(245,239,227,0.08)',
                border: '1px solid rgba(201,168,106,0.5)', color: '#F5EFE3',
                fontFamily: '"Kaiti SC", "楷体", serif', fontSize: 12, cursor: 'pointer',
                borderRadius: 2, letterSpacing: 2,
              }}>设置</button>
              <button onClick={() => {
                // "提示"按钮：实时算亲密度最低的 4 主角，给精准建议
                const lowest = Object.entries(G.npcPortrait || {})
                  .filter(([id]) => ['xiangsongmao','fangyexian','guole','bajin'].includes(id))
                  .sort(([,a], [,b]) => (a.intimacy || 0) - (b.intimacy || 0))[0]
                const hint = lowest
                  ? `建议先去找 ${NPC_AGENTS[lowest[0]]?.name}（亲密最低 ${lowest[1].intimacy || 0}）聊聊`
                  : '全员都熟了，可以推进 day'
                const dayHint = G.day >= 95 ? '已到清明前夕，注意"梦回 1937"弹窗' :
                                G.day >= 50 ? '已过半，进度进入抉择期' :
                                G.day >= 20 ? '中盘期，多跟 4 主角聊' :
                                '前期，跟 4 位传奇人物多聊聊'
                alert(`第 ${G.day} 天 / 100 天\n\n📅 ${dayHint}\n👥 ${hint}\n💡 提示：敢输"滚"试 NPC 变脸`)
              }} style={{
                padding: '4px 12px', background: 'rgba(176,58,46,0.55)',
                border: '1px solid rgba(201,168,106,0.5)', color: '#F5EFE3',
                fontFamily: '"Kaiti SC", "楷体", serif', fontSize: 12, cursor: 'pointer',
                borderRadius: 2, letterSpacing: 2,
              }}>提示</button>
            </div>
          </div>
        </div>
      </div>

      {/* Dream 横幅（如有未处理的梦）—— 紧凑 32px 高 */}
      {pendingDream && (
        <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, padding: '4px 28px 0' }}>
          <DreamBanner dream={pendingDream} onAccept={() => onAcceptDream(pendingDream)} />
        </div>
      )}

      {/* 中央：游戏大标题（v3 重做：紧凑 60px 高，齐聚麒麟角传奇人物 + 解锁 同行） */}
      <div style={{
        position: 'relative', zIndex: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 28px', color: '#F5EFE3',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 'bold', letterSpacing: 6, margin: 0,
            color: '#F5EFE3', lineHeight: 1,
            textShadow: '0 2px 6px rgba(0,0,0,0.6), 0 0 16px rgba(201,168,106,0.25)',
            fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
          }}>
            五洲大药房
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#C9A86A', letterSpacing: 4 }}>
              民族企业 · 1936
            </span>
            <span style={{ fontSize: 10, color: 'rgba(201,168,106,0.6)', letterSpacing: 3 }}>
              守仁·松茂·五洲
            </span>
          </div>
        </div>
        {/* 右侧"齐聚麒麟角传奇人物 + 解锁" —— 同行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 4, fontFamily: '"Kaiti SC", "楷体", serif' }}>
            齐聚麒麟角传奇人物
          </span>
          <button
            onClick={() => {
              const unlocked = Object.entries(G.npcPortrait || {})
                .filter(([_, p]) => (p.intimacy || 0) >= 3)
                .map(([id]) => NPC_AGENTS[id]?.name || id)
              alert(unlocked.length > 0
                ? `已深度结交：${unlocked.join('、')}`
                : '暂未解锁任何深度关系（intimacy ≥ 3）')
            }}
            style={{
              padding: '4px 14px',
              background: 'rgba(176,58,46,0.7)', color: '#F5EFE3',
              border: '1.5px solid #C9A86A', borderRadius: 2,
              fontFamily: '"Kaiti SC", "楷体", serif', fontSize: 12, fontWeight: 'bold',
              letterSpacing: 4, cursor: 'pointer',
            }}>
            解锁
          </button>
        </div>
      </div>

      {/* 主体：左 今天可做(4) + 右 4 传奇 + 5 邻里 —— 严格 flex:1 填满剩余高度 */}
      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12,
        padding: '4px 28px 0',
        alignItems: 'flex-start',
      }}>
        {/* 左：今天可做 (4) —— 自然高度，不撑满 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
          <TodayTasks G={G} onOpenNpc={onOpenNpc} onAcceptDream={onAcceptDream} />
        </div>

        {/* 右：9 张卡（4 传奇 + 5 邻里，2 个 grid 比例 1.4:1 + 最小高度） */}
        <div style={{ display: 'grid', gridTemplateRows: 'minmax(340px, 1.4fr) minmax(240px, 1fr)', gap: 6, minHeight: 0 }}>
          {/* 4 核心 NPC —— 占上半：1 行 grid，stretch 到整个 1.4fr */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr',
            gap: 8, minHeight: 0,
          }}>
            {HERO_FOUR_EXT.map((h) => {
              const p = G.npcPortrait?.[h.id] || { mood: '平静', intimacy: 0 }
              return (
                <HeroCard
                  key={h.id}
                  npcId={h.id}
                  name={h.name}
                  era={h.era}
                  role={h.role}
                  location={h.location}
                  mood={p.mood}
                  intimacy={p.intimacy}
                  onClick={() => onOpenNpc(h.id)}
                />
              )
            })}
          </div>

          {/* 5 邻里 —— 占下半：标签条 + 1 行 5 卡 grid */}
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 4, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block', width: 3, height: 14,
                background: 'linear-gradient(180deg, #C9A86A 0%, #B03A2E 100%)',
                borderRadius: 1,
              }} />
              <span style={{ fontSize: 13, color: '#F5EFE3', fontWeight: 'bold', letterSpacing: 3, fontFamily: '"Kaiti SC", "楷体", serif' }}>
                齐堂邻里
              </span>
              <span style={{ fontSize: 10, color: 'rgba(201,168,106,0.55)', letterSpacing: 1, marginLeft: 'auto' }}>
                5 位 · 弄堂众生
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr',
              gap: 8, minHeight: 0,
            }}>
              {NEIGHBORS.map((n) => {
                const p = G.npcPortrait?.[n.id] || { mood: '平静', intimacy: 0 }
                return (
                  <NeighborCard
                    key={n.id}
                    npcId={n.id}
                    name={n.name}
                    role={n.role}
                    mood={p.mood}
                    intimacy={p.intimacy}
                    onClick={() => onOpenNpc(n.id)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 底部：版本 + 重开 + 明日预告（左）| 打烊 · 传火（右） —— 紧凑 56px 高 */}
      <div style={{
        position: 'relative', zIndex: 4, flexShrink: 0, height: 56,
        background: 'linear-gradient(0deg, rgba(15,18,22,0.95) 0%, rgba(15,18,22,0.6) 60%, transparent 100%)',
        padding: '0 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {/* 左：版本 + 重开 + 明日预告 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#F5EFE3', fontSize: 13 }}>
          <span style={{ color: 'rgba(245,239,227,0.65)' }}>
            版本已读 / 1.0 版
          </span>
          {/* 重开游戏按钮（v3：账本删除后用重开占位） */}
          <span
            onClick={() => {
              if (confirm('确认重开？当前进度会清空。')) {
                clearSave()
                location.reload()
              }
            }}
            style={{
              padding: '5px 12px', background: 'rgba(176,58,46,0.85)', color: '#F5EFE3',
              border: '1px solid #C9A86A', cursor: 'pointer', fontSize: 12,
              fontFamily: '"Kaiti SC", "楷体", serif', borderRadius: 2,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >重 开</span>
          {/* 明日预告（节拍器结果，紧凑 1 行）—— v9：todayPlan 描述的是当前 day，文案改「今日」 */}
          {G.todayPlan && G.day < 100 && (
            <span style={{
              color: '#C9A86A', fontSize: 11, letterSpacing: 1,
              borderLeft: '1px solid rgba(201,168,106,0.4)',
              paddingLeft: 12,
              maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              今日：{G.todayPlan.dailyTask?.label || `${G.todayPlan.actTitle}`}
            </span>
          )}
        </div>

        {/* 右：朱砂"打烊 · 传火"按钮 */}
        <button
          onClick={onEndOfDay}
          style={{
            padding: '10px 32px',
            background: 'linear-gradient(135deg, #B03A2E 0%, #8B2A1E 100%)',
            color: '#F5EFE3',
            border: '2px solid #C9A86A',
            borderRadius: 2, cursor: 'pointer',
            fontSize: 17, fontWeight: 'bold',
            fontFamily: '"Kaiti SC", "楷体", "SimSun", serif',
            letterSpacing: 4,
            boxShadow: '0 4px 16px rgba(176,58,46,0.5), inset 0 1px 0 rgba(245,239,227,0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{
            display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
            background: 'radial-gradient(circle, #E04A3E 0%, #B03A2E 70%)',
            boxShadow: '0 0 8px rgba(224, 74, 62, 0.6)',
          }} />
          <span>打烊 · 传火</span>
          <span style={{ fontSize: 20 }}>→</span>
        </button>
      </div>
    </div>
  )
}
