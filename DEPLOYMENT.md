# Deployment Guide: PythonAnywhere

This guide explains how to deploy the Proctor AI project to PythonAnywhere, ensuring the extension correctly connects to your backend.

## Architecture Overview

**Proctor AI** consists of two parts:
- **Backend**: Flask REST API running on PythonAnywhere
- **Extension**: Chrome extension that monitors students and sends violations to the backend

The key to successful deployment is configuring the extension to point to your PythonAnywhere URL and ensuring CORS permissions are set correctly.

## Prerequisites

- PythonAnywhere account (free tier supported)
- Git repository or zip file of the project
- Chrome browser with admin access to install the extension
- Python 3.8+ (PythonAnywhere usually provides this)

## Step 1: Prepare Your PythonAnywhere Account

### 1.1 Create Web App

1. Log in to [PythonAnywhere](https://www.pythonanywhere.com)
2. Go to **Web** tab
3. Click **Add a new web app**
4. Choose **Manual configuration**
5. Select **Python 3.X** (3.11+ recommended)
6. Note your domain: `your-username.pythonanywhere.com`

### 1.2 Clone/Upload Project

Use Bash console:

```bash
cd /home/your-username
git clone <your-repo.git>
cd proctor_project
```

Or upload via web interface to `/home/your-username/proctor_project/`

## Step 2: Setup Backend on PythonAnywhere

### 2.1 Configure Python Virtual Environment

In PythonAnywhere Bash console:

```bash
# Go to project directory
cd /home/your-username/proctor_project

# Create virtual environment
mkvirtualenv --python=/usr/bin/python3.11 proctor-env

# Install dependencies
pip install -r backend/requirements.txt

# Verify installation
python backend/app.py --help
```

### 2.2 Create Backend .env File

In Bash console:

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit the file with nano or vi
nano backend/.env
```

**Critical settings for PythonAnywhere:**

```env
DEPLOY_ENV=pythonanywhere
DATA_DIR=/home/your-username
SECRET_KEY=<use: python -c "import secrets; print(secrets.token_hex(32))">
CORS_ORIGINS=https://your-username.pythonanywhere.com,chrome-extension://YOUR_EXTENSION_ID
```

**⚠️ IMPORTANT**: Get your Chrome extension ID:
1. Build the extension locally first (see Step 3)
2. Load it unpacked in Chrome (chrome://extensions/)
3. Copy the extension ID from the page
4. Then add it to CORS_ORIGINS in .env

### 2.3 Configure WSGI File

Edit `/var/www/your-username_pythonanywhere_com_wsgi.py`:

```python
import os
import sys

# Add project to path
path = '/home/your-username/proctor_project'
if path not in sys.path:
    sys.path.append(path)

# Set environment
os.chdir(path)
os.environ['DEPLOY_ENV'] = 'pythonanywhere'

# Import Flask app
from backend.app import app
application = app
```

### 2.4 Set Web App Source Code

In Web tab:
1. Set **Source code** to: `/home/your-username/proctor_project`
2. Set **Working directory** to: `/home/your-username/proctor_project`
3. Set **Virtualenv** to: `/home/your-username/.virtualenvs/proctor-env`

### 2.5 Reload Web App

Click the **Reload** button in PythonAnywhere Web tab.

Test the backend:
```bash
curl https://your-username.pythonanywhere.com/
```

Should return the dashboard or a valid response (not a 500 error).

## Step 3: Build & Configure Extension

### 3.1 Setup extension/.env

```bash
cd /path/to/proctor_project
# Copy example
cp extension/.env.example extension/.env

# Edit extension/.env
# Windows (PowerShell): notepad extension\.env
# Mac/Linux: nano extension/.env
```

**For PythonAnywhere:**

```env
BACKEND_URL=https://your-username.pythonanywhere.com
ENV_MODE=production
```

### 3.2 Build Extension

Choose one method:

**Method A: Python (recommended)**
```bash
python build-extension.py
```

**Method B: Node.js**
```bash
node build-extension.js
```

This generates:
- `extension/config.js` with your backend URL
- Updated `extension/manifest.json` with correct permissions

### 3.3 Load Extension in Chrome

1. Open Chrome: chrome://extensions/
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Browse to `/path/to/proctor_project/extension/`
5. Copy the **Extension ID** (shown on the page)

### 3.4 Add Extension ID to PythonAnywhere

Update backend/.env on PythonAnywhere:

```bash
# In Bash console
nano /home/your-username/proctor_project/backend/.env
```

Update CORS_ORIGINS:
```env
CORS_ORIGINS=https://your-username.pythonanywhere.com,chrome-extension://YOUR_EXTENSION_ID
```

Reload the web app:
```bash
# In Web tab, click Reload
```

## Step 4: Test the Deployment

### 4.1 Check Backend Connectivity

```bash
curl https://your-username.pythonanywhere.com/session
```

Should return: `405 Method Not Allowed` (or `-CORS error` if extension ID not configured).

### 4.2 Test Extension

1. Open the test exam webpage
2. Click the extension icon
3. Enter Student Name and Exam URL
4. Click **Start Exam**
5. Open browser DevTools: F12 or Cmd+Option+I
6. Go to **Console** tab
7. Should see `[Proctor AI] ✅ Session started`
8. Perform a monitored action (e.g., open another tab)
9. Should see violation logged: `[Proctor AI] ✅ Violation logged`

### 4.3 Check PythonAnywhere Logs

In Web tab, view **Log files**:
- **access.log**: HTTP requests
- **error.log**: Flask errors
- **server.log**: Server startup

Errors often indicate CORS or database issues.

## Step 5: Make Repo Public (Security Checklist)

Before making the repository public on GitHub:

- [ ] `.env` files NOT committed (check .gitignore)
- [ ] No hardcoded URLs in source code (use build system)
- [ ] `SECRET_KEY` changed in PythonAnywhere (not 'change-me-in-production')
- [ ] CORS_ORIGINS limited to your domain + extension ID (not `*`)
- [ ] Database path correctly set to `/home/your-username` (not local paths)
- [ ] All sensitive files documented in .gitignore

### Security Commands

```bash
# Check no .env files are committed
git status | grep ".env"

# Check for hardcoded URLs
grep -r "saalfy.pythonanywhere.com" .
grep -r "localhost" . --exclude-dir=.git  # Should only be in .env.example or config
```

## Troubleshooting

### Issue: CORS Error on Extension

```
XMLHttpRequest cannot load https://... CORS policy: ...
```

**Solution:**
1. Check backend/.env `CORS_ORIGINS` includes your extension ID
2. Run `python build-extension.py` to regenerate extension/manifest.json
3. Reload extension in chrome://extensions/
4. Restart PythonAnywhere web app (click Reload)

### Issue: "Failed to connect to backend"

```
[Proctor AI] Failed to log violation: TypeError: fetch failed
```

**Solution:**
1. Check extension/.env `BACKEND_URL` is correct
2. Run `.py build-extension.py` to regenerate extension/config.js
3. Test: `curl https://your-username.pythonanywhere.com/` from Bash
4. Check error.log in PythonAnywhere Web tab

### Issue: 404 Not Found

```
POST /log HTTP/1.1" 404
```

**Solution:**
1. Backend not running - check Web tab status (should be "Reloading" or "Running")
2. WSGI file incorrect - check `/var/www/your-username_pythonanywhere_com_wsgi.py`
3. Verify `from backend.app import app` works: `python -c "from backend.app import app; print('OK')"`

### Issue: Database Permission Error

```
sqlite3.OperationalError: attempt to write a readonly database
```

**Solution:**
1. Ensure DATA_DIR=/home/your-username (absolute path, not relative)
2. Check directory exists and is writable: `ls -la /home/your-username/`
3. Create if missing: `mkdir -p /home/your-username`

## Updating the Deployment

When you make changes to the code:

1. **Backend changes**: Push to repository, pull in Bash console, click **Reload** in Web tab
2. **Extension changes**: Run `python build-extension.py`, reload in chrome://extensions/

## Next Steps

- Configure SSL/HTTPS (PythonAnywhere provides free SSL)
- Monitor violations in the dashboard: `https://your-username.pythonanywhere.com/dashboard`
- Set up logging to track issues: check PythonAnywhere error logs
- Backup database regularly: `proctor.db` location is set by DATA_DIR

## Support

- PythonAnywhere Help: https://help.pythonanywhere.com/
- Flask CORS: https://flask-cors.readthedocs.io/
- Chrome Extensions: https://developer.chrome.com/docs/extensions/
