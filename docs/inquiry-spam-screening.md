# 官网询盘防垃圾 · 筛查规则清单

**用途：** 处理 jekinpolymer.com 官网联系表单询盘前的统一筛查 SOP。
**目标：** 每条询盘 30 秒内判定「垃圾 / 待验证 / 真实」，统一处理动作，避免诈骗线索混入 CRM、避免浪费时间在无效询盘上。
**维护者：** Nathan ｜ 最后更新：2026-09

> 案例驱动来源：2026-09 官网收到 `hsilojhonaisy@gmail.com / Wallmart / StephensawGM / UHMWPE` 询盘，
> 经核实为在案黑名单垃圾邮箱 + 仿冒 Walmart 公司名 + 用户名式假名，判定疑似诈骗（见附录 B）。

---

## 一、表单入口拦截（网站层，一劳永逸）

按优先级从易到难，逐项确认是否已启用：

- [ ] **反垃圾插件**：WordPress 启用 CleanTalk 或 Akismet（本案例邮箱已在 CleanTalk 黑名单，启用后自动拦截）。
- [ ] **Honeypot 隐藏字段**：人类看不见不会填，机器人会填 → 命中即丢弃。
- [ ] **reCAPTCHA v3**（无感评分，不伤害真实客户转化）；条件不允许时用 v2 checkbox。
- [ ] **时间戳检查**：表单打开到提交 < 3 秒 = 机器人。
- [ ] **「大牌公司名 + 个人免费邮箱」规则**：Company 字段命中附录 A 词表、Email 为 gmail/outlook 等免费域名 → 直接进垃圾箱（注意小公司用 gmail 很正常，见 §二二次判定，勿一刀切）。
- [ ] **代理/机房 IP 段封锁**（可选，Wordfence / CleanTalk 均可做）：命中附录 B 所述 IP 段的提交直接拒绝。
- [ ] **保留原始数据**：表单邮件通知/记录里必须包含提交 **IP + User-Agent + 完整正文**——这是后续核实的唯一现场证据。

---

## 二、30 秒人工筛查清单（每条询盘必过）

### 红灯项（命中越多越可疑，≥2 条即判垃圾，无需回复）

- [ ] 邮箱是个人免费邮箱（gmail/yahoo/hotmail/outlook/qq/163…），但公司填的是知名企业。
- [ ] 公司名是**知名品牌的错拼/仿冒**（Wallmart、Wal-Mart、Walmark…），或全网搜不到该公司官网与任何真实业务。
- [ ] 姓名格式异常：无姓无名、用户名式（`StephensawGM`、`Robertkax` 类）、带乱码数字。
- [ ] 正文空泛：只有材料关键词（UHMWPE / PEEK / PVDF…），无规格、无数量、无应用场景；或整段复制粘贴、与产品无关。
- [ ] 零背景信息：不写国家、用途、电话，只留一个邮箱。
- [ ] IP/UA 异常：代理/机房 IP、UA 为 curl / python-requests 等脚本特征（查表单记录）。

### 绿灯加分项（真实客户特征，越多越像真人）

- [ ] 公司域名邮箱，域名能打开，公司行业与询盘相关。
- [ ] 正文具体：有牌号、形状（板/棒/管/异形件）、尺寸、数量、应用场景（如「食品输送线 UHMWPE 衬板 500×1000×15mm，200 件」）。
- [ ] 提到网站具体产品或页面内容 → 说明真的浏览过。
- [ ] 国家/时区与 IP 一致，写明询价或收货国家。

### 灰区

- 信息少但**无红灯**：不判死，进入「先验证再开发」流程（§三-B），用 `buyer-background-check` skill 查公司/域名后再决定。

---

## 三、处理动作分级（SOP）

