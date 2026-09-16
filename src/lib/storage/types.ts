import type { MediaKind } from './shared';

export type StorageDriverName = 'local' | 'oss';

export interface CommitResult {
  driver: StorageDriverName;
  key: string;
  url: string;
  size: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export interface StorageProvider {
  readonly driver: StorageDriverName;
  /** 把已落盘的临时文件提交到最终位置；图片会同时生成缩略图 */
  commit(tempFilePath: string, key: string, kind: MediaKind): Promise<CommitResult>;
  remove(key: string | null | undefined): Promise<void>;
  urlFor(key: string): string;
  /** 本地存储才有绝对路径；对象存储返回 null */
  absolutePath(key: string): string | null;
}

export interface ReferenceCheck {
  /** 素材被引用的位置描述（用于删除前提示） */
  references: string[];
}
