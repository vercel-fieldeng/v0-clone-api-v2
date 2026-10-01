import 'server-only'

import {
  createV0Client,
  type Chat,
  type Message,
  type V0StreamResult,
  type V0StreamUpdate,
} from 'v0'

/**
 * Shared v0 Platform API **v2** client.
 *
 * Authentication is resolved automatically by the SDK: it uses `V0_API_KEY`
 * when present, and otherwise falls back to project-scoped Vercel OIDC auth for
 * server-side code deployed on Vercel. `V0_API_URL` can override the base URL
 * (useful for local proxies / staging).
 *
 * IMPORTANT: The `v0` package statically imports server-only modules
 * (`@vercel/oidc`), so this file must only ever be imported from server code
 * (route handlers, server actions). Client components consume the stream via
 * the plain SSE emitted by {@link v0StreamToSSE}.
 */
export const v0 = createV0Client(
  process.env.V0_API_URL ? { baseUrl: process.env.V0_API_URL } : {},
)

export type { Chat, Message }

/** A single event in the plain SSE stream produced by {@link v0StreamToSSE}. */
export type V0SseEvent =
  | {
      type: 'update' | 'done'
      parts: Message['parts']
      chat: Chat | null
      message: Message | null
      title: string | null
      capability?: string
    }
  | { type: 'error'; error: string }

interface V0ErrorShape {
  message?: string
  error?: { message?: string }
}

/**
 * Unwraps a hey-api style `{ data, error }` result. The v2 SDK returns errors
 * in-band rather than throwing, so callers use this to surface them.
 */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    const err = result.error as V0ErrorShape
    const message =
      err?.error?.message ||
      err?.message ||
      (typeof result.error === 'string' ? result.error : 'v0 API request failed')
    throw new Error(message)
  }
  return result.data as T
}

/**
 * Bridges a v2 {@link V0StreamResult} into a browser-friendly SSE response.
 *
 * Rather than forwarding the raw v0 SSE (which would require importing the
 * server-only `v0` package on the client to decode via `readV0Stream`), we
 * consume the stream on the server and re-emit full structured `parts`
 * snapshots as simple `data: <json>` events. The client only needs a tiny SSE
 * reader.
 */
export function v0StreamToSSE(
  result: V0StreamResult,
  options: {
    onChat?: (chat: Chat) => string | void | Promise<string | void>
  } = {},
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: V0SseEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      let last: V0StreamUpdate | undefined
      let recordedChatId: string | undefined
      let capability: string | undefined

      try {
        for await (const update of result.stream) {
          last = update

          if (update.chat && update.chat.id !== recordedChatId) {
            capability = (await options.onChat?.(update.chat)) ?? undefined
            recordedChatId = update.chat.id
          }

          send({
            type: 'update',
            parts: update.parts,
            chat: update.chat ?? null,
            message: update.message ?? null,
            title: update.title ?? null,
            capability,
          })
        }

        send({
          type: 'done',
          parts: last?.parts ?? [],
          chat: last?.chat ?? null,
          message: last?.message ?? null,
          title: last?.title ?? null,
          capability,
        })
      } catch (error) {
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Streaming failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
