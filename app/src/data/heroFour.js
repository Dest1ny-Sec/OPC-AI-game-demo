// app/src/data/heroFour.js
// HomeView 用的 4 核心 NPC + 5 邻里静态数据
// 4 真实人物：项松茂 / 方液仙 / 郭乐 / 巴金

export const HERO_FOUR = [
  { id: 'xiangsongmao', name: '项松茂', item: '药柜' },
  { id: 'fangyexian',   name: '方液仙', item: '烧瓶' },
  { id: 'guole',        name: '郭乐',   item: '手杖' },
  { id: 'bajin',        name: '巴金',   item: '钢笔' },
]

export const NEIGHBORS = [
  { id: 'wangpo',    name: '王婆',     role: '弄堂接济人' },
  { id: 'xunpu',     name: '巡捕阿德', role: '法租界巡捕' },
  { id: 'qingbang',  name: '青帮管事', role: '弄堂秩序' },
  { id: 'rishang',   name: '日商买办', role: '日资洋行' },
  { id: 'dixia',     name: '地下党',   role: '暗中布道' },
]

// 4 核心 NPC 扩展信息（用于 HomeView 卡片横排）
export const HERO_FOUR_EXT = HERO_FOUR.map((h) => {
  const ext = {
    xiangsongmao: { era: '1880-1932', role: '廊中 · 药师', location: '五洲大药房' },
    fangyexian:   { era: '1893-1940', role: '廊中 · 掌方', location: '中国化工社' },
    guole:        { era: '1874-1955', role: '廊中 · 伙什', location: '永安百货' },
    bajin:        { era: '1904-2005', role: '廊中 · 学徒', location: '武康路书房' },
  }
  return { ...h, ...(ext[h.id] || {}) }
})
