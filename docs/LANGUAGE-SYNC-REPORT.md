# 交接任务最终报告

日期 2026-09-18 ｜ 起点 `6a96b44` ｜ 终点 `c0502de`（本地 main，**未推送**）

---

## 1. 初始 Git 状态与未提交修改的处理

**起始状态**：HEAD `6a96b44`，与 origin/main 一致，工作区有 2 个已修改文件 + 4 项未跟踪：

```
 M src/app/(site)/[locale]/products/[slug]/page.tsx
 M src/lib/catalog.ts
?? .playwright-cli/  k.html  output/  sg.html
```

那 2 个已修改文件就是交接里说的「严格语言回退实验」。

**处理方式，以及我做错又改回来的地方：**

我第一次提交时用了 `git add -A`，把这份未提交的实验**一并提交到了 main**。
代码没有丢，但这样部署第一阶段就会把它带上 —— 而它有个已知后果（第 13 节实测确认）：
线上两个正式商品只有中文，严格规则会让 20 个原本返回 200 的地址变成 404。

处理办法不是删掉它，而是加开关：`STRICT_LOCALE_FALLBACK`，**默认关闭**。
关闭时逐字保留改造前的旧行为（`pickTranslation` 的 `英文 → rows[0]` 兜底、
目录不过滤、hreflang 列全部语言）。第三阶段全站翻译完成后置为 `true` 再 reload 即可，
不用改代码、不用重新构建。

同样的 `git add -A` 还把工作区里原本未跟踪的排查产物（`k.html`、`sg.html`、
`output/playwright/*.png`、`.playwright-cli/`）扫进了版本库。已在 `ff1aeef` 里
**从索引移除**（磁盘文件原样保留，那是之前会话留下的东西，不该由我决定删），
并写进 `.gitignore`。

**没有** reset、checkout 或覆盖任何无关文件；除了上面这批误入的产物（已纠正），
用户与此前 AI 的改动都完整保留。

---

## 2. 可翻译的内容类型与字段清单

路由在 `src/lib/translation/adapters.ts`，每种内容类型一个适配器。新增类型只需加一个适配器，
同步中心、发布保险、命令行会自动认得它。

| 内容类型 | 字段 |
| --- | --- |
| 商品 | 名称、一句话介绍、完整介绍、尺寸摘要、规格说明、应用场景、SEO 标题、SEO 描述 |
| | 规格表列名；规格表单元格（路径按 **行 id + 列 id**，不是数组下标） |
| | 型号/颜色选项组名称；选项名称 |
| | 旧版「参数」表的名称与值（specTable 之前的数据） |
| 页面（含首页） | 页面标题、SEO 标题、SEO 描述 |
| | 每个区块的标题、副标题、正文、按钮文字 |
| 公司资料 | 公司名称、标语、公司介绍、定位、地址、营业时间、SEO 标题、SEO 描述 |
| 联系方式 | label（「销售咨询」这类说明文字）；地址类型额外翻 `value` |
| 导航 | 导航文字 |
| 商品类目 | 类目名称、类目说明 |
| 素材 | 标题、说明、alt 替代文字 |

「图片 alt」落在素材（Asset）上而不是商品上 —— 同一张图被多个商品复用时只翻一次。

---

## 3. 尚未覆盖的访客可见中文，以及原因

**刻意不翻的结构字段**（送进模型只会翻出错误的值）：

| 字段 | 原因 |
| --- | --- |
| 所有 slug | 它是网址不是文案。改 slug 会 301 重定向（第 6 节） |
| 区块的 `ctaHref`（按钮链接） | 链接是结构。前台渲染时 `withLocale` 会补当前语言前缀 |
| 素材的 key / url | 路径 |
| 价格、货币、计价单位、起订量、SKU、型号代码 | 数字与代号 |
| 联系方式里**非地址类型**的 `value` | 电话、邮箱、WhatsApp 号、微信号 —— 翻了最好的结果是原样返回，最坏的结果是打不通 |
| 推荐位、排序、开关、分类归属 | 配置 |

**未接入翻译的后台可配置内容**：

- `SiteSetting`（站点 URL、默认语言、SEO 默认值）—— 是配置不是内容，前台不直接渲染成文案。
- `Inquiry`（访客提交的询盘）—— 用户输入，不是要本地化的内容。

**仍然用 i18n 字典而非 DeepSeek 的部分**：后台界面、前台固定文案
（按钮、表单标签、错误提示、页脚版权行等）。这些在 `src/lib/i18n/dictionaries/`
与 `catalog.ts` 里，本来就已是 11 种语言，按需求要求两套不混。

