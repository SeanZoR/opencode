/**
 * Chrome Browser Automation CLI Commands
 *
 * Manages the OpenCode Browser Extension and native messaging host
 */

import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Instance } from "../../project/instance"
import {
  Chrome,
  installNativeHost,
  uninstallNativeHost,
  isNativeHostInstalled,
  runNativeHost,
  getClientStatus,
} from "../../chrome"
import { getManifestPath, getNativeHostPath, NATIVE_HOST_NAME } from "../../chrome/manifest"

export const ChromeCommand = cmd({
  command: "chrome",
  describe: "manage Chrome browser automation",
  builder: (yargs) =>
    yargs
      .command(ChromeStatusCommand)
      .command(ChromeInstallCommand)
      .command(ChromeUninstallCommand)
      .command(ChromeNativeHostCommand)
      .demandCommand(),
  async handler() {},
})

export const ChromeStatusCommand = cmd({
  command: "status",
  describe: "show Chrome extension installation status",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Chrome Browser Automation Status")

        const info = await isNativeHostInstalled()

        if (!info.installed) {
          prompts.log.warn("Native messaging host is not installed")
          prompts.log.info(`Run 'opencode chrome install' to set up browser automation`)
          prompts.outro("Not configured")
          return
        }

        prompts.log.success("Native messaging host is installed")
        prompts.log.info(`  Host name: ${NATIVE_HOST_NAME}`)
        prompts.log.info(`  Manifest: ${info.manifestPath}`)
        prompts.log.info(`  Host path: ${info.hostPath}`)

        if (info.extensionId) {
          prompts.log.info(`  Extension ID: ${info.extensionId}`)
        }

        // Check connection status
        const status = Chrome.status()
        if (status.status === "connected") {
          prompts.log.success(`Connected to Chrome extension`)
        } else if (status.status === "error") {
          prompts.log.error(`Connection error: ${status.error}`)
        } else {
          prompts.log.warn(`Not connected (extension may not be active)`)
          prompts.log.info(`  Click the OpenCode Browser extension icon in Chrome to connect`)
        }

        prompts.outro("Configuration complete")
      },
    })
  },
})

export const ChromeInstallCommand = cmd({
  command: "install [extension-id]",
  describe: "install native messaging host for Chrome extension",
  builder: (yargs) =>
    yargs
      .positional("extension-id", {
        describe: "Chrome extension ID (from chrome://extensions when loaded unpacked)",
        type: "string",
      })
      .option("force", {
        describe: "overwrite existing installation",
        type: "boolean",
        default: false,
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Install Chrome Native Messaging Host")

        // Check if already installed
        const existing = await isNativeHostInstalled()
        if (existing.installed && !args.force) {
          prompts.log.warn("Native messaging host is already installed")
          prompts.log.info(`  Extension ID: ${existing.extensionId}`)
          prompts.log.info(`  Use --force to overwrite`)
          prompts.outro("Skipped")
          return
        }

        // Get extension ID
        let extensionId = args["extension-id"]
        if (!extensionId) {
          prompts.log.info("To find your extension ID:")
          prompts.log.info("  1. Go to chrome://extensions in Chrome")
          prompts.log.info("  2. Enable 'Developer mode' (toggle in top-right)")
          prompts.log.info("  3. Load unpacked extension from:")
          prompts.log.info(`     ${process.cwd()}/packages/chrome-extension`)
          prompts.log.info("  4. Copy the 'ID' shown under the extension")
          prompts.log.info("")

          const response = await prompts.text({
            message: "Enter your Chrome extension ID:",
            placeholder: "abcdefghijklmnopqrstuvwxyz123456",
            validate: (value) => {
              if (!value) return "Extension ID is required"
              if (!/^[a-z]{32}$/.test(value)) {
                return "Extension ID should be 32 lowercase letters"
              }
            },
          })

          if (prompts.isCancel(response)) {
            prompts.cancel("Installation cancelled")
            return
          }

          extensionId = response
        }

        // Install
        prompts.log.step("Installing native messaging host...")

        const result = await installNativeHost(extensionId)

        if (!result.success) {
          prompts.log.error(`Installation failed: ${result.error}`)
          prompts.outro("Failed")
          return
        }

        prompts.log.success("Native messaging host installed!")
        prompts.log.info(`  Manifest: ${result.manifestPath}`)
        prompts.log.info(`  Host: ${result.hostPath}`)
        prompts.log.info("")
        prompts.log.info("Next steps:")
        prompts.log.info("  1. Restart Chrome (close all windows)")
        prompts.log.info("  2. Click the OpenCode Browser extension icon")
        prompts.log.info("  3. Run 'opencode chrome status' to verify")

        prompts.outro("Installation complete")
      },
    })
  },
})

export const ChromeUninstallCommand = cmd({
  command: "uninstall",
  describe: "uninstall native messaging host",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Uninstall Chrome Native Messaging Host")

        const confirm = await prompts.confirm({
          message: "Are you sure you want to uninstall the Chrome native messaging host?",
        })

        if (prompts.isCancel(confirm) || !confirm) {
          prompts.cancel("Uninstallation cancelled")
          return
        }

        const result = await uninstallNativeHost()

        if (!result.success) {
          prompts.log.error(`Uninstallation failed: ${result.error}`)
          prompts.outro("Failed")
          return
        }

        prompts.log.success("Native messaging host uninstalled")
        prompts.outro("Complete")
      },
    })
  },
})

export const ChromeNativeHostCommand = cmd({
  command: "native-host",
  describe: false, // Hidden command - runs the native host process
  async handler() {
    // This is called by Chrome when connecting via native messaging
    runNativeHost()
  },
})
