// app/src/rules/asylum.js
// 疯人院结局 —— meta-AI 触发的"游戏强制终止"
// 触发条件（metaAI.js）：连续 OOC / 总 OOC 硬限 / 所有 NPC trust 崩溃
// 玩家被法租界巡捕房送入精神病院，1936 沪上传奇结束

/**
 * 疯人院结局的元数据
 */
export const ASYLUM_ENDING = {
  id: 'asylum_1936',
  type: 'asylum',
  title: '沪上疯人院',
  subtitle: '你被法租界巡捕房送入精神病院',
  year: 1936,
  letter: `民国二十五年深秋。
你被法租界巡捕房的人用一副铁镣押进了虹口疯人院。
他们说你"胡言乱语""行为怪异"，整天说些没人听得懂的怪话——
什么"玩家""存档""game""NPC"……
弄堂里的人说，项松茂、方液仙、郭乐、巴金，
都因为你这个"神经错乱"的过客而拂袖而去。
你在疯人院里待了 47 天，
医生在你的病历上写着："幻听幻视，逻辑混乱，无可救药。"
窗外，武康路的梧桐叶落了又生。
1937 年 8 月 13 日，淞沪会战的炮声传到了虹口。
你再也没有走出那扇铁门。

—— 游戏结束`,
  unlockCondition: 'meta-AI 判定玩家"瞎玩"，连续 3 天 OOC 超过 50% 或总 OOC > 30 或所有 NPC trust 崩溃',
  color: '#1A1410',
}

/**
 * 应用疯人院结局
 * - 锁定 state.ended
 * - state.dialogues / npcMemory / npcPortrait 全部清空（已结束，无需保留）
 * - 不解锁其他结局
 * @param {Object} state
 * @param {string} reason - 触发原因 ('OOC_CONSECUTIVE' | 'TRUST_COLLAPSE' | 'OOC_HARD_LIMIT' | 'MULTI_SIGNALS')
 * @returns {Object} - { state, ending: ASYLUM_ENDING, reason }
 */
export function applyAsylum(state, reason) {
  const newState = {
    ...state,
    ended: {
      type: 'asylum',
      reason,
      day: state.day,
      timestamp: Date.now(),
    },
    // 疯人院结局后游戏锁死
    asylumLocked: true,
    // 触发原因记录
    asylumReason: reason,
  }

  return {
    state: newState,
    ending: ASYLUM_ENDING,
    reason,
  }
}

/**
 * 检查是否已经触发疯人院
 */
export function isAsylumTriggered(state) {
  return state?.ended?.type === 'asylum' || state?.asylumLocked === true
}

/**
 * 从疯人院重开游戏
 * - 清存档
 * - 重置 sessionId（让 NPC 上下文彻底隔离）
 * - 返回全新 initialGameState
 */
export function resetFromAsylum() {
  // 必须在 use store.js 的 clearSave
  // 这里只是数据层
  return {
    type: 'reset_from_asylum',
    message: '你从疯人院逃出，但已失去所有记忆……1936 重新开始。',
    action: 'new_game',
  }
}
