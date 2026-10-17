# CRM 上线部署 — 海外 ECS + crm.jekinpolymer.com（2026-10-17）

**状态：** 进行中（**服务器准备完成、代码已部署、数据库已迁移**）。已完成：①服务器一次性准备（Mac SSH 公钥授权、rsync 3.1.3、Node v22.23.3 系统级 /usr/local、/opt/jekin-crm 目录）②Mac 构建 + rsync 上传（dist/dist-server/scripts/package*，openrsync 实测可用）+ 服务器 `npm ci --omit=dev`（162 包，better-sqlite3 预编译直装）③本地库 wal_checkpoint 后迁移（本地备份留底 `backups/local-pre-migration-*.db`；行数核对一致：users 2 / companies 86 / quotations 116）④生产适配修正：登录 IP 限流经 X-Forwarded-For 最后一跳解析真实客户端地址（反代后 socket 地址恒为 127.0.0.1，原逻辑会全站互锁）；setup 门禁在直连环回基础上同时拒绝携带代转头的请求；契约测试 `tests/local-security.test.mjs` 钉子同步重写、全量测试与重新部署见下文。**上线完成（2026-10-17）：** systemd 守护（active/enabled/58.7M）→ 宝塔反向代理项目（真实 IP 透传头已复核）→ LE 证书（至 2027-01-15）+ 强制 HTTPS（301 实测 ✓）；生产实测：health/登录页/图标 200、控制台零错误、登录限流按真实 IP 分桶（Mac 源 5×401→429、服务器本机源仍 401——127.0.0.1 共享桶 bug 证实修复）；backup/restore 脚本加 sha256sum 双平台兼容并同步服务器。剩余：备份 cron 安装、用户登录验收、临时 QA 巡检（待批准）、最终提交。目标：JEKIN CRM 部署至海外阿里云 ECS（47.82.158.162；Alibaba Cloud Linux 3，**宝塔面板统管 nginx 与证书**，已托管 WordPress 官网），以 https://crm.jekinpolymer.com 对外服务；Node 常驻进程由 systemd 守护；WordPress 站点零改动。
**已确认：** 同机部署；执行方式＝命令手册粘贴（服务器侧操作由用户粘贴执行，Mac 侧 rsync 上传由助手执行）；数据＝迁移本地 crm.db（迁移前 wal_checkpoint 留底）；通道＝rsync 直传（服务器 rsync 未装需补装；git 未装亦不需要）；访问＝公开 HTTPS + 应用内置登录限流（不叠 Nginx 限流、不做 IP 白名单）；服务器无 Node（系统级安装 Node 22.23.3，阿里镜像已验证；本机 Node 22.22.3）；无 certbot——官网证书由宝塔 SSL 功能签发，crm 站点同样走宝塔 UI（站点 → 反向代理 → Let's Encrypt）；SELinux 关闭、firewalld 未运行（安全组把关）；sqlite3 已有（备份脚本可用）；海外机房免备案；crm A 记录未建（列入上线步骤）。
**待确认：** ①服务器资源数值（free/df 输出上轮被截断，非阻塞）②系统安全更新（登录横幅显示 107 项待装、58 项重要——建议 CRM 上线验收后另择窗口 `sudo dnf upgrade-minimal --security`，不混入本次变更）。
**实施步骤：** 0) 服务器一次性准备（Mac 公钥入 authorized_keys + dnf 装 rsync）1) 安装 Node 22（/usr/local，系统级，非 nvm）2) Mac 构建 + rsync 至 /opt/jekin-crm + 服务器 `npm ci --omit=dev` 3) 迁移 crm.db（wal_checkpoint 后上传，行数核对）4) .env（PORT/CRM_DB_PATH/JWT_SECRET 现场生成）5) 手动启动验证 6) systemd 服务（开机自启/崩溃重启）7) DNS A 记录 8) 宝塔：站点 + 反向代理（127.0.0.1:3001）+ LE 证书 + 强制 HTTPS 9) 每日备份 cron（复用 scripts/backup-crm.sh）10) 浏览器端验收（登录/全模块/零控制台错误，详见手册第 10 节）。
**约束：** 不动 WordPress 配置；不动宝塔 nginx 主配置；Node 仅监听 127.0.0.1；生产操作逐步确认；凭证不入仓库；迁移数据库前先备份留底。

---

# CRM 品牌更名为 JEKIN CRM + 蓝环新图标（2026-10-17）

**状态：** 已实施完成（2026-10-17）。**更名：** 应用可见名由「Basepoint / Engineering Plastics CRM / 工程塑料 CRM」统一为「JEKIN CRM」——侧边栏品牌字、登录页大标题、关于弹窗标题、浏览器标签标题、i18n 六处（EN/ZH 的 `loginTitle` + `login.subtitle` + `about.subtitle`）、`public/locales/*/translation.json`（死文件 app.name）、启动脚本横幅（`start-crm.sh`/`start-crm-lan.sh`，顺带修正旧品牌行内宽 42→43 与边框对齐）、活文档四处（`README.md`/`CONTEXT.md`/`DESIGN.md`/`docs/daily-workflow-checklist.md` 标题）+ `src/design/tokens.ts` 注释；历史文档（release-notes/specs）按约定不动。**图标：** 新增 `public/jekin-logo.svg`（源 `blue-spiral-icon.svg`，viewBox 由 `0 0 602 602` 收紧为 `50 46 504 504`，去除约 8% 四周空白使 16–56px 观感不显小；渐变/几何不变），侧边栏（32px）/登录页（56px）换成新标且尺寸类不变；关于弹窗头部为品牌黑底，新增全白变体 `public/jekin-logo-white.svg` 替换原 28px target 线框图标（40px）；favicon 指向新文件。旧 `public/basepoint-logo.svg` 于 2026-10-17 经用户确认删除（删前备份至会话临时目录；全库已无引用，dist 重建后不再包含）。同步契约测试两处：`tests/sidebar-logo.test.mjs`（函数名 `JekinLogo`/路径/alt/viewBox/`#2285ff` 钉子）与 `tests/app-shell.test.mjs`（favicon URL + 新增 `<title>JEKIN CRM</title>` 钉子）。`npx tsc --noEmit`、`npm run test` 557/557（+1 新钉子）、`npm run build` 通过；QA 实机核验与截图归档见汇报。**同日用户复核：** 品牌名要求全大写，可见字符串全量 `Jekin CRM` → `JEKIN CRM`（含两处 SVG `aria-label`、侧边栏 `alt`、`<title>`、启动脚本与活文档；代码标识符 `JekinLogo` 与资产路径 `jekin-logo.svg` 保持不变），测试钉子同步，`tsc`/557 测试/构建重跑、QA 截图重拍全绿。随后用户指定登录页与关于弹窗副标题均改为「一站式客户关系管理平台」（EN: `One-stop customer relationship management platform`），标题+副标题重复全部解除。
**同日收尾（用户确认后实施）：** ①公司中英文名统一为「杰京新材料（江苏）有限公司 / JEKIN HPM (Jiangsu) Co., Ltd」：`server/pdf-quotation.ts` 的 `COMPANY_EN` 由 `JEKIN Polymer (Jiangsu) Co., Ltd` 改为 `JEKIN HPM (Jiangsu) Co., Ltd`（中文名/地址/联系方式不变）；`server/materials-tooling/pdf.ts` 页眉与 PDF Author 元数据两处去除尾部句点，逐字对齐规范名。②`index.html` 的 `lang="en"` 硬编码改为 `lang="zh-CN"`，`src/lib/i18n.tsx` 新增 `document.documentElement.lang` 随 UI 语言同步（zh → `zh-CN`，否则 `en`，`languageChanged` 时刷新）。③新增 `public/apple-touch-icon.png`（180×180、白底，用浏览器画布从 `jekin-logo.svg` 栅格化，避免 iOS 将透明区域渲染为黑色），`index.html` 引入 `<link rel="apple-touch-icon">`。④按用户要求，首开默认语言由 `en` 改为 `zh`（`src/lib/i18n.tsx` 无 `crm-language` 存储时取 `zh`；`TopBar` 的 `zhInterface` 回退与 `lang` 同步回退值一并对齐，`app-shell` 钉子同步）。契约测试：`tests/app-shell.test.mjs` +3 钉子（lang/link、PNG 尺寸、同步代码）、新增 `tests/company-name-consistency.test.mjs`（两 PDF 公司名钉子）、`tests/quotation-pdf-privacy.test.mjs` 增真实渲染断言（pdftotext 提取 `JEKIN HPM (Jiangsu) Co., Ltd` 与中文全名，反向断言 `JEKIN Polymer` 不出现）。`tsc`/全量测试/构建与 QA 复验见汇报。
**范围：** 品牌字符串与图标资产（skin 层）；无 IA、路由、API、数据改动。
**下一步：** 无（副标题去重、旧 logo 删除、公司名统一、lang 与 apple-touch-icon 均已完成）。

---

# CRM 工装页优化 — 工具条连体 + 移动行 + 保管人姓名（2026-10-17）

**状态：** 已实施完成（2026-10-17）。按用户「同库存一个问题」反馈，对照库存 D 批收法处理 `/materials-tooling` 工装 tab：①工具条去 `mb-4` 悬浮，与列表表面连体（表面 `border-t-0 rounded-t-none`，桌面实测 toolbarBottom 233 == surfaceTop 233）；工具条内「条记录: N」撤下，改由页头摘要行实时显示 `12 件工装`（状态筛选时 `1 / 12 件工装`；经 `onStatsChange` 回调从 ToolingTab 上报，页面侧 `useCallback` 防止重渲染循环）；②移动端列表由独立卡片（~270px/件）改为单一 `data-surface` + `divide-y` 分隔行（~130px/件）——编号+状态徽章 / 名称 13px·500 / 分类·规格 / 位置·保管人·采购价 / 操作行；工具栏移动端压成一行（筛选 `flex-1` + 新增按钮）；③保管人列由原始 UUID 改为姓名：服务端 `list()`/`selectAsset` 联 users 表返回 `custodian_name`（`custodian_user_id` 保留，API 向后兼容），桌面/移动均显示姓名，无值显示 `—`；④新增按钮文案 `＋工装` → `新增工装`（新 i18n 键 `addTooling`；`toolingCount` 含 EN 单复数）。**B（同页收口）：** 物料/单据/月度台账三 tab 工具条同样去悬浮（`mb-4 md:mb-0`：桌面与表格连体、移动端保留原卡片间距），桌面表表面 `border-t-0 rounded-t-none`（实测三 tab gap 0 / radiusTop 0px / borderTop 0px）。`npm run test` 556/556（+4 新契约钉子；同步 3 个测试文件 4 处旧 class 钉子）、`npx tsc --noEmit`、`npm run build` 通过；QA 实机核验：摘要 `12 件工装` → 筛选借出 `1 / 12 件工装` → 复位、保管人显示 `Design QA`、工具条与表格连体、零控制台错误；截图 tooling-after / filtered / 390 / ledger-after @1512 归档（克隆渲染小号文本切片为 html2canvas 伪影，已记入 runbook）。QA 实例播种 12 条匿名工装（TLG-0001~12，状态/库位/价格多样），仅存在于 QA 库。
**范围：** `/materials-tooling` 全部 tab 的 skin/UX 层 + 工装列表 API 只读联表扩展（`custodian_name`）。
**下一步：** 无。

