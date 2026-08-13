import { v4 as uuidv4 } from 'uuid';
import { DbWord, upsertWords, getWordCount } from './db.js';

// 种子词根定义：一个词根 + 词族成员
interface SeedWord {
  word: string;
  phonetic: string;
  meaning: string;
  prefix?: string;
  prefixMeaning?: string;
  root: string;
  rootMeaning: string;
  suffix?: string;
  suffixMeaning?: string;
  etymology: string;
  sceneTag: string;
  sceneExample: string;
}

interface SeedRoot {
  root: string;
  rootMeaning: string;
  family: SeedWord[];
}

// 高频词根示范数据（词根词源 + 场景记忆）
const SEED_ROOTS: SeedRoot[] = [
  {
    root: 'port',
    rootMeaning: '搬运 / 港口',
    family: [
      {
        word: 'transport', phonetic: '/trænˈspɔːrt/', meaning: 'v. 运输，运送',
        prefix: 'trans', prefixMeaning: '横跨', root: 'port', rootMeaning: '搬运',
        etymology: 'trans(横跨) + port(搬运) = 把东西搬运到另一边 → 运输',
        sceneTag: '机场出行', sceneExample: 'Where can I take the ground transport to downtown?',
      },
      {
        word: 'import', phonetic: '/ɪmˈpɔːrt/', meaning: 'v. 进口',
        prefix: 'im', prefixMeaning: '向内', root: 'port', rootMeaning: '搬运',
        etymology: 'im(向内) + port(搬运) = 往国内搬 → 进口',
        sceneTag: '外贸商务', sceneExample: 'The company imports coffee beans from Brazil.',
      },
      {
        word: 'export', phonetic: '/ˈekspɔːrt/', meaning: 'v. 出口',
        prefix: 'ex', prefixMeaning: '向外', root: 'port', rootMeaning: '搬运',
        etymology: 'ex(向外) + port(搬运) = 往国外搬 → 出口',
        sceneTag: '外贸商务', sceneExample: 'China exports electronics to the world.',
      },
      {
        word: 'portable', phonetic: '/ˈpɔːrtəbl/', meaning: 'adj. 便携的',
        root: 'port', rootMeaning: '搬运', suffix: 'able', suffixMeaning: '能…的',
        etymology: 'port(搬运) + able(能) = 能搬动的 → 便携的',
        sceneTag: '数码产品', sceneExample: 'This portable charger fits in your pocket.',
      },
    ],
  },
  {
    root: 'spect',
    rootMeaning: '看',
    family: [
      {
        word: 'inspect', phonetic: '/ɪnˈspekt/', meaning: 'v. 检查，视察',
        prefix: 'in', prefixMeaning: '向内', root: 'spect', rootMeaning: '看',
        etymology: 'in(向内) + spect(看) = 往里面看 → 检查',
        sceneTag: '海关安检', sceneExample: 'The officer inspected my passport carefully.',
      },
      {
        word: 'respect', phonetic: '/rɪˈspekt/', meaning: 'v./n. 尊重',
        prefix: 're', prefixMeaning: '反复', root: 'spect', rootMeaning: '看',
        etymology: 're(反复) + spect(看) = 反复看、重视 → 尊重',
        sceneTag: '职场沟通', sceneExample: 'We should respect different opinions in a meeting.',
      },
      {
        word: 'spectator', phonetic: '/spekˈteɪtər/', meaning: 'n. 观众',
        root: 'spect', rootMeaning: '看', suffix: 'ator', suffixMeaning: '做…的人',
        etymology: 'spect(看) + ator(人) = 看的人 → 观众',
        sceneTag: '体育赛事', sceneExample: 'Thousands of spectators cheered in the stadium.',
      },
    ],
  },
  {
    root: 'dict',
    rootMeaning: '说',
    family: [
      {
        word: 'predict', phonetic: '/prɪˈdɪkt/', meaning: 'v. 预测',
        prefix: 'pre', prefixMeaning: '提前', root: 'dict', rootMeaning: '说',
        etymology: 'pre(提前) + dict(说) = 提前说 → 预测',
        sceneTag: '商业分析', sceneExample: 'Analysts predict sales will rise next quarter.',
      },
      {
        word: 'dictate', phonetic: '/ˈdɪkteɪt/', meaning: 'v. 口述，命令',
        root: 'dict', rootMeaning: '说', suffix: 'ate', suffixMeaning: '动词后缀',
        etymology: 'dict(说) + ate = 说出来让人照做 → 口述/命令',
        sceneTag: '办公室', sceneExample: 'The manager dictated a letter to her assistant.',
      },
      {
        word: 'dictionary', phonetic: '/ˈdɪkʃəneri/', meaning: 'n. 词典',
        root: 'dict', rootMeaning: '说',
        etymology: 'dict(说) + ion + ary = 收录"说的话"的书 → 词典',
        sceneTag: '学习场景', sceneExample: 'I looked up the word in the dictionary.',
      },
    ],
  },
  {
    root: 'tract',
    rootMeaning: '拉',
    family: [
      {
        word: 'attract', phonetic: '/əˈtrækt/', meaning: 'v. 吸引',
        prefix: 'at', prefixMeaning: '朝向', root: 'tract', rootMeaning: '拉',
        etymology: 'at(朝向) + tract(拉) = 往自己这边拉 → 吸引',
        sceneTag: '市场营销', sceneExample: 'The sale attracted many customers.',
      },
      {
        word: 'contract', phonetic: '/ˈkɑːntrækt/', meaning: 'n. 合同 v. 收缩',
        prefix: 'con', prefixMeaning: '共同', root: 'tract', rootMeaning: '拉',
        etymology: 'con(共同) + tract(拉) = 把双方拉到一起 → 合同',
        sceneTag: '商务签约', sceneExample: 'We signed a contract with the supplier.',
      },
      {
        word: 'extract', phonetic: '/ɪkˈstrækt/', meaning: 'v. 提取，拔出',
        prefix: 'ex', prefixMeaning: '向外', root: 'tract', rootMeaning: '拉',
        etymology: 'ex(向外) + tract(拉) = 往外拉 → 提取',
        sceneTag: '食品加工', sceneExample: 'The machine extracts juice from oranges.',
      },
    ],
  },
  {
    root: 'bio',
    rootMeaning: '生命',
    family: [
      {
        word: 'biology', phonetic: '/baɪˈɑːlədʒi/', meaning: 'n. 生物学',
        root: 'bio', rootMeaning: '生命', suffix: 'logy', suffixMeaning: '…学',
        etymology: 'bio(生命) + logy(学) = 研究生命的学问 → 生物学',
        sceneTag: '校园课堂', sceneExample: 'We dissected a frog in biology class.',
      },
      {
        word: 'biography', phonetic: '/baɪˈɑːɡrəfi/', meaning: 'n. 传记',
        root: 'bio', rootMeaning: '生命', suffix: 'graphy', suffixMeaning: '写/记录',
        etymology: 'bio(生命) + graphy(写) = 记录一个人的一生 → 传记',
        sceneTag: '阅读场景', sceneExample: 'She is reading a biography of Steve Jobs.',
      },
    ],
  },
  {
    root: 'tele',
    rootMeaning: '远',
    family: [
      {
        word: 'television', phonetic: '/ˈtelɪvɪʒn/', meaning: 'n. 电视',
        prefix: 'tele', prefixMeaning: '远', root: 'vis', rootMeaning: '看', suffix: 'ion', suffixMeaning: '名词后缀',
        etymology: 'tele(远) + vis(看) + ion = 看远处传来的画面 → 电视',
        sceneTag: '家庭生活', sceneExample: 'We watched the news on television.',
      },
      {
        word: 'telescope', phonetic: '/ˈtelɪskoʊp/', meaning: 'n. 望远镜',
        prefix: 'tele', prefixMeaning: '远', root: 'scope', rootMeaning: '看/观察',
        etymology: 'tele(远) + scope(看) = 看远处 → 望远镜',
        sceneTag: '天文观测', sceneExample: 'He observed the stars through a telescope.',
      },
    ],
  },
  {
    root: 'graph',
    rootMeaning: '写 / 画',
    family: [
      {
        word: 'photograph', phonetic: '/ˈfoʊtəɡræf/', meaning: 'n. 照片',
        prefix: 'photo', prefixMeaning: '光', root: 'graph', rootMeaning: '写/画',
        etymology: 'photo(光) + graph(画) = 用光"画"出的影像 → 照片',
        sceneTag: '旅行', sceneExample: 'I took a photograph of the sunset.',
      },
      {
        word: 'autograph', phonetic: '/ˈɔːtəɡræf/', meaning: 'n. 亲笔签名',
        prefix: 'auto', prefixMeaning: '自己', root: 'graph', rootMeaning: '写',
        etymology: 'auto(自己) + graph(写) = 自己亲手写 → 亲笔签名',
        sceneTag: '追星现场', sceneExample: 'The fan asked the singer for an autograph.',
      },
    ],
  },
  {
    root: 'aud',
    rootMeaning: '听',
    family: [
      {
        word: 'audience', phonetic: '/ˈɔːdiəns/', meaning: 'n. 观众，听众',
        root: 'aud', rootMeaning: '听', suffix: 'ence', suffixMeaning: '名词后缀',
        etymology: 'aud(听) + ence = 听的人 → 听众',
        sceneTag: '演讲现场', sceneExample: 'The speaker faced a large audience.',
      },
      {
        word: 'audio', phonetic: '/ˈɔːdioʊ/', meaning: 'n./adj. 音频(的)',
        root: 'aud', rootMeaning: '听',
        etymology: 'aud(听) + io = 与听有关的 → 音频',
        sceneTag: '数字设备', sceneExample: 'The audio quality of this earbud is great.',
      },
    ],
  },
  {
    root: 'cred',
    rootMeaning: '相信',
    family: [
      {
        word: 'credit', phonetic: '/ˈkredɪt/', meaning: 'n. 信用，学分',
        root: 'cred', rootMeaning: '相信',
        etymology: 'cred(相信) + it = 别人相信你 → 信用',
        sceneTag: '金融场景', sceneExample: 'Your credit score affects loan approval.',
      },
      {
        word: 'incredible', phonetic: '/ɪnˈkredəbl/', meaning: 'adj. 难以置信的',
        prefix: 'in', prefixMeaning: '不', root: 'cred', rootMeaning: '相信', suffix: 'ible', suffixMeaning: '能…的',
        etymology: 'in(不) + cred(相信) + ible(能) = 无法相信的 → 难以置信的',
        sceneTag: '日常惊叹', sceneExample: 'The view from the top was incredible.',
      },
    ],
  },
  {
    root: 'duct',
    rootMeaning: '引导',
    family: [
      {
        word: 'produce', phonetic: '/prəˈduːs/', meaning: 'v. 生产',
        prefix: 'pro', prefixMeaning: '向前', root: 'duct', rootMeaning: '引导',
        etymology: 'pro(向前) + duce(引导) = 向前引导出来 → 生产',
        sceneTag: '工厂制造', sceneExample: 'This factory produces electric cars.',
      },
      {
        word: 'introduce', phonetic: '/ˌɪntrəˈduːs/', meaning: 'v. 介绍',
        prefix: 'intro', prefixMeaning: '向内', root: 'duct', rootMeaning: '引导',
        etymology: 'intro(向内) + duce(引导) = 把某人引入 → 介绍',
        sceneTag: '社交场合', sceneExample: 'Let me introduce you to my colleague.',
      },
      {
        word: 'reduce', phonetic: '/rɪˈduːs/', meaning: 'v. 减少',
        prefix: 're', prefixMeaning: '向后', root: 'duct', rootMeaning: '引导',
        etymology: 're(向后) + duce(引导) = 往回引导 → 减少',
        sceneTag: '环保节能', sceneExample: 'We should reduce plastic waste.',
      },
    ],
  },
  {
    root: 'form',
    rootMeaning: '形状',
    family: [
      {
        word: 'transform', phonetic: '/trænsˈfɔːrm/', meaning: 'v. 转变，改造',
        prefix: 'trans', prefixMeaning: '横跨', root: 'form', rootMeaning: '形状',
        etymology: 'trans(横跨) + form(形状) = 改变形状 → 转变',
        sceneTag: '科技变革', sceneExample: 'AI is transforming how we work.',
      },
      {
        word: 'uniform', phonetic: '/ˈjuːnɪfɔːrm/', meaning: 'n. 制服 adj. 统一的',
        prefix: 'uni', prefixMeaning: '单一', root: 'form', rootMeaning: '形状',
        etymology: 'uni(单一) + form(形状) = 一样的样子 → 制服/统一',
        sceneTag: '校园生活', sceneExample: 'Students wear uniforms to school.',
      },
    ],
  },
  {
    root: 'struct',
    rootMeaning: '建造',
    family: [
      {
        word: 'construct', phonetic: '/kənˈstrʌkt/', meaning: 'v. 建造',
        prefix: 'con', prefixMeaning: '共同', root: 'struct', rootMeaning: '建造',
        etymology: 'con(共同) + struct(建造) = 一起建造 → 建设',
        sceneTag: '建筑工程', sceneExample: 'They are constructing a new bridge.',
      },
      {
        word: 'instruct', phonetic: '/ɪnˈstrʌkt/', meaning: 'v. 指导，命令',
        prefix: 'in', prefixMeaning: '向内', root: 'struct', rootMeaning: '建造',
        etymology: 'in(向内) + struct(建造) = 在脑中构建 → 指导',
        sceneTag: '教育培训', sceneExample: 'The coach instructed us on the technique.',
      },
    ],
  },
];

// 展开种子数据为 DbWord[]，并填充 root_family（词族）
export function seedWords(): number {
  const existing = getWordCount();
  if (existing > 0) return existing; // 已有数据则跳过

  const allWords: DbWord[] = [];
  for (const sr of SEED_ROOTS) {
    const familyWords = sr.family.map(f => f.word);
    for (const f of sr.family) {
      allWords.push({
        id: uuidv4(),
        word: f.word,
        phonetic: f.phonetic,
        meaning: f.meaning,
        prefix: f.prefix ?? null,
        prefix_meaning: f.prefixMeaning ?? null,
        root: f.root,
        root_meaning: f.rootMeaning,
        suffix: f.suffix ?? null,
        suffix_meaning: f.suffixMeaning ?? null,
        etymology: f.etymology,
        root_family: JSON.stringify(familyWords),
        scene_tag: f.sceneTag,
        scene_example: f.sceneExample,
        scene_dialogue: null,
      });
    }
  }
  const count = upsertWords(allWords);
  console.log(`[Seed] 词库已初始化，共 ${count} 个单词（${SEED_ROOTS.length} 个词根）`);
  return count;
}
