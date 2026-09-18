# 第一阶段部署记录

**执行时间**：2026-09-18 16:04–16:12 CST
**部署提交**：`2d13acb6604555dd2961011d1538bad3e13d3cc1`（`main`，已推送）
**上一稳定提交**：`6a96b44188cabbafd4cb6953d0c1de0d5dcbb7dd`（记在 `/opt/mizhong-data/last-good-commit.txt`）
**范围**：只部署功能。未运行全站同步，未执行 `--limit 1`，未改动任何正式内容。

---

## 1. 部署前备份

| 项 | 值 |
| --- | --- |
| 位置 | `/opt/mizhong-data/backups/mizhong-20260918-160429.dump` |
| 大小 | 103,556 字节 |
| 格式 | PostgreSQL custom（`-Fc`），Dump Version 1.14-0 |
| 表数 | 27 |
| 校验 | `pg_restore --list` 可读，TOC Entries 164 |

**还原验证**（还原到一个临时库，不碰生产库）：

```
一致的表: 18，不一致: 0
```

18 张核心表逐表比对行数，全部与生产一致（Product / ProductTranslation /
ProductSpecification / Page / PageTranslation / PageBlock / PageBlockTranslation /
CompanyProfile(Translation) / NavItem(Translation) / ContactMethod(Translation) /
ProductCategory / Asset(Translation) / User / SiteSetting）。
验证用的临时库与临时副本已删除。

> **恢复时要注意**：`/opt/mizhong-data` 是 `750 ecs-user:nginx`，`postgres` 用户
> 进不去这个目录 —— 直接 `sudo -u postgres pg_restore <dump>` 会报
> `Permission denied`。真恢复时先把 dump 复制到一个 postgres 能读的地方。

## 2. 环境变量

在 `/opt/mizhong/.env.local` 里**显式写入**（此前没有这一行）：

```
STRICT_LOCALE_FALLBACK=false
```

配置解析：**只有字符串严格等于 `'true'` 才开启**，`1` / `TRUE` / `true ` / `yes`
一律关闭 —— 有 12 种写法的测试锁着。这个开关一打开，没有自己译文的 URL 会直接
404，一个拼写差异的代价太大。

## 3. 数据库迁移

```
Applying migration `20260918140000_translation_sync_and_releases`
All migrations have been successfully applied.
```

| 项 | 值 |
| --- | --- |
| 已应用 | **9** |
| 失败 | **0** |
| 迁移内容 | 纯新增：新表 7 张（+`SlugHistory`）、可空列 4 个、新枚举 6 个 |

**没有破坏现有记录** —— 见下面的逐字比对。迁移新建的表全部为空：

```
TranslationState: 0   ContentRelease: 0   TranslationJob: 0
ContentRevision: 0    SlugHistory: 0
```

## 4. sourceRevision 语义核查结果

**发现并修正了一处缺口。** 上一轮我写「不推进中文版本号」，指错了对象；实际实现
也确实缺了「推进中文自己那一版」这一步 —— `ContentRevision` 停在旧值，于是各语言的
`sourceRevision` 与它**相等**，数字上完全看不出落后，只能靠一个状态标记去断言。

现在应急发布的顺序是（第 2、3 步方向相反、缺一不可）：

| 步骤 | 动作 |
| --- | --- |
| 1 | 把新的中文写上线（`kind = EMERGENCY` 的 release + 中文发布版本快照） |
| 2 | **推进中文自己的 `ContentRevision`**（内容确实变了） |
| 3 | **各语言的 `sourceRevision` 与来源哈希一律不动**（它们没有重新翻译过） |
| 4 | 补齐任务钉在这一版中文的 `sourceHash` 上 |

于是「落后」是**算出来的**：外语记录里的版本号 < 中文版本号。

四条证明都有测试，跑在真实代码路径上（`performEmergencyPublish`）：

1. 应急发布前后中文发布版本不同；
2. 外语的 `translatedFromRevision` 保持旧值；
3. 系统能准确判断外语落后（记录里的版本号 < 中文版本号，且在同步计划里显示为待同步）；
4. 自动补齐之后，外语才推进到应急发布对应的那一版中文。

