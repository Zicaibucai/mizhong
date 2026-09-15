import { Prisma, type AuditAction } from '@prisma/client';
import { tryDb } from '@/lib/db';
import { headers } from 'next/headers';

export interface AuditInput {
  userId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  summary?: string | null;
  detail?: Prisma.InputJsonValue | null;
}

async function resolveIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    return forwarded ? forwarded.split(',')[0]?.trim() ?? null : null;
  } catch {
    return null;
  }
}

/**
 * 写入操作审计记录。
 * 审计失败不影响主流程（仅记录服务端日志）。
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  const ip = await resolveIp();
  await tryDb((db) =>
    db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        summary: input.summary ?? null,
        detail: input.detail ?? undefined,
        ip,
      },
    }),
  );
}
