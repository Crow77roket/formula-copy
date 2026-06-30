# Formula Copy

Chrome 扩展 — 在 ChatGPT 网页复制数学公式时，自动将 KaTeX 渲染结果转换为干净的 LaTeX 源码。

## 安装

1. 打开 `chrome://extensions`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本仓库目录
5. 打开 [chatgpt.com](https://chatgpt.com) 即可使用

## 功能

- **Ctrl+C** 复制含公式的文字，粘贴得到 LaTeX（`$…$` / `$$…$$`）
- HTML 表格结构保留在 `text/html` 中，粘贴到 Obsidian 时自动转为 Markdown 表格
- 不破坏普通文本复制（无公式时走原生行为）
- 不干扰 ChatGPT 自带的代码块复制按钮

## 原理

```
copy 事件 → 克隆选区 → 在原始 DOM 预提取 LaTeX → 替换克隆体中的 .katex
→ XMLSerializer 输出 text/html + textContent 输出 text/plain → 双 MIME 写入剪贴板
```

关键设计：LaTeX 提取**必须在原始 DOM 上进行**，因为 `range.cloneContents()` 截断范围时会把位于 `.katex-html` 之前的 `.katex-mathml`（含 annotation）丢弃。

## 运行测试

```bash
npm install
npm test
```

测试需要 `example/不定积分求解.html`（从 ChatGPT 网页另存为的对话样本）。`example/` 目录未纳入版本控制。
