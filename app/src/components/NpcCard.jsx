// app/src/components/NpcCard.jsx
// NPC 卡片 —— 1:1 还原 mockup-13-npccard + mockup-01-homeview 底部
// 海派边框（红边 + 金边双线）+ 米色纸底 + 立绘 + 名字 + 时期 + 五洲印章

import NPC_AGENTS from '../data/npcAgents.js'
import { moodToPortraitUrl } from '../rules/portrait.js'
import { MOOD_COLOR } from '../data/portraitLabels.js'

// 把文件名 `01-xiangsongmao-平静-...` → URL 路径
// 实际文件名带描述后缀，需要 glob 找
const PORTRAIT_FILE_MAP = {
  'xiangsongmao-平静': '01-xiangsongmao-平静-圆脸方框眼镜礼帽长衫马褂-五洲药房背景.png',
  'xiangsongmao-愉悦': '05-xiangsongmao-愉悦-笑容舒展眼睛眯起-拍胸口赞131牙膏.png',
  'xiangsongmao-愤怒': '09-xiangsongmao-愤怒-眉头紧锁-握算盘用力摔账本.png',
  'xiangsongmao-忧虑': '13-xiangsongmao-忧虑-眼神向下眉头微皱-手扶药柜.png',
  'xiangsongmao-烦躁': '17-xiangsongmao-烦躁-嘴角紧抿眼神锐利-挥手示意.png',
  'xiangsongmao-悲哀': '21-xiangsongmao-悲哀-眼眶微红-垂首沉思手抚算盘.png',
  'fangyexian-平静': '02-fangyexian-平静-瘦长脸金丝眼镜西装油头-化学实验室背景.png',
  'fangyexian-愉悦': '06-fangyexian-愉悦-表情舒展微微点头-拱手致意.png',
  'fangyexian-愤怒': '10-fangyexian-愤怒-眉头紧锁-握紧拳头怒目而视.png',
  'fangyexian-忧虑': '14-fangyexian-忧虑-眉头微皱-目光深邃陷入沉思.png',
  'fangyexian-烦躁': '18-fangyexian-烦躁-摘下眼镜擦拭-不耐烦.png',
  'fangyexian-悲哀': '22-fangyexian-悲哀-凝视窗外-背影悲伤.png',
  'guole-平静': '03-guole-平静-圆胖脸长衫瓜皮帽手杖-永安百货背景.png',
  'guole-愉悦': '07-guole-愉悦-慈祥笑容点头赞许-露出慈祥笑容.png',
  'guole-愤怒': '11-guole-愤怒-手杖重重顿地-严厉怒目眉头紧锁.png',
  'guole-忧虑': '15-guole-忧虑-扶杖远眺-忧心忡忡眉头微皱.png',
  'guole-烦躁': '19-guole-烦躁-拍桌子-眉头紧锁眼神锐利.png',
  'guole-悲哀': '23-guole-悲哀-摘下瓜皮帽-悲凉垂首沉默.png',
  'bajin-平静': '04-bajin-平静-清瘦温和眼神中山装围巾-书房背景.png',
  'bajin-愉悦': '08-bajin-愉悦-温柔笑容停下笔微微抬头-露出温柔笑容.png',
  'bajin-愤怒': '12-bajin-愤怒-紧握钢笔-眉头紧锁怒目而视.png',
  'bajin-忧虑': '16-bajin-忧虑-凝视窗外远方-忧国忧民眉头微皱.png',
  'bajin-烦躁': '20-bajin-烦躁-撕稿纸-紧握笔杆眉头紧锁.png',
  'bajin-悲哀': '24-bajin-悲哀-垂首沉默-悲悯面色凝重.png',
  'wangpo-平静': '25-wangpo-平静-圆脸慈祥银白发髻-茶馆背景.png',
  'wangpo-愉悦': '26-wangpo-愉悦-笑容满面-手端热茶递给客人.png',
  'wangpo-愤怒': '27-wangpo-愤怒-眉头紧锁-手持茶壶作势要砸.png',
  'wangpo-忧虑': '28-wangpo-忧虑-眉头微皱-陷入对亡夫的思念.png',
  'wangpo-烦躁': '29-wangpo-烦躁-嘴角紧抿-挥围裙赶人.png',
  'wangpo-悲哀': '30-wangpo-悲哀-眼眶微红-垂首沉默手抚红木盒.png',
  'xunpu-平静': '31-xunpu-平静-深色短发西装红臂章-法租界街景.png',
  'xunpu-愉悦': '32-xunpu-愉悦-笑眯眯-点头打招呼拍胸口.png',
  'xunpu-愤怒': '33-xunpu-愤怒-眉头紧锁-手按腰间警棍怒目而视.png',
  'xunpu-忧虑': '34-xunpu-忧虑-眉头微皱-陷入1932惨痛记忆.png',
  'xunpu-烦躁': '35-xunpu-烦躁-嘴角紧抿-挥手驱赶摊贩.png',
  'xunpu-悲哀': '36-xunpu-悲哀-垂首沉默-陷入对死难同胞的哀悼.png',
  'qingbang-平静': '37-qingbang-平静-短长衫别短刀-堂口背景.png',
  'qingbang-愉悦': '38-qingbang-愉悦-笑眯眯-露出一颗金牙拱手致意.png',
  'qingbang-愤怒': '39-qingbang-愤怒-眉头紧锁-手握短刀刀柄怒目圆睁.png',
  'qingbang-忧虑': '40-qingbang-忧虑-眉头微皱-陷入对命运的迷茫.png',
  'qingbang-烦躁': '41-qingbang-烦躁-嘴角紧抿-拍桌吓唬人.png',
  'qingbang-悲哀': '42-qingbang-悲哀-垂首沉默-望着香烛小龛面色凝重.png',
  'rishang-平静': '43-rishang-平静-西装三件套眼角旧伤疤-洋行办公室背景.png',
  'rishang-愉悦': '44-rishang-愉悦-笑眯眯-点头致意举起清酒小杯.png',
  'rishang-愤怒': '45-rishang-愤怒-眉头紧锁-怒目而视手拍桌子.png',
  'rishang-忧虑': '46-rishang-忧虑-眉头微皱-眼神疲惫陷入对战争的担忧.png',
  'rishang-烦躁': '47-rishang-烦躁-嘴角紧抿-拍掉桌上的清酒瓶.png',
  'rishang-悲哀': '48-rishang-悲哀-垂首沉默-抚摸眼角旧伤疤面色凝重.png',
  'dixia-平静': '49-dixia-平静-教师长衫素银戒指-简朴小学教师办公室.png',
  'dixia-愉悦': '50-dixia-愉悦-笑容舒展-手伸出来跟人握手.png',
  'dixia-愤怒': '51-dixia-愤怒-眉头微皱-目光锐利双手紧按讲义.png',
  'dixia-忧虑': '52-dixia-忧虑-眉头微皱-凝视讲义陷入沉思.png',
  'dixia-烦躁': '53-dixia-烦躁-嘴角紧抿-起身在桌边踱步.png',
  'dixia-悲哀': '54-dixia-悲哀-垂首沉默-抚摸着讲义上的墨迹面色凝重.png',
}

