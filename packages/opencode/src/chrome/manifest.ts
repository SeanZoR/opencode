/**
 * Native Messaging Host Manifest
 *
 * Generates platform-specific manifest for Chrome Native Messaging
 */

import path from "path"
import os from "os"

export const NATIVE_HOST_NAME = "com.opencode.browser"

export interface NativeManifest {
  name: string
  description: string
  path: string
  type: "stdio"
  allowed_origins: string[]
}

/**
 * Get the path where the native host executable should be installed
 */
export function getNativeHostPath(): string {
  const home = os.homedir()

  switch (process.platform) {
    case "darwin":
    case "linux":
      return path.join(home, ".opencode", "chrome", "native-host")
    case "win32":
      return path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "OpenCode", "chrome", "native-host.exe")
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

/**
 * Get the path where the manifest should be installed
 */
export function getManifestPath(): string {
  const home = os.homedir()

  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", `${NATIVE_HOST_NAME}.json`)
    case "linux":
      return path.join(home, ".config", "google-chrome", "NativeMessagingHosts", `${NATIVE_HOST_NAME}.json`)
    case "win32":
      return path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "OpenCode", "chrome", `${NATIVE_HOST_NAME}.json`)
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}

/**
 * Get Chromium browser manifest path (for non-Google Chrome browsers)
 */
export function getChromiumManifestPath(): string | null {
  const home = os.homedir()

  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "Chromium", "NativeMessagingHosts", `${NATIVE_HOST_NAME}.json`)
    case "linux":
      return path.join(home, ".config", "chromium", "NativeMessagingHosts", `${NATIVE_HOST_NAME}.json`)
    default:
      return null
  }
}

/**
 * Generate the native messaging host manifest
 * @param extensionId The Chrome extension ID (from chrome://extensions when unpacked, or from store)
 */
export function generateManifest(extensionId: string): NativeManifest {
  return {
    name: NATIVE_HOST_NAME,
    description: "OpenCode Browser Automation Native Messaging Host",
    path: getNativeHostPath(),
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  }
}

/**
 * Generate manifest JSON string
 */
export function generateManifestJson(extensionId: string): string {
  const manifest = generateManifest(extensionId)
  return JSON.stringify(manifest, null, 2)
}
