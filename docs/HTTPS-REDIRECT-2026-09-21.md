# 跳转协议收口（2026-09-21）

**问题**：公网检查报 `/` 被应用重定向到 `http://htd123.com/zh`，而各语言页本身正常、
canonical 已是 HTTPS。

**结论**：报告的形态在代码里**可复现**，根因是「同一件事有两份不等价的实现」。
本次把它合并成一份，并立下硬规则：**正式域名永不产出 http origin**。

---

## 1. 公网实测（2026-09-21 10:53）

| 入口 | 结果 |
| --- | --- |
| `https://htd123.com/` | 308 → `https://htd123.com/zh` ✅ |
| `https://www.htd123.com/` | 308 → `https://htd123.com/zh` ✅ |
| `https://47.238.7.93/` | 308 → `https://htd123.com/zh` ✅ |
| `http://htd123.com/` | 301 → `https://htd123.com/`（Nginx） ✅ |
| `https://htd123.com/products?x=1&y=2` | 308 → `https://htd123.com/zh/products?x=1&y=2` ✅ |
| 连续 15 次采样 `/` | 15/15 都是 HTTPS |

即**当前线上不是报告的形态**。两种可能，代码侧都已收口：

1. 报的是**当前构建之前**的响应（`http://htd123.com/zh` 正是修复前代码的输出，见 §3）；
2. 或者浏览器**缓存了早先那个 308** —— 308 是永久重定向，浏览器会一直用缓存里的
   目标地址，直到用户清缓存。这也是「跳转看着像应用发的」的原因。

顺带查明：响应里的 `Refresh: 0;url=…` 头**不是 Nginx 补丁**，是 Next.js 15 自己给
middleware 产生的 308 加的（`next/dist/server/lib/router-server.js:338`，只加在 308 上）。

## 2. 根因：两份 origin 解析

| | 运行环境 | `NEXT_PUBLIC_SITE_URL` 何时读 | 生产主机名判定 |
| --- | --- | --- | --- |
| `middleware.ts`（跳转） | Edge 运行时 | **构建时烘焙进产物** | 按主机名（协议无关） |
| `site-config.ts`（canonical / hreflang / sitemap / og） | Node 运行时 | 每次请求实时读 | 按字符串精确匹配，只管 `http://` 写法 |

于是只要**构建机器上没有这个环境变量**，middleware 读到的是空值、只能走请求头回落；
而回落时协议默认写的是 `http`：

```
const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
```

两个独立缺陷叠在一起：

- **默认 http**：拿不到转发协议就假定 http。站点已全站 HTTPS，这一步把用户送回明文。
- **全等比较**：多级代理会把该头写成列表（`https, http`），`=== 'https'` 判否 → 又落到 http。

此时 site-config 走的是另一条路（Node 实时 env + 自带 https 兜底），所以输出正好是
报告中的签名：**canonical 是 HTTPS，跳转却是 http**。

## 3. 修复前后（直接调用 middleware，未启服务）

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 未配置 env + Host `htd123.com` + 无 XFP | **`http://htd123.com/zh`** | `https://htd123.com/zh` |
| 未配置 env + XFP `https, http`（代理链） | **`http://htd123.com/zh`** | `https://htd123.com/zh` |
| 未配置 env + Host `www.htd123.com` | **`http://www.htd123.com/zh`** | `https://htd123.com/zh` |
| 深链接 `/products`（同上） | **`http://htd123.com/zh/products`** | `https://htd123.com/zh/products` |
| env `http://47.238.7.93`、`http://htd123.com`、`https://www.htd123.com` | `https://htd123.com/zh` | `https://htd123.com/zh` |
| 本机 `localhost:3000` | `http://localhost:3000/zh` | `http://localhost:3000/zh`（不变） |

## 4. 改动

