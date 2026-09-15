export type ClassValue = string | number | false | null | undefined;

/**
 * 极简 className 合并工具（避免引入额外依赖）。
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(' ');
}
