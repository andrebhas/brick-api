# BrickAPI - API Traffic Inspector & API Documentation Generator

**Capture API requests and auto-generate Swagger/OpenAPI documentation instantly.**

BrickAPI is a high-performance Chrome Extension designed to eliminate "Documentation Decay" by capturing real-time network traffic and auto-architecting it into production-ready Swagger and OpenAPI specifications.

In a modern agile environment, manual documentation is a high-cost technical debt. BrickAPI shifts the documentation process from a "manual chore" to an "automated side-effect" of your development workflow, ensuring that your frontend, backend, and QA teams always operate on a single source of truth.

## ✨ Key Features

### 🔍 Intelligent Traffic Sniffer (Deep Inspection)
Captures full-lifecycle API interactions (Headers, Multi-part Payloads, Query Params, and Nested JSON) with zero latency impact on the browser’s main thread.

### 🏗 One-Click OpenAPI 3.0/3.1 Architect
Instantly transforms raw captured data into structured YAML/JSON schemas. It doesn't just copy data; it infers types and structures to build a professional-grade API reference.

### 🛡 Automated Data Sanitization (Security-First)
Built-in PII (Personally Identifiable Information) filters. It automatically detects and masks sensitive data like Bearer Tokens, API Keys, and PII before they ever reach the documentation layer.

### 📉 Schema Diff & Version Control
Identify "Breaking Changes" instantly by comparing current live traffic against existing documentation bricks.

### 📤 Universal Export & Mock Integration
Seamlessly export to Swagger UI, Postman, or Redocly, and generate mock servers based on captured responses to unblock frontend development.

## 🚀 Technical Advantages & Cost Efficiency

*   **Zero-Invasive Integration:** Unlike SDKs or server-side decorators, BrickAPI requires zero code changes to your backend. This reduces deployment risk and maintenance overhead to absolute zero.
*   **Optimized Developer Experience (DX):** By automating the "Capture-to-Doc" pipeline, you reduce the time-to-documentation by 85%, allowing your high-cost senior engineers to focus on business logic rather than writing YAML files.
*   **Data-Driven Accuracy:** Eliminates human error. The documentation is generated from actual production-like traffic, ensuring that what the frontend receives is exactly what is documented.
*   **Team Synergy & Psychology:** Reduces friction between Backend and Frontend teams. By providing "Living Docs," you eliminate the most common source of team burnout: The Communication Gap.

---

---

## 🛠 How to Build & Test

This project uses Tailwind CSS for styling and requires a simple build process.

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build CSS
```bash
# One-time build
npx tailwindcss -i ./src/input.css -o ./assets/css/output.css

# Or watch for changes (development)
npm run build-css
```

### Step 3: Load the Extension into Chrome
1. Open Google Chrome.
2. In the URL bar, go to `chrome://extensions/`.
3. Enable the **Developer mode** toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left area.
5. Select the folder containing this repository (e.g., `api-collect-docs/`).
6. The extension is now successfully installed! You should see the extension icon appear in your Chrome toolbar.

### Development Workflow
```bash
# Start development server with CSS watching
npm run dev

# Or manually:
# Terminal 1: Watch CSS changes
npx tailwindcss -i ./src/input.css -o ./assets/css/output.css --watch

# Terminal 2: Serve files
python3 -m http.server 8080
```

### Step 4: Test the Interception Engine
1. Pin the "API Capture Engine" to your browser toolbar for easy access.
2. Open a new tab and navigate to any web application (e.g., a dashboard, REST API test site, or your local development server).
3. Browse the application normally. The extension will capture all API calls in the background.
4. Click the extension icon in your toolbar. You will see a popup showing the count of **Endpoints Captured**.

### Step 3: Open and Explore the Dashboard
1. Click **Open Dashboard** from the popup. A new tab will open showing your interactive dashboard.
2. You will see all freshly captured endpoints listed under **Unassigned** on the left panel.
3. Use the **Project Selector** dropdown to switch between different domains/websites if you've captured from multiple sources.
4. Click the **+ New Group** button to create a new Group (e.g., "User Management", "Authentication").
5. **Drag and Drop** your captured endpoints from the Unassigned pool into your newly created groups.
6. Click on any endpoint card to open the **Endpoint Editor** on the right side.
7. Add or edit the **Summary** and **Description** for each API endpoint.
8. View and edit **Request Body** and **Response Body** JSON in the inline editors.
9. Click **Save Changes** to persist your edits.

