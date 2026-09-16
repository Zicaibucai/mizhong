import type { Dict } from './en';

export const zh: Dict = {
  meta: {
    title: '纺织辅料供应商与采购合作伙伴',
    description:
      '为服装厂、品牌方与采购商供应纺织辅料——织带、标签与定制辅料，稳定品质、按时交付。',
  },
  nav: {
    home: '首页',
    products: '产品',
    supply: '供应链',
    quality: '质量',
    contact: '联系我们',
    cta: '发起询盘',
    menu: '打开菜单',
    close: '关闭菜单',
    primary: '主导航',
    mobile: '移动端导航',
  },
  lang: {
    label: '语言',
  },
  hero: {
    eyebrow: '纺织辅料供应商与采购合作伙伴',
    titleLine1: '纺织辅料采购与供应，',
    titleLine2: '交给可靠的伙伴。',
    subtitle:
      '我们为服装厂、品牌方与采购商供应可靠的纺织辅料——从织带、标签到定制辅料——以稳定品质按时交付。',
    ctaPrimary: '浏览产品',
    ctaSecondary: '发起询盘',
    mediaLabel: '首屏媒体',
  },
  capabilities: {
    eyebrow: '我们做什么',
    title: '贯穿供应链的可靠合作伙伴',
    subtitle: '从采购与规格确认，到检验与出货，我们把握让订单顺畅推进的每一个环节。',
    items: [
      {
        title: '采购与定制',
        desc: '根据您的设计、材质与颜色要求确定规格。',
      },
      {
        title: '稳定供应',
        desc: '依托稳定的供应商网络，保证批次一致。',
      },
      {
        title: '品质把控',
        desc: '出货前对产品进行检验与核对。',
      },
      {
        title: '出口服务',
        desc: '清晰的沟通与符合出口要求的包装。',
      },
    ],
  },
  /**
   * 公司介绍区块。
   *
   * 标题与领域标签来自字典，正文与辅助文字全部来自后台公司资料
   * （CompanyProfile：about / positioning / tagline）；字段为空即不渲染，
   * 不拿字典文案冒充公司介绍。
   */
  about: {
    eyebrow: '关于我们',
    title: '公司介绍',
    positioningLabel: '公司定位',
    detailsLabel: '公司信息',
  },
  products: {
    eyebrow: '产品',
    title: '产品分类',
    subtitle: '此为代表性概览。完整产品目录与规格将在资料确认后发布。',
    categories: [
      { name: '织带与包边', desc: '多种幅宽与材质的梭织织带、包边带。' },
      { name: '标签与吊牌', desc: '织唛、印唛、洗水标与吊牌。' },
      { name: '拉链与扣具', desc: '拉链、纽扣及服装扣合配件。' },
      { name: '松紧带与绳索', desc: '松紧带、抽绳与功能性绳带。' },
      { name: '花边与装饰', desc: '花边、缎带与装饰辅料。' },
      { name: '包装辅料', desc: '包装配件与陈列材料。' },
    ],
    cta: '查看完整目录',
  },
  supply: {
    eyebrow: '供应链',
    title: '供应链与采购',
    subtitle: '我们与经过筛选的生产伙伴合作，把控每个环节，让订单按期、按规格交付。',
    points: ['供应商筛选与评估', '规格与样品确认', '过程与出货前检验', '出货协调与单证'],
    mediaLabel: '供应链媒体',
  },
  quality: {
    eyebrow: '质量与信任',
    title: '经得起检验的品质',
    subtitle: '我们以高标准要求合作方，让客户对每一次交付都放心。',
    principles: [
      {
        title: '原料标准',
        desc: '按约定规格核对材料。',
      },
      {
        title: '供应方责任',
        desc: '文件化要求让不同订单保持一致。',
      },
      {
        title: '交付可靠',
        desc: '从下单到出货，时间表与沟通清晰透明。',
      },
    ],
    certificatesTitle: '认证资质',
    certificatesNote: '认证资质详情将在公司确认后发布。',
    certificatesPlaceholder: '证书 — 待确认',
  },
  inquiry: {
    eyebrow: '开启项目',
    title: '有采购需求？',
    subtitle: '告诉我们您的产品、规格与数量，我们将回复报价与交期。',
    cta: '发起询盘',
    emailLabel: '邮箱',
    phoneLabel: '电话',
    addressLabel: '地址',
    note: '在线询盘表单即将上线。',
  },
  contact: {
    email: '邮箱',
    whatsapp: 'WhatsApp',
    phone: '电话',
    wechat: '微信',
    address: '地址',
  },
  footer: {
    tagline: '为服装厂、品牌方与采购商供应纺织辅料。',
    productsTitle: '产品',
    companyTitle: '公司',
    contactTitle: '联系方式',
    copyright: '版权所有。',
    noContacts: '联系方式即将公布。',
  },
  notFound: {
    title: '页面不存在',
    description: '您访问的页面不存在或已被移动。',
    back: '返回首页',
  },
  common: {
    placeholder: '占位',
    comingSoon: '即将上线',
    toBeConfirmed: '待确认',
    skipToContent: '跳转到主要内容',
  },
  /** 设计预览页（/zh/design-preview）专用文案，见 en.ts 中的说明 */
  preview: {
    scroll: '向下滚动',
    stage: '阶段',
    artwork: '生成的织纹示意图——装饰性图形，非产品照片',
    channels: '直接联系渠道',
  },
};
