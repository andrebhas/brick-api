// Task 2.1: Implement Path Normalizer
const NORMALIZATION_RULES = [
  { name: 'uuid', regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, replacement: '{uuid}' },
  { name: 'md5', regex: /\b[0-9a-fA-F]{32}\b/g, replacement: '{hash}' },
  { name: 'numeric_id', regex: /\b\d+\b/g, replacement: '{id}' },
  { name: 'slug', regex: /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g, replacement: '{slug}' },
];

function normalizePath(urlPath) {
  let normalized = urlPath;
  
  // Protect versioning segments (v1, v2, etc.)
  const versionSegments = normalized.match(/\/[vV]\d+\//g) || [];
  versionSegments.forEach((v, i) => { normalized = normalized.replace(v, `/__VER${i}__/`); });

  NORMALIZATION_RULES.forEach(rule => {
      normalized = normalized.replace(rule.regex, rule.replacement);
  });

  // Restore versioning segments
  versionSegments.forEach((v, i) => { normalized = normalized.replace(`/__VER${i}__/`, v); });
  return normalized;
}

// Task 2.2: Implement SHA-1 Fingerprinting
async function generateFingerprint(method, normalizedPath) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${method.toUpperCase()}:${normalizedPath}`);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Task 3.1: Chunked Storage Wrapper
const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
const QUOTA_LIMIT = 0.8; // 80%

class StorageManager {
  static async saveEndpoint(fingerprint, payload) {
    const metaKey = `meta_${fingerprint}`;
    const existing = await chrome.storage.local.get(metaKey);
    const existingMeta = existing[metaKey] || {};

    const dataStr = JSON.stringify(payload);
    const chunks = this._chunkString(dataStr, MAX_CHUNK_SIZE);
    
    const chunkKeys = chunks.map((_, i) => `${fingerprint}_part${i}`);
    const chunkData = {};
    chunks.forEach((chunk, i) => chunkData[chunkKeys[i]] = chunk);

    await chrome.storage.local.set({ 
        [metaKey]: { 
          ...existingMeta,
          parts: chunkKeys.length, 
          timestamp: Date.now(),
          normalizedPath: payload.normalizedPath,
          method: payload.method,
          hostname: payload.hostname
        },
        ...chunkData 
    });
    
    this._enforceLRU();
  }

  static _chunkString(str, size) {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      chunks[i] = str.substring(o, o + size);
    }
    return chunks;
  }

  // Task 3.2: LRU Eviction Logic (Batch Deletion)
  static async _enforceLRU() {
    let usage = await chrome.storage.local.getBytesInUse(null);
    const quotaLimit = 5242880; // 5MB generic quota limit
    const highWatermark = quotaLimit * 0.8; // 80%
    const lowWatermark = quotaLimit * 0.6; // 60%

    if (usage > highWatermark) {
      console.log(`Storage high usage: ${usage} bytes. Starting LRU eviction...`);
      const all = await chrome.storage.local.get(null);
      const metas = Object.entries(all)
        .filter(([k]) => k.startsWith('meta_'))
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const keysToRemove = [];
      let i = 0;
      while (usage > lowWatermark && i < metas.length) {
        const [metaKey, meta] = metas[i];
        const fingerprint = metaKey.replace('meta_', '');
        
        keysToRemove.push(metaKey);
        for (let j = 0; j < meta.parts; j++) {
            keysToRemove.push(`${fingerprint}_part${j}`);
        }
        
        // This is a rough estimation of freed space, but chrome.storage.local.remove is async
        // For accuracy, we could re-query usage, but batching is more efficient
        i++;
        // We'll just collect keys and remove in one go
      }
      
      if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
          const finalUsage = await chrome.storage.local.getBytesInUse(null);
          console.log(`LRU eviction complete. Removed ${i} endpoints. Final usage: ${finalUsage} bytes.`);
      }
    }
  }

  static async getEndpoint(fingerprint) {
    const metaObj = await chrome.storage.local.get(`meta_${fingerprint}`);
    const metaData = metaObj[`meta_${fingerprint}`];
    if (!metaData) return null;
    
    if (metaData.parts === undefined) {
        // This is an unchunked imported endpoint.
        try {
            if (typeof metaData.reqBody === 'string') metaData.reqBody = JSON.parse(metaData.reqBody);
            if (typeof metaData.resBody === 'string') metaData.resBody = JSON.parse(metaData.resBody);
        } catch(e) { }
        return metaData;
    }
    
    const { parts } = metaData;
    
    const chunkKeys = [];
    for (let i = 0; i < parts; i++) chunkKeys.push(`${fingerprint}_part${i}`);
    const chunks = await chrome.storage.local.get(chunkKeys);
    
    const fullStr = chunkKeys.map(k => chunks[k] || '').join('');
    if (!fullStr.trim()) return null;
    
    try {
        return JSON.parse(fullStr);
    } catch (e) {
        console.error("Failed to parse endpoint chunks for", fingerprint, e);
        return null;
    }
  }
}

// Background Task Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PROCESS_CAPTURE') {
    (async () => {
        const { url, method, queryParams, reqHeaders, reqBody, resBody, timestamp, hostname } = message.payload;
        const urlObj = new URL(url);
        const normalizedPath = normalizePath(urlObj.pathname);
        const fingerprint = await generateFingerprint(method, normalizedPath);
        
        await StorageManager.saveEndpoint(fingerprint, {
          url, method, queryParams, reqHeaders, reqBody, resBody, normalizedPath, timestamp, hostname
        });
    })();
  }

  if (message.action === 'GET_ENDPOINT') {
    StorageManager.getEndpoint(message.fingerprint)
        .then(sendResponse)
        .catch(err => {
            console.error("GET_ENDPOINT failed:", err);
            sendResponse(null);
        });
    return true; // Keep channel open for async
  }
});
