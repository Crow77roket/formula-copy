/**
 * Popup — whitelist manager.
 * - Shows current tab domain + toggle button
 * - Lists all enabled domains with remove buttons
 * - Persists whitelist in chrome.storage.local
 */

var WHITELIST_KEY = 'formula-copy-whitelist';
var DEFAULT_WHITELIST = ['chatgpt.com'];

var currentDomain = null;
var whitelist = [];

// ---- init ------------------------------------------------------------------

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  var tab = tabs[0];
  if (tab && tab.url) {
    try { currentDomain = new URL(tab.url).hostname; } catch (_) { }
  }
  loadWhitelist();
});

function loadWhitelist() {
  chrome.storage.local.get(WHITELIST_KEY, function (data) {
    whitelist = data[WHITELIST_KEY] || DEFAULT_WHITELIST.slice();
    render();
  });
}

function saveWhitelist() {
  chrome.storage.local.set({ [WHITELIST_KEY]: whitelist });
}

// ---- helpers ---------------------------------------------------------------

function isEnabled(domain) {
  return whitelist.indexOf(domain) !== -1;
}

// ---- render ----------------------------------------------------------------

function render() {
  var enabled = currentDomain ? isEnabled(currentDomain) : false;

  // dot + toggle button
  document.getElementById('dot').className = 'dot ' + (enabled ? 'on' : 'off');
  document.getElementById('current-domain').textContent = currentDomain || '(unknown)';

  var btn = document.getElementById('toggle-btn');
  var status = document.getElementById('current-status');

  if (enabled) {
    status.textContent = '已启用 — 公式复制生效中';
    btn.textContent = '停用';
    btn.className = 'disable-btn';
    btn.onclick = function () {
      removeDomain(currentDomain);
    };
  } else {
    status.textContent = '未启用';
    btn.textContent = '在此网站启用';
    btn.className = 'enable-btn';
    btn.onclick = function () {
      addDomain(currentDomain);
    };
  }

  // list
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  list.innerHTML = '';

  if (whitelist.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    whitelist.forEach(function (d) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.className = 'domain';
      span.textContent = d;
      li.appendChild(span);

      if (d === currentDomain) {
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = '(当前)';
        badge.style.cssText = 'font-size:10px;color:#10a37f;margin-left:4px;';
        li.appendChild(badge);
      }

      var removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = '移除 ' + d;
      removeBtn.onclick = function () { removeDomain(d); };
      li.appendChild(removeBtn);

      list.appendChild(li);
    });
  }
}

// ---- actions ---------------------------------------------------------------

function addDomain(domain) {
  if (!domain || isEnabled(domain)) return;
  whitelist.push(domain);
  saveWhitelist();

  // Re-register content scripts for the new set of domains
  chrome.runtime.sendMessage({ type: 'update-whitelist', whitelist: whitelist });

  render();
}

function removeDomain(domain) {
  whitelist = whitelist.filter(function (d) { return d !== domain; });
  saveWhitelist();

  chrome.runtime.sendMessage({ type: 'update-whitelist', whitelist: whitelist });

  render();
}
