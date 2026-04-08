// Interceptor and PII Masking logic in the MAIN world
const SENSITIVE_KEYS = /password|secret|credit_card/i; // Removed 'token' and 'authorization' to allow editing in dashboard

function maskPII(data) {
  if (typeof data !== 'object' || data === null) return data;
  const sanitized = Array.isArray(data) ? [] : {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = maskPII(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function safeParse(str) {
    try { return JSON.parse(str); } catch { return str; }
}

// 1. Proxy window.fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const requestClone = new Request(...args);
  const response = await originalFetch(...args);
  const responseClone = response.clone();
  
  Promise.all([
    requestClone.text().catch(() => ''),
    responseClone.text().catch(() => '')
  ]).then(([reqBodyStr, resBodyStr]) => {
      let qParams = {};
      try {
          const params = new URL(requestClone.url).searchParams;
          for (const [k, v] of params.entries()) qParams[k] = v;
      } catch(e) {}

      let reqHeaders = {};
      requestClone.headers.forEach((v, k) => {
          reqHeaders[k.toLowerCase()] = v;
      });

      const captured = {
          url: requestClone.url,
          method: requestClone.method,
          queryParams: maskPII(qParams),
          reqHeaders: reqHeaders, // Added headers
          reqBody: maskPII(safeParse(reqBodyStr)),
          resBody: maskPII(safeParse(resBodyStr)),
          timestamp: Date.now(),
          hostname: window.location.hostname
      };
      window.postMessage({ type: 'API_CAPTURE', payload: captured }, '*');
  });

  return response;
};

// 2. Proxy XMLHttpRequest (XHR) - Task 1 & Task 6
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
    this._method = method;
    this._url = url;
    this._reqHeaders = {}; // Init headers storage
    return origOpen.apply(this, arguments);
};

const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (this._reqHeaders) {
        this._reqHeaders[header.toLowerCase()] = value;
    }
    return origSetRequestHeader.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener('load', function() {
        const finalUrl = this._url.startsWith('http') ? this._url : window.location.origin + this._url;
        let qParams = {};
        try {
            const params = new URL(finalUrl).searchParams;
            for (const [k, v] of params.entries()) qParams[k] = v;
        } catch(e) {}

        let responseTextFallback = '';
        try {
            if (!this.responseType || this.responseType === 'text') {
                responseTextFallback = this.responseText;
            } else if (this.responseType === 'json') {
                responseTextFallback = JSON.stringify(this.response);
            } else if (this.responseType === 'blob' || this.responseType === 'arraybuffer') {
                responseTextFallback = '[Binary Data]';
            } else {
                responseTextFallback = String(this.response || '');
            }
        } catch (e) {
            responseTextFallback = '';
        }

        const captured = {
            url: finalUrl,
            method: this._method,
            queryParams: maskPII(qParams),
            reqHeaders: this._reqHeaders || {}, // Added headers
            reqBody: maskPII(safeParse(body)),
            resBody: maskPII(safeParse(responseTextFallback)),
            timestamp: Date.now(),
            hostname: window.location.hostname
        };
        window.postMessage({ type: 'API_CAPTURE', payload: captured }, '*');
    });
    return origSend.apply(this, arguments);
};
