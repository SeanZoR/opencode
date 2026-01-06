/**
 * Browser Tools
 *
 * Provides browser automation capabilities through the OpenCode Browser Extension.
 * These tools are only available when connected to Chrome via native messaging.
 */

import { z } from "zod"
import { Tool } from "./tool"
import { Identifier } from "../id/id"
import {
  isClientConnected,
  browserNavigate,
  browserSnapshot,
  browserClick,
  browserType,
  browserScreenshot,
  browserTabs,
  browserEvaluate,
  browserReadConsole,
  browserCreateTab,
  browserCloseTab,
  browserGetContext,
} from "../chrome/client"

/**
 * Navigate to URL
 */
export const BrowserNavigateTool = Tool.define(
  "browser_navigate",
  {
    description: "Navigate a browser tab to a URL. Requires Chrome extension connection.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID to navigate"),
      url: z.string().describe("URL to navigate to"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserNavigate(args.tabId, args.url)

      return {
        title: `Navigated to ${result.title || args.url}`,
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Get accessibility snapshot
 */
export const BrowserSnapshotTool = Tool.define(
  "browser_snapshot",
  {
    description:
      "Get accessibility snapshot of page (DOM tree with interactive elements). Returns element refs for clicking/typing.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID to snapshot"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserSnapshot(args.tabId)

      return {
        title: "Page snapshot",
        metadata: {},
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Click element
 */
export const BrowserClickTool = Tool.define(
  "browser_click",
  {
    description: "Click an element on the page. Use ref from snapshot or CSS selector.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID"),
      selector: z.string().optional().describe("CSS selector of element to click"),
      ref: z.string().optional().describe("Element reference from snapshot (e.g., ref_5)"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserClick(args.tabId, {
        selector: args.selector,
        ref: args.ref,
      })

      return {
        title: result.success ? "Clicked element" : "Click failed",
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Type text
 */
export const BrowserTypeTool = Tool.define(
  "browser_type",
  {
    description: "Type text into an element (input, textarea, etc.). Use ref from snapshot or CSS selector.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID"),
      text: z.string().describe("Text to type"),
      selector: z.string().optional().describe("CSS selector of element"),
      ref: z.string().optional().describe("Element reference from snapshot (e.g., ref_5)"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserType(args.tabId, args.text, {
        selector: args.selector,
        ref: args.ref,
      })

      return {
        title: result.success ? "Typed text" : "Type failed",
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Take screenshot
 */
export const BrowserScreenshotTool = Tool.define(
  "browser_screenshot",
  {
    description: "Take a screenshot of the visible tab. Returns base64 data URL.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID to screenshot"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserScreenshot(args.tabId)

      return {
        title: "Screenshot captured",
        metadata: {},
        output: `Screenshot captured. Data URL length: ${result.dataUrl.length} chars`,
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file" as const,
            mime: "image/png",
            url: result.dataUrl,
            filename: "screenshot.png",
          },
        ],
      }
    },
  },
)

/**
 * Manage tabs
 */
export const BrowserTabsTool = Tool.define(
  "browser_tabs",
  {
    description: "List, activate, or close browser tabs.",
    parameters: z.object({
      action: z.enum(["list", "activate", "close"]).describe("Tab action: list, activate, or close"),
      tabId: z.number().optional().describe("Tab ID for activate/close actions"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserTabs(args.action, args.tabId)

      return {
        title: `Tabs: ${args.action}`,
        metadata: {},
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Execute JavaScript
 */
export const BrowserEvaluateTool = Tool.define(
  "browser_evaluate",
  {
    description: "Execute JavaScript code in page context. Returns the result.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID"),
      code: z.string().describe("JavaScript code to evaluate"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserEvaluate(args.tabId, args.code)

      return {
        title: "JavaScript evaluated",
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Read console
 */
export const BrowserReadConsoleTool = Tool.define(
  "browser_read_console",
  {
    description: "Read console messages from the page (logs, errors, warnings).",
    parameters: z.object({
      tabId: z.number().describe("Tab ID"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserReadConsole(args.tabId)

      return {
        title: `Console: ${result.messages.length} messages`,
        metadata: {},
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Create new tab
 */
export const BrowserCreateTabTool = Tool.define(
  "browser_create_tab",
  {
    description: "Create a new browser tab, optionally with a URL.",
    parameters: z.object({
      url: z.string().optional().describe("URL to open in new tab"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserCreateTab(args.url)

      return {
        title: `Created tab ${result.tabId}`,
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Close tab
 */
export const BrowserCloseTabTool = Tool.define(
  "browser_close_tab",
  {
    description: "Close a browser tab.",
    parameters: z.object({
      tabId: z.number().describe("Tab ID to close"),
    }),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserCloseTab(args.tabId)

      return {
        title: "Tab closed",
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * Get browser context
 */
export const BrowserGetContextTool = Tool.define(
  "browser_get_context",
  {
    description: "Get browser context info: all tabs, active tab, extension info.",
    parameters: z.object({}),
    async execute(args, ctx) {
      if (!isClientConnected()) {
        return {
          title: "Browser not connected",
          metadata: {},
          output: "Chrome extension is not connected. Click the OpenCode Browser extension icon in Chrome to connect.",
        }
      }

      const result = await browserGetContext()

      return {
        title: `Browser context: ${result.tabs.length} tabs`,
        metadata: result,
        output: JSON.stringify(result, null, 2),
      }
    },
  },
)

/**
 * All browser tools
 */
export const BrowserTools = [
  BrowserNavigateTool,
  BrowserSnapshotTool,
  BrowserClickTool,
  BrowserTypeTool,
  BrowserScreenshotTool,
  BrowserTabsTool,
  BrowserEvaluateTool,
  BrowserReadConsoleTool,
  BrowserCreateTabTool,
  BrowserCloseTabTool,
  BrowserGetContextTool,
]
