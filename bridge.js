// Bridging messages from MAIN world to the background script
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data.type || event.data.type !== 'API_CAPTURE') return;
    chrome.runtime.sendMessage({ action: 'PROCESS_CAPTURE', payload: event.data.payload });
});
