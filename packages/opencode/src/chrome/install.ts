/**
 * Native Messaging Host Installation
 *
 * Handles installing the native messaging host on different platforms
 */

import fs from "fs/promises"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { getNativeHostPath, getManifestPath, getChromiumManifestPath, generateManifestJson, NATIVE_HOST_NAME } from "./manifest"

const execAsync = promisify(exec)

export interface InstallResult {
  success: boolean
  manifestPath: string
  hostPath: string
  error?: string
}

/**
 * Install the native messaging host
 * @param extensionId The Chrome extension ID
 * @param hostSourcePath Path to the compiled native host executable
 */
export async function installNativeHost(extensionId: string, hostSourcePath?: string): Promise<InstallResult> {
  const manifestPath = getManifestPath()
  const hostPath = getNativeHostPath()

  try {
    // Create directories
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.mkdir(path.dirname(hostPath), { recursive: true })

    // Generate and write manifest
    const manifestJson = generateManifestJson(extensionId)
    await fs.writeFile(manifestPath, manifestJson, "utf-8")

    // Also install for Chromium if path exists
    const chromiumPath = getChromiumManifestPath()
    if (chromiumPath) {
      try {
        await fs.mkdir(path.dirname(chromiumPath), { recursive: true })
        await fs.writeFile(chromiumPath, manifestJson, "utf-8")
      } catch {
        // Chromium installation is optional
      }
    }

    // Copy or create native host executable
    if (hostSourcePath) {
      await fs.copyFile(hostSourcePath, hostPath)
      // Make executable on Unix
      if (process.platform !== "win32") {
        await fs.chmod(hostPath, 0o755)
      }
    } else {
      // Create a shell script that runs opencode chrome native-host
      const script = createHostScript()
      await fs.writeFile(hostPath, script, "utf-8")
      if (process.platform !== "win32") {
        await fs.chmod(hostPath, 0o755)
      }
    }

    // On Windows, also register in registry
    if (process.platform === "win32") {
      await registerWindowsHost(manifestPath)
    }

    return {
      success: true,
      manifestPath,
      hostPath,
    }
  } catch (error) {
    return {
      success: false,
      manifestPath,
      hostPath,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Uninstall the native messaging host
 */
export async function uninstallNativeHost(): Promise<{ success: boolean; error?: string }> {
  try {
    const manifestPath = getManifestPath()
    const hostPath = getNativeHostPath()

    // Remove manifest
    try {
      await fs.unlink(manifestPath)
    } catch {
      // File may not exist
    }

    // Remove Chromium manifest
    const chromiumPath = getChromiumManifestPath()
    if (chromiumPath) {
      try {
        await fs.unlink(chromiumPath)
      } catch {
        // File may not exist
      }
    }

    // Remove host
    try {
      await fs.unlink(hostPath)
    } catch {
      // File may not exist
    }

    // On Windows, remove registry entry
    if (process.platform === "win32") {
      await unregisterWindowsHost()
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check if native host is installed
 */
export async function isNativeHostInstalled(): Promise<{
  installed: boolean
  manifestPath?: string
  hostPath?: string
  extensionId?: string
}> {
  const manifestPath = getManifestPath()
  const hostPath = getNativeHostPath()

  try {
    // Check if both files exist
    await fs.access(manifestPath)
    await fs.access(hostPath)

    // Read manifest to get extension ID
    const manifestContent = await fs.readFile(manifestPath, "utf-8")
    const manifest = JSON.parse(manifestContent)
    const origin = manifest.allowed_origins?.[0] || ""
    const extensionId = origin.replace("chrome-extension://", "").replace("/", "")

    return {
      installed: true,
      manifestPath,
      hostPath,
      extensionId,
    }
  } catch {
    return { installed: false }
  }
}

/**
 * Create the shell script that acts as the native host
 */
function createHostScript(): string {
  if (process.platform === "win32") {
    // Windows batch script
    return `@echo off
opencode chrome native-host
`
  } else {
    // Unix shell script
    return `#!/bin/bash
exec opencode chrome native-host
`
  }
}

/**
 * Register native messaging host in Windows registry
 */
async function registerWindowsHost(manifestPath: string): Promise<void> {
  const regPath = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`
  await execAsync(`reg add "${regPath}" /ve /d "${manifestPath}" /f`)
}

/**
 * Unregister native messaging host from Windows registry
 */
async function unregisterWindowsHost(): Promise<void> {
  const regPath = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`
  try {
    await execAsync(`reg delete "${regPath}" /f`)
  } catch {
    // Key may not exist
  }
}
