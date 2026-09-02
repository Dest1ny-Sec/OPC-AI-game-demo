// app/src/components/TodayTasks.jsx
// 今天可做 (5) 横条 —— v4 改：读 todayPlan（叙事节拍器）
// 暖纸米色背景 + 朱砂双线边框 + 5 行任务

import NPC_AGENTS from '../data/npcAgents.js'

const TYPE_LABELS = {
  npc: '主',       // NPC 主动日
  gossip: '邻',    // 邻里 gossip 日
  free: '闲',      // 自由日
  review: '顾',    // 幕回顾
  final: '结',     // 清明墓前 4 选 1
  open: '行',      // 开放
}

const TYPE_TITLES = {
  npc: 'NPC 主动找你',
  gossip: '邻里 gossip',
  free: '自由日',
  review: '本周回顾',
  final: '清明墓前 4 选 1',
  open: '自由探索',
}

export default function TodayTasks({ G, onOpenNpc, onAcceptDream }) {
  // v4: 优先用 todayPlan（节拍器结果）
  const plan = G.todayPlan
  const tasks = []

  if (plan?.dailyTask) {
    const t = plan.dailyTask
    let subtitle = t.label
    let onClick = null
    let npcId = null

    if (t.type === 'npc' && plan.activeNpc) {
      npcId = plan.activeNpc
      onClick = () => onOpenNpc?.(npcId)
    } else if (t.type === 'gossip' && plan.neighborId) {
      npcId = plan.neighborId
      onClick = () => onOpenNpc?.(npcId)
      subtitle = `${NPC_AGENTS[npcId]?.name || '邻里'} 上门`
    } else if (t.type === 'free') {
      subtitle = '想做啥做啥'
    } else if (t.type === 'review') {
      subtitle = `${plan.actTitle || '幕回顾'}`
    } else if (t.type === 'final') {
      subtitle = '清明墓前 4 选 1'
    }

    tasks.push({
      id: 'daily',
      type: t.type,
      title: subtitle,
      npcId,
      onClick,
    })
  }

  // v4: 加 mandatory event（挂机保护）
  if (plan?.mandatoryEvent) {
    const e = plan.mandatoryEvent
    tasks.push({
      id: 'event',
      type: 'npc',
      title: e.title,
      npcId: e.npcId,
      onClick: () => onOpenNpc?.(e.npcId),
    })
  }

  // v4: 加 dream 推送（如果有）
  // v9 修复（H-3）：dream 任务基于**真实队列**（此前用 plan.dreamPush，与 runDream 实际结果脱节，
  //   计划日没推 / 非计划日推了 → 点击无反应）
  const pendingDream = (G.dreamQueue || []).find((x) => !x.responded && x.expiresAtDay >= G.day)
  if (pendingDream) {
    tasks.push({
      id: 'dream',
      type: 'npc',
      title: `${NPC_AGENTS[pendingDream.npcId]?.name || 'NPC'} 找侬有桩事体`,
      onClick: () => onAcceptDream?.(pendingDream),
    })
  }

  // v8.1: 加回 fillers 但**真 onClick**（之前是 onClick: null 点了没反应）
  //   按 day 阶段变 4 个常用入口（访客/邻里）
  const fillers = [
    { id: 'visit-guole', type: 'npc', title: '去找郭乐聊聊百货', npcId: 'guole', onClick: () => onOpenNpc?.('guole') },
    { id: 'visit-bajin', type: 'npc', title: '去找巴金坐坐', npcId: 'bajin', onClick: () => onOpenNpc?.('bajin') },
    { id: 'visit-wangpo', type: 'npc', title: '去王婆茶馆坐坐', npcId: 'wangpo', onClick: () => onOpenNpc?.('wangpo') },
  ]
  // 已经有的 type 不重复（dailyTask 优先）
  const existingTypes = new Set(tasks.map(t => t.type))
  for (const f of fillers) {
    if (tasks.length >= 4) break
    if (existingTypes.has(f.type)) continue
    tasks.push(f)
  }

  if (tasks.length === 0) return null

  return (
    <div style={{
      background: '#F5EFE3',
      border: '3px solid #B03A2E',
      borderRadius: 4,
      padding: '20px 24px',
      fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 标题（朱砂圆点 + 文字） */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginBottom: 6,
      }}>
        <span style={{
          display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
          background: '#B03A2E', flexShrink: 0,
          boxShadow: '0 0 0 3px rgba(176,58,46,0.15)',
        }} />
        <span style={{ color: '#B03A2E', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 }}>
          今天可做 ({tasks.length})
        </span>
      </div>

      {/* 副标题：今天是什么幕 + 节奏感 */}
      {plan && (
        <div style={{
          textAlign: 'center', fontSize: 12, color: '#6B4E2E',
          marginBottom: 14, letterSpacing: 2,
        }}>
          {plan.actTitle} · 视觉：{plan.visualMood}
        </div>
      )}

      {/* 任务列表 */}
      {tasks.map((task, i) => (
        <div
          key={task.id}
          onClick={task.onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 0',
            borderBottom: i < tasks.length - 1 ? '1px dashed rgba(176, 58, 46, 0.3)' : 'none',
            cursor: task.onClick ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { if (task.onClick) e.currentTarget.style.background = 'rgba(201, 168, 106, 0.15)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{
            display: 'inline-block', width: 4, height: 22,
            background: '#B03A2E', flexShrink: 0, borderRadius: 1,
          }} />
          <span style={{ color: '#B03A2E', fontSize: 20, fontWeight: 'bold', minWidth: 50 }}>
            [{TYPE_LABELS[task.type] || task.type}]
          </span>
          <span style={{ color: '#1F2A33', fontSize: 20, fontWeight: 'bold', flex: 1 }}>
            {task.title?.replace(/^\[[^\]]+\]\s*/, '') || TYPE_TITLES[task.type] || '做点啥'}
          </span>
          <span style={{
            color: '#B03A2E', fontSize: 18, fontWeight: 'bold',
            border: '1px solid #C9A86A', padding: '2px 10px', borderRadius: 2,
            background: 'rgba(201, 168, 106, 0.1)',
          }}>
            {TYPE_LABELS[task.type] || task.type}
          </span>
        </div>
      ))}
    </div>
  )
}
