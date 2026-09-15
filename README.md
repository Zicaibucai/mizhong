# 米众贸易有限公司 · 多语言企业官网

面向中国、越南及英语市场的高端 B2B 纺织辅料企业官网。服务服装厂、品牌方、采购商与贸易客户，目标是展示公司、产品、生产能力与质量实力，并促使客户发起询盘。

暂定英文名：**Mizhong Trading Co., Ltd.**（未经公司正式确认，集中配置于 `src/lib/site-config.ts`，待确认后统一修改）。

> **当前阶段状态**：已完成品牌重置、基础架构整理与版本控制。国际化首页（zh / en / vi）、设计系统、公司信息与文案集中配置、语义化媒体位接口（含可配置 Logo 槽位）、后台 / 数据库 / 媒体 / 产品模块的目录边界均已就绪。
>
> **尚未实现**：后台管理系统、产品管理、图片视频管理、阿里云 OSS、DeepSeek 多语言翻译、WhatsApp / Email 集成、Google 图片 SEO、阿里云部署。详见文末[开发阶段清单](#开发阶段清单)。

## 技术栈

- [Next.js 15](https://nextjs.org/)（App Router，静态生成 + 服务器组件）
- TypeScript 5（严格模式）
- [Tailwind CSS 4](https://tailwindcss.com/)（CSS 变量主题）
- Node.js 22+
- PostgreSQL + Prisma（下一阶段接入，模型见 `prisma/schema.prisma`）
- S3 兼容对象存储 / 阿里云 OSS（下一阶段接入）
- 部署目标：阿里云香港 ECS + Nginx + PM2

## 本地启动

```bash
# 环境要求：Node.js >= 22（见 .nvmrc）
npm install

# 开发模式
npm run dev
# 打开 http://localhost:3000 （会自动重定向到 /zh）

# 生产构建
npm run build

# 生产模式运行
npm run start

# 类型检查 / 代码规范
npm run typecheck
npm run lint
```

环境变量：复制 `.env.example` 为 `.env.local` 并按需填写（本阶段无必填项，全部为下一阶段的占位）。

## 目录结构

```
src/
  app/
    [locale]/              # 语言路由（根布局，服务端渲染 <html lang>）
      layout.tsx           #   根布局 + generateMetadata（hreflang / canonical / OG）
      page.tsx             #   首页组装
      not-found.tsx        #   404
    globals.css            # 设计令牌（颜色/字体）+ 全局样式
    robots.ts              # robots.txt
    sitemap.ts             # sitemap.xml
  middleware.ts            # 无语言前缀路径 → 重定向到默认语言
  components/
    layout/                # 站点头部、页脚、品牌 Logo、语言切换、移动菜单
    home/                  # 首页各区块（hero / 能力 / 产品 / 制造 / 质量 / 询盘）
    ui/                    # 基础组件（按钮、容器、媒体位、图标…）
  lib/
    i18n/                  # 语言配置 + 三语言字典（文案集中管理）
    site-config.ts         # 公司信息统一配置（★ 英文名、联系方式等集中于此）
    media.ts               # 语义化媒体位接口（含 brand.logo，后续绑定后台素材）
    cn.ts                  # className 合并工具
prisma/
  schema.prisma            # 数据模型（下一阶段接入）
```

## 语言与文案

- 三语言：`zh`（简体中文）、`en`、`vi`（越南语），路由 `/zh`、`/en`、`/vi`。
- 所有文案集中在 `src/lib/i18n/dictionaries/`，`zh.ts` 与 `vi.ts` 与 `en.ts` 共享 `Dict` 类型——**缺失或多余的键会在编译期报错**，杜绝文案散落硬编码。
- 组件通过 `getDictionary(locale)` 取文案，禁止在组件中直接写死字符串。

## 公司信息与品牌

- **所有商务信息集中在一个文件**：`src/lib/site-config.ts`（中文名、暂定英文名、联系方式、地址、ICP 备案号）。
- 网站**不展示任何图形 Logo、字母 Logo 或临时 Logo**，仅以纯文字公司名保持身份识别。
- 品牌 Logo 保留一个**后台可配置的媒体槽位** `brand.logo`（见 `src/components/layout/brand-logo.tsx`）：后台未上传 Logo 时不渲染任何图片；上传后自动显示。
- 联系方式、地址、备案号当前为**明确标注 TODO 的占位内容**（邮箱使用保留域名 `.example`），待公司提供真实信息后替换。

> 未虚构任何产品、证书、产能、客户、评价或网络图片。产品分类为行业通用分类占位，认证区域为“待确认”占位。

## 媒体位接口（图片 / 视频）

所有图片视频位置使用**语义化媒体位**，为后续后台绑定预留，不硬编码随机图片 URL：

- 槽位定义：`src/lib/media.ts` 的 `MEDIA_SLOTS`（如 `brand.logo`、`hero.image`、`product.webbing`）。
- 组件：`src/components/ui/media.tsx`（`<Media slot="..." />`），当前 `getMediaBySlot` 恒返回 `null`，因此渲染 `MediaPlaceholder` 占位。
- 下一阶段接入后台后，`getMediaBySlot` 改为查询数据库 / OSS，组件自动切换为真实图片 / 视频，无需改动页面代码。

## 设计系统

- 主色：深海军蓝（`--color-navy-*`），背景：象牙白（`--color-ivory-*`），强调：铜金（`--color-copper-*`）。
- 字体：Inter（latin / latin-ext / vietnamese 子集，经 `next/font` 自托管），中文回退系统字体（苹方 / 微软雅黑 / Noto Sans SC）。
- 令牌定义于 `src/app/globals.css` 的 `@theme` 块，响应式使用 Tailwind 断点（sm / md / lg）。

## 最终需求（Final Requirements）

以下为本站点的完整目标范围，**尚未全部实现**：

1. **前端与后台**：面向访客的多语言前台 + 管理员登录的独立后台。
2. **产品管理**：产品分类与产品的增删改查、多语言内容、排序与上下架。
3. **图片视频管理**：素材上传、预览、编辑、分类、排序、替换、删除，三语言标题 / 说明 / alt 文本，并绑定到页面媒体位。
4. **阿里云 OSS**：图片与视频存储于阿里云 OSS（S3 兼容接口），支持 CDN 加速。
5. **DeepSeek 多语言翻译**：接入 DeepSeek 实现内容的中 / 英 / 越多语言翻译辅助。
6. **WhatsApp 与 Email**：询盘可通过 WhatsApp 与 Email 触达。
7. **Google 图片 SEO**：图片结构化数据、`ImageObject` / `Product` 等 Schema.org 标记、站点地图与图片站点地图。
8. **最终部署**：部署至阿里云香港 ECS（Alibaba Cloud Linux 4、Node 22、PM2 + Nginx），配置 HTTPS 与 CDN。

## 开发阶段清单

> 本轮仅完成“阶段 0 / 阶段 1”。以下为后续开发阶段清单，**本轮不实现**。

### ✅ 阶段 0 — 品牌重置与基础架构（已完成）

- [x] 公司名称更新为“米众贸易有限公司 / Mizhong Trading Co., Ltd.（暂定）”，集中配置
- [x] 清除全部旧品牌内容（代码、页面、SEO、README、package.json、翻译）
- [x] 移除图形 / 字母 / 临时 Logo，改为纯文字身份识别
- [x] 保留后台可配置的 Logo 媒体槽位 `brand.logo`
- [x] 项目重命名为 `mizhong-trade-website`

### ✅ 阶段 1 — 国际化首页与设计系统（已完成）

- [x] zh / en / vi 三语言路由与切换
- [x] 文案集中管理与编译期完整性校验
- [x] 设计令牌、字体、响应式
- [x] 首页：导航、首屏、企业能力、产品占位、制造能力、质量与信任、询盘 CTA、页脚
- [x] 语义化媒体位接口与占位符
- [x] SEO（hreflang / canonical / sitemap / robots）与无障碍基线
- [x] 生产构建通过

### ⬜ 阶段 2 — 数据库与后台基础（待开发）

- [ ] 接入 PostgreSQL + Prisma（`prisma generate` / `migrate`）
- [ ] 管理员认证与登录、会话、权限
- [ ] 后台布局与受保护路由

### ⬜ 阶段 3 — 媒体管理（待开发）

- [ ] 阿里云 OSS 接入（S3 兼容），上传 / 删除 / 替换
- [ ] 素材库：预览、编辑、分类、排序
- [ ] 三语言标题 / 说明 / alt 文本编辑
- [ ] 媒体位绑定后台（`brand.logo`、`hero.image` 等）

### ⬜ 阶段 4 — 产品管理（待开发）

- [ ] 产品分类与产品的增删改查、多语言内容
- [ ] 前台产品列表页与详情页（`/products`、`/products/[slug]`）
- [ ] 产品级图片画廊

### ⬜ 阶段 5 — 询盘与通知（待开发）

- [ ] 询盘表单（前端 + 后端入库）
- [ ] Email 通知
- [ ] WhatsApp 联系入口

### ⬜ 阶段 6 — DeepSeek 多语言翻译（待开发）

- [ ] 接入 DeepSeek API，实现内容中 / 英 / 越翻译辅助
- [ ] 后台翻译工作流与人工校对

### ⬜ 阶段 7 — SEO 与图片优化（待开发）

- [ ] Google 图片 SEO：`next/image` 优化、图片站点地图
- [ ] Schema.org 结构化数据（`Organization` / `Product` / `ImageObject`）
- [ ] 性能与 Core Web Vitals 优化

### ⬜ 阶段 8 — 部署上线（待开发）

- [ ] 阿里云香港 ECS（Alibaba Cloud Linux 4、Node 22、PM2 + Nginx）
- [ ] 域名、HTTPS、CDN
- [ ] 生产环境变量与密钥管理，补充 ICP 备案号

## 安全说明

- `.env.example` 仅含占位符，不含任何真实密钥；`.gitignore` 已排除所有 `.env*`（保留 `.env.example`）、`.next`、`node_modules`、数据库文件。
- 生产安全响应头已在 `next.config.mjs` 配置；严格 CSP 待域名 / CDN 确定后收紧。
