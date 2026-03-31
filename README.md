# Proctor AI 🎓

Professional exam proctoring system with real-time violation monitoring and session management.

**Backend**: Flask REST API with SQLite database  
**Frontend**: Chrome Extension (Manifest V3) + Web Dashboard  
**Deployment**: PythonAnywhere (Production) | Local development (http://127.0.0.1:5000)

---

## 📋 Features

### Session-Based Monitoring ✅
- **Exam Sessions**: Each student exam has a unique session ID (UUID)
- **START/STOP Lifecycle**: Students click "Start Exam" → monitoring begins, "Stop Exam" → session ends
- **Session Grouping**: Dashboard groups all violations by exam session
- **Student Identity**: Track student name and ID throughout session

### Violation Detection 👁️
Detects and logs:
- **Tab Switches** - Student switched away from exam tab
- **Focus Loss** - Browser window lost focus (ALT+TAB, etc.)
- **URL Navigation** - Student navigated to different domain
- **Copy/Paste** - Student attempted Ctrl+C/Ctrl+V
- **Fullscreen Exit** - Student exited fullscreen mode

### Dashboard UI 📊
- **Accordion Sessions**: Expandable session cards with visual indicators
- **Violation Details**: Click to expand and see every violation with:
  - 📋 Violation type (Tab Switched, Copy/Paste, etc.)
  - ⏰ Exact timestamp (date + time down to seconds)
  - 🌐 Page URL where violation occurred
- **Real-time Stats**: Sessions count, total violations, unique students tracked
- **Dark Mode Support**: Full dark theme with Tailwind-like colors
- **Auto-Refresh**: Dashboard updates every 5 seconds automatically
- **Responsive Design**: Mobile-friendly accordion layout

### Security 🔒
- **Dynamic Backend URL**: Extension configured via environment variables at build time (no hardcoding)
- **CORS Configuration**: Restricted cross-origin requests to trusted origins
- **Rate Limiting**: 60 requests per minute per IP address
- **Input Validation**: All student data validated before database insertion
- **Environment Detection**: Automatic path adjustment for PythonAnywhere vs. local

---

## 🏗️ Architecture

```
proctor_project/
├── backend/
│   ├── app.py                    # Flask backend (7 API routes)
│   ├── pythonanywhere_wsgi.py    # WSGI entry point for PythonAnywhere
│   ├── requirements.txt          # Python dependencies
│   ├── templates/
│   │   └── dashboard.html        # Modern accordion dashboard (dark mode)
│   └── [auto-generated]
│       ├── proctor.db            # SQLite database
│       └── proctor.log           # Application logs
├── extension/
│   ├── manifest.json             # Manifest V3 configuration
│   ├── background.js             # Service worker (violation logging)
│   ├── content.js                # Page monitoring (violation detection)
│   ├── popup.html                # Extension popup UI
│   └── popup.js                  # Session management (START/STOP)
├── README.md                     # This file
├── QUICKSTART.md                 # Quick setup guide (5 minutes)
├── TROUBLESHOOTING.md            # Common issues & solutions
└── LICENSE                       # MIT License
```

---

## 🚀 Quick Start (5 Minutes)

### Local Development

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Run backend server
python app.py

# Expected output:
# ============================================================
# Starting Proctor AI Backend Server...
# Database: proctor.db
# Logging to: proctor.log
# 📊 Dashboard: http://127.0.0.1:5000/dashboard
# 💊 Health Check: http://127.0.0.1:5000/health
# Server ready!
# ============================================================
```

### Load Extension in Chrome

**Before loading the extension, you must build it to inject your configuration:**

```bash
# Build the extension with your backend URL
python build-extension.py           # Recommended (Python 3)
# OR
node build-extension.js             # If you have Node.js

# This generates:
# - extension/config.js (with your backend URL)
# - Updated extension/manifest.json (with correct permissions)
```

Now load in Chrome:

1. Open `chrome://extensions/`
2. Toggle "Developer mode" (top-right corner)
3. Click "Load unpacked"
4. Select the `extension/` folder
### Test System

1. **Click extension icon** → Enter student name & ID → Click "▶️ Start Exam"
2. **Switch browser tabs** → This triggers a violation
3. **View dashboard** → Open `http://127.0.0.1:5000/dashboard`
4. **Click session card** → Expand to see violation details

For detailed setup, see **[QUICKSTART.md](QUICKSTART.md)**

---

## 🌐 Production Deployment

**For detailed step-by-step deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

### Quick Overview:

The deployment process involves:
1. **Configure extension** for your production URL
2. **Build extension** to inject your backend URL
3. **Security audit** before making repo public
4. **PythonAnywhere setup** with environment variables

### Configuration

```bash
# 1. Edit extension/.env with your PythonAnywhere domain
BACKEND_URL=https://your-username.pythonanywhere.com

# 2. Build the extension
python build-extension.py

# 3. Load extension in browser
# chrome://extensions/ > Load unpacked > extension/

# 4. Copy the extension ID and configure backend CORS
# See DEPLOYMENT.md for complete setup
```

### Without Hardcoding:

Unlike the old approach, the extension URL is **no longer hardcoded** in the source code. Instead:

- **Before deployment**: Edit `extension/.env` with your target URL
- **Build process**: `python build-extension.py` injects the URL into:
  - `extension/config.js` (used by popup and background worker)
  - `extension/manifest.json` (CORS permissions)
- **Source code**: Stays generic and safe for public repositories

### Live Server:

The extension is configured to point to your deployment URL after building. Dashboard available at:
```
https://your-username.pythonanywhere.com/dashboard
```

---

## 🔌 API Endpoints

| Method | Endpoint | Purpose | Returns |
|--------|----------|---------|----------|
| `POST` | `/session` | START/END exam sessions | `{session_id: UUID}` |
| `POST` | `/log` | Log violation with session_id | `{status: success}` |
| `GET` | `/sessions` | Get grouped sessions with counts | Sessions array |
| `GET` | `/dashboard` | Render HTML dashboard | HTML page |
| `POST` | `/clear` | Delete all violation records | `{status: success}` |
| `GET` | `/health` | Health check endpoint | `{status: healthy}` |
| `GET` | `/api/violations` | Get raw violations (legacy) | Violations array |

---

## 📊 Database Schema

**violations table:**
```sql
CREATE TABLE violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,                    -- UUID for current exam session
    student_info TEXT NOT NULL,         -- Student name + ID (e.g., "John Doe (2024-001)")
    type TEXT NOT NULL,                 -- Violation type (Tab Switched, Copy/Paste, etc.)
    timestamp TEXT NOT NULL,            -- ISO format datetime
    url TEXT NOT NULL                   -- Current page URL
);
```

---

## 🔒 Security Features

✅ **Hardcoded Backend URL** - Students cannot redirect violations to malicious server  
✅ **No Settings UI** - Extension has no configuration options for students  
✅ **HTTPS in Production** - All communication encrypted on PythonAnywhere  
✅ **Rate Limiting** - 60 requests/minute per IP prevents brute force attacks  
✅ **Input Validation** - All data sanitized before database insertion  
✅ **CORS Restricted** - Only specific origins allowed  
✅ **Type Annotations** - Pylance compatibility for production-ready code  

---

### Recent Updates (v1.2) - 2026-03-31

#### Bug Fixes 🐛
- ✅ **Fixed F12 & Right Click Blocking**: Resolved a critical bug where DevTools and Context Menu were blocked globally even when an exam was not active. 
- ✅ **State Awareness**: Monitoring features now correctly respect the `isExamActive` state and remain dormant until an exam session is started.

#### Documentation 📑
- ✅ **Release Roadmap**: Added `final_push.md` outlining the path to production.

---

## 📝 Previous Updates (v1.1)

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Installation & setup guide (5 minutes)
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues & solutions
- **[requirements.txt](backend/requirements.txt)** - Python package versions

---

## 🛠️ Development

**Technology Stack:**
- Python 3.8+
- Flask 2.3.3 with Flask-CORS
- SQLite3 for persistence
- Chrome Manifest V3 extension
- Tailwind CSS for dashboard styling

**Browser Support:**
- Chrome 120+
- Chromium-based browsers (Brave, Edge, etc.)

**Development Environment:**
- Windows 10/11
- VS Code with Pylance
- Git version control
- PythonAnywhere for hosting

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details
