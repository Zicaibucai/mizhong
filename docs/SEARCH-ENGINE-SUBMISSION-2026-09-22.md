# 主动向搜索引擎报备（2026-09-22）

**结论先说**：能主动推送的开放协议只剩 **IndexNow**，它覆盖 Bing / Yandex / Naver / Seznam；
**Google 不在其中**，而且 Google 的 sitemap ping 端点 2023 年 6 月就已退役
（官方博文标题即 "Sitemaps ping endpoint is going away"）。Google 那条路只能在
Search Console 里做，没有可编程入口（Indexing API 只对 JobPosting/BroadcastEvent 生效，
商品页用不上）。

## 1. 已做的事

| 项 | 结果 |
| --- | --- |
| key 文件 | `public/58adf24b97e473e9446af94e5afaff87.txt`（文件名与内容一致，32 位十六进制） |
| 脚本 | `scripts/indexnow-submit.ts`：`check` / `submit`（`--limit` `--dry-run` `--engine` `--sitemap`） |
| 推送 | 2026-09-22 09:5x，**1430 条**（11 个语言首页 + 129 商品 × 11 语言）→ `HTTP 200` |
| 推送前自检 | 脚本会先验证 key 文件公网可达（不可达会导致整批 403/422） |

`api.indexnow.org` 是各参与引擎的共用入口；单独提交的端点见
`https://www.bing.com/indexnow`、`https://yandex.com/indexnow`、
`https://searchadvisor.naver.com/indexnow`、`https://search.seznam.cz/indexnow`。
批量上限 10000 条/请求（本次一次装下）。

**2xx 只代表「引擎已接收」，不等于已收录。** 收录结果在 Bing Webmaster Tools 的
IndexNow 报告里看。

## 2. 一个部署细节（容易踩）

`public/` 里新增文件**必须重启应用**才生效：Next 在**启动时**就把 public 目录的清单
固化了，只 `git pull` 的话运行中的进程会继续返回 404（本次实测：pull 后 404，
`pm2 reload mizhong-web` 后 200）。不需要重新构建。

## 3. 还没做的（都需要账号，得你来）

站点目前**没有任何站长平台验证**（`public/` 无验证文件、页面无验证 meta、
DNS 无 TXT 记录），所以先要证明「你是 htd123.com 的主人」：

| 平台 | 做什么 | 备注 |
| --- | --- | --- |
| **Google Search Console** | 添加资源 → 提交 `https://htd123.com/sitemap.xml` → 对重点页面用「网址检查 → 请求编入」 | 验证方式二选一：DNS TXT（在阿里云解析里加）或 HTML 文件/meta 标签（把 GSC 给的 token 发我，我放进 public/ 并部署） |
| **Bing Webmaster Tools** | 支持从 GSC 直接导入；导入后提交 sitemap，IndexNow 报告在这里看 | IndexNow 本身不需要账号，但报告需要 |
| **百度搜索资源平台**（可选） | 有独立的主推送 API（需 token），对出口导向的 B2B 站优先级低 | 若要就单独配 |

自动化（可选）：现在推送靠手动跑脚本。可以接到「发布商品」动作后面，做到内容一变
就报备 —— 需要处理超时与失败重试，别让外部接口拖慢发布。

本次推送的主要内容就是 130 个商品（见 `docs/PRODUCT-IMPORT-2026-09-21.md`）。
