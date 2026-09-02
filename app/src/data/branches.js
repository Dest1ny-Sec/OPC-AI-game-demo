// app/src/data/branches.js
// 6 个剧情分支的静态数据 + 终章 4 选 1 映射
// 拆分自 lib/branching.js（320 行 → 多文件）

/**
 * 6 个真正的剧情分支（不是死板结局判定）
 * 每个分支有触发条件、后续影响、可解锁的隐藏剧情
 */
export const BRANCHES = {
  qingbang_path: {
    id: 'qingbang_path',
    title: '青帮之路',
    icon: '青龙',
    desc: '投靠青帮，放弃原则，在乱世中求生存',
    trigger: {
      choices: [
        { id: 'q1', npcId: 'qingbang', text: '我愿意给青帮交保护费', context: '武康路开店被青帮盯上' },
        { id: 'q2', npcId: 'qingbang', text: '帮青帮送货（违禁品）', context: '青帮让你帮一次' },
      ],
      minChoices: 2,  // 至少做 2 个选择
    },
    effects: {
      morality: { conscience: -30, survival: +20 },
      relations: { qingbang: +30, dixia: -20, rishang: -10 },
      money: -20,                    // 交保护费
      nextScene: '青帮堂口',
      hiddenScene: '杜月笙密谈',
    },
    finaleType: '青帮',
    finaleText: '你成了青帮在上海滩的代理人。1937 年，日本人打进来了，你继续做你的生意。',
  },
  rishang_path: {
    id: 'rishang_path',
    title: '日商之路',
    icon: '日昇',
    desc: '与伊藤洋行合作，赚日本人的钱，放弃民族气节',
    trigger: {
      choices: [
        { id: 'r1', npcId: 'rishang', text: '接受伊藤洋行的 200 大洋资助', context: '巴金拒绝了，你呢？' },
        { id: 'r2', npcId: 'rishang', text: '卖日货（仁丹/万金油）', context: '利润 5 倍，但项松茂会翻脸' },
      ],
      minChoices: 2,
    },
    effects: {
      morality: { conscience: -20, survival: +30 },
      relations: { rishang: +30, qingbang: +10, xiangsongmao: -40, bajin: -30 },
      money: +200,                   // 接受伊藤洋行 200 大洋资助
      nextScene: '虹口日商区',
      hiddenScene: '伊藤密约',
    },
    finaleType: '日商',
    finaleText: '你跟伊藤洋行合作得不错。1937 年 8 月 13 日，淞沪会战爆发。你选择了活下去。',
  },
  dixia_path: {
    id: 'dixia_path',
    title: '地下党之路',
    icon: '暗火',
    desc: '暗中联络同志，传递情报，把命交给信仰',
    trigger: {
      choices: [
        { id: 'd1', npcId: 'dixia', text: '为地下党送一封信', context: '霞飞路咖啡馆，靠窗第二桌' },
        { id: 'd2', npcId: 'dixia', text: '藏匿地下党伤员', context: '弄堂里的秘密' },
      ],
      minChoices: 2,
    },
    effects: {
      morality: { conscience: +30, survival: -10 },
      relations: { dixia: +40, qingbang: -30, rishang: -20, bajin: +20 },
      money: +30,                    // 组织津贴
      nextScene: '霞飞路咖啡馆',
      hiddenScene: '组织密谈',
    },
    finaleType: '地下党',
    finaleText: '你成了宋氏外围联络员。1937 年，你冒着炮火送出了最后一封情报。',
  },
  conscience_path: {
    id: 'conscience_path',
    title: '良心之路',
    icon: '明心',
    desc: '守住底线，不卖东洋货，不跟青帮同流合污',
    trigger: {
      choices: [
        { id: 'c1', npcId: 'xiangsongmao', text: '坚持只卖国货 131 牙膏', context: '东洋货利润 5 倍' },
        { id: 'c2', npcId: 'qingbang', text: '拒绝青帮保护费', context: '可能被砸店' },
        { id: 'c3', npcId: 'rishang', text: '拒绝日商合作', context: '巴金会敬佩你' },
      ],
      minChoices: 3,
    },
    effects: {
      morality: { conscience: +40, survival: -10 },
      relations: { xiangsongmao: +30, bajin: +25, fangyexian: +15, qingbang: -30, rishang: -30 },
      nextScene: '武康路药房',
      hiddenScene: '1932 年项松茂的日记',
    },
    finaleType: '良心',
    finaleText: '你守住了良心，没卖东洋货，没跟青帮同流合污。1937 年，日本人炸了你的药房。你走了，五洲的牌子还在。',
  },
  survival_path: {
    id: 'survival_path',
    title: '生存之路',
    icon: '草根',
    desc: '不站队，谁给钱就跟谁合作，只求活下来',
    trigger: {
      // 触发条件：不做良心选择 + 跟至少 2 个阵营有合作
      choices: [
        { id: 's1', npcId: 'qingbang', text: '讨价还价但最终交保护费', context: '勉强接受' },
        { id: 's2', npcId: 'rishang', text: '少量卖日货（不是主要）', context: '试探' },
      ],
      minChoices: 1,
      excludeBranches: ['conscience_path'],
    },
    effects: {
      morality: { conscience: -10, survival: +20 },
      relations: { qingbang: +10, rishang: +10, xiangsongmao: -10, bajin: -10 },
      money: +50,                    // 两头周转的油水
      nextScene: '法租界咖啡馆',
      hiddenScene: '看着窗外的人跑',
    },
    finaleType: '生存',
    finaleText: '你活下来了。用什么换的？你自己知道。1937 年，你在法租界的咖啡馆里，看着窗外的人跑。',
  },
  neutral_path: {
    id: 'neutral_path',
    title: '平凡之路',
    icon: '雾',
    desc: '不显山不露水，1937 年你关了门',
    trigger: {
      // 触发：100 天没明确选任何分支
      minChoices: 0,
    },
    effects: {
      morality: { conscience: 0, survival: 0 },
      relations: {},
      nextScene: '武康路',
      hiddenScene: '空荡的药房',
    },
    finaleType: '平凡',
    finaleText: '1936 年，你在武康路开了家药房。1937 年，你关了门。没人在乎你来过。',
  },
}

/**
 * 终章 4 选 1 —— 清明墓前 4 张卡片 → 4 个真结局
 * 0 魂穿回现代   → pingfan（平凡之人）
 * 1 留 1936      → liangxin（良心守护者）
 * 2 带走记忆     → torch（传火者）
 * 3 找周保中     → dixia（地下党先驱）
 */
export const CHOICE_TO_ENDING = ['pingfan', 'liangxin', 'torch', 'dixia']
