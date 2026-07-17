'use client'

import { useEffect, useRef, useState } from 'react'
import { Message, MessageBinaryFormat } from '@v0-sdk/react'
import { Loader } from '@/components/ai-elements/loader'
import { readV0Sse } from '@/lib/v0-stream'
import {
  isBinaryFormat,
  preprocessBinary,
} from '@/components/message-renderer'
import { sharedComponents } from '@/components/shared-components'

interface V0StreamingMessageProps {
  stream: ReadableStream<Uint8Array>
  onComplete?: (finalParts: MessageBinaryFormat) => void
  onChatData?: (chat: { id: string }) => void
  onChunk?: () => void
  className?: string
}

/**
 * Consumes the SSE stream from `/api/chat` and renders the live v2 message.
 *
 * The v2 streaming API emits the v0 **binary format** (`[[0,[...]],[1,{...}]]`)
 * as full snapshots, which `@v0-sdk/react`'s `Message` renders. A loader is
 * shown until the first content arrives so there's always visible progress.
 */
export function V0StreamingMessage({
  stream,
  onComplete,
  onChatData,
  onChunk,
  className,
}: V0StreamingMessageProps) {
  const [parts, setParts] = useState<MessageBinaryFormat>([])

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

      readV0Sse(stream, {
        onUpdate: (snapshot) => {
          if (!mountedRef.current) return
          handlers.current.onChunk?.()
          setParts(snapshot.parts as MessageBinaryFormat)
        },
        onChat: (chat) => {
          if (mountedRef.current) handlers.current.onChatData?.(chat)
        },
        onDone: (snapshot) => {
          if (!mountedRef.current) return
          const final = snapshot.parts as MessageBinaryFormat
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
      })
    }

    return () => {
      mountedRef.current = false
    }
  }, [stream])

  // Nothing rendered yet — show a spinner so there's always visible progress.
  if (!isBinaryFormat(parts)) {
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
    <Message
      content={preprocessBinary(parts)}
      role="assistant"
      className={className}
      components={sharedComponents}
    />
  )
}
