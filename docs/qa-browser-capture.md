# QA 浏览器截图管线（Runbook）

**用途**：本机无法用桌面窗口直接截图（`browser.screenshot` 不可用）时，用 html2canvas 静态克隆管线为 CRM 界面变更产出 QA 截图证据。
**边界**：只允许对匿名 QA 实例操作（`127.0.0.1:3105`），禁止指向真实 `crm.db`。QA 实例内允许必要的播种数据（示例公司/联系人/任务），截图前先确认地址。

---

## 1. 匿名 QA 实例

在项目根目录（需已 `npm run build` 产出 `dist/` 与 `dist-server/`）：

```bash
NODE_ENV=production PORT=3105 CRM_DB_PATH=/private/var/folders/w4/fcn94_1j65s4w0_996bb3r6h0000gn/T/crm-design-qa/qa.db node dist-server/index.js
```

- 该实例同时托管前端 `dist/`（SPA 回退）与 `/api`。
- 数据库为匿名 QA 数据（2026-10-17 播种：5 家公司；MedTech 4 联系人/4 任务/1 报价；各公司若干活动）。
- 登录（一次性，token 存 `localStorage`）：

```js
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Design QA', pin: '271828' }),
});
const data = await res.json();
localStorage.setItem('crm-token', data.token);
```

- 语言键 `crm-language`（`'en'` / `'zh'`）。
- 停止：`kill $(lsof -ti :3105)`（QA 数据库文件保留，重启后数据仍在）。

## 2. 截图管线

### 2.1 准备

```bash
cp /private/var/folders/w4/fcn94_1j65s4w0_996bb3r6h0000gn/T/opencode/package/dist/html2canvas.min.js <项目>/dist/html2canvas.min.js
```

> html2canvas 源取自 opencode 会话临时目录的浏览器工具包（`…/T/opencode/package/dist/`）；若不存在，可在任意临时目录 `npm i html2canvas` 后取 `node_modules/html2canvas/dist/html2canvas.min.js`。
> `npm run build` 会清空 `dist/`——**每次构建后需重新拷贝**，截图完成后删除 `dist/html2canvas.min.js` 以保持 dist 与构建产物一致。

### 2.2 注入脚本（在目标页面上下文执行）

等待页面关键文本渲染完成后（可用 browser wait 等一个已知文本出现，再 settle 约 600ms），注入以下脚本：把**已渲染 DOM 的静态副本**（剔除 `<script>`）写入隐藏 iframe，再对副本执行 html2canvas 渲染并以 `a.download` 下载。

```js
// NAME / W 按需修改：W = 1512（桌面）/ 390（移动）
(async () => {
  const NAME = 'companies-1512.png';
  const W = 1512;
  if (!window.html2canvas) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/html2canvas.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('h2c-load-fail'));
      document.head.appendChild(s);
    });
  }
  const old = document.getElementById('__shot_frame');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = '__shot_frame';
  iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:900px;border:0;`;
  document.body.appendChild(iframe);
  const html = '<!DOCTYPE html>' + document.documentElement.outerHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
  const idoc = iframe.contentDocument;
  idoc.open(); idoc.write(html); idoc.close();
  // 克隆内禁用动画：否则 slideIn 面板与部分图标停留在动画初始帧（不可见）
  const st = idoc.createElement('style');
  st.textContent = '*{animation:none !important;transition:none !important;}';
  idoc.head.appendChild(st);
  // 含块级子元素（div）的 <button> 在 html2canvas 中内容不渲染 → 换成 <div> 保留内容
  idoc.querySelectorAll('button').forEach(function (b) {
    if (b.querySelector('div')) {
      var d = idoc.createElement('div');
      d.className = b.className;
      if (b.getAttribute('aria-expanded') !== null) d.setAttribute('aria-expanded', b.getAttribute('aria-expanded'));
      d.innerHTML = b.innerHTML;
      b.parentNode.replaceChild(d, b);
    }
  });
  try { await idoc.fonts.ready; } catch (e) {}
  await new Promise(r => setTimeout(r, 600));
  const h = Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 900);
  iframe.style.height = h + 'px';
  await new Promise(r => setTimeout(r, 400));
  let bg = getComputedStyle(idoc.body).backgroundColor;
  if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') bg = '#ffffff';
  const canvas = await window.html2canvas(idoc.body, {
    windowWidth: W, windowHeight: h, width: W, height: h,
    scale: 2, backgroundColor: bg, useCORS: true, logging: false,
  });
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = NAME;
  document.body.appendChild(a);
  a.click();
  await new Promise(r => setTimeout(r, 700));
  a.remove();
  iframe.remove();
  return 'shot:' + NAME + ':' + canvas.width + 'x' + canvas.height;
})()
```

### 2.3 取件与归档

1. 轮询下载列表（约每 2s）：`browser.files.list` → 找到 name 匹配且 `state === 'completed'` 的条目 → `browser.files.get` 取服务器本地 `path`。
   下载落盘目录形如 `…/T/opencode-browser-*/0/`，是 `…/T/opencode` 的**兄弟目录**（不在其内部）。
2. 归档到截图目录：`…/T/opencode/final/`。
3. 命名约定：`<页面>-<变体>-<宽度>.png`（宽度 390 / 1512）；重拍同名覆盖。

### 2.4 清理

```bash
rm <项目>/dist/html2canvas.min.js
```

## 3. 已知伪影（非缺陷）

- 原生 `<select>` 克隆后显示第一项文本（如 "All statuses"），不代表真实选中值。
- 链接下划线会穿透文字渲染。
- 深色模式未在此管线核验（仅亮色主题截图）。
- 侧滑面板（`animate-[slideIn]`）与部分入场图标在克隆中会停留在动画初始帧而不可见——注入脚本已内置 `animation:none`（§2.2）。
- 含块级 `<div>` 子元素的按钮（如库存页展开分组头）在 html2canvas 中内容空白（克隆 DOM 检查文字/颜色/位置均正常）——注入脚本已内置「按钮换 div」workaround。
- 500 字重的小号文本（如库存行 SKU、流水表 SKU 列）在克隆渲染中顶部约 1px 被截断。真实 DOM 实测无裁切（元素 rect 在容器 padding 内、`overflow` 非 hidden），为 html2canvas 栅格化伪影，不要据此改 UI。
- 同类伪影在移动端窄幅截图中更明显（小号文本中段出现横向切片、个别笔画缺失，如「TLG-0001」显示为「TI G-0001」），仍为栅格化伪影；文本问题一律以真实 DOM 实测为准。
- `<img>` 引用的 SVG 若无显式 `width`/`height` 属性（仅 viewBox），html2canvas 无法栅格化——图标在截图中整块缺失（真实 DOM 正常显示）。修法：给 SVG 根元素补显式尺寸（如 `width="504" height="504"`），CSS 显示尺寸不受影响（2026-10-17 JEKIN 图标轮次实测）。
- ⚠️ 非伪影：库存流水表右侧留白/编号折行是真实 UI 状态（表格缺 `w-full`），不要当伪影过滤。

## 4. 参考

- 客户/联系人改版的截图证据与逐条验证记录：`docs/companies-redesign-review-2026-10-16.md` §七。