---

## 4. 数据库模型与迁移

迁移文件：`prisma/migrations/20260918140000_translation_sync_and_releases/migration.sql`
（183 行，由 `prisma migrate diff` 从新旧 schema **本地生成**，未连接任何数据库）

**纯新增**：5 个枚举、4 个可空列、7 张新表。没有 DROP，没有给已有表加 NOT NULL。

| 模型 | 作用 |
| --- | --- |
| `ContentRevision` | 每个实体的中文版本号 + 内容哈希。哈希判断「到底变没变」，整数版本号给人看 |
| `TranslationState` | 一行 = 一个「内容 × 语言」。逐字段明细在 `fields` JSON 里 |
| `ContentRelease` | 一次成功发布的记录（revision、参与语言、结果、发布人） |
| `TranslationJob` / `TranslationJobItem` | 长任务与逐语言工作项 |
| `PageVersion` | 页面版本快照（与 ProductVersion 同形） |
| `SlugHistory` | 旧 slug → 新 slug 的 301 |
| `Page.draftData` | 页面草稿（与商品的 draftData 同一套做法） |
| `ProductVersion.releaseId` | 把商品版本与那次发布串起来 |

---

## 5. 翻译状态与版本设计

**状态是每次读的时候现场算出来的，不是存下来的。**

`TranslationState.status` 只记录**上一次尝试的结果**（成功 / 失败 / 进行中）；
「现在该不该重翻」由「当前中文哈希 vs 翻译当时记录的哈希」现场比较得出。

理由：存一份 STALE 标记意味着「中文一改就要记得把标记写对」，而写中文的入口有很多 ——
漏掉一处，那个字段就永远显示「已同步」而实际停在旧版本上。这类 bug 不报错。

判定规则（`document.ts` 的 `diffUnits`）：

1. 没有译文 → `missing`，翻；
2. 有译文、**没有记录** → `synced`，**认下来不覆盖**（见下）；
3. 有记录且哈希一致 → `synced`；不一致 → `stale`，翻。

第 2 条是有意为之：生产库里首页、公司资料、导航**已经有手写的 en/vi**。
按「没记录就重翻」会把这些直接覆盖掉且不可撤销，而需求 6.7 要求保留人工调整过的译文。
认下来的字段**必须补上哈希**（`adoptUntrackedTranslations`，纯写库零调用）——
不补的话以后中文改了它们也检测不出过期。代价是：中文若在功能上线**之前**改过、
旧译文没跟着改，机器判断不出来，用同步中心的「重新翻译全部语言」（force）兜底。

**版本**：商品与页面都是「保存写草稿 → 发布才写线上 → 发布留一版快照、清草稿」，
最多 3 版，恢复写回**草稿**（不直接改线上，误点可退）。回滚与删除会同时清掉同步状态 ——
内容整体换掉却没经过翻译引擎，不清的话记录会描述一个已不存在的版本。
每次成功发布写一条 `ContentRelease`，版本快照带 `releaseId`，因此「这些语言是不是
同一次发布出去的」可以直接查证。

---

## 6. 一键翻译 / 自动发布 / 全站同步的流程

**一键翻译**（商品）：扫 DOM 取表单里的最新中文 → 服务端按白名单收敛 → 算清「有没有可写位置」
（没有就零调用返回）→ DeepSeek → 按 `语言_字段` 名字逐个回填 → 触发自动保存写进草稿。

**一键翻译**（页面）：页面是「页面信息 + 每个区块各一个表单」，浏览器一次只能提交一个。
按钮先把每个表单逐个交给服务端保存（await 到每一个都完成），再让服务端按草稿里
刚保存的最新中文翻译。结果一样，而且翻译失败时编辑已经存好了。

**发布**：校验 → **同步保险**（没有待同步字段就零调用放行；跑不完就把 jobId 交回界面
继续推；任何目标语言失败就**放弃发布**，线上保持原样）→ 重新读一次草稿 →
一次事务写入线上 + 记录 release + 留一版 + 清草稿。

**全站同步**：`/admin/sync` 或 `npm run translation:sync`。两者驱动**同一个**任务引擎、
同一套幂等键、同一份审计。命令行适合首次全量（不依赖浏览器开着）。

**长任务**：任务与工作项状态落在数据库，每次推进只跑一段预算（后台 15~20 秒，命令行 20 秒）。
断点就是工作项自己的状态（PENDING/SYNCED/FAILED/SKIPPED），不另记游标。
幂等键带上中文版本号；并发用会超时的锁挡住。收尾时**再算一次同步计划** ——
工作项说「都成功了」不等于内容真的同步了，同步中途有人改中文的话会以 `PARTIAL` 结束
并让发布失败。

