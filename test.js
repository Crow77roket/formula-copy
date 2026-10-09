/**
 * Test harness for Formula Copy content script.
 * Uses inline mock DOM fixtures — no external files required.
 *
 *   npm install && npm test
 */

const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const CONTENT_SCRIPT = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const POPUP_SCRIPT = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');
const POPUP_HTML = fs.readFileSync(path.join(__dirname, 'popup.html'), 'utf8');

// ---------------------------------------------------------------------------
// Mock fixtures — miniature ChatGPT DOM snippets
// ---------------------------------------------------------------------------

/** A single display (block) formula:  \sin2x = t^2 - 1 */
const DISPLAY_FORMULA = `
<span class="katex-display">
  <span class="katex">
    <span class="katex-mathml">
      <math><semantics>
        <mrow><mi>sin</mi><mo>⁡</mo><mn>2</mn><mi>x</mi><mo>=</mo><msup><mi>t</mi><mn>2</mn></msup><mo>−</mo><mn>1</mn></mrow>
        <annotation encoding="application/x-tex">\\sin2x=t^2-1</annotation>
      </semantics></math>
    </span>
    <span class="katex-html" aria-hidden="true">
      <span class="base"><span class="mop">sin</span><span class="mord">2</span><span class="mord mathnormal">x</span><span class="mrel">=</span><span class="mord"><span class="mord mathnormal">t</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist"><span class="pstrut">2</span></span></span></span></span></span><span class="mbin">−</span><span class="mord">1</span></span>
    </span>
  </span>
</span>`;

/** An inline formula:  \theta */
const INLINE_FORMULA = `
<span class="katex">
  <span class="katex-mathml">
    <math><semantics>
      <mrow><mi>θ</mi></mrow>
      <annotation encoding="application/x-tex">\\theta</annotation>
    </semantics></math>
  </span>
  <span class="katex-html" aria-hidden="true">
    <span class="base"><span class="mord mathnormal">θ</span></span>
  </span>
</span>`;

/**
 * ChatGPT's newer markup (2026): no .katex-mathml / <annotation>. LaTeX is
 * on a wrapper <span role="math" data-math-source="…"> around .katex.
 */
const NEW_INLINE_FORMULA = `
<span data-start="12" data-end="19" role="math" aria-label="y=0" data-math-source="y=0" data-client-katex-layout="">
  <span class="katex">
    <span class="katex-html" aria-hidden="true">
      <span class="base"><span class="mord mathnormal">y</span><span class="mrel">=</span><span class="mord">0</span></span>
    </span>
  </span>
</span>`;

/** Display formula in the newer markup (block math, style="display: block;") */
const NEW_DISPLAY_FORMULA = `
<span data-start="295" data-end="339" role="math" aria-label="\\frac{dy}{dx}=y" data-math-source="\\frac{dy}{dx}=y" data-client-katex-layout="" style="display: block;">
  <span class="katex-display">
    <span class="katex">
      <span class="katex-html" aria-hidden="true">
        <span class="base"><span class="mord"><span class="mfrac"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist">d</span></span></span></span></span></span>
      </span>
    </span>
  </span>
</span>`;

/** A table with KaTeX formulas in header and body cells */
const TABLE_WITH_FORMULAS = `
<table>
  <thead>
    <tr>
      <th>${INLINE_FORMULA} range</th>
      <th>Recovery formula</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${DISPLAY_FORMULA}</td>
      <td>${INLINE_FORMULA}</td>
    </tr>
    <tr>
      <td>plain cell</td>
      <td>${DISPLAY_FORMULA}</td>
    </tr>
  </tbody>
</table>`;

/** A paragraph mixing Chinese text, bold, and inline formulas */
const MIXED_PARAGRAPH = `
<p>
  The function we need is ${INLINE_FORMULA}, <strong>not</strong> ${INLINE_FORMULA}.
  Consider the range of ${INLINE_FORMULA}, let
</p>
${DISPLAY_FORMULA}
<p>Therefore we can derive the final result.</p>`;

/** A paragraph with only plain text (no formulas) */
const PLAIN_PARAGRAPH = `<p>This is a <strong>plain</strong> paragraph with no formulas.</p>`;

