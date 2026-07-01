# Release Notes — Engineering Plastics CRM v1.0.0

**发布日期：** 2026-07-01  
**版本：** v1.0.0  
**状态：** Local Formal Release (单用户本地版)  
**维护人：** Nathan

---

## 概述

Engineering Plastics CRM 本地正式版，面向工程塑料销售日常工作的轻量 CRM 系统。专注于：客户管理、询盘跟踪、报价/订单执行、库存管理、回款/发货追踪。

当前为**单用户本地版本**，所有数据存储在本地 SQLite 数据库，通过桌面快捷方式一键启动。

---

## 功能清单

### 客户管理
- 公司档案（含多联系人、多地址）
- 联系人管理（含多维度信息）
- 客户摘要面板（近期活动、交易汇总）
- 邮件草稿助手

### 销售管道
- 可视化 Pipeline 看板
- 询盘记录（来源、紧急度、品类）
- 报价管理（含 PDF 生成）
- 订单管理（含明细、状态追踪）

### 库存管理
- 产品目录（SKU、规格、品类）
- 库存台账（出入库记录）
- 库存调整（盘盈/盘亏）
- 库存盘点入口

### 业务支撑
- 活动时间线（电话、邮件、会议）
- 会议纪要
- 任务管理
- 回款记录
- 发货追踪

### 系统功能
- 中英文界面（i18next，实时切换）
- 紧凑型 Attio 风格排版
- 本地 SQLite 数据持久化
- 一键备份/恢复
- 桌面快捷方式启动
- 本地 API Smoke 安全校验
- 字段级更新白名单保护

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS 3 |
| 后端 | Express + TypeScript (tsx) |
| 数据库 | SQLite (better-sqlite3) |
| 国际化 | i18next + react-i18next |
| PDF | PDFKit |
| 桌面启动 | macOS .command → 脚本启动 |

---

## 已知限制（v1.0.0 不包含）

- 多用户协同
- 用户角色与权限
- 网络远程访问
- 登录认证
- HTTPS
- 数据库迁移工具
- 自动备份调度
- 数据导出（除 CSV 报价列表）

---

## 安装与启动

```bash
# 1. 确保 Node.js 20+ 已安装
# 2. 克隆或确保项目目录存在
cd /Users/myairbook/AIProjects/engineering-plastics-crm

# 3. 安装依赖
npm install

# 4. 一键启动
./start-crm.sh
```

或双击桌面 `CRM.app` / `CRM.command`。

---

## 验证清单

每次启动后确认：

```bash
# API 健康检查
curl http://127.0.0.1:3001/api/health
# → 返回 200 OK

# 前端访问
# 浏览器打开 http://127.0.0.1:5173
```

完整回归：

```bash
npm run test       # 50 项安全/国际化/字段保护测试
npm run build      # 前端 + 服务端构建
npm run smoke:api  # 9 模块 API 写操作冒烟测试
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1.0 | — | 初始项目创建，基础 CRUD |
| v1.0.0 | 2026-07-01 | 本地正式版：i18n 完整覆盖、排版优化、字段保护、备份恢复、桌面启动 |

---

## 升级路径

后续版本按以下优先级规划（内部使用）：

1. **v1.1 — 多用户基础**：LAN 访问、会话认证、数据归属
2. **v1.2 — 团队功能**：用户角色、审计日志、通知
3. **v2.0 — 生产就绪**：HTTPS、自动备份、远程访问

详见 `docs/local-release-checklist.md` Stage 2。
