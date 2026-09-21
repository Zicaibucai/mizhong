import type { Dict } from './dictionaries/en';
import type { Locale } from './config';

/**
 * 米众新材料的沙发辅料定位文案。
 *
 * 单独放在这里而不散落到11个通用字典中，是为了保证：
 * - 公司定位、首页结构和 SEO 在所有语言中同步更新；
 * - 不再混入旧的“服装/纺织辅料”定位；
 * - 所有表述只描述供应与采购服务，不虚构工厂、产能或认证。
 */

export type SofaDictionaryOverlay = Pick<
  Dict,
  | 'meta'
  | 'hero'
  | 'capabilities'
  | 'products'
  | 'supply'
  | 'quality'
  | 'inquiry'
  | 'footer'
  | 'preview'
>;

export interface SofaCompanyProfileCopy {
  name: string;
  tagline: string;
  about: string;
  positioning: string;
  seoTitle: string;
  seoDescription: string;
}

export interface SofaPreviewCopy {
  qualityProcessLabel: string;
  qualitySteps: readonly { title: string; desc: string }[];
  productsPublishedLabel: string;
  productsFromCatalogue: string;
  productsNoPublished: string;
  browseProducts: string;
  requestCatalogue: string;
  inquirySubject: string;
  inquiryHint: string;
}

export interface SofaLocaleContent extends SofaDictionaryOverlay {
  company: SofaCompanyProfileCopy;
  previewCopy: SofaPreviewCopy;
}

const sharedCompanyName = 'Mizhong New Materials Co., Ltd.';

