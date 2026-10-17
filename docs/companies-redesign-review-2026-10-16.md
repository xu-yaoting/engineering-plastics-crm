# 客户页与客户详情页 — 设计审查与重构方案（2026-10-16）

> **范围**：`/companies`（客户列表）与 `/companies/:id`（客户详情）两页，含移动端。
> **性质**：审查 + 方案。**未改任何代码。**
> **证据**：两页源码逐行核对；1512/390 截图；390px iframe 真实布局实测（指标条截断量化）；API 与契约测试交叉验证。
> **数据口径**：隔离匿名 QA 实例（5 公司 / 5 报价 / 5 订单 / 2 发运 / 5 发票）。
> **Venture 参照说明**：本轮 Figma 标签页因浏览器窗口不可见（画布渲染挂起 → 抓帧与原生截图均不可用），**未能直接调阅 kit 的 Contacts 画板**。方案按「联系人作为一等实体」的方向 + 已移植的设计语言（`DESIGN.md`）给出；如需对照 kit 复核，下轮窗口可见时我可再看（标签页仍在）。

## 一、结论摘要

问题集中在三层，核心不是「不好看」，而是**信息取舍与展示顺序不符合客户开发的判断顺序**：

1. **内容逻辑反转**：列表页不展示「该不该跟」的信号（最近活动、分级），详情页却把同源数据拆成两个指标重复展示（Pipeline Value 与 Open Pipeline 都来自同一批活跃报价，且后者名实不符）。
2. **关系信息被降级**：贸易场景里联系人（采购/技术/老板）是核心资产，但详情页只展示 1 个「主联系人」，其余要跳全局目录找；模型里已录入的 `is_decision_maker` 在详情页完全不显示；i18n 里预留的 `keyContacts` / `viewAllContacts` / `decisionMakerLabel` 三个键至今闲置——原设计要求本来存在一块「联系人组」。
3. **移动端细节失误**：指标条第三格真实截断（DOM 实测 81px 容器 vs 115px 内容）；列表卡片把 industry / code 各显示两遍；联系人 / 任务区排在整个活动流之后。

## 二、现状盘点

### 2.1 列表页（`src/pages/Companies.tsx`，608 行）

- 头部：客户标题 + `N records` + New Company；工具栏：搜索、状态筛选、负责人筛选、更多（导入 / CSV 导出）。
- 桌面表格列：Name（含 customer_code）/ Status / Owner / Location / Industry / 行操作（编辑·复制·删除）。
- 移动卡片：名称 → `industry · code` → 状态 + 城市 → 分隔线 + 网格（Industry / Owner / Code）。
- 侧面板：新建（9 字段）、内联编辑（8 字段）、导入（模板/上传/结果）、删除确认。
- 过滤逻辑：搜索只匹配 name/city；分页 8 条/页；无排序。

### 2.2 详情页（`src/pages/CompanyDetail.tsx`，561 行）

- 头部：返回 + 名称 + Status 徽章 + A/B/C 等级 chip + 编辑 / 新建报价 + meta 行（类型 · 行业 · 地区 · 最近活动 N 天前）。
- 指标条：Pipeline Value（活跃报价金额，多币种 `+` 拼接）/ Open Pipeline（实际值为报价**数量**）/ Next Follow-up（最早未完成任务）。
- 左栏：管道机会（活跃报价，最多 3 条）+ 活动时间线（Note/Call/Email/Meeting + Log Meeting）。
- 右栏：主联系人（仅 1 个）/ 任务（最多 3 条）/ 负责人 / 三个跳转文字链（联系人目录、公司信息、历史）。
- 侧面板：公司信息（法定名/注册号/网站/地址/分级/信用/产品兴趣）、责任历史、会议记录。
- 移动端：右栏整体排在左栏之后（`order-2`）。

## 三、问题清单

### P1 — 逻辑 / 可用性受损

