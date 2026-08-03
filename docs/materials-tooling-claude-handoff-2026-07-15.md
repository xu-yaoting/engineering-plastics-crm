# Materials & Tooling 交接文件（交给 Claude）

更新时间：2026-07-15（Asia/Shanghai）  
项目：`/Users/myairbook/AIProjects/engineering-plastics-crm`  
当前目标：在现有 CRM 内新增独立的 `Materials & Tooling / 物资与工装` 模块，并尽快让用户从 Inventory 下方进入系统页面查看和操作。

## 0. 接手后的第一条指令

不要重新设计，不要清理工作树，不要先提交代码。先完整阅读：

1. `/Users/myairbook/AIProjects/AGENTS.md`
2. `/Users/myairbook/AIProjects/RTK.md`（由上级 AGENTS.md 引用）
3. 本项目 `README.md`、`PLANS.md`、`DESIGN.md`
4. `docs/superpowers/specs/2026-07-14-materials-tooling-design.md`
5. `docs/superpowers/plans/2026-07-14-materials-tooling-implementation.md`
6. 本交接文件

然后先运行只读检查：

```bash
git status --short
rg --files server/materials-tooling tests | sort
```

当前工作树非常脏，包含 Nathan 的既有修改和本模块大量未跟踪文件。禁止 reset、checkout、clean、批量格式化、删除或覆盖不相关改动。未经 Nathan 明确要求，不要暂存、提交或 push。

## 1. 已确认的产品边界，不得擅自改变

- 模块标题：英文 `Materials & Tooling`，中文 `物资与工装`。
- 放在 CRM 左侧栏 Inventory 下方，但路由、页面、数据和 Inventory 保持独立。
- 禁止把它叫作“库存管理”，也不得与原 CRM 的客户、询盘、报价、订单或项目建立业务关联。
- 只复用 CRM 的 `users` 和 `audit_log`；业务表全部使用 `mt_` 前缀。
- 所有已登录用户都能进入和查看非敏感记录；Moana 是主要编辑、上传和执行人员。
- 采购价格、供应商、合同号、发票号属于敏感采购信息；没有 `viewPrices` 权限时必须由服务端删除，不能只在前端隐藏。
- 金额记录的主要目的，是保留历史采购底价以便后续议价；采购通常有发票，大件通常有合同。
- 系统保留线上审批和审计，同时支持下载打印、线下签字、签字件回传。
- 第一期单个物料只允许一个计量单位，不支持“箱转个”等单位换算。
- 不支持单张执行单部分执行；数量需要变化时，审批前修改或拆成多张单据。
- 提交审批时不因库存不足而拦截；最终执行事务内重新校验，禁止负库存。
- 审批必须基于不可变版本快照；主档名称、人员名称后续变化不得改写历史。
- 工装的状态、保管人和地点只能通过审批后的工装动作单改变，禁止直接编辑。
- 遗失必须审批、有书面原因，并至少有一张未删除的 `tooling_photo` 证据。这是 Nathan 后来明确确认的规则，优先于旧规格中的 `when available` 表述。
- 已执行单据的更正使用“作废原单 + 新顺序编号替换单 + 双向关联”，不能覆盖原单。
- 附件必须私有存储，下载使用短时签名 URL，不能暴露永久静态路径。

## 2. 当前实现状态

### 已完成的后端能力

以下能力已经实现并通过测试，不要重写：

1. `mt_` 独立数据库结构、安全增量迁移、约束、索引和不可变触发器。
2. 模块权限、静态审批人配置、禁止自审、价格权限。
3. 物料和供应商主档 HTTP CRUD。
4. 单据编号、创建、编辑、提交、撤回、驳回、重新提交、审批和版本冻结。
5. 采购入库、领用、退回、报废、盘点调整的原子执行与库存流水。
6. 禁止负库存、重复执行保护、采购申请分多张完整收货单履行。
7. 已执行耗材单据的原子反冲、作废和替换。
8. 私有附件、权限过滤、短时签名下载、签字件闭环。
9. 申请版/审批版 PDF、价格脱敏、不可变版本输出。
10. 概览、采购价格历史、月度台账、结账/反结账、Excel 和 A3 PDF 导出。
11. 工装主档、价格与证据脱敏、完整历史读取。
12. 结构化工装动作申请 `mt_tooling_requests`、审批冻结和版本防漂移。
13. 工装实际执行：领用、归还、借出、转交、送修、修复完成、报废、遗失。
14. 工装执行使用审批快照，原子更新资产/单据/历史/双审计；重复执行、非法转换、路径资产不一致均返回 409。
15. 工装专用执行入口和通用单据执行入口都会检查月度结账。
16. 工装流转只写 `mt_tooling_movements`，绝不能复用耗材 `mt_movements`。