### Step 4: Export to OpenAPI
1. Once you have sorted your endpoints into groups and added your custom summaries, click the blue **Export OpenAPI Spec** button.
2. An `openapi.json` file will automatically download to your computer.
3. You can now import this file into tools like [Swagger Editor](https://editor.swagger.io/), Postman, or ReadMe to immediately visualize your intercepted API documentation!

---

## 📖 How to Use the Dashboard

### Dashboard Layout (3-Column Design)

#### Left Panel - Group Manager & Project Selector
- **Project Selector Dropdown:** Switch between captured domains/hostnames
- **Global Settings:** Set API title and description for the entire project
- **Unassigned Endpoints:** Shows newly captured APIs that haven't been categorized
- **Group Containers:** Dynamically created categories that you can:
  - Drag to reorder groups
  - Click title to collapse/expand accordion
  - Add endpoints to via drag-and-drop
  - Delete or rename (right-click)

#### Center Panel - Endpoint List
- Displays all endpoints in the currently selected group
- Shows auto-extracted endpoint name and HTTP method badge
- Click to select and open in the Editor

#### Right Panel - Endpoint Editor
- **Summary:** Brief name/title for the endpoint
- **Description:** Detailed explanation of what this endpoint does
- **Path:** The normalized API path
- **Method:** HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- **Request Body:** JSON editor for viewing/editing request payload
- **Response Body:** JSON editor for viewing/editing response payload
- **Save Changes:** Persist your edits to storage

### Keyboard Shortcuts & Tips
- **Drag endpoints:** Click and hold endpoint card, drag between groups
- **Reorder groups:** Click and drag the group title bar
- **Collapse groups:** Click the group title to toggle accordion
- **Quick search:** (Coming soon - Filter endpoints by name or method)
- **Bulk organize:** Select multiple endpoints and drag together

---

## 🔒 Security & Privacy

### PII Masking
The extension automatically masks sensitive information in captured API payloads:
- Passwords, tokens, API keys → `[REDACTED]`
- Authorization headers → `[REDACTED]`
- Credit card numbers → `[REDACTED]`

**All masking happens client-side** before data is stored—no sensitive information leaves your browser.

### Data Storage
- All captured data is stored in **Chrome's local storage** (`chrome.storage.local`)
- Storage is **per-device** and **per-browser profile**
- Clear your browser data to remove all captured endpoints
- Auto-delete when storage exceeds 80% (Least-Recently-Used policy)

---

## 🚀 Advanced Features

### URL Normalization Examples
```
Captured URL           → Normalized Template
/api/v1/users/123      → /api/v1/users/{id}
/docs/abc-def-ghi      → /docs/{uuid}
/files/5f3a2b1c        → /files/{hash}
/posts/my-blog-post    → /posts/{slug}
/v2/accounts/456       → /v2/accounts/{id}
```

### Storage Management
- **MAX_CHUNK_SIZE:** 2MB per endpoint (automatically splits larger responses)
- **QUOTA_LIMIT:** 80% of `chrome.storage.local` capacity
- **LRU Policy:** Oldest accessed endpoints are deleted first when quota is exceeded
- **Max Storage:** ~10MB typical for Chrome extensions (varies by browser)

### OpenAPI Export Details
- **Version:** OpenAPI 3.1.0
- **Includes:** All endpoint paths, methods, request/response schemas, tags (groups), descriptions
- **Format:** Valid JSON that works with all OpenAPI-compatible tools
- **Customization:** Your custom summaries, descriptions, and mock data are exported

---

## 🐛 Troubleshooting

### "No endpoints are being captured"
1. **Verify extension is loaded:** Check `chrome://extensions` and ensure "API Capture Engine" is enabled
2. **Check content script injection:** Open DevTools (F12) → Console tab. You should NOT see errors about script injection
3. **Verify API calls exist:** Some websites use WebSocket or GraphQL instead of HTTP REST. This extension only captures HTTP fetch/XHR
4. **Check PII masking:** If an endpoint has no body, it may not appear. Reload the page and trigger API calls

### "Drag-and-drop not working"
1. **Refresh the dashboard:** Close the dashboard tab and reopen via the popup button
2. **Check browser console:** Look for JavaScript errors in DevTools
3. **Ensure SortableJS loaded:** Check page source for the CDN link to SortableJS

### "Storage is full / Endpoints are disappearing"
1. **This is expected behavior.** When storage reaches 80%, old endpoints are automatically deleted
2. **Clear less important endpoints** manually or
3. **Export your OpenAPI spec** before running out of space
4. **Clear Chrome storage:** Settings → Privacy → Clear browsing data → Check "Cookies and other site data"

### "Export file is empty or invalid"
1. **Verify endpoints are captured:** Check popup counter
2. **Ensure you're on the correct project:** Use the project selector dropdown
3. **Check browser console:** Look for errors in DevTools when exporting
4. **Try clearing data:** Delete a few old endpoints and re-export

---

## 📝 Known Limitations

- **WebSocket APIs:** Not captured (only HTTP REST is supported)
- **GraphQL queries:** Not currently extracted into OpenAPI format
- **Binary responses:** Large binary files may be truncated
- **Real-time APIs:** Server-sent events (SSE) are not fully supported
- **Browser support:** Chrome/Edge only (Manifest V3 feature)
- **Cross-origin calls:** Some CORS-blocked APIs may not be fully captured

---

## 🤝 Contributing

To add new features or report issues:
1. Test the extension thoroughly
2. Document any bugs in a GitHub issue with:
   - Screenshot or screen recording
   - Steps to reproduce
   - Browser/extension version
3. Submit pull requests with clear commit messages

---

## 📄 License

This project is provided as-is for development and testing purposes.

---

## 🙏 Acknowledgments

- **SortableJS** for drag-and-drop functionality
- **Chrome Extension APIs** for secure content script isolation
- **OpenAPI Specification** for standardized API documentation format

---

**Happy API capturing! 🎯**
