// app/src/views/DialogueView.jsx
// 对话页（galgame 风格：左 NPC 立绘 1:1 居中 + 右暗色对话框 + 底意图卡 + 输入框）
// 1:1 还原 mockup-05

import { useState, useEffect, useRef } from 'react'
import NPC_AGENTS from '../data/npcAgents.js'
import { SCENES, NPC_SCENES } from '../data/scenes.js'
import { initNpcPortrait, moodToPortraitUrl } from '../rules/portrait.js'
import { npcAgent, buildNpcSystemPrompt } from '../services/dialogueService.js'
import { processDialogueTurn } from '../engine/processDialogue.js'
import { processPlayerChoice } from '../engine/commitDay.js'
import { getAvailableChoices } from '../rules/branching.js'
import { INTENT_CARDS } from '../data/intentCards.js'
import TopBar from '../components/TopBar.jsx'
import DialogueBottomNav from './DialogueBottomNav.jsx'

// 思考指示器动画 + 情绪脉冲
const THINKING_DOTS_STYLE = `
@keyframes cw-thinking-dots {
  0%, 20% { opacity: 0.25; }
  50%     { opacity: 1; }
  80%,100%{ opacity: 0.25; }
}
.cw-thinking-dot {
  display: inline-block;
  width: 8px; height: 8px;
  margin: 0 4px;
  border-radius: 50%;
  background: #C9A86A;
  box-shadow: 0 0 6px rgba(201,168,106,0.6);
  animation: cw-thinking-dots 1.4s infinite ease-in-out;
}
.cw-thinking-dot:nth-child(1) { animation-delay: 0s; }
.cw-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.cw-thinking-dot:nth-child(3) { animation-delay: 0.4s; }

/* 情绪脉冲：mood 改变时短暂高亮立绘外框 */
@keyframes cw-mood-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(201,168,106,0.6), 0 12px 40px rgba(0,0,0,0.45); }
  50%  { box-shadow: 0 0 0 6px rgba(201,168,106,0.0), 0 12px 40px rgba(0,0,0,0.45); }
  100% { box-shadow: 0 0 0 0 rgba(201,168,106,0.0), 0 12px 40px rgba(0,0,0,0.45); }
}
.cw-mood-pulse {
  animation: cw-mood-pulse 1.6s ease-out 1;
}

/* 情绪按 mood 选边框色（愤怒=朱砂、愉悦=淡金、忧虑=墨青、烦躁=朱砂偏深） */
.cw-mood-frame {
  border: 3px solid #C9A86A;
  transition: border-color 0.4s;
}
.cw-mood-frame.angry   { border-color: #B03A2E; }
.cw-mood-frame.tense   { border-color: #A85A3E; }
.cw-mood-frame.happy   { border-color: #E27D60; }
.cw-mood-frame.worried { border-color: #6B7B8C; }
.cw-mood-frame.sad     { border-color: #4A5C6A; }
`

