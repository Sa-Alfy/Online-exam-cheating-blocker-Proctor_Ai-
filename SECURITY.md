# Security Checklist Before Making Repo Public

This checklist ensures your repository is secure and ready to be made public on GitHub.

## ✅ Configuration Verification

### Environment Variables
- [ ] `.env` files are NOT committed to git (check .gitignore)
  ```bash
  # Verify:
  git log --all --full-history -- backend/.env extension/.env
  # Should return empty/no results
  ```

- [ ] `.env.example` files are committed and contain NO secrets
  - [ ] `backend/.env.example` has placeholder: `SECRET_KEY=change-me-in-production`
  - [ ] `extension/.env.example` has placeholder: `BACKEND_URL=http://localhost:5000`
  - [ ] `.env.example` (root) exists and documents all variables

### Build System
- [ ] `build-extension.js` exists (Node.js build script)
- [ ] `build-extension.py` exists (Python build script)
- [ ] `extension/.env.example` exists and documents BACKEND_URL
- [ ] Both build scripts properly:
  - [ ] Read BACKEND_URL from environment or `extension/.env`
  - [ ] Generate `extension/config.js` with correct URL
  - [ ] Update `extension/manifest.json` with dynamic host permissions

### Git Configuration
- [ ] `.gitignore` includes:
  - [ ] `.env` (all .env files)
  - [ ] `.env.*` (environment-specific files)
  - [ ] `!.env.example` (but excludes example files from exclusion)
  - [ ] `__pycache__/`, `venv/`, `node_modules/` (common build artifacts)
  - [ ] `*.db`, `*.log` (runtime files)

## ✅ Code Security Audit

### No Hardcoded Credentials
```bash
# Run these checks:
grep -r "password\|secret\|api_key\|token" . --include="*.js" --include="*.py" | grep -v ".env.example" | grep -v "DEPLOYMENT.md" | grep -v "QUICKSTART.md"
# Should find only references to os.getenv() or config variables, NOT actual values
```

Result: ✅ **PASS** - Only environment variable references found

### No Hardcoded URLs (except examples)
```bash
# Check for hardcoded backend URLs
grep -r "saalfy\|localhost\|127.0.0.1" extension/*.js
# Should return empty (only config.js and manifest set these)

grep -r "localhost" . --exclude-dir=.git | grep -v ".env.example" | grep -v "config.js" | grep -v "README" | grep -v "DEPLOYMENT"
# Should be minimal (DEPLOYMENT.md examples are OK)
```

Result: ✅ **PASS** - No hardcoded backend URLs in active code

### Extension Changes
- [ ] `extension/background.js`:
  - [ ] Removed hardcoded `https://saalfy.pythonanywhere.com`
  - [ ] Uses `getDefaultBackendUrl()` function
  - [ ] Reads from chrome.storage.local

- [ ] `extension/popup.js`:
  - [ ] Removed hardcoded `FALLBACK_BACKEND_URL`
  - [ ] Uses `getBackendUrl()` with fallback to EXTENSION_CONFIG

- [ ] `extension/popup.html`:
  - [ ] Loads `config.js` before `popup.js`

- [ ] `extension/config.js`:
  - [ ] Exists and marked as "AUTO-GENERATED FILE"
  - [ ] Contains EXTENSION_CONFIG object with BACKEND_URL

### Backend Changes
- [ ] `backend/config.py`:
  - [ ] Uses `os.getenv()` for all configuration
  - [ ] No hardcoded URLs in code
  - [ ] CORS_ORIGINS loaded from environment

- [ ] `backend/app.py`:
  - [ ] No hardcoded database paths
  - [ ] Uses Config object from config.py
  - [ ] DEPLOY_ENV correctly switches behavior

- [ ] `backend/pythonanywhere_wsgi.py`:
  - [ ] Loads .env file properly
  - [ ] No hardcoded paths or credentials

## ✅ Documentation

- [ ] `README.md`:
  - [ ] Mentions build system (`python build-extension.py`)
  - [ ] No example hardcoded URLs (except placeholders like `your-username.pythonanywhere.com`)
  - [ ] Links to DEPLOYMENT.md for production setup

