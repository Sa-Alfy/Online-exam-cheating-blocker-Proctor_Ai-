/**
 * Proctor AI - Content Script
 * Monitors exam page for violations
 */

// Configuration
const CONFIG = {
  DEBOUNCE_DELAY: 1000, // 1 second debounce to prevent spam
  MAX_VIOLATIONS_PER_MINUTE: 10, // Prevent logging spam
  VERSION: '1.1'
};

// Track violation timestamps to implement local rate limiting
const violationTracker = {
  lastMinuteWindow: Date.now(),
  violationCount: 0,
  violations: [] // Store recent violations
};

/**
 * Debounce function to prevent rapid-fire violations
 * Ensures we don't spam the server with multiple violations in quick succession
 */
function debounce(func, wait) {
  let timeoutId;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeoutId);
      func(...args);
    };
    clearTimeout(timeoutId);
    timeoutId = setTimeout(later, wait);
  };
}

/**
 * Check if we should log this violation (rate limiting)
 */
function shouldLogViolation() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Reset if we've moved to a new minute window
  if (now - violationTracker.lastMinuteWindow > 60000) {
    violationTracker.lastMinuteWindow = now;
    violationTracker.violationCount = 0;
    violationTracker.violations = [];
  }
  
  // Remove violations older than 1 minute
  violationTracker.violations = violationTracker.violations.filter(time => time > oneMinuteAgo);
  
  // Check if we're at the limit
  if (violationTracker.violations.length >= CONFIG.MAX_VIOLATIONS_PER_MINUTE) {
    console.warn('[Proctor AI] Rate limit reached - skipping violation');
    return false;
  }
  
  return true;
}

let extensionInvalidated = false;

/**
 * Sends a violation signal to the background.js service worker
 * Only sends if exam is active and conditions are met
 */
function notifyProctor(violationType) {
  if (extensionInvalidated) return;

  try {
    // Check rate limits
    if (!shouldLogViolation()) {
      return;
    }

    // Check if exam is active
    chrome.storage.local.get(["isExamActive", "examOriginUrl"], (result) => {
      if (chrome.runtime.lastError) {
        // Handle context invalidation here too just in case
        return;
      }

      if (!result.isExamActive) {
        return; // Silently ignore if exam not active
      }

      const currentUrl = window.location.href;

      // For URL mismatch violations, additionally check if URL actually changed
      if (violationType.includes("Navigated")) {
        if (currentUrl === result.examOriginUrl) {
          return; // Still on correct URL, no violation
        }
      }

      console.log(`[Proctor AI] Violation detected: ${violationType}`);

      // Track this violation
      violationTracker.violations.push(Date.now());

      // Send to background worker
      try {
        chrome.runtime.sendMessage({
          action: "LOG_VIOLATION",
          type: violationType,
          url: currentUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
             const errMsg = chrome.runtime.lastError.message || '';
             if (errMsg.includes('Extension context invalidated')) {
                 extensionInvalidated = true;
             }
             return;
          }
          
          if (response && response.success) {
            console.log(`[Proctor AI] ✅ Logged: ${violationType}`);
          } else if (response && response.error) {
            console.warn('[Proctor AI] Violation not logged:', response.error);
          }
        });
      } catch (sendError) {
        const msg = sendError.message || '';
        if (msg.includes('Extension context invalidated')) {
            extensionInvalidated = true;
        }
      }
    });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('Extension context invalidated')) {
        extensionInvalidated = true;
    }
  }
}

// Create debounced versions of violation handlers to prevent spam
const debouncedTabSwitch = debounce(() => notifyProctor("Tab Switched / Hidden"), CONFIG.DEBOUNCE_DELAY);
const debouncedFocusLoss = debounce(() => notifyProctor("Focus Lost (Alt+Tab or Window Switch)"), CONFIG.DEBOUNCE_DELAY);
const debouncedFullscreenExit = debounce(() => notifyProctor("Exited Fullscreen Mode"), CONFIG.DEBOUNCE_DELAY);
const debouncedUrlMismatch = debounce(() => notifyProctor("Navigated Away from Exam Page"), CONFIG.DEBOUNCE_DELAY);
const debouncedMouseLeave = debounce(() => notifyProctor("Mouse Left Viewport"), CONFIG.DEBOUNCE_DELAY);

