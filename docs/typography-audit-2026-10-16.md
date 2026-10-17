# CRM 排版审计（Typography Audit）

**日期：** 2026-10-16
**范围：** `src/` 全部 19 个页面 + 共享组件与布局；**静态源码层面**（未渲染截图）
**方法：** 源码模式扫描（字重 / 字号 / 行高 / 大小写 / 数字对齐 / 截断 / 空态）+ 共享组件类盘点 + 契约测试现状核对
**结论一句话：** 全站排版纪律良好，无结构性问题。共 11 项发现：建议直接修的仅 2 处（边角）；5 条属于"应文档化"；4 处属边角或需渲染时再定。
**本审计未改任何代码。**

---

## 一、规范现状（三层防线）

### 1. 契约测试层 — `tests/typography-system.test.mjs`（17 条，随全量 555 跑绿）

- 紧凑字号阶梯：页标题上限 `2xl` = 18px/26px；禁止紧负字距（`letterSpacing: -0.02em` 被显式禁止）。
- 字重纪律：全库禁 `font-bold`；`.btn` 450、`.input` 400、`.label` 450、表头 450。
- 大小写：导航与表头句子大小写；禁止 `uppercase tracking-*` 的重型分组标签模式。
- 数字：金额 / 数量 / 日期 / ID / SKU / 百分比要求 `tabular-nums`（等宽数字）；商业单据禁 `font-mono`。

### 2. 共享组件类层 — `src/index.css`

| 类 | 定义 | 用途 |
|---|---|---|
| `.page-shell` | `max-w-7xl` 居中 · `px-4 py-5 sm:px-6` | 列表页统一版心 |
| `.page-heading` | 18px/26px · 600 | 页面唯一 h1 |
| `.page-summary` | 13px · muted | 标题下实时摘要 |
| `.section-label` | 12px · 450 · muted | 面板 / 分组小标签 |
| `.table-header` | h-8 · 12px · 450 | 全尺寸表头 |
| `.table-cell` | h-10 · 13px · 400 | 全尺寸表体单元格 |
| `.empty-state` | 13px muted 居中 · min-h-32 | 空态 |
| `.metric-cell` | min-h-108 · p-4 | KPI 芯片 |

### 3. 文档层 — `DESIGN.md` §Typography

字体栈不动（Inter + PingFang SC）、不放大标题、字重 400/450/500/600 分工、表格数字等宽。
**明确不移植 Venture kit 的营销式大字与紧字距**——这是有意决策，不是遗漏。

---

## 二、全站一致性（数据佐证）

- **h1：** 19/19 页有且仅有一个（Inventory 两个互斥视图分支各一）；17 页走 `.page-heading`，特例 2 处（见 P3-8/9）。
- **`font-bold`：0 处。** 600 仅出现在页标题、卡片标题、关键数值、激活步骤标签。
- **`tabular-nums`：** 除 SettingsProfile（无数字场景）外全覆盖；金额列右对齐。
- **任意字号 `text-[…]`：全库仅 1 处**（TopBar 通知徽章 10px）。
- **空态：** 12 个页面使用共享 `.empty-state`。
- **截断：** 列表页 `truncate + min-w-0` 配对齐全；看板卡（Tasks / Pipeline）与单据详情（QuotationDetail）改用换行——符合各自语境。

---

## 三、逐页清点

