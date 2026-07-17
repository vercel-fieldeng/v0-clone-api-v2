/**
 * A single decoded snapshot from the v0 SSE stream. `parts` is always the full
 * current state of the message (v2 streams emit complete snapshots, not deltas).
 *
 * NOTE: the streaming API emits parts in the v0 *binary format*
 * (`[[0,[...]],[1,{...}]]`), which is a different shape than the clean
 * `{ type, ... }[]` returned by `messages.list`. Typed loosely here; the
 * renderer (`@v0-sdk/react` `Message`) understands the binary shape.
 */
export interface V0StreamSnapshot {
  parts: unknown[]
  chat: { id: string } | null
  title: string | null
}

interface V0StreamHandlers {
  onUpdate?: (snapshot: V0StreamSnapshot) => void
  onChat?: (chat: { id: string }) => void
  onDone?: (snapshot: V0StreamSnapshot) => void
  onError?: (message: string) => void
}

/**
 * Client-side reader for the plain SSE emitted by the `/api/chat` route
 * (see `lib/v0.ts#v0StreamToSSE`). Each `data:` line is a JSON snapshot with the
 * full `parts` array; this parser dispatches update/done/error events and fires
 * `onChat` once when the chat id first appears.
 *
 * This intentionally does NOT use the `v0` package's `readV0Stream` helper,
 * which would pull the server-only SDK (and `@vercel/oidc`) into the browser.
 */
export async function readV0Sse(
  stream: ReadableStream<Uint8Array>,
  handlers: V0StreamHandlers,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let notifiedChatId: string | null = null

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const dataLine = rawEvent
          .split('\n')
          .find((line) => line.startsWith('data:'))
        if (!dataLine) continue

        const json = dataLine.slice('data:'.length).trim()
        if (!json) continue

        let event: {
          type: 'update' | 'done' | 'error'
          parts?: unknown[]
          chat?: { id: string } | null
          title?: string | null
          error?: string
        }
        try {
          event = JSON.parse(json)
        } catch {
          continue
        }

        if (event.type === 'error') {
          handlers.onError?.(event.error || 'Streaming failed')
          continue
        }

        const snapshot: V0StreamSnapshot = {
          parts: event.parts ?? [],
          chat: event.chat ?? null,
          title: event.title ?? null,
        }

        if (snapshot.chat?.id && snapshot.chat.id !== notifiedChatId) {
          notifiedChatId = snapshot.chat.id
          handlers.onChat?.(snapshot.chat)
        }

        if (event.type === 'update') {
          handlers.onUpdate?.(snapshot)
        } else if (event.type === 'done') {
          handlers.onDone?.(snapshot)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
