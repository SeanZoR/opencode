/**
 * Native Messaging Protocol
 *
 * Chrome Native Messaging uses length-prefixed JSON messages:
 * - First 4 bytes: message length (uint32 little-endian)
 * - Remaining bytes: JSON payload
 */

import { z } from "zod"

// Message schemas
export const RequestMessage = z.object({
  id: z.string(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
})
export type RequestMessage = z.infer<typeof RequestMessage>

export const ResponseMessage = z.object({
  id: z.string(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
})
export type ResponseMessage = z.infer<typeof ResponseMessage>

/**
 * Encode a message for native messaging protocol
 * @param message The message object to encode
 * @returns Buffer with length prefix + JSON payload
 */
export function encodeMessage(message: unknown): Buffer {
  const json = JSON.stringify(message)
  const payload = Buffer.from(json, "utf-8")
  const length = Buffer.alloc(4)
  length.writeUInt32LE(payload.length, 0)
  return Buffer.concat([length, payload])
}

/**
 * Decode a message from native messaging protocol
 * @param buffer Buffer containing length prefix + JSON payload
 * @returns Decoded message object and remaining buffer
 */
export function decodeMessage(buffer: Buffer): { message: unknown; remaining: Buffer } | null {
  // Need at least 4 bytes for length
  if (buffer.length < 4) {
    return null
  }

  const length = buffer.readUInt32LE(0)

  // Check if we have the full message
  if (buffer.length < 4 + length) {
    return null
  }

  const payload = buffer.subarray(4, 4 + length)
  const message = JSON.parse(payload.toString("utf-8"))
  const remaining = buffer.subarray(4 + length)

  return { message, remaining }
}

/**
 * Create a message reader for stdin
 * Handles buffering and message framing
 */
export function createMessageReader(
  stream: NodeJS.ReadStream,
  onMessage: (message: unknown) => void,
  onError: (error: Error) => void
) {
  let buffer: Buffer = Buffer.alloc(0)

  stream.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])

    // Process all complete messages in buffer
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

/**
 * Write a message to stdout
 */
export function writeMessage(stream: NodeJS.WriteStream, message: unknown): void {
  const encoded = encodeMessage(message)
  stream.write(encoded)
}
