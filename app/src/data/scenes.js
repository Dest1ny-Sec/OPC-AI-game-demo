// app/src/data/scenes.js
// 场景配置 + NPC 默认位置 + 成就定义（静态数据）
// 拆分自 lib/store.js（217 行 → 多文件）

// ===== 初始 NPC 关系 =====
export const INIT_RELATIONS = {
  xiangsongmao: 50, fangyexian: 50, guole: 45, bajin: 55,
  wangpo: 60, xunpu: 40, qingbang: 25, rishang: 25, dixia: 40,
}

/* --- 场景配置 --- */
export const SCENES = {
  pharmacy:         { name: '五洲大药房',   bg: '/img/scenes/02-wuzhou-pharmacy-内景-药柜算盘账本铜秤.png',          music: 'pipa',      musicNote: '琵琶独奏，宁静庄重' },
  alley:            { name: '武康路弄堂',   bg: '/img/scenes/01-wukangroad-俯瞰全景-五洲立面-1936街景.png',         music: 'erhu',      musicNote: '二胡+环境音，市井烟火' },
  teahouse:         { name: '茶馆',         bg: '/img/scenes/05-wangpo-teahouse-王婆茶馆内景-八仙桌条凳红灯笼.png', music: 'guzheng',   musicNote: '古筝+三弦，慵懒闲谈' },
  french_concession:{ name: '法国租界',     bg: '/img/scenes/01-wukangroad-俯瞰全景-五洲立面-1936街景.png',         music: 'accordion', musicNote: '手风琴+爵士，异国情调' },
  '16pu_dock':      { name: '十六铺码头',   bg: '/img/scenes/06-shiliupu-dock-十六铺码头-黄浦江老式货船.png',       music: 'drums',     musicNote: '打击乐+号子，嘈杂忙碌' },
  yongan_dept:      { name: '永安百货',     bg: '/img/scenes/04-yongan-department-永安百货内景-多层货架铁艺电梯.png', music: 'orchestra', musicNote: '管弦乐，宏伟奢华' },
  bajin_study:      { name: '巴金书房',     bg: '/img/scenes/03-bajin-study-书房-满墙书架文房四宝.png',              music: 'piano',     musicNote: '钢琴独奏，沉思忧郁' },
}

export const NPC_SCENES = {
  xiangsongmao: 'pharmacy',
  fangyexian:   'pharmacy',
  guole:        'yongan_dept',
  bajin:        'bajin_study',
  wangpo:       'teahouse',
  xunpu:        'french_concession',
  qingbang:     'alley',
  rishang:      'pharmacy',
  dixia:        'alley',
}

/* --- 成就 --- */
export const MILESTONE_DEFS = {
  open:       { name: '初入江湖', desc: '1936年的第一天' },
  first_talk: { name: '开口说话', desc: '与第一位NPC交谈' },
  rich:       { name: '家道殷实', desc: '良心与生存都超过60' },
  survivor:   { name: '百天掌柜', desc: '熬过了整整100天' },
  collector10:{ name: '拾遗者',   desc: '收齐10件时代碎片' },
  all_endings:{ name: '览尽沧桑', desc: '解锁所有结局' },
}

export const unlockMilestone = (state, id) => {
  const ms = state.milestones || (state.milestones = [])
  if (ms.includes(id)) return []
  ms.push(id)
  return [id]
}
