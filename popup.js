document.getElementById('open-dashboard').onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
};

async function updateStats() {
    const data = await chrome.storage.local.get(null);
    const count = Object.keys(data).filter(k => k.startsWith('meta_')).length;
    document.getElementById('stats').innerText = `${count} Endpoints Captured.`;
}

updateStats();
setInterval(updateStats, 2000);