---

# CRM 库存页优化 — A1–A8 + B9–B15 + C16 + D 批（视觉压缩）（2026-10-17）

**状态：** 已实施完成（2026-10-17）——**A 批**：①流水与库存搜索解耦（新增当前形状的全量范围拉取）；②流水表 `w-full`；③流水视图补加载骨架与错误态（Refresh 重试）；④流水客户端分页（10 条/页，切形状重置）；⑤空态区分「无库存 / 搜索无结果 + Clear search / Add stock specification」；⑥参考规格补全长宽（`3150 × 1250 × 20.000 mm`）；⑦搜索防抖 250ms（3 次击键从 9 请求降到 3）；⑧指标在搜索时显示 filtered/total（`1 / 2`）。**B 批**：⑨视图切换改用共享 `segmented-control`（Tasks 同款，含 id/aria-controls）；⑩行内按钮标签缩短（`Record measurement` / `记录实测`）；⑪`Display Weight` → `Display weight`；⑫流水编号 `whitespace-nowrap` 防折行；⑬双 tablist 补 `role="tabpanel"` 接线（共享 `#inventory-v2-panel`，`aria-labelledby` 随视图动态切换）。`npm run test` 557/557、`npm run build`、`npx tsc --noEmit` 通过；QA 实机核验：搜索 PEEK 下流水 12 条不受影响、分页 `1–10 / 12` 翻页、Rods 仅显示棒料流水、强制失败出错误态且 Refresh 可恢复、tabpanel 接线与 segmented 样式生效；截图 6 张（stock / stock-search / stock-filtered / ledger / ledger-error / create-panel @1512 + stock @390）归档 QA 截图目录。
**收尾批（同日）：** B12 导出随当前形状与搜索联动——`/v2/export.xlsx` 增加可选 `shape`/`q`（无参数＝原双表全量，向后兼容）；`exportInventoryWorkbook` 增加 sheets 选择参数，工作簿只含对应形状工作表。B15 页头摘要行由静态 tagline 改实时记录数口径——库存视图 `N Master SKUs`（搜索时 `filtered / total`）、流水视图 `N Movements`；移除 `v2.isolatedSummary` 死键。C16 删除 legacy 不可达代码约 1.66k 行（`LegacyInventoryPage`/`DashboardTab`/`ProductsTab`/`LedgerTab`/`ImportTab`/`StockForm`/`TransactionForm` 等），`InventoryPage.tsx` 2464 → 808 行；同步 11 个测试文件钉子（删 5 个 legacy 专属测试）。`npm run test` 552/552、`npm run build`、`npx tsc --noEmit` 通过；QA 实机核验：导出请求 `?shape=sheet`/`&q=…`、服务端 4 种导出范围、摘要 `2` → `1 / 2`（PVDF）→ `2`、流水 `12 Movements`、零控制台错误；stock/ledger @1512 重拍归档。
**D 批（用户评审后同日）：** 按用户反馈压缩库存页顶部、重排列表行——①删除三格指标条（108px），数字并入页头摘要行（`2 主体 SKU · 13 pc · 130.7 kg`；搜索时逐项 `filtered / total`，如 `1 / 2 主体 SKU · 3 / 13 pc · 26.7 / 130.7 kg`）；②页头右侧控件由两行并成一行（视图 segmented + 新增库存规格 + 导出 Excel），页头回归共享 `.page-header`/`.page-actions px-3` 结构（与 Companies 一致）；③板材/棒材由下划线 tab 带改为同款 `segmented-control` 并入工具栏（板材/棒材 + 搜索 + 刷新同行，库存与流水视图均显示；工具栏与下方表面连体）；④列表由独立卡片改为单一 `data-surface` + 分隔线行，桌面三栏 `[SKU + 材质·厚度·N 个规格 | 显示重量 | 数量]` 右对齐等宽数字，行标题 13px/500，行高 ~54px；移动端重量并入副标题；⑤骨架屏由指标条+分块改为 8 行列表形态；新增 i18n 键 `specCount`（EN/ZH 含单复数）。顶部四段（页头两行/形态 tab 带/指标条/工具栏）压缩为两段，列表内容起点 212px。`npm run test` 552/552、`npx tsc --noEmit`、`npm run build` 通过；QA 实机核验：摘要→搜索 PVDF `1 / 2 主体 SKU · 3 / 13 pc · 26.7 / 130.7 kg`→清空复原、行展开 2 items 正常、流水视图保留板材/棒材切换且表格与工具栏连体（borderTop 0px/radiusTop 0px）、零控制台错误；重拍 stock / stock-expanded / stock-filtered / ledger @1512 + stock @390 归档（克隆渲染的 500 字重文本顶部 1px 截断为 html2canvas 伪影，已记入截图 runbook；真实 DOM 实测无裁切）。
**范围：** `/inventory` V2 工作区（skin/UX 层）+ `/v2/export.xlsx` 只读参数扩展；legacy 标签页（不可达）已删除。
**下一步：** 无（A/B/收尾/D 批全部完成）。

---

# CRM 客户页与详情页重构 — 审查方案（2026-10-16）

**状态：** 已实施完成（2026-10-16）；2026-10-17 两批收尾（1–9）全部落地——摘要口径、日期 helper 收敛、CompanyFilterChip 抽取、R11 空态统一、R14 名称/最近活动列排序、QA 截图管线 runbook（`docs/qa-browser-capture.md`）、边界与 a11y 修正、活动卡「View all」出口（Activities 只读 `?company=` 联动）。`npm run test` 557/557、`npm run build`、`npx tsc --noEmit` 通过；QA 截图（EN+ZH，390/1512，共 19 张）与实机核验记录见 `docs/companies-redesign-review-2026-10-16.md` 第六、七节。
**范围：** `/companies` 列表 + `/companies/:id` 详情 + `/companies/contacts` 目录，以及 `/quotations`、`/tasks` 的只读 `?company=` 联动；参照方向：Venture kit 的 contacts（本轮 Figma 标签页因窗口不可见无法调阅画板，见方案卷首说明）。
**下一步：** 无（2026-10-17 两批收尾 1–9 全部完成，见 review 文档第七节；后续可另开题：报价行展开、空态插画等）。

---

# CRM Venture Design Pilot (2026-10-16)

**Goal:** Transplant the visual language of the "Venture — CRM Dashboard UI kit" (Figma community) onto the CRM as a design-only pilot: neutral black-and-white shell, black primary accent, pastel status fills, lighter borders, larger radii. No information architecture, density, copy, routing, API or data changes.

**Decisions (user-confirmed):**
- Primary accent switches from blue `#2563EB` to pure black; blue leaves the primary-command layer.
- Scope: pilot pages first — Dashboard + Companies — for review before any site-wide page sweep.

**Batches (max three primary files each, pause between batches; contract-test syncs ship with their subject):**
1. [x] Token layer — `PLANS.md`, `tailwind.config.js`, `src/index.css` plus contract-test sync `tests/typography-system.test.mjs` (synced together so the suite stays green).
2. [x] App shell — `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`, `public/basepoint-logo.svg` plus contract-test syncs `tests/sidebar-logo.test.mjs` and `tests/typography-system.test.mjs`.
3. [x] Pilot pages + shell doc — `src/pages/Dashboard.tsx`, `src/pages/Companies.tsx`, `DESIGN.md` plus contract-test sync `tests/i18n-dashboard.test.mjs`.
4. [x] Verification — full suite + build + screenshot capture from an isolated anonymous instance; evidence limits reported below.
5. [x] Typography audit follow-up — audit at `docs/typography-audit-2026-10-16.md`; P1 `uppercase tracking-wide` cleanup in `src/pages/OrderDetail.tsx` + `src/pages/InventoryPage.tsx`; P2 detail-width, row-primary weight, card-title levels, compact-table and empty-state rules added to `DESIGN.md`. Batch C rendered review completed 2026-10-16 — 9 captures (1512/390, zh UI, dark mode) archived in `$TMP/crm-design-qa/final/`; findings C1–C5 fixed in Batch 6 (2026-10-16): shipment header alignment, invoice-row nowrap + break point, detail h1 scale, pipeline heading, zh placeholder punctuation. Tests 557/557, build green (audit §七).

**Token mapping (Venture → CRM tokens):**
- Primary/command `#000000`, hover `#262626`, soft fill `#F2F2F2`; new `--color-brand-foreground` for button text.
- Canvas `#F5F5F5`; surface `#FFFFFF`; subtle `#FAFAFA`; hover `#F1F1F1`.
- Borders `#ECECEC` / strong `#D9D9D9`.
- Ink neutral (no blue cast): `#141414` / `#6F6F6F` / `#A3A3A3`.
- Status softs: success `#E7EFE8`, warning `#F5EFE1`, danger `#F7E8E8`; stage softs quotation `#E8F0F8`, order `#F0E8F0`, shipment `#E7F0F0`, payment `#E7EFE8`.
- Radii: control 10px, surface/card 12px, panel 14px (tailwind `rounded` 6, `md` 10, `lg` 12, `card` 12).

**Steps:**
1. [x] Token layer values in `tailwind.config.js` + `src/index.css` (`:root`, `.dark` inverse brand, `--color-brand-foreground`, radius vars) + contract-test update.
2. [x] App shell: white chrome, light-gray active pill, sentence-case group labels, logo mark follows ink, ⌘K hint sits inside the search field (shell/logo contract tests updated with the change).
3. [x] Pilot pages: Dashboard (KPI cells swap colored left edges for pastel icon chips, aging bars escalate neutral-to-red) and Companies (hairline underlined record links) — black solid CTAs, outlined row buttons, and pastel pills already flow from the token layer.
4. [x] Verify with full suite + build + screenshot capture: `npm run test` **555/555 pass**; captures rendered from the batch-3 compiled build (`dist-server`) through an isolated instance (`CRM_DB_PATH` → temp SQLite, `server/seed.ts` + anonymous demo records, port 3105) — never touched the user's dev database. Dashboard + Companies captured at 1512px ×2.

**Verification (batch 4, 2026-10-16):**
- Full suite 555/555; build exit 0 (batch 3, unchanged since — batch 4 edits no code).
- Captures archived (temp, not in repo): `/private/var/folders/w4/fcn94_1j65s4w0_996bb3r6h0000gn/T/crm-design-qa/final/`.
- Evidence limits: HTML capture flattens `color-mix()` status tints to near-identical flat hex; dark mode not visually reviewed; captures use anonymous fixture data; other pages still inherit token values only.
- Review instance left running at `http://127.0.0.1:3105` (name "Design QA" / PIN 271828, anonymous temp DB). Stop: `kill $(lsof -ti :3105)` + `rm -rf` the temp dir above.

**Limits:** No new dependencies; no business logic, schema, API, copy or test-behavior changes. Other pages inherit token values only and receive no page-level polish until the pilot is approved. The tree carries large uncommitted user work — this pilot only edits the files listed above, makes no commit and no branch operations.

---

# CRM Continuous Workflow Review (2026-10-16)

**Authorization:** The user requested continuous checking and repair until the review is finished, superseding the requirement to stop for “continue” between batches. Preserve small, focused changes and all unrelated work. Production deployment, migrations, credentials and new business rules still need explicit approval.

