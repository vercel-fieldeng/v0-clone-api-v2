'use client'

import React from 'react'
import { Message, MessageBinaryFormat } from '@v0-sdk/react'
import { cn } from '@/lib/utils'
import { PROSE_CLASS } from '@/lib/prose'
import { Response } from '@/components/ai-elements/response'
import { MessageParts, type V0MessagePart } from '@/components/v0/message-parts'
import { sharedComponents } from './shared-components'

/**
 * v2 has two message shapes depending on the source:
 *  - The streaming API (`chats.createStream` / `messages.sendStream`) emits the
 *    v0 **binary format** (`[[0, [...]], [1, {...}]]`) — rendered by
 *    `@v0-sdk/react`'s `Message`.
 *  - `messages.list` (loaded history) returns clean `{ type, ... }[]` parts —
 *    rendered by `MessageParts`.
 */
export function isBinaryFormat(
  content: unknown,
): content is MessageBinaryFormat {
  return (
    Array.isArray(content) && content.length > 0 && Array.isArray(content[0])
  )
}

// Strip v0's internal `[V0_FILE]` markers and shell placeholders from the
// binary content before rendering.
export function preprocessBinary(
  content: MessageBinaryFormat,
): MessageBinaryFormat {
  if (!Array.isArray(content)) return content

  return content.map((row) => {
    if (!Array.isArray(row)) return row
    return row.map((item) => {
      if (typeof item === 'string') {
        let processed = item.replace(/\[V0_FILE\][^:]*:file="[^"]*"\n?/g, '')
        processed = processed.replace(/\[V0_FILE\][^\n]*\n?/g, '')
        processed = processed.replace(/\.\.\. shell \.\.\./g, '')
        processed = processed.replace(/\.\.\.\s*shell\s*\.\.\./g, '')
        processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n')
        processed = processed.replace(/^\s*\n+/g, '')
        processed = processed.replace(/\n+\s*$/g, '')
        processed = processed.trim()
        if (!processed || processed.match(/^\s*$/)) return ''
        return processed
      }
      return item
    }) as [number, ...any[]]
  })
}

interface MessageRendererProps {
  content: string | MessageBinaryFormat | V0MessagePart[]
  messageId?: string
  role: 'user' | 'assistant'
  className?: string
}

export function MessageRenderer({
  content,
  messageId,
  role,
  className,
}: MessageRendererProps) {
  if (typeof content === 'string') {
    // Assistant prose renders as markdown; user text stays plain.
    if (role === 'assistant') {
      return <Response className={cn(PROSE_CLASS, className)}>{content}</Response>
    }
    return (
      <div className={className}>
        <p className="mb-4 leading-relaxed whitespace-pre-wrap text-foreground">
          {content}
        </p>
      </div>
    )
  }

  // Streaming binary format -> @v0-sdk/react Message
  if (isBinaryFormat(content)) {
    return (
      <Message
        content={preprocessBinary(content)}
        messageId={messageId}
        role={role}
        className={className}
        components={sharedComponents}
      />
    )
  }

  // Loaded history -> clean parts
  return <MessageParts parts={content as V0MessagePart[]} className={className} />
}