**R1｜指标条名实不符 + 同源重复**
- 现象：`Open Pipeline` 的 label 是「进行中管道」，值却是 `1 quotation`（数量）；且与 `Pipeline Value` 同出一源（`activeQuotations`，CompanyDetail.tsx:161-181、243-247）。
- 建议：合并为一格——`活跃报价：$15,000.00 · 1 个`；第三格换为**最近活动**（数据已有 `last_activity_at`），或保留「下次跟进」但允许两行。
- 最小改法：把 `Open Pipeline` 改名为「活跃报价数」并去掉暗示金额的管道色条。
- 成本提示：`tests/i18n-profile-activity-detail.test.mjs:75-86` 钉住了 4 个指标 key，改结构需同步。

**R2｜移动端指标截断（DOM 实测，非截图误报）**
- 数据：390px 下第三格 "No next follow-up" `clientWidth 81 / scrollWidth 115` → 截断；1512px 下 369/369 不截断（桌面截图里的缺口是 html2canvas 伪影，**不要据此报缺陷**）。
- 建议：改 `grid-cols-1 sm:grid-cols-3` 单列堆叠（label 上、值下），或值允许两行；桌面不受影响。

**R3｜联系人区降级**
- 现象：只显示 `primaryContact`（CompanyDetail.tsx:165、335-387）；`is_decision_maker` 在 ContactPanel 可录入、Contacts 页有展示，详情页不用；`keyContacts` / `viewAllContacts` / `decisionMakerLabel` 键闲置（i18n.tsx:125、131-132）。
- 建议：右栏改为「联系人 (n)」分区——列出 ≤3 位（姓名 + 职务 + 「主」/「决策」徽章 + 邮件/电话快捷图标，可选首字母圆头像），底部「查看全部 n 个联系人」→ `/companies/contacts?company=<id>`（该页已有公司筛选下拉，只需加读 URL 参数）。

**R4｜移动端信息顺序反了**
- 现象：390 下要滚过整条活动流才看到联系人与任务（right rail `order-2`）。
- 建议：移动端把右栏提前到「管道机会」之前（CSS order 调整，最少改动）；备选是把「联系人 + 任务」拆成独立卡片置顶。

### P2 — 信息取舍 / 一致性

**R5｜列表缺「最近活动」列**：`last_activity_at` 列表 API 已返回（`SELECT c.*`，server/routes/companies.ts:41-58），UI 不用。找客户时「该不该跟」是首要判断 → 桌面新增「最近活动」列（`3d ago` / `—`），移动放入卡片信息区。

**R6｜移动卡片字段重复**：`industry`、`code` 各出现两遍（副标题 + 网格，Companies.tsx:558-583），网格唯一新增信息只有 Owner。建议：副标题收敛为 `industry`；网格 = Owner / 最近活动 / Code（code 是订单号前缀，保留一处）。

**R7｜搜索范围窄**：只匹配 name/city（Companies.tsx:78）。`customer_code` 是订单号的关键前缀、industry 也是常用查找维度。建议：加入 `customer_code` + `industry`（一行改动，注意大小写不敏感处理）。

**R8｜分级（A/B/C）列表不可见**：详情头部有 chip、编辑里有、列表没有——「分级」正是列表里最有用的销售策略字段。建议：名称旁小 chip（复用详情页样式），窄屏自动隐藏。

**R9｜两个编辑面板漂移**：列表内联编辑 8 字段（缺网站/邮箱/电话/注册号/地址），详情 `CompanyEditPanel` 覆盖全字段。同一记录两个编辑入口能力不同 = 逻辑不一致。建议：列表复用 `CompanyEditPanel`。

**R10｜「查看全部」缺口**：报价 ≤3、任务 ≤3 都没有入口。建议：报价卡头加「查看全部」→ `/quotations?company=<id>`（Quotations 页需加读 URL 参数 + 公司筛选，API 已支持 `company_id`，server/routes/quotations.ts:65-77）；任务区加「查看全部」→ 任务页带公司筛选（任务页参数支持待核，批次 8 实施前先查）。

### P3 — 打磨

