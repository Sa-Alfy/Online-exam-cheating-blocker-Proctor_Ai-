# 🚀 Proctor AI: The Final Push (Release Roadmap)

This document outlines the critical steps required to transition Proctor AI from a development/testing environment to a stable, production-ready release for institutions and the Chrome Web Store.

---

## 🔍 Phase 1: Security & Hardening (Critical)
The most urgent priority is protecting student data and preventing unauthorized access to the logging infrastructure.

*   [ ] **Dashboard Authentication**: 
    *   Implement a secure login page for `/dashboard`.
    *   Store hashed administrative credentials in `.env`.
    *   Restrict `/clear` and `/export` routes to authenticated sessions only.
*   [ ] **API Authentication**: 
    *   Implement a shared secret (API Key) between the extension and backend.
    *   Verify headers on every `/log` and `/session` request.
*   [ ] **CORS Locking**: 
    *   Replace wildcards in CORS configuration with the final published Extension ID.
*   [ ] **Production Environment Variables**: 
    *   Enforce `DEBUG=False` in all production deployments.
    *   Ensure absolute paths for logs and databases are globally unique per installation.

---

## 🛠️ Phase 2: Reliability & Scalability
Ensuring the system can handle full exam cohorts (50-200+ students) simultaneously.

*   [ ] **Database Migration (SQLite to PostgreSQL)**: 
    *   Prepare SQLAlchemy or direct driver support for PostgreSQL (Standard for PythonAnywhere/Heroku/AWS).
    *   SQLite may lock under high concurrent write loads.
*   [ ] **Robust Rate Limiting**: 
    *   Migrate from in-memory dictionary limiting to `flask-limiter` for multi-worker stability.
*   [ ] **Extension Retry Logic**: 
    *   Implement a local queue in the extension to retry logs if the backend is unreachable or the student's WiFi drops.

---

## 🎨 Phase 3: Extension Polish & Branding
Building trust through professional design and optimized code.

*   [ ] **Professional Icon Set**: 
    *   Generate official icons (16px, 48px, 128px) for `manifest.json`.
*   [ ] **UI/UX Cleanup**: 
    *   Refine `popup.html` with institutional branding.
    *   Add better loading states and detailed error messages for the user.
*   [ ] **Code Minification**: 
    *   Use a build script (Vite/Webpack or a simple minifier) to reduce extension size and protect source logic.

---

## 🧪 Phase 4: Quality Assurance (QA)
Validating that the proctoring "cannot be bypassed" easily.

*   [ ] **Edge Case Testing**: 
    *   Simulate battery death, network loss, and "Incognito" mode.
*   [ ] **Cross-Platform Validation**: 
    *   Verify behavior on Windows, macOS, and ChromeOS (especially regarding window focusing).
*   [ ] **Automated Tests**: 
    *   Write unit tests for the backend validation logic.
    *   Implement basic E2E tests for the "Start/Stop Session" flow.

---

## 📦 Phase 5: Packaging & Distribution
Preparing for the final upload.

*   [ ] **Clean ZIP Creation**: 
    *   Create a release script that excludes `.git`, `__pycache__`, and `.env` files.
*   [ ] **Web Store Submission**: 
    *   Write the Privacy Policy (required for proctoring tools).
    *   Capture high-quality store screenshots.
*   [ ] **Institutional Setup Guide**: 
    *   Finalize `QUICKSTART.md` for schools to deploy their own backend instance.

---

## ✅ Success Metrics
A build is considered "Stable" when:
1.  **Zero-Log Leakage**: No unauthenticated user can see violation data.
2.  **Concurrency Ready**: Backend handles 100 simultaneous "Start Exam" requests without delay.
3.  **Store Ready**: Extension passes the Chrome Web Store automated validator with zero warnings.