| 页面 | 版心 / 结构 | 空态 | 备注 |
|---|---|---|---|
| Dashboard | `page-shell` ×3 区块 | `.empty-state` ×5 | 嵌入紧凑表（裸 `<td>` 12px / py-2）；卡片标题 14px 600 |
| Companies | `page-shell` + `page-header` | ×3 | 全尺寸表（header 6 / cell 9） |
| CompanyDetail | 自管 `<main>` · `max-w-7xl` 双栏 · p-4 | ×1 | 详情页版心变体（P2-2） |
| Contacts | `page-shell` + `page-header` | ×3 | |
| Activities | `page-shell` + `page-header` | ×2 | 描述文案 `leading-5`（P3-7） |
| FollowUpWorkbench | `page-shell` + `page-header` | ×3 | 表头共享类、表体半裸 `py-2`（P2-5） |
| InventoryPage | `page-shell` ×2（互斥视图） | ×9 | 6 张表；`legend` 复用 `section-label` |
| Login | 独立品牌页 | — | 品牌语境特例（P3-11） |
| MaterialsToolingPage | `page-shell` + `page-header` | 0（裸 `noData` 段落） | tab 布局（P2-6） |
| OrderDetail | 自管 · `max-w-5xl` · p-6 | ×3 | `#行号` 小标 uppercase（P1-1） |
| Orders | `page-shell` + `page-header` | ×3 | |
| Payments | `page-shell` + `page-header` | ×3 | 行主文本 500（P2-3） |
| Pipeline | 自管看板布局 | 虚线投放区（语境合理） | h1 自写（P3-8） |
| QuotationDetail | 自管 · `max-w-5xl` · p-6 | ×3 | |
| Quotations | `page-shell` + `page-header` | ×3 | |
| SettingsProfile | `page-shell` + `page-header` | 0 | 无数字，故无 `tabular-nums` 语境 |
| ShipmentDetail | 自管 · `max-w-3xl` · p-6 | ×1 | h1 覆盖不全（P3-9） |
| Shipments | `page-shell` + `page-header` | ×3 | |
| Tasks | `page-shell` + `page-header` | ×3 | 看板卡换行不截断（合理） |

---

## 四、发现清单

### P1 · 建议修（2 处，小改）

1. **`#行号` 小标残留全大写模式** — `OrderDetail.tsx:652`、`InventoryPage.tsx:2281`：
   `text-2xs … uppercase tracking-wide text-ink-subtle`。数字经 uppercase 无视觉差异，但 `tracking-wide` 会把 `#1` 这类标号拉宽，且该模式与全站"句子大小写"纪律相反。改法：删去 `uppercase tracking-wide` 两个类词。
   契约测试未直接钉死该串（改动前仍建议跑 `node --test tests/typography-system.test.mjs` 与相关页面测试确认）。

### P2 · 文档化即可（规范应有、DESIGN.md 未写；只改文档不改码）

2. **详情页版心三种、内边距两种**：OrderDetail / QuotationDetail `max-w-5xl p-6`、CompanyDetail `max-w-7xl p-4`（双栏）、ShipmentDetail `max-w-3xl p-6`。列表页统一 `page-shell 7xl`，详情页各自为政且无书面规则。→ 在 DESIGN.md 写明版心选择规则（如：单据类 5xl、窄单据 3xl、工作台类 7xl；内边距统一 p-6 或声明 p-4 适用双栏）。
3. **行主文本 500 未入规范**：公司名 / 编号 / 发票号等"行主文本"广泛使用 `font-medium`（Dashboard、Payments 等）。DESIGN.md 只写了"labels/controls 450/500"，未覆盖行主文本。→ 补一句"行主文本 500，正文 400"。
4. **卡片标题两个层级**：页级卡片 14px 600（Dashboard `WORKSPACE_CARD_TITLE`）vs 面板 / 弹层 13px 600（SidePanel、ConfirmDialog、PipelineCard 等 8 个文件）。两级成立，但未书面声明。→ 在 DESIGN.md 声明"页级卡片 14 · 面板 / 弹层 13"。
5. **两种表格行高并存**：全尺寸表 `.table-cell` 40px vs 嵌入卡的紧凑表（Dashboard AR 表、FollowUpWorkbench 表体）≈32px + 12px 字号。→ 声明"嵌入卡允许紧凑表变体"（推荐）或统一。
6. **MaterialsToolingPage 空态是裸段落**（`<p className="text-sm text-ink-muted">`），不走 `.empty-state`。→ 统一或声明 tab 内例外。

### P3 · 边角 / 渲染时再看

