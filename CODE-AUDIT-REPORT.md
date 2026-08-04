# CRM 系统全面代码审查报告

**日期**: 2026-08-04 | **审查范围**: 全栈 (服务端 + 前端) | **基准 Commit**: `3c4cbb0`

---

## 一、架构根本性问题

### 1.1 Inquiry → Quotation 合并未完成

Inquiry 实体在数据库中被软删除，但其路由、页面、API、前端链接全部保留且无重定向。导致以下连锁问题：

- `/inquiries` 列表页永远显示空（数据已软删除）
- `/inquiries/:id` 详情页永远返回 404
- Dashboard、Pipeline、CustomerSummary 仍有多处 `/inquiries/` 链接指向死页面
- 前端 `api.ts` 中 `inquiries` 模块仍然存在且功能正常，但与 UI 脱节

**建议**: 要么彻底删除 inquiries 路由并添加 301 重定向，要么恢复 inquiries 表数据。

---

## 二、按严重程度排序的发现问题

### 🔴 严重 (影响用户正常使用)

#### 2.1 Follow-ups 页面首次加载 400 报错（已修复）
- **文件**: `server/routes/activities.ts:20`
- **现象**: 前端默认 bucket 改为 `thisWeek`，但后端 `allowedBuckets` 不含该值
- **状态**: ✅ 已修复 (添加 `thisWeek` 到 allowedBuckets)

#### 2.2 `/samples` 死链接 — 两处
- **文件**: `src/components/pipeline/PipelineCard.tsx:19`, `src/pages/Dashboard.tsx:109`
- **现象**: Pipeline 样品卡片点击跳转到 `/samples/:id`，Dashboard 管线链接到 `/samples`，均无对应路由，渲染空白页
- **原因**: App.tsx 中从未注册 `/samples` 路由
- **建议**: 移除这些链接，或创建 Samples 页面

#### 2.3 `/opportunities` 死链接
- **文件**: `src/pages/Pipeline.tsx:198`
- **现象**: Pipeline 页面顶部 "Opportunities" tab 链接到 `/opportunities`，该路由已被删除
- **建议**: 改为 `/quotations` 或直接移除该 tab

#### 2.4 Pipeline 卡片导航不一致
- **文件**: `src/components/pipeline/PipelineCard.tsx:17`
- **现象**: `entityType === 'inquiry'` 的卡片跳转到 `/quotations/${card.entityId}`，但 entityId 是 inquiry 的 ID，不是 quotation 的 ID
- **后果**: 点击后 QuotationDetail 页面会尝试用 inquiry ID 查询 quotations 表，返回 404
- **建议**: 移除 inquiry 类型的卡片处理（inquiries 已不存在），或确保 pipeline 不再产生 inquiry 类型卡片

---

### 🟡 中等 (功能可用但有瑕疵)

#### 2.5 Dashboard 引用已废弃的 inquiries
- **文件**: `src/pages/Dashboard.tsx`
  - Line 64: `fetch('/api/inquiries')` — 返回空数组
  - Line 107: 管线阶段含 `link: '/inquiries'` — 死链接
  - Line 360: "Recent Inquiries" 区域链接到 `/inquiries`
  - Line 368: 每条 inquiry 行链接到 `/inquiries/:id` — 均 404
- **建议**: 移除 inquiries 管线阶段，将 `Recent Inquiries` 改为 `Recent Quotations`

#### 2.6 报价复制时丢失需求信息字段
- **文件**: `src/pages/QuotationDetail.tsx:213-230`
- **现象**: `duplicate()` 函数创建报价复制时，未包含 `application_description`, `target_material_requested`, `quantity_estimate`, `urgency`, `source`
- **后果**: 复制的报价丢失所有客户需求上下文
- **建议**: 在 POST body 中加入这 5 个字段

#### 2.7 CustomerSummary 组件仍依赖 inquiries
- **文件**: `src/components/shared/CustomerSummary.tsx:24,33,48-50`
- **现象**: 计算 `openInquiries`、产品统计、next action 均使用 `inquiries` prop
- **注意**: 该组件当前未被任何页面使用（CompanyDetail 已改为直接渲染 quotation 卡片），但代码仍存在
- **建议**: 清理或更新该组件

#### 2.8 后端 `navigate(-1)` 无回退方案
- **文件**: `InquiryDetail.tsx:270`, `InquiryNew.tsx:66,179`, `CompanyDetail.tsx:176`, 等 7 处
- **现象**: 用户通过直接 URL 进入时，浏览器无历史记录，`navigate(-1)` 无效果
- **建议**: 参考 `ShipmentDetail.tsx:186` 的做法，使用明确的 `<Link to="/quotations">` 替代

#### 2.9 QuotationEditPanel 编辑模式不显示公司/联系人选择器
- **文件**: `src/components/quotations/QuotationEditPanel.tsx`
- **现象**: 编辑已有报价时，公司、联系人以只读信息条显示，但需求描述、材料、数量、紧急程度、来源字段仍然可编辑
- **后果**: 编辑时无法修改基本字段（公司、联系人），但可以修改需求内容——逻辑不一致
- **建议**: 编辑模式下允许修改公司、联系人，或将所有需求字段设为统一模式

---

