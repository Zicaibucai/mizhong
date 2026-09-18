import type { AdminMessages } from '@/lib/admin/i18n';
import type { EmergencyOffer } from '@/lib/admin/action-state';

/**
 * 应急发布的**文案**，单独一个模块。
 *
 * 为什么不放在 `emergency-publish.ts` 里：那个模块负责判定与执行，会一路引到
 * `translation/jobs` → `lib/audit` → `next/headers` —— 那是**只能在服务端**加载的。
 * 而前台需要用的只是「把失败类型翻成一句人话」，客户端组件从那里引会把
 * 整个服务端依赖拖进浏览器包，构建直接失败。
 *
 * 所以这里只留纯函数：入参是消息字典与几个字符串，不碰数据库、不碰请求上下文。
 */

/** 可应急的失败类型（与 `TRANSIENT_FAILURES` 一致，类型独立以便客户端引用） */
export type TransientFailureKind = 'timeout' | 'network' | 'rate-limit' | 'server';

/** 把失败类型翻成一句人话，供确认框与后台提示使用 */
export function describeFailureKind(kind: string | null | undefined, t: AdminMessages): string {
  switch (kind) {
    case 'timeout':
      return t.emergency.failureTimeout;
    case 'network':
      return t.emergency.failureNetwork;
    case 'rate-limit':
      return t.emergency.failureRateLimit;
    case 'server':
      return t.emergency.failureServer;
    default:
      return t.emergency.failureUnknown;
  }
}

/** 不可应急时，告诉管理员该去做什么 —— 只说「不行」帮不上忙 */
export function describeBlockedReason(reason: EmergencyOffer['reason'], t: AdminMessages): string {
  switch (reason) {
    case 'config':
      return t.emergency.blockedConfig;
    case 'content':
      return t.emergency.blockedContent;
    case 'none-needed':
      return t.emergency.blockedNoneNeeded;
    default:
      return t.emergency.blockedUnknown;
  }
}
