const { chromium } = require('playwright');
const fs = require('fs');

// =========================
// STORAGE
// =========================
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

// =========================
// HELPERS
// =========================
function saveLogs(entry) {
  logs.push(entry);
  fs.writeFileSync('api-log.json', JSON.stringify(logs, null, 2));
}

function saveOpenAPI() {
  fs.writeFileSync('openapi.json', JSON.stringify(openapi, null, 2));
}

function classify(url) {
  if (url.includes('/auth') || url.includes('/login')) return 'AUTH';
  if (url.includes('/user') || url.includes('/profile')) return 'USER';
  if (url.includes('/fraudwatch')) return 'RISK_ANALYTICS';
  if (url.includes('/carrier')) return 'CARRIER';
  if (url.includes('/aggregation')) return 'AGGREGATION';
  return 'OTHER';
}

function extractQuery(fullUrl) {
  try {
    const u = new URL(fullUrl);
    const obj = {};

    for (const [k, v] of u.searchParams.entries()) {
      try {
        obj[k] = JSON.parse(decodeURIComponent(v));
      } catch {
        obj[k] = v;
      }
    }

    return Object.keys(obj).length ? obj : null;
  } catch {
    return null;
  }
}

function safeBody(req) {
  try {
    return req.postDataJSON();
  } catch {
    return req.postData();
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
      type: "array",
      sampleKeys: Object.keys(data[0] || {})
    };
  }

  if (typeof data === 'object') {
    return {
      type: "object",
      keys: Object.keys(data)
    };
  }

  return typeof data;
}

// =========================
// OPENAPI BUILDER
// =========================
function addToOpenAPI(api) {
  const path = getPath(api.url);
  const method = (api.method || "get").toLowerCase();

  if (!openapi.paths[path]) {
    openapi.paths[path] = {};
  }

  const entry = openapi.paths[path][method] || {
    summary: api.category,
    responses: {}
  };

  entry.summary = api.category;

  if (api.query || api.body) {
    entry.requestBody = {
      content: {
        "application/json": {
          example: api.body || api.query
        }
      }
    };
  }

  entry.responses[api.status || 200] = {
    description: "Captured Response",
    content: {
      "application/json": {
        example: api.response
      }
    }
  };

  openapi.paths[path][method] = entry;

  saveOpenAPI();
}

// =========================
// MAIN
// =========================
(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🚀 FULL API SNIFER + OPENAPI ENGINE STARTED\n');

  // =========================
  // REQUEST
  // =========================
  page.on('request', (req) => {
    const key = req._guid;

    const entry = {
      method: req.method(),
      url: req.url(),
      category: classify(req.url()),
      query: extractQuery(req.url()),
      body: safeBody(req),
      ts: Date.now()
    };

    pending.set(key, entry);
  });

  // =========================
  // RESPONSE
  // =========================
  page.on('response', async (res) => {
    const req = res.request();
    const key = req._guid;

    let json = null;

    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('application/json')) {
        json = await res.json();
      }
    } catch {}

    const reqData = pending.get(key) || {
      method: req.method(),
      url: res.url(),
      category: classify(res.url())
    };

    const apiCall = {
      type: "api_call",
      method: reqData.method,
      url: res.url(),
      endpoint: getPath(res.url()),
      category: classify(res.url()),
      query: reqData.query || null,
      body: reqData.body || null,
      status: res.status(),
      response: json,
      responseShape: extractShape(json),
      ts: Date.now()
    };

    console.log(`[API] ${apiCall.status} ${apiCall.endpoint}`);

    saveLogs(apiCall);

    addToOpenAPI(apiCall);

    pending.delete(key);
  });

  // =========================
  // START PAGE
  // =========================
  await page.goto('https://example.com', {
    waitUntil: 'domcontentloaded'
  });

  console.log('\n✅ READY — full API + OpenAPI capture active\n');
})();