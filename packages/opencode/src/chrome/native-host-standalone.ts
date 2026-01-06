/**
 * Native Messaging Host with HTTP Bridge (Standalone)
 *
 * This is a standalone version without dependencies on the rest of OpenCode.
 * It gets compiled to a binary for Chrome native messaging.
 */

const HTTP_PORT = 19875

// Pending requests waiting for responses from extension
const pendingRequests = new Map<
  string,
  {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }
>()

// Request timeout in ms
const REQUEST_TIMEOUT = 60000

// Track if extension is connected
let extensionConnected = false

// ============ Protocol ============

function encodeMessage(message: unknown): Buffer {
  const json = JSON.stringify(message)
  const payload = Buffer.from(json, "utf-8")
  const length = Buffer.alloc(4)
  length.writeUInt32LE(payload.length, 0)
  return Buffer.concat([length, payload])
}

function decodeMessage(buffer: Buffer): { message: unknown; remaining: Buffer } | null {
  if (buffer.length < 4) {
    return null
  }

  const length = buffer.readUInt32LE(0)

  if (buffer.length < 4 + length) {
    return null
  }

  const payload = buffer.subarray(4, 4 + length)
  const message = JSON.parse(payload.toString("utf-8"))
  const remaining = buffer.subarray(4 + length)

  return { message, remaining }
}

function createMessageReader(
  stream: NodeJS.ReadStream,
  onMessage: (message: unknown) => void,
  onError: (error: Error) => void
) {
  let buffer: Buffer = Buffer.alloc(0)

  stream.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])

    let result = decodeMessage(buffer)
    while (result) {
      try {
        onMessage(result.message)
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)))
      }
      buffer = Buffer.from(result.remaining)
      result = decodeMessage(buffer)
    }
  })

  stream.on("error", onError)
}

function writeMessage(stream: NodeJS.WriteStream, message: unknown): void {
  const encoded = encodeMessage(message)
  stream.write(encoded)
}

// ============ Extension Communication ============

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

function handleExtensionMessage(message: unknown): void {
  const msg = message as { id?: string; result?: unknown; error?: { message: string } }

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

  console.error("[native-host] Event from extension:", JSON.stringify(message))
}

// ============ HTTP Server ============

async function startHttpServer(): Promise<void> {
  const server = Bun.serve({
    port: HTTP_PORT,
    async fetch(req) {
      const url = new URL(req.url)

      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }

      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders })
      }

      if (url.pathname === "/health") {
        return Response.json(
          { ok: true, extensionConnected },
          { headers: corsHeaders }
        )
      }

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

// ============ Main ============

function runNativeHost(): void {
  extensionConnected = true

  startHttpServer()

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

  process.stdin.on("end", () => {
    console.error("[native-host] stdin ended - extension disconnected")
    extensionConnected = false
  })

  process.stdin.on("close", () => {
    console.error("[native-host] stdin closed")
  })

  process.on("SIGTERM", () => {
    console.error("[native-host] Received SIGTERM")
    process.exit(0)
  })

  process.on("SIGINT", () => {
    console.error("[native-host] Received SIGINT")
    process.exit(0)
  })

  process.on("uncaughtException", (error) => {
    console.error("[native-host] Uncaught exception:", error.message)
  })

  process.stdin.resume()

  console.error("[native-host] Native host started, waiting for extension connection...")
}

// Start
try {
  console.error("[native-host] Starting native host...")
  runNativeHost()
} catch (error) {
  console.error("[native-host] Fatal error during startup:", error)
  process.exit(1)
}
