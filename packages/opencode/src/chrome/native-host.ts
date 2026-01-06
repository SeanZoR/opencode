/**
 * Native Messaging Host with HTTP Bridge
 *
 * This process serves two purposes:
 * 1. Communicates with Chrome extension via native messaging (stdin/stdout)
 * 2. Exposes an HTTP server for OpenCode to call browser tools
 *
 * Flow:
 * OpenCode → HTTP (localhost:19875) → Native Host → Native Messaging → Extension
 */

import { createMessageReader, writeMessage, RequestMessage, ResponseMessage } from "./protocol"

const HTTP_PORT = 19875

// Pending requests waiting for responses from extension
const pendingRequests = new Map<
  string,
  {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }
>()

// Request timeout in ms
const REQUEST_TIMEOUT = 60000

// Track if extension is connected
let extensionConnected = false

/**
 * Send a request to the Chrome extension and wait for response
 */
function sendToExtension(method: string, params?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!extensionConnected) {
      reject(new Error("Chrome extension not connected"))
      return
    }

    const id = crypto.randomUUID()

    const timeout = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`Request timed out: ${method}`))
    }, REQUEST_TIMEOUT)

    pendingRequests.set(id, { resolve, reject, timeout })

    writeMessage(process.stdout, { id, method, params })
  })
}

/**
 * Handle incoming messages from Chrome extension (via stdin)
 */
function handleExtensionMessage(message: unknown): void {
  const msg = message as { id?: string; result?: unknown; error?: { message: string } }

  // Handle response to our request
  if (msg.id && pendingRequests.has(msg.id)) {
    const pending = pendingRequests.get(msg.id)!
    clearTimeout(pending.timeout)
    pendingRequests.delete(msg.id)

    if (msg.error) {
      pending.reject(new Error(msg.error.message))
    } else {
      pending.resolve(msg.result)
    }
    return
  }

  // Handle notification/event from extension
  console.error("[native-host] Event from extension:", JSON.stringify(message))
}

/**
 * Start HTTP server for OpenCode
 */
async function startHttpServer(): Promise<void> {
  const server = Bun.serve({
    port: HTTP_PORT,
    async fetch(req) {
      const url = new URL(req.url)

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }

      // Handle preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders })
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json(
          { ok: true, extensionConnected },
          { headers: corsHeaders }
        )
      }

      // MCP-style endpoint
      if (url.pathname === "/mcp" && req.method === "POST") {
        try {
          const body = await req.json()
          const { method, params } = body

          if (!method) {
            return Response.json(
              { error: { message: "Missing method" } },
              { status: 400, headers: corsHeaders }
            )
          }

          const result = await sendToExtension(method, params || {})
          return Response.json({ result }, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: { message: error instanceof Error ? error.message : String(error) } },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // Tool call endpoint (simpler)
      if (url.pathname.startsWith("/tool/") && req.method === "POST") {
        const method = url.pathname.replace("/tool/", "")
        try {
          const params = await req.json()
          const result = await sendToExtension(method, params)
          return Response.json({ result }, { headers: corsHeaders })
        } catch (error) {
          return Response.json(
            { error: { message: error instanceof Error ? error.message : String(error) } },
            { status: 500, headers: corsHeaders }
          )
        }
      }

      return Response.json(
        { error: { message: "Not found" } },
        { status: 404, headers: corsHeaders }
      )
    },
  })

  console.error(`[native-host] HTTP server listening on http://localhost:${HTTP_PORT}`)
}

/**
 * Run the native host
 */
export function runNativeHost(): void {
  // Mark extension as connected when we start (Chrome spawned us)
  extensionConnected = true

  // Start HTTP server for OpenCode
  startHttpServer()

  // Configure stdin for binary reading (if available and if it's a TTY)
  try {
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
  } catch (e) {
    console.error("[native-host] Could not set raw mode:", e)
  }

  // Start reading messages from Chrome extension (via stdin)
  createMessageReader(
    process.stdin,
    (message) => {
      console.error("[native-host] Received message:", JSON.stringify(message))
      handleExtensionMessage(message)
    },
    (error) => {
      console.error("[native-host] Error reading from extension:", error.message)
      extensionConnected = false
    }
  )

  // Handle stdin end (extension disconnected)
  process.stdin.on("end", () => {
    console.error("[native-host] stdin ended - extension disconnected")
    extensionConnected = false
    // Don't exit - keep HTTP server running for debugging
  })

  process.stdin.on("close", () => {
    console.error("[native-host] stdin closed")
  })

  // Handle process signals
  process.on("SIGTERM", () => {
    console.error("[native-host] Received SIGTERM")
    process.exit(0)
  })

  process.on("SIGINT", () => {
    console.error("[native-host] Received SIGINT")
    process.exit(0)
  })

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[native-host] Uncaught exception:", error.message)
  })

  // Keep the process running
  process.stdin.resume()

  console.error("[native-host] Native host started, waiting for extension connection...")
}

// Run if executed directly (when Chrome spawns us)
const isMain = process.argv[1]?.endsWith("native-host.ts") ||
               process.argv[1]?.endsWith("native-host") ||
               process.argv.includes("native-host")

if (isMain) {
  try {
    console.error("[native-host] Starting native host...")
    console.error("[native-host] argv:", process.argv)
    runNativeHost()
  } catch (error) {
    console.error("[native-host] Fatal error during startup:", error)
    process.exit(1)
  }
}
