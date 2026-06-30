# Formula Copy

Chrome 扩展 — 在网页复制数学公式时，自动将 KaTeX 渲染结果转换为干净的 LaTeX 源码。

## 安装

1. 打开 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择本仓库目录
4. 打开 [chatgpt.com](https://chatgpt.com)，图标变绿即生效

## 使用

- **Ctrl+C** 复制含公式的文字，粘贴得到 LaTeX（`$…$` / `$$…$$`）
- 点击工具栏图标打开 popup，在任意网站上**启用 / 停用**公式复制
- 默认白名单：`chatgpt.com`，其他域名按需添加
- 图标状态：**绿色** = 当前网站生效，**灰色** = 未生效

## 功能细节

- 单个公式选中 → `$\theta$` 或 `$$\int_0^1$$`
- 混合文字 + 公式 → 公式自动替换，普通文字保留
- HTML 表格 → 双 MIME 写入剪贴板（`text/html` + `text/plain`），粘贴到 Obsidian 时表格结构完整
- 无公式的选区 → 走原生复制，零影响
- 不干扰 ChatGPT 自带的代码块复制按钮

## 原理

```
copy 事件 → 克隆选区 → 原始 DOM 预提取 LaTeX → 替换克隆体中的 .katex
→ XMLSerializer 输出 text/html + textContent 输出 text/plain → 双 MIME 写入剪贴板
```

关键设计：LaTeX 提取**必须在原始 DOM 上进行**，因为 `range.cloneContents()` 截断范围时会把位于 `.katex-html` 之前的 `.katex-mathml`（含 annotation）丢弃。

## 运行测试

```bash
npm install
npm test
```

测试使用内置 mock DOM 结构，无需外部文件。覆盖场景：单公式选中、混合文字+公式、表格保留、加粗格式保留、选区边界截断等。

## 项目结构

```
manifest.json       Chrome Extension Manifest V3
content.js          copy 拦截 + LaTeX 提取 + 剪贴板写入
background.js       图标状态管理 + 白名单同步
popup.html / .js    域名白名单管理界面
icons/              PNG 图标（激活/未激活 × 3 尺寸）
test.js             15 个集成测试
scripts/            图标生成脚本
```
