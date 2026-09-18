/**
 * 语言同步的命令行入口。
 *
 * 存在的理由：后台那个「同步全部」按钮很好用，但**首次全站同步**（几十条内容 ×
 * 十种语言）不该依赖某个人的浏览器一直开着。这个脚本驱动的是**同一个任务引擎**、
 * 同一套幂等键、同一份审计 —— 它不是绕开后台的临时脚本，只是另一个入口。
 *
 * 需求里禁止的是「用临时脚本直接写生产数据」；这里一行 SQL 都不写，
 * 全部经由与后台完全相同的 `syncEntity`，而且照样受翻译设置与限流约束。
 * 它也不会碰中文原文：同步只读中文、只写其它语言。
 *
 * 用法：
 *   npx tsx scripts/translation-sync.ts status               # 只看还差多少，不发请求也不写库
 *   npx tsx scripts/translation-sync.ts sync                 # 同步全部已发布的中文内容
 *   npx tsx scripts/translation-sync.ts sync --limit 5       # 只处理前 5 条内容
 *   npx tsx scripts/translation-sync.ts sync --type product --id <商品id>
 *   npx tsx scripts/translation-sync.ts retry                # 只重试最近一次任务里失败的
 *
 * 安全约定：任何输出里都不会出现 API Key、原文或译文全文 —— 只有条数与状态。
 */
import type { PrismaClient } from '@prisma/client';
import { locales } from '@/lib/i18n/config';
import { getPrisma } from '@/lib/db';
import { loadTranslationSettings } from '@/lib/translation/settings';
import {
  advanceJob,
  collectScope,
  createJob,
  createRetryJob,
  listRecentJobs,
} from '@/lib/translation/jobs';
import { planSync } from '@/lib/translation/state';
import { isContentType, type ContentType } from '@/lib/translation/adapters';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

interface Options {
  command: string;
  type?: string;
  id?: string;
  limit?: number;
}

function parseArgs(argv: string[]): Options {
  const [command = 'status', ...rest] = argv;
  const options: Options = { command };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === '--type' && value) {
      options.type = value;
      index += 1;
    } else if (flag === '--id' && value) {
      options.id = value;
      index += 1;
    } else if (flag === '--limit' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = parsed;
      index += 1;
    }
  }
  return options;
}

/**
 * 一轮一轮推进到跑完。
 *
 * 与后台按钮走的是同一个 `advanceJob` —— 每次只跑一段预算，因此单次调用不会
 * 长时间挂着。断点在数据库里，这个进程被杀掉也不会丢进度，重跑接着做。
 */
async function runToCompletion(db: PrismaClient, jobId: string): Promise<void> {
  const settings = await loadTranslationSettings(db);
  if (!settings.apiKey) {
    console.error('DeepSeek 还没有配置（后台「翻译设置」或 DEEPSEEK_API_KEY）。一个请求都不会发。');
    process.exitCode = 1;
    return;
  }

  let guard = 0;
  for (;;) {
    const advanced = await advanceJob(db, settings, jobId, { budgetMs: 20_000 });
    if (!advanced) {
      console.error(`任务 ${jobId} 不存在。`);
      process.exitCode = 1;
      return;
    }

    const { progress } = advanced;
    console.log(
      `  进度 ${progress.completedItems}/${progress.totalItems}，失败 ${progress.failedItems}，` +
        `请求 ${progress.requestCount}，约 ${progress.tokenEstimate} tokens`,
    );

    if (!advanced.hasMore) {
      console.log(`\n任务结束：${progress.status}。`);
      if (progress.failures.length > 0) {
        console.log('失败明细（前 50 条）：');
        for (const failure of progress.failures) {
          console.log(`  ${failure.entityType} ${failure.entityId} ${failure.locale}: ${failure.error}`);
        }
      }
      return;
    }

    guard += 1;
    // 防御性上限：正常不会触发，但「循环永远不会退出」比「提前结束」糟得多
    if (guard > 5_000) {
      console.error('推进次数异常，已停止。任务状态已保存在数据库里，可以重新运行。');
      process.exitCode = 1;
      return;
    }
  }
}

