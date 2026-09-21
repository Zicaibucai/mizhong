# 商品批量导入记录（2026-09-21）

把 `aHD/`（82 张）与 `aHT/`（48 张）两个文件夹的 **130 张产品图**导入生产站：
一个商品一张图、中文名与英文名、型号、分类，并补齐 11 种语言。

**中文名与英文名全部取自图片上印刷的文字**（用户要求：英文不按中文翻译，按图里的来）。
型号取自图右上角的印刷编号。

---

## 1. 数量与分类

| 项 | 值 |
| --- | --- |
| 导入商品 | **130**（129 发布 + 1 未发布，见 §4） |
| 新建分类 | **9** |
| 每商品图片 | 1 张（封面 + 图库首图，同一张） |
| 语言 | 11 种全部有 `name`；其中 **en 来自图片原文**，其余 9 种由 DeepSeek 从中文译出 |

| 分类 slug | 中文名 | 英文名 | 商品数 |
| --- | --- | --- | --- |
| `edge_rope_welt` | 垫边与滚边 | Edge Rope & Welt Cord | 19 |
| `springs_accessories` | 弹簧与弹簧配件 | Springs & Spring Accessories | 23 |
| `filling_padding` | 填充与棉毡 | Filling & Padding | 14 |
| `fabrics_lining` | 布料与里布 | Fabrics & Linings | 14 |
| `zippers_buttons` | 拉链与纽扣 | Zippers & Buttons | 14 |
| `tacks_fasteners` | 钉类与紧固件 | Tacks & Fasteners | 19 |
| `webbing_thread` | 织带与线材 | Webbing & Thread | 12 |
| `tools_machines` | 工具与设备 | Tools & Machines | 5 |
| `labels_sundries` | 标签与耗材 | Labels & Sundries | 10 |

分类是按名称语义归的（我先归类、用户后续在后台慢慢审核调整）。

## 2. 执行链路（三步，都不是临时脚本直写生产数据）

```
# 1) 商品与图片（幂等：同 sku 已存在则跳过）
npx tsx scripts/import-products.ts import --source /opt/mizhong-data/import-20260921

# 2) 其余 9 种语言（与后台「同步全部」同一个引擎、同一套幂等键与限流）
npx tsx scripts/translation-sync.ts sync

# 3) 发布（把草稿里的译文上线；闸门与后台「发布」一致：任何目标语言没翻完就不发布）
npx tsx scripts/import-products.ts publish
```

- 图片走 `getStorage().commit()` —— 与后台上传同一条路径，缩略图（webp，最长边 640）与 key 规则一致。
- 网址后缀走 `resolveUniqueProductSlug()`，格式 `hd6001_styrofoam_edge_rope`（型号 + 英文名）。
- `writeAudit` 记录每一步，`actorEmail` 为 `batch-import@mizhong`，**不冒充任何管理员账号**。
- 第 2 步把译文写进**草稿**（商品类内容一直是这个设计），第 3 步才上线。

**英文为什么不会被翻译覆盖**：同步引擎对「已有译文、但没有翻译记录」的字段采取
**认下来（adopt）而不是重翻**。导入时写进去的 en 名称正好命中这条规则，
所以 `status` 显示的是「待同步 9 种语言」而不是 10 种。

## 3. 导入后验证（2026-09-21 12:2x）

| 项 | 结果 |
| --- | --- |
| 商品详情页 11 种语言 | 11 / 11 = 200，且各自显示该语言的名称 |
| 例：`hd6001_styrofoam_edge_rope` 的 h1 | zh 圆形垫边 / en Styrofoam Edge Rope / ja 円形パッド縁 / ar حشوة دائرية بحافة / ru Круглая накладка с окантовкой / hi गोल पैड किनारा … |
| 列表页 `/zh`、`/en`、`/ja` | 200，每页 12 张卡片，分页 `?page=2` 正常 |
| 分类过滤 | `?category=edge_rope_welt` 只出该分类（不含弓簧）；`?category=springs_accessories` 只出弹簧类（不含 Styrofoam Edge Rope） |
| 分类侧栏名称 | 显示译文（中文页显示「垫边与滚边 / 弹簧与弹簧配件 / 工具与设备」） |
| 缩略图 | 从 `/media/thumb/image/2026/09/<hash>.webp` 正常出图 |
| 磁盘 | `uploads/image/2026/09/` 130 张原图 + `uploads/thumb/.../` 130 张 webp |
| 翻译任务 | 2800 / 2800 工作项完成，**失败 0**，272 次请求约 1.2 万 tokens |

## 4. 需要人工处理的三件事（都已按要求「先上传」）

1. **`aHT/HD6054-20.jpg` 图上没有印名称**（一张带 M 标的金属包扣特写）。
   已入库但 **published = false**，zh/en 名称都暂时写成 `HD6054-20` —— 我没替它编名字。
   在后台改好名称后发布即可（公开站现在访问它是 404，已核实）。
2. **有几个英文名照图原样保留了小写/疑似笔误**，因为要求是「按图里的来」：
   `hessian`(HD6032)、`woven cloth`(HD6034)、`Anti slip cloth`(HD6041)、`Hard cotton`(HD6031)、
   `Jute webbing`(HD6074)、`glue`(HD6081)、`desiccant`(HD6078)、
   `brace`(HT5034/HT5039/HT5040/HT5043 共 4 处)、
   `None-Woven fabric`(HD6039/HD6047/HD6075 —— 推测本意是 Non-Woven)。
   要改就在后台改英文名：**英文是人工填写的值，同步引擎会「认下来」而不会用中文把它覆盖掉**。
3. **商品目前只有名称**：没有简介、描述、规格、价格与贸易信息。
   详情页能正常打开并展示图与名称，但要真正接单还需要补这些字段（可在后台逐条补，或再跑一轮批量填充）。

## 5. 图片本体没有进仓库

130 张原图（25MB）用 `scp` 传到 `/opt/mizhong-data/import-20260921/`，脚本读完后
已提交进素材库（`uploads/`）。仓库里只有清单（`scripts/data/product-import-2026-09-21.json`）
与脚本，**不含图片**。导入目录可随时删除：

```
rm -rf /opt/mizhong-data/import-20260921
```
