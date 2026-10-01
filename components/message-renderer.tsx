'use client'

import React from 'react'
import type { Message } from '@v0-sdk/react'
import { cn } from '@/lib/utils'
import { PROSE_CLASS } from '@/lib/prose'
import { Response } from '@/components/ai-elements/response'
import { MessageParts } from '@/components/v0/message-parts'

interface MessageRendererProps {
  content: string | Message['parts']
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

  return <MessageParts parts={content} className={className} />
}