| 级别 | 判定 | 动作 |
|---|---|---|
| **A 真实** | 明显真实买家 | 正常录入 CRM，48h 内回复 |
| **B 待验证** | 无红灯但信息不足 | 先背调（查域名/公司/IP）→ 有据再开发，不得直接报价 |
| **C 垃圾** | 2–4 条红灯，无攻击特征 | 不回复；CRM 公司标记 `Blacklisted` 或备注 spam，防止重复建单 |
| **D 疑似诈骗** | 黑名单命中 / 攻击特征（刷表单、暴力尝试、假名+代理 IP） | **不回信**（回复=确认活邮箱，招来钓鱼/假 PO 骗货）；防火墙拉黑 IP；登记证据 |

对 **C/D 一律**：不回复、不报价、不点附件、不点链接、不加 WhatsApp/Telegram。

---

## 四、CRM 登记规范

- 询盘 `source` 字段：官网表单来的记 `website`，便于日后统计垃圾占比。
- 判 C/D：公司 `status` 置 `Blacklisted`（或 `Dormant`），`notes` 写清证据链接与判定日期。
- 判 A/B：正常建档，询盘 `status = open / under_review`。
- **先查库再建单**：同一邮箱/公司/IP 再次出现时，先按邮箱/公司名搜索 CRM，避免重复建档污染数据。

---

## 五、定期维护（建议每月一次，季度全面复查）

- [ ] 复查被拦截名单的**误杀率**：被拒请求中是否有正常询价 → 及时放行并调整规则。
- [ ] 更新附录 A 错拼词表与免费邮箱判断逻辑。
- [ ] 看垃圾趋势：垃圾占比、来源 IP 段、邮箱域名分布 → 决定是否升级规则。
- [ ] 抽查 CRM 中 `Blacklisted` 记录是否被误标，可恢复。

---

## 附录 A：红灯快速参考表（可做成拦截词）

**大牌错拼/仿冒（常见被冒用对象）**
- Walmart → Wallmart / Wal-Mart / Walmark / Walmarts
- Amazon → Amazone / Amzon / 仿冒二级域
- 其他常被冒用：Apple、Microsoft、Samsung、Siemens、BASF、Dow、Shell、车企与大型零售商
- 通用特征：改一个字母、加/减字母、大小写混排的品牌名

**免费邮箱域名（单凭此条不判死）**
`gmail.com` `yahoo.com` `hotmail.com` `outlook.com` `aol.com` `qq.com` `163.com` `126.com`
（小公司老板、独立工程师用 gmail 很常见，必须与公司名/正文交叉判断）

**用户名式假名模式**
- `Robert + 随机字母`（StopForumSpam 本案例 98 条举报全是 RobertXxx 轮换）
- 数字串、游戏 ID 式、与正文无关的单词拼接

---

## 附录 B：本次案例存档（2026-09）

| 字段 | 值 | 判定信号 |
|---|---|---|
| 邮箱 | hsilojhonaisy@gmail.com | [CleanTalk 黑名单](https://cleantalk.org/blacklists/hsilojhonaisy@gmail.com)（2026-08-28 暴力尝试+假名 Robertmex；2026-08-31 联系表单反复灌垃圾）；[StopForumSpam 98 条记录](https://www.stopforumspam.com/search?q=hsilojhonaisy%40gmail.com)（2026-09-01~04，IP 段 77.90.185.x / 141.98.11.x / 80.94.95.x，用户名 Robert* 轮换） |
| 公司 | Wallmart | Walmart 错拼仿冒；真实 Walmart 采购走企业供应商门户 + @walmart.com，绝不用个人 Gmail 在官网表单询价 |
| 姓名 | StephensawGM | 用户名式，全网无职业身份 |
| 需求 | UHMWPE | 只有材料词，无规格/数量/应用 |

**结论：** D 类疑似诈骗（自动化垃圾农场刷表单）→ 不回信、拉黑登记、表单层加拦截。
**背景佐证：** [Malwarebytes 2026-07：120 个仿冒 Walmart 假网店](https://www.malwarebytes.com/blog/scams/2026/07/we-found-120-fake-walmart-stores-trying-to-steal-your-credit-card)、[Walmart 订单邮件诈骗](https://www.pcrisk.com/removal-guides/26354-walmart-order-email-scam) —— 冒用大牌名是当前活跃诈骗手法。
