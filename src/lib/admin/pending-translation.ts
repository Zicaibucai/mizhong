import type { PrismaClient } from '@prisma/client';

/**
 * 「这条内容现在是应急发布状态」的判定。
 *
 * 判定方式很直接：**这条内容最近一次发布是不是应急发布**。
 * 是的话，它的多语言就还没补齐 —— 中文已经上线，别的语言还停在上一版（或干脆没有）。
 *
 * 刻意不另存一个布尔标记：那需要「补齐成功时记得把它清掉」，而清标记的路径
 * 有自动补齐、手动重试、管理员直接改库……漏掉一处，警告就会永远挂着，
 * 于是所有人都会开始忽略它。用发布记录来判断，事实只有一个来源。
 */

export interface EmergencyPending {
  entityType: string;
  entityId: string;
  /** 应急发布的时间 */
  publishedAt: Date;
  /** 中文字段所在的版本 */
  revision: number;
  /** 管理员填写的原因 */
  reason: string | null;
  /** 当时翻译失败的类型 */
  failureKind: string | null;
}

/**
 * 查一条内容是否处于「应急发布、尚未补齐」的状态。
 *
 * 两次查询：最近一次应急发布、最近一次完整发布。后者比前者新就说明已经补齐了。
 */
export async function findPendingEmergency(
  db: PrismaClient,
  entityType: string,
  entityId: string,
): Promise<EmergencyPending | null> {
  const emergency = await db.contentRelease.findFirst({
    where: { entityType, entityId, kind: 'EMERGENCY' },
    orderBy: { publishedAt: 'desc' },
    select: { publishedAt: true, revision: true, reason: true, failureKind: true },
  });
  if (!emergency) return null;

  const full = await db.contentRelease.findFirst({
    where: { entityType, entityId, kind: 'FULL', publishedAt: { gt: emergency.publishedAt } },
    select: { id: true },
  });
  if (full) return null;

  return {
    entityType,
    entityId,
    publishedAt: emergency.publishedAt,
    revision: emergency.revision,
    reason: emergency.reason,
    failureKind: emergency.failureKind,
  };
}

/**
 * 编辑器要的那一份：应急发布状态 + 已经排好的补齐任务。
 *
 * 把任务 id 一并取回来，是为了让「立即重试」能接着推那个任务而不是新建一个 ——
 * 手动催一次不该在数据库里留下第二条平行的任务。
 */
export async function loadPendingEmergencyForEditor(
  db: PrismaClient,
  entityType: string,
  entityId: string,
): Promise<{
  reason: string | null;
  failureKind: string | null;
  jobId: string | null;
  publishedAt: string;
} | null> {
  const pending = await findPendingEmergency(db, entityType, entityId);
  if (!pending) return null;

  const job = await db.translationJob.findFirst({
    where: {
      kind: 'EMERGENCY_SYNC',
      status: { in: ['PENDING', 'RUNNING', 'PARTIAL', 'FAILED'] },
      items: { some: { entityType, entityId } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return {
    reason: pending.reason,
    failureKind: pending.failureKind,
    jobId: job?.id ?? null,
    publishedAt: pending.publishedAt.toISOString(),
  };
}

/**
 * 全站范围内所有「应急发布、尚未补齐」的内容，用于后台常驻提醒。
 *
 * 应急发布本身是罕见事件，所以这里先把应急发布的记录全取出来（正常情况下是个位数），
 * 再逐条看有没有更新的完整发布 —— 比「按内容扫一遍全部发布记录」便宜得多。
 */
export async function listPendingEmergencies(db: PrismaClient): Promise<EmergencyPending[]> {
  const emergencies = await db.contentRelease.findMany({
    where: { kind: 'EMERGENCY' },
    orderBy: { publishedAt: 'desc' },
    select: { entityType: true, entityId: true, publishedAt: true, revision: true, reason: true, failureKind: true },
    take: 200,
  });
  if (emergencies.length === 0) return [];

  // 同一条内容可能应急发布过多次，只保留最近的一次
  const latest = new Map<string, (typeof emergencies)[number]>();
  for (const row of emergencies) {
    const key = `${row.entityType}:${row.entityId}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  const pending: EmergencyPending[] = [];
  for (const row of latest.values()) {
    const done = await db.contentRelease.findFirst({
      where: {
        entityType: row.entityType,
        entityId: row.entityId,
        kind: 'FULL',
        publishedAt: { gt: row.publishedAt },
      },
      select: { id: true },
    });
    if (done) continue;
    pending.push({
      entityType: row.entityType,
      entityId: row.entityId,
      publishedAt: row.publishedAt,
      revision: row.revision,
      reason: row.reason,
      failureKind: row.failureKind,
    });
  }

  return pending;
}