- **R11｜空态弱**："No tasks" 纯文本、无行动号召；建议统一空态样式（说明 + 主行动按钮）。
- **R12｜公司档案藏两层**：网站/注册号/地址/信用/产品兴趣都在侧面板，右栏只有小文字链。建议加一张紧凑档案卡（或至少把入口按钮化）。
- **R13｜meta 行**：最近活动埋在 11px 小字；与 R1 联动后更顺。
- **R14｜可选**：分页 8/页可调 10；列排序（名称/最近活动）后续再说。

## 四、实施批次建议（每批 ≤3 个主体文件；待批准）

> 背景：详情页当前「单联系人 + 短侧栏」是此前一次刻意精简（见契约测试用例名 `one short support rail…`）；批次 8 相当于按「联系人资产化」方向重新翻案，相关测试命名与断言同步改写。

| 批次 | 内容 | 文件 | 契约测试同步 |
|---|---|---|---|
| 7（列表） | R5+R6+R7+R8（+R14 可选） | `Companies.tsx` | `i18n-first-batch` / `i18n-shared-batch` / `i18n-fulfillment-payments` / `follow-up-workbench` / `ui-p0-overlays` / `team-accountability` / `typography-system`（均为源码字符串断言，逐条核对） |
| 8（详情） | R1+R2+R3+R4+R10 | `CompanyDetail.tsx`、`Contacts.tsx`（读 URL 参数）、`Quotations.tsx`（公司筛选） | `i18n-profile-activity-detail`（钉了 `primaryContact`、`pendingTasks.slice(0, 3)`、指标 keys、`to="/companies/contacts"`、`lg:sticky lg:top-4`）、`typography-system`、`team-accountability`、`user-reported-workflow-fixes`、`i18n-shared-batch`、`i18n-final-sweep` |
| 9（收尾，可选） | R9+R11+R12 | `Companies.tsx`、`CompanyDetail.tsx`（复用 `CompanyEditPanel`；空态；档案卡） | 同上相关项 |

每批完成后：全量 `npm run test` + `npm run build` + 390/1512 对照复截（沿用 QA 实例与既有截图管线）。

## 五、证据清单

- 截图（`$TMP/crm-design-qa/final/`）：`qa-companies.png`（列表 1512）、`c-companies-390.png`（列表 390）、`c-companydetail-1512.png`（详情 1512）、`c2-companydetail-390.png`（详情 390，本轮新截）。
- 实测数据：390/1512 iframe DOM 测量（R2 截断量化：81/115）。
- 代码引用：`Companies.tsx:78/138-151/503-508/558-583`；`CompanyDetail.tsx:161-181/243-247/272/335-387/392/410`；`server/routes/companies.ts:41-58`（列表 API `SELECT c.*`）；`server/routes/quotations.ts:65-77`（`company_id` 筛选）；`i18n.tsx:125/131-132`（闲置键）。

## 六、实施记录（2026-10-16，R1–R14 全部落地）

**范围**：三页一并重构（`/companies` 列表、`/companies/:id` 详情、`/companies/contacts` 目录），外加 `/quotations`、`/tasks` 的只读 `?company=` 联动。未动路由 / API / 数据模型（URL 参数为只读新增）；批次 7–9 合并为「两轮实施 + 测试同步 + 收尾」。