---

## 6.5 应急发布（第二轮追加）

「应急发布中文，其他语言稍后同步」—— DeepSeek 故障时的兜底，**不是绕过翻译的常规出口**。

### 它什么时候出现

默认不显示。只有发布**真的尝试过翻译**、并且失败原因属于「服务暂时不可用」才有：

| 出现 | 不出现（界面会说明下一步） |
| --- | --- |
| 超时、网络错误、429、DeepSeek 5xx | 没配 Key / Key 被拒 → 去「翻译设置」 |
| | 返回结构不对、模型漏翻 → 数据结构错误，重试 |
| | 中文同步途中被改过 → 再点一次发布 |
| | 内容校验不过 → 应急绕过的是翻译，不是内容规范 |

服务端会**自己重试一次翻译**再判定，不采信客户端的说法。

### 它做了什么、不做什么

做：只把中文写上线；已有的外语原样保留（继续显示上一次成功发布的版本）；
写一条独立的发布记录（操作人、原因、失败类型、中文 sourceRevision、
哪些语言停在旧版 / 仍然缺失）；记一条同样内容的审计日志；自动排一个补齐任务；
后台每一页顶部常驻「多语言待同步」警告。

不做：**不伪造任何同步状态** —— 不写来源哈希、不推进中文版本号，只把受影响的
语言标记为待同步；**不给没有译文的语言造记录**；**不因为它们进 hreflang 或 sitemap**。

### 故障恢复

补齐任务被钉在**刚刚发布的那一版中文**上（`sourceHash`）。翻译服务恢复后自动跑完、
自动发布一次「语言补齐版本」，警告随之消失。「立即重试」走同一个任务。
**中文在故障期间又改过的话，旧任务整批作废**（`source-changed`），一个字段都不会写回去。

---

## 7. 修改文件与提交哈希

```
c0502de feat: emergency publish, with automatic catch-up and a real invalidation guard
ff1aeef chore: untrack the stray debug artifacts that slipped into earlier commits
a0de3a9 fix: bound the sitemap's database query so a slow database cannot hang it
9399ad4 feat: adopt existing hand-written translations instead of overwriting them
0485a87 feat: make the strict locale fallback opt-in, and add slug redirects
16656f1 feat: add the command-line runner, and tests for jobs, documents and strict fallback
77fe1a6 feat: give pages the same draft, publish-sync and version treatment as products
bd4016f feat: publish now carries its own translation sync, and add the sync centre
86c4b75 feat: unify the translation engine across every content type
d57dad3 feat: add the schema for site-wide translation sync, releases and jobs
```

**新增 24 个文件**（节选）：翻译内核 `src/lib/translation/{document,adapters,state,engine,jobs,batch,prompt}.ts`、
页面草稿 `src/lib/page-draft.ts`、页面草稿存储 `src/lib/admin/page-draft-store.ts`、
slug 重定向 `src/lib/slug-history.ts`、同步中心 `src/app/(admin)/admin/(protected)/sync/*`、
命令行 `scripts/translation-sync.ts`、迁移 `prisma/migrations/20260918140000_*/migration.sql`、
测试 6 个文件、文档 `docs/LANGUAGE-SYNC.md`。

**修改 21 个文件**（节选）：`catalog.ts`（严格回退加开关）、`sitemap.ts`（列真实内容 + 超时）、
`admin/actions/{products,pages,sync,translation}.ts`、`product-action-bar.tsx`、
页面编辑器 4 个组件、`deepseek.ts`（抽出公共内核）、`fields.ts`（提示词合并成一份）。

合计 63 files changed（含上述被移除的调试产物），+14521 / −209。

---

## 8. TypeScript / lint / 测试 / build 结果

全部在最终提交 `ff1aeef` 上重跑：

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过，0 错误 |
| `npm run lint` | 通过，0 错误 0 警告 |
| `npm test` | **226 通过 / 0 失败**（起点是 111） |
| `npm run build` | 通过（`/admin/sync` 已生成，`/sitemap.xml` 为 1 小时 ISR） |

新增 115 个测试，其中 28 个专测应急发布（逐条对着需求：故障时出现、非故障时不出现、
只更新中文、已有外语不被清空、没有译文的语言不被造出来、外语被正确标记、
恢复后自动补齐、旧任务不能回写、重复点击不产生重复版本、非管理员不能执行、
审计不含密钥与译文）。其余覆盖需求第十四节里可自动化的部分：首次全语言同步、只改一个字段就只翻那一个、
中文清空译文跟着清空且零调用、中文没变零调用、HTML/占位符/嵌套结构保持、
规格表按行 id 回填且新增行不打乱老行、部分失败不回退成功结果、只重试失败语言、
多批次中断后续跑、发布同步的幂等与失败即放弃、已有译文不被覆盖、force 重翻、
严格回退规则与开关默认值。

