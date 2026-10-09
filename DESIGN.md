---
version: alpha
name: Formula Copy
description: A compact Chrome extension popup for copying math into note editors.
colors:
  primary: "#10a37f"
  focus: "#0e8c6e"
  background: "#ffffff"
  surface: "#f3f4f6"
  text: "#1a1a2e"
  secondary: "#6b7280"
  border: "#d1d5db"
typography:
  sans:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
  mono:
    fontFamily: "Consolas, monospace"
rounded:
  DEFAULT: "5px"
  card: "8px"
spacing:
  page: "14px"
  section: "10px"
components:
  delimiterButton:
    ownership: native
---

# Formula Copy Design System

## Overview

The reference is the existing extension toolbar popup: a small utility panel
with a green activation indicator, domain list, and monospace math examples.
Keep this product register and compact density; avoid marketing layouts,
decorative imagery, and new font downloads for a settings change.

Audience and task come from README.md and the delimiter feature request:
desktop Chrome users copying formulas to Markdown editors. This is a global
utility with eight locales, including Japanese; no Japan-specific business
rules or regulated data are involved. Japanese labels use concise nouns and
polite status/error sentences. The system font supplies localized glyphs.

Runtime ownership: popup.html's stylesheet is the canonical token source;
this document records its established values. No generated theme adapter or
shared component library exists. popup.js owns localized settings text and
local storage behavior. Compare token values here against that stylesheet
when changing the popup. The language and whitelist settings are sibling
workflows; delimiter changes use the same local storage convention.

## Colors

White background, pale grey site card, dark text, and green enabled state.
The focus outline uses the darker green. Scrollbars use grey thumbs on pale grey tracks; forced colors
delegate to the operating system. Only the existing light theme is supported.

## Typography

System sans for UI, monospace for domains and delimiter examples. The existing
260px toolbar popup uses 11–14px text as a bounded desktop utility surface.
Localized prose uses 1.5 line height and wraps naturally; avoid forced breaks,
italics, or letter spacing for Japanese and other non-Latin scripts.

## Layout

Keep the 260px panel, 14px main inset, and 10px section gaps. The delimiter button
sits beside the language button in the header and remains available on disabled
sites because the preference applies globally. Both buttons share .header-btn
styling; the delimiter button reserves 38px to keep both symbols stable.
There is no footer feedback or extra status space; preserve the original popup height.
The existing list remains scrollable with a stable scrollbar gutter.

## Elevation & Depth

Use tonal surfaces and a thin separator. No new shadows or overlays.

## Shapes

Retain the existing 8px site card and 5px control radius.

## Components

- Delimiter toggle owner: native button in popup.html, sharing the language
  button's styling. Click, Enter, or Space cycles between the two styles. The
  visible symbol shows the saved style; localized tooltip and accessible name
  include complete examples and global scope.
- Form/preference owner: saveDelimiterStyle in popup.js. Load before enabling
  the button, disable during writes, preserve
  the saved style on failure, and allow retry by clicking again. Restore keyboard
  focus after saving when disabling the button moved focus to the document body.
- Scrollbar owner: popup.html's global html scrollbar baseline. No hidden bars.
- Locale owner: MSG and t() in popup.js; set document language to the active locale.
- Defaults: dollar delimiters for missing or invalid storage values. The saved
  global choice updates content scripts via chrome.storage.onChanged.

No new animation is introduced. Visible keyboard focus is mandatory. Formula
examples use literal punctuation, independent of language. Verification lives
in test.js and covers the actual popup/content scripts and storage failures.

## Do's and Don'ts

- Do preserve the site's HTML formatting and both clipboard formats.
- Do keep delimiter examples visible so users can recognize the output.
- Don't add a separate save button to this immediate preference.
- Don't redesign the whitelist or language workflow for this feature.
