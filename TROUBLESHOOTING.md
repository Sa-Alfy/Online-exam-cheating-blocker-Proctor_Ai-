# Proctor AI - Troubleshooting Guide

## Issues Fixed

### ✅ Issue 1: Dashboard Not Showing Logs
**Problem**: Dashboard was blank, not displaying any violation records

**Root Cause**: Template variables weren't being converted to JavaScript-accessible format

**Solution**: Updated dashboard template to properly expose Flask logs using `{{ logs | tojson }}`

**Testing**: 
- Reload the dashboard at `http://127.0.0.1:5000/dashboard`
- You should now see violations (if any have been logged)

---

### ✅ Issue 2: Extension "Failed to Fetch" Error
**Problem**: Extension showing `❌ Failed to log violation: Failed to fetch`

**Root Causes** (in order of likelihood):
1. Backend server not running on port 5000
2. CORS misconfiguration
3. Network connectivity issues
4. Firewall blocking localhost communication

**Solutions**:

#### A. Verify Backend is Running
```bash
# In PowerShell terminal
python app.py
```

Expected output:
```
============================================================
Starting Proctor AI Backend Server...
============================================================
Database: proctor.db
Logging to: proctor.log

📊 Dashboard: http://127.0.0.1:5000/dashboard
💊 Health Check: http://127.0.0.1:5000/health
📡 API: http://127.0.0.1:5000/api/violations

Server ready! Waiting for violations...
============================================================
```

#### B. Test Backend Connectivity
Open a new terminal and run:

**PowerShell**:
```powershell
$uri = "http://127.0.0.1:5000/health"
$response = Invoke-WebRequest -Uri $uri -Method GET
$response.Content | ConvertFrom-Json | Format-Table
```

**Or from Python**:
```python
import requests
resp = requests.get('http://127.0.0.1:5000/health')
print(resp.json())
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "violations": 0,
  "timestamp": "2026-02-28T10:30:00.123456"
}
```

#### C. Check CORS Configuration
The backend now has explicit CORS setup for:
- Origin: `http://127.0.0.1` and `http://localhost`
- Endpoints: `/log`, `/clear`, `/health`, `/dashboard`

If you get CORS errors:
1. Check browser console (F12 → Console tab)
2. Look for "CORS error" messages
3. Verify backend is running on correct port

---

### ✅ Issue 3: "Proctoring Session Interrupted" Error
**Problem**: Extension showing `[Proctor AI] Proctoring session interrupted. Please refresh the page.`

**Root Cause**: Extension was checking for `chrome.runtime?.id` which could fail if extension was reloaded or in specific contexts

**Solution**: Improved error handling to gracefully handle extension reloads without blocking violation logging

**Instructions if you see this**:
1. Reload the exam page (press F5)
2. The extension should reconnect automatically
3. Click "Start Exam" again in the popup

---

## Common Issues & Fixes

### Issue: Database File Not Found
**Error**: `Database initialization failed: No such file or directory`

**Fix**:
```bash
# Ensure you're in the correct directory
cd f:\Code\Python Code\proctor_project\backend
python app.py
```

---

### Issue: Port 5000 Already in Use
**Error**: `OSError: [Errno 10048] Only one usage of each socket address...`

**Fix**:
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Then restart the application
python app.py
```

---

### Issue: Extension Not Loading in Chrome
**Error**: Extension doesn't appear in `chrome://extensions`

**Fix**:
1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` folder from this project
5. The extension should now appear

---

### Issue: Logs Not Being Recorded
**Problem**: Running the exam but nothing appears in dashboard

**Diagnostics**:
1. Check browser console (F12) for JavaScript errors
2. Verify backend is running with `http://127.0.0.1:5000/health`
3. Check `proctor.log` file for backend errors
4. Ensure you filled in "Full Name" and "Student ID" in popup

**Check logs**:
```bash
# View real-time log output
Get-Content -Path proctor.log -Tail 20 -Wait
```

---

## Testing Workflow

### Step-by-Step Testing

**1. Start Backend**
```bash
cd f:\Code\Python Code\proctor_project\backend
python app.py
```

**2. Verify Health**
```bash
# In another terminal
curl http://127.0.0.1:5000/health
```

Should return: `{"status": "healthy", "database": "connected", "violations": 0}`

**3. Load Extension**
- Open `chrome://extensions/`
- Click "Load unpacked" → select `extension/` folder

**4. Open Exam Page**
- Navigate to any website (e.g., `google.com`)

**5. Start Exam Session**
- Click Proctor AI icon
- Enter name and student ID
- Click "Start Exam"
- Should see "✅ Monitoring Active"

**6. Trigger a Violation**
- Close the tab or switch tabs
- Check `proctor.log` for logging

**7. View Dashboard**
- Open `http://127.0.0.1:5000/dashboard`
- Should show violation records

---

## Debugging Tips

### Enable Debug Logging
Edit `app.py` and change:
```python
logging.basicConfig(level=logging.DEBUG)
```

### Browser DevTools
1. Right-click extension icon → "Inspect popup"
2. Or press F12 on the exam page
3. Go to "Console" tab
4. Look for `[Proctor AI]` prefixed messages

### Backend Logs
```bash
# Real-time log streaming
Get-Content -Path proctor.log -Tail 50 -Wait
```

### Extension Logs
1. Open `chrome://extensions/`
2. Click the extension
3. Look at "Errors" section
4. Check "Inspect views: background page"

---

## Performance Issues

### Dashboard Slow/Unresponsive
**Solution**: Dashboard only loads last 1000 records
- Pre-existing large datasets will take time to render
- Use "Clear All" button to reset if needed

### Extension Spam/Too Many Logs
**Solution**: Violations are debounced (1 second minimum between logs)
- Even with rapid switching, only 1 log per second maximum
- Rate-limited to 10 violations per student per minute

---

## Still Having Issues?

### Diagnostic Commands

**Check Python Installation**
```powershell
python --version
pip list | grep flask
```

**Check Extension Files**
```powershell
Get-ChildItem -Path "f:\Code\Python Code\proctor_project\extension\" -Include *.js, *.html, *.json
```

**Test API Directly**
```powershell
# Test logging endpoint
$body = @{
  student_name = "Test Student"
  violation_type = "Test Violation"
  timestamp = Get-Date
  url = "http://test.com"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:5000/log" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

---

## Contact & Support

If issues persist:
1. Check `proctor.log` for detailed error messages
2. Review browser console (F12) for extension errors
3. Verify all files are in correct locations
4. Ensure Python dependencies are installed (`pip install -r requirements.txt`)

---

## Checklist for Full Setup

- [ ] Python 3.7+ installed
- [ ] Flask and dependencies installed (`pip install -r requirements.txt`)
- [ ] Backend running on `http://127.0.0.1:5000`
- [ ] Extension loaded in Chrome (developer mode)
- [ ] No port 5000 conflicts
- [ ] Database permissions allow read/write
- [ ] Exam page accessible in browser
- [ ] Console shows `[Proctor AI]` messages when violations occur
- [ ] Dashboard loads at `http://127.0.0.1:5000/dashboard`

---

Last Updated: February 28, 2026