**Scope:** Review the existing customer/contact, quotation/editor/copy/conversion, order/product-line, shipment and payment workflows. Reproduce concrete failures with anonymous fixtures before fixing them. Run the full suite and build after related groups; finish with isolated compiled-runtime/API and browser checks for changed flows. Report evidence boundaries and unresolved business decisions rather than claiming the entire application is bug-free.

**Checklist:**
- [x] Quotation metadata edits preserve saved commercial amounts; new copies and price edits follow the user's confirmed no-discount rule. Conversion preserves agreed/zero amounts without activating legacy discount metadata.
- [x] Customer/contact and order references reject inconsistent or deleted parents before writes. Primary-contact moves and displaced-primary audit writes are transactional; sample requests enforce matching active company/quotation/contact references.
- [x] Shipment writes keep valid order references and unchanged records remain editable.
- [x] Payment writes and UI actions preserve currency, amounts, permissions and duplicate-submission safeguards. Immediate action/input guards, correct currency labels and decimal-balance residue fixes pass.
- [x] Core list/detail/error flows and existing inventory/materials-tooling checks pass without unrelated redesign.
- [x] Full tests, frontend/server checks, build, isolated API smoke and changed-flow browser checks pass; record remaining limits.

**Confirmed business rule:** The user clarified that quotations have no discounts; the old discount mechanism was invented by earlier Codex work. Supersede prior discount-focused plans: new quotation/copy and price edits use quantity times unit price, with zero discount metadata. Preserve saved historical amounts on nonpricing edits; do not bulk-rewrite business data. Existing storage fields may remain for compatibility, but must not define the active quotation pricing rules.

**Completed changes:** Nonpricing quotation edits preserve historical subtotal/tax/total; new copies and quantity/price edits use gross prices with no discount, and conversions retain agreed zero totals. Order summary displays preserve zero. Primary-contact company moves clear the correct destination primary and audit the displaced record atomically; invalid references and audit failures leave records unchanged. Shipment reassignment and sample requests validate active matching references. Quotation edits reject empty/malformed product lists. Reopened tasks clear their completion timestamp. Payment actions share an immediate submission lock; pending payment inputs are disabled, the currency label follows the invoice, and floating-point residue cannot reject exact final installments or create phantom balances. README authentication instructions now match account/PIN login.

**Verification:** Final full suite 555/555; frontend typecheck and production build/server typecheck passed. All 28 HTTP business regressions passed against a copied compiled runtime and independent anonymous databases. The original API write smoke passed across companies, contacts, tasks, inquiries, quotations, orders, payments, shipments and inventory. The compiled materials/tooling in-memory API smoke passed 18/18, including permissions, configured historical approval compatibility, stock execution, duplicate-execution rejection, tooling issue and reversal; current no-approval fallback remains covered by the full suite. Diff whitespace checks passed.

**Browser evidence:** In the anonymous compiled-runtime fixture, an old quotation retained 201.23 total and 22.23 tax after a note-only edit; changing quantity to three saved subtotal 300, VAT 39, total 347 and zero discount metadata. A fresh copy of a separate legacy fixture used subtotal 200, VAT 26 and total 234 without changing its source. A zero-valued order displayed 0.00. The CNY payment dialog showed the correct symbol, locked inputs while waiting and ignored repeated submission; two payments of 0.10 and 0.20 settled exactly 0.30 with two records and zero remaining balance. Twelve main routes loaded without API failures, runtime exceptions or page error alerts: dashboard, companies, company detail, contacts, quotations, orders, shipments, payments, activities, tasks, inventory and materials/tooling. Closed only the QA tab and stopped the temporary QA server; API fixtures cleaned up their own processes.

**Evidence limits:** This completes the defined local core-workflow review and all confirmed defects in that review. Existing business data was not inspected/repaired or bulk-repriced. No shared LAN-instance acceptance, Alibaba Cloud deployment, migration, dependency addition, credential change or production write was performed. Earlier discount-focused entries below are historical and superseded by the confirmed no-discount rule above.

**Boundaries:** No business database writes/repair, deployment, shared-service restart, new dependency, schema migration or permission-policy redesign.

---

# CRM Quotation Line Discount Recalculation (2026-10-16)

**Goal:** Keep the existing product-line percentage discount when an editor changes that line's quantity or unit price.

**Scope:** Recalculate the edited line as quantity times unit price times its existing discount factor; treat missing/null percentage as zero. Preserve other lines, descriptive edits, zero/fractional inputs and source objects. Do not change header-discount or VAT calculation policy, rounding, UI controls or backend routes.

**Batch (maximum three files):** `PLANS.md`, `src/components/quotations/QuotationEditPanel.tsx`, `tests/quotation-line-pricing.test.mjs`.

**Steps:**
1. [x] Inspect line-edit callbacks, current calculations, persistence and prior tests; preserve source snapshots and SHA-256 checksums outside the repository.
2. [x] Reproduce discount loss with the actual line-edit callback, cover defaults/zero/fractional values and unrelated edits, then apply the smallest correction.
3. [x] Run focused/full tests, typecheck, build, isolated API write smoke and anonymous browser edit/reload verification; pause at the batch boundary.

**Verification:** Three actual-callback tests first reproduced discounted quantity edits returning 300 instead of 270 and full discounts returning a nonzero total. After applying the existing line discount factor, all 11 focused and 536 full-suite tests passed. Tests cover quantity/price changes, zero inputs, fractional quantities, missing/null/zero/full discounts, descriptive edits, unrelated rows and immutable source data. Frontend typecheck, production build, isolated API write smoke and diff whitespace checks passed. An authenticated browser using an anonymous quotation with no header discount retained its 10 percent line discount after changing quantity from 2 to 3 (270), then unit price from 100 to 125 (337.50); saving only an internal note retained 337.50. Each result was reloaded and checked against stored API data. Closed only the QA tab and stopped the temporary QA server. No business data, shared-service acceptance or deployment was involved.

**Limits:** No business data access or repair, header pricing/tax policy changes, new discount inputs, schema/dependency changes, shared-service restart or deployment. Header-discount behavior in the editor remains a separate review item.

---

# CRM Quotation Copy Header Discounts (2026-10-16)

**Goal:** Preserve quotation header discounts when copying an existing quotation through the page action.

**Scope:** Send the source's existing `discount_percent` and `discount_amount` with the duplicate payload, defaulting absent/null values to zero. Retain product-line discounts, submitted amounts, source data, existing duplicate guard and failure/retry behavior.

**Batch (maximum three files):** `PLANS.md`, `src/pages/QuotationDetail.tsx`, `tests/quotation-duplicate.test.mjs`.

**Steps:**
1. [x] Inspect the duplicate payload, existing handler tests and create-route support; preserve source snapshots and SHA-256 checksums outside the repository.
2. [x] Reproduce missing discounts with the actual handler and add defaults coverage, then extend only the duplicate payload.
3. [x] Run focused/full tests, typecheck, build, isolated API write smoke and anonymous browser copy/reload checks; pause at the batch boundary.

**Verification:** The extended actual-handler regression and new optional-default test first failed because header discounts were absent. All eight focused copy/conversion tests and the full 533-test suite then passed. Frontend typecheck, production build, isolated API write smoke and diff whitespace checks passed. In the authenticated browser against an anonymous isolated fixture, duplicating and reloading retained the 5 percent header discount, discount amount 9, 10 percent line discount, subtotal 180, tax 22.23, shipping 8 and total 201.23. Exactly one copy was added and the source quotation remained unchanged. Closed only the QA tab and stopped the temporary QA server. No business data, shared-service acceptance or deployment was involved.

**Limits:** No business data access, source-record changes, pricing/date policy changes, schema/dependency changes, shared-service restart or deployment.

---

# CRM Quotation Creation Discount Persistence (2026-10-16)

**Goal:** Preserve submitted quotation header and line discount fields so subsequent order conversion receives the stored commercial values.

**Scope:** Include existing header `discount_percent`/`discount_amount` and line `discount_percent` columns in quotation creation, matching their existing edit and order-create support. Keep omitted/null values at zero. Retain submitted subtotal, tax, shipping, line totals and total without recalculation or a change to pricing policy.

**Batch (maximum three files):** `PLANS.md`, `server/routes/quotations.ts`, `tests/customer-development-api.test.mjs`.

**Steps:**
1. [x] Inspect create/edit/convert payloads, schema and existing tests; preserve current source snapshots and SHA-256 checksums outside the repository.
2. [x] Reproduce lost discounts through the real HTTP API, cover quotation-to-order values and defaults, then extend only the create INSERTs.
3. [x] Run focused/full tests, typechecks, build, compiled-runtime regressions, isolated API write smoke and diff checks; pause at the batch boundary.

**Verification:** Four new real-HTTP regressions first reproduced lost header discounts, lost product-line discount percentages, and zeroed discounts in the resulting order; omitted/null/zero defaults already passed. The new conversion test also explicitly checks the expected derived order link while preserving the source quotation's stored fields. After extending only the creation INSERTs, the full 532-test suite passed. Tests confirm header discounts round-trip in creation/reload/audit, line discounts and submitted totals persist, conversion carries both levels of discount to an order, and optional defaults stay zero. Frontend typecheck, production build (including server typecheck), all 18 API tests against a copied compiled runtime, isolated API write smoke and diff whitespace checks passed. Temporary API processes exited through test cleanup. No business data inspection/repair, shared-service acceptance or deployment was performed.

**Limits:** No business data access or repair, UI/pricing-policy change, schema/dependency change, shared-service restart or deployment.

---

# CRM Deleted-order Line Update Guard (2026-10-16)

**Goal:** Reject individual product-line updates after their parent order has been deleted.

**Scope:** Require the line's parent order to exist and remain active before any per-line update or audit write. Preserve the existing shared collaboration rules for authenticated colleagues, supported line fields and missing-record response. Do not introduce owner-only editing or alter deletion policy.

**Batch (maximum three files):** `PLANS.md`, `server/routes/orders.ts`, `tests/customer-development-api.test.mjs`.

**Steps:**
1. [x] Inspect order writes, collaboration rules, authorization helpers and fixtures; preserve source snapshots and SHA-256 checksums outside the repository.
2. [x] Reproduce updates to deleted orders through the real HTTP API, verify no-write rejection and active-order collaboration, then add the smallest route guard.
3. [x] Run focused/full tests, typechecks, build, isolated API write smoke and diff checks; pause at the batch boundary.

**Verification:** Four new real-HTTP tests first showed two failures: deleted-parent and missing-parent product lines both accepted writes with HTTP 200. After the join guard, 14 focused tests and the full 528-test suite passed. Administrator/member attempts to edit deleted-order quantities or units returned HTTP 404 with unchanged order/line/audit snapshots. Active-order edits by a different authenticated colleague succeeded and recorded the actual actor and before/after quantities; missing lines and orphaned lines were rejected. Frontend typecheck, production build (including server typecheck), the same 14 HTTP tests against a copied compiled runtime, isolated API write smoke and diff whitespace checks passed. All API test processes exited through fixture cleanup. No business data inspection/repair, shared-service acceptance or deployment was performed.

**Limits:** No business data access, historical data repair, permission-policy changes, schema/dependency changes, shared-service restart or deployment.