/** 只读盘点：每条内容还差多少种语言。**不发任何请求，也不写任何东西。** */
async function printStatus(db: PrismaClient): Promise<void> {
  const targets = await collectScope(db);
  console.log(`已发布的中文内容共 ${targets.length} 条。\n`);

  let pendingEntities = 0;
  let totalPending = 0;
  const byType = new Map<string, number>();

  for (const target of targets) {
    const plan = await planSync(db, target.entityType, target.entityId);
    if (!plan) continue;

    const pending = plan.locales.filter((item) => item.state !== 'synced' && item.state !== 'empty');
    if (pending.length === 0) continue;

    pendingEntities += 1;
    totalPending += pending.length;
    byType.set(target.entityType, (byType.get(target.entityType) ?? 0) + 1);

    const failed = pending.filter((item) => item.state === 'failed').length;
    console.log(
      `  [${target.entityType}] ${target.label}` +
        `${target.hint ? ` (${target.hint})` : ''} — 待同步 ${pending.length} 种语言` +
        `${failed > 0 ? `，其中失败 ${failed}` : ''}，中文第 ${plan.revision} 版`,
    );
  }

  if (pendingEntities === 0) {
    console.log('  （没有待同步的内容 —— 一个请求都不会发。）');
    return;
  }

  console.log(`\n合计：${pendingEntities} 条内容、${totalPending} 个「内容 × 语言」待同步。`);
  for (const [type, count] of byType) console.log(`  ${type}: ${count} 条`);
}

async function printRecentJobs(db: PrismaClient): Promise<void> {
  const jobs = await listRecentJobs(db, 5);
  if (jobs.length === 0) return;

  console.log('\n最近任务：');
  for (const job of jobs) {
    console.log(
      `  ${job.id} ${job.status} ${job.completedItems}/${job.totalItems}` +
        `${job.failedItems > 0 ? ` 失败 ${job.failedItems}` : ''}` +
        ` 请求 ${job.requestCount} 约 ${job.tokenEstimate} tokens` +
        `${job.lastError ? ` (${job.lastError})` : ''}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = getPrisma();
  if (!db) {
    console.error('DATABASE_URL 未配置，无法连接数据库。');
    process.exitCode = 1;
    return;
  }

  if (options.command === 'status') {
    await printStatus(db);
    await printRecentJobs(db);
    return;
  }

  if (options.command === 'retry') {
    const [last] = await listRecentJobs(db, 1);
    if (!last) {
      console.log('还没有任何同步任务。');
      return;
    }
    const retry = await createRetryJob(db, last.id);
    if (!retry) {
      console.log(`最近的任务 ${last.id} 没有失败项，无需重试。`);
      return;
    }
    console.log(`重试任务 ${retry.jobId}（${retry.totalItems} 个工作项）…`);
    await runToCompletion(db, retry.jobId);
    return;
  }

  if (options.command === 'sync') {
    let targets;
    if (options.id) {
      if (!options.type || !isContentType(options.type)) {
        console.error('指定 --id 时必须同时给出合法的 --type（product / page / company / contact / nav / category / asset）。');
        process.exitCode = 1;
        return;
      }
      targets = [{ entityType: options.type as ContentType, entityId: options.id, label: options.id }];
    } else {
      targets = await collectScope(db);
    }

    const limited = options.limit ? targets.slice(0, options.limit) : targets;
    if (limited.length === 0) {
      console.log('没有需要同步的内容。');
      return;
    }

    const localeCount = locales.length - 1;
    console.log(`准备同步 ${limited.length} 条内容 × ${localeCount} 种语言。`);

    const { jobId, created, totalItems } = await createJob(db, {
      kind: 'SYNC_ALL',
      targets: limited,
      // 指定单条时用固定键：重复执行命中同一个任务，不会翻两遍
      idempotencyKey: options.id ? `cli:${options.type}:${options.id}` : null,
    });
    console.log(created ? `已创建任务 ${jobId}（${totalItems} 个工作项）。` : `复用进行中的任务 ${jobId}。`);

    await runToCompletion(db, jobId);
    return;
  }

  console.log(
    [
      '用法：',
      '  npx tsx scripts/translation-sync.ts status',
      '  npx tsx scripts/translation-sync.ts sync [--limit N] [--type product --id <id>]',
      '  npx tsx scripts/translation-sync.ts retry',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error('同步脚本执行失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