### 最新验证基线

在最后一个后端批次完成后已验证：

```text
node --test tests/materials-tooling-assets.test.mjs  -> 2/2 PASS
npm run test                                        -> 207/207 PASS
npm run build                                       -> PASS（Vite + server tsc）
```

测试需要本机临时 IPC 和监听端口。若沙箱内出现 `listen EPERM ... tsx-*.pipe`，这是运行环境限制，不是业务测试失败；应按权限流程申请在沙箱外运行。测试只允许使用临时目录、匿名用户和临时 SQLite，禁止写真实 `crm.db`。

### 当前主要文件

```text
server/materials-tooling/schema.ts
server/materials-tooling/permissions.ts
server/materials-tooling/documents.ts
server/materials-tooling/movements.ts
server/materials-tooling/attachments.ts
server/materials-tooling/pdf.ts
server/materials-tooling/reporting.ts
server/materials-tooling/tooling.ts
server/routes/materials-tooling.ts
tests/materials-tooling-*.test.mjs
```

这些文件目前大多是未跟踪文件，但包含已验证的完整工作成果。不要因为 `??` 就认为它们可以删除。

## 3. 当前明确未完成的内容

1. 前端页面完全没有接入，所以用户现在还不能在 CRM 中看到 `Materials & Tooling`。
2. 已执行工装单据的作废反冲尚未实现；公开作废接口目前安全返回 409。
3. 工装审批 PDF 很可能还没有把结构化 `tooling_request` 以适合签字的表格呈现，需要专项测试确认后补，不得凭感觉判断。
4. Excel 切换导入未实现（原计划 Task 10）。
5. 数据库与附件一起备份/恢复未实现（Task 11）。
6. 独立全流程 smoke test 未实现（Task 12）。
7. Materials、Documents、Ledger、Tooling、Approvals、Settings 的完整 UI 尚未实现（Tasks 16–19）。
8. 操作手册和最终人工验收未完成（Task 20）。

## 4. 接下来必须采用的执行顺序

Nathan 当前最关心“什么时候能在系统里面查看”。因此先把可见页面做出来，再回头补导入、备份和 smoke。为避免先出现一个会跳转到空白页的侧边栏链接，前端顺序与原计划 13→14→15 略作调整。

### 下一批 V1：页面壳和类型化 API（最多 3 文件）

只允许：

```text
tests/materials-tooling-shell.test.mjs
src/lib/materials-tooling-api.ts
src/pages/MaterialsToolingPage.tsx
```

要求：

- 先写失败测试，再实现。
- API client 使用现有认证 fetch 机制，不另造 token 状态。
- 下载必须 authenticated fetch → Blob，禁止永久 `<a href>`。
- 页面先提供真实 Overview；数据来自现有 `/api/materials-tooling/overview` 和 `/me`。
- 页面具备 Overview、Materials、Documents、Monthly Ledger、Tooling、Approvals 六个 tab 的可访问语义；未接线 tab 显示明确空态，不伪造数据。
- `viewPrices=false` 时不渲染采购金额，不能在前端缓存或推断被服务端删除的数据。
- 使用现有 `DESIGN.md`、`data-surface`、紧凑表格和既有页面层级；不要生成常见 AI 大卡片仪表盘。
- 不添加生产依赖。
- 结束时运行定向测试和 `npm run build`，然后停止，等待 Nathan 说“继续”。

### 下一批 V2：注册前端路由（最多 3 文件）

只允许：