export default function DialogueView({ G, npcId, onClose, onStateChange, onSwitchView }) {
  const npc = NPC_AGENTS[npcId]
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [refusedInfo, setRefusedInfo] = useState(null)
  const bodyRef = useRef(null)
  const portrait = G.npcPortrait?.[npcId] || initNpcPortrait()[npcId]
  const mood = portrait.mood || '平静'
  // 情绪变化检测：mood 变化时短暂高亮立绘框（rude/awkward 命中后立绘 + 边框 + 心绪点都会更新）
  const prevMoodRef = useRef(mood)
  const [moodChanged, setMoodChanged] = useState(false)
  useEffect(() => {
    if (prevMoodRef.current && prevMoodRef.current !== mood) {
      setMoodChanged(true)
      const t = setTimeout(() => setMoodChanged(false), 1700)
      prevMoodRef.current = mood
      return () => clearTimeout(t)
    }
    prevMoodRef.current = mood
  }, [mood])
  // mood → CSS class（用于边框色 + pulse 动画）
  const MOOD_CLASS = {
    '愤怒': 'angry',
    '烦躁': 'tense',
    '愉悦': 'happy',
    '忧虑': 'worried',
    '悲哀': 'sad',
  }
  const moodFrameClass = `cw-mood-frame ${MOOD_CLASS[mood] || ''} ${moodChanged ? 'cw-mood-pulse' : ''}`.trim()
  const sceneId = NPC_SCENES[npcId] || 'pharmacy'
  const scene = SCENES[sceneId] || SCENES.pharmacy
  const activeDream = (G.dreamQueue || []).find((d) => d.npcId === npcId && !d.responded)
  // 怀疑度（保留数据但 UI 不显示）
  const suspicion = G.suspicion?.[npcId] || 0

  // 场景图：按 NPC 选对应场景
  const SCENE_BG_MAP = {
    pharmacy: '/img/scenes/02-wuzhou-pharmacy-内景-药柜算盘账本铜秤.png',
    alley: '/img/scenes/01-wukangroad-俯瞰全景-五洲立面-1936街景.png',
    teahouse: '/img/scenes/05-wangpo-teahouse-王婆茶馆内景-八仙桌条凳红灯笼.png',
    french_concession: '/img/scenes/01-wukangroad-俯瞰全景-五洲立面-1936街景.png',
    '16pu_dock': '/img/scenes/06-shiliupu-dock-十六铺码头-黄浦江老式货船.png',
    yongan_dept: '/img/scenes/04-yongan-department-永安百货内景-多层货架铁艺电梯.png',
    bajin_study: '/img/scenes/03-bajin-study-书房-满墙书架文房四宝.png',
  }
  const sceneBg = SCENE_BG_MAP[sceneId] || SCENE_BG_MAP.pharmacy

  // NPC 角色副标题（按 mockup 的"办牌掌柜"位置）
  const NPC_ROLE_LABEL = {
    xiangsongmao: '办牌掌柜',
    fangyexian:   '化学药师',
    guole:        '永安掌柜',
    bajin:        '青年作家',
    wangpo:       '弄堂接济人',
    xunpu:        '法租界巡捕',
    qingbang:     '弄堂秩序',
    rishang:      '日资洋行',
    dixia:        '暗中布道',
  }
  const roleLabel = NPC_ROLE_LABEL[npcId] || npc.role_in_game || ''

  // 对话阶段（按 mood 推断，按 mockup 的"审问阶段"）
  const STAGE_LABEL = {
    '愤怒': '对峙中',
    '烦躁': '僵持中',
    '忧虑': '深谈中',
    '悲哀': '伤逝中',
    '愉悦': '融洽中',
    '平静': '闲谈中',
  }
  const stageLabel = STAGE_LABEL[mood] || '闲谈中'

  // 心绪分数 —— v9 修复：此前读 npcAgents 静态数据（toward_player 永不变化），
  //   改为从 4 维 portrait 实时计算：trust 高/紧张低/亲密高 → 高分
  const moodScore = Math.round(Math.max(0, Math.min(100,
    (portrait.trust || 50) - (portrait.tension || 0) + (portrait.intimacy || 0) * 8
  )))

  // 当前 location 标签（按场景）
  const LOCATION_LABEL = {
    pharmacy: '城西五洲大药房',
    alley: '武康路弄堂',
    teahouse: '弄堂茶馆',
    french_concession: '法租界街头',
    '16pu_dock': '十六铺码头',
    yongan_dept: '永安百货',
    bajin_study: '武康路书房',
  }
  const locationLabel = LOCATION_LABEL[sceneId] || scene.name || ''

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs])

  useEffect(() => {
    if (activeDream && activeDream.lines && msgs.length === 0) {
      setMsgs(activeDream.lines.map((line) => ({ role: 'npc', text: line, dream: true })))
    }
  }, [activeDream?.id])

  async function send(textOverride) {
    const text = (textOverride !== undefined ? textOverride : input).trim()
    if (!text || streaming) return
    setInput('')
    setStreaming(true)

    const result = processDialogueTurn(G, npcId, text, { npcName: npc.name })
    if (result.refused) {
      // v2.1: 拒答时直接用 gameEngine 给的 refusalReply（中文模板），不调 LLM
      //   - 玩家立刻看到「项松茂别过脸去不愿与你说话」+ 拒绝原因
      //   - 立绘已切到对应 mood（result.mood = talkCheck.mood）
      //   - 输入框 / 按钮 / 意图卡都重新 enabled（玩家可换态度重说）
      //   - 不再卡 LLM（之前 5+ 秒不返回让用户以为卡了）
      setRefusedInfo({ reason: result.refusalReason, reply: result.refusalReply, mode: 'final' })
      // v9: 拒绝也要把玩家消息放进聊天记录（此前看不到自己说了什么，M-3）
      setMsgs(m => [...m, { role: 'user', text }])
      setStreaming(false)
      onStateChange(result.state)
      return
    }
    setRefusedInfo(null)
    onStateChange(result.state)

    let fullText = ''
    try {
      setMsgs(m => [...m, { role: 'user', text }])
      const sysPrompt = buildNpcSystemPrompt(npc, text, G.day, result.newPortrait, scene.name)
      await npcAgent({
        npc: { name: npc.name, system: sysPrompt },
        playerInput: text,
        day: G.day,
        portrait: result.newPortrait,
        scene: scene.name,
      }, (delta) => {
        fullText += delta
        setMsgs(m => {
          const nm = [...m]
          if (nm.length > 0 && nm[nm.length - 1].role === 'npc' && nm[nm.length - 1].streaming) {
            nm[nm.length - 1] = { ...nm[nm.length - 1], text: fullText }
          } else {
            nm.push({ role: 'npc', text: fullText, streaming: true })
          }
          return nm
        })
      })
      setMsgs(m => {
        const nm = [...m]
        if (nm.length > 0) nm[nm.length - 1] = { ...nm[nm.length - 1], streaming: false }
        return nm
      })
    } catch (e) {
      setMsgs(m => [...m, { role: 'system', text: '回复失败：' + e.message }])
    } finally {
      setStreaming(false)
    }
  }

  // 取最新一条 NPC 消息（galgame 风格：右半屏只显示最新一条）
  const lastNpcMsg = [...msgs].reverse().find((m) => m.role === 'npc')
  // streaming 期间：优先取正在流的 npc msg；没有就 null（触发"思考中"dots）
  // 不取上一轮的 lastNpcMsg，否则第二轮会一直显示旧回复、玩家以为没反应
  const lastStreamingNpcMsg = [...msgs].reverse().find((m) => m.role === 'npc' && m.streaming)
  const displayMsg = streaming
    ? (lastStreamingNpcMsg || null)
    : (lastNpcMsg || (refusedInfo ? { text: refusedInfo.reply } : null))

  // v9：A/B 分支选择 —— 6 条路径真正可玩（此前 processPlayerChoice 从未被 UI 调用）
  const availChoices = getAvailableChoices(npcId, '', G)
  async function handleChoice(choice) {
    if (streaming) return
    setStreaming(true)
    const pc = processPlayerChoice(G, choice.choiceId, npcId)
    const afterState = pc.state
    onStateChange(afterState)
    setMsgs(m => [...m, { role: 'user', text: `【抉择】${choice.text}` }])
    let fullText = ''
    try {
      const sysPrompt = buildNpcSystemPrompt(npc, choice.text, afterState.day, afterState.npcPortrait?.[npcId], scene.name)
      await npcAgent({
        npc: { name: npc.name, system: sysPrompt },
        playerInput: choice.text,
        day: afterState.day,
        portrait: afterState.npcPortrait?.[npcId],
        scene: scene.name,
      }, (delta) => {
        fullText += delta
        setMsgs(m => {
          const nm = [...m]
          if (nm.length > 0 && nm[nm.length - 1].role === 'npc' && nm[nm.length - 1].streaming) {
            nm[nm.length - 1] = { ...nm[nm.length - 1], text: fullText }
          } else {
            nm.push({ role: 'npc', text: fullText, streaming: true })
          }
          return nm
        })
      })
      setMsgs(m => {
        const nm = [...m]
        if (nm.length > 0) nm[nm.length - 1] = { ...nm[nm.length - 1], streaming: false }
        return nm
      })
    } catch (e) {
      setMsgs(m => [...m, { role: 'system', text: '回复失败：' + e.message }])
    }
    if (pc.branchActivated) {
      setMsgs(m => [...m, { role: 'system', text: `【${pc.branchName}】${pc.branchDesc}` }])
    }
    if (pc.storylineTriggered) {
      setMsgs(m => [...m, { role: 'system', text: `【剧情解锁】${pc.storylineTriggered.title}` }])
    }
    setStreaming(false)
  }

  // 意图卡点击：把卡片内容当 prompt 发送
  function onIntent(card) {
    send(card.main)
  }

  // 3-tab 切换（v2：去掉未实现功能）
  function switchView(target) {
    if (onSwitchView) onSwitchView(target)
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0A0A0A', fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif', overflow: 'hidden' }}>
      {/* ① 顶栏 3 字段 */}
      <div style={{ position: 'relative', zIndex: 4 }}>
        {/* v8: 删 TopBar 重复的「设」按钮（之前也跳 home，与「返」重复）—— 传 null 即不渲染 */}
        <TopBar day={G.day} variant="light" onHome={() => onSwitchView?.('home')} onSettings={null} />
      </div>

      {/* ② 副标题栏：location(左) | stage(中) | mood(右) */}
      <div style={{
        position: 'relative', zIndex: 3,
        height: 50,
        padding: '0 32px',
        background: 'linear-gradient(180deg, rgba(31,42,51,0.92) 0%, rgba(31,42,51,0.78) 100%)',
        borderBottom: '1px solid rgba(201,168,106,0.4)',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        color: '#C9A86A', fontSize: 14, letterSpacing: 2,
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#B03A2E' }} />
          <span style={{ fontWeight: 'bold' }}>{locationLabel}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 16, color: '#F5EFE3', fontWeight: 'bold' }}>
          ◆ {stageLabel} ◆
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#C9A86A' }}>心緒</span>
          <span style={{ fontSize: 18, color: '#F5EFE3', fontWeight: 'bold', minWidth: 28, textAlign: 'right' }}>{moodScore}</span>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: moodScore > 60 ? '#B03A2E' : moodScore > 30 ? '#C9A86A' : '#1F2A33',
            boxShadow: '0 0 8px rgba(176,58,46,0.6)',
            border: '1.5px solid #C9A86A',
          }} />
          {/* v9：显示巡捕怀疑度（此前 suspicion 只写不读；玩家能看到"被盯上"的风险） */}
          {suspicion > 0 && (
            <>
              <span style={{ fontSize: 13, color: '#C9A86A' }}>疑</span>
              <span style={{ fontSize: 18, color: suspicion >= 71 ? '#B03A2E' : '#C9A86A', fontWeight: 'bold', minWidth: 28, textAlign: 'right' }}>{suspicion}</span>
            </>
          )}
        </div>
      </div>

      {/* ③ 全屏场景背景 */}
      <div style={{
        position: 'absolute', top: 120, left: 0, right: 0, bottom: 280,
        backgroundImage: `url(${sceneBg})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        zIndex: 0,
      }} />

      {/* ④ 主体区：左 NPC 立绘 + 右 暗色对话框 */}
      <div style={{
        position: 'absolute', top: 140, left: 24, right: 24, bottom: 280,
        zIndex: 1, display: 'flex', gap: 24, alignItems: 'stretch',
      }}>
        {/* 左半屏：NPC 立绘（白卡片框 + 名字 overlay + 角色）—— v8: 名字移到立绘底部不超容器 */}
        <div style={{
          flex: '0 0 38%', maxWidth: 520, minHeight: 0,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div
            className={moodFrameClass}
            style={{
              background: '#F5EFE3', padding: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              position: 'relative',
              flex: '1 1 auto', minHeight: 0,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <img
              src={moodToPortraitUrl(mood, npcId)}
              alt={npc.name}
              style={{ width: '100%', flex: '1 1 auto', minHeight: 0, display: 'block', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/img/portraits/01-xiangsongmao-平静-圆脸方框眼镜礼帽长衫马褂-五洲药房背景.png' }}
            />
            {/* 朱砂大印（圆点 + 名字左侧装饰） */}
            <div style={{
              position: 'absolute', top: 22, left: 22,
              width: 18, height: 18, borderRadius: '50%', background: '#B03A2E',
              boxShadow: '0 0 0 4px rgba(176,58,46,0.18)',
            }} />
            {/* v8: 名字 + 角色叠加在立绘底部（米色半透明带）—— 不会再被意图卡遮住 */}
            <div style={{
              position: 'absolute', left: 10, right: 10, bottom: 10,
              padding: '10px 14px',
              background: 'linear-gradient(180deg, rgba(245,239,227,0) 0%, rgba(245,239,227,0.92) 30%, rgba(245,239,227,0.96) 100%)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22, color: '#1F2A33', fontWeight: 'bold', letterSpacing: 4, fontFamily: '"Kaiti SC", "楷体", serif' }}>{npc.name}</span>
              <span style={{ display: 'inline-block', width: 1, height: 16, background: 'rgba(176,58,46,0.5)' }} />
              <span style={{ fontSize: 13, color: '#6B4E2E', letterSpacing: 2 }}>{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* 右半屏：暗色对话框（纸感） */}
        <div style={{
          flex: 1, position: 'relative',
          background: 'rgba(20, 14, 10, 0.78)',
          backgroundImage: 'linear-gradient(180deg, rgba(20,14,10,0.82) 0%, rgba(31,18,12,0.78) 100%)',
          border: '1.5px solid #C9A86A',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.3)',
          padding: '32px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          {/* 注入思考指示器动画样式 */}
          <style>{THINKING_DOTS_STYLE}</style>

          {/* ① 思考中（最优先）：streaming=true 且还没回文字 */}
          {streaming && !displayMsg?.text ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              color: 'rgba(245,239,227,0.85)',
              fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
            }}>
              <span style={{ fontSize: 18, fontStyle: 'italic', letterSpacing: 1 }}>
                {npc.name}正在斟酌用词
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
                <span className="cw-thinking-dot" />
                <span className="cw-thinking-dot" />
                <span className="cw-thinking-dot" />
              </span>
            </div>
          ) : displayMsg ? (
            /* ② 正常文本（含正在流式回字） */
            <div style={{
              fontSize: 22, lineHeight: 2, color: '#F5EFE3', letterSpacing: 1.5,
              fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
              whiteSpace: 'pre-wrap',
            }}>
              {displayMsg.text}
              {displayMsg.streaming && displayMsg.text && (
                <span style={{ color: '#C9A86A', marginLeft: 4 }}>▍</span>
              )}
            </div>
          ) : (
            /* ③ 空状态：NPC 等玩家先开口 */
            <div style={{
              fontSize: 20, lineHeight: 2, color: 'rgba(245,239,227,0.55)', letterSpacing: 2,
              fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
              textAlign: 'center',
            }}>
              {npc.name}看着你，似乎在等你先开口。
            </div>
          )}
          {/* 右下角朱砂三角（继续提示） */}
          <div style={{
            position: 'absolute', bottom: 18, right: 22,
            width: 0, height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '14px solid #B03A2E',
          }} />
          {/* v6: 删右上角"打烊"按钮（与 TopBar 返字重复，TopBar 已有 onHome） */}
        </div>
      </div>

      {/* v9: A/B 分支选择条（6 路径入口；与意图卡互斥避免拥挤） */}
      {availChoices.length > 0 && !streaming && (
        <div style={{
          position: 'absolute', bottom: 252, left: 24, right: 24, zIndex: 2,
          display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center',
          fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
        }}>
          {availChoices.map((c) => (
            <button
              key={c.choiceId}
              onClick={() => handleChoice(c)}
              title={c.desc}
              style={{
                background: 'rgba(176, 58, 46, 0.88)',
                border: '1.5px solid #C9A86A', borderRadius: 2,
                color: '#F5EFE3', padding: '6px 14px', cursor: 'pointer',
                fontSize: 13, letterSpacing: 1, transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,106,0.9)'; e.currentTarget.style.color = '#1F2A33' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(176, 58, 46, 0.88)'; e.currentTarget.style.color = '#F5EFE3' }}
            >
              <span style={{ fontWeight: 'bold' }}>【{c.branchTitle}】</span> {c.text}
            </button>
          ))}
        </div>
      )}

      {/* ⑤ 意图卡（3 张，按新 mockup） */}
      <div style={{
        position: 'absolute', bottom: 144, left: 24, right: 24, zIndex: 2,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      }}>
        {INTENT_CARDS(G).map((card) => (
          <button
            key={card.id}
            onClick={() => onIntent(card)}
            disabled={streaming}
            style={{
              background: 'rgba(31, 42, 51, 0.78)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(201, 168, 106, 0.5)',
              borderTop: '2px solid #C9A86A',
              padding: '14px 18px',
              cursor: streaming ? 'wait' : 'pointer',
              textAlign: 'left', color: '#F5EFE3',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 14,
              opacity: streaming ? 0.5 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(176, 58, 46, 0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(31, 42, 51, 0.78)'}
          >
            <span style={{
              fontSize: 20, color: '#C9A86A', width: 22, textAlign: 'center', flexShrink: 0,
              fontFamily: '"Kaiti SC", "楷体", serif',
            }}>{card.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: '#F5EFE3', marginBottom: 2, letterSpacing: 1, fontWeight: 'bold' }}>{card.main}</div>
              <div style={{ fontSize: 11, color: '#C9A86A', letterSpacing: 2 }}>{card.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ⑥ 玩家输入框 + "说"按钮（位于意图卡下方、5 tab 之上） */}
      <div style={{
        position: 'absolute', bottom: 76, left: 24, right: 24, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      }}>
        <div style={{
          flex: 1,
          background: 'rgba(245, 239, 227, 0.95)',
          border: '1.5px solid #C9A86A',
          padding: '10px 16px', borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="说点什么..."
            disabled={streaming}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, color: '#1F2A33', fontFamily: '"Kaiti SC", "楷体", serif',
            }}
          />
          <span style={{ fontSize: 11, color: '#6B4E2E', whiteSpace: 'nowrap', letterSpacing: 1 }}>
            {Math.max(0, 60 - input.length)} / 60
          </span>
        </div>
        <button onClick={() => send()} disabled={streaming || !input.trim()} style={{
          padding: '10px 24px',
          background: streaming || !input.trim() ? 'rgba(176, 58, 46, 0.4)' : '#B03A2E',
          color: '#F5EFE3',
          border: '1.5px solid #B03A2E', borderRadius: 2, cursor: streaming ? 'wait' : 'pointer',
          fontSize: 18, fontWeight: 'bold', letterSpacing: 4,
          fontFamily: '"Kaiti SC", "楷体", serif',
          minWidth: 80,
        }}>
          {streaming ? '...' : '说'}
        </button>
      </div>

      {/* ⑦ 5 tab 底栏 */}
      <DialogueBottomNav onSwitchView={switchView} />
    </div>
  )
}
