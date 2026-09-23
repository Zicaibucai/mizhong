/**
 * 百度「普通收录」主动推送（2026-09-23 新增，配合用户提问：百度为什么没收录）。
 *
 * 与 `indexnow-submit.ts` 是同一个套路，只是协议不同：
 *   POST http://data.zz.baidu.com/urls?site=<站点>&token=<令牌>
 *   body = 每行一个 URL
 *
 * 三个与 IndexNow 不同的地方，必须说清楚：
 *   1. **令牌必须来自用户的百度账号**：在「百度搜索资源平台」(ziyuan.baidu.com) 添加站点、
 *      验证归属后，在「普通收录 → 资源提交 → API 提交」里拿到 token。脚本不生成、不猜令牌。
 *   2. **每日配额由百度按站点质量分配**，新站可能只有几条到几十条 —— 所以默认 `--limit 10`，
 *      别一次把 1400 多个地址推光（推了也不会被收，还可能浪费配额）。
 *   3. 百度对**境外服务器且未备案**的站点抓取优先级本来就低；这个脚本只是把能做的做满，
 *      不保证收录速度。
 *
 * 用法：
 *   BAIDU_PUSH_TOKEN=xxx npx tsx scripts/baidu-submit.ts --dry-run
 *   BAIDU_PUSH_TOKEN=xxx npx tsx scripts/baidu-submit.ts            # 默认只推前 10 条
 *   BAIDU_PUSH_TOKEN=xxx npx tsx scripts/baidu-submit.ts --limit 50
 *   BAIDU_PUSH_TOKEN=xxx npx tsx scripts/baidu-submit.ts --urls https://htd123.com/zh,https://htd123.com/en
 *
 *   # 每天自动推（cron 用的就是这条）：从上次的位置接着推 10 条，推完一轮从头再来
 *   BAIDU_PUSH_TOKEN=xxx npx tsx scripts/baidu-submit.ts --rotate
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { site } from '@/lib/site-config';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

const ENDPOINT = 'http://data.zz.baidu.com/urls';

/**
 * 轮换游标：记着「上一天推到 sitemap 的第几条」。
 *
 * 为什么需要：百度给未备案新站的配额只有 10 条/天，而我们有 1400 多个地址 ——
 * 一次推完不可能，只能每天推一小段。游标文件放在上传目录旁边（不进 Git），
 * 推完一轮后从头再来（重要的页面因此会被周期性重推）。
 */
const CURSOR_FILE = process.env.BAIDU_PUSH_CURSOR ?? '/opt/mizhong-data/baidu-push-cursor.txt';

interface Options {
  sitemap: string;
  limit: number;
  token?: string;
  urls?: string[];
  /** 只推这些语言的地址（逗号分隔），缺省推全部。百度服务中文搜索，默认 cron 用 zh,en */
  locales?: string[];
  rotate: boolean;
  dryRun: boolean;
}

/** sitemap 里的地址 → 该地址属于哪个语言（取路径第一段） */
function localeOf(url: string): string | null {
  try {
    const first = new URL(url).pathname.split('/').filter(Boolean)[0] ?? '';
    return first || null;
  } catch {
    return null;
  }
}

function filterByLocales(urls: string[], locales: string[] | undefined): string[] {
  if (!locales?.length) return urls;
  const wanted = new Set(locales);
  return urls.filter((url) => {
    const locale = localeOf(url);
    return locale !== null && wanted.has(locale);
  });
}

/**
 * 按 `--locales` 给的顺序重排：`zh,en` → 所有中文页排在英文页前面。
 *
 * 为什么：轮换是「一天推 10 条」，如果中英文交错，头半个月的中文页只推了一半。
 * 用户要求「先把所有中文页面推完」—— 排序就够，不需要额外的状态或阶段切换：
 * 131 个中文页 ≈ 14 天推完，之后才轮到英文页。
 * 同语言内部保持 sitemap 原顺序（Array.sort 是稳定的）。
 */