---

# CRM Shipped Quantity Partial-save Recovery (2026-10-16)

**Goal:** Keep shipped-quantity edits aligned with independently saved order lines after partial HTTP or network failures.

**Scope:** Wait for all submitted line updates, refresh persisted page data, remove only successfully saved unchanged edits, and retain failures or newer edits for retry. Add immediate in-flight protection and expose the save button's busy state. Preserve the existing per-line API, quantity rules, units and fulfillment policy.

**Batch (maximum three files):** `PLANS.md`, `src/pages/OrderDetail.tsx`, `tests/user-reported-workflow-fixes.test.mjs`.

**Steps:**
1. [x] Inspect the page, per-line API and prior tests; preserve current files and SHA-256 checksums outside the repository.
2. [x] Replace the shipped-quantity source-pattern check with actual-handler regressions, reproduce partial-save/retry and pending-edit loss, then make the smallest correction.
3. [x] Run focused/full tests, typecheck, build, isolated API write smoke and browser fault injection; pause at the batch boundary.

**Verification:** Six actual-handler tests first demonstrated four failures: no refresh after partial success, early unlock after a network rejection, dropped edits made during a pending request, and repeated immediate batch submissions. All six then passed; 68 focused and 524 full-suite tests passed. Frontend typecheck, production build, the existing API write smoke script against a copied runtime/anonymous database, and diff whitespace checks passed. In an authenticated anonymous browser fixture, a delayed first line and HTTP 503 on the second kept the button busy/disabled with exactly two PUTs. After settling, persisted quantities were [2, 0]; retry submitted only the second line. Changing that input from 3 to 4 during retry preserved the newer value while the server saved 3, and the final save persisted [2, 4]. Closed only the QA tab and stopped the temporary QA server. No business data, shared-service acceptance or deployment was involved.

**Limits:** No business data access, schema/dependency changes, API transaction or idempotency changes, shared-service restart or deployment.

---

# CRM Order Invoice Submission Guard (2026-10-16)

**Goal:** Prevent immediate repeated invoice actions from creating duplicate receivables before React renders the busy state.

**Scope:** Keep the order-page invoice payload, API permissions and invoice policy. Add an immediate in-flight guard alongside the existing busy state, retain response validation and retry behavior, and expose the pending state on the button. This is a client action guard; server idempotency and intentional multiple invoices per order are outside this batch.

**Batch (maximum three files):** `PLANS.md`, `src/pages/OrderDetail.tsx`, `tests/order-invoice-create.test.mjs`.

**Steps:**
1. [x] Inspect the page, payment-create route, related tests and current worktree; save source snapshots and SHA-256 checksums.
2. [x] Reproduce immediate repeated submissions with the actual handler, cover successful creation and retryable failures, then make the smallest correction.
3. [x] Run focused/full tests, typecheck, build, isolated API write smoke and browser verification; pause at the batch boundary.

**Verification:** The actual-handler regression first demonstrated two invoice POSTs before a rerender; all five new tests then passed, including success, rejection/retry, invalid/network responses and existing state blockers. The full suite initially had 36 environment failures because the sandbox blocked temporary communication pipes; rerunning with permission passed 519/519. Frontend typecheck, production build, the existing API write smoke script against a copied runtime and independent anonymous database, and diff whitespace checks passed. In the authenticated browser fixture, a delayed invoice request disabled the button and exposed its busy state; a second click did not submit. An injected HTTP 503 restored the button with zero invoices. Retrying succeeded, navigated to payments and produced exactly one CNY invoice for 265.64. Closed only the QA tab and stopped the temporary QA server. Shared-service acceptance and deployment were not performed.

**Limits:** No business database access, dependency/schema changes, invoice/amount policy changes, shared-service restart or deployment.

---

# CRM Order Copy Completeness and Submission Guard (2026-10-16)

**Goal:** Make a copied order start as a fresh order with the source's commercial terms and product lines.

**Scope:** Extend the order duplicate request with the existing API's supported pricing, tax, shipping and payment fields plus ordered product-line values. Do not carry over the old customer PO, status, dates, or fulfillment quantities. Prevent repeated in-flight submissions and preserve API errors for retry feedback. Keep the existing create route and numbering behavior.

**Batch (maximum three files):** `PLANS.md`, `src/pages/OrderDetail.tsx`, `tests/order-duplicate.test.mjs`.

**Steps:**
1. [x] Verify the detail-page payload, create-route accepted fields and available tests; save source snapshots and checksums.
2. [x] Add real-handler regressions for missing pricing/lines, fulfillment reset, repeated clicks and useful failures; implement the smallest correction.
3. [x] Run focused/full tests, typecheck, build, isolated API smoke and anonymous browser verification; pause at the batch boundary.

**Verification:** Three real-handler regressions first reproduced omitted discount/tax terms, repeated immediate submissions, and generic failure feedback; all passed after the correction. The full suite passed 514/514; frontend typecheck, production build, isolated API write smoke, and `git diff --check` passed. In the logged-in browser against an anonymous isolated fixture, the duplicate action stayed busy and disabled while the request was pending, with exactly one POST. The resulting order retained both product lines and commercial pricing/tax/shipping values, started as a draft with a fresh order date, and had no customer PO or shipped/delivered quantities. Closed the browser task and stopped only the temporary QA server. No business data, shared-service acceptance, or deployment was involved.

**Limits:** No change to order numbering, ownership, approval, PO assignment or shipment/payment records; no business data change, shared-service restart or deployment.

---

# CRM Quotation Status and Activity Failure Feedback (2026-10-16)

**Goal:** Keep the quotation page aligned with a saved status when its separate activity-log request fails.

**Scope:** Persist the selected status first, close the menu and reload page data after that write succeeds, then log the activity independently. Report a status-save failure only when the quotation update fails; report activity-log failure with its existing translation. Preserve the route, available statuses, and audit behavior.

**Batch (maximum three files):** `PLANS.md`, `src/pages/QuotationDetail.tsx`, `tests/quotation-status-change.test.mjs`.

**Steps:**
1. [x] Inspect the page handler, API methods, existing error translations and test conventions; save original source snapshots and checksums.
2. [x] Add real-handler regressions for saved-status/activity failure, update failure, normal success and duplicate calls; implement the smallest correction.
3. [x] Run focused/full tests, typecheck, build, isolated API smoke and anonymous browser fault-injection verification; pause at the batch boundary.

**Verification:** Four real-handler regressions first reproduced the stale menu and misleading status error after an activity failure, then all passed. The full test suite passed 511/511; frontend typecheck, production build, isolated API write smoke and `git diff --check` passed. In the logged-in browser against an anonymous fixture, an injected activity POST 503 left the saved quotation at `Sent`, closed the status menu, refreshed the page and showed only “Failed to log activity”. Closed the browser task and stopped only the temporary QA server. No shared-service acceptance or deployment was performed.

**Limits:** No API transaction, schema/data change, status policy change, shared-service restart, or deployment.

---

# CRM Authenticated Quotation PDF Download (2026-10-16)

**Goal:** Let signed-in CRM users download quotation PDFs through the protected API.

**Scope:** Replace the quotation detail page's unauthenticated new-tab link with an authenticated in-page fetch, save the PDF blob under the quotation number, prevent duplicate in-flight downloads, surface API errors, and release the temporary object URL. Preserve the server PDF contents and route permissions.

**Batch (maximum three files):** `PLANS.md`, `src/pages/QuotationDetail.tsx`, `tests/quotation-pdf-download.test.mjs`.

**Steps:**
1. [x] Verify the page uses a native link while all quotation API routes require Bearer auth; save original source snapshots and checksums.
2. [x] Add real-handler regressions showing the missing authenticated download path; implement the page action.
3. [x] Run focused/full tests, typecheck, build, isolated API smoke and anonymous browser verification; pause at the batch boundary.

**Verification:** The four real-handler tests first failed because the page had no authenticated PDF-download action, then passed after implementation. The full suite passed 507/507; frontend typecheck, production build, isolated API write smoke, and `git diff --check` passed. In the logged-in browser against an isolated anonymous fixture, the PDF action downloaded `QA-PDF-2026-01.pdf` successfully with no browser download failure. Closed the browser task and stopped only the temporary QA server. No company data, shared-service acceptance, or deployment was involved.

**Limits:** No business database changes, API or PDF-template changes, shared-service restart, or deployment.

---

# CRM Quotation Conversion Partial-failure Recovery (2026-10-16)

**Goal:** Avoid reporting confirmed order creation as a failure when the later activity or quotation-status request fails, and prevent another order request after confirmation.

**Scope:** The page currently performs order creation, activity creation and quotation status update under one catch. Add immediate in-flight protection, remember the confirmed order ID keyed to its source quotation, and update the existing order link immediately. Attempt both follow-up writes independently; show a translated creation-confirmed warning for any failed follow-up, and open the created order. Keep genuine creation failures retryable and preserve the existing payload, calculations and policies.

**Batch (maximum three files):** `PLANS.md`, `src/pages/QuotationDetail.tsx`, `tests/quotation-conversion.test.mjs`.

**Steps:**
1. [x] Inspect the page action, API behavior, current links, translations and tests; save source snapshots and SHA-256 checksums outside the project.
2. [x] Add failing real-handler regressions for partial failure, immediate repeat calls, confirmed-order reuse and genuine creation failure; implement the smallest UI correction.
3. [x] Run focused/full tests, typecheck, build, isolated API smoke and anonymous browser fault-injection verification; pause at the batch boundary.

**Verification:** New real-handler tests first failed on missing confirmed-order state, immediate duplicate submissions and partial-failure handling; all four then passed (seven focused tests including quotation copying). Full tests passed 503/503; frontend typecheck, build, isolated API smoke and `git diff --check` passed. Anonymous browser fault injection independently failed the activity POST and quotation-status PUT. Each scenario created exactly one real temporary order and navigated to it with a creation-confirmed warning; activity failure did not block status acceptance, while injected status failure left the quotation draft as expected. Reloading the latter source quotation showed the existing-order link and disabled creation button. Closed the test page and stopped only the isolated QA server. No business-data changes, shared-service acceptance or deployment were performed.

**Limits:** No business database reads/writes, schema/dependency change, shared-service restart or deployment. This does not make the three endpoints transactional or add server idempotency; a failed follow-up may still need later correction. No change to multiple orders per quotation, approval, ownership or amount rules.

---

# CRM Quotation Copy Completeness and Submission Guard (2026-10-16)

**Goal:** Keep copied quotations' tax amounts and internal notes consistent with the source, prevent repeated in-flight copy requests, and show useful failure feedback.

**Scope:** The detail-page duplicate payload currently omits `tax_amount` and `internal_notes`, although the API now persists both. Add these fields, guard the action with an immediate in-flight ref and visible disabled/busy state, and surface backend errors with a translated fallback. Preserve product lines, existing terms/dates, server-calculated approval behavior and source records. This is a client submission guard, not server idempotency or a change to order splitting.

**Batch (maximum three files):** `PLANS.md`, `src/pages/QuotationDetail.tsx`, `tests/quotation-duplicate.test.mjs`.

