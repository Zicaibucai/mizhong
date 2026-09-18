/** 发布时译文自动同步的进度，用于在按钮下方显示「已翻译 3 / 10 种语言」 */
export interface PublishProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

/**
 * 「要不要提供应急发布」的判断结果。
 *
 * **不可应急时也照常返回**，因为界面需要知道原因才能告诉管理员下一步做什么 ——
 * 「没配 Key」与「内容有问题」的下一步完全不同，只说「不能应急」帮不上忙。
 */
export interface EmergencyOffer {
  eligible: boolean;
  /** 可应急时的失败类型（timeout / network / rate-limit / server） */
  failureKind: string | null;
  /** 不可应急时的原因分类 */
  reason: 'service' | 'config' | 'content' | 'none-needed' | 'unknown';
}

/** Shared Action return state for admin forms */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  /**
   * 发布自带的译文同步还没跑完时带上任务 id。
   *
   * 界面据此继续调 `continueTranslationJobAction` 推进，而不是把整个翻译塞进
   * 这一个请求里 —— 一次请求挂满 60 秒是需求明确禁止的。
   */
  jobId?: string;
  progress?: PublishProgress;
  /** 发布因译文同步失败而中止时带着它，界面据此决定要不要显示应急发布 */
  emergency?: EmergencyOffer;
}

export const initialFormState: FormState = { status: 'idle' };