**代码**
- 新增 `src/components/shared/ClassBadge.tsx`（A/B/C → blue/yellow/gray；空值不渲染；列表 + 详情共用）。
- `Companies.tsx`：页大小 8→10；搜索扩展到 `customer_code`/`industry`；新增「Last activity」列（`hidden lg:table-cell`）；内联编辑面板删除，改复用 `CompanyEditPanel`（R9）。
- `CompanyDetail.tsx`：指标行改为 Active quotations / Last activity / Next follow-up（brand / neutral / warning+risk 三色调）；aside 移动端前置 + `lg:sticky`；联系人 rail top-3（主要联系人优先）+ Primary/Decision 徽章 + 「View all N contacts」；任务区「View all」；旧链接块换成公司档案小卡；分级徽章进头部。
- `Contacts.tsx`：`?company=` 初始化并同步公司筛选（`replace` 写回）；摘要 `filtered / total`；Primary/Decision 徽章（移动卡片 + 桌面表格共用）。
- `Quotations.tsx`：`?company=` 只读 chip（漏斗图标 + 公司名 + 清除 ×）+ 行过滤 + 摘要条件扩展。
- `Tasks.tsx`：同款 chip（建筑图标）+ 按 `entity_type`/`entity_id` 过滤（分页 / 摘要 / 空态均基于 `visible`）。
- `i18n.tsx`：EN/ZH 新增 `activeQuotations`、`primaryBadge`、`decisionBadge`、`clearFilter`、`viewAll`；ZH `keyContacts` 口径改为「联系人」；`quotationCount/openPipeline` 等闲置键保留（字典存在性测试钉住）。

**验证**
- `npm run test`：557/557 通过（同步改写 7 个测试文件：`follow-up-workbench`、`i18n-first-batch`、`user-reported-workflow-fixes`、`i18n-profile-activity-detail`、`i18n-list-pages`、`i18n-shared-batch`、`i18n-fulfillment-payments`）。
- `npm run build`：通过。
- QA 截图（匿名 QA 实例，EN + ZH，390/1512，共 10 张）存档：`/private/var/folders/w4/fcn94_1j65s4w0_996bb3r6h0000gn/T/opencode/final/`（`companies-1512/390`、`company-medtech-1512/390`、`contacts-1512/390`、`contacts-390-zh`、`contacts-filtered-1512`、`quotations-company-1512`、`tasks-company-1512`）。
- 实机核验（非截图推断）：`contacts?company=<id>` → 下拉 `value` = id、显示公司名、4 records / 4 行；`quotations?company=` → 1 / 5 records；`tasks?company=` → 4 pending / 1–4 of 4。
- QA 数据播种（仅匿名实例）：MedTech 增 3 联系人（Nina Hart/Primary、Owen Reed/Decision、Pia Lang）+ 3 任务，用于展示 rail ≥4 与 View all 链接。

**截图管线备注**：本机 `browser.screenshot` 需桌面窗口可见，沿用 html2canvas 下载管线；html2canvas 克隆会重跑 SPA 脚本（拍到骨架屏）——解法：先把当前已渲染 DOM 序列化为「去 `<script>` 的静态副本」写入隐藏 iframe，再对该副本 `html2canvas(..., { windowWidth: 390|1512, scale: 2 })` 渲染下载。临时文件 `dist/html2canvas.min.js` 已随最终构建清除（2026-10-17 回归截图时临时放回、用毕再次清除）。

## 七、追加收尾批次（2026-10-17）

上一轮完成后的两批收尾（1–5），均为皮肤 / 结构层小改，无路由 / API 变化：

1. **Contacts 摘要口径**：公司筛选激活（`filterCompany`）时同样显示 `filtered / total`，与搜索口径一致。实机：`contacts?company=<id>` → “4 / 4 records”。
2. **日期差 helper 收敛**：三处拷贝合并为 `src/lib/dates.ts` 的两个函数——`daysSince`（整时间戳差；`Companies.tsx`、`CompanyDetail.tsx` 共用）与 `calendarDaysSince`（日期部分归零的日历日差；`FollowUpWorkbench.tsx`）。两者语义本来就不同，分别保留、行为不变。
3. **CompanyFilterChip 抽取**：新增 `src/components/shared/CompanyFilterChip.tsx`（`Quotations.tsx`、`Tasks.tsx` 共用；图标与 `ml-auto` 由入参控制），清除按钮从 `setSearchParams({}, { replace: true })` 改为只删 `company` 参数。实机：`/tasks?company=<id>&sortBy=zzz` 点 × → `?sortBy=zzz`。