export const sofaContent: Record<Locale, SofaLocaleContent> = {
  zh: {
    company: {
      name: '米众新材料有限公司',
      tagline: '专注沙发辅料，让采购更简单。',
      about:
        '米众新材料有限公司专注于沙发及软体家具辅料，为客户提供产品选型、规格确认、样品跟进、供应协调、质量核对与出货服务。我们重视清晰沟通、稳定品质与按期交付，支持不同市场和项目的采购需求。',
      positioning: '沙发辅料供应商与采购服务伙伴',
      seoTitle: '米众新材料有限公司｜沙发辅料供应商',
      seoDescription:
        '专注沙发及软体家具辅料供应，提供五金连接件、弹簧支撑、松紧带、无纺布等产品的选型、打样、采购协调与出口服务。',
    },
    meta: {
      title: '沙发辅料供应商与采购服务伙伴',
      description:
        '为沙发及软体家具制造商提供五金连接件、弹簧支撑、松紧带、无纺布与配套辅料的采购与交付服务。',
    },
    hero: {
      eyebrow: '沙发辅料供应商与采购服务伙伴',
      titleLine1: '专注沙发辅料，',
      titleLine2: '连接稳定供应与可靠交付。',
      subtitle:
        '我们为沙发及软体家具客户提供五金连接件、弹簧支撑、松紧带、无纺布等辅料的选型、打样、采购协调与出货服务。',
      ctaPrimary: '了解产品范围',
      ctaSecondary: '发起询盘',
      mediaLabel: '沙发辅料材质示意',
    },
    capabilities: {
      eyebrow: '我们的服务',
      title: '从需求确认到出货交付，让每一步更清晰',
      subtitle: '围绕沙发辅料采购，我们协调产品选型、样品、质量核对与出货信息。',
      items: [
        { title: '产品选型', desc: '根据用途、材质、尺寸与装配要求匹配合适的沙发辅料。' },
        { title: '稳定采购', desc: '协调供应资源与交期，跟进样品和批量订单。' },
        { title: '质量核对', desc: '按确认的规格、数量与包装要求进行出货前核对。' },
        { title: '出口协调', desc: '协调包装、唛头、单证与发运信息，支持海外采购。' },
      ],
    },
    products: {
      eyebrow: '产品范围',
      title: '沙发辅料分类',
      subtitle: '以下为代表性产品范围。具体材质、尺寸、包装与最小起订量请向我们询价。',
      categories: [
        { name: '沙发五金连接件', desc: '连接、固定、调节与装配所用的金属辅件。' },
        { name: '弹簧与支撑系统', desc: '蛇形弹簧、夹具以及座包与靠背支撑配件。' },
        { name: '松紧带与织带', desc: '用于坐垫、靠背和软体结构的弹性支撑材料。' },
        { name: '无纺布与底布', desc: '沙发底部、内衬和防尘覆盖所用材料。' },
        { name: '填充与包覆辅料', desc: '用于缓冲、填充、包覆与表面整理的配套材料。' },
        { name: '包装与装配辅料', desc: '缝制、粘合、防护包装与装配所需辅料。' },
      ],
      cta: '联系获取产品目录',
    },
    supply: {
      eyebrow: '采购流程',
      title: '从规格到交付，全程有据可跟',
      subtitle: '以确认过的用途、规格、样品与包装要求为基准，协调供应、检查与发运。',
      points: ['需求与材质确认', '样品与规格批准', '订单跟进与出货前核对', '包装、单证与发运'],
      mediaLabel: '沙发辅料材质示意',
    },
    quality: {
      eyebrow: '质量与交付',
      title: '将关键细节确认在出货之前',
      subtitle: '从材质、尺寸到数量与包装，按双方确认的要求逐项核对。',
      principles: [
        { title: '规格基准', desc: '材质、尺寸、颜色与用途在下单前确认。' },
        { title: '样品一致', desc: '批量订单以已批准样品和书面要求为依据。' },
        { title: '交付核对', desc: '出货前核对数量、包装、唛头与单证信息。' },
      ],
      certificatesTitle: '文件与资质',
      certificatesNote: '与具体产品相关的检测报告或资质文件，将以实际可提供资料为准。',
      certificatesPlaceholder: '文件—以实际资料为准',
    },
    inquiry: {
      eyebrow: '联系米众',
      title: '正在寻找沙发辅料？',
      subtitle: '告诉我们产品用途、材质、尺寸、数量与目的地，我们将根据需求回复选型、报价与交期。',
      cta: '发起询盘',
      emailLabel: '邮箱',
      phoneLabel: '电话',
      addressLabel: '地址',
      note: '请通过 WhatsApp、邮件或电话联系我们。',
    },
    footer: {
      tagline: '专注沙发及软体家具辅料，连接适合的产品与可靠交付。',
      productsTitle: '产品范围',
      companyTitle: '公司',
      contactTitle: '联系方式',
      copyright: '版权所有。',
      noContacts: '联系方式即将公布。',
    },
    preview: {
      scroll: '向下浏览',
      stage: '阶段',
      artwork: '沙发辅料材质与结构示意—装饰图形，非产品照片',
      channels: '直接联系渠道',
    },
    previewCopy: {
      qualityProcessLabel: '质量核对流程',
      qualitySteps: [
        { title: '需求与规格确认', desc: '下单前确认用途、材质、尺寸、颜色与包装要求。' },
        { title: '样品与供应核验', desc: '将批量订单与已确认样品和书面规格进行对照。' },
        { title: '出货前检查', desc: '按约定标准核对外观、关键尺寸、数量与包装。' },
        { title: '包装与单证复核', desc: '确认包装方式、唛头、数量与发运单证信息。' },
      ],
      productsPublishedLabel: '已发布产品',
      productsFromCatalogue: '以下为已发布的沙发辅料，点击查看详情。',
      productsNoPublished: '正在整理正式产品目录，当前先展示主要产品范围。欢迎联系获取适合您项目的规格与报价。',
      browseProducts: '浏览全部产品',
      requestCatalogue: '联系获取产品目录',
      inquirySubject: '沙发辅料询盘',
      inquiryHint: '请提供用途、规格、数量和目的地，便于我们更快回复。',
    },
  },

  en: {
    company: {
      name: sharedCompanyName,
      tagline: 'Focused on sofa accessories. Built for easier sourcing.',
      about:
        'Mizhong New Materials Co., Ltd. focuses on accessories for sofas and upholstered furniture. We support product selection, specification confirmation, sample follow-up, sourcing coordination, quality checks and shipment. Clear communication, consistent quality and dependable delivery guide every project.',
      positioning: 'Sofa accessories supplier and sourcing partner',
      seoTitle: 'Mizhong New Materials | Sofa Accessories Supplier',
      seoDescription:
        'Sofa and upholstered furniture accessories, including hardware connectors, spring supports, elastic webbing, non-woven fabrics and coordinated sourcing services.',
    },
    meta: {
      title: 'Sofa Accessories Supplier & Sourcing Partner',
      description:
        'Sourcing and delivery support for sofa hardware, spring systems, elastic webbing, non-woven fabrics and related upholstered furniture accessories.',
    },
    hero: {
      eyebrow: 'Sofa Accessories Supplier & Sourcing Partner',
      titleLine1: 'Reliable sofa accessories,',
      titleLine2: 'ready for every build.',
      subtitle:
        'We help sofa and upholstered furniture businesses source hardware connectors, spring supports, elastic webbing, non-woven fabrics and related materials — from specification and samples to delivery.',
      ctaPrimary: 'Explore our range',
      ctaSecondary: 'Send an inquiry',
      mediaLabel: 'Sofa accessory material study',
    },
    capabilities: {
      eyebrow: 'How we help',
      title: 'A clearer path from requirement to delivery',
      subtitle:
        'We coordinate product matching, samples, quality checks and shipment details for sofa accessory orders.',
      items: [
        { title: 'Product matching', desc: 'Options matched to the application, material, dimensions and assembly requirements.' },
        { title: 'Stable sourcing', desc: 'Supplier coordination and lead-time follow-up for samples and volume orders.' },
        { title: 'Quality checks', desc: 'Pre-shipment checks against confirmed specifications, quantities and packing requirements.' },
        { title: 'Export coordination', desc: 'Packing, shipping marks, documents and dispatch details coordinated for overseas orders.' },
      ],
    },
    products: {
      eyebrow: 'Product range',
      title: 'Sofa accessory categories',
      subtitle:
        'A representative overview. Contact us to confirm material, dimensions, packing and minimum order requirements.',
      categories: [
        { name: 'Sofa hardware & connectors', desc: 'Metal parts for joining, fixing, adjustment and assembly.' },
        { name: 'Springs & support systems', desc: 'Zigzag springs, clips and support components for seats and backs.' },
        { name: 'Elastic webbing & tapes', desc: 'Elastic support materials for seats, backs and upholstered structures.' },
        { name: 'Non-woven fabrics & dust covers', desc: 'Materials for sofa bases, liners and dust covers.' },
        { name: 'Padding & upholstery supplies', desc: 'Supporting materials for cushioning, padding, wrapping and finishing.' },
        { name: 'Packing & assembly supplies', desc: 'Sewing, bonding, protective packing and assembly consumables.' },
      ],
      cta: 'Request the product catalogue',
    },
    supply: {
      eyebrow: 'Sourcing process',
      title: 'From specification to delivery, every step stays visible',
      subtitle:
        'Confirmed applications, specifications, samples and packing requirements guide sourcing, checks and dispatch.',
      points: [
        'Requirement and material confirmation',
        'Sample and specification approval',
        'Order follow-up and pre-shipment check',
        'Packing, documents and dispatch',
      ],
      mediaLabel: 'Sofa accessory material study',
    },
    quality: {
      eyebrow: 'Quality & delivery',
      title: 'Key details checked before shipment',
      subtitle:
        'Material, dimensions, quantity and packing are checked against the requirements confirmed for the order.',
      principles: [
        { title: 'Specification baseline', desc: 'Material, dimensions, colour and application are confirmed before ordering.' },
        { title: 'Sample consistency', desc: 'Volume orders follow the approved sample and written requirements.' },
        { title: 'Delivery verification', desc: 'Quantity, packing, shipping marks and documents are checked before dispatch.' },
      ],
      certificatesTitle: 'Documents & compliance',
      certificatesNote:
        'Test reports or compliance documents are provided when they are available for the selected product.',
      certificatesPlaceholder: 'Document — subject to availability',
    },
    inquiry: {
      eyebrow: 'Contact Mizhong',
      title: 'Looking for sofa accessories?',
      subtitle:
        'Tell us the application, material, dimensions, quantity and destination. We will respond with suitable options, pricing and lead time.',
      cta: 'Send an inquiry',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      addressLabel: 'Address',
      note: 'Contact us by WhatsApp, email or phone.',
    },
    footer: {
      tagline: 'Sofa and upholstered furniture accessories, matched to your requirements and delivery plan.',
      productsTitle: 'Product range',
      companyTitle: 'Company',
      contactTitle: 'Contact',
      copyright: 'All rights reserved.',
      noContacts: 'Contact details will be published shortly.',
    },
    preview: {
      scroll: 'Scroll',
      stage: 'Stage',
      artwork: 'Sofa accessory material and structure study — decorative graphic, not a product photograph',
      channels: 'Direct contact channels',
    },
    previewCopy: {
      qualityProcessLabel: 'Quality verification process',
      qualitySteps: [
        { title: 'Requirement and specification confirmation', desc: 'Application, material, dimensions, colour and packing are confirmed before ordering.' },
        { title: 'Sample and supply verification', desc: 'Volume orders are compared with the approved sample and written specification.' },
        { title: 'Pre-shipment inspection', desc: 'Appearance, key dimensions, quantity and packing are checked against the agreed standard.' },
        { title: 'Packing and document review', desc: 'Packing method, shipping marks, quantities and dispatch documents are reviewed.' },
      ],
      productsPublishedLabel: 'Published products',
      productsFromCatalogue: 'Published sofa accessories are listed below — select one for details.',
      productsNoPublished:
        'The formal catalogue is being prepared. The main product categories are shown for now; contact us for specifications and a quotation for your project.',
      browseProducts: 'Browse all products',
      requestCatalogue: 'Request the product catalogue',
      inquirySubject: 'Sofa accessories inquiry',
      inquiryHint: 'Share the application, specification, quantity and destination so we can respond faster.',
    },
  },

  vi: {
    company: {
      name: sharedCompanyName,
      tagline: 'Chuyên phụ kiện sofa, giúp việc thu mua đơn giản hơn.',
      about:
        'Mizhong New Materials Co., Ltd. tập trung vào phụ kiện cho sofa và nội thất bọc nệm. Chúng tôi hỗ trợ lựa chọn sản phẩm, xác nhận thông số, theo dõi mẫu, điều phối nguồn cung, kiểm tra chất lượng và giao hàng.',
      positioning: 'Nhà cung cấp phụ kiện sofa và đối tác thu mua',
      seoTitle: 'Mizhong New Materials | Nhà cung cấp phụ kiện sofa',
      seoDescription:
        'Phụ kiện sofa và nội thất bọc nệm: đầu nối kim loại, hệ lò xo, dây đai đàn hồi, vải không dệt và dịch vụ điều phối thu mua.',
    },
    meta: {
      title: 'Nhà cung cấp phụ kiện sofa & đối tác thu mua',
      description: 'Hỗ trợ thu mua phụ kiện kim loại, lò xo, dây đai, vải không dệt và vật tư cho sofa.',
    },
    hero: {
      eyebrow: 'Nhà cung cấp phụ kiện sofa & đối tác thu mua',
      titleLine1: 'Phụ kiện sofa đáng tin cậy,',
      titleLine2: 'sẵn sàng cho mọi dự án.',
      subtitle:
        'Chúng tôi hỗ trợ thu mua đầu nối kim loại, hệ lò xo, dây đai đàn hồi, vải không dệt và vật tư liên quan — từ thông số, mẫu đến giao hàng.',
      ctaPrimary: 'Xem phạm vi sản phẩm',
      ctaSecondary: 'Gửi yêu cầu',
      mediaLabel: 'Minh họa vật liệu phụ kiện sofa',
    },
    capabilities: {
      eyebrow: 'Cách chúng tôi hỗ trợ',
      title: 'Quy trình rõ ràng từ yêu cầu đến giao hàng',
      subtitle: 'Điều phối lựa chọn sản phẩm, mẫu, kiểm tra chất lượng và chi tiết giao hàng.',
      items: [
        { title: 'Lựa chọn sản phẩm', desc: 'Đề xuất theo ứng dụng, vật liệu, kích thước và yêu cầu lắp ráp.' },
        { title: 'Nguồn cung ổn định', desc: 'Điều phối nhà cung cấp và tiến độ cho mẫu và đơn hàng số lượng lớn.' },
        { title: 'Kiểm tra chất lượng', desc: 'Kiểm tra trước khi xuất theo thông số, số lượng và yêu cầu đóng gói.' },
        { title: 'Điều phối xuất khẩu', desc: 'Phối hợp đóng gói, ký mã hiệu, chứng từ và giao hàng.' },
      ],
    },
    products: {
      eyebrow: 'Phạm vi sản phẩm',
      title: 'Danh mục phụ kiện sofa',
      subtitle: 'Danh mục đại diện. Liên hệ để xác nhận vật liệu, kích thước, đóng gói và MOQ.',
      categories: [
        { name: 'Kim khí & đầu nối sofa', desc: 'Chi tiết kim loại để nối, cố định, điều chỉnh và lắp ráp.' },
        { name: 'Lò xo & hệ đỡ', desc: 'Lò xo zigzag, kẹp và linh kiện đỡ cho mặt ngồi, tựa lưng.' },
        { name: 'Dây đai đàn hồi', desc: 'Vật liệu đàn hồi cho mặt ngồi, tựa lưng và kết cấu bọc nệm.' },
        { name: 'Vải không dệt & vải đáy', desc: 'Vật liệu cho đáy sofa, lớp lót và tấm che bụi.' },
        { name: 'Vật tư đệm & bọc', desc: 'Vật liệu hỗ trợ đệm, lót, bọc và hoàn thiện.' },
        { name: 'Vật tư đóng gói & lắp ráp', desc: 'Vật tư may, dán, bảo vệ và lắp ráp.' },
      ],
      cta: 'Yêu cầu danh mục sản phẩm',
    },
    supply: {
      eyebrow: 'Quy trình thu mua',
      title: 'Theo dõi rõ ràng từ thông số đến giao hàng',
      subtitle: 'Ứng dụng, thông số, mẫu và yêu cầu đóng gói đã xác nhận làm cơ sở cho mọi bước.',
      points: ['Xác nhận yêu cầu và vật liệu', 'Duyệt mẫu và thông số', 'Theo dõi đơn và kiểm tra trước xuất', 'Đóng gói, chứng từ và giao hàng'],
      mediaLabel: 'Minh họa vật liệu phụ kiện sofa',
    },
    quality: {
      eyebrow: 'Chất lượng & giao hàng',
      title: 'Kiểm tra chi tiết quan trọng trước khi xuất',
      subtitle: 'Vật liệu, kích thước, số lượng và đóng gói được đối chiếu với yêu cầu đã xác nhận.',
      principles: [
        { title: 'Chuẩn thông số', desc: 'Xác nhận vật liệu, kích thước, màu sắc và ứng dụng trước khi đặt.' },
        { title: 'Đồng nhất với mẫu', desc: 'Đơn số lượng lớn tuân theo mẫu duyệt và yêu cầu bằng văn bản.' },
        { title: 'Xác minh giao hàng', desc: 'Kiểm tra số lượng, đóng gói, ký mã hiệu và chứng từ.' },
      ],
      certificatesTitle: 'Tài liệu & tuân thủ',
      certificatesNote: 'Báo cáo thử nghiệm hoặc hồ sơ tuân thủ được cung cấp khi có cho sản phẩm đã chọn.',
      certificatesPlaceholder: 'Tài liệu — tùy khả năng cung cấp',
    },
    inquiry: {
      eyebrow: 'Liên hệ Mizhong',
      title: 'Bạn đang tìm phụ kiện sofa?',
      subtitle: 'Hãy cho biết ứng dụng, vật liệu, kích thước, số lượng và điểm đến để nhận lựa chọn, giá và thời gian giao.',
      cta: 'Gửi yêu cầu',
      emailLabel: 'Email',
      phoneLabel: 'Điện thoại',
      addressLabel: 'Địa chỉ',
      note: 'Liên hệ qua WhatsApp, email hoặc điện thoại.',
    },
    footer: {
      tagline: 'Phụ kiện sofa và nội thất bọc nệm, phù hợp với yêu cầu và kế hoạch giao hàng.',
      productsTitle: 'Phạm vi sản phẩm',
      companyTitle: 'Công ty',
      contactTitle: 'Liên hệ',
      copyright: 'Bảo lưu mọi quyền.',
      noContacts: 'Thông tin liên hệ sẽ sớm được cập nhật.',
    },
    preview: {
      scroll: 'Cuộn xuống',
      stage: 'Giai đoạn',
      artwork: 'Minh họa vật liệu và kết cấu phụ kiện sofa — đồ họa trang trí, không phải ảnh sản phẩm',
      channels: 'Kênh liên hệ trực tiếp',
    },
    previewCopy: {
      qualityProcessLabel: 'Quy trình xác minh chất lượng',
      qualitySteps: [
        { title: 'Xác nhận yêu cầu và thông số', desc: 'Xác nhận ứng dụng, vật liệu, kích thước, màu và đóng gói trước khi đặt.' },
        { title: 'Xác minh mẫu và nguồn cung', desc: 'Đối chiếu đơn số lượng lớn với mẫu duyệt và thông số bằng văn bản.' },
        { title: 'Kiểm tra trước khi xuất', desc: 'Kiểm tra ngoại quan, kích thước chính, số lượng và đóng gói.' },
        { title: 'Rà soát đóng gói và chứng từ', desc: 'Rà soát cách đóng gói, ký mã hiệu, số lượng và chứng từ.' },
      ],
      productsPublishedLabel: 'Sản phẩm đã đăng',
      productsFromCatalogue: 'Các phụ kiện sofa đã đăng được liệt kê dưới đây.',
      productsNoPublished: 'Danh mục chính thức đang được chuẩn bị. Hãy liên hệ để nhận thông số và báo giá.',
      browseProducts: 'Xem tất cả sản phẩm',
      requestCatalogue: 'Yêu cầu danh mục sản phẩm',
      inquirySubject: 'Yêu cầu phụ kiện sofa',
      inquiryHint: 'Gửi ứng dụng, thông số, số lượng và điểm đến để chúng tôi phản hồi nhanh hơn.',
    },
  },

  es: {
    company: {
      name: sharedCompanyName,
      tagline: 'Especialistas en accesorios para sofás y en una compra más sencilla.',
      about: 'Mizhong New Materials Co., Ltd. se especializa en accesorios para sofás y muebles tapizados. Apoyamos la selección, confirmación de especificaciones, muestras, coordinación de compras, control de calidad y envío.',
      positioning: 'Proveedor de accesorios para sofás y socio de aprovisionamiento',
      seoTitle: 'Mizhong New Materials | Accesorios para sofás',
      seoDescription: 'Herrajes, muelles, cinchas elásticas, telas no tejidas y otros accesorios para sofás con apoyo de aprovisionamiento.',
    },
    meta: { title: 'Proveedor de accesorios para sofás y socio de aprovisionamiento', description: 'Aprovisionamiento de herrajes, muelles, cinchas, telas no tejidas y materiales para sofás.' },
    hero: {
      eyebrow: 'Proveedor de accesorios para sofás y socio de aprovisionamiento',
      titleLine1: 'Accesorios fiables para sofás,',
      titleLine2: 'listos para cada proyecto.',
      subtitle: 'Ayudamos a adquirir herrajes, sistemas de muelles, cinchas elásticas, telas no tejidas y materiales relacionados, desde la especificación y la muestra hasta la entrega.',
      ctaPrimary: 'Ver gama de productos',
      ctaSecondary: 'Enviar consulta',
      mediaLabel: 'Estudio de materiales para sofás',
    },
    capabilities: {
      eyebrow: 'Cómo ayudamos',
      title: 'Un recorrido claro desde la necesidad hasta la entrega',
      subtitle: 'Coordinamos selección, muestras, controles de calidad y detalles de expedición.',
      items: [
        { title: 'Selección de producto', desc: 'Opciones según aplicación, material, medidas y montaje.' },
        { title: 'Suministro estable', desc: 'Coordinación de proveedores y plazos para muestras y pedidos.' },
        { title: 'Control de calidad', desc: 'Verificación previa al envío de especificaciones, cantidades y embalaje.' },
        { title: 'Coordinación de exportación', desc: 'Embalaje, marcas, documentos y expedición coordinados.' },
      ],
    },
    products: {
      eyebrow: 'Gama de productos',
      title: 'Categorías de accesorios para sofás',
      subtitle: 'Resumen representativo. Consúltenos para confirmar material, medidas, embalaje y pedido mínimo.',
      categories: [
        { name: 'Herrajes y conectores', desc: 'Piezas metálicas para unión, fijación, ajuste y montaje.' },
        { name: 'Muelles y sistemas de soporte', desc: 'Muelles zigzag, clips y soportes para asientos y respaldos.' },
        { name: 'Cinchas elásticas', desc: 'Soporte elástico para asientos, respaldos y estructuras tapizadas.' },
        { name: 'Telas no tejidas y guardapolvos', desc: 'Materiales para bases, forros y cubiertas antipolvo.' },
        { name: 'Materiales de relleno y tapizado', desc: 'Materiales auxiliares para acolchado, relleno, envoltura y acabado.' },
        { name: 'Embalaje y montaje', desc: 'Consumibles de costura, adhesión, protección y montaje.' },
      ],
      cta: 'Solicitar catálogo',
    },
    supply: {
      eyebrow: 'Proceso de compra',
      title: 'Cada paso visible, de la especificación a la entrega',
      subtitle: 'La aplicación, las especificaciones, las muestras y el embalaje confirmados guían todo el proceso.',
      points: ['Confirmación de requisitos y material', 'Aprobación de muestra y especificación', 'Seguimiento y control previo al envío', 'Embalaje, documentos y expedición'],
      mediaLabel: 'Estudio de materiales para sofás',
    },
    quality: {
      eyebrow: 'Calidad y entrega',
      title: 'Detalles clave revisados antes del envío',
      subtitle: 'Material, medidas, cantidad y embalaje se contrastan con los requisitos confirmados.',
      principles: [
        { title: 'Base de especificación', desc: 'Material, medidas, color y uso se confirman antes del pedido.' },
        { title: 'Coherencia con la muestra', desc: 'La producción sigue la muestra aprobada y los requisitos escritos.' },
        { title: 'Verificación de entrega', desc: 'Cantidad, embalaje, marcas y documentos se revisan antes de expedir.' },
      ],
      certificatesTitle: 'Documentos y conformidad',
      certificatesNote: 'Los informes o documentos se facilitan cuando están disponibles para el producto elegido.',
      certificatesPlaceholder: 'Documento — según disponibilidad',
    },
    inquiry: {
      eyebrow: 'Contactar con Mizhong',
      title: '¿Busca accesorios para sofás?',
      subtitle: 'Indique aplicación, material, medidas, cantidad y destino; responderemos con opciones, precio y plazo.',
      cta: 'Enviar consulta',
      emailLabel: 'Correo',
      phoneLabel: 'Teléfono',
      addressLabel: 'Dirección',
      note: 'Contáctenos por WhatsApp, correo o teléfono.',
    },
    footer: { tagline: 'Accesorios para sofás y muebles tapizados adaptados a sus requisitos y entrega.', productsTitle: 'Gama de productos', companyTitle: 'Empresa', contactTitle: 'Contacto', copyright: 'Todos los derechos reservados.', noContacts: 'Los datos de contacto se publicarán pronto.' },
    preview: { scroll: 'Desplazar', stage: 'Etapa', artwork: 'Estudio de materiales y estructura para sofás — gráfico decorativo, no fotografía', channels: 'Canales de contacto directo' },
    previewCopy: {
      qualityProcessLabel: 'Proceso de verificación de calidad',
      qualitySteps: [
        { title: 'Confirmación de requisitos', desc: 'Aplicación, material, medidas, color y embalaje se confirman antes del pedido.' },
        { title: 'Verificación de muestra y suministro', desc: 'El pedido se compara con la muestra aprobada y la especificación escrita.' },
        { title: 'Inspección previa al envío', desc: 'Se revisan apariencia, medidas clave, cantidad y embalaje.' },
        { title: 'Revisión de embalaje y documentos', desc: 'Se revisan embalaje, marcas, cantidades y documentos de expedición.' },
      ],
      productsPublishedLabel: 'Productos publicados',
      productsFromCatalogue: 'Los accesorios publicados aparecen a continuación.',
      productsNoPublished: 'El catálogo se está preparando. Contáctenos para especificaciones y cotización.',
      browseProducts: 'Ver todos los productos',
      requestCatalogue: 'Solicitar catálogo',
      inquirySubject: 'Consulta sobre accesorios para sofás',
      inquiryHint: 'Comparta aplicación, especificación, cantidad y destino para responder más rápido.',
    },
  },

  ja: {
    company: {
      name: sharedCompanyName,
      tagline: 'ソファ資材に特化し、調達をよりシンプルに。',
      about: 'Mizhong New Materials Co., Ltd. はソファ・アップホルスター家具用副資材を専門とし、製品選定、仕様確認、サンプル、調達調整、品質確認、出荷をサポートします。',
      positioning: 'ソファ副資材サプライヤー・調達パートナー',
      seoTitle: 'Mizhong New Materials｜ソファ副資材',
      seoDescription: '金具、スプリング、ウェビング、不織布などソファ用副資材の調達をサポート。',
    },
    meta: { title: 'ソファ副資材サプライヤー・調達パートナー', description: 'ソファ用金具、スプリング、ウェビング、不織布などの調達・納品支援。' },
    hero: {
      eyebrow: 'ソファ副資材サプライヤー・調達パートナー',
      titleLine1: '信頼できるソファ資材を、',
      titleLine2: 'あらゆるプロジェクトへ。',
      subtitle: '金具、スプリング支持材、エラスティックウェビング、不織布などを、仕様・サンプル確認から納品まで支援します。',
      ctaPrimary: '製品範囲を見る',
      ctaSecondary: 'お問い合わせ',
      mediaLabel: 'ソファ資材イメージ',
    },
    capabilities: {
      eyebrow: 'サポート内容',
      title: '要件から納品までを明確に',
      subtitle: '製品選定、サンプル、品質確認、出荷情報を調整します。',
      items: [
        { title: '製品マッチング', desc: '用途、素材、寸法、組立要件に合わせて選定。' },
        { title: '安定調達', desc: 'サンプルと量産の仕入先・納期を調整。' },
        { title: '品質確認', desc: '仕様、数量、梱包要件に基づき出荷前に確認。' },
        { title: '輸出調整', desc: '梱包、マーク、書類、発送情報を調整。' },
      ],
    },
    products: {
      eyebrow: '製品範囲',
      title: 'ソファ副資材カテゴリー',
      subtitle: '代表例です。素材、寸法、梱包、最小ロットはお問い合わせください。',
      categories: [
        { name: 'ソファ金具・連結部品', desc: '連結、固定、調整、組立用金属部品。' },
        { name: 'スプリング・支持システム', desc: 'ジグザグスプリング、クリップ、座面・背面支持部品。' },
        { name: 'エラスティックウェビング', desc: '座面、背面、アップホルスター構造用支持材。' },
        { name: '不織布・底張り材', desc: 'ソファ底部、ライナー、防塵カバー用。' },
        { name: 'パッディング・張り資材', desc: 'クッション、充填、包装、仕上げ用資材。' },
        { name: '梱包・組立資材', desc: '縫製、接着、保護梱包、組立用消耗品。' },
      ],
      cta: '製品カタログを依頼',
    },
    supply: {
      eyebrow: '調達プロセス',
      title: '仕様から納品まで、全行程を明確に',
      subtitle: '確認済みの用途、仕様、サンプル、梱包要件に基づき進行します。',
      points: ['要件・素材確認', 'サンプル・仕様承認', '進捗・出荷前確認', '梱包・書類・発送'],
      mediaLabel: 'ソファ資材イメージ',
    },
    quality: {
      eyebrow: '品質・納品',
      title: '出荷前に重要事項を確認',
      subtitle: '素材、寸法、数量、梱包を確定要件と照合します。',
      principles: [
        { title: '仕様基準', desc: '発注前に素材、寸法、色、用途を確認。' },
        { title: 'サンプルとの一致', desc: '承認サンプルと書面要件に準拠。' },
        { title: '納品確認', desc: '数量、梱包、マーク、書類を発送前に確認。' },
      ],
      certificatesTitle: '書類・適合性',
      certificatesNote: '選定製品で提供可能な試験報告や適合性書類をご案内します。',
      certificatesPlaceholder: '書類—提供可否による',
    },
    inquiry: {
      eyebrow: 'Mizhong へのお問い合わせ',
      title: 'ソファ副資材をお探しですか？',
      subtitle: '用途、素材、寸法、数量、仕向地をお知らせください。候補、価格、納期を回答します。',
      cta: 'お問い合わせ',
      emailLabel: 'メール',
      phoneLabel: '電話',
      addressLabel: '住所',
      note: 'WhatsApp、メール、電話でご連絡ください。',
    },
    footer: { tagline: 'ソファ・アップホルスター家具用副資材をご要望と納品計画に合わせて提案。', productsTitle: '製品範囲', companyTitle: '会社', contactTitle: 'お問い合わせ', copyright: '無断転載禁止。', noContacts: '連絡先は近日公開します。' },
    preview: { scroll: 'スクロール', stage: '段階', artwork: 'ソファ資材の素材・構造イメージ—装飾図形であり製品写真ではありません', channels: '直接連絡先' },
    previewCopy: {
      qualityProcessLabel: '品質確認プロセス',
      qualitySteps: [
        { title: '要件・仕様確認', desc: '用途、素材、寸法、色、梱包を発注前に確認。' },
        { title: 'サンプル・供給確認', desc: '量産品を承認サンプルと書面仕様に照合。' },
        { title: '出荷前検品', desc: '外観、主要寸法、数量、梱包を確認。' },
        { title: '梱包・書類確認', desc: '梱包方法、マーク、数量、発送書類を確認。' },
      ],
      productsPublishedLabel: '公開中の製品',
      productsFromCatalogue: '公開中のソファ副資材です。',
      productsNoPublished: '正式カタログを準備中です。仕様とお見積りはお問い合わせください。',
      browseProducts: 'すべての製品を見る',
      requestCatalogue: '製品カタログを依頼',
      inquirySubject: 'ソファ副資材のお問い合わせ',
      inquiryHint: '用途、仕様、数量、仕向地をお知らせください。',
    },
  },

  ru: {
    company: {
      name: sharedCompanyName,
      tagline: 'Фурнитура для диванов и простая организация закупок.',
      about: 'Mizhong New Materials Co., Ltd. специализируется на комплектующих для диванов и мягкой мебели. Мы помогаем с подбором, спецификациями, образцами, контролем качества и отгрузкой.',
      positioning: 'Поставщик фурнитуры для диванов и партнёр по закупкам',
      seoTitle: 'Mizhong New Materials | Фурнитура для диванов',
      seoDescription: 'Металлофурнитура, пружины, эластичные ленты, нетканые материалы и поддержка закупок.',
    },
    meta: { title: 'Поставщик фурнитуры для диванов', description: 'Закупка фурнитуры, пружин, лент, нетканых материалов и комплектующих для диванов.' },
    hero: {
      eyebrow: 'Поставщик фурнитуры для диванов',
      titleLine1: 'Надёжные комплектующие,',
      titleLine2: 'готовые к вашему проекту.',
      subtitle: 'Помогаем закупать крепёж, пружинные системы, эластичные ленты, нетканые материалы — от спецификации до поставки.',
      ctaPrimary: 'Продукты',
      ctaSecondary: 'Отправить запрос',
      mediaLabel: 'Материалы для диванов',
    },
    capabilities: {
      eyebrow: 'Наша поддержка',
      title: 'Понятный путь от задачи до поставки',
      subtitle: 'Подбор, образцы, контроль качества и отгрузка.',
      items: [
        { title: 'Подбор изделий', desc: 'Подбор по назначению, материалу, размерам и монтажу.' },
        { title: 'Стабильное снабжение', desc: 'Координация поставщиков и сроков для образцов и партий.' },
        { title: 'Контроль качества', desc: 'Проверка спецификаций, количества и упаковки перед отгрузкой.' },
        { title: 'Экспортная координация', desc: 'Упаковка, маркировка, документы и отправка.' },
      ],
    },
    products: {
      eyebrow: 'Ассортимент',
      title: 'Категории фурнитуры для диванов',
      subtitle: 'Обзор категорий. Уточняйте материал, размеры, упаковку и MOQ.',
      categories: [
        { name: 'Металлофурнитура и соединители', desc: 'Детали для соединения, фиксации, регулировки и сборки.' },
        { name: 'Пружины и системы поддержки', desc: 'Зигзагообразные пружины, клипсы и опоры.' },
        { name: 'Эластичные ленты', desc: 'Эластичная опора для сидений, спинок и мягких каркасов.' },
        { name: 'Нетканые материалы', desc: 'Материалы для оснований, подкладок и пылезащиты.' },
        { name: 'Набивка и обивочные материалы', desc: 'Материалы для амортизации, набивки, оборачивания и отделки.' },
        { name: 'Упаковка и сборка', desc: 'Швейные, клеевые, защитные и сборочные материалы.' },
      ],
      cta: 'Запросить каталог',
    },
    supply: {
      eyebrow: 'Процесс закупки',
      title: 'Все этапы видны — от спецификации до поставки',
      subtitle: 'Подтверждённые назначение, спецификации, образцы и упаковка задают процесс.',
      points: ['Требования и материал', 'Образец и спецификация', 'Сопровождение и проверка', 'Упаковка, документы, отгрузка'],
      mediaLabel: 'Материалы для диванов',
    },
    quality: {
      eyebrow: 'Качество и поставка',
      title: 'Ключевые детали проверяются до отгрузки',
      subtitle: 'Материал, размеры, количество и упаковка сверяются с заказом.',
      principles: [
        { title: 'Базовая спецификация', desc: 'Материал, размеры, цвет и назначение согласуются до заказа.' },
        { title: 'Соответствие образцу', desc: 'Партия следует утверждённому образцу и требованиям.' },
        { title: 'Проверка поставки', desc: 'До отправки проверяются количество, упаковка, маркировка и документы.' },
      ],
      certificatesTitle: 'Документы и соответствие',
      certificatesNote: 'Отчёты и документы предоставляются, если они доступны для выбранного изделия.',
      certificatesPlaceholder: 'Документ — по наличию',
    },
    inquiry: {
      eyebrow: 'Связаться с Mizhong',
      title: 'Ищете фурнитуру для диванов?',
      subtitle: 'Укажите назначение, материал, размеры, количество и адрес доставки.',
      cta: 'Отправить запрос',
      emailLabel: 'Email',
      phoneLabel: 'Телефон',
      addressLabel: 'Адрес',
      note: 'Свяжитесь через WhatsApp, email или по телефону.',
    },
    footer: { tagline: 'Фурнитура для диванов и мягкой мебели под ваши требования.', productsTitle: 'Ассортимент', companyTitle: 'Компания', contactTitle: 'Контакты', copyright: 'Все права защищены.', noContacts: 'Контакты будут опубликованы позже.' },
    preview: { scroll: 'Прокрутка', stage: 'Этап', artwork: 'Материал и структура фурнитуры — декоративная графика, не фото', channels: 'Прямые каналы связи' },
    previewCopy: {
      qualityProcessLabel: 'Процесс проверки качества',
      qualitySteps: [
        { title: 'Требования и спецификация', desc: 'Назначение, материал, размеры, цвет и упаковка согласуются заранее.' },
        { title: 'Образец и поставка', desc: 'Партия сверяется с образцом и письменной спецификацией.' },
        { title: 'Проверка перед отгрузкой', desc: 'Проверяются внешний вид, размеры, количество и упаковка.' },
        { title: 'Упаковка и документы', desc: 'Проверяются упаковка, маркировка, количество и документы.' },
      ],
      productsPublishedLabel: 'Опубликованные товары',
      productsFromCatalogue: 'Опубликованная фурнитура представлена ниже.',
      productsNoPublished: 'Каталог готовится. Запросите спецификацию и цену.',
      browseProducts: 'Все товары',
      requestCatalogue: 'Запросить каталог',
      inquirySubject: 'Запрос на фурнитуру для диванов',
      inquiryHint: 'Укажите назначение, спецификацию, количество и адрес доставки.',
    },
  },

  ar: {
    company: {
      name: sharedCompanyName,
      tagline: 'نتخصص في مستلزمات الأرائك لتكون عملية التوريد أسهل.',
      about: 'تتخصص Mizhong New Materials Co., Ltd. في مستلزمات الأرائك والأثاث المنجد. ندعم اختيار المنتج، وتأكيد المواصفات، والعينات، والتوريد، وفحص الجودة، والشحن.',
      positioning: 'مورّد مستلزمات الأرائك وشريك التوريد',
      seoTitle: 'Mizhong New Materials | مستلزمات الأرائك',
      seoDescription: 'موصلات معدنية، ويانابيع، وأشرطة مرنة، وأقمشة غير منسوجة وخدمات توريد.',
    },
    meta: { title: 'مورّد مستلزمات الأرائك وشريك التوريد', description: 'دعم توريد القطع المعدنية والنوابض والأشرطة والأقمشة للأرائك.' },
    hero: {
      eyebrow: 'مورّد مستلزمات الأرائك وشريك التوريد',
      titleLine1: 'مستلزمات موثوقة للأرائك،',
      titleLine2: 'جاهزة لكل مشروع.',
      subtitle: 'نساعد في توريد الموصلات المعدنية، وأنظمة النوابض، والأشرطة المرنة، والأقمشة غير المنسوجة من المواصفة حتى التسليم.',
      ctaPrimary: 'استكشف المنتجات',
      ctaSecondary: 'أرسل استفساراً',
      mediaLabel: 'دراسة مواد الأرائك',
    },
    capabilities: {
      eyebrow: 'كيف نساعد',
      title: 'مسار واضح من المتطلبات إلى التسليم',
      subtitle: 'ننسّق اختيار المنتج، والعينات، وفحص الجودة، والشحن.',
      items: [
        { title: 'مطابقة المنتج', desc: 'خيارات حسب الاستخدام والمادة والأبعاد والتجميع.' },
        { title: 'توريد مستقر', desc: 'تنسيق الموردين والمهل للعينات والطلبيات.' },
        { title: 'فحص الجودة', desc: 'فحص قبل الشحن حسب المواصفات والكميات والتعبئة.' },
        { title: 'تنسيق التصدير', desc: 'تنسيق التعبئة والعلامات والوثائق والإرسال.' },
      ],
    },
    products: {
      eyebrow: 'نطاق المنتجات',
      title: 'فئات مستلزمات الأرائك',
      subtitle: 'نظرة تمثيلية. تواصل معنا لتأكيد المادة والأبعاد والتعبئة والحد الأدنى.',
      categories: [
        { name: 'قطع معدنية وموصلات', desc: 'للربط والتثبيت والضبط والتجميع.' },
        { name: 'نوابض وأنظمة دعم', desc: 'نوابض متعرجة، مشابك ومكونات دعم للمقاعد والظهر.' },
        { name: 'أشرطة مرنة', desc: 'دعم مرن للمقاعد والظهر والهياكل المنجدة.' },
        { name: 'أقمشة غير منسوجة وأغطية غبار', desc: 'لقواعد الأرائك والبطانات وأغطية الغبار.' },
        { name: 'مواد الحشو والتنجيد', desc: 'للتوسيد والحشو والتغليف والتشطيب.' },
        { name: 'مستلزمات التعبئة والتجميع', desc: 'مستهلكات الخياطة واللصق والحماية والتجميع.' },
      ],
      cta: 'اطلب الكتالوج',
    },
    supply: {
      eyebrow: 'عملية التوريد',
      title: 'وضوح كل خطوة من المواصفة إلى التسليم',
      subtitle: 'توجّه التطبيقات والمواصفات والعينات والتعبئة المؤكدة جميع الخطوات.',
      points: ['تأكيد المتطلبات والمادة', 'اعتماد العينة والمواصفة', 'متابعة الطلب وفحص ما قبل الشحن', 'التعبئة والوثائق والإرسال'],
      mediaLabel: 'دراسة مواد الأرائك',
    },
    quality: {
      eyebrow: 'الجودة والتسليم',
      title: 'فحص التفاصيل الأساسية قبل الشحن',
      subtitle: 'تتم مطابقة المادة والأبعاد والكمية والتعبئة مع متطلبات الطلب.',
      principles: [
        { title: 'خط أساس للمواصفة', desc: 'تأكيد المادة والأبعاد واللون والاستخدام قبل الطلب.' },
        { title: 'التطابق مع العينة', desc: 'تتبع الطلبيات الكمية العينة المعتمدة والمتطلبات المكتوبة.' },
        { title: 'التحقق من التسليم', desc: 'فحص الكمية والتعبئة وعلامات الشحن والوثائق.' },
      ],
      certificatesTitle: 'الوثائق والامتثال',
      certificatesNote: 'تُقدم تقارير الاختبار أو وثائق الامتثال عند توفرها للمنتج.',
      certificatesPlaceholder: 'وثيقة — حسب التوفر',
    },
    inquiry: {
      eyebrow: 'تواصل مع Mizhong',
      title: 'هل تبحث عن مستلزمات للأرائك؟',
      subtitle: 'أرسل لنا الاستخدام والمادة والأبعاد والكمية والوجهة لنرد بالخيارات والسعر والمهلة.',
      cta: 'إرسال استفسار',
      emailLabel: 'البريد',
      phoneLabel: 'الهاتف',
      addressLabel: 'العنوان',
      note: 'تواصل عبر WhatsApp أو البريد أو الهاتف.',
    },
    footer: { tagline: 'مستلزمات للأرائك والأثاث المنجد وفق متطلباتك وخطة التسليم.', productsTitle: 'نطاق المنتجات', companyTitle: 'الشركة', contactTitle: 'التواصل', copyright: 'جميع الحقوق محفوظة.', noContacts: 'ستُنشر بيانات الاتصال قريبًا.' },
    preview: { scroll: 'تمرير', stage: 'مرحلة', artwork: 'دراسة لمواد وهيكل مستلزمات الأرائك — رسم زخرفي وليس صورة', channels: 'قنوات اتصال مباشرة' },
    previewCopy: {
      qualityProcessLabel: 'عملية التحقق من الجودة',
      qualitySteps: [
        { title: 'تأكيد المتطلبات', desc: 'تأكيد الاستخدام والمادة والأبعاد واللون والتعبئة.' },
        { title: 'التحقق من العينة والتوريد', desc: 'مقارنة الطلبية بالعينة المعتمدة والمواصفة.' },
        { title: 'فحص ما قبل الشحن', desc: 'فحص المظهر والأبعاد والكمية والتعبئة.' },
        { title: 'مراجعة التعبئة والوثائق', desc: 'مراجعة التعبئة والعلامات والكميات ووثائق الشحن.' },
      ],
      productsPublishedLabel: 'منتجات منشورة',
      productsFromCatalogue: 'مستلزمات الأرائك المنشورة مدرجة أدناه.',
      productsNoPublished: 'الكتالوج قيد الإعداد. تواصل معنا للمواصفات وعرض السعر.',
      browseProducts: 'كل المنتجات',
      requestCatalogue: 'اطلب الكتالوج',
      inquirySubject: 'استفسار عن مستلزمات الأرائك',
      inquiryHint: 'أرسل الاستخدام والمواصفة والكمية والوجهة لرد أسرع.',
    },
  },

  fr: {
    company: {
      name: sharedCompanyName,
      tagline: 'Spécialiste des accessoires de canapé pour un approvisionnement plus simple.',
      about: 'Mizhong New Materials Co., Ltd. se consacre aux accessoires pour canapés et meubles rembourrés. Nous accompagnons la sélection, les spécifications, les échantillons, les achats, les contrôles qualité et l’expédition.',
      positioning: 'Fournisseur d’accessoires de canapé et partenaire d’approvisionnement',
      seoTitle: 'Mizhong New Materials | Accessoires de canapé',
      seoDescription: 'Connecteurs, ressorts, sangles élastiques, non-tissés et autres accessoires pour canapés avec coordination des achats.',
    },
    meta: { title: 'Fournisseur d’accessoires de canapé et partenaire d’approvisionnement', description: 'Approvisionnement en quincaillerie, ressorts, sangles, non-tissés et fournitures pour canapés.' },
    hero: {
      eyebrow: 'Fournisseur d’accessoires de canapé et partenaire d’approvisionnement',
      titleLine1: 'Des accessoires de canapé fiables,',
      titleLine2: 'prêts pour chaque projet.',
      subtitle: 'Nous facilitons l’achat de connecteurs, ressorts, sangles élastiques, non-tissés et fournitures associées, de la spécification à la livraison.',
      ctaPrimary: 'Voir la gamme',
      ctaSecondary: 'Envoyer une demande',
      mediaLabel: 'Etude de matériaux pour canapés',
    },
    capabilities: {
      eyebrow: 'Notre accompagnement',
      title: 'Un parcours clair du besoin à la livraison',
      subtitle: 'Sélection, échantillons, contrôles qualité et expédition coordonnés.',
      items: [
        { title: 'Sélection produit', desc: 'Options adaptées à l’usage, la matière, les dimensions et l’assemblage.' },
        { title: 'Approvisionnement stable', desc: 'Coordination des fournisseurs et des délais pour échantillons et commandes.' },
        { title: 'Contrôles qualité', desc: 'Vérification avant expédition des spécifications, quantités et emballages.' },
        { title: 'Coordination export', desc: 'Emballage, marquage, documents et expédition coordonnés.' },
      ],
    },
    products: {
      eyebrow: 'Gamme de produits',
      title: 'Catégories d’accessoires de canapé',
      subtitle: 'Aperçu représentatif. Contactez-nous pour la matière, les dimensions, l’emballage et le minimum de commande.',
      categories: [
        { name: 'Quincaillerie et connecteurs', desc: 'Pièces métalliques pour liaison, fixation, réglage et assemblage.' },
        { name: 'Ressorts et systèmes de soutien', desc: 'Ressorts zigzag, clips et composants pour assises et dossiers.' },
        { name: 'Sangles élastiques', desc: 'Soutien élastique pour assises, dossiers et structures rembourrées.' },
        { name: 'Non-tissés et cache-poussière', desc: 'Matériaux pour bases, doublures et dessous de canapé.' },
        { name: 'Rembourrage et fournitures', desc: 'Matériaux auxiliaires de rembourrage, garnissage, enveloppe et finition.' },
        { name: 'Emballage et assemblage', desc: 'Consommables de couture, collage, protection et assemblage.' },
      ],
      cta: 'Demander le catalogue',
    },
    supply: {
      eyebrow: 'Processus d’achat',
      title: 'Chaque étape visible, de la spécification à la livraison',
      subtitle: 'Applications, spécifications, échantillons et emballages confirmés guident le processus.',
      points: ['Confirmation du besoin et de la matière', 'Validation de l’échantillon et des spécifications', 'Suivi et contrôle avant expédition', 'Emballage, documents et envoi'],
      mediaLabel: 'Etude de matériaux pour canapés',
    },
    quality: {
      eyebrow: 'Qualité et livraison',
      title: 'Les détails essentiels sont contrôlés avant l’expédition',
      subtitle: 'Matière, dimensions, quantité et emballage sont comparés aux exigences confirmées.',
      principles: [
        { title: 'Base de spécification', desc: 'Matière, dimensions, couleur et usage sont confirmés avant commande.' },
        { title: 'Conformité à l’échantillon', desc: 'Les commandes suivent l’échantillon validé et les exigences écrites.' },
        { title: 'Vérification de livraison', desc: 'Quantité, emballage, marquage et documents sont contrôlés.' },
      ],
      certificatesTitle: 'Documents et conformité',
      certificatesNote: 'Les rapports ou documents de conformité sont fournis lorsqu’ils sont disponibles pour le produit choisi.',
      certificatesPlaceholder: 'Document — selon disponibilité',
    },
    inquiry: {
      eyebrow: 'Contacter Mizhong',
      title: 'Vous recherchez des accessoires de canapé ?',
      subtitle: 'Indiquez l’usage, la matière, les dimensions, la quantité et la destination pour recevoir options, prix et délai.',
      cta: 'Envoyer une demande',
      emailLabel: 'E-mail',
      phoneLabel: 'Téléphone',
      addressLabel: 'Adresse',
      note: 'Contactez-nous par WhatsApp, e-mail ou téléphone.',
    },
    footer: { tagline: 'Accessoires pour canapés et meubles rembourrés adaptés à vos besoins et à votre livraison.', productsTitle: 'Gamme de produits', companyTitle: 'Entreprise', contactTitle: 'Contact', copyright: 'Tous droits réservés.', noContacts: 'Les coordonnées seront publiées prochainement.' },
    preview: { scroll: 'Défiler', stage: 'Étape', artwork: 'Étude de matériaux et de structure pour canapé — illustration décorative, pas une photo', channels: 'Canaux de contact direct' },
    previewCopy: {
      qualityProcessLabel: 'Processus de vérification qualité',
      qualitySteps: [
        { title: 'Confirmation des exigences', desc: 'Usage, matière, dimensions, couleur et emballage sont confirmés avant commande.' },
        { title: 'Vérification de l’échantillon', desc: 'La commande est comparée à l’échantillon validé et à la spécification.' },
        { title: 'Contrôle avant expédition', desc: 'Aspect, dimensions clés, quantité et emballage sont contrôlés.' },
        { title: 'Revue emballage et documents', desc: 'Emballage, marquage, quantités et documents d’expédition sont revus.' },
      ],
      productsPublishedLabel: 'Produits publiés',
      productsFromCatalogue: 'Les accessoires publiés figurent ci-dessous.',
      productsNoPublished: 'Le catalogue est en préparation. Contactez-nous pour les spécifications et un devis.',
      browseProducts: 'Voir tous les produits',
      requestCatalogue: 'Demander le catalogue',
      inquirySubject: 'Demande d’accessoires de canapé',
      inquiryHint: 'Indiquez usage, spécification, quantité et destination pour une réponse rapide.',
    },
  },

  ko: {
    company: {
      name: sharedCompanyName,
      tagline: '소파 부자재에 전문성을 더해 조달을 더 간단하게.',
      about: 'Mizhong New Materials Co., Ltd.는 소파와 스터프 가구용 부자재를 전문으로 합니다. 제품 선정, 사양 확인, 샘플, 조달 조정, 품질 확인과 출하를 지원합니다.',
      positioning: '소파 부자재 공급 및 조달 파트너',
      seoTitle: 'Mizhong New Materials | 소파 부자재',
      seoDescription: '금속 연결구, 스프링, 탄성 웨빙, 부직포 등 소파 부자재와 조달 지원.',
    },
    meta: { title: '소파 부자재 공급 및 조달 파트너', description: '소파용 금속 부품, 스프링, 웨빙, 부직포 등의 조달과 납품 지원.' },
    hero: {
      eyebrow: '소파 부자재 공급 및 조달 파트너',
      titleLine1: '믿을 수 있는 소파 부자재,',
      titleLine2: '모든 프로젝트를 위해 준비합니다.',
      subtitle: '금속 연결구, 스프링 지지재, 탄성 웨빙, 부직포 등을 사양과 샘플 확인부터 납품까지 지원합니다.',
      ctaPrimary: '제품 범위 보기',
      ctaSecondary: '문의하기',
      mediaLabel: '소파 부자재 소재 이미지',
    },
    capabilities: {
      eyebrow: '지원 방식',
      title: '요구사항에서 납품까지 명확하게',
      subtitle: '제품 선정, 샘플, 품질 확인과 출하 상세를 조정합니다.',
      items: [
        { title: '제품 매칭', desc: '용도, 소재, 치수와 조립 요구사항에 맞춰 선정합니다.' },
        { title: '안정적인 조달', desc: '샘플과 대량 주문의 공급처와 납기를 조정합니다.' },
        { title: '품질 확인', desc: '사양, 수량과 포장 요구사항에 따라 출하 전 확인합니다.' },
        { title: '수출 조정', desc: '포장, 마크, 서류와 발송 정보를 조정합니다.' },
      ],
    },
    products: {
      eyebrow: '제품 범위',
      title: '소파 부자재 카테고리',
      subtitle: '대표적인 범위입니다. 소재, 치수, 포장과 최소 주문량은 문의해 주세요.',
      categories: [
        { name: '소파 금속 부품과 연결구', desc: '연결, 고정, 조정과 조립용 금속 부품.' },
        { name: '스프링과 지지 시스템', desc: '지그재그 스프링, 클립과 좌면·등받이 지지 부품.' },
        { name: '탄성 웨빙과 테이프', desc: '좌면, 등받이와 스터프 구조용 탄성 지지재.' },
        { name: '부직포와 방진천', desc: '소파 바닥, 내장재와 방진 커버용 소재.' },
        { name: '충전과 스터프 부자재', desc: '쿠션, 충전, 감싸기와 마감을 위한 소재.' },
        { name: '포장과 조립 부자재', desc: '재봉, 접착, 보호 포장과 조립용 소모품.' },
      ],
      cta: '제품 카탈로그 요청',
    },
    supply: {
      eyebrow: '조달 프로세스',
      title: '사양에서 납품까지 모든 단계를 투명하게',
      subtitle: '확인된 용도, 사양, 샘플과 포장 요구사항을 기준으로 진행합니다.',
      points: ['요구사항과 소재 확인', '샘플과 사양 승인', '주문 추적과 출하 전 확인', '포장, 서류와 발송'],
      mediaLabel: '소파 부자재 소재 이미지',
    },
    quality: {
      eyebrow: '품질과 납품',
      title: '출하 전 핵심 상세를 확인합니다',
      subtitle: '소재, 치수, 수량과 포장을 확인된 요구사항과 비교합니다.',
      principles: [
        { title: '사양 기준', desc: '주문 전 소재, 치수, 색상과 용도를 확인합니다.' },
        { title: '샘플 일치성', desc: '대량 주문은 승인된 샘플과 서면 요구사항을 따릅니다.' },
        { title: '납품 검증', desc: '수량, 포장, 운송 마크와 서류를 발송 전 확인합니다.' },
      ],
      certificatesTitle: '서류와 준수',
      certificatesNote: '선택한 제품에 대한 시험 보고서 또는 준수 서류가 있는 경우 제공합니다.',
      certificatesPlaceholder: '서류 — 제공 가능 여부',
    },
    inquiry: {
      eyebrow: 'Mizhong 문의',
      title: '소파 부자재를 찾고 계십니까?',
      subtitle: '용도, 소재, 치수, 수량과 목적지를 알려주시면 적합한 옵션, 가격과 납기를 회신합니다.',
      cta: '문의하기',
      emailLabel: '이메일',
      phoneLabel: '전화',
      addressLabel: '주소',
      note: 'WhatsApp, 이메일 또는 전화로 연락해 주세요.',
    },
    footer: { tagline: '요구사항과 납품 계획에 맞춘 소파와 스터프 가구 부자재.', productsTitle: '제품 범위', companyTitle: '회사', contactTitle: '연락처', copyright: '모든 권리 보유.', noContacts: '연락처를 곧 공개합니다.' },
    preview: { scroll: '스크롤', stage: '단계', artwork: '소파 부자재 소재와 구조 이미지 — 장식 그래픽이며 제품 사진이 아닙니다', channels: '직접 연락 채널' },
    previewCopy: {
      qualityProcessLabel: '품질 검증 프로세스',
      qualitySteps: [
        { title: '요구사항과 사양 확인', desc: '주문 전 용도, 소재, 치수, 색상과 포장을 확인합니다.' },
        { title: '샘플과 공급 검증', desc: '대량 주문을 승인 샘플과 서면 사양에 비교합니다.' },
        { title: '출하 전 검사', desc: '외관, 주요 치수, 수량과 포장을 확인합니다.' },
        { title: '포장과 서류 검토', desc: '포장, 마크, 수량과 발송 서류를 검토합니다.' },
      ],
      productsPublishedLabel: '게시된 제품',
      productsFromCatalogue: '게시된 소파 부자재입니다.',
      productsNoPublished: '정식 카탈로그를 준비 중입니다. 사양과 견적은 문의해 주세요.',
      browseProducts: '전체 제품 보기',
      requestCatalogue: '제품 카탈로그 요청',
      inquirySubject: '소파 부자재 문의',
      inquiryHint: '용도, 사양, 수량과 목적지를 알려주세요.',
    },
  },

  pt: {
    company: {
      name: sharedCompanyName,
      tagline: 'Especialistas em acessórios para sofás e em compras mais simples.',
      about: 'A Mizhong New Materials Co., Ltd. dedica-se a acessórios para sofás e móveis estofados. Apoiamos seleção, especificações, amostras, coordenação de compras, verificações de qualidade e expedição.',
      positioning: 'Fornecedor de acessórios para sofás e parceiro de sourcing',
      seoTitle: 'Mizhong New Materials | Acessórios para sofás',
      seoDescription: 'Conectores, molas, percintas elásticas, não tecidos e outros acessórios para sofás com apoio de sourcing.',
    },
    meta: { title: 'Fornecedor de acessórios para sofás e parceiro de sourcing', description: 'Sourcing de ferragens, molas, percintas, não tecidos e materiais para sofás.' },
    hero: {
      eyebrow: 'Fornecedor de acessórios para sofás e parceiro de sourcing',
      titleLine1: 'Acessórios confiáveis para sofás,',
      titleLine2: 'prontos para cada projeto.',
      subtitle: 'Ajudamos a adquirir conectores, sistemas de molas, percintas elásticas, não tecidos e materiais relacionados, da especificação à entrega.',
      ctaPrimary: 'Ver gama de produtos',
      ctaSecondary: 'Enviar consulta',
      mediaLabel: 'Estudo de materiais para sofás',
    },
    capabilities: {
      eyebrow: 'Como ajudamos',
      title: 'Um caminho claro da necessidade à entrega',
      subtitle: 'Coordenamos seleção, amostras, qualidade e expedição.',
      items: [
        { title: 'Seleção de produto', desc: 'Opções conforme aplicação, material, dimensões e montagem.' },
        { title: 'Fornecimento estável', desc: 'Coordenação de fornecedores e prazos para amostras e encomendas.' },
        { title: 'Verificações de qualidade', desc: 'Conferência pré-embarque de especificações, quantidades e embalagem.' },
        { title: 'Coordenação de exportação', desc: 'Embalagem, marcações, documentos e expedição coordenados.' },
      ],
    },
    products: {
      eyebrow: 'Gama de produtos',
      title: 'Categorias de acessórios para sofás',
      subtitle: 'Visão representativa. Contacte-nos para material, dimensões, embalagem e MOQ.',
      categories: [
        { name: 'Ferragens e conectores', desc: 'Peças metálicas para união, fixação, ajuste e montagem.' },
        { name: 'Molas e sistemas de suporte', desc: 'Molas zigzag, grampos e suportes para assentos e encostos.' },
        { name: 'Percintas elásticas', desc: 'Suporte elástico para assentos, encostos e estruturas estofadas.' },
        { name: 'Não tecidos e guarda-pó', desc: 'Materiais para bases, forros e coberturas contra pó.' },
        { name: 'Enchimento e estofamento', desc: 'Materiais auxiliares para amortecimento, enchimento, envolvimento e acabamento.' },
        { name: 'Embalagem e montagem', desc: 'Consumíveis de costura, colagem, proteção e montagem.' },
      ],
      cta: 'Solicitar catálogo',
    },
    supply: {
      eyebrow: 'Processo de sourcing',
      title: 'Cada etapa visível, da especificação à entrega',
      subtitle: 'Aplicações, especificações, amostras e embalagem confirmadas orientam o processo.',
      points: ['Confirmação de requisitos e material', 'Aprovação de amostra e especificação', 'Acompanhamento e verificação pré-embarque', 'Embalagem, documentos e expedição'],
      mediaLabel: 'Estudo de materiais para sofás',
    },
    quality: {
      eyebrow: 'Qualidade e entrega',
      title: 'Detalhes importantes verificados antes do embarque',
      subtitle: 'Material, dimensões, quantidade e embalagem são comparados aos requisitos confirmados.',
      principles: [
        { title: 'Base de especificação', desc: 'Material, dimensões, cor e aplicação confirmados antes da encomenda.' },
        { title: 'Consistência com a amostra', desc: 'Encomendas seguem a amostra aprovada e os requisitos escritos.' },
        { title: 'Verificação de entrega', desc: 'Quantidade, embalagem, marcações e documentos verificados antes do envio.' },
      ],
      certificatesTitle: 'Documentos e conformidade',
      certificatesNote: 'Relatórios ou documentos são fornecidos quando disponíveis para o produto selecionado.',
      certificatesPlaceholder: 'Documento — sujeito a disponibilidade',
    },
    inquiry: {
      eyebrow: 'Contactar a Mizhong',
      title: 'Procura acessórios para sofás?',
      subtitle: 'Informe aplicação, material, dimensões, quantidade e destino para receber opções, preço e prazo.',
      cta: 'Enviar consulta',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefone',
      addressLabel: 'Endereço',
      note: 'Contacte-nos por WhatsApp, e-mail ou telefone.',
    },
    footer: { tagline: 'Acessórios para sofás e móveis estofados adequados aos seus requisitos e entrega.', productsTitle: 'Gama de produtos', companyTitle: 'Empresa', contactTitle: 'Contacto', copyright: 'Todos os direitos reservados.', noContacts: 'Os contactos serão publicados em breve.' },
    preview: { scroll: 'Deslocar', stage: 'Etapa', artwork: 'Estudo de materiais e estrutura para sofás — gráfico decorativo, não fotografia', channels: 'Canais de contacto direto' },
    previewCopy: {
      qualityProcessLabel: 'Processo de verificação da qualidade',
      qualitySteps: [
        { title: 'Confirmação de requisitos', desc: 'Aplicação, material, dimensões, cor e embalagem confirmados antes da encomenda.' },
        { title: 'Verificação de amostra e fornecimento', desc: 'A encomenda é comparada à amostra aprovada e à especificação.' },
        { title: 'Inspeção pré-embarque', desc: 'Aspeto, dimensões principais, quantidade e embalagem são verificados.' },
        { title: 'Revisão da embalagem e documentos', desc: 'Embalagem, marcações, quantidades e documentos são revistos.' },
      ],
      productsPublishedLabel: 'Produtos publicados',
      productsFromCatalogue: 'Os acessórios publicados estão listados abaixo.',
      productsNoPublished: 'O catálogo está em preparação. Contacte-nos para especificações e cotação.',
      browseProducts: 'Ver todos os produtos',
      requestCatalogue: 'Solicitar catálogo',
      inquirySubject: 'Consulta de acessórios para sofás',
      inquiryHint: 'Partilhe aplicação, especificação, quantidade e destino para resposta rápida.',
    },
  },

  hi: {
    company: {
      name: sharedCompanyName,
      tagline: 'सोफ़ा एक्सेसरीज़ पर फ़ोकस, सोर्सिंग और आसान।',
      about: 'Mizhong New Materials Co., Ltd. सोफ़ा और अपहोल्स्टर्ड फर्नीचर एक्सेसरीज़ पर केंद्रित है। हम उत्पाद चयन, स्पेसिफ़िकेशन, सैंपल, सोर्सिंग, गुणवत्ता जाँच और शिपमेंट में सहायता करते हैं।',
      positioning: 'सोफ़ा एक्सेसरीज़ सप्लायर और सोर्सिंग पार्टनर',
      seoTitle: 'Mizhong New Materials | सोफ़ा एक्सेसरीज़',
      seoDescription: 'हार्डवेयर, स्प्रिंग, इलास्टिक वेबिंग, नॉन-वुवन फैब्रिक और सोर्सिंग सपोर्ट।',
    },
    meta: { title: 'सोफ़ा एक्सेसरीज़ सप्लायर और सोर्सिंग पार्टनर', description: 'सोफ़ा हार्डवेयर, स्प्रिंग, वेबिंग, नॉन-वुवन फैब्रिक और संबंधित सामग्री के लिए सोर्सिंग।' },
    hero: {
      eyebrow: 'सोफ़ा एक्सेसरीज़ सप्लायर और सोर्सिंग पार्टनर',
      titleLine1: 'भरोसेमंद सोफ़ा एक्सेसरीज़,',
      titleLine2: 'हर प्रोजेक्ट के लिए तैयार।',
      subtitle: 'हम हार्डवेयर कनेक्टर, स्प्रिंग सिस्टम, इलास्टिक वेबिंग और नॉन-वुवन फैब्रिक की स्पेसिफ़िकेशन से डिलीवरी तक सहायता करते हैं।',
      ctaPrimary: 'उत्पाद श्रेणी देखें',
      ctaSecondary: 'पूछताछ भेजें',
      mediaLabel: 'सोफ़ा सामग्री अध्ययन',
    },
    capabilities: {
      eyebrow: 'हम कैसे मदद करते हैं',
      title: 'आवश्यकता से डिलीवरी तक स्पष्ट प्रक्रिया',
      subtitle: 'उत्पाद चयन, सैंपल, गुणवत्ता जाँच और शिपमेंट का समन्वय।',
      items: [
        { title: 'उत्पाद मिलान', desc: 'उपयोग, सामग्री, आयाम और असेंबली के अनुसार विकल्प।' },
        { title: 'स्थिर सोर्सिंग', desc: 'सैंपल और बल्क ऑर्डर के लिए सप्लायर और लीड टाइम समन्वय।' },
        { title: 'गुणवत्ता जाँच', desc: 'स्पेसिफ़िकेशन, मात्रा और पैकिंग के अनुसार प्री-शिपमेंट जाँच।' },
        { title: 'निर्यात समन्वय', desc: 'पैकिंग, मार्क, दस्तावेज़ और डिस्पैच समन्वय।' },
      ],
    },
    products: {
      eyebrow: 'उत्पाद श्रेणी',
      title: 'सोफ़ा एक्सेसरी श्रेणियाँ',
      subtitle: 'प्रतिनिधि श्रेणियाँ। सामग्री, आयाम, पैकिंग और MOQ के लिए संपर्क करें।',
      categories: [
        { name: 'सोफ़ा हार्डवेयर और कनेक्टर', desc: 'जोड़ने, फ़िक्सिंग, एडजस्टमेंट और असेंबली के लिए धातु भाग।' },
        { name: 'स्प्रिंग और सपोर्ट सिस्टम', desc: 'सीट और बैक के लिए ज़िगज़ैग स्प्रिंग, क्लिप और सपोर्ट।' },
        { name: 'इलास्टिक वेबिंग', desc: 'सीट, बैक और अपहोल्स्टर्ड संरचनाओं के लिए लचीला सपोर्ट।' },
        { name: 'नॉन-वुवन फैब्रिक और डस्ट कवर', desc: 'सोफ़ा बेस, लाइनर और डस्ट कवर के लिए।' },
        { name: 'पैडिंग और अपहोल्स्ट्री सप्लाई', desc: 'कुशनिंग, फ़िलिंग, रैपिंग और फ़िनिशिंग की सामग्री।' },
        { name: 'पैकिंग और असेंबली सप्लाई', desc: 'सिलाई, बॉन्डिंग, सुरक्षा और असेंबली के लिए सामग्री।' },
      ],
      cta: 'उत्पाद कैटलॉग माँगें',
    },
    supply: {
      eyebrow: 'सोर्सिंग प्रक्रिया',
      title: 'स्पेसिफ़िकेशन से डिलीवरी तक हर कदम स्पष्ट',
      subtitle: 'पुष्ट उपयोग, स्पेसिफ़िकेशन, सैंपल और पैकिंग सभी कदमों का आधार हैं।',
      points: ['आवश्यकता और सामग्री की पुष्टि', 'सैंपल और स्पेसिफ़िकेशन अनुमोदन', 'ऑर्डर फ़ॉलो-अप और प्री-शिपमेंट जाँच', 'पैकिंग, दस्तावेज़ और डिस्पैच'],
      mediaLabel: 'सोफ़ा सामग्री अध्ययन',
    },
    quality: {
      eyebrow: 'गुणवत्ता और डिलीवरी',
      title: 'शिपमेंट से पहले महत्वपूर्ण विवरणों की जाँच',
      subtitle: 'सामग्री, आयाम, मात्रा और पैकिंग की पुष्ट आवश्यकताओं से तुलना होती है।',
      principles: [
        { title: 'स्पेसिफ़िकेशन बेसलाइन', desc: 'ऑर्डर से पहले सामग्री, आयाम, रंग और उपयोग की पुष्टि।' },
        { title: 'सैंपल संगति', desc: 'बल्क ऑर्डर स्वीकृत सैंपल और लिखित आवश्यकताओं का पालन करते हैं।' },
        { title: 'डिलीवरी सत्यापन', desc: 'मात्रा, पैकिंग, शिपिंग मार्क और दस्तावेज़ की जाँच।' },
      ],
      certificatesTitle: 'दस्तावेज़ और अनुपालन',
      certificatesNote: 'चुने गए उत्पाद के लिए उपलब्ध होने पर रिपोर्ट या अनुपालन दस्तावेज़ दिए जाते हैं।',
      certificatesPlaceholder: 'दस्तावेज़ — उपलब्धता के अधीन',
    },
    inquiry: {
      eyebrow: 'Mizhong से संपर्क',
      title: 'सोफ़ा एक्सेसरीज़ ढूँढ रहे हैं?',
      subtitle: 'उपयोग, सामग्री, आयाम, मात्रा और गंतव्य बताएँ; हम विकल्प, मूल्य और लीड टाइम भेजेंगे।',
      cta: 'पूछताछ भेजें',
      emailLabel: 'ईमेल',
      phoneLabel: 'फ़ोन',
      addressLabel: 'पता',
      note: 'WhatsApp, ईमेल या फ़ोन से संपर्क करें।',
    },
    footer: { tagline: 'आपकी आवश्यकता और डिलीवरी योजना के अनुरूप सोफ़ा और अपहोल्स्टर्ड फर्नीचर एक्सेसरीज़।', productsTitle: 'उत्पाद श्रेणी', companyTitle: 'कंपनी', contactTitle: 'संपर्क', copyright: 'सर्वाधिकार सुरक्षित।', noContacts: 'संपर्क विवरण जल्द प्रकाशित होंगे।' },
    preview: { scroll: 'स्क्रॉल', stage: 'चरण', artwork: 'सोफ़ा एक्सेसरी सामग्री और संरचना अध्ययन — सजावटी ग्राफ़िक, उत्पाद फ़ोटो नहीं', channels: 'सीधे संपर्क चैनल' },
    previewCopy: {
      qualityProcessLabel: 'गुणवत्ता सत्यापन प्रक्रिया',
      qualitySteps: [
        { title: 'आवश्यकता और स्पेसिफ़िकेशन', desc: 'ऑर्डर से पहले उपयोग, सामग्री, आयाम, रंग और पैकिंग पुष्ट।' },
        { title: 'सैंपल और सप्लाई सत्यापन', desc: 'बल्क ऑर्डर की स्वीकृत सैंपल और लिखित स्पेसिफ़िकेशन से तुलना।' },
        { title: 'प्री-शिपमेंट जाँच', desc: 'दिखावट, प्रमुख आयाम, मात्रा और पैकिंग की जाँच।' },
        { title: 'पैकिंग और दस्तावेज़ समीक्षा', desc: 'पैकिंग, मार्क, मात्रा और डिस्पैच दस्तावेज़ की समीक्षा।' },
      ],
      productsPublishedLabel: 'प्रकाशित उत्पाद',
      productsFromCatalogue: 'प्रकाशित सोफ़ा एक्सेसरीज़ नीचे हैं।',
      productsNoPublished: 'औपचारिक कैटलॉग तैयार हो रहा है। स्पेसिफ़िकेशन और कोटेशन के लिए संपर्क करें।',
      browseProducts: 'सभी उत्पाद देखें',
      requestCatalogue: 'उत्पाद कैटलॉग माँगें',
      inquirySubject: 'सोफ़ा एक्सेसरी पूछताछ',
      inquiryHint: 'तेज़ जवाब के लिए उपयोग, स्पेसिफ़िकेशन, मात्रा और गंतव्य भेजें।',
    },
  },
};

/** 运行时字典只需要首页覆盖，公司资料由内容层单独使用。 */
export function getSofaDictionaryOverlay(locale: Locale): SofaDictionaryOverlay {
  const content = sofaContent[locale];
  return {
    meta: content.meta,
    hero: content.hero,
    capabilities: content.capabilities,
    products: content.products,
    supply: content.supply,
    quality: content.quality,
    inquiry: content.inquiry,
    footer: content.footer,
    preview: content.preview,
  };
}