**Steps:**
1. [x] Inspect duplication, create API, action-menu controls and existing tests; save source snapshots and SHA-256 checksums outside the project.
2. [x] Add failing tests of the actual duplicate handler for copied fields, immediate repeat clicks and failure/retry, then implement the smallest UI change.
3. [x] Run focused/full tests, typecheck, build, isolated API smoke and anonymous browser copy/reload validation; pause at the batch boundary.

**Verification:** Three real-handler tests first failed on missing tax, repeated immediate submission and generic failure feedback, then passed. Full tests passed 499/499; frontend typecheck, production build, isolated API smoke and `git diff --check` passed. Browser QA against an anonymous compiled-runtime fixture delayed the copy request, confirmed the reopened action menu's copy button was disabled/busy, then completed the request and verified source/copy terms, dates, tax, notes and amounts matched, one product line remained, exactly one new quotation was created, and the original total stayed unchanged. Closed the test page and stopped only the isolated QA server. No business-data changes, shared-service acceptance or deployment were performed.

**Boundaries:** No business database reads/writes, schema/dependency change, shared-service restart, deployment or changes to date/discount/approval policies.

---

# CRM Quotation Company/Contact Consistency (2026-10-15)

**Goal:** Prevent quotations from linking another company's contact, keep optional-contact editing functional, and avoid breaking linked-order ownership by moving the source quotation to another company.

**Scope:** Validate company/contact pairing on create and effective reference changes on update, before any quotation/line/company/audit writes. Normalize an empty contact selection to SQL NULL, matching the editor's existing payload. Reject company changes while an active linked order exists. Preserve normal note/term edits and unchanged historical contact references; do not rewrite historical data or introduce new contact requirements.

**Batch (maximum three files):** `PLANS.md`, `server/routes/quotations.ts`, `tests/customer-development-api.test.mjs`.

**Steps:**
1. [x] Inspect quote create/update/editor payloads, order invariants and fixtures; save source snapshots and SHA-256 checksums outside the project.
2. [x] Add failing HTTP regressions for invalid contacts, no-contact edits and linked orders, then implement minimal validation.
3. [x] Verify atomic rejection and valid/historical flows; run full tests, typechecks, build, isolated compiled-runtime regressions, API smoke and diff checks; pause at the batch boundary.

**Verification:** Three new HTTP regressions first reproduced invalid create/update requests returning HTTP 201/200, including a company move that broke a linked order's source relationship. Focused tests passed 10/10 after the fix. Snapshots confirmed rejected requests did not change quotation headers/lines, company stages, orders, or audit records; empty contact create/update, unchanged deleted-contact references and ordinary edits with linked orders passed. Full tests passed 496/496; frontend/server typechecks, build, isolated API write smoke, the same ten HTTP tests against the compiled server, and `git diff --check` passed. No business-data inspection/repair, shared-service acceptance, or deployment was performed.

**Boundaries:** No business database reads/writes, schema/dependency change, shared-service restart, deployment, or order splitting/approval policy changes.

---

# CRM Order Company/Quotation/Contact Consistency (2026-10-15)

**Goal:** Prevent new or edited orders from combining a company with another company's quotation or contact.

**Scope:** The order create route checks that company and quotation exist independently but omits their relationship, and it does not check contact ownership. Add matching checks before numbering or writes. On update, validate the effective references only when the company, quotation, or contact actually changes; preserve ordinary edits to historical orders whose source quotation is unavailable. Keep optional contacts, existing valid reassignment behavior, numbering, amounts, ownership, and approvals unchanged.

**Batch (maximum three files):** `PLANS.md`, `server/routes/orders.ts`, `tests/customer-development-api.test.mjs`.

**Steps:**
1. [x] Inspect conversion UI, create/update routes, related validation and existing fixtures; save source snapshots and SHA-256 checksums outside the project.
2. [x] Reproduce mismatched references via anonymous HTTP tests, then add the smallest server validation.
3. [x] Verify rejected requests leave no order/line/audit writes, valid references and optional contacts work, historical-order edits remain compatible, then run full tests, typecheck, build, isolated compiled-runtime regressions and API smoke.

**Verification:** New tests first reproduced invalid create/update requests succeeding with HTTP 201/200. After the fix, all seven focused HTTP tests passed, including snapshots confirming rejected requests leave order headers, line items, and audit records unchanged. Valid reassignment, missing/null contact, and note edits after the source quotation is soft-deleted passed. Full tests passed 493/493; frontend/server typechecks, build, isolated API write smoke, the same seven HTTP tests against the compiled server, and `git diff --check` passed. Business data and historical records were not inspected or rewritten; no shared-service acceptance or deployment was performed.

**Boundaries:** No business database reads/writes, historical-record correction, schema change, new dependencies, shared-service restart, or deployment. Do not change order splitting or quotation acceptance policy in this batch.

---

# CRM Quotation PDF Internal-note Privacy (2026-10-15)

**Goal:** Keep internal quotation notes in the CRM and exclude them from customer-facing quotation PDFs.

**Confirmed scope:** Remove `internal_notes` from the PDF's visible terms list. Preserve existing company/contact information, product lines, amounts, currency, trade/payment/delivery terms, note storage/editing, and all historical records. Do not add a customer-visible remarks field in this batch.

**Batch (maximum three files):** `PLANS.md`, `server/pdf-quotation.ts`, `tests/quotation-pdf-privacy.test.mjs`.

**Steps:**
1. [x] Inspect the PDF export route, template, note editor, and available test/render tools; save source snapshots and SHA-256 checksums outside the project.
2. [x] Generate an anonymous PDF regression that demonstrates the internal-note leak, then remove the private field from rendering.
3. [x] Verify real PDF text and rendered layout, targeted/full tests, typecheck, build, and isolated compiled-runtime export; pause at the batch boundary.

**Verification:** The real-PDF regression first failed because the English private marker was present, then passed with both English and Chinese internal notes absent. Customer/contact, product, amounts, currency, and commercial terms remained in extracted text, and export did not mutate input data. Rendered the anonymous one-page A4 PDF and inspected its layout. Full tests passed 491/491; frontend typecheck, build, isolated API write smoke, compiled-template PDF regression, and `git diff --check` passed. The isolated compiled-template test explicitly included the existing font assets; deployment asset packaging was not changed or verified. No shared-service acceptance or deployment was performed.

**Boundaries:** No business database reads/writes, data cleanup, new dependency, migration, shared-service restart, or deployment. Existing downloaded PDFs are not modified by this change.

---

# CRM Quotation Create-field Persistence (2026-10-15)

**Goal:** Persist the optional notes and existing commercial fields submitted by the quotation editor when creating a quotation, so reloading does not silently discard them.

**Root cause and scope:** The create-route INSERT omits `internal_notes`, `incoterm`, `payment_term`, `delivery_term`, `tax_type`, `domestic_vat_rate`, `export_tax_rebate_rate`, `tax_amount`, and `shipping_handling`. These columns and their edit support already exist. Add only these submitted fields with existing schema defaults; preserve calculation, ownership, audit, approval, and legacy-data behavior.

**Batch (maximum three files):** `PLANS.md`, `server/routes/quotations.ts`, `tests/customer-development-api.test.mjs`.

**Steps:**
1. [x] Inspect the editor, create/update routes, schema, and HTTP test fixtures; save source snapshots and SHA-256 checksums outside the project.
2. [x] Add HTTP regressions that reproduce lost fields, then extend the existing INSERT.
3. [x] Verify create/reload/audit, optional empty fields and defaults, targeted/full tests, typecheck, build, isolated API write smoke, and diff checks; pause at the batch boundary.

**Verification:** New HTTP tests first failed on lost notes and empty values, then focused tests passed 5/5. Full tests passed 490/490; frontend typecheck, production build, isolated API write smoke, and `git diff --check` passed. The same five HTTP tests also passed against `dist-server` in a temporary project copy, confirming compiled-runtime persistence. Existing quotations and business data were not rewritten; no deployment or shared-service acceptance was performed.

**Follow-up resolved:** The next approved PDF privacy batch above removes `quotation.internal_notes` from customer-facing export while preserving note storage and existing commercial terms.

**Boundaries:** No business database reads/writes, schema migration, dependency changes, shared-service restart, or deployment. Use anonymous temporary databases for all writes. Run the existing write smoke from an isolated project copy because it uses relative `crm.db` paths.

---

# CRM Quotation Entry Simplification (2026-10-15)

**Goal:** Create a quotation from the selected company, existing contact, product lines, prices, and commercial terms without requiring knowledge of the customer's application.

**Confirmed scope:**
- Remove application description, urgency, and source controls from the quotation editor; retain existing stored values by omitting these legacy fields from create/update payloads.
- Default to the company's single active primary contact, or its sole active contact; keep manual selection when ambiguous and allow no contact.
- Preserve an explicitly selected valid contact, reject stale contact responses when switching companies, and keep load-error retry behavior.
- Keep optional internal notes for customer-stated requirements and preserve current commercial fields, permissions, and translations.

**Batch (maximum three files):** `PLANS.md`, `src/components/quotations/QuotationEditPanel.tsx`, `tests/i18n-second-batch.test.mjs`.

**Steps:**
1. [x] Inspect current code and existing changes; save source snapshots and SHA-256 checksums outside the project.
2. [x] Add failing behavioral regression coverage, then implement the smallest quotation-editor change.
3. [x] Run focused tests, full tests, frontend typecheck, build, isolated API write smoke, and diff checks; pause at the batch boundary.

**Verification:** Focused tests 9/9; full tests 488/488 after allowing local test pipes/ports (the sandbox-only attempt blocked 28 tests with `EPERM`); `tsc --noEmit`, production build, isolated API write smoke, and `git diff --check` passed. Browser QA in an anonymous temporary database verified primary-contact defaulting, manual contact switching, clearing contacts on company change, removal of the three requirement controls, and saving a two-item-unit quotation with the correct contact and total without an application description.

**Follow-up resolved:** The next approved quotation create-field persistence batch above fixes the missing `internal_notes` insert, along with the same omission affecting existing commercial fields. The initial anonymous browser-save check established the original failure.

**Boundaries:** No dependency changes, business database writes, migration, restart of the shared CRM, or deployment. Run write smoke only in a temporary isolated project/database because its current paths target `crm.db` beside the script.

---

# CRM Company Workspace Simplification Plan

# CRM Inventory V2 PEEK Sheet Reference-data Plan (2026-09-09)

**Current goal:** Improve PEEK sheet stock weights without changing SKU codes or inventory quantities by separating nominal dimensions, supplier reference specifications, warehouse measurements, calculated weights, and scale weights.

**Confirmed data rules:**
- Keep the CRM PEEK density at `1320 kg/m3` for calculations.
- Store the 20 visible rows from the supplied PEEK sheet table as supplier reference data, not as warehouse measurements.
- For nominal 12-20 mm rows, use the explicit `1250 x 3150 mm` size column and retain a note that the category column says `1260 x 3150 mm`.
- Never apply the measured `2.77 mm` thickness to every nominal 2 mm sheet; measurements belong only to the confirmed inventory specification or batch.
- Preserve existing SKU codes, quantities, movements, actual weights, legacy references, and isolated-inventory boundaries.

