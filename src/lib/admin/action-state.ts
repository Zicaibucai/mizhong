/** 后台表单统一的 Action 返回状态 */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialFormState: FormState = { status: 'idle' };
