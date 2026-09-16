'use server';

/**
 * 媒体库 Server Actions。
 *
 * 约定（与 contacts / navigation / pages 模块保持一致）：
 *   - 每个 action 先取当前请求的后台语言 `t`，再走 `requireAdminOrError` 守卫；
 *   - 所有输入用 Zod 校验，绝不信任客户端；
 *   - 每次创建 / 更新 / 删除 / 绑定 / 解绑都写 AuditLog（summary 为简短英文）；
 *   - 变更后 `revalidatePath('/', 'layout')`，让前台立即刷新。
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { getDbUnavailableState, requireAdminOrError } from '@/lib/admin/guard';
import {
  ADMIN_LOCALES,
  makeIdSchema,
  parseForm,
  parseLocaleFields,
  type AdminLocale,
} from '@/lib/admin/validation';
import { getAdminMessagesForRequest, type AdminMessages } from '@/lib/admin/i18n';
import { getStorage } from '@/lib/storage';
import { SLOT_OPTIONS, type MediaSlot } from '@/lib/media';
import { collectAssetReferences, describeAssetReferences } from '@/components/admin/media/asset-references';
import { pickLocalizedText } from '@/components/admin/media/utils';
import type { FormState } from '@/lib/admin/action-state';

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

const SLOT_VALUE_SET = new Set<string>(SLOT_OPTIONS.map((option) => option.value));

/** 复选框 / 隐藏字段 → boolean（`1` / `true` / `on` 视为真） */
const flag = z.preprocess(
  (value) => value === '1' || value === 'true' || value === 'on',
  z.boolean(),
);

/** 表单文本：缺失字段与 null 一律视作空串，再做长度校验 */
function optionalText(max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : ''),
    z.string().max(max, message),
  );
}

function makeAssetTranslationSchema(t: AdminMessages) {
  return z.object({
    title: optionalText(300, t.validation.invalidInput),
    caption: optionalText(1000, t.validation.invalidInput),
    alt: optionalText(500, t.validation.invalidInput),
  });
}

