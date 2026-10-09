/**
 * Popup — whitelist manager, language switcher, and math delimiter preference.
 */

var WHITELIST_KEY = 'formula-copy-whitelist';
var LOCALE_KEY     = 'formula-copy-locale';
var DELIMITER_KEY  = 'formula-copy-delimiter-style';
var DEFAULT_WHITELIST = ['chatgpt.com'];

var currentDomain = null;
var whitelist = [];
var locale = 'en';
var delimiterStyle = 'dollar';

var LOCALES = ['en', 'zh_CN', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
var LOCALE_LABELS = { en: 'EN', zh_CN: '中', ja: '日', ko: '한', fr: 'FR', de: 'DE', es: 'ES', ru: 'RU' };

// ---- inline i18n messages --------------------------------------------------

var MSG = {
  en: {
    popupDelimiters:   'Math delimiters',
    popupDelimiterHint: 'Applies to all enabled sites.',
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
    popupDelimiters:   '公式分隔符',
    popupDelimiterHint: '适用于所有已启用的网站。',
    popupEnabled:      '已启用 — 公式复制生效中',
    popupDisabled:     '未启用',
    popupEnable:       '在此网站启用',
    popupDisable:      '停用',
    popupCurrent:      '（当前）',
    popupEnabledSites: '已启用的网站',
    popupEmpty:        '—',
    popupUnknown:      '（未知）'
  },
  ja: {
    popupDelimiters:   '数式の区切り記号',
    popupDelimiterHint: '有効なすべてのサイトに適用されます。',
    popupEnabled:      '有効 — LaTeX としてコピーされます',
    popupDisabled:     'このサイトでは無効',
    popupEnable:       'このサイトで有効にする',
    popupDisable:      '無効にする',
    popupCurrent:      '（現在）',
    popupEnabledSites: '有効なサイト',
    popupEmpty:        '—',
    popupUnknown:      '（不明）'
  },
  ko: {
    popupDelimiters:   '수식 구분자',
    popupDelimiterHint: '활성화된 모든 사이트에 적용됩니다.',
    popupEnabled:      '활성화됨 — LaTeX로 복사됩니다',
    popupDisabled:     '이 사이트에서 비활성화됨',
    popupEnable:       '이 사이트에서 활성화',
    popupDisable:      '비활성화',
    popupCurrent:      '(현재)',
    popupEnabledSites: '활성화된 사이트',
    popupEmpty:        '—',
    popupUnknown:      '(알 수 없음)'
  },
  fr: {
    popupDelimiters:   'Délimiteurs mathématiques',
    popupDelimiterHint: 'Pour tous les sites activés.',
    popupEnabled:      'Activé — formules copiées en LaTeX',
    popupDisabled:     'Non activé sur ce site',
    popupEnable:       'Activer sur ce site',
    popupDisable:      'Désactiver',
    popupCurrent:      '(actuel)',
    popupEnabledSites: 'Sites activés',
    popupEmpty:        '—',
    popupUnknown:      '(inconnu)'
  },
  de: {
    popupDelimiters:   'Formelbegrenzer',
    popupDelimiterHint: 'Gilt für alle aktivierten Seiten.',
    popupEnabled:      'Aktiv — Formeln werden als LaTeX kopiert',
    popupDisabled:     'Auf dieser Seite nicht aktiv',
    popupEnable:       'Auf dieser Seite aktivieren',
    popupDisable:      'Deaktivieren',
    popupCurrent:      '(aktuell)',
    popupEnabledSites: 'Aktivierte Seiten',
    popupEmpty:        '—',
    popupUnknown:      '(unbekannt)'
  },
  es: {
    popupDelimiters:   'Delimitadores matemáticos',
    popupDelimiterHint: 'Para todos los sitios activados.',
    popupEnabled:      'Activado — fórmulas copiadas como LaTeX',
    popupDisabled:     'No activado en este sitio',
    popupEnable:       'Activar en este sitio',
    popupDisable:      'Desactivar',
    popupCurrent:      '(actual)',
    popupEnabledSites: 'Sitios activados',
    popupEmpty:        '—',
    popupUnknown:      '(desconocido)'
  },
  ru: {
    popupDelimiters:   'Разделители формул',
    popupDelimiterHint: 'Для всех включённых сайтов.',
    popupEnabled:      'Включено — формулы копируются как LaTeX',
    popupDisabled:     'Не включено на этом сайте',
    popupEnable:       'Включить на этом сайте',
    popupDisable:      'Отключить',
    popupCurrent:      '(текущий)',
    popupEnabledSites: 'Включённые сайты',
    popupEmpty:        '—',
    popupUnknown:      '(неизвестно)'
  }
};

function t(key) {
  return (MSG[locale] && MSG[locale][key]) || (MSG.en[key]) || key;
}

// ---- init ------------------------------------------------------------------

document.getElementById('lang-btn').addEventListener('click', toggleLocale);
document.getElementById('delimiter-style').addEventListener('click', saveDelimiterStyle);

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  var tab = tabs[0];
  if (tab && tab.url) {
    try { currentDomain = new URL(tab.url).hostname; } catch (_) { }
  }
  loadState();
});

