# JEKIN CRM 上线部署手册（海外 ECS + crm.jekinpolymer.com）

**适用服务器**：阿里云海外 ECS `47.82.158.162` —— Alibaba Cloud Linux 3，宝塔面板统管 nginx（WordPress 官网同机运行）。
**部署架构**：Mac 本地构建 → rsync 上传 `/opt/jekin-crm` → systemd 守护 Node（仅监听 `127.0.0.1:3001`）→ 宝塔反代 + Let's Encrypt。
**原则**：不动 WordPress 配置；不动宝塔的 nginx 主配置；每步执行后先验证再继续；凭证不进仓库。

**已确认的服务器事实**（2026-10-17 采集）：
- 无 Node（需安装）；nginx 由宝塔管理（`/www/server/panel/vhost/`）；无 certbot（证书走宝塔 SSL 功能，已为官网签发 LE 证书）
- SELinux 已关闭；firewalld 未运行（出入流量由阿里云安全组控制）
- sqlite3 已装（备份脚本可用）；rsync、git 未装（git 不需要；rsync 需要装）
- 官网证书为 Let's Encrypt；`www.jekinpolymer.com` → `47.82.158.162`；海外机房，无需备案

---

## 0 · 一次性准备

### 0.1 Mac → 服务器 SSH 授权（在服务器上以 admin 执行）
把 Mac 的公钥加入服务器（公钥全文在对话里给出，或以 `~/.ssh/*.pub` 内容为准）：

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
grep -q "$(echo '<MAC_SSH_PUBKEY>' | awk '{print $2}')" ~/.ssh/authorized_keys 2>/dev/null \
  || echo '<MAC_SSH_PUBKEY>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Mac 侧验证（本地执行）：
```bash
ssh -o ConnectTimeout=8 admin@47.82.158.162 'echo ssh-ok'
```
> 若超时：检查阿里云安全组 22 端口是否对本机出口 IP 放行（此前登录来源是控制台代理 IP，可能不在放行名单）。

### 0.2 服务器安装 rsync
```bash
sudo dnf install -y rsync
rsync --version | head -1
```

---

## 1 · 安装 Node 22（服务器）
系统级安装（不用 nvm——nvm 装在用户家目录，systemd 服务读不到）：

```bash
cd /tmp
curl -fLO https://mirrors.aliyun.com/nodejs-release/v22.23.3/node-v22.23.3-linux-x64.tar.xz
sudo tar -xJf node-v22.23.3-linux-x64.tar.xz -C /usr/local --strip-components=1
node -v    # 应输出 v22.23.3
npm -v
rm -f node-v22.23.3-linux-x64.tar.xz
```

> 装完顺手确认属主：`ls -l /usr/local/bin/node` 应为 root。tar 解包会保留原包 uid（本服务器实测映射为 www，存在被 WP 入侵提权的隐患），非 root 时执行：`sudo chown root:root /usr/local/bin/node && sudo chown -R root:root /usr/local/lib/node_modules && [ -d /usr/local/include/node ] && sudo chown -R root:root /usr/local/include/node`

## 2 · 部署应用（Mac 构建上传 + 服务器装依赖）

服务器先建目录：
```bash
sudo mkdir -p /opt/jekin-crm && sudo chown admin:admin /opt/jekin-crm
```

Mac 执行（构建 + 上传 + 远程安装生产依赖，脚本幂等，以后更新同一条）：
```bash
cd ~/AIProjects/engineering-plastics-crm
bash scripts/deploy-crm-to-server.sh
```

> 若服务器上 better-sqlite3 预编译下载失败（极少见）：
> ```bash
> sudo dnf install -y gcc-c++ make python3 && cd /opt/jekin-crm && npm rebuild better-sqlite3
> ```

## 3 · 迁移本地数据库（已确认迁移）

Mac（先停本地 dev server，避免写入；QA 实例 3105 不受影响）：
```bash
cd ~/AIProjects/engineering-plastics-crm
lsof -ti :3001 | xargs kill 2>/dev/null || true
sqlite3 crm.db "PRAGMA wal_checkpoint(TRUNCATE);"     # 合并 WAL，保证一致快照
rsync -avz crm.db admin@47.82.158.162:/opt/jekin-crm/crm.db
```

服务器验证（行数应与本地一致）：
```bash
sqlite3 /opt/jekin-crm/crm.db "SELECT count(*) FROM users; SELECT count(*) FROM companies;"
```

## 4 · 环境变量（服务器本地生成，不进仓库）

