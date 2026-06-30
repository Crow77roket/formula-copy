/**
 * Toggle the extension icon between active (green) and inactive (grey)
 * based on whether the current tab is on chatgpt.com.
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

var CHATGPT = /^https?:\/\/chatgpt\.com(\/|$)/;

function setIcon(tabId, url) {
  chrome.action.setIcon({
    tabId: tabId,
    path: CHATGPT.test(url || '') ? ACTIVE_ICON : INACTIVE_ICON
  });
}

// Tab navigations / reloads / SPA pushState
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tab.url) setIcon(tabId, tab.url);
});

// User switches to a different tab
chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (chrome.runtime.lastError) return;
    if (tab && tab.url) setIcon(tab.id, tab.url);
  });
});
