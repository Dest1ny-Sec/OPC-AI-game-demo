// app/src/data/portraitLabels.js
// 心情标签 + 颜色（UI 显示用）
// 4 色域硬约束：纸白 #F5EFE3 + 墨青 #1F2A33 + 朱砂 #B03A2E + 淡金 #C9A86A
// 此处允许扩展色（用于 mood dot）

/** 推断 mood 的视觉标签（中文） */
export const MOOD_LABEL = {
  平静: '平静',
  愉悦: '愉悦',
  愤怒: '愤怒',
  忧虑: '忧虑',
  烦躁: '烦躁',
  悲哀: '悲哀',
}

/** mood 颜色（前端 UI 用） */
export const MOOD_COLOR = {
  平静: '#4A6670',   // 烟青
  愉悦: '#C8A45D',   // 金箔
  愤怒: '#B03A2E',   // 朱砂
  忧虑: '#6B4E2E',   // 黄褐
  烦躁: '#8B4513',   // 棕褐
  悲哀: '#1F2A33',   // 墨黑
}
