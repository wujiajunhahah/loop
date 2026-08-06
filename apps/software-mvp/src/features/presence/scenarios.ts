/**
 * 引导场景库（Guided Scenarios）——v2.5
 *
 * 采集层三原则（对照 docs/product/guided-collection-spec.md）：
 *  1. 体量轻：一次只递一个话头，不连环追问、不问卷式列表；
 *  2. 操作成本低：语音 / 照片 / 短文字都算一次采集，不用组织语言；
 *  3. 有边界感且优雅：引导者只递话头，不追问、不评价、可随时停。
 *
 * v2.5 场景库大幅延展（8 → 30 个）：覆盖真实关系里几乎所有「说得出口
 * 与说不出口」的时刻。范围仍以「人-人」关系为主；非人主体（宠物/地方/
 * 物件等）暂不纳入。
 *
 * 每个场景 = 一组触发关键词 + 一个开放话头 + 建议模态 + 目标主题标签。
 * 话头必须通过 assertOpenGuideLine（不出现元问题/封闭确认/直接索取）。
 */
import type { GuideStyle, SourceModality } from './types'

/** 建议采集模态：主模态在前，可多选（如 image+audio 表示「拍一张，顺便说说」） */
export type SuggestedModality = readonly SourceModality[]

export interface GuideScenario {
  id: string
  /** 一句话说明这个场景想补什么缺口（内部使用，不展示给本人） */
  name: string
  /** 触发关键词：缺口情境里命中任意一个即匹配 */
  keywords: readonly string[]
  /** 开放话头模板，{recipient} 会被替换为接收者称呼 */
  line: string
  /** 建议模态：语音为主；照片/文字为辅 */
  suggestedModalities: SuggestedModality
  /** 期望归纳出的主题标签（与 extractor LEXICON 对齐） */
  expectedTags: readonly string[]
  /** 边界说明：什么不做（内部约束，不展示） */
  boundary: string
}

/**
 * 采集场景库（v2.5：30 个「人-人」场景）。
 * 每个话头都经过 assertOpenGuideLine 校验（scenarios.test.ts 全量兜底），
 * 并覆盖真实素材里的核心话题（离世遗憾 / 杭州之约 / 信使回应 / 生命记录与传承）。
 */
