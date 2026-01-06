/**
 * Chrome Browser Automation Module
 *
 * Provides browser automation capabilities through the OpenCode Browser Extension
 * using Chrome's Native Messaging API.
 */

import { installNativeHost, uninstallNativeHost, isNativeHostInstalled } from "./install"
import { browserTools } from "./tools"
import type { BrowserToolName } from "./tools"
import { getNativeHostPath, getManifestPath, NATIVE_HOST_NAME } from "./manifest"
import {
  connectToChrome,
  disconnectFromChrome,
  getClientStatus,
  isClientConnected,
  chromeClientEvents,
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
  type ChromeClientStatus,
} from "./client"

// Re-export everything
export { installNativeHost, uninstallNativeHost, isNativeHostInstalled } from "./install"
export { browserTools } from "./tools"
export type { BrowserToolName } from "./tools"
export { getNativeHostPath, getManifestPath, NATIVE_HOST_NAME } from "./manifest"
export { runNativeHost } from "./native-host"
export {
  connectToChrome,
  disconnectFromChrome,
  getClientStatus,
  isClientConnected,
  chromeClientEvents,
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
  type ChromeClientStatus,
} from "./client"

/**
 * Get installation info
 */
export async function getInstallInfo(): Promise<{
  installed: boolean
  manifestPath: string
  hostPath: string
  extensionId?: string
}> {
  const info = await isNativeHostInstalled()

  return {
    installed: info.installed,
    manifestPath: getManifestPath(),
    hostPath: getNativeHostPath(),
    extensionId: info.extensionId,
  }
}

/**
 * Chrome namespace for external use
 */
export namespace Chrome {
  export const connect = connectToChrome
  export const disconnect = disconnectFromChrome
  export const status = getClientStatus
  export const connected = isClientConnected
  export const events = chromeClientEvents
  export const tools = browserTools
  export const install = installNativeHost
  export const uninstall = uninstallNativeHost
  export const info = getInstallInfo

  // Browser actions
  export const navigate = browserNavigate
  export const snapshot = browserSnapshot
  export const click = browserClick
  export const type = browserType
  export const screenshot = browserScreenshot
  export const tabs = browserTabs
  export const evaluate = browserEvaluate
  export const readConsole = browserReadConsole
  export const createTab = browserCreateTab
  export const closeTab = browserCloseTab
  export const getContext = browserGetContext
}

export default Chrome