```text
tests/materials-tooling-shell.test.mjs
src/App.tsx
src/pages/MaterialsToolingPage.tsx
```

要求：

- 先添加路由失败断言。
- 注册 `/materials-tooling`，不触碰 `/inventory` 的实现和数据。
- 确保直接访问 URL 可显示页面、刷新不丢失。
- 结束时定向测试 + build，然后停止。

### 下一批 V3：导航和完整双语键（最多 3 文件）

只允许：

```text
tests/materials-tooling-navigation.test.mjs
src/lib/i18n.tsx
src/components/layout/Sidebar.tsx
```

要求：

- 先写失败测试。
- `/materials-tooling` 必须紧跟在 `/inventory` 后面。
- 标题为 `Materials & Tooling / 物资与工装`，不要叫 Inventory Management 或库存管理。
- 使用现有 Lucide 图标体系，不手写 SVG，不添加依赖。
- 补齐 overview/materials/documents/ledger/tooling/approvals/settings/status/error/export/sensitive-data 等中英文键。
- 不允许新增明显硬编码英文可见文案。
- 完成本批后，用户即可从系统侧边栏进入并查看真实概览。

每一批最多修改 3 个文件。这是 Nathan 的硬规则。每批完成后必须停下，给出完成报告并等待“继续”，不能为了赶进度把 V1–V3 合并。

## 5. 页面可见后继续的顺序

1. Task 16：Materials + Documents UI。
2. Task 17：Ledger + Tooling UI。
3. Task 18：Approvals + Settings UI。
4. Task 19：全部 tab 接线，保持当前 tab，mutation 后只刷新对应查询。
5. 工装 PDF 表格专项：先验证现状；如缺失，用 PDF 测试 + `pdf.ts` 在不超过 3 文件的一批内补齐。
6. 工装作废反冲，拆成两个可独立验证的批次，见下一节。
7. Task 10 安全切换导入。
8. Task 11 数据库 + 附件联合备份恢复。
9. Task 12 独立全流程 smoke。
10. Task 20 操作手册、全量验证和人工验收。

## 6. 工装作废反冲的正确拆分

这个缺口不能用“直接删 movement”或“把原 movement 改掉”解决。历史必须 append-only。当前 `mt_tooling_movements.movement_type` 没有 `void_reversal`，完整实现天然涉及 schema、service、route、test 四类文件，不能在一个 3 文件批次硬塞。

建议拆分：

### R1：领域服务和 schema（3 文件）

```text
tests/materials-tooling-assets.test.mjs
server/materials-tooling/schema.ts
server/materials-tooling/tooling.ts
```

- 先在公开 service interface seam 测试反冲与替换，不先挂 HTTP。
- 增量迁移 `mt_tooling_movements` 支持明确的 `void_reversal`，旧数据、FK、自定义索引必须保留。
- 反冲从原 movement 恢复 `from_status/from_custodian/from_location`。
- 写一条新的 append-only reversal movement，不修改或删除原 movement。
- 原单变 `voided`，新单使用全新顺序编号并双向关联。
- 所有写入和审计在一个 immediate transaction 内；任一失败全部回滚。
- 如果同一工装在原 movement 后已有后续 movement，拒绝反冲，避免改写后续历史。

### R2：HTTP 接线（最多 3 文件）

```text
tests/materials-tooling-void-reversal.test.mjs（或复用 assets test，但只选一个）
server/routes/materials-tooling.ts
server/materials-tooling/tooling.ts（仅必要的小修）
```

- `/documents/:id/void-and-replace` 按 document type 分派：耗材继续使用 `movements.ts`，工装使用 `tooling.ts`。
- 管理员权限、结账期、重复作废、后续 movement、审计失败都要 HTTP 测试。
- 不能让工装反冲写入耗材 `mt_movements`。

## 7. 工装状态机的既定规则

当前 `tooling.ts` 已有明确 `TRANSITION_RULES`，继续复用，不改成散落的多处分支：