7. **多行说明文案行高三套策略**：`leading-5`（Activities · 12px）、`leading-6`（CompanyDetail / ConfirmDialog · 13px）、`leading-relaxed`（Login / InventoryPage · 12px）。观感接近，但体系不一。→ 渲染审查时定一条规则。
8. **Pipeline h1 自写** `text-xl md:text-2xl`（16→18px 响应式），其余页面恒定 18px。
9. **ShipmentDetail h1 缺 `text-lg sm:text-2xl` 覆盖**（其他三个详情页有）——窄屏下 ShipmentDetail 保持 18px，其余详情页降到 15px。
10. **TopBar 通知徽章 `text-[10px]`** 是全库唯一任意字号。语境合理（16px 圆形徽章），可换 `2xs`（11px）或保留。
11. **Login 二级标题 500、AboutModal 深色面 18px 600**——特殊语境，建议不动。

---

## 五、未覆盖（渲染层）

- 中英混排间距、真实换行 / 截断表现、窄屏与响应式观感、暗色模式——需在匿名 QA 实例（`:3105`）做渲染抽查。
- 本审计为静态源码检查，不含像素级核对。

---

## 六、建议行动分组

- **A（小修）**：P1 两处 `uppercase tracking-wide`——任意批次顺手带上。
- **B（文档）**：P2 五条写进 `DESIGN.md`（§Typography / §Lists And Tables），约 10 分钟，不动代码。
- **C（渲染审查，独立一轮）**：P3 + 中英混排 / 窄屏 / 暗色，在 QA 实例截图取证后再决定是否改码。

---

## 附录 · 复现命令

```bash
# 任意字号（应仅 1 处徽章）
grep -rn "text-\[" src --include="*.tsx"

# 全大写残留
grep -rn "uppercase" src/pages src/components --include="*.tsx"

# 行高策略
grep -rn "leading-" src --include="*.tsx"

# 数字对齐覆盖（应仅 SettingsProfile 为空）
for f in src/pages/*.tsx; do grep -L "tabular-nums" "$f"; done

# 字重纪律（font-bold 应为 0）
grep -rn "font-bold" src/pages src/components --include="*.tsx"
```

---

## 七、C 轮渲染审查结果（2026-10-16）

方法：QA 匿名实例（`:3105`，5 公司/5 报价/5 订单/2 发运/5 发票）上用 html2canvas 全页截屏（scale 2），共 9 张：1512 桌面 / 390 窄屏 / 中文 UI / 暗色。归档在 `$TMP/crm-design-qa/final/`（`c-*.png`、`_inspect-*.png`）。样本页：Pipeline、Companies、CompanyDetail、OrderDetail、ShipmentDetail、Activities(zh)、Materials-Tooling(zh)、Dashboard(dark)。

### 通过项
- 中英混排（zh UI + EN 数据）：数字两侧留空（"共 5 条活动"）、"·" 分隔、zh 日期格式均正常；中文标题/正文行高无挤压。
- 暗色首审：面（`#0F1623`/`#151E2D`）与发丝边正常；pastel 胶囊、stage 进度条、红警 status-edge 均清晰可读；黑实心 CTA 反转成立。
- 窄屏 390：列表页表格→卡片、工具栏折行、看板纵排，无溢出重叠；`⌘K` 徽章按预期隐藏。
- A 批去 uppercase 的两处小标（`#1`、行项目表）渲染观感正常。