**Implementation order:**
1. [x] Back up `crm.db`; add idempotent sheet-reference and measurement storage with schema-level regression coverage.
2. [x] Replace broad PEEK tolerance-only estimation with an explicit evidence hierarchy: scale weight, warehouse measured thickness, supplier reference thickness, then configured fallback rule.
3. [x] Expose calculation basis, supplier reference values, manual measurement entry, and evidence columns in the read-only inventory Excel export.
4. Produce a before/after preview for existing estimated weights; update estimated values only after review and leave actual weights unchanged.

**Implemented without inventory rewrites:**
- The stock list and Excel export now label scale, measured-thickness, supplier-reference, tolerance-rule, geometric, legacy-estimate, and missing-rule weight evidence separately.
- Warehouse measurements are recorded per actual inventory specification; saving a measurement does not change the master SKU nominal dimensions.
- Existing legacy estimated weights remain stored and visible. Where the recommendation differs, the UI and Excel expose the recommendation for review instead of applying it automatically.

**Batch and verification constraints:** Change no more than three files per batch. After each batch run targeted tests, `npm run test`, `npx tsc --noEmit`, `npm run smoke:api`, `npm run build`, and `git diff --check`; stop immediately on failure.

# CRM Materials and Tooling Master-data Plan (2026-08-06)

**Current goal:** Keep material quantities ledger-based, make count adjustments easy to start from the Materials list, default material safety stock to 5, and generate stable unique codes for new materials and tooling assets without renaming historical records.

**Confirmed implementation order:**
1. Add a Materials-row shortcut that creates a count-adjustment draft with the current quantity prefilled.
2. Default new material safety quantity to 5, then back up the local database and update existing material safety quantities according to the confirmed scope.
3. Generate `MAT-0001`-style material codes and `TLG-0001`-style tooling codes server-side; preserve existing codes and keep saved codes immutable.

**Constraints:** Preserve movement/audit history, use additive local changes only, add no dependency, do not rename existing codes, and keep each implementation batch to no more than three files with verification before continuing.

# CRM Materials and Tooling Simplified Workflow Plan (2026-08-07)

**Current goal:** Remove approval and settings from the small-team user workflow while preserving document records, inventory/tooling movements, audit history, and compatibility with historical approval records.

**Confirmed implementation order:**
1. Add a no-approval fallback for new documents when no approver is configured; keep legacy approval records and configured workflows compatible.
2. Make the Materials count-adjustment shortcut create and execute the adjustment with one explicit confirmation.
3. Simplify the Documents page actions and status presentation around draft, pending execution/purchase, and executed records.
4. Remove the user-facing Approvals and Settings tabs, fix visible translation-key leaks, back up the local database, and run final verification.

**Constraints:** Do not drop approval tables or historical fields, do not auto-approve existing pending documents, preserve stock/audit transactions, add no dependency, and keep each implementation batch to no more than three files with verification before continuing.

# CRM Dependency Security Remediation (2026-08-05)

**Current goal:** Resolve production dependency advisories without changing CRM routes, stored data, or deployment state.

**Completed:**
- [x] Upgrade `multer` to 2.2.0 and `uuid` to 11.1.1.
- [x] Upgrade `react-router-dom` to 7.18.2; existing client-side `BrowserRouter` usage remains compatible.
- [x] Replace the unmaintained `xlsx` package with the API-compatible `@e965/xlsx` 0.20.3 alias.
- [x] Pin transitive `body-parser` to 1.20.6 through npm overrides.
- [x] Run production audit, full tests, typecheck, build, API write smoke, and diff checks.

**Audit note:** The remaining npm advisory targets React Router RSC mode. This CRM uses `BrowserRouter` and does not use RSC, server actions, or React Router SSR hydration.

**Constraints:** No database migration, production deployment, remote push, or real-customer data write.

# CRM Release Defect Repair Plan (2026-08-04)

**Current goal:** Resolve the defects found in the full CRM acceptance pass while keeping the confirmed quotation-primary workflow, preserving legacy Inquiry URLs as redirects, and avoiding production data or schema changes.

**Repair order:**
1. [x] Restore the quotation-created Company development-stage transition and add a regression assertion.
2. [x] Make the isolated write smoke flow follow the quotation-primary API while preserving a clear legacy Inquiry compatibility response.
3. [x] Complete quotation editor labels and explicitly decide whether the removed discount controls remain out of scope; align static contracts with the current seven-column list.
4. [x] Normalize list toolbar/empty-state markup and commercial action-menu surfaces.
5. [x] Run targeted tests, full tests, typecheck, build, diff checks, and isolated API smoke.
6. [x] Verify the authenticated desktop workflow in an isolated temporary database and simplify the new quotation form defaults.

**Constraints:**
- No database migration, production dependency, deployment, push, or real-customer data writes.
- Keep changes to no more than three files per batch.
- Preserve `/inquiries/*` redirects and existing stored legacy fields unless a compatibility issue requires a narrowly scoped response.
- Do not remove the existing test-generated PDF change from the worktree without user direction.

**Verification:** `npm run test`, `npm run smoke:api`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.

**Current goal:** Rebalance the desktop Company workspace around actionable follow-up and sales work, remove duplicated summaries, and make Follow-ups a direct Sales navigation destination.

**Confirmed product decisions:**
- Company Detail uses a top action summary, a primary opportunities/activity column, and one short supporting rail.
- The top summary shows active quotation value, open inquiry/quotation counts, next follow-up, pending tasks, and one recommended action.
- Recent Activity, Pipeline Summary, Quick Stats, and the existing Customer Briefing are removed instead of hidden in accordions.
- The supporting rail keeps Primary Contact, up to three pending tasks, Owner, and entry points for Company Details and Operation History.
- Full company information and audit history use progressive disclosure through side panels.
- Follow-ups appears directly below Companies in the Sales sidebar.
- Contact Directory remains company-scoped and accessible from Company screens; its existing routes remain compatible.
- Desktop information hierarchy is completed and verified before further mobile refinement.

**Implementation order:**
1. [x] Add Follow-ups directly after Companies in the Sales sidebar.
2. [x] Remove the Company module tab bar and normalize the Follow-up Workbench page heading.
3. [x] Replace Company Detail summaries with the compact top action summary.
4. [x] Reduce the supporting rail to Primary Contact, pending tasks, Owner, and detail entry points.
5. [x] Move full Company Details and Operation History into side panels.
6. [x] Run desktop browser QA, accessibility checks, tests, typecheck, build, and diff verification.

**Constraints and verification:**
- No database migration, API contract change, new production dependency, or route removal.
- Preserve bilingual copy, ownership, permissions, audit data, follow-up behavior, and contact-detail fallbacks.
- Change no more than three files per batch and pause at every batch boundary.
- Add a user-facing static UI regression before or with each behavior slice.
- Final verification: `npx tsc --noEmit`, `npm run test`, `npm run build`, and `git diff --check`.

---

# CRM Mobile Optimization Plan

**Current goal:** Make the existing CRM usable on phone-sized viewports without changing routes, business workflows, APIs, stored data, or the desktop information hierarchy.

**Design direction:** Treat mobile as a focused single-column workflow: full-height navigation drawer, compact page headers, readable touch targets, and progressive disclosure for secondary company details.

**Implementation order:**
1. [x] Harden the mobile app shell, navigation drawer, viewport sizing, and background scroll behavior.
2. [x] Reflow Company List, Follow-up Workbench, and Contact Directory for narrow screens.
3. [x] Rework Company Detail header, action summary, opportunity cards, activity timeline, and support rail for phone widths.
4. [x] Reflow shared panels, forms, tables, and dense operational pages that still clip or force horizontal scrolling.
5. [x] Run 390×844 and 430×932 browser QA, keyboard/accessibility checks, tests, typecheck, build, and diff verification.

**Constraints:**
- Keep React, Tailwind, Lucide, existing bilingual copy, permissions, and route compatibility.
- Add no production dependency, database migration, API contract change, or public deployment.
- Change no more than three files per batch and stop at each batch boundary.
- Keep mobile changes additive and preserve the confirmed desktop layout.

---

# CRM Customer Development and Follow-up Plan

**Current goal:** Make Company the primary customer record, add a reliable cross-company follow-up workflow, simplify Company Detail, and demote Contacts to a company-scoped directory without mixing customer development with the existing sales pipeline.

**Confirmed product decisions:**
- Companies owns three related views: Company List, Follow-up Workbench, and Contact Directory.
- The Follow-up Workbench covers both prospect development and existing-customer maintenance.
- Customer development uses `Uncontacted → Contacted → Replied → Qualified → Converted`, with `Nurturing` and `Stopped` as side states.
- The existing sales pipeline remains `Inquiry → Quotation → Sample/Testing → Order`.
- Company is the customer subject; Contact is a person and role within one Company.
- Activities and follow-up tasks belong to Company and may identify a Contact.
- The earliest open follow-up task is the single source of truth for the next follow-up date.

**Data and migration assumptions:**
- Use additive SQLite migrations only; preserve all existing records.
- Back up the local database before applying migrations.
- Add a Company development stage, an optional task Contact reference, and an optional activity outcome.
- Initialize existing Company stages deterministically: records with inquiries or orders are Converted; records with inbound customer activity are Replied; records with outbound contact activity are Contacted; remaining records are Uncontacted.
- Do not infer Nurturing or Stopped from elapsed time.
- Creating an Inquiry moves its Company to Converted.
- A Contact may be saved without a direct channel; Company public contact details provide a visible fallback.

**Implementation order:**
1. [x] Back up the current local database and record the confirmed plan and domain language.
2. [x] Add migration-safe schema fields, indexes, and deterministic existing-data initialization.
3. [x] Add transactional follow-up read/write contracts and Inquiry-driven conversion.
4. [x] Add typed frontend contracts and bilingual customer-development copy.
5. [x] Build one reusable follow-up recording panel.
6. [x] Build the cross-company Follow-up Workbench.
7. [x] Add the Company module navigation without adding a new primary sidebar item.
8. [x] Allow Contacts without direct contact details and expose Company fallback details.
9. [x] Simplify the Contact Directory and remove it from primary navigation.
10. [x] Replace Company Detail's three-column information wall with a two-column, single-scroll workspace.
11. [x] Run migration, API, UI, accessibility, type, test, build, and diff verification.

**Batch constraints:**
- Change no more than three files per implementation batch.
- Add no production dependency.
- Write regression coverage before or with each behavioral change.
- Preserve bilingual UI, authentication, ownership, permissions, and audit behavior.
- Keep existing routes working unless the confirmed module navigation explicitly adds a route.
- Pause at each batch boundary for review.

**Verification:**
- Test migrations against temporary legacy-shaped databases and verify repeatability.
- Test follow-up recording as one transaction: activity creation, current-task completion, next-task creation, and Company stage update.
- Test Contact ownership and reject cross-company Contact references.
- Test stage initialization and automatic conversion when an Inquiry is created.
- Test Company contact-detail fallback without duplicating identical values.
- Run targeted Node tests after every batch.
- Final: `npx tsc --noEmit`, `npm run test`, `npm run build`, and `git diff --check`.
- Run the local write smoke test only after explaining its database impact.

**Out of scope for this rollout:**
- Automatic email sending or multi-step email sequences.
- Email-open tracking.
- External email, browser, or mobile notifications.
- AI summaries and customer-health scoring.
- Existing sales-pipeline redesign.
- Global search and Command-K redesign.

---

# CRM Form Accessibility Completion Sweep