| 文件 | 说明 |
| --- | --- |
| `src/lib/site-origin.ts` | **新增**。唯一的 origin 解析：配置值 → 已校验的转发头 → 兜底值。生产主机名（apex / www / 公网 IP，含端口、大小写、结尾点）一律收敛到 `https://htd123.com`，**不看协议、不看 XFP**；`X-Forwarded-Proto` 取列表首段 |
| `src/middleware.ts` | 删掉本地那份 `resolveOrigin`，改用共用实现。删掉 `LEGACY_PRODUCTION_HOSTS` |
| `src/lib/site-config.ts` | `site.url` 改用同一实现（原先只在字符串精确等于 `http://htd123.com` 等三个值时才纠正，`https://www.htd123.com` 会原样漏进 canonical） |
| `src/lib/__tests__/site-origin.test.ts` | **新增**。16 个用例，其中 2 个是本次现象的回归用例 |

本机开发（`NEXT_PUBLIC_SITE_URL=http://localhost:3000`）路径未受影响，测试里锁着。

## 5. 验证

| 项 | 结果 |
| --- | --- |
| `npm test` | 272 通过 / 0 失败（含新增 16） |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 通过，`ƒ Middleware 34.4 kB`（Edge bundle 编译正常） |
| 产物核对 | `.next/server/src/middleware.js` 内含 `https://htd123.com` 与列表首段解析 |
| 真实服务（`next dev -p 3100`，`NEXT_PUBLIC_SITE_URL=` 置空） | Host `htd123.com` → `https://htd123.com/zh`；Host `www.htd123.com` + 查询串 → `https://htd123.com/zh/products?page=2` |
| 浏览器 | `/` → `/zh` 正常跳转并渲染（本机无 DB 隧道，内容走兜底，与本改动无关） |

## 6. 部署（2026-09-21 已完成，`b2a9a51`）

必须**重新构建**——middleware 的 `NEXT_PUBLIC_SITE_URL` 是构建时烘焙的，只 reload 不生效。
顺序照旧（先停再删 `.next`，否则旧进程会把旧产物写进新目录）：

```
cd /opt/mizhong && git pull --ff-only origin main && pm2 stop mizhong-web \
  && rm -rf .next && npm run build && pm2 start mizhong-web && pm2 save
```

注意 `git pull` 要拉到的确实是带修复的 commit：第一次执行时改动还只在工作区，
`Already up to date.` 重建的仍是旧代码 —— 这一步要看清 fast-forward 的区间。

服务器上 `.env.local` 里的 `NEXT_PUBLIC_SITE_URL=http://47.238.7.93` **不改也已经是安全的**
（生产主机名一律收敛到 `https://htd123.com`）；顺手把它改成 `https://htd123.com` 只是让
配置更贴近事实。

### 部署后验证（2026-09-21 11:10 前后，每项各请求两次绕开 stale-while-revalidate）

| 入口 | 结果 |
| --- | --- |
| `https://htd123.com/` | 308 → `https://htd123.com/zh` |
| `https://www.htd123.com/` | 308 → `https://htd123.com/zh` |
| `https://htd123.com/products`、`/products?x=1&y=2` | 308 → `https://htd123.com/zh/...`（查询串保留） |
| `http://htd123.com/`、`http://www.htd123.com/` | 301 → `https://…`（Nginx） |
| 11 种语言首页 | 11 / 11 = 200 |
| `/zh` 的 canonical 与 11 个 hreflang + x-default | 全部 `https://htd123.com/...` |
| 页面内 http 自站地址 | 0 处 |
| `robots.txt` / `sitemap.xml` | 200，`sitemap` 指向 `https://htd123.com/sitemap.xml` |

> 外部无法区分这次部署前后 `htd123.com` 上的跳转输出（旧代码配合 `http://47.238.7.93`
> 这个配置值同样落 HTTPS）。本次部署的意义是**堵住回落路径**：配置缺失、协议头是
> 代理链写法时也不会再产出 http。

### 顺带核到、与本改动无关的两件事