// --- High-Reliability Listeners ---

// 1. Detect Tab Switching (The most reliable way)
document.addEventListener('visibilitychange', () => {
    try {
        if (document.hidden) {
            debouncedTabSwitch();
        }
    } catch (error) {
        console.error('[Proctor AI] Error in visibility change handler:', error);
    }
}, { passive: true });

// 2. Detect Focus Loss (Alt-Tab, clicking the address bar, or opening another app)
window.addEventListener('blur', () => {
    try {
        debouncedFocusLoss();
    } catch (error) {
        console.error('[Proctor AI] Error in blur handler:', error);
    }
}, { passive: true });

// 3. Detect Fullscreen Exit
document.addEventListener('fullscreenchange', () => {
    try {
        if (!document.fullscreenElement) {
            debouncedFullscreenExit();
        }
    } catch (error) {
        console.error('[Proctor AI] Error in fullscreen change handler:', error);
    }
}, { passive: true });

// 4. Detect Copy/Paste/Drag Attempts
document.addEventListener('copy', () => {
    try { notifyProctor("Copy Attempted"); } catch (e) { console.error(e); }
}, { passive: true });

document.addEventListener('paste', () => {
    try { notifyProctor("Paste Attempted"); } catch (e) { console.error(e); }
}, { passive: true });

document.addEventListener('dragstart', () => {
    try { notifyProctor("Text/Image Drag Attempted"); } catch (e) { console.error(e); }
}, { passive: true });

document.addEventListener('drop', () => {
    try { notifyProctor("Content Drop Attempted"); } catch (e) { console.error(e); }
}, { passive: true });

// 5. Detect when the page is being closed or navigated away
window.addEventListener('beforeunload', () => {
    try {
        notifyProctor("Navigating away from Exam Page");
    } catch (error) { }
});

// 6. Block DevTools & Context Menu, Monitor Keyboard Shortcuts
document.addEventListener('contextmenu', (e) => {
    try {
        e.preventDefault(); // Block right click
        notifyProctor("Context Menu (Right Click) Blocked");
    } catch (err) { }
});

document.addEventListener('keydown', (e) => {
    try {
        const key = e.key.toLowerCase();
        
        // Disable Developer Tools Shortcuts
        if (
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) || // Ctrl+Shift+I/J/C
            (e.ctrlKey && key === 'u') // Ctrl+U (View Source)
        ) {
            e.preventDefault();
            notifyProctor("Developer Tools Access Blocked");
            return;
        }

        // Monitor, but don't block Copy/Paste Shortcuts
        if ((e.ctrlKey || e.metaKey) && key === 'c') {
            notifyProctor("Copy Shortcut used");
        }
        if ((e.ctrlKey || e.metaKey) && key === 'v') {
            notifyProctor("Paste Shortcut used");
        }
        if ((e.ctrlKey || e.metaKey) && key === 'x') {
            notifyProctor("Cut Shortcut used");
        }
        if (e.key === "PrintScreen") {
            notifyProctor("PrintScreen Shortcut used");
        }
    } catch (err) { }
});

// 7. Monitor Mouse Leaving the Window
document.addEventListener('mouseleave', (e) => {
    try {
        if (e.clientY <= 0 || e.clientX <= 0 || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
            debouncedMouseLeave();
        }
    } catch (err) { }
});

// 8. Periodic URL and Focus Check (Bulletproof loop)
let lastCheckedUrl = window.location.href;
setInterval(() => {
    // 1. URL change check
    const currentUrl = window.location.href;
    if (currentUrl !== lastCheckedUrl) {
        lastCheckedUrl = currentUrl;
        debouncedUrlMismatch();
    }
    
    // 2. Continuous focus check (hard to bypass)
    if (!document.hasFocus() && !document.hidden) {
        debouncedFocusLoss();
    }
}, 2000); // Check every 2 seconds

// Notify that monitoring is active
console.log(`[Proctor AI v${CONFIG.VERSION}] Content script loaded. Strong monitoring active.`);