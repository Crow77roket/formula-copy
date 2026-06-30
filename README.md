# Formula Copy

Chrome extension — copy KaTeX-rendered math formulas as clean LaTeX source code.

[中文](docs/README_zh_CN.md) · [日本語](docs/README_ja.md) · [한국어](docs/README_ko.md) · [Français](docs/README_fr.md) · [Deutsch](docs/README_de.md) · [Español](docs/README_es.md) · [Русский](docs/README_ru.md)

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory
4. Open [chatgpt.com](https://chatgpt.com) — the icon turns green when active

## Usage

- **Ctrl+C** to copy text with formulas, paste to get LaTeX (`$…$` / `$$…$$`)
- Click the toolbar icon to **enable / disable** on any website
- Default whitelist: `chatgpt.com`, add others as needed
- Icon: **green** = active on current site, **grey** = inactive

## Features

- Single formula → `$\theta$` or `$$\int_0^1$$`
- Mixed text + formulas → formulas replaced, plain text preserved
- HTML tables → dual MIME clipboard (`text/html` + `text/plain`), paste into Obsidian yields Markdown tables
- Plain text without formulas → native copy, zero interference
- Does not interfere with ChatGPT's built-in code-block copy button

## How it works

```
copy event → clone selection → pre-extract LaTeX from original DOM
→ replace .katex in clone → XMLSerializer for text/html
→ textContent for text/plain → dual MIME clipboard write
```

Key insight: LaTeX extraction **must** happen on the original DOM, because `range.cloneContents()` truncates `.katex-mathml` (which contains the annotation) when the selection boundary cuts through a formula.

## Tests

```bash
npm install
npm test
```

Self-contained mock DOM fixtures — no external files needed. 15 tests cover single formula, mixed text, tables, bold formatting, edge cases.

## Structure

```
manifest.json       Chrome Extension Manifest V3
content.js          copy interception + LaTeX extraction + clipboard write
background.js       icon state + whitelist sync
popup.html / .js    domain whitelist manager
icons/              PNG icons (active/inactive × 3 sizes)
test.js             15 integration tests
scripts/            icon generation script
```