async function writeAssetAudit(
  user: { id: string; email: string },
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  assetId: string,
  summary: string,
  detail?: Prisma.InputJsonValue,
): Promise<void> {
  await writeAudit({
    userId: user.id,
    actorEmail: user.email,
    action,
    targetType: 'Asset',
    targetId: assetId,
    summary,
    detail: detail ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// 多语言文案
// ---------------------------------------------------------------------------

export async function saveAssetTranslationsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const base = parseForm(makeIdSchema(t), formData, t);
  if (!base.ok) return { status: 'error', message: base.message };

  const schema = makeAssetTranslationSchema(t);
  const translations: { locale: AdminLocale; title: string; caption: string; alt: string }[] = [];
  for (const locale of ADMIN_LOCALES) {
    const parsed = parseLocaleFields(schema, locale, formData, t);
    if (!parsed.ok) return { status: 'error', message: parsed.message };
    translations.push({ locale, ...parsed.data });
  }

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const asset = await db.asset.findUnique({
      where: { id: base.data.id },
      select: { id: true, originalName: true, key: true },
    });
    if (!asset) return { status: 'error', message: t.media.notFound };

    for (const item of translations) {
      const data = {
        title: item.title || null,
        caption: item.caption || null,
        alt: item.alt || null,
      };
      await db.assetTranslation.upsert({
        where: { assetId_locale: { assetId: asset.id, locale: item.locale } },
        update: data,
        create: { assetId: asset.id, locale: item.locale, ...data },
      });
    }

    await writeAssetAudit(user, 'UPDATE', asset.id, 'Updated media translations', {
      key: asset.key,
    });
  } catch (error) {
    console.error('[admin] save asset translations failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

// ---------------------------------------------------------------------------
// 启用 / 停用
// ---------------------------------------------------------------------------

export async function setAssetEnabledAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    enabled: flag,
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const asset = await db.asset.update({
      where: { id: parsed.data.id },
      data: { enabled: parsed.data.enabled },
      select: { id: true, key: true },
    });

    await writeAssetAudit(
      user,
      'UPDATE',
      asset.id,
      parsed.data.enabled ? 'Enabled media' : 'Disabled media',
      { key: asset.key },
    );
  } catch (error) {
    console.error('[admin] set asset enabled failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: parsed.data.enabled ? t.media.enabled : t.media.disabled,
  };
}

// ---------------------------------------------------------------------------
// 槽位绑定
// ---------------------------------------------------------------------------

export async function bindAssetSlotAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    slot: z
      .string()
      .trim()
      .refine((value): value is MediaSlot => SLOT_VALUE_SET.has(value), {
        message: t.validation.invalidInput,
      }),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const asset = await db.asset.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, key: true },
    });
    if (!asset) return { status: 'error', message: t.media.notFound };

    // 0 号位是该槽位的「主素材」：绑定即替换原占位素材
    await db.$transaction(async (tx) => {
      await tx.slotBinding.deleteMany({ where: { slot: parsed.data.slot, position: 0 } });
      await tx.slotBinding.create({
        data: { slot: parsed.data.slot, assetId: asset.id, position: 0 },
      });
    });

    await writeAssetAudit(user, 'UPDATE', asset.id, `Bound media to slot ${parsed.data.slot}`, {
      key: asset.key,
      slot: parsed.data.slot,
    });
  } catch (error) {
    console.error('[admin] bind asset slot failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: parsed.data.slot };
}

export async function unbindAssetSlotAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    bindingId: z.string().trim().min(1, t.validation.invalidInput),
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const binding = await db.slotBinding.findFirst({
      where: { id: parsed.data.bindingId, assetId: parsed.data.id },
      select: { id: true, slot: true },
    });
    if (!binding) return { status: 'error', message: t.actions.operationFailed };

    await db.slotBinding.delete({ where: { id: binding.id } });

    await writeAssetAudit(user, 'UPDATE', parsed.data.id, `Unbound media from slot ${binding.slot}`, {
      slot: binding.slot,
    });
  } catch (error) {
    console.error('[admin] unbind asset slot failed:', error);
    return { status: 'error', message: t.actions.operationFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

// ---------------------------------------------------------------------------
// 替换文件 / 视频封面（客户端上传成功后回调）
// ---------------------------------------------------------------------------

const replaceSchema = z.object({
  assetId: z.string().trim().min(1),
  sourceAssetId: z.string().trim().min(1),
});

/**
 * 用刚上传的新素材替换旧素材的文件，**保留同一个素材 id**，
 * 因此 ProductMedia / SlotBinding / 封面引用全部不受影响。
 * 数据库更新成功后才删除旧文件。
 */
export async function replaceAssetFileAction(input: {
  assetId: string;
  sourceAssetId: string;
}): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const { assetId, sourceAssetId } = parsed.data;
  if (assetId === sourceAssetId) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const [target, source] = await Promise.all([
      db.asset.findUnique({ where: { id: assetId } }),
      db.asset.findUnique({ where: { id: sourceAssetId } }),
    ]);
    if (!target || !source) return { status: 'error', message: t.media.notFound };
    // 图片只能换成图片，视频只能换成视频，避免前台把视频塞进 <img>
    if (source.type !== target.type) return { status: 'error', message: t.validation.invalidInput };

    // 新上传的素材应当还没有任何引用；若已被引用则拒绝（不静默破坏页面）
    const [galleryRefs, slotRefs, productRefs, categoryRefs] = await Promise.all([
      db.productMedia.count({ where: { assetId: sourceAssetId } }),
      db.slotBinding.count({ where: { assetId: sourceAssetId } }),
      db.product.count({ where: { coverAssetId: sourceAssetId } }),
      db.productCategory.count({ where: { coverAssetId: sourceAssetId } }),
    ]);
    if (galleryRefs + slotRefs + productRefs + categoryRefs > 0) {
      return { status: 'error', message: t.actions.operationFailed };
    }

    const oldKey = target.key;

    await db.$transaction(async (tx) => {
      // 先删除刚上传的临时素材行，释放 key 的唯一约束，再把文件字段搬到目标素材上
      await tx.asset.delete({ where: { id: sourceAssetId } });
      await tx.asset.update({
        where: { id: assetId },
        data: {
          key: source.key,
          url: source.url,
          thumbnailUrl: source.thumbnailUrl,
          mimeType: source.mimeType,
          size: source.size,
          width: source.width,
          height: source.height,
          originalName: source.originalName ?? target.originalName,
        },
      });
    });

    // 数据库已指向新文件，此时删除旧文件才是安全的
    try {
      await getStorage().remove(oldKey);
    } catch (error) {
      console.error('[admin] remove replaced media file failed:', error);
    }

    await writeAssetAudit(user, 'UPDATE', assetId, 'Replaced media file', {
      oldKey,
      newKey: source.key,
    });
  } catch (error) {
    console.error('[admin] replace asset file failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success', message: t.media.uploadSuccess };
}

const posterSchema = z.object({
  assetId: z.string().trim().min(1),
  /** null = 移除封面 */
  posterAssetId: z.string().trim().min(1).nullable(),
});

/** 上传单独一张图片作为视频封面（存 URL），或移除封面 */
export async function setAssetPosterAction(input: {
  assetId: string;
  posterAssetId: string | null;
}): Promise<FormState> {
  const { t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const parsed = posterSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: t.validation.invalidInput };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  try {
    const asset = await db.asset.findUnique({
      where: { id: parsed.data.assetId },
      select: { id: true, key: true },
    });
    if (!asset) return { status: 'error', message: t.media.notFound };

    let posterUrl: string | null = null;
    if (parsed.data.posterAssetId) {
      const poster = await db.asset.findUnique({
        where: { id: parsed.data.posterAssetId },
        select: { url: true, thumbnailUrl: true },
      });
      if (!poster) return { status: 'error', message: t.media.notFound };
      // 封面用于视频首帧，优先使用缩略图（体积更小、加载更快）
      posterUrl = poster.thumbnailUrl ?? poster.url;
    }

    await db.asset.update({ where: { id: asset.id }, data: { posterUrl } });

    await writeAssetAudit(
      user,
      'UPDATE',
      asset.id,
      posterUrl ? 'Set video poster' : 'Removed video poster',
      { key: asset.key },
    );
  } catch (error) {
    console.error('[admin] set asset poster failed:', error);
    return { status: 'error', message: t.actions.saveFailed };
  }

  revalidatePath('/', 'layout');
  return { status: 'success' };
}

// ---------------------------------------------------------------------------
// 删除（先查引用，必要时强制解绑）
// ---------------------------------------------------------------------------

export async function deleteAssetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { locale, t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return guard.error;
  const { user } = guard;

  const schema = z.object({
    id: z.string().trim().min(1, t.validation.invalidInput),
    force: flag,
  });
  const parsed = parseForm(schema, formData, t);
  if (!parsed.ok) return { status: 'error', message: parsed.message };

  const db = getPrisma();
  if (!db) return getDbUnavailableState(t);

  let storedKey: string | null = null;

  try {
    const asset = await db.asset.findUnique({
      where: { id: parsed.data.id },
      include: {
        slots: true,
        productMedia: { include: { product: { include: { translations: true } } } },
        productCovers: { include: { translations: true } },
        categoryCovers: { include: { translations: true } },
      },
    });
    if (!asset) return { status: 'error', message: t.media.notFound };

    // posterUrl 是一个 URL 而非外键，因此单独查出「把该素材当封面的视频」
    const posterUrls = [asset.url, asset.thumbnailUrl].filter(
      (value): value is string => Boolean(value),
    );
    const posterOf = posterUrls.length
      ? await db.asset.findMany({
          where: { id: { not: asset.id }, posterUrl: { in: posterUrls } },
          select: { id: true, key: true, type: true },
        })
      : [];

    const references = collectAssetReferences({ ...asset, posterOf }, locale, t);
    if (references.length > 0 && !parsed.data.force) {
      return {
        status: 'error',
        message: `${t.media.inUseTitle} ${describeAssetReferences(references)}`,
      };
    }

    storedKey = asset.key;

    // 强制删除：先解除全部引用，再删除素材本身，绝不给前台留下悬空引用
    await db.$transaction(async (tx) => {
      await tx.productMedia.deleteMany({ where: { assetId: asset.id } });
      await tx.product.updateMany({
        where: { coverAssetId: asset.id },
        data: { coverAssetId: null },
      });
      await tx.productCategory.updateMany({
        where: { coverAssetId: asset.id },
        data: { coverAssetId: null },
      });
      await tx.slotBinding.deleteMany({ where: { assetId: asset.id } });
      if (posterUrls.length) {
        await tx.asset.updateMany({
          where: { posterUrl: { in: posterUrls } },
          data: { posterUrl: null },
        });
      }
      await tx.asset.delete({ where: { id: asset.id } });
    });

    // 数据库删除成功后才清理磁盘文件
    try {
      await getStorage().remove(storedKey);
    } catch (error) {
      console.error('[admin] remove deleted media file failed:', error);
    }

    await writeAssetAudit(user, 'DELETE', asset.id, 'Deleted media', {
      key: storedKey,
      referencesRemoved: references.length,
    });
  } catch (error) {
    console.error('[admin] delete asset failed:', error);
    return { status: 'error', message: t.actions.deleteFailed };
  }

  revalidatePath('/', 'layout');
  // 素材已不存在，直接回到列表（避免停留在 404 详情页）
  redirect('/admin/media');
}

// ---------------------------------------------------------------------------
// 选择器数据（媒体库选择弹窗使用，只读）
// ---------------------------------------------------------------------------

export interface MediaPickerAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  label: string;
  size: number | null;
}

