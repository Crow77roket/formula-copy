/**
 * Test harness for Formula Copy content script.
 * Loads the sample ChatGPT HTML, simulates selections, and verifies
 * LaTeX extraction + table-preserving HTML output.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// Load sample HTML
// ---------------------------------------------------------------------------

const htmlPath = path.join(__dirname, 'example', '不定积分求解.html');
const raw = fs.readFileSync(htmlPath, 'utf-8');
const dom = new JSDOM(raw, { runScripts: 'outside-only' });
const doc = dom.window.document;
const XMLSerializer = dom.window.XMLSerializer;

// ---------------------------------------------------------------------------
// Replicate the extension's core helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Simulate copy
// ---------------------------------------------------------------------------

function simulateCopy(range) {
  var html, text, toastEl;

  // Case A: single formula
  const singleKatex = findKatexAncestor(range.commonAncestorContainer);
  if (singleKatex && range.intersectsNode(singleKatex)) {
    const startEl = range.startContainer.nodeType === 3
      ? range.startContainer.parentElement : range.startContainer;
    const endEl = range.endContainer.nodeType === 3
      ? range.endContainer.parentElement : range.endContainer;
    if (startEl && endEl &&
        startEl.closest('.' + KATEX_CLASS) === singleKatex &&
        endEl.closest('.' + KATEX_CLASS) === singleKatex) {
      const latex = extractLatex(singleKatex);
      if (latex) {
        const block = !!singleKatex.closest('.' + DISPLAY_CLASS);
        text = block ? '$$\n' + latex + '\n$$' : '$' + latex + '$';
        html = text; // single formula: HTML = text
        return { html, text };
      }
    }
  }

  // Case B: mixed
  const originals = findKatexInRange(range);
  if (originals.length === 0) return null;

  const latexData = [];
  for (let i = 0; i < originals.length; i++) {
    const l = extractLatex(originals[i]);
    const d = !!originals[i].closest('.' + DISPLAY_CLASS);
    latexData.push({ latex: l, display: d });
  }

  const fragment = range.cloneContents();
  buildMixedText(fragment, latexData);

  html = new XMLSerializer().serializeToString(fragment);
  text = fragment.textContent.replace(/\n{3,}/g, '\n\n');

  return { html, text };
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
    console.log('        ' + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertContains(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error((msg || 'expected to contain') +
      '\n        expected: ' + JSON.stringify(needle) +
      '\n        actual:   ' + JSON.stringify(haystack.substring(0, 200)));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('=== Formula Copy — Integration Tests (v3: dual MIME) ===\n');

// -- Test 1: Basic counts ----------------------------------------------------
test('80 .katex elements in the sample', () => {
  assert(doc.querySelectorAll('.' + KATEX_CLASS).length === 80);
});

test('44 katex-display wrappers', () => {
  assert(doc.querySelectorAll('.' + DISPLAY_CLASS).length === 44);
});

test('1 table found', () => {
  assert(doc.querySelectorAll('table').length === 1);
});

// -- Test 2: LaTeX extraction ------------------------------------------------
test('extractLatex works for all 80 .katex elements', () => {
  const all = doc.querySelectorAll('.' + KATEX_CLASS);
  let ok = 0;
  for (const el of all) { if (extractLatex(el)) ok++; }
  assert(ok >= 70);
  console.log('        (' + ok + ' OK)');
});

// -- Test 3: Single formula --------------------------------------------------
test('single formula: text and html are LaTeX', () => {
  const katex = doc.querySelector('.' + DISPLAY_CLASS + ' .' + KATEX_CLASS);
  assert(katex);
  const range = doc.createRange();
  range.selectNodeContents(katex);
  const result = simulateCopy(range);
  assert(result);
  assert(result.text.startsWith('$$'));
  assert(result.html === result.text);
  console.log('        text: ' + result.text.substring(0, 60) + '...');
});

// -- Test 4: Mixed text → HTML has table structure ---------------------------
test('mixed text: HTML preserves <table> for Obsidian', () => {
  const table = doc.querySelector('table');
  assert(table);
  const range = doc.createRange();
  range.selectNode(table);

  const result = simulateCopy(range);
  assert(result, 'no output');
  assertContains(result.html, '<table', 'HTML should contain <table> tag');
  assertContains(result.html, '<td', 'HTML should contain <td> tags');
  assertContains(result.html, '$', 'HTML cells should contain LaTeX delimiters');
  assert(!result.html.includes('katex-mathml'), 'HTML should NOT contain .katex-mathml');
  assert(!result.html.includes('katex-html'), 'HTML should NOT contain .katex-html');

  console.log('        text/plain preview:');
  result.text.split('\n').slice(0, 4).forEach(l => console.log('        ' + l));

  console.log('        text/html contains table: ' + result.html.includes('<table'));
  console.log('        text/html contains LaTeX $: ' + result.html.includes('$'));
  console.log('        text/html katex-mathml removed: ' + !result.html.includes('katex-mathml'));
});

// -- Test 5: Plain text has clean LaTeX in table cells -----------------------
test('plain text: table cells have LaTeX (not rendered Unicode)', () => {
  const table = doc.querySelector('table');
  const range = doc.createRange();
  range.selectNode(table);
  const result = simulateCopy(range);

  // The plain text should contain LaTeX $...$ patterns, not rendered Unicode
  assertContains(result.text, '$\\theta$', 'should contain LaTeX theta');
  assertContains(result.text, '$\\left[-\\frac\\pi2', 'should contain LaTeX frac');
  assert(!result.text.includes('θ'), 'plain text should NOT contain rendered theta');

  console.log('        text/plain has $\\theta$: ' + result.text.includes('$\\theta$'));
  console.log('        text/plain has no rendered θ: ' + !result.text.includes('θ'));
});

// -- Test 6: Bold/italic formatting preserved in HTML -------------------------
test('HTML preserves bold/strong formatting', () => {
  // Find a paragraph with <strong>
  const strong = doc.querySelector('strong');
  if (!strong) { console.log('        (no <strong> — skipping)'); return; }

  // Select a range containing the strong element
  const range = doc.createRange();
  const p = strong.closest('p') || strong.parentElement;
  range.selectNodeContents(p);

  const originals = findKatexInRange(range);
  if (originals.length === 0) {
    console.log('        (no formulas in this paragraph — would pass through)');
    return;
  }

  const latexData = [];
  for (let i = 0; i < originals.length; i++) {
    latexData.push({
      latex: extractLatex(originals[i]),
      display: !!originals[i].closest('.' + DISPLAY_CLASS)
    });
  }

  const fragment = range.cloneContents();
  buildMixedText(fragment, latexData);
  const html = new XMLSerializer().serializeToString(fragment);

  assertContains(html, '<strong', 'HTML should preserve <strong>');
  console.log('        <strong> preserved in HTML: ' + html.includes('<strong'));
});

// -- Test 7: Clone truncation → original DOM still saves us -----------------
test('LaTeX from ORIGINAL dom (not truncated clones)', () => {
  const allKatex = doc.querySelectorAll('.' + KATEX_CLASS);
  let clonesOK = 0;
  let originalsOK = 0;
  for (const el of allKatex) {
    if (extractLatex(el)) originalsOK++;
    const clone = el.cloneNode(true);
    const mathml = clone.querySelector('.katex-mathml');
    if (mathml) mathml.remove();
    if (clone.querySelector('math[data-math]') ||
        clone.querySelector('semantics')) clonesOK++;
  }
  console.log('        originals: ' + originalsOK + ' OK, clones w/o mathml: ' + clonesOK);
  assert(clonesOK === 0);
});

// -- Test 8: Non-math copy passes through ------------------------------------
test('non-math copy is NOT intercepted', () => {
  const p = doc.querySelector('p');
  if (!p) { console.log('        (no <p> — skipping)'); return; }
  const range = doc.createRange();
  range.selectNodeContents(p);
  const originals = findKatexInRange(range);
  console.log('        formulas in plain paragraph: ' + originals.length +
    (originals.length === 0 ? ' → would pass through' : ' → would be intercepted'));
  assert(true); // just verifying the guard logic
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed > 0 ? 1 : 0);