**Current goal:** Eliminate the remaining unlabeled `input`, `select`, and `textarea` controls identified by the TypeScript JSX audit without changing workflows, routes, APIs, dependencies, or stored data.

**Scope and assumptions:**
- Associate existing visible labels through matching `htmlFor` and `id`.
- Add screen-reader-only labels for compact search and filter controls where a visible label would add noise.
- Preserve bilingual copy by reusing existing translation keys.
- Keep each implementation batch to two UI files plus one shared static regression test.

**Remaining implementation order:**
1. [x] Shared meeting notes and material settings.
2. [x] Contact and quotation lists.
3. [x] Material documents and ledger filters.
4. [x] Shared activity timeline and email draft controls.
5. [x] Inquiry list and order detail editor.
6. [x] Order list and top-bar search.
7. [x] Material approvals and task quick-add.
8. [x] Activity and payment controls.
9. [x] Pipeline and shipment controls.
10. [x] Full JSX rescan, tests, typecheck, build, and diff validation.

**Verification:**
- Targeted Node static UI test after every two-file slice.
- Final JSX AST scan must report zero unlabeled form controls.
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `git diff --check`

---

# CRM P0 UI Consistency Repair Plan

**Current goal:** Finish the eight P0 UI consistency repairs identified in the VibeHub-informed audit without changing CRM workflows, routes, dependencies, or stored data.

**Design direction:** Keep the existing Precision Industrial language, use one blue brand accent, reserve red for risk and destructive states, and make shared interaction patterns predictable across dense desktop workflows.

**Constraints:**
- Keep React, Tailwind 3, Lucide, the existing typography system, and current routes.
- Add no production dependency and make no database or API schema change.
- Preserve bilingual layout and existing permissions.
- Change no more than three files per batch and verify each batch before continuing.
- Reuse the existing Node static UI contract tests as the public test seam.

**P0 implementation order:**
1. [x] Complete dark mode with dark surface, text, border, interaction, and semantic-state tokens.
2. [x] Replace hard-coded brand blue with the shared brand token.
3. [x] Reserve danger red for overdue, failed, destructive, and genuinely abnormal states.
4. [x] Route create, quick-edit, and contextual detail flows through side panels; keep short decisions in centered dialogs.
5. [x] Replace native and ad-hoc delete confirmation with one accessible confirmation dialog.
6. [x] Add persistent form labels and field-level validation messages to the audited forms.
7. [x] Replace generic loading text and premature zero metrics with layout-shaped skeleton states.
8. [x] Remove nested fixed-width columns that break the responsive company workspace.

**Expected affected areas:**
- Theme and tokens: `src/index.css`, `src/lib/theme.tsx`, `src/components/layout/Sidebar.tsx`
- Semantic colors: `src/pages/Dashboard.tsx`, `src/pages/InventoryPage.tsx`
- Panels and confirmations: shared overlays plus companies, contacts, quotations, orders, shipments, payments, activities, tasks, inventory, and materials tooling
- Forms: `CompanyEditPanel.tsx`, `ContactPanel.tsx`, `QuotationEditPanel.tsx`, `InventoryPage.tsx`
- Loading: `App.tsx`, dashboard, pipeline, inventory, and record detail pages
- Responsive workspace: `ResponsiveWorkspace.tsx`, `CompanyDetail.tsx`

**Verification:**
- Targeted `node --test tests/ui-p0-*.test.mjs` after each slice
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `git diff --check`

---

# CRM Team Accountability Plan

**Current goal:** Make ownership and every important write operation attributable to a real CRM user for the current 2-3 person internal team.

**Rules:**
- Ownership and operation history are separate concepts.
- Store user IDs in records; resolve names from `users` when displaying them.
- New sales records default to the current user and inherit customer ownership where appropriate.
- Historical records remain unassigned until an administrator assigns them.
- Inventory changes must remain ledger-based and record before/change/after quantities.
- Keep permissions simple for the internal team: administrators manage accounts; authenticated members collaborate and every key write is audited.

**Implementation order:**
1. [x] Add ownership, creator, and updater fields with additive migrations.
2. [x] Add field-level audit diffing and a protected history API.
3. [x] Complete audit coverage for companies, contacts, tasks, and inventory.
4. [x] Default and inherit ownership through customers, inquiries, quotations, and orders.
5. [x] Add owner columns, filters, assignment, metadata, and history UI.
6. [x] Verify migrations, tests, build, and isolated API smoke writes.

**Completed verification (2026-07-13):** 167 automated tests, frontend and server type checks, production build, database backup, and isolated API write smoke across nine modules.

**Payments soft ownership (2026-07-13):** Payments display linked order owners, preserve truthful actor metadata, and enforce owner-or-admin invoice/payment writes. Verified with 170 automated tests and three-account API smoke coverage.

**Domestic-first shipments (2026-07-13):** Simplify the shipment list around domestic express/logistics, move sea/air schedule details to the detail page, and make shipment forms type-aware without a database migration.

---

# CRM Product UI Refinement Plan

**Current goal:** Give the local CRM a distinctive, professional Precision Industrial visual language without changing its typography system or business workflows.

**Design direction:** Attio-inspired information discipline, cool neutral surfaces, one blue brand accent, restrained status color, compact motion, and clear operational hierarchy.

**Constraints:**
- Keep React, Tailwind 3, Lucide, the existing font scale, and current routes.
- Add no production dependency.
- Preserve bilingual layout and dense desktop workflows.
- Use cards only where a framed surface communicates real hierarchy.
- Change no more than three files per batch and verify each batch.

**Implementation order:**
1. [x] Establish `DESIGN.md`, shared surface tokens, page shells, toolbars, and interaction primitives.
2. [x] Reshape Workspace hierarchy and reduce repetitive cards.
3. [x] Use Customers as the canonical list-page pattern.
4. [x] Apply the list pattern to quotations and orders.
5. [x] Apply the list pattern to shipments, payments, and inventory.
6. [x] Standardize side panels, modals, forms, loading, empty, and error states.
7. [x] Audit icon semantics, sizes, tooltips, focus, hover, and pressed states.
8. [x] Complete the Attio-style density pass: sentence-case headers, stable row heights, responsive action wrapping, and restrained segmented controls.
9. [x] Verify responsive layout constraints, tests, type checking, build, and static visual regressions.

---

# Previous CRM Chinese Localization Plan

**Goal:** Finish the Simplified Chinese UI for the local CRM in small, safe batches.

**Tone:** Use concise personal-workflow Chinese, not formal enterprise wording.

**Assumptions:**
- The existing `react-i18next` setup stays in place.
- Existing translated pages should be checked and polished, not rebuilt.
- Customer-entered data, product grades, material names, SKU, company names, currency codes, and file formats stay as-is.
- No production deployment, database migration, or dependency change is needed.

**Current batch:** Local formal release preparation.

**Affected files for batch 1:**
- `src/lib/i18n.tsx`
- `src/pages/Companies.tsx`
- `src/pages/Contacts.tsx`
- `src/components/contacts/ContactPanel.tsx`
- `tests/i18n-first-batch.test.mjs`

**Affected files for batch 2:**
- `src/lib/i18n.tsx`
- `src/pages/InquiryNew.tsx`
- `src/pages/InquiryDetail.tsx`
- `src/pages/Quotations.tsx`
- `tests/i18n-second-batch.test.mjs`

**Affected files for batch 3:**
- `src/lib/i18n.tsx`
- `src/pages/QuotationDetail.tsx`
- `src/components/quotations/QuotationEditPanel.tsx`
- `src/pages/OrderDetail.tsx`
- `tests/i18n-third-batch.test.mjs`

**Affected files for batch 4:**
- `src/lib/i18n.tsx`
- `src/pages/InventoryPage.tsx`
- `tests/inventory-ui.test.mjs`

**Affected files for batch 5a:**
- `src/lib/i18n.tsx`
- `src/components/shared/ActivityTimeline.tsx`
- `src/components/shared/MeetingNotes.tsx`
- `src/components/shared/TaskSection.tsx`
- `tests/i18n-shared-batch.test.mjs`

**Affected files for batch 5b:**
- `src/lib/i18n.tsx`
- `src/components/shared/QuoteAssistant.tsx`
- `tests/i18n-quote-assistant.test.mjs`

**Affected files for batch 6:**
- `src/lib/i18n.tsx`
- `src/pages/Dashboard.tsx`
- `tests/i18n-dashboard.test.mjs`

**Affected files for batch 7:**
- `src/lib/i18n.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Shipments.tsx`
- `src/pages/ShipmentDetail.tsx`
- `tests/i18n-fulfillment-payments.test.mjs`

**Affected files for batch 8:**
- `src/lib/i18n.tsx`
- `src/pages/Inquiries.tsx`
- `src/pages/Orders.tsx`
- `src/pages/Tasks.tsx`
- `tests/i18n-list-pages.test.mjs`

**Affected files for batch 9:**
- `src/lib/i18n.tsx`
- `src/pages/CompanyDetail.tsx`
- `src/pages/Activities.tsx`
- `src/pages/SettingsProfile.tsx`
- `tests/i18n-profile-activity-detail.test.mjs`

**Affected files for batch 10:**
- `src/lib/i18n.tsx`
- `src/components/shared/ResponsiveWorkspace.tsx`
- `src/components/shared/StatusBadge.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/shared/AboutModal.tsx`
- `src/components/pipeline/PipelineColumn.tsx`
- `src/pages/Pipeline.tsx`
- `src/pages/InventoryPage.tsx`
- `tests/i18n-shared-components.test.mjs`

**Affected files for typography batch:**
- `tailwind.config.js`
- `src/index.css`
- `src/pages/**/*.tsx`
- `src/components/**/*.tsx`
- `tests/typography-system.test.mjs`

**Affected files for save workflow fixes:**
- `src/components/contacts/ContactPanel.tsx`
- `src/pages/InventoryPage.tsx`
- `src/pages/SettingsProfile.tsx`
- `src/components/shared/UserMenu.tsx`
- `tests/user-reported-workflow-fixes.test.mjs`

**Affected files for local release preparation:**
- `docs/local-release-checklist.md`
- `README.md`
- `start-crm.sh`
- backup and restore scripts, if added in a later batch

## Milestones

