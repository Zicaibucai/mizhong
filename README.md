# 米众贸易有限公司 · 多语言企业官网

面向中国、越南及英语市场的高端 B2B 纺织辅料企业官网。定位为**纺织辅料贸易商、供应商、采购与供应链合作伙伴**（非制造工厂），服务服装厂、品牌方、采购商与贸易客户。

暂定英文名：**Mizhong Trading Co., Ltd.**（未经公司正式确认，集中配置于 `src/lib/site-config.ts`，待确认后统一修改）。

> **当前阶段**：阶段 2 已完成 —— PostgreSQL 数据库、管理员登录系统与基础内容管理后台已就绪；前台公司资料、联系方式、导航、首页区块文案均可由后台管理，数据库不可用时自动回退到内置字典，页面不会崩溃。
>
> **尚未接入**（后续阶段）：阿里云 OSS、DeepSeek 自动翻译、图片 SEO、询盘邮件 / WhatsApp 发送、服务器部署。详见文末[开发阶段清单](#开发阶段清单)。

## 技术栈

- [Next.js 15](https://nextjs.org/)（App Router，SSG + ISR + 服务器组件 / Server Actions）
- TypeScript 5（严格模式，无 `any`）
- [Tailwind CSS 4](https://tailwindcss.com/)（CSS 变量主题）
- Node.js 22+
- PostgreSQL + [Prisma 6](https://www.prisma.io/)
- 校验：[Zod](https://zod.dev/)；密码哈希：bcrypt（12 轮）
- 部署目标：阿里云香港 ECS + Nginx + PM2

## 本地启动

```bash
# 环境要求：Node.js >= 22（见 .nvmrc）
npm install

# 1) 配置环境变量（数据库为必需项）
cp .env.example .env.local
#    编辑 .env.local，填写 DATABASE_URL，例如：
#    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mizhong?schema=public

# 2) 应用数据库迁移并导入初始内容
npm run db:migrate     # 应用 prisma/migrations 下的迁移
npm run db:seed        # 导入三语言首页文案（幂等，不会覆盖后台修改）

# 3) 创建管理员账号（交互式，密码不会写入任何文件）
npm run admin:create

# 4) 启动
npm run dev            # http://localhost:3000 → 自动跳转 /zh
```

其他命令：

```bash
npm run build          # 生产构建
npm run start          # 生产模式运行
npm run typecheck      # 类型检查
npm run lint           # 代码规范
npm run db:generate    # 生成 Prisma Client（postinstall 已自动执行）
npm run db:studio      # Prisma Studio 可视化查看数据
```

## 后台管理

- 登录地址：**`/admin/login`**（后台入口 `/admin`，未登录自动跳转登录页）
- **不开放自助注册**，管理员由命令创建：

```bash
npm run admin:create
# 或指定邮箱
npm run admin:create -- admin@example.com
```

  密码在终端输入时不回显，不少于 12 位，不会写入源码 / README / Git / `.env.example`。若邮箱已存在，则重置密码并确保为 `ADMIN` 角色。

  服务器部署时可用非交互方式（密码从文件读取，不出现在命令行参数或日志中）：

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD_FILE=/path/to/pwfile npm run admin:create
```

- 会话采用「数据库存储会话记录 + 随机令牌」：Cookie 为 `HttpOnly` + `SameSite=Lax`，生产环境自动加 `Secure`，有效期 7 天；退出登录会同时销毁服务端会话。
- 登录失败有基础频率限制（同一 IP + 邮箱 10 分钟内 5 次失败后锁定 10 分钟），错误提示统一为「邮箱或密码不正确」，不暴露账号是否存在。
- 后台全部页面、Server Action 均在服务端做权限校验（`requireAdminPage` / `requireAdminAction`），不依赖前端隐藏按钮。

### 后台可管理的内容

| 模块 | 路径 | 说明 |
|---|---|---|
| 控制台 | `/admin` | 页面 / 已发布 / 草稿 / 产品 / 素材 / 询盘数量，最近操作记录 |
| 公司资料 | `/admin/company` | 三语言公司名称、简介、业务定位、地址、营业时间、默认 SEO |
| 联系方式 | `/admin/contacts` | Email / WhatsApp / 电话 / 微信 / 地址，启用开关、排序、显示文字 |
| 导航 | `/admin/navigation` | 导航项的增删改、三语言名称、内外部链接、排序、启用 |
| 页面与区块 | `/admin/pages` | 页面标题 / slug / SEO、草稿与发布、首页区块标题 / 正文 / 按钮文字 / 显示状态 |
| 审计记录 | `/admin/audit` | 登录、退出、创建、修改、发布、删除操作留痕 |

## 联系方式

公开联系方式的**唯一来源**是 `src/lib/contact-config.ts`（Phone / WhatsApp / Email，含展示文字与 `tel:` / `wa.me` / `mailto:` 链接）。它同时被两处使用：

1. **`npm run db:seed`** —— 以稳定 `key` **幂等**写入数据库；已存在的记录**完全不会被修改**，因此管理员在后台的启用/停用、排序与文案调整都会被保留。
2. **前台回退** —— 数据库不可用时，前台仍展示这些真实联系方式，而不是留空或使用占位假数据。

前台展示位置：页脚、询盘区、桌面端右侧固定悬浮按钮（WhatsApp / Email）、移动端底部联系栏（WhatsApp / Email / 电话）。

- 只有**已启用且填写了值**的联系方式才会出现在前台；在后台停用任意一项，对应入口（含悬浮按钮与底部栏）会立即消失。
- 数据库可连接但联系方式为空时，前台**不显示**任何联系方式（此时不会回退，以保证后台的停用操作立即生效）。

## 前台由后台控制的内容

- **公司资料**：页脚公司名、标语、地址、营业时间；页面默认 SEO 标题与描述（`generateMetadata`）。
- **联系方式**：页脚与首屏询盘区。**仅展示「已启用且填写了值」的联系方式**；未配置时不显示任何联系方式，绝不使用占位假数据。
- **导航**：顶部导航与移动端菜单（未配置时使用内置锚点导航）。
- **首页区块**：首屏 / 企业能力 / 产品 / 供应链 / 质量与信任 / 询盘 CTA 的标题、描述、正文、按钮文字与显示状态。**仅当页面状态为「已发布」时生效**，草稿状态前台回退到内置文案。

数据库不可用（未配置 `DATABASE_URL` 或连接失败）时，前台自动回退到 `src/lib/i18n/dictionaries/` 中的内置文案，站点仍可正常访问。

## 目录结构

```
src/
  app/
    (site)/[locale]/        # 前台（路由组，拥有独立根布局以支持按语言设置 <html lang>）
      layout.tsx            #   根布局 + generateMetadata（hreflang / canonical / OG）
      page.tsx              #   首页组装
      not-found.tsx         #   404
    (admin)/admin/          # 后台（独立根布局）
      login/                #   /admin/login
      (protected)/          #   需登录：控制台 / 公司资料 / 联系方式 / 导航 / 页面 / 审计
    globals.css             # 设计令牌（颜色/字体）+ 全局样式
    robots.ts / sitemap.ts
  middleware.ts             # 无语言前缀的公开路径 → 重定向到默认语言（后台/接口除外）
  components/
    layout/                 # 前台头部、页脚、品牌 Logo、语言切换、移动菜单
    home/                   # 首页各区块
    ui/                     # 基础组件（按钮、容器、媒体位、图标…）
    admin/                  # 后台组件（外壳、导航、表单控件、删除确认）
  lib/
    i18n/                   # 语言配置 + 三语言字典（文案集中管理）
    admin/                  # 后台校验（Zod）、Server Actions、权限守卫、标签
    auth/                   # 密码哈希、会话、登录频率限制
    db.ts                   # Prisma Client 单例 + 安全查询（失败回退，不crash）
    content.ts              # 内容读取层：数据库优先 + 字典回退
    media.ts                # 语义化媒体位接口
    site-config.ts          # 公司信息统一配置（★ 英文名集中于此）
    contact-config.ts       # 公开联系方式唯一来源（seed 与前台回退共用）
    audit.ts / href.ts / cn.ts
prisma/
  schema.prisma             # 数据模型
  migrations/               # 数据库迁移
  seed.ts                   # 初始内容种子
scripts/
  create-admin.ts           # 管理员创建脚本
```

## 数据模型

- **管理员与会话**：`User`、`Session`（仅存令牌哈希）、`AuditLog`
- **站点内容**：`SiteSetting`、`CompanyProfile` + `CompanyProfileTranslation`、`ContactMethod` + `ContactMethodTranslation`、`NavItem` + `NavItemTranslation`、`Page` + `PageTranslation`、`PageBlock` + `PageBlockTranslation`
- **素材 / 产品 / 询盘**（模型已保留，功能在后续阶段）：`Asset`、`AssetTranslation`、`SlotBinding`、`ProductCategory`、`Product`、`Inquiry`
- 所有多语言内容统一通过 `Locale`（`zh` / `en` / `vi`）枚举的翻译关联表存储，**不为每种语言硬编码独立字段**。

## 安全说明

- 密码使用 bcrypt（12 轮）哈希，绝不明文存储；管理员密码不写入任何文件。
- `.env.example` 仅含变量名与安全示例；`.gitignore` 排除所有 `.env*`（保留 `.env.example`）、`.next`、`node_modules` 与数据库文件。
- 后台链接字段经 `sanitizeHref` 白名单校验（仅允许站内路径、锚点、http/https/mailto/tel），防止 `javascript:` 与协议相对 URL 注入；登录后固定跳转 `/admin`，不接受外部跳转地址。
- 所有后台输入在服务端用 Zod 校验；删除操作需二次确认；数据库异常对用户给出友好提示，服务端保留可诊断日志。
- 生产安全响应头在 `next.config.mjs` 配置；后台页面与登录页均设置 `robots: noindex`。

## 最终需求（Final Requirements）

1. **前端与后台**：多语言前台 + 管理员登录的独立后台。✅ 本阶段完成
2. **产品管理**：产品分类与产品的增删改查、多语言内容、排序与上下架。⬜
3. **图片视频管理**：素材上传、预览、编辑、分类、排序、替换、删除，三语言标题 / 说明 / alt，绑定到页面媒体位。⬜
4. **阿里云 OSS**：图片与视频存储于阿里云 OSS（S3 兼容接口），支持 CDN 加速。⬜
5. **DeepSeek 多语言翻译**：接入 DeepSeek 实现内容的中 / 英 / 越翻译辅助。⬜
6. **WhatsApp 与 Email**：询盘可通过 WhatsApp 与 Email 触达。⬜
7. **Google 图片 SEO**：图片结构化数据（`ImageObject` / `Product`）、图片站点地图。⬜
8. **最终部署**：阿里云香港 ECS（Alibaba Cloud Linux 4、Node 22、PM2 + Nginx）+ HTTPS + CDN。⬜

## 开发阶段清单

### ✅ 阶段 0 — 品牌重置与基础架构

- [x] 公司名称「米众贸易有限公司 / Mizhong Trading Co., Ltd.（暂定）」，集中配置
- [x] 清除全部旧品牌内容；移除图形 / 字母 / 临时 Logo，保留可配置的 `brand.logo` 媒体槽位

### ✅ 阶段 1 — 国际化首页与设计系统

- [x] zh / en / vi 三语言路由与切换；文案集中管理与编译期完整性校验
- [x] 设计令牌、字体、响应式；首页九个区块；语义化媒体位接口
- [x] SEO（hreflang / canonical / sitemap / robots）与无障碍基线

### ✅ 阶段 2 — 数据库、认证与内容管理后台

- [x] PostgreSQL + Prisma；数据模型（用户 / 会话 / 审计 / 公司资料 / 联系方式 / 导航 / 页面 / 区块）
- [x] 迁移文件、种子脚本（导入三语言首页文案）
- [x] 管理员登录、会话 Cookie、退出登录、登录频率限制
- [x] 后台：控制台、公司资料、联系方式、导航、页面与区块、审计记录
- [x] 前台接入：公司资料 / 联系方式 / 导航 / 首页区块由后台控制，失败回退字典
- [x] 去除无事实依据的「制造商 / 自有工厂 / 生产线 / 产能」表述，改为贸易 / 供应 / 采购定位

### ⬜ 阶段 3 — 媒体管理（待开发）

- [ ] 阿里云 OSS 接入（S3 兼容），上传 / 删除 / 替换
- [ ] 素材库：预览、编辑、分类、排序；三语言标题 / 说明 / alt
- [ ] 媒体位绑定后台（`brand.logo`、`hero.image` 等）

### ⬜ 阶段 4 — 产品管理（待开发）

- [ ] 产品分类与产品增删改查、多语言内容、上下架
- [ ] 前台产品列表页与详情页（`/products`、`/products/[slug]`）、产品级图片画廊

### ⬜ 阶段 5 — 询盘与通知（待开发）

- [ ] 询盘表单（前端 + 后端入库）、Email 通知、WhatsApp 入口

### ⬜ 阶段 6 — DeepSeek 多语言翻译（待开发）

- [ ] 接入 DeepSeek API；后台翻译工作流与人工校对

### ⬜ 阶段 7 — SEO 与图片优化（待开发）

- [ ] Google 图片 SEO、图片站点地图、Schema.org 结构化数据、Core Web Vitals

### ⬜ 阶段 8 — 部署上线（待开发）

- [ ] 阿里云香港 ECS（Alibaba Cloud Linux 4、Node 22、PM2 + Nginx）、域名、HTTPS、CDN、ICP 备案号

## 运行环境说明

本仓库的数据库相关命令（migrate / seed / admin:create）需要可用的 **PostgreSQL** 实例。若本机未安装 PostgreSQL 或 Docker，请先准备其一：

```bash
# 方式 A：Homebrew 本地安装（macOS）
brew install postgresql@16 && brew services start postgresql@16
createdb mizhong

# 方式 B：Docker
docker run -d --name mizhong-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mizhong -p 5432:5432 postgres:16
```

随后在 `.env.local` 中填写 `DATABASE_URL` 并依次执行 `npm run db:migrate`、`npm run db:seed`、`npm run admin:create`。
