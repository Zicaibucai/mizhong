/** Shared Action return state for admin forms */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

export const initialFormState: FormState = { status: 'idle' };
