# 🚀 Playwright API Sniffer + OpenAPI Generator

A powerful reverse engineering tool built with **Playwright** that captures real-time API traffic from web applications and automatically generates structured API intelligence.

This tool helps you understand how modern frontend applications communicate with backend systems by observing real network behavior in a live browser environment.

---

## 🧠 Overview

The sniffer launches a managed Chromium instance and intercepts network traffic to:

* **Capture** all API requests (`GET`, `POST`, `PUT`, `DELETE`).
* **Intercept** API responses including full JSON bodies.
* **Decode** complex query parameters, including encoded JSON filters.
* **Extract** request payloads and correlate them with their specific responses.
* **Generate** structured outputs including OpenAPI (Swagger) specs and detailed interaction logs.

---

## 📦 Features

* ✅ **Network Interception**: Full capture of `fetch` and `XHR` requests.
* ✅ **Payload Extraction**: Automatic JSON parsing and query parameter decoding.
* ✅ **Response Analysis**: Schema inference and structure detection.
* ✅ **API Classification**: Automatically categorizes endpoints such as `AUTH`, `USER`, or `RISK_ANALYTICS`.
* ✅ **OpenAPI Generator**: Converts live traffic into a documentation-ready OpenAPI specification.

---

## 🛠️ Installation

### Prerequisites
* **Node.js** >= 18
* **npm**

### Setup
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/playwright-api-sniffer.git](https://github.com/your-username/playwright-api-sniffer.git)
    cd playwright-api-sniffer
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Install Playwright browsers:**
    ```bash
    npx playwright install chromium
    ```

---

## ▶️ Usage

1.  **Run the sniffer:**
    ```bash
    node api-sniffer.js
    ```
2.  **Interact with the App:**
    * A Chromium browser will open automatically.
    * Navigate to your target web application and log in.
    * Perform actions like clicking buttons or opening dashboards to trigger API calls.
3.  **Collect Results:**
    Once you close the browser or stop the script, two files are generated in your directory:
    * 📄 `api-log.json`: Raw and structured API traffic logs.
    * 📄 `openapi.json`: Auto-generated API documentation in Swagger-style.

---

## 📊 Example Output

### Captured API Interaction (`api-log.json`)
```json
{
  "method": "GET",
  "url": "/api/v3/fraudwatch/carrier_companies/risk_level_aggregation",
  "query": {
    "filters": {
      "group_id": null,
      "in_network": true
    }
  },
  "response": [
    {
      "high_risk": 4,
      "low_risk": 6,
      "medium_risk": 0
    }
  ],
  "status": 200
}
```

## 💡 Use Cases
- Reverse Engineering: Map out how a web application's frontend talks to its backend.
- Undocumented APIs: Generate documentation for legacy systems or internal APIs automatically.
- Security Auditing: Analyze data being sent to the backend for sensitive information leaks.
- Architecture Discovery: Understand the data models and endpoint structures of complex systems.

## ⚠️ Disclaimer
This tool is intended only for:
-Educational purposes
- Debugging your own systems
- Authorized security testing
- Do NOT use this tool on systems you do not own or do not have explicit permission to analyze.