// ---------------------------------------------------------------------------
// Test document builder
// ---------------------------------------------------------------------------

function buildDoc(bodyHtml) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' + bodyHtml + '</body></html>',
    { runScripts: 'outside-only', url: 'https://chatgpt.com/' }
  );
  return {
    doc: dom.window.document,
    XMLSerializer: dom.window.XMLSerializer
  };
}

// ---------------------------------------------------------------------------
// Isolated extraction/range helper checks; copy tests run the actual script.
// ---------------------------------------------------------------------------

function makeHelpers(doc) {
  const KATEX_CLASS = 'katex';

  function extractLatex(el) {
    const ann = el.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent) return ann.textContent.trim();

    const mathEl = el.querySelector('math[data-math]');
    if (mathEl) {
      const dm = mathEl.getAttribute('data-math');
      if (dm) return dm.trim();
    }

    const sem = el.querySelector('semantics');
    if (sem) {
      const a = sem.querySelector('annotation');
      if (a && a.textContent) return a.textContent.trim();
    }

    // Newer ChatGPT markup: LaTeX on a wrapper <span role="math" data-math-source="…">
    const wrapper = el.closest('[role="math"]');
    if (wrapper) {
      const src = wrapper.getAttribute('data-math-source') ||
                  wrapper.getAttribute('aria-label');
      if (src) return src.trim();
    }
    return null;
  }

  function findKatexInRange(range) {
    const result = [];
    let root = range.commonAncestorContainer;
    if (root.nodeType === 3) root = root.parentElement;
    if (!root || !root.querySelectorAll) return result;
    const all = root.querySelectorAll('.' + KATEX_CLASS);
    for (let i = 0; i < all.length; i++) {
      if (range.intersectsNode(all[i])) result.push(all[i]);
    }
    return result;
  }

  return { extractLatex, findKatexInRange };
}

// ---------------------------------------------------------------------------
// Run the real content script with Chrome storage and clipboard mocks.
// ---------------------------------------------------------------------------

const contentHarnesses = new WeakMap();
const DELIMITER_KEY = 'formula-copy-delimiter-style';

function contentHarness(doc, data = {}) {
  const win = doc.defaultView;
  let onChanged;
  win.chrome = {
    storage: {
      local: { get: (keys, callback) => callback(data) },
      onChanged: { addListener: (listener) => { onChanged = listener; } }
    }
  };
  // The toast does not need animation or timers in copy integration tests.
  win.requestAnimationFrame = () => {};
  win.eval(CONTENT_SCRIPT);
  const harness = {
    change: (changes, area = 'local') => onChanged(changes, area),
    copy: (range) => {
      const selection = win.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const clipboard = {};
      const event = new win.Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: { setData: (type, value) => { clipboard[type] = value; } }
      });
      doc.dispatchEvent(event);
      // Keep the original fixture unchanged between successive copies.
      doc.querySelectorAll('body > div').forEach((el) => {
        if (el.textContent === '✓ LaTeX') el.remove();
      });
      return event.defaultPrevented
        ? { html: clipboard['text/html'], text: clipboard['text/plain'] }
        : null;
    }
  };
  contentHarnesses.set(doc, harness);
  return harness;
}

function simulateCopy(doc, XMLSerializer, range) {
  const harness = contentHarnesses.get(doc) || contentHarness(doc);
  return harness.copy(range);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('        ' + e.message.split('\n')[0]);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertContains(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error((msg || 'expected to contain') +
      '\n        needle: ' + JSON.stringify(needle) +
      '\n        haystack: ' + JSON.stringify(haystack.substring(0, 200)));
  }
}

