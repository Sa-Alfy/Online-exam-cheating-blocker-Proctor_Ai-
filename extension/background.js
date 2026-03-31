/**
 * Proctor AI - Background Service Worker
 * Professional exam monitoring with session management
 */

// Backend URL is loaded from config.js (auto-generated during build)
// If EXTENSION_CONFIG is not available, defaults to localhost
const getDefaultBackendUrl = () => 'https://saalfy.pythonanywhere.com';

const STORAGE_KEY_BACKEND_URL = 'backendUrl';

const CONFIG = {
  LOG_ENDPOINT: '/log',
  SESSION_ENDPOINT: '/session',
  TIMEOUT: 30000,
  VERSION: '1.1',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

async function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_BACKEND_URL], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[Proctor AI] Could not read backendUrl from storage:', chrome.runtime.lastError);
        resolve(getDefaultBackendUrl());
        return;
      }

      const backendUrl = result[STORAGE_KEY_BACKEND_URL];
      if (backendUrl && typeof backendUrl === 'string' && backendUrl.trim().length > 0) {
        resolve(backendUrl.trim());
      } else {
        resolve(getDefaultBackendUrl());
      }
    });
  });
}

function ensureDefaultBackendUrl() {
  chrome.storage.local.get([STORAGE_KEY_BACKEND_URL], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[Proctor AI] Could not read backendUrl from storage during install:', chrome.runtime.lastError);
      return;
    }

    if (!result || !result[STORAGE_KEY_BACKEND_URL]) {
      chrome.storage.local.set({ [STORAGE_KEY_BACKEND_URL]: getDefaultBackendUrl() });
    }
  });
}

const SUPPORTED_MESSAGE_TYPES = ['LOG_VIOLATION', 'LOG_VIOLATION_V1'];

// 1. Setup: Confirm the background worker is alive
chrome.runtime.onInstalled.addListener(() => {
  console.log(`[Proctor AI v${CONFIG.VERSION}] Service Worker: Active`);
  // Force update the backend URL default on install/reload
  chrome.storage.local.set({ [STORAGE_KEY_BACKEND_URL]: getDefaultBackendUrl() });
  
  chrome.storage.local.set({ 
    installTime: Date.now(),
    isExamActive: false 
  });
});

/**
 * Retry logic for failed requests
 */
async function fetchWithRetry(url, options, attempt = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (attempt < CONFIG.RETRY_ATTEMPTS) {
      console.warn(`[Proctor AI] Request attempt ${attempt + 1}/${CONFIG.RETRY_ATTEMPTS} failed, retrying...`, error.message);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (attempt + 1)));
      return fetchWithRetry(url, options, attempt + 1);
    }
    
    throw error;
  }
}

// 2. The Central Logger: Listens for violations from any tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Validate message structure
    if (!message || !message.action) {
      console.warn('[Proctor AI] Invalid message structure', message);
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    // Check if message type is supported (versioning)
    if (!SUPPORTED_MESSAGE_TYPES.includes(message.action)) {
      console.warn(`[Proctor AI] Unsupported message type: ${message.action}`);
      sendResponse({ success: false, error: 'Unsupported message type' });
      return false;
    }

    if (message.action === 'LOG_VIOLATION' || message.action === 'LOG_VIOLATION_V1') {
      // Check if exam is active
      chrome.storage.local.get(["isExamActive", "studentName", "studentId", "sessionId"], (result) => {
        try {
          if (chrome.runtime.lastError) {
            console.error('[Proctor AI] Storage error:', chrome.runtime.lastError);
            sendResponse({ success: false, error: 'Storage access error' });
            return;
          }

          // Only log violations if exam is active
          if (!result.isExamActive) {
            console.warn('[Proctor AI] Exam not active - ignoring violation');
            sendResponse({ success: false, error: 'Exam not active' });
            return;
          }

          const studentIdentity = `${result.studentName} (${result.studentId})`;
          
          // Validate message data
          if (!message.type || !message.url) {
            console.warn('[Proctor AI] Missing violation data', message);
            sendResponse({ success: false, error: 'Missing violation data' });
            return;
          }

          console.log(`[Proctor AI] Logging violation: ${message.type}`);

          // Send violation to backend (configurable by deployer)
          getBackendUrl().then((apiUrl) => {
            fetchWithRetry(`${apiUrl}${CONFIG.LOG_ENDPOINT}`, {
              method: 'POST',
              mode: 'cors',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'X-Extension-Version': CONFIG.VERSION,
                'X-Student': studentIdentity
              },
              body: JSON.stringify({
                student_name: studentIdentity,
                violation_type: message.type,
                timestamp: new Date().toLocaleString(),
                url: message.url,
                session_id: result.sessionId || null
              })
            })
            .then(response => {
              if (!response.ok) {
                console.error(`[Proctor AI] Server error (${response.status}):`, response.statusText);
                throw new Error(`Server returned ${response.status}`);
              }
              return response.json();
            })
            .then(data => {
              console.log(`[Proctor AI] ✅ Violation logged:`, message.type);
              sendResponse({ success: true, message: 'Violation logged' });
            })
            .catch(err => {
              console.error('[Proctor AI] ❌ Failed to log violation:', err.message);
              sendResponse({ success: false, error: err.message });
            });
          });
        } catch (error) {
          console.error('[Proctor AI] Error processing violation:', error);
          sendResponse({ success: false, error: error.message });
        }
      });

      // Returning true is required to keep the message channel open for async operations
      return true;
    }
  } catch (error) {
    console.error('[Proctor AI] Unexpected error in message listener:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// 3. Error handling for service worker
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Proctor AI] Service Worker suspending - will restart on next event');
});

// 4. Monitor extension errors
chrome.runtime.onStartup.addListener(() => {
  console.log('[Proctor AI] Browser started - Service Worker initializing');
});

