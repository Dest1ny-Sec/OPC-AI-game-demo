// app/src/data/storylines.js
// 4 NPC 完整故事线（28 节点）+ 触发条件
// 通过玩家行为（fact）触发，LLM 生成内容，enterpriseHistory 限定事实

/**
 * 故事线节点 schema
 *
 * {
 *   id: 'xiangsongmao_node_1',
 *   npcId: 'xiangsongmao',
 *   title: '131 牙膏的来历',
 *   trigger: { type: 'fact', factType: 'buy', item: '131-牙膏', flags: ['first_time'] },
 *   unlocks: {
 *     relationBonus: 5,
 *     fragment: 1,                // 时代碎片 ID
 *     flag: 'xiang_node_1_seen',
 *   },
 *   context: '企业历史知识（注入到 LLM system prompt）',
 *   llmPrompt: '请用项松茂的性格，讲 131 牙膏 1912 年诞生的故事。30-80 字。',
 *   boundLevel: 'semi_fixed',     // 'fixed' | 'semi_fixed' | 'free'
 *   nextNodeHint: 'xiangsongmao_node_2',
 * }
 */

export const STORYLINES = {
  // ============================================================
  // 项松茂 7 节点
  // ============================================================
  xiangsongmao_node_1: {
    id: 'xiangsongmao_node_1',
    npcId: 'xiangsongmao',
    title: '131 牙膏的来历',
    trigger: { type: 'buy', item: '131-牙膏', flags: ['first_time'] },
    unlocks: { relationBonus: 5, fragment: 1, flag: 'xiang_node_1_seen' },
    context: '1912 年项松茂创办五洲大药房时，日本"狮子牌"牙膏垄断中国市场。项松茂立志"中国人口腔里的牙膏，必须是中国的"，用一年时间研发出 131 牙膏（配方编号 131）。',
    llmPrompt: '请用项松茂硬气爱国的性格，讲 131 牙膏诞生的故事。30-80 字。',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'xiangsongmao_node_2',
  },
  xiangsongmao_node_2: {
    id: 'xiangsongmao_node_2',
    npcId: 'xiangsongmao',
    title: '五洲的账本',
    trigger: { type: 'fact_count', npcId: 'xiangsongmao', action: 'buy', count: 3 },
    unlocks: { relationBonus: 3, flag: 'xiang_node_2_seen' },
    context: '1932 年一·二八事变，日军进攻上海，项松茂亲自赴前线劳军，被日军逮捕，坚贞不屈，2 月 25 日殉难。1936 年剧情设定为"重生"为五洲大药房坐堂经理。',
    llmPrompt: '项松茂提到账本，回忆起 1932 年的事（不剧透具体年份，但要让玩家感受到历史重量）。',
    boundLevel: 'free',
    nextNodeHint: 'xiangsongmao_node_3',
  },
  xiangsongmao_node_3: {
    id: 'xiangsongmao_node_3',
    npcId: 'xiangsongmao',
    title: '五洲的伙计们',
    trigger: { type: 'dialogue_keyword', npcId: 'xiangsongmao', keywords: ['上海', '药房', '学徒'] },
    unlocks: { relationBonus: 2, flag: 'xiang_node_3_seen' },
    context: '五洲大药房 1930 年代员工约 30 人，包括坐堂经理、账房、跑街（采购）、学徒、伙计。跑街每天凌晨 4 点去十六铺进货。',
    llmPrompt: '项松茂讲他的伙计们——跑街、账房、学徒的故事。可以虚构具体人物名，但要符合 1936 年上海药房生态。',
    boundLevel: 'free',
    nextNodeHint: 'xiangsongmao_node_4',
  },
  xiangsongmao_node_4: {
    id: 'xiangsongmao_node_4',
    npcId: 'xiangsongmao',
    title: '武康路的早晨',
    trigger: { type: 'time_at_screen', screen: 'home', seconds: 30 },
    unlocks: { flag: 'xiang_node_4_seen' },
    context: '武康路原名福开森路，1907 年命名。路两旁种满法国梧桐。武康大楼（诺曼底公寓）1924 年落成，是邬达克设计。',
    llmPrompt: '项松茂讲武康路的早晨——梧桐树下的报童、卖花的弄堂阿姨、电车铃声。30-60 字。',
    boundLevel: 'free',
    nextNodeHint: 'xiangsongmao_node_5',
  },
  xiangsongmao_node_5: {
    id: 'xiangsongmao_node_5',
    npcId: 'xiangsongmao',
    title: '不卖给东洋人',
    trigger: { type: 'fact_count', action: 'sell_japanese', count: 3 },
    unlocks: { relationBonus: -30, flag: 'xiang_node_5_anger' },
    context: '项松茂是 1932 年一二八殉难的爱国实业家，他绝不容忍店里卖日货。',
    llmPrompt: '项松茂拍桌子翻脸：「侬卖东洋货？五洲不收侬这种人！滚出去！」，并禁止玩家再进五洲。30-60 字。',
    boundLevel: 'fixed',
    nextNodeHint: 'xiangsongmao_node_6',
  },
  xiangsongmao_node_6: {
    id: 'xiangsongmao_node_6',
    npcId: 'xiangsongmao',
    title: '武康大楼',
    trigger: { type: 'day_relation', day_gte: 50, npcId: 'xiangsongmao', relation_gte: 70 },
    unlocks: { relationBonus: 5, flag: 'xiang_node_6_seen' },
    context: '武康大楼 1924 年落成，是上海第一座现代化公寓，邬达克设计。项松茂 1930 年代常路过。',
    llmPrompt: '项松茂提到 1924 年武康大楼落成时的盛况。',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'xiangsongmao_node_7',
  },
  xiangsongmao_node_7: {
    id: 'xiangsongmao_node_7',
    npcId: 'xiangsongmao',
    title: '账本交给你',
    trigger: { type: 'day_relation', day_gte: 97, npcId: 'xiangsongmao', relation_gte: 80 },
    unlocks: { relationBonus: 10, flag: 'xiang_node_7_seen' },
    context: '第 100 天前 3 天，项松茂把五洲的 1936 年账本托付给玩家。',
    llmPrompt: '项松茂郑重地说：「格本账，记着五洲 1936 年的事。侬带着它……自己想办法。」',
    boundLevel: 'fixed',
    nextNodeHint: null,
  },

  // ============================================================
  // 方液仙 7 节点
  // ============================================================
  fangyexian_node_1: {
    id: 'fangyexian_node_1',
    npcId: 'fangyexian',
    title: '三星牙膏的诞生',
    trigger: { type: 'buy', item: '三星牙膏', flags: ['first_time'] },
    unlocks: { relationBonus: 5, fragment: 5, flag: 'fang_node_1_seen' },
    context: '1912 年方液仙用 200 银元在上海四川路租了一间小屋，创办中国化学工业社，研发出"三星牙膏"（三星指福禄寿三星）。',
    llmPrompt: '请用方液仙圆滑精明的性格，讲三星牙膏诞生的故事。30-80 字。',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'fangyexian_node_2',
  },
  fangyexian_node_2: {
    id: 'fangyexian_node_2',
    npcId: 'fangyexian',
    title: '中华牙膏的前身',
    trigger: { type: 'fact_count', npcId: 'fangyexian', action: 'buy', count: 3 },
    unlocks: { relationBonus: 3, flag: 'fang_node_2_seen' },
    context: '三星牙膏后来演变成中华牙膏（公私合营后改名）。1936 年时还是"三星"牌。',
    llmPrompt: '方液仙讲三星牙膏的未来雄心（不能剧透 1953 年中华牙膏上市，但要让玩家感受到他想把国产牙膏做成世界品牌的决心）。',
    boundLevel: 'free',
    nextNodeHint: 'fangyexian_node_3',
  },
  fangyexian_node_3: {
    id: 'fangyexian_node_3',
    npcId: 'fangyexian',
    title: '四川路工厂',
    trigger: { type: 'dialogue_keyword', npcId: 'fangyexian', keywords: ['工厂', '化工厂', '烟囱'] },
    unlocks: { relationBonus: 2, flag: 'fang_node_3_seen' },
    context: '1930 年代方液仙在四川路建化工厂，有自己的化学师团队。烟囱日夜冒烟。',
    llmPrompt: '方液仙带玩家"参观"四川路化工厂——烟囱、化学师、配方室。30-60 字。',
    boundLevel: 'free',
    nextNodeHint: 'fangyexian_node_4',
  },
  fangyexian_node_4: {
    id: 'fangyexian_node_4',
    npcId: 'fangyexian',
    title: '圆滑的生意',
    trigger: { type: 'bargain_success', npcId: 'fangyexian', discount_gte: 0.30 },
    unlocks: { relationBonus: 4, flag: 'fang_node_4_seen' },
    context: '方液仙是圆滑商人，让价空间大，但关系好才会真让。',
    llmPrompt: '方液仙笑着讲他做生意的心得——"侬也是老江湖了"。',
    boundLevel: 'free',
    nextNodeHint: 'fangyexian_node_5',
  },
  fangyexian_node_5: {
    id: 'fangyexian_node_5',
    npcId: 'fangyexian',
    title: '项松茂的竞争对手',
    trigger: { type: 'cross_npc', npcA: 'xiangsongmao', npcB: 'fangyexian' },
    unlocks: { relationBonus: 2, flag: 'fang_node_5_seen' },
    context: '项松茂（131 牙膏）和方液仙（三星牙膏）都是国产牙膏，但定位不同：五洲走中高端，中化社走亲民。',
    llmPrompt: '方液仙提到项松茂——"老项的 131 是好牙膏，阿拉三星也不差。两条路，两个牌子，都是国产。"',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'fangyexian_node_6',
  },
  fangyexian_node_6: {
    id: 'fangyexian_node_6',
    npcId: 'fangyexian',
    title: '化工业的雄心',
    trigger: { type: 'day_relation', day_gte: 60, npcId: 'fangyexian', relation_gte: 70 },
    unlocks: { relationBonus: 5, flag: 'fang_node_6_seen' },
    context: '方液仙的目标是"中国日化必须中国人自己做"。',
    llmPrompt: '方液仙讲他对"中国化学工业"的雄心——"阿拉不只做牙膏，要做香水、做肥皂、做化妆品，全部国产"。',
    boundLevel: 'free',
    nextNodeHint: 'fangyexian_node_7',
  },
  fangyexian_node_7: {
    id: 'fangyexian_node_7',
    npcId: 'fangyexian',
    title: '配方交给你',
    trigger: { type: 'day_relation', day_gte: 97, npcId: 'fangyexian', relation_gte: 80 },
    unlocks: { relationBonus: 10, flag: 'fang_node_7_seen' },
    context: '第 100 天前 3 天，方液仙把三星牙膏配方托付给玩家。',
    llmPrompt: '方液仙郑重地说："格份配方，是阿拉 24 年的心血。侬带着它，替我守住。"',
    boundLevel: 'fixed',
    nextNodeHint: null,
  },

  // ============================================================
  // 郭乐 7 节点
  // ============================================================
  guole_node_1: {
    id: 'guole_node_1',
    npcId: 'guole',
    title: '永安百货的创办',
    trigger: { type: 'bargain', npcId: 'guole' },
    unlocks: { relationBonus: 5, fragment: 4, flag: 'guo_node_1_seen' },
    context: '1918 年郭乐带着海外华侨资本回上海，在南京路 635 号创办永安百货（先施百货对面）。"永安"取"永远平安"之意。',
    llmPrompt: '请用郭乐精明老派的性格，讲永安百货 1918 年创办的故事。30-80 字。',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'guole_node_2',
  },
  guole_node_2: {
    id: 'guole_node_2',
    npcId: 'guole',
    title: '南京路 635 号',
    trigger: { type: 'fact_count', npcId: 'guole', action: 'bargain', count: 2 },
    unlocks: { relationBonus: 3, flag: 'guo_node_2_seen' },
    context: '南京路 635 号（永安百货原址）到 2026 年仍是商业地标。',
    llmPrompt: '郭乐指着窗外："老友，侬看，这块地，老郭要守一辈子。"（不剧透 2026，但要让玩家感受老派商人的执念）',
    boundLevel: 'free',
    nextNodeHint: 'guole_node_3',
  },
  guole_node_3: {
    id: 'guole_node_3',
    npcId: 'guole',
    title: '百货里的上海',
    trigger: { type: 'dialogue_keyword', npcId: 'guole', keywords: ['上海', '百货', '顾客'] },
    unlocks: { relationBonus: 2, flag: 'guo_node_3_seen' },
    context: '永安百货 1930 年代有旗袍、化妆品、洋酒、罐头食品、钟表、珠宝。电梯小姐穿旗袍迎客。',
    llmPrompt: '郭乐讲永安百货里的人物——旗袍太太、化妆品柜台、电梯小姐。30-60 字。',
    boundLevel: 'free',
    nextNodeHint: 'guole_node_4',
  },
  guole_node_4: {
    id: 'guole_node_4',
    npcId: 'guole',
    title: '进货的眼光',
    trigger: { type: 'bargain_fail', npcId: 'guole', count: 3 },
    unlocks: { relationBonus: -10, flag: 'guo_node_4_seen' },
    context: '郭乐是精明百货大亨，永安不收散户。',
    llmPrompt: '郭乐叹气："老友，侬要的价，唔该再去外面掂量掂量。永安不收散户。"',
    boundLevel: 'fixed',
    nextNodeHint: 'guole_node_5',
  },
  guole_node_5: {
    id: 'guole_node_5',
    npcId: 'guole',
    title: '跟方液仙的合作',
    trigger: { type: 'dialogue_keyword', npcId: 'guole', keywords: ['方液仙', '中化社', '三星'] },
    unlocks: { relationBonus: 3, flag: 'guo_node_5_seen' },
    context: '永安百货 1930 年代就上架中化社产品（包括三星牙膏），是郭乐与方液仙的合作。',
    llmPrompt: '郭乐讲他和方液仙的合作——"老方的三星牙膏，摆在永安一楼化妆品柜台，侬知道一天卖多少枝？"',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'guole_node_6',
  },
  guole_node_6: {
    id: 'guole_node_6',
    npcId: 'guole',
    title: '百年永安',
    trigger: { type: 'day_relation', day_gte: 80, npcId: 'guole', relation_gte: 70 },
    unlocks: { relationBonus: 5, flag: 'guo_node_6_seen' },
    context: '郭乐的目标是让永安撑过一切。',
    llmPrompt: '郭乐讲"我这辈子最骄傲的事，是看着永安撑过 1937、撑过 1945、撑过 1949。"（不剧透具体年份，但暗示永安会活下来）',
    boundLevel: 'free',
    nextNodeHint: 'guole_node_7',
  },
  guole_node_7: {
    id: 'guole_node_7',
    npcId: 'guole',
    title: '货架给你留一格',
    trigger: { type: 'day_relation', day_gte: 97, npcId: 'guole', relation_gte: 80 },
    unlocks: { relationBonus: 10, flag: 'guo_node_7_seen' },
    context: '第 100 天前 3 天，郭乐答应战后在永安百货给玩家留货架。',
    llmPrompt: '郭乐笑着说："老友，等仗打完了，永安一楼化妆品柜台留一格给侬。吾说话算数。"',
    boundLevel: 'fixed',
    nextNodeHint: null,
  },

  // ============================================================
  // 巴金 7 节点
  // ============================================================
  bajin_node_1: {
    id: 'bajin_node_1',
    npcId: 'bajin',
    title: '账房先生的早晨',
    trigger: { type: 'enter_screen', screen: 'shop', day_lte: 3 },
    unlocks: { relationBonus: 3, flag: 'bajin_node_1_seen' },
    context: '巴金是旁白说书人 + 账房先生。每天早晨他会在账本上写一段话。',
    llmPrompt: '巴金作为账房先生，温和地说："先生，今天的账我替你记着。1936 年又是新的一天。"',
    boundLevel: 'free',
    nextNodeHint: 'bajin_node_2',
  },
  bajin_node_2: {
    id: 'bajin_node_2',
    npcId: 'bajin',
    title: '《家》手稿',
    trigger: { type: 'fact_count', npcId: 'bajin', action: 'dialogue', count: 3 },
    unlocks: { relationBonus: 4, fragment: 6, flag: 'bajin_node_2_seen' },
    context: '巴金 1931 年发表《家》（激流三部曲），1936 年在写《春》《秋》。',
    llmPrompt: '巴金讲 1931 年写《家》时的心境——"我写高家，不是写一个家族，是写一代青年的挣扎。"',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'bajin_node_3',
  },
  bajin_node_3: {
    id: 'bajin_node_3',
    npcId: 'bajin',
    title: '巴黎来信',
    trigger: { type: 'dialogue_keyword', npcId: 'bajin', keywords: ['巴黎', '留学', '法国'] },
    unlocks: { relationBonus: 3, fragment: 14, flag: 'bajin_node_3_seen' },
    context: '1927 年巴金旅法（巴黎），1928 年回国。',
    llmPrompt: '巴金讲 1927 年在巴黎的生活——"巴黎的冬天很长，黄昏的时候我会去塞纳河边走走。"',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'bajin_node_4',
  },
  bajin_node_4: {
    id: 'bajin_node_4',
    npcId: 'bajin',
    title: '良心的账',
    trigger: { type: 'morality_change', abs_delta_gte: 15 },
    unlocks: { relationBonus: 2, flag: 'bajin_node_4_seen' },
    context: '巴金作为旁白和账房先生，会观察玩家的道德选择。',
    llmPrompt: '巴金在账本上记下玩家这一天的道德变化，但不会直接说"你做错了/对了"，只会说"这账我替你记着"。',
    boundLevel: 'free',
    nextNodeHint: 'bajin_node_5',
  },
  bajin_node_5: {
    id: 'bajin_node_5',
    npcId: 'bajin',
    title: '战前的上海文坛',
    trigger: { type: 'day', day_gte: 50, npcId: 'bajin' },
    unlocks: { relationBonus: 3, flag: 'bajin_node_5_seen' },
    context: '1936 年上海文坛：鲁迅刚去世（1936-10-19），巴金、茅盾、沈从文、张天翼等活跃。',
    llmPrompt: '巴金讲 1935-1936 年的上海文坛——"这一年上海写文章的人很多，但心里有火的人不多了。"（不能提鲁迅去世，但可以暗示）',
    boundLevel: 'semi_fixed',
    nextNodeHint: 'bajin_node_6',
  },
  bajin_node_6: {
    id: 'bajin_node_6',
    npcId: 'bajin',
    title: '黎明的方向',
    trigger: { type: 'day_relation', day_gte: 75, npcId: 'bajin', relation_gte: 70 },
    unlocks: { relationBonus: 5, flag: 'bajin_node_6_seen' },
    context: '1936 年末，巴金感到"山雨欲来"。',
    llmPrompt: '巴金说："先生，我最近总在听北边的风。风里好像有什么东西要来了……"（暗示 1937，但不剧透）',
    boundLevel: 'free',
    nextNodeHint: 'bajin_node_7',
  },
  bajin_node_7: {
    id: 'bajin_node_7',
    npcId: 'bajin',
    title: '一支钢笔',
    trigger: { type: 'day_relation', day_gte: 97, npcId: 'bajin', relation_gte: 80 },
    unlocks: { relationBonus: 10, fragment: 15, flag: 'bajin_node_7_seen' },
    context: '第 100 天前 3 天，巴金把写《家》时的钢笔托付给玩家。',
    llmPrompt: '巴金郑重地说："先生，这支笔写着《家》的字。侬带着它，往后写自己的文章。"',
    boundLevel: 'fixed',
    nextNodeHint: null,
  },
};