function portraitUrlByNpcId(npcId, mood) {
  const key = `${npcId}-${mood}`
  const file = PORTRAIT_FILE_MAP[key]
  return file ? `/img/portraits/${file}` : `/img/portraits/${npcId}-${mood}.png`
}

export default function NpcCard({ npcId, mood = '平静', onClick, isHeroFour = false, item = null }) {
  const npc = NPC_AGENTS[npcId]
  if (!npc) return null
  const era = npc.era || ''
  const role = npc.role || ''
  const moodColor = MOOD_COLOR[mood] || '#4A6670'
  const url = portraitUrlByNpcId(npcId, mood)

  // 4 核心 NPC 用金边（v2 套图 1 差异化），5 邻里用朱砂红边
  const borderColor = isHeroFour ? '#C9A86A' : '#B03A2E'
  const borderWidth = isHeroFour ? '2.5px' : '1.5px'

  return (
    <div
      onClick={onClick}
      style={{
        background: '#F5EFE3',
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 4,
        padding: 12,
        fontFamily: '"Kaiti SC", "楷体", "Songti SC", serif',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
        boxShadow: isHeroFour ? '0 4px 12px rgba(201,168,106,0.35)' : '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      {/* 五洲印章 右上（仅核心 NPC） */}
      {isHeroFour && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 24, height: 24, borderRadius: '50%',
          background: '#B03A2E', color: '#C9A86A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 'bold', lineHeight: 1,
          border: '1px solid #C9A86A',
        }}>五<br/>洲</div>
      )}

      {/* 立绘 圆形 */}
      <div style={{
        width: 70, height: 88, borderRadius: '50% 50% 48% 48%',
        overflow: 'hidden', marginBottom: 8,
        background: '#E8DDC4', filter: 'grayscale(80%) contrast(1.1)',
        border: '1px solid #1F2A33',
      }}>
        <img
          src={url}
          alt={npc.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.src = '/img/portraits/01-xiangsongmao-平静-圆脸方框眼镜礼帽长衫马褂-五洲药房背景.png' }}
        />
      </div>

      {/* 名字 */}
      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2A33', marginBottom: 2 }}>
        {npc.name}
      </div>

      {/* 时期（仅核心 NPC 显示） */}
      {isHeroFour && (
        <div style={{ fontSize: 10, color: '#6B4E2E', marginBottom: 2 }}>
          {era}
        </div>
      )}

      {/* 职位 */}
      <div style={{ fontSize: 10, color: '#1F2A33', textAlign: 'center', marginBottom: 4 }}>
        {role}
      </div>

      {/* 道具小字（仅核心 NPC，1 行 bento 视觉差异） */}
      {isHeroFour && item && (
        <div style={{
          fontSize: 10, color: '#6B4E2E',
          fontStyle: 'italic', letterSpacing: 1,
          paddingTop: 4, marginTop: 2,
          borderTop: '1px solid rgba(201, 168, 106, 0.4)',
          minHeight: 14,
        }}>
          随身：{item}
        </div>
      )}

      {/* mood 圆点 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: isHeroFour ? 4 : 0 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: moodColor }} />
        <span style={{ fontSize: 10, color: moodColor }}>{mood}</span>
      </div>
    </div>
  )
}