## 5. 线上健康检查

| 检查 | 结果 |
| --- | --- |
| 服务启动 | `pm2 reload` 成功，Ready in 385ms，状态 online |
| 错误日志 | 最新一条是 **09-17 18:46**（部署前），本次部署**没有产生新错误** |
| 响应时间 | 首页 4ms，商品页 40ms |
| `/admin/login` | 200 |
| 未登录访问 `/admin/sync` | 307 → `/admin/login`（鉴权有效） |
| 登录态访问 | `/admin`、`/admin/sync`、`/admin/products`、`/admin/products/<id>`、`/admin/pages`、`/admin/pages/<id>`、`/admin/settings/translation` **全部 200** |
| `/admin/sync` 内容 | 102KB，含「Language sync」「Product」「Up to date」 |
| 商品编辑器 | 含「Publish」「Draft」「Language sync」 |
| **应急按钮** | 两个编辑器里渲染出的应急按钮 **0 个**，原因输入框 **0 个** → 默认不显示 |
| 管理员账号 | 1 个，未改动 |

> 登录态验证用的是一条**临时会话**（只写 `Session` 表一行，用完即删），
> 没有创建账号、没有改任何用户记录。验证后 24 小时内新建会话数为 **0**。
>
> **没有验证到的**：用密码走一遍登录。我没有管理员密码，且登录流程本次未被改动
> （`auth.ts` / `session.ts` 一行没动）。已验证的是它周边的一切：登录页渲染、
> 未登录拦截、以及带会话时全部后台页面正常。

## 6. 那 20 个外语商品 URL

**全部 200，零回归。**

```
200 的: 20 / 非 200 的: 0
```

（`tehsugouzi` 与 `manli` × en vi es ja ru ar fr ko pt hi）

SEO 行为保持第一阶段兼容：

| 项 | 结果 |
| --- | --- |
| 商品页 hreflang | 仍列 **11 种语言 + x-default** |
| canonical | 指向当前语言自己的地址（`/zh/products/tehsugouzi`） |
| `/ar/products/tehsugouzi` 的 robots meta | **没有** noindex —— 符合第一阶段预期 |
| sitemap | 11 条语言首页 + 20 条商品地址，全部已验证 200 |

## 7. 正式内容前后一致性

对全部内容表做了确定性导出并取 sha256，部署前后各一次：

```
部署前: 4ce4a910c8db2990ae6ae09eee1e0f2254f7ee6615f04e6cf2d70a55a02b7230
部署后: 4ce4a910c8db2990ae6ae09eee1e0f2254f7ee6615f04e6cf2d70a55a02b7230
✅ 内容逐字一致（63 行全部相同）
```

覆盖：商品及其三语翻译、规格、图库、页面与区块及其翻译、公司资料、导航、
联系方式、素材、站点设置、管理员账号（含密码哈希）。
**已有的手写 en/vi 一字节未变。**

未发布的三个测试商品仍在（3 条），未删除、未修改。

## 8. 回滚方案（已验证，未执行）

```bash
cd /opt/mizhong
git checkout 6a96b44188cabbafd4cb6953d0c1de0d5dcbb7dd
npm ci && npm run build && pm2 reload mizhong-web --update-env && pm2 save
```

- 该提交确认存在于服务器本地仓库；
- **数据库无需回滚**：本次迁移全是新增，旧代码不认识新表但不受其影响；
- 真要回滚数据，用第 1 节那个已验证可还原的备份。

为了验证回滚方案，我**只在临时库上**做了一次真实还原，生产库未被触碰。

---

## 9. 是否发现阻止第二阶段同步的问题

**没有发现阻止性的问题。** 第二阶段可以按 `docs/LANGUAGE-SYNC.md` 推进：
备份 → `translation:sync status` 只读盘点 → `--limit 1` → 程序化验证 → 全量。

但有两条**不影响同步、但影响 SEO 效果**的既有问题，建议在开启严格回退之前处理：

