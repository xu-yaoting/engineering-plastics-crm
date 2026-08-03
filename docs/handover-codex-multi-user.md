# CRM 多用户协同 — 交接文档

**编写时间**：2026-07-11
**交接给**：Codex
**背景**：CRM 局域网测试一周，准备推广给客户下载使用。

---

## 已完成 — Phase 1：用户系统（姓名 + 无密码）

### 架构

```
登录页 → POST /api/auth/register {name}
              ↓
        token 存 localStorage
              ↓
  每次请求带 Authorization: Bearer <token>
              ↓
        auth.ts 中间件验证 → req.user = { id, name }
```

### 关键文件

| 文件 | 说明 |
|------|------|
| `server/db.ts` | 新增 `users` 表 + `audit_log` 表 |
| `server/auth.ts` | Token 认证中间件，读 `Authorization: Bearer` 头，设 `req.user` |
| `server/routes/auth.ts` | `POST /register` — 注册/登录，`GET /me` — 验证 token |
| `server/index.ts` | 公开端点 → auth 路由 → authMiddleware → 业务路由 |
| `src/lib/api.ts` | 全局注入 `Bearer` 头，401 自动清除 token |
| `src/lib/auth.tsx` | AuthContext：`{ user, loading, login, logout }` |
| `src/pages/Login.tsx` | 姓名输入 → 注册/登录 |
| `src/App.tsx` | 未认证 → 显示 Login 页 |
| `src/components/shared/UserMenu.tsx` | 显示当前用户 + 退出登录 |
| `package.json` | 新增 `npm start` 和 `npm run build` 脚本 |

### 验证

- 82/82 测试通过
- TypeScript 类型检查无错误（client + server）
- Vite 构建成功

---

## 待完成 — Phase 2：审计追踪（完整变更历史）

### 2.1 数据库

`audit_log` 表已建在 `server/db.ts` 中：

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,         -- 'company', 'order' 等
  entity_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'create', 'update', 'delete'
  changes TEXT NOT NULL DEFAULT '{}', -- JSON: {"field": {"old": val, "new": val}}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 新建 `server/audit.ts`

核心函数：

```typescript
function logAudit(entityType, entityId, userId, userName, action, changes)
function computeChanges(before, after)  // 返回有差异的字段
```

### 2.3 修改 11 个路由文件

每个 PUT 操作：

```typescript
router.put('/:id', (req, res) => {
  const before = db.prepare("SELECT * FROM table WHERE id = ?").get(req.params.id);
  // ... 现有更新逻辑 ...
  const after = db.prepare("SELECT * FROM table WHERE id = ?").get(req.params.id);
  logAudit('entity', req.params.id, req.user.id, req.user.name, 'update',
    computeChanges(before, after));
  res.json(after);
});
```

POST 类似（before=null），DELETE 类似（after=null）。

涉及文件路径：`server/routes/*.ts`（共 11 个）

### 2.4 `created_by` / `updated_by`

为以下表加两个 TEXT 字段，在 INSERT/UPDATE 时填 `req.user.id`：
- `companies`, `contacts`, `inquiries`, `quotations`, `orders`, `shipments`, `invoices`, `payment_records`

### 2.5 前端审计历史 UI

在各详情页底部加"操作历史"区域：
- `/api/audit?entity_type=xxx&entity_id=yyy` 端点
- 格式：`张三 于 2026-07-11 14:30 修改了 单价`

---

## 待完成 — Phase 3：生产部署

### 3.1 Express 静态文件服务（已完成）

`server/index.ts` 中已实现：

```typescript
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}
```

### 3.2 构建

```bash
npm run build    # vite build + tsc -p tsconfig.server.json
npm start        # NODE_ENV=production node dist-server/index.js
```

### 3.3 待创建

| 文件 | 内容 |
|------|------|
| `Dockerfile` | node:20-alpine, npm ci, npm run build, CMD |
| `docker-compose.yml` | 单服务，挂载 crm.db + backups 卷 |
| `README.md` | 两种部署方式 + 首次启动指南 + 备份还原 |
| 更新 `.env.example` | 生产环境配置参考 |

---

## 架构要点

### 认证流程（已实现）

```
首次访问 → Login 页 → 输入姓名
    ↓
POST /api/auth/register {name}
    ↓
服务端查 users 表（名已存则返回旧 token，否则新创建）
    ↓
token 存 localStorage
    ↓
所有请求自动带 Authorization: Bearer <token>
```

### 重要约定

1. **Token 无过期**（轻量化），用户不退出就永久有效
2. **姓名 + 无密码**，同一姓名多次注册返回同一用户
3. **公开端点**（不需认证）：`GET /api/config`、`GET /api/health`、`POST /api/auth/register`、`GET /api/auth/me`
4. **`req.user`**：所有受保护路由中可用，`type { id: string, name: string }`
5. **CORS**：开发环境保留，生产环境同源 serve 不需要
6. **HOST** 默认 `127.0.0.1`，生产部署需显式设 `HOST=0.0.0.0`

### 注意事项

- 行合计、金额等财务字段已统一为 `Inter + tabular-nums`，全项目 font-mono 已清理完毕
- SQLite 适合 <50 人团队，大团队需考虑 PostgreSQL 迁移
- 审计日志会逐渐增大，后续需考虑归档策略
