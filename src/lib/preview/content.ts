import type { Locale } from '@/lib/i18n/config';
import { sofaContent, type SofaPreviewCopy } from '@/lib/i18n/sofa-content';

/**
 * 设计预览页专用文案。
 *
 * 只包含**预览页新增**的通用流程表述与界面标签，与主字典分离：
 *   - 预览页是独立路由，正式首页不读取这里的任何键，改动不会影响正式站；
 *   - 所有已启用语言都必须有完整文案，不使用英文兜底。
 *
 * 内容约束（与全站一致）：只描述通用的供应链质量流程，不出现任何未经确认的
 * 证书、工厂、产能、检测数据或客户信息。
 */

export type PreviewCopy = SofaPreviewCopy;

/**
 * 正式首页与设计预览共用这一内容入口；Record<Locale, ...> 保证新增语言时必须补齐。
 */
export function getPreviewCopy(locale: Locale): PreviewCopy {
  return sofaContent[locale].previewCopy;
}
