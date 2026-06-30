/**
 * Formula Copy — Chrome Extension
 * Intercepts copy events on whitelisted domains and converts KaTeX-
 * rendered math formulas into clean LaTeX source code ($…$ / $$…$$).
 *
 * Writes BOTH text/html and text/plain to the clipboard so that
 * consumers like Obsidian can still convert HTML tables to Markdown
 * while getting LaTeX formulas instead of rendered Unicode.
 */
(function () {
  'use strict';

  var TOAST_DURATION = 800;
  var KATEX_CLASS = 'katex';
  var DISPLAY_CLASS = 'katex-display';

  // ---- domain whitelist (cached from chrome.storage) ------------------------

  var enabledDomains = ['chatgpt.com'];  // default
  var currentHost = location.hostname;

  // Load persisted whitelist
  chrome.storage.local.get('formula-copy-whitelist', function (data) {
    if (data['formula-copy-whitelist']) {
      enabledDomains = data['formula-copy-whitelist'];
    }
  });

  // React to popup changes in real time
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes['formula-copy-whitelist']) {
      enabledDomains = changes['formula-copy-whitelist'].newValue;
    }
  });

  function isActive() {
    return enabledDomains.indexOf(currentHost) !== -1;
  }

  // ---- event binding --------------------------------------------------------

  document.addEventListener('copy', onCopy, { capture: true });

  // ---------------------------------------------------------------------------
  // Copy handler
  // ---------------------------------------------------------------------------

  function onCopy(event) {
    if (!isActive()) return; // domain not in whitelist — native copy

    var selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    var range = selection.getRangeAt(0);
    if (!range) return;

    var toastEl;

    // ---- case A: selection entirely within a single .katex -----------------
    var singleKatex = findKatexAncestor(range.commonAncestorContainer);
    if (singleKatex && isFullyWithin(selection, singleKatex)) {
      var latex = extractLatex(singleKatex);
      if (latex) {
        var block = !!singleKatex.closest('.' + DISPLAY_CLASS);
        var output = block ? '$$\n' + latex + '\n$$' : '$' + latex + '$';

        event.preventDefault();
        event.stopImmediatePropagation();
        writeClipboard(event, output, output);
        showToast(singleKatex);
        return;
      }
    }

    // ---- case B: mixed text + formulas (+ optional tables) ------------------
    // Pre-extract LaTeX from ORIGINAL dom BEFORE cloning.
    var originals = findKatexInRange(range);
    if (originals.length === 0) return; // no math → native copy

    var latexData = [];
    for (var i = 0; i < originals.length; i++) {
      var l = extractLatex(originals[i]);
      var d = !!originals[i].closest('.' + DISPLAY_CLASS);
      latexData.push({ latex: l, display: d });
    }

    var fragment;
    try { fragment = range.cloneContents(); } catch (_) { return; }

    // Replace .katex subtrees with LaTeX text nodes (in-place on fragment)
    buildMixedText(fragment, latexData);

    // Serialize to HTML (preserves tables, formatting) and plain text
    var html = new XMLSerializer().serializeToString(fragment);
    var text = fragment.textContent.replace(/\n{3,}/g, '\n\n');

    event.preventDefault();
    event.stopImmediatePropagation();

    writeClipboard(event, html, text);
    showToast(originals[0]);
  }

  // ---------------------------------------------------------------------------
  // Clipboard write (dual MIME: html + plain)
  // ---------------------------------------------------------------------------

  /**
   * Try to write both text/html and text/plain to the clipboard.
   * Falls back to async Clipboard API if the synchronous event method fails,
   * and to text-only as a last resort.
   */
  function writeClipboard(event, html, text) {
    // Attempt 1 — synchronous DataTransfer (works inside copy event)
    try {
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', text);
      return;
    } catch (_) { /* fall through */ }

    // Attempt 2 — async Clipboard API with dual MIME
    try {
      var item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      navigator.clipboard.write([item]).catch(function () {
        // Attempt 3 — text only
        navigator.clipboard.writeText(text).catch(function () {});
      });
    } catch (_) {
      // Attempt 3 — text only
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  // ---------------------------------------------------------------------------
  // Mixed-text builder (formulas replaced; tables left as HTML)
  // ---------------------------------------------------------------------------

  /**
   * Walk `fragment`, replace each .katex subtree with a <span> containing
   * LaTeX ($…$ / $$…$$).  The <span> wrapper keeps the HTML structure
   * valid so that XMLSerializer produces clean output.
   */
  function buildMixedText(fragment, latexData) {
    var clones = fragment.querySelectorAll('.' + KATEX_CLASS);

    for (var i = clones.length - 1; i >= 0; i--) {
      var data = latexData[i];
      if (!data || !data.latex) continue;

      var wrapped = data.display
        ? '\n$$\n' + data.latex + '\n$$\n'
        : '$' + data.latex + '$';

      // Replace the .katex element with a plain span so the HTML stays
      // clean and the LaTeX delimiters are preserved in both HTML and
      // plain-text views.
      var span = document.createElement('span');
      span.textContent = wrapped;

      var el = clones[i];
      el.parentNode.replaceChild(span, el);
    }
  }

  // ---------------------------------------------------------------------------
  // LaTeX extraction (always from original DOM)
  // ---------------------------------------------------------------------------

  function extractLatex(katexEl) {
    var ann = katexEl.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent) return ann.textContent.trim();

    var mathEl = katexEl.querySelector('math[data-math]');
    if (mathEl) {
      var dm = mathEl.getAttribute('data-math');
      if (dm) return dm.trim();
    }

    var sem = katexEl.querySelector('semantics');
    if (sem) {
      ann = sem.querySelector('annotation');
      if (ann && ann.textContent) return ann.textContent.trim();
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function findKatexAncestor(node) {
    var el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el ? el.closest('.' + KATEX_CLASS) : null;
  }

  function isFullyWithin(selection, katexEl) {
    for (var i = 0; i < selection.rangeCount; i++) {
      var r = selection.getRangeAt(i);
      if (!nodeWithin(r.startContainer, katexEl)) return false;
      if (!nodeWithin(r.endContainer, katexEl)) return false;
    }
    return true;
  }

  function nodeWithin(node, katexEl) {
    var el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el && el.closest('.' + KATEX_CLASS) === katexEl;
  }

  function findKatexInRange(range) {
    var result = [];
    var root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
    if (!root || !root.querySelectorAll) return result;

    var all = root.querySelectorAll('.' + KATEX_CLASS);
    for (var i = 0; i < all.length; i++) {
      if (range.intersectsNode(all[i])) result.push(all[i]);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  function showToast(katexEl) {
    var rect = katexEl.getBoundingClientRect();
    var toast = document.createElement('div');
    toast.textContent = chrome.i18n.getMessage('toastCopied') || '✓ LaTeX';
    Object.assign(toast.style, {
      position: 'fixed',
      zIndex: '2147483647',
      padding: '3px 10px',
      background: '#10a37f',
      color: '#fff',
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '500',
      borderRadius: '4px',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 150ms ease',
      top: Math.max(4, rect.top - 28) + 'px',
      left: rect.left + 'px'
    });
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.style.opacity = '1';
      setTimeout(function () {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', function () { toast.remove(); });
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 200);
      }, TOAST_DURATION);
    });
  }
})();
