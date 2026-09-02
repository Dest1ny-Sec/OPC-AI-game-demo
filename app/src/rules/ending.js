// app/src/rules/ending.js
// 纯函数：决定游戏结局
// 拆分自 lib/branching.js（320 行 → 多文件）
//
// 决定规则：
//  1. 优先按 activeBranch（玩家做过的选择）→ 走 branch.finaleType
//  2. 兜底按 morality：
//     - conscience >= 70 → 良心
//     - survival >= 70    → 生存
//     - 否则              → 平凡

import { BRANCHES } from '../data/branches.js'
import { checkActiveBranch } from './branching.js'

/**
 * 根据 state 决定结局（不是死板 relations 判定）
 * @param {Object} state
 * @returns {Object} - {type, text, branch}
 */
export function determineEnding(state) {
  const activeBranch = checkActiveBranch(state)
  if (activeBranch) {
    const branch = BRANCHES[activeBranch]
    return { type: branch.finaleType, text: branch.finaleText, branch: activeBranch }
  }
  // v9 修复：删除 relations>=80 兜底（H-7）。
  //   中性闲聊每天 relations+1，100 天纯聊 rishang 会被误判成"日商结局"；
  //   按本文件头注释的设计意图："不要看 relations>=80 死板判定，要看玩家做了哪些选择"。
  //   结局只由实际选择（branchChoices）+ 道德轴决定；没做任何选择 → 平凡。
  const cn = state.morality?.conscience || 50
  const sv = state.morality?.survival || 50

  if (cn >= 70) return { type: '良心', text: BRANCHES.conscience_path.finaleText, branch: 'conscience_path' }
  if (sv >= 70) return { type: '生存', text: BRANCHES.survival_path.finaleText, branch: 'survival_path' }
  return { type: '平凡', text: BRANCHES.neutral_path.finaleText, branch: 'neutral_path' }
}