4. **R11 空态统一**（说明 + 主行动按钮）：`Companies.tsx` 列表两处——筛选无结果显示 `noData.companiesFiltered` + 「Clear filters」次级按钮（一键重置搜索/状态/负责人），真无数据保留 `noData.companies` + 「New Company」主按钮；`Quotations.tsx`、`Tasks.tsx` 各两处补主按钮（New Quotation / New Task）；`TaskSection.tsx` 的「No tasks」纯文本改为空态 + 「Add Task」按钮（打开输入时空态让位、关闭恢复）；`CompanyDetail.tsx` 管道空态按钮统一为 `btn-primary btn-sm`，联系人 rail 空态升级为说明 + 「Add first contact」。新增键 `common.clearFilters`、`noData.companiesFiltered`（EN/ZH）。
5. **R14 列排序延伸项**（名称 / 最近活动）：`Companies.tsx` 表头 Name、Last activity 可点击排序（首点升序、再点降序、chevron 指示、`aria-sort` 同步、`last_activity_at` 空值恒排末位；作用于分页前结果集，移动卡片同步；排序变更重置回第 1 页）。

验证（1–3）：`npm run test` 557/557、`npm run build` 通过、`npx tsc --noEmit` 0 错误；QA 重截并同名替换 3 张存档（`quotations-company-1512`、`tasks-company-1512`、`contacts-filtered-1512`）。

验证（4–5）：`npm run test` 557/557（TaskSection 交互修正后复跑）、`npm run build`、`npx tsc --noEmit` 均通过；QA 新增 6 张存档：`companies-sorted-1512`、`companies-empty-filter-1512`、`companies-empty-filter-390`、`tasks-empty-1512`、`company-detail-no-tasks-1512`、`company-detail-empty-rails-1512`；html2canvas 临时文件用毕再次清除；契约测试无需同步（无钉受影响）。

**6–9（同日第二批收尾）**，同样为皮肤 / 行为层小改，无路由 / API / 数据模型变化：

6. **QA 截图管线固化**：新增 `docs/qa-browser-capture.md` runbook——匿名 QA 实例启停/登录、html2canvas 静态克隆管线的完整注入脚本、取件归档与清理步骤、已知伪影清单；后续截图不再逐次推导。
7. **边界与 a11y 修正**：`Companies.tsx` 工具栏「⋯」溢出菜单按钮补 `aria-label`/`title`（`common.moreActions`）；`ActivityTimeline.tsx` 跟进提示关闭按钮（图标 only）补 `aria-label`/`title`（`common.close`）；`Contacts.tsx` 空态「New Contact」与页头「New」在 `?company=` 筛选激活时改为预选当前筛选公司（原固定取 `allCompanies[0]`，筛选无联系人公司时会开错公司）。
8. **活动卡「View all」出口**：`CompanyDetail.tsx` 活动卡头部（有活动时）新增「View all」→ `/activities?company=<id>`；`Activities.tsx` 新增只读 `?company=` 联动（建筑图标 chip、按 `entity_type`/`entity_id` 过滤、摘要改 `filtered / total records`、筛选变更重置分页），与 Quotations/Tasks 同款模式。
9. **Tasks 390 chip 补截**：`/tasks?company=<id>` 移动宽度（390）截图补齐，chip 在窄屏的换行表现有据可查。

验证（6–9）：`npm run test` 557/557、`npm run build`、`npx tsc --noEmit` 均通过；实机核验：`/companies` 溢出按钮 aria-label 就位；`contacts?company=TechPlast` 空态 New Contact → 面板 `#contact-company` 预选 TechPlast（不再落到首家公司）；AeroFit 详情「View all」→ `/activities?company=…` chip「AeroFit Industries」、`1 / 5 records`、仅 1 行且全为 AeroFit；chip × 清除后恢复 `/activities`、`5 records`、5 行。QA 新增 3 张存档：`company-detail-activity-1512`、`activities-company-1512`、`tasks-company-390`；html2canvas 临时文件用毕清除；契约测试无需同步（无钉受影响）。
