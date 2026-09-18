/** 发布时译文自动同步的进度，用于在按钮下方显示「已翻译 3 / 10 种语言」 */
export interface PublishProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
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
}

export const initialFormState: FormState = { status: 'idle' };