### 🟢 低 (可优化)

#### 2.10 Dashboard 管线阶段仍包含 `Sample` 和 `Inquiry`
- **文件**: `src/pages/Dashboard.tsx:107-109`
- **建议**: 简化为 `Quotation → Order → Shipment → Payment`

#### 2.11 无 404 路由兜底
- **文件**: `src/App.tsx`
- **现象**: 访问不存在的路径时渲染空白页面，无友好提示
- **建议**: 添加 `<Route path="*" element={<NotFound />} />`

#### 2.12 部分页面使用原生 fetch 绕过 API 模块
- **文件**: `Dashboard.tsx:61-67`, `QuotationDetail.tsx:130,158,210`
- **现象**: 直接使用 `fetch()` 而非 `src/lib/api.ts` 封装的函数，无统一错误处理和 token 注入
- **注意**: Dashboard 的 fetch 调用确实会被 `installAuthenticatedFetch()` 拦截注入 token，但缺少统一错误处理

#### 2.13 QuotationEditPanel 宽度在桌面端可能不够
- **文件**: `src/components/quotations/QuotationEditPanel.tsx`
- **现象**: `width="w-[min(560px,calc(100vw-1rem))]"` — 现在表单增加了公司/联系人/需求描述等多个字段，560px 在桌面端可能偏窄

---

## 三、API 前后端一致性检查

| 前端调用 | 后端路由 | 状态 |
|---|---|---|
| `followUps.list({bucket:'thisWeek'})` | `GET /api/activities/follow-ups?bucket=thisWeek` | ✅ 已修复 |
| `quotations.create({application_description,...})` | `POST /api/quotations` | ✅ 匹配 |
| `quotations.update(id,{application_description,...})` | `PUT /api/quotations/:id` | ✅ 匹配 |
| `quotations.list()` | `GET /api/quotations` | ✅ 匹配（已移除 inquiry JOIN） |
| `quotations.get(id)` | `GET /api/quotations/:id` | ✅ 匹配 |
| `inquiries.list()` | `GET /api/inquiries` | ⚠️ 返回空（数据已软删除） |
| `pipeline.move(entityType,id,from,to)` | `PUT /api/pipeline/move` | ✅ 匹配 |
| `POST /api/orders` (QuotationDetail:158) | `POST /api/orders` | ✅ 匹配 |
| `POST /api/quotations` (QuotationDetail:210) | `POST /api/quotations` | ⚠️ 复制时缺失新字段 |

---

## 四、前端链接完整性检查

| 来源 | 目标路径 | 状态 |
|---|---|---|
| Sidebar | `/dashboard`, `/pipeline`, `/companies`, `/companies/follow-ups`, `/quotations`, `/orders`, `/shipments`, `/payments`, `/inventory`, `/materials-tooling`, `/activities`, `/tasks` | ✅ 全部有效 |
| App "/" 重定向 | `/quotations` | ✅ |
| Pipeline 页 tab | `/opportunities` | ❌ 死链接 |
| Pipeline 页 tab | `/inquiries` | ⚠️ 空数据 |
| Pipeline 卡片 (quotation) | `/quotations/:id` | ✅ |
| Pipeline 卡片 (sample) | `/samples/:id` | ❌ 死链接 |
| Dashboard KPI 卡片 | `/payments`, `/orders`, `/quotations` | ✅ |
| Dashboard 管线 | `/inquiries`, `/samples` | ❌ 死链接 |
| Dashboard Recent Inquiries | `/inquiries`, `/inquiries/:id` | ❌ 404 |
| CompanyDetail "+ 新建报价" | QuotationEditPanel | ✅ |
| QuotationDetail 复制 | `/quotations/:id` | ✅ |
| QuotationDetail 创建订单 | `/orders/:id` | ✅ |
| Quotations 列表 | `/quotations/:id` | ✅ |
| Inquiries 列表 | `/inquiries/new`, `/inquiries/:id` | ⚠️ 空数据+404 |

---

## 五、优先修复清单 (Top 10)

| # | 严重度 | 问题 | 文件 |
|---|---|---|---|
| 1 | 🔴 | Follow-ups 页面 400 报错 | `server/routes/activities.ts:20` ✅ 已修复 |
| 2 | 🔴 | Pipeline 卡片 `/samples/:id` 死链接 | `PipelineCard.tsx:19` |
| 3 | 🔴 | Dashboard `/samples` 死链接 | `Dashboard.tsx:109` |
| 4 | 🔴 | Pipeline `/opportunities` 死链接 | `Pipeline.tsx:198` |
| 5 | 🔴 | Pipeline inquiry 卡片跳转错误 (inquiry id → quotation page) | `PipelineCard.tsx:17` |
| 6 | 🟡 | Dashboard "/inquiries" 死链接 (多处) | `Dashboard.tsx:107,360,368` |
| 7 | 🟡 | 报价复制丢失需求字段 | `QuotationDetail.tsx:213` |
| 8 | 🟡 | Pipeline "/inquiries" tab 死链接 | `Pipeline.tsx:204` |
| 9 | 🟢 | 无 404 路由 | `App.tsx` |
| 10 | 🟢 | CustomerSummary 未更新 | `CustomerSummary.tsx` |
