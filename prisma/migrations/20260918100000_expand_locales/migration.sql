-- 内容语言从 3 种扩展到 11 种（新增 es/ja/ru/ar/fr/ko/pt/hi）
--
-- 纯新增：只给 Locale 枚举追加成员，不改动任何列、表或数据。
-- 所有翻译表都以该枚举为外键，追加后旧数据完全不受影响。
--
-- 注意：PostgreSQL 12+ 允许在同一事务里 ADD VALUE，只要同一事务不使用新值。
-- 本迁移只做追加，因此安全。

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "Locale" ADD VALUE 'es';
ALTER TYPE "Locale" ADD VALUE 'ja';
ALTER TYPE "Locale" ADD VALUE 'ru';
ALTER TYPE "Locale" ADD VALUE 'ar';
ALTER TYPE "Locale" ADD VALUE 'fr';
ALTER TYPE "Locale" ADD VALUE 'ko';
ALTER TYPE "Locale" ADD VALUE 'pt';
ALTER TYPE "Locale" ADD VALUE 'hi';
