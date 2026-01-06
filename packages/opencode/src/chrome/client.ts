/**
 * Chrome Extension Client
 *
 * Communicates with the Chrome extension via the native host's HTTP bridge.
 * The native host exposes an HTTP server at localhost:19875 that forwards
 * requests to the extension via native messaging.
 */

import { EventEmitter } from "events"
import { Log } from "../util/log"

const log = Log.create({ service: "chrome.client" })

const HTTP_PORT = 19875
const BASE_URL = `http://localhost:${HTTP_PORT}`

export type ChromeClientStatus =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected" }
  | { status: "error"; error: string }

let clientStatus: ChromeClientStatus = { status: "disconnected" }

// Event emitter for connection events
export const chromeClientEvents = new EventEmitter()

/**
 * Get current client status
 */
export function getClientStatus(): ChromeClientStatus {
  return clientStatus
}

/**
 * Check if connected to Chrome
 */
export function isClientConnected(): boolean {
  return clientStatus.status === "connected"
}

/**
 * Check health of the native host HTTP bridge
 */
export async function checkHealth(): Promise<{ ok: boolean; extensionConnected: boolean }> {
  try {
    const response = await fetch(`${BASE_URL}/health`)
    if (!response.ok) {
      return { ok: false, extensionConnected: false }
    }
    return await response.json()
  } catch {
    return { ok: false, extensionConnected: false }
  }
}

/**
 * Connect to Chrome extension via HTTP bridge
 * This checks if the native host is running and extension is connected
 */
export async function connectToChrome(): Promise<boolean> {
  clientStatus = { status: "connecting" }
  chromeClientEvents.emit("status", clientStatus)

  try {
    const health = await checkHealth()

    if (!health.ok) {
      throw new Error("Native host not running. Click the OpenCode extension icon in Chrome to start it.")
    }

    if (!health.extensionConnected) {
      throw new Error("Extension not connected to native host.")
    }

    // Test with a ping
    const result = await sendChromeRequest("ping", {})
    log.info("Connected to Chrome extension", { result })

    clientStatus = { status: "connected" }
    chromeClientEvents.emit("status", clientStatus)
    chromeClientEvents.emit("connected")
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error("Failed to connect to Chrome", { error: message })
    clientStatus = { status: "error", error: message }
    chromeClientEvents.emit("status", clientStatus)
    return false
  }
}

/**
 * Disconnect from Chrome
 */
export function disconnectFromChrome(): void {
  clientStatus = { status: "disconnected" }
  chromeClientEvents.emit("status", clientStatus)
  chromeClientEvents.emit("disconnected")
}

/**
 * Send a request to Chrome extension via HTTP bridge
 */
export async function sendChromeRequest(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 60000
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
      signal: controller.signal,
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || "Unknown error")
    }

    return data.result
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out: ${method}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// ============ Browser Tool Implementations ============

/**
 * Navigate to a URL
 */
export async function browserNavigate(tabId: number, url: string): Promise<{ tabId: number; url: string; title: string }> {
  const result = await sendChromeRequest("browser_navigate", { tabId, url })
  return result as { tabId: number; url: string; title: string }
}

/**
 * Get page accessibility snapshot
 */
export async function browserSnapshot(tabId: number): Promise<unknown> {
  return await sendChromeRequest("browser_snapshot", { tabId })
}

/**
 * Click an element
 */
export async function browserClick(tabId: number, options: { selector?: string; ref?: string }): Promise<{ success: boolean }> {
  const result = await sendChromeRequest("browser_click", { tabId, ...options })
  return result as { success: boolean }
}

/**
 * Type text into an element
 */
export async function browserType(
  tabId: number,
  text: string,
  options: { selector?: string; ref?: string }
): Promise<{ success: boolean }> {
  const result = await sendChromeRequest("browser_type", { tabId, text, ...options })
  return result as { success: boolean }
}

/**
 * Take screenshot
 */
export async function browserScreenshot(tabId: number): Promise<{ dataUrl: string }> {
  const result = await sendChromeRequest("browser_screenshot", { tabId })
  return result as { dataUrl: string }
}

/**
 * Manage tabs
 */
export async function browserTabs(action: "list" | "activate" | "close", tabId?: number): Promise<unknown> {
  return await sendChromeRequest("browser_tabs", { action, tabId })
}

/**
 * Execute JavaScript
 */
export async function browserEvaluate(tabId: number, code: string): Promise<{ result: unknown }> {
  const result = await sendChromeRequest("browser_evaluate", { tabId, code })
  return result as { result: unknown }
}

/**
 * Read console messages
 */
export async function browserReadConsole(tabId: number): Promise<{ messages: Array<{ level: string; message: string; timestamp: number }> }> {
  const result = await sendChromeRequest("browser_read_console", { tabId })
  return result as { messages: Array<{ level: string; message: string; timestamp: number }> }
}

/**
 * Create a new tab
 */
export async function browserCreateTab(url?: string): Promise<{ tabId: number; url: string; title: string }> {
  const result = await sendChromeRequest("browser_create_tab", { url })
  return result as { tabId: number; url: string; title: string }
}

/**
 * Close a tab
 */
export async function browserCloseTab(tabId: number): Promise<{ success: boolean }> {
  const result = await sendChromeRequest("browser_close_tab", { tabId })
  return result as { success: boolean }
}

/**
 * Get browser context (all tabs, active tab info)
 */
export async function browserGetContext(): Promise<{
  tabs: Array<{ id: number; url: string; title: string; active: boolean; windowId: number }>
  activeTabId: number
  extensionId: string
}> {
  const result = await sendChromeRequest("browser_get_context", {})
  return result as {
    tabs: Array<{ id: number; url: string; title: string; active: boolean; windowId: number }>
    activeTabId: number
    extensionId: string
  }
}
