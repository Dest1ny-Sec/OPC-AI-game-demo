// app/src/data/intentCards.js
// DialogueView 用的 3 张意图卡（按 day 阶段变）
// 让玩家对话题有阶段性目标
// 用单字汉字代替图标（禁用 emoji）
//
// 用法：
//   import { INTENT_CARDS } from '../data/intentCards.js'
//   const cards = INTENT_CARDS(G)  // 返回 3 张意图卡

export const INTENT_CARDS = G => G.day < 10
  ? [
      { id: 'introduce', main: '初次见面，介绍一下自己', sub: '了解人物', icon: '茗' },
      { id: 'wuzhou',    main: '五洲大药房最近如何',     sub: '了解背景', icon: '查' },
      { id: 'chat',      main: '武康路今天有什么新鲜事', sub: '了解环境', icon: '议' },
    ]
  : G.day < 50
  ? [
      { id: 'business',  main: '最近药材生意如何',         sub: '推进调查', icon: '议' },
      { id: 'secret',    main: '听说弄堂里有些风声',       sub: '探查线索', icon: '查' },
      { id: 'chat',      main: '聊聊家常',                 sub: '了解人物', icon: '茗' },
    ]
  : [
      // v9：原"你觉得 1937 年会怎样"是 OOC 陷阱（NPC 被禁谈 1937），改成不剧透的局势提问
      { id: 'future',    main: '北边的风声，你怎么看',     sub: '了解局势', icon: '议' },
      { id: 'choice',    main: '若是要抉择，你会选哪条路', sub: '推进调查', icon: '查' },
      { id: 'chat',      main: '这些年你经历过什么',       sub: '了解人物', icon: '茗' },
    ]
