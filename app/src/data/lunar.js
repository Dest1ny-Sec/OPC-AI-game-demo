// app/src/data/lunar.js
// 农历换算（1936 年 = 丙子年）
// game day 1 = 1936.1.1 = 腊月初八
// 用法：
//   import { getLunarDate } from '../data/lunar.js'

const LUNAR_SEGMENTS = [
  { start: 1,    month: '腊月', offset: 8 },   // day 1 = 腊月初八
  { start: 24,   month: '正月', offset: 1 },   // day 24 = 正月初一
  { start: 54,   month: '二月', offset: 1 },   // day 54 = 二月初一（2/23）
  { start: 83,   month: '三月', offset: 1 },   // day 83 = 三月初一（3/23）
  { start: 112,  month: '四月', offset: 1 },
  { start: 142,  month: '五月', offset: 1 },
]

const LUNAR_DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十']

export function getLunarDate(day) {
  let seg = LUNAR_SEGMENTS[LUNAR_SEGMENTS.length - 1]
  for (const s of LUNAR_SEGMENTS) {
    if (day >= s.start) seg = s
    else break
  }
  const dIdx = Math.min(LUNAR_DAY_NAMES.length - 1, (day - seg.start) + (seg.offset - 1))
  return `丙子年 · ${seg.month}${LUNAR_DAY_NAMES[dIdx]}`
}
