/**
 * Test harness for Formula Copy content script.
 * Uses inline mock DOM fixtures — no external files required.
 *
 *   npm install && npm test
 */

const { JSDOM } = require('jsdom');

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

/** A table with KaTeX formulas in header and body cells */
const TABLE_WITH_FORMULAS = `
<table>
  <thead>
    <tr>
      <th>${INLINE_FORMULA} 所在区间</th>
      <th>恢复公式</th>
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
  所以真正需要单调的是 ${INLINE_FORMULA}，<strong>不是</strong> ${INLINE_FORMULA}。
  看 ${INLINE_FORMULA} 的范围，设
</p>
${DISPLAY_FORMULA}
<p>因此我们可以推导出最终结果。</p>`;

/** A paragraph with only plain text (no formulas) */
const PLAIN_PARAGRAPH = `<p>这是一段<strong>普通</strong>文字，没有任何公式。</p>`;

// ---------------------------------------------------------------------------
// Test document builder
// ---------------------------------------------------------------------------

function buildDoc(bodyHtml) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' + bodyHtml + '</body></html>',
    { runScripts: 'outside-only' }
  );
  return {
    doc: dom.window.document,
    XMLSerializer: dom.window.XMLSerializer
  };
}

// ---------------------------------------------------------------------------
// Replicated extension helpers (same logic as content.js)
// ---------------------------------------------------------------------------

function makeHelpers(doc) {
  const KATEX_CLASS = 'katex';
  const DISPLAY_CLASS = 'katex-display';

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

  function findKatexAncestor(node) {
    const el = node.nodeType === 3 ? node.parentElement : node;
    return el ? el.closest('.' + KATEX_CLASS) : null;
  }

  function buildMixedText(fragment, latexData) {
    const clones = fragment.querySelectorAll('.' + KATEX_CLASS);
    for (let i = clones.length - 1; i >= 0; i--) {
      const data = latexData[i];
      if (!data || !data.latex) continue;
      const wrapped = data.display
        ? '\n$$\n' + data.latex + '\n$$\n'
        : '$' + data.latex + '$';
      const span = doc.createElement('span');
      span.textContent = wrapped;
      clones[i].parentNode.replaceChild(span, clones[i]);
    }
  }

  return { extractLatex, findKatexInRange, findKatexAncestor, buildMixedText };
}

// ---------------------------------------------------------------------------
// simulateCopy — mirrors content.js onCopy logic
// ---------------------------------------------------------------------------

function simulateCopy(doc, XMLSerializer, range) {
  const { extractLatex, findKatexInRange, findKatexAncestor, buildMixedText } = makeHelpers(doc);
  const DISPLAY_CLASS = 'katex-display';

  // Case A: selection entirely within a single .katex
  const singleKatex = findKatexAncestor(range.commonAncestorContainer);
  if (singleKatex && range.intersectsNode(singleKatex)) {
    const startEl = range.startContainer.nodeType === 3
      ? range.startContainer.parentElement : range.startContainer;
    const endEl = range.endContainer.nodeType === 3
      ? range.endContainer.parentElement : range.endContainer;
    const KATEX_CLASS = 'katex';
    if (startEl && endEl &&
        startEl.closest('.' + KATEX_CLASS) === singleKatex &&
        endEl.closest('.' + KATEX_CLASS) === singleKatex) {
      const latex = extractLatex(singleKatex);
      if (latex) {
        const block = !!singleKatex.closest('.' + DISPLAY_CLASS);
        const text = block ? '$$\n' + latex + '\n$$' : '$' + latex + '$';
        return { html: text, text };
      }
    }
  }

  // Case B: mixed content
  const originals = findKatexInRange(range);
  if (originals.length === 0) return null;

  const latexData = [];
  for (let i = 0; i < originals.length; i++) {
    latexData.push({
      latex: extractLatex(originals[i]),
      display: !!originals[i].closest('.' + DISPLAY_CLASS)
    });
  }

  const fragment = range.cloneContents();
  buildMixedText(fragment, latexData);

  return {
    html: new XMLSerializer().serializeToString(fragment),
    text: fragment.textContent.replace(/\n{3,}/g, '\n\n')
  };
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
  assertContains(result.text, '所以真正需要单调的是', 'should preserve Chinese text');
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

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
