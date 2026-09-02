// app/src/data/intimacy.js
// 亲密等级 + 心绪颜色的静态标签

// 亲密等级 0-5 的中文标签
// 0/1 都是「初识」（游戏设计：让前 2 次对话在 UI 上没差别）
export const INTIMACY_LABEL = ['初识', '初识', '相识', '相知', '深交', '至交']

// 心绪 → 状态点颜色（UI 用）
// 4 色域硬约束：纸白 #F5EFE3 + 墨青 #1F2A33 + 朱砂 #B03A2E + 淡金 #C9A86A
// 此处允许扩展色（用于 mood dot）
export const MOOD_DOT_COLOR = {
  '平静': '#7BA0A8',
  '愉悦': '#E27D60',
  '愤怒': '#B03A2E',
  '忧虑': '#6B7B8C',
  '烦躁': '#A85A3E',
  '悲哀': '#4A5C6A',
}