export const GUIDE_SCENARIOS: readonly GuideScenario[] = [
  // ---------------------------------------------------------- 日常与念叨
  {
    id: 'weather_nagging',
    name: '日常念叨（天冷加衣）',
    keywords: ['天冷', '加衣', '降温', '穿衣服', '冷'],
    line: '你跟{recipient}念叨最多的是啥事？她老嫌你烦的那种。',
    suggestedModalities: ['audio'],
    expectedTags: ['weather_care', 'daily_care'],
    boundary: '不追问具体次数；她烦不烦由本人说，不替她下判断。',
  },
  {
    id: 'daily_voice',
    name: '日常碎碎念',
    keywords: ['日常', '今天', '碎碎念', '随口'],
    line: '今天有什么想跟她念叨的？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['daily_care', 'family'],
    boundary: '不要求「有意义」；碎碎念本身就是素材。',
  },
  {
    id: 'family_recipes',
    name: '家的味道',
    keywords: ['菜', '做饭', '味道', '手艺', '家常'],
    line: '家里哪道菜，是你最拿手的？',
    suggestedModalities: ['audio', 'image'],
    expectedTags: ['family', 'daily_care', 'memory'],
    boundary: '不用报菜名大全；一道就够。',
  },
  {
    id: 'night_ritual',
    name: '睡前的习惯',
    keywords: ['睡前', '晚安', '夜谈', '关灯'],
    line: '你们睡前通常会聊点什么？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'daily_care', 'evening'],
    boundary: '不追问「为什么不聊了」；聊到什么算什么。',
  },
  // ---------------------------------------------------------- 想念与陪伴
  {
    id: 'missing_moments',
    name: '想念的时刻',
    keywords: ['想念', '想她', '陪伴', '倾诉'],
    line: '你平时想她的时候，脑子里都是些什么？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['companionship', 'family'],
    boundary: '不引导情绪走向；沉默或不想说不勉强。',
  },
  {
    id: 'worries_left',
    name: '放心不下的事',
    keywords: ['放心', '担心', '牵挂', '放不下'],
    line: '你心里有没有一直放心不下的事？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'worry', 'grief'],
    boundary: '只递话头；不追问「为什么担心」。',
  },
  {
    id: 'her_habits',
    name: '她的小习惯',
    keywords: ['习惯', '脾气', '毛病', '性格'],
    line: '她身上有哪些改不掉的小习惯？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'intimacy_rule'],
    boundary: '只说本人观察到的，不上升评价。',
  },
  {
    id: 'what_she_likes',
    name: '她喜欢什么',
    keywords: ['喜欢', '爱好', '兴趣', '爱吃什么'],
    line: '她平时最喜欢干的事是啥？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'daily_care'],
    boundary: '不要求准确到爱好列表；想到啥说啥。',
  },
  // ---------------------------------------------------------- 回忆与故事
  {
    id: 'first_meet',
    name: '第一次见面',
    keywords: ['第一次', '初见', '怎么认识', '相遇'],
    line: '你们俩第一次见面，还记得是个什么场景？',
    suggestedModalities: ['audio', 'image'],
    expectedTags: ['family', 'memory'],
    boundary: '记不清也没关系；不用补齐细节。',
  },
  {
    id: 'her_childhood',
    name: '她的小时候',
    keywords: ['小时候', '童年', '打小', '那会儿'],
    line: '{recipient}小时候，最让你记到现在的事是啥？',
    suggestedModalities: ['audio', 'image'],
    expectedTags: ['family', 'childhood', 'memory'],
    boundary: '不比较她和其他孩子。',
  },
  {
    id: 'old_photos',
    name: '老照片与物件',
    keywords: ['照片', '相册', '老物件', '合影', '翻到'],
    line: '这张照片是在哪儿拍的？那会儿你们在干嘛？',
    suggestedModalities: ['image', 'audio'],
    expectedTags: ['family', 'memory', 'photo'],
    boundary: '照片本人选；不索取她没准备好的照片。',
  },
  {
    id: 'places_together',
    name: '一起去过的地方',
    keywords: ['去过', '一起旅行', '走过', '带她'],
    line: '你们一起去过的最远的地方是哪儿？',
    suggestedModalities: ['audio', 'image'],
    expectedTags: ['family', 'travel', 'memory'],
    boundary: '不比较「去过多少地方」。',
  },
  {
    id: 'life_stories',
    name: '人生故事与传承',
    keywords: ['故事', '传承', '人生', '经历', '这辈子'],
    line: '你这一辈子，最想讲给她的故事是哪一个？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'memory', 'legacy'],
    boundary: '不评判故事好坏；讲到哪里算哪里。',
  },
  // ---------------------------------------------------------- 节日与仪式
  {
    id: 'holiday_rituals',
    name: '节日与纪念日',
    keywords: ['节日', '纪念日', '生日', '过年', '热闹'],
    line: '你们家过节日的时候，都是怎么过的？谁张罗，谁最热闹？',
    suggestedModalities: ['audio', 'image'],
    expectedTags: ['family', 'ritual'],
    boundary: '不评价谁对谁错；只记录事实与感受。',
  },
  {
    id: 'family_photo_wall',
    name: '全家福',
    keywords: ['全家福', '合影', '一大家子', '团圆饭'],
    line: '全家福里，你总站在哪个位置？',
    suggestedModalities: ['image', 'audio'],
    expectedTags: ['family', 'photo', 'ritual'],
    boundary: '照片本人选；不要求现在补拍。',
  },
  // ---------------------------------------------------------- 心愿与未来
  {
    id: 'hangzhou_promise',
    name: '未竟之约（杭州）',
    keywords: ['杭州', '旅游', '旅行', '约定', '没去成', '答应过'],
    line: '你们约好过要去的地方，哪个一直没去成？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'promise', 'travel'],
    boundary: '这是遗憾场景，只递话头，不替本人惋惜；可随时停。',
  },
  {
    id: 'future_parent',
    name: '她的未来（当了妈）',
    keywords: ['育儿', '母亲', '当了妈', '成为母亲', '生娃'],
    line: '{recipient}要是当了妈，你觉得她会是个什么样的妈妈？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'future'],
    boundary: '不替本人假设孩子存在；只聊本人愿意聊的。',
  },
  {
    id: 'wishes_for_her',
    name: '想给她的祝愿',
    keywords: ['祝愿', '希望她', '祝福', '盼'],
    line: '你盼着她以后过成什么样？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'future'],
    boundary: '祝愿可以朴素；不要求成句成段。',
  },
  {
    id: 'advice_to_her',
    name: '想教给她的话',
    keywords: ['教她', '告诉她', '提醒', '经验'],
    line: '有什么话，你想趁现在教给她？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'future', 'legacy'],
    boundary: '只递话头；不检查她「学会了没有」。',
  },
  // ---------------------------------------------------------- 遗憾与告别
  {
    id: 'things_never_said',
    name: '没来得及说的话',
    keywords: ['没来得及', '没说过', '说不出口', '遗憾'],
    line: '有没有一直想说、还没说出口的话？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'grief', 'promise'],
    boundary: '最重的场景之一；说完即停，不追问细节。',
  },
  {
    id: 'farewell_words',
    name: '告别与嘱托',
    keywords: ['离别', '告别', '不在', '离开', '嘱托'],
    line: '要是有一天你不在了，你最想让她记住你哪句话？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'grief', 'legacy'],
    boundary: '最重的场景，只在本人主动谈起生死时触发；默认允许拒绝。',
  },
  {
    id: 'apology_left',
    name: '欠她的一句道歉',
    keywords: ['道歉', '对不起', '亏欠', '错怪'],
    line: '有没有什么事，你想跟她说声对不起？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'grief', 'intimacy_rule'],
    boundary: '只递话头，不追问来龙去脉；可随时停。',
  },
  {
    id: 'gratitude_left',
    name: '想谢谢她的',
    keywords: ['谢谢', '感谢', '亏她', '多亏'],
    line: '这些年，你最想谢谢她什么？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'memory'],
    boundary: '感谢不用成篇；一句话也行。',
  },
  {
    id: 'her_strength',
    name: '她让我骄傲的事',
    keywords: ['骄傲', '出息', '争气', '了不起'],
    line: '她做的哪件事，最让你觉得骄傲？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'future'],
    boundary: '不比较她和别人家孩子。',
  },
  // ---------------------------------------------------------- 关系细节
  {
    id: 'how_we_argue',
    name: '吵架与和好',
    keywords: ['吵架', '拌嘴', '冷战', '和好'],
    line: '你们俩闹别扭的时候，一般是谁先开口？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'intimacy_rule'],
    boundary: '不评判谁对谁错；只记相处方式。',
  },
  {
    id: 'what_she_fears',
    name: '她害怕什么',
    keywords: ['怕', '害怕', '不敢', '躲'],
    line: '她从小怕的东西，现在还在怕吗？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'worry', 'childhood'],
    boundary: '不拿她的害怕开玩笑；说到哪算哪。',
  },
  {
    id: 'her_voice',
    name: '她的口头禅',
    keywords: ['口头禅', '常挂嘴边', '说话方式'],
    line: '她说话有没有什么口头禅？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'intimacy_rule'],
    boundary: '口头禅也是记忆；不模仿取笑。',
  },
  {
    id: 'my_own_story',
    name: '讲我自己',
    keywords: ['我自己', '我的事', '我这辈子', '年轻时候'],
    line: '你年轻时候，最得意的一件事是啥？',
    suggestedModalities: ['audio'],
    expectedTags: ['memory', 'legacy'],
    boundary: '本人讲自己时不需要引导者插话；听完即可。',
  },
  {
    id: 'what_i_want_her_to_keep',
    name: '想让她留下的东西',
    keywords: ['留下', '传给她', '保管', '收着'],
    line: '家里有没有哪样东西，你想留给她？',
    suggestedModalities: ['image', 'audio'],
    expectedTags: ['family', 'legacy', 'memory'],
    boundary: '物件不值钱也没关系；讲它背后的故事。',
  },
  {
    id: 'the_last_time',
    name: '最近一次见面',
    keywords: ['最近一次', '最后一次', '上次见', '视频', '通话'],
    line: '你们最近一次见面（通话），聊了些什么？',
    suggestedModalities: ['audio', 'text'],
    expectedTags: ['family', 'daily_care', 'memory'],
    boundary: '聊得普通也没关系；普通就是日常。',
  },
  {
    id: 'her_birth',
    name: '她出生那天',
    keywords: ['出生', '生她', '产房', '抱她'],
    line: '她出生那天，你记得什么？',
    suggestedModalities: ['audio'],
    expectedTags: ['family', 'memory', 'grief'],
    boundary: '记不清细节也没关系；记得感受就行。',
  },
]

export const FALLBACK_SCENARIO: GuideScenario = {
  id: 'fallback',
  name: '通用话头',
  keywords: [],
  line: '聊聊{recipient}吧——你们俩最像的地方是什么？',
  suggestedModalities: ['audio', 'text'],
  expectedTags: ['family'],
  boundary: '兜底场景；不假装知道任何背景。',
}

/** 按缺口情境匹配场景；未命中返回兜底场景 */
export function matchScenario(situation: string): GuideScenario {
  const hit = GUIDE_SCENARIOS.find((s) =>
    s.keywords.some((k) => situation.includes(k)),
  )
  return hit ?? FALLBACK_SCENARIO
}

/** 场景 -> 开放话头（替换接收者称呼） */
export function scenarioLine(scenario: GuideScenario, recipient: string): string {
  return scenario.line.replaceAll('{recipient}', recipient)
}
