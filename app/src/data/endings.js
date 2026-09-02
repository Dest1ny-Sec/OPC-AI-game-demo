// app/src/data/endings.js
// 中文结局类型 → ENDING_CATALOG 的 key 映射
// 用于 resolveEndingId() 把 commitEndOfDay 的结果路由到对应结局卡片
// v9: 此前不匹配 → 永远落到 torch 兜底
//
// 用法：
//   import { resolveEndingId } from '../data/endings.js'

export const TYPE_TO_CATALOG = {
  青帮: 'qingbang',
  日商: 'rishang',
  地下党: 'dixia',
  良心: 'liangxin',
  生存: 'shengcun',
  平凡: 'pingfan',
  // gameOver reason → 结局卡片
  arrested: 'xunpu',
  bankruptcy: 'pochan',
  conscience_collapse: 'pingfan',
  qingbang_attack: 'pochan',
  hp_zero: 'pochan',
  game_over: 'pochan',
}

// 把 commitEndOfDay 结果解析成可展示的结局 id（无则 null）
export function resolveEndingId(r) {
  if (!r) return null
  if (r.ending?.type) return TYPE_TO_CATALOG[r.ending.type] || 'torch'
  if (r.gameOver) return TYPE_TO_CATALOG[r.state?.ended?.reason] || TYPE_TO_CATALOG[r.state?.ended?.type] || 'pochan'
  return null
}
