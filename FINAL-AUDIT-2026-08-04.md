# CRM 全面复查报告

**日期**: 2026-08-04 | **Commit**: `2396862` (检查时) | **检查范围**: 全栈

---

## 自动化验证

| 项目 | 结果 |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 无错误 |
| 构建 (`npm run build`) | ✅ 成功 |
| 测试 (`npm test`) | 407/408 通过 (1 个集成测试需运行中服务器) |

---

## 一、全局链接与路由 — ✅ 通过

- 侧边栏 12 个 NavLink 全部与 App.tsx 路由匹配
- `/inquiries`、`/inquiries/new`、`/inquiries/:id` 均有 301 重定向到 `/quotations`
- Dashboard 管线 4 个阶段链接均有效 (`/quotations`, `/orders`, `/shipments`, `/payments`)
- Pipeline 卡片跳转正确 (quotation→/quotations, order→/orders, sample→/companies)
- 不存在 `entityType === 'inquiry'` 处理逻辑
- 无 `/samples`、`/opportunities` 死链接
- **0 个死链接**

### 低优先级发现

| # | 问题 | 文件 |
|---|---|---|
| L1 | `window.location.href` 硬刷新替代 SPA 导航 | `OrderDetail.tsx:278` |
| L2 | `/login` 不是显式路由（依赖 `!user` 条件渲染） | `App.tsx` |
| L3 | 未挂载的 `server/routes/inquiries.ts` 死代码 | `server/routes/inquiries.ts` |
| L4 | 空目录 `server/{routes}/` | `server/` |
| L5 | TopBar 搜索不传参 | `TopBar.tsx:54` |
| L6 | 重复 `/contacts` 路由 | `App.tsx:178` |

---

## 二、页面布局 — ✅ 通过，2 处已修复

| # | 问题 | 严重度 | 状态 |
|---|---|---|---|
| P1 | 报价复制缺失 Terms/Fees 字段 | 🔴 | ✅ 已修复 (QuotationDetail.tsx) |
| P2 | Fees 标题仍显示 "Shipping & Discount" | 🟡 | ✅ 已修复 (i18n + edit panel) |
| P3 | 详情页下拉菜单无外部点击关闭 | 🟡 | 待修复 |
| P4 | Portal 菜单位置不随滚动更新 | 🟢 | 待修复 |
| P5 | LineItem 接口仍含 discount_percent | 🟢 | 待修复 |
| P6 | CompanyDetail KPI 标签 "Open Pipeline" | 🟢 | 待修复 |

### 已确认正确的项

- QuotationDetail: Pricing Summary 在左侧 Line Items 下方 ✅
- QuotationDetail: 右侧 Terms→Responsibility 顺序 ✅
- CompanyDetail: 3 格 KPI ✅
- CompanyDetail: "New Quotation" 打开 QuotationEditPanel ✅
- CompanyEditPanel: 分组 + 可折叠地址 + 固定底部 ✅
- QuotationEditPanel: Material/Qty/Discount 已移除 ✅
- QuotationEditPanel: Fees 可折叠 ✅
- FollowUpWorkbench: 默认 This Week + Suggest 蓝色标签 + btn-ghost ✅
- 4 个列表页表头居中 ✅

---

## 三、数据与 API — ✅ 通过，1 处已修复

| # | 问题 | 严重度 | 状态 |
|---|---|---|---|
| D1 | db.ts 迁移顺序错误（软删除在字段复制前） | 🔴 | ✅ 已修复 |
| D2 | `thisWeek` bucket 后端不过滤（前端已处理） | 🟢 | 无影响 |
| D3 | 死代码迁移块（QT- 编号、孤儿创建） | 🟢 | ✅ 已删除 |

### 已确认正确的项

- quotations POST/PUT 接受新字段 ✅
- `inquiry_id` 已从所有位置移除 ✅
- 报价删除使用 `DELETE` 端点 ✅
- 报价复制包含 5 个需求字段 ✅
- Follow-ups `thisWeek` 加入 allowedBuckets ✅
- Pipeline 不再生成 inquiry 卡片 ✅
- Pipeline quotation 卡片使用 `target_material_requested` ✅
- Pipeline stageMap 无 inquiry ✅
- Orders UPDATE_FIELDS 无 inquiry_id ✅

---

## 四、优先修复清单 (Top 5)

| # | 严重度 | 问题 | 文件 |
|---|---|---|---|
| 1 | 🔴 | db.ts 迁移顺序 | server/db.ts ✅ |
| 2 | 🔴 | 报价复制丢失 Terms/Fees | QuotationDetail.tsx ✅ |
| 3 | 🟡 | 下拉菜单无外部点击关闭 | QuotationDetail.tsx |
| 4 | 🟡 | Fees 标题未更新 | QuotationEditPanel.tsx ✅ |
| 5 | 🟢 | 未挂载死代码 + 空目录 | inquiries.ts, {routes}/ |

---

## 五、整体评价

**核心功能健全**：路由无死链、API 前后端一致、数据迁移已修正、7 个页面布局统一对齐。

**剩余问题均为低优先级**（外部点击关闭、i18n 标签、死代码清理），不影响用户正常使用。
