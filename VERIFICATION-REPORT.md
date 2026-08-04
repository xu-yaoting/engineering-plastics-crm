# 清理后验证报告

**日期**: 2026-08-04 | **基准 Commit**: `4034681`

---

## ✅ 通过的检查

### 1. 死链接清理

| 检查项 | 结果 |
|---|---|
| `/inquiries` 路径引用 | ✅ 0 处残留（App.tsx 已添加 301 重定向） |
| `/samples` 路径引用 | ✅ 0 处残留 |
| `/opportunities` 路径引用 | ✅ 0 处残留 |
| Pipeline 顶部 tabs | ✅ 仅保留 Quotations + Orders |
| Dashboard 管线阶段 | ✅ Quotation / Order / Shipment / Payment |
| Dashboard KPI 卡片 | ✅ 均指向有效路由 |
| Inquiries 页面文件 | ✅ 已删除（3 个文件） |

### 2. Inquiry → Quotation 合并

| 检查项 | 结果 |
|---|---|
| `entityType === 'inquiry'` 卡片 | ✅ 服务端不再生成 |
| `inquiries.` API 调用 | ✅ 0 处残留 |
| `inquiries` API 模块 | ✅ 已从 api.ts 移除 |
| `/api/inquiries` 路由挂载 | ✅ 已从 server/index.ts 移除 |
| `inquiry_id` in quotations POST | ✅ 已移除（字段、验证、INSERT） |
| `inquiry_id` in orders UPDATE | ✅ 已从 ORDER_UPDATE_FIELDS 移除 |
| Pipeline inquiry stageMap | ✅ 已删除 |

### 3. 核心业务流

| 流程 | 结果 |
|---|---|
| 新建报价 → 5 个需求字段 | ✅ company/contact/description/material/qty/urgency/source |
| 复制报价 → 需求字段完整性 | ✅ 5 字段全部复制（QuotationDetail.tsx:219-223） |
| 报价 → 创建订单 | ✅ 保留原有逻辑 |
| 公司详情 → 新建报价 | ✅ 预填 company_id + company_name |
| Follow-ups 页面 | ✅ thisWeek 参数已加入 allowedBuckets |

### 4. 编辑模式

| 检查项 | 结果 |
|---|---|
| 新建时公司/联系人 | ✅ 可编辑下拉框 |
| 编辑时公司/联系人 | ✅ 只读信息条 |
| 需求字段（新建/编辑） | ✅ 均可编辑（description/material/qty/urgency/source） |

### 5. Pipeline

| 检查项 | 结果 |
|---|---|
| 标题 | ✅ Pipeline（非 Opportunities） |
| 列数 | ✅ 4 列（quotation/sample/testing/order） |
| 卡片分组 | ✅ `c.stage === col.key`（不再合并 sample+testing） |
| 卡片跳转 | ✅ quotation→/quotations, order→/orders, sample→/companies |

---

## ⚠️ 仍存在的问题

### 1. 无 404 路由（优先级：中）

**文件**: `src/App.tsx`

App.tsx 没有 `<Route path="*" element={<NotFound />} />` 兜底路由。访问任何不存在路径会渲染空白页面。

**建议**: 添加 404 页面或在现有 Routes 末尾加 catch-all。

### 2. 返回按钮依赖 `navigate(-1)`（优先级：中）

**文件**: `src/pages/QuotationDetail.tsx:294`, `src/pages/CompanyDetail.tsx:176`, 等

直接 URL 访问或刷新后 `navigate(-1)` 无效果。

**建议**: 参考 `ShipmentDetail.tsx:186` 使用 `<Link to="/quotations">` 替代。

### 3. CustomerSummary.tsx — 死代码（优先级：低）

**文件**: `src/components/shared/CustomerSummary.tsx`

该组件包含 inquiry 引用，但未被任何页面导入。可安全删除。

### 4. `nav.inquiries` i18n key 已无用（优先级：低）

`nav.inquiries` 在 i18n.tsx 中仍存在但不再被使用。可保留或清理。

---

## 📊 测试结果

- TypeScript: ✅ 无错误
- 构建: ✅ 成功
- 测试: ✅ 407/408 通过（1 个集成测试需要运行中服务器）