### 发现（候选修复，未改码）
| # | 级别 | 现象 | 定位 | 建议修复 |
|---|------|------|------|----------|
| C1 | P2 | ShipmentDetail 移动端页头整块居中（返回+h1+胶囊内缩、⋮ 单独居中一行），与 Order/Quotation 详情左对齐不一致 | `src/pages/ShipmentDetail.tsx:243`，`page-header … items-center` | 改 `items-start sm:items-center` |
| C2 | P2 | OrderDetail 移动端发票日期中段断行（"Due: 2026-11-" / "05"） | `src/pages/OrderDetail.tsx:832` | 该 span 加 `whitespace-nowrap` |
| C3 | P3 | 详情页 h1 移动端两套阶梯：Order/Quotation/Company 15px（`text-lg sm:text-2xl`），Shipment 固定 18px（原 P3-9 坐实） | `src/pages/ShipmentDetail.tsx:246` | 补 `text-lg sm:text-2xl` |
| C4 | P3 | Pipeline h1 移动端 16px（`text-xl md:text-2xl`），列表页其余 18px（原 P3-8 坐实） | `src/pages/Pipeline.tsx:195` | 换 `page-heading` |
| C5 | P3 | 中文下 TopBar 占位符半角标点（"客户, 联系人, 报价..."） | `src/components/layout/TopBar.tsx:74`（拼接写死 `', '` 与 `'...'`） | 分隔符/省略号按语言取 "、" 与 "…" |

测试锚点预检：以上 5 处均不撞现有契约测试（`page-header mb-0`、`page-heading` 均为前缀匹配；Pipeline h1 与占位符无断言）。

### 非缺陷澄清（防误报）
- ShipmentDetail 曾显示 "page.shipments.sea"：QA 种子数据用了非法枚举（规范值 `sea_freight`，见 `Shipments.tsx:14`），非应用缺陷。已修种子并复验 → "Sea Freight" 正常（`c-shipmentdetail-390-v2.png`）。
- CompanyDetail 度量条数值"底部截断"：DOM 实测 `clientHeight = scrollHeight = 18px` 无溢出 → html2canvas 伪影（元素级单抓仍复现，真实渲染无此问题）。勿据截图报缺陷。

### 结论
- P3-7 行高三套策略：渲染无碍，建议仅文档化（列表行 `leading-5` / 详情段落 `leading-6` / 弥散引导 `leading-relaxed`），不改码。
- P3-10 TopBar 徽章 `text-[10px]`：浅色/暗色截图均无碍，维持。
- P3-11 Login/AboutModal：本轮无新增证据，维持不动。
- C1–C5 已合成"批次 6"修复（见下）。

### 批次 6（C 修复）记录（2026-10-16，完成）
| # | 修复内容 | 落点 |
|---|----------|------|
| C1 | 页头 `items-start sm:items-center`（移动端左对齐） | `ShipmentDetail.tsx:243` |
| C2 | 发票行：编号加 `whitespace-nowrap` + 两段间显式空格（制造合法断行点）；日期保持 `whitespace-nowrap` | `OrderDetail.tsx:832` |
| C3 | h1 补 `text-lg sm:text-2xl`（移动端 15px，对齐 Order/Quotation/Company） | `ShipmentDetail.tsx:246` |
| C4 | h1 换 `.page-heading`（移动端 16px → 18px） | `Pipeline.tsx:195` |
| C5 | 占位符按语言取 "、"/"…"（`i18n.language` 判断） | `TopBar.tsx`（连接点 :74） |

验证：`npm run test` 557/557（typography-system 新增 2 条契约）；`npm run build` exit 0；390px iframe 真实布局实测——发票行编号 76px 单段整行 + 日期 87px 整行（修复前实测：编号被拆 46/30、日期中段断行）；Shipment/Order h1 均 15px/22px 且 `clientHeight = scrollHeight`（无裁切）；Shipment 页头 `align-items: flex-start` 左对齐。复截证据归档：`v6-*.png`（初验）、`v7-order-390.png`（发票行终验）。

C2 二次修正说明：首版只给日期加 `whitespace-nowrap`，真实布局暴露浏览器把断点移到编号连字符（"INV-26-" / "0005"）。根因：左列可用宽 155px < 编号(76)+间距(8)+日期(87)=171px，且两个 span 之间无断裂机会。用"编号 nowrap + 显式空格"给出确定性断行点后解决。

截图审查注意（补充）：`truncate` 元素的文本在 html2canvas 截图中可能出现"顶部切半"伪影（如 h1 `SHP-26-0002`），DOM 实测 `clientHeight = scrollHeight` 无裁切，勿据此报缺陷。
