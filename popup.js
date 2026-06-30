/**
 * Popup — whitelist manager + in-app language switcher.
 */

var WHITELIST_KEY = 'formula-copy-whitelist';
var LOCALE_KEY     = 'formula-copy-locale';
var DEFAULT_WHITELIST = ['chatgpt.com'];

var currentDomain = null;
var whitelist = [];
var locale = 'en';

// ---- inline i18n messages --------------------------------------------------

var MSG = {
  en: {
    popupEnabled:      'Enabled — formulas copied as LaTeX',
    popupDisabled:     'Not enabled on this site',
    popupEnable:       'Enable on this site',
    popupDisable:      'Disable',
    popupCurrent:      '(current)',
    popupEnabledSites: 'Enabled sites',
    popupEmpty:        '—',
    popupUnknown:      '(unknown)'
  },
  zh_CN: {
    popupEnabled:      '已启用 — 公式复制生效中',
    popupDisabled:     '未启用',
    popupEnable:       '在此网站启用',
    popupDisable:      '停用',
    popupCurrent:      '（当前）',
    popupEnabledSites: '已启用的网站',
    popupEmpty:        '—',
    popupUnknown:      '（未知）'
  }
};

function t(key) {
  return (MSG[locale] && MSG[locale][key]) || (MSG.en[key]) || key;
}

// ---- init ------------------------------------------------------------------

document.getElementById('lang-btn').addEventListener('click', toggleLocale);

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  var tab = tabs[0];
  if (tab && tab.url) {
    try { currentDomain = new URL(tab.url).hostname; } catch (_) { }
  }
  loadState();
});

function loadState() {
  chrome.storage.local.get([WHITELIST_KEY, LOCALE_KEY], function (data) {
    whitelist = data[WHITELIST_KEY] || DEFAULT_WHITELIST.slice();
    locale    = data[LOCALE_KEY] || 'en';
    document.getElementById('lang-btn').textContent = locale === 'zh_CN' ? '中' : 'EN';
    document.getElementById('section-title').textContent = t('popupEnabledSites');
    render();
  });
}

// ---- locale toggle ---------------------------------------------------------

function toggleLocale() {
  locale = locale === 'zh_CN' ? 'en' : 'zh_CN';
  chrome.storage.local.set({ [LOCALE_KEY]: locale });
  document.getElementById('lang-btn').textContent = locale === 'zh_CN' ? '中' : 'EN';
  document.getElementById('section-title').textContent = t('popupEnabledSites');
  render();
}

// ---- storage ---------------------------------------------------------------

function saveWhitelist() {
  chrome.storage.local.set({ [WHITELIST_KEY]: whitelist });
}

function isEnabled(domain) {
  return whitelist.indexOf(domain) !== -1;
}

// ---- render ----------------------------------------------------------------

function render() {
  var enabled = currentDomain ? isEnabled(currentDomain) : false;

  document.getElementById('dot').className = 'dot ' + (enabled ? 'on' : 'off');
  document.getElementById('current-domain').textContent = currentDomain || t('popupUnknown');

  var btn = document.getElementById('toggle-btn');
  var status = document.getElementById('current-status');

  if (enabled) {
    status.textContent = t('popupEnabled');
    btn.textContent = t('popupDisable');
    btn.className = 'disable-btn';
    btn.onclick = function () { removeDomain(currentDomain); };
  } else {
    status.textContent = t('popupDisabled');
    btn.textContent = t('popupEnable');
    btn.className = 'enable-btn';
    btn.onclick = function () { addDomain(currentDomain); };
  }

  // whitelist
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  list.innerHTML = '';

  if (whitelist.length === 0) {
    empty.style.display = 'block';
    empty.textContent = t('popupEmpty');
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
        badge.style.cssText = 'font-size:10px;color:#10a37f;margin-left:4px;';
        badge.textContent = t('popupCurrent');
        li.appendChild(badge);
      }

      var removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = t('popupDisable') + ' ' + d;
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
  chrome.runtime.sendMessage({ type: 'update-whitelist', whitelist: whitelist });
  render();
}

function removeDomain(domain) {
  whitelist = whitelist.filter(function (d) { return d !== domain; });
  saveWhitelist();
  chrome.runtime.sendMessage({ type: 'update-whitelist', whitelist: whitelist });
  render();
}
