'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message } from '@v0-sdk/react'
import { Loader } from '@/components/ai-elements/loader'
import { readV0Sse } from '@/lib/v0-stream'
import { MessageParts } from '@/components/v0/message-parts'

interface V0StreamingMessageProps {
  stream: ReadableStream<Uint8Array>
  onComplete?: (finalParts: Message['parts']) => void
  onChatData?: (chat: { id: string }, capability?: string) => void | Promise<void>
  onChunk?: () => void
  className?: string
}

/**
 * Consumes the SSE stream from `/api/chat` and renders the live v2 message.
 *
 * The v2 streaming API emits structured message parts as full snapshots. A
 * loader is shown until the first content arrives.
 */
export function V0StreamingMessage({
  stream,
  onComplete,
  onChatData,
  onChunk,
  className,
}: V0StreamingMessageProps) {
  const [parts, setParts] = useState<Message['parts']>([])

  const handlers = useRef({ onComplete, onChatData, onChunk })
  handlers.current = { onComplete, onChatData, onChunk }

  // A ReadableStream can be consumed only once; guard against React Strict
  // Mode's double effect invocation while keeping the reader alive across it.
  const startedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    if (!startedRef.current) {
      startedRef.current = true

      void readV0Sse(stream, {
        onUpdate: (snapshot) => {
          if (!mountedRef.current) return
          handlers.current.onChunk?.()
          setParts(snapshot.parts)
        },
        onChat: async (chat, capability) => {
          if (mountedRef.current) {
            await handlers.current.onChatData?.(chat, capability)
          }
        },
        onDone: (snapshot) => {
          if (!mountedRef.current) return
          const final = snapshot.parts
          setParts(final)
          handlers.current.onComplete?.(final)
        },
        onError: (message) => {
          console.error('Streaming error:', message)
          // Freeze whatever has streamed so far (read the latest via the
          // updater, not the stale `parts` captured when the effect first ran).
          setParts((latest) => {
            if (mountedRef.current) handlers.current.onComplete?.(latest)
            return latest
          })
        },
      }).catch((error) => {
        console.error('Streaming error:', error)
      })
    }

    return () => {
      mountedRef.current = false
    }
  }, [stream])

  // Nothing rendered yet — show a spinner so there's always visible progress.
  if (parts.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 py-2 text-sm text-muted-foreground"
      >
        <Loader size={16} />
        <span>Generating…</span>
      </div>
    )
  }

  return (
    <MessageParts parts={parts} isStreaming className={className} />
  )
}
