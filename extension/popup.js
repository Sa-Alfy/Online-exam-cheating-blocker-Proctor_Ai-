/**
 * Popup Script - Professional Exam Session Management
 */

// ⚠️ SECURITY: Backend URL is read from chrome.storage.local, NOT hardcoded.
// This is set once during extension install (see background.js) and can be
// configured by the deployer. Students cannot bypass proctoring because
// the content script and background worker enforce exam-active checks.
const STORAGE_KEY_BACKEND_URL = 'backendUrl';
const isDevMode = !('update_url' in chrome.runtime.getManifest());
const FALLBACK_BACKEND_URL = isDevMode ? 'http://127.0.0.1:5000' : 'https://saalfy.pythonanywhere.com';

/**
 * Read the backend URL from chrome.storage.local (same source as background.js)
 */
async function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_BACKEND_URL], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[Proctor AI] Could not read backendUrl from storage:', chrome.runtime.lastError);
        resolve(FALLBACK_BACKEND_URL);
        return;
      }
      const url = result[STORAGE_KEY_BACKEND_URL];
      if (url && typeof url === 'string' && url.trim().length > 0) {
        resolve(url.trim());
      } else {
        resolve(FALLBACK_BACKEND_URL);
      }
    });
  });
}

// Configuration - Immutable
const CONFIG = {
  SESSION_ENDPOINT: '/session',
  TIMEOUT: 30000
};

// DOM Elements
const toggleExamBtn = document.getElementById('toggleExamBtn');
const statusMessage = document.getElementById('statusMessage');
const examInfo = document.getElementById('examInfo');
const statusText = document.getElementById('statusText');
const studentNameDisplay = document.getElementById('studentNameDisplay');
const examUrlDisplay = document.getElementById('examUrlDisplay');
const monitoringStatus = document.getElementById('monitoringStatus');

/**
 * Show status message to user
 */
function showMessage(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  if (type === 'timeout') {
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 2000);
  }
}

/**
 * Send session event to backend (START or END)
 */
async function sendSessionEvent(eventType, examUrl) {
  try {
    const apiBase = await getBackendUrl();
    const response = await fetch(`${apiBase}${CONFIG.SESSION_ENDPOINT}`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': '1.1'
      },
      body: JSON.stringify({
        event: eventType,
        examUrl: examUrl,
        timestamp: new Date().toLocaleString()
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Proctor AI] Failed to send ${eventType} event:`, error);
    throw error;
  }
}

/**
 * Start exam session
 */
async function startExam() {
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tab = tabs[0];
    const examUrl = tab.url;

    // Get student info (ask user or use stored)
    const studentName = prompt('Enter your full name:');
    if (!studentName) {
      showMessage('❌ Exam start cancelled.', 'error');
      return;
    }

    const studentId = prompt('Enter your student ID:');
    if (!studentId) {
      showMessage('❌ Exam start cancelled.', 'error');
      return;
    }

    showMessage('<span class="loading-spinner"></span>Starting exam...', 'loading');

    // Send START event to backend
    await sendSessionEvent('START', examUrl);

    // Save exam state to local storage
    const examState = {
      isExamActive: true,
      examOriginUrl: examUrl,
      studentName: studentName,
      studentId: studentId,
      startTime: new Date().toISOString()
    };

    chrome.storage.local.set(examState, () => {
      console.log('[Proctor AI] Exam session started:', examState);
    });

    // Update UI
    updateUI(true, studentName, examUrl);
    showMessage('✅ Exam monitoring active! Stay focused on this window.', 'success');

    // Set extension badge
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

  } catch (error) {
    console.error('[Proctor AI] Error starting exam:', error);
    showMessage(`❌ Failed to start exam: ${error.message}`, 'error');
  }
}

/**
 * Stop exam session
 */
async function stopExam() {
  try {
    showMessage('<span class="loading-spinner"></span>Stopping exam...', 'loading');

    // Send END event to backend
    await sendSessionEvent('END', '');

    // Clear exam state
    chrome.storage.local.remove(['isExamActive', 'examOriginUrl', 'studentName', 'studentId', 'startTime'], () => {
      console.log('[Proctor AI] Exam session ended');
    });

    // Update UI
    updateUI(false);
    showMessage('✅ Exam monitoring stopped.', 'success');

    // Clear extension badge
    chrome.action.setBadgeText({ text: '' });

  } catch (error) {
    console.error('[Proctor AI] Error stopping exam:', error);
    showMessage(`❌ Failed to stop exam: ${error.message}`, 'error');
  }
}

/**
 * Update UI based on exam state
 */
function updateUI(isActive, studentName = '', examUrl = '') {
  if (isActive) {
    toggleExamBtn.textContent = '⏹️ Stop Exam';
    toggleExamBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    toggleExamBtn.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.2)';
    
    statusText.textContent = 'MONITORING ACTIVE';
    statusText.style.color = '#dc2626';
    statusText.style.fontWeight = 'bold';
    
    studentNameDisplay.textContent = studentName;
    examUrlDisplay.textContent = examUrl;
    examInfo.style.display = 'block';
    
    monitoringStatus.textContent = '✅ Active - Violations being tracked';
    monitoringStatus.style.color = '#059669';
  } else {
    toggleExamBtn.textContent = '▶️ Start Exam';
    toggleExamBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    toggleExamBtn.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.2)';
    
    statusText.textContent = 'Offline';
    statusText.style.color = '#6b7280';
    statusText.style.fontWeight = 'normal';
    
    examInfo.style.display = 'none';
    
    monitoringStatus.textContent = 'Idle';
    monitoringStatus.style.color = '#6b7280';
  }
}

/**
 * Load current exam state on popup open
 */
function loadExamState() {
  chrome.storage.local.get(
    ['isExamActive', 'studentName', 'examOriginUrl'],
    (result) => {
      if (result.isExamActive) {
        updateUI(true, result.studentName, result.examOriginUrl);
      } else {
        updateUI(false);
      }
    }
  );
}

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', () => {
  // Load exam state
  loadExamState();
  
  // Set up event listeners
  toggleExamBtn.addEventListener('click', async () => {
    // Check current state
    chrome.storage.local.get(['isExamActive'], (result) => {
      if (result.isExamActive) {
        stopExam();
      } else {
        startExam();
      }
    });
  });

  console.log('[Proctor AI] Popup initialized - Professional Mode');
});