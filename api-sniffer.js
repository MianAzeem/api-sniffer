const { chromium } = require('playwright');
const fs = require('fs');

// ======================================================
// STORAGE
// ======================================================

const logs = [];
const pending = new Map();

const openapi = {
  openapi: "3.0.0",
  info: {
    title: "Captured API (Playwright Reverse Engineered)",
    version: "1.0.0"
  },
  paths: {}
};

// ======================================================
// FILTER RULES
// ======================================================

const EXCLUDED_PATTERNS = [

  // Static assets
  '.js',
  '.css',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.mp3',
  '.mp4',
  '.webm',
  '.avi',
  '.mov',

  // Browser / blob
  'blob:',
  'data:',

  // CDN / Cloudflare
  'cdn-cgi',

  // Telemetry / monitoring
  'datadog',
  'fullstory',
  'sentry',
  'newrelic',
  'hotjar',
  'segment',
  'mixpanel',
  'amplitude',
  'google-analytics',
  'googletagmanager',

  // Support / widgets
  'zendesk',
  'web_widget',
  'intercom',

  // Fonts / CDNs
  'gstatic',
  'googleapis',
  'fonts.googleapis',
  'fonts.gstatic',

  // Extensions
  'chrome-extension',
  'moz-extension',

  // Guides / misc
  'guide-content'
];

// ======================================================
// HELPERS
// ======================================================

function shouldExclude(url) {
  if (!url) return true;

  const lower = url.toLowerCase();

  return EXCLUDED_PATTERNS.some(pattern =>
    lower.includes(pattern)
  );
}

function isLikelyAPI(url) {
  return (
    url.includes('/api/') ||
    url.includes('/graphql') ||
    url.includes('/rest/')
  );
}

function saveLogs(entry) {
  logs.push(entry);

  fs.writeFileSync(
    'api-log.json',
    JSON.stringify(logs, null, 2)
  );
}

function saveOpenAPI() {
  fs.writeFileSync(
    'openapi.json',
    JSON.stringify(openapi, null, 2)
  );
}

function classify(url) {

  if (url.includes('/auth') || url.includes('/login')) {
    return 'AUTH';
  }

  if (url.includes('/profile') || url.includes('/user')) {
    return 'USER';
  }

  if (url.includes('/fraudwatch')) {
    return 'FRAUDWATCH';
  }

  if (url.includes('/carrier')) {
    return 'CARRIER';
  }

  if (url.includes('/aggregation')) {
    return 'ANALYTICS';
  }

  return 'OTHER';
}

function extractQuery(fullUrl) {

  try {

    const url = new URL(fullUrl);
    const result = {};

    for (const [key, value] of url.searchParams.entries()) {

      try {
        result[key] = JSON.parse(decodeURIComponent(value));
      } catch {
        result[key] = value;
      }
    }

    return Object.keys(result).length ? result : null;

  } catch {
    return null;
  }
}

function safeBody(req) {

  try {
    return req.postDataJSON();
  } catch {

    try {
      return req.postData();
    } catch {
      return null;
    }
  }
}

function getPath(url) {

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function extractShape(data) {

  if (!data) return null;

  if (Array.isArray(data)) {

    return {
      type: 'array',
      sampleKeys: Object.keys(data[0] || {})
    };
  }

  if (typeof data === 'object') {

    return {
      type: 'object',
      keys: Object.keys(data)
    };
  }

  return typeof data;
}

// ======================================================
// OPENAPI BUILDER
// ======================================================

function addToOpenAPI(api) {

  const path = getPath(api.url);
  const method = (api.method || 'get').toLowerCase();

  if (!openapi.paths[path]) {
    openapi.paths[path] = {};
  }

  const entry = openapi.paths[path][method] || {
    summary: api.category,
    responses: {}
  };

  entry.summary = api.category;

  // Request examples
  if (api.query || api.body) {

    entry.requestBody = {
      content: {
        'application/json': {
          example: api.body || api.query
        }
      }
    };
  }

  // Response examples
  entry.responses[api.status || 200] = {
    description: 'Captured Response',
    content: {
      'application/json': {
        example: api.response
      }
    }
  };

  openapi.paths[path][method] = entry;

  saveOpenAPI();
}

// ======================================================
// MAIN
// ======================================================

(async () => {

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  console.log('\n🚀 API Sniffer Started...\n');

  // ======================================================
  // REQUEST CAPTURE
  // ======================================================

  page.on('request', (req) => {

    const url = req.url();

    // Skip unwanted traffic
    if (
      shouldExclude(url) ||
      !isLikelyAPI(url)
    ) {
      return;
    }

    const key = req._guid;

    const requestData = {
      method: req.method(),
      url: url,
      endpoint: getPath(url),
      category: classify(url),
      query: extractQuery(url),
      body: safeBody(req),
      timestamp: Date.now()
    };

    pending.set(key, requestData);

    console.log(`[REQ] ${requestData.method} ${requestData.endpoint}`);
  });

  // ======================================================
  // RESPONSE CAPTURE
  // ======================================================

  page.on('response', async (res) => {

    const url = res.url();

    // Skip unwanted traffic
    if (
      shouldExclude(url) ||
      !isLikelyAPI(url)
    ) {
      return;
    }

    const req = res.request();
    const key = req._guid;

    let responseJson = null;

    try {

      const contentType =
        res.headers()['content-type'] || '';

      if (contentType.includes('application/json')) {
        responseJson = await res.json();
      }

    } catch {}

    const requestData =
      pending.get(key) || {};

    const apiCall = {

      type: 'api_call',

      method: requestData.method || req.method(),

      url: url,

      endpoint: getPath(url),

      category: classify(url),

      query: requestData.query || null,

      body: requestData.body || null,

      status: res.status(),

      response: responseJson,

      responseShape: extractShape(responseJson),

      timestamp: Date.now()
    };

    console.log(
      `[RES] ${apiCall.status} ${apiCall.endpoint}`
    );

    saveLogs(apiCall);

    addToOpenAPI(apiCall);

    pending.delete(key);
  });

  // ======================================================
  // START PAGE
  // ======================================================

  await page.goto('https://example.com', {
    waitUntil: 'domcontentloaded'
  });

  console.log('\n✅ Browser Ready');
  console.log('Navigate to your target application manually.\n');

})();
