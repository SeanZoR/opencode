/**
 * Browser Tools
 *
 * Tool definitions for browser automation via Chrome extension
 */

import { z } from "zod"

// Tool parameter schemas
export const NavigateParams = z.object({
  tabId: z.number().describe("Tab ID to navigate"),
  url: z.string().url().describe("URL to navigate to"),
})

export const SnapshotParams = z.object({
  tabId: z.number().describe("Tab ID to snapshot"),
})

export const ClickParams = z.object({
  tabId: z.number().describe("Tab ID"),
  selector: z.string().optional().describe("CSS selector of element to click"),
  ref: z.string().optional().describe("Element reference from snapshot"),
})

export const TypeParams = z.object({
  tabId: z.number().describe("Tab ID"),
  selector: z.string().optional().describe("CSS selector of element"),
  ref: z.string().optional().describe("Element reference from snapshot"),
  text: z.string().describe("Text to type"),
})

export const ScreenshotParams = z.object({
  tabId: z.number().describe("Tab ID to screenshot"),
})

export const TabsParams = z.object({
  action: z.enum(["list", "activate", "close"]).describe("Tab action"),
  tabId: z.number().optional().describe("Tab ID for activate/close actions"),
})

export const EvaluateParams = z.object({
  tabId: z.number().describe("Tab ID"),
  code: z.string().describe("JavaScript code to evaluate"),
})

export const ConsoleParams = z.object({
  tabId: z.number().describe("Tab ID"),
})

export const CreateTabParams = z.object({
  url: z.string().url().optional().describe("URL to open in new tab"),
})

export const CloseTabParams = z.object({
  tabId: z.number().describe("Tab ID to close"),
})

// Tool definitions
export const browserTools = {
  browser_navigate: {
    name: "browser_navigate",
    description: "Navigate a browser tab to a URL",
    parameters: NavigateParams,
  },
  browser_snapshot: {
    name: "browser_snapshot",
    description: "Get accessibility snapshot of page (DOM tree with interactive elements)",
    parameters: SnapshotParams,
  },
  browser_click: {
    name: "browser_click",
    description: "Click an element on the page",
    parameters: ClickParams,
  },
  browser_type: {
    name: "browser_type",
    description: "Type text into an element",
    parameters: TypeParams,
  },
  browser_screenshot: {
    name: "browser_screenshot",
    description: "Take a screenshot of the visible tab",
    parameters: ScreenshotParams,
  },
  browser_tabs: {
    name: "browser_tabs",
    description: "List, activate, or close browser tabs",
    parameters: TabsParams,
  },
  browser_evaluate: {
    name: "browser_evaluate",
    description: "Execute JavaScript in page context",
    parameters: EvaluateParams,
  },
  browser_read_console: {
    name: "browser_read_console",
    description: "Read console messages from the page",
    parameters: ConsoleParams,
  },
  browser_create_tab: {
    name: "browser_create_tab",
    description: "Create a new browser tab",
    parameters: CreateTabParams,
  },
  browser_close_tab: {
    name: "browser_close_tab",
    description: "Close a browser tab",
    parameters: CloseTabParams,
  },
  browser_get_context: {
    name: "browser_get_context",
    description: "Get browser context (all tabs, active tab, extension info)",
    parameters: z.object({}),
  },
}

export type BrowserToolName = keyof typeof browserTools