测试用内存假库 + 假 fetch（引擎走的是与线上同一条代码路径，只换掉网络那一层）。

---

## 9. 部署与回滚步骤

完整步骤写在 `docs/LANGUAGE-SYNC.md`，这里是要点。

### 第一阶段：部署功能（不动生产内容）

```bash
cd /opt/mizhong
git pull --ff-only origin main && npm ci
DBURL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | sed "s/?schema=public//") \
  && DATABASE_URL="$DBURL" npx prisma migrate deploy
npm run build && pm2 reload mizhong-web --update-env && pm2 save
```

顺序不能改：**先迁移再 build**。sitemap 会在构建期查库，缺列时会降级（不失败），
但日志里会有报错。

`STRICT_LOCALE_FALLBACK` 保持不设 → 线上行为与部署前完全一致。

### 第二阶段：备份 + 首次全站同步

```bash
DBURL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2- | sed "s/?schema=public//")
STAMP=$(date +%Y%m%d-%H%M%S)
pg_dump "$DBURL" -Fc -f /opt/mizhong-data/backups/mizhong-$STAMP.dump
pg_restore --list /opt/mizhong-data/backups/mizhong-$STAMP.dump | head   # 验证备份可读

npm run translation:sync status      # 只读盘点，不发请求不写库
npm run translation:sync sync --limit 2   # 先试一条
npm run translation:sync sync
```

`--limit 2` 那一步建议保留：它让「Key 对不对、模型能不能通」这件事在花全量之前就暴露出来。

### 第三阶段：验证后开启严格回退

抽查各语言商品页与首页 → 确认 `tehsugouzi`、`manli` 的目标语言内容都已发布 →
在 `.env.local` 加 `STRICT_LOCALE_FALLBACK=true` → `pm2 reload mizhong-web --update-env && pm2 save`。
**不需要重新构建。**

### 回滚

- 代码：`git checkout <上一个稳定提交> && npm ci && npm run build && pm2 reload`
  —— **数据库不用回滚**，这一版迁移全是新增。
- 数据：`pg_restore -d "$DBURL" --clean --if-exists <备份文件>`
- 单条内容：编辑器「版本历史」里点恢复（写回草稿，线上不受影响）。
- 关闭严格回退：删掉 `STRICT_LOCALE_FALLBACK` 或置 false，reload 即可。

---

## 10. 首次生产同步前的内容数量

2026-09-18 用只读 SQL 从生产库盘点（**没有执行任何写操作**）：

| 内容 | 已发布 | 现有翻译语言 | 待同步 |
| --- | --- | --- | --- |
| 商品 | 2（`tehsugouzi`、`manli`） | 只有 zh | 各 10 种语言 |
| 页面 | 1（`home` 首页，6 个区块） | zh / en / vi | 其余 8 种 |
| 公司资料 | 1 | zh / en / vi | 其余 8 种 |
| 导航 | 4 条 | zh / en / vi | 其余 8 种 |
| 联系方式 | 3 条 | **一条都没有** | 各 10 种 |
| 商品类目 | 0 条 | — | — |
| 素材 | 4 条 | **一条都没有** | 各 10 种 |

**合计 15 条内容**（其中商品 2、页面 1、公司资料 1、导航 4、联系方式 3、素材 4）。

另有 3 条**未发布**的测试商品（`product_3`、`product_3_copy`、`product_3_copy_2`），
**不在同步范围内**（未发布的内容不参与全站同步），也**没有动过**它们 ——
删不删由你决定。

首页、公司资料、导航的 en/vi 会被「认下来」不重翻，所以实际要生成的
「内容 × 语言」少于 15 × 10。

---

## 11. 同步后的成功 / 失败 / 跳过数量

**未执行。** 首次全站同步属于第二阶段，需要先备份生产库并由你确认后再跑。
本次交付的是功能与命令行入口，没有对生产数据做任何写入。

跑完之后 `npm run translation:sync status` 会给出这份数字。

---

## 12. 目标语言 URL / SEO / hreflang / sitemap 验证

**部分已验证，部分依赖第 11 节。**

已在本机用**生产库数据**实测（只读访问）：

