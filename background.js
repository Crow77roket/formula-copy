/**
 * Background service worker — icon state + whitelist sync.
 */

var ACTIVE_ICON = {
  16:  'icons/icon-active-16.png',
  48:  'icons/icon-active-48.png',
  128: 'icons/icon-active-128.png'
};

var INACTIVE_ICON = {
  16:  'icons/icon-inactive-16.png',
  48:  'icons/icon-inactive-48.png',
  128: 'icons/icon-inactive-128.png'
};

var WHITELIST_KEY = 'formula-copy-whitelist';
var DEFAULT_WHITELIST = ['chatgpt.com'];

// ---- icon helpers ----------------------------------------------------------

function getDomain(url) {
  try { return new URL(url).hostname; } catch (_) { return ''; }
}

function setIcon(tabId, url) {
  chrome.storage.local.get(WHITELIST_KEY, function (data) {
    var list = data[WHITELIST_KEY] || DEFAULT_WHITELIST;
    var enabled = list.indexOf(getDomain(url)) !== -1;
    chrome.action.setIcon({
      tabId: tabId,
      path: enabled ? ACTIVE_ICON : INACTIVE_ICON
    });
  });
}

// ---- tab navigation --------------------------------------------------------

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tab.url) setIcon(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (chrome.runtime.lastError || !tab) return;
    if (tab.url) setIcon(tab.id, tab.url);
  });
});

// ---- whitelist init --------------------------------------------------------

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(WHITELIST_KEY, function (data) {
    if (!data[WHITELIST_KEY]) {
      chrome.storage.local.set({ [WHITELIST_KEY]: DEFAULT_WHITELIST });
    }
  });
});

// ---- messages from popup ---------------------------------------------------

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'update-whitelist') {
    // Refresh icon for all tabs after whitelist change
    chrome.tabs.query({}, function (tabs) {
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].url) setIcon(tabs[i].id, tabs[i].url);
      }
    });
  }
});