- [x] Add a lightweight test that catches obvious hard-coded English UI labels in the first batch.
- [x] Add concise Chinese dictionary entries for customer/contact labels, import UI, role labels, and toast messages.
- [x] Replace hard-coded English UI in `Contacts.tsx`.
- [x] Replace hard-coded English UI in `ContactPanel.tsx`.
- [x] Replace hard-coded English UI in `Companies.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to the next 2-3 files.
- [x] Add a lightweight test for obvious hard-coded English UI labels in inquiry/quotation list files.
- [x] Add concise Chinese dictionary entries for inquiry detail, source/urgency labels, quotation statuses, and table headers.
- [x] Replace hard-coded English UI in `InquiryNew.tsx`.
- [x] Replace hard-coded English UI in `InquiryDetail.tsx`.
- [x] Replace hard-coded English UI in `Quotations.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to quotation/order details.
- [x] Add a lightweight test for obvious hard-coded English UI labels in quotation/order detail files.
- [x] Add concise Chinese dictionary entries for quote actions, sample requests, order summary, shipment previews, and invoice summaries.
- [x] Replace hard-coded English UI in `QuotationDetail.tsx`.
- [x] Replace hard-coded English UI in `QuotationEditPanel.tsx`.
- [x] Replace hard-coded English UI in `OrderDetail.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to inventory.
- [x] Add/update a lightweight test for obvious hard-coded English UI labels in inventory.
- [x] Add concise Chinese dictionary entries for inventory dashboard, product edit/delete, ledger, stock in/out, adjustment, and import UI.
- [x] Replace hard-coded English UI in `InventoryPage.tsx`.
- [x] Keep product data, SKU, file-template columns, and unit values untranslated.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to shared components.
- [x] Add a lightweight test for obvious hard-coded English UI labels in shared activity, meeting, and task components.
- [x] Add concise Chinese dictionary entries for activity logging, follow-ups, meeting notes, and task quick-add UI.
- [x] Replace hard-coded English UI in `ActivityTimeline.tsx`.
- [x] Replace hard-coded English UI in `MeetingNotes.tsx`.
- [x] Replace hard-coded English UI in `TaskSection.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this three-file batch before moving to `QuoteAssistant.tsx`.
- [x] Add a lightweight test for obvious hard-coded English UI labels in `QuoteAssistant.tsx`.
- [x] Add concise Chinese dictionary entries for quote assistant pricing, margin, discount, and insight labels.
- [x] Replace hard-coded English UI in `QuoteAssistant.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch before final sweep/code-splitting decision.
- [x] Add a lightweight test for final hard-coded English UI labels in email draft, customer summary, and company edit components.
- [x] Add concise Chinese dictionary entries for email draft actions, customer briefing metrics, next-action prompts, and company edit toasts/helper text.
- [x] Replace hard-coded English UI in `EmailDraftPanel.tsx`.
- [x] Replace hard-coded English UI in `CustomerSummary.tsx`.
- [x] Replace hard-coded English UI in `CompanyEditPanel.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this three-file final sweep batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels on the dashboard.
- [x] Add concise Chinese dictionary entries for dashboard KPIs, receivables, pipeline, monthly sales, and aging sections.
- [x] Replace hard-coded English UI in `Dashboard.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this dashboard batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in payments, shipments, and shipment detail.
- [x] Add concise Chinese dictionary entries for payment KPI cards, invoice editing, shipment forms, shipment table, and shipment detail.
- [x] Replace hard-coded English UI in `Payments.tsx`.
- [x] Replace hard-coded English UI in `Shipments.tsx`.
- [x] Replace hard-coded English UI in `ShipmentDetail.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in inquiry list, order list, and task list pages.
- [x] Add concise Chinese dictionary entries for inquiry urgency, order table headers, and task summary/form labels.
- [x] Replace hard-coded English UI in `Inquiries.tsx`.
- [x] Replace hard-coded English UI in `Orders.tsx`.
- [x] Replace hard-coded English UI in `Tasks.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in company detail, activities, and profile pages.
- [x] Add concise Chinese dictionary entries for company detail cards, opportunity labels, activity list, and profile form placeholders.
- [x] Replace hard-coded English UI in `CompanyDetail.tsx`.
- [x] Replace hard-coded English UI in `Activities.tsx`.
- [x] Replace hard-coded English UI in `SettingsProfile.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for shared layout, status badge, sidebar/about, and pipeline control labels.
- [x] Add concise Chinese dictionary entries for workspace labels, about modal, pipeline loading/drop hints, and missing status labels.
- [x] Replace shared workspace default labels in `ResponsiveWorkspace.tsx`.
- [x] Replace status badge labels in `StatusBadge.tsx`.
- [x] Replace sidebar section labels and about modal labels.
- [x] Replace pipeline loading/drop hints.
- [x] Replace remaining stock in/out/adjustment form labels in `InventoryPage.tsx`.
- [x] Run shared component, inventory, final sweep tests, and typecheck.
- [x] Add a lightweight test for the CRM typography system.
- [x] Tighten the Tailwind font scale to match a compact Attio-style CRM interface.
- [x] Remove negative heading letter spacing so Chinese and English titles render evenly.
- [x] Normalize buttons, inputs, labels, table headers, table cells, badges, and product tags to lighter 400/450/600 weights.
- [x] Replace heavy uppercase section labels with lighter 450-weight labels and consistent small letter spacing.
- [x] Replace remaining 700-weight text with 600-weight emphasis.
- [x] Add a lightweight regression test for the reported contact, inventory product, and profile save issues.
- [x] Make contact edit save show the actual API error instead of a generic failure.
- [x] Keep the contact save button clickable during validation so users get a visible reason when required data is missing.
- [x] Let inventory product SKU and name be edited directly instead of locking them behind auto generation.
- [x] Show backend validation details when inventory product save fails.
- [x] Notify the sidebar user menu immediately after profile changes are saved.
- [x] Run targeted tests, typecheck, full test suite, build, and write smoke test.
- [x] Fix the actual contact API 500 by converting boolean checkbox values to SQLite-safe 1/0 values during contact updates.
- [x] Fix inventory product duplicate SKU saves by returning a clear 400 error instead of a SQLite 500.
- [x] Extend the write smoke test to submit the same boolean contact payload shape used by the page.
- [x] Add a local-first release checklist for personal daily use and later internal company use.
- [x] Freeze current feature work before creating a stable local release.
- [x] Review the uncommitted changes and split them into clear local release commits.
- [x] Add local database backup and restore instructions.
- [x] Run a final local formal release verification pass.
- [x] Confirm the desktop CRM app starts the current main project path.

## Batch Order

1. Customers and contacts:
   - `Companies.tsx`
   - `Contacts.tsx`
   - `ContactPanel.tsx`
2. Inquiry list/detail and quotation list:
   - `InquiryNew.tsx`
   - `InquiryDetail.tsx`
   - `Quotations.tsx`
3. Quotation/order details:
   - `QuotationDetail.tsx`
   - `QuotationEditPanel.tsx`
   - `OrderDetail.tsx`
4. Inventory:
   - `InventoryPage.tsx`
5. Shared components and final sweep:
   - `ActivityTimeline.tsx`
   - `MeetingNotes.tsx`
   - `TaskSection.tsx`
   - `QuoteAssistant.tsx`
   - `EmailDraftPanel.tsx`
   - `CustomerSummary.tsx`
   - `CompanyEditPanel.tsx`
   - remaining toasts/placeholders/table labels
6. Dashboard:
   - `Dashboard.tsx`
7. Payments and shipments:
   - `Payments.tsx`
   - `Shipments.tsx`
   - `ShipmentDetail.tsx`
8. List pages:
   - `Inquiries.tsx`
   - `Orders.tsx`
   - `Tasks.tsx`
9. Detail/activity/profile pages:
   - `CompanyDetail.tsx`
   - `Activities.tsx`
   - `SettingsProfile.tsx`
10. Shared controls and final polish:
   - `ResponsiveWorkspace.tsx`
   - `StatusBadge.tsx`
   - `Sidebar.tsx`
   - `AboutModal.tsx`
   - `PipelineColumn.tsx`
   - `Pipeline.tsx`
   - remaining inventory form labels
11. Typography system alignment:
   - global font scale
   - component control typography
   - section label and badge weight
12. User-reported save workflow fixes:
   - contact edit save
   - inventory product create save
   - profile name refresh in sidebar
13. Save workflow root-cause follow-up:
   - SQLite-safe contact checkbox updates
   - clear inventory duplicate SKU validation
   - live local API restart and endpoint check
14. Local formal release preparation:
   - local release checklist
   - backup and restore workflow
   - final local verification pass
15. Local formal release:
   - release note v1.0.0
   - daily workflow checklist
   - git tag v1.0.0
16. Internal company preparation (Stage 2):
   - access model
   - authentication
   - user roles and audit trail

## Verification

Use `package.json` scripts as the source of truth for current verification commands.

- `node --test tests/i18n-first-batch.test.mjs`
- `node --test tests/i18n-second-batch.test.mjs`
- `node --test tests/i18n-third-batch.test.mjs`
- `node --test tests/inventory-ui.test.mjs`
- `node --test tests/i18n-shared-batch.test.mjs`
- `node --test tests/i18n-quote-assistant.test.mjs`
- `node --test tests/i18n-final-sweep.test.mjs`
- `node --test tests/i18n-dashboard.test.mjs`
- `node --test tests/i18n-fulfillment-payments.test.mjs`
- `node --test tests/i18n-list-pages.test.mjs`
- `node --test tests/i18n-profile-activity-detail.test.mjs`
- `node --test tests/i18n-shared-components.test.mjs`
- `node --test tests/typography-system.test.mjs`
- `node --test tests/user-reported-workflow-fixes.test.mjs`
- `npx tsc --noEmit`
- `npm run test`
- `npm run smoke:api`
- `git diff --check`
- `npm run build`

## Out of Scope For Batch 1

- Translating inventory.
- Translating generated PDFs.
- Translating database/customer-entered content.
- Adding new i18n dependencies.

---

# CRM Opportunity Unification Plan

## Materials tooling procurement fields follow-up (2026-08-08)

- Goal: allow purchase request/receipt supplier to be handwritten and optional, while keeping existing supplier master IDs and audit history compatible.
- Additive schema: nullable `supplier_name` on documents and movements; nullable purchase line price remains supported.
- Order: schema/document persistence → movement execution/reporting → Documents UI and regression tests.
- Constraints: backup before migration, no destructive data changes, maximum three files per implementation batch, then typecheck/build/tests.

**Current goal:** Make Inquiry and Quotation one sales workflow in the UI while preserving separate domain records for customer demand and commercial quote documents.

**Confirmed product decisions:**
- Sales users work from one Opportunity/销售机会 record, not two duplicated entry pages.
- Inquiry remains the customer requirement record; Quotation remains the price, terms, validity, approval, and revision document.
- One Inquiry may have multiple Quotation revisions or alternatives; an accepted Quotation creates the Order.
- Company, Contact, material, quantity, and application details are entered once and inherited read-only by the quotation flow.
- The existing quotation list remains as a secondary quote-status view, not a second creation workflow.
- The primary sidebar exposes Opportunities / 销售机会; Inquiry and Quotation list routes remain available as secondary views from that workspace.
- Existing routes, records, audit history, and bilingual copy remain compatible.

**Implementation order:**
1. [x] Add a unified Opportunities workspace and reduce duplicate top-level entry points.
2. [x] Add an Opportunity detail view that groups request, activity, latest quotation, quote revisions, and order progression.
3. [x] Make quotation creation/revision contextual and inherit request/customer data without re-entry.
4. [x] Protect against duplicate empty quotations and clarify quotation-to-inquiry relationships.
5. [x] Backfill or surface legacy unlinked quotations without deleting existing data.
6. [x] Run targeted tests, full tests, typecheck, build, and smoke verification.
7. [ ] Complete authenticated browser QA for the Inquiry/Quotation flow (the local browser currently has no signed-in session and requires the user's account PIN).

**Constraints:**
- No destructive table merge; preserve `inquiries` and `quotations` for audit, approvals, PDF output, and order links.
- No production dependency or external deployment.
- Additive database migration only after backup and explicit confirmation if schema changes are required.
- Keep each implementation batch to no more than three files.