/**
 * 检测事实是否触发某个故事线节点
 *
 * @param {object} fact - 玩家行为
 * @param {object} state - 当前 state
 * @returns {object|null} 触发的 STORYLINE 节点
 */
export function checkStorylineTrigger(fact, state) {
  for (const node of Object.values(STORYLINES)) {
    // 已经看过的不重复
    if (state.storylineSeen?.includes(node.id)) continue;
    if (!matchesTrigger(node.trigger, fact, state)) continue;
    return node;
  }
  return null;
}

function matchesTrigger(trigger, fact, state) {
  // P0-A4 修复：触发器里若指定了 npcId，必须与当前 fact.npcId 匹配
  //   否则 day=50 后 xiangsongmao/fangyexian/guole 的 fact 都会错误触发 bajin_node_5
  if (trigger.npcId && trigger.npcId !== fact.npcId) return false
  // 简单实现，按 trigger.type 分发
  switch (trigger.type) {
    case 'buy':
      // P0-8 修复：必须校验 npcId，否则买 131 牙膏会同时触发方液仙的 131 故事线
      if (fact.type !== 'buy' || fact.item !== trigger.item) return false;
      if (trigger.npcId && fact.npcId !== trigger.npcId) return false;
      if (trigger.flags && !trigger.flags.some(f => fact.flags?.includes(f))) return false;
      return true;

    case 'bargain':
      return (fact.type === 'bargain' || fact.type === 'buy') && fact.npcId === trigger.npcId
        && (!trigger.flags || trigger.flags.some(f => fact.flags?.includes(f)));

    case 'bargain_fail':
      // 累计 3 次讨价失败
      if (fact.npcId !== trigger.npcId) return false;
      const fails = state.behavior?.filter(b => b.day && b.npcId === trigger.npcId && b.action === 'bargain_fail') || [];
      return fails.length >= trigger.count;

    case 'bargain_success':
      // 讨价成功且折扣 >= 30%
      if (fact.npcId !== trigger.npcId) return false;
      return fact.discount && fact.discount >= trigger.discount_gte;

    case 'fact_count':
      // 累计购买某 NPC 商品 N 次
      // v9 修复：trigger 无 npcId 时（如 xiangsongmao_node_5 sell_japanese）按 action 全局统计，
      //   此前 `b.npcId === undefined` 永远 false → node_5 永远不可达
      const buys = state.behavior?.filter(b => b.day && (!trigger.npcId || b.npcId === trigger.npcId) && b.action === trigger.action) || [];
      return buys.length >= trigger.count;

    case 'dialogue_keyword':
      // 跟 NPC 对话中提到关键词
      if (fact.npcId !== trigger.npcId) return false;
      const kw = trigger.keywords;
      return kw.some(k => fact.context?.includes(k));

    case 'time_at_screen':
      return fact.screen === trigger.screen && (fact.seconds || 0) >= (trigger.seconds || 0);

    case 'enter_screen':
      return fact.type === 'enter_screen' && fact.screen === trigger.screen
        && state.day <= trigger.day_lte;

    case 'day_relation':
      return state.day >= trigger.day_gte
        && (state.relations?.[trigger.npcId] || 0) >= trigger.relation_gte;

    case 'day':
      return state.day >= trigger.day_gte;

    case 'cross_npc':
      // 跟 NPC A 和 NPC B 都有过互动
      return state.behavior?.some(b => b.npcId === trigger.npcA)
        && state.behavior?.some(b => b.npcId === trigger.npcB);

    case 'morality_change':
      return fact.morality_delta && (
        Math.abs(fact.morality_delta.conscience || 0) >= trigger.abs_delta_gte ||
        Math.abs(fact.morality_delta.survival || 0) >= trigger.abs_delta_gte
      );

    default:
      return false;
  }
}

/**
 * 应用节点解锁
 */
export function applyStorylineUnlock(state, node) {
  const u = node.unlocks;
  if (!u) return state;
  return {
    ...state,
    relations: u.relationBonus
      ? { ...state.relations, [node.npcId]: Math.max(0, Math.min(100, (state.relations?.[node.npcId] || 50) + u.relationBonus)) }
      : state.relations,
    fragments: u.fragment
      ? [...(state.fragments || []), u.fragment].filter((v, i, a) => a.indexOf(v) === i)
      : state.fragments,
    // v9：去重（多个循环可能同时触发同一节点 → storylineSeen 出现重复）
    storylineSeen: [...(state.storylineSeen || []), node.id].filter((v, i, a) => a.indexOf(v) === i),
  };
}

export default {
  STORYLINES,
  checkStorylineTrigger,
  applyStorylineUnlock,
};
