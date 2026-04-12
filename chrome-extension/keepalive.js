// Keeps the background service worker alive by maintaining a persistent port connection
chrome.runtime.connect({ name: 'keepalive' })