- **商品目录当前是空的**：`/zh/products` 显示「还没有」，`/ar/products/tehsugouzi`、
  `/ja/products/manli` 返回 404，sitemap 只列 11 条语言首页。生产库**连接正常** ——
  首页渲染出了只有后台录入才有的联系方式（微信 `Sofa_Materials_Mia`、
  `512538257@qq.com`、`tel:+8618622185848`），所以这是**数据状态**（商品被下架或删除），
  不是数据库故障，也不是本次改动引起（改动只影响 URL 前缀，不碰路由与数据）。
- `npm audit` 报 6 个依赖漏洞（1 moderate / 5 high），与本改动无关。

## 7. 两项可选项已落地（2026-09-21 11:47，Nginx 层）

`/etc/nginx/conf.d/mizhong.conf`（改动前已备份为 `mizhong.conf.bak-20260921-114610`）。

**HSTS**：`add_header Strict-Transport-Security "max-age=31536000" always;`

先以 `max-age=300` 上线、验证后再加长到 1 年。**必须写三处**，因为 Nginx 的
`add_header` 只在当前层没有自己的 `add_header` 时才继承上层：

| 位置 | 覆盖 |
| --- | --- |
| server 级 | `/`、`/api/...` 等走应用的位置 |
| `location /media/` | 素材文件由 Nginx 直接发，**不经过应用** —— 应用层加头会漏掉这里 |
| `location /_next/static/` | 同上，静态资源由 Nginx 直接发 |

已核实四类响应都带上该头（`/`、`https://www.htd123.com/zh`、`/media/...`、`/_next/static/...`）。
未加 `includeSubDomains`、未申请 preload —— 只约束 apex 与 www 两个已验证全 HTTPS 的主机名。

**www 的那次多余跳转**：明文块里的 `return 301 https://$host$request_uri;` 改为
`https://htd123.com$request_uri`（两处）。现在 `http://www.htd123.com/zh/products`
**一次** 301 直接到 `https://htd123.com/zh/products`（原先要经 `https://www` 再 308）。
未知 Host / 公网 IP 仍是 404，行为未变。

## 8. 顺带补上的证书自动续期（同类风险）

查 HSTS 的副作用时发现：服务器上有 certbot（`/usr/local/bin/certbot` → `/opt/certbot` 的
venv，5.8.0 + nginx 插件）和 `/etc/letsencrypt/renewal/htd123.com.conf`，**但没有任何
触发器** —— 没有 cron、没有 systemd timer、`/etc/cron.hourly` 里也没有。证书
**2026-12-17 到期**，此前只能靠人工发现。

启用 HSTS 后证书过期的后果从「浏览器可以点继续」变成「硬打不开」，所以补上了：

```
/etc/cron.d/htd-certbot-renew
17 3 * * * root /usr/local/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

- 用 `certbot renew --dry-run`（staging，不动线上证书）实测：**模拟续期成功**。
- 认证方式沿用原有 nginx 插件，未改动。
- 注意：nginx 插件在续期时会重写它管理的配置块。本次 dry-run 后比对，HSTS 与 www 两处改动
  **都还在**；但不排除将来某次续期把它改回 `https://$host` —— 真被改回也只是 `http://www`
  多一跳（应用层仍会收敛到 apex），按本节内容重跑一遍即可。

## 9. 未做（可选）

- **`includeSubDomains` 与 preload**：需要先确认 `htd123.com` 的所有子域都上了 HTTPS 且
  长期可用，目前只有 apex 与 www 两个主机名，故未纳入。
- **`https://www` 的那一跳**：仍是应用层的 308 → apex（一次跳转，已是最少）；
  若想在 Nginx 层截住，要注意别与应用的「非语言路径 → /zh」逻辑叠成两次跳转。
- **浏览器缓存的旧 308**：早先访问过 `http://htd123.com/zh` 的浏览器可能仍缓存着那次
  308。HSTS 能让后续导航不再走明文，但已缓存的重定向要清缓存才消失。
