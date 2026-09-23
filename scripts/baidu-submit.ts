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
 */
import { site } from '@/lib/site-config';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

const ENDPOINT = 'http://data.zz.baidu.com/urls';

interface Options {
  sitemap: string;
  limit: number;
  token?: string;
  urls?: string[];
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    sitemap: `${site.url}/sitemap.xml`,
    limit: 10,
    token: process.env.BAIDU_PUSH_TOKEN,
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
    } else if (flag === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
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
  const all = await collect(options);
  const list = all.slice(0, options.limit);

  console.log(`sitemap 共 ${all.length} 条，本次推送前 ${list.length} 条（百度每日配额由站点质量决定，别一次推光）`);

  if (options.dryRun) {
    list.forEach((url) => console.log(`  ${url}`));
    console.log('（dry-run，未发送）');
    return;
  }

  if (!options.token) {
    throw new Error(
      '缺少令牌：在百度搜索资源平台「普通收录 → 资源提交 → API 提交」复制 token，' +
        '用 BAIDU_PUSH_TOKEN=xxx 或 --token xxx 传入',
    );
  }

  const endpoint = `${ENDPOINT}?site=${encodeURIComponent(site.url)}&token=${encodeURIComponent(options.token)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: list.join('\n'),
  });
  const text = (await response.text()).slice(0, 500);
  console.log(`HTTP ${response.status} ${text.trim()}`);
  console.log('返回里的 success 是本次成功条数，remain 是当天剩余配额。');
}

main().catch((error) => {
  console.error('[baidu-submit] 失败：', error instanceof Error ? error.message : error);
  process.exit(1);
});