```text
issue:             in_stock -> in_use
loan:              in_stock -> loaned
return:            in_use/loaned -> in_stock
transfer:          非终态保持当前状态，只更新目标保管人/地点
repair:            in_stock/in_use -> under_repair
repair_completion: under_repair -> in_stock
disposal:          任意非 disposed/lost -> disposed
loss_report:       任意非 disposed/lost -> lost
```

- issue/loan 必须有目标保管人。
- return/repair/repair_completion 必须有目标地点，并清空保管人。
- transfer 至少改变保管人或地点，未提供的字段保留当前值。
- disposal/loss 清空保管人；未提供目标地点时保留最后地点。
- loss_report 必须有原因和照片。
- 执行使用冻结 request，不能信任当前 `mt_tooling_requests` 可变行。
- duplicate execution 返回 409，不能重复 history 或 audit。

## 8. 开发方法和质量门槛

### 每批固定流程

1. 重新读目标文件、imports、相似实现和现有测试。
2. 明确本批 public seam；优先 HTTP seam，除非为了 3 文件拆批而明确采用导出的 service interface。
3. 写一条会因为缺失行为而真实失败的测试，记录 red 原因。
4. 只实现足以通过当前行为的最小改动。
5. 检查权限、事务、审计、历史防漂移和服务端脱敏。
6. 运行定向测试。
7. 运行 `npm run test` 和 `npm run build`（高风险或公共模块改动必须全量）。
8. 做两轴只读复审：Spec 与 Standards 分开；复审 agent 不得修改文件。
9. 修复真实问题，重新验证。
10. 简洁汇报并停止，等待 Nathan 的“继续”。

Nathan 已选择“分任务执行（推荐）”。如果运行环境支持 subagents，建议每批使用一个实现 agent，完成后再使用两个只读 review agent；主 agent 必须亲自核对关键代码和最终测试，不能只转发子 agent 结论。

### 完成报告固定格式

- **改了什么**：列文件和真实行为。
- **验证了什么**：给出命令和精确通过数量。
- **未验证的内容**：说明原因和后续命令。
- **风险或后续建议**：只列真实缺口。
- 明确是否暂存/提交。

### 禁止事项

- 不要添加 Jest、Supertest、React Testing Library 或其他依赖；现有 Node test runner 足够。
- 不要写真实客户、供应商、合同金额或联系方式进测试。
- 不要修改生产环境、环境变量、密钥或真实数据库。
- 不要启动/停止用户正在使用的 CRM 服务，除非先说明影响并取得确认。
- 不要因为看到旧代码风格问题就顺手重构。
- 不要把价格脱敏责任交给前端。
- 不要把工装 movement 写入 `mt_movements`。
- 不要把 `Materials & Tooling` 合并进原 Inventory 数据表或页面状态。
- 不要修改 jekinpolymer.com、WordPress、小程序或任何不在本项目范围内的内容。

## 9. 关键验证命令

```bash
cd /Users/myairbook/AIProjects/engineering-plastics-crm

# 最小后端回归
node --test tests/materials-tooling-assets.test.mjs

# 所有 Materials & Tooling 测试
node --test tests/materials-tooling-*.test.mjs

# 全量测试
npm run test

# 前端 + server TypeScript 构建
npm run build
```

不要默认运行 `npm run smoke:api`：它是本地写入流程，运行前要说明影响。未来的 `smoke:materials` 必须使用临时数据库和临时附件目录，运行前后证明真实 `crm.db` 未变化。

## 10. 交接完成标准

接手者只有在满足以下条件时，才算延续了当前实现质量：

- 保持 `mt_` 数据隔离和服务端权限边界。
- 所有业务写操作都来自审批快照、事务化并有审计。
- 纸质下载/签字件与线上历史形成闭环。
- 页面使用真实 API，不使用演示数字或伪造汇总。
- 中英文完整，价格权限正确，所有用户可进入但敏感操作受控。
- 每批不超过 3 文件、red→green、验证、双轴复审、暂停交付。
- 不破坏当前 207/207 测试基线和生产构建。

如果计划文件中的复选框与代码或测试冲突，以“代码 + 通过的测试 + 本交接记录”为当前事实；不要为了让复选框好看而重做已完成模块。最终 Task 20 再统一、如实更新计划复选框。
