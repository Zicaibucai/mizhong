export const en = {
  meta: {
    title: 'Textile Accessories Supplier & Sourcing Partner',
    description:
      'Supplier of textile accessories for garment factories, brands and sourcing partners — webbing, labels and custom trims, delivered with consistent quality and on time.',
  },
  nav: {
    home: 'Home',
    products: 'Products',
    supply: 'Supply Chain',
    quality: 'Quality',
    contact: 'Contact',
    cta: 'Send Inquiry',
    menu: 'Open menu',
    close: 'Close menu',
    primary: 'Primary navigation',
    mobile: 'Mobile navigation',
  },
  lang: {
    label: 'Language',
  },
  hero: {
    eyebrow: 'Textile Accessories Supplier & Sourcing Partner',
    titleLine1: 'Your sourcing partner',
    titleLine2: 'for textile accessories.',
    subtitle:
      'We supply garment factories, brands and sourcing partners with dependable textile accessories — from webbing and labels to custom trims — backed by consistent quality and on-time delivery.',
    ctaPrimary: 'Explore Products',
    ctaSecondary: 'Send an Inquiry',
    mediaLabel: 'Featured media',
  },
  capabilities: {
    eyebrow: 'What we do',
    title: 'A dependable partner across the supply chain',
    subtitle:
      'From sourcing and specification to inspection and shipment, we manage the details that keep orders moving.',
    items: [
      {
        title: 'Sourcing & customisation',
        desc: 'Specifications tailored to your design, material and colour requirements.',
      },
      {
        title: 'Stable supply',
        desc: 'An established supplier network that keeps every batch consistent.',
      },
      {
        title: 'Quality assurance',
        desc: 'Inspection and verification before goods leave our partners.',
      },
      {
        title: 'Export service',
        desc: 'Clear communication and export-ready packaging for markets worldwide.',
      },
    ],
  },
  /**
   * 公司介绍区块。
   *
   * 标题与领域标签来自字典，**正文与辅助文字全部来自后台的公司资料**
   * （CompanyProfile：about / positioning / tagline）。任一字段为空就不渲染对应内容，
   * 整块内容都为空时整个区块不出现 —— 绝不用字典文案去冒充公司介绍。
   */
  about: {
    eyebrow: 'About us',
    title: 'About our company',
    positioningLabel: 'Positioning',
    detailsLabel: 'Company details',
  },
  products: {
    eyebrow: 'Products',
    title: 'Product categories',
    subtitle:
      'A representative overview. The full catalogue and specifications will be published as materials are confirmed.',
    categories: [
      { name: 'Webbing & Tapes', desc: 'Woven webbing, bindings and tapes in a range of widths and fibres.' },
      { name: 'Labels & Tags', desc: 'Woven and printed labels, care labels and hang tags.' },
      { name: 'Zippers & Fasteners', desc: 'Zippers, buttons and fastening components for apparel.' },
      { name: 'Elastics & Cords', desc: 'Elastic bands, drawcords and cords for functional finishes.' },
      { name: 'Lace & Trims', desc: 'Lace, ribbons and decorative trims.' },
      { name: 'Packaging', desc: 'Packaging accessories and presentation materials.' },
    ],
    cta: 'View full catalogue',
  },
  supply: {
    eyebrow: 'Supply chain',
    title: 'Supply chain and procurement',
    subtitle:
      'We work with vetted production partners and manage each step so orders arrive on schedule and to specification.',
    points: [
      'Supplier qualification and selection',
      'Specification and sample confirmation',
      'In-process and pre-shipment inspection',
      'Shipment coordination and documentation',
    ],
    mediaLabel: 'Supply chain media',
  },
  quality: {
    eyebrow: 'Quality & trust',
    title: 'Quality you can build on',
    subtitle:
      'We hold our partners to standards that make it easy for customers to trust every delivery.',
    principles: [
      {
        title: 'Material standards',
        desc: 'Materials are checked against agreed specifications.',
      },
      {
        title: 'Supplier accountability',
        desc: 'Documented requirements keep output consistent across orders.',
      },
      {
        title: 'Delivery reliability',
        desc: 'Clear timelines and communication from order to shipment.',
      },
    ],
    certificatesTitle: 'Certifications',
    certificatesNote: 'Certification details will be published once confirmed by the company.',
    certificatesPlaceholder: 'Certificate — to be confirmed',
  },
  inquiry: {
    eyebrow: 'Start a project',
    title: 'Have a requirement in mind?',
    subtitle:
      'Tell us about your product, specification and volume, and we will respond with pricing and lead time.',
    cta: 'Send an Inquiry',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    addressLabel: 'Address',
    note: 'The online inquiry form is coming soon.',
  },
  contact: {
    email: 'Email',
    whatsapp: 'WhatsApp',
    phone: 'Phone',
    wechat: 'WeChat',
    address: 'Address',
  },
  footer: {
    tagline: 'Textile accessories for garment factories, brands and sourcing partners.',
    productsTitle: 'Products',
    companyTitle: 'Company',
    contactTitle: 'Contact',
    copyright: 'All rights reserved.',
    noContacts: 'Contact details will be published shortly.',
  },
  notFound: {
    title: 'Page not found',
    description: 'The page you are looking for does not exist or has been moved.',
    back: 'Back to home',
  },
  common: {
    placeholder: 'Placeholder',
    comingSoon: 'Coming soon',
    toBeConfirmed: 'To be confirmed',
    skipToContent: 'Skip to main content',
  },
  /**
   * 设计预览页（/en/design-preview）专用文案。
   * 仅用于新增的编辑式版式与动效所需的最小标签，不引入任何未经确认的事实。
   */
  preview: {
    scroll: 'Scroll',
    stage: 'Stage',
    artwork: 'Generated weave study — decorative graphic, not a product photograph',
    channels: 'Direct contact channels',
  },
};

export type Dict = typeof en;
