/**
 * OpenCode Browser Extension - Background Service Worker
 *
 * This extension acts as a bridge between OpenCode and Chrome.
 * It exposes browser automation tools via a simple HTTP interface
 * that OpenCode can connect to as an MCP server.
 */

const SERVER_PORT = 19875;

// Connection state
let serverStarted = false;
let pendingRequests = new Map();

// Generate unique IDs
function generateId() {
  return crypto.randomUUID();
}

// ============ Server Setup ============
// Note: Chrome extensions can't run traditional HTTP servers,
// but we can use chrome.runtime messaging as the transport
// and have a companion native host that forwards HTTP requests

// Store for browser state
let tabGroups = new Map();
let currentGroupId = null;

// ============ Browser Tools ============

// Navigate to URL
async function browserNavigate({ tabId, url }) {
  const tab = await chrome.tabs.update(tabId, { url });

  // Wait for page to load
  await new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });

  const updatedTab = await chrome.tabs.get(tabId);
  return {
    tabId: updatedTab.id,
    url: updatedTab.url,
    title: updatedTab.title
  };
}

// Get accessibility snapshot
async function browserSnapshot({ tabId }) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: getAccessibilitySnapshot
  });

  return results[0]?.result || { error: 'Failed to get snapshot' };
}

// Click element
async function browserClick({ tabId, selector, ref }) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: clickElement,
    args: [selector, ref]
  });

  return results[0]?.result || { success: false };
}

// Type text
async function browserType({ tabId, selector, ref, text }) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: typeText,
    args: [selector, ref, text]
  });

  return results[0]?.result || { success: false };
}

// Take screenshot
async function browserScreenshot({ tabId }) {
  // Get the window of the tab first
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  return { dataUrl };
}

// Get/manage tabs
async function browserTabs({ action, tabId }) {
  switch (action) {
    case 'list':
      const tabs = await chrome.tabs.query({});
      return {
        tabs: tabs.map(t => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active
        }))
      };
    case 'activate':
      await chrome.tabs.update(tabId, { active: true });
      return { success: true };
    case 'close':
      await chrome.tabs.remove(tabId);
      return { success: true };
    default:
      throw new Error(`Unknown tab action: ${action}`);
  }
}

// Evaluate JavaScript
async function browserEvaluate({ tabId, code }) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: new Function('return (' + code + ')'),
  });

  return { result: results[0]?.result };
}

// Read console messages
async function browserReadConsole({ tabId }) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__opencode_console_logs || []
  });

  return { messages: results[0]?.result || [] };
}

// Create new tab
async function browserCreateTab({ url }) {
  const tab = await chrome.tabs.create({ url: url || 'about:blank' });
  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title
  };
}

// Close tab
async function browserCloseTab({ tabId }) {
  await chrome.tabs.remove(tabId);
  return { success: true };
}

// Get browser context
async function browserGetContext() {
  const tabs = await chrome.tabs.query({});
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return {
    tabs: tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      windowId: t.windowId
    })),
    activeTabId: activeTab?.id,
    extensionId: chrome.runtime.id
  };
}

// ============ Handle Tool Calls ============