| 检查项 | 结果 |
| --- | --- |
| `/zh` `/en` `/vi` `/ar` `/ja` `/ru` `/hi` 首页 | 200 |
| `/zh/products`、`/zh/search` | 200 |
| `/zh/products/tehsugouzi` | 200，canonical 指向当前语言 |
| `/ar/products/tehsugouzi` | 200 |
| `/ja/products/manli` | 200 |
| `/admin/login` | 200 |
| sitemap 在数据库不可用时 | 降级为只列 11 条语言首页（不失败、不挂起）✓ |

**尚未验证**的部分：各语言页面上「正文与 SEO 是否确实是对应语言」。那要等第 11 节的同步
真正跑完才能查 —— 现在这些页面显示的是中文回退内容（这正是要修的问题本身）。

---

## 13. 严格回退是否部署，以及部署前后的 URL 对比

**没有部署。** 开关默认关闭，线上行为与部署前一致。

本机实测了开关两边的差异（生产库数据，同一份代码，只改环境变量）：

| URL | `STRICT_LOCALE_FALLBACK` 关闭（部署后状态） | 打开（第三阶段） |
| --- | --- | --- |
| `/zh/products/tehsugouzi` | **200** | **200** |
| `/en/products/tehsugouzi` | **200** | **404** |
| `/ar/products/tehsugouzi` | **200** | **404** |
| `/ja/products/manli` | **200** | **404** |
| `/vi/products/tehsugouzi` | **200** | **404** |
| 商品页 hreflang | 11 种语言全列 | 只剩 `zh-CN` + `x-default` |
| `/en` `/vi` `/ja` `/es` `/fr` `/ko` `/pt` `/ru` `/hi` 的商品页 | 全 200 | **全 404** |

上一轮的 16 条地址（各语言首页、商品目录、搜索、`/admin/login`、`/robots.txt`）
在开关关闭时**全部 200**；打开后 `/zh/products/tehsugouzi` 仍 200，
其余 10 个非中文商品 URL 变 404 —— 即交接里说的那 20 个（2 商品 × 10 语言）。

这就是交接里说的那 20 个 URL（2 商品 × 10 非中文语言）—— 用实测确认了它的存在，
也正是开关必须默认关闭的原因。第三阶段同步跑完后再打开，这些地址就不会变成 404。

---

## 14. 尚未完成 / 需要你决定的事项

### 需要你决定

1. **10 个提交还没有推到 origin**（本地 main 领先 origin/main 10 个提交）。
   部署命令是 `git pull --ff-only origin main`，所以推不推、什么时候推由你定。
2. **首次全站同步尚未执行**（第 11 节）。按第八节的顺序：先 `--limit 1` 跑一条，
   程序化验证之后再全量。
3. **3 条未发布的测试商品**（`product_3`、`product_3_copy`、`product_3_copy_2`）
   仍未处理 —— 未获授权我不动它们。
4. **严格回退的开启时机**：第三阶段那五条全部满足后再置 `STRICT_LOCALE_FALLBACK=true`。

### 尚未完成

5. **页面区块的新增/删除**：页面编辑器目前只能编辑已有区块，不能新增或删除。
   数据层（`applyPageDraftToLive`）已经支持增删，缺的是界面。这是改造前就有的限制。
6. **按内容类型配置「发布哪些语言」**：现在固定是除中文外的全部 10 种。
   引擎与任务都已经能接受任意语言子集，缺的是设置项。
7. **同步中心的进度不自动刷新**：推进过程中进度条会更新，但底下的内容列表要
   手动点「刷新」。自动轮询没做，是为了避免在翻译进行中反复查十几条内容的同步计划。
8. **`TranslationState` 的清理**：删商品、恢复版本会清；但直接删库或未来新增的
   内容类型如果忘了清，会留下指向不存在内容的条目（同步中心会跳过它们，不会报错）。
9. **应急发布目前覆盖商品与页面**，不含公司资料、导航、联系方式、素材 ——
   那几类没有草稿/发布机制，改动即时生效，不存在「发布被翻译卡住」的问题。

### 与交接报告不一致的地方

- 交接说「线上、本地和 origin 的已部署 HEAD 为 `6a96b44`」—— 已核实一致。
- 交接说「111 tests 通过」—— 已核实一致（起点确实 111）。其余检查项同样核实通过。
- 交接没有提到 **2026-09-18 的生产盘点结果**（第 10 节），也没有提到首页/公司资料/导航
  已经有手写的 en/vi 内容 —— 这一条直接改变了「已有译文要不要重翻」的设计。
- 交接提到「严格回退…… 没有部署」—— 属实，但那份代码在我接手时是**未提交状态**，
  我在第一次提交时误将它带上 main；已在 `0485a87` 里改为开关控制。
