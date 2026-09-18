import type { Locale } from '@/lib/i18n/config';

/**
 * 设计预览页专用文案。
 *
 * 只包含**预览页新增**的通用流程表述与界面标签，与三语言主字典
 * （src/lib/i18n/dictionaries/）分离：
 *   - 预览页是独立路由，正式首页不读取这里的任何键，改动不会影响正式站；
 *   - 新增文案必须同样提供 zh / en / vi 三份，缺失时回退英文。
 *
 * 内容约束（与全站一致）：只描述通用的供应链质量流程，不出现任何未经确认的
 * 证书、工厂、产能、检测数据或客户信息。
 */

export interface PreviewStep {
  title: string;
  desc: string;
}

export interface PreviewCopy {
  /** 「供应链质量流程」清单的领域标签 */
  qualityProcessLabel: string;
  /** 四条通用质量流程（规格确认 → 供应方核验 → 出货前检验 → 包装与单证） */
  qualitySteps: readonly PreviewStep[];
  /** 产品区：配置了真实商品时的领域标签 */
  productsPublishedLabel: string;
  /** 产品区：数据来自后台已发布商品时的说明 */
  productsFromCatalogue: string;
  /** 产品区：后台暂无已发布商品时的说明（分类概览，不代表具体商品） */
  productsNoPublished: string;
  /** 主按钮：进入完整产品目录 */
  browseProducts: string;
  /** 询盘邮件主题（预填，便于后台识别来源） */
  inquirySubject: string;
  /** 询盘区：主按钮下的辅助说明 */
  inquiryHint: string;
}

const zh: PreviewCopy = {
  qualityProcessLabel: '供应链质量流程',
  qualitySteps: [
    {
      title: '规格确认',
      desc: '生产前以书面形式确认材质、颜色、尺寸与包装要求。',
    },
    {
      title: '供应方与来料核验',
      desc: '按已确认的规格核对供应方信息与到料情况。',
    },
    {
      title: '出货前检验',
      desc: '按约定标准在出货前核对成品。',
    },
    {
      title: '包装与单证复核',
      desc: '核对包装方式、运输唛头与出口单证是否与订单一致。',
    },
  ],
  productsPublishedLabel: '已发布商品',
  productsFromCatalogue: '以下为后台已发布的商品，点击进入商品详情。',
  productsNoPublished:
    '后台尚未发布商品，此处展示产品分类概览；完整目录与规格将在商品上架后自动更新。',
  browseProducts: '浏览全部产品',
  inquirySubject: '网站询盘',
  inquiryHint: '以上渠道均可直接触达，工作时间内我们会尽快回复。',
};

const en: PreviewCopy = {
  qualityProcessLabel: 'Supply chain quality process',
  qualitySteps: [
    {
      title: 'Specification confirmation',
      desc: 'Material, colour, size and packing requirements are confirmed in writing before production.',
    },
    {
      title: 'Supplier and material verification',
      desc: 'Suppliers and incoming materials are checked against the confirmed specification.',
    },
    {
      title: 'Pre-shipment inspection',
      desc: 'Finished goods are checked against the agreed standard before dispatch.',
    },
    {
      title: 'Packing and documentation review',
      desc: 'Packing method, shipping marks and export documents are reviewed against the order.',
    },
  ],
  productsPublishedLabel: 'Published products',
  productsFromCatalogue: 'Products published in the admin are listed below — select one for details.',
  productsNoPublished:
    'No products are published yet, so the categories below are shown as an overview. The full catalogue updates automatically once products go live.',
  browseProducts: 'Browse all products',
  inquirySubject: 'Website enquiry',
  inquiryHint: 'Every channel above reaches us directly. We reply within business hours.',
};

const vi: PreviewCopy = {
  qualityProcessLabel: 'Quy trình chất lượng chuỗi cung ứng',
  qualitySteps: [
    {
      title: 'Xác nhận thông số',
      desc: 'Chất liệu, màu sắc, kích thước và yêu cầu đóng gói được xác nhận bằng văn bản trước khi sản xuất.',
    },
    {
      title: 'Xác minh nhà cung cấp và nguyên phụ liệu',
      desc: 'Nhà cung cấp và nguyên phụ liệu đầu vào được đối chiếu với thông số đã xác nhận.',
    },
    {
      title: 'Kiểm tra trước khi xuất hàng',
      desc: 'Thành phẩm được kiểm tra theo tiêu chuẩn đã thống nhất trước khi giao hàng.',
    },
    {
      title: 'Rà soát đóng gói và chứng từ',
      desc: 'Cách đóng gói, ký hiệu vận chuyển và chứng từ xuất khẩu được rà soát theo đơn hàng.',
    },
  ],
  productsPublishedLabel: 'Sản phẩm đã đăng',
  productsFromCatalogue:
    'Các sản phẩm đã đăng trong trang quản trị được liệt kê dưới đây — chọn một sản phẩm để xem chi tiết.',
  productsNoPublished:
    'Chưa có sản phẩm nào được đăng, nên danh mục dưới đây chỉ mang tính khái quát. Danh mục đầy đủ sẽ tự động cập nhật khi sản phẩm được đăng.',
  browseProducts: 'Xem toàn bộ sản phẩm',
  inquirySubject: 'Yêu cầu từ website',
  inquiryHint: 'Mọi kênh trên đều liên hệ trực tiếp được. Chúng tôi phản hồi trong giờ làm việc.',
};

/**
 * 设计预览页是**独立路由**，正式首页不读这里，因此新增语言不必立刻补全。
 * 用 Partial 明确表达「可以缺席」，未提供的语言回退英文 —— 与文件开头的设计一致。
 */
const COPY: Partial<Record<Locale, PreviewCopy>> = { zh, en, vi };

export function getPreviewCopy(locale: Locale): PreviewCopy {
  return COPY[locale] ?? en;
}