function orderByLocalePriority(urls: string[], locales: string[] | undefined): string[] {
  if (!locales?.length) return urls;
  const rank = new Map(locales.map((locale, index) => [locale, index]));
  return [...urls].sort((a, b) => {
    const ra = rank.get(localeOf(a) ?? '') ?? locales.length;
    const rb = rank.get(localeOf(b) ?? '') ?? locales.length;
    return ra - rb;
  });
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    sitemap: `${site.url}/sitemap.xml`,
    limit: 10,
    token: process.env.BAIDU_PUSH_TOKEN,
    rotate: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--sitemap' && value) {
      options.sitemap = value;
      i += 1;
    } else if (flag === '--token' && value) {
      options.token = value;
      i += 1;
    } else if (flag === '--limit' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = parsed;
      i += 1;
    } else if (flag === '--urls' && value) {
      options.urls = value.split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
    } else if (flag === '--locales' && value) {
      options.locales = value.split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
    } else if (flag === '--rotate') {
      options.rotate = true;
    } else if (flag === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function readCursor(): Promise<number> {
  try {
    const raw = (await fs.readFile(CURSOR_FILE, 'utf8')).trim();
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

async function writeCursor(value: number): Promise<void> {
  await fs.mkdir(path.dirname(CURSOR_FILE), { recursive: true });
  await fs.writeFile(CURSOR_FILE, `${value}\n`, 'utf8');
}

async function collect(options: Options): Promise<string[]> {
  if (options.urls?.length) return options.urls;
  const response = await fetch(options.sitemap, { headers: { 'user-agent': 'mizhong-baidu/1.0' } });
  if (!response.ok) throw new Error(`取 sitemap 失败：HTTP ${response.status}`);
  const body = await response.text();
  const urls = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(urls)];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const collected = await collect(options);
  // 显式给了 --urls 就照单全推；从 sitemap 取时才按语言过滤 + 按语言优先级排序
  const all = options.urls?.length
    ? collected
    : orderByLocalePriority(filterByLocales(collected, options.locales), options.locales);
  if (options.locales?.length && !options.urls?.length) {
    console.log(`语言过滤：${options.locales.join(', ')} → ${all.length} 条（过滤前 ${collected.length} 条）`);
  }

  let cursor = 0;
  let list: string[];
  if (options.rotate) {
    cursor = await readCursor();
    if (cursor >= all.length) cursor = 0; // 推完一轮：从头再来
    const rest = all.slice(cursor);
    list =
      rest.length >= options.limit
        ? rest.slice(0, options.limit)
        : [...rest, ...all.slice(0, options.limit - rest.length)];
    console.log(`轮换模式：从第 ${cursor} 条开始推 ${list.length} 条（共 ${all.length} 条）`);
  } else {
    list = all.slice(0, options.limit);
    console.log(`sitemap 共 ${all.length} 条，本次推送前 ${list.length} 条`);
  }

  if (options.dryRun) {
    list.forEach((url) => console.log(`  ${url}`));
    console.log(`（dry-run，未发送；${options.rotate ? '游标不动' : ''}）`);
    return;
  }

  if (!options.token) {
    throw new Error(
      '缺少令牌：在百度搜索资源平台「普通收录 → 资源提交 → API 提交」复制 token，' +
        '用 BAIDU_PUSH_TOKEN=xxx 或 --token xxx 传入',
    );
  }

  /**
   * 注意：`site` 参数**绝不能做 URL 编码**。
   *
   * 百度那边拿到编码后的值（`https%3A%2F%2F…`）匹配不到站点，会返回
   * `{"error":400,"message":"site init fail"}` —— 这个报错极具误导性，
   * 看起来像「站点没初始化」，实际是参数形式问题（2026-09-23 实测：
   * 同一 token、同一批地址，编码后 400、不编码 200）。
   * 百度文档给的示例也是原样写 `?site=https://example.com`。
   */
  const endpoint = `${ENDPOINT}?site=${site.url}&token=${options.token}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: list.join('\n'),
  });
  const text = (await response.text()).slice(0, 500);
  console.log(`HTTP ${response.status} ${text.trim()}`);

  let parsed: { success?: number; remain?: number; message?: string } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // 不是 JSON 就按原样打印（上面已经打过），继续走游标逻辑的失败分支
  }

  if (typeof parsed.remain === 'number') console.log(`当天剩余配额：${parsed.remain} 条`);

  if (options.rotate) {
    // 游标只按「百度实际接收的条数」推进：接收 0 条时原地不动，
    // 保证不会有地址被静默跳过（失败的下一轮重来）。
    if (response.ok && typeof parsed.success === 'number' && parsed.success > 0) {
      const next = (cursor + parsed.success) % all.length;
      await writeCursor(next);
      console.log(`游标推进：${cursor} → ${next}（接收 ${parsed.success} 条；推完 ${all.length} 条会从头再来）`);
    } else if (response.ok && parsed.success === 0) {
      console.log('百度一条都没接收（配额用尽或地址已存在），游标保持不动');
    } else {
      console.log('本次未成功，游标保持不动 —— 明天会重推同一段，不会跳过');
    }
  }
}

main().catch((error) => {
  console.error('[baidu-submit] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
