/**
 * OpenCode Browser Extension - Content Script
 *
 * Runs in the context of web pages to enable DOM interaction
 * and console log capture.
 */

// Store console logs for retrieval
window.__opencode_console_logs = [];

// Intercept console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

function captureConsole(level, ...args) {
  const entry = {
    level,
    timestamp: Date.now(),
    message: args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch {
        return String(arg);
      }
    }).join(' ')
  };

  window.__opencode_console_logs.push(entry);

  // Keep only last 1000 entries
  if (window.__opencode_console_logs.length > 1000) {
    window.__opencode_console_logs.shift();
  }

  // Call original console method
  originalConsole[level].apply(console, args);
}

console.log = (...args) => captureConsole('log', ...args);
console.warn = (...args) => captureConsole('warn', ...args);
console.error = (...args) => captureConsole('error', ...args);
console.info = (...args) => captureConsole('info', ...args);
console.debug = (...args) => captureConsole('debug', ...args);

// Capture uncaught errors
window.addEventListener('error', (event) => {
  window.__opencode_console_logs.push({
    level: 'error',
    timestamp: Date.now(),
    message: `Uncaught error: ${event.message} at ${event.filename}:${event.lineno}`
  });
});

window.addEventListener('unhandledrejection', (event) => {
  window.__opencode_console_logs.push({
    level: 'error',
    timestamp: Date.now(),
    message: `Unhandled promise rejection: ${event.reason}`
  });
});

// Element highlighting for debugging
let highlightOverlay = null;

function highlightElement(selector) {
  removeHighlight();

  const element = document.querySelector(selector);
  if (!element) return false;

  const rect = element.getBoundingClientRect();

  highlightOverlay = document.createElement('div');
  highlightOverlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background: rgba(255, 165, 0, 0.3);
    border: 2px solid orange;
    pointer-events: none;
    z-index: 999999;
    transition: all 0.2s ease;
  `;

  document.body.appendChild(highlightOverlay);
  return true;
}

function removeHighlight() {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
}

// Expose functions to page context for background script access
window.__opencode = {
  highlightElement,
  removeHighlight,
  getConsoleLogs: () => window.__opencode_console_logs,
  clearConsoleLogs: () => { window.__opencode_console_logs = []; }
};

// Notify background script that content script is loaded
chrome.runtime.sendMessage({ type: 'content_script_loaded', url: window.location.href });

console.log('[OpenCode] Content script loaded');