async function handleToolCall(method, params) {
  switch (method) {
    case 'browser_navigate':
      return await browserNavigate(params);
    case 'browser_snapshot':
      return await browserSnapshot(params);
    case 'browser_click':
      return await browserClick(params);
    case 'browser_type':
      return await browserType(params);
    case 'browser_screenshot':
      return await browserScreenshot(params);
    case 'browser_tabs':
      return await browserTabs(params);
    case 'browser_evaluate':
      return await browserEvaluate(params);
    case 'browser_read_console':
      return await browserReadConsole(params);
    case 'browser_create_tab':
      return await browserCreateTab(params);
    case 'browser_close_tab':
      return await browserCloseTab(params);
    case 'browser_get_context':
      return await browserGetContext(params);
    case 'ping':
      return { pong: true, timestamp: Date.now(), extensionId: chrome.runtime.id };
    case 'tools/list':
      return {
        tools: [
          { name: 'browser_navigate', description: 'Navigate to URL', inputSchema: { type: 'object', properties: { tabId: { type: 'number' }, url: { type: 'string' } }, required: ['tabId', 'url'] } },
          { name: 'browser_snapshot', description: 'Get page accessibility snapshot', inputSchema: { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'] } },
          { name: 'browser_click', description: 'Click element', inputSchema: { type: 'object', properties: { tabId: { type: 'number' }, selector: { type: 'string' }, ref: { type: 'string' } }, required: ['tabId'] } },
          { name: 'browser_type', description: 'Type text', inputSchema: { type: 'object', properties: { tabId: { type: 'number' }, text: { type: 'string' }, selector: { type: 'string' }, ref: { type: 'string' } }, required: ['tabId', 'text'] } },
          { name: 'browser_screenshot', description: 'Take screenshot', inputSchema: { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'] } },
          { name: 'browser_tabs', description: 'Manage tabs', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'activate', 'close'] }, tabId: { type: 'number' } }, required: ['action'] } },
          { name: 'browser_evaluate', description: 'Execute JavaScript', inputSchema: { type: 'object', properties: { tabId: { type: 'number' }, code: { type: 'string' } }, required: ['tabId', 'code'] } },
          { name: 'browser_create_tab', description: 'Create new tab', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
          { name: 'browser_close_tab', description: 'Close tab', inputSchema: { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'] } },
          { name: 'browser_get_context', description: 'Get browser context', inputSchema: { type: 'object', properties: {} } },
        ]
      };
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// ============ Native Messaging ============

const NATIVE_HOST_NAME = 'com.opencode.browser';
let nativePort = null;

function connectNativeHost() {
  if (nativePort) return;

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    console.log('[OpenCode] Connected to native host');

    nativePort.onMessage.addListener(async (message) => {
      console.log('[OpenCode] Received from native:', message);

      if (message.id && message.method) {
        try {
          const result = await handleToolCall(message.method, message.params || {});
          nativePort.postMessage({ id: message.id, result });
        } catch (error) {
          nativePort.postMessage({
            id: message.id,
            error: { code: -32603, message: error.message }
          });
        }
      }
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('[OpenCode] Disconnected from native host:', chrome.runtime.lastError?.message);
      nativePort = null;
    });
  } catch (error) {
    console.error('[OpenCode] Failed to connect:', error);
  }
}

// ============ Content Script Functions ============

function getAccessibilitySnapshot() {
  const snapshot = {
    url: window.location.href,
    title: document.title,
    elements: []
  };

  let refCounter = 0;

  function walkDOM(node, depth = 0) {
    if (depth > 10) return;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = {
        ref: `ref_${refCounter++}`,
        tag: node.tagName.toLowerCase(),
        role: node.getAttribute('role') || getImplicitRole(node),
        name: getAccessibleName(node),
        text: node.textContent?.slice(0, 100),
        attributes: {}
      };

      ['id', 'class', 'href', 'src', 'type', 'value', 'placeholder', 'aria-label'].forEach(attr => {
        if (node.hasAttribute(attr)) {
          element.attributes[attr] = node.getAttribute(attr);
        }
      });

      if (isInteractive(node)) {
        element.interactive = true;
        const rect = node.getBoundingClientRect();
        element.bounds = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      }

      snapshot.elements.push(element);
    }

    for (const child of node.childNodes) {
      walkDOM(child, depth + 1);
    }
  }

  function getImplicitRole(element) {
    const tag = element.tagName.toLowerCase();
    const roleMap = {
      'a': 'link',
      'button': 'button',
      'input': element.type === 'checkbox' ? 'checkbox' :
               element.type === 'radio' ? 'radio' :
               element.type === 'submit' ? 'button' : 'textbox',
      'select': 'combobox',
      'textarea': 'textbox',
      'img': 'img',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'aside': 'complementary',
      'article': 'article',
      'section': 'region'
    };
    return roleMap[tag] || null;
  }

  function getAccessibleName(element) {
    return element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           element.getAttribute('alt') ||
           (element.tagName === 'INPUT' ? element.placeholder : null) ||
           element.textContent?.trim().slice(0, 50) ||
           null;
  }

  function isInteractive(element) {
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
    const tag = element.tagName.toLowerCase();
    return interactiveTags.includes(tag) ||
           element.hasAttribute('onclick') ||
           element.getAttribute('role') === 'button' ||
           element.getAttribute('tabindex') !== null;
  }

  walkDOM(document.body);
  return snapshot;
}

function clickElement(selector, ref) {
  let element;

  if (ref) {
    const elements = document.querySelectorAll('*');
    let counter = 0;
    for (const el of elements) {
      if (`ref_${counter}` === ref) {
        element = el;
        break;
      }
      counter++;
    }
  } else if (selector) {
    element = document.querySelector(selector);
  }

  if (!element) {
    return { success: false, error: 'Element not found' };
  }

  element.click();
  return { success: true };
}

function typeText(selector, ref, text) {
  let element;

  if (ref) {
    const elements = document.querySelectorAll('*');
    let counter = 0;
    for (const el of elements) {
      if (`ref_${counter}` === ref) {
        element = el;
        break;
      }
      counter++;
    }
  } else if (selector) {
    element = document.querySelector(selector);
  }

  if (!element) {
    return { success: false, error: 'Element not found' };
  }

  element.focus();
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true };
}

// ============ Lifecycle ============

// Auto-connect when extension loads
chrome.runtime.onStartup.addListener(() => {
  console.log('[OpenCode] Extension starting up');
  connectNativeHost();
});

// Also try to connect when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OpenCode] Extension installed');
  connectNativeHost();
});

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
  console.log('[OpenCode] Icon clicked, attempting to connect...');
  connectNativeHost();
});

// Listen for external messages (from web pages or other extensions)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') {
    sendResponse({ pong: true, extensionId: chrome.runtime.id });
  }
  return true;
});

console.log('[OpenCode] Background service worker loaded');
// Try to connect immediately
connectNativeHost();
