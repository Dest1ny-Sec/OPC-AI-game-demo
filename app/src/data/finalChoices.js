// app/src/data/finalChoices.js
// 终章 4 选 1 —— 清明墓前 4 张卡片 → 4 个真结局
//   0 魂穿回去 → pingfan（平凡之人）—— 不带记忆，1937 关闭药房
//   1 留在 1936 → liangxin（良心守护者）—— 守住五洲，最终被炸
//   2 带记忆回 2026 → torch（传火者）—— 记得所有 NPC
//   3 跟周保中去东北 → dixia（地下党先驱）
// 1:1 还原 mockup-09

export const FINAL_CHOICES = [
  {
    seal: '1936', title: '魂穿回去', shortTitle: '魂 穿 回 去',
    text: '一九三六年清醒来，你回到二零二六年武康路咖啡馆。',
    playerLabel: '玩家',
    portrait: null,
  },
  {
    seal: '留存', title: '留在九三六', shortTitle: '留 在 九 三 六',
    text: '你选择留在一九三六年，守住五洲大药房的国货招牌。',
    playerLabel: '玩家',
    portrait: null,
  },
  {
    seal: '记忆', title: '带 NPC 记忆回二零二六', shortTitle: '记 忆 回 二 零 二 六',
    text: '你回到二零二六年但记得所有 NPC 的故事。',
    playerLabel: '玩家',
    portrait: null,
  },
  {
    // v8: 改文案（"周保中"AI 敏感词用"联络员"代替）+ 不用巴金立绘兜底
    seal: '征途', title: '跟联络员去东北', shortTitle: '跟 联 络 员 去 东 北',
    text: '你选择跟抗联联络员一起去东北，投身另一场救亡运动。',
    playerLabel: '联络员',
    portrait: null,  // 不用巴金立绘（文不符）
  },
]