function loadState() {
  chrome.storage.local.get([WHITELIST_KEY, LOCALE_KEY, DELIMITER_KEY], function (data) {
    whitelist = data[WHITELIST_KEY] || DEFAULT_WHITELIST.slice();
    locale    = data[LOCALE_KEY] || 'en';
    delimiterStyle = data[DELIMITER_KEY] === 'brackets' ? 'brackets' : 'dollar';
    document.getElementById('delimiter-style').disabled = false;
    document.getElementById('lang-btn').textContent = LOCALE_LABELS[locale] || locale;
    document.getElementById('section-title').textContent = t('popupEnabledSites');
    render();
  });
}

// ---- locale toggle ---------------------------------------------------------

function toggleLocale() {
  var idx = LOCALES.indexOf(locale);
  locale = LOCALES[(idx + 1) % LOCALES.length];
  chrome.storage.local.set({ [LOCALE_KEY]: locale });
  document.getElementById('lang-btn').textContent = LOCALE_LABELS[locale] || locale;
  document.getElementById('section-title').textContent = t('popupEnabledSites');
  render();
}

// ---- storage ---------------------------------------------------------------

function saveWhitelist() {
  chrome.storage.local.set({ [WHITELIST_KEY]: whitelist });
}

function saveDelimiterStyle() {
  var button = document.getElementById('delimiter-style');
  if (button.disabled) return;
  var restoreFocus = document.activeElement === button;
  var nextStyle = delimiterStyle === 'dollar' ? 'brackets' : 'dollar';
  button.disabled = true;
  chrome.storage.local.set({ [DELIMITER_KEY]: nextStyle }, function () {
    if (!chrome.runtime.lastError) {
      delimiterStyle = nextStyle;
    }
    button.disabled = false;
    renderDelimiterSettings();
    if (restoreFocus && document.activeElement === document.body) button.focus();
  });
}

function renderDelimiterSettings() {
  document.documentElement.lang = locale.replace('_', '-');
  var button = document.getElementById('delimiter-style');
  var examples = delimiterStyle === 'brackets' ? '\\(...\\) / \\[...\\]' : '$...$ / $$...$$';
  button.textContent = delimiterStyle === 'brackets' ? '\\(\\)' : '$';
  button.title = t('popupDelimiters') + ': ' + examples + '. ' + t('popupDelimiterHint');
  button.setAttribute('aria-label', button.title);
}

function isEnabled(domain) {
  return whitelist.indexOf(domain) !== -1;
}

// ---- render ----------------------------------------------------------------

function render() {
  renderDelimiterSettings();
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