```bash
cd /opt/jekin-crm
umask 077
cat > .env <<EOF
PORT=3001
CRM_DB_PATH=/opt/jekin-crm/crm.db
JWT_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env
```

## 5 · 首次手动启动（验证再守护）

```bash
cd /opt/jekin-crm
NODE_ENV=production node dist-server/index.js
```
另开终端（或 Ctrl+C 前）：
```bash
curl -s http://127.0.0.1:3001/api/health    # {"status":"ok",...}
```
确认 OK 后 Ctrl+C。

## 6 · systemd 守护（服务器）

```bash
sudo cp /opt/jekin-crm/scripts/jekin-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now jekin-crm
systemctl status jekin-crm --no-pager | head -12
curl -s http://127.0.0.1:3001/api/health
```

## 7 · DNS（阿里云域名控制台）

新增 A 记录：主机记录 `crm`，记录值 `47.82.158.162`，TTL 默认。
验证（Mac 或服务器）：
```bash
dig +short crm.jekinpolymer.com     # 应返回 47.82.158.162
```

## 8 · 宝塔面板：反向代理项目 + SSL

> 顺序：DNS 生效后再申请证书（宝塔 LE 走 HTTP-01 校验）。
> 本服务器该版本的「反向代理」是独立项目类型（网站 →「反向代理」标签直接建反代站点）。不要先在「PHP项目」建普通站点再转反代——会报「网站已存在」；如已误建，删掉空站再走本流程。

1.「网站」→「反向代理」标签 →「添加反代」：
   - 域名：`crm.jekinpolymer.com`
   - 目标：URL地址 `http://127.0.0.1:3001`
   - 发送域名(host)：默认 `$http_host`；备注随意
2. 验证 HTTP 链路与真实 IP 透传头：
   ```bash
   curl -s http://crm.jekinpolymer.com/api/health        # {"status":"ok",...}
   sudo grep -E "X-Forwarded-For|X-Real-IP" /www/server/panel/vhost/nginx/crm.jekinpolymer.com.conf
   ```
   预期含 `X-Forwarded-For $proxy_add_x_forwarded_for`（宝塔模板默认带）。
3. 反代项目 →「设置」→「SSL」→「Let's Encrypt」→ 勾选域名申请 → 成功后打开「强制 HTTPS」。
4. 验证：浏览器打开 `https://crm.jekinpolymer.com` → JEKIN CRM 登录页；`http://` 应 301 跳转 HTTPS。

> 登录限流：应用已内置（用户名 + IP 双维度失败限流，5 次失败 / 15 分钟；IP 维度经 X-Forwarded-For 最后一跳解析真实客户端地址）。v1 不叠 Nginx 限流，减少面板配置改动面。

## 9 · 每日备份（服务器）

先手动跑一次：
```bash
bash /opt/jekin-crm/scripts/backup-crm.sh
ls -lh /opt/jekin-crm/backups/ | tail -3
```
然后 `crontab -e` 加一行：
```
0 3 * * * /opt/jekin-crm/scripts/backup-crm.sh >> /opt/jekin-crm/backups/backup.log 2>&1
```
（备份 = sqlite3 一致性快照 tar.gz + sha256 校验，存 `/opt/jekin-crm/backups/`）

## 10 · 验收清单

- [ ] `systemctl is-active jekin-crm` → `active`
- [ ] `curl -s http://127.0.0.1:3001/api/health` → `{"status":"ok"}`
- [ ] `https://crm.jekinpolymer.com` 登录页正常（中文默认、HTTPS 锁标）
- [ ] 你的账号 + PIN 可登录（数据迁移自本地库）
- [ ] 全部 12 个页面抽查无报错、浏览器控制台零错误
- [ ] 报价单 PDF / 工装单 PDF 公司名正确（JEKIN HPM (Jiangsu) Co., Ltd）
- [ ] 手机蜂窝网络可访问（外贸同事场景）
- [ ] 备份文件生成成功
- [ ] （可选）`sudo reboot` 后服务自动恢复

## 11 · 日常更新（以后改了代码）

```bash
# Mac：
bash scripts/deploy-crm-to-server.sh
# 服务器：
ssh admin@47.82.158.162 'sudo systemctl restart jekin-crm'
```

## 12 · 回滚

```bash
# 停 CRM（WordPress 官网不受影响）：
sudo systemctl stop jekin-crm
# 宝塔中把 crm.jekinpolymer.com 站点「停用」；DNS 可不动。
# 本地环境继续可用作备用。
```
