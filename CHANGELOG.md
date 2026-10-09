# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-10-09

### Added

- Math delimiter button next to the popup's language button: click to switch
  between dollar signs (`$...$` / `$$...$$`)
  or parentheses and brackets (`\(...\)` / `\[...\]`). Dollar signs remain the
  default. The saved preference updates open pages immediately and applies to
  single formulas, mixed selections, and both clipboard formats.
- Localized delimiter button tooltips in all eight supported languages,
  preserving the popup's compact layout without extra footer messages.

### Changed

- Copy integration tests now run the actual content script instead of a
  duplicated copy implementation. Added 16 regression tests for delimiter
  output, live preference changes, defaults, and popup settings.

## [1.0.1] - 2026-08-14

### Fixed

- **Copy broke after ChatGPT changed its math rendering.** ChatGPT stopped
  emitting KaTeX's MathML tree — it switched KaTeX's `output` option from
  `htmlAndMathml` to `html` (a DOM-size/performance optimization) and moved
  the LaTeX source into a custom wrapper `<span role="math"
  data-math-source="…">` for accessibility and source-tracking. KaTeX itself
  is unchanged (still pinned at 0.16.0); only OpenAI's own client-side
  rendering layer changed. Because the extension looked only inside
  `.katex-mathml` / `<annotation>`, it found no LaTeX and copied formulas
  reverted to rendered HTML/Unicode. Formulas now copy as clean LaTeX again.
- **Backward compatibility preserved.** The old KaTeX markup (`annotation` /
  `.katex-mathml`) is still detected first, so pages using either the old or
  the new format keep working.

## [1.0.0] - 2026-06-30

### Added

- Intercept copy events on KaTeX/MathJax pages and replace the clipboard with
  clean LaTeX source code.
- Dual-MIME clipboard write (`text/html` + `text/plain`) so Obsidian can
  convert tables to Markdown while receiving LaTeX formulas.
- Domain whitelist — enable/disable the extension per site from the popup.
- In-app language switcher (8 locales) and localized store listing.
- Green/grey action icon reflecting whether the current site is enabled.
- Privacy policy page.

### Fixed

- PNG icons instead of SVG (Chrome's sandbox can't decode SVG fonts/gradients).
- `tabs` permission for race-free icon-state updates.
- Toast repositioned to top-center to avoid ChatGPT's own toast.