- [ ] `DEPLOYMENT.md`:
  - [ ] Complete step-by-step PythonAnywhere setup
  - [ ] Shows how to build extension for production
  - [ ] Includes security considerations
  - [ ] Has troubleshooting section

- [ ] `QUICKSTART.md`:
  - [ ] Updated if needed with build step
  - [ ] Only references to saalfy are in examples/documentation

- [ ] `backend/.env.example`:
  - [ ] Documents all required variables
  - [ ] Provides clear instructions
  - [ ] Includes PythonAnywhere configuration example

- [ ] `extension/.env.example`:
  - [ ] Documents BACKEND_URL usage
  - [ ] Clear local vs. production examples

## ✅ Files to Add to Repository

These should be NEW commits (not part of git history):

```bash
# Verify these files exist:
ls -la build-extension.js      # Node.js build script
ls -la build-extension.py      # Python build script
ls -la extension/.env.example  # Extension config template
ls -la backend/.env.example    # Backend config template
ls -la DEPLOYMENT.md            # Deployment guide
ls -la extension/config.js     # Initial config (will be regenerated on build)

# All should exist
```

## ✅ Remove Old Artifacts (if applicable)

If you had previous values committed:

```bash
# Check for any old saalfy references in git history
git log --all --source --full-history -S "saalfy" -- .

# If found, consider a fresh clean start or using BFG Repo Cleaner
# See: https://rtyley.github.io/bfg-repo-cleaner/
```

## ✅ Final Verification Steps

### Step 1: Build Extension Locally
```bash
# Test the build system
python build-extension.py

# Verify generated files
cat extension/config.js       # Should have http://localhost:5000
cat extension/manifest.json   # Should have http://localhost:5000 in host_permissions
```

### Step 2: Load Extension in Chrome
```
1. Open chrome://extensions/
2. Click "Load unpacked"
3. Select extension/ folder
4. Verify no errors in DevTools (F12 > Console)
```

### Step 3: Run Backend Locally
```bash
cd backend
python app.py

# Verify output shows:
# ✅ DEPLOY_ENV: local
# ✅ Database: proctor.db (or your configured path)
```

### Step 4: Make Repo Public
Once verified locally:
```bash
# Final check
git status                      # Should be clean
git log --oneline | head -20    # Verify your commits are good

# Push to GitHub
git push origin main

# Double-check on GitHub
# 1. Verify no .env files present (only .env.example)
# 2. Verify build scripts present (build-extension.py, build-extension.js)
# 3. Verify DEPLOYMENT.md present
```

## ✅ Security Checklist Summary

| Item | Status |
|------|--------|
| .env files NOT committed | ✅ PASS |
| .env.example files present with placeholders | ✅ PASS |
| No hardcoded credentials in code | ✅ PASS |
| No hardcoded backend URLs in code | ✅ PASS |
| Build system in place | ✅ PASS |
| README updated with build instructions | ✅ PASS |
| DEPLOYMENT.md created with full setup guide | ✅ PASS |
| Backend uses environment variables | ✅ PASS |
| Extension dynamically configured | ✅ PASS |
| .gitignore properly configured | ✅ PASS |

## ⚠️ Before Deploying to Production

1. **Generate a strong SECRET_KEY:**
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Save this in PythonAnywhere backend/.env

2. **Update PythonAnywhere .env with real values:**
   - DEPLOY_ENV=pythonanywhere
   - DATA_DIR=/home/your-username
   - SECRET_KEY=<the-value-from-above>
   - CORS_ORIGINS=https://your-username.pythonanywhere.com,chrome-extension://YOUR_EXT_ID

3. **Build extension for production:**
   ```bash
   # Set BACKEND_URL to your PythonAnywhere URL
   BACKEND_URL=https://your-username.pythonanywhere.com python build-extension.py
   # Then load in Chrome from extension/
   ```

4. **Do NOT commit the production .env file**

## Questions?

- **Build System Help**: See comments in build-extension.py and build-extension.js
- **Deployment Help**: See DEPLOYMENT.md (detailed step-by-step guide)
- **Configuration Help**: See .env.example files and configuration sections in README.md
