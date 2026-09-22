/**
 * IndexNow 主动推送：内容新增/更新后，主动告诉搜索引擎「来抓这些地址」，
 * 不必等爬虫自己发现。
 *
 * 覆盖范围要说清楚（2026-09 查证 indexnow.org 官方文档）：
 *   - 参与方：**Bing、Yandex、Naver、Seznam**（`api.indexnow.org` 是它们的共用入口）；
 *   - **Google 不在其中**，而且 Google 的 sitemap ping 端点 2023 年 6 月就已退役
 *     （博文标题即 "Sitemaps ping endpoint is going away"）。Google 那条路只有在
 *     Search Console 里提交 sitemap + 对重点页面手动请求编入，没有可编程接口
 *     （Indexing API 只对 JobPosting/BroadcastEvent 生效，商品页用不上）。
 *
 * key 的来源是**仓库里的那个公网 key 文件**（public/<key>.txt，文件名与内容一致），
 * 这里不另存一份，避免两处不一致 —— 推送前会先验证它真的能公网访问，
 * 因为理论上「key 文件不可访问」会导致整批被拒（403/422）。
 *
 * 用法（本地或服务器都行，只需要能访问公网）：
 *   npx tsx scripts/indexnow-submit.ts check                    # 只验证 key 文件
 *   npx tsx scripts/indexnow-submit.ts submit --dry-run         # 只打印将要推送的地址
 *   npx tsx scripts/indexnow-submit.ts submit                   # 按 sitemap 全量推送
 *   npx tsx scripts/indexnow-submit.ts submit --limit 50        # 只推前 50 条（试水）
 *   npx tsx scripts/indexnow-submit.ts submit --sitemap <url> --engine <endpoint>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { site } from '@/lib/site-config';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

const BATCH_LIMIT = 10_000;

interface Options {
  command: string;
  sitemap: string;
  engine: string;
  limit?: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const [command = 'check', ...rest] = argv;
  const options: Options = {
    command,
    sitemap: `${site.url}/sitemap.xml`,
    engine: 'https://api.indexnow.org/indexnow',
    dryRun: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === '--sitemap' && value) {
      options.sitemap = value;
      index += 1;
    } else if (flag === '--engine' && value) {
      options.engine = value;
      index += 1;
    } else if (flag === '--limit' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = parsed;
      index += 1;
    } else if (flag === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

/** 从 public/ 里找 IndexNow 的 key 文件：文件名（去掉 .txt）与文件内容相同 */
async function readKeyFile(): Promise<{ key: string; file: string }> {
  const dir = path.join(process.cwd(), 'public');
  const entries = await fs.readdir(dir);
  for (const name of entries) {
    if (!name.endsWith('.txt')) continue;
    const key = name.slice(0, -4);
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) continue;
    const content = (await fs.readFile(path.join(dir, name), 'utf8')).trim();
    if (content === key) return { key, file: name };
  }
  throw new Error('public/ 里没有找到 IndexNow key 文件（文件名需与内容一致，8~128 位字母数字）');
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(url, { headers: { 'user-agent': 'mizhong-indexnow/1.0' } });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

async function readSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const { ok, status, body } = await fetchText(sitemapUrl);
  if (!ok) throw new Error(`取 sitemap 失败：HTTP ${status} ${sitemapUrl}`);
  const urls = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
  return [...new Set(urls)];
}

async function submit(options: Options) {
  const { key, file } = await readKeyFile();
  const keyLocation = `${site.url}/${file}`;

  // key 文件必须先能被公网访问，否则整批会被拒
  const probe = await fetchText(keyLocation);
  if (!probe.ok || probe.body.trim() !== key) {
    throw new Error(`key 文件不可用（HTTP ${probe.status}）：${keyLocation} —— 先部署再推送`);
  }
  console.log(`key 文件可用：${keyLocation}`);

  const urls = await readSitemapUrls(options.sitemap);
  const host = new URL(options.sitemap).host;
  const list = options.limit ? urls.slice(0, options.limit) : urls;
  console.log(`待推送 ${list.length} 条地址（sitemap 共 ${urls.length} 条，host=${host}）`);

  if (options.dryRun) {
    list.slice(0, 5).forEach((url) => console.log(`  ${url}`));
    if (list.length > 5) console.log(`  … 其余 ${list.length - 5} 条`);
    console.log('（dry-run，未发送）');
    return;
  }

  let sent = 0;
  for (let start = 0; start < list.length; start += BATCH_LIMIT) {
    const batch = list.slice(start, start + BATCH_LIMIT);
    const response = await fetch(options.engine, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: batch }),
    });
    const text = (await response.text()).slice(0, 300);
    // 200/202 = 已接收；403 = key 无效或不被认可；422 = 地址与 host 不匹配；429 = 推得太频繁
    console.log(`第 ${start / BATCH_LIMIT + 1} 批：${batch.length} 条 → HTTP ${response.status} ${text.trim()}`);
    sent += batch.length;
  }
  console.log(`已推送 ${sent} 条。注意 2xx 只代表「引擎已接收」，不等于已收录。`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === 'check') {
    const { key, file } = await readKeyFile();
    const keyLocation = `${site.url}/${file}`;
    const probe = await fetchText(keyLocation);
    console.log(`key=${key}  keyLocation=${keyLocation}`);
    console.log(`HTTP ${probe.status}，内容${probe.body.trim() === key ? '一致' : '不一致'}`);
    return;
  }

  if (options.command === 'submit') return submit(options);

  console.error('用法：check | submit  [--sitemap <url>] [--engine <endpoint>] [--limit N] [--dry-run]');
  process.exit(1);
}

main().catch((error) => {
  console.error('[indexnow] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
