# Proctor AI - Quick Start Guide

## ⚡ Setup (5 Minutes)

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

**This installs:**
- Flask==2.3.3
- Flask-CORS==4.0.0
- Werkzeug==2.3.7

### 2. Start Backend Server
```bash
python app.py
```

**Expected Output:**
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

✅ **Backend is now running!**

---

### 3. Load Extension in Chrome

1. Open `chrome://extensions/`
2. Toggle "Developer mode" (top-right corner)
3. Click "Load unpacked"
4. Select the `extension/` folder

✅ **Extension should now appear in Chrome (icon in toolbar)**

---

### 4. Test the System

**Step A: Open any website** (e.g., Google, Wikipedia, etc.)

**Step B: Start exam session**
1. Click Proctor AI icon (top-right in Chrome toolbar)
2. Enter:
   - **Student Name**: e.g., "John Doe"
   - **Student ID**: e.g., "2024-001"
3. Click "▶️ Start Exam" (green button)
4. Should show: ✅ "Exam started successfully"
5. Badge should change to red "ON"

**Step C: Trigger a test violation**
- Switch to another browser tab (ALT+TAB or click another tab)
- Come back to the exam page
- This counts as one violation

**Step D: View Dashboard**
- Open: `http://127.0.0.1:5000/dashboard`
- You should see:
  - Stats: 1 Session, 1 Violation, 1 Student
  - Session card with student name and timestamp
  - Click the session card to expand and see violation details

**Step E: Stop exam**
- Click extension icon again
- Click "⏹️ Stop Exam" (red button)
- Badge disappears
- Session is now complete

---

## 🌐 Production Deployment (PythonAnywhere)

**Live Server**: `https://saalfy.pythonanywhere.com`

### How It Works:
- Backend is deployed on PythonAnywhere
- Extension is **hardcoded** to use production server
- Cannot be changed by students (security feature)
- All violations automatically sent to production

### To Deploy Code Changes:

1. **Push to GitHub**
   ```bash
   git add -A
   git commit -m "Your commit message"
   git push origin main
   ```

2. **Reload on PythonAnywhere**
   - Go to: https://www.pythonanywhere.com/user/saalfy/webapps/
   - Click your web app (saalfy.pythonanywhere.com)
   - Click "Reload" button (green circular icon)
   - Wait 30 seconds for restart

3. **Test production**
   - Open: `https://saalfy.pythonanywhere.com/dashboard`
   - Should see all recorded violations

---

## 🔒 Security Notes

✅ **Backend URL is hardcoded** - Students cannot change it to bypass proctoring  
✅ **No settings UI** - Extension has no configuration options  
✅ **HTTPS only** - Production uses HTTPS encryption  
✅ **Rate limited** - 60 requests/minute per IP  
✅ **Validated input** - All data checked before storage  

---

## 📋 File Locations

```
f:\Code\Python Code\proctor_project\
├── backend/
│   ├── app.py              ← Run this
│   ├── config.py           ← Configuration
│   ├── proctor.db          ← Database (auto-created)
│   ├── proctor.log         ← Logs
│   └── templates/
│       └── dashboard.html  ← View at http://127.0.0.1:5000/dashboard
├── extension/
│   ├── manifest.json       ← Extension metadata
│   ├── background.js       ← Extension service worker
│   ├── content.js          ← Page monitoring
│   ├── popup.html          ← Popup UI
│   └── popup.js            ← Popup logic
├── .env.example            ← Configuration template
└── TROUBLESHOOTING.md      ← Detailed troubleshooting
```

---

## 🔧 Configuration

### For Development (Default)
No changes needed - works out of the box

### For Production
1. Copy `.env` and edit:
```bash
cp .env.example .env
```

2. Update settings:
```
FLASK_ENV=production
SECRET_KEY=<your-secure-key>
HOST=0.0.0.0
PORT=8000
```

---

## 📊 Monitoring

### View Real-time Logs
```powershell
Get-Content -Path "f:\Code\Python Code\proctor_project\backend\proctor.log" -Tail 10 -Wait
```

### Check Backend Health
Open in browser: `http://127.0.0.1:5000/health`

Should show:
```json
{
  "status": "healthy",
  "database": "connected",
  "violations": 0,
  "timestamp": "2026-02-28T..."
}
```

### View Dashboard
Open in browser: `http://127.0.0.1:5000/dashboard`

---

## 🎯 What Each Violation Means

| Violation | Detected | Severity |
|-----------|----------|----------|
| Tab Switched | User left/came back to tab | ⚠️ Warning |
| Focus Lost | Alt+Tab or window switch | ⚠️ Warning |
| Exited Fullscreen | Left fullscreen mode | ℹ️ Info |
| Copy Attempted | Ctrl+C pressed | 🔴 Critical |
| Paste Attempted | Ctrl+V pressed | 🔴 Critical |
| Navigating Away | Closing tab/page | 🔴 Critical |

---

## ⚡ Performance Notes

- **Dashboard**: Optimized for 1000+ records
- **Extension**: Debounced (max 1 log per second)
- **Rate Limiting**: 10 violations/minute per student
- **Database**: SQLite (suitable for small to medium deployments)

---

## ✅ Success Checklist

After completing setup, verify:

- [ ] Backend starts without errors
- [ ] `http://128.0.0.1:5000/health` returns healthy status
- [ ] Extension loads in `chrome://extensions`
- [ ] Extension popup shows fields for name and ID
- [ ] Can start exam session without errors
- [ ] Violations are logged when tabs are switched
- [ ] Dashboard shows violations at `http://127.0.0.1:5000/dashboard`
- [ ] `proctor.log` contains entries

---

## 🐛 Quick Fixes

### Backend won't start?
```bash
# Make sure you're in the right directory
cd f:\Code\Python Code\proctor_project\backend
python app.py
```

### Port 5000 in use?
```powershell
# Find and kill the process
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Extension not working?
1. Reload extension: `chrome://extensions` → reload button
2. Reload exam page: F5
3. Check browser console: F12 → Console tab

### Dashboard blank?
1. Check backend is running
2. Reload dashboard page: F5
3. Check `proctor.log` for errors

---

## 📲 Next Steps

1. ✅ Run backend
2. ✅ Load extension
3. ✅ Test with a sample exam page
4. ✅ View dashboard results
5. 🚀 Deploy to production (see `.env.example`)

---

**Happy Proctoring! 📚**

Last Updated: February 28, 2026