function assertNotContains(haystack, needle, msg) {
  if (haystack.includes(needle)) {
    throw new Error((msg || 'expected NOT to contain') +
      '\n        found: ' + JSON.stringify(needle));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('=== Formula Copy — Self-contained Tests ===\n');

// ---- 1. LaTeX extraction ---------------------------------------------------

test('extract display formula LaTeX', () => {
  const { doc } = buildDoc(DISPLAY_FORMULA);
  const { extractLatex } = makeHelpers(doc);
  const katex = doc.querySelector('.katex');
  assert(katex, '.katex not found');
  assert(extractLatex(katex) === '\\sin2x=t^2-1');
});

test('extract inline formula LaTeX', () => {
  const { doc } = buildDoc(INLINE_FORMULA);
  const { extractLatex } = makeHelpers(doc);
  assert(extractLatex(doc.querySelector('.katex')) === '\\theta');
});

test('extract from katex without annotation (fallback to semantics)', () => {
  const html = `
    <span class="katex">
      <span class="katex-mathml">
        <math><semantics>
          <mrow><mi>x</mi></mrow>
          <annotation>x</annotation>
        </semantics></math>
      </span>
    </span>`;
  const { doc } = buildDoc(html);
  const { extractLatex } = makeHelpers(doc);
  assert(extractLatex(doc.querySelector('.katex')) === 'x');
});

test('extract returns null for empty katex', () => {
  const html = '<span class="katex"></span>';
  const { doc } = buildDoc(html);
  const { extractLatex } = makeHelpers(doc);
  assert(extractLatex(doc.querySelector('.katex')) === null);
});

// ---- 2. Single formula selection -------------------------------------------

test('single display formula → $$...$$', () => {
  const { doc, XMLSerializer } = buildDoc(DISPLAY_FORMULA);
  const katex = doc.querySelector('.katex');
  const range = doc.createRange();
  range.selectNodeContents(katex);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assert(result.text.startsWith('$$'), 'should start with $$');
  assertContains(result.text, '\\sin2x=t^2-1');
});

test('single inline formula → $...$', () => {
  const { doc, XMLSerializer } = buildDoc(INLINE_FORMULA);
  const katex = doc.querySelector('.katex');
  const range = doc.createRange();
  range.selectNodeContents(katex);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assert(result.text === '$\\theta$');
});

// ---- 3. Mixed text + formulas ----------------------------------------------

test('mixed paragraph: inline formulas wrapped, text preserved', () => {
  const { doc, XMLSerializer } = buildDoc(MIXED_PARAGRAPH);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assertContains(result.text, '$\\theta$', 'should contain inline math');
  assertContains(result.text, '$$\n\\sin2x=t^2-1\n$$', 'should contain display math');
  assertContains(result.text, 'The function we need is', 'should preserve surrounding text');
});

test('plain text paragraph → not intercepted (returns null)', () => {
  const { doc, XMLSerializer } = buildDoc(PLAIN_PARAGRAPH);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result === null, 'should return null for non-math selection');
});

// ---- 4. Table preservation -------------------------------------------------

test('table with formulas → HTML preserves <table> structure', () => {
  const { doc, XMLSerializer } = buildDoc(TABLE_WITH_FORMULAS);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  // HTML must keep the table
  assertContains(result.html, '<table', 'HTML should contain <table>');
  assertContains(result.html, '<thead', 'HTML should contain <thead>');
  assertContains(result.html, '<td', 'HTML should contain <td>');
  // katex internals must be stripped
  assertNotContains(result.html, 'katex-mathml', 'HTML should NOT contain katex-mathml');
  assertNotContains(result.html, 'katex-html', 'HTML should NOT contain katex-html');
  // cells should have LaTeX
  assertContains(result.html, '$\\theta$', 'HTML cells should contain $\\theta$');
});

test('table plain text has LaTeX in cells', () => {
  const { doc, XMLSerializer } = buildDoc(TABLE_WITH_FORMULAS);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assertContains(result.text, '$\\theta$', 'text should contain LaTeX theta');
  assertContains(result.text, '$$\n\\sin2x=t^2-1\n$$', 'text should contain display LaTeX');
  // The rendered unicode θ should be gone
  assertNotContains(result.text, 'θ', 'text should NOT contain rendered theta');
});

// ---- 5. Bold formatting preserved in HTML ----------------------------------

test('HTML preserves <strong> formatting', () => {
  const { doc, XMLSerializer } = buildDoc(MIXED_PARAGRAPH);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assertContains(result.html, '<strong', 'HTML should preserve <strong>');
});

// ---- 6. Edge case: selection starts inside a formula -----------------------

test('selection starting inside katex-html still works', () => {
  const { doc, XMLSerializer } = buildDoc(
    DISPLAY_FORMULA + '<p>followed by text</p>'
  );
  // Find a text node deep inside katex-html
  const katexHtml = doc.querySelector('.katex-html');
  assert(katexHtml, '.katex-html not found');
  const textNode = katexHtml.querySelector('.mop'); // "sin" span
  assert(textNode, 'text node inside katex-html not found');

  const range = doc.createRange();
  // Start 1 char into "sin"
  range.setStart(textNode.firstChild || textNode, 1);
  range.setEndAfter(doc.body.lastChild);

  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output when selection starts inside formula');
  assertContains(result.text, '\\sin2x=t^2-1', 'should still extract LaTeX');
  assertContains(result.text, 'followed by text', 'should preserve following text');
});

// ---- 7. findKatexInRange accuracy ------------------------------------------

test('findKatexInRange counts formulas correctly in mixed content', () => {
  const { doc } = buildDoc(MIXED_PARAGRAPH);
  const { findKatexInRange } = makeHelpers(doc);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const found = findKatexInRange(range);
  // 3 inline + 1 display = 4 total .katex elements
  assert(found.length === 4, 'expected 4 .katex, got ' + found.length);
});

test('findKatexInRange returns empty for plain text', () => {
  const { doc } = buildDoc(PLAIN_PARAGRAPH);
  const { findKatexInRange } = makeHelpers(doc);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const found = findKatexInRange(range);
  assert(found.length === 0, 'expected 0, got ' + found.length);
});

// ---- 8. Multiple display formulas in selection -----------------------------

test('two display formulas both wrapped in $$...$$', () => {
  const { doc, XMLSerializer } = buildDoc(DISPLAY_FORMULA + DISPLAY_FORMULA);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  // Count $$ occurrences: each display formula = 2 $$ (open + close) = 4 total
  const count = (result.text.match(/\$\$/g) || []).length;
  assert(count === 4, 'expected 4 $$, got ' + count);
});

// ---- 9. Newer ChatGPT markup (data-math-source wrapper) ---------------------

test('extract LaTeX from new markup (inline, data-math-source)', () => {
  const { doc } = buildDoc(NEW_INLINE_FORMULA);
  const { extractLatex } = makeHelpers(doc);
  assert(extractLatex(doc.querySelector('.katex')) === 'y=0');
});

test('extract LaTeX from new markup (display, data-math-source)', () => {
  const { doc } = buildDoc(NEW_DISPLAY_FORMULA);
  const { extractLatex } = makeHelpers(doc);
  assert(extractLatex(doc.querySelector('.katex')) === '\\frac{dy}{dx}=y');
});

test('new markup single inline formula → $y=0$', () => {
  const { doc, XMLSerializer } = buildDoc(NEW_INLINE_FORMULA);
  const katex = doc.querySelector('.katex');
  const range = doc.createRange();
  range.selectNodeContents(katex);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assert(result.text === '$y=0$');
});

test('new markup single display formula → $$...$$', () => {
  const { doc, XMLSerializer } = buildDoc(NEW_DISPLAY_FORMULA);
  const katex = doc.querySelector('.katex');
  const range = doc.createRange();
  range.selectNodeContents(katex);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assert(result.text.startsWith('$$'), 'should start with $$');
  assertContains(result.text, '\\frac{dy}{dx}=y');
});

test('new markup mixed selection: LaTeX extracted, wrapper stripped', () => {
  const html = '<p>The solution is ' + NEW_INLINE_FORMULA + ', and generally</p>' +
    NEW_DISPLAY_FORMULA + '<p>for all x.</p>';
  const { doc, XMLSerializer } = buildDoc(html);
  const range = doc.createRange();
  range.selectNodeContents(doc.body);
  const result = simulateCopy(doc, XMLSerializer, range);
  assert(result, 'no output');
  assertContains(result.text, '$y=0$', 'inline LaTeX missing');
  assertContains(result.text, '$$\n\\frac{dy}{dx}=y\n$$', 'display LaTeX missing');
  assertContains(result.text, 'The solution is', 'surrounding text missing');
  // wrapper attributes and katex internals must not leak into HTML
  assertNotContains(result.html, 'data-math-source', 'wrapper data-math-source leaked');
  assertNotContains(result.html, 'role="math"', 'wrapper role="math" leaked');
  assertNotContains(result.html, 'katex-html', 'katex internals leaked');
});

// ---- Delimiter preference: production script integration --------------------

for (const [fixture, expected] of [
  [INLINE_FORMULA, '\\(\\theta\\)'],
  [DISPLAY_FORMULA, '\\[\n\\sin2x=t^2-1\n\\]'],
  [NEW_INLINE_FORMULA, '\\(y=0\\)'],
  [NEW_DISPLAY_FORMULA, '\\[\n\\frac{dy}{dx}=y\n\\]']
]) {
  test('bracket preference: single formula ' + JSON.stringify(expected), () => {
    const { doc } = buildDoc(fixture);
    const harness = contentHarness(doc, { [DELIMITER_KEY]: 'brackets' });
    const range = doc.createRange();
    range.selectNodeContents(doc.querySelector('.katex'));
    const result = harness.copy(range);
    assert(result.text === expected, 'unexpected plain text');
    assert(result.html === expected, 'unexpected HTML');
  });
}

for (const fixture of [MIXED_PARAGRAPH, TABLE_WITH_FORMULAS,
  '<p>Value ' + NEW_INLINE_FORMULA + '</p>' + NEW_DISPLAY_FORMULA]) {
  test('bracket preference: mixed selection preserves text and formatting', () => {
    const { doc } = buildDoc(fixture);
    const harness = contentHarness(doc, { [DELIMITER_KEY]: 'brackets' });
    const range = doc.createRange();
    range.selectNodeContents(doc.body);
    const result = harness.copy(range);
    for (const output of [result.text, result.html]) {
      assertContains(output, '\\(');
      assertContains(output, '\\)');
      assertContains(output, '\\[\n');
      assertContains(output, '\n\\]');
      assertNotContains(output, '$');
    }
    assertNotContains(result.html, 'katex-html');
    assertNotContains(result.html, 'data-math-source');
    if (fixture === TABLE_WITH_FORMULAS) assertContains(result.html, '<table');
    if (fixture === MIXED_PARAGRAPH) {
      assertContains(result.html, '<strong');
      assertContains(result.text, 'Therefore we can derive the final result.');
    }
  });
}

test('bracket conversion preserves literal dollars and handles partial formula selections', () => {
  const { doc } = buildDoc('<p>Price: $5. Value: ' + INLINE_FORMULA + '</p>');
  const harness = contentHarness(doc, { [DELIMITER_KEY]: 'brackets' });
  const range = doc.createRange();
  range.setStart(doc.querySelector('.katex-html .mord').firstChild, 0);
  range.setEndAfter(doc.querySelector('p'));
  assertContains(harness.copy(range).text, '\\(\\theta\\)');
  range.selectNodeContents(doc.body);
  const result = harness.copy(range);
  assertContains(result.text, 'Price: $5. Value:');
  assertContains(result.text, '\\(\\theta\\)');
  assertContains(result.html, 'Price: $5. Value:');
});

test('delimiter changes update an open page immediately and ignore other storage areas', () => {
  const { doc } = buildDoc(INLINE_FORMULA);
  const harness = contentHarness(doc);
  const range = doc.createRange();
  range.selectNodeContents(doc.querySelector('.katex'));
  assert(harness.copy(range).text === '$\\theta$');
  harness.change({ [DELIMITER_KEY]: { newValue: 'brackets' } }, 'sync');
  assert(harness.copy(range).text === '$\\theta$');
  harness.change({ [DELIMITER_KEY]: { newValue: 'brackets' } });
  assert(harness.copy(range).text === '\\(\\theta\\)');
  harness.change({ [DELIMITER_KEY]: { newValue: 'dollar' } });
  assert(harness.copy(range).text === '$\\theta$');
  harness.change({ [DELIMITER_KEY]: { newValue: 'brackets' } });
  harness.change({ [DELIMITER_KEY]: {} });
  assert(harness.copy(range).text === '$\\theta$');
  harness.change({ [DELIMITER_KEY]: { newValue: 'unknown' } });
  assert(harness.copy(range).text === '$\\theta$');
});

for (const style of [undefined, 'unknown', 'dollar']) {
  test('missing/invalid/dollar setting keeps the default: ' + style, () => {
    const { doc } = buildDoc(DISPLAY_FORMULA);
    const harness = contentHarness(doc, { [DELIMITER_KEY]: style });
    const range = doc.createRange();
    range.selectNodeContents(doc.querySelector('.katex'));
    assert(harness.copy(range).text === '$$\n\\sin2x=t^2-1\n$$');
  });
}

test('bracket setting respects disabled sites and plain-text selections', () => {
  const { doc } = buildDoc(INLINE_FORMULA + PLAIN_PARAGRAPH);
  const harness = contentHarness(doc, {
    [DELIMITER_KEY]: 'brackets', 'formula-copy-whitelist': []
  });
  const range = doc.createRange();
  range.selectNodeContents(doc.querySelector('.katex'));
  assert(harness.copy(range) === null);
  harness.change({ 'formula-copy-whitelist': { newValue: ['chatgpt.com'] } });
  range.selectNodeContents(doc.querySelector('p'));
  assert(harness.copy(range) === null);
});

// Popup: exercise initialization, saving, persistence, errors, and locales.
function popupHarness(data = {}) {
  const dom = new JSDOM(POPUP_HTML, { runScripts: 'outside-only' });
  const win = dom.window;
  let finishSave;
  win.chrome = {
    tabs: { query: (options, cb) => cb([{ url: 'https://chatgpt.com/' }]) },
    runtime: { sendMessage: () => {}, lastError: null },
    storage: { local: {
      get: (keys, cb) => cb(data),
      set: (next, cb) => {
        if (cb) {
          finishSave = (fail) => {
            win.chrome.runtime.lastError = fail ? { message: 'Storage unavailable' } : null;
            if (!fail) Object.assign(data, next);
            cb();
            win.chrome.runtime.lastError = null;
          };
        } else Object.assign(data, next);
      }
    } }
  };
  win.eval(POPUP_SCRIPT);
  return { win, doc: win.document, finish: (fail = false) => finishSave(fail) };
}

test('popup button toggles, prevents duplicate saves, and restores the choice on reopen', () => {
  const data = {};
  const popup = popupHarness(data);
  const button = popup.doc.getElementById('delimiter-style');
  assert(button.textContent === '$' && !button.disabled);
  button.click();
  assert(button.disabled, 'button must be disabled while saving');
  button.click(); // Must not queue another toggle while the write is pending.
  popup.finish();
  assert(!button.disabled && data[DELIMITER_KEY] === 'brackets');
  assert(button.textContent === '\\(\\)');
  assert(popup.doc.getElementById('delimiter-status') === null, 'no footer feedback');
  const reopened = popupHarness(data);
  assert(reopened.doc.getElementById('delimiter-style').textContent === '\\(\\)');
  button.click();
  popup.finish();
  assert(button.textContent === '$' && data[DELIMITER_KEY] === 'dollar');
});

test('popup save failure preserves the saved choice and permits retry', () => {
  const popup = popupHarness({ [DELIMITER_KEY]: 'brackets' });
  const button = popup.doc.getElementById('delimiter-style');
  button.click();
  popup.finish(true);
  assert(button.textContent === '\\(\\)' && !button.disabled);
  button.click();
  popup.finish();
  assert(button.textContent === '$');
});

test('popup normalizes invalid preference and localizes the button in all eight languages', () => {
  const popup = popupHarness({ [DELIMITER_KEY]: 'unknown' });
  const button = popup.doc.getElementById('delimiter-style');
  assert(button.textContent === '$');
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'fr', 'de', 'es', 'ru']) {
    assert(popup.doc.documentElement.lang === locale);
    assertNotContains(button.title, 'popupDelimiters');
    assertNotContains(button.title, 'popupDelimiterHint');
    assertContains(button.title, '$...$ / $$...$$');
    assert(button.getAttribute('aria-label') === button.title);
    if (locale !== 'en') assertNotContains(button.title, 'Math delimiters');
    popup.doc.getElementById('lang-btn').click();
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
