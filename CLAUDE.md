# CLAUDE.md — Formula Copy

## Project overview

Chrome Extension (Manifest V3) that intercepts copy events on KaTeX/MathJax pages
and replaces clipboard content with clean LaTeX source code. Built for copying
math from ChatGPT into note-taking apps like Obsidian.

## Branch strategy

- `main` — development: full project with tests, docs, build scripts
- `release` — packaging: only extension files, no dev dependencies
- Dev on `main`, merge to `release` when ready to package. Run `rm -rf node_modules/ package.json package-lock.json test.js scripts/ .gitignore docs/` on release after merge.

## Key files

| File | Purpose |
|---|---|
| `content.js` | Copy interception, LaTeX extraction, clipboard write (dual MIME) |
| `background.js` | Icon state (green/grey), whitelist sync, tab URL detection |
| `popup.html / .js` | Domain whitelist manager with language switcher |
| `manifest.json` | Permissions, content scripts, action config |
| `test.js` | 15 integration tests with jsdom + inline mock DOM fixtures |
| `scripts/generate-icons.js` | PNG icon generation from SVG template via sharp |

## Architecture decisions

1. **LaTeX pre-extraction from original DOM**: `range.cloneContents()` truncates
   `.katex-mathml` (which precedes `.katex-html` in DOM order) when the selection
   starts or ends inside a formula. We must extract annotations from the original
   DOM before cloning. See `findKatexInRange()` + `extractLatex()`.

2. **Dual MIME clipboard**: Write both `text/html` (via XMLSerializer) and
   `text/plain` (via textContent) so that Obsidian can still convert HTML tables
   to Markdown while getting LaTeX formulas.

3. **Domain whitelist via storage**: Whitelist stored in `chrome.storage.local`,
   read by both content script (to gate copy interception) and background script
   (to set icon state). Changes sync instantly via `chrome.storage.onChanged`.

4. **PNG over SVG icons**: Chrome's sandbox can't decode SVG fonts/gradients
   for `chrome.action.setIcon()`. Raster PNGs generated via sharp.

5. **tabs permission for reliable icon state**: `chrome.tabs.onUpdated` fires
   multiple times per navigation (url → loading → complete). Reading `tab.url`
   directly is the only race-free approach.

## i18n

- Popup language switcher: inline message objects in `popup.js` (8 locales),
  preference stored in `chrome.storage.local`
- Manifest strings: `_locales/` directory for Chrome Web Store listing
- Toast text in content.js follows the same locale preference

## Testing

```bash
npm install
npm test
```

15 self-contained tests using jsdom with inline mock KaTeX DOM fixtures.
No external files required. Covers: single formula, mixed text, table
preservation, bold formatting, selection edge cases.

## Packaging

```bash
git checkout release
git merge main --no-edit
rm -rf node_modules/ package.json package-lock.json test.js scripts/ .gitignore docs/ tmp-*
git add -A && git commit -m "release: sync main"
git archive -o ../formula-copy-v1.0.0.zip HEAD
```

## Naming conventions

- Functions: `camelCase` for helpers, descriptive names
- Constants: `UPPER_SNAKE_CASE` for config values
- Var declarations: `var` (ES5-compatible, no transpilation for service worker)
- No arrow functions in service worker or content script (Chrome compatibility)