/**
 * 读取可在选择器中展示的素材（最多 60 条）。
 * 只返回已启用素材，避免把停用素材误绑到前台区块。
 */
export async function listMediaAssetsAction(input?: {
  q?: string;
  type?: 'image' | 'video' | 'all';
}): Promise<{ ok: boolean; assets: MediaPickerAsset[] }> {
  const { locale, t } = await getAdminMessagesForRequest();

  const guard = await requireAdminOrError(t);
  if ('error' in guard) return { ok: false, assets: [] };

  const db = getPrisma();
  if (!db) return { ok: false, assets: [] };

  const q = input?.q?.trim() ?? '';
  const type = input?.type ?? 'all';

  try {
    const rows = await db.asset.findMany({
      where: {
        enabled: true,
        ...(type === 'all' ? {} : { type: type === 'image' ? 'IMAGE' : 'VIDEO' }),
        ...(q
          ? {
              OR: [
                { originalName: { contains: q, mode: 'insensitive' as const } },
                { translations: { some: { title: { contains: q, mode: 'insensitive' as const } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 60,
      include: { translations: true },
    });

    return {
      ok: true,
      assets: rows.map((row) => ({
        id: row.id,
        type: row.type === 'VIDEO' ? 'video' : 'image',
        url: row.url,
        thumbnailUrl: row.thumbnailUrl,
        label:
          pickLocalizedText(row.translations, 'title', locale) ||
          row.originalName ||
          row.key,
        size: row.size,
      })),
    };
  } catch (error) {
    console.error('[admin] list media assets failed:', error);
    return { ok: false, assets: [] };
  }
}
