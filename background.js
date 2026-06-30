/**
 * Toggles the extension icon between active (green) and inactive (grey)
 * depending on whether the current tab is on chatgpt.com.
 *
 * Avoids the "tabs" permission: we rely on host_permissions for
 * chatgpt.com to populate changeInfo.url when navigating to/within
 * ChatGPT, and default to inactive when the URL is absent (meaning
 * the page is outside our host permission scope).
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

function setIcon(tabId, url) {
  var isChatGPT = /^https?:\/\/chatgpt\.com(\/|$)/.test(url || '');
  chrome.action.setIcon({
    tabId: tabId,
    path: isChatGPT ? ACTIVE_ICON : INACTIVE_ICON
  });
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // changeInfo.url is only present when we have host permissions for it.
  // If absent, the new URL is outside chatgpt.com → inactive.
  if (changeInfo.url) {
    setIcon(tabId, changeInfo.url);
  } else if (changeInfo.status === 'complete') {
    setIcon(tabId, ''); // no URL → default to inactive
  }
});
