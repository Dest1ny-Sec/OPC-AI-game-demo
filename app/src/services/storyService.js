// app/src/services/storyService.js
// 故事服务 —— 故事线判定 / 碎片故事 / 终章信 / 场景氛围
// 拆分自 lib/api.js（line 437-486）

import { call } from './llmClient.js'

/* ===== 故事线判定 ===== */
export async function storyJudge({ fact, state, factHistory = [] }) {
  const localFallback = () => ({
    mode: 'local',
    nextNpc: fact?.npcId || null,
    eventType: 'dialogue',
    reason: '本地兜底',
  })
  if (!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) && !(typeof process !== 'undefined' && process.env.VITE_API_BASE)) {
    await new Promise(r => setTimeout(r, 150))
    return localFallback()
  }
  try {
    const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || (typeof process !== 'undefined' && process.env.VITE_API_BASE) || ''
    const res = await fetch(BASE + '/api/story/judge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact, state, factHistory }),
    })
    if (!res.ok) return localFallback()
    return await res.json()
  } catch {
    return localFallback()
  }
}

/* ===== 碎片生成 ===== */
export const fragmentStory = ({ fragment, playerContext }, onDelta) =>
  call('/api/fragment/generate', { fragment, playerContext }, onDelta,
    `说起这${fragment.name}，老上海没人不认得。${fragment.desc || ''}经手它的人都散了，物件还在，替他们记着年份。`)

/* ===== 终章 ===== */
export const finaleLetter = ({ choiceId, choiceName, state }, onDelta) =>
  call('/api/finale/letter', { choiceId, choiceName, state }, onDelta,
    `第 100 天，武康路的风起了。\n\n这 100 天，良心 ${state.morality?.conscience}，生存 ${state.morality?.survival}。\n\n${choiceName}。你做了选择，历史没有如果。\n\n1936 年的上海，记住了你。`)

/* ===== 场景描述生成 ===== */
export const sceneAtmosphere = ({ scene, day, volume, mood }, onDelta) =>
  call('/api/scene/atmosphere', { scene, day, volume, mood }, onDelta,
    getLocalSceneDesc(scene, day, volume))

function getLocalSceneDesc(scene, day, volume) {
  const descs = {
    pharmacy: '五洲大药房的铜铃叮当作响，药香混着桐油味，柜台后的铜药碾沉默着。',
    alley: '弄堂里飘着各家晚饭的香气，晾衣绳上的被单在风里晃，远处传来叮叮咚咚的自行车铃声。',
    teahouse: '茶博士的铜壶在水吊里转了三圈，茶客们压低声音说着外头的局势。',
    french_concession: '梧桐叶在秋风中打着旋儿，咖啡馆的留声机放着爵士乐，巡捕房的警笛远远传来。',
    '16pu_dock': '黄浦江的汽笛长鸣，苦力们的号子声此起彼伏，船来船往，尽是谋生活的人。',
    yongan_dept: '永安百货的琉璃灯照亮了大理石地面，香水味和丝绸光泽，这里是另一个世界。',
    bajin_study: '煤油灯的光晕里，稿纸堆积如山，窗外的雨声和笔尖的沙沙声混在一起。',
  }
  return descs[scene] || '上海的弄堂里，又是一个平常的傍晚。'
}
