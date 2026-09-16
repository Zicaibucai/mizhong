import type { Locale } from '@/lib/i18n/config';

/**
 * 商品目录 / 搜索页面的文案。
 *
 * 独立于主字典（src/lib/i18n/dictionaries/），因为该目录由并行的开发线维护；
 * 结构同样是「英文为准 + 其余语言同型校验」，缺键会在编译期报错。
 */
const en = {
  list: {
    title: 'Product catalogue',
    subtitle: 'Browse our textile accessories. Use the filters below to narrow the list.',
    searchPlaceholder: 'Search products, SKU or category…',
    searchButton: 'Search',
    allCategories: 'All categories',
    categoryLabel: 'Category',
    clearFilters: 'Clear filters',
    featuredTitle: 'Featured products',
    empty: 'No products match your current filters.',
    emptyHint: 'Try another keyword, or clear the filters to see the whole catalogue.',
    resultCount: '{count} products',
    resultCountOne: '1 product',
    prev: 'Previous',
    next: 'Next',
    pageOf: 'Page {page} of {total}',
    viewDetails: 'View details',
  },
  detail: {
    back: 'Back to catalogue',
    sku: 'SKU',
    category: 'Category',
    overview: 'Overview',
    specs: 'Specifications',
    applications: 'Applications',
    gallery: 'Gallery',
    inquiryTitle: 'Interested in this product?',
    inquirySubtitle: 'Send us the specification and quantity you need, and we will reply with pricing and lead time.',
    whatsapp: 'Ask on WhatsApp',
    email: 'Send an email',
    whatsappMessage: 'Hello, I would like to ask about "{product}" ({url}).',
    fallbackNotice: 'A translation for this product is not available in your language yet, so the English text is shown.',
  },
  search: {
    title: 'Search',
    resultsFor: 'Results for “{query}”',
    resultCount: '{count} products found',
    resultCountOne: '1 product found',
    emptyQuery: 'Enter a keyword to search the catalogue.',
    emptyQueryHint: 'You can search by product name, SKU, description or category.',
    noResults: 'No products found for “{query}”.',
    noResultsHint: 'Check the spelling, or try a broader keyword.',
    backToCatalogue: 'Browse the full catalogue',
  },
  notFound: {
    title: 'Product not found',
    description: 'This product does not exist, or it is no longer available.',
    back: 'Back to catalogue',
  },
};

export type CatalogDict = typeof en;

const zh: CatalogDict = {
  list: {
    title: '产品目录',
    subtitle: '浏览我们的纺织辅料产品，可使用下方筛选缩小范围。',
    searchPlaceholder: '搜索产品名称、SKU 或分类…',
    searchButton: '搜索',
    allCategories: '全部分类',
    categoryLabel: '分类',
    clearFilters: '清除筛选',
    featuredTitle: '精选产品',
    empty: '当前筛选条件下没有匹配的产品。',
    emptyHint: '换个关键词，或清除筛选查看完整目录。',
    resultCount: '共 {count} 件产品',
    resultCountOne: '共 1 件产品',
    prev: '上一页',
    next: '下一页',
    pageOf: '第 {page} / {total} 页',
    viewDetails: '查看详情',
  },
  detail: {
    back: '返回产品目录',
    sku: 'SKU',
    category: '分类',
    overview: '产品说明',
    specs: '规格参数',
    applications: '应用场景',
    gallery: '产品图库',
    inquiryTitle: '对该产品有需求？',
    inquirySubtitle: '告诉我们所需规格与数量，我们会回复报价与交期。',
    whatsapp: 'WhatsApp 咨询',
    email: '发送邮件',
    whatsappMessage: '您好，我想咨询产品「{product}」（{url}）。',
    fallbackNotice: '该产品暂未提供您所选语言的翻译，当前显示英文内容。',
  },
  search: {
    title: '搜索',
    resultsFor: '“{query}”的搜索结果',
    resultCount: '找到 {count} 件产品',
    resultCountOne: '找到 1 件产品',
    emptyQuery: '输入关键词以搜索产品目录。',
    emptyQueryHint: '可以按产品名称、SKU、描述或分类搜索。',
    noResults: '没有找到与“{query}”匹配的产品。',
    noResultsHint: '请检查拼写，或换用更宽泛的关键词。',
    backToCatalogue: '浏览完整目录',
  },
  notFound: {
    title: '产品不存在',
    description: '该产品不存在，或已下架。',
    back: '返回产品目录',
  },
};

const vi: CatalogDict = {
  list: {
    title: 'Danh mục sản phẩm',
    subtitle: 'Xem phụ kiện dệt may của chúng tôi. Dùng bộ lọc bên dưới để thu hẹp danh sách.',
    searchPlaceholder: 'Tìm sản phẩm, SKU hoặc danh mục…',
    searchButton: 'Tìm kiếm',
    allCategories: 'Tất cả danh mục',
    categoryLabel: 'Danh mục',
    clearFilters: 'Xóa bộ lọc',
    featuredTitle: 'Sản phẩm nổi bật',
    empty: 'Không có sản phẩm nào khớp với bộ lọc hiện tại.',
    emptyHint: 'Hãy thử từ khóa khác, hoặc xóa bộ lọc để xem toàn bộ danh mục.',
    resultCount: '{count} sản phẩm',
    resultCountOne: '1 sản phẩm',
    prev: 'Trước',
    next: 'Sau',
    pageOf: 'Trang {page} / {total}',
    viewDetails: 'Xem chi tiết',
  },
  detail: {
    back: 'Quay lại danh mục',
    sku: 'SKU',
    category: 'Danh mục',
    overview: 'Mô tả sản phẩm',
    specs: 'Thông số kỹ thuật',
    applications: 'Ứng dụng',
    gallery: 'Thư viện ảnh',
    inquiryTitle: 'Bạn quan tâm đến sản phẩm này?',
    inquirySubtitle: 'Cho chúng tôi biết thông số và số lượng cần thiết, chúng tôi sẽ phản hồi giá và thời gian giao hàng.',
    whatsapp: 'Hỏi qua WhatsApp',
    email: 'Gửi email',
    whatsappMessage: 'Xin chào, tôi muốn hỏi về sản phẩm "{product}" ({url}).',
    fallbackNotice: 'Sản phẩm này chưa có bản dịch cho ngôn ngữ của bạn, hiện đang hiển thị nội dung tiếng Anh.',
  },
  search: {
    title: 'Tìm kiếm',
    resultsFor: 'Kết quả cho “{query}”',
    resultCount: 'Tìm thấy {count} sản phẩm',
    resultCountOne: 'Tìm thấy 1 sản phẩm',
    emptyQuery: 'Nhập từ khóa để tìm kiếm trong danh mục.',
    emptyQueryHint: 'Bạn có thể tìm theo tên sản phẩm, SKU, mô tả hoặc danh mục.',
    noResults: 'Không tìm thấy sản phẩm nào cho “{query}”.',
    noResultsHint: 'Hãy kiểm tra chính tả, hoặc thử từ khóa rộng hơn.',
    backToCatalogue: 'Xem toàn bộ danh mục',
  },
  notFound: {
    title: 'Không tìm thấy sản phẩm',
    description: 'Sản phẩm này không tồn tại hoặc đã ngừng cung cấp.',
    back: 'Quay lại danh mục',
  },
};

const catalogDicts: Record<Locale, CatalogDict> = { en, zh, vi };

export function getCatalogDict(locale: Locale): CatalogDict {
  return catalogDicts[locale];
}

/** 简单占位符替换：{count}、{page}、{query} 等 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