1. **`NEXT_PUBLIC_SITE_URL` 是 IP 而不是域名**（`http://47.238.7.93`）。
   于是 canonical、`og:url`、hreflang、sitemap 全部指向 IP。这是**部署前就存在**的
   配置，不是本次引入；但它会让整套 hreflang/sitemap 的效果大打折扣 ——
   搜索引擎看到的规范地址是 IP 而不是 `htd123.com`。改它只需要在服务器的
   `.env.local` 里换个值再 reload，但它会改变公开输出，所以我没有擅自改。
2. **47 条历史登录会话**（最早 09-15，最近 09-17，46 条仍未过期）。
   是此前会话留下的，不影响功能。要清的话需要在后台加一个过期会话清理，
   或者直接删掉已过期的那些 —— 同样不在本次授权范围内。

---

## 10. 部署后停止

按要求在此停止。**没有运行全站同步，也没有执行 `--limit 1`。**
第二阶段等你确认后再开始。

---

## 11. 部署后追加：两个前台问题（同日修复）

部署后用户报告「后台加了邮箱，前台不显示」。查下来是**两个互不相干的既有问题**，
都不是本次部署引入的，但都在这天修掉了。

### 11.1 空串遮蔽共享值（真 bug，`ced2b0c`）

后台保存联系方式时会给**每种语言**都写一行翻译，没填的字段存成 `''` 而不是 NULL。
读取时写的是 `(tr?.value ?? row.value)` —— `??` 只在 null / undefined 时下沉，
`''` 被当成一个值，于是「填了共享值、没填该语言」的联系方式拿到空串，
被下一行 `.filter(value.length > 0)` 整条丢掉。

线上数据：6 条联系方式里 5 条的翻译行是空串（共 55 行），只有 seed 写的那条
WhatsApp 是 NULL，所以只有它正常显示。剩下 5 条全被丢掉之后，页脚对每种类型
各取一条、取不到就用内置的 `PUBLIC_CONTACTS` 兜底 —— 页面上于是出现了
**早已改掉的邮箱和电话**，看起来像缓存。

修两处：读取侧一律用 `||`（空串与 null 同等对待）并抽成纯函数 `resolveContactViews`
便于单测；写入侧空串写成 NULL。**没有改数据** —— 读取侧修好后，已存的空串会被
正确当作「没填」。

### 11.2 部署顺序会让旧代码污染新构建

修完第一个问题、部署之后，`/zh` 仍然显示旧邮箱。查下来：`rm -rf .next && npm run build
&& pm2 reload` 这个顺序有洞 —— **构建的那 27 秒里旧进程还活着**，它用旧代码响应请求、
触发 ISR 重新生成，把**旧代码渲染的页面**写进了刚构建好的 `.next`。

改成 `pm2 stop → rm -rf .next → npm run build → pm2 start` 之后产物干净，
各语言页脚全部正确。**代价约 30 秒停机**，已写进 `docs/LANGUAGE-SYNC.md`。

另外 `Cache-Control` 带 `stale-while-revalidate=31535940`：60 秒窗口过期后
**第一次**请求仍返回旧页面、后台再生成，**第二次**才新。部署后立刻验证要看两次。

### 11.3 验证结果（修复后）

| 项 | 结果 |
| --- | --- |
| 页脚联系方式（zh/en/ar/ja/vi） | 全部为数据库里的真实值：WhatsApp / `Kate_wang@htdmaterials.net` / `tel:+8618622185848` |
| 兜底邮箱残留 | 各语言均为 **0** |
| 原有 20 个外语商品 URL | **20 / 20 = 200** |
| hreflang | 仍 11 种语言 + x-default（第一阶段兼容） |
| 内容比对 | 与部署前不同 —— 但差异**全部来自用户新增的商品**（`chocolate`、`shuoguo`，含 10 种语言译文），我方操作未写入任何内容 |

> 新商品能在 zh/en/ar 全部 200 —— **整套翻译流程在生产上确实跑通了**。
