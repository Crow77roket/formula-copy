# Formula Copy

Chrome 扩展 — 复制 KaTeX 渲染的数学公式，自动转换为干净的 LaTeX 源码。

[English](README.md)

## 安装

1. 打开 `chrome://extensions`，开启开发者模式
2. 加载已解压的扩展程序，选择本仓库目录
3. 打开 chatgpt.com，图标变绿即生效

## 使用

- 选中含公式的文字 **Ctrl+C**，粘贴得到 LaTeX（`$…$` / `$$…$$`）
- 点击工具栏图标在任意网站上启用或停用
- 绿色图标 = 当前网站生效，灰色 = 未生效

## 功能

- 单个公式、混合文字+公式、HTML 表格均正确处理
- 不含公式的纯文本不受影响
- 不干扰 ChatGPT 自带的代码块复制按钮
- 支持 8 种界面语言

## 原理

复制事件 → 原始 DOM 预提取 LaTeX → 替换克隆体中的 KaTeX → 双 MIME 写入剪贴板（text/html + text/plain）

## 测试

```bash
npm install
npm test
```
